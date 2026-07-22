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
  isPublished: boolean
  opensAt: Date | null
  closesAt: Date | null
  gradingPreset: string
  structuralConstraints: {
    required: string[]
    forbidden: string[]
    weight: number
  } | null
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

export function useStudentClassroomAssessments(classroomId: string | undefined) {
  return useQuery({
    queryKey: ["studentClassroomAssessments", classroomId],
    queryFn: async (): Promise<Assessment[]> => {
      const res = await api.get(`/assessments/student/classrooms/${classroomId}/assessments`)
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

export function useStudentAssessment(assessmentId: string | undefined) {
  return useQuery({
    queryKey: ["studentAssessment", assessmentId],
    queryFn: async (): Promise<AssessmentWithProblems> => {
      const res = await api.get(`/assessments/student/assessments/${assessmentId}`)
      return res.data.data
    },
    enabled: !!assessmentId,
    refetchInterval: 30_000, // poll every 30s so publish/unpublish reflects in real time
    retry: false            // don't retry on 404 (assessment gated/closed)
  })
}

export function useStudentAssessmentStatus(assessmentId: string | undefined) {
  return useQuery({
    queryKey: ["studentAssessmentStatus", assessmentId],
    queryFn: async (): Promise<{
      assessmentId: number
      title: string
      isPublished: boolean
      opensAt: string | null
      closesAt: string | null
    }> => {
      const res = await api.get(`/assessments/student/assessments/${assessmentId}/status`)
      return res.data.data
    },
    enabled: !!assessmentId,
    refetchInterval: 30_000 // poll every 30s for real-time publish changes
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
      problemIds?: number[],
      opensAt?: string | null,
      closesAt?: string | null,
      gradingPreset?: string,
      structuralConstraints?: { required: string[], forbidden: string[], weight: number } | null
    }) => {
      // First create the assessment
      const res = await api.post("/assessments", {
        classroomId: data.classroomId,
        title: data.title,
        description: data.description,
        assessmentType: data.assessmentType,
        academicTerm: data.academicTerm,
        timeLimitMinutes: data.timeLimitMinutes,
        opensAt: data.opensAt,
        closesAt: data.closesAt,
        gradingPreset: data.gradingPreset,
        structuralConstraints: data.structuralConstraints
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

export function useUpdateAssessment(assessmentId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      title?: string
      description?: string
      assessmentType?: string
      academicTerm?: string
      timeLimitMinutes?: number | null,
      opensAt?: string | null,
      closesAt?: string | null,
      gradingPreset?: string,
      structuralConstraints?: { required: string[], forbidden: string[], weight: number } | null
    }) => {
      const res = await api.put(`/assessments/${assessmentId}`, data)
      return res.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment", assessmentId] })
    }
  })
}

export function useDeleteAssessment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (assessmentId: string) => {
      await api.delete(`/assessments/${assessmentId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classroomAssessments"] })
    }
  })
}

export function usePublishAssessment(assessmentId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const res = await api.put(`/assessments/${assessmentId}/publish`)
      return res.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment", assessmentId] })
      queryClient.invalidateQueries({ queryKey: ["classroomAssessments"] })
    }
  })
}

export function useTestCode() {
  return useMutation({
    mutationFn: async (data: { problemId: number, sourceCode: string, language: string }) => {
      const res = await api.post("/assessments/student/test", data)
      return res.data.data
    }
  })
}

export function useSubmitAssessment(assessmentId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (problemSolutions: { problemId: number, sourceCode: string }[]) => {
      const res = await api.post(`/assessments/student/assessments/${assessmentId}/submit`, { problemSolutions })
      return res.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studentAssessment", assessmentId] })
      queryClient.invalidateQueries({ queryKey: ["studentSubmission", assessmentId] })
    }
  })
}

export function useStudentSubmission(assessmentId: string | undefined) {
  return useQuery({
    queryKey: ["studentSubmission", assessmentId],
    queryFn: async () => {
      const res = await api.get(`/assessments/student/assessments/${assessmentId}/submission`)
      return res.data.data
    },
    enabled: !!assessmentId
  })
}

export function useProblemTestCases(problemId: number | undefined) {
  return useQuery({
    queryKey: ["problemTestCases", problemId],
    queryFn: async () => {
      const res = await api.get(`/assessments/student/problems/${problemId}/test-cases`)
      return res.data.data
    },
    enabled: !!problemId
  })
}

export function useStartSession(assessmentId: string | undefined) {
  return useMutation({
    mutationFn: async () => {
      const res = await api.post(`/assessments/student/assessments/${assessmentId}/start-session`)
      return res.data.data
    }
  })
}

export function useAssessmentSession(assessmentId: string | undefined) {
  return useQuery({
    queryKey: ["assessmentSession", assessmentId],
    queryFn: async () => {
      const res = await api.get(`/assessments/student/assessments/${assessmentId}/session`)
      return res.data.data
    },
    enabled: !!assessmentId
  })
}
