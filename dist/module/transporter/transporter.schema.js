"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateTransporterSchema = exports.CreateTransporterSchema = void 0;
const zod_1 = require("zod");
exports.CreateTransporterSchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .min(1, "Name is required")
        .max(200, "Name must be at most 200 characters")
        .trim(),
    transporterContact: zod_1.z
        .string()
        .max(100, "Contact must be at most 100 characters")
        .trim()
        .optional()
        .nullable(),
    area: zod_1.z
        .string()
        .max(100, "Area must be at most 100 characters")
        .trim()
        .optional()
        .nullable(),
});
exports.UpdateTransporterSchema = exports.CreateTransporterSchema.partial();
//# sourceMappingURL=transporter.schema.js.map