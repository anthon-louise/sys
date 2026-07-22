import { Router, Request, Response } from "express"
import { z } from "zod"
import asyncHandler from "express-async-handler"
import { db } from "../config/db.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { protect, instructorOnly, AuthRequest } from "../middlewares/auth.middleware.js"
import axios from "axios"
import { execSync } from "child_process"
import { writeFileSync, unlinkSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

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
  isPublished: boolean
  opensAt: Date | null
  closesAt: Date | null
  gradingPreset: string
  structuralConstraints: StructuralConstraints | null
}

export interface StructuralConstraints {
  required: string[]
  forbidden: string[]
  weight: number  // 0–100, portion of the final score
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

const GRADING_PRESETS = [
  "Correctness Only",
  "Balanced",
  "Speed Challenge",
  "Structure + Tests",
  "Mixed",
  "Structure Focus"
] as const
export type GradingPreset = typeof GRADING_PRESETS[number]

const StructuralConstraintsSchema = z.object({
  required: z.array(z.string()).default([]),
  forbidden: z.array(z.string()).default([]),
  weight: z.number().min(0).max(100).default(0)
}).optional().nullable()

export const CreateAssessmentSchema = z.object({
  classroomId: z.number().int(),
  title: z.string().min(1).max(100),
  description: z.string().optional(),
  assessmentType: z.enum(["Practice", "Quiz", "Exam"]),
  academicTerm: z.enum(["Midterm", "Finals"]),
  timeLimitMinutes: z.number().int().optional(),
  opensAt: z.string().datetime({ offset: true }).optional().nullable(),
  closesAt: z.string().datetime({ offset: true }).optional().nullable(),
  gradingPreset: z.enum(GRADING_PRESETS).default("Correctness Only"),
  structuralConstraints: StructuralConstraintsSchema
})

export const UpdateAssessmentSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  assessmentType: z.enum(["Practice", "Quiz", "Exam"]).optional(),
  academicTerm: z.enum(["Midterm", "Finals"]).optional(),
  timeLimitMinutes: z.number().int().optional().nullable(),
  opensAt: z.string().datetime({ offset: true }).optional().nullable(),
  closesAt: z.string().datetime({ offset: true }).optional().nullable(),
  gradingPreset: z.enum(GRADING_PRESETS).optional(),
  structuralConstraints: StructuralConstraintsSchema
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
    const { classroomId, title, description, assessmentType, academicTerm, timeLimitMinutes, opensAt, closesAt, gradingPreset, structuralConstraints } = CreateAssessmentSchema.parse(req.body)
    const teacherId = req.user!.userId

    const { rows } = await db.query<Assessment>(
      `INSERT INTO assessments (classroom_id, teacher_id, title, description, assessment_type, academic_term, time_limit_minutes, opens_at, closes_at, grading_preset, structural_constraints)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING
         assessment_id           AS "assessmentId",
         classroom_id            AS "classroomId",
         teacher_id              AS "teacherId",
         title,
         description,
         assessment_type         AS "assessmentType",
         academic_term           AS "academicTerm",
         time_limit_minutes      AS "timeLimitMinutes",
         created_at              AS "createdAt",
         updated_at              AS "updatedAt",
         is_published            AS "isPublished",
         opens_at                AS "opensAt",
         closes_at               AS "closesAt",
         grading_preset          AS "gradingPreset",
         structural_constraints  AS "structuralConstraints"`,
      [classroomId, teacherId, title, description || null, assessmentType, academicTerm, timeLimitMinutes || null, opensAt || null, closesAt || null, gradingPreset, structuralConstraints ? JSON.stringify(structuralConstraints) : null]
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
         assessment_id           AS "assessmentId",
         classroom_id            AS "classroomId",
         teacher_id              AS "teacherId",
         title,
         description,
         assessment_type         AS "assessmentType",
         academic_term           AS "academicTerm",
         time_limit_minutes      AS "timeLimitMinutes",
         created_at              AS "createdAt",
         updated_at              AS "updatedAt",
         is_published            AS "isPublished",
         opens_at                AS "opensAt",
         closes_at               AS "closesAt",
         grading_preset          AS "gradingPreset",
         structural_constraints  AS "structuralConstraints"
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

// PUT /api/assessments/:id
assessmentRouter.put(
  "/:id",
  protect,
  instructorOnly,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string
    const teacherId = req.user!.userId
    const updateData = UpdateAssessmentSchema.parse(req.body)

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

    // Check if there are any submissions or started sessions - optional but safe
    const { rows: submissionRows } = await db.query(
      `SELECT COUNT(*) AS count FROM submissions WHERE assessment_id = $1`,
      [assessmentId]
    )
    const hasSubmissions = Number(submissionRows[0].count) > 0

    const { rows: sessionRows } = await db.query(
      `SELECT COUNT(*) AS count FROM student_assessment_sessions WHERE assessment_id = $1`,
      [assessmentId]
    )
    const hasSessions = Number(sessionRows[0].count) > 0

    if (hasSubmissions || hasSessions) {
      throw new ApiError("Cannot update an assessment that has already been started or has submissions", 400)
    }

    // Build update query
    const updates: string[] = []
    const values: any[] = []
    let paramCount = 0

    if (updateData.title !== undefined) {
      paramCount++
      updates.push(`title = $${paramCount}`)
      values.push(updateData.title)
    }
    if (updateData.description !== undefined) {
      paramCount++
      updates.push(`description = $${paramCount}`)
      values.push(updateData.description || null)
    }
    if (updateData.assessmentType !== undefined) {
      paramCount++
      updates.push(`assessment_type = $${paramCount}`)
      values.push(updateData.assessmentType)
    }
    if (updateData.academicTerm !== undefined) {
      paramCount++
      updates.push(`academic_term = $${paramCount}`)
      values.push(updateData.academicTerm)
    }
    if (updateData.timeLimitMinutes !== undefined) {
      paramCount++
      updates.push(`time_limit_minutes = $${paramCount}`)
      values.push(updateData.timeLimitMinutes)
    }
    if (updateData.opensAt !== undefined) {
      paramCount++
      updates.push(`opens_at = $${paramCount}`)
      values.push(updateData.opensAt || null)
    }
    if (updateData.closesAt !== undefined) {
      paramCount++
      updates.push(`closes_at = $${paramCount}`)
      values.push(updateData.closesAt || null)
    }
    if (updateData.gradingPreset !== undefined) {
      paramCount++
      updates.push(`grading_preset = $${paramCount}`)
      values.push(updateData.gradingPreset)
    }
    if (updateData.structuralConstraints !== undefined) {
      paramCount++
      updates.push(`structural_constraints = $${paramCount}`)
      values.push(updateData.structuralConstraints ? JSON.stringify(updateData.structuralConstraints) : null)
    }

    if (updates.length === 0) {
      throw new ApiError("No fields to update", 400)
    }

    paramCount++
    values.push(assessmentId)

    const { rows } = await db.query<Assessment>(
      `UPDATE assessments 
       SET ${updates.join(", ")}, updated_at = NOW() 
       WHERE assessment_id = $${paramCount}
       RETURNING
         assessment_id           AS "assessmentId",
         classroom_id            AS "classroomId",
         teacher_id              AS "teacherId",
         title,
         description,
         assessment_type         AS "assessmentType",
         academic_term           AS "academicTerm",
         time_limit_minutes      AS "timeLimitMinutes",
         created_at              AS "createdAt",
         updated_at              AS "updatedAt",
         is_published            AS "isPublished",
         opens_at                AS "opensAt",
         closes_at               AS "closesAt",
         grading_preset          AS "gradingPreset",
         structural_constraints  AS "structuralConstraints"`,
      values
    )

    res.status(200).json(new ApiResponse(true, "Assessment updated successfully", rows[0]))
  })
)

