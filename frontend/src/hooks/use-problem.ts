import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "../lib/api"
import type { CreateProblemForm } from "../schemas/problem.schema"
import type { CreateTestCaseForm } from "../schemas/testcase.schema"

interface Problem {
  problemId: number
  teacherId: number
  title: string
  description: string
  language: string
  difficulty: string | null
  starterCode: string | null
  createdAt: Date
  isValidated: boolean
  workingSolutionId: number | null
  validatedAt: Date | null
  workingSolution?: string | null
  solutionLanguage?: string | null
}

interface TestCase {
  testCaseId: number
  problemId: number
  inputData: string
  expectedOutput: string
  isHidden: boolean
  orderIndex: number
}

interface ValidationResult {
  testCaseId: number
  passed: boolean
  actualOutput: string | null
  expectedOutput: string
  error: string | null
}

interface ValidateResponse {
  allPassed: boolean
  results: ValidationResult[]
}

export function useProblems() {
  return useQuery({
    queryKey: ["problems"],
    queryFn: async (): Promise<Problem[]> => {
      const res = await api.get("/problems")
      return res.data.data
    },
  })
}

export function useProblem(problemId: string | undefined) {
  return useQuery({
    queryKey: ["problem", problemId],
    queryFn: async (): Promise<Problem> => {
      const res = await api.get(`/problems/${problemId}`)
      return res.data.data
    },
    enabled: !!problemId,
  })
}

export function useCreateProblem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateProblemForm) => {
      const res = await api.post("/problems", data)
      return res.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["problems"] })
    },
  })
}

export function useTestCases(problemId: string | undefined) {
  return useQuery({
    queryKey: ["testCases", problemId],
    queryFn: async (): Promise<TestCase[]> => {
      const res = await api.get(`/problems/${problemId}/testcases`)
      return res.data.data
    },
    enabled: !!problemId,
  })
}

export function useCreateTestCases(problemId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateTestCaseForm[]) => {
      const res = await api.post(`/problems/${problemId}/testcases`, data)
      return res.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["testCases", problemId] })
    },
  })
}

export function useValidateProblem(problemId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ sourceCode, language }: { sourceCode: string; language: string }): Promise<ValidateResponse> => {
      const res = await api.post(`/problems/${problemId}/validate`, { sourceCode, language })
      return res.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["problem", problemId] })
      queryClient.invalidateQueries({ queryKey: ["problems"] })
    },
  })
}
