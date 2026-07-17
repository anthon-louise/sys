import { z } from "zod"

export const createAssessmentSchema = z.object({
  classroomId: z.number().int(),
  title: z.string().min(1).max(100),
  description: z.string().optional(),
  assessmentType: z.enum(["Practice", "Quiz", "Exam"]),
  academicTerm: z.enum(["Midterm", "Finals"]),
  timeLimitMinutes: z.number().int().optional(),
  problemIds: z.array(z.number().int()).optional(),
  opensAt: z.string().optional().nullable(),
  closesAt: z.string().optional().nullable()
})

export type CreateAssessmentForm = z.infer<typeof createAssessmentSchema>

export const updateAssessmentSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  assessmentType: z.enum(["Practice", "Quiz", "Exam"]).optional(),
  academicTerm: z.enum(["Midterm", "Finals"]).optional(),
  timeLimitMinutes: z.number().int().optional().nullable(),
  opensAt: z.string().optional().nullable(),
  closesAt: z.string().optional().nullable()
})

export type UpdateAssessmentForm = z.infer<typeof updateAssessmentSchema>
