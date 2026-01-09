"use client"

import * as React from "react"
import { useSession } from "@/lib/auth/client"

// User type matching Better Auth
export interface User {
  id: string
  name: string
  email: string
  image?: string | null
  role?: string
  avatarUrl?: string | null
  emailVerified?: boolean
  createdAt?: Date
  updatedAt?: Date
}

export interface SessionData {
  id: string
  expiresAt: Date
  token: string
  ipAddress?: string | null
  userAgent?: string | null
}

export interface Session {
  user: User
  session: SessionData
}

interface AuthContextType {
  user: User | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
}

const AuthContext = React.createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession()

  const value = React.useMemo<AuthContextType>(() => ({
    user: session?.user ? {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
      emailVerified: session.user.emailVerified,
      createdAt: session.user.createdAt,
      updatedAt: session.user.updatedAt,
    } : null,
    session: session ? {
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        emailVerified: session.user.emailVerified,
        createdAt: session.user.createdAt,
        updatedAt: session.user.updatedAt,
      },
      session: {
        id: session.session.id,
        expiresAt: session.session.expiresAt,
        token: session.session.token,
        ipAddress: session.session.ipAddress,
        userAgent: session.session.userAgent,
      },
    } : null,
    isLoading: isPending,
    isAuthenticated: !!session?.user,
  }), [session, isPending])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export function useUser() {
  const { user } = useAuth()
  return user
}

export function useRequireAuth() {
  const { user, isLoading, isAuthenticated } = useAuth()

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = "/auth/login"
    }
  }, [isLoading, isAuthenticated])

  return { user, isLoading }
}
