import { z } from "zod";

export const CreateTransporterSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(200, "Name must be at most 200 characters")
    .trim(),
  transporterContact: z
    .string()
    .max(100, "Contact must be at most 100 characters")
    .trim()
    .optional()
    .nullable(),
  area: z
    .string()
    .max(100, "Area must be at most 100 characters")
    .trim()
    .optional()
    .nullable(),
});

export const UpdateTransporterSchema = CreateTransporterSchema.partial();
