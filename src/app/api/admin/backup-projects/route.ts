/**
 * API route to backup all projects to a markdown file
 *
 * POST - Save backup data to a file
 * Body: { data: string, outputPath: string }
 */

import { NextRequest, NextResponse } from "next/server"
import * as fs from "fs/promises"
import * as path from "path"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { data, outputPath } = body

    if (!data || !outputPath) {
      return NextResponse.json(
        { error: "Missing required fields: data and outputPath" },
        { status: 400 }
      )
    }

    // Ensure the directory exists
    const dir = path.dirname(outputPath)
    await fs.mkdir(dir, { recursive: true })

    // Write the backup file
    await fs.writeFile(outputPath, data, "utf-8")

    console.log(`[backup-projects] Backup saved to: ${outputPath}`)

    return NextResponse.json({
      success: true,
      outputPath,
      size: data.length
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save backup"
    console.error("[backup-projects] Error:", message)

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
