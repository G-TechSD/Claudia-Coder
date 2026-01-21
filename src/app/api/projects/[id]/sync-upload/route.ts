/**
 * Sync Upload to Working Directory API
 *
 * POST /api/projects/[id]/sync-upload
 *
 * Saves an uploaded file to the project's working directory
 * so it appears in the Browse Files section.
 */

import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import os from "os"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * Expand ~ to home directory
 */
function expandPath(p: string): string {
  if (!p) return p
  return p.replace(/^~/, os.homedir())
}

/**
 * POST /api/projects/[id]/sync-upload
 *
 * Saves uploaded file content to .claudia/uploads/ in the working directory
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: projectId } = await params

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      )
    }

    const formData = await request.formData()
    const workingDirectory = formData.get("workingDirectory") as string
    const file = formData.get("file") as File
    const fileName = formData.get("fileName") as string

    if (!workingDirectory) {
      return NextResponse.json(
        { error: "workingDirectory is required" },
        { status: 400 }
      )
    }

    if (!file || !fileName) {
      return NextResponse.json(
        { error: "file and fileName are required" },
        { status: 400 }
      )
    }

    const targetDir = expandPath(workingDirectory)
    const uploadsDir = path.join(targetDir, ".claudia", "uploads")

    // Create uploads directory if it doesn't exist
    await fs.mkdir(uploadsDir, { recursive: true })

    // Sanitize filename (remove path traversal attempts)
    const sanitizedName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_")
    const filePath = path.join(uploadsDir, sanitizedName)

    // Write the file
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    await fs.writeFile(filePath, buffer)

    console.log(`[sync-upload] Saved file to: ${filePath}`)

    return NextResponse.json({
      success: true,
      projectId,
      filePath,
      relativePath: `.claudia/uploads/${sanitizedName}`,
      size: buffer.length
    })
  } catch (error) {
    console.error("[sync-upload] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    )
  }
}
