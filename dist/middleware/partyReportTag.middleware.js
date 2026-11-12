"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAssignPartiesToTag = exports.validatePartyReportTagQuery = exports.validateUpdatePartyReportTag = exports.validateCreatePartyReportTag = void 0;
const partyReportTagForm_schema_1 = require("../libs/schemas/partyReportTagForm.schema");
const zod_1 = __importDefault(require("zod"));
const validateCreatePartyReportTag = (req, res, next) => {
    try {
        partyReportTagForm_schema_1.CreatePartyReportTagSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            res.status(400).json({ message: error });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateCreatePartyReportTag = validateCreatePartyReportTag;
const validateUpdatePartyReportTag = (req, res, next) => {
    try {
        partyReportTagForm_schema_1.UpdatePartyReportTagSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            res.status(400).json({ message: error });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateUpdatePartyReportTag = validateUpdatePartyReportTag;
const validatePartyReportTagQuery = (req, res, next) => {
    try {
        partyReportTagForm_schema_1.PartyReportTagQuerySchema.parse(req.query);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            res.status(400).json({ message: error });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validatePartyReportTagQuery = validatePartyReportTagQuery;
const validateAssignPartiesToTag = (req, res, next) => {
    try {
        partyReportTagForm_schema_1.AssignPartiesToTagSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            res.status(400).json({ message: error });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateAssignPartiesToTag = validateAssignPartiesToTag;
//# sourceMappingURL=partyReportTag.middleware.js.map