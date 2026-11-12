"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateDispatchTripSchema = exports.UpdatePendingDistributorSchema = exports.CreatePendingDistributorSchema = exports.CreateDispatchTripSchema = void 0;
const zod_1 = require("zod");
exports.CreateDispatchTripSchema = zod_1.z.object({
    tripNumber: zod_1.z
        .number()
        .int("Trip number must be an integer")
        .min(1, "Trip number must be at least 1")
        .optional()
        .default(1),
    tripDate: zod_1.z.coerce.date().optional().default(() => new Date()),
    distributorId: zod_1.z.string().trim().optional().nullable(),
    orderId: zod_1.z.string().trim().optional().nullable(),
    vehicleId: zod_1.z.string().trim().optional().nullable(),
    driverId: zod_1.z.string().trim().optional().nullable(),
    remarks: zod_1.z.string().trim().optional().nullable(),
    vehiclePosition: zod_1.z.number().int().min(1).optional().nullable(),
});
const objectId = zod_1.z.string().trim().min(24, "Invalid ID").max(24, "Invalid ID");
exports.CreatePendingDistributorSchema = zod_1.z.object({
    distributorId: objectId,
    remarks: zod_1.z.string().trim().optional().nullable(),
});
exports.UpdatePendingDistributorSchema = zod_1.z.object({
    remarks: zod_1.z.string().trim().optional().nullable(),
});
exports.UpdateDispatchTripSchema = zod_1.z.object({
    tripNumber: zod_1.z
        .number()
        .int("Trip number must be an integer")
        .min(1, "Trip number must be at least 1")
        .optional(),
    tripDate: zod_1.z.coerce.date().optional(),
    distributorId: zod_1.z.string().trim().optional().nullable(),
    orderId: zod_1.z.string().trim().optional().nullable(),
    vehicleId: zod_1.z.string().trim().optional().nullable(),
    driverId: zod_1.z.string().trim().optional().nullable(),
    remarks: zod_1.z.string().trim().optional().nullable(),
    vehiclePosition: zod_1.z.number().int().min(1).optional().nullable(),
});
//# sourceMappingURL=dispatch-trip.schema.js.map