"use client"

import { useState, useCallback, useRef } from "react"
import type { TranscriptionData, TranscriptionMethod } from "@/lib/data/types"

interface UseTranscriptionReturn {
  isTranscribing: boolean
  progress: number
  method: TranscriptionMethod | null
  result: TranscriptionData | null
  error: string | null

  transcribe: (audioBlob: Blob) => Promise<TranscriptionData | null>
  transcribeWithBrowser: (audioBlob: Blob) => Promise<TranscriptionData | null>
  cancel: () => void
  reset: () => void
}

export function useTranscription(): UseTranscriptionReturn {
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [method, setMethod] = useState<TranscriptionMethod | null>(null)
  const [result, setResult] = useState<TranscriptionData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)

  const reset = useCallback(() => {
    setIsTranscribing(false)
    setProgress(0)
    setMethod(null)
    setResult(null)
    setError(null)
  }, [])

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    reset()
  }, [reset])

  /**
   * Transcribe using local Whisper API (primary method)
   */
  const transcribe = useCallback(async (audioBlob: Blob): Promise<TranscriptionData | null> => {
    reset()
    setIsTranscribing(true)
    setProgress(10)

    abortControllerRef.current = new AbortController()

    try {
      // Try local Whisper first
      const formData = new FormData()
      formData.append("file", audioBlob, "recording.webm")

      setProgress(30)
      setMethod("whisper-local")

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
        signal: abortControllerRef.current.signal
      })

      setProgress(70)

      const data = await response.json()

      if (data.useBrowserFallback) {
        // Local Whisper not available, try browser
        console.log("Falling back to browser speech recognition")
        return await transcribeWithBrowser(audioBlob)
      }

      if (data.error) {
        throw new Error(data.error)
      }

      if (data.transcription) {
        setResult(data.transcription)
        setProgress(100)
        return data.transcription
      }

      throw new Error("No transcription returned")

    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return null
      }

      const errorMessage = err instanceof Error ? err.message : "Transcription failed"
      setError(errorMessage)

      // Try browser fallback
      console.log("API error, falling back to browser:", errorMessage)
      return await transcribeWithBrowser(audioBlob)
    } finally {
      setIsTranscribing(false)
      abortControllerRef.current = null
    }
  }, [reset])

  /**
   * Transcribe using browser Speech Recognition (fallback)
   * This plays the audio and captures speech recognition in real-time
   */
  const transcribeWithBrowser = useCallback(async (audioBlob: Blob): Promise<TranscriptionData | null> => {
    setMethod("browser-speech")
    setProgress(20)
    setError(null)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      setError("Speech recognition not supported in this browser")
      setIsTranscribing(false)
      return null
    }

    return new Promise((resolve) => {
      // Create audio element to play the recording
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)

      // Set up speech recognition
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = false
      recognition.lang = "en-US"

      let fullTranscript = ""
      const startTime = Date.now()

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            fullTranscript += event.results[i][0].transcript + " "
          }
        }
        // Update progress based on audio position
        if (audio.duration) {
          setProgress(20 + (audio.currentTime / audio.duration) * 70)
        }
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("Speech recognition error:", event.error)
      }

      recognition.onend = () => {
        // Restart if audio is still playing
        if (!audio.paused && !audio.ended) {
          try {
            recognition.start()
          } catch (e) {
            // Ignore if already started
          }
        }
      }

      audio.onended = () => {
        recognition.stop()

        const duration = (Date.now() - startTime) / 1000
        const wordCount = fullTranscript.split(/\s+/).filter(Boolean).length

        const transcription: TranscriptionData = {
          text: fullTranscript.trim(),
          method: "browser-speech",
          duration,
          wordCount,
          transcribedAt: new Date().toISOString()
        }

        URL.revokeObjectURL(audioUrl)
        setResult(transcription)
        setProgress(100)
        setIsTranscribing(false)
        resolve(transcription)
      }

      audio.onerror = () => {
        recognition.stop()
        URL.revokeObjectURL(audioUrl)
        setError("Failed to play audio for transcription")
        setIsTranscribing(false)
        resolve(null)
      }

      // Start recognition and play audio
      try {
        recognition.start()
        audio.play()
      } catch (err) {
        setError("Failed to start transcription")
        setIsTranscribing(false)
        resolve(null)
      }
    })
  }, [])

  return {
    isTranscribing,
    progress,
    method,
    result,
    error,
    transcribe,
    transcribeWithBrowser,
    cancel,
    reset
  }
}

// Type declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
}

interface SpeechRecognitionResultList {
  length: number
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  isFinal: boolean
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}
