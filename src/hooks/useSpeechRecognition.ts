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

  // Check browser support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    setIsSupported(!!SpeechRecognition)

    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = continuous
      recognitionRef.current.interimResults = interimResults
      recognitionRef.current.lang = language

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = ""
        let interim = ""

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            finalTranscript += result[0].transcript
          } else {
            interim += result[0].transcript
          }
        }

        if (finalTranscript) {
          setTranscript(prev => prev + " " + finalTranscript)
          onResult?.(finalTranscript.trim(), true)
        }

        setInterimTranscript(interim)
        if (interim) {
          onResult?.(interim, false)
        }
      }

      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
        const errorMessage = event.error || "Speech recognition error"
        setError(errorMessage)
        onError?.(errorMessage)

        // Don't set listening to false for no-speech errors in continuous mode
        if (event.error !== "no-speech") {
          setIsListening(false)
          isListeningRef.current = false
        }
      }

      recognitionRef.current.onend = () => {
        // Restart if we're still supposed to be listening (continuous mode)
        if (isListeningRef.current && continuous) {
          try {
            recognitionRef.current?.start()
          } catch (e) {
            // Already started, ignore
          }
        } else {
          setIsListening(false)
          isListeningRef.current = false
          onEnd?.()
        }
      }
    }

    return () => {
      recognitionRef.current?.abort()
    }
  }, [continuous, interimResults, language, onResult, onError, onEnd])

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      setError("Speech recognition not supported")
      return
    }

    setError(null)
    setInterimTranscript("")

    try {
      recognitionRef.current.start()
      setIsListening(true)
      isListeningRef.current = true
    } catch (e) {
      // Handle "already started" error
      if ((e as Error).message?.includes("already started")) {
        setIsListening(true)
        isListeningRef.current = true
      } else {
        setError("Failed to start speech recognition")
        onError?.("Failed to start speech recognition")
      }
    }
  }, [onError])

  const stopListening = useCallback(() => {
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
