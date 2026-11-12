import { z } from "zod";

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

export const FUEL_CONSUMPTION_DISTANCE_PERIODS = [
  "month",
  "firstHalf",
  "secondHalf",
] as const;

export type FuelConsumptionDistancePeriod =
  (typeof FUEL_CONSUMPTION_DISTANCE_PERIODS)[number];

export const FuelConsumptionOrdersQuerySchema = z.object({
  year: z.coerce
    .number()
    .int("Year must be an integer")
    .min(2000, "Year must be at least 2000")
    .max(2100, "Year must be at most 2100"),
  month: z.coerce
    .number()
    .int("Month must be an integer")
    .min(1, "Month must be between 1 and 12")
    .max(12, "Month must be between 1 and 12"),
  vehicleId: z
    .string()
    .min(1, "vehicleId is required")
    .refine((id) => OBJECT_ID_RE.test(id), "Invalid vehicleId"),
  period: z.enum(FUEL_CONSUMPTION_DISTANCE_PERIODS),
});
