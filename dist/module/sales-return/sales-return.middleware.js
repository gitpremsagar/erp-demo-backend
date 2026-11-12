"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUpdateSalesReturn = exports.validateCreateSalesReturn = void 0;
const sales_return_schema_1 = require("./sales-return.schema");
const zod_1 = __importDefault(require("zod"));
const validateCreateSalesReturn = (req, res, next) => {
    try {
        req.body = sales_return_schema_1.CreateSalesReturnSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            return res.status(400).json({ message: error.issues });
        }
        return res.status(500).json({ message: "Internal server error" });
    }
    next();
};
exports.validateCreateSalesReturn = validateCreateSalesReturn;
const validateUpdateSalesReturn = (req, res, next) => {
    try {
        req.body = sales_return_schema_1.UpdateSalesReturnSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            return res.status(400).json({ message: error.issues });
        }
        return res.status(500).json({ message: "Internal server error" });
    }
    next();
};
exports.validateUpdateSalesReturn = validateUpdateSalesReturn;
//# sourceMappingURL=sales-return.middleware.js.map