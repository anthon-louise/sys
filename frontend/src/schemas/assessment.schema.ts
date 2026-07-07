import { z } from "zod"

export const createAssessmentSchema = z.object({
  classroomId: z.number().int(),
  title: z.string().min(1).max(100),
  description: z.string().optional(),
  assessmentType: z.enum(["Practice", "Quiz", "Exam"]),
  academicTerm: z.enum(["Midterm", "Finals"]),
  timeLimitMinutes: z.number().int().optional(),
  problemIds: z.array(z.number().int()).optional()
})

export type CreateAssessmentForm = z.infer<typeof createAssessmentSchema>
