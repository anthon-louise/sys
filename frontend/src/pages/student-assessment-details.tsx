import { Link, useParams, useNavigate } from "react-router-dom"
import { useStudentAssessment, useStudentSubmission } from "../hooks/use-assessment"
import { useAuth } from "../context/auth-context"

export default function StudentAssessmentDetails() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: assessment, isLoading } = useStudentAssessment(id)
  const { data: submission } = useStudentSubmission(id)

  if (isLoading) {
    return <div style={{ maxWidth: 800, margin: "2rem auto" }}><p>Loading assessment...</p></div>
  }

  if (!assessment) {
    return <div style={{ maxWidth: 800, margin: "2rem auto" }}><p>Assessment not found</p></div>
  }

  const startAssessment = () => {
    navigate(`/student/assessment/${id}/take`)
  }

  return (
    <div style={{ maxWidth: 800, margin: "2rem auto" }}>
      <Link 
        to={`/classroom/${assessment.classroomId}`} 
        style={{ display: "inline-block", marginBottom: "1rem" }}
      >
        ← Back to Classroom
      </Link>
      <div style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "1.5rem", background: "white", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ margin: "0 0 0.5rem 0" }}>{assessment.title}</h1>
            <p style={{ margin: "0 0 0.5rem 0", color: "#666" }}>Type: {assessment.assessmentType}</p>
            <p style={{ margin: "0 0 0.5rem 0", color: "#666" }}>Term: {assessment.academicTerm}</p>
            {assessment.timeLimitMinutes && (
              <p style={{ margin: 0, color: "#666" }}>Time Limit: {assessment.timeLimitMinutes} mins</p>
            )}
            {assessment.description && <p style={{ marginTop: "1rem" }}>{assessment.description}</p>}
          </div>
          {!submission ? (
            <button 
              onClick={startAssessment}
              style={{
                padding: "0.75rem 1.5rem",
                fontSize: "1rem",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer"
              }}
            >
              Start Assessment
            </button>
          ) : (
            <Link 
              to={`/student/assessment/${id}/results`}
              style={{
                padding: "0.75rem 1.5rem",
                fontSize: "1rem",
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                textDecoration: "none",
                display: "inline-block"
              }}
            >
              View Results
            </Link>
          )}
        </div>
      </div>

      {assessment.problems && assessment.problems.length > 0 ? (
        <div>
          <h2>Problems</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {assessment.problems.map((problem, index) => (
            <div key={problem.problemId} style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "1rem", background: "white" }}>
              <h3 style={{ margin: "0 0 0.5rem 0" }}>
                Problem {index + 1}: {problem.title}
              </h3>
              <p style={{ margin: "0 0 0.5rem 0", color: "#666" }}>
                Language: {problem.language} | Difficulty: {problem.difficulty || "N/A"}
              </p>
              <p style={{ margin: 0 }}>{problem.description}</p>
            </div>
          ))}
          </div>
        </div>
      ) : (
        <div><p>No problems in this assessment.</p></div>
      )}
    </div>
  )
}
