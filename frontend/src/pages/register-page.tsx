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
    <div style={{ maxWidth: 400, margin: "2rem auto" }}>
      <h1>Register</h1>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label>Username</label>
          <input {...register("username")} />
          {errors.username && <p>{errors.username.message}</p>}
        </div>
        <br />
        <div>
          <label>Email</label>
          <input {...register("email")} />
          {errors.email && <p>{errors.email.message}</p>}
        </div>
        <br />
        <div>
          <label>Password</label>
          <input type="password" {...register("password")} />
          {errors.password && <p>{errors.password.message}</p>}
        </div>
        <br />
        <div>
          <label>Role</label>
          <select {...register("roleName")}>
            <option value="student">Student</option>
            <option value="instructor">Instructor</option>
          </select>
        </div>
        <br />
        <button type="submit" disabled={registerMutation.isPending}>
          {registerMutation.isPending ? "Creating..." : "Register"}
        </button>
      </form>
    </div>
  )
}