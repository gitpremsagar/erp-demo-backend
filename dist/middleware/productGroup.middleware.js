"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateProductGroupQuery = exports.validateUpdateProductGroup = exports.validateCreateProductGroup = void 0;
const productGroupForm_schema_1 = require("../libs/schemas/productGroupForm.schema");
const zod_1 = __importDefault(require("zod"));
const validateCreateProductGroup = (req, res, next) => {
    try {
        productGroupForm_schema_1.CreateProductGroupSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            console.error("Create ProductGroup Validation error:\n", error);
            res.status(400).json({ message: error });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateCreateProductGroup = validateCreateProductGroup;
const validateUpdateProductGroup = (req, res, next) => {
    try {
        productGroupForm_schema_1.UpdateProductGroupSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            console.error("Update ProductGroup Validation error:\n", error);
            res.status(400).json({ message: error });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateUpdateProductGroup = validateUpdateProductGroup;
const validateProductGroupQuery = (req, res, next) => {
    try {
        productGroupForm_schema_1.ProductGroupQuerySchema.parse(req.query);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            console.error("ProductGroup Query Validation error:\n", error);
            res.status(400).json({ message: error });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateProductGroupQuery = validateProductGroupQuery;
//# sourceMappingURL=productGroup.middleware.js.map