/**
 * Better Auth Configuration
 * Server-side auth configuration with SQLite database
 */

import { betterAuth } from "better-auth"
import { db } from "./db"

export const auth = betterAuth({
  database: {
    type: "sqlite",
    db: db,
  },

  // Email/password authentication
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    requireEmailVerification: false, // Can enable later with email provider
  },

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes cache
    },
  },

  // OAuth providers
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      enabled: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    },
  },

  // Trust proxy for HTTPS
  trustedOrigins: [
    "https://localhost:3000",
    "https://localhost:3001",
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ].filter(Boolean),

  // User configuration
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
      },
      avatarUrl: {
        type: "string",
        required: false,
      },
    },
  },

})

// Export type for user
export type AuthUser = typeof auth.$Infer.Session.user
export type Session = typeof auth.$Infer.Session
