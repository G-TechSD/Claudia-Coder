"use client"

import * as React from "react"
import { ActivityEvent } from "@/components/execution/activity-stream"

const STORAGE_KEY_PREFIX = "claudia_activity_events_"

interface PersistedEvent {
  id: string
  type: ActivityEvent["type"]
  message: string
  timestamp: string
  detail?: string
  iteration?: number
  progress?: number
  files?: string[]
  tool?: string
  command?: string
  content?: string
  streaming?: boolean
  provider?: string
  model?: string
  testResults?: {
    passed: number
    failed: number
    total: number
  }
}

export interface UseActivityPersistenceReturn {
  events: ActivityEvent[]
  addEvent: (
    type: ActivityEvent["type"],
    message: string,
    detail?: string,
    extra?: Partial<ActivityEvent>
  ) => void
  clearEvents: () => void
  isLoading: boolean
  setEvents: React.Dispatch<React.SetStateAction<ActivityEvent[]>>
}

/**
 * Hook for persisting activity events to localStorage with project scoping
 *
 * Features:
 * - Events are scoped by projectId to avoid mixing projects
 * - Persists to localStorage immediately on change
 * - Syncs across browser tabs via StorageEvent listener
 * - Automatically converts Date objects for serialization
 */
export function useActivityPersistence(projectId: string): UseActivityPersistenceReturn {
  const [events, setEvents] = React.useState<ActivityEvent[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const storageKey = `${STORAGE_KEY_PREFIX}${projectId}`

  // Load events from localStorage on mount
  React.useEffect(() => {
    if (!projectId) {
      setIsLoading(false)
      return
    }

    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed: PersistedEvent[] = JSON.parse(stored)
        // Convert timestamp strings back to Date objects
        const loadedEvents: ActivityEvent[] = parsed.map((e) => ({
          ...e,
          timestamp: new Date(e.timestamp),
        }))
        setEvents(loadedEvents)
      }
    } catch (error) {
      console.error("[useActivityPersistence] Failed to load events:", error)
    } finally {
      setIsLoading(false)
    }
  }, [projectId, storageKey])

  // Persist events to localStorage whenever they change
  React.useEffect(() => {
    if (isLoading || !projectId) return

    try {
      const toStore: PersistedEvent[] = events.map((e) => ({
        id: e.id,
        type: e.type,
        message: e.message,
        timestamp: e.timestamp instanceof Date ? e.timestamp.toISOString() : e.timestamp as unknown as string,
        detail: e.detail,
        iteration: e.iteration,
        progress: e.progress,
        files: e.files,
        tool: e.tool,
        command: e.command,
        content: e.content,
        streaming: e.streaming,
        provider: e.provider,
        model: e.model,
        testResults: e.testResults,
      }))
      localStorage.setItem(storageKey, JSON.stringify(toStore))
    } catch (error) {
      console.error("[useActivityPersistence] Failed to save events:", error)
    }
  }, [events, isLoading, projectId, storageKey])

  // Listen for storage events from other tabs
  React.useEffect(() => {
    if (!projectId) return

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        try {
          const parsed: PersistedEvent[] = JSON.parse(e.newValue)
          const loadedEvents: ActivityEvent[] = parsed.map((ev) => ({
            ...ev,
            timestamp: new Date(ev.timestamp),
          }))
          setEvents(loadedEvents)
        } catch (error) {
          console.error("[useActivityPersistence] Failed to sync events from other tab:", error)
        }
      }
    }

    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [projectId, storageKey])

  // Add a new event
  const addEvent = React.useCallback(
    (
      type: ActivityEvent["type"],
      message: string,
      detail?: string,
      extra?: Partial<ActivityEvent>
    ) => {
      const newEvent: ActivityEvent = {
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type,
        timestamp: new Date(),
        message,
        detail,
        ...extra,
      }
      setEvents((prev) => [...prev, newEvent])
    },
    []
  )

  // Clear all events
  const clearEvents = React.useCallback(() => {
    setEvents([])
    try {
      localStorage.removeItem(storageKey)
    } catch (error) {
      console.error("[useActivityPersistence] Failed to clear events:", error)
    }
  }, [storageKey])

  return {
    events,
    addEvent,
    clearEvents,
    isLoading,
    setEvents,
  }
}

/**
 * Hook for accessing run history data
 */
export function useRunHistory(projectId?: string) {
  const [history, setHistory] = React.useState<RunHistorySummary[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const fetchHistory = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const url = projectId
        ? `/api/run-history?projectId=${projectId}`
        : "/api/run-history"
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to fetch run history: ${response.statusText}`)
      }
      const data = await response.json()
      setHistory(data.history || [])
    } catch (err) {
      console.error("[useRunHistory] Error fetching history:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch run history")
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  React.useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  return {
    history,
    isLoading,
    error,
    refetch: fetchHistory,
  }
}

// Run history summary type for list views
export interface RunHistorySummary {
  id: string
  projectId: string
  projectName?: string
  userId: string
  startedAt: string
  completedAt?: string
  status: "running" | "complete" | "error" | "cancelled"
  packetCount: number
  successCount: number
  failedCount: number
  duration?: number
  mode?: string
}
