/**
 * Stop Application API
 * POST /api/launch-test/stop
 */

import { NextRequest, NextResponse } from "next/server"
import { ChildProcess } from "child_process"

// Reference the global process store from start/route.ts
declare global {
   
  var launchTestProcesses: Map<string, {
    process: ChildProcess
    projectId: string
    port: number
    startedAt: Date
  }>
}

if (!global.launchTestProcesses) {
  global.launchTestProcesses = new Map()
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { processId, projectId } = body

  // Find process by ID or project ID
  let targetProcessId = processId
  let processInfo = processId ? global.launchTestProcesses.get(processId) : null

  if (!processInfo && projectId) {
    const entries = Array.from(global.launchTestProcesses.entries())
    for (const [id, info] of entries) {
      if (info.projectId === projectId) {
        targetProcessId = id
        processInfo = info
        break
      }
    }
  }

  if (!processInfo) {
    return NextResponse.json({
      success: false,
      error: "Process not found"
    })
  }

  try {
    console.log(`[Stop] Stopping process ${targetProcessId} (PID: ${processInfo.process.pid})`)

    // Try graceful shutdown first
    if (processInfo.process.pid) {
      try {
        // Kill the process group (negative PID)
        process.kill(-processInfo.process.pid, "SIGTERM")
      } catch {
        // If that fails, try killing just the process
        try {
          processInfo.process.kill("SIGTERM")
        } catch {
          // Ignore
        }
      }
    }

    // Wait a moment for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Force kill if still running
    if (processInfo.process.pid && !processInfo.process.killed) {
      try {
        process.kill(-processInfo.process.pid, "SIGKILL")
      } catch {
        try {
          processInfo.process.kill("SIGKILL")
        } catch {
          // Ignore
        }
      }
    }

    // Remove from tracking
    global.launchTestProcesses.delete(targetProcessId)

    console.log(`[Stop] Process ${targetProcessId} stopped`)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error(`[Stop] Error stopping process:`, error)

    // Try to clean up anyway
    global.launchTestProcesses.delete(targetProcessId)

    return NextResponse.json({
      success: true, // Report success since we cleaned up the tracking
      warning: error instanceof Error ? error.message : "Process may still be running"
    })
  }
}
