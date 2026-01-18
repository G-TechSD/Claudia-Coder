/**
 * Better Auth Client
 * Client-side auth utilities for React components
 * Includes 2FA (TOTP) client support
 */

import { createAuthClient } from "better-auth/react"
import { twoFactorClient } from "better-auth/client/plugins"

// Create the auth client with 2FA support
// Session polling is DISABLED to prevent automatic page refresh
export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "",
  // Disable all automatic session refresh behaviors
  // This prevents the page from auto-refreshing every 60 seconds
  sessionOptions: {
    // Do not poll for session updates (0 = disabled)
    refetchInterval: 0,
    // Do not refetch session when window regains focus
    refetchOnWindowFocus: false,
    // Do not refetch when coming back online
    refetchWhenOffline: false,
  },
  plugins: [
    // Two-Factor Authentication client
    twoFactorClient({
      // Redirect callback when 2FA verification is required
      onTwoFactorRedirect: () => {
        if (typeof window !== "undefined") {
          window.location.href = "/auth/two-factor"
        }
      },
    }),
    // Note: Passkey client requires additional setup with @better-auth/passkey/client
    // To enable passkeys, install: npm install @better-auth/passkey
    // Then add: passkeyClient()
  ],
})

// Export commonly used hooks and utilities
export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
} = authClient

// Export 2FA utilities
export const {
  twoFactor,
} = authClient
