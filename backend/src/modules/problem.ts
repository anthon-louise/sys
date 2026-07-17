import { Router, Request, Response } from "express"
import { z } from "zod"
import asyncHandler from "express-async-handler"
import { db } from "../config/db.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { protect, instructorOnly, AuthRequest } from "../middlewares/auth.middleware.js"

const problemRouter = Router()

// -- types --

export interface Problem {
  problemId: number
  teacherId: number
  title: string
  description: string
  language: string
  difficulty: string | null
  starterCode: string | null
  createdAt: Date
  isValidated: boolean
  workingSolutionId: number | null
  validatedAt: Date | null
}

// -- schemas --

export const CreateProblemSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().optional(),
  language: z.string().min(1).max(50),
  difficulty: z.string().max(20).optional(),
  starterCode: z.string().optional()
})

export type CreateProblemInput = z.infer<typeof CreateProblemSchema>

export const UpdateProblemSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  language: z.string().min(1).max(50).optional(),
  difficulty: z.string().max(20).optional(),
  starterCode: z.string().optional()
})

export type UpdateProblemInput = z.infer<typeof UpdateProblemSchema>

// -- routes --

// GET /api/problems
problemRouter.get(
  "/",
  protect,
  instructorOnly,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const teacherId = req.user!.userId

    const { rows } = await db.query(
      `SELECT
         p.problem_id    AS "problemId",
         p.teacher_id    AS "teacherId",
         p.title,
         p.description,
         p.language,
         p.difficulty,
         p.starter_code  AS "starterCode",
         p.created_at    AS "createdAt",
         ws.solution_id  AS "workingSolutionId",
         ws.validated_at AS "validatedAt",
         CASE 
           WHEN ws.validated_at IS NOT NULL THEN true 
           ELSE false 
         END AS "isValidated"
       FROM problems p
       LEFT JOIN working_solutions ws ON p.problem_id = ws.problem_id
       WHERE p.teacher_id = $1
       ORDER BY p.created_at DESC`,
      [teacherId]
    )

    res.status(200).json(new ApiResponse(true, "Problems fetched successfully", rows))
  })
)

// GET /api/problems/:id
problemRouter.get(
  "/:id",
  protect,
  instructorOnly,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params
    const teacherId = req.user!.userId

    const { rows } = await db.query(
      `SELECT
         p.problem_id    AS "problemId",
         p.teacher_id    AS "teacherId",
         p.title,
         p.description,
         p.language,
         p.difficulty,
         p.starter_code  AS "starterCode",
         p.created_at    AS "createdAt",
         ws.solution_id  AS "workingSolutionId",
         ws.source_code  AS "workingSolution",
         ws.language     AS "solutionLanguage",
         ws.validated_by AS "validatedBy",
         ws.validated_at AS "validatedAt",
         CASE 
           WHEN ws.validated_at IS NOT NULL THEN true 
           ELSE false 
         END AS "isValidated"
       FROM problems p
       LEFT JOIN working_solutions ws ON p.problem_id = ws.problem_id
       WHERE p.problem_id = $1 AND p.teacher_id = $2`,
      [id, teacherId]
    )

    const problem = rows[0]
    if (!problem) {
      throw new ApiError("Problem not found", 404)
    }

    res.status(200).json(new ApiResponse(true, "Problem fetched successfully", problem))
  })
)

// GET /api/problems/:id/validation-status
problemRouter.get(
  "/:id/validation-status",
  protect,
  instructorOnly,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params
    const teacherId = req.user!.userId

    // Verify problem ownership
    const { rows: problemRows } = await db.query(
      `SELECT problem_id FROM problems WHERE problem_id = $1 AND teacher_id = $2`,
      [id, teacherId]
    )
    if (!problemRows[0]) {
      throw new ApiError("Problem not found", 404)
    }

    const { rows } = await db.query(
      `SELECT
         p.problem_id AS "problemId",
         p.title,
         ws.solution_id AS "workingSolutionId",
         ws.validated_at AS "validatedAt",
         ws.validated_by AS "validatedBy",
         CASE 
           WHEN ws.validated_at IS NOT NULL THEN true 
           ELSE false 
         END AS "isValidated"
       FROM problems p
       LEFT JOIN working_solutions ws ON p.problem_id = ws.problem_id
       WHERE p.problem_id = $1`,
      [id]
    )

    res.status(200).json(
      new ApiResponse(true, "Validation status fetched successfully", rows[0] || { 
        problemId: parseInt(id as string), 
        isValidated: false,
        workingSolutionId: null,
        validatedAt: null,
        validatedBy: null
      })
    )
  })
)

// POST /api/problems
problemRouter.post(
  "/",
  protect,
  instructorOnly,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { title, description, language, difficulty, starterCode } = CreateProblemSchema.parse(req.body)
    const teacherId = req.user!.userId

    const { rows } = await db.query(
      `INSERT INTO problems (teacher_id, title, description, language, difficulty, starter_code)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING
         problem_id    AS "problemId",
         teacher_id    AS "teacherId",
         title,
         description,
         language,
         difficulty,
         starter_code  AS "starterCode",
         created_at    AS "createdAt"`,
      [teacherId, title, description || null, language, difficulty || null, starterCode || null]
    )

    // Return the created problem with validation status (will be false since no working solution yet)
    const newProblem = rows[0]
    res.status(201).json(
      new ApiResponse(true, "Problem created successfully", {
        ...newProblem,
        isValidated: false,
        workingSolutionId: null,
        validatedAt: null
      })
    )
  })
)

// PUT /api/problems/:id
problemRouter.put(
  "/:id",
  protect,
  instructorOnly,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params
    const teacherId = req.user!.userId
    const updateData = UpdateProblemSchema.parse(req.body)

    // Verify ownership
    const { rows: problemRows } = await db.query(
      `SELECT problem_id FROM problems WHERE problem_id = $1 AND teacher_id = $2`,
      [id, teacherId]
    )
    if (!problemRows[0]) {
      throw new ApiError("Problem not found", 404)
    }

    // Check if problem is already validated OR attached to any assessments - if so, prevent edits? Or allow? Let's follow similar pattern as assessments: if validated or attached to assessments, maybe prevent? Wait, let's check:
    const { rows: validationRows } = await db.query(
      `SELECT ws.validated_at FROM working_solutions ws WHERE ws.problem_id = $1`,
      [id]
    )
    const isAlreadyValidated = !!validationRows[0]?.validated_at

    const { rows: attachmentRows } = await db.query(
      `SELECT ap.assessment_id FROM assessment_problems ap WHERE ap.problem_id = $1`,
      [id]
    )
    const isAttachedToAssessments = attachmentRows.length > 0

    // Let's prevent updates if the problem is validated OR attached to assessments to be safe!
    if (isAlreadyValidated || isAttachedToAssessments) {
      throw new ApiError("Cannot update a problem that is already validated or attached to an assessment", 400)
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
    if (updateData.language !== undefined) {
      paramCount++
      updates.push(`language = $${paramCount}`)
      values.push(updateData.language)
    }
    if (updateData.difficulty !== undefined) {
      paramCount++
      updates.push(`difficulty = $${paramCount}`)
      values.push(updateData.difficulty || null)
    }
    if (updateData.starterCode !== undefined) {
      paramCount++
      updates.push(`starter_code = $${paramCount}`)
      values.push(updateData.starterCode || null)
    }

    if (updates.length === 0) {
      throw new ApiError("No fields to update", 400)
    }

    paramCount++
    values.push(id)

    const { rows } = await db.query(
      `UPDATE problems
       SET ${updates.join(", ")}
       WHERE problem_id = $${paramCount}
       RETURNING
         problem_id    AS "problemId",
         teacher_id    AS "teacherId",
         title,
         description,
         language,
         difficulty,
         starter_code  AS "starterCode",
         created_at    AS "createdAt"`,
      values
    )

    // Return updated problem with validation status
    const updatedProblem = rows[0]
    res.status(200).json(new ApiResponse(true, "Problem updated successfully", {
      ...updatedProblem,
      isValidated: isAlreadyValidated,
      workingSolutionId: null,
      validatedAt: null
    }))
  })
)

// DELETE /api/problems/:id
problemRouter.delete(
  "/:id",
  protect,
  instructorOnly,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params
    const teacherId = req.user!.userId

    // Verify ownership
    const { rows: problemRows } = await db.query(
      `SELECT problem_id FROM problems WHERE problem_id = $1 AND teacher_id = $2`,
      [id, teacherId]
    )
    if (!problemRows[0]) {
      throw new ApiError("Problem not found", 404)
    }

    // Check if problem is attached to any assessments - if yes, prevent deletion? Or allow? Let's follow safe pattern: prevent deletion if attached to assessments or validated!
    const { rows: validationRows } = await db.query(
      `SELECT ws.validated_at FROM working_solutions ws WHERE ws.problem_id = $1`,
      [id]
    )
    const isAlreadyValidated = !!validationRows[0]?.validated_at

    const { rows: attachmentRows } = await db.query(
      `SELECT ap.assessment_id FROM assessment_problems ap WHERE ap.problem_id = $1`,
      [id]
    )
    const isAttachedToAssessments = attachmentRows.length > 0

    if (isAlreadyValidated || isAttachedToAssessments) {
      throw new ApiError("Cannot delete a problem that is already validated or attached to an assessment", 400)
    }

    // Delete problem - foreign key constraints should handle test cases and working solutions (since they have ON DELETE CASCADE probably?)
    await db.query(
      `DELETE FROM problems WHERE problem_id = $1`,
      [id]
    )

    res.status(200).json(new ApiResponse(true, "Problem deleted successfully", null))
  })
)

export default problemRouter
