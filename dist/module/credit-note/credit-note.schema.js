"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateCreditNoteSchema = exports.CreateCreditNoteSchema = void 0;
const zod_1 = require("zod");
const CreditNoteItemInputSchema = zod_1.z.object({
    productId: zod_1.z.string().min(1, "Product ID is required"),
    quantity: zod_1.z.number().int().min(1, "Quantity must be at least 1"),
});
exports.CreateCreditNoteSchema = zod_1.z.object({
    customerId: zod_1.z.string().min(1, "Customer ID is required"),
    orderId: zod_1.z.string().min(1, "Order ID is required"),
    noteDate: zod_1.z.coerce.date(),
    noteReason: zod_1.z.string().min(1, "Credit note reason is required"),
    items: zod_1.z.array(CreditNoteItemInputSchema).min(1, "At least one line item is required"),
});
exports.UpdateCreditNoteSchema = zod_1.z
    .object({
    noteDate: zod_1.z.coerce.date().optional(),
    noteReason: zod_1.z.string().min(1).optional(),
    items: zod_1.z.array(CreditNoteItemInputSchema).min(1).optional(),
})
    .refine((d) => d.noteDate !== undefined || d.noteReason !== undefined || d.items !== undefined, { message: "At least one of noteDate, noteReason, or items is required" });
//# sourceMappingURL=credit-note.schema.js.map