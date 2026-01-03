"use client"

import { useState, useEffect, useCallback } from "react"
import {
  getSettings,
  updateSettings,
  subscribeToSettings,
  type AppSettings
} from "@/lib/settings"

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(getSettings)

  // Subscribe to settings changes
  useEffect(() => {
    // Initial load
    setSettings(getSettings())

    // Subscribe to changes from other components
    const unsubscribe = subscribeToSettings(setSettings)
    return unsubscribe
  }, [])

  const update = useCallback((updates: Partial<AppSettings>) => {
    const newSettings = updateSettings(updates)
    setSettings(newSettings)
    return newSettings
  }, [])

  return { settings, update }
}
