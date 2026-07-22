import { useState, useEffect } from "react"
import { Link, useParams, useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useClassroom, useClassroomStudents, useUpdateClassroom, useDeleteClassroom } from "../hooks/use-classroom"
import { useClassroomAssessments, useStudentClassroomAssessments, useCreateAssessment } from "../hooks/use-assessment"
import { useProblems } from "../hooks/use-problem"
import { useAuth } from "../context/auth-context"
import { createAssessmentSchema, type CreateAssessmentForm } from "../schemas/assessment.schema"
import { updateClassroomSchema, type UpdateClassroomForm } from "../schemas/classroom.schema"

export default function ClassroomPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: classroom, isLoading: classroomLoading } = useClassroom(id)
  const isInstructor = user?.roleName === "instructor"
  const { data: students } = useClassroomStudents(isInstructor ? id : undefined)
  const { data: instructorAssessments, isLoading: instructorAssessmentsLoading } = useClassroomAssessments(id)
  const { data: studentAssessments, isLoading: studentAssessmentsLoading } = useStudentClassroomAssessments(id)
  const { data: problems } = useProblems()
  const createAssessmentMutation = useCreateAssessment()
  const updateClassroomMutation = useUpdateClassroom(id)
  const deleteClassroomMutation = useDeleteClassroom()
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)

  const { 
    register: updateRegister, 
    handleSubmit: handleUpdateSubmit, 
    reset: resetUpdateForm,
    formState: { errors: updateErrors } 
  } = useForm<UpdateClassroomForm>({
    resolver: zodResolver(updateClassroomSchema),
    defaultValues: {
      classroomName: classroom?.classroomName || "",
      schoolYear: classroom?.schoolYear || "",
      isActive: classroom?.isActive ?? true
    }
  })

  // Reset update form when classroom data loads
  useEffect(() => {
    if (classroom) {
      resetUpdateForm({
        classroomName: classroom.classroomName,
        schoolYear: classroom.schoolYear,
        isActive: classroom.isActive
      })
    }
  }, [classroom, resetUpdateForm])

  const onUpdateSubmit = async (data: UpdateClassroomForm) => {
    try {
      await updateClassroomMutation.mutateAsync(data)
      toast.success("Classroom updated successfully!")
      setIsUpdateModalOpen(false)
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update classroom")
    }
  }

  const onDelete = async () => {
    if (!id) return
    try {
      await deleteClassroomMutation.mutateAsync(id)
      toast.success("Classroom deleted successfully!")
      navigate(isInstructor ? "/instructor/dashboard" : "/student/dashboard")
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete classroom")
    }
  }

  const assessments = isInstructor ? instructorAssessments : studentAssessments
  const assessmentsLoading = isInstructor ? instructorAssessmentsLoading : studentAssessmentsLoading

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<CreateAssessmentForm>({
    resolver: zodResolver(createAssessmentSchema),
    defaultValues: {
      classroomId: id ? parseInt(id) : 0,
      problemIds: [],
      opensAt: null,
      closesAt: null,
      gradingPreset: "Correctness Only"
    }
  })

  // Helper to convert datetime-local string (Philippine time, UTC+8) to ISO string with +08:00 offset
  const toISOString = (dateTimeLocal: string | null | undefined): string | null => {
    if (!dateTimeLocal) return null
    // dateTimeLocal is like "2026-07-18T10:00" — already in PHT (UTC+8)
    // Append seconds + PHT offset so the backend receives the correct time
    if (isNaN(new Date(dateTimeLocal).getTime())) return null
    return `${dateTimeLocal}:00+08:00`
  }

  const onSubmit = async (data: CreateAssessmentForm) => {
    try {
      const processedData = {
        ...data,
        opensAt: toISOString(data.opensAt),
        closesAt: toISOString(data.closesAt)
      }
      await createAssessmentMutation.mutateAsync(processedData)
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
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={() => setIsUpdateModalOpen(true)}>Edit Classroom</button>
            <button onClick={() => setIsDeleteConfirmOpen(true)} style={{ backgroundColor: "#dc3545", color: "white" }}>Delete Classroom</button>
            <button onClick={() => setIsCreateModalOpen(true)}>Create Assessment</button>
          </div>
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
                to={isInstructor ? `/instructor/assessment/${assessment.assessmentId}` : `/student/assessment/${assessment.assessmentId}`}
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                    <h3 style={{ margin: "0 0 0.5rem 0" }}>{assessment.title}</h3>
                    {isInstructor && (
                      <span
                        style={{
                          padding: "0.125rem 0.5rem",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          fontWeight: "bold",
                          backgroundColor: assessment.isPublished ? "#d4edda" : "#fff3cd",
                          color: assessment.isPublished ? "#155724" : "#856404",
                          flexShrink: 0
                        }}
                      >
                        {assessment.isPublished ? "✓" : "⏸"}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: "0 0 0.5rem 0", color: "#666" }}>Type: {assessment.assessmentType}</p>
                  <p style={{ margin: "0 0 0.5rem 0", color: "#666" }}>Term: {assessment.academicTerm}</p>
                  {Boolean(assessment.timeLimitMinutes && assessment.timeLimitMinutes > 0) && (
                    <p style={{ margin: 0, color: "#666" }}>Time Limit: {assessment.timeLimitMinutes} mins</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: "2rem" }}><p>No assessments yet.</p></div>
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
                <label style={{ display: "block", marginBottom: "0.25rem" }}>Opens At (optional)</label>
                <input {...register("opensAt")} type="datetime-local" style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }} />
                {errors.opensAt && <p style={{ color: "red", margin: "0.25rem 0 0 0" }}>{errors.opensAt.message}</p>}
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.25rem" }}>Closes At (optional)</label>
                <input {...register("closesAt")} type="datetime-local" style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }} />
                {errors.closesAt && <p style={{ color: "red", margin: "0.25rem 0 0 0" }}>{errors.closesAt.message}</p>}
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.25rem" }}>Grading Preset</label>
                <select {...register("gradingPreset")} style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }}>
                  <option value="Correctness Only">Correctness Only — Test 100%, Time 0%</option>
                  <option value="Balanced">Balanced — Test 75%, Time Bonus 25%</option>
                  <option value="Speed Challenge">Speed Challenge — Test 50%, Time Bonus 50%</option>
                </select>
                <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.78rem", color: "#666" }}>
                  💡 Note: Time bonus requires a time limit or closing deadline. If neither is set, test cases are automatically weighted at 100%.
                </p>
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

      {/* Update Classroom Modal */}
      {isUpdateModalOpen && (
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
            minWidth: 500,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2>Edit Classroom</h2>
              <button onClick={() => setIsUpdateModalOpen(false)} style={{ border: "none", background: "none", fontSize: "1.5rem", cursor: "pointer" }}>×</button>
            </div>
            <form onSubmit={handleUpdateSubmit(onUpdateSubmit)}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.25rem" }}>Classroom Name</label>
                <input {...updateRegister("classroomName")} style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }} />
                {updateErrors.classroomName && <p style={{ color: "red", margin: "0.25rem 0 0 0" }}>{updateErrors.classroomName.message}</p>}
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.25rem" }}>School Year</label>
                <input {...updateRegister("schoolYear")} style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }} />
                {updateErrors.schoolYear && <p style={{ color: "red", margin: "0.25rem 0 0 0" }}>{updateErrors.schoolYear.message}</p>}
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input 
                    type="checkbox" 
                    {...updateRegister("isActive")} 
                    id="isActive" 
                  />
                  <label htmlFor="isActive">Active</label>
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setIsUpdateModalOpen(false)}>Cancel</button>
                <button type="submit" disabled={updateClassroomMutation.isPending}>
                  {updateClassroomMutation.isPending ? "Updating..." : "Update"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {isDeleteConfirmOpen && (
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
            minWidth: 400,
          }}>
            <h2 style={{ marginBottom: "1rem" }}>Delete Classroom?</h2>
            <p style={{ marginBottom: "1.5rem" }}>Are you sure you want to delete this classroom? This action cannot be undone and all associated data (assessments, submissions, etc.) will be lost.</p>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setIsDeleteConfirmOpen(false)}>Cancel</button>
              <button 
                onClick={onDelete} 
                style={{ backgroundColor: "#dc3545", color: "white" }} 
                disabled={deleteClassroomMutation.isPending}
              >
                {deleteClassroomMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
