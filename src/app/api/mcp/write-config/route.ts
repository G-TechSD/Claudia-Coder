import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import os from "os"

const CLAUDE_DIR = path.join(os.homedir(), ".claude")
const CLAUDE_CONFIG_PATH = path.join(CLAUDE_DIR, "claude_desktop_config.json")

export async function POST(request: Request) {
  try {
    const newConfig = await request.json()

    // Ensure .claude directory exists
    try {
      await fs.access(CLAUDE_DIR)
    } catch {
      await fs.mkdir(CLAUDE_DIR, { recursive: true })
    }

    // Read existing config if it exists
    let existingConfig = {}
    try {
      const content = await fs.readFile(CLAUDE_CONFIG_PATH, "utf-8")
      existingConfig = JSON.parse(content)
    } catch {
      // File doesn't exist or is invalid, start fresh
    }

    // Merge the new MCP servers with existing config
    // This preserves other settings in the config file
    const mergedConfig = {
      ...existingConfig,
      mcpServers: newConfig.mcpServers
    }

    // Write the config file with pretty formatting
    await fs.writeFile(
      CLAUDE_CONFIG_PATH,
      JSON.stringify(mergedConfig, null, 2),
      "utf-8"
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error writing Claude config:", error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to write config" },
      { status: 500 }
    )
  }
}
