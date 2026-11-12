import { z } from "zod";

export const DepartmentValues = ["WAREHOUSE", "ADMINISTRATION"] as const;
export const DepartmentSchema = z.enum(DepartmentValues);

export const WarehouseEmployeeCategoryValues = [
  "STAFF",
  "DRIVER",
  "LABOR",
  "WB_LABOR",
] as const;
export const WarehouseEmployeeCategorySchema = z.enum(WarehouseEmployeeCategoryValues);

const warehouseCategoryRefine = (
  data: {
    department?: (typeof DepartmentValues)[number];
    warehouseCategory?: (typeof WarehouseEmployeeCategoryValues)[number] | null;
  },
  ctx: z.RefinementCtx
) => {
  if (data.department === "WAREHOUSE" && !data.warehouseCategory) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Warehouse category is required for warehouse employees",
      path: ["warehouseCategory"],
    });
  }
  if (
    data.department === "ADMINISTRATION" &&
    data.warehouseCategory != null &&
    data.warehouseCategory !== undefined
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Warehouse category must not be set for administration employees",
      path: ["warehouseCategory"],
    });
  }
};

// Employee-related user types (ADMIN allowed in create so super-admin can create admins; controller enforces permission)
const EmployeeUserTypes: [string, ...string[]] = [
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

export const CreateEmployeeSchema = z
  .object({
  name: z
    .string()
    .min(1, "Employee name is required")
    .max(100, "Employee name must be at most 100 characters long")
    .trim(),
  email: z
    .string()
    .email("Invalid email format")
    .trim(),
  phone: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .max(15, "Phone number must be at most 15 digits")
    .trim(),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters long")
    .optional(),
  userType: z
    .enum(EmployeeUserTypes, {
      message: `userType must be one of: ${EmployeeUserTypes.join(", ")}`,
    })
    .default("EMPLOYEE"),
  department: DepartmentSchema.optional(),
  warehouseCategory: WarehouseEmployeeCategorySchema.nullable().optional(),
  address: z
    .string()
    .min(1, "Address is required")
    .max(500, "Address must be at most 500 characters long")
    .trim()
    .optional(),
  aadharNumber: z
    .number()
    .int("Aadhar number must be an integer")
    .positive("Aadhar number must be positive")
    .optional(),
  pan: z
    .string()
    .min(10, "PAN must be 10 characters long")
    .max(10, "PAN must be 10 characters long")
    .trim()
    .optional(),
})
  .superRefine(warehouseCategoryRefine);

export const UpdateEmployeeSchema = z
  .object({
  name: z
    .string()
    .min(1, "Employee name is required")
    .max(100, "Employee name must be at most 100 characters long")
    .trim()
    .optional(),
  email: z
    .string()
    .email("Invalid email format")
    .trim()
    .optional(),
  phone: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .max(15, "Phone number must be at most 15 digits")
    .trim()
    .optional(),
  userType: z
    .enum(EmployeeUserTypes, {
      message: `userType must be one of: ${EmployeeUserTypes.join(", ")}`,
    })
    .optional(),
  department: DepartmentSchema.optional(),
  warehouseCategory: WarehouseEmployeeCategorySchema.nullable().optional(),
  address: z
    .string()
    .min(1, "Address is required")
    .max(500, "Address must be at most 500 characters long")
    .trim()
    .optional(),
  aadharNumber: z
    .number()
    .int("Aadhar number must be an integer")
    .positive("Aadhar number must be positive")
    .optional(),
  pan: z
    .string()
    .min(10, "PAN must be 10 characters long")
    .max(10, "PAN must be 10 characters long")
    .trim()
    .optional(),
})
  .superRefine(warehouseCategoryRefine);

export const EmployeeQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  search: z.string().trim().optional(),
  userType: z
    .enum(EmployeeUserTypes, {
      message: `userType must be one of: ${EmployeeUserTypes.join(", ")}`,
    })
    .optional(),
  department: DepartmentSchema.optional(),
});
