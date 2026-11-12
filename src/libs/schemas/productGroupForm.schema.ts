import { z } from "zod";

export const CreateProductGroupSchema = z.object({
  name: z
    .string()
    .min(1, "Product group name is required")
    .max(100, "Product group name must be at most 100 characters long")
    .trim(),
});

export const UpdateProductGroupSchema = CreateProductGroupSchema.partial();

export const ProductGroupQuerySchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 10),
  search: z.string().optional(),
});

