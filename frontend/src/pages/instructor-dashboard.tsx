import { useAuth } from "../context/auth-context"
import { useLogout } from "../hooks/use-auth"

export default function InstructorDashboard() {
  const { user } = useAuth()
  const logoutMutation = useLogout()

  return (
    <div>
      <h1>Instructor Dashboard</h1>
      <p>Welcome, {user?.username}</p>
      <button onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}>
        {logoutMutation.isPending ? "Logging out..." : "Logout"}
      </button>
    </div>
  )
}