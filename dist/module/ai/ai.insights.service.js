"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInsight = getInsight;
const ai_tools_read_1 = require("./ai.tools.read");
const deepseek_client_1 = require("./deepseek.client");
const ai_utils_1 = require("./ai.utils");
const CACHE_TTL_MS = 60 * 1000;
const cache = new Map();
function num(value, fallback, max) {
    return (0, ai_utils_1.toPositiveInt)(value, fallback, max);
}
async function buildFacts(kind, params) {
    switch (kind) {
        case "sales_summary":
            return (0, ai_tools_read_1.salesSummary)({
                dateFrom: params.dateFrom,
                dateTo: params.dateTo,
                groupBy: params.groupBy ?? "none",
                limit: num(params.limit, 10, 25),
            });
        case "low_stock":
            return (0, ai_tools_read_1.lowStockAndReorder)({
                mode: "low_stock",
                threshold: params.threshold,
                limit: num(params.limit, 15, 25),
            });
        case "reorder_suggestions":
            return (0, ai_tools_read_1.lowStockAndReorder)({
                mode: "reorder",
                lookbackDays: num(params.lookbackDays, 60, 366),
                targetCoverDays: num(params.targetCoverDays, 30, 365),
                limit: num(params.limit, 15, 25),
            });
        case "slow_movers":
            return (0, ai_tools_read_1.lowStockAndReorder)({
                mode: "slow_movers",
                threshold: params.threshold,
                lookbackDays: num(params.lookbackDays, 90, 366),
                limit: num(params.limit, 15, 25),
            });
        case "pending_orders":
            return (0, ai_tools_read_1.searchOrders)({
                dateFrom: params.dateFrom,
                dateTo: params.dateTo,
                includeCompleted: false,
                includeStatusSummary: true,
                limit: num(params.limit, 15, 25),
            });
        case "purchases_in_transit":
            return (0, ai_tools_read_1.searchPurchases)({
                statuses: [
                    "PENDING",
                    "LOADING",
                    "LOADED",
                    "IN_TRANSIT",
                    "ARRIVED",
                    "UNLOADING",
                    "UNLOADED",
                ],
                dateFrom: params.dateFrom,
                dateTo: params.dateTo,
                limit: num(params.limit, 15, 25),
            });
        default:
            throw new Error("Unsupported insight kind");
    }
}
async function buildNarrative(kind, facts) {
    if (!(0, deepseek_client_1.isDeepSeekConfigured)())
        return null;
    try {
        const config = (0, deepseek_client_1.getDeepSeekConfig)();
        const result = await (0, deepseek_client_1.chatCompletion)({
            model: config.reasonerModel,
            messages: [
                {
                    role: "system",
                    content: "You are a concise ERP analyst for a wholesale distributor. Write 2-4 sentences summarizing the provided facts. " +
                        "Use ONLY the numbers and names in the facts JSON. Never invent or estimate numbers. " +
                        "Focus on the most important action the admin should take. No markdown table unless the facts contain one.",
                },
                {
                    role: "user",
                    content: `Insight kind: ${kind}\nFacts JSON:\n${JSON.stringify(facts)}`,
                },
            ],
            thinking: "enabled",
            maxTokens: 400,
            timeoutMs: 20000,
        });
        return result.message.content?.trim() || null;
    }
    catch {
        return null;
    }
}
async function getInsight(input) {
    const kind = input.kind;
    const params = (input.params ?? {});
    const cacheKey = JSON.stringify({ kind, params, narrative: input.narrative });
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.result;
    }
    const facts = await buildFacts(kind, params);
    let narrative = null;
    if (input.narrative) {
        narrative = await buildNarrative(kind, facts);
    }
    const result = {
        kind,
        generatedAt: new Date().toISOString(),
        facts,
        narrative,
        aiUsed: Boolean(narrative),
    };
    cache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
}
//# sourceMappingURL=ai.insights.service.js.map