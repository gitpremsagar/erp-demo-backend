"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateSalesReturnSchema = exports.CreateSalesReturnSchema = void 0;
const zod_1 = require("zod");
const SalesReturnItemInputSchema = zod_1.z.object({
    productId: zod_1.z.string().min(1, "Product ID is required"),
    quantity: zod_1.z.number().int().min(1, "Quantity must be at least 1"),
});
exports.CreateSalesReturnSchema = zod_1.z.object({
    customerId: zod_1.z.string().min(1, "Customer ID is required"),
    orderId: zod_1.z.string().min(1, "Order ID is required"),
    returnDate: zod_1.z.coerce.date(),
    returnReason: zod_1.z.string().min(1, "Return reason is required"),
    items: zod_1.z.array(SalesReturnItemInputSchema).min(1, "At least one line item is required"),
});
exports.UpdateSalesReturnSchema = zod_1.z
    .object({
    returnDate: zod_1.z.coerce.date().optional(),
    returnReason: zod_1.z.string().min(1).optional(),
    items: zod_1.z.array(SalesReturnItemInputSchema).min(1).optional(),
})
    .refine((d) => d.returnDate !== undefined ||
    d.returnReason !== undefined ||
    d.items !== undefined, { message: "At least one of returnDate, returnReason, or items is required" });
//# sourceMappingURL=sales-return.schema.js.map