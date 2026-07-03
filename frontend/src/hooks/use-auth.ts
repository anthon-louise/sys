import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/auth-context"
import type { LoginForm } from "../schemas/auth.schema"

import { api } from "../lib/api"
import type { RegisterForm } from "../schemas/auth.schema"

// Hook for handling user registration
export function useRegister() {
  return useMutation({
    mutationFn: async (data: RegisterForm) => {
      const res = await api.post("/auth/register", data)
      return res.data.data
    },
  })
}

// Hook for handling user login
export function useLogin() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: async (data: LoginForm) => {
      const res = await api.post("/auth/login", data)
      return res.data.data
    },
    onSuccess: (user) => {
      setUser(user)
      if (user.roleName === "instructor") {
        navigate("/instructor/dashboard")
      } else {
        navigate("/student/dashboard")
      }
    },
  })
}

// Hook for handling user logout
export function useLogout() {
  const { setUser } = useAuth()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async () => {
      await api.post("/auth/logout")
    },
    onSuccess: () => {
      setUser(null)
      navigate("/login")
    },
  })
}