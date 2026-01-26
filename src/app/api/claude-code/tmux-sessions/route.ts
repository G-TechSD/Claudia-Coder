import { NextRequest, NextResponse } from "next/server"
import {
  isTmuxAvailable,
  getTmuxSessionsInfo,
  listClaudeCodeTmuxSessions,
  killTmuxSession,
  killAllTmuxSessions,
  tmuxSessionExists,
} from "@/lib/claude-code/tmux-utils"

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET - List all tmux sessions with detailed info
 */
export async function GET() {
  try {
    const tmuxAvailable = isTmuxAvailable()

    if (!tmuxAvailable) {
      return NextResponse.json({
        tmuxAvailable: false,
        tmuxSessions: [],
        activeTerminals: [],
      })
    }

    const tmuxSessions = getTmuxSessionsInfo()
    const sessionNames = listClaudeCodeTmuxSessions()

    return NextResponse.json({
      tmuxAvailable: true,
      tmuxSessions,
      sessionNames,
      count: tmuxSessions.length,
    })
  } catch (error) {
    console.error("[claude-code/tmux-sessions] Error listing sessions:", error)
    return NextResponse.json(
      { error: "Failed to list tmux sessions" },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Kill tmux session(s)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tmuxName = searchParams.get("tmuxName")
    const killAll = searchParams.get("all") === "true"

    if (!isTmuxAvailable()) {
      return NextResponse.json(
        { error: "tmux is not available" },
        { status: 400 }
      )
    }

    if (killAll) {
      // Kill all claude-code tmux sessions
      const killed = killAllTmuxSessions()
      console.log(`[claude-code/tmux-sessions] Killed ${killed} tmux sessions`)
      return NextResponse.json({
        killed,
        message: `Killed ${killed} tmux sessions`,
      })
    }

    if (tmuxName) {
      // Kill specific tmux session by name
      if (!tmuxSessionExists(tmuxName)) {
        return NextResponse.json(
          { error: `tmux session '${tmuxName}' not found` },
          { status: 404 }
        )
      }
      const killed = killTmuxSession(tmuxName)
      return NextResponse.json({
        killed,
        tmuxName,
        message: killed ? `Killed tmux session: ${tmuxName}` : `Failed to kill: ${tmuxName}`,
      })
    }

    return NextResponse.json(
      { error: "Either 'tmuxName' or 'all=true' is required" },
      { status: 400 }
    )
  } catch (error) {
    console.error("[claude-code/tmux-sessions] Error deleting session:", error)
    return NextResponse.json(
      { error: "Failed to delete tmux session" },
      { status: 500 }
    )
  }
}
