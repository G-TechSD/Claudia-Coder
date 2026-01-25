"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  getSettings,
  updateSettings,
  subscribeToSettings,
  type AppSettings
} from "@/lib/settings"

export type SyncStatus = "idle" | "syncing" | "synced" | "error"

export interface SettingsState {
  settings: AppSettings
  syncStatus: SyncStatus
  lastSyncedAt: string | null
  error: string | null
}

/**
 * Hook for managing app settings with server sync
 * Provides settings state and update function with automatic server synchronization
 */
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(getSettings)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle")
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch settings from server
  const fetchFromServer = useCallback(async () => {
    setSyncStatus("syncing")
    setError(null)

    try {
      const response = await fetch("/api/settings", {
        method: "GET",
        credentials: "include"
      })

      if (!response.ok) {
        if (response.status === 401) {
          // Not authenticated - use localStorage
          setSyncStatus("idle")
          return
        }
        throw new Error(`Server returned ${response.status}`)
      }

      const data = await response.json()

      if (data.success && data.exists && data.appSettings) {
        // Merge server settings with local (server takes precedence)
        const mergedSettings = { ...getSettings(), ...data.appSettings }
        setSettings(mergedSettings)
        // Also update localStorage
        updateSettings(mergedSettings)
      }

      setSyncStatus("synced")
      setLastSyncedAt(data.lastUpdated || new Date().toISOString())
    } catch (err) {
      console.warn("[useSettings] Failed to fetch from server:", err)
      setSyncStatus("error")
      setError(err instanceof Error ? err.message : "Failed to sync")
    }
  }, [])

  // Fetch settings from server on mount
  useEffect(() => {
    // Initial load from localStorage
    setSettings(getSettings())

    // Subscribe to changes from other components
    const unsubscribe = subscribeToSettings(setSettings)

    // Attempt to fetch from server
    fetchFromServer()

    return () => {
      unsubscribe()
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
      }
    }
  }, [fetchFromServer])

  // Sync settings to server with debounce
  const syncToServer = useCallback(async (settingsToSync: AppSettings) => {
    // Clear any pending sync
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current)
    }

    // Debounce server sync to avoid too many requests
    syncTimeoutRef.current = setTimeout(async () => {
      setSyncStatus("syncing")
      setError(null)

      try {
        const response = await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ appSettings: settingsToSync })
        })

        if (!response.ok) {
          if (response.status === 401) {
            // Not authenticated - skip server sync
            setSyncStatus("idle")
            return
          }
          throw new Error(`Server returned ${response.status}`)
        }

        const data = await response.json()

        if (data.success) {
          setSyncStatus("synced")
          setLastSyncedAt(data.lastUpdated || new Date().toISOString())
        } else {
          throw new Error(data.error || "Sync failed")
        }
      } catch (err) {
        console.warn("[useSettings] Failed to sync to server:", err)
        setSyncStatus("error")
        setError(err instanceof Error ? err.message : "Failed to sync")
      }
    }, 500) // 500ms debounce
  }, [])

  // Update settings (local + server sync)
  const update = useCallback((updates: Partial<AppSettings>) => {
    const newSettings = updateSettings(updates)
    setSettings(newSettings)

    // Trigger server sync
    syncToServer(newSettings)

    return newSettings
  }, [syncToServer])

  // Force refresh from server
  const refresh = useCallback(() => {
    return fetchFromServer()
  }, [fetchFromServer])

  return {
    settings,
    update,
    refresh,
    syncStatus,
    lastSyncedAt,
    error,
    isSynced: syncStatus === "synced",
    isSyncing: syncStatus === "syncing"
  }
}
