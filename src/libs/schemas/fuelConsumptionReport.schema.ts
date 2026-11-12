import { z } from "zod";

export const FuelConsumptionReportQuerySchema = z.object({
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
});
