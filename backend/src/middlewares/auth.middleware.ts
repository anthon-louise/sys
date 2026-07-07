import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import asyncHandler from "express-async-handler"
import { ApiError } from "../utils/ApiError.js"

export interface AuthRequest extends Request {
    user?: {
        userId: number
        roleName: string
    }
}

export const protect = asyncHandler(async (req: AuthRequest, _: Response, next: NextFunction) => {
    let token

    if (req.cookies?.token) {
        token = req.cookies.token
    }

    if (!token) {
        throw new ApiError("Not authorized to access this route", 401)
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: number; roleName: string }
        req.user = decoded
        next()
    } catch (error) {
        throw new ApiError("Not authorized, token failed", 401)
    }
})

export const instructorOnly = asyncHandler(async (req: AuthRequest, _: Response, next: NextFunction) => {
    if (req.user?.roleName !== "instructor") {
        throw new ApiError("Access denied. Instructors only", 403)
    }
    next()
})

export const studentOnly = asyncHandler(async (req: AuthRequest, _: Response, next: NextFunction) => {
    if (req.user?.roleName !== "student") {
        throw new ApiError("Access denied. Students only", 403)
    }
    next()
})

