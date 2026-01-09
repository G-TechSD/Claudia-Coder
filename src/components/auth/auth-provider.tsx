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

interface BetaLimits {
  canCreateProject: boolean
  canExecute: boolean
  remaining: {
    projects: number
    executions: number
  }
  current: {
    projects: number
    executions: number
  }
  limits: {
    projects: number
    executions: number
  }
}

interface AuthContextType {
  user: User | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
  isBetaTester: boolean
  betaLimits: BetaLimits | null
  refreshBetaLimits: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,
  isBetaTester: false,
  betaLimits: null,
  refreshBetaLimits: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession()
  const [userRole, setUserRole] = React.useState<string | null>(null)
  const [betaLimits, setBetaLimits] = React.useState<BetaLimits | null>(null)
  const [roleSynced, setRoleSynced] = React.useState(false)

  // Sync role cookie when session changes
  React.useEffect(() => {
    const syncRole = async () => {
      if (session?.user && !roleSynced) {
        try {
          const response = await fetch("/api/beta/sync-role", {
            method: "POST",
          })
          if (response.ok) {
            const data = await response.json()
            setUserRole(data.role)
            setRoleSynced(true)

            // If beta tester, fetch limits
            if (data.role === "beta" || data.role === "beta_tester") {
              fetchBetaLimits()
            }
          }
        } catch (error) {
          console.error("Failed to sync role:", error)
        }
      } else if (!session?.user) {
        // Clear role when logged out
        setUserRole(null)
        setBetaLimits(null)
        setRoleSynced(false)
        // Clear the role cookie
        fetch("/api/beta/sync-role", { method: "DELETE" }).catch(() => {})
      }
    }

    syncRole()
  }, [session?.user, roleSynced])

  const fetchBetaLimits = React.useCallback(async () => {
    try {
      const response = await fetch("/api/beta/limits")
      if (response.ok) {
        const data = await response.json()
        if (data.isBetaTester && data.limits) {
          setBetaLimits(data.limits)
        }
      }
    } catch (error) {
      console.error("Failed to fetch beta limits:", error)
    }
  }, [])

  const refreshBetaLimits = React.useCallback(async () => {
    if (userRole === "beta" || userRole === "beta_tester") {
      await fetchBetaLimits()
    }
  }, [userRole, fetchBetaLimits])

  const isBetaTester = userRole === "beta" || userRole === "beta_tester"

  const value = React.useMemo<AuthContextType>(() => ({
    user: session?.user ? {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
      role: userRole || undefined,
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
        role: userRole || undefined,
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
    isBetaTester,
    betaLimits,
    refreshBetaLimits,
  }), [session, isPending, userRole, isBetaTester, betaLimits, refreshBetaLimits])

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
