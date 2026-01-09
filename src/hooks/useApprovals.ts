"use client"

import { useState, useEffect, useCallback } from "react"

type ApprovalStatus = "pending" | "approved" | "rejected" | "expired"
type ApprovalType = "cost" | "deploy" | "security" | "manual" | "quality"

export interface Approval {
  id: string
  type: ApprovalType
  title: string
  description: string
  status: ApprovalStatus
  packetId: string
  requestedBy: string
  requestedAt: Date
  respondedAt?: Date
  respondedBy?: string
  expiresAt?: Date
  details: Record<string, string | number>
  urgency: "high" | "normal" | "low"
}

const STORAGE_KEY = "claudia_approvals"
const STORAGE_EVENT_KEY = "claudia_approvals_update"

/**
 * Hook for managing approval requests
 * Provides approvals list and count with cross-component sync
 */
export function useApprovals() {
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load approvals from storage
  const loadApprovals = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Convert date strings back to Date objects
        const approvalsList = parsed.map((a: Approval) => ({
          ...a,
          requestedAt: new Date(a.requestedAt),
          respondedAt: a.respondedAt ? new Date(a.respondedAt) : undefined,
          expiresAt: a.expiresAt ? new Date(a.expiresAt) : undefined,
        }))
        setApprovals(approvalsList)
      } else {
        setApprovals([])
      }
    } catch {
      setApprovals([])
    }
    setIsLoading(false)
  }, [])

  // Initial load
  useEffect(() => {
    loadApprovals()
  }, [loadApprovals])

  // Listen for storage events (cross-tab sync and custom events)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        loadApprovals()
      }
    }

    const handleCustomEvent = () => {
      loadApprovals()
    }

    window.addEventListener("storage", handleStorageChange)
    window.addEventListener(STORAGE_EVENT_KEY, handleCustomEvent)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener(STORAGE_EVENT_KEY, handleCustomEvent)
    }
  }, [loadApprovals])

  // Get pending count
  const pendingCount = approvals.filter(a => a.status === "pending").length
  const urgentCount = approvals.filter(a => a.status === "pending" && a.urgency === "high").length

  return {
    approvals,
    isLoading,
    pendingCount,
    urgentCount,
    refresh: loadApprovals
  }
}
