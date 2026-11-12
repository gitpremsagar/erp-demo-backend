"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateSubCategorySchema = exports.CreateSubCategorySchema = exports.UpdateCategorySchema = exports.CreateCategorySchema = void 0;
const zod_1 = require("zod");
// Category Schema
exports.CreateCategorySchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .min(1, "Category name is required")
        .max(100, "Category name must be at most 100 characters long")
        .trim(),
    description: zod_1.z
        .string()
        .min(1, "Description is required")
        .max(500, "Description must be at most 500 characters long")
        .trim(),
    position: zod_1.z
        .number()
        .int("Position must be an integer")
        .min(0, "Position cannot be negative")
        .optional(),
});
exports.UpdateCategorySchema = exports.CreateCategorySchema.partial();
// SubCategory Schema
exports.CreateSubCategorySchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .min(1, "Sub-category name is required")
        .max(100, "Sub-category name must be at most 100 characters long")
        .trim(),
    description: zod_1.z
        .string()
        .min(1, "Description is required")
        .max(500, "Description must be at most 500 characters long")
        .trim(),
    categoryId: zod_1.z
        .string()
        .min(24, "Invalid category ID")
        .max(24, "Invalid category ID")
        .trim(),
});
exports.UpdateSubCategorySchema = exports.CreateSubCategorySchema.partial();
//# sourceMappingURL=categoryForm.schema.js.map