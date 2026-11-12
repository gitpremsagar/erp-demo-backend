import { z } from "zod";

const stockRecordReasonEnum = z.enum([
  "ARRIVAL_FROM_SUPPLIER",
  "ASSIGNED_TO_ORDER",
  "RELEASED_FROM_ORDER",
  "GIFTED",
  "RETURNED",
  "CREDIT_NOTE",
  "DAMAGED",
  "CORRECTION_BY_ADMIN",
]);

export const CreateStockRecordSchema = z.object({
  productId: z
    .string()
    .min(24, "Invalid product ID")
    .max(24, "Invalid product ID"),
  stockBatchId: z
    .string()
    .min(24, "Invalid stock batch ID")
    .max(24, "Invalid stock batch ID"),
  changeInStock: z
    .number()
    .int("Change in stock must be an integer")
    .refine((val) => val !== 0, "Change in stock cannot be zero"),
  reason: stockRecordReasonEnum,
  createdBy: z
    .string()
    .min(24, "Invalid user ID")
    .max(24, "Invalid user ID"),
  changeDate: z.coerce.date().optional(),
});

export const UpdateStockRecordSchema = z
  .object({
    changeInStock: z
      .number()
      .int("Change in stock must be an integer")
      .refine((val) => val !== 0, "Change in stock cannot be zero")
      .optional(),
    reason: stockRecordReasonEnum.optional(),
    changeDate: z.coerce.date().optional(),
  })
  .partial();

export const StockRecordQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val) : 10)),
  search: z.string().optional(),
  productId: z.string().optional(),
  stockBatchId: z.string().optional(),
  reason: stockRecordReasonEnum.optional(),
  createdBy: z.string().optional(),
  dateFrom: z
    .string()
    .optional()
    .refine((date) => {
      if (!date) return true;
      const dateObj = new Date(date);
      return !isNaN(dateObj.getTime());
    }, "Invalid date format"),
  dateTo: z
    .string()
    .optional()
    .refine((date) => {
      if (!date) return true;
      const dateObj = new Date(date);
      return !isNaN(dateObj.getTime());
    }, "Invalid date format"),
});
