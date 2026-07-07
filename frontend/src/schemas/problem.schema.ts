import { z } from "zod"

export const createProblemSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().optional(),
  language: z.string().min(1).max(50),
  difficulty: z.string().max(20).optional(),
  starterCode: z.string().optional(),
})
export type CreateProblemForm = z.infer<typeof createProblemSchema>
