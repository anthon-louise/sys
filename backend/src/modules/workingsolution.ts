import { Router, Request, Response } from "express"
import { z } from "zod"
import asyncHandler from "express-async-handler"
import axios from "axios"
import { db } from "../config/db.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { protect, instructorOnly, AuthRequest } from "../middlewares/auth.middleware.js"

// Use the same server (no need for separate proxy)
const API_BASE = process.env.API_BASE || "http://localhost:5000"

const workingSolutionRouter = Router()

// -- types --

export interface WorkingSolution {
  solutionId: number
  problemId: number
  sourceCode: string
  language: string
  validatedBy: number | null
  validatedAt: Date | null
}

export interface ValidationResult {
  testCaseId: number
  passed: boolean
  actualOutput: string | null
  expectedOutput: string
  error: string | null
}

// -- schemas --

export const ValidateSchema = z.object({
  sourceCode: z.string().min(1),
  language: z.string().min(1)
})
export type ValidateInput = z.infer<typeof ValidateSchema>

// -- helpers --

const runCodeViaProxy = async (sourceCode: string, language: string, input: string): Promise<any> => {
  try {
    const response = await axios.post(`${API_BASE}/run`, {
      sourceCode,
      language,
      stdin: input
    }, {
      timeout: 30000
    })

    return response.data
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error(`Cannot connect to server at ${API_BASE}. Please make sure it's running.`)
    }
    if (error.response) {
      throw new Error(`Server error: ${error.response.status} - ${JSON.stringify(error.response.data)}`)
    }
    throw new Error(error.message || "Code execution failed")
  }
}

// -- routes --

// POST /api/problems/:id/validate
workingSolutionRouter.post(
  "/",
  protect,
  instructorOnly,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const idParam = req.params.id
    const id = Array.isArray(idParam) ? idParam[0] : idParam
    
    if (!id) {
      throw new ApiError("Problem id is required", 400)
    }
    
    const teacherId = req.user!.userId
    const { sourceCode, language } = ValidateSchema.parse(req.body)

    const problemId = parseInt(id, 10)
    if (Number.isNaN(problemId)) {
      throw new ApiError("Invalid problem id", 400)
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
    const { rows: testCaseRows } = await db.query(
      `SELECT
         test_case_id   AS "testCaseId",
         input_data     AS "inputData",
         expected_output AS "expectedOutput"
       FROM test_cases
       WHERE problem_id = $1
       ORDER BY order_index ASC`,
      [problemId]
    )

    if (!testCaseRows.length) {
      throw new ApiError("No test cases found for this problem", 404)
    }

    // Run code against each test case
    const validationResults: ValidationResult[] = []

    for (const tc of testCaseRows) {
      try {
        console.log(`Running test case ${tc.testCaseId} with input:`, tc.inputData)
        
        const result = await runCodeViaProxy(sourceCode, language, tc.inputData as string)
        
        const actualOutput = (result.stdout || "").trim()
        const expectedOutput = (tc.expectedOutput as string).trim()
        const passed = actualOutput === expectedOutput

        const error = result.stderr || result.compile_output || null
        if (error) {
          validationResults.push({
            testCaseId: tc.testCaseId,
            passed: false,
            actualOutput: null,
            expectedOutput: expectedOutput,
            error: error
          })
        } else {
          validationResults.push({
            testCaseId: tc.testCaseId,
            passed: passed,
            actualOutput: actualOutput || null,
            expectedOutput: expectedOutput,
            error: null
          })
        }
      } catch (error: any) {
        console.error(`Error running test case ${tc.testCaseId}:`, error.message)
        validationResults.push({
          testCaseId: tc.testCaseId,
          passed: false,
          actualOutput: null,
          expectedOutput: (tc.expectedOutput as string).trim(),
          error: error.message || "Code execution failed"
        })
      }
    }

    const allPassed = validationResults.every(r => r.passed)

    // Update working_solutions if all test cases passed
    if (allPassed) {
      const { rows: existingSolution } = await db.query(
        `SELECT solution_id FROM working_solutions WHERE problem_id = $1`,
        [problemId]
      )

      if (existingSolution[0]) {
        await db.query(
          `UPDATE working_solutions SET source_code = $1, language = $2, validated_by = $3, validated_at = NOW() WHERE solution_id = $4`,
          [sourceCode, language, teacherId, existingSolution[0].solution_id]
        )
      } else {
        await db.query(
          `INSERT INTO working_solutions (problem_id, source_code, language, validated_by, validated_at) VALUES ($1, $2, $3, $4, NOW())`,
          [problemId, sourceCode, language, teacherId]
        )
      }
    }

    res.status(200).json(
      new ApiResponse(
        true,
        allPassed ? "All test cases passed" : "Some test cases failed",
        {
          allPassed,
          results: validationResults
        }
      )
    )
  })
)

export default workingSolutionRouter