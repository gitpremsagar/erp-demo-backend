"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateProductAllocationQuery = exports.validateUpdateFulfillment = exports.validateCreateFulfillment = exports.validateUpdateProductAllocation = exports.validateCreateProductAllocation = void 0;
const zod_1 = __importDefault(require("zod"));
const product_allocation_schema_1 = require("./product-allocation.schema");
function handleZod(err, res) {
    if (err instanceof zod_1.default.ZodError) {
        return res.status(400).json({ message: err.issues });
    }
    return res.status(500).json({ message: "Internal server error" });
}
const validateCreateProductAllocation = (req, res, next) => {
    try {
        req.body = product_allocation_schema_1.CreateProductAllocationSchema.parse(req.body);
    }
    catch (error) {
        return handleZod(error, res);
    }
    next();
};
exports.validateCreateProductAllocation = validateCreateProductAllocation;
const validateUpdateProductAllocation = (req, res, next) => {
    try {
        req.body = product_allocation_schema_1.UpdateProductAllocationSchema.parse(req.body);
    }
    catch (error) {
        return handleZod(error, res);
    }
    next();
};
exports.validateUpdateProductAllocation = validateUpdateProductAllocation;
const validateCreateFulfillment = (req, res, next) => {
    try {
        req.body = product_allocation_schema_1.CreateFulfillmentSchema.parse(req.body);
    }
    catch (error) {
        return handleZod(error, res);
    }
    next();
};
exports.validateCreateFulfillment = validateCreateFulfillment;
const validateUpdateFulfillment = (req, res, next) => {
    try {
        req.body = product_allocation_schema_1.UpdateFulfillmentSchema.parse(req.body);
    }
    catch (error) {
        return handleZod(error, res);
    }
    next();
};
exports.validateUpdateFulfillment = validateUpdateFulfillment;
const validateProductAllocationQuery = (req, res, next) => {
    try {
        const parsed = product_allocation_schema_1.ProductAllocationQuerySchema.parse(req.query);
        req.allocationQuery = parsed;
    }
    catch (error) {
        return handleZod(error, res);
    }
    next();
};
exports.validateProductAllocationQuery = validateProductAllocationQuery;
//# sourceMappingURL=product-allocation.middleware.js.map