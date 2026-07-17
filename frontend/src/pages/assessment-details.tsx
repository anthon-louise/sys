import { useState, useEffect } from "react"
import { Link, useParams, useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useAssessment, useAttachProblemToAssessment, useUpdateAssessment, useDeleteAssessment, usePublishAssessment } from "../hooks/use-assessment"
import { useProblems } from "../hooks/use-problem"
import { updateAssessmentSchema, type UpdateAssessmentForm } from "../schemas/assessment.schema"

export default function AssessmentDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: assessment, isLoading: assessmentLoading } = useAssessment(id)
  const { data: problems, isLoading: problemsLoading } = useProblems()
  const attachProblemMutation = useAttachProblemToAssessment(id)
  const updateAssessmentMutation = useUpdateAssessment(id)
  const deleteAssessmentMutation = useDeleteAssessment()
  const publishAssessmentMutation = usePublishAssessment(id)

  const handlePublish = async () => {
    try {
      await publishAssessmentMutation.mutateAsync()
      toast.success("Assessment published successfully!")
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to publish assessment")
    }
  }
  const [isAddProblemModalOpen, setIsAddProblemModalOpen] = useState(false)
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)

  // Helper to convert Date/ISO string (UTC from backend) to local datetime-local string (YYYY-MM-DDTHH:mm)
  const formatDateTimeLocal = (date: Date | string | null | undefined): string | null => {
    if (!date) return null
    const d = new Date(date)
    // Check if date is valid
    if (isNaN(d.getTime())) return null
    
    // Get local date and time components
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  const {
    register: updateRegister,
    handleSubmit: handleUpdateSubmit,
    reset: resetUpdateForm,
    formState: { errors: updateErrors }
  } = useForm<UpdateAssessmentForm>({
    resolver: zodResolver(updateAssessmentSchema),
    defaultValues: {
      title: assessment?.title || "",
      description: assessment?.description || "",
      assessmentType: assessment?.assessmentType || "Practice",
      academicTerm: assessment?.academicTerm || "Midterm",
      timeLimitMinutes: assessment?.timeLimitMinutes,
      opensAt: formatDateTimeLocal(assessment?.opensAt),
      closesAt: formatDateTimeLocal(assessment?.closesAt)
    }
  })

  // Reset update form when assessment data loads
  useEffect(() => {
    if (assessment) {
      resetUpdateForm({
        title: assessment.title,
        description: assessment.description || "",
        assessmentType: assessment.assessmentType,
        academicTerm: assessment.academicTerm,
        timeLimitMinutes: assessment.timeLimitMinutes,
        opensAt: formatDateTimeLocal(assessment.opensAt),
        closesAt: formatDateTimeLocal(assessment.closesAt)
      })
    }
  }, [assessment, resetUpdateForm])

  // Helper to convert datetime-local string (local time) to ISO string (UTC)
  const toISOString = (dateTimeLocal: string | null | undefined): string | null => {
    if (!dateTimeLocal) return null
    // Create a Date object from the local datetime string
    const date = new Date(dateTimeLocal)
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return null
    }
    // Return ISO string
    return date.toISOString()
  }

  const handleUpdate = async (data: UpdateAssessmentForm) => {
    try {
      // Convert datetime-local strings to ISO for backend
      const processedData = {
        ...data,
        opensAt: toISOString(data.opensAt),
        closesAt: toISOString(data.closesAt)
      }
      await updateAssessmentMutation.mutateAsync(processedData)
      toast.success("Assessment updated successfully!")
      setIsUpdateModalOpen(false)
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update assessment")
    }
  }

  const handleDelete = async () => {
    if (!id || !assessment) return
    try {
      await deleteAssessmentMutation.mutateAsync(id)
      toast.success("Assessment deleted successfully!")
      navigate(`/classroom/${assessment.classroomId}`)
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete assessment")
    }
  }

  console.log("Problems:", problems)
  console.log("Problems loading:", problemsLoading)
  console.log("Assessment:", assessment)

  if (assessmentLoading || problemsLoading) {
    return <div style={{ maxWidth: 800, margin: "2rem auto" }}><p>Loading...</p></div>
  }

  if (!assessment) {
    return <div style={{ maxWidth: 800, margin: "2rem auto" }}><p>Assessment not found</p></div>
  }

  const attachedProblemIds = assessment.problems.map(p => p.problemId)
  const availableProblems = (problems?.filter(p => p.isValidated && !attachedProblemIds.includes(p.problemId)) || [])

  console.log("Attached problem ids:", attachedProblemIds)
  console.log("Available problems:", availableProblems)

  const handleAttachProblem = async (problemId: number) => {
    try {
      await attachProblemMutation.mutateAsync(problemId)
      toast.success("Problem attached successfully!")
      setIsAddProblemModalOpen(false)
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to attach problem")
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: "2rem auto" }}>
      <Link to={`/classroom/${assessment.classroomId}`} style={{ display: "inline-block", marginBottom: "1rem" }}>
        ← Back to Classroom
      </Link>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <h1 style={{ margin: 0 }}>{assessment.title}</h1>
          <span
            style={{
              padding: "0.25rem 0.75rem",
              borderRadius: "4px",
              fontSize: "0.875rem",
              fontWeight: "bold",
              backgroundColor: assessment.isPublished ? "#d4edda" : "#fff3cd",
              color: assessment.isPublished ? "#155724" : "#856404",
            }}
          >
            {assessment.isPublished ? "✓ Published" : "⏸ Draft"}
          </span>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {!assessment.isPublished && (
            <button
              onClick={handlePublish}
              disabled={publishAssessmentMutation.isPending}
              style={{ backgroundColor: "#28a745", color: "white" }}
            >
              {publishAssessmentMutation.isPending ? "Publishing..." : "Publish Assessment"}
            </button>
          )}
          <button onClick={() => setIsUpdateModalOpen(true)} disabled={assessment.isPublished}>
            Edit Assessment
          </button>
          <button onClick={() => setIsDeleteConfirmOpen(true)} style={{ backgroundColor: "#dc3545", color: "white" }} disabled={assessment.isPublished}>
            Delete Assessment
          </button>
          <button
            onClick={() => setIsAddProblemModalOpen(true)}
            disabled={assessment.isPublished}
          >
            Add More Problems
          </button>
        </div>
      </div>
      <div style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "1.5rem", background: "white", marginBottom: "2rem" }}>
        <p><strong>Status:</strong> {assessment.isPublished ? "Published" : "Draft"}</p>
        <p><strong>Type:</strong> {assessment.assessmentType}</p>
        <p><strong>Academic Term:</strong> {assessment.academicTerm}</p>
        {assessment.timeLimitMinutes && <p><strong>Time Limit:</strong> {assessment.timeLimitMinutes} minutes</p>}
        {assessment.opensAt && <p><strong>Opens At:</strong> {new Date(assessment.opensAt).toLocaleString()}</p>}
        {assessment.closesAt && <p><strong>Closes At:</strong> {new Date(assessment.closesAt).toLocaleString()}</p>}
        {assessment.description && (
          <div style={{ marginTop: "1rem" }}>
            <h3>Description</h3>
            <p>{assessment.description}</p>
          </div>
        )}
      </div>

      {assessment.problems.length > 0 ? (
        <div>
          <h2>Problems</h2>
          <div style={{ display: "grid", gap: "1rem" }}>
            {assessment.problems.map(problem => (
              <div
                key={problem.problemId}
                style={{
                  border: "1px solid #ccc",
                  borderRadius: "8px",
                  padding: "1rem",
                  background: "white"
                }}
              >
                <h3 style={{ margin: "0 0 0.5rem 0" }}>
                  {problem.problemOrder + 1}. {problem.title}
                </h3>
                <p style={{ margin: "0 0 0.5rem 0", color: "#666" }}>
                  Language: {problem.language}
                </p>
                {problem.difficulty && (
                  <p style={{ margin: "0 0 0.5rem 0", color: "#666" }}>
                    Difficulty: {problem.difficulty}
                  </p>
                )}
                {problem.description && (
                  <p style={{ margin: "0.5rem 0 0 0", color: "#444" }}>
                    {problem.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p>No problems attached yet. {availableProblems.length > 0 && "Click 'Add More Problems' to get started!"}</p>
      )}

      {isAddProblemModalOpen && (
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
            maxHeight: "90vh",
            overflowY: "auto",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2>Add More Problems</h2>
              <button onClick={() => setIsAddProblemModalOpen(false)} style={{ border: "none", background: "none", fontSize: "1.5rem", cursor: "pointer" }}>×</button>
            </div>
            {availableProblems.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {availableProblems.map(problem => (
                  <div
                    key={problem.problemId}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      border: "1px solid #eee",
                      borderRadius: "4px",
                      padding: "0.75rem"
                    }}
                  >
                    <div>
                      <strong>{problem.title}</strong>
                      <p style={{ margin: 0, color: "#666", fontSize: "0.875rem" }}>{problem.language}</p>
                    </div>
                    <button
                      onClick={() => handleAttachProblem(problem.problemId)}
                      disabled={attachProblemMutation.isPending}
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p>No validated problems available to attach.</p>
            )}
          </div>
        </div>
      )}

      {/* Update Modal */}
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
              <h2>Edit Assessment</h2>
              <button onClick={() => setIsUpdateModalOpen(false)} style={{ border: "none", background: "none", fontSize: "1.5rem", cursor: "pointer" }}>×</button>
            </div>
            <form onSubmit={handleUpdateSubmit(handleUpdate)}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.25rem" }}>Title</label>
                <input 
                  {...updateRegister("title")} 
                  style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }} 
                />
                {updateErrors.title && <p style={{ color: "red", margin: "0.25rem 0 0 0" }}>{updateErrors.title.message}</p>}
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.25rem" }}>Description</label>
                <textarea 
                  {...updateRegister("description")} 
                  rows={3}
                  style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }} 
                />
                {updateErrors.description && <p style={{ color: "red", margin: "0.25rem 0 0 0" }}>{updateErrors.description.message}</p>}
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.25rem" }}>Assessment Type</label>
                <select 
                  {...updateRegister("assessmentType")} 
                  style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }} 
                >
                  <option value="Practice">Practice</option>
                  <option value="Quiz">Quiz</option>
                  <option value="Exam">Exam</option>
                </select>
                {updateErrors.assessmentType && <p style={{ color: "red", margin: "0.25rem 0 0 0" }}>{updateErrors.assessmentType.message}</p>}
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.25rem" }}>Academic Term</label>
                <select 
                  {...updateRegister("academicTerm")} 
                  style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }} 
                >
                  <option value="Midterm">Midterm</option>
                  <option value="Finals">Finals</option>
                </select>
                {updateErrors.academicTerm && <p style={{ color: "red", margin: "0.25rem 0 0 0" }}>{updateErrors.academicTerm.message}</p>}
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.25rem" }}>Time Limit (minutes, optional)</label>
                <input 
                  type="number" 
                  {...updateRegister("timeLimitMinutes", { valueAsNumber: true })} 
                  style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }} 
                />
                {updateErrors.timeLimitMinutes && <p style={{ color: "red", margin: "0.25rem 0 0 0" }}>{updateErrors.timeLimitMinutes.message}</p>}
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.25rem" }}>Opens At (optional)</label>
                <input 
                  type="datetime-local" 
                  {...updateRegister("opensAt")} 
                  style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }} 
                />
                {updateErrors.opensAt && <p style={{ color: "red", margin: "0.25rem 0 0 0" }}>{updateErrors.opensAt.message}</p>}
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.25rem" }}>Closes At (optional)</label>
                <input 
                  type="datetime-local" 
                  {...updateRegister("closesAt")} 
                  style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }} 
                />
                {updateErrors.closesAt && <p style={{ color: "red", margin: "0.25rem 0 0 0" }}>{updateErrors.closesAt.message}</p>}
              </div>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setIsUpdateModalOpen(false)}>Cancel</button>
                <button type="submit" disabled={updateAssessmentMutation.isPending}>
                  {updateAssessmentMutation.isPending ? "Updating..." : "Update"}
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
            <h2 style={{ marginBottom: "1rem" }}>Delete Assessment?</h2>
            <p style={{ marginBottom: "1.5rem" }}>Are you sure you want to delete this assessment? This action cannot be undone and all related data will be permanently removed.</p>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setIsDeleteConfirmOpen(false)}>Cancel</button>
              <button 
                onClick={handleDelete} 
                style={{ backgroundColor: "#dc3545", color: "white" }}
                disabled={deleteAssessmentMutation.isPending}
              >
                {deleteAssessmentMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
