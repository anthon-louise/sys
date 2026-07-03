import { createContext, useContext, useState, type ReactNode } from "react"

interface User {
  userId: number
  username: string
  email: string
  roleId: number
  roleName: string
  isActive: boolean
}

interface AuthContextValue {
  user: User | null
  setUser: (user: User | null) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(() => {
    const stored = localStorage.getItem("user")
    return stored ? JSON.parse(stored) : null
  })

  const setUser = (u: User | null) => {
    setUserState(u)
    if (u) localStorage.setItem("user", JSON.stringify(u))
    else localStorage.removeItem("user")
  }

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}