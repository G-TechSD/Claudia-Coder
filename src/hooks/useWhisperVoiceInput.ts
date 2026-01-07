"use client"

/**
 * useWhisperVoiceInput Hook
 *
 * Provides voice input using local Whisper server for transcription.
 * Records audio and sends it to the Whisper server for transcription.
 * Falls back to browser Speech Recognition if Whisper is unavailable.
 */

import { useState, useCallback, useRef, useEffect } from "react"

interface UseWhisperVoiceInputOptions {
  /** Language code (e.g., "en", "es") */
  language?: string
  /** Callback when final transcript is received */
  onResult?: (transcript: string, isFinal: boolean) => void
  /** Callback on error */
  onError?: (error: string) => void
  /** Callback when listening ends */
  onEnd?: () => void
  /** Minimum audio duration before sending (ms) */
  minDuration?: number
  /** Silence detection threshold (ms) - send after this much silence */
  silenceThreshold?: number
}

interface UseWhisperVoiceInputReturn {
  isListening: boolean
  isProcessing: boolean
  isSupported: boolean
  transcript: string
  interimTranscript: string
  error: string | null
  whisperAvailable: boolean | null
  startListening: () => Promise<void>
  stopListening: () => void
  resetTranscript: () => void
}

export function useWhisperVoiceInput(
  options: UseWhisperVoiceInputOptions = {}
): UseWhisperVoiceInputReturn {
  const {
    language = "en",
    onResult,
    onError,
    onEnd,
    minDuration = 500,
    silenceThreshold = 1500
  } = options

  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [interimTranscript, setInterimTranscript] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [whisperAvailable, setWhisperAvailable] = useState<boolean | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSoundTimeRef = useRef<number>(Date.now())
  const recordingStartTimeRef = useRef<number>(0)
  const isListeningRef = useRef(false)
  const animationRef = useRef<number | null>(null)

  // Store callbacks in refs
  const onResultRef = useRef(onResult)
  const onErrorRef = useRef(onError)
  const onEndRef = useRef(onEnd)

  useEffect(() => {
    onResultRef.current = onResult
    onErrorRef.current = onError
    onEndRef.current = onEnd
  }, [onResult, onError, onEnd])

  // Check browser support and Whisper availability
  useEffect(() => {
    const checkSupport = async () => {
      const mediaSupported = typeof window !== "undefined" &&
        typeof navigator !== "undefined" &&
        typeof navigator.mediaDevices !== "undefined" &&
        typeof navigator.mediaDevices.getUserMedia !== "undefined" &&
        typeof MediaRecorder !== "undefined"

      setIsSupported(mediaSupported)

      // Check Whisper availability
      try {
        const response = await fetch("/api/transcribe", { method: "GET" })
        const data = await response.json()
        setWhisperAvailable(data.available && data.primary === "whisper-local")
      } catch {
        setWhisperAvailable(false)
      }
    }

    checkSupport()
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cleanup = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop()
      } catch {
        // Ignore
      }
    }
    mediaRecorderRef.current = null
    analyserRef.current = null
    chunksRef.current = []
  }, [])

  /**
   * Send recorded audio to Whisper for transcription
   */
  const transcribeAudio = useCallback(async (audioBlob: Blob): Promise<string | null> => {
    if (audioBlob.size === 0) return null

    setIsProcessing(true)
    setInterimTranscript("Processing...")

    try {
      const formData = new FormData()
      formData.append("file", audioBlob, "recording.webm")
      if (language) {
        formData.append("language", language)
      }

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData
      })

      const data = await response.json()

      if (data.useBrowserFallback) {
        // Whisper not available, return null to trigger fallback
        return null
      }

      if (data.success && data.transcription?.text) {
        return data.transcription.text
      }

      return null
    } catch (err) {
      console.error("[WhisperVoice] Transcription error:", err)
      return null
    } finally {
      setIsProcessing(false)
      setInterimTranscript("")
    }
  }, [language])

  /**
   * Process accumulated audio chunks
   */
  const processChunks = useCallback(async () => {
    if (chunksRef.current.length === 0) return

    const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" })
    chunksRef.current = []

    const duration = Date.now() - recordingStartTimeRef.current
    if (duration < minDuration) {
      console.log("[WhisperVoice] Audio too short, skipping")
      return
    }

    const text = await transcribeAudio(audioBlob)
    if (text && text.trim()) {
      setTranscript(prev => (prev + " " + text).trim())
      onResultRef.current?.(text.trim(), true)
    }

    recordingStartTimeRef.current = Date.now()
  }, [minDuration, transcribeAudio])

  /**
   * Monitor audio level for silence detection
   */
  const monitorAudioLevel = useCallback(() => {
    if (!analyserRef.current || !isListeningRef.current) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)

    // Calculate average level
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
    const level = average / 255

    // Detect sound
    if (level > 0.02) {
      lastSoundTimeRef.current = Date.now()

      // Clear existing silence timeout
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current)
        silenceTimeoutRef.current = null
      }
    } else {
      // Check for silence
      const silenceDuration = Date.now() - lastSoundTimeRef.current

      if (silenceDuration >= silenceThreshold && !silenceTimeoutRef.current) {
        // Set a timeout to process after silence
        silenceTimeoutRef.current = setTimeout(async () => {
          if (isListeningRef.current && chunksRef.current.length > 0) {
            await processChunks()
          }
          silenceTimeoutRef.current = null
        }, 100)
      }
    }

    if (isListeningRef.current) {
      animationRef.current = requestAnimationFrame(monitorAudioLevel)
    }
  }, [silenceThreshold, processChunks])

  /**
   * Start listening and recording
   */
  const startListening = useCallback(async () => {
    if (isListening) return

    setError(null)
    setInterimTranscript("")
    chunksRef.current = []
    recordingStartTimeRef.current = Date.now()
    lastSoundTimeRef.current = Date.now()

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })
      streamRef.current = stream

      // Set up audio analysis
      audioContextRef.current = new AudioContext()
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256

      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)

      // Determine MIME type
      let mimeType = "audio/webm;codecs=opus"
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        const alternatives = ["audio/webm", "audio/ogg", "audio/mp4", ""]
        for (const alt of alternatives) {
          if (!alt || MediaRecorder.isTypeSupported(alt)) {
            mimeType = alt
            break
          }
        }
      }

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType || undefined,
        audioBitsPerSecond: 128000
      })
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onerror = (event) => {
        const errorMsg = (event as ErrorEvent).message || "Recording error"
        setError(errorMsg)
        onErrorRef.current?.(errorMsg)
      }

      // Start recording with chunking
      mediaRecorder.start(1000)
      setIsListening(true)
      isListeningRef.current = true

      // Start audio level monitoring
      monitorAudioLevel()

      console.log("[WhisperVoice] Started listening")

    } catch (err) {
      cleanup()
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          setError("Microphone access denied")
          onErrorRef.current?.("Microphone access denied")
        } else if (err.name === "NotFoundError") {
          setError("No microphone found")
          onErrorRef.current?.("No microphone found")
        } else {
          setError(err.message)
          onErrorRef.current?.(err.message)
        }
      } else {
        setError("Failed to start recording")
        onErrorRef.current?.("Failed to start recording")
      }
    }
  }, [isListening, cleanup, monitorAudioLevel])

  /**
   * Stop listening and process remaining audio
   */
  const stopListening = useCallback(async () => {
    if (!isListening) return

    console.log("[WhisperVoice] Stopping...")
    isListeningRef.current = false
    setIsListening(false)

    // Clear silence timeout
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }

    // Stop animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }

    // Stop media recorder and process remaining audio
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      // Get remaining data
      mediaRecorderRef.current.requestData()

      // Small delay to ensure data is captured
      await new Promise(resolve => setTimeout(resolve, 100))

      mediaRecorderRef.current.stop()

      // Process any remaining chunks
      if (chunksRef.current.length > 0) {
        await processChunks()
      }
    }

    // Cleanup
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    onEndRef.current?.()
  }, [isListening, processChunks])

  /**
   * Reset transcript
   */
  const resetTranscript = useCallback(() => {
    setTranscript("")
    setInterimTranscript("")
  }, [])

  return {
    isListening,
    isProcessing,
    isSupported,
    transcript: transcript.trim(),
    interimTranscript,
    error,
    whisperAvailable,
    startListening,
    stopListening,
    resetTranscript
  }
}
