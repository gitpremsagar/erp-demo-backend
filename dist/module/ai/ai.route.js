"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("../../middleware/auth.middleware");
const ai_rateLimit_1 = require("./ai.rateLimit");
const ai_controller_1 = require("./ai.controller");
const router = express_1.default.Router();
const invoiceImageUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { files: 10, fileSize: 8 * 1024 * 1024 },
}).array("files", 10);
router.use(auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin);
router.get("/status", ai_controller_1.getAiStatus);
router.post("/chat", (0, ai_rateLimit_1.aiRateLimit)("chat"), ai_controller_1.postAiChat);
router.get("/purchase/status", ai_controller_1.getPurchaseAiStatus);
router.post("/purchase/chat", (0, ai_rateLimit_1.aiRateLimit)("purchase-chat"), ai_controller_1.postPurchaseAiChat);
router.post("/purchase/invoice-extract", (0, ai_rateLimit_1.aiRateLimit)("purchase-invoice-extract"), (req, res, next) => {
    invoiceImageUpload(req, res, (error) => {
        if (!error)
            return next();
        const message = error instanceof multer_1.default.MulterError && error.code === "LIMIT_FILE_SIZE"
            ? "Each invoice image must be 8 MB or smaller."
            : "Could not read the uploaded invoice files.";
        res.status(400).json({ message });
    });
}, ai_controller_1.postPurchaseInvoiceExtract);
router.post("/invoice-parse", (0, ai_rateLimit_1.aiRateLimit)("invoice-parse"), ai_controller_1.postAiInvoiceParse);
router.post("/line-items", (0, ai_rateLimit_1.aiRateLimit)("line-items"), ai_controller_1.postAiLineItems);
router.post("/insights", (0, ai_rateLimit_1.aiRateLimit)("insights"), ai_controller_1.postAiInsights);
exports.default = router;
//# sourceMappingURL=ai.route.js.map