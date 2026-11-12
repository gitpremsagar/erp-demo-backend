"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductAllocationQuerySchema = exports.UpdateFulfillmentSchema = exports.CreateFulfillmentSchema = exports.UpdateProductAllocationSchema = exports.CreateProductAllocationSchema = exports.AllocationLineInputSchema = void 0;
const zod_1 = require("zod");
const objectId = zod_1.z
    .string()
    .min(24, "Invalid ID")
    .max(24, "Invalid ID");
exports.AllocationLineInputSchema = zod_1.z.object({
    customerId: objectId,
    allocatedQty: zod_1.z.number().int().min(0, "Allocated quantity cannot be negative"),
});
exports.CreateProductAllocationSchema = zod_1.z.object({
    productId: objectId,
    stockBatchIds: zod_1.z
        .array(objectId)
        .min(1, "At least one stock batch is required"),
    allocationDate: zod_1.z.coerce.date(),
    notes: zod_1.z.string().max(2000).optional().nullable(),
    lines: zod_1.z.array(exports.AllocationLineInputSchema).default([]),
});
exports.UpdateProductAllocationSchema = zod_1.z
    .object({
    allocationDate: zod_1.z.coerce.date().optional(),
    notes: zod_1.z.string().max(2000).optional().nullable(),
    lines: zod_1.z.array(exports.AllocationLineInputSchema).optional(),
})
    .refine((d) => d.allocationDate !== undefined ||
    d.notes !== undefined ||
    d.lines !== undefined, { message: "At least one of allocationDate, notes, or lines is required" });
exports.CreateFulfillmentSchema = zod_1.z.object({
    billDate: zod_1.z.coerce.date(),
    billQty: zod_1.z.number().int().min(1, "Bill quantity must be at least 1"),
});
exports.UpdateFulfillmentSchema = zod_1.z
    .object({
    billDate: zod_1.z.coerce.date().optional(),
    billQty: zod_1.z.number().int().min(1, "Bill quantity must be at least 1").optional(),
})
    .refine((d) => d.billDate !== undefined || d.billQty !== undefined, {
    message: "At least one of billDate or billQty is required",
});
exports.ProductAllocationQuerySchema = zod_1.z.object({
    productId: objectId.optional(),
    startDate: zod_1.z.string().optional(),
    endDate: zod_1.z.string().optional(),
    page: zod_1.z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: zod_1.z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : 50)),
});
//# sourceMappingURL=product-allocation.schema.js.map