import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { AiChatRequestSchema, AiInsightRequestSchema, AiInvoiceParseRequestSchema, AiLineItemsRequestSchema } from "./ai.schema";
import { getDeepSeekConfig, isDeepSeekConfigured } from "./deepseek.client";
import { runAiChat } from "./ai.service";
import { initSse, startSseHeartbeat, writeSseEvent } from "./ai.sse";
import { parseInvoiceRows } from "./ai.invoiceParse.service";
import { extractLineItems } from "./ai.lineItems.service";
import { getInsight } from "./ai.insights.service";
import { extractInvoiceImages } from "./ai.invoiceImage.service";
import type { AiChatEvent, AiStatusResponse } from "./ai.type";

function actorId(req: Request): string | null {
  const user = (req as AuthenticatedRequest).user as { id?: string } | undefined;
  return typeof user?.id === "string" && user.id ? user.id : null;
}

export const getAiStatus = (_req: Request, res: Response) => {
  const config = getDeepSeekConfig();
  const body: AiStatusResponse = {
    enabled: isDeepSeekConfigured(),
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

async function handleAiChat(
  req: Request,
  res: Response,
  profile: "general" | "purchase"
) {
  const parsed = AiChatRequestSchema.safeParse(req.body);
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

  if (!isDeepSeekConfigured()) {
    res.status(503).json({
      message:
        "The AI assistant is not configured. Add DEEPSEEK_API_KEY to the backend environment.",
    });
    return;
  }

  const request = parsed.data;
  const controller = new AbortController();
  const onClose = () => controller.abort();

  if (request.mode === "json") {
    try {
      const events: AiChatEvent[] = [];
      const result = await runAiChat({
        request,
        actorId: userId,
        profile,
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
    } catch (error) {
      console.error("AI chat (json) failed:\n", error);
      res.status(500).json({ message: "AI chat failed" });
    }
    return;
  }

  initSse(res);
  const stopHeartbeat = startSseHeartbeat(res);
  // res "close" fires when the client disconnects; req "close" can fire
  // as soon as the request body completes, which would abort the stream early.
  res.on("close", onClose);

  try {
    await runAiChat({
      request,
      actorId: userId,
      profile,
      signal: controller.signal,
      emit: (event) => writeSseEvent(res, event),
    });
  } catch (error) {
    console.error("AI chat (sse) failed:\n", error);
    writeSseEvent(res, {
      type: "error",
      code: "PROVIDER_ERROR",
      message: "The AI assistant ran into an unexpected error. Please try again.",
      retryable: true,
    });
  } finally {
    stopHeartbeat();
    res.off("close", onClose);
    if (!res.writableEnded && !res.destroyed) res.end();
  }
}

export const postAiChat = (req: Request, res: Response) =>
  handleAiChat(req, res, "general");

export const postPurchaseAiChat = (req: Request, res: Response) =>
  handleAiChat(req, res, "purchase");

export const getPurchaseAiStatus = (_req: Request, res: Response) => {
  const config = getDeepSeekConfig();
  const body: AiStatusResponse = {
    enabled: isDeepSeekConfigured(),
    model: config.model,
    assistant: "purchase",
    capabilities: [
      "purchase_chat",
      "purchase_workspace",
      "purchase_analytics",
      "purchase_actions",
    ],
    deterministicFallback: true,
    limits: {
      maxMessages: 30,
      maxMessageChars: 4000,
      maxInvoiceRows: 300,
    },
  };
  res.json(body);
};

export const postAiInvoiceParse = async (req: Request, res: Response) => {
  const parsed = AiInvoiceParseRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: "Validation failed",
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const result = await parseInvoiceRows(parsed.data);
    res.json(result);
  } catch (error) {
    console.error("AI invoice parse failed:\n", error);
    res.status(500).json({ message: "Invoice parsing failed" });
  }
};

const ALLOWED_INVOICE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const postPurchaseInvoiceExtract = async (req: Request, res: Response) => {
  const files = ((req.files as Express.Multer.File[] | undefined) ?? []).filter(
    (file) => file.size > 0
  );
  if (!files.length) {
    res.status(400).json({
      message: "Upload at least one invoice image or PDF.",
    });
    return;
  }
  if (files.length > 10) {
    res.status(400).json({ message: "Upload at most 10 invoice pages at a time." });
    return;
  }
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > 24 * 1024 * 1024) {
    res.status(413).json({
      message: "The combined invoice upload is too large. Use fewer pages or smaller images.",
    });
    return;
  }

  const invalid = files.find((file) => !ALLOWED_INVOICE_IMAGE_TYPES.has(file.mimetype));
  if (invalid) {
    res.status(400).json({
      message: `Unsupported file type "${invalid.mimetype}". Upload JPEG, PNG, WebP, or a PDF.`,
    });
    return;
  }

  const vehicleNumber =
    typeof req.body?.vehicleNumber === "string" && req.body.vehicleNumber.trim()
      ? req.body.vehicleNumber.trim().slice(0, 80)
      : undefined;
  const supplierName =
    typeof req.body?.supplierName === "string" && req.body.supplierName.trim()
      ? req.body.supplierName.trim().slice(0, 200)
      : undefined;
  const notes =
    typeof req.body?.notes === "string" && req.body.notes.trim()
      ? req.body.notes.trim().slice(0, 1000)
      : undefined;

  try {
    const result = await extractInvoiceImages({
      images: files.map((file) => ({
        name: file.originalname,
        dataUrl: `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
      })),
      vehicleNumber,
      supplierName,
      notes,
    });
    res.json(result);
  } catch (error) {
    console.error("Purchase invoice image extraction failed:\n", error);
    res.status(500).json({ message: "Invoice image extraction failed" });
  }
};

export const postAiLineItems = async (req: Request, res: Response) => {
  const parsed = AiLineItemsRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: "Validation failed",
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const result = await extractLineItems(parsed.data);
    res.json(result);
  } catch (error) {
    console.error("AI line-item extraction failed:\n", error);
    res.status(500).json({ message: "Line-item extraction failed" });
  }
};

export const postAiInsights = async (req: Request, res: Response) => {
  const parsed = AiInsightRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: "Validation failed",
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const result = await getInsight(parsed.data);
    res.json(result);
  } catch (error) {
    console.error("AI insights failed:\n", error);
    res.status(500).json({ message: "Insights generation failed" });
  }
};
