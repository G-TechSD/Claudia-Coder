"use client"

import { useState, useEffect, useCallback, useRef } from "react"

interface SpeechSynthesisOptions {
  voice?: string // Voice name or URI
  rate?: number  // 0.1 to 10, default 1
  pitch?: number // 0 to 2, default 1
  volume?: number // 0 to 1, default 1
  onStart?: () => void
  onEnd?: () => void
  onError?: (error: string) => void
}

interface UseSpeechSynthesisReturn {
  isSpeaking: boolean
  isPaused: boolean
  isSupported: boolean
  voices: SpeechSynthesisVoice[]
  speak: (text: string) => void
  cancel: () => void
  pause: () => void
  resume: () => void
  getVoice: (name: string) => SpeechSynthesisVoice | null
  setVoice: (name: string) => void
  currentVoice: SpeechSynthesisVoice | null
}

export function useSpeechSynthesis(options: SpeechSynthesisOptions = {}): UseSpeechSynthesisReturn {
  const {
    voice: voiceName,
    rate = 1,
    pitch = 1,
    volume = 1,
    onStart,
    onEnd,
    onError
  } = options

  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [currentVoice, setCurrentVoice] = useState<SpeechSynthesisVoice | null>(null)

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const queueRef = useRef<string[]>([])

  // Check support and load voices
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setIsSupported(false)
      return
    }

    setIsSupported(true)

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices()
      setVoices(availableVoices)

      // Select initial voice
      if (availableVoices.length > 0) {
        // Try to find the specified voice
        if (voiceName) {
          const found = availableVoices.find(
            v => v.name === voiceName || v.voiceURI === voiceName
          )
          if (found) {
            setCurrentVoice(found)
            return
          }
        }

        // Default: prefer a natural English voice
        const preferred = availableVoices.find(
          v => v.lang.startsWith("en") && v.name.toLowerCase().includes("natural")
        ) || availableVoices.find(
          v => v.lang.startsWith("en") && v.default
        ) || availableVoices.find(
          v => v.lang.startsWith("en")
        ) || availableVoices[0]

        setCurrentVoice(preferred)
      }
    }

    // Load voices (may need to wait for them to load)
    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices

    return () => {
      window.speechSynthesis.cancel()
    }
  }, [voiceName])

  const processQueue = useCallback(() => {
    if (queueRef.current.length === 0) {
      setIsSpeaking(false)
      return
    }

    const text = queueRef.current.shift()!
    const utterance = new SpeechSynthesisUtterance(text)

    utterance.rate = rate
    utterance.pitch = pitch
    utterance.volume = volume

    if (currentVoice) {
      utterance.voice = currentVoice
    }

    utterance.onstart = () => {
      setIsSpeaking(true)
      setIsPaused(false)
      onStart?.()
    }

    utterance.onend = () => {
      // Process next in queue
      if (queueRef.current.length > 0) {
        processQueue()
      } else {
        setIsSpeaking(false)
        onEnd?.()
      }
    }

    utterance.onerror = (event) => {
      setIsSpeaking(false)
      onError?.(event.error || "Speech synthesis error")
    }

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }, [rate, pitch, volume, currentVoice, onStart, onEnd, onError])

  const speak = useCallback((text: string) => {
    if (!isSupported) {
      onError?.("Speech synthesis not supported")
      return
    }

    // Split long text into sentences for better natural pauses
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]

    // Add to queue
    queueRef.current.push(...sentences.map(s => s.trim()).filter(Boolean))

    // Start processing if not already speaking
    if (!isSpeaking) {
      processQueue()
    }
  }, [isSupported, isSpeaking, processQueue, onError])

  const cancel = useCallback(() => {
    queueRef.current = []
    window.speechSynthesis?.cancel()
    setIsSpeaking(false)
    setIsPaused(false)
  }, [])

  const pause = useCallback(() => {
    window.speechSynthesis?.pause()
    setIsPaused(true)
  }, [])

  const resume = useCallback(() => {
    window.speechSynthesis?.resume()
    setIsPaused(false)
  }, [])

  const getVoice = useCallback((name: string): SpeechSynthesisVoice | null => {
    return voices.find(v => v.name === name || v.voiceURI === name) || null
  }, [voices])

  const setVoiceByName = useCallback((name: string) => {
    const voice = getVoice(name)
    if (voice) {
      setCurrentVoice(voice)
    }
  }, [getVoice])

  return {
    isSpeaking,
    isPaused,
    isSupported,
    voices,
    speak,
    cancel,
    pause,
    resume,
    getVoice,
    setVoice: setVoiceByName,
    currentVoice
  }
}

// Helper to get recommended voices
export function getRecommendedVoices(voices: SpeechSynthesisVoice[]): {
  natural: SpeechSynthesisVoice[]
  english: SpeechSynthesisVoice[]
  all: SpeechSynthesisVoice[]
} {
  const natural = voices.filter(
    v => v.name.toLowerCase().includes("natural") ||
         v.name.toLowerCase().includes("neural") ||
         v.name.toLowerCase().includes("premium")
  )

  const english = voices.filter(v => v.lang.startsWith("en"))

  return { natural, english, all: voices }
}
