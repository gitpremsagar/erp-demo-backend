import { z } from "zod";

const DATE_YMD_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const ProductVehicleWiseReportQuerySchema = z.object({
  date: z
    .string()
    .trim()
    .regex(DATE_YMD_REGEX, "date must be YYYY-MM-DD"),
  includeZeroProducts: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export type ProductVehicleWiseReportQuery = z.infer<
  typeof ProductVehicleWiseReportQuerySchema
>;
