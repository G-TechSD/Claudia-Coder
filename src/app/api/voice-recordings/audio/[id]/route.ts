/**
 * Voice Recording Audio API Route
 * Serves audio files for playback
 */

import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { getCurrentUser } from "@/lib/auth/middleware"

// GET: Serve audio file for playback
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const resolvedParams = await params
    const recordingId = resolvedParams.id

    // Find the audio file - check common extensions
    const projectRoot = process.cwd()
    const storageBase = `.local-storage/voice-recordings/${user.id}`
    const storagePath = path.join(projectRoot, storageBase)

    const extensions = ["webm", "ogg", "mp4", "wav"]
    let audioPath: string | null = null
    let mimeType = "audio/webm"

    for (const ext of extensions) {
      const testPath = path.join(storagePath, `${recordingId}.${ext}`)
      try {
        await fs.access(testPath)
        audioPath = testPath
        mimeType = ext === "ogg" ? "audio/ogg" :
                   ext === "mp4" ? "audio/mp4" :
                   ext === "wav" ? "audio/wav" :
                   "audio/webm"
        break
      } catch {
        // File doesn't exist, try next extension
      }
    }

    if (!audioPath) {
      return NextResponse.json(
        { error: "Audio file not found" },
        { status: 404 }
      )
    }

    // Read and return the audio file
    const audioBuffer = await fs.readFile(audioPath)
    const stat = await fs.stat(audioPath)

    // Handle range requests for seeking
    const range = request.headers.get("range")

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-")
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1
      const chunkSize = end - start + 1

      const chunk = audioBuffer.subarray(start, end + 1)

      return new NextResponse(chunk, {
        status: 206,
        headers: {
          "Content-Type": mimeType,
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize.toString(),
          "Cache-Control": "private, max-age=3600"
        }
      })
    }

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": stat.size.toString(),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600"
      }
    })

  } catch (error) {
    console.error("[VoiceRecordings] Error serving audio:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to serve audio" },
      { status: 500 }
    )
  }
}
