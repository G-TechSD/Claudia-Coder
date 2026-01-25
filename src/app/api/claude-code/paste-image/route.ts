import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import os from "os"

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Directory for pasted images
const PASTE_DIR = path.join(os.homedir(), ".claudia", "pasted-images")

/**
 * POST - Save a pasted image and return its path
 *
 * Request body should be:
 * {
 *   image: string (base64 encoded image data with data URL prefix)
 *   workingDirectory?: string (optional - save relative to this directory)
 *   filename?: string (optional custom filename)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { image, workingDirectory, filename } = body

    if (!image) {
      return NextResponse.json(
        { error: "Image data is required" },
        { status: 400 }
      )
    }

    // Parse the data URL to extract mime type and base64 data
    const match = image.match(/^data:image\/([\w+]+);base64,(.+)$/)
    if (!match) {
      return NextResponse.json(
        { error: "Invalid image data format. Expected base64 data URL." },
        { status: 400 }
      )
    }

    const mimeType = match[1]
    const base64Data = match[2]

    // Map mime types to file extensions
    const extMap: Record<string, string> = {
      png: "png",
      jpeg: "jpg",
      jpg: "jpg",
      gif: "gif",
      webp: "webp",
      "svg+xml": "svg",
    }

    const extension = extMap[mimeType] || "png"

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const finalFilename = filename || `paste-${timestamp}.${extension}`

    // Determine save directory
    let saveDir = PASTE_DIR
    if (workingDirectory && existsSync(workingDirectory)) {
      // Save in a .pasted-images folder within the working directory
      saveDir = path.join(workingDirectory, ".pasted-images")
    }

    // Ensure directory exists
    if (!existsSync(saveDir)) {
      await mkdir(saveDir, { recursive: true })
    }

    // Save the file
    const filePath = path.join(saveDir, finalFilename)
    const buffer = Buffer.from(base64Data, "base64")
    await writeFile(filePath, buffer)

    console.log(`[paste-image] Saved image: ${filePath} (${buffer.length} bytes)`)

    return NextResponse.json({
      success: true,
      path: filePath,
      filename: finalFilename,
      size: buffer.length,
      mimeType: `image/${mimeType}`,
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save image"
    console.error("[paste-image] Error:", error)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

/**
 * GET - List recently pasted images (optional endpoint for reference)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workingDirectory = searchParams.get("workingDirectory")

    let checkDir = PASTE_DIR
    if (workingDirectory && existsSync(path.join(workingDirectory, ".pasted-images"))) {
      checkDir = path.join(workingDirectory, ".pasted-images")
    }

    if (!existsSync(checkDir)) {
      return NextResponse.json({ images: [] })
    }

    const { readdir, stat } = await import("fs/promises")
    const files = await readdir(checkDir)

    const imageFiles = await Promise.all(
      files
        .filter(f => /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(f))
        .map(async (f) => {
          const filePath = path.join(checkDir, f)
          const stats = await stat(filePath)
          return {
            filename: f,
            path: filePath,
            size: stats.size,
            createdAt: stats.birthtime.toISOString(),
          }
        })
    )

    // Sort by creation date, newest first
    imageFiles.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({
      success: true,
      images: imageFiles.slice(0, 20), // Return last 20 images
      directory: checkDir,
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list images"
    console.error("[paste-image] Error:", error)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
