"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { CommandPalette } from "@/components/command-palette"
import { GlobalVoiceButton } from "@/components/voice/global-voice-button"
import { SetupWizard } from "@/components/setup/setup-wizard"
import { isSetupComplete } from "@/lib/settings/global-settings"

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [showSetup, setShowSetup] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Check if setup is complete
    if (!isSetupComplete()) {
      setShowSetup(true)
    }
  }, [])

  // Don't render until mounted to avoid hydration issues
  if (!mounted) {
    return null
  }

  // Show setup wizard if not complete
  if (showSetup) {
    return <SetupWizard onComplete={() => setShowSetup(false)} />
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
      <CommandPalette />
      <GlobalVoiceButton />
    </div>
  )
}
