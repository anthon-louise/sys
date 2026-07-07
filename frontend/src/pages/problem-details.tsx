import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useProblem, useTestCases } from "../hooks/use-problem"

export default function ProblemDetails() {
  const { id } = useParams<{ id: string }>()
  const { data: problem, isLoading: problemLoading } = useProblem(id)
  const { data: testCases, isLoading: testCasesLoading } = useTestCases(id)
  const [showTestCasesModal, setShowTestCasesModal] = useState(false)

  if (problemLoading) {
    return <div style={{ maxWidth: 800, margin: "2rem auto" }}><p>Loading problem...</p></div>
  }

  if (!problem) {
    return <div style={{ maxWidth: 800, margin: "2rem auto" }}><p>Problem not found</p></div>
  }

  return (
    <div style={{ maxWidth: 800, margin: "2rem auto" }}>
      <Link to="/instructor/problem-bank" style={{ display: "inline-block", marginBottom: "1rem" }}>← Back to Problem Bank</Link>
      
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>{problem.title}</h1>
        <span style={{
          padding: "0.25rem 0.75rem",
          borderRadius: "4px",
          fontSize: "0.875rem",
          fontWeight: "bold",
          backgroundColor: problem.isValidated ? "#d4edda" : "#fff3cd",
          color: problem.isValidated ? "#155724" : "#856404"
        }}>
          {problem.isValidated ? "✅ Validated" : "⚠️ Not Validated"}
        </span>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <Link to={`/instructor/problem/${id}/testcases`} style={{ textDecoration: "none" }}>
          <button>Create Test Cases</button>
        </Link>
        <button onClick={() => setShowTestCasesModal(true)}>View Test Cases</button>
        <Link to={`/instructor/problem/${id}/verify`} style={{ textDecoration: "none" }}>
          <button>Verify Problem</button>
        </Link>
      </div>

      <div style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "1.5rem", background: "white" }}>
        <p><strong>Language:</strong> {problem.language}</p>
        {problem.difficulty && <p><strong>Difficulty:</strong> {problem.difficulty}</p>}
        <p><strong>Created At:</strong> {new Date(problem.createdAt).toLocaleDateString()}</p>
        {problem.validatedAt && (
          <p><strong>Validated At:</strong> {new Date(problem.validatedAt).toLocaleString()}</p>
        )}
        {problem.description && (
          <div style={{ marginTop: "1.5rem" }}>
            <h3>Description</h3>
            <p>{problem.description}</p>
          </div>
        )}
        {problem.starterCode && (
          <div style={{ marginTop: "1.5rem" }}>
            <h3>Starter Code</h3>
            <pre style={{ background: "#f5f5f5", padding: "1rem", borderRadius: "4px", overflowX: "auto" }}>
              {problem.starterCode}
            </pre>
          </div>
        )}
      </div>

      {showTestCasesModal && (
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
            minWidth: "700px",
            maxWidth: "90vw",
            maxHeight: "90vh",
            overflowY: "auto",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2>Test Cases</h2>
              <button onClick={() => setShowTestCasesModal(false)} style={{ border: "none", background: "none", fontSize: "1.5rem", cursor: "pointer" }}>×</button>
            </div>

            {testCasesLoading ? (
              <p>Loading test cases...</p>
            ) : testCases && testCases.length > 0 ? (
              <div>
                <p>Total Test Cases: {testCases.length}</p>
                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #ccc" }}>
                      <th style={{ textAlign: "left", padding: "0.5rem" }}>#</th>
                      <th style={{ textAlign: "left", padding: "0.5rem" }}>Input</th>
                      <th style={{ textAlign: "left", padding: "0.5rem" }}>Expected Output</th>
                      <th style={{ textAlign: "left", padding: "0.5rem" }}>Hidden</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testCases.map((tc, index) => (
                      <tr key={tc.testCaseId} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "0.5rem" }}>{index + 1}</td>
                        <td style={{ padding: "0.5rem", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tc.inputData}</td>
                        <td style={{ padding: "0.5rem", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tc.expectedOutput}</td>
                        <td style={{ padding: "0.5rem" }}>{tc.isHidden ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No test cases yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
