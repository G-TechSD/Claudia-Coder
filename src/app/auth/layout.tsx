/**
 * Auth Layout
 * Clean layout for login and signup pages without the sidebar
 */

import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Sign In - Claudia Coder",
  description: "Sign in to Claudia Coder",
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 mb-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl overflow-hidden bg-gradient-to-br from-green-400/20 to-blue-500/20 shadow-lg">
          <Image
            src="/claudia-logo.jpg"
            alt="Claudia Coder"
            width={48}
            height={48}
            className="h-12 w-12 object-cover"
          />
        </div>
        <span className="text-2xl font-bold tracking-tight bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
          Claudia Coder
        </span>
      </Link>

      {/* Auth Card */}
      <div className="w-full max-w-md">
        <div className="rounded-xl border bg-card shadow-xl p-8">
          {children}
        </div>
      </div>

      {/* Footer */}
      <p className="mt-8 text-sm text-muted-foreground">
        Dev Agent Orchestrator
      </p>
    </div>
  )
}