// DELETE /api/assessments/:id
assessmentRouter.delete(
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

    // Verify assessment ownership
    const { rows: assessmentRows } = await db.query(
      `SELECT assessment_id FROM assessments WHERE assessment_id = $1 AND teacher_id = $2`,
      [assessmentId, teacherId]
    )
    if (!assessmentRows[0]) {
      throw new ApiError("Assessment not found", 404)
    }

    // Delete assessment - foreign keys with ON DELETE CASCADE will handle related records
    await db.query(
      `DELETE FROM assessments WHERE assessment_id = $1`,
      [assessmentId]
    )

    res.status(200).json(new ApiResponse(true, "Assessment deleted successfully", null))
  })
)

// PUT /api/assessments/:id/publish
assessmentRouter.put(
  "/:id/publish",
  protect,
  instructorOnly,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string
    const teacherId = req.user!.userId

    const assessmentId = parseInt(id, 10)
    if (Number.isNaN(assessmentId)) {
      throw new ApiError("Invalid assessment id", 400)
    }

    // Verify assessment ownership
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
         updated_at         AS "updatedAt",
         is_published       AS "isPublished",
         opens_at           AS "opensAt",
         closes_at          AS "closesAt",
         grading_preset     AS "gradingPreset"
       FROM assessments
       WHERE assessment_id = $1 AND teacher_id = $2`,
      [assessmentId, teacherId]
    )
    if (!assessmentRows[0]) {
      throw new ApiError("Assessment not found", 404)
    }

    // Check if assessment has at least one problem
    const { rows: problemRows } = await db.query(
      `SELECT COUNT(*) AS count FROM assessment_problems WHERE assessment_id = $1`,
      [assessmentId]
    )
    if (Number(problemRows[0].count) === 0) {
      throw new ApiError("Cannot publish an assessment with no problems", 400)
    }

    // Update is_published to true
    const { rows } = await db.query<Assessment>(
      `UPDATE assessments
       SET is_published = true, updated_at = NOW()
       WHERE assessment_id = $1
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
         updated_at         AS "updatedAt",
         is_published       AS "isPublished",
         opens_at           AS "opensAt",
         closes_at          AS "closesAt",
         grading_preset     AS "gradingPreset"`,
      [assessmentId]
    )

    res.status(200).json(new ApiResponse(true, "Assessment published successfully", rows[0]))
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

// GET /api/classrooms/:id/assessments (instructor)
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
         updated_at         AS "updatedAt",
         is_published       AS "isPublished",
         opens_at           AS "opensAt",
         closes_at          AS "closesAt",
         grading_preset     AS "gradingPreset"
       FROM assessments
       WHERE classroom_id = $1
       ORDER BY created_at DESC`,
      [classroomId]
    )

    res.status(200).json(new ApiResponse(true, "Assessments fetched successfully", rows))
  })
)

