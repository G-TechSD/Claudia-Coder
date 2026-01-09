"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { CommandPalette } from "@/components/command-palette"
import { GlobalVoiceButton } from "@/components/voice/global-voice-button"

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Render the layout structure immediately to prevent black screen
  // Only conditionally render client-only components (CommandPalette, GlobalVoiceButton)
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
      {mounted && (
        <>
          <CommandPalette />
          <GlobalVoiceButton />
        </>
      )}
    </div>
  )
}
