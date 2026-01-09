/**
 * Better Auth Configuration
 * Server-side auth configuration with SQLite database
 * Includes 2FA (TOTP, Email OTP) and Passkey support
 */

import { betterAuth } from "better-auth"
import { twoFactor } from "better-auth/plugins"
import { db } from "./db"

export const auth = betterAuth({
  // App name used as issuer for TOTP authenticator apps
  appName: "Claudia Admin",

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

  // OAuth providers - disabled, email/password only
  // socialProviders: {
  //   google: {
  //     clientId: process.env.GOOGLE_CLIENT_ID || "",
  //     clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  //     enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  //   },
  //   github: {
  //     clientId: process.env.GITHUB_CLIENT_ID || "",
  //     clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
  //     enabled: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
  //   },
  // },

  // Trust localhost origins (both HTTP and HTTPS)
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://localhost:3000",
    "https://localhost:3001",
    "https://bill-dev-linux-1:3000",
    "http://bill-dev-linux-1:3000",
    "https://preview.claudiacoder.com",
    "http://preview.claudiacoder.com",
    "https://preview.claudiacode.com",
    "http://preview.claudiacode.com",
    "https://claudiacoder.com",
    "https://claudiacode.com",
    process.env.NEXT_PUBLIC_APP_URL,
  ].filter(Boolean) as string[],

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

  // Plugins for 2FA
  plugins: [
    // Two-Factor Authentication (TOTP + Backup Codes)
    twoFactor({
      // Issuer name shown in authenticator apps (uses appName by default)
      issuer: "Claudia Admin",
      // Number of backup codes to generate
      backupCodes: {
        length: 10,
        // Backup code character length
        characters: 8,
      },
      // TOTP configuration
      totpOptions: {
        // Time period for TOTP codes (in seconds)
        period: 30,
        // Number of digits in TOTP code
        digits: 6,
      },
      // Skip verification step when enabling (require user to verify code first)
      skipVerificationOnEnable: false,
    }),
    // Note: Passkey/WebAuthn plugin requires additional setup with @better-auth/passkey
    // To enable passkeys, install: npm install @better-auth/passkey
    // Then add: passkey({ rpID: "localhost", rpName: "Claudia Admin" })
  ],
})

// Export type for user
export type AuthUser = typeof auth.$Infer.Session.user
export type Session = typeof auth.$Infer.Session
