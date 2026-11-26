import express from "express";
import multer from "multer";
import { requireAdmin, validateAccessToken } from "../../middleware/auth.middleware";
import { aiRateLimit } from "./ai.rateLimit";
import {
  getAiStatus,
  getPurchaseAiStatus,
  postAiChat,
  postAiInsights,
  postAiInvoiceParse,
  postAiLineItems,
  postPurchaseAiChat,
  postPurchaseInvoiceExtract,
} from "./ai.controller";

const router = express.Router();

const invoiceImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 10, fileSize: 8 * 1024 * 1024 },
}).array("files", 10);

router.use(validateAccessToken, requireAdmin);

router.get("/status", getAiStatus);
router.post("/chat", aiRateLimit("chat"), postAiChat);
router.get("/purchase/status", getPurchaseAiStatus);
router.post("/purchase/chat", aiRateLimit("purchase-chat"), postPurchaseAiChat);
router.post(
  "/purchase/invoice-extract",
  aiRateLimit("purchase-invoice-extract"),
  (req, res, next) => {
    invoiceImageUpload(req, res, (error) => {
      if (!error) return next();
      const message =
        error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
          ? "Each invoice image must be 8 MB or smaller."
          : "Could not read the uploaded invoice files.";
      res.status(400).json({ message });
    });
  },
  postPurchaseInvoiceExtract
);
router.post("/invoice-parse", aiRateLimit("invoice-parse"), postAiInvoiceParse);
router.post("/line-items", aiRateLimit("line-items"), postAiLineItems);
router.post("/insights", aiRateLimit("insights"), postAiInsights);

export default router;
