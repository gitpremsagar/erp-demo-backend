import { z } from "zod";

// Vehicle Schema
export const CreateVehicleSchema = z.object({
  vehicleName: z
    .string()
    .min(1, "Vehicle name is required")
    .max(100, "Vehicle name must be at most 100 characters long")
    .trim(),
  vehicleNumber: z
    .string()
    .min(1, "Vehicle number is required")
    .max(20, "Vehicle number must be at most 20 characters long")
    .trim(),
  vehicleTypeId: z
    .string()
    .min(1, "Vehicle type is required")
    .trim(),
  capacity: z
    .number()
    .int("Capacity must be a whole number")
    .positive("Capacity must be positive")
    .min(1, "Capacity must be at least 1"),
  mileage: z
    .number()
    .positive("Mileage must be positive")
    .max(100, "Mileage must be at most 100 km/L"),
});

export const UpdateVehicleSchema = CreateVehicleSchema.partial();
