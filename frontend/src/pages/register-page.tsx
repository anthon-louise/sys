import { Link } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { useRegister } from "../hooks/use-auth"
import { registerSchema, type RegisterForm } from "../schemas/auth.schema"

export default function RegisterPage() {
  const registerMutation = useRegister()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { roleName: "student" },
  })

  const onSubmit = async (data: RegisterForm) => {
    try {
      await registerMutation.mutateAsync(data)
      toast.success("Account created successfully")
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Registration failed")
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Register</h1>

        <form onSubmit={handleSubmit(onSubmit)} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Username</label>
            <input {...register("username")} style={styles.input} placeholder="johndoe" />
            {errors.username && <p style={styles.error}>{errors.username.message}</p>}
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input {...register("email")} type="email" style={styles.input} placeholder="you@example.com" />
            {errors.email && <p style={styles.error}>{errors.email.message}</p>}
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input {...register("password")} type="password" style={styles.input} placeholder="••••••••" />
            {errors.password && <p style={styles.error}>{errors.password.message}</p>}
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Role</label>
            <select {...register("roleName")} style={styles.select}>
              <option value="student">Student</option>
              <option value="instructor">Instructor</option>
            </select>
            {errors.roleName && <p style={styles.error}>{errors.roleName.message}</p>}
          </div>

          <button type="submit" disabled={registerMutation.isPending} style={styles.btn}>
            {registerMutation.isPending ? "Creating account..." : "Register"}
          </button>
        </form>

        <p style={styles.footer}>
          Already have an account?{" "}
          <Link to="/login" style={styles.link}>
            Login
          </Link>
        </p>
        <p style={styles.footer}>
          <Link to="/" style={styles.link}>
            ← Back
          </Link>
        </p>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f5f5",
  },
  card: {
    background: "#fff",
    borderRadius: "10px",
    border: "1px solid #e0e0e0",
    padding: "2.5rem",
    width: "100%",
    maxWidth: "380px",
  },
  title: {
    margin: "0 0 1.5rem 0",
    fontSize: "1.75rem",
    fontWeight: 700,
    color: "#1a1a1a",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
  },
  label: {
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#333",
  },
  input: {
    padding: "0.6rem 0.75rem",
    fontSize: "1rem",
    border: "1px solid #d0d0d0",
    borderRadius: "6px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  select: {
    padding: "0.6rem 0.75rem",
    fontSize: "1rem",
    border: "1px solid #d0d0d0",
    borderRadius: "6px",
    backgroundColor: "#fff",
    width: "100%",
    boxSizing: "border-box",
  },
  error: {
    margin: 0,
    fontSize: "0.8rem",
    color: "#dc3545",
  },
  btn: {
    marginTop: "0.5rem",
    padding: "0.75rem",
    fontSize: "1rem",
    fontWeight: 500,
    backgroundColor: "#1a1a1a",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    width: "100%",
  },
  footer: {
    marginTop: "1rem",
    fontSize: "0.875rem",
    color: "#555",
    textAlign: "center",
  },
  link: {
    color: "#1a1a1a",
    fontWeight: 500,
  },
}