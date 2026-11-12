"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUpdateTransporter = exports.validateCreateTransporter = void 0;
const transporter_schema_1 = require("./transporter.schema");
const zod_1 = __importDefault(require("zod"));
const validateCreateTransporter = (req, res, next) => {
    try {
        transporter_schema_1.CreateTransporterSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            return res.status(400).json({ message: error.issues });
        }
        return res.status(500).json({ message: "Internal server error" });
    }
    next();
};
exports.validateCreateTransporter = validateCreateTransporter;
const validateUpdateTransporter = (req, res, next) => {
    try {
        transporter_schema_1.UpdateTransporterSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            return res.status(400).json({ message: error.issues });
        }
        return res.status(500).json({ message: "Internal server error" });
    }
    next();
};
exports.validateUpdateTransporter = validateUpdateTransporter;
//# sourceMappingURL=transporter.middleware.js.map