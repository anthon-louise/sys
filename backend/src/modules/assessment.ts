import { Router, Request, Response } from "express"
import { z } from "zod"
import asyncHandler from "express-async-handler"
import { db } from "../config/db.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { protect, instructorOnly, AuthRequest } from "../middlewares/auth.middleware.js"

const assessmentRouter = Router()

// -- types --

export interface Assessment {
  assessmentId: number
  classroomId: number
  teacherId: number
  title: string
  description: string | null
  assessmentType: string
  academicTerm: string
  timeLimitMinutes: number | null
  createdAt: Date
  updatedAt: Date
}

export interface AssessmentProblem {
  assessmentId: number
  problemId: number
  problemOrder: number
  title: string
  description: string
  language: string
  difficulty: string | null
  starterCode: string | null
}

// -- schemas --

export const CreateAssessmentSchema = z.object({
  classroomId: z.number().int(),
  title: z.string().min(1).max(100),
  description: z.string().optional(),
  assessmentType: z.enum(["Practice", "Quiz", "Exam"]),
  academicTerm: z.enum(["Midterm", "Finals"]),
  timeLimitMinutes: z.number().int().optional()
})

export const AttachProblemSchema = z.object({
  problemId: z.number().int()
})

export type CreateAssessmentInput = z.infer<typeof CreateAssessmentSchema>
export type AttachProblemInput = z.infer<typeof AttachProblemSchema>

// -- routes --

// POST /api/assessments
assessmentRouter.post(
  "/",
  protect,
  instructorOnly,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { classroomId, title, description, assessmentType, academicTerm, timeLimitMinutes } = CreateAssessmentSchema.parse(req.body)
    const teacherId = req.user!.userId

    const { rows } = await db.query<Assessment>(
      `INSERT INTO assessments (classroom_id, teacher_id, title, description, assessment_type, academic_term, time_limit_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING
         assessment_id      AS "assessmentId",
         classroom_id       AS "classroomId",
         teacher_id         AS "teacherId",
         title,
         description,
         assessment_type    AS "assessmentType",
         academic_term      AS "academicTerm",
         time_limit_minutes AS "timeLimitMinutes",
         created_at         AS "createdAt",
         updated_at         AS "updatedAt"`,
      [classroomId, teacherId, title, description || null, assessmentType, academicTerm, timeLimitMinutes || null]
    )

    res.status(201).json(new ApiResponse(true, "Assessment created successfully", rows[0]))
  })
)

// GET /api/assessments/:id
assessmentRouter.get(
  "/:id",
  protect,
  instructorOnly,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string
    const teacherId = req.user!.userId

    const assessmentId = parseInt(id, 10)
    if (Number.isNaN(assessmentId)) {
      throw new ApiError("Invalid assessment id", 400)
    }

    // Get assessment with ownership check
    const { rows: assessmentRows } = await db.query<Assessment>(
      `SELECT
         assessment_id      AS "assessmentId",
         classroom_id       AS "classroomId",
         teacher_id         AS "teacherId",
         title,
         description,
         assessment_type    AS "assessmentType",
         academic_term      AS "academicTerm",
         time_limit_minutes AS "timeLimitMinutes",
         created_at         AS "createdAt",
         updated_at         AS "updatedAt"
       FROM assessments
       WHERE assessment_id = $1 AND teacher_id = $2`,
      [assessmentId, teacherId]
    )
    if (!assessmentRows[0]) {
      throw new ApiError("Assessment not found", 404)
    }

    // Get problems for this assessment
    const { rows: problemsRows } = await db.query<AssessmentProblem>(
      `SELECT
         ap.assessment_id   AS "assessmentId",
         ap.problem_id      AS "problemId",
         ap.problem_order   AS "problemOrder",
         p.title,
         p.description,
         p.language,
         p.difficulty,
         p.starter_code     AS "starterCode"
       FROM assessment_problems ap
       JOIN problems p ON p.problem_id = ap.problem_id
       WHERE ap.assessment_id = $1
       ORDER BY ap.problem_order ASC`,
      [assessmentId]
    )

    res.status(200).json(
      new ApiResponse(true, "Assessment fetched successfully", {
        ...assessmentRows[0],
        problems: problemsRows
      })
    )
  })
)

// POST /api/assessments/:id/problems
assessmentRouter.post(
  "/:id/problems",
  protect,
  instructorOnly,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string
    const teacherId = req.user!.userId
    const { problemId } = AttachProblemSchema.parse(req.body)

    const assessmentId = parseInt(id, 10)
    if (Number.isNaN(assessmentId)) {
      throw new ApiError("Invalid assessment id", 400)
    }

    // Verify assessment ownership
    const { rows: assessmentRows } = await db.query(
      `SELECT assessment_id FROM assessments WHERE assessment_id = $1 AND teacher_id = $2`,
      [assessmentId, teacherId]
    )
    if (!assessmentRows[0]) {
      throw new ApiError("Assessment not found", 404)
    }

    // Verify problem ownership and that it's validated
    const { rows: problemRows } = await db.query(
      `SELECT p.problem_id, ws.validated_at 
       FROM problems p 
       LEFT JOIN working_solutions ws ON p.problem_id = ws.problem_id 
       WHERE p.problem_id = $1 AND p.teacher_id = $2`,
      [problemId, teacherId]
    )
    if (!problemRows[0]) {
      throw new ApiError("Problem not found", 404)
    }
    if (!problemRows[0].validated_at) {
      throw new ApiError("Only validated problems can be attached to assessments", 400)
    }

    // Check if already attached
    const { rows: existingRows } = await db.query(
      `SELECT assessment_id FROM assessment_problems WHERE assessment_id = $1 AND problem_id = $2`,
      [assessmentId, problemId]
    )
    if (existingRows[0]) {
      throw new ApiError("Problem already attached to this assessment", 400)
    }

    // Get next problem order
    const { rows: maxOrderRows } = await db.query(
      `SELECT COALESCE(MAX(problem_order), -1) AS max_order FROM assessment_problems WHERE assessment_id = $1`,
      [assessmentId]
    )
    const nextOrder = (maxOrderRows[0]?.max_order ?? -1) + 1

    await db.query(
      `INSERT INTO assessment_problems (assessment_id, problem_id, problem_order) VALUES ($1, $2, $3)`,
      [assessmentId, problemId, nextOrder]
    )

    res.status(201).json(new ApiResponse(true, "Problem attached successfully", null))
  })
)

// GET /api/classrooms/:id/assessments
assessmentRouter.get(
  "/classrooms/:id/assessments",
  protect,
  instructorOnly,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string
    const teacherId = req.user!.userId

    const classroomId = parseInt(id, 10)
    if (Number.isNaN(classroomId)) {
      throw new ApiError("Invalid classroom id", 400)
    }

    // Verify classroom ownership
    const { rows: classroomRows } = await db.query(
      `SELECT classroom_id FROM classrooms WHERE classroom_id = $1 AND teacher_id = $2`,
      [classroomId, teacherId]
    )
    if (!classroomRows[0]) {
      throw new ApiError("Classroom not found", 404)
    }

    const { rows } = await db.query<Assessment>(
      `SELECT
         assessment_id      AS "assessmentId",
         classroom_id       AS "classroomId",
         teacher_id         AS "teacherId",
         title,
         description,
         assessment_type    AS "assessmentType",
         academic_term      AS "academicTerm",
         time_limit_minutes AS "timeLimitMinutes",
         created_at         AS "createdAt",
         updated_at         AS "updatedAt"
       FROM assessments
       WHERE classroom_id = $1
       ORDER BY created_at DESC`,
      [classroomId]
    )

    res.status(200).json(new ApiResponse(true, "Assessments fetched successfully", rows))
  })
)

export { assessmentRouter }
export default assessmentRouter
