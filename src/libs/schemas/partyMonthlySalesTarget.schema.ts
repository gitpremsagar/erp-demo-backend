import { z } from "zod";

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

const yearSchema = z.coerce
  .number()
  .int("Year must be an integer")
  .min(2000, "Year must be at least 2000")
  .max(2100, "Year must be at most 2100");

const monthSchema = z.coerce
  .number()
  .int("Month must be an integer")
  .min(1, "Month must be between 1 and 12")
  .max(12, "Month must be between 1 and 12");

const targetAmountSchema = z
  .union([z.number().nonnegative("targetAmount must be non-negative"), z.null()])
  .optional();

const targetVehiclesSchema = z
  .union([
    z
      .number()
      .int("targetVehicles must be an integer")
      .nonnegative("targetVehicles must be non-negative"),
    z.null(),
  ])
  .optional();

const customerIdSchema = z
  .string()
  .min(1, "customerId is required")
  .refine((id) => OBJECT_ID_RE.test(id), "Invalid customerId");

export const UpsertPartyMonthlySalesTargetSchema = z
  .object({
    customerId: customerIdSchema,
    year: yearSchema,
    month: monthSchema,
    targetAmount: targetAmountSchema,
    targetVehicles: targetVehiclesSchema,
  })
  .refine(
    (data) => data.targetAmount !== undefined || data.targetVehicles !== undefined,
    { message: "At least one of targetAmount or targetVehicles is required" }
  );

export const BulkUpsertPartyMonthlySalesTargetSchema = z.object({
  year: yearSchema,
  month: monthSchema,
  targets: z
    .array(
      z
        .object({
          customerId: customerIdSchema,
          targetAmount: targetAmountSchema,
          targetVehicles: targetVehiclesSchema,
        })
        .refine(
          (data) =>
            data.targetAmount !== undefined || data.targetVehicles !== undefined,
          { message: "At least one of targetAmount or targetVehicles is required" }
        )
    )
    .min(1, "At least one target is required"),
});
