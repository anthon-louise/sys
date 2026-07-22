import { z } from "zod"

export const GRADING_PRESETS = [
  "Correctness Only",
  "Balanced",
  "Speed Challenge",
  "Structure + Tests",
  "Mixed",
  "Structure Focus"
] as const
export type GradingPresetType = typeof GRADING_PRESETS[number]

export const REQUIRED_CONSTRAINTS = [
  { key: "must_use_if",         label: "must_use_if" },
  { key: "must_use_else",       label: "must_use_else" },
  { key: "must_use_comparison", label: "must_use_comparison" },
  { key: "must_use_print",      label: "must_use_print" },
  { key: "must_use_input",      label: "must_use_input" },
  { key: "must_use_assignment", label: "must_use_assignment" },
] as const

export const FORBIDDEN_CONSTRAINTS = [
  { key: "no_if",    label: "no_if" },
  { key: "no_print", label: "no_print" },
  { key: "no_input", label: "no_input" },
] as const

// Mutual exclusion map: forbidden key -> required key it conflicts with (and vice versa)
export const FORBIDDEN_REQUIRED_CONFLICT: Record<string, string> = {
  no_if:    "must_use_if",
  no_print: "must_use_print",
  no_input: "must_use_input",
}

export const REQUIRED_FORBIDDEN_CONFLICT: Record<string, string> = {
  must_use_if:    "no_if",
  must_use_print: "no_print",
  must_use_input: "no_input",
}

const structuralConstraintsSchema = z.object({
  required: z.array(z.string()).default([]),
  forbidden: z.array(z.string()).default([]),
  weight: z.number().min(0).max(100).default(0)
}).optional().nullable()

export const createAssessmentSchema = z.object({
  classroomId: z.number().int(),
  title: z.string().min(1).max(100),
  description: z.string().optional(),
  assessmentType: z.enum(["Practice", "Quiz", "Exam"]),
  academicTerm: z.enum(["Midterm", "Finals"]),
  timeLimitMinutes: z.number().int().optional(),
  problemIds: z.array(z.number().int()).optional(),
  opensAt: z.string().optional().nullable(),
  closesAt: z.string().optional().nullable(),
  gradingPreset: z.enum(GRADING_PRESETS).default("Correctness Only"),
  structuralConstraints: structuralConstraintsSchema
})

export type CreateAssessmentForm = z.infer<typeof createAssessmentSchema>

export const updateAssessmentSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  assessmentType: z.enum(["Practice", "Quiz", "Exam"]).optional(),
  academicTerm: z.enum(["Midterm", "Finals"]).optional(),
  timeLimitMinutes: z.number().int().optional().nullable(),
  opensAt: z.string().optional().nullable(),
  closesAt: z.string().optional().nullable(),
  gradingPreset: z.enum(GRADING_PRESETS).optional(),
  structuralConstraints: structuralConstraintsSchema
})

export type UpdateAssessmentForm = z.infer<typeof updateAssessmentSchema>
