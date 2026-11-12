"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductVehicleWiseReportQuerySchema = void 0;
const zod_1 = require("zod");
const DATE_YMD_REGEX = /^\d{4}-\d{2}-\d{2}$/;
exports.ProductVehicleWiseReportQuerySchema = zod_1.z.object({
    date: zod_1.z
        .string()
        .trim()
        .regex(DATE_YMD_REGEX, "date must be YYYY-MM-DD"),
    includeZeroProducts: zod_1.z
        .enum(["true", "false"])
        .optional()
        .transform((v) => v === "true"),
});
//# sourceMappingURL=productVehicleWiseReport.schema.js.map