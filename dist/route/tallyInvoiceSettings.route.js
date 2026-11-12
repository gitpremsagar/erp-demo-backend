"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const tallyInvoiceSettings_controller_1 = require("../controller/tallyInvoiceSettings.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
router.get("/", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, tallyInvoiceSettings_controller_1.getTallyInvoiceSettings);
router.put("/", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, tallyInvoiceSettings_controller_1.updateTallyInvoiceSettings);
exports.default = router;
//# sourceMappingURL=tallyInvoiceSettings.route.js.map