// GET /api/student/classrooms/:id/assessments (student)
assessmentRouter.get(
  "/student/classrooms/:id/assessments",
  protect,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string
    const userId = req.user!.userId

    const classroomId = parseInt(id, 10)
    if (Number.isNaN(classroomId)) {
      throw new ApiError("Invalid classroom id", 400)
    }

    // Verify student is enrolled in the classroom
    const { rows: enrollmentRows } = await db.query(
      `SELECT student_id FROM classroom_students WHERE classroom_id = $1 AND student_id = $2`,
      [classroomId, userId]
    )
    if (!enrollmentRows[0]) {
      throw new ApiError("Not enrolled in this classroom", 403)
    }

    const now = new Date()
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
         updated_at         AS "updatedAt",
         is_published       AS "isPublished",
         opens_at           AS "opensAt",
         closes_at          AS "closesAt",
         grading_preset     AS "gradingPreset"
       FROM assessments
       WHERE 
         classroom_id = $1 AND 
         is_published = true AND 
         (opens_at IS NULL OR opens_at <= $2) AND 
         (closes_at IS NULL OR closes_at >= $2)
       ORDER BY created_at DESC`,
      [classroomId, now]
    )

    res.status(200).json(new ApiResponse(true, "Assessments fetched successfully", rows))
  })
)

// GET /api/student/assessments/:id/status (student) - returns schedule/publish info without access gate
assessmentRouter.get(
  "/student/assessments/:id/status",
  protect,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string
    const userId = req.user!.userId

    const assessmentId = parseInt(id, 10)
    if (Number.isNaN(assessmentId)) {
      throw new ApiError("Invalid assessment id", 400)
    }

    // Only check enrollment, not publish/schedule
    const { rows } = await db.query(
      `SELECT
         a.assessment_id AS "assessmentId",
         a.title,
         a.is_published  AS "isPublished",
         a.opens_at      AS "opensAt",
         a.closes_at     AS "closesAt"
       FROM assessments a
       JOIN classroom_students cs ON a.classroom_id = cs.classroom_id
       WHERE a.assessment_id = $1 AND cs.student_id = $2`,
      [assessmentId, userId]
    )
    if (!rows[0]) {
      throw new ApiError("Assessment not found", 404)
    }

    res.status(200).json(new ApiResponse(true, "Assessment status fetched", rows[0]))
  })
)

// GET /api/student/assessments/:id (student)
assessmentRouter.get(
  "/student/assessments/:id",
  protect,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string
    const userId = req.user!.userId

    const assessmentId = parseInt(id, 10)
    if (Number.isNaN(assessmentId)) {
      throw new ApiError("Invalid assessment id", 400)
    }

    // Get assessment and check enrollment and schedule
    const now = new Date()
    const { rows: assessmentRows } = await db.query<Assessment>(
      `SELECT
         a.assessment_id      AS "assessmentId",
         a.classroom_id       AS "classroomId",
         a.teacher_id         AS "teacherId",
         a.title,
         a.description,
         a.assessment_type    AS "assessmentType",
         a.academic_term      AS "academicTerm",
         a.time_limit_minutes AS "timeLimitMinutes",
         a.created_at         AS "createdAt",
         a.updated_at         AS "updatedAt",
         a.is_published       AS "isPublished",
         a.opens_at           AS "opensAt",
         a.closes_at          AS "closesAt",
         a.grading_preset     AS "gradingPreset"
       FROM assessments a
       JOIN classroom_students cs ON a.classroom_id = cs.classroom_id
       WHERE 
         a.assessment_id = $1 AND 
         cs.student_id = $2 AND 
         a.is_published = true AND
         (a.opens_at IS NULL OR a.opens_at <= $3) AND
         (a.closes_at IS NULL OR a.closes_at >= $3)`,
      [assessmentId, userId, now]
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

// -- Types for submissions
export interface Submission {
  submissionId: number
  assessmentId: number
  studentId: number
  problemId: number
  sourceCode: string
  language: string
  score: number
  finalScore: number | null
  status: string
  executionTimeMs: number | null
  memoryUsedKb: number | null
  submittedAt: Date
}

// -- Grading preset weight lookup
function getGradingWeights(
  preset: string,
  timeEnabled: boolean,
  constraintWeight: number  // 0 if no constraints
): { testWeight: number; timeWeight: number; constraintWeight: number } {
  // Presets that include structural constraints use the configured weight directly.
  // Presets without constraints always return constraintWeight=0.
  switch (preset) {
    case "Balanced":
      return timeEnabled
        ? { testWeight: 75, timeWeight: 25, constraintWeight: 0 }
        : { testWeight: 100, timeWeight: 0, constraintWeight: 0 }
    case "Speed Challenge":
      return timeEnabled
        ? { testWeight: 50, timeWeight: 50, constraintWeight: 0 }
        : { testWeight: 100, timeWeight: 0, constraintWeight: 0 }
    case "Structure + Tests":
      // 50% test, 50% constraints (time ignored)
      return { testWeight: 50, timeWeight: 0, constraintWeight: 50 }
    case "Mixed":
      // 50% test, 25% constraints, 25% time
      return timeEnabled
        ? { testWeight: 50, timeWeight: 25, constraintWeight: 25 }
        : { testWeight: 75, timeWeight: 0, constraintWeight: 25 }
    case "Structure Focus":
      // 30% test, 70% constraints (time ignored)
      return { testWeight: 30, timeWeight: 0, constraintWeight: 70 }
    default: // 'Correctness Only'
      return { testWeight: 100, timeWeight: 0, constraintWeight: 0 }
  }
}

// -- Constraint keys that map to Python AST node types / call names
const CONSTRAINT_AST_MAP: Record<string, string> = {
  must_use_if:          "If",
  must_use_else:        "Else",
  must_use_comparison:  "Compare",
  must_use_print:       "print",
  must_use_input:       "input",
  must_use_assignment:  "Assign",
  no_if:                "If",
  no_print:             "print",
  no_input:             "input",
}

export interface ConstraintDetail {
  rule: string
  type: "required" | "forbidden"
  passed: boolean
  message: string
}

export interface StructuralCheckResult {
  score: number
  details: ConstraintDetail[]
}

const CONSTRAINT_DESCRIPTIONS: Record<string, { requiredPass: string; requiredFail: string; forbiddenPass: string; forbiddenFail: string }> = {
  must_use_if: {
    requiredPass: "Used required 'if' statement",
    requiredFail: "Missing required 'if' statement",
    forbiddenPass: "No 'if' statement used",
    forbiddenFail: "Used forbidden 'if' statement",
  },
  must_use_else: {
    requiredPass: "Used required 'else' branch",
    requiredFail: "Missing required 'else' branch",
    forbiddenPass: "No 'else' branch used",
    forbiddenFail: "Used forbidden 'else' branch",
  },
  must_use_comparison: {
    requiredPass: "Used required comparison operator (==, >, <, etc.)",
    requiredFail: "Missing required comparison operator",
    forbiddenPass: "No comparison operator used",
    forbiddenFail: "Used forbidden comparison operator",
  },
  must_use_print: {
    requiredPass: "Used required print() call",
    requiredFail: "Missing required print() call",
    forbiddenPass: "No print() call used",
    forbiddenFail: "Used forbidden print() call",
  },
  must_use_input: {
    requiredPass: "Used required input() call",
    requiredFail: "Missing required input() call",
    forbiddenPass: "No input() call used",
    forbiddenFail: "Used forbidden input() call",
  },
  must_use_assignment: {
    requiredPass: "Used required variable assignment (=, +=, etc.)",
    requiredFail: "Missing required variable assignment",
    forbiddenPass: "No variable assignment used",
    forbiddenFail: "Used forbidden variable assignment",
  },
  no_if: {
    requiredPass: "Used 'if' statement",
    requiredFail: "Missing 'if' statement",
    forbiddenPass: "No 'if' statement used",
    forbiddenFail: "Used forbidden 'if' statement",
  },
  no_print: {
    requiredPass: "Used print() call",
    requiredFail: "Missing print() call",
    forbiddenPass: "No print() call used",
    forbiddenFail: "Used forbidden print() call",
  },
  no_input: {
    requiredPass: "Used input() call",
    requiredFail: "Missing input() call",
    forbiddenPass: "No input() call used",
    forbiddenFail: "Used forbidden input() call",
  },
}

// -- Check Python source code against structural constraints using python AST
// Returns score 0–100 and detailed results for each constraint
function checkStructuralConstraints(
  sourceCode: string,
  constraints: StructuralConstraints
): StructuralCheckResult {
  if (!constraints || ((constraints.required?.length ?? 0) === 0 && (constraints.forbidden?.length ?? 0) === 0)) {
    return { score: 100, details: [] }
  }

  const pythonScript = `import ast, sys, json
code = open(sys.argv[1]).read()
try:
    tree = ast.parse(code)
except SyntaxError:
    print(json.dumps({"error": "syntax"}))
    sys.exit(0)

result = {}
for node in ast.walk(tree):
    t = type(node).__name__
    result[t] = True
    if t in ("Assign", "AugAssign", "AnnAssign"):
        result["Assign"] = True
    if t == "Call":
        if isinstance(node.func, ast.Name):
            result["call_" + node.func.id] = True
    if t == "If" and node.orelse:
        result["Else"] = True

print(json.dumps(result))`

  // Write script to temp file to avoid shell escaping issues
  const tmpScript = join(tmpdir(), `ast_check_${Date.now()}.py`)
  const tmpInput  = join(tmpdir(), `ast_input_${Date.now()}.py`)
  let found: Record<string, boolean> = {}
  try {
    writeFileSync(tmpScript, pythonScript, "utf8")
    writeFileSync(tmpInput, sourceCode, "utf8")
    
    let output = ""
    try {
      output = execSync(`py "${tmpScript}" "${tmpInput}"`, { timeout: 5000, encoding: "utf8" })
    } catch {
      output = execSync(`python "${tmpScript}" "${tmpInput}"`, { timeout: 5000, encoding: "utf8" })
    }
    
    found = JSON.parse(output.trim())
    if (found.error) return { score: 50, details: [] }  // syntax error — partial credit
  } catch {
    // If python is unavailable or errors, skip constraint check with full credit
    return { score: 100, details: [] }
  } finally {
    try { unlinkSync(tmpScript) } catch { /* ignore */ }
    try { unlinkSync(tmpInput)  } catch { /* ignore */ }
  }

  // Helper: is construct present?
  function isPresent(key: string): boolean {
    const astNode = CONSTRAINT_AST_MAP[key]
    if (!astNode) return false
    // Call-based nodes (print, input) are tracked as call_<name>
    if (["print", "input"].includes(astNode)) {
      return Boolean(found[`call_${astNode}`])
    }
    return Boolean(found[astNode])
  }

  const details: ConstraintDetail[] = []
  let passedCount = 0

  for (const req of (constraints.required || [])) {
    const ok = isPresent(req)
    if (ok) passedCount++
    const desc = CONSTRAINT_DESCRIPTIONS[req]
    details.push({
      rule: req,
      type: "required",
      passed: ok,
      message: ok ? (desc?.requiredPass || `Used required construct (${req})`) : (desc?.requiredFail || `Missing required construct (${req})`)
    })
  }

  for (const forb of (constraints.forbidden || [])) {
    const present = isPresent(forb)
    const ok = !present
    if (ok) passedCount++
    const desc = CONSTRAINT_DESCRIPTIONS[forb]
    details.push({
      rule: forb,
      type: "forbidden",
      passed: ok,
      message: ok ? (desc?.forbiddenPass || `Did not use forbidden construct (${forb})`) : (desc?.forbiddenFail || `Used forbidden construct (${forb})`)
    })
  }

  const totalCount = (constraints.required?.length || 0) + (constraints.forbidden?.length || 0)
  const score = totalCount > 0 ? (passedCount / totalCount) * 100 : 100
  return { score, details }
}

// -- Compute time bonus score (0–100)
// windowStart: session.started_at or assessment.opens_at
// deadline:    assessment.closes_at
// submittedAt: when the student submitted
function computeTimeBonusScore(
  windowStart: Date,
  deadline: Date,
  submittedAt: Date
): number {
  const totalMs = deadline.getTime() - windowStart.getTime()
  if (totalMs <= 0) return 0

  const elapsedMs = submittedAt.getTime() - windowStart.getTime()
  const thresholdMs = 0.4 * totalMs

  if (elapsedMs <= thresholdMs) return 100
  if (elapsedMs >= totalMs) return 0

  return 100 * (1 - (elapsedMs - thresholdMs) / (totalMs - thresholdMs))
}

export interface SubmissionTestResult {
  resultId: number
  submissionId: number
  testCaseId: number
  actualOutput: string | null
  passed: boolean
  executionTimeMs: number | null
  errorType: string | null
}

// -- Endpoint to get test cases for a problem (student view)
assessmentRouter.get(
  "/student/problems/:problemId/test-cases",
  protect,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const problemId = parseInt(req.params.problemId as string, 10)
    const userId = req.user!.userId

    if (Number.isNaN(problemId)) {
      throw new ApiError("Invalid problem id", 400)
    }

    const { rows } = await db.query(
      `SELECT 
        test_case_id AS "testCaseId",
        problem_id AS "problemId",
        input_data AS "inputData",
        expected_output AS "expectedOutput",
        is_hidden AS "isHidden",
        order_index AS "orderIndex"
       FROM test_cases
       WHERE problem_id = $1
       ORDER BY order_index ASC`,
      [problemId]
    )

    // Don't show hidden test cases to students
    const filtered = rows.map(tc => ({
      ...tc,
      expectedOutput: tc.isHidden ? null : tc.expectedOutput
    }))

    res.status(200).json(new ApiResponse(true, "Test cases fetched successfully", filtered))
  })
)

// -- Endpoint to test a student's code (run all test cases)
assessmentRouter.post(
  "/student/test",
  protect,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { problemId, sourceCode, language } = req.body
    const userId = req.user!.userId

    // Get test cases for the problem
    const { rows: testCases } = await db.query(
      `SELECT 
        test_case_id AS "testCaseId",
        input_data AS "inputData",
        expected_output AS "expectedOutput"
       FROM test_cases
       WHERE problem_id = $1
       ORDER BY order_index ASC`,
      [problemId]
    )

    if (!testCases.length) {
      throw new ApiError("No test cases for this problem", 400)
    }

    // Run test cases in parallel
    const testCasePromises = testCases.map(async (tc) => {
      try {
        console.log(`Testing test case ${tc.testCaseId}, input: "${tc.inputData}"`)
        // Use existing /run endpoint on the same server
        const runRes = await axios.post(`http://localhost:${process.env.PORT || 5000}/run`, {
          sourceCode,
          language,
          stdin: tc.inputData || ""
        })
        console.log(`Test case ${tc.testCaseId} result:`, runRes.data)

        const passed = (runRes.data.stdout || "").trim() === (tc.expectedOutput || "").trim()

        return {
          testCaseId: tc.testCaseId,
          actualOutput: runRes.data.stdout,
          passed,
          executionTimeMs: runRes.data.time ? Math.round(runRes.data.time * 1000) : null,
          errorType: runRes.data.status !== "Accepted" ? runRes.data.status : null,
          stderr: runRes.data.stderr,
          compileOutput: runRes.data.compile_output
        }
      } catch (err: any) {
        console.error(`Test case ${tc.testCaseId} error:`, err.response?.data || err.message)
        return {
          testCaseId: tc.testCaseId,
          actualOutput: null,
          passed: false,
          executionTimeMs: null,
          errorType: err.response?.data?.error || err.message || "Error",
          stderr: err.response?.data?.stderr || null,
          compileOutput: err.response?.data?.compile_output || null
        }
      }
    })

    const testResults = await Promise.all(testCasePromises)
    const allPassed = testResults.every(tr => tr.passed)
    const totalTimeMs = testResults.reduce((acc, tr) => acc + (tr.executionTimeMs || 0), 0)

    res.status(200).json(new ApiResponse(true, "Test completed", {
      testResults,
      allPassed,
      totalTimeMs
    }))
  })
)

// -- Endpoint to submit an assessment
assessmentRouter.post(
  "/student/assessments/:id/submit",
  protect,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const assessmentId = parseInt(req.params.id as string, 10)
    const userId = req.user!.userId
    const { problemSolutions } = req.body // Array of { problemId, sourceCode }

    if (Number.isNaN(assessmentId)) {
      throw new ApiError("Invalid assessment id", 400)
    }

    const now = new Date()

    // Verify student is in the classroom, assessment is published, and schedule is active
    const { rows: enrollRows } = await db.query(
      `SELECT cs.student_id 
       FROM assessments a
       JOIN classroom_students cs ON a.classroom_id = cs.classroom_id
       WHERE 
         a.assessment_id = $1 AND 
         cs.student_id = $2 AND 
         a.is_published = true AND
         (a.opens_at IS NULL OR a.opens_at <= $3) AND
         (a.closes_at IS NULL OR a.closes_at >= $3)`,
      [assessmentId, userId, now]
    )
    if (!enrollRows[0]) throw new ApiError("Not allowed to submit this assessment", 403)

    // Check session
    const { rows: sessionRows } = await db.query(
      `SELECT ends_at AS "endsAt", submitted_at AS "submittedAt", started_at AS "startedAt"
       FROM student_assessment_sessions WHERE assessment_id = $1 AND student_id = $2`,
      [assessmentId, userId]
    )
    const session = sessionRows[0]
    if (!session) throw new ApiError("Session not found", 400)
    if (session.submittedAt) throw new ApiError("Assessment already submitted", 400)
    // Only allow submission before or at endsAt
    if (session.endsAt && new Date(session.endsAt) < new Date()) {
      throw new ApiError("Assessment time expired", 400)
    }

    // Fetch full assessment data for grading (preset, opens_at, closes_at, time_limit_minutes, constraints)
    const { rows: assessmentMeta } = await db.query(
      `SELECT time_limit_minutes AS "timeLimitMinutes", grading_preset AS "gradingPreset", opens_at AS "opensAt", closes_at AS "closesAt", structural_constraints AS "structuralConstraints"
       FROM assessments WHERE assessment_id = $1`,
      [assessmentId]
    )
    const { timeLimitMinutes, gradingPreset, opensAt: assessmentOpensAt, closesAt: assessmentClosesAt, structuralConstraints } = assessmentMeta[0]
    
    // Time is enabled only if there is a positive time limit or a closes_at deadline
    const timeEnabled = Boolean((timeLimitMinutes && timeLimitMinutes > 0) || assessmentClosesAt)
    const scWeight = structuralConstraints?.weight ?? 0
    const { testWeight, timeWeight, constraintWeight } = getGradingWeights(gradingPreset, timeEnabled, scWeight)

    // Get problems for this assessment
    const { rows: assessmentProblems } = await db.query(
      `SELECT problem_id AS "problemId" FROM assessment_problems WHERE assessment_id = $1`,
      [assessmentId]
    )

    const submissions = []
    let totalTestCaseScore = 0
    let problemsWithSolutions = 0
    let totalConstraintScore = 0
    let problemsWithConstraints = 0

    for (const ap of assessmentProblems) {
      const solution = problemSolutions?.find((s: any) => s.problemId === ap.problemId)
      if (!solution) continue // Skip if no solution for this problem

      const { problemId, sourceCode } = solution

      // Get problem details (language)
      const { rows: problemRows } = await db.query(
        `SELECT language FROM problems WHERE problem_id = $1`,
        [problemId]
      )
      if (!problemRows[0]) continue

      const language = problemRows[0].language

      // Get test cases
      const { rows: testCases } = await db.query(
        `SELECT test_case_id AS "testCaseId", input_data AS "inputData", expected_output AS "expectedOutput"
         FROM test_cases WHERE problem_id = $1 ORDER BY order_index ASC`,
        [problemId]
      )

      const testCasePromises = testCases.map(async (tc) => {
        try {
          const runRes = await axios.post(`http://localhost:${process.env.PORT || 5000}/run`, {
            sourceCode,
            language,
            stdin: tc.inputData
          })

          const passed = runRes.data.stdout?.trim() === tc.expectedOutput?.trim()

          return {
            testCaseId: tc.testCaseId,
            actualOutput: runRes.data.stdout,
            passed,
            executionTimeMs: runRes.data.time ? Math.round(runRes.data.time * 1000) : null,
            errorType: runRes.data.status !== "Accepted" ? runRes.data.status : null
          }
        } catch (err: any) {
          return {
            testCaseId: tc.testCaseId,
            actualOutput: null,
            passed: false,
            executionTimeMs: null,
            errorType: err.message || "Error"
          }
        }
      })

      const testResults = await Promise.all(testCasePromises)
      const passedCount = testResults.filter(tr => tr.passed).length
      const totalTime = testResults.reduce((acc, tr) => acc + (tr.executionTimeMs || 0), 0) / 1000

      const testCaseScore = testCases.length ? (passedCount / testCases.length) * 100 : 0
      totalTestCaseScore += testCaseScore
      problemsWithSolutions++
      const status = testCaseScore === 100 ? "Correct" : testCaseScore > 0 ? "Partial" : "Incorrect"

      // Check structural constraints (Python only)
      let perProblemConstraintScore: number | null = null
      let constraintDetails: ConstraintDetail[] = []
      if (structuralConstraints && language.toLowerCase() === "python") {
        const checkRes = checkStructuralConstraints(sourceCode, structuralConstraints)
        perProblemConstraintScore = checkRes.score
        constraintDetails = checkRes.details
      }

      // Insert submission (score = raw test-case score per problem)
      const { rows: subRows } = await db.query<Submission>(
        `INSERT INTO submissions (assessment_id, student_id, problem_id, source_code, language, score, status, execution_time_ms, memory_used_kb, constraint_score)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (assessment_id, student_id, problem_id)
         DO UPDATE SET 
           source_code = EXCLUDED.source_code, 
           language = EXCLUDED.language, 
           score = EXCLUDED.score, 
           status = EXCLUDED.status, 
           execution_time_ms = EXCLUDED.execution_time_ms, 
           constraint_score = EXCLUDED.constraint_score,
           submitted_at = NOW()
         RETURNING
           submission_id AS "submissionId",
           assessment_id AS "assessmentId",
           student_id AS "studentId",
           problem_id AS "problemId",
           source_code AS "sourceCode",
           language,
           score,
           status,
           constraint_score AS "constraintScore",
           execution_time_ms AS "executionTimeMs",
           memory_used_kb AS "memoryUsedKb",
           submitted_at AS "submittedAt"`,
        [assessmentId, userId, problemId, sourceCode, language, testCaseScore, status, totalTime ? Math.round(totalTime * 1000) : null, null, perProblemConstraintScore]
      )

      const submission = subRows[0]

      // Insert submission test results
      for (const tr of testResults) {
        await db.query(
          `INSERT INTO submission_test_results (submission_id, test_case_id, actual_output, passed, execution_time_ms, error_type)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (submission_id, test_case_id)
           DO UPDATE SET 
             actual_output = EXCLUDED.actual_output, 
             passed = EXCLUDED.passed, 
             execution_time_ms = EXCLUDED.execution_time_ms, 
             error_type = EXCLUDED.error_type`,
          [submission.submissionId, tr.testCaseId, tr.actualOutput, tr.passed, tr.executionTimeMs, tr.errorType]
        )
      }

      // Accumulate constraint score
      if (perProblemConstraintScore !== null) {
        totalConstraintScore += perProblemConstraintScore
        problemsWithConstraints++
      }

      submissions.push({
        ...submission,
        constraintDetails
      })
    }

    // Mark session as submitted
    const { rows: submittedSessionRows } = await db.query(
      `UPDATE student_assessment_sessions 
       SET submitted_at = NOW() 
       WHERE assessment_id = $1 AND student_id = $2
       RETURNING submitted_at AS "submittedAt", started_at AS "startedAt"`,
      [assessmentId, userId]
    )
    const submittedAt = submittedSessionRows[0]?.submittedAt ?? now

    // -- Compute overall scores
    const overallTestCaseScore = problemsWithSolutions > 0 ? totalTestCaseScore / problemsWithSolutions : 0
    const overallConstraintScore = problemsWithConstraints > 0 ? totalConstraintScore / problemsWithConstraints : null

    // Time bonus: calculated if time is enabled and deadline/end time exists
    let timeBonusScore = 0
    if (timeWeight > 0) {
      // Determine deadline: session.endsAt if present, otherwise assessment.closesAt
      const deadline = session.endsAt ? new Date(session.endsAt) : (assessmentClosesAt ? new Date(assessmentClosesAt) : null)
      if (deadline) {
        // If timeLimitMinutes is set, the student's timer window starts at session.startedAt
        const windowStart = (timeLimitMinutes && timeLimitMinutes > 0)
          ? new Date(session.startedAt)
          : (assessmentOpensAt ? new Date(assessmentOpensAt) : new Date(session.startedAt))
        timeBonusScore = computeTimeBonusScore(windowStart, deadline, new Date(submittedAt))
      }
    }

    // Final weighted score
    const totalWeight = testWeight + timeWeight + constraintWeight
    const finalScore = totalWeight > 0
      ? (
          overallTestCaseScore * testWeight +
          timeBonusScore * timeWeight +
          (overallConstraintScore ?? 0) * constraintWeight
        ) / totalWeight
      : overallTestCaseScore

    // Persist final_score on all submissions for this assessment + student
    await db.query(
      `UPDATE submissions SET final_score = $1
       WHERE assessment_id = $2 AND student_id = $3`,
      [finalScore, assessmentId, userId]
    )

    res.status(200).json(new ApiResponse(true, "Assessment submitted", {
      submissions,
      overallTestCaseScore,
      overallConstraintScore,
      timeBonusScore,
      finalScore,
      gradingPreset,
      testWeight,
      timeWeight,
      constraintWeight
    }))
  })
)

// -- Endpoint to get student's submission for an assessment
assessmentRouter.get(
  "/student/assessments/:id/submission",
  protect,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const assessmentId = parseInt(req.params.id as string, 10)
    const userId = req.user!.userId

    if (Number.isNaN(assessmentId)) {
      throw new ApiError("Invalid assessment id", 400)
    }

    const { rows: submissions } = await db.query<Submission>(
      `SELECT 
        submission_id AS "submissionId",
        assessment_id AS "assessmentId",
        student_id AS "studentId",
        problem_id AS "problemId",
        source_code AS "sourceCode",
        language,
        score,
        final_score AS "finalScore",
        status,
        constraint_score AS "constraintScore",
        execution_time_ms AS "executionTimeMs",
        memory_used_kb AS "memoryUsedKb",
        submitted_at AS "submittedAt"
       FROM submissions
       WHERE assessment_id = $1 AND student_id = $2`,
      [assessmentId, userId]
    )

    // If no submissions, return null
    if (submissions.length === 0) {
      res.status(200).json(new ApiResponse(true, "No submission yet", null))
      return
    }

    // Fetch grading preset + weights + structural constraints for this assessment
    const { rows: assessmentMeta } = await db.query(
      `SELECT time_limit_minutes AS "timeLimitMinutes", grading_preset AS "gradingPreset", opens_at AS "opensAt", closes_at AS "closesAt", structural_constraints AS "structuralConstraints"
       FROM assessments WHERE assessment_id = $1`,
      [assessmentId]
    )
    const meta = assessmentMeta[0] ?? { timeLimitMinutes: null, gradingPreset: "Correctness Only", opensAt: null, closesAt: null, structuralConstraints: null }

    // Get test results and structural constraint details for each submission
    const submissionsWithResults = []
    for (const sub of submissions) {
      const { rows: testResults } = await db.query<SubmissionTestResult>(
        `SELECT 
          result_id AS "resultId",
          submission_id AS "submissionId",
          test_case_id AS "testCaseId",
          actual_output AS "actualOutput",
          passed,
          execution_time_ms AS "executionTimeMs",
          error_type AS "errorType"
         FROM submission_test_results
         WHERE submission_id = $1`,
        [sub.submissionId]
      )

      let constraintDetails: ConstraintDetail[] = []
      if (meta.structuralConstraints && sub.language.toLowerCase() === "python") {
        const checkRes = checkStructuralConstraints(sub.sourceCode, meta.structuralConstraints)
        constraintDetails = checkRes.details
      }

      submissionsWithResults.push({
        ...sub,
        testResults,
        constraintDetails
      })
    }

    // Compute aggregate scores from stored data
    const overallTestCaseScore = submissions.reduce((acc, s) => acc + Number(s.score), 0) / submissions.length
    // final_score is the same for all rows (assessment-level), grab from first
    const finalScore = submissions[0].finalScore ?? overallTestCaseScore

    const timeEnabled = Boolean((meta.timeLimitMinutes && meta.timeLimitMinutes > 0) || meta.closesAt)
    const scWeight = meta.structuralConstraints?.weight ?? 0
    const { testWeight, timeWeight, constraintWeight } = getGradingWeights(meta.gradingPreset, timeEnabled, scWeight)

    // Compute overall constraint score from stored per-submission values
    const constraintScores = submissions.map((s: any) => s.constraintScore).filter((v: any) => v !== null && v !== undefined)
    const overallConstraintScore: number | null = constraintScores.length > 0
      ? constraintScores.reduce((a: number, b: number) => a + Number(b), 0) / constraintScores.length
      : null

    // Reconstruct time bonus from final score and weights
    let timeBonusScore: number | null = null
    if (timeWeight > 0) {
      const totalW = testWeight + timeWeight + constraintWeight
      timeBonusScore = (
        (finalScore * totalW) -
        overallTestCaseScore * testWeight -
        (overallConstraintScore ?? 0) * constraintWeight
      ) / timeWeight
      timeBonusScore = Math.max(0, Math.min(100, timeBonusScore))
    }

    res.status(200).json(new ApiResponse(true, "Submission fetched", {
      submissions: submissionsWithResults,
      overallTestCaseScore,
      overallConstraintScore,
      timeBonusScore,
      finalScore,
      gradingPreset: meta.gradingPreset,
      testWeight,
      timeWeight,
      constraintWeight
    }))
  })
)

// -- Session endpoints
assessmentRouter.post(
  "/student/assessments/:id/start-session",
  protect,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const assessmentId = parseInt(req.params.id as string, 10)
    const userId = req.user!.userId

    if (Number.isNaN(assessmentId)) throw new ApiError("Invalid assessment id", 400)

    const now = new Date()

    // Verify student is enrolled in the classroom, assessment is published, and schedule is active
    const { rows: enrollRows } = await db.query(
      `SELECT cs.student_id, a.opens_at, a.closes_at 
       FROM assessments a
       JOIN classroom_students cs ON a.classroom_id = cs.classroom_id
       WHERE 
         a.assessment_id = $1 AND 
         cs.student_id = $2 AND 
         a.is_published = true AND
         (a.opens_at IS NULL OR a.opens_at <= $3) AND
         (a.closes_at IS NULL OR a.closes_at >= $3)`,
      [assessmentId, userId, now]
    )
    if (!enrollRows[0]) throw new ApiError("Not allowed to take this assessment", 403)

    // Check if there's already a session
    const { rows: existingRows } = await db.query(
      `SELECT
        session_id AS "sessionId",
        assessment_id AS "assessmentId",
        student_id AS "studentId",
        started_at AS "startedAt",
        ends_at AS "endsAt",
        submitted_at AS "submittedAt"
       FROM student_assessment_sessions
       WHERE assessment_id = $1 AND student_id = $2`,
      [assessmentId, userId]
    )

    if (existingRows[0]) {
      res.status(200).json(new ApiResponse(true, "Session already exists", existingRows[0]))
      return
    }

    // Get assessment to calculate end time if needed
    const { rows: assessmentRows } = await db.query(
      `SELECT time_limit_minutes FROM assessments WHERE assessment_id = $1`,
      [assessmentId]
    )
    const timeLimitMinutes = assessmentRows[0].time_limit_minutes

    let endsAt: Date | null = null
    if (timeLimitMinutes) {
      endsAt = new Date(Date.now() + timeLimitMinutes * 60 * 1000)
    }

    // Create new session
    const { rows } = await db.query(
      `INSERT INTO student_assessment_sessions (assessment_id, student_id, ends_at)
       VALUES ($1, $2, $3)
       RETURNING
         session_id AS "sessionId",
         assessment_id AS "assessmentId",
         student_id AS "studentId",
         started_at AS "startedAt",
         ends_at AS "endsAt",
         submitted_at AS "submittedAt"`,
      [assessmentId, userId, endsAt]
    )

    res.status(201).json(new ApiResponse(true, "Session started", rows[0]))
  })
)

assessmentRouter.get(
  "/student/assessments/:id/session",
  protect,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const assessmentId = parseInt(req.params.id as string, 10)
    const userId = req.user!.userId

    if (Number.isNaN(assessmentId)) throw new ApiError("Invalid assessment id", 400)

    const { rows } = await db.query(
      `SELECT
        session_id AS "sessionId",
        assessment_id AS "assessmentId",
        student_id AS "studentId",
        started_at AS "startedAt",
        ends_at AS "endsAt",
        submitted_at AS "submittedAt"
       FROM student_assessment_sessions
       WHERE assessment_id = $1 AND student_id = $2`,
      [assessmentId, userId]
    )

    res.status(200).json(new ApiResponse(true, "Session fetched", rows[0] || null))
  })
)



export { assessmentRouter }
export default assessmentRouter
