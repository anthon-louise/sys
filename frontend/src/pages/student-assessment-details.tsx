import { useState, useEffect } from "react"
import { Link, useParams, useNavigate } from "react-router-dom"
import { useStudentAssessment, useStudentAssessmentStatus, useStudentSubmission } from "../hooks/use-assessment"
import { useAuth } from "../context/auth-context"

// Returns a human-readable countdown string like "2h 15m 30s"
function useCountdown(targetDate: string | null | undefined) {
  const [countdown, setCountdown] = useState("")

  useEffect(() => {
    if (!targetDate) return
    const update = () => {
      const diff = new Date(targetDate).getTime() - Date.now()
      if (diff <= 0) {
        setCountdown("now")
        return
      }
      const h = Math.floor(diff / 3_600_000)
      const m = Math.floor((diff % 3_600_000) / 60_000)
      const s = Math.floor((diff % 60_000) / 1_000)
      setCountdown(
        [h && `${h}h`, m && `${m}m`, `${s}s`].filter(Boolean).join(" ")
      )
    }
    update()
    const id = setInterval(update, 1_000)
    return () => clearInterval(id)
  }, [targetDate])

  return countdown
}

export default function StudentAssessmentDetails() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  // Status query — always available (only checks enrollment, not schedule)
  const { data: status, isLoading: statusLoading } = useStudentAssessmentStatus(id)

  // Main assessment query — only succeeds when published + within schedule window
  const { data: assessment, isLoading: assessmentLoading } = useStudentAssessment(id)
  const { data: submission } = useStudentSubmission(id)

  const opensCountdown = useCountdown(
    status && !assessment && status.opensAt && new Date(status.opensAt) > new Date()
      ? status.opensAt
      : null
  )

  if (statusLoading || assessmentLoading) {
    return (
      <div style={wrapStyle}>
        <p>Loading assessment...</p>
      </div>
    )
  }

  if (!status) {
    return (
      <div style={wrapStyle}>
        <p>Assessment not found.</p>
      </div>
    )
  }

  const now = new Date()
  const opensAt  = status.opensAt  ? new Date(status.opensAt)  : null
  const closesAt = status.closesAt ? new Date(status.closesAt) : null

  // ── Not published ──────────────────────────────────────────────────────────
  if (!status.isPublished) {
    return (
      <div style={wrapStyle}>
        <BackLink assessment={assessment ?? status} />
        <StatusCard
          icon="🔒"
          title={status.title}
          heading="Assessment Not Available"
          message="This assessment hasn't been published yet by your instructor."
          color="#6c757d"
        />
      </div>
    )
  }

  // ── Not yet open ───────────────────────────────────────────────────────────
  if (opensAt && now < opensAt) {
    return (
      <div style={wrapStyle}>
        <BackLink assessment={assessment ?? status} />
        <StatusCard
          icon="⏳"
          title={status.title}
          heading="Not Open Yet"
          message={`This assessment opens in ${opensCountdown}.`}
          sub={`Opens: ${opensAt.toLocaleString("en-PH", { timeZone: "Asia/Manila" })}`}
          color="#fd7e14"
        />
      </div>
    )
  }

  // ── Deadline passed ────────────────────────────────────────────────────────
  if (closesAt && now > closesAt) {
    return (
      <div style={wrapStyle}>
        <BackLink assessment={assessment ?? status} />
        <StatusCard
          icon="🔐"
          title={status.title}
          heading="Deadline Has Passed"
          message="This assessment is no longer accepting submissions."
          sub={`Closed: ${closesAt.toLocaleString("en-PH", { timeZone: "Asia/Manila" })}`}
          color="#dc3545"
          extra={
            submission ? (
              <Link
                to={`/student/assessment/${id}/results`}
                style={btnStyle("#28a745")}
              >
                View My Results
              </Link>
            ) : null
          }
        />
      </div>
    )
  }

  // ── Assessment available but data still loading ────────────────────────────
  if (!assessment) {
    return (
      <div style={wrapStyle}>
        <p>Loading assessment...</p>
      </div>
    )
  }

  // ── Normal view ────────────────────────────────────────────────────────────
  return (
    <div style={wrapStyle}>
      <BackLink assessment={assessment} />
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 style={{ margin: "0 0 0.5rem 0" }}>{assessment.title}</h1>
            <p style={metaStyle}>Type: {assessment.assessmentType}</p>
            <p style={metaStyle}>Term: {assessment.academicTerm}</p>
            {assessment.timeLimitMinutes && (
              <p style={metaStyle}>Time Limit: {assessment.timeLimitMinutes} mins</p>
            )}
            {assessment.opensAt && (
              <p style={metaStyle}>
                Opens: {new Date(assessment.opensAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}
              </p>
            )}
            {assessment.closesAt && (
              <p style={{ ...metaStyle, color: "#dc3545", fontWeight: 500 }}>
                Closes: {new Date(assessment.closesAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}
              </p>
            )}
            {assessment.description && <p style={{ marginTop: "1rem" }}>{assessment.description}</p>}
          </div>

          <div>
            {!submission ? (
              <button onClick={() => navigate(`/student/assessment/${id}/take`)} style={btnStyle("#007bff")}>
                Start Assessment
              </button>
            ) : (
              <Link to={`/student/assessment/${id}/results`} style={btnStyle("#28a745")}>
                View Results
              </Link>
            )}
          </div>
        </div>
      </div>

      {assessment.problems && assessment.problems.length > 0 ? (
        <div>
          <h2>Problems</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {assessment.problems.map((problem, index) => (
              <div key={problem.problemId} style={cardStyle}>
                <h3 style={{ margin: "0 0 0.5rem 0" }}>Problem {index + 1}: {problem.title}</h3>
                <p style={metaStyle}>Language: {problem.language} | Difficulty: {problem.difficulty || "N/A"}</p>
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

// ── Shared helpers ─────────────────────────────────────────────────────────

function BackLink({ assessment }: { assessment: { classroomId?: number } }) {
  return (
    <Link
      to={assessment.classroomId ? `/classroom/${assessment.classroomId}` : "/student/dashboard"}
      style={{ display: "inline-block", marginBottom: "1rem" }}
    >
      ← Back to Classroom
    </Link>
  )
}

function StatusCard({
  icon, title, heading, message, sub, color, extra
}: {
  icon: string
  title: string
  heading: string
  message: string
  sub?: string
  color: string
  extra?: React.ReactNode
}) {
  return (
    <div style={{
      border: `2px solid ${color}`,
      borderRadius: "10px",
      padding: "2rem",
      background: "#fff",
      textAlign: "center"
    }}>
      <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>{icon}</div>
      <h2 style={{ margin: "0 0 0.25rem 0", color: "#333" }}>{title}</h2>
      <h3 style={{ margin: "0 0 0.75rem 0", color }}>{heading}</h3>
      <p style={{ color: "#555", margin: "0 0 0.5rem 0" }}>{message}</p>
      {sub && <p style={{ color: "#888", fontSize: "0.9rem", margin: "0 0 1rem 0" }}>{sub}</p>}
      {extra && <div style={{ marginTop: "1rem" }}>{extra}</div>}
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────

const wrapStyle: React.CSSProperties = { maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }
const cardStyle: React.CSSProperties = { border: "1px solid #ccc", borderRadius: "8px", padding: "1.5rem", background: "white", marginBottom: "1.5rem" }
const metaStyle: React.CSSProperties = { margin: "0 0 0.5rem 0", color: "#666" }
const btnStyle = (bg: string): React.CSSProperties => ({
  padding: "0.75rem 1.5rem",
  fontSize: "1rem",
  backgroundColor: bg,
  color: "white",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-block"
})
