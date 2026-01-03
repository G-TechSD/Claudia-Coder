/**
 * NextAuth.js Configuration
 * OAuth providers for AI services: Google (Gemini), OpenAI, Anthropic
 */

import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import type { Provider } from "next-auth/providers"

// Custom OpenAI OAuth Provider
const OpenAIProvider: Provider = {
  id: "openai",
  name: "OpenAI",
  type: "oauth",
  authorization: {
    url: "https://auth.openai.com/authorize",
    params: {
      scope: "openid profile email",
      response_type: "code"
    }
  },
  token: "https://auth.openai.com/oauth/token",
  userinfo: "https://api.openai.com/v1/me",
  profile(profile) {
    return {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      image: profile.picture
    }
  },
  clientId: process.env.OPENAI_CLIENT_ID,
  clientSecret: process.env.OPENAI_CLIENT_SECRET
}

// Custom Anthropic OAuth Provider
const AnthropicProvider: Provider = {
  id: "anthropic",
  name: "Anthropic",
  type: "oauth",
  authorization: {
    url: "https://console.anthropic.com/oauth/authorize",
    params: {
      scope: "read:models write:messages",
      response_type: "code"
    }
  },
  token: "https://api.anthropic.com/oauth/token",
  userinfo: "https://api.anthropic.com/v1/me",
  profile(profile) {
    return {
      id: profile.id,
      name: profile.name || profile.email,
      email: profile.email,
      image: null
    }
  },
  clientId: process.env.ANTHROPIC_CLIENT_ID,
  clientSecret: process.env.ANTHROPIC_CLIENT_SECRET
}

// Build providers list based on available credentials
function getProviders(): Provider[] {
  const providers: Provider[] = []

  // Google provider for Google AI (Gemini)
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        authorization: {
          params: {
            scope: "openid email profile https://www.googleapis.com/auth/generative-language.retriever",
            access_type: "offline",
            prompt: "consent"
          }
        }
      })
    )
  }

  // OpenAI provider
  if (process.env.OPENAI_CLIENT_ID && process.env.OPENAI_CLIENT_SECRET) {
    providers.push(OpenAIProvider)
  }

  // Anthropic provider
  if (process.env.ANTHROPIC_CLIENT_ID && process.env.ANTHROPIC_CLIENT_SECRET) {
    providers.push(AnthropicProvider)
  }

  return providers
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: getProviders(),
  callbacks: {
    async jwt({ token, account }) {
      // Persist the OAuth access_token and refresh_token to the JWT
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.provider = account.provider
        token.expiresAt = account.expires_at
      }
      return token
    },
    async session({ session, token }) {
      // Send properties to the client
      session.accessToken = token.accessToken as string
      session.provider = token.provider as string
      return session
    }
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error"
  }
})

// Extend the Session type
declare module "next-auth" {
  interface Session {
    accessToken?: string
    provider?: string
  }
}
