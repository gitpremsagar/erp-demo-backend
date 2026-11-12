"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const credit_note_controller_1 = require("./credit-note.controller");
const credit_note_middleware_1 = require("./credit-note.middleware");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = express_1.default.Router();
router.post("/", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, credit_note_middleware_1.validateCreateCreditNote, credit_note_controller_1.createCreditNote);
router.get("/", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdminOrWarehouseManager, credit_note_controller_1.getCreditNotes);
router.get("/:id", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdminOrWarehouseManager, credit_note_controller_1.getCreditNoteById);
router.patch("/:id", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, credit_note_middleware_1.validateUpdateCreditNote, credit_note_controller_1.updateCreditNote);
router.delete("/:id", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, credit_note_controller_1.deleteCreditNote);
exports.default = router;
//# sourceMappingURL=credit-note.route.js.map