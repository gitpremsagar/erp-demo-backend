import { z } from "zod";

export const CreateStockBatchSchema = z.object({
  productId: z
    .string()
    .min(24, "Invalid product ID")
    .max(24, "Invalid product ID"),
  manufacturingDate: z.string().refine((date) => {
    // Accept various date formats: ISO datetime, date only, or common formats
    const dateObj = new Date(date);
    return !isNaN(dateObj.getTime());
  }, "Invalid manufacturing date format"),
  arrivalDate: z.string().refine((date) => {
    // Accept various date formats: ISO datetime, date only, or common formats
    const dateObj = new Date(date);
    return !isNaN(dateObj.getTime());
  }, "Invalid arrival date format"),
  stockQuantity: z
    .number()
    .int("Stock quantity must be an integer")
    .min(0, "Stock quantity cannot be negative")
    .default(0),
  isArchived: z.boolean().default(false).optional(),
  purchaseInvoiceId: z
    .string()
    .min(24, "Invalid purchase invoice ID")
    .max(24, "Invalid purchase invoice ID")
    .optional()
    .nullable(),
});

export const UpdateStockBatchSchema = CreateStockBatchSchema.partial();

export const StockBatchQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val) : 10)),
  search: z.string().optional(),
  productId: z.string().optional(),
  isArchived: z
    .string()
    .optional()
    .transform((val) =>
      val === "true" ? true : val === "false" ? false : undefined
    ),
  expired: z
    .string()
    .optional()
    .transform((val) =>
      val === "true" ? true : val === "false" ? false : undefined
    ),
  lowStock: z
    .string()
    .optional()
    .transform((val) =>
      val === "true" ? true : val === "false" ? false : undefined
    ),
});
