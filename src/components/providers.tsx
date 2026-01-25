"use client"

import * as React from "react"
import { AuthProvider } from "@/components/auth/auth-provider"
import { MigrationProvider } from "@/components/data/migration-provider"

/**
 * Client-side providers wrapper
 * This component wraps all context providers that need to run on the client
 * Being a client component, it can safely use hooks and browser APIs
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <MigrationProvider>
        {children}
      </MigrationProvider>
    </AuthProvider>
  )
}
