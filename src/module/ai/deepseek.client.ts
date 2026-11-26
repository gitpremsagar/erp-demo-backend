import type { AiUsage } from "./ai.type";

export type DeepSeekThinking = "enabled" | "disabled";

export interface DeepSeekToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export type DeepSeekContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface DeepSeekMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | DeepSeekContentPart[] | null;
  reasoning_content?: string | null;
  tool_calls?: DeepSeekToolCall[];
  tool_call_id?: string;
  name?: string;
}

/** Model responses are text; vision requests may have had array content. */
export function messageText(content: DeepSeekMessage["content"]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((part): part is Extract<DeepSeekContentPart, { type: "text" }> =>
        part.type === "text"
      )
      .map((part) => part.text)
      .join("\n");
  }
  return "";
}

export interface DeepSeekChatResult {
  message: DeepSeekMessage;
  finishReason: string;
  usage?: AiUsage;
}

export type DeepSeekErrorCode =
  | "NOT_CONFIGURED"
  | "AUTH"
  | "INSUFFICIENT_BALANCE"
  | "RATE_LIMITED"
  | "INVALID_REQUEST"
  | "TIMEOUT"
  | "PROVIDER_ERROR"
  | "BAD_RESPONSE";

export class DeepSeekError extends Error {
  code: DeepSeekErrorCode;
  status?: number;

  constructor(code: DeepSeekErrorCode, message: string, status?: number) {
    super(message);
    this.name = "DeepSeekError";
    this.code = code;
    this.status = status;
  }
}

export interface DeepSeekConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  reasonerModel: string;
  thinking: DeepSeekThinking;
  reasoningEffort: string;
  temperature: number;
  maxTokens: number;
}

export function getDeepSeekConfig(): DeepSeekConfig {
  const apiKey = (process.env.DEEPSEEK_API_KEY ?? "").trim();
  const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com")
    .trim()
    .replace(/\/+$/, "");
  const model = (process.env.DEEPSEEK_MODEL ?? "deepseek-flash").trim() || "deepseek-flash";
  const reasonerModel =
    (process.env.DEEPSEEK_REASONER_MODEL ?? "deepseek-v4-pro").trim() || "deepseek-v4-pro";
  const thinking: DeepSeekThinking =
    (process.env.DEEPSEEK_THINKING ?? "disabled").trim().toLowerCase() === "enabled"
      ? "enabled"
      : "disabled";

  return {
    apiKey,
    baseUrl,
    model,
    reasonerModel,
    thinking,
    reasoningEffort: (process.env.DEEPSEEK_REASONING_EFFORT ?? "low").trim() || "low",
    temperature: Number(process.env.DEEPSEEK_TEMPERATURE) || 0.2,
    maxTokens: Number(process.env.DEEPSEEK_MAX_TOKENS) || 1500,
  };
}

export function isDeepSeekConfigured(): boolean {
  const enabled = (process.env.AI_ENABLED ?? "true").trim().toLowerCase() !== "false";
  return enabled && Boolean(getDeepSeekConfig().apiKey);
}

export interface ChatCompletionOptions {
  messages: DeepSeekMessage[];
  tools?: unknown[];
  responseFormat?: { type: "json_object" };
  maxTokens?: number;
  temperature?: number;
  thinking?: DeepSeekThinking;
  model?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

type RawChatResponse = {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string | null;
      reasoning_content?: string | null;
      tool_calls?: DeepSeekToolCall[];
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
  };
};

function mapUsage(raw: RawChatResponse["usage"]): AiUsage | undefined {
  if (!raw) return undefined;
  return {
    promptTokens: raw.prompt_tokens,
    completionTokens: raw.completion_tokens,
    totalTokens: raw.total_tokens,
  };
}

function mapHttpError(status: number, body: RawChatResponse | null): DeepSeekError {
  const providerMessage =
    typeof body?.error?.message === "string" ? body.error.message.slice(0, 300) : "";

  if (status === 401 || status === 403) {
    return new DeepSeekError(
      "AUTH",
      "DeepSeek authentication failed. Check DEEPSEEK_API_KEY.",
      status
    );
  }
  if (status === 402) {
    return new DeepSeekError(
      "INSUFFICIENT_BALANCE",
      "DeepSeek account has insufficient balance.",
      status
    );
  }
  if (status === 429) {
    return new DeepSeekError(
      "RATE_LIMITED",
      "DeepSeek is rate limiting requests. Please try again shortly.",
      status
    );
  }
  if (status === 400 || status === 422) {
    return new DeepSeekError(
      "INVALID_REQUEST",
      providerMessage || "DeepSeek rejected the request.",
      status
    );
  }
  return new DeepSeekError(
    "PROVIDER_ERROR",
    providerMessage || "DeepSeek is unavailable right now.",
    status
  );
}

async function parseJsonResponse(response: Response): Promise<RawChatResponse | null> {
  try {
    return (await response.json()) as RawChatResponse;
  } catch {
    return null;
  }
}

async function postChatCompletion(
  config: DeepSeekConfig,
  body: Record<string, unknown>,
  timeoutMs: number,
  externalSignal?: AbortSignal
): Promise<DeepSeekChatResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener("abort", onExternalAbort);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const raw = await parseJsonResponse(response);

    if (!response.ok) {
      throw mapHttpError(response.status, raw);
    }

    const choice = raw?.choices?.[0];
    const message = choice?.message;
    if (!message) {
      throw new DeepSeekError("BAD_RESPONSE", "DeepSeek returned an empty response.");
    }

    return {
      message: {
        role: "assistant",
        content: message.content ?? null,
        reasoning_content: message.reasoning_content ?? null,
        tool_calls: message.tool_calls,
      },
      finishReason: choice?.finish_reason ?? "stop",
      usage: mapUsage(raw?.usage),
    };
  } catch (error) {
    if (error instanceof DeepSeekError) throw error;
    if (controller.signal.aborted) {
      throw new DeepSeekError("TIMEOUT", "DeepSeek request timed out.");
    }
    throw new DeepSeekError("PROVIDER_ERROR", "Failed to reach DeepSeek.");
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
}

export async function chatCompletion(
  options: ChatCompletionOptions
): Promise<DeepSeekChatResult> {
  const config = getDeepSeekConfig();
  if (!config.apiKey) {
    throw new DeepSeekError("NOT_CONFIGURED", "DEEPSEEK_API_KEY is not configured.");
  }

  const thinking = options.thinking ?? config.thinking;
  const timeoutMs =
    options.timeoutMs ?? (Number(process.env.AI_REQUEST_TIMEOUT_MS) || 35000);

  const buildBody = (opts: {
    includeResponseFormat: boolean;
    includeThinking: boolean;
  }): Record<string, unknown> => {
    const body: Record<string, unknown> = {
      model: options.model ?? config.model,
      messages: options.messages,
      stream: false,
      max_tokens: options.maxTokens ?? config.maxTokens,
    };

    if (opts.includeThinking) {
      body.thinking =
        thinking === "enabled"
          ? { type: "enabled" }
          : { type: "disabled" };

      if (thinking === "enabled") {
        body.reasoning_effort = config.reasoningEffort;
      } else {
        body.temperature = options.temperature ?? config.temperature;
      }
    }

    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools;
      body.tool_choice = "auto";
    }

    if (opts.includeResponseFormat && options.responseFormat) {
      body.response_format = options.responseFormat;
    }

    return body;
  };

  try {
    return await postChatCompletion(
      config,
      buildBody({ includeResponseFormat: true, includeThinking: true }),
      timeoutMs,
      options.signal
    );
  } catch (error) {
    if (!(error instanceof DeepSeekError) || error.code !== "INVALID_REQUEST") {
      throw error;
    }

    // Some accounts/models reject response_format; retry without it.
    if (options.responseFormat) {
      try {
        return await postChatCompletion(
          config,
          buildBody({ includeResponseFormat: false, includeThinking: true }),
          timeoutMs,
          options.signal
        );
      } catch (secondError) {
        if (
          !(secondError instanceof DeepSeekError) ||
          secondError.code !== "INVALID_REQUEST"
        ) {
          throw secondError;
        }
      }
    }

    // Finally, retry without the optional thinking/temperature parameters.
    return postChatCompletion(
      config,
      buildBody({ includeResponseFormat: false, includeThinking: false }),
      timeoutMs,
      options.signal
    );
  }
}
