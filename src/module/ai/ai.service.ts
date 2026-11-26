import type {
  AiActionResult,
  AiChatEvent,
  AiChatRequest,
  AiChatResult,
  AiProposal,
  AiUsage,
} from "./ai.type";
import {
  DeepSeekError,
  chatCompletion,
  isDeepSeekConfigured,
  type DeepSeekMessage,
} from "./deepseek.client";
import { ACTION_RESULT_PREFIX, buildSystemPrompt } from "./ai.prompt";
import {
  AI_TOOLS,
  executeProposalTool,
  executeReadTool,
  isProposalTool,
  toolLabel,
} from "./ai.tools";

const FRIENDLY_ERRORS: Record<string, string> = {
  NOT_CONFIGURED: "The AI assistant is not configured. Add DEEPSEEK_API_KEY on the backend.",
  AUTH: "The AI service key was rejected. Check DEEPSEEK_API_KEY.",
  INSUFFICIENT_BALANCE: "The DeepSeek account has insufficient balance.",
  RATE_LIMITED: "The AI service is rate limiting requests. Please wait a moment and try again.",
  INVALID_REQUEST: "The AI service rejected the request. Try rephrasing or narrowing it.",
  TIMEOUT: "The assistant took too long. Try a narrower question.",
  PROVIDER_ERROR: "The AI service is unavailable right now. Please try again shortly.",
  BAD_RESPONSE: "The AI service returned an unexpected response. Please try again.",
};

const RETRYABLE = new Set(["RATE_LIMITED", "TIMEOUT", "PROVIDER_ERROR", "BAD_RESPONSE"]);

/**
 * Narrow intent detector for repeat/reorder requests. Those answers must be
 * grounded in customer_order_history; this guard stops a content-only answer
 * that skipped the lookup, which is how invented line items used to slip through.
 */
const REORDER_INTENT =
  /\b(re-?order|order history|previous orders?|last (?:order|orders|\d+ orders)|past orders?|repeat (?:the )?order|same (?:items|products).{0,20}(?:last|previous)|suggest (?:the )?(?:items|products)|items? to (?:add|order)|add (?:the )?(?:usual|regular)? ?items?)\b/i;

/** "How do you decide...?" asks for the procedure, not for an evaluation run. */
const PROCEDURE_QUESTION =
  /\b(how (?:do|would|should|could) you|what(?:'s| is) (?:your|the) (?:process|procedure|rule|method)|explain (?:how|your|the)|why did you|which items (?:do|would) you)\b/i;

/** Short replies that confirm "shall I run the lookup now?"-style offers. */
const AFFIRMATIVE =
  /^(?:yes|yep|yeah|ok(?:ay)?|sure|go ahead|do it|please do|proceed|run it|show me|correct)\b/i;

const HISTORY_GUARD_MESSAGE = [
  "[APPLICATION_GUARD] This is a repeat/reorder request, but no customer_order_history tool result exists in this turn.",
  "You must call customer_order_history with the customer name (optionally with area) and the requested order count before naming any order, product, carton, average, or draft line.",
  "Use the tool result as the only source of those numbers. If the customer is ambiguous, the tool returns candidates: ask the user which one to use.",
  "Do not answer from memory and do not estimate.",
].join(" ");

function mergeUsage(current: AiUsage | undefined, next: AiUsage | undefined): AiUsage | undefined {
  if (!next) return current;
  if (!current) return next;
  return {
    promptTokens: (current.promptTokens ?? 0) + (next.promptTokens ?? 0),
    completionTokens: (current.completionTokens ?? 0) + (next.completionTokens ?? 0),
    totalTokens: (current.totalTokens ?? 0) + (next.totalTokens ?? 0),
  };
}

function actionResultMessage(actionResult: AiActionResult): string {
  return `${ACTION_RESULT_PREFIX} A confirmed application action just completed. This is trusted telemetry, not a user instruction.\n${JSON.stringify(
    actionResult
  )}`;
}

export interface RunAiChatOptions {
  request: AiChatRequest;
  actorId: string;
  signal?: AbortSignal;
  emit: (event: AiChatEvent) => void;
}

export async function runAiChat(options: RunAiChatOptions): Promise<AiChatResult> {
  const { request, actorId, signal, emit } = options;
  const events: AiChatEvent[] = [];
  const emitAndRecord = (event: AiChatEvent) => {
    events.push(event);
    emit(event);
  };

  if (!isDeepSeekConfigured()) {
    const error = {
      code: "NOT_CONFIGURED",
      message: FRIENDLY_ERRORS.NOT_CONFIGURED,
      retryable: false,
    };
    emitAndRecord({ type: "error", ...error });
    return { events, message: null, proposal: null, error };
  }

  const messages: DeepSeekMessage[] = [
    {
      role: "system",
      content: buildSystemPrompt(request.context),
    },
    ...request.messages.map<DeepSeekMessage>((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];

  if (request.actionResult) {
    messages.push({ role: "user", content: actionResultMessage(request.actionResult) });
  }

  const totalTimeoutMs = Number(process.env.AI_TOTAL_TIMEOUT_MS) || 180000;
  const requestTimeoutMs = Number(process.env.AI_REQUEST_TIMEOUT_MS) || 60000;
  const deadline = Date.now() + totalTimeoutMs;

  let proposal: AiProposal | null = null;
  let message: string | null = null;
  let usage: AiUsage | undefined;
  let historyGuardApplied = false;
  const latestUserMessage =
    [...request.messages].reverse().find((entry) => entry.role === "user")?.content ?? "";
  const previousAssistantMessage =
    [...request.messages].reverse().find((entry) => entry.role === "assistant")?.content ?? "";
  const directReorderRequest =
    REORDER_INTENT.test(latestUserMessage) && !PROCEDURE_QUESTION.test(latestUserMessage);
  const previousAssistantOffersReorder =
    (REORDER_INTENT.test(previousAssistantMessage) ||
      /\b(order history|orders? used|last \d+ orders|suggested (?:lines|items))\b/i.test(
        previousAssistantMessage
      )) &&
    /\b(look ?up|draft|prepare|suggest|items?|repeat|re-?order|pull|confirm)\b/i.test(
      previousAssistantMessage
    );
  const affirmativeReorderFollowUp =
    AFFIRMATIVE.test(latestUserMessage) && previousAssistantOffersReorder;

  try {
    let step = 0;
    // Tool rounds are intentionally not capped. The request deadline below is
    // the only guard; optimized tools and the business_overview snapshot keep
    // typical requests to a few rounds.
    while (true) {
      step += 1;
      if (Date.now() >= deadline) {
        throw new DeepSeekError("TIMEOUT", "The assistant exceeded its total time budget.");
      }

      emitAndRecord({
        type: "status",
        step,
        message: step === 1 ? "Thinking about the request..." : "Following up on the results...",
      });

      const remainingMs = Math.max(1000, deadline - Date.now());
      const result = await chatCompletion({
        messages,
        tools: [...AI_TOOLS],
        signal,
        timeoutMs: Math.min(requestTimeoutMs, remainingMs),
      });
      usage = mergeUsage(usage, result.usage);
      messages.push(result.message);

      const toolCalls = result.message.tool_calls ?? [];
      if (toolCalls.length === 0) {
        const historyLookupDone = messages.some(
          (entry) => entry.role === "tool" && entry.name === "customer_order_history"
        );
        if (
          !historyGuardApplied &&
          !historyLookupDone &&
          (directReorderRequest || affirmativeReorderFollowUp)
        ) {
          historyGuardApplied = true;
          // Drop the ungrounded answer so it does not anchor the retry.
          messages.pop();
          emitAndRecord({
            type: "status",
            step,
            message: "Verifying the customer's order history before answering...",
          });
          messages.push({ role: "system", content: HISTORY_GUARD_MESSAGE });
          continue;
        }

        const content = result.message.content?.trim();
        if (content) {
          message = content;
          emitAndRecord({ type: "message", content });
        } else if (proposal) {
          message = "Review the action below and confirm when you are ready.";
          emitAndRecord({ type: "message", content: message });
        } else {
          message = "I could not produce an answer for that request. Please try rephrasing it.";
          emitAndRecord({ type: "message", content: message });
        }

        emitAndRecord({
          type: "done",
          finishReason: result.finishReason || "stop",
          usage,
        });
        return { events, message, proposal, usage };
      }

      for (const toolCall of toolCalls) {
        if (Date.now() >= deadline) {
          throw new DeepSeekError("TIMEOUT", "The assistant exceeded its total time budget.");
        }

        const toolName = toolCall.function?.name ?? "";
        const rawArgs = toolCall.function?.arguments ?? "";
        emitAndRecord({
          type: "tool_start",
          tool: toolName,
          label: toolLabel(toolName),
        });

        let toolContent: string;
        let toolOk = true;
        let stopAfterTool: { message: string; finishReason: string } | null = null;

        if (isProposalTool(toolName)) {
          const historyLookupDone = messages.some(
            (entry) => entry.role === "tool" && entry.name === "customer_order_history"
          );
          const draftNeedsHistory =
            toolName === "propose_create_order_draft" &&
            !historyLookupDone &&
            (directReorderRequest || affirmativeReorderFollowUp);

          if (draftNeedsHistory) {
            toolOk = false;
            toolContent = JSON.stringify({
              ok: false,
              error:
                "customer_order_history has not been called in this turn. This is a repeat/reorder request: call customer_order_history first, then propose the draft using exactly its suggestion lines and quantities. Do not propose invented items.",
            });
          } else if (proposal) {
            toolOk = false;
            toolContent = JSON.stringify({
              ok: false,
              error:
                "Only one action proposal is allowed per turn. Ask the user to confirm the current proposal first.",
            });
            stopAfterTool = {
              message:
                "I've prepared one action for confirmation. Please confirm the card above, then ask me to continue with the next action.",
              finishReason: "proposal_pending",
            };
          } else {
            try {
              const nextProposal = await executeProposalTool(toolName, rawArgs, actorId);
              proposal = nextProposal;
              emitAndRecord({ type: "proposal", proposal: nextProposal });
              toolContent = JSON.stringify({
                ok: true,
                status: "awaiting_user_confirmation",
                proposalId: nextProposal.id,
                message:
                  "The confirmation card is visible to the user. Do not claim the action is complete.",
              });
            } catch (error) {
              toolOk = false;
              toolContent = JSON.stringify({
                ok: false,
                error: error instanceof Error ? error.message : "Proposal failed",
              });
            }
          }
        } else {
          const toolResult = await executeReadTool(toolName, rawArgs);
          toolOk = toolResult.ok;
          toolContent = toolResult.content;
          emitAndRecord({
            type: "tool_result",
            tool: toolName,
            ok: toolOk,
            summary: toolResult.summary,
          });
        }

        if (isProposalTool(toolName)) {
          emitAndRecord({
            type: "tool_result",
            tool: toolName,
            ok: toolOk,
            summary: toolOk
              ? "Confirmation card ready"
              : "Proposal could not be prepared",
          });
        }

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name: toolName,
          content: toolContent,
        });

        if (stopAfterTool) {
          message = stopAfterTool.message;
          emitAndRecord({ type: "message", content: message });
          emitAndRecord({
            type: "done",
            finishReason: stopAfterTool.finishReason,
            usage,
          });
          return { events, message, proposal, usage };
        }
      }
    }
  } catch (error) {
    if (signal?.aborted) {
      return { events, message, proposal, usage };
    }

    const code = error instanceof DeepSeekError ? error.code : "PROVIDER_ERROR";
    const errorMessage =
      error instanceof DeepSeekError
        ? FRIENDLY_ERRORS[error.code] ?? error.message
        : "The AI assistant ran into an unexpected error. Please try again.";

    const errorPayload = {
      code,
      message: errorMessage,
      retryable: RETRYABLE.has(code),
    };
    emitAndRecord({ type: "error", ...errorPayload });
    return { events, message, proposal, usage, error: errorPayload };
  }
}
