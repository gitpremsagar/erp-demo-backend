"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postAiInsights = exports.postAiLineItems = exports.postAiInvoiceParse = exports.postAiChat = exports.getAiStatus = void 0;
const ai_schema_1 = require("./ai.schema");
const deepseek_client_1 = require("./deepseek.client");
const ai_service_1 = require("./ai.service");
const ai_sse_1 = require("./ai.sse");
const ai_invoiceParse_service_1 = require("./ai.invoiceParse.service");
const ai_lineItems_service_1 = require("./ai.lineItems.service");
const ai_insights_service_1 = require("./ai.insights.service");
function actorId(req) {
    const user = req.user;
    return typeof user?.id === "string" && user.id ? user.id : null;
}
const getAiStatus = (_req, res) => {
    const config = (0, deepseek_client_1.getDeepSeekConfig)();
    const body = {
        enabled: (0, deepseek_client_1.isDeepSeekConfigured)(),
        model: config.model,
        capabilities: ["chat", "invoice_parse", "line_items", "insights"],
        deterministicFallback: true,
        limits: {
            maxMessages: 30,
            maxMessageChars: 4000,
            maxInvoiceRows: 300,
        },
    };
    res.json(body);
};
exports.getAiStatus = getAiStatus;
const postAiChat = async (req, res) => {
    const parsed = ai_schema_1.AiChatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            message: "Validation failed",
            errors: parsed.error.flatten().fieldErrors,
        });
        return;
    }
    const userId = actorId(req);
    if (!userId) {
        res.status(401).json({ message: "Authentication required" });
        return;
    }
    if (!(0, deepseek_client_1.isDeepSeekConfigured)()) {
        res.status(503).json({
            message: "The AI assistant is not configured. Add DEEPSEEK_API_KEY to the backend environment.",
        });
        return;
    }
    const request = parsed.data;
    const controller = new AbortController();
    const onClose = () => controller.abort();
    if (request.mode === "json") {
        try {
            const events = [];
            const result = await (0, ai_service_1.runAiChat)({
                request,
                actorId: userId,
                signal: controller.signal,
                emit: (event) => events.push(event),
            });
            res.json({
                events: result.events,
                message: result.message,
                proposal: result.proposal,
                usage: result.usage,
                error: result.error ?? null,
            });
        }
        catch (error) {
            console.error("AI chat (json) failed:\n", error);
            res.status(500).json({ message: "AI chat failed" });
        }
        return;
    }
    (0, ai_sse_1.initSse)(res);
    const stopHeartbeat = (0, ai_sse_1.startSseHeartbeat)(res);
    // res "close" fires when the client disconnects; req "close" can fire
    // as soon as the request body completes, which would abort the stream early.
    res.on("close", onClose);
    try {
        await (0, ai_service_1.runAiChat)({
            request,
            actorId: userId,
            signal: controller.signal,
            emit: (event) => (0, ai_sse_1.writeSseEvent)(res, event),
        });
    }
    catch (error) {
        console.error("AI chat (sse) failed:\n", error);
        (0, ai_sse_1.writeSseEvent)(res, {
            type: "error",
            code: "PROVIDER_ERROR",
            message: "The AI assistant ran into an unexpected error. Please try again.",
            retryable: true,
        });
    }
    finally {
        stopHeartbeat();
        res.off("close", onClose);
        if (!res.writableEnded && !res.destroyed)
            res.end();
    }
};
exports.postAiChat = postAiChat;
const postAiInvoiceParse = async (req, res) => {
    const parsed = ai_schema_1.AiInvoiceParseRequestSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            message: "Validation failed",
            errors: parsed.error.flatten().fieldErrors,
        });
        return;
    }
    try {
        const result = await (0, ai_invoiceParse_service_1.parseInvoiceRows)(parsed.data);
        res.json(result);
    }
    catch (error) {
        console.error("AI invoice parse failed:\n", error);
        res.status(500).json({ message: "Invoice parsing failed" });
    }
};
exports.postAiInvoiceParse = postAiInvoiceParse;
const postAiLineItems = async (req, res) => {
    const parsed = ai_schema_1.AiLineItemsRequestSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            message: "Validation failed",
            errors: parsed.error.flatten().fieldErrors,
        });
        return;
    }
    try {
        const result = await (0, ai_lineItems_service_1.extractLineItems)(parsed.data);
        res.json(result);
    }
    catch (error) {
        console.error("AI line-item extraction failed:\n", error);
        res.status(500).json({ message: "Line-item extraction failed" });
    }
};
exports.postAiLineItems = postAiLineItems;
const postAiInsights = async (req, res) => {
    const parsed = ai_schema_1.AiInsightRequestSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            message: "Validation failed",
            errors: parsed.error.flatten().fieldErrors,
        });
        return;
    }
    try {
        const result = await (0, ai_insights_service_1.getInsight)(parsed.data);
        res.json(result);
    }
    catch (error) {
        console.error("AI insights failed:\n", error);
        res.status(500).json({ message: "Insights generation failed" });
    }
};
exports.postAiInsights = postAiInsights;
//# sourceMappingURL=ai.controller.js.map