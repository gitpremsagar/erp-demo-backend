"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerQuerySchema = exports.UpdateCustomerSchema = exports.CreateCustomerSchema = void 0;
const zod_1 = require("zod");
exports.CreateCustomerSchema = zod_1.z.object({
    // User fields
    name: zod_1.z
        .string()
        .min(1, "Customer name is required")
        .max(100, "Customer name must be at most 100 characters long")
        .trim(),
    email: zod_1.z
        .email({ message: "Invalid email format" })
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
    // CustomerDetail fields
    dbName: zod_1.z
        .string()
        .min(1, "DB name is required")
        .max(100, "DB name must be at most 100 characters long")
        .trim(),
    dbCategory: zod_1.z
        .enum(["RSS", "DISTRIBUTOR", "SS", "WB", "CHK", "OTHER"], {
        message: "DB category must be one of: RSS, DISTRIBUTOR, SS, WB, CHK, or OTHER",
    }),
    area: zod_1.z
        .string()
        .min(1, "Area is required")
        .max(200, "Area must be at most 200 characters long")
        .trim(),
    state: zod_1.z
        .string()
        .min(1, "State is required")
        .max(100, "State must be at most 100 characters long")
        .trim(),
    address: zod_1.z
        .string()
        .min(1, "Address is required")
        .max(500, "Address must be at most 500 characters long")
        .trim(),
    pincode: zod_1.z
        .string()
        .trim()
        .optional(),
    vehicleType: zod_1.z
        .string()
        .max(100, "Vehicle type must be at most 100 characters long")
        .trim()
        .optional(),
    panNumber: zod_1.z
        .string()
        .trim()
        .nullish(),
    gstinNumber: zod_1.z
        .string()
        .trim()
        .nullish(),
    ownerAadharNumber: zod_1.z
        .number()
        .int("Aadhar number must be an integer")
        .max(999999999999, "Aadhar number must be a 12-digit number")
        .nullish(),
    salesOfficerName: zod_1.z
        .string()
        .max(100, "Sales officer name must be at most 100 characters long")
        .trim()
        .optional(),
    salesOfficerContact: zod_1.z
        .string()
        .max(15, "Contact number must be at most 15 digits")
        .trim()
        .optional(),
    contact2: zod_1.z
        .string()
        .max(15, "Contact number must be at most 15 digits")
        .trim()
        .optional(),
    creditLimit: zod_1.z
        .number()
        .int("Credit limit must be an integer")
        .min(0, "Credit limit must be a positive number")
        .default(0),
    paymentTerms: zod_1.z
        .enum(["ADVANCE", "ONE_BILL_CREDIT"], {
        message: "Payment terms must be either ADVANCE or ONE_BILL_CREDIT",
    })
        .default("ADVANCE"),
    isCashDiscountAllowed: zod_1.z
        .boolean()
        .default(false),
    cashDiscountPercentage: zod_1.z
        .enum(["POINT_5", "POINT_75"], {
        message: "Cash discount percentage must be either POINT_5 (0.5%) or POINT_75 (0.75%)",
    })
        .nullable()
        .optional(),
    isSundayDispatchAllowed: zod_1.z
        .boolean()
        .default(false),
    isMondayDispatchAllowed: zod_1.z
        .boolean()
        .default(false),
    isTuesdayDispatchAllowed: zod_1.z
        .boolean()
        .default(false),
    isWednesdayDispatchAllowed: zod_1.z
        .boolean()
        .default(false),
    isThursdayDispatchAllowed: zod_1.z
        .boolean()
        .default(false),
    isFridayDispatchAllowed: zod_1.z
        .boolean()
        .default(false),
    isSaturdayDispatchAllowed: zod_1.z
        .boolean()
        .default(false),
    twoSideDistance: zod_1.z
        .number()
        .int("Two side distance must be an integer")
        .min(0, "Two side distance must be at least 0")
        .default(0),
});
exports.UpdateCustomerSchema = zod_1.z.object({
    // User fields
    name: zod_1.z
        .string()
        .min(1, "Customer name is required")
        .max(100, "Customer name must be at most 100 characters long")
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
    // CustomerDetail fields
    dbName: zod_1.z
        .string()
        .min(1, "DB name is required")
        .max(100, "DB name must be at most 100 characters long")
        .trim()
        .optional(),
    dbCategory: zod_1.z
        .enum(["RSS", "DISTRIBUTOR", "SS", "WB", "CHK", "OTHER"], {
        message: "DB category must be one of: RSS, DISTRIBUTOR, SS, WB, CHK, or OTHER",
    })
        .optional(),
    area: zod_1.z
        .string()
        .max(200, "Area must be at most 200 characters long")
        .trim()
        .optional(),
    state: zod_1.z
        .string()
        .max(100, "State must be at most 100 characters long")
        .trim()
        .optional(),
    address: zod_1.z
        .string()
        .max(500, "Address must be at most 500 characters long")
        .trim()
        .optional(),
    pincode: zod_1.z
        .string()
        .trim()
        .optional(),
    vehicleType: zod_1.z
        .string()
        .max(100, "Vehicle type must be at most 100 characters long")
        .trim()
        .optional(),
    panNumber: zod_1.z
        .string()
        .trim()
        .nullish(),
    gstinNumber: zod_1.z
        .string()
        .trim()
        .nullish(),
    ownerAadharNumber: zod_1.z
        .number()
        .int("Aadhar number must be an integer")
        .max(999999999999, "Aadhar number must be a 12-digit number")
        .nullish(),
    salesOfficerName: zod_1.z
        .string()
        .max(100, "Sales officer name must be at most 100 characters long")
        .trim()
        .optional(),
    salesOfficerContact: zod_1.z
        .string()
        .max(15, "Contact number must be at most 15 digits")
        .trim()
        .optional(),
    contact2: zod_1.z
        .string()
        .max(15, "Contact number must be at most 15 digits")
        .trim()
        .optional(),
    creditLimit: zod_1.z
        .number()
        .int("Credit limit must be an integer")
        .min(0, "Credit limit must be a positive number")
        .optional(),
    paymentTerms: zod_1.z
        .enum(["ADVANCE", "ONE_BILL_CREDIT"], {
        message: "Payment terms must be either ADVANCE or ONE_BILL_CREDIT",
    })
        .optional(),
    isCashDiscountAllowed: zod_1.z
        .boolean()
        .optional(),
    cashDiscountPercentage: zod_1.z
        .enum(["POINT_5", "POINT_75"], {
        message: "Cash discount percentage must be either POINT_5 (0.5%) or POINT_75 (0.75%)",
    })
        .nullable()
        .optional(),
    isSundayDispatchAllowed: zod_1.z
        .boolean()
        .optional(),
    isMondayDispatchAllowed: zod_1.z
        .boolean()
        .optional(),
    isTuesdayDispatchAllowed: zod_1.z
        .boolean()
        .optional(),
    isWednesdayDispatchAllowed: zod_1.z
        .boolean()
        .optional(),
    isThursdayDispatchAllowed: zod_1.z
        .boolean()
        .optional(),
    isFridayDispatchAllowed: zod_1.z
        .boolean()
        .optional(),
    isSaturdayDispatchAllowed: zod_1.z
        .boolean()
        .optional(),
    twoSideDistance: zod_1.z
        .number()
        .int("Two side distance must be an integer")
        .min(0, "Two side distance must be at least 0")
        .optional(),
});
exports.CustomerQuerySchema = zod_1.z.object({
    page: zod_1.z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: zod_1.z.string().regex(/^\d+$/).transform(Number).optional(),
    search: zod_1.z.string().trim().optional(),
});
//# sourceMappingURL=customerForm.schema.js.map