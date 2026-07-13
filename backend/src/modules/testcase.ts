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

export type CreateTestCaseInput = z.infer<typeof CreateTestCaseSchema>
export type BulkCreateTestCasesInput = z.infer<typeof BulkCreateTestCasesSchema>

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
         test_case_id   AS "testCaseId",
         problem_id     AS "problemId",
         input_data     AS "inputData",
         expected_output AS "expectedOutput",
         is_hidden      AS "isHidden",
         order_index    AS "orderIndex"
       FROM test_cases
       WHERE problem_id = $1
       ORDER BY order_index ASC`,
      [problemId]
    )

    res.status(200).json(new ApiResponse(true, "Test cases fetched successfully", rows))
  })
)

export default testcaseRouter