import { z } from "zod";

export const CreateDispatchTripSchema = z.object({
  tripNumber: z
    .number()
    .int("Trip number must be an integer")
    .min(1, "Trip number must be at least 1")
    .optional()
    .default(1),
  tripDate: z.coerce.date().optional().default(() => new Date()),
  distributorId: z.string().trim().optional().nullable(),
  orderId: z.string().trim().optional().nullable(),
  vehicleId: z.string().trim().optional().nullable(),
  driverId: z.string().trim().optional().nullable(),
  remarks: z.string().trim().optional().nullable(),
  vehiclePosition: z.number().int().min(1).optional().nullable(),
});

const objectId = z.string().trim().min(24, "Invalid ID").max(24, "Invalid ID");

export const CreatePendingDistributorSchema = z.object({
  distributorId: objectId,
  remarks: z.string().trim().optional().nullable(),
});

export const UpdatePendingDistributorSchema = z.object({
  remarks: z.string().trim().optional().nullable(),
});

export const UpdateDispatchTripSchema = z.object({
  tripNumber: z
    .number()
    .int("Trip number must be an integer")
    .min(1, "Trip number must be at least 1")
    .optional(),
  tripDate: z.coerce.date().optional(),
  distributorId: z.string().trim().optional().nullable(),
  orderId: z.string().trim().optional().nullable(),
  vehicleId: z.string().trim().optional().nullable(),
  driverId: z.string().trim().optional().nullable(),
  remarks: z.string().trim().optional().nullable(),
  vehiclePosition: z.number().int().min(1).optional().nullable(),
});
