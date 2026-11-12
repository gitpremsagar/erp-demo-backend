"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeQuerySchema = exports.UpdateEmployeeSchema = exports.CreateEmployeeSchema = exports.WarehouseEmployeeCategorySchema = exports.WarehouseEmployeeCategoryValues = exports.DepartmentSchema = exports.DepartmentValues = void 0;
const zod_1 = require("zod");
exports.DepartmentValues = ["WAREHOUSE", "ADMINISTRATION"];
exports.DepartmentSchema = zod_1.z.enum(exports.DepartmentValues);
exports.WarehouseEmployeeCategoryValues = [
    "STAFF",
    "DRIVER",
    "LABOR",
    "WB_LABOR",
];
exports.WarehouseEmployeeCategorySchema = zod_1.z.enum(exports.WarehouseEmployeeCategoryValues);
const warehouseCategoryRefine = (data, ctx) => {
    if (data.department === "WAREHOUSE" && !data.warehouseCategory) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "Warehouse category is required for warehouse employees",
            path: ["warehouseCategory"],
        });
    }
    if (data.department === "ADMINISTRATION" &&
        data.warehouseCategory != null &&
        data.warehouseCategory !== undefined) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "Warehouse category must not be set for administration employees",
            path: ["warehouseCategory"],
        });
    }
};
// Employee-related user types (ADMIN allowed in create so super-admin can create admins; controller enforces permission)
const EmployeeUserTypes = [
    "EMPLOYEE",
    "ACCOUNTANT",
    "DRIVER",
    "WAREHOUSE_MANAGER",
    "ORDER_MANAGER",
    "PURCHASING_MANAGER",
    "GUARD",
    "ADMIN",
    "MIS",
];
exports.CreateEmployeeSchema = zod_1.z
    .object({
    name: zod_1.z
        .string()
        .min(1, "Employee name is required")
        .max(100, "Employee name must be at most 100 characters long")
        .trim(),
    email: zod_1.z
        .string()
        .email("Invalid email format")
        .trim(),
    phone: zod_1.z
        .string()
        .min(10, "Phone number must be at least 10 digits")
        .max(15, "Phone number must be at most 15 digits")
        .trim(),
    password: zod_1.z
        .string()
        .min(6, "Password must be at least 6 characters long")
        .optional(),
    userType: zod_1.z
        .enum(EmployeeUserTypes, {
        message: `userType must be one of: ${EmployeeUserTypes.join(", ")}`,
    })
        .default("EMPLOYEE"),
    department: exports.DepartmentSchema.optional(),
    warehouseCategory: exports.WarehouseEmployeeCategorySchema.nullable().optional(),
    address: zod_1.z
        .string()
        .min(1, "Address is required")
        .max(500, "Address must be at most 500 characters long")
        .trim()
        .optional(),
    aadharNumber: zod_1.z
        .number()
        .int("Aadhar number must be an integer")
        .positive("Aadhar number must be positive")
        .optional(),
    pan: zod_1.z
        .string()
        .min(10, "PAN must be 10 characters long")
        .max(10, "PAN must be 10 characters long")
        .trim()
        .optional(),
})
    .superRefine(warehouseCategoryRefine);
exports.UpdateEmployeeSchema = zod_1.z
    .object({
    name: zod_1.z
        .string()
        .min(1, "Employee name is required")
        .max(100, "Employee name must be at most 100 characters long")
        .trim()
        .optional(),
    email: zod_1.z
        .string()
        .email("Invalid email format")
        .trim()
        .optional(),
    phone: zod_1.z
        .string()
        .min(10, "Phone number must be at least 10 digits")
        .max(15, "Phone number must be at most 15 digits")
        .trim()
        .optional(),
    userType: zod_1.z
        .enum(EmployeeUserTypes, {
        message: `userType must be one of: ${EmployeeUserTypes.join(", ")}`,
    })
        .optional(),
    department: exports.DepartmentSchema.optional(),
    warehouseCategory: exports.WarehouseEmployeeCategorySchema.nullable().optional(),
    address: zod_1.z
        .string()
        .min(1, "Address is required")
        .max(500, "Address must be at most 500 characters long")
        .trim()
        .optional(),
    aadharNumber: zod_1.z
        .number()
        .int("Aadhar number must be an integer")
        .positive("Aadhar number must be positive")
        .optional(),
    pan: zod_1.z
        .string()
        .min(10, "PAN must be 10 characters long")
        .max(10, "PAN must be 10 characters long")
        .trim()
        .optional(),
})
    .superRefine(warehouseCategoryRefine);
exports.EmployeeQuerySchema = zod_1.z.object({
    page: zod_1.z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: zod_1.z.string().regex(/^\d+$/).transform(Number).optional(),
    search: zod_1.z.string().trim().optional(),
    userType: zod_1.z
        .enum(EmployeeUserTypes, {
        message: `userType must be one of: ${EmployeeUserTypes.join(", ")}`,
    })
        .optional(),
    department: exports.DepartmentSchema.optional(),
});
//# sourceMappingURL=employeeForm.schema.js.map