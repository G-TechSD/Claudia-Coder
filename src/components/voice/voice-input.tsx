"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Mic, MicOff, Loader2 } from "lucide-react"

interface VoiceInputProps {
  onTranscript: (text: string) => void
  onListeningChange?: (isListening: boolean) => void
  className?: string
  size?: "sm" | "md" | "lg"
  pauseTimeout?: number // ms to wait before auto-submitting (default: 5 minutes for deep thinking)
  disabled?: boolean
}

/**
 * Voice Input Component with visual feedback
 *
 * Philosophy: "The quieter you are, the more you are able to hear"
 * The system should LISTEN, not "wait to talk". Users need 5-10 minutes
 * of silence to think deeply, not 2 seconds. The best listeners wait
 * patiently through long pauses.
 *
 * Features:
 * - Audio visualization (sound wave bars)
 * - Patient auto-transcription after extended pause (5 min default)
 * - Clear status indication
 * - Forgiving about interruptions (accumulates speech)
 * - Manual send button for user control
 */
export function VoiceInput({
  onTranscript,
  onListeningChange,
  className,
  size = "md",
  pauseTimeout = 300000, // 5 minutes - embody stillness and receptivity
  disabled = false
}: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)
  const [pendingText, setPendingText] = useState("")
  const [interimText, setInterimText] = useState("")

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const pauseTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isListeningRef = useRef(false)

  // Check support and initialize
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setIsSupported(!!SpeechRecognitionAPI)

    if (!SpeechRecognitionAPI) return

    const recognition = new SpeechRecognitionAPI() as SpeechRecognitionInstance
    recognitionRef.current = recognition

    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = "en-US"

    recognition.onstart = () => {
      console.log("[Voice] Started")
      setIsListening(true)
      isListeningRef.current = true
      setError(null)
      onListeningChange?.(true)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let finalText = ""
      let interim = ""

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0].transcript

        if (result.isFinal) {
          finalText += text
        } else {
          interim += text
        }
      }

      if (finalText) {
        console.log("[Voice] Final:", finalText)
        setPendingText(prev => (prev + " " + finalText).trim())

        // Reset pause timer on new speech
        if (pauseTimerRef.current) {
          clearTimeout(pauseTimerRef.current)
        }

        // Start timer for auto-submit after pause
        pauseTimerRef.current = setTimeout(() => {
          setPendingText(current => {
            if (current.trim()) {
              console.log("[Voice] Auto-submitting:", current)
              onTranscript(current.trim())
            }
            return ""
          })
          setInterimText("")
        }, pauseTimeout)
      }

      setInterimText(interim)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      console.log("[Voice] Error:", event.error)

      if (event.error === "not-allowed") {
        setError("Microphone access denied")
        stopListening()
      } else if (event.error === "audio-capture") {
        setError("No microphone found")
        stopListening()
      }
      // "no-speech" is common and handled by restart
    }

    recognition.onend = () => {
      console.log("[Voice] Ended, should restart:", isListeningRef.current)

      if (isListeningRef.current) {
        // Restart after brief delay
        setTimeout(() => {
          if (isListeningRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start()
            } catch (e) {
              // Already started
            }
          }
        }, 100)
      } else {
        setIsListening(false)
        onListeningChange?.(false)
      }
    }

    return () => {
      stopListening()
      recognition.abort()
    }
  }, [pauseTimeout, onTranscript, onListeningChange])

  // Audio visualization
  const startAudioVisualization = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const audioContext = new AudioContext()
      audioContextRef.current = audioContext

      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser

      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      const updateLevel = () => {
        if (!isListeningRef.current) return

        analyser.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length
        setAudioLevel(average / 255)

        animationRef.current = requestAnimationFrame(updateLevel)
      }

      updateLevel()
    } catch (err) {
      console.error("[Voice] Audio visualization failed:", err)
    }
  }, [])

  const stopAudioVisualization = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    setAudioLevel(0)
  }, [])

  const startListening = useCallback(() => {
    if (!recognitionRef.current || disabled) return

    setError(null)
    setPendingText("")
    setInterimText("")
    isListeningRef.current = true

    try {
      recognitionRef.current.start()
      startAudioVisualization()
    } catch (e) {
      console.error("[Voice] Start failed:", e)
    }
  }, [disabled, startAudioVisualization])

  const stopListening = useCallback(() => {
    isListeningRef.current = false
    setIsListening(false)

    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current)
      pauseTimerRef.current = null
    }

    // Submit any pending text immediately
    if (pendingText.trim()) {
      onTranscript(pendingText.trim())
      setPendingText("")
    }

    setInterimText("")
    stopAudioVisualization()

    try {
      recognitionRef.current?.stop()
    } catch (e) {
      // Ignore
    }

    onListeningChange?.(false)
  }, [pendingText, onTranscript, stopAudioVisualization, onListeningChange])

  const toggle = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  const sizeClasses = {
    sm: "h-10 w-10",
    md: "h-14 w-14",
    lg: "h-20 w-20"
  }

  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8"
  }

  if (!isSupported) {
    return (
      <div className={cn("text-center text-sm text-muted-foreground", className)}>
        Voice input not supported in this browser
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      {/* Microphone Button with Visualization */}
      <div className="relative">
        {/* Audio level rings */}
        {isListening && (
          <>
            <div
              className="absolute inset-0 rounded-full bg-red-500/20 animate-ping"
              style={{ animationDuration: "1.5s" }}
            />
            <div
              className="absolute rounded-full bg-red-500/30 transition-all duration-100"
              style={{
                inset: `-${Math.max(4, audioLevel * 24)}px`,
              }}
            />
            <div
              className="absolute rounded-full bg-red-500/20 transition-all duration-100"
              style={{
                inset: `-${Math.max(8, audioLevel * 40)}px`,
              }}
            />
          </>
        )}

        <button
          type="button"
          onClick={toggle}
          disabled={disabled}
          className={cn(
            "relative rounded-full flex items-center justify-center transition-all",
            sizeClasses[size],
            isListening
              ? "bg-red-500 text-white scale-110"
              : "bg-muted hover:bg-accent text-muted-foreground hover:text-foreground",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {isListening ? (
            <MicOff className={iconSizes[size]} />
          ) : (
            <Mic className={iconSizes[size]} />
          )}
        </button>
      </div>

      {/* Audio Level Bars */}
      {isListening && (
        <div className="flex items-end justify-center gap-1 h-8">
          {[0.3, 0.5, 0.7, 1, 0.7, 0.5, 0.3].map((multiplier, i) => (
            <div
              key={i}
              className="w-1 bg-red-500 rounded-full transition-all duration-75"
              style={{
                height: `${Math.max(4, audioLevel * 32 * multiplier)}px`,
              }}
            />
          ))}
        </div>
      )}

      {/* Status Text - "The quieter you are, the more you are able to hear" */}
      <div className="text-center min-h-[40px]">
        {error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : isListening ? (
          <div className="space-y-1">
            {(pendingText || interimText) ? (
              <p className="text-sm">
                <span className="text-foreground">{pendingText}</span>
                {interimText && (
                  <span className="text-muted-foreground"> {interimText}</span>
                )}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground animate-pulse">
                Take your time - I&apos;m listening for up to 5 minutes
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Click mic when ready to send.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Click to speak
          </p>
        )}
      </div>
    </div>
  )
}

// Type declarations for Web Speech API
// Web Speech API types - shared with useSpeechRecognition hook
// Using 'any' for recognition to avoid duplicate global declarations
type SpeechRecognitionInstance = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: { resultIndex: number; results: { length: number; [index: number]: { isFinal: boolean; [index: number]: { transcript: string } } } }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}
