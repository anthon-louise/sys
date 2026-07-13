import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useFocusLossSummary, useStudentFocusLog, useAssessment } from "../hooks/use-assessment"

export default function AssessmentFocusLogs() {
  const { id } = useParams<{ id: string }>()
  const { data: assessment, isLoading: assessmentLoading } = useAssessment(id)
  const { data: focusSummary, isLoading: summaryLoading } = useFocusLossSummary(id)
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null)
  const { data: studentLog, isLoading: logLoading } = useStudentFocusLog(id, selectedStudentId)

  if (assessmentLoading || summaryLoading) {
    return <div style={{ maxWidth: 1000, margin: "2rem auto" }}><p>Loading...</p></div>
  }

  if (!assessment) {
    return <div style={{ maxWidth: 1000, margin: "2rem auto" }}><p>Assessment not found</p></div>
  }

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    }
    return `${seconds}s`
  }

  return (
    <div style={{ maxWidth: 1000, margin: "2rem auto" }}>
      <Link to={`/instructor/assessment/${id}`} style={{ display: "inline-block", marginBottom: "1rem" }}>
        ← Back to Assessment
      </Link>
      <h1>Focus Loss Logs - {assessment.title}</h1>

      {focusSummary && focusSummary.length > 0 ? (
        <div style={{ border: "1px solid #ccc", borderRadius: "8px", background: "white", overflow: "hidden", marginTop: "1rem" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#f3f4f6" }}>
              <tr>
                <th style={{ padding: "1rem", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Student</th>
                <th style={{ padding: "1rem", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Total Incidents</th>
                <th style={{ padding: "1rem", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Total Time Away</th>
                <th style={{ padding: "1rem", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {focusSummary.map((student: any) => (
                <tr key={student.studentId}>
                  <td style={{ padding: "1rem", borderBottom: "1px solid #e5e7eb" }}>{student.username}</td>
                  <td style={{ padding: "1rem", borderBottom: "1px solid #e5e7eb" }}>{student.totalIncidents}</td>
                  <td style={{ padding: "1rem", borderBottom: "1px solid #e5e7eb" }}>{formatTime(Number(student.totalTimeSeconds))}</td>
                  <td style={{ padding: "1rem", borderBottom: "1px solid #e5e7eb" }}>
                    <button onClick={() => setSelectedStudentId(student.studentId)}>View Details</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ marginTop: "1rem" }}>No focus loss logs found for this assessment.</p>
      )}

      {selectedStudentId && (
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
            maxWidth: 800,
            maxHeight: "90vh",
            overflowY: "auto",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2>Student Focus Log Details</h2>
              <button onClick={() => setSelectedStudentId(null)} style={{ border: "none", background: "none", fontSize: "1.5rem", cursor: "pointer" }}>×</button>
            </div>
            {logLoading ? (
              <p>Loading...</p>
            ) : studentLog && studentLog.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {studentLog.map((log: any) => (
                  <div key={log.logId} style={{ border: "1px solid #e5e7eb", borderRadius: "4px", padding: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                      <strong>{log.eventType}</strong>
                      <span style={{ color: "#666", fontSize: "0.875rem" }}>
                        {new Date(log.occurredAt).toLocaleString()}
                      </span>
                    </div>
                    <p style={{ margin: 0, color: "#444" }}>
                      Duration: {log.durationSeconds} second{log.durationSeconds !== 1 ? 's' : ''}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p>No detailed logs found for this student.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
