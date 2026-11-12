"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateOrderStatusTypeSchema = exports.CreateOrderStatusTypeSchema = void 0;
const zod_1 = require("zod");
exports.CreateOrderStatusTypeSchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .min(1, "Status code is required")
        .max(80, "Status code must be at most 80 characters")
        .trim()
        .regex(/^[A-Z0-9_\s]+$/i, "Use only letters, numbers, spaces, and underscores"),
    displayName: zod_1.z
        .string()
        .max(120, "Display name must be at most 120 characters")
        .trim()
        .optional()
        .or(zod_1.z.literal("")),
    sortOrder: zod_1.z.number().int().optional(),
});
exports.UpdateOrderStatusTypeSchema = exports.CreateOrderStatusTypeSchema.partial();
//# sourceMappingURL=orderStatusTypeForm.schema.js.map