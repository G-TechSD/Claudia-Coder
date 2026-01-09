import { NextResponse } from "next/server"
import { spawn } from "child_process"

export async function POST(request: Request) {
  try {
    const { command, args, env } = await request.json()

    if (!command) {
      return NextResponse.json(
        { success: false, message: "Command is required" },
        { status: 400 }
      )
    }

    // Test the connection by spawning the process and waiting for initialization
    const result = await testMCPConnection(command, args || [], env || {})

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error testing MCP connection:", error)
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to test connection"
    })
  }
}

async function testMCPConnection(
  command: string,
  args: string[],
  env: Record<string, string>
): Promise<{ success: boolean; message: string; tools?: string[] }> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      proc.kill()
      resolve({
        success: false,
        message: "Connection timed out after 10 seconds"
      })
    }, 10000)

    const proc = spawn(command, args, {
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"]
    })

    let stdout = ""
    let stderr = ""
    let initialized = false

    proc.stdout.on("data", (data) => {
      stdout += data.toString()

      // Try to parse JSON-RPC responses
      const lines = stdout.split("\n")
      for (const line of lines) {
        if (line.trim()) {
          try {
            const msg = JSON.parse(line)
            // Check for initialization response or tools list
            if (msg.result && (msg.result.capabilities || msg.result.tools)) {
              initialized = true
              clearTimeout(timeout)
              proc.kill()

              const tools = msg.result.tools?.map((t: { name: string }) => t.name) || []
              resolve({
                success: true,
                message: `Server responded successfully${tools.length > 0 ? ` with ${tools.length} tools` : ""}`,
                tools
              })
            }
          } catch {
            // Not a valid JSON line, continue
          }
        }
      }
    })

    proc.stderr.on("data", (data) => {
      stderr += data.toString()
    })

    proc.on("error", (err) => {
      clearTimeout(timeout)
      resolve({
        success: false,
        message: `Failed to start server: ${err.message}`
      })
    })

    proc.on("exit", (code) => {
      if (!initialized) {
        clearTimeout(timeout)
        if (code === 0) {
          resolve({
            success: true,
            message: "Server started successfully (process exited cleanly)"
          })
        } else {
          resolve({
            success: false,
            message: stderr || `Server exited with code ${code}`
          })
        }
      }
    })

    // Send MCP initialize request
    const initRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "claudia-admin",
          version: "1.0.0"
        }
      }
    }

    // Small delay to let the server start
    setTimeout(() => {
      try {
        proc.stdin.write(JSON.stringify(initRequest) + "\n")
      } catch {
        // Process may have already exited
      }
    }, 500)
  })
}
