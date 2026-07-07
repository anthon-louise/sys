import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "../lib/api"

interface Assessment {
  assessmentId: number
  classroomId: number
  teacherId: number
  title: string
  description: string | null
  assessmentType: string
  academicTerm: string
  timeLimitMinutes: number | null
  createdAt: Date
  updatedAt: Date
}

interface AssessmentProblem {
  assessmentId: number
  problemId: number
  problemOrder: number
  title: string
  description: string
  language: string
  difficulty: string | null
  starterCode: string | null
}

export interface AssessmentWithProblems extends Assessment {
  problems: AssessmentProblem[]
}

export function useClassroomAssessments(classroomId: string | undefined) {
  return useQuery({
    queryKey: ["classroomAssessments", classroomId],
    queryFn: async (): Promise<Assessment[]> => {
      const res = await api.get(`/assessments/classrooms/${classroomId}/assessments`)
      return res.data.data
    },
    enabled: !!classroomId
  })
}

export function useAssessment(assessmentId: string | undefined) {
  return useQuery({
    queryKey: ["assessment", assessmentId],
    queryFn: async (): Promise<AssessmentWithProblems> => {
      const res = await api.get(`/assessments/${assessmentId}`)
      return res.data.data
    },
    enabled: !!assessmentId
  })
}

export function useCreateAssessment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { 
      classroomId: number, 
      title: string, 
      description?: string, 
      assessmentType: string, 
      academicTerm: string, 
      timeLimitMinutes?: number, 
      problemIds?: number[] 
    }) => {
      // First create the assessment
      const res = await api.post("/assessments", {
        classroomId: data.classroomId,
        title: data.title,
        description: data.description,
        assessmentType: data.assessmentType,
        academicTerm: data.academicTerm,
        timeLimitMinutes: data.timeLimitMinutes
      })
      const assessment = res.data.data
      
      // Then attach the selected problems
      if (data.problemIds && data.problemIds.length > 0) {
        for (const problemId of data.problemIds) {
          await api.post(`/assessments/${assessment.assessmentId}/problems`, { problemId })
        }
      }
      
      return assessment
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["classroomAssessments", variables.classroomId.toString()] })
    }
  })
}

export function useAttachProblemToAssessment(assessmentId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (problemId: number) => {
      await api.post(`/assessments/${assessmentId}/problems`, { problemId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment", assessmentId] })
    }
  })
}
