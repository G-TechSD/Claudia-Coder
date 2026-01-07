/**
 * Transcription API Route
 * Handles audio transcription using local Whisper server, OpenAI Whisper API, or browser fallback
 * Priority: Local Whisper > OpenAI Whisper > Browser fallback
 */

import { NextRequest, NextResponse } from "next/server"

const WHISPER_URL = process.env.NEXT_PUBLIC_WHISPER_URL
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

/**
 * Check if local Whisper server is available
 */
async function isLocalWhisperAvailable(): Promise<boolean> {
  if (!WHISPER_URL) return false

  try {
    const response = await fetch(`${WHISPER_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(2000)
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Transcribe using local Whisper server
 */
async function transcribeWithLocalWhisper(
  audioFile: Blob,
  language?: string | null
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  if (!WHISPER_URL) {
    return { success: false, error: "No local Whisper URL configured" }
  }

  const formData = new FormData()
  formData.append("file", audioFile, "recording.webm")
  formData.append("model", "whisper-1")
  formData.append("response_format", "verbose_json")

  if (language) {
    formData.append("language", language)
  }

  try {
    const response = await fetch(`${WHISPER_URL}/v1/audio/transcriptions`, {
      method: "POST",
      body: formData
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error")
      return { success: false, error: `Local Whisper error: ${errorText}` }
    }

    const result = await response.json()
    return { success: true, data: result }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Local Whisper request failed"
    }
  }
}

/**
 * Transcribe using OpenAI Whisper API
 */
async function transcribeWithOpenAI(
  audioFile: Blob,
  language?: string | null
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  if (!OPENAI_API_KEY) {
    return { success: false, error: "No OpenAI API key configured" }
  }

  const formData = new FormData()
  formData.append("file", audioFile, "recording.webm")
  formData.append("model", "whisper-1")
  formData.append("response_format", "verbose_json")

  if (language) {
    formData.append("language", language)
  }

  try {
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: formData
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error")
      return { success: false, error: `OpenAI Whisper error: ${errorText}` }
    }

    const result = await response.json()
    return { success: true, data: result }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "OpenAI Whisper request failed"
    }
  }
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

    let result: { success: boolean; data?: unknown; error?: string }
    let method = "unknown"

    // Try local Whisper first (priority)
    const localAvailable = await isLocalWhisperAvailable()
    if (localAvailable) {
      console.log("[Transcribe] Using local Whisper server:", WHISPER_URL)
      result = await transcribeWithLocalWhisper(audioFile, language)
      method = "whisper-local"

      if (result.success) {
        const data = result.data as { text?: string; duration?: number; segments?: Array<{ start: number; end: number; text: string }> }
        const wordCount = data.text?.split(/\s+/).filter(Boolean).length || 0

        return NextResponse.json({
          success: true,
          transcription: {
            text: data.text || "",
            method,
            duration: data.duration || 0,
            wordCount,
            transcribedAt: new Date().toISOString(),
            segments: data.segments?.map((seg) => ({
              start: seg.start,
              end: seg.end,
              text: seg.text
            }))
          }
        })
      }
      console.warn("[Transcribe] Local Whisper failed:", result.error)
    }

    // Fallback to OpenAI Whisper
    if (OPENAI_API_KEY) {
      console.log("[Transcribe] Falling back to OpenAI Whisper")
      result = await transcribeWithOpenAI(audioFile, language)
      method = "openai-whisper"

      if (result.success) {
        const data = result.data as { text?: string; duration?: number; segments?: Array<{ start: number; end: number; text: string }> }
        const wordCount = data.text?.split(/\s+/).filter(Boolean).length || 0

        return NextResponse.json({
          success: true,
          transcription: {
            text: data.text || "",
            method,
            duration: data.duration || 0,
            wordCount,
            transcribedAt: new Date().toISOString(),
            segments: data.segments?.map((seg) => ({
              start: seg.start,
              end: seg.end,
              text: seg.text
            }))
          }
        })
      }
      console.warn("[Transcribe] OpenAI Whisper failed:", result.error)
    }

    // No transcription service available - use browser fallback
    console.log("[Transcribe] No transcription service available - using browser fallback")
    return NextResponse.json({
      useBrowserFallback: true,
      message: "No transcription service available. Configure NEXT_PUBLIC_WHISPER_URL for local Whisper or OPENAI_API_KEY for cloud Whisper."
    })

  } catch (error) {
    console.error("[Transcribe] Error:", error)

    return NextResponse.json({
      useBrowserFallback: true,
      error: error instanceof Error ? error.message : "Transcription failed"
    })
  }
}

// GET endpoint to check availability
export async function GET() {
  const localAvailable = await isLocalWhisperAvailable()

  return NextResponse.json({
    available: localAvailable || !!OPENAI_API_KEY,
    endpoints: {
      local: localAvailable ? WHISPER_URL : null,
      openai: OPENAI_API_KEY ? "openai-whisper" : null
    },
    primary: localAvailable ? "whisper-local" : (OPENAI_API_KEY ? "openai-whisper" : null),
    fallback: "browser-speech-recognition"
  })
}
