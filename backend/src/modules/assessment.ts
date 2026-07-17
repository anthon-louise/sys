import { Router, Request, Response } from "express"
import { z } from "zod"
import asyncHandler from "express-async-handler"
import { db } from "../config/db.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { protect, instructorOnly, AuthRequest } from "../middlewares/auth.middleware.js"
import axios from "axios"

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
  timeLimitMinutes: z.number().int().optional(),
  opensAt: z.string().datetime({ offset: true }).optional().nullable(),
  closesAt: z.string().datetime({ offset: true }).optional().nullable()
})

export const UpdateAssessmentSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  assessmentType: z.enum(["Practice", "Quiz", "Exam"]).optional(),
  academicTerm: z.enum(["Midterm", "Finals"]).optional(),
  timeLimitMinutes: z.number().int().optional().nullable(),
  opensAt: z.string().datetime({ offset: true }).optional().nullable(),
  closesAt: z.string().datetime({ offset: true }).optional().nullable()
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
    const { classroomId, title, description, assessmentType, academicTerm, timeLimitMinutes, opensAt, closesAt } = CreateAssessmentSchema.parse(req.body)
    const teacherId = req.user!.userId

    const { rows } = await db.query<Assessment>(
      `INSERT INTO assessments (classroom_id, teacher_id, title, description, assessment_type, academic_term, time_limit_minutes, opens_at, closes_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
         opens_at AS "opensAt",
         closes_at AS "closesAt"`,
      [classroomId, teacherId, title, description || null, assessmentType, academicTerm, timeLimitMinutes || null, opensAt || null, closesAt || null]
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
         updated_at         AS "updatedAt",
         is_published       AS "isPublished",
         opens_at AS "opensAt",
         closes_at AS "closesAt"
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
         opens_at AS "opensAt",
         closes_at AS "closesAt"`,
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
         opens_at AS "opensAt",
         closes_at AS "closesAt"
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
         opens_at AS "opensAt",
         closes_at AS "closesAt"`,
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
         opens_at AS "opensAt",
         closes_at AS "closesAt"
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
         teacher_id     AS "teacherId",
         title,
         description,
         assessment_type    AS "assessmentType",
         academic_term    AS "academicTerm",
         time_limit_minutes AS "timeLimitMinutes",
         created_at     AS "createdAt",
         updated_at     AS "updatedAt",
         is_published       AS "isPublished",
         opens_at AS "opensAt",
         closes_at AS "closesAt"
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
         a.academic_term    AS "academicTerm",
         a.time_limit_minutes AS "timeLimitMinutes",
         a.created_at     AS "createdAt",
         a.updated_at     AS "updatedAt",
         a.is_published       AS "isPublished",
         a.opens_at AS "opensAt",
         a.closes_at AS "closesAt"
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
  status: string
  executionTimeMs: number | null
  memoryUsedKb: number | null
  submittedAt: Date
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
    const problemId = parseInt(req.params.problemId, 10)
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
    const assessmentId = parseInt(req.params.id, 10)
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
      `SELECT ends_at, submitted_at FROM student_assessment_sessions WHERE assessment_id = $1 AND student_id = $2`,
      [assessmentId, userId]
    )
    const session = sessionRows[0]
    if (!session) throw new ApiError("Session not found", 400)
    if (session.submittedAt) throw new ApiError("Assessment already submitted", 400)
    // Only allow submission before or at endsAt
    if (session.endsAt && new Date(session.endsAt) < new Date()) {
      throw new ApiError("Assessment time expired", 400)
    }

    // Get problems for this assessment
    const { rows: assessmentProblems } = await db.query(
      `SELECT problem_id AS "problemId" FROM assessment_problems WHERE assessment_id = $1`,
      [assessmentId]
    )

    const submissions = []
    let totalScore = 0

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
      const totalTime = testResults.reduce((acc, tr) => acc + (tr.executionTimeMs || 0), 0) / 1000 // Convert back to seconds for DB

      const score = testCases.length ? (passedCount / testCases.length) * 100 : 0
      totalScore += score
      const status = score === 100 ? "Correct" : score > 0 ? "Partial" : "Incorrect"

      // Insert submission
      const { rows: subRows } = await db.query<Submission>(
        `INSERT INTO submissions (assessment_id, student_id, problem_id, source_code, language, score, status, execution_time_ms, memory_used_kb)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (assessment_id, student_id, problem_id)
         DO UPDATE SET 
           source_code = EXCLUDED.source_code, 
           language = EXCLUDED.language, 
           score = EXCLUDED.score, 
           status = EXCLUDED.status, 
           execution_time_ms = EXCLUDED.execution_time_ms, 
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
           execution_time_ms AS "executionTimeMs",
           memory_used_kb AS "memoryUsedKb",
           submitted_at AS "submittedAt"`,
        [assessmentId, userId, problemId, sourceCode, language, score, status, totalTime ? Math.round(totalTime * 1000) : null, null]
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

      submissions.push(submission)
    }

    // Mark session as submitted
    await db.query(
      `UPDATE student_assessment_sessions 
       SET submitted_at = NOW() 
       WHERE assessment_id = $1 AND student_id = $2`,
      [assessmentId, userId]
    )

    const overallScore = assessmentProblems.length ? totalScore / assessmentProblems.length : 0

    res.status(200).json(new ApiResponse(true, "Assessment submitted", {
      submissions,
      overallScore
    }))
  })
)

// -- Endpoint to get student's submission for an assessment
assessmentRouter.get(
  "/student/assessments/:id/submission",
  protect,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const assessmentId = parseInt(req.params.id, 10)
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
        status,
        execution_time_ms AS "executionTimeMs",
        memory_used_kb AS "memoryUsedKb",
        submitted_at AS "submittedAt"
       FROM submissions
       WHERE assessment_id = $1 AND student_id = $2`,
      [assessmentId, userId]
    )

    // Get test results for each submission
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
      submissionsWithResults.push({
        ...sub,
        testResults
      })
    }

    // If no submissions, return null
    if (submissions.length === 0) {
      return res.status(200).json(new ApiResponse(true, "No submission yet", null))
    }

    // Calculate overall score
    const overallScore = submissions.reduce((acc, s) => acc + s.score, 0) / submissions.length

    res.status(200).json(new ApiResponse(true, "Submission fetched", {
      submissions: submissionsWithResults,
      overallScore
    }))
  })
)

// -- Session endpoints
assessmentRouter.post(
  "/student/assessments/:id/start-session",
  protect,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const assessmentId = parseInt(req.params.id, 10)
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
      return res.status(200).json(new ApiResponse(true, "Session already exists", existingRows[0]))
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
    const assessmentId = parseInt(req.params.id, 10)
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
