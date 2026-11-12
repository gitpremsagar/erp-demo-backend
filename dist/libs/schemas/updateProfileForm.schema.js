"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateProfileFormSchema = void 0;
const zod_1 = require("zod");
exports.UpdateProfileFormSchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .min(2, "Name must be at least 2 characters long")
        .max(100, "Name must be at most 100 characters long")
        .trim()
        .optional(),
    phone: zod_1.z
        .string()
        .min(10, "Phone number must be at least 10 digits")
        .max(15, "Phone number must be at most 15 digits")
        .trim()
        .optional()
        .nullable(),
    email: zod_1.z.string().email("Invalid email format").optional(),
});
//# sourceMappingURL=updateProfileForm.schema.js.map