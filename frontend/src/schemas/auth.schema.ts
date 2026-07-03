import { z } from "zod"

export const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  roleName: z.enum(["student", "instructor"]),
})
export type RegisterForm = z.infer<typeof registerSchema>

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
})
export type LoginForm = z.infer<typeof loginSchema>