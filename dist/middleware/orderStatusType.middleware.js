"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUpdateOrderStatusType = exports.validateCreateOrderStatusType = void 0;
const orderStatusTypeForm_schema_1 = require("../libs/schemas/orderStatusTypeForm.schema");
const zod_1 = __importDefault(require("zod"));
const validateCreateOrderStatusType = (req, res, next) => {
    try {
        orderStatusTypeForm_schema_1.CreateOrderStatusTypeSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            const msg = error.issues.map((issue) => issue.message).join("; ");
            res.status(400).json({ message: msg });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateCreateOrderStatusType = validateCreateOrderStatusType;
const validateUpdateOrderStatusType = (req, res, next) => {
    try {
        orderStatusTypeForm_schema_1.UpdateOrderStatusTypeSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            const msg = error.issues.map((issue) => issue.message).join("; ");
            res.status(400).json({ message: msg });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateUpdateOrderStatusType = validateUpdateOrderStatusType;
//# sourceMappingURL=orderStatusType.middleware.js.map