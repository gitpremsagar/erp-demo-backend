"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateVehicleTypeSchema = exports.CreateVehicleTypeSchema = void 0;
const zod_1 = require("zod");
// Vehicle Type Schema
exports.CreateVehicleTypeSchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .min(1, "Vehicle type name is required")
        .max(100, "Vehicle type name must be at most 100 characters long")
        .trim(),
});
exports.UpdateVehicleTypeSchema = exports.CreateVehicleTypeSchema.partial();
//# sourceMappingURL=vehicleTypeForm.schema.js.map