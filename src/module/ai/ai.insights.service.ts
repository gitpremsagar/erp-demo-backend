import type { AiInsightKind, AiInsightResult } from "./ai.type";
import type { AiInsightRequestInput } from "./ai.schema";
import {
  lowStockAndReorder,
  salesSummary,
  searchOrders,
  searchPurchases,
} from "./ai.tools.read";
import { chatCompletion, getDeepSeekConfig, isDeepSeekConfigured, messageText } from "./deepseek.client";
import { toPositiveInt } from "./ai.utils";

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map<string, { result: AiInsightResult; expiresAt: number }>();

interface InsightParams {
  dateFrom?: string;
  dateTo?: string;
  groupBy?: "none" | "day" | "product" | "customer";
  limit?: number;
  threshold?: number;
  lookbackDays?: number;
  targetCoverDays?: number;
}

function num(value: unknown, fallback: number, max: number): number {
  return toPositiveInt(value, fallback, max);
}

async function buildFacts(
  kind: AiInsightKind,
  params: InsightParams
): Promise<unknown> {
  switch (kind) {
    case "sales_summary":
      return salesSummary({
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        groupBy: params.groupBy ?? "none",
        limit: num(params.limit, 10, 25),
      });
    case "low_stock":
      return lowStockAndReorder({
        mode: "low_stock",
        threshold: params.threshold,
        limit: num(params.limit, 15, 25),
      });
    case "reorder_suggestions":
      return lowStockAndReorder({
        mode: "reorder",
        lookbackDays: num(params.lookbackDays, 60, 366),
        targetCoverDays: num(params.targetCoverDays, 30, 365),
        limit: num(params.limit, 15, 25),
      });
    case "slow_movers":
      return lowStockAndReorder({
        mode: "slow_movers",
        threshold: params.threshold,
        lookbackDays: num(params.lookbackDays, 90, 366),
        limit: num(params.limit, 15, 25),
      });
    case "pending_orders":
      return searchOrders({
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        includeCompleted: false,
        includeStatusSummary: true,
        limit: num(params.limit, 15, 25),
      });
    case "purchases_in_transit":
      return searchPurchases({
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

async function buildNarrative(kind: AiInsightKind, facts: unknown): Promise<string | null> {
  if (!isDeepSeekConfigured()) return null;

  try {
    const config = getDeepSeekConfig();
    const result = await chatCompletion({
      model: config.reasonerModel,
      messages: [
        {
          role: "system",
          content:
            "You are a concise ERP analyst for a wholesale distributor. Write 2-4 sentences summarizing the provided facts. " +
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
    return messageText(result.message.content).trim() || null;
  } catch {
    return null;
  }
}

export async function getInsight(input: AiInsightRequestInput): Promise<AiInsightResult> {
  const kind = input.kind;
  const params = (input.params ?? {}) as InsightParams;
  const cacheKey = JSON.stringify({ kind, params, narrative: input.narrative });

  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const facts = await buildFacts(kind, params);
  let narrative: string | null = null;
  if (input.narrative) {
    narrative = await buildNarrative(kind, facts);
  }

  const result: AiInsightResult = {
    kind,
    generatedAt: new Date().toISOString(),
    facts,
    narrative,
    aiUsed: Boolean(narrative),
  };

  cache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}
