"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductGroupQuerySchema = exports.UpdateProductGroupSchema = exports.CreateProductGroupSchema = void 0;
const zod_1 = require("zod");
exports.CreateProductGroupSchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .min(1, "Product group name is required")
        .max(100, "Product group name must be at most 100 characters long")
        .trim(),
});
exports.UpdateProductGroupSchema = exports.CreateProductGroupSchema.partial();
exports.ProductGroupQuerySchema = zod_1.z.object({
    page: zod_1.z.string().optional().transform(val => val ? parseInt(val) : 1),
    limit: zod_1.z.string().optional().transform(val => val ? parseInt(val) : 10),
    search: zod_1.z.string().optional(),
});
//# sourceMappingURL=productGroupForm.schema.js.map