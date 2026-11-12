import { z } from "zod";

// Category Schema
export const CreateCategorySchema = z.object({
  name: z
    .string()
    .min(1, "Category name is required")
    .max(100, "Category name must be at most 100 characters long")
    .trim(),
  description: z
    .string()
    .min(1, "Description is required")
    .max(500, "Description must be at most 500 characters long")
    .trim(),
  position: z
    .number()
    .int("Position must be an integer")
    .min(0, "Position cannot be negative")
    .optional(),
});

export const UpdateCategorySchema = CreateCategorySchema.partial();


// SubCategory Schema
export const CreateSubCategorySchema = z.object({
  name: z
    .string()
    .min(1, "Sub-category name is required")
    .max(100, "Sub-category name must be at most 100 characters long")
    .trim(),
  description: z
    .string()
    .min(1, "Description is required")
    .max(500, "Description must be at most 500 characters long")
    .trim(),
  categoryId: z
    .string()
    .min(24, "Invalid category ID")
    .max(24, "Invalid category ID")
    .trim(),
});

export const UpdateSubCategorySchema = CreateSubCategorySchema.partial();
