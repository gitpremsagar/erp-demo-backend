import { z } from "zod";

// Vehicle Type Schema
export const CreateVehicleTypeSchema = z.object({
  name: z
    .string()
    .min(1, "Vehicle type name is required")
    .max(100, "Vehicle type name must be at most 100 characters long")
    .trim(),
});

export const UpdateVehicleTypeSchema = CreateVehicleTypeSchema.partial();
