import { Router, Request, Response } from "express"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import asyncHandler from "express-async-handler"
import { db } from "../config/db.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"

const authRouter = Router()

import { z } from "zod"

// -- types --
export interface Role {
  roleId: number
  roleName: string
  description: string | null
}
export interface User {
  userId: number
  username: string
  email: string
  passwordHash: string
  roleId: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}
export type PublicUser = Omit<User, "passwordHash">

// -- schemas --

export const RegisterSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  roleName: z.enum(["student", "instructor"])
})
export type RegisterInput = z.infer<typeof RegisterSchema>

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required")
})
export type LoginInput = z.infer<typeof LoginSchema>

// -- routes --

// POST /api/auth/register
authRouter.post("/register", asyncHandler(async (req: Request, res: Response) => {
  const { username, email, password, roleName } = RegisterSchema.parse(req.body)
  const { rows: existingRows } = await db.query<User>(
    `SELECT user_id FROM users WHERE email = $1`,
    [email]
  )
  if (existingRows[0]) {
    throw new ApiError("Email already in use", 409)
  }
  const { rows: roleRows } = await db.query<Role>(
    `SELECT role_id AS "roleId" FROM roles WHERE role_name = $1`,
    [roleName]
  )
  if (!roleRows[0]) {
    throw new ApiError("Invalid role", 400)
  }
  const passwordHash = await bcrypt.hash(password, 10)
  const { rows } = await db.query<User>(
    `INSERT INTO users (username, email, password_hash, role_id)
     VALUES ($1, $2, $3, $4)
     RETURNING
       user_id       AS "userId",
       username,
       email,
       password_hash AS "passwordHash",
       role_id       AS "roleId",
       is_active     AS "isActive",
       created_at    AS "createdAt",
       updated_at    AS "updatedAt"`,
    [username, email, passwordHash, roleRows[0].roleId]
  )
  const { passwordHash: _, ...publicUser } = rows[0]
  res.status(201).json(new ApiResponse(true, "User registered successfully", publicUser))
}))

// POST /api/auth/login
authRouter.post("/login", asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = LoginSchema.parse(req.body)
  const { rows } = await db.query<User & { roleName: string }>(
    `SELECT
       u.user_id       AS "userId",
       u.username,
       u.email,
       u.password_hash AS "passwordHash",
       u.role_id       AS "roleId",
       u.is_active     AS "isActive",
       r.role_name     AS "roleName"
     FROM users u
     JOIN roles r ON r.role_id = u.role_id
     WHERE u.email = $1`,
    [email]
  )
  const user = rows[0]
  if (!user) {
    throw new ApiError("Invalid email or password", 401)
  }
  if (!user.isActive) {
    throw new ApiError("Account is inactive", 403)
  }
  const isMatch = await bcrypt.compare(password, user.passwordHash)
  if (!isMatch) {
    throw new ApiError("Invalid email or password", 401)
  }
  const token = jwt.sign(
    { userId: user.userId, roleName: user.roleName },
    process.env.JWT_SECRET as string,
    { expiresIn: "7d" }
  )
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000
  })
  const { passwordHash: _, ...publicUser } = user
  res.status(200).json(new ApiResponse(true, "Login successful", publicUser))
}))

// POST /api/auth/logout
authRouter.post("/logout", asyncHandler(async (req: Request, res: Response) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  })
  res.status(200).json(new ApiResponse(true, "Logged out successfully", null))
}))

export default authRouter