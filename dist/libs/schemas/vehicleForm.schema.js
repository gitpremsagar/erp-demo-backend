"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateVehicleSchema = exports.CreateVehicleSchema = void 0;
const zod_1 = require("zod");
// Vehicle Schema
exports.CreateVehicleSchema = zod_1.z.object({
    vehicleName: zod_1.z
        .string()
        .min(1, "Vehicle name is required")
        .max(100, "Vehicle name must be at most 100 characters long")
        .trim(),
    vehicleNumber: zod_1.z
        .string()
        .min(1, "Vehicle number is required")
        .max(20, "Vehicle number must be at most 20 characters long")
        .trim(),
    vehicleTypeId: zod_1.z
        .string()
        .min(1, "Vehicle type is required")
        .trim(),
    capacity: zod_1.z
        .number()
        .int("Capacity must be a whole number")
        .positive("Capacity must be positive")
        .min(1, "Capacity must be at least 1"),
    mileage: zod_1.z
        .number()
        .positive("Mileage must be positive")
        .max(100, "Mileage must be at most 100 km/L"),
});
exports.UpdateVehicleSchema = exports.CreateVehicleSchema.partial();
//# sourceMappingURL=vehicleForm.schema.js.map