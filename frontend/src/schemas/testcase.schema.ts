import { z } from "zod"

export const createTestCaseSchema = z.object({
  inputData: z.string(),
  expectedOutput: z.string(),
  isHidden: z.boolean().optional(),
  orderIndex: z.number().int().optional(),
})

export const updateTestCaseSchema = z.object({
  inputData: z.string().optional(),
  expectedOutput: z.string().optional(),
  isHidden: z.boolean().optional(),
  orderIndex: z.number().int().optional(),
})

export type CreateTestCaseForm = z.infer<typeof createTestCaseSchema>
export type UpdateTestCaseForm = z.infer<typeof updateTestCaseSchema>
