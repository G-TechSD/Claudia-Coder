/**
 * Server Sync Hook
 *
 * Synchronizes localStorage data with server on app startup.
 * This ensures data persists across devices.
 *
 * Usage: Call useServerSync() in your main app layout or provider.
 */

import { useEffect, useState } from "react"
import { useSession } from "@/lib/auth/client"
import { syncRunsFromServer } from "@/lib/data/packet-runs"
import { syncResourcesFromServer } from "@/lib/data/resources"

// Sync status
export interface SyncStatus {
  isSyncing: boolean
  lastSyncTime: string | null
  error: string | null
}

// Sync interval (5 minutes)
const SYNC_INTERVAL = 5 * 60 * 1000
// Key for last sync time
const LAST_SYNC_KEY = "claudia_last_server_sync"

/**
 * Hook to sync localStorage data with server
 * Runs on mount and periodically
 */
export function useServerSync() {
  const { data: session, isPending } = useSession()
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    lastSyncTime: null,
    error: null
  })

  useEffect(() => {
    // Only sync when authenticated
    if (isPending || !session?.user?.id) {
      return
    }

    const userId = session.user.id

    // Get last sync time
    const lastSync = typeof window !== "undefined"
      ? localStorage.getItem(LAST_SYNC_KEY)
      : null

    // Check if we need to sync (first time or interval passed)
    const shouldSync = !lastSync ||
      Date.now() - new Date(lastSync).getTime() > SYNC_INTERVAL

    if (!shouldSync) {
      setSyncStatus(prev => ({
        ...prev,
        lastSyncTime: lastSync
      }))
      return
    }

    // Perform sync
    async function performSync() {
      setSyncStatus(prev => ({ ...prev, isSyncing: true, error: null }))

      try {
        // Sync all data types in parallel
        await Promise.all([
          syncRunsFromServer(userId),
          syncResourcesFromServer(userId),
          // Add more sync functions here as they're created
        ])

        const syncTime = new Date().toISOString()
        if (typeof window !== "undefined") {
          localStorage.setItem(LAST_SYNC_KEY, syncTime)
        }

        setSyncStatus({
          isSyncing: false,
          lastSyncTime: syncTime,
          error: null
        })

        console.log("[useServerSync] Sync completed at", syncTime)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error"
        console.error("[useServerSync] Sync failed:", error)
        setSyncStatus(prev => ({
          ...prev,
          isSyncing: false,
          error: errorMsg
        }))
      }
    }

    performSync()

    // Set up periodic sync
    const intervalId = setInterval(performSync, SYNC_INTERVAL)

    return () => {
      clearInterval(intervalId)
    }
  }, [session, isPending])

  return syncStatus
}

/**
 * Force a sync immediately
 */
export async function forceSync(userId: string): Promise<void> {
  console.log("[forceSync] Starting forced sync for user", userId)

  await Promise.all([
    syncRunsFromServer(userId),
    syncResourcesFromServer(userId),
  ])

  const syncTime = new Date().toISOString()
  if (typeof window !== "undefined") {
    localStorage.setItem(LAST_SYNC_KEY, syncTime)
  }

  console.log("[forceSync] Completed at", syncTime)
}
