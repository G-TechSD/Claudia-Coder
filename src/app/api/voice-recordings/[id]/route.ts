/**
 * Voice Recording API Route - Individual Recording
 * Handles deleting recordings
 */

import { NextRequest, NextResponse } from "next/server"
import { deleteAudioFile } from "@/lib/data/voice-recordings"
import { getCurrentUser } from "@/lib/auth/middleware"

// DELETE: Delete a voice recording
export async function DELETE(
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

    // Get the audio URL from the request body or query params
    const url = new URL(request.url)
    const audioUrl = url.searchParams.get("audioUrl")

    // If audioUrl is provided, delete the file
    if (audioUrl) {
      await deleteAudioFile(audioUrl)
    }

    return NextResponse.json({
      success: true,
      deleted: recordingId
    })

  } catch (error) {
    console.error("[VoiceRecordings] Error deleting recording:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete recording" },
      { status: 500 }
    )
  }
}
