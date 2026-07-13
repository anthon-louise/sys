import { Link, useParams, useNavigate } from "react-router-dom"
import { useEffect } from "react"
import { useStudentAssessment, useStudentSubmission } from "../hooks/use-assessment"

export default function StudentAssessmentResults() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: assessment } = useStudentAssessment(id)
  const { data: submission, isLoading } = useStudentSubmission(id)

  useEffect(() => {
    if (!isLoading && !submission) {
      navigate(`/student/assessment/${id}`)
    }
  }, [submission, isLoading, id, navigate])

  if (isLoading) {
    return <div style={{ maxWidth: "1000px", margin: "2rem auto", padding: "0 1rem" }}><p>Loading results...</p></div>
  }
  if (!submission) {
    return null
  }

  return (
    <div style={{ maxWidth: "1000px", margin: "2rem auto", padding: "0 1rem" }}>
      <Link 
        to={assessment ? `/classroom/${assessment.classroomId}` : "/student/dashboard"}
        style={{ display: "inline-block", marginBottom: "1rem" }}
      >
        ← Back
      </Link>
      <div style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "1.5rem", background: "#fff", marginBottom: "2rem" }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ margin: "0 0 0.5rem 0" }}>Assessment Complete!</h1>
          <p style={{ margin: 0, fontSize: "3rem", fontWeight: "bold", color: Number(submission?.overallScore) >= 80 ? "#28a745" : Number(submission?.overallScore) >= 50 ? "#ffc107" : "#dc3545" }}>
            {Number(submission?.overallScore || 0).toFixed(0)}%
          </p>
        </div>
      </div>

      {assessment?.problems?.map((problem, idx) => {
        const sub = submission?.submissions?.find((s: any) => s.problemId === problem.problemId)
        return (
          <div 
            key={problem.problemId} 
            style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "1.5rem", background: "#fff", marginBottom: "1rem" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h3 style={{ margin: "0 0 0.5rem 0" }}>Problem {idx + 1}: {problem.title}</h3>
                <p style={{ margin: 0, color: "#666" }}>Language: {problem.language}</p>
              </div>
              {sub && (
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: Number(sub.score) === 100 ? "#28a745" : Number(sub.score) > 0 ? "#ffc107" : "#dc3545" }}>
                    {Number(sub.score || 0).toFixed(0)}%
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "#666" }}>{sub.status}</div>
                </div>
              )}
            </div>

            {sub?.testResults?.length > 0 && (
              <div style={{ marginTop: "1.5rem" }}>
                <h4 style={{ margin: "0 0 0.75rem 0" }}>Test Results</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {sub.testResults.map((tr: any, trIdx: number) => (
                    <div 
                      key={tr.resultId} 
                      style={{ 
                        border: "1px solid #ddd", 
                        borderRadius: "6px", 
                        padding: "0.75rem",
                        backgroundColor: tr.passed ? "#d4edda" : "#f8d7da"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontWeight: "bold" }}>Test Case {trIdx + 1}</span>
                        <span>{tr.passed ? "✅ Passed" : "❌ Failed"}</span>
                      </div>
                      {tr.errorType && (
                        <p style={{ margin: "0.5rem 0 0 0", color: "#721c24" }}>
                          Error: {tr.errorType}
                        </p>
                      )}
                      {tr.actualOutput && (
                        <p style={{ margin: "0.5rem 0 0 0" }}>
                          Actual Output: <code>{tr.actualOutput}</code>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sub?.sourceCode && (
              <div style={{ marginTop: "1.5rem" }}>
                <h4 style={{ margin: "0 0 0.5rem 0" }}>Your Code</h4>
                <pre style={{ 
                  backgroundColor: "#f5f5f5", 
                  padding: "1rem", 
                  borderRadius: "6px", 
                  overflowX: "auto",
                  margin: 0
                }}>
                  {sub.sourceCode}
                </pre>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}