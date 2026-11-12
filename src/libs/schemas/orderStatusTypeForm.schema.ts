import { z } from "zod";

export const CreateOrderStatusTypeSchema = z.object({
  name: z
    .string()
    .min(1, "Status code is required")
    .max(80, "Status code must be at most 80 characters")
    .trim()
    .regex(/^[A-Z0-9_\s]+$/i, "Use only letters, numbers, spaces, and underscores"),
  displayName: z
    .string()
    .max(120, "Display name must be at most 120 characters")
    .trim()
    .optional()
    .or(z.literal("")),
  sortOrder: z.number().int().optional(),
});

export const UpdateOrderStatusTypeSchema = CreateOrderStatusTypeSchema.partial();
