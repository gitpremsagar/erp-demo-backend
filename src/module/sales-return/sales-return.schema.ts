import { z } from "zod";

const SalesReturnItemInputSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
});

export const CreateSalesReturnSchema = z.object({
  customerId: z.string().min(1, "Customer ID is required"),
  orderId: z.string().min(1, "Order ID is required"),
  returnDate: z.coerce.date(),
  returnReason: z.string().min(1, "Return reason is required"),
  items: z.array(SalesReturnItemInputSchema).min(1, "At least one line item is required"),
});

export const UpdateSalesReturnSchema = z
  .object({
    returnDate: z.coerce.date().optional(),
    returnReason: z.string().min(1).optional(),
    items: z.array(SalesReturnItemInputSchema).min(1).optional(),
  })
  .refine(
    (d) =>
      d.returnDate !== undefined ||
      d.returnReason !== undefined ||
      d.items !== undefined,
    { message: "At least one of returnDate, returnReason, or items is required" }
  );
