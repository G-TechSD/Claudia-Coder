/**
 * Better Auth Client
 * Client-side auth utilities for React components
 */

import { createAuthClient } from "better-auth/react"

// Create the auth client
export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "",
})

// Export commonly used hooks and utilities
export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
} = authClient
