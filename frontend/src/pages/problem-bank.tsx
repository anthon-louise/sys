import { useState } from "react"
import { Link } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useProblems, useCreateProblem } from "../hooks/use-problem"
import { createProblemSchema, type CreateProblemForm } from "../schemas/problem.schema"

export default function ProblemBank() {
  const { data: problems, isLoading } = useProblems()
  const createProblemMutation = useCreateProblem()
  const [isModalOpen, setIsModalOpen] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateProblemForm>({ resolver: zodResolver(createProblemSchema) })

  const onSubmit = async (data: CreateProblemForm) => {
    try {
      await createProblemMutation.mutateAsync(data)
      toast.success("Problem created successfully!")
      setIsModalOpen(false)
      reset()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Failed to create problem")
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: "2rem auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <Link to="/instructor/dashboard" style={{ display: "inline-block", marginBottom: "0.5rem" }}>← Back to Dashboard</Link>
          <h1>Problem Bank</h1>
        </div>
        <button onClick={() => setIsModalOpen(true)}>Create Problem</button>
      </div>

      {isLoading ? (
        <p>Loading problems...</p>
      ) : problems && problems.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "1rem" }}>
          {problems.map((problem) => (
            <Link
              key={problem.problemId}
              to={`/instructor/problem/${problem.problemId}`}
              style={{
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div
                style={{
                  border: "1px solid #ccc",
                  borderRadius: "8px",
                  padding: "1rem",
                  background: "white",
                  cursor: "pointer",
                  transition: "box-shadow 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                  <h3 style={{ margin: 0 }}>{problem.title}</h3>
                  <span style={{
                    padding: "0.125rem 0.5rem",
                    borderRadius: "4px",
                    fontSize: "0.75rem",
                    fontWeight: "bold",
                    backgroundColor: problem.isValidated ? "#d4edda" : "#fff3cd",
                    color: problem.isValidated ? "#155724" : "#856404"
                  }}>
                    {problem.isValidated ? "✅ Validated" : "⚠️ Not Validated"}
                  </span>
                </div>
                <p style={{ margin: "0 0 0.5rem 0", color: "#666" }}>Language: {problem.language}</p>
                {problem.difficulty && (
                  <p style={{ margin: "0 0 0.5rem 0", color: "#666" }}>Difficulty: {problem.difficulty}</p>
                )}
                <p style={{ margin: 0, fontSize: "0.875rem", color: "#888" }}>Created: {new Date(problem.createdAt).toLocaleDateString()}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p>No problems yet.</p>
      )}

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
            minWidth: 500,
            maxHeight: "90vh",
            overflowY: "auto",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2>Create Problem</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ border: "none", background: "none", fontSize: "1.5rem", cursor: "pointer" }}>×</button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.25rem" }}>Title</label>
                <input {...register("title")} style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }} />
                {errors.title && <p style={{ color: "red", margin: "0.25rem 0 0 0" }}>{errors.title.message}</p>}
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.25rem" }}>Language</label>
                <input {...register("language")} style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }} />
                {errors.language && <p style={{ color: "red", margin: "0.25rem 0 0 0" }}>{errors.language.message}</p>}
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.25rem" }}>Difficulty (optional)</label>
                <input {...register("difficulty")} style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box" }} />
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.25rem" }}>Description (optional)</label>
                <textarea {...register("description")} style={{ width: "100%", padding: "0.5rem", minHeight: "100px", boxSizing: "border-box" }} />
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.25rem" }}>Starter Code (optional)</label>
                <textarea {...register("starterCode")} style={{ width: "100%", padding: "0.5rem", minHeight: "150px", fontFamily: "monospace", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" disabled={createProblemMutation.isPending}>
                  {createProblemMutation.isPending ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
