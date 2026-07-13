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

// Focus loss hooks
export function useReportFocusLoss(assessmentId: string | undefined) {
  return useMutation({
    mutationFn: async (data: { event_type: string, duration_seconds: number }) => {
      const res = await api.post(`/assessments/${assessmentId}/focus-loss`, data)
      return res.data.data
    }
  })
}

export function useFocusLossSummary(assessmentId: string | undefined) {
  return useQuery({
    queryKey: ["focusLossSummary", assessmentId],
    queryFn: async () => {
      const res = await api.get(`/assessments/${assessmentId}/focus-loss/summary`)
      return res.data.data
    },
    enabled: !!assessmentId
  })
}

export function useStudentFocusLog(assessmentId: string | undefined, studentId: number | undefined) {
  return useQuery({
    queryKey: ["studentFocusLog", assessmentId, studentId],
    queryFn: async () => {
      const res = await api.get(`/assessments/${assessmentId}/focus-loss/students/${studentId}`)
      return res.data.data
    },
    enabled: !!assessmentId && !!studentId
  })
}
