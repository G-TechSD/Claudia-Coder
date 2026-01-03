/**
 * Application Settings
 *
 * Settings are stored in localStorage and control global behaviors
 * like paid API usage and preferences.
 */

export interface AppSettings {
  // LLM Settings
  allowPaidLLM: boolean // Allow fallback to paid APIs (Claude, OpenAI)
  preferredLocalServer: string | null // Preferred LM Studio/Ollama server

  // Image Generation
  allowPaidImageGen: boolean // Allow paid image generation
  nanoBananaApiKey: string | null // NanoBanana API key

  // General
  autoSpeak: boolean // Auto-speak AI responses
  theme: "light" | "dark" | "system"
}

const DEFAULT_SETTINGS: AppSettings = {
  allowPaidLLM: false,
  preferredLocalServer: null,
  allowPaidImageGen: false,
  nanoBananaApiKey: null,
  autoSpeak: true,
  theme: "system"
}

const STORAGE_KEY = "claudia-settings"

export function getSettings(): AppSettings {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
    }
  } catch {
    console.warn("Failed to load settings from localStorage")
  }

  return DEFAULT_SETTINGS
}

export function updateSettings(updates: Partial<AppSettings>): AppSettings {
  const current = getSettings()
  const newSettings = { ...current, ...updates }

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings))
    } catch {
      console.warn("Failed to save settings to localStorage")
    }
  }

  // Dispatch custom event for reactive updates
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("settings-changed", { detail: newSettings }))
  }

  return newSettings
}

export function resetSettings(): AppSettings {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY)
    window.dispatchEvent(new CustomEvent("settings-changed", { detail: DEFAULT_SETTINGS }))
  }
  return DEFAULT_SETTINGS
}

// Hook helper for settings changes
export function subscribeToSettings(callback: (settings: AppSettings) => void): () => void {
  if (typeof window === "undefined") {
    return () => {}
  }

  const handler = (e: Event) => {
    callback((e as CustomEvent<AppSettings>).detail)
  }

  window.addEventListener("settings-changed", handler)
  return () => window.removeEventListener("settings-changed", handler)
}
