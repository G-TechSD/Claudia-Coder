"use client"

import { useParams } from "next/navigation"
import { PoppedOutTerminal } from "@/components/claude-code/multi/popped-out-terminal"

export default function PopOutPage() {
  const params = useParams()
  const terminalId = params.id as string

  if (!terminalId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Invalid terminal ID</p>
      </div>
    )
  }

  return <PoppedOutTerminal terminalId={terminalId} />
}
