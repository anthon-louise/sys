import { Navigate } from "react-router-dom"
import type { ReactNode } from "react"

import { useAuth } from "../context/auth-context"

interface ProtectedRouteProps {
  children: ReactNode
  allowedRoles?: string[]
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user } = useAuth()

  if (!user) return <Navigate to="/login" replace />

  if (allowedRoles && !allowedRoles.includes(user.roleName)) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}