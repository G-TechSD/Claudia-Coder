/**
 * Voice Recordings API Route
 * Handles saving new voice recordings with transcriptions
 *
 * Key principle: Users are tired of losing ideas. NOTHING GETS LOST unless user deletes.
 */

import { NextRequest, NextResponse } from "next/server"
import { saveAudioFile, ensureUserStorageDirectory } from "@/lib/data/voice-recordings"
import { getCurrentUser } from "@/lib/auth/middleware"

// POST: Save a new voice recording
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const audioFile = formData.get("audio") as Blob | null
    const transcription = formData.get("transcription") as string | null
    const transcriptionMethod = formData.get("transcriptionMethod") as string | null
    const transcriptionConfidence = formData.get("transcriptionConfidence") as string | null
    const audioDuration = formData.get("audioDuration") as string | null
    const title = formData.get("title") as string | null
    const tags = formData.get("tags") as string | null
    const sourceContext = formData.get("sourceContext") as string | null
    const linkedProjectId = formData.get("linkedProjectId") as string | null
    const linkedBusinessIdeaId = formData.get("linkedBusinessIdeaId") as string | null

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      )
    }

    if (!transcription) {
      return NextResponse.json(
        { error: "Transcription is required" },
        { status: 400 }
      )
    }

    // Generate a recording ID
    const recordingId = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`

    // Convert blob to buffer
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer())

    // Save the audio file
    const audioUrl = await saveAudioFile(
      user.id,
      audioBuffer,
      recordingId,
      audioFile.type || "audio/webm"
    )

    // Return the data needed to create the recording in localStorage
    return NextResponse.json({
      success: true,
      recording: {
        id: recordingId,
        userId: user.id,
        audioUrl,
        audioDuration: audioDuration ? parseFloat(audioDuration) : 0,
        audioMimeType: audioFile.type || "audio/webm",
        audioSize: audioBuffer.length,
        transcription,
        transcriptionMethod: transcriptionMethod || "browser-speech",
        transcriptionConfidence: transcriptionConfidence ? parseFloat(transcriptionConfidence) : undefined,
        title,
        tags: tags ? JSON.parse(tags) : [],
        sourceContext,
        linkedProjectId,
        linkedBusinessIdeaId
      }
    })

  } catch (error) {
    console.error("[VoiceRecordings] Error saving recording:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save recording" },
      { status: 500 }
    )
  }
}

// GET: Get storage info (for debugging)
export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    // Ensure storage directory exists
    const storagePath = await ensureUserStorageDirectory(user.id)

    return NextResponse.json({
      success: true,
      storagePath,
      userId: user.id
    })

  } catch (error) {
    console.error("[VoiceRecordings] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get storage info" },
      { status: 500 }
    )
  }
}
