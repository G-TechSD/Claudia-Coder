/**
 * Whisper Transcription Client
 * Uses OpenAI-compatible API (LM Studio, Ollama)
 */

import type { TranscriptionData, TranscriptionMethod } from "@/lib/data/types"

interface WhisperResponse {
  text: string
  segments?: {
    start: number
    end: number
    text: string
  }[]
  duration?: number
}

interface TranscriptionOptions {
  language?: string
  prompt?: string
  response_format?: "json" | "text" | "verbose_json"
}

/**
 * Get the Whisper API endpoint from environment
 */
function getWhisperEndpoint(): string | null {
  if (typeof window === "undefined") return null

  // Priority: Dedicated Whisper server > LM Studio > Ollama
  const whisperUrl = process.env.NEXT_PUBLIC_WHISPER_URL
  const lmstudioBeast = process.env.NEXT_PUBLIC_LMSTUDIO_BEAST
  const lmstudioBedroom = process.env.NEXT_PUBLIC_LMSTUDIO_BEDROOM
  const ollamaUrl = process.env.NEXT_PUBLIC_OLLAMA_URL

  // Prefer dedicated Whisper server
  if (whisperUrl) {
    return `${whisperUrl}/v1/audio/transcriptions`
  }

  // Fallback to LM Studio BEAST for performance
  if (lmstudioBeast) {
    return `${lmstudioBeast}/v1/audio/transcriptions`
  }

  if (lmstudioBedroom) {
    return `${lmstudioBedroom}/v1/audio/transcriptions`
  }

  // Try Ollama
  if (ollamaUrl) {
    return `${ollamaUrl}/v1/audio/transcriptions`
  }

  return null
}

/**
 * Check if Whisper transcription is available
 */
export async function isWhisperAvailable(): Promise<boolean> {
  const endpoint = getWhisperEndpoint()
  if (!endpoint) return false

  try {
    // Try the health endpoint first (for faster-whisper-server)
    const baseUrl = endpoint.replace("/v1/audio/transcriptions", "")
    const healthResponse = await fetch(`${baseUrl}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(3000)
    })
    if (healthResponse.ok) return true

    // Fallback to models endpoint (for OpenAI-compatible servers)
    const modelsResponse = await fetch(`${baseUrl}/v1/models`, {
      method: "GET",
      signal: AbortSignal.timeout(3000)
    })
    return modelsResponse.ok
  } catch {
    return false
  }
}

/**
 * Get the configured Whisper endpoint URL (for debugging)
 */
export function getWhisperUrl(): string | null {
  return getWhisperEndpoint()
}

/**
 * Transcribe audio using local Whisper model
 */
export async function transcribeWithWhisper(
  audioBlob: Blob,
  options: TranscriptionOptions = {}
): Promise<TranscriptionData> {
  const endpoint = getWhisperEndpoint()
  if (!endpoint) {
    throw new Error("No Whisper endpoint available")
  }

  const formData = new FormData()
  formData.append("file", audioBlob, "recording.webm")
  formData.append("model", "whisper-1") // Standard model name
  formData.append("response_format", options.response_format || "verbose_json")

  if (options.language) {
    formData.append("language", options.language)
  }

  if (options.prompt) {
    formData.append("prompt", options.prompt)
  }

  const startTime = Date.now()

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData
  })

  if (!response.ok) {
    const error = await response.text().catch(() => "Unknown error")
    throw new Error(`Transcription failed: ${error}`)
  }

  const result: WhisperResponse = await response.json()
  const processingTime = Date.now() - startTime

  // Calculate word count
  const wordCount = result.text.split(/\s+/).filter(Boolean).length

  // Estimate duration from segments or audio
  let duration = result.duration || 0
  if (!duration && result.segments?.length) {
    duration = result.segments[result.segments.length - 1].end
  }

  return {
    text: result.text,
    method: "whisper-local" as TranscriptionMethod,
    duration,
    wordCount,
    transcribedAt: new Date().toISOString(),
    segments: result.segments?.map(seg => ({
      start: seg.start,
      end: seg.end,
      text: seg.text
    }))
  }
}

/**
 * Transcribe long audio by chunking
 */
export async function transcribeLongAudio(
  audioBlob: Blob,
  onProgress?: (progress: number) => void
): Promise<TranscriptionData> {
  // For now, just transcribe the whole thing
  // In the future, we could split audio into chunks
  onProgress?.(10)

  const result = await transcribeWithWhisper(audioBlob)

  onProgress?.(100)

  return result
}
