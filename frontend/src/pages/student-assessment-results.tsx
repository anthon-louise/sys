import { Link, useParams, useNavigate } from "react-router-dom"
import { useEffect } from "react"
import { useStudentAssessment, useStudentSubmission, useAssessmentSession } from "../hooks/use-assessment"

// ── Score ring component ────────────────────────────────────────────────────
function ScoreRing({ score, size = 120, label }: { score: number; size?: number; label: string }) {
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference
  const color = score >= 80 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444"

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#e5e7eb" strokeWidth={10}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
        <text
          x={size / 2} y={size / 2}
          textAnchor="middle" dominantBaseline="central"
          style={{
            transform: `rotate(90deg)`,
            transformOrigin: `${size / 2}px ${size / 2}px`,
            fontWeight: 700,
            fontSize: size > 100 ? "1.5rem" : "1rem",
            fill: color
          }}
        >
          {score.toFixed(0)}%
        </text>
      </svg>
      <span style={{ fontSize: "0.8rem", color: "#94a3b8", fontWeight: 600, textAlign: "center" }}>{label}</span>
    </div>
  )
}

// ── Preset badge ────────────────────────────────────────────────────────────
const PRESET_META: Record<string, { emoji: string; color: string; bg: string; desc: string }> = {
  "Correctness Only":  { emoji: "🎯", color: "#1d4ed8", bg: "#dbeafe", desc: "Test 100%" },
  "Balanced":          { emoji: "⚖️", color: "#7c3aed", bg: "#ede9fe", desc: "Test 75% + Time 25%" },
  "Speed Challenge":   { emoji: "⚡", color: "#b45309", bg: "#fef3c7", desc: "Test 50% + Time 50%" },
  "Structure + Tests": { emoji: "🧱", color: "#065f46", bg: "#d1fae5", desc: "Test 50% + Constraints 50%" },
  "Mixed":             { emoji: "🔀", color: "#7e22ce", bg: "#f3e8ff", desc: "Test 50% + Constraints 25% + Time 25%" },
  "Structure Focus":   { emoji: "📐", color: "#9a3412", bg: "#ffedd5", desc: "Test 30% + Constraints 70%" },
}

function PresetBadge({ preset }: { preset: string }) {
  const meta = PRESET_META[preset] ?? PRESET_META["Correctness Only"]
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "0.35rem",
      padding: "0.3rem 0.75rem", borderRadius: "999px",
      backgroundColor: meta.bg, color: meta.color,
      fontWeight: 600, fontSize: "0.85rem"
    }}>
      {meta.emoji} {preset} <span style={{ opacity: 0.7, fontWeight: 400 }}>({meta.desc})</span>
    </span>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function StudentAssessmentResults() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: assessment } = useStudentAssessment(id)
  const { data: submission, isLoading: submissionLoading } = useStudentSubmission(id)
  const { data: session, isLoading: sessionLoading } = useAssessmentSession(id)

  const isLoading = submissionLoading || sessionLoading

  useEffect(() => {
    if (!isLoading && !submission && !session?.endsAt) {
      navigate(`/student/assessment/${id}`)
    }
  }, [submission, session, isLoading, id, navigate])

  if (isLoading) {
    return (
      <div style={{ maxWidth: "900px", margin: "2rem auto", padding: "0 1rem" }}>
        <p>Loading results...</p>
      </div>
    )
  }
  if (!submission && (!session?.endsAt || new Date(session.endsAt) > new Date())) {
    return null
  }

  // ── Derived values ──────────────────────────────────────────────────────
  const finalScore        = Number(submission?.finalScore ?? submission?.overallTestCaseScore ?? 0)
  const testCaseScore     = Number(submission?.overallTestCaseScore ?? 0)
  const timeBonusScore    = submission?.timeBonusScore != null ? Number(submission.timeBonusScore) : null
  const constraintScore   = submission?.overallConstraintScore != null ? Number(submission.overallConstraintScore) : null
  const gradingPreset     = submission?.gradingPreset ?? "Correctness Only"
  const testWeight        = submission?.testWeight        ?? 100
  const timeWeight        = submission?.timeWeight        ?? 0
  const constraintWeight  = submission?.constraintWeight  ?? 0
  const hasTimeComponent       = timeWeight > 0
  const hasConstraintComponent = constraintWeight > 0

  return (
    <div style={{ maxWidth: "900px", margin: "2rem auto", padding: "0 1rem" }}>
      {/* Back link */}
      <Link
        to={assessment ? `/classroom/${assessment.classroomId}` : "/student/dashboard"}
        style={{
          display: "inline-flex", alignItems: "center", gap: "0.4rem",
          marginBottom: "1.5rem", textDecoration: "none",
          color: "#4b5563", fontWeight: 500
        }}
      >
        ← Back
      </Link>

      {/* ── Hero score card ─────────────────────────────────────────────── */}
      {submission ? (
        <div style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)",
          borderRadius: "16px",
          padding: "2rem",
          marginBottom: "1.5rem",
          color: "#fff",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)"
        }}>
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <h1 style={{ margin: "0 0 0.4rem 0", fontSize: "1.6rem", fontWeight: 700 }}>Assessment Complete! 🎉</h1>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.95rem" }}>{assessment?.title}</p>
          </div>

          {/* Score rings */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-start", gap: "3rem", flexWrap: "wrap" }}>
            <ScoreRing score={finalScore} size={150} label="Final Score" />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5rem" }}>
              <ScoreRing score={testCaseScore} size={100} label={`Test Cases (${testWeight}%)`} />
              {hasTimeComponent && timeBonusScore != null && (
                <ScoreRing score={timeBonusScore} size={100} label={`Time Bonus (${timeWeight}%)`} />
              )}
              {hasConstraintComponent && constraintScore != null && (
                <ScoreRing score={constraintScore} size={100} label={`Structure (${constraintWeight}%)`} />
              )}
            </div>
          </div>

          {/* Grading preset badge */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: "1.5rem" }}>
            <PresetBadge preset={gradingPreset} />
          </div>
        </div>
      ) : (
        <div style={{
          background: "#fff", borderRadius: "16px", border: "1px solid #e5e7eb",
          padding: "2rem", marginBottom: "1.5rem", textAlign: "center"
        }}>
          <h1 style={{ margin: "0 0 0.5rem 0", fontSize: "1.6rem" }}>Time's Up! ⏰</h1>
          <p style={{ margin: 0, color: "#6b7280" }}>No submission was made before the time expired.</p>
        </div>
      )}

      {/* ── Score breakdown table ────────────────────────────────────────── */}
      {submission && (
        <div style={{
          background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb",
          padding: "1.5rem", marginBottom: "1.5rem"
        }}>
          <h2 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem", fontWeight: 700, color: "#111827" }}>Score Breakdown</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", color: "#6b7280" }}>Component</th>
                <th style={{ textAlign: "right", padding: "0.5rem 0.75rem", color: "#6b7280" }}>Score</th>
                <th style={{ textAlign: "right", padding: "0.5rem 0.75rem", color: "#6b7280" }}>Weight</th>
                <th style={{ textAlign: "right", padding: "0.5rem 0.75rem", color: "#6b7280" }}>Contribution</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "0.75rem", fontWeight: 500 }}>🎯 Test Cases</td>
                <td style={{ padding: "0.75rem", textAlign: "right" }}>{testCaseScore.toFixed(1)}%</td>
                <td style={{ padding: "0.75rem", textAlign: "right" }}>{testWeight}%</td>
                <td style={{ padding: "0.75rem", textAlign: "right", fontWeight: 600 }}>
                  {((testCaseScore * testWeight) / (testWeight + timeWeight + constraintWeight)).toFixed(1)} pts
                </td>
              </tr>
              {hasTimeComponent && timeBonusScore != null && (
                <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "0.75rem", fontWeight: 500 }}>⚡ Time Bonus</td>
                  <td style={{ padding: "0.75rem", textAlign: "right" }}>{timeBonusScore.toFixed(1)}%</td>
                  <td style={{ padding: "0.75rem", textAlign: "right" }}>{timeWeight}%</td>
                  <td style={{ padding: "0.75rem", textAlign: "right", fontWeight: 600 }}>
                    {((timeBonusScore * timeWeight) / (testWeight + timeWeight + constraintWeight)).toFixed(1)} pts
                  </td>
                </tr>
              )}
              {hasConstraintComponent && constraintScore != null && (
                <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "0.75rem", fontWeight: 500 }}>🧱 Structure</td>
                  <td style={{ padding: "0.75rem", textAlign: "right" }}>{constraintScore.toFixed(1)}%</td>
                  <td style={{ padding: "0.75rem", textAlign: "right" }}>{constraintWeight}%</td>
                  <td style={{ padding: "0.75rem", textAlign: "right", fontWeight: 600 }}>
                    {((constraintScore * constraintWeight) / (testWeight + timeWeight + constraintWeight)).toFixed(1)} pts
                  </td>
                </tr>
              )}
              <tr style={{ background: "#f9fafb" }}>
                <td style={{ padding: "0.75rem", fontWeight: 700 }}>Final Score</td>
                <td colSpan={2} />
                <td style={{ padding: "0.75rem", textAlign: "right", fontWeight: 700, fontSize: "1rem" }}>
                  {finalScore.toFixed(1)}%
                </td>
              </tr>
            </tbody>
          </table>
          {hasTimeComponent && (
            <p style={{ margin: "0.75rem 0 0 0", fontSize: "0.8rem", color: "#6b7280" }}>
              ℹ️ Time bonus is 100% if submitted within the first 40% of the assessment window, then decreases linearly to 0% at the deadline.
            </p>
          )}
        </div>
      )}

      {/* ── Per-problem breakdown ────────────────────────────────────────── */}
      {submission && assessment?.problems?.map((problem, idx) => {
        const sub = submission?.submissions?.find((s: any) => s.problemId === problem.problemId)
        const subScore = Number(sub?.score || 0)
        return (
          <div
            key={problem.problemId}
            style={{
              background: "#fff", border: "1px solid #e5e7eb",
              borderRadius: "12px", padding: "1.5rem", marginBottom: "1rem"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <div>
                <h3 style={{ margin: "0 0 0.25rem 0", fontSize: "1rem", fontWeight: 700, color: "#111827" }}>
                  Problem {idx + 1}: {problem.title}
                </h3>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#6b7280" }}>Language: {problem.language}</p>
              </div>
              {sub && (
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{
                    fontSize: "1.4rem", fontWeight: 700,
                    color: subScore === 100 ? "#22c55e" : subScore > 0 ? "#f59e0b" : "#ef4444"
                  }}>
                    {subScore.toFixed(0)}%
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>{sub.status}</div>
                </div>
              )}
            </div>

            {/* Test results */}
            {sub?.testResults?.length > 0 && (
              <div>
                <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "0.9rem", fontWeight: 600, color: "#374151" }}>Test Results</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {sub.testResults.map((tr: any, trIdx: number) => (
                    <div
                      key={tr.resultId}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                        border: "1px solid",
                        borderColor: tr.passed ? "#bbf7d0" : "#fecaca",
                        borderRadius: "8px", padding: "0.75rem 1rem",
                        backgroundColor: tr.passed ? "#f0fdf4" : "#fff5f5"
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 600, color: "#374151", fontSize: "0.9rem" }}>
                          Test Case {trIdx + 1}
                        </span>
                        {tr.errorType && (
                          <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.82rem", color: "#b91c1c" }}>
                            Error: {tr.errorType}
                          </p>
                        )}
                        {tr.actualOutput && (
                          <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.82rem", color: "#374151" }}>
                            Output: <code style={{ background: "#f3f4f6", padding: "0.1rem 0.3rem", borderRadius: "3px" }}>{tr.actualOutput}</code>
                          </p>
                        )}
                      </div>
                      <span style={{ fontWeight: 700, fontSize: "0.9rem", color: tr.passed ? "#16a34a" : "#dc2626", flexShrink: 0 }}>
                        {tr.passed ? "✅ Passed" : "❌ Failed"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Structural Constraint Checks */}
            {sub?.constraintDetails?.length > 0 && (
              <div style={{ marginTop: "1rem" }}>
                <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "0.9rem", fontWeight: 600, color: "#374151" }}>
                  Structural Constraint Checks
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {sub.constraintDetails.map((cd: any, cdIdx: number) => (
                    <div
                      key={cdIdx}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        border: "1px solid",
                        borderColor: cd.passed ? "#bbf7d0" : "#fecaca",
                        borderRadius: "8px", padding: "0.6rem 1rem",
                        backgroundColor: cd.passed ? "#f0fdf4" : "#fff5f5"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{
                          fontSize: "0.75rem", padding: "0.1rem 0.4rem", borderRadius: "4px", fontWeight: 600,
                          backgroundColor: cd.type === "required" ? "#dbeafe" : "#fef3c7",
                          color: cd.type === "required" ? "#1e40af" : "#92400e"
                        }}>
                          {cd.type === "required" ? "Required" : "Forbidden"}
                        </span>
                        <span style={{ fontWeight: 500, color: "#374151", fontSize: "0.88rem" }}>
                          <code>{cd.rule}</code> — {cd.message}
                        </span>
                      </div>
                      <span style={{ fontWeight: 700, fontSize: "0.88rem", color: cd.passed ? "#16a34a" : "#dc2626", flexShrink: 0 }}>
                        {cd.passed ? "✅ Passed" : "❌ Failed"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Source code — collapsible */}
            {sub?.sourceCode && (
              <details style={{ marginTop: "1rem" }}>
                <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.9rem", color: "#374151", userSelect: "none" }}>
                  View Your Code
                </summary>
                <pre style={{
                  marginTop: "0.5rem",
                  background: "#1e1e1e", color: "#d4d4d4",
                  padding: "1rem", borderRadius: "8px",
                  overflowX: "auto", fontSize: "0.85rem", lineHeight: 1.5, margin: 0
                }}>
                  {sub.sourceCode}
                </pre>
              </details>
            )}
          </div>
        )
      })}
    </div>
  )
}
