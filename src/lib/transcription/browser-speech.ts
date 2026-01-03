/**
 * Browser Speech API Fallback for Transcription
 * Uses Web Speech API when local Whisper is unavailable
 */

// Web Speech API type declarations
interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionResult {
  isFinal: boolean
  length: number
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionResultList {
  length: number
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionEventMap {
  audioend: Event
  audiostart: Event
  end: Event
  error: SpeechRecognitionErrorEvent
  nomatch: SpeechRecognitionEvent
  result: SpeechRecognitionEvent
  soundend: Event
  soundstart: Event
  speechend: Event
  speechstart: Event
  start: Event
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message?: string
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  grammars: unknown
  interimResults: boolean
  lang: string
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition
}

export interface BrowserTranscriptionResult {
  text: string
  confidence: number
  isFinal: boolean
}

export interface BrowserTranscriptionOptions {
  language?: string
  continuous?: boolean
  interimResults?: boolean
  onInterimResult?: (text: string) => void
  onError?: (error: string) => void
}

/**
 * Check if browser supports Speech Recognition
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false
  return !!(
    (window as Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
      .SpeechRecognition ||
    (window as Window & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  )
}

/**
 * Get SpeechRecognition constructor
 */
function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return win.SpeechRecognition || win.webkitSpeechRecognition || null
}

/**
 * Transcribe audio using browser's Speech Recognition API
 * Note: This requires playing the audio through speakers or using a workaround
 */
export async function transcribeWithBrowserSpeech(
  audioBlob: Blob,
  options: BrowserTranscriptionOptions = {}
): Promise<BrowserTranscriptionResult> {
  const SpeechRecognitionClass = getSpeechRecognition()

  if (!SpeechRecognitionClass) {
    throw new Error("Speech Recognition not supported in this browser")
  }

  return new Promise((resolve, reject) => {
    const recognition = new SpeechRecognitionClass()

    recognition.lang = options.language || "en-US"
    recognition.continuous = options.continuous ?? true
    recognition.interimResults = options.interimResults ?? true
    recognition.maxAlternatives = 1

    let fullTranscript = ""
    let lastConfidence = 0

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = ""

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0].transcript

        if (result.isFinal) {
          fullTranscript += transcript + " "
          lastConfidence = result[0].confidence
        } else {
          interimTranscript += transcript
          options.onInterimResult?.(fullTranscript + interimTranscript)
        }
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      options.onError?.(event.error)
      reject(new Error(`Speech recognition error: ${event.error}`))
    }

    recognition.onend = () => {
      resolve({
        text: fullTranscript.trim(),
        confidence: lastConfidence,
        isFinal: true
      })
    }

    // For audio blob transcription, we need to play it through Audio API
    // and let the microphone pick it up, or use AudioContext routing
    // This is a limitation of the Web Speech API

    // Alternative approach: Use the audio blob with MediaStream
    transcribeAudioBlob(audioBlob, recognition, options)
      .catch(reject)
  })
}

/**
 * Helper to transcribe an audio blob
 * This plays the audio and uses speech recognition on the output
 */
async function transcribeAudioBlob(
  blob: Blob,
  recognition: SpeechRecognition,
  options: BrowserTranscriptionOptions
): Promise<void> {
  // Create audio context for playback analysis
  const audioContext = new AudioContext()
  const arrayBuffer = await blob.arrayBuffer()
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

  // Create audio element
  const audioUrl = URL.createObjectURL(blob)
  const audio = new Audio(audioUrl)

  return new Promise((resolve, reject) => {
    audio.onended = () => {
      // Give recognition a moment to finish processing
      setTimeout(() => {
        recognition.stop()
        URL.revokeObjectURL(audioUrl)
        audioContext.close()
        resolve()
      }, 500)
    }

    audio.onerror = () => {
      URL.revokeObjectURL(audioUrl)
      audioContext.close()
      reject(new Error("Failed to play audio"))
    }

    // Start recognition and playback
    recognition.start()
    audio.play().catch(reject)
  })
}

/**
 * Live transcription from microphone
 */
export function startLiveTranscription(
  options: BrowserTranscriptionOptions & {
    onResult: (result: BrowserTranscriptionResult) => void
  }
): { stop: () => void } {
  const SpeechRecognitionClass = getSpeechRecognition()

  if (!SpeechRecognitionClass) {
    throw new Error("Speech Recognition not supported")
  }

  const recognition = new SpeechRecognitionClass()

  recognition.lang = options.language || "en-US"
  recognition.continuous = true
  recognition.interimResults = true
  recognition.maxAlternatives = 1

  let fullTranscript = ""

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    let interimTranscript = ""

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      const transcript = result[0].transcript

      if (result.isFinal) {
        fullTranscript += transcript + " "
        options.onResult({
          text: fullTranscript.trim(),
          confidence: result[0].confidence,
          isFinal: true
        })
      } else {
        interimTranscript += transcript
        options.onResult({
          text: fullTranscript + interimTranscript,
          confidence: result[0].confidence,
          isFinal: false
        })
      }
    }
  }

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    options.onError?.(event.error)
  }

  recognition.onend = () => {
    // Restart if continuous mode
    if (options.continuous) {
      try {
        recognition.start()
      } catch {
        // Already started or stopped
      }
    }
  }

  recognition.start()

  return {
    stop: () => {
      recognition.stop()
    }
  }
}

/**
 * Get supported languages for speech recognition
 */
export function getSupportedLanguages(): string[] {
  // Common languages supported by most browsers
  return [
    "en-US",
    "en-GB",
    "es-ES",
    "es-MX",
    "fr-FR",
    "de-DE",
    "it-IT",
    "pt-BR",
    "pt-PT",
    "ja-JP",
    "ko-KR",
    "zh-CN",
    "zh-TW",
    "ru-RU",
    "ar-SA",
    "hi-IN"
  ]
}
