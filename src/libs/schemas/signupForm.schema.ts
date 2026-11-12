import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(100, "Password must be at most 100 characters long")
  .regex(/[A-Z]/, "Must contain at least one uppercase letter")
  .regex(/[0-9]/, "Must contain at least one number")
  .trim();

export const SignupFormSchema = z
  .object({
    email: z.string().email("Invalid email format"),
    password: passwordSchema,
    name: z
      .string()
      .min(2, "Name must be at least 2 characters long")
      .max(100, "Name must be at most 100 characters long")
      .trim(),
    phone: z
      .string()
      .min(10, "Phone number must be at least 10 digits")
      .max(15, "Phone number must be at most 15 digits")
      .trim()
      .optional(),
    aadharNumber: z.number().optional(),
    pan: z.string().optional(),
    gstNumber: z.string().optional(),
    address: z.string().optional(),
    // userType intentionally omitted — public signup always creates CUSTOMER
    confirmPassword: z.string().min(1, "Confirm password is required").trim(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
