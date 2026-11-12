"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateToggleStatus = exports.validateProductSchemeQuery = exports.validateUpdateProductScheme = exports.validateCreateProductScheme = void 0;
const productScheme_schema_1 = require("../libs/schemas/productScheme.schema");
const zod_1 = __importDefault(require("zod"));
const validateCreateProductScheme = (req, res, next) => {
    try {
        productScheme_schema_1.CreateProductSchemeSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            console.error("Create Product Scheme Validation error:\n", error);
            res.status(400).json({ message: error });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateCreateProductScheme = validateCreateProductScheme;
const validateUpdateProductScheme = (req, res, next) => {
    try {
        productScheme_schema_1.UpdateProductSchemeSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            console.error("Update Product Scheme Validation error:\n", error);
            res.status(400).json({ message: error });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateUpdateProductScheme = validateUpdateProductScheme;
const validateProductSchemeQuery = (req, res, next) => {
    try {
        productScheme_schema_1.ProductSchemeQuerySchema.parse(req.query);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            console.error("Product Scheme Query Validation error:\n", error);
            res.status(400).json({ message: error });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateProductSchemeQuery = validateProductSchemeQuery;
const validateToggleStatus = (req, res, next) => {
    try {
        const schema = zod_1.default.object({
            isActive: zod_1.default.boolean(),
        });
        schema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            console.error("Toggle Status Validation error:\n", error);
            res.status(400).json({ message: error });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateToggleStatus = validateToggleStatus;
//# sourceMappingURL=productScheme.middleware.js.map