"use client"

import { useState, useEffect, createContext, useContext, useCallback, useMemo, type ReactNode } from "react"

// TEMPORARY: Force bypass mode for beta testing
// TODO: Remove this and restore env var checks before production release
// The middleware is also bypassing auth (see src/middleware.ts line ~196)
const AUTH_BYPASS_MODE = true

// Since we're in bypass mode, we don't need the real useSession hook
// This prevents the SSR/build issues completely
// When bypass mode is disabled, uncomment the import below
// import { useSession } from "@/lib/auth/client"

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

// Default context value for SSR - no auth state
const defaultAuthContext: AuthContextType = {
  user: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,
  isBetaTester: false,
  betaLimits: null,
  refreshBetaLimits: async () => {},
}

// Bypass auth context - used in bypass mode
const bypassAuthContext: AuthContextType = {
  user: {
    id: BYPASS_SESSION.user.id,
    name: BYPASS_SESSION.user.name,
    email: BYPASS_SESSION.user.email,
    image: BYPASS_SESSION.user.image,
    role: "admin",
    emailVerified: BYPASS_SESSION.user.emailVerified,
    createdAt: BYPASS_SESSION.user.createdAt,
    updatedAt: BYPASS_SESSION.user.updatedAt,
  },
  session: {
    user: {
      id: BYPASS_SESSION.user.id,
      name: BYPASS_SESSION.user.name,
      email: BYPASS_SESSION.user.email,
      image: BYPASS_SESSION.user.image,
      role: "admin",
      emailVerified: BYPASS_SESSION.user.emailVerified,
      createdAt: BYPASS_SESSION.user.createdAt,
      updatedAt: BYPASS_SESSION.user.updatedAt,
    },
    session: {
      id: BYPASS_SESSION.session.id,
      expiresAt: BYPASS_SESSION.session.expiresAt,
      token: BYPASS_SESSION.session.token,
      ipAddress: BYPASS_SESSION.session.ipAddress,
      userAgent: BYPASS_SESSION.session.userAgent,
    },
  },
  isLoading: false,
  isAuthenticated: true,
  isBetaTester: false,
  betaLimits: null,
  refreshBetaLimits: async () => {},
}

const AuthContext = createContext<AuthContextType>(defaultAuthContext)

// Inner component that uses hooks - only rendered on client
function AuthProviderClient({ children }: { children: ReactNode }) {
  const [userRole, setUserRole] = useState<string | null>(null)
  const [betaLimits, setBetaLimits] = useState<BetaLimits | null>(null)
  const [roleSynced, setRoleSynced] = useState(false)

  // Since AUTH_BYPASS_MODE is true, skip the real session hook
  // This prevents SSR/build issues completely
  // When bypass mode is disabled, restore: const { data: realSession, isPending } = useSession()
  const realSession = null
  const isPending = false

  // DEBUG: Log auth state on every render
  console.log(`[AuthProvider] Render - isPending: ${isPending}, AUTH_BYPASS_MODE: ${AUTH_BYPASS_MODE}, realSession: ${realSession ? 'exists' : 'null'}`)

  // Use dev bypass session if no real session and in dev mode
  const session = realSession || (AUTH_BYPASS_MODE ? BYPASS_SESSION : null)

  console.log(`[AuthProvider] Session resolved - userId: ${session?.user?.id}, sessionExists: ${!!session}`)

  // Sync role cookie when session changes
  useEffect(() => {
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

  const fetchBetaLimits = useCallback(async () => {
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

  const refreshBetaLimits = useCallback(async () => {
    if (userRole === "beta" || userRole === "beta_tester") {
      await fetchBetaLimits()
    }
  }, [userRole, fetchBetaLimits])

  const isBetaTester = userRole === "beta" || userRole === "beta_tester"

  // In dev bypass mode with no real session, skip the loading state
  const isLoading = AUTH_BYPASS_MODE && !realSession ? false : isPending

  console.log(`[AuthProvider] isLoading computed: ${isLoading} (AUTH_BYPASS_MODE: ${AUTH_BYPASS_MODE}, realSession: ${!!realSession}, isPending: ${isPending})`)

  const value = useMemo<AuthContextType>(() => {
    console.log(`[AuthProvider] useMemo - computing context value with userId: ${session?.user?.id}, isLoading: ${isLoading}`)
    return {
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
  }
  }, [session, isLoading, userRole, isBetaTester, betaLimits, refreshBetaLimits])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// Main AuthProvider - checks for SSR and uses appropriate implementation
export function AuthProvider({ children }: { children: ReactNode }) {
  // During SSR/prerendering, provide static context to avoid hooks
  // This check runs before any hooks are called
  if (typeof window === "undefined") {
    // Server-side: use bypass context directly without hooks
    return (
      <AuthContext.Provider value={AUTH_BYPASS_MODE ? bypassAuthContext : defaultAuthContext}>
        {children}
      </AuthContext.Provider>
    )
  }

  // Client-side: use the full implementation with hooks
  return <AuthProviderClient>{children}</AuthProviderClient>
}

export function useAuth() {
  const context = useContext(AuthContext)
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

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = "/auth/login"
    }
  }, [isLoading, isAuthenticated])

  return { user, isLoading }
}
