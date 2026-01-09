"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { CommandPalette } from "@/components/command-palette"
import { GlobalVoiceButton } from "@/components/voice/global-voice-button"
import { useAuth } from "@/components/auth/auth-provider"

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const { isAuthenticated, isLoading } = useAuth()

  // Check if we're on an auth route (login, signup, etc.)
  const isAuthRoute = pathname?.startsWith("/auth")

  // Show sidebar only when authenticated and not on auth routes
  const showSidebar = isAuthenticated && !isAuthRoute

  useEffect(() => {
    setMounted(true)
  }, [])

  // If on auth route, render without sidebar (auth layout handles its own styling)
  if (isAuthRoute) {
    return <>{children}</>
  }

  // If not authenticated and not on auth route, show just the content
  // (this prevents sidebar flash while redirecting to login)
  if (!isLoading && !isAuthenticated) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    )
  }

  // Render the layout structure immediately to prevent black screen
  // Only conditionally render client-only components (CommandPalette, GlobalVoiceButton)
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {showSidebar && <Sidebar />}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
      {mounted && showSidebar && (
        <>
          <CommandPalette />
          <GlobalVoiceButton />
        </>
      )}
    </div>
  )
}
