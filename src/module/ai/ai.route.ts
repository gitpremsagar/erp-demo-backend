import express from "express";
import { requireAdmin, validateAccessToken } from "../../middleware/auth.middleware";
import { aiRateLimit } from "./ai.rateLimit";
import {
  getAiStatus,
  postAiChat,
  postAiInsights,
  postAiInvoiceParse,
  postAiLineItems,
} from "./ai.controller";

const router = express.Router();

router.use(validateAccessToken, requireAdmin);

router.get("/status", getAiStatus);
router.post("/chat", aiRateLimit("chat"), postAiChat);
router.post("/invoice-parse", aiRateLimit("invoice-parse"), postAiInvoiceParse);
router.post("/line-items", aiRateLimit("line-items"), postAiLineItems);
router.post("/insights", aiRateLimit("insights"), postAiInsights);

export default router;
