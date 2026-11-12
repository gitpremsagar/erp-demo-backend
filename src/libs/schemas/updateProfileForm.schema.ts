import { z } from "zod";

export const UpdateProfileFormSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters long")
    .max(100, "Name must be at most 100 characters long")
    .trim()
    .optional(),
  phone: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .max(15, "Phone number must be at most 15 digits")
    .trim()
    .optional()
    .nullable(),
  email: z.string().email("Invalid email format").optional(),
});
