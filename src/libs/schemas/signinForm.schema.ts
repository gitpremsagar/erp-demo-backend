import { z } from "zod";

export const SigninFormSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required").max(100, "Invalid password"),
});
