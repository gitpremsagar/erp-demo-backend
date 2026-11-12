"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FuelConsumptionReportQuerySchema = void 0;
const zod_1 = require("zod");
exports.FuelConsumptionReportQuerySchema = zod_1.z.object({
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
});
//# sourceMappingURL=fuelConsumptionReport.schema.js.map