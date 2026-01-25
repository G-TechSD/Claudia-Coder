"use client"

import { useState, useRef, useCallback, useEffect } from "react"

interface UseAudioRecorderOptions {
  mimeType?: string
  audioBitsPerSecond?: number
  onDataAvailable?: (blob: Blob) => void
}

interface UseAudioRecorderReturn {
  isRecording: boolean
  isPaused: boolean
  duration: number
  audioLevel: number
  error: string | null
  isSupported: boolean

  startRecording: () => Promise<void>
  pauseRecording: () => void
  resumeRecording: () => void
  stopRecording: () => Promise<Blob | null>
  cancelRecording: () => void
}

export function useAudioRecorder(
  options: UseAudioRecorderOptions = {}
): UseAudioRecorderReturn {
  const {
    mimeType = "audio/webm;codecs=opus",
    audioBitsPerSecond = 128000
  } = options

  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [duration, setDuration] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number | null>(null)
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)
  const pausedDurationRef = useRef<number>(0)
  const resolveStopRef = useRef<((blob: Blob | null) => void) | null>(null)

  // Check browser support
  useEffect(() => {
    const supported = typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      typeof navigator.mediaDevices !== "undefined" &&
      typeof navigator.mediaDevices.getUserMedia !== "undefined" &&
      typeof MediaRecorder !== "undefined"

    setIsSupported(supported)
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
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current)
      durationIntervalRef.current = null
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    mediaRecorderRef.current = null
    analyserRef.current = null
    chunksRef.current = []
  }, [])

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)

    // Calculate average level
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
    setAudioLevel(average / 255) // Normalize to 0-1

    if (isRecording && !isPaused) {
      animationRef.current = requestAnimationFrame(updateAudioLevel)
    }
  }, [isRecording, isPaused])

  const startDurationTimer = useCallback(() => {
    startTimeRef.current = Date.now()
    durationIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current + pausedDurationRef.current
      setDuration(Math.floor(elapsed / 1000))
    }, 100)
  }, [])

  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current)
      durationIntervalRef.current = null
    }
    pausedDurationRef.current = Date.now() - startTimeRef.current + pausedDurationRef.current
  }, [])

  const startRecording = useCallback(async () => {
    if (isRecording) return
    setError(null)
    chunksRef.current = []
    pausedDurationRef.current = 0
    setDuration(0)

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

      // Set up audio analysis for level visualization
      audioContextRef.current = new AudioContext()
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256

      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)

      // Check for supported MIME type
      let actualMimeType = mimeType
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        // Fallback to alternatives
        const alternatives = [
          "audio/webm",
          "audio/ogg",
          "audio/mp4",
          ""
        ]
        for (const alt of alternatives) {
          if (!alt || MediaRecorder.isTypeSupported(alt)) {
            actualMimeType = alt
            break
          }
        }
      }

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: actualMimeType || undefined,
        audioBitsPerSecond
      })
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
          options.onDataAvailable?.(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: actualMimeType || "audio/webm"
        })
        if (resolveStopRef.current) {
          resolveStopRef.current(blob)
          resolveStopRef.current = null
        }
      }

      mediaRecorder.onerror = (event) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setError((event as any).error?.message || "Recording error")
      }

      // Start recording with timeslice for chunked data
      mediaRecorder.start(1000) // Chunk every second
      setIsRecording(true)
      setIsPaused(false)

      // Start audio level monitoring
      updateAudioLevel()

      // Start duration timer
      startDurationTimer()

    } catch (err) {
      cleanup()
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          setError("Microphone access denied")
        } else if (err.name === "NotFoundError") {
          setError("No microphone found")
        } else {
          setError(err.message)
        }
      } else {
        setError("Failed to start recording")
      }
    }
  }, [isRecording, mimeType, audioBitsPerSecond, options, cleanup, updateAudioLevel, startDurationTimer])

  const pauseRecording = useCallback(() => {
    if (!isRecording || isPaused) return

    const mediaRecorder = mediaRecorderRef.current
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.pause()
      setIsPaused(true)
      stopDurationTimer()
      setAudioLevel(0)
    }
  }, [isRecording, isPaused, stopDurationTimer])

  const resumeRecording = useCallback(() => {
    if (!isRecording || !isPaused) return

    const mediaRecorder = mediaRecorderRef.current
    if (mediaRecorder && mediaRecorder.state === "paused") {
      mediaRecorder.resume()
      setIsPaused(false)
      startDurationTimer()
      updateAudioLevel()
    }
  }, [isRecording, isPaused, startDurationTimer, updateAudioLevel])

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    if (!isRecording) return null

    return new Promise((resolve) => {
      resolveStopRef.current = resolve

      const mediaRecorder = mediaRecorderRef.current
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop()
      } else {
        resolve(null)
      }

      setIsRecording(false)
      setIsPaused(false)
      stopDurationTimer()
      setAudioLevel(0)

      // Stop stream tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }

      // Close audio context
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close()
      }
    })
  }, [isRecording, stopDurationTimer])

  const cancelRecording = useCallback(() => {
    if (!isRecording) return

    cleanup()
    setIsRecording(false)
    setIsPaused(false)
    setDuration(0)
    setAudioLevel(0)
    pausedDurationRef.current = 0
    chunksRef.current = []

    if (resolveStopRef.current) {
      resolveStopRef.current(null)
      resolveStopRef.current = null
    }
  }, [isRecording, cleanup])

  return {
    isRecording,
    isPaused,
    duration,
    audioLevel,
    error,
    isSupported,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording
  }
}

// Helper to format duration as mm:ss
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}
