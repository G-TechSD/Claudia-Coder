/**
 * Transcription API Route
 * Handles audio transcription using local Whisper model
 */

import { NextRequest, NextResponse } from "next/server"

const LMSTUDIO_BEAST = process.env.NEXT_PUBLIC_LMSTUDIO_BEAST
const LMSTUDIO_BEDROOM = process.env.NEXT_PUBLIC_LMSTUDIO_BEDROOM
const OLLAMA_URL = process.env.NEXT_PUBLIC_OLLAMA_URL

async function checkEndpoint(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/v1/models`, {
      method: "GET",
      signal: AbortSignal.timeout(2000)
    })
    return response.ok
  } catch {
    return false
  }
}

async function getAvailableEndpoint(): Promise<string | null> {
  // Try endpoints in order of preference
  const endpoints = [
    LMSTUDIO_BEAST,
    LMSTUDIO_BEDROOM,
    OLLAMA_URL
  ].filter(Boolean) as string[]

  for (const endpoint of endpoints) {
    if (await checkEndpoint(endpoint)) {
      return endpoint
    }
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get("file") as Blob | null
    const language = formData.get("language") as string | null

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      )
    }

    // Find available Whisper endpoint
    const endpoint = await getAvailableEndpoint()

    if (!endpoint) {
      // No local Whisper available - suggest browser fallback
      return NextResponse.json({
        useBrowserFallback: true,
        message: "No local Whisper model available. Use browser speech recognition instead."
      })
    }

    // Forward to Whisper API
    const whisperFormData = new FormData()
    whisperFormData.append("file", audioFile, "recording.webm")
    whisperFormData.append("model", "whisper-1")
    whisperFormData.append("response_format", "verbose_json")

    if (language) {
      whisperFormData.append("language", language)
    }

    const whisperResponse = await fetch(`${endpoint}/v1/audio/transcriptions`, {
      method: "POST",
      body: whisperFormData
    })

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text().catch(() => "Unknown error")
      console.error("Whisper API error:", errorText)

      // Fallback to browser
      return NextResponse.json({
        useBrowserFallback: true,
        message: `Whisper API error: ${errorText}`
      })
    }

    const result = await whisperResponse.json()

    // Calculate word count
    const wordCount = result.text?.split(/\s+/).filter(Boolean).length || 0

    // Return transcription data
    return NextResponse.json({
      success: true,
      transcription: {
        text: result.text || "",
        method: "whisper-local",
        duration: result.duration || 0,
        wordCount,
        transcribedAt: new Date().toISOString(),
        segments: result.segments?.map((seg: { start: number; end: number; text: string }) => ({
          start: seg.start,
          end: seg.end,
          text: seg.text
        }))
      }
    })

  } catch (error) {
    console.error("Transcription error:", error)

    return NextResponse.json({
      useBrowserFallback: true,
      error: error instanceof Error ? error.message : "Transcription failed"
    })
  }
}

// GET endpoint to check availability
export async function GET() {
  const endpoint = await getAvailableEndpoint()

  return NextResponse.json({
    available: !!endpoint,
    endpoint: endpoint ? "local-whisper" : null
  })
}
