import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "sonner"

import { queryClient } from "./lib/query-client"
import { AuthProvider } from "./context/auth-context"
import ProtectedRoute from "./components/protected-route"

import LoginPage from "./pages/login-page"
import RegisterPage from "./pages/register-page"
import HeroPage from "./pages/hero-page"
import StudentDashboard from "./pages/student-dashboard"
import InstructorDashboard from "./pages/instructor-dashboard"
import ClassroomPage from "./pages/classroom-page"
import ClassroomStudentsPage from "./pages/classroom-students-page"
import ProblemBank from "./pages/problem-bank"
import ProblemDetails from "./pages/problem-details"
import CreateTestCases from "./pages/create-test-cases"
import VerifyProblem from "./pages/verify-problem"
import AssessmentDetails from "./pages/assessment-details"
import StudentAssessmentDetails from "./pages/student-assessment-details"
import StudentAssessmentTake from "./pages/student-assessment-take"
import StudentAssessmentResults from "./pages/student-assessment-results"

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Toaster />
          <Routes>
            <Route path="/" element={<HeroPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/student/dashboard"
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/instructor/dashboard"
              element={
                <ProtectedRoute allowedRoles={["instructor"]}>
                  <InstructorDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/instructor/problem-bank"
              element={
                <ProtectedRoute allowedRoles={["instructor"]}>
                  <ProblemBank />
                </ProtectedRoute>
              }
            />
            <Route
              path="/instructor/problem/:id"
              element={
                <ProtectedRoute allowedRoles={["instructor"]}>
                  <ProblemDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/instructor/problem/:id/verify"
              element={
                <ProtectedRoute allowedRoles={["instructor"]}>
                  <VerifyProblem />
                </ProtectedRoute>
              }
            />
            <Route
              path="/instructor/problem/:id/testcases"
              element={
                <ProtectedRoute allowedRoles={["instructor"]}>
                  <CreateTestCases />
                </ProtectedRoute>
              }
            />
            <Route
              path="/instructor/assessment/:id"
              element={
                <ProtectedRoute allowedRoles={["instructor"]}>
                  <AssessmentDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/assessment/:id"
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentAssessmentDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/assessment/:id/take"
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentAssessmentTake />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/assessment/:id/results"
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentAssessmentResults />
                </ProtectedRoute>
              }
            />
            <Route
              path="/classroom/:id"
              element={
                <ProtectedRoute allowedRoles={["instructor", "student"]}>
                  <ClassroomPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/classroom/:id/students"
              element={
                <ProtectedRoute allowedRoles={["instructor"]}>
                  <ClassroomStudentsPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}