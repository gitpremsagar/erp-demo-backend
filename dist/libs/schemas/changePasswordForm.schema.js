"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangePasswordFormSchema = void 0;
const zod_1 = require("zod");
const passwordSchema = zod_1.z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be at most 100 characters long")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[0-9]/, "Must contain at least one number")
    .trim();
exports.ChangePasswordFormSchema = zod_1.z
    .object({
    oldPassword: zod_1.z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmNewPassword: zod_1.z.string().min(1, "Confirm password is required").trim(),
})
    .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "New passwords don't match",
    path: ["confirmNewPassword"],
});
//# sourceMappingURL=changePasswordForm.schema.js.map