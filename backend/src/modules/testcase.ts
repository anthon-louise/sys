import { Router, Request, Response } from "express"
import { z } from "zod"
import asyncHandler from "express-async-handler"
import { db } from "../config/db.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { protect, instructorOnly, AuthRequest } from "../middlewares/auth.middleware.js"

const testcaseRouter = Router({ mergeParams: true })

// -- types --

export interface TestCase {
  testCaseId: number
  problemId: number
  inputData: string
  expectedOutput: string
  isHidden: boolean
  orderIndex: number
}

// -- schemas --

export const CreateTestCaseSchema = z.object({
  inputData: z.string(),
  expectedOutput: z.string(),
  isHidden: z.boolean().optional(),
  orderIndex: z.number().int().optional()
})

export const BulkCreateTestCasesSchema = z.array(
  z.object({
    inputData: z.string(),
    expectedOutput: z.string(),
    isHidden: z.boolean().optional(),
    orderIndex: z.number().int().optional()
  })
)

export const UpdateTestCaseSchema = z.object({
  inputData: z.string().optional(),
  expectedOutput: z.string().optional(),
  isHidden: z.boolean().optional(),
  orderIndex: z.number().int().optional()
})

export type CreateTestCaseInput = z.infer<typeof CreateTestCaseSchema>
export type BulkCreateTestCasesInput = z.infer<typeof BulkCreateTestCasesSchema>
export type UpdateTestCaseInput = z.infer<typeof UpdateTestCaseSchema>

// -- routes --

// POST /api/problems/:id/testcases
testcaseRouter.post(
  "/",
  protect,
  instructorOnly,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Fix: Get id and ensure it's a string
    const id = req.params.id as string
    const teacherId = req.user!.userId
    
    // Validate that id is a number
    const problemId = parseInt(id)
    if (isNaN(problemId)) {
      throw new ApiError("Invalid problem ID", 400)
    }
    
    // Parse and validate request body
    const testCases = BulkCreateTestCasesSchema.parse(req.body)

    // Verify problem ownership
    const { rows: problemRows } = await db.query(
      `SELECT problem_id FROM problems WHERE problem_id = $1 AND teacher_id = $2`,
      [problemId, teacherId]
    )
    
    if (!problemRows[0]) {
      throw new ApiError("Problem not found", 404)
    }

    // Insert all test cases
    const insertedTestCases = []
    for (const tc of testCases) {
      const { rows } = await db.query<TestCase>(
        `INSERT INTO test_cases (problem_id, input_data, expected_output, is_hidden, order_index)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING
           test_case_id   AS "testCaseId",
           problem_id     AS "problemId",
           input_data     AS "inputData",
           expected_output AS "expectedOutput",
           is_hidden      AS "isHidden",
           order_index    AS "orderIndex"`,
        [
          problemId,
          tc.inputData,
          tc.expectedOutput,
          tc.isHidden ?? false,
          tc.orderIndex ?? 0
        ]
      )
      insertedTestCases.push(rows[0])
    }

    res.status(201).json(new ApiResponse(true, "Test cases created successfully", insertedTestCases))
  })
)

// GET /api/problems/:id/testcases
testcaseRouter.get(
  "/",
  protect,
  instructorOnly,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Fix: Get id and ensure it's a string
    const id = req.params.id as string
    const teacherId = req.user!.userId
    
    // Validate that id is a number
    const problemId = parseInt(id)
    if (isNaN(problemId)) {
      throw new ApiError("Invalid problem ID", 400)
    }

    // Verify problem ownership
    const { rows: problemRows } = await db.query(
      `SELECT problem_id FROM problems WHERE problem_id = $1 AND teacher_id = $2`,
      [problemId, teacherId]
    )
    
    if (!problemRows[0]) {
      throw new ApiError("Problem not found", 404)
    }

    // Get all test cases for the problem
    const { rows } = await db.query<TestCase>(
      `SELECT
         test_case_id    AS "testCaseId",
         problem_id      AS "problemId",
         input_data      AS "inputData",
         expected_output AS "expectedOutput",
         is_hidden       AS "isHidden",
         order_index     AS "orderIndex"
       FROM test_cases
       WHERE problem_id = $1
       ORDER BY order_index ASC`,
      [problemId]
    )

    res.status(200).json(new ApiResponse(true, "Test cases fetched successfully", rows))
  })
)

// PUT /api/problems/:id/testcases/:testCaseId
testcaseRouter.put(
  "/:testCaseId",
  protect,
  instructorOnly,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id, testCaseId } = req.params
    const teacherId = req.user!.userId
    const updateData = UpdateTestCaseSchema.parse(req.body)

    const problemIdNum = parseInt(id as string)
    const testCaseIdNum = parseInt(testCaseId as string)
    if (isNaN(problemIdNum) || isNaN(testCaseIdNum)) {
      throw new ApiError("Invalid IDs", 400)
    }

    // Verify problem ownership
    const { rows: problemRows } = await db.query(
      `SELECT problem_id FROM problems WHERE problem_id = $1 AND teacher_id = $2`,
      [problemIdNum, teacherId]
    )
    if (!problemRows[0]) {
      throw new ApiError("Problem not found", 404)
    }

    // Verify test case exists and belongs to this problem
    const { rows: testCaseRows } = await db.query(
      `SELECT test_case_id FROM test_cases WHERE test_case_id = $1 AND problem_id = $2`,
      [testCaseIdNum, problemIdNum]
    )
    if (!testCaseRows[0]) {
      throw new ApiError("Test case not found", 404)
    }

    // Check if problem is validated OR attached to any assessments - prevent edit if yes!
    const { rows: validationRows } = await db.query(
      `SELECT ws.validated_at FROM working_solutions ws WHERE ws.problem_id = $1`,
      [problemIdNum]
    )
    const isAlreadyValidated = !!validationRows[0]?.validated_at

    const { rows: attachmentRows } = await db.query(
      `SELECT ap.assessment_id FROM assessment_problems ap WHERE ap.problem_id = $1`,
      [problemIdNum]
    )
    const isAttachedToAssessments = attachmentRows.length > 0

    if (isAlreadyValidated || isAttachedToAssessments) {
      throw new ApiError("Cannot update a test case for a problem that is already validated or attached to an assessment", 400)
    }

    // Build update query
    const updates: string[] = []
    const values: any[] = []
    let paramCount = 0

    if (updateData.inputData !== undefined) {
      paramCount++
      updates.push(`input_data = $${paramCount}`)
      values.push(updateData.inputData)
    }
    if (updateData.expectedOutput !== undefined) {
      paramCount++
      updates.push(`expected_output = $${paramCount}`)
      values.push(updateData.expectedOutput)
    }
    if (updateData.isHidden !== undefined) {
      paramCount++
      updates.push(`is_hidden = $${paramCount}`)
      values.push(updateData.isHidden)
    }
    if (updateData.orderIndex !== undefined) {
      paramCount++
      updates.push(`order_index = $${paramCount}`)
      values.push(updateData.orderIndex)
    }

    if (updates.length === 0) {
      throw new ApiError("No fields to update", 400)
    }

    paramCount++
    values.push(testCaseIdNum)

    const { rows } = await db.query<TestCase>(
      `UPDATE test_cases
       SET ${updates.join(", ")}
       WHERE test_case_id = $${paramCount}
       RETURNING
         test_case_id    AS "testCaseId",
         problem_id      AS "problemId",
         input_data      AS "inputData",
         expected_output AS "expectedOutput",
         is_hidden       AS "isHidden",
         order_index     AS "orderIndex"`,
      values
    )

    res.status(200).json(new ApiResponse(true, "Test case updated successfully", rows[0]))
  })
)

// DELETE /api/problems/:id/testcases/:testCaseId
testcaseRouter.delete(
  "/:testCaseId",
  protect,
  instructorOnly,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id, testCaseId } = req.params
    const teacherId = req.user!.userId

    const problemIdNum = parseInt(id as string)
    const testCaseIdNum = parseInt(testCaseId as string)
    if (isNaN(problemIdNum) || isNaN(testCaseIdNum)) {
      throw new ApiError("Invalid IDs", 400)
    }

    // Verify problem ownership
    const { rows: problemRows } = await db.query(
      `SELECT problem_id FROM problems WHERE problem_id = $1 AND teacher_id = $2`,
      [problemIdNum, teacherId]
    )
    if (!problemRows[0]) {
      throw new ApiError("Problem not found", 404)
    }

    // Verify test case exists and belongs to this problem
    const { rows: testCaseRows } = await db.query(
      `SELECT test_case_id FROM test_cases WHERE test_case_id = $1 AND problem_id = $2`,
      [testCaseIdNum, problemIdNum]
    )
    if (!testCaseRows[0]) {
      throw new ApiError("Test case not found", 404)
    }

    // Check if problem is validated OR attached to any assessments - prevent delete if yes!
    const { rows: validationRows } = await db.query(
      `SELECT ws.validated_at FROM working_solutions ws WHERE ws.problem_id = $1`,
      [problemIdNum]
    )
    const isAlreadyValidated = !!validationRows[0]?.validated_at

    const { rows: attachmentRows } = await db.query(
      `SELECT ap.assessment_id FROM assessment_problems ap WHERE ap.problem_id = $1`,
      [problemIdNum]
    )
    const isAttachedToAssessments = attachmentRows.length > 0

    if (isAlreadyValidated || isAttachedToAssessments) {
      throw new ApiError("Cannot delete a test case for a problem that is already validated or attached to an assessment", 400)
    }

    // Delete test case
    await db.query(
      `DELETE FROM test_cases WHERE test_case_id = $1`,
      [testCaseIdNum]
    )

    res.status(200).json(new ApiResponse(true, "Test case deleted successfully", null))
  })
)

export default testcaseRouter