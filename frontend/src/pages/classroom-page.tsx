import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useClassroom, useClassroomStudents } from "../hooks/use-classroom"
import { useClassroomAssessments, useCreateAssessment } from "../hooks/use-assessment"
import { useProblems } from "../hooks/use-problem"
import { useAuth } from "../context/auth-context"
import { createAssessmentSchema, type CreateAssessmentForm } from "../schemas/assessment.schema"

export default function ClassroomPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { data: classroom, isLoading: classroomLoading } = useClassroom(id)
  const { data: students } = useClassroomStudents(id)
  const { data: assessments, isLoading: assessmentsLoading } = useClassroomAssessments(id)
  const { data: problems } = useProblems()
  const createAssessmentMutation = useCreateAssessment()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const isInstructor = user?.roleName === "instructor"

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<CreateAssessmentForm>({
    resolver: zodResolver(createAssessmentSchema),
    defaultValues: {
      classroomId: id ? parseInt(id) : 0,
      problemIds: []
    }
  })

  const onSubmit = async (data: CreateAssessmentForm) => {
    try {
      await createAssessmentMutation.mutateAsync(data)
      toast.success("Assessment created successfully!")
      setIsCreateModalOpen(false)
      reset()
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create assessment")
    }
  }

  if (classroomLoading) {
    return <div style={{ maxWidth: 800, margin: "2rem auto" }}><p>Loading classroom...</p></div>
  }

  if (!classroom) {
    return <div style={{ maxWidth: 800, margin: "2rem auto" }}><p>Classroom not found</p></div>
  }

  const validatedProblems = problems?.filter(p => p.isValidated) || []
  const selectedProblemIds = watch("problemIds") || []

  return (
    <div style={{ maxWidth: 800, margin: "2rem auto" }}>
      <Link 
        to={isInstructor ? "/instructor/dashboard" : "/student/dashboard"} 
        style={{ display: "inline-block", marginBottom: "1rem" }}
      >
        ← Back to Dashboard
      </Link>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1>{classroom.classroomName}</h1>
        {isInstructor && (
          <button onClick={() => setIsCreateModalOpen(true)}>Create Assessment</button>
        )}
      </div>
      <div style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "1.5rem", background: "white" }}>
        <p><strong>School Year:</strong> {classroom.schoolYear}</p>
        {isInstructor && <p><strong>Join Code:</strong> {classroom.joinCode}</p>}
        <p><strong>Active:</strong> {classroom.isActive ? "Yes" : "No"}</p>
        <p><strong>Created At:</strong> {new Date(classroom.createdAt).toLocaleDateString()}</p>
        {isInstructor && (
          <p style={{ marginTop: "1rem" }}><strong>Students Enrolled:</strong> {students?.length || 0}</p>
        )}
      </div>

      {isInstructor && (
        <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.5rem" }}>
          <Link to={`/classroom/${id}/students`} style={{ textDecoration: "none" }}>
            <button>Students Enrolled</button>
          </Link>
        </div>
      )}

      {assessmentsLoading ? (
        <div style={{ marginTop: "2rem" }}><p>Loading assessments...</p></div>
      ) : assessments && assessments.length > 0 ? (
        <div style={{ marginTop: "2rem" }}>
          <h2>Assessments</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "1rem" }}>
            {assessments.map(assessment => (
              <Link
                key={assessment.assessmentId}
                to={`/instructor/assessment/${assessment.assessmentId}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div
                  style={{
                    border: "1px solid #ccc",
                    borderRadius: "8px",
                    padding: "1rem",
                    background: "white",
                    cursor: "pointer",
                    transition: "box-shadow 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "none"
                  }}
                >
                  <h3 style={{ margin: "0 0 0.5rem 0" }}>{assessment.title}</h3>
                  <p style={{ margin: "0 0 0.5rem 0", color: "#666" }}>Type: {assessment.assessmentType}</p>
                  <p style={{ margin: "0 0 0.5rem 0", color: "#666" }}>Term: {assessment.academicTerm}</p>
                  {assessment.timeLimitMinutes && (
                    <p style={{ margin: 0, color: "#666" }}>Time Limit: {assessment.timeLimitMinutes} mins</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        isInstructor && <div style={{ marginTop: "2rem" }}><p>No assessments yet.</p></div>
      )}

      {isCreateModalOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000,
        }}>
          <div style={{
            background: "white",
            padding: "2rem",
            borderRadius: "8px",
            minWidth: 600,
            maxHeight: "90vh",
            overflowY: "auto",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2>Create Assessment</h2>
              <button onClick={() => setIsCreateModalOpen(false)} style={{ border: "none", background: "none", fontSize: "1.5rem", cursor: "pointer" }}>×</button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.25rem" }}>Title</label>
                <input {...register("title")} style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }} />
                {errors.title && <p style={{ color: "red", margin: "0.25rem 0 0 0" }}>{errors.title.message}</p>}
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.25rem" }}>Type</label>
                <select {...register("assessmentType")} style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }}>
                  <option value="Practice">Practice</option>
                  <option value="Quiz">Quiz</option>
                  <option value="Exam">Exam</option>
                </select>
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.25rem" }}>Academic Term</label>
                <select {...register("academicTerm")} style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }}>
                  <option value="Midterm">Midterm</option>
                  <option value="Finals">Finals</option>
                </select>
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.25rem" }}>Time Limit (minutes, optional)</label>
                <input {...register("timeLimitMinutes", { valueAsNumber: true })} type="number" style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }} />
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.25rem" }}>Description (optional)</label>
                <textarea {...register("description")} style={{ width: "100%", padding: "0.5rem", minHeight: "100px", boxSizing: "border-box" }} />
              </div>
              {validatedProblems.length > 0 && (
                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ display: "block", marginBottom: "0.25rem" }}>Problems (validated only)</label>
                  {validatedProblems.map(problem => (
                    <div key={problem.problemId} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <input
                        type="checkbox"
                        checked={selectedProblemIds.includes(problem.problemId)}
                        onChange={(e) => {
                          const checked = e.target.checked
                          if (checked) {
                            setValue("problemIds", [...selectedProblemIds, problem.problemId])
                          } else {
                            setValue("problemIds", selectedProblemIds.filter(id => id !== problem.problemId))
                          }
                        }}
                      />
                      <label>{problem.title} ({problem.language})</label>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setIsCreateModalOpen(false)}>Cancel</button>
                <button type="submit" disabled={createAssessmentMutation.isPending}>
                  {createAssessmentMutation.isPending ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
