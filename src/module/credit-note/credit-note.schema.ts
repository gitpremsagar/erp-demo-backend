import { z } from "zod";

const CreditNoteItemInputSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
});

export const CreateCreditNoteSchema = z.object({
  customerId: z.string().min(1, "Customer ID is required"),
  orderId: z.string().min(1, "Order ID is required"),
  noteDate: z.coerce.date(),
  noteReason: z.string().min(1, "Credit note reason is required"),
  items: z.array(CreditNoteItemInputSchema).min(1, "At least one line item is required"),
});

export const UpdateCreditNoteSchema = z
  .object({
    noteDate: z.coerce.date().optional(),
    noteReason: z.string().min(1).optional(),
    items: z.array(CreditNoteItemInputSchema).min(1).optional(),
  })
  .refine(
    (d) => d.noteDate !== undefined || d.noteReason !== undefined || d.items !== undefined,
    { message: "At least one of noteDate, noteReason, or items is required" }
  );
