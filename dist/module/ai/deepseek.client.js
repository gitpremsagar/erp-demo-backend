"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeepSeekError = void 0;
exports.getDeepSeekConfig = getDeepSeekConfig;
exports.isDeepSeekConfigured = isDeepSeekConfigured;
exports.chatCompletion = chatCompletion;
class DeepSeekError extends Error {
    constructor(code, message, status) {
        super(message);
        this.name = "DeepSeekError";
        this.code = code;
        this.status = status;
    }
}
exports.DeepSeekError = DeepSeekError;
function getDeepSeekConfig() {
    const apiKey = (process.env.DEEPSEEK_API_KEY ?? "").trim();
    const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com")
        .trim()
        .replace(/\/+$/, "");
    const model = (process.env.DEEPSEEK_MODEL ?? "deepseek-flash").trim() || "deepseek-flash";
    const reasonerModel = (process.env.DEEPSEEK_REASONER_MODEL ?? "deepseek-v4-pro").trim() || "deepseek-v4-pro";
    const thinking = (process.env.DEEPSEEK_THINKING ?? "disabled").trim().toLowerCase() === "enabled"
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
function isDeepSeekConfigured() {
    const enabled = (process.env.AI_ENABLED ?? "true").trim().toLowerCase() !== "false";
    return enabled && Boolean(getDeepSeekConfig().apiKey);
}
function mapUsage(raw) {
    if (!raw)
        return undefined;
    return {
        promptTokens: raw.prompt_tokens,
        completionTokens: raw.completion_tokens,
        totalTokens: raw.total_tokens,
    };
}
function mapHttpError(status, body) {
    const providerMessage = typeof body?.error?.message === "string" ? body.error.message.slice(0, 300) : "";
    if (status === 401 || status === 403) {
        return new DeepSeekError("AUTH", "DeepSeek authentication failed. Check DEEPSEEK_API_KEY.", status);
    }
    if (status === 402) {
        return new DeepSeekError("INSUFFICIENT_BALANCE", "DeepSeek account has insufficient balance.", status);
    }
    if (status === 429) {
        return new DeepSeekError("RATE_LIMITED", "DeepSeek is rate limiting requests. Please try again shortly.", status);
    }
    if (status === 400 || status === 422) {
        return new DeepSeekError("INVALID_REQUEST", providerMessage || "DeepSeek rejected the request.", status);
    }
    return new DeepSeekError("PROVIDER_ERROR", providerMessage || "DeepSeek is unavailable right now.", status);
}
async function parseJsonResponse(response) {
    try {
        return (await response.json());
    }
    catch {
        return null;
    }
}
async function postChatCompletion(config, body, timeoutMs, externalSignal) {
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
    }
    catch (error) {
        if (error instanceof DeepSeekError)
            throw error;
        if (controller.signal.aborted) {
            throw new DeepSeekError("TIMEOUT", "DeepSeek request timed out.");
        }
        throw new DeepSeekError("PROVIDER_ERROR", "Failed to reach DeepSeek.");
    }
    finally {
        clearTimeout(timer);
        externalSignal?.removeEventListener("abort", onExternalAbort);
    }
}
async function chatCompletion(options) {
    const config = getDeepSeekConfig();
    if (!config.apiKey) {
        throw new DeepSeekError("NOT_CONFIGURED", "DEEPSEEK_API_KEY is not configured.");
    }
    const thinking = options.thinking ?? config.thinking;
    const timeoutMs = options.timeoutMs ?? (Number(process.env.AI_REQUEST_TIMEOUT_MS) || 35000);
    const buildBody = (opts) => {
        const body = {
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
            }
            else {
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
        return await postChatCompletion(config, buildBody({ includeResponseFormat: true, includeThinking: true }), timeoutMs, options.signal);
    }
    catch (error) {
        if (!(error instanceof DeepSeekError) || error.code !== "INVALID_REQUEST") {
            throw error;
        }
        // Some accounts/models reject response_format; retry without it.
        if (options.responseFormat) {
            try {
                return await postChatCompletion(config, buildBody({ includeResponseFormat: false, includeThinking: true }), timeoutMs, options.signal);
            }
            catch (secondError) {
                if (!(secondError instanceof DeepSeekError) ||
                    secondError.code !== "INVALID_REQUEST") {
                    throw secondError;
                }
            }
        }
        // Finally, retry without the optional thinking/temperature parameters.
        return postChatCompletion(config, buildBody({ includeResponseFormat: false, includeThinking: false }), timeoutMs, options.signal);
    }
}
//# sourceMappingURL=deepseek.client.js.map