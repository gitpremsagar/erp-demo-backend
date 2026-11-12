"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUpdateCreditNote = exports.validateCreateCreditNote = void 0;
const zod_1 = __importDefault(require("zod"));
const credit_note_schema_1 = require("./credit-note.schema");
const validateCreateCreditNote = (req, res, next) => {
    try {
        req.body = credit_note_schema_1.CreateCreditNoteSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            return res.status(400).json({ message: error.issues });
        }
        return res.status(500).json({ message: "Internal server error" });
    }
    next();
};
exports.validateCreateCreditNote = validateCreateCreditNote;
const validateUpdateCreditNote = (req, res, next) => {
    try {
        req.body = credit_note_schema_1.UpdateCreditNoteSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            return res.status(400).json({ message: error.issues });
        }
        return res.status(500).json({ message: "Internal server error" });
    }
    next();
};
exports.validateUpdateCreditNote = validateUpdateCreditNote;
//# sourceMappingURL=credit-note.middleware.js.map