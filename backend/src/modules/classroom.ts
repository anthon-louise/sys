import { Router, Request, Response } from "express"
import { z } from "zod"
import crypto from "crypto"
import asyncHandler from "express-async-handler"
import { db } from "../config/db.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { protect, instructorOnly, studentOnly, AuthRequest } from "../middlewares/auth.middleware.js"

const classroomRouter = Router()

// -- types --

export interface Classroom {
  classroomId: number
  teacherId: number
  classroomName: string
  joinCode: string
  schoolYear: string
  isActive: boolean
  createdAt: Date
}

// -- schemas --

export const CreateClassroomSchema = z.object({
  classroomName: z.string().min(1).max(100),
  schoolYear: z.string().min(1).max(20)
})

export type CreateClassroomInput = z.infer<typeof CreateClassroomSchema>

export const JoinClassroomSchema = z.object({
  joinCode: z.string().length(6)
})
export type JoinClassroomInput = z.infer<typeof JoinClassroomSchema>

// -- helpers --

const generateJoinCode = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += chars[crypto.randomInt(chars.length)]
  }
  return code
}

// -- routes --

// POST /api/classrooms/join
classroomRouter.post(
  "/join",
  protect,
  studentOnly,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { joinCode } = JoinClassroomSchema.parse(req.body)
    const studentId = req.user!.userId
    const { rows: classroomRows } = await db.query(
      `SELECT classroom_id FROM classrooms WHERE join_code = $1`,
      [joinCode]
    )
    const classroom = classroomRows[0]
    if (!classroom) {
      throw new ApiError("Invalid join code", 404)
    }
    const { rows: existingRows } = await db.query(
      `SELECT classroom_id FROM classroom_students WHERE classroom_id = $1 AND student_id = $2`,
      [classroom.classroom_id, studentId]
    )
    if (existingRows[0]) {
      throw new ApiError("Already enrolled in this classroom", 400)
    }
    await db.query(
      `INSERT INTO classroom_students (classroom_id, student_id) VALUES ($1, $2)`,
      [classroom.classroom_id, studentId]
    )
    res.status(200).json(new ApiResponse(true, "Joined classroom successfully", null))
  })
)

// GET /api/classrooms
classroomRouter.get(
  "/",
  protect,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId
    const roleName = req.user!.roleName
    let classrooms: Classroom[]
    if (roleName === "instructor") {
      const { rows } = await db.query<Classroom>(
        `SELECT
           classroom_id   AS "classroomId",
           teacher_id     AS "teacherId",
           classroom_name AS "classroomName",
           join_code      AS "joinCode",
           school_year    AS "schoolYear",
           is_active      AS "isActive",
           created_at     AS "createdAt"
         FROM classrooms
         WHERE teacher_id = $1`,
        [userId]
      )
      classrooms = rows
    } else {
      const { rows } = await db.query<Classroom>(
        `SELECT
           c.classroom_id   AS "classroomId",
           c.teacher_id     AS "teacherId",
           c.classroom_name AS "classroomName",
           c.join_code      AS "joinCode",
           c.school_year    AS "schoolYear",
           c.is_active      AS "isActive",
           c.created_at     AS "createdAt"
         FROM classrooms c
         JOIN classroom_students cs ON cs.classroom_id = c.classroom_id
         WHERE cs.student_id = $1`,
        [userId]
      )
      classrooms = rows
    }
    res.status(200).json(new ApiResponse(true, "Classrooms fetched successfully", classrooms))
  })
)

// GET /api/classrooms/:id
classroomRouter.get(
  "/:id",
  protect,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params
    const userId = req.user!.userId
    const roleName = req.user!.roleName

    let classroom: any
    if (roleName === "instructor") {
      const { rows } = await db.query(
        `SELECT
           classroom_id   AS "classroomId",
           teacher_id     AS "teacherId",
           classroom_name AS "classroomName",
           join_code      AS "joinCode",
           school_year    AS "schoolYear",
           is_active      AS "isActive",
           created_at     AS "createdAt"
         FROM classrooms
         WHERE classroom_id = $1 AND teacher_id = $2`,
        [id, userId]
      )
      classroom = rows[0]
    } else {
      const { rows } = await db.query(
        `SELECT
           c.classroom_id   AS "classroomId",
           c.teacher_id     AS "teacherId",
           c.classroom_name AS "classroomName",
           c.join_code      AS "joinCode",
           c.school_year    AS "schoolYear",
           c.is_active      AS "isActive",
           c.created_at     AS "createdAt",
           u.username       AS "teacherName"
         FROM classrooms c
         JOIN users u ON u.user_id = c.teacher_id
         JOIN classroom_students cs ON cs.classroom_id = c.classroom_id
         WHERE c.classroom_id = $1 AND cs.student_id = $2`,
        [id, userId]
      )
      classroom = rows[0]
    }
    if (!classroom) {
      throw new ApiError("Classroom not found", 404)
    }
    res.status(200).json(new ApiResponse(true, "Classroom fetched successfully", classroom))
  })
)

// GET /api/classrooms/:id/students
classroomRouter.get(
  "/:id/students",
  protect,
  instructorOnly,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params
    const userId = req.user!.userId
    const { rows: classroomRows } = await db.query(
      `SELECT classroom_id FROM classrooms WHERE classroom_id = $1 AND teacher_id = $2`,
      [id, userId]
    )
    if (!classroomRows[0]) {
      throw new ApiError("Classroom not found", 404)
    }
    const { rows } = await db.query(
      `SELECT
         u.user_id   AS "studentId",
         u.username  AS "studentName",
         u.email     AS "studentEmail",
         cs.enrolled_at AS "enrolledAt"
       FROM classroom_students cs
       JOIN users u ON u.user_id = cs.student_id
       WHERE cs.classroom_id = $1
       ORDER BY cs.enrolled_at DESC`,
      [id]
    )
    res.status(200).json(new ApiResponse(true, "Students fetched successfully", rows))
  })
)

// POST /api/classrooms
classroomRouter.post(
  "/",
  protect,
  instructorOnly,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { classroomName, schoolYear } = CreateClassroomSchema.parse(req.body)
    const teacherId = req.user!.userId
    let classroom: Classroom | undefined
    while (!classroom) {
      const joinCode = generateJoinCode()
      try {
        const { rows } = await db.query<Classroom>(
          `INSERT INTO classrooms (teacher_id, classroom_name, join_code, school_year)
           VALUES ($1, $2, $3, $4)
           RETURNING
             classroom_id   AS "classroomId",
             teacher_id     AS "teacherId",
             classroom_name AS "classroomName",
             join_code      AS "joinCode",
             school_year    AS "schoolYear",
             is_active      AS "isActive",
             created_at     AS "createdAt"`,
          [teacherId, classroomName, joinCode, schoolYear]
        )
        classroom = rows[0]
      } catch (error: any) {
        if (error.code !== "23505") {
          throw error
        }
      }
    }
    res.status(201).json(new ApiResponse(true, "Classroom created successfully", classroom))
  })
)

export default classroomRouter