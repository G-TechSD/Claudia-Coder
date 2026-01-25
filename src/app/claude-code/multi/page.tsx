"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// Redirect to main Claude Code page with multi-terminal tab
export default function MultiTerminalRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/claude-code")
  }, [router])

  return null
}
