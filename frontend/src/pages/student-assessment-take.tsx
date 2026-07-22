import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { useStudentAssessment, useTestCode, useSubmitAssessment, useProblemTestCases, useStartSession, useAssessmentSession } from "../hooks/use-assessment"

export default function StudentAssessmentTake() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: assessment, isLoading: assessmentLoading } = useStudentAssessment(id)
  const testCodeMutation = useTestCode()
  const submitAssessmentMutation = useSubmitAssessment(id)
  const startSessionMutation = useStartSession(id)
  const { data: session, isLoading: sessionLoading, refetch: refetchSession } = useAssessmentSession(id)

  const [currentProblemIndex, setCurrentProblemIndex] = useState(0)
  const [codeByProblemId, setCodeByProblemId] = useState<Record<number, string>>({})
  const [testResults, setTestResults] = useState<any[] | null>(null)
  const [terminalOutput, setTerminalOutput] = useState<string>("")
  const [timer, setTimer] = useState(0)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [customInput, setCustomInput] = useState("")
  const [deadlineLabel, setDeadlineLabel] = useState("")
  const timerRef = useRef<number | null>(null)

  // Initialize code with starter code only (no localStorage, no server snapshot)
  useEffect(() => {
    if (assessment?.problems) {
      const initialCode: Record<number, string> = {}
      assessment.problems.forEach(p => {
        initialCode[p.problemId] = p.starterCode || ""
      })
      setCodeByProblemId(initialCode)
    }
  }, [assessment])

  // Start session when component mounts if not already started
  useEffect(() => {
    if (assessment?.assessmentId && !session && !startSessionMutation.isPending) {
      startSessionMutation.mutate()
    }
  }, [assessment, session, startSessionMutation])

  // Refetch session when startSessionMutation succeeds
  useEffect(() => {
    if (startSessionMutation.isSuccess) {
      refetchSession()
    }
  }, [startSessionMutation.isSuccess, refetchSession])

  const handleSubmit = useCallback(async () => {
    if (!assessment?.problems || !assessment.assessmentId) return
    const problemSolutions = assessment.problems.map(p => ({
      problemId: p.problemId,
      sourceCode: codeByProblemId[p.problemId] || ""
    }))
    try {
      await submitAssessmentMutation.mutateAsync(problemSolutions)
      toast.success("Assessment submitted successfully!")
      navigate(`/student/assessment/${id}/results`)
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Submit failed")
    }
  }, [assessment, codeByProblemId, navigate, id, submitAssessmentMutation])

  // Pagehide handler using fetch with keepalive for best-effort submit
  useEffect(() => {
    const handlePageHide = async () => {
      if (!assessment?.assessmentId || !assessment.problems || session?.submittedAt) return
      const problemSolutions = assessment.problems.map(p => ({
        problemId: p.problemId,
        sourceCode: codeByProblemId[p.problemId] || ""
      }))

      // Use fetch with keepalive to allow custom headers (Authorization)
      await fetch(`${import.meta.env.VITE_API_URL}/assessments/student/assessments/${id}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ problemSolutions }),
        keepalive: true
      })
    }

    window.addEventListener("pagehide", handlePageHide)
    return () => {
      window.removeEventListener("pagehide", handlePageHide)
    }
  }, [assessment, codeByProblemId, id, session])

  // Timer setup and assessment locking
  useEffect(() => {
    if (sessionLoading || assessmentLoading) return

    // If already submitted or past endsAt: redirect to results/locked
    if (session?.submittedAt || (session?.endsAt && new Date(session.endsAt) < new Date())) {
      navigate(`/student/assessment/${id}/results`)
      return
    }

    if (session?.endsAt) {
      const updateTimer = () => {
        const now = Date.now()
        const endsAt = new Date(session.endsAt).getTime()
        const remainingSeconds = Math.max(0, Math.floor((endsAt - now) / 1000))

        setTimer(remainingSeconds)

        if (remainingSeconds <= 0) {
          // Auto-submit when timer hits zero
          handleSubmit()
        }
      }

      updateTimer()
      timerRef.current = window.setInterval(updateTimer, 1000)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [session, assessmentLoading, sessionLoading, handleSubmit, navigate, id])

  // closes_at wall-clock deadline — auto-submit even if no time-limit timer
  useEffect(() => {
    if (!assessment?.closesAt || session?.submittedAt) return

    const checkDeadline = () => {
      if (new Date(assessment.closesAt!) <= new Date()) {
        handleSubmit()
      }
    }

    checkDeadline() // check immediately on mount
    const deadlineInterval = window.setInterval(checkDeadline, 15_000) // every 15s
    return () => clearInterval(deadlineInterval)
  }, [assessment?.closesAt, session?.submittedAt, handleSubmit])


  const currentProblem = assessment?.problems?.[currentProblemIndex]
  const currentCode = currentProblem ? codeByProblemId[currentProblem.problemId] || "" : ""
  const { data: testCases } = useProblemTestCases(currentProblem?.problemId)

  const handleCodeChange = useCallback((newCode: string) => {
    if (currentProblem) {
      setCodeByProblemId(prev => ({
        ...prev,
        [currentProblem.problemId]: newCode
      }))
    }
  }, [currentProblem])

  const handleRun = useCallback(async () => {
    if (!currentProblem) return
    try {
      const res = await fetch(`http://localhost:5000/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceCode: currentCode,
          language: currentProblem.language,
          stdin: customInput
        })
      })
      const data = await res.json()
      let output = ""
      if (data.status) output += `STATUS: ${data.status}\n`
      if (data.time) output += `TIME: ${data.time}s\n`
      if (data.memory) output += `MEMORY: ${data.memory}KB\n`
      if (data.compile_output) output += `\nCOMPILE OUTPUT:\n${data.compile_output}\n`
      if (data.stderr) output += `\nSTDERR:\n${data.stderr}\n`
      if (data.stdout) output += `\nSTDOUT:\n${data.stdout}\n`
      if (data.error) output += `\nERROR: ${data.error}\n`
      setTerminalOutput(output || "No output")
    } catch (err: any) {
      setTerminalOutput(`Error: ${err.message}`)
    }
  }, [currentProblem, currentCode, customInput])

  const handleTest = useCallback(async () => {
    if (!currentProblem) return
    try {
      const res = await testCodeMutation.mutateAsync({
        problemId: currentProblem.problemId,
        sourceCode: currentCode,
        language: currentProblem.language
      })
      setTestResults(res.testResults)
      toast.success(res.allPassed ? "All test cases passed!" : "Some test cases failed")
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Test failed")
    }
  }, [currentProblem, currentCode, testCodeMutation])

  const confirmSubmit = () => {
    if (showSubmitConfirm) {
      handleSubmit()
    } else {
      setShowSubmitConfirm(true)
    }
  }

  const nextProblem = () => {
    if (currentProblemIndex < (assessment?.problems?.length || 0) - 1) {
      setCurrentProblemIndex(prev => prev + 1)
      setTestResults(null)
      setTerminalOutput("")
    }
  }

  const prevProblem = () => {
    if (currentProblemIndex > 0) {
      setCurrentProblemIndex(prev => prev - 1)
      setTestResults(null)
      setTerminalOutput("")
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  // Update closes_at label every minute
  useEffect(() => {
    if (!assessment?.closesAt) return
    const update = () => {
      const diff = new Date(assessment.closesAt!).getTime() - Date.now()
      if (diff <= 0) { setDeadlineLabel("Closed"); return }
      const h = Math.floor(diff / 3_600_000)
      const m = Math.floor((diff % 3_600_000) / 60_000)
      setDeadlineLabel(h > 0 ? `${h}h ${m}m left` : `${m}m left`)
    }
    update()
    const id = setInterval(update, 60_000)
    return () => clearInterval(id)
  }, [assessment?.closesAt])

  if (assessmentLoading || sessionLoading) {
    return <div style={{ maxWidth: "1400px", margin: "2rem auto", padding: "0 1rem" }}><p>Loading assessment...</p></div>
  }
  if (!assessment) {
    return <div style={{ maxWidth: "1400px", margin: "2rem auto", padding: "0 1rem" }}><p>Assessment not found</p></div>
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "1rem 2rem",
        borderBottom: "1px solid #ccc",
        backgroundColor: "#fff"
      }}>
        <h2 style={{ margin: 0 }}>{assessment.title}</h2>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {/* Session timer (time-limit based) */}
          {Boolean(assessment.timeLimitMinutes && assessment.timeLimitMinutes > 0) && (
            <div style={{
              fontSize: "1.5rem",
              fontWeight: "bold",
              color: timer < 60 ? "red" : "black"
            }}>
              {formatTime(timer)}
            </div>
          )}
          {/* Closes-at deadline badge (shown when no per-session timer, or as extra info) */}
          {assessment.closesAt && !Boolean(assessment.timeLimitMinutes && assessment.timeLimitMinutes > 0) && deadlineLabel && (
            <div style={{
              fontSize: "0.9rem",
              fontWeight: 600,
              padding: "0.3rem 0.75rem",
              borderRadius: "999px",
              backgroundColor: deadlineLabel === "Closed" ? "#dc3545" : "#fff3cd",
              color: deadlineLabel === "Closed" ? "#fff" : "#856404",
              border: "1px solid currentColor"
            }}>
              ⏰ Deadline: {deadlineLabel}
            </div>
          )}
        </div>
        <button
          onClick={confirmSubmit}
          style={{
            padding: "0.75rem 1.5rem",
            fontSize: "1rem",
            backgroundColor: showSubmitConfirm ? "#dc3545" : "#28a745",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer"
          }}
        >
          {showSubmitConfirm ? "Confirm Submit" : "Submit Assessment"}
        </button>
      </div>
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left Panel - Problem & Test Cases */}
        <div style={{ width: "30%", borderRight: "1px solid #ccc", padding: "1.5rem", overflowY: "auto" }}>
          {currentProblem && (
            <div>
              <h3 style={{ margin: "0 0 0.5rem 0" }}>
                Problem {currentProblemIndex + 1}: {currentProblem.title}
              </h3>
              <p style={{ margin: "0 0 1rem 0", color: "#666" }}>
                Language: {currentProblem.language} | Difficulty: {currentProblem.difficulty || "N/A"}
              </p>
              <div style={{ whiteSpace: "pre-wrap" }}>{currentProblem.description}</div>

              {testCases && testCases.length > 0 && (
                <div style={{ marginTop: "1.5rem" }}>
                  <h4 style={{ margin: "0 0 0.75rem 0" }}>Test Cases</h4>
                  {testCases.map((tc: any, idx: number) => (
                    <div
                      key={tc.testCaseId}
                      style={{
                        border: "1px solid #ddd",
                        borderRadius: "6px",
                        padding: "0.75rem",
                        marginBottom: "0.5rem",
                        backgroundColor: testResults?.find((r: any) => r.testCaseId === tc.testCaseId)?.passed ? "#d4edda" : "#fff"
                      }}
                    >
                      <p style={{ margin: "0 0 0.25rem 0", fontWeight: "bold" }}>Test Case {idx + 1}</p>
                      {tc.inputData && (
                        <p style={{ margin: "0 0 0.25rem 0", fontSize: "0.9rem" }}>
                          Input: <code>{tc.inputData}</code>
                        </p>
                      )}
                      {!tc.isHidden && tc.expectedOutput && (
                        <p style={{ margin: 0, fontSize: "0.9rem" }}>
                          Expected: <code>{tc.expectedOutput}</code>
                        </p>
                      )}
                      {testResults?.find((r: any) => r.testCaseId === tc.testCaseId) && (
                        <div style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
                          <p style={{ margin: "0 0 0.25rem 0" }}>
                            {testResults.find((r: any) => r.testCaseId === tc.testCaseId)?.passed ? "✅ Passed" : "❌ Failed"}
                          </p>
                          {testResults.find((r: any) => r.testCaseId === tc.testCaseId)?.actualOutput && (
                            <p style={{ margin: "0 0 0.25rem 0" }}>
                              Actual: <code>{testResults.find((r: any) => r.testCaseId === tc.testCaseId)?.actualOutput}</code>
                            </p>
                          )}
                          {testResults.find((r: any) => r.testCaseId === tc.testCaseId)?.errorType && (
                            <p style={{ margin: "0 0 0.25rem 0", color: "red" }}>
                              Error: {testResults.find((r: any) => r.testCaseId === tc.testCaseId)?.errorType}
                            </p>
                          )}
                          {testResults.find((r: any) => r.testCaseId === tc.testCaseId)?.stderr && (
                            <p style={{ margin: "0 0 0.25rem 0", color: "red" }}>
                              Stderr: <code>{testResults.find((r: any) => r.testCaseId === tc.testCaseId)?.stderr}</code>
                            </p>
                          )}
                          {testResults.find((r: any) => r.testCaseId === tc.testCaseId)?.compileOutput && (
                            <p style={{ margin: 0, color: "red" }}>
                              Compile: <code>{testResults.find((r: any) => r.testCaseId === tc.testCaseId)?.compileOutput}</code>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div style={{
            marginTop: "1.5rem",
            display: "flex",
            gap: "0.5rem",
            position: "sticky",
            bottom: 0,
            backgroundColor: "#fff",
            paddingTop: "1rem"
          }}>
            <button
              onClick={prevProblem}
              disabled={currentProblemIndex === 0}
              style={{ flex: 1, padding: "0.5rem", cursor: currentProblemIndex === 0 ? "not-allowed" : "pointer" }}
            >
              Previous
            </button>
            <button
              onClick={nextProblem}
              disabled={currentProblemIndex === (assessment.problems?.length || 0) - 1}
              style={{ flex: 1, padding: "0.5rem", cursor: currentProblemIndex === (assessment.problems?.length || 0) - 1 ? "not-allowed" : "pointer" }}
            >
              Next
            </button>
          </div>
        </div>

        {/* Center Panel - Code Editor */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{
            display: "flex",
            gap: "0.5rem",
            padding: "0.75rem",
            borderBottom: "1px solid #ccc",
            backgroundColor: "#f5f5f5"
          }}>
            <button onClick={handleRun} style={{ padding: "0.5rem 1rem", cursor: "pointer" }}>Run</button>
            <button
              onClick={handleTest}
              disabled={testCodeMutation.isPending}
              style={{ padding: "0.5rem 1rem", cursor: testCodeMutation.isPending ? "not-allowed" : "pointer" }}
            >
              {testCodeMutation.isPending ? "Testing..." : "Test"}
            </button>
          </div>
          <div style={{ flex: 1, padding: "1rem" }}>
            <textarea
              value={currentCode}
              onChange={(e) => handleCodeChange(e.target.value)}
              style={{
                fontFamily: '"Fira code", "Fira Mono", monospace',
                fontSize: 14,
                backgroundColor: "#f5f5f5",
                border: "1px solid #ccc",
                borderRadius: "6px",
                height: "100%",
                width: "100%",
                padding: "16px",
                resize: "none",
                boxSizing: "border-box"
              }}
            />
          </div>
        </div>

        {/* Right Panel - Terminal */}
        <div style={{ width: "25%", borderLeft: "1px solid #ccc", display: "flex", flexDirection: "column" }}>
          <div style={{
            padding: "0.75rem",
            borderBottom: "1px solid #ccc",
            backgroundColor: "#333",
            color: "#fff"
          }}>
            Custom Input
          </div>
          <textarea
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            style={{
              fontFamily: "monospace",
              fontSize: "0.9rem",
              height: "150px",
              padding: "0.75rem",
              border: "none",
              borderBottom: "1px solid #333",
              resize: "none",
              backgroundColor: "#1e1e1e",
              color: "#d4d4d4"
            }}
            placeholder="Type your custom input here..."
          />
          <div style={{
            padding: "0.75rem",
            borderBottom: "1px solid #ccc",
            backgroundColor: "#333",
            color: "#fff"
          }}>
            Output
          </div>
          <div style={{
            flex: 1,
            padding: "1rem",
            backgroundColor: "#1e1e1e",
            color: "#d4d4d4",
            fontFamily: "monospace",
            overflowY: "auto",
            whiteSpace: "pre-wrap"
          }}>
            {terminalOutput || "Click 'Run' to execute your code"}
          </div>
        </div>
      </div>
    </div>
  )
}
