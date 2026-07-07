import { useState } from "react"
import { Link } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { useAuth } from "../context/auth-context"
import { useLogout } from "../hooks/use-auth"
import { useCreateClassroom, useClassrooms } from "../hooks/use-classroom"
import { createClassroomSchema, type CreateClassroomForm } from "../schemas/classroom.schema"

export default function InstructorDashboard() {
  const { user } = useAuth()
  const logoutMutation = useLogout()
  const createClassroomMutation = useCreateClassroom()
  const { data: classrooms, isLoading } = useClassrooms()
  const [isModalOpen, setIsModalOpen] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateClassroomForm>({ resolver: zodResolver(createClassroomSchema) })

  const onSubmit = async (data: CreateClassroomForm) => {
    try {
      await createClassroomMutation.mutateAsync(data)
      toast.success("Classroom created successfully!")
      setIsModalOpen(false)
      reset()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Failed to create classroom")
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: "2rem auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h1>Instructor Dashboard</h1>
          <p>Welcome, {user?.username}</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link to="/instructor/problem-bank" style={{ textDecoration: "none" }}>
            <button>Problem Bank</button>
          </Link>
          <button onClick={() => setIsModalOpen(true)}>Create Classroom</button>
          <button onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}>
            {logoutMutation.isPending ? "Logging out..." : "Logout"}
          </button>
        </div>
      </div>

      <div>
        {isLoading ? (
          <p>Loading classrooms...</p>
        ) : classrooms && classrooms.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "1rem" }}>
            {classrooms.map((classroom) => (
              <Link
                key={classroom.classroomId}
                to={`/classroom/${classroom.classroomId}`}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div style={{
                  border: "1px solid #ccc",
                  borderRadius: "8px",
                  padding: "1rem",
                  background: "white",
                  cursor: "pointer",
                  transition: "box-shadow 0.2s",
                }} onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)"
                }} onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none"
                }}>
                  <h3 style={{ margin: "0 0 0.5rem 0" }}>{classroom.classroomName}</h3>
                  <p style={{ margin: "0 0 0.5rem 0", color: "#666" }}>School Year: {classroom.schoolYear}</p>
                  <p style={{ margin: 0, fontSize: "0.875rem", color: "#888" }}>Join Code: {classroom.joinCode}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p>No classrooms yet. Create your first classroom!</p>
        )}
      </div>

      {isModalOpen && (
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
            minWidth: 400,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2>Create Classroom</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ border: "none", background: "none", fontSize: "1.5rem", cursor: "pointer" }}>×</button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.25rem" }}>Classroom Name</label>
                <input {...register("classroomName")} style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }} />
                {errors.classroomName && <p style={{ color: "red", margin: "0.25rem 0 0 0" }}>{errors.classroomName.message}</p>}
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.25rem" }}>School Year</label>
                <input {...register("schoolYear")} style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }} />
                {errors.schoolYear && <p style={{ color: "red", margin: "0.25rem 0 0 0" }}>{errors.schoolYear.message}</p>}
              </div>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" disabled={createClassroomMutation.isPending}>
                  {createClassroomMutation.isPending ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}