import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query"
import { api } from "../lib/api"
import type { CreateClassroomForm, JoinClassroomForm } from "../schemas/classroom.schema"

interface Classroom {
  classroomId: number
  teacherId: number
  classroomName: string
  joinCode: string
  schoolYear: string
  isActive: boolean
  createdAt: Date
}

interface ClassroomStudent {
  studentId: number
  studentName: string
  studentEmail: string
  enrolledAt: Date
}

export function useClassrooms() {
  return useQuery({
    queryKey: ["classrooms"],
    queryFn: async (): Promise<Classroom[]> => {
      const res = await api.get("/classrooms")
      return res.data.data
    },
  })
}

export function useClassroom(classroomId: string | undefined) {
  return useQuery({
    queryKey: ["classroom", classroomId],
    queryFn: async (): Promise<Classroom> => {
      const res = await api.get(`/classrooms/${classroomId}`)
      return res.data.data
    },
    enabled: !!classroomId,
  })
}

export function useClassroomStudents(classroomId: string | undefined) {
  return useQuery({
    queryKey: ["classroom-students", classroomId],
    queryFn: async (): Promise<ClassroomStudent[]> => {
      const res = await api.get(`/classrooms/${classroomId}/students`)
      return res.data.data
    },
    enabled: !!classroomId,
  })
}

export function useCreateClassroom() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateClassroomForm) => {
      const res = await api.post("/classrooms", data)
      return res.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classrooms"] })
    },
  })
}

export function useJoinClassroom() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: JoinClassroomForm) => {
      await api.post("/classrooms/join", data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classrooms"] })
    },
  })
}
