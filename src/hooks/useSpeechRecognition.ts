"use client"

import { useState, useEffect, useCallback, useRef } from "react"

interface SpeechRecognitionOptions {
  continuous?: boolean
  interimResults?: boolean
  language?: string
  onResult?: (transcript: string, isFinal: boolean) => void
  onError?: (error: string) => void
  onEnd?: () => void
}

interface UseSpeechRecognitionReturn {
  isListening: boolean
  isSupported: boolean
  transcript: string
  interimTranscript: string
  error: string | null
  startListening: () => void
  stopListening: () => void
  resetTranscript: () => void
}

// Type declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  isFinal: boolean
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
  onspeechstart: (() => void) | null
  onspeechend: (() => void) | null
  onaudiostart: (() => void) | null
  onaudioend: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

export function useSpeechRecognition(options: SpeechRecognitionOptions = {}): UseSpeechRecognitionReturn {
  const {
    continuous = true,
    interimResults = true,
    language = "en-US",
    onResult,
    onError,
    onEnd
  } = options

  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [interimTranscript, setInterimTranscript] = useState("")
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const isListeningRef = useRef(false)
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Store callbacks in refs to avoid re-initializing recognition
  const onResultRef = useRef(onResult)
  const onErrorRef = useRef(onError)
  const onEndRef = useRef(onEnd)

  // Update refs when callbacks change
  useEffect(() => {
    onResultRef.current = onResult
    onErrorRef.current = onError
    onEndRef.current = onEnd
  }, [onResult, onError, onEnd])

  // Initialize speech recognition once
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    setIsSupported(!!SpeechRecognition)

    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition

    recognition.continuous = continuous
    recognition.interimResults = interimResults
    recognition.lang = language

    recognition.onstart = () => {
      console.log("[Speech] Recognition started")
      setIsListening(true)
      isListeningRef.current = true
      setError(null)
    }

    recognition.onaudiostart = () => {
      console.log("[Speech] Audio capture started")
    }

    recognition.onspeechstart = () => {
      console.log("[Speech] Speech detected")
    }

    recognition.onspeechend = () => {
      console.log("[Speech] Speech ended")
    }

    recognition.onaudioend = () => {
      console.log("[Speech] Audio capture ended")
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = ""
      let interim = ""

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0].transcript

        if (result.isFinal) {
          finalTranscript += text
          console.log("[Speech] Final transcript:", text)
        } else {
          interim += text
        }
      }

      if (finalTranscript) {
        setTranscript(prev => (prev + " " + finalTranscript).trim())
        onResultRef.current?.(finalTranscript.trim(), true)
      }

      setInterimTranscript(interim)
      if (interim && !finalTranscript) {
        onResultRef.current?.(interim, false)
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.log("[Speech] Error:", event.error, event.message)

      // Handle different error types
      switch (event.error) {
        case "no-speech":
          // This is common, don't treat as error, just restart
          console.log("[Speech] No speech detected, will restart...")
          break
        case "audio-capture":
          setError("No microphone found or microphone access denied")
          onErrorRef.current?.("No microphone found or microphone access denied")
          setIsListening(false)
          isListeningRef.current = false
          break
        case "not-allowed":
          setError("Microphone access denied. Please allow microphone access in your browser.")
          onErrorRef.current?.("Microphone access denied")
          setIsListening(false)
          isListeningRef.current = false
          break
        case "network":
          setError("Network error during speech recognition")
          onErrorRef.current?.("Network error")
          // Will attempt restart on end
          break
        case "aborted":
          // User or system aborted, don't restart
          console.log("[Speech] Recognition aborted")
          break
        default:
          setError(`Speech recognition error: ${event.error}`)
          onErrorRef.current?.(event.error)
      }
    }

    recognition.onend = () => {
      console.log("[Speech] Recognition ended, shouldRestart:", isListeningRef.current)

      // Restart if we're still supposed to be listening
      if (isListeningRef.current && continuous) {
        // Small delay before restarting to avoid rapid restart loops
        restartTimeoutRef.current = setTimeout(() => {
          if (isListeningRef.current && recognitionRef.current) {
            try {
              console.log("[Speech] Restarting recognition...")
              recognitionRef.current.start()
            } catch (e) {
              console.log("[Speech] Restart failed:", e)
              // If restart fails, we're probably already started
            }
          }
        }, 100)
      } else {
        setIsListening(false)
        onEndRef.current?.()
      }
    }

    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current)
      }
      recognition.abort()
    }
  }, [continuous, interimResults, language])

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      setError("Speech recognition not supported")
      return
    }

    // Clear any pending restart
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current)
      restartTimeoutRef.current = null
    }

    setError(null)
    setInterimTranscript("")
    isListeningRef.current = true

    try {
      recognitionRef.current.start()
      console.log("[Speech] Start requested")
    } catch (e) {
      const error = e as Error
      console.log("[Speech] Start error:", error.message)

      // Handle "already started" error
      if (error.message?.includes("already started")) {
        setIsListening(true)
      } else {
        setError("Failed to start speech recognition")
        onErrorRef.current?.("Failed to start speech recognition")
        isListeningRef.current = false
      }
    }
  }, [])

  const stopListening = useCallback(() => {
    console.log("[Speech] Stop requested")

    // Clear any pending restart
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current)
      restartTimeoutRef.current = null
    }

    isListeningRef.current = false
    setIsListening(false)
    setInterimTranscript("")

    try {
      recognitionRef.current?.stop()
    } catch (e) {
      // Ignore stop errors
    }
  }, [])

  const resetTranscript = useCallback(() => {
    setTranscript("")
    setInterimTranscript("")
  }, [])

  return {
    isListening,
    isSupported,
    transcript: transcript.trim(),
    interimTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript
  }
}
