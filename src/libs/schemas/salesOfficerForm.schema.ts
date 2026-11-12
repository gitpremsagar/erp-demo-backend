import { z } from "zod";

export const CreateSalesOfficerSchema = z.object({
  name: z
    .string()
    .min(1, "Sales officer name is required")
    .max(100, "Sales officer name must be at most 100 characters long")
    .trim(),
  email: z
    .string()
    .email("Invalid email format")
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
});

export const UpdateSalesOfficerSchema = z.object({
  name: z
    .string()
    .min(1, "Sales officer name is required")
    .max(100, "Sales officer name must be at most 100 characters long")
    .trim()
    .optional(),
  email: z
    .string()
    .email("Invalid email format")
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
});

export const AssignDistributorSchema = z.object({
  salesOfficerId: z
    .string()
    .min(1, "Sales officer ID is required"),
  distributorId: z
    .string()
    .min(1, "Distributor ID is required"),
});
