"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_middleware_1 = require("../../middleware/auth.middleware");
const ai_rateLimit_1 = require("./ai.rateLimit");
const ai_controller_1 = require("./ai.controller");
const router = express_1.default.Router();
router.use(auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin);
router.get("/status", ai_controller_1.getAiStatus);
router.post("/chat", (0, ai_rateLimit_1.aiRateLimit)("chat"), ai_controller_1.postAiChat);
router.post("/invoice-parse", (0, ai_rateLimit_1.aiRateLimit)("invoice-parse"), ai_controller_1.postAiInvoiceParse);
router.post("/line-items", (0, ai_rateLimit_1.aiRateLimit)("line-items"), ai_controller_1.postAiLineItems);
router.post("/insights", (0, ai_rateLimit_1.aiRateLimit)("insights"), ai_controller_1.postAiInsights);
exports.default = router;
//# sourceMappingURL=ai.route.js.map