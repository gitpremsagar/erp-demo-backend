"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssignDistributorSchema = exports.UpdateSalesOfficerSchema = exports.CreateSalesOfficerSchema = void 0;
const zod_1 = require("zod");
exports.CreateSalesOfficerSchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .min(1, "Sales officer name is required")
        .max(100, "Sales officer name must be at most 100 characters long")
        .trim(),
    email: zod_1.z
        .string()
        .email("Invalid email format")
        .trim(),
    phone: zod_1.z
        .string()
        .max(15, "Phone number must be at most 15 digits")
        .trim()
        .optional(),
    password: zod_1.z
        .string()
        .min(6, "Password must be at least 6 characters long")
        .optional(),
});
exports.UpdateSalesOfficerSchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .min(1, "Sales officer name is required")
        .max(100, "Sales officer name must be at most 100 characters long")
        .trim()
        .optional(),
    email: zod_1.z
        .string()
        .email("Invalid email format")
        .trim()
        .optional(),
    phone: zod_1.z
        .string()
        .max(15, "Phone number must be at most 15 digits")
        .trim()
        .optional(),
    password: zod_1.z
        .string()
        .min(6, "Password must be at least 6 characters long")
        .optional(),
});
exports.AssignDistributorSchema = zod_1.z.object({
    salesOfficerId: zod_1.z
        .string()
        .min(1, "Sales officer ID is required"),
    distributorId: zod_1.z
        .string()
        .min(1, "Distributor ID is required"),
});
//# sourceMappingURL=salesOfficerForm.schema.js.map