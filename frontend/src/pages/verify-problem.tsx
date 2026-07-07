import { useState } from "react"
import { Link, useParams, useNavigate } from "react-router-dom"
import { useProblem, useTestCases, useValidateProblem } from "../hooks/use-problem"
import { toast } from "sonner"

export default function VerifyProblem() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: problem, isLoading: problemLoading } = useProblem(id)
  const { data: testCases, isLoading: testCasesLoading } = useTestCases(id)
  const validateMutation = useValidateProblem(id)
  
  const [sourceCode, setSourceCode] = useState(problem?.workingSolution || problem?.starterCode || "")
  const [validationResults, setValidationResults] = useState<any[] | null>(null)
  const [allPassed, setAllPassed] = useState<boolean | null>(null)

  const handleRun = async () => {
    if (!problem) return
    try {
      const result = await validateMutation.mutateAsync({
        sourceCode,
        language: problem.language
      })
      setValidationResults(result.results)
      setAllPassed(result.allPassed)
      if (result.allPassed) {
        toast.success("All test cases passed! Problem validated.")
      } else {
        toast.error("Some test cases failed.")
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Validation failed")
    }
  }

  if (problemLoading || testCasesLoading) {
    return <div style={{ maxWidth: "1200px", margin: "2rem auto" }}><p>Loading...</p></div>
  }

  if (!problem) {
    return <div style={{ maxWidth: "1200px", margin: "2rem auto" }}><p>Problem not found</p></div>
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "2rem auto", padding: "0 1rem" }}>
      <Link to={`/instructor/problem/${id}`} style={{ display: "inline-block", marginBottom: "1rem" }}>← Back to Problem</Link>
      <h1>Verify Problem: {problem.title}</h1>
      
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
        {/* Code Editor Section */}
        <div style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "1rem", background: "white" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3>Working Solution ({problem.language})</h3>
            <button 
              onClick={handleRun} 
              disabled={validateMutation.isPending || !testCases || testCases.length === 0}
            >
              {validateMutation.isPending ? "Running..." : "Run & Validate"}
            </button>
          </div>
          <textarea
            value={sourceCode}
            onChange={(e) => setSourceCode(e.target.value)}
            style={{
              width: "100%",
              height: "600px",
              padding: "1rem",
              fontFamily: "monospace",
              fontSize: "14px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              resize: "vertical",
              boxSizing: "border-box"
            }}
            placeholder="Write your working solution here..."
          />
        </div>

        {/* Test Results Section */}
        <div style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "1rem", background: "white" }}>
          <h3>Test Results</h3>
          {!testCases || testCases.length === 0 ? (
            <p>No test cases available. Please add test cases first.</p>
          ) : validationResults ? (
            <div style={{ maxHeight: "600px", overflowY: "auto" }}>
              <div style={{ marginBottom: "1rem", padding: "1rem", borderRadius: "4px", background: allPassed ? "#d4edda" : "#f8d7da", color: allPassed ? "#155724" : "#721c24" }}>
                <strong>{allPassed ? "✅ All Test Cases Passed!" : "❌ Some Test Cases Failed"}</strong>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {validationResults.map((result, index) => (
                  <div 
                    key={result.testCaseId}
                    style={{
                      border: "1px solid #eee",
                      borderRadius: "4px",
                      padding: "0.75rem",
                      background: result.passed ? "#f0fdf4" : "#fef2f2"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                      <strong>Test Case {index + 1}</strong>
                      <span style={{ 
                        color: result.passed ? "#16a34a" : "#dc2626",
                        fontWeight: "bold"
                      }}>
                        {result.passed ? "PASSED" : "FAILED"}
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                      <div>
                        <strong>Expected:</strong>
                        <pre style={{ 
                          background: "#f5f5f5", 
                          padding: "0.5rem", 
                          borderRadius: "4px", 
                          overflowX: "auto",
                          margin: "0.25rem 0 0 0"
                        }}>
                          {result.expectedOutput}
                        </pre>
                      </div>
                      <div>
                        <strong>Actual:</strong>
                        <pre style={{ 
                          background: "#f5f5f5", 
                          padding: "0.5rem", 
                          borderRadius: "4px", 
                          overflowX: "auto",
                          margin: "0.25rem 0 0 0"
                        }}>
                          {result.actualOutput || "(no output)"}
                        </pre>
                      </div>
                    </div>
                    {result.error && (
                      <div style={{ marginTop: "0.5rem" }}>
                        <strong style={{ color: "#dc2626" }}>Error:</strong>
                        <pre style={{ 
                          background: "#fef2f2", 
                          padding: "0.5rem", 
                          borderRadius: "4px", 
                          overflowX: "auto",
                          margin: "0.25rem 0 0 0"
                        }}>
                          {result.error}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p>Click "Run & Validate" to test your solution.</p>
          )}
        </div>
      </div>
    </div>
  )
}
