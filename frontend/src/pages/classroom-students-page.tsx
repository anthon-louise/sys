import { Link, useParams } from "react-router-dom"
import { useClassroom, useClassroomStudents } from "../hooks/use-classroom"

export default function ClassroomStudentsPage() {
  const { id } = useParams<{ id: string }>()
  const { data: classroom, isLoading: classroomLoading } = useClassroom(id)
  const { data: students, isLoading: studentsLoading } = useClassroomStudents(id)

  if (classroomLoading) {
    return <div style={{ maxWidth: 800, margin: "2rem auto" }}><p>Loading classroom...</p></div>
  }

  if (!classroom) {
    return <div style={{ maxWidth: 800, margin: "2rem auto" }}><p>Classroom not found</p></div>
  }

  return (
    <div style={{ maxWidth: 800, margin: "2rem auto" }}>
      <Link to={`/classroom/${id}`} style={{ display: "inline-block", marginBottom: "1rem" }}>← Back to Classroom</Link>
      <h1>{classroom.classroomName} - Students</h1>
      <p style={{ marginBottom: "1rem" }}>Total Students: {students?.length || 0}</p>

      <div style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "1.5rem", background: "white" }}>
        {studentsLoading ? (
          <p>Loading students...</p>
        ) : students && students.length > 0 ? (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {students.map((student) => (
              <li key={student.studentId} style={{ padding: "0.75rem 0", borderBottom: "1px solid #eee" }}>
                <div><strong>{student.studentName}</strong></div>
                <div style={{ color: "#666", fontSize: "0.875rem" }}>{student.studentEmail}</div>
                <div style={{ color: "#888", fontSize: "0.75rem", marginTop: "0.25rem" }}>
                  Enrolled: {new Date(student.enrolledAt).toLocaleDateString()}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>No students enrolled yet.</p>
        )}
      </div>
    </div>
  )
}
