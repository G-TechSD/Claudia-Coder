import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import os from "os"

const CLAUDE_CONFIG_PATH = path.join(os.homedir(), ".claude", "claude_desktop_config.json")

export async function GET() {
  try {
    // Check if file exists
    try {
      await fs.access(CLAUDE_CONFIG_PATH)
    } catch {
      // File doesn't exist, return empty config
      return NextResponse.json({ mcpServers: {} })
    }

    // Read the config file
    const content = await fs.readFile(CLAUDE_CONFIG_PATH, "utf-8")
    const config = JSON.parse(content)

    return NextResponse.json(config)
  } catch (error) {
    console.error("Error reading Claude config:", error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to read config" },
      { status: 500 }
    )
  }
}
