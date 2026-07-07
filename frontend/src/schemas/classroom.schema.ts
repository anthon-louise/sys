import { z } from "zod"

export const createClassroomSchema = z.object({
  classroomName: z.string().min(1).max(100),
  schoolYear: z.string().min(1).max(20),
})
export type CreateClassroomForm = z.infer<typeof createClassroomSchema>

export const joinClassroomSchema = z.object({
  joinCode: z.string().length(6, "Join code must be 6 characters"),
})
export type JoinClassroomForm = z.infer<typeof joinClassroomSchema>
