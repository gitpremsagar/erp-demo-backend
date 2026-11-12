"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignupFormSchema = void 0;
const zod_1 = require("zod");
const passwordSchema = zod_1.z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be at most 100 characters long")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[0-9]/, "Must contain at least one number")
    .trim();
exports.SignupFormSchema = zod_1.z
    .object({
    email: zod_1.z.string().email("Invalid email format"),
    password: passwordSchema,
    name: zod_1.z
        .string()
        .min(2, "Name must be at least 2 characters long")
        .max(100, "Name must be at most 100 characters long")
        .trim(),
    phone: zod_1.z
        .string()
        .min(10, "Phone number must be at least 10 digits")
        .max(15, "Phone number must be at most 15 digits")
        .trim()
        .optional(),
    aadharNumber: zod_1.z.number().optional(),
    pan: zod_1.z.string().optional(),
    gstNumber: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    // userType intentionally omitted — public signup always creates CUSTOMER
    confirmPassword: zod_1.z.string().min(1, "Confirm password is required").trim(),
})
    .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});
//# sourceMappingURL=signupForm.schema.js.map