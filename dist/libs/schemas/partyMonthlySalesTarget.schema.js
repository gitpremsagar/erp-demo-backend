"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BulkUpsertPartyMonthlySalesTargetSchema = exports.UpsertPartyMonthlySalesTargetSchema = void 0;
const zod_1 = require("zod");
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;
const yearSchema = zod_1.z.coerce
    .number()
    .int("Year must be an integer")
    .min(2000, "Year must be at least 2000")
    .max(2100, "Year must be at most 2100");
const monthSchema = zod_1.z.coerce
    .number()
    .int("Month must be an integer")
    .min(1, "Month must be between 1 and 12")
    .max(12, "Month must be between 1 and 12");
const targetAmountSchema = zod_1.z
    .union([zod_1.z.number().nonnegative("targetAmount must be non-negative"), zod_1.z.null()])
    .optional();
const targetVehiclesSchema = zod_1.z
    .union([
    zod_1.z
        .number()
        .int("targetVehicles must be an integer")
        .nonnegative("targetVehicles must be non-negative"),
    zod_1.z.null(),
])
    .optional();
const customerIdSchema = zod_1.z
    .string()
    .min(1, "customerId is required")
    .refine((id) => OBJECT_ID_RE.test(id), "Invalid customerId");
exports.UpsertPartyMonthlySalesTargetSchema = zod_1.z
    .object({
    customerId: customerIdSchema,
    year: yearSchema,
    month: monthSchema,
    targetAmount: targetAmountSchema,
    targetVehicles: targetVehiclesSchema,
})
    .refine((data) => data.targetAmount !== undefined || data.targetVehicles !== undefined, { message: "At least one of targetAmount or targetVehicles is required" });
exports.BulkUpsertPartyMonthlySalesTargetSchema = zod_1.z.object({
    year: yearSchema,
    month: monthSchema,
    targets: zod_1.z
        .array(zod_1.z
        .object({
        customerId: customerIdSchema,
        targetAmount: targetAmountSchema,
        targetVehicles: targetVehiclesSchema,
    })
        .refine((data) => data.targetAmount !== undefined || data.targetVehicles !== undefined, { message: "At least one of targetAmount or targetVehicles is required" }))
        .min(1, "At least one target is required"),
});
//# sourceMappingURL=partyMonthlySalesTarget.schema.js.map