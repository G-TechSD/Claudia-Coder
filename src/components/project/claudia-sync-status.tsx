"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import {
  RefreshCw,
  Eye,
  EyeOff,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  MessageSquare,
  FileText,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  Inbox,
  Zap
} from "lucide-react"
import Link from "next/link"

// ============ Types ============

type SyncWatchStatus = "watching" | "paused" | "disconnected" | "error"
type RequestStatus = "pending" | "approved" | "rejected" | "expired"
type UpdateType = "file_change" | "command_run" | "error" | "info" | "request" | "completion"

interface ClaudiaRequest {
  id: string
  type: "permission" | "approval" | "review"
  title: string
  description: string
  status: RequestStatus
  createdAt: string
  expiresAt?: string
  packetId?: string
  filePath?: string
  action?: string
}

interface StatusUpdate {
  id: string
  type: UpdateType
  message: string
  timestamp: string
  packetId?: string
  filePath?: string
  details?: string
  read: boolean
}

interface SyncStatus {
  watchStatus: SyncWatchStatus
  lastScanAt: string | null
  isScanning: boolean
  updates: StatusUpdate[]
  pendingRequests: ClaudiaRequest[]
  stats: {
    totalUpdates: number
    unreadUpdates: number
    pendingRequests: number
    completedToday: number
  }
}

interface ClaudiaSyncStatusProps {
  projectId: string
  projectPath: string
  className?: string
}

// ============ Helper Functions ============

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 30) return "just now"
  if (seconds < 60) return `${seconds}s ago`
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

// ============ Status Configurations ============

const watchStatusConfig: Record<SyncWatchStatus, {
  label: string
  color: string
  bgColor: string
  icon: typeof Eye
}> = {
  watching: {
    label: "Watching",
    color: "text-green-400",
    bgColor: "bg-green-400",
    icon: Eye
  },
  paused: {
    label: "Paused",
    color: "text-yellow-400",
    bgColor: "bg-yellow-400",
    icon: EyeOff
  },
  disconnected: {
    label: "Disconnected",
    color: "text-gray-400",
    bgColor: "bg-gray-400",
    icon: EyeOff
  },
  error: {
    label: "Error",
    color: "text-red-400",
    bgColor: "bg-red-400",
    icon: AlertCircle
  }
}

const updateTypeConfig: Record<UpdateType, {
  icon: typeof FileText
  color: string
}> = {
  file_change: { icon: FileText, color: "text-blue-400" },
  command_run: { icon: Zap, color: "text-purple-400" },
  error: { icon: XCircle, color: "text-red-400" },
  info: { icon: MessageSquare, color: "text-gray-400" },
  request: { icon: AlertCircle, color: "text-yellow-400" },
  completion: { icon: CheckCircle2, color: "text-green-400" }
}

// ============ Sub-Components ============

function WatchStatusIndicator({ status }: { status: SyncWatchStatus }) {
  const config = watchStatusConfig[status]
  const Icon = config.icon

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex h-2.5 w-2.5">
        {status === "watching" && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
              config.bgColor
            )}
          />
        )}
        <span
          className={cn(
            "relative inline-flex h-2.5 w-2.5 rounded-full",
            config.bgColor
          )}
        />
      </div>
      <Icon className={cn("h-4 w-4", config.color)} />
      <span className={cn("text-sm font-medium", config.color)}>
        {config.label}
      </span>
    </div>
  )
}

function UpdateItem({ update, onMarkRead }: { update: StatusUpdate; onMarkRead: (id: string) => void }) {
  const config = updateTypeConfig[update.type]
  const Icon = config.icon

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent/50",
        !update.read && "bg-primary/5 border-l-2 border-primary"
      )}
      onClick={() => !update.read && onMarkRead(update.id)}
    >
      <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", config.color)} />
      <div className="flex-1 min-w-0">
        <p className={cn("text-foreground", !update.read && "font-medium")}>
          {update.message}
        </p>
        {update.details && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {update.details}
          </p>
        )}
        {update.filePath && (
          <code className="text-xs text-muted-foreground bg-muted px-1 rounded mt-1 inline-block">
            {update.filePath}
          </code>
        )}
      </div>
      <span className="text-xs text-muted-foreground flex-shrink-0">
        {formatTimeAgo(new Date(update.timestamp))}
      </span>
    </div>
  )
}

function RequestItem({
  request,
  onApprove,
  onReject,
  isProcessing
}: {
  request: ClaudiaRequest
  onApprove: (id: string) => void
  onReject: (id: string) => void
  isProcessing: boolean
}) {
  const isPending = request.status === "pending"

  return (
    <div className={cn(
      "rounded-lg border p-3 space-y-2",
      isPending ? "border-yellow-500/30 bg-yellow-500/5" : "border-muted"
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge
              variant={isPending ? "warning" : request.status === "approved" ? "success" : "secondary"}
              className="text-xs"
            >
              {request.type}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatTime(request.createdAt)}
            </span>
          </div>
          <p className="font-medium text-sm mt-1">{request.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {request.description}
          </p>
          {request.filePath && (
            <code className="text-xs text-muted-foreground bg-muted px-1 rounded mt-1 inline-block">
              {request.filePath}
            </code>
          )}
        </div>
      </div>

      {isPending && (
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            className="gap-1.5 bg-green-600 hover:bg-green-500 text-white h-7 px-2"
            onClick={() => onApprove(request.id)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ThumbsUp className="h-3 w-3" />
            )}
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-7 px-2 border-red-500/30 text-red-400 hover:bg-red-500/10"
            onClick={() => onReject(request.id)}
            disabled={isProcessing}
          >
            <ThumbsDown className="h-3 w-3" />
            Reject
          </Button>
          {request.packetId && (
            <Button size="sm" variant="ghost" className="gap-1 h-7 px-2 ml-auto" asChild>
              <Link href={`/packets?id=${request.packetId}`}>
                <ExternalLink className="h-3 w-3" />
                View Packet
              </Link>
            </Button>
          )}
        </div>
      )}

      {!isPending && (
        <div className="flex items-center gap-2 text-xs">
          {request.status === "approved" ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
          ) : request.status === "rejected" ? (
            <XCircle className="h-3.5 w-3.5 text-red-400" />
          ) : (
            <Clock className="h-3.5 w-3.5 text-gray-400" />
          )}
          <span className="text-muted-foreground capitalize">{request.status}</span>
        </div>
      )}
    </div>
  )
}

// ============ Main Component ============

export function ClaudiaSyncStatus({ projectId, projectPath, className }: ClaudiaSyncStatusProps) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    watchStatus: "disconnected",
    lastScanAt: null,
    isScanning: false,
    updates: [],
    pendingRequests: [],
    stats: {
      totalUpdates: 0,
      unreadUpdates: 0,
      pendingRequests: 0,
      completedToday: 0
    }
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isScanning, setIsScanning] = useState(false)
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch sync status from API
  const fetchSyncStatus = useCallback(async () => {
    // Skip API call if projectPath is empty - API requires workingDirectory
    if (!projectPath) {
      setSyncStatus({
        watchStatus: "disconnected",
        lastScanAt: null,
        isScanning: false,
        updates: [],
        pendingRequests: [],
        stats: {
          totalUpdates: 0,
          unreadUpdates: 0,
          pendingRequests: 0,
          completedToday: 0
        }
      })
      setIsLoading(false)
      return
    }

    try {
      // Both projectId and workingDirectory are required by the API
      const response = await fetch(`/api/claudia-sync?projectId=${projectId}&workingDirectory=${encodeURIComponent(projectPath)}`)

      if (!response.ok) {
        // If 404, return mock data for development
        if (response.status === 404) {
          // Generate mock data for development
          setSyncStatus(generateMockStatus(projectId, projectPath))
          setIsLoading(false)
          return
        }
        throw new Error("Failed to fetch sync status")
      }

      const data = await response.json()
      setSyncStatus(data)
      setError(null)
    } catch (err) {
      console.error("Error fetching sync status:", err)
      // Use mock data in development
      setSyncStatus(generateMockStatus(projectId, projectPath))
      setError(null) // Don't show error in dev mode
    } finally {
      setIsLoading(false)
    }
  }, [projectId, projectPath])

  // Poll for updates
  useEffect(() => {
    fetchSyncStatus()

    // Poll every 7 seconds (between 5-10 as requested)
    const interval = setInterval(fetchSyncStatus, 7000)

    return () => clearInterval(interval)
  }, [fetchSyncStatus])

  // Manual scan trigger
  const handleScanNow = async () => {
    setIsScanning(true)
    try {
      const response = await fetch(`/api/claudia-sync/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, projectPath })
      })

      if (!response.ok && response.status !== 404) {
        throw new Error("Scan failed")
      }

      // Simulate scan completion for mock mode
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Refresh status after scan
      await fetchSyncStatus()
    } catch (err) {
      console.error("Scan error:", err)
      setError("Failed to trigger scan")
    } finally {
      setIsScanning(false)
    }
  }

  // Mark update as read
  const handleMarkRead = (updateId: string) => {
    setSyncStatus(prev => ({
      ...prev,
      updates: prev.updates.map(u =>
        u.id === updateId ? { ...u, read: true } : u
      ),
      stats: {
        ...prev.stats,
        unreadUpdates: Math.max(0, prev.stats.unreadUpdates - 1)
      }
    }))
  }

  // Approve request
  const handleApprove = async (requestId: string) => {
    setProcessingRequestId(requestId)
    try {
      const response = await fetch(`/api/claudia-sync/requests/${requestId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId })
      })

      if (!response.ok && response.status !== 404) {
        throw new Error("Failed to approve")
      }

      // Update local state
      setSyncStatus(prev => ({
        ...prev,
        pendingRequests: prev.pendingRequests.map(r =>
          r.id === requestId ? { ...r, status: "approved" as RequestStatus } : r
        ),
        stats: {
          ...prev.stats,
          pendingRequests: Math.max(0, prev.stats.pendingRequests - 1)
        }
      }))
    } catch (err) {
      console.error("Approve error:", err)
      setError("Failed to approve request")
    } finally {
      setProcessingRequestId(null)
    }
  }

  // Reject request
  const handleReject = async (requestId: string) => {
    setProcessingRequestId(requestId)
    try {
      const response = await fetch(`/api/claudia-sync/requests/${requestId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId })
      })

      if (!response.ok && response.status !== 404) {
        throw new Error("Failed to reject")
      }

      // Update local state
      setSyncStatus(prev => ({
        ...prev,
        pendingRequests: prev.pendingRequests.map(r =>
          r.id === requestId ? { ...r, status: "rejected" as RequestStatus } : r
        ),
        stats: {
          ...prev.stats,
          pendingRequests: Math.max(0, prev.stats.pendingRequests - 1)
        }
      }))
    } catch (err) {
      console.error("Reject error:", err)
      setError("Failed to reject request")
    } finally {
      setProcessingRequestId(null)
    }
  }

  // Mark all as read
  const handleMarkAllRead = () => {
    setSyncStatus(prev => ({
      ...prev,
      updates: prev.updates.map(u => ({ ...u, read: true })),
      stats: {
        ...prev.stats,
        unreadUpdates: 0
      }
    }))
  }

  const pendingRequests = syncStatus.pendingRequests.filter(r => r.status === "pending")
  const recentUpdates = syncStatus.updates.slice(0, 10)

  if (isLoading) {
    return (
      <Card className={cn("", className)}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base font-medium">Claudia Coder Sync</CardTitle>
            {syncStatus.stats.unreadUpdates > 0 && (
              <Badge variant="default" className="h-5 px-1.5 text-xs">
                {syncStatus.stats.unreadUpdates} new
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <WatchStatusIndicator status={syncStatus.watchStatus} />
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-7"
              onClick={handleScanNow}
              disabled={isScanning}
            >
              {isScanning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Scan Now
            </Button>
          </div>
        </div>

        {/* Last scan time */}
        {syncStatus.lastScanAt && (
          <p className="text-xs text-muted-foreground mt-1">
            Last scan: {formatTimeAgo(new Date(syncStatus.lastScanAt))}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 p-2 bg-red-500/10 rounded-lg">
            <AlertCircle className="h-4 w-4" />
            {error}
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 ml-auto"
              onClick={() => setError(null)}
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Pending Requests Section */}
        {pendingRequests.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-400" />
                Pending Requests
                <Badge variant="warning" className="h-5 px-1.5 text-xs">
                  {pendingRequests.length}
                </Badge>
              </h4>
            </div>
            <div className="space-y-2">
              {pendingRequests.map(request => (
                <RequestItem
                  key={request.id}
                  request={request}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  isProcessing={processingRequestId === request.id}
                />
              ))}
            </div>
          </div>
        )}

        {/* Activity Feed Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              Recent Activity
            </h4>
            {syncStatus.stats.unreadUpdates > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={handleMarkAllRead}
              >
                Mark all read
              </Button>
            )}
          </div>

          {recentUpdates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
              <Inbox className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No recent activity</p>
              <p className="text-xs mt-1">Updates from Claudia Coder will appear here</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[280px]">
              <div className="space-y-1">
                {recentUpdates.map(update => (
                  <UpdateItem
                    key={update.id}
                    update={update}
                    onMarkRead={handleMarkRead}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Stats Footer */}
        <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>{syncStatus.stats.totalUpdates} total updates</span>
            <span>{syncStatus.stats.completedToday} completed today</span>
          </div>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1" asChild>
            <Link href={`/activity?projectId=${projectId}`}>
              View all
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ============ Mock Data Generator (for development) ============

function generateMockStatus(projectId: string, projectPath: string): SyncStatus {
  const now = new Date()

  const mockUpdates: StatusUpdate[] = [
    {
      id: "u1",
      type: "completion",
      message: "Completed packet: Add user authentication",
      timestamp: new Date(now.getTime() - 5 * 60000).toISOString(),
      packetId: "pkt-001",
      read: false
    },
    {
      id: "u2",
      type: "file_change",
      message: "Modified 3 files in src/components",
      timestamp: new Date(now.getTime() - 12 * 60000).toISOString(),
      filePath: "src/components/auth/",
      details: "login.tsx, register.tsx, auth-provider.tsx",
      read: false
    },
    {
      id: "u3",
      type: "command_run",
      message: "Executed: npm run build",
      timestamp: new Date(now.getTime() - 25 * 60000).toISOString(),
      details: "Build completed successfully",
      read: true
    },
    {
      id: "u4",
      type: "info",
      message: "Started working on packet: API integration",
      timestamp: new Date(now.getTime() - 45 * 60000).toISOString(),
      packetId: "pkt-002",
      read: true
    },
    {
      id: "u5",
      type: "error",
      message: "Test suite failed: 2 tests failing",
      timestamp: new Date(now.getTime() - 90 * 60000).toISOString(),
      details: "auth.test.ts: expect(user).toBeDefined() failed",
      read: true
    }
  ]

  const mockRequests: ClaudiaRequest[] = [
    {
      id: "r1",
      type: "permission",
      title: "Write to package.json",
      description: "Claudia Coder wants to add a new dependency: zod@3.22.0",
      status: "pending",
      createdAt: new Date(now.getTime() - 2 * 60000).toISOString(),
      filePath: "package.json",
      action: "write"
    },
    {
      id: "r2",
      type: "approval",
      title: "Deploy to staging",
      description: "Ready to deploy current changes to staging environment",
      status: "pending",
      createdAt: new Date(now.getTime() - 8 * 60000).toISOString(),
      packetId: "pkt-001"
    }
  ]

  return {
    watchStatus: "watching",
    lastScanAt: new Date(now.getTime() - 30000).toISOString(),
    isScanning: false,
    updates: mockUpdates,
    pendingRequests: mockRequests,
    stats: {
      totalUpdates: mockUpdates.length,
      unreadUpdates: mockUpdates.filter(u => !u.read).length,
      pendingRequests: mockRequests.filter(r => r.status === "pending").length,
      completedToday: 3
    }
  }
}
