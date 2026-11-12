"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateFuelConsumptionEntrySchema = exports.FUEL_CONSUMPTION_EDITABLE_FIELDS = void 0;
const zod_1 = require("zod");
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;
exports.FUEL_CONSUMPTION_EDITABLE_FIELDS = [
    "actualFuelFirstHalf",
    "actualFuelSecondHalf",
    "meterReadingDay1",
    "meterReadingDay16",
    "meterReadingLastDay",
];
exports.UpdateFuelConsumptionEntrySchema = zod_1.z.object({
    year: zod_1.z.coerce
        .number()
        .int("Year must be an integer")
        .min(2000, "Year must be at least 2000")
        .max(2100, "Year must be at most 2100"),
    month: zod_1.z.coerce
        .number()
        .int("Month must be an integer")
        .min(1, "Month must be between 1 and 12")
        .max(12, "Month must be between 1 and 12"),
    vehicleId: zod_1.z
        .string()
        .min(1, "vehicleId is required")
        .refine((id) => OBJECT_ID_RE.test(id), "Invalid vehicleId"),
    field: zod_1.z.enum(exports.FUEL_CONSUMPTION_EDITABLE_FIELDS),
    value: zod_1.z
        .union([
        zod_1.z.number().nonnegative("Value must be non-negative"),
        zod_1.z.null(),
    ])
        .optional(),
});
//# sourceMappingURL=fuelConsumptionEntry.schema.js.map