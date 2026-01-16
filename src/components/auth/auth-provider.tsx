"use client"

import * as React from "react"
import { useSession } from "@/lib/auth/client"

// TEMPORARY: Force bypass mode for beta testing
// TODO: Remove this and restore env var checks before production release
// The middleware is also bypassing auth (see src/middleware.ts line ~196)
const AUTH_BYPASS_MODE = true

// Original check (restore when beta testing is complete):
// const AUTH_BYPASS_MODE =
//   process.env.NEXT_PUBLIC_BETA_AUTH_BYPASS === "true" ||
//   process.env.NODE_ENV === "development"

// Mock session for bypass mode (dev or beta testing)
const BYPASS_SESSION = {
  user: {
    id: "beta-admin",
    name: "Beta Tester",
    email: "beta@claudiacoder.com",
    image: null,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  session: {
    id: "bypass-session",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    token: "bypass-session-token",
    ipAddress: "127.0.0.1",
    userAgent: "Auth Bypass Mode",
  },
}

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
  const { data: realSession, isPending } = useSession()
  const [userRole, setUserRole] = React.useState<string | null>(null)
  const [betaLimits, setBetaLimits] = React.useState<BetaLimits | null>(null)
  const [roleSynced, setRoleSynced] = React.useState(false)

  // Use dev bypass session if no real session and in dev mode
  const session = realSession || (AUTH_BYPASS_MODE ? BYPASS_SESSION : null)

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

  // In dev bypass mode with no real session, skip the loading state
  const isLoading = AUTH_BYPASS_MODE && !realSession ? false : isPending

  const value = React.useMemo<AuthContextType>(() => ({
    user: session?.user ? {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
      role: userRole || (AUTH_BYPASS_MODE ? "admin" : undefined),
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
        role: userRole || (AUTH_BYPASS_MODE ? "admin" : undefined),
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
    isLoading,
    isAuthenticated: !!session?.user,
    isBetaTester,
    betaLimits,
    refreshBetaLimits,
  }), [session, isLoading, userRole, isBetaTester, betaLimits, refreshBetaLimits])

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
