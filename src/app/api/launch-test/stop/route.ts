/**
 * Stop Application API
 * POST /api/launch-test/stop
 *
 * Can stop by:
 * - processId: Internal process ID
 * - projectId: Stop process for a specific project
 * - port: Stop whatever is running on a specific port (useful for orphaned processes)
 */

import { NextRequest, NextResponse } from "next/server"
import { ChildProcess, exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

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

/**
 * Check what's running on a port
 */
async function checkPort(port: number): Promise<{ inUse: boolean; pid?: string; command?: string }> {
  try {
    const { stdout } = await execAsync(`lsof -i :${port} -t`, { timeout: 5000 })
    const pid = stdout.trim().split("\n")[0]
    if (pid) {
      // Try to get the command
      try {
        const { stdout: cmdOut } = await execAsync(`ps -p ${pid} -o comm=`, { timeout: 2000 })
        return { inUse: true, pid, command: cmdOut.trim() }
      } catch {
        return { inUse: true, pid }
      }
    }
    return { inUse: false }
  } catch {
    return { inUse: false }
  }
}

/**
 * GET: Scan common ports for running processes
 */
export async function GET() {
  // Common ports used by dev servers
  const portsToCheck = [3001, 3002, 3003, 5000, 5001, 8000, 8001, 8080, 8081, 9000, 9001, 9020]

  const activeProcesses: Array<{
    port: number
    pid?: string
    command?: string
    tracked: boolean
    projectId?: string
  }> = []

  // Check each port
  for (const port of portsToCheck) {
    const result = await checkPort(port)
    if (result.inUse) {
      // Check if it's a tracked process
      let tracked = false
      let projectId: string | undefined

      const entries = Array.from(global.launchTestProcesses.entries())
      for (const [, info] of entries) {
        if (info.port === port) {
          tracked = true
          projectId = info.projectId
          break
        }
      }

      activeProcesses.push({
        port,
        pid: result.pid,
        command: result.command,
        tracked,
        projectId
      })
    }
  }

  // Also include tracked processes that might be on non-standard ports
  const entries = Array.from(global.launchTestProcesses.entries())
  for (const [, info] of entries) {
    if (!activeProcesses.find(p => p.port === info.port)) {
      const result = await checkPort(info.port)
      if (result.inUse) {
        activeProcesses.push({
          port: info.port,
          pid: result.pid,
          command: result.command,
          tracked: true,
          projectId: info.projectId
        })
      }
    }
  }

  // Sort by port
  activeProcesses.sort((a, b) => a.port - b.port)

  return NextResponse.json({
    processes: activeProcesses,
    trackedCount: global.launchTestProcesses.size
  })
}

/**
 * Kill process(es) running on a specific port
 */
async function killByPort(port: number): Promise<{ success: boolean; killed: number; error?: string }> {
  try {
    // Find PIDs using the port
    const { stdout } = await execAsync(`lsof -t -i :${port}`, { timeout: 5000 })
    const pids = stdout.trim().split("\n").filter(Boolean)

    if (pids.length === 0) {
      return { success: true, killed: 0 }
    }

    console.log(`[Stop] Found PIDs on port ${port}: ${pids.join(", ")}`)

    // Kill each PID
    let killed = 0
    for (const pid of pids) {
      try {
        await execAsync(`kill -TERM ${pid}`, { timeout: 5000 })
        killed++
        console.log(`[Stop] Killed PID ${pid}`)
      } catch (e) {
        // Try force kill
        try {
          await execAsync(`kill -9 ${pid}`, { timeout: 5000 })
          killed++
          console.log(`[Stop] Force killed PID ${pid}`)
        } catch {
          console.log(`[Stop] Failed to kill PID ${pid}`)
        }
      }
    }

    // Also clean up any tracked processes on this port
    const entries = Array.from(global.launchTestProcesses.entries())
    for (const [id, info] of entries) {
      if (info.port === port) {
        global.launchTestProcesses.delete(id)
        console.log(`[Stop] Removed tracked process ${id}`)
      }
    }

    return { success: true, killed }
  } catch (error) {
    // lsof returns error if nothing found on port
    if ((error as { code?: number }).code === 1) {
      return { success: true, killed: 0 }
    }
    return { success: false, killed: 0, error: (error as Error).message }
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { processId, projectId, port } = body

  // If port is specified, kill by port (useful for orphaned processes)
  if (port && typeof port === "number") {
    console.log(`[Stop] Stopping processes on port ${port}`)
    const result = await killByPort(port)
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.killed > 0 ? `Killed ${result.killed} process(es) on port ${port}` : `No processes found on port ${port}`
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || `Failed to stop processes on port ${port}`
      })
    }
  }

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
