import { z } from "zod";

const objectId = z
  .string()
  .min(24, "Invalid ID")
  .max(24, "Invalid ID");

export const AllocationLineInputSchema = z.object({
  customerId: objectId,
  allocatedQty: z.number().int().min(0, "Allocated quantity cannot be negative"),
});

export const CreateProductAllocationSchema = z.object({
  productId: objectId,
  stockBatchIds: z
    .array(objectId)
    .min(1, "At least one stock batch is required"),
  allocationDate: z.coerce.date(),
  notes: z.string().max(2000).optional().nullable(),
  lines: z.array(AllocationLineInputSchema).default([]),
});

export const UpdateProductAllocationSchema = z
  .object({
    allocationDate: z.coerce.date().optional(),
    notes: z.string().max(2000).optional().nullable(),
    lines: z.array(AllocationLineInputSchema).optional(),
  })
  .refine(
    (d) =>
      d.allocationDate !== undefined ||
      d.notes !== undefined ||
      d.lines !== undefined,
    { message: "At least one of allocationDate, notes, or lines is required" }
  );

export const CreateFulfillmentSchema = z.object({
  billDate: z.coerce.date(),
  billQty: z.number().int().min(1, "Bill quantity must be at least 1"),
});

export const UpdateFulfillmentSchema = z
  .object({
    billDate: z.coerce.date().optional(),
    billQty: z.number().int().min(1, "Bill quantity must be at least 1").optional(),
  })
  .refine((d) => d.billDate !== undefined || d.billQty !== undefined, {
    message: "At least one of billDate or billQty is required",
  });

export const ProductAllocationQuerySchema = z.object({
  productId: objectId.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50)),
});
