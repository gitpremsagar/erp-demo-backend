import { z } from "zod";

export const CreateCustomerSchema = z.object({
  // User fields
  name: z
    .string()
    .min(1, "Customer name is required")
    .max(100, "Customer name must be at most 100 characters long")
    .trim(),
  email: z
    .email({ message: "Invalid email format" })
    .trim(),
  phone: z
    .string()
    .max(15, "Phone number must be at most 15 digits")
    .trim()
    .optional(),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters long")
    .optional(),

  // CustomerDetail fields
  dbName: z
    .string()
    .min(1, "DB name is required")
    .max(100, "DB name must be at most 100 characters long")
    .trim(),
  dbCategory: z
    .enum(["RSS", "DISTRIBUTOR", "SS", "WB", "CHK", "OTHER"], {
      message: "DB category must be one of: RSS, DISTRIBUTOR, SS, WB, CHK, or OTHER",
    }),
  area: z
    .string()
    .min(1, "Area is required")
    .max(200, "Area must be at most 200 characters long")
    .trim(),
  state: z
    .string()
    .min(1, "State is required")
    .max(100, "State must be at most 100 characters long")
    .trim(),
  address: z
    .string()
    .min(1, "Address is required")
    .max(500, "Address must be at most 500 characters long")
    .trim(),
  pincode: z
    .string()
    .trim()
    .optional(),
  vehicleType: z
    .string()
    .max(100, "Vehicle type must be at most 100 characters long")
    .trim()
    .optional(),
  panNumber: z
    .string()
    .trim()
    .nullish(),
  gstinNumber: z
    .string()
    .trim()
    .nullish(),
  ownerAadharNumber: z
    .number()
    .int("Aadhar number must be an integer")
    .max(999999999999, "Aadhar number must be a 12-digit number")
    .nullish(),
  salesOfficerName: z
    .string()
    .max(100, "Sales officer name must be at most 100 characters long")
    .trim()
    .optional(),
  salesOfficerContact: z
    .string()
    .max(15, "Contact number must be at most 15 digits")
    .trim()
    .optional(),
  contact2: z
    .string()
    .max(15, "Contact number must be at most 15 digits")
    .trim()
    .optional(),
  creditLimit: z
    .number()
    .int("Credit limit must be an integer")
    .min(0, "Credit limit must be a positive number")
    .default(0),
  paymentTerms: z
    .enum(["ADVANCE", "ONE_BILL_CREDIT"], {
      message: "Payment terms must be either ADVANCE or ONE_BILL_CREDIT",
    })
    .default("ADVANCE"),
  isCashDiscountAllowed: z
    .boolean()
    .default(false),
  cashDiscountPercentage: z
    .enum(["POINT_5", "POINT_75"], {
      message: "Cash discount percentage must be either POINT_5 (0.5%) or POINT_75 (0.75%)",
    })
    .nullable()
    .optional(),
  isSundayDispatchAllowed: z
    .boolean()
    .default(false),
  isMondayDispatchAllowed: z
    .boolean()
    .default(false),
  isTuesdayDispatchAllowed: z
    .boolean()
    .default(false),
  isWednesdayDispatchAllowed: z
    .boolean()
    .default(false),
  isThursdayDispatchAllowed: z
    .boolean()
    .default(false),
  isFridayDispatchAllowed: z
    .boolean()
    .default(false),
  isSaturdayDispatchAllowed: z
    .boolean()
    .default(false),
  twoSideDistance: z
    .number()
    .int("Two side distance must be an integer")
    .min(0, "Two side distance must be at least 0")
    .default(0),
});

export const UpdateCustomerSchema = z.object({
  // User fields
  name: z
    .string()
    .min(1, "Customer name is required")
    .max(100, "Customer name must be at most 100 characters long")
    .trim()
    .optional(),
  phone: z
    .string()
    .max(15, "Phone number must be at most 15 digits")
    .trim()
    .optional(),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters long")
    .optional(),

  // CustomerDetail fields
  dbName: z
    .string()
    .min(1, "DB name is required")
    .max(100, "DB name must be at most 100 characters long")
    .trim()
    .optional(),
  dbCategory: z
    .enum(["RSS", "DISTRIBUTOR", "SS", "WB", "CHK", "OTHER"], {
      message: "DB category must be one of: RSS, DISTRIBUTOR, SS, WB, CHK, or OTHER",
    })
    .optional(),
  area: z
    .string()
    .max(200, "Area must be at most 200 characters long")
    .trim()
    .optional(),
  state: z
    .string()
    .max(100, "State must be at most 100 characters long")
    .trim()
    .optional(),
  address: z
    .string()
    .max(500, "Address must be at most 500 characters long")
    .trim()
    .optional(),
  pincode: z
    .string()
    .trim()
    .optional(),
  vehicleType: z
    .string()
    .max(100, "Vehicle type must be at most 100 characters long")
    .trim()
    .optional(),
  panNumber: z
    .string()
    .trim()
    .nullish(),
  gstinNumber: z
    .string()
    .trim()
    .nullish(),
  ownerAadharNumber: z
    .number()
    .int("Aadhar number must be an integer")
    .max(999999999999, "Aadhar number must be a 12-digit number")
    .nullish(),
  salesOfficerName: z
    .string()
    .max(100, "Sales officer name must be at most 100 characters long")
    .trim()
    .optional(),
  salesOfficerContact: z
    .string()
    .max(15, "Contact number must be at most 15 digits")
    .trim()
    .optional(),
  contact2: z
    .string()
    .max(15, "Contact number must be at most 15 digits")
    .trim()
    .optional(),
  creditLimit: z
    .number()
    .int("Credit limit must be an integer")
    .min(0, "Credit limit must be a positive number")
    .optional(),
  paymentTerms: z
    .enum(["ADVANCE", "ONE_BILL_CREDIT"], {
      message: "Payment terms must be either ADVANCE or ONE_BILL_CREDIT",
    })
    .optional(),
  isCashDiscountAllowed: z
    .boolean()
    .optional(),
  cashDiscountPercentage: z
    .enum(["POINT_5", "POINT_75"], {
      message: "Cash discount percentage must be either POINT_5 (0.5%) or POINT_75 (0.75%)",
    })
    .nullable()
    .optional(),
  isSundayDispatchAllowed: z
    .boolean()
    .optional(),
  isMondayDispatchAllowed: z
    .boolean()
    .optional(),
  isTuesdayDispatchAllowed: z
    .boolean()
    .optional(),
  isWednesdayDispatchAllowed: z
    .boolean()
    .optional(),
  isThursdayDispatchAllowed: z
    .boolean()
    .optional(),
  isFridayDispatchAllowed: z
    .boolean()
    .optional(),
  isSaturdayDispatchAllowed: z
    .boolean()
    .optional(),
  twoSideDistance: z
    .number()
    .int("Two side distance must be an integer")
    .min(0, "Two side distance must be at least 0")
    .optional(),
});

export const CustomerQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  search: z.string().trim().optional(),
});
