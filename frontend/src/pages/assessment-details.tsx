import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"
import { useAssessment, useAttachProblemToAssessment } from "../hooks/use-assessment"
import { useProblems } from "../hooks/use-problem"

export default function AssessmentDetails() {
  const { id } = useParams<{ id: string }>()
  const { data: assessment, isLoading: assessmentLoading } = useAssessment(id)
  const { data: problems, isLoading: problemsLoading } = useProblems()
  const attachProblemMutation = useAttachProblemToAssessment(id)
  const [isAddProblemModalOpen, setIsAddProblemModalOpen] = useState(false)

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", gap: "1rem", flexWrap: "wrap" }}>
        <h1>{assessment.title}</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link to={`/instructor/assessment/${id}/focus-logs`} style={{ textDecoration: "none" }}>
            <button>View Focus Loss Logs</button>
          </Link>
          <button 
            onClick={() => setIsAddProblemModalOpen(true)}
          >
            Add More Problems
          </button>
        </div>
      </div>
      <div style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "1.5rem", background: "white", marginBottom: "2rem" }}>
        <p><strong>Type:</strong> {assessment.assessmentType}</p>
        <p><strong>Academic Term:</strong> {assessment.academicTerm}</p>
        {assessment.timeLimitMinutes && <p><strong>Time Limit:</strong> {assessment.timeLimitMinutes} minutes</p>}
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
    </div>
  )
}
