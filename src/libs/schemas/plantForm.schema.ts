import { z } from "zod";

// Plant Schema
export const CreatePlantSchema = z.object({
  name: z
    .string()
    .min(1, "Plant name is required")
    .max(100, "Plant name must be at most 100 characters long")
    .trim(),
  location: z
    .string()
    .max(200, "Location must be at most 200 characters long")
    .trim()
    .optional(),
});

export const UpdatePlantSchema = CreatePlantSchema.partial();

