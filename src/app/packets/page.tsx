"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Package,
  Search,
  Filter,
  Play,
  Pause,
  Square,
  XCircle,
  RotateCcw,
  ChevronDown,
  Clock,
  CheckCircle,
  AlertTriangle,
  Loader2,
  GitBranch,
  User,
  ExternalLink,
  Terminal,
  Zap,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  StopCircle,
  List,
  LayoutGrid
} from "lucide-react"
import { useLegacyPacketExecution, type ExecutionLog, type ExecutionResult } from "@/hooks/usePacketExecution"

// Extended status types to match N8N data
type PacketStatus = "queued" | "running" | "paused" | "blocked" | "completed" | "failed" | "cancelled"
type PacketPriority = "high" | "normal" | "low"
type FeedbackType = "thumbs_up" | "thumbs_down" | null

interface Packet {
  id: string
  packetID: string
  projectID: string
  planRunID: string
  title: string
  summary: string
  status: PacketStatus
  priority: PacketPriority
  assignedWorker: string | null
  issueIDs: string[]
  issues: Array<{ id: string; title: string; description: string }>
  acceptanceCriteria: string[]
  risks: string[]
  dependencies: string[]
  feedback: FeedbackType
  feedbackComment: string | null
  startedAt: Date | null
  completedAt: Date | null
  createdAt: Date | null
  updatedAt: Date | null
}

// API response type
interface ApiPacket {
  id: string
  packetID: string
  projectID: string
  planRunID: string
  title: string
  summary: string
  status: string
  assignedWorker: string | null
  issueIDs: string[]
  issues: Array<{ id: string; title: string; description: string }>
  acceptanceCriteria: string[]
  risks: string[]
  dependencies: string[]
  feedback: FeedbackType
  feedbackComment: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

const statusConfig: Record<PacketStatus, {
  icon: typeof Clock
  color: string
  bg: string
  label: string
  animate?: boolean
  badgeVariant: "secondary" | "default" | "warning" | "success" | "destructive"
}> = {
  queued: {
    icon: Clock,
    color: "text-muted-foreground",
    bg: "bg-muted-foreground",
    label: "Queued",
    badgeVariant: "secondary"
  },
  running: {
    icon: Loader2,
    color: "text-blue-400",
    bg: "bg-blue-400",
    label: "Running",
    animate: true,
    badgeVariant: "default"
  },
  paused: {
    icon: Pause,
    color: "text-orange-400",
    bg: "bg-orange-400",
    label: "Paused",
    badgeVariant: "warning"
  },
  blocked: {
    icon: AlertTriangle,
    color: "text-yellow-400",
    bg: "bg-yellow-400",
    label: "Blocked",
    badgeVariant: "warning"
  },
  completed: {
    icon: CheckCircle,
    color: "text-green-400",
    bg: "bg-green-400",
    label: "Completed",
    badgeVariant: "success"
  },
  failed: {
    icon: XCircle,
    color: "text-red-400",
    bg: "bg-red-400",
    label: "Failed",
    badgeVariant: "destructive"
  },
  cancelled: {
    icon: StopCircle,
    color: "text-gray-400",
    bg: "bg-gray-400",
    label: "Cancelled",
    badgeVariant: "secondary"
  }
}

const workerConfig: Record<string, { label: string; color: string }> = {
  worker_bee_gptoss: { label: "GPT-OSS", color: "text-blue-400" },
  worker_bee_opus: { label: "Claude Opus", color: "text-purple-400" },
  vision_worker: { label: "Vision", color: "text-green-400" },
}

function formatDate(date: Date | null): string {
  if (!date) return "-"
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })
}

function formatDuration(start: Date | null, end: Date | null): string {
  if (!start) return "-"
  const endTime = end || new Date()
  const diff = endTime.getTime() - start.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  return `${minutes}m`
}

function transformApiPacket(apiPacket: ApiPacket): Packet {
  return {
    ...apiPacket,
    status: (apiPacket.status as PacketStatus) || "queued",
    priority: "normal" as PacketPriority, // Default priority
    startedAt: apiPacket.startedAt ? new Date(apiPacket.startedAt) : null,
    completedAt: apiPacket.completedAt ? new Date(apiPacket.completedAt) : null,
    createdAt: apiPacket.createdAt ? new Date(apiPacket.createdAt) : null,
    updatedAt: apiPacket.updatedAt ? new Date(apiPacket.updatedAt) : null,
  }
}

// View mode type for list/tile toggle
type ViewMode = "list" | "tile"

// Helper to get view mode from localStorage
function getStoredViewMode(): ViewMode {
  if (typeof window === "undefined") return "list"
  const stored = localStorage.getItem("claudia_packets_view_mode")
  return (stored === "tile" ? "tile" : "list") as ViewMode
}

export default function PacketsPage() {
  const [packets, setPackets] = useState<Packet[]>([])
  const [selectedPacket, setSelectedPacket] = useState<Packet | null>(null)
  const [filter, setFilter] = useState<PacketStatus | "all">("all")
  const [search, setSearch] = useState("")
  const [showExecutionLogs, setShowExecutionLogs] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("list")

  // Execution hook
  const {
    execute,
    isExecuting,
    currentPacketId,
    lastResult,
    logs,
    checkServerStatus
  } = useLegacyPacketExecution()

  interface ServerInfo {
    name: string
    url: string
    type: string
    status: string
    currentModel: string | null
    availableModels: string[]
  }

  const [serverStatus, setServerStatus] = useState<{ servers: ServerInfo[]; available: boolean } | null>(null)
  const [selectedServer, setSelectedServer] = useState<string | null>(null)
  const [executionMode, setExecutionMode] = useState<"standard" | "long-horizon">("standard")

  // Fetch packets from multiple sources: localStorage (primary), N8N API (secondary)
  const loadPackets = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const allPackets: Packet[] = []
    const seenIds = new Set<string>()

    // 1. First, load from localStorage (where build plan packets are stored)
    try {
      const storedPackets = localStorage.getItem("claudia_packets")
      if (storedPackets) {
        const packetsByProject = JSON.parse(storedPackets) as Record<string, Array<{
          id: string
          title: string
          description: string
          type: string
          priority: string
          status: string
          tasks?: Array<{ id: string; description: string; completed: boolean }>
          acceptanceCriteria?: string[]
          phaseId?: string
          assignedModel?: string
        }>>

        // Flatten all project packets
        for (const [projectId, projectPackets] of Object.entries(packetsByProject)) {
          for (const wp of projectPackets) {
            if (!seenIds.has(wp.id)) {
              seenIds.add(wp.id)
              // Map status from WorkPacket to Packet status
              let status: Packet["status"] = "queued"
              if (wp.status === "completed") status = "completed"
              else if (wp.status === "in_progress" || wp.status === "assigned") status = "running"
              else if (wp.status === "blocked") status = "blocked"
              else if (wp.status === "review") status = "running"

              // Map priority to PacketPriority type (high | normal | low)
              let priority: PacketPriority = "normal"
              if (wp.priority === "critical" || wp.priority === "high") priority = "high"
              else if (wp.priority === "low") priority = "low"

              allPackets.push({
                id: wp.id,
                packetID: wp.id,
                projectID: projectId,
                planRunID: wp.phaseId || "",
                title: wp.title,
                summary: wp.description || "",
                status,
                priority,
                assignedWorker: wp.assignedModel || null,
                issueIDs: [],
                issues: [],
                acceptanceCriteria: wp.acceptanceCriteria || [],
                risks: [],
                dependencies: [],
                feedback: null,
                feedbackComment: null,
                startedAt: null,
                completedAt: null,
                createdAt: new Date(),
                updatedAt: new Date()
              })
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to load packets from localStorage:", err)
    }

    // 2. Then try the server-side API (loads from N8N and .local-storage files)
    try {
      const response = await fetch("/api/packets")
      const data = await response.json()

      if (data.success && data.packets) {
        const transformedPackets = data.packets.map(transformApiPacket)
        for (const packet of transformedPackets) {
          if (!seenIds.has(packet.id)) {
            seenIds.add(packet.id)
            allPackets.push(packet)
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch packets from API:", err)
      // Don't set error if we have browser localStorage packets
    }

    // Sort by priority and creation date
    allPackets.sort((a, b) => {
      const priorityOrder: Record<string, number> = { high: 0, normal: 1, low: 2 }
      const aPriority = priorityOrder[a.priority] ?? 1
      const bPriority = priorityOrder[b.priority] ?? 1
      if (aPriority !== bPriority) return aPriority - bPriority
      const aTime = a.createdAt?.getTime() ?? 0
      const bTime = b.createdAt?.getTime() ?? 0
      return bTime - aTime
    })

    setPackets(allPackets)
    // Auto-select first packet if none selected
    if (allPackets.length > 0 && !selectedPacket) {
      setSelectedPacket(allPackets[0])
    }
    // Clear any previous error - empty state is handled in the UI
    setError(null)

    setIsLoading(false)
  }, [selectedPacket])

  useEffect(() => {
    loadPackets()
    checkServerStatus().then((result: { servers: unknown[]; available: boolean }) => {
      setServerStatus({
        servers: result.servers as ServerInfo[],
        available: result.available
      })
    })
  }, [loadPackets, checkServerStatus])

  // Refresh packets after execution
  useEffect(() => {
    if (lastResult) {
      loadPackets()
    }
  }, [lastResult, loadPackets])

  // Load view mode from localStorage on mount
  useEffect(() => {
    setViewMode(getStoredViewMode())
  }, [])

  // Handle view mode change with localStorage persistence
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem("claudia_packets_view_mode", mode)
  }

  // Handle packet actions
  const handlePacketAction = async (packetId: string, action: "start" | "stop" | "pause" | "cancel") => {
    setActionLoading(packetId)

    try {
      const response = await fetch("/api/packets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, packetId })
      })

      const result = await response.json()

      if (result.success) {
        // Refresh packets list
        await loadPackets()
      } else {
        console.error("Action failed:", result.error)
      }
    } catch (err) {
      console.error("Failed to perform action:", err)
    } finally {
      setActionLoading(null)
    }
  }

  // Handle feedback
  const handleFeedback = async (packetId: string, feedback: "thumbs_up" | "thumbs_down", comment?: string) => {
    setActionLoading(packetId)

    try {
      const response = await fetch("/api/packets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "feedback", packetId, feedback, comment })
      })

      const result = await response.json()

      if (result.success) {
        // Update local state immediately for responsiveness
        setPackets(prev => prev.map(p =>
          p.id === packetId ? { ...p, feedback } : p
        ))
        if (selectedPacket?.id === packetId) {
          setSelectedPacket(prev => prev ? { ...prev, feedback } : null)
        }
      }
    } catch (err) {
      console.error("Failed to submit feedback:", err)
    } finally {
      setActionLoading(null)
    }
  }

  // Handle packet execution via LLM
  const handleExecute = async (packet: Packet) => {
    setShowExecutionLogs(true)
    await execute(packet.id, packet.projectID, {
      preferredServer: selectedServer || undefined,
      useIteration: executionMode === "long-horizon",
      maxIterations: executionMode === "long-horizon" ? 10 : 3,
      minConfidence: 0.75
    })
  }

  const filteredPackets = packets.filter(packet => {
    const matchesFilter = filter === "all" || packet.status === filter
    const matchesSearch = search === "" ||
      packet.title.toLowerCase().includes(search.toLowerCase()) ||
      packet.id.toLowerCase().includes(search.toLowerCase()) ||
      packet.issueIDs.some(id => id.toLowerCase().includes(search.toLowerCase()))
    return matchesFilter && matchesSearch
  })

  const stats = {
    queued: packets.filter(p => p.status === "queued").length,
    running: packets.filter(p => p.status === "running").length,
    paused: packets.filter(p => p.status === "paused").length,
    blocked: packets.filter(p => p.status === "blocked").length,
    completed: packets.filter(p => p.status === "completed").length,
    failed: packets.filter(p => p.status === "failed").length,
    cancelled: packets.filter(p => p.status === "cancelled").length,
  }

  return (
    <div className="flex flex-col gap-6 p-6 h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Packet Queue</h1>
          <p className="text-sm text-muted-foreground">
            Manage and monitor development work packets across all projects
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Server/Model Selection */}
          {serverStatus?.servers && serverStatus.servers.length > 0 && (
            <select
              value={selectedServer || ""}
              onChange={(e) => setSelectedServer(e.target.value || null)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Auto (any server)</option>
              {serverStatus.servers.map((server) => (
                <option key={server.name} value={server.name}>
                  {server.name}: {server.currentModel || "No model loaded"}
                </option>
              ))}
            </select>
          )}

          {/* Execution Mode */}
          <select
            value={executionMode}
            onChange={(e) => setExecutionMode(e.target.value as "standard" | "long-horizon")}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="standard">Standard (3 iterations)</option>
            <option value="long-horizon">Long-Horizon (10 iterations)</option>
          </select>

          {/* Server Status */}
          <div className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded text-xs",
            serverStatus?.available ? "bg-green-400/10 text-green-400" : "bg-red-400/10 text-red-400"
          )}>
            <span className={cn(
              "h-2 w-2 rounded-full",
              serverStatus?.available ? "bg-green-400" : "bg-red-400"
            )} />
            <span className="hidden sm:inline">
              {serverStatus?.available ? "LLM Online" : "LLM Offline"}
            </span>
          </div>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={loadPackets}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              const nextQueued = packets.find(p => p.status === "queued")
              if (nextQueued) handleExecute(nextQueued)
            }}
            disabled={isExecuting || !packets.some(p => p.status === "queued")}
          >
            {isExecuting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            <span className="hidden sm:inline">Start Next</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setShowExecutionLogs(!showExecutionLogs)}
          >
            <Terminal className="h-4 w-4" />
            <span className="hidden sm:inline">Logs</span>
          </Button>
          <Button size="sm" className="gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">New Packet</span>
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-lg bg-red-400/10 border border-red-400/30 p-4 text-sm text-red-400">
          <strong>Error:</strong> {error}
          <Button variant="link" size="sm" onClick={loadPackets} className="ml-2 text-red-400 underline">
            Retry
          </Button>
        </div>
      )}

      {/* Stats Bar */}
      <div className="flex flex-wrap gap-2 sm:gap-4">
        {(["queued", "running", "paused", "blocked", "completed", "failed"] as const).map(status => {
          const config = statusConfig[status]
          return (
            <button
              key={status}
              onClick={() => setFilter(filter === status ? "all" : status)}
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 rounded-lg border px-2 sm:px-4 py-1.5 sm:py-2 transition-colors",
                filter === status ? "border-primary bg-accent" : "hover:bg-accent/50"
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", config.bg)} />
              <span className="text-xs sm:text-sm font-medium hidden xs:inline">{config.label}</span>
              <span className={cn("text-base sm:text-lg font-semibold", config.color)}>
                {stats[status]}
              </span>
            </button>
          )
        })}
      </div>

      {/* Filter & Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search packets or issues..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent pl-10 pr-4 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          Filters
          <ChevronDown className="h-3 w-3" />
        </Button>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 rounded-lg border p-1">
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            className={cn(
              "h-7 w-7 p-0",
              viewMode === "list" && "bg-primary text-primary-foreground"
            )}
            onClick={() => handleViewModeChange("list")}
            title="List view"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "tile" ? "default" : "ghost"}
            size="sm"
            className={cn(
              "h-7 w-7 p-0",
              viewMode === "tile" && "bg-primary text-primary-foreground"
            )}
            onClick={() => handleViewModeChange("tile")}
            title="Tile view"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 md:grid-cols-5 flex-1 min-h-0">
        {/* Packet List */}
        <Card className="md:col-span-3 flex flex-col min-h-0">
          <CardHeader className="pb-2 flex-none">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">
                All Packets
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                {isLoading ? "Loading..." : `${filteredPackets.length} items`}
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredPackets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
                {packets.length === 0 ? (
                  <>
                    <h3 className="text-lg font-medium mb-2">No work packets yet</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mb-4">
                      Work packets are generated when you create a build plan for a project.
                      Each packet represents a unit of work that can be assigned and tracked.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        className="gap-2"
                        onClick={() => window.location.href = '/projects'}
                      >
                        <GitBranch className="h-4 w-4" />
                        Go to Projects
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={loadPackets}
                      >
                        <RefreshCw className="h-4 w-4" />
                        Refresh
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-medium mb-2">No matching packets</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mb-4">
                      No packets match your current filter or search criteria.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        setFilter("all")
                        setSearch("")
                      }}
                    >
                      Clear filters
                    </Button>
                  </>
                )}
              </div>
            ) : viewMode === "list" ? (
              /* LIST VIEW - Full-width rows with all content visible */
              <div className="divide-y">
                {filteredPackets.map(packet => {
                  const config = statusConfig[packet.status]
                  const Icon = config.icon
                  const isSelected = selectedPacket?.id === packet.id
                  const isActionLoading = actionLoading === packet.id
                  const workerInfo = packet.assignedWorker ? workerConfig[packet.assignedWorker] : null

                  return (
                    <div
                      key={packet.id}
                      onClick={() => setSelectedPacket(packet)}
                      className={cn(
                        "flex items-start gap-4 p-4 cursor-pointer transition-colors",
                        isSelected ? "bg-accent" : "hover:bg-accent/50"
                      )}
                    >
                      {/* Left side: Status, Priority, Type badges */}
                      <div className="flex-none flex flex-col items-center gap-2 pt-0.5">
                        <Icon className={cn("h-5 w-5", config.color, config.animate && "animate-spin")} />
                        <Badge variant={config.badgeVariant} className="text-xs">
                          {config.label}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {packet.priority}
                        </Badge>
                      </div>

                      {/* Middle: Content - title, description, metadata */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-muted-foreground">
                            {packet.packetID || packet.id}
                          </span>
                          {packet.feedback && (
                            <span className={cn(
                              "flex items-center",
                              packet.feedback === "thumbs_up" ? "text-green-400" : "text-red-400"
                            )}>
                              {packet.feedback === "thumbs_up" ? (
                                <ThumbsUp className="h-3 w-3" />
                              ) : (
                                <ThumbsDown className="h-3 w-3" />
                              )}
                            </span>
                          )}
                          {workerInfo && (
                            <span className={cn("flex items-center gap-1 text-xs", workerInfo.color)}>
                              <User className="h-3 w-3" />
                              {workerInfo.label}
                            </span>
                          )}
                        </div>
                        <p className="font-medium">{packet.title}</p>

                        {/* Full description - no truncation */}
                        {packet.summary && (
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {packet.summary}
                          </p>
                        )}

                        {/* Dependencies and metadata */}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          {packet.issueIDs.length > 0 && (
                            <span className="flex items-center gap-1">
                              <GitBranch className="h-3 w-3" />
                              Issues: {packet.issueIDs.join(", ")}
                            </span>
                          )}
                          {packet.dependencies.length > 0 && (
                            <span className="flex items-center gap-1">
                              Dependencies: {packet.dependencies.join(", ")}
                            </span>
                          )}
                          {packet.acceptanceCriteria.length > 0 && (
                            <span>
                              {packet.acceptanceCriteria.length} acceptance criteria
                            </span>
                          )}
                          {packet.risks.length > 0 && (
                            <span className="text-yellow-500">
                              {packet.risks.length} risk{packet.risks.length !== 1 ? "s" : ""}
                            </span>
                          )}
                          <span>
                            {packet.issues.length} issue{packet.issues.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>

                      {/* Right side: Action Buttons */}
                      <div className="flex-none flex items-center gap-1">
                        {/* Start/Stop Button */}
                        {packet.status === "queued" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-green-400 hover:text-green-300 hover:bg-green-400/10"
                            onClick={(e) => {
                              e.stopPropagation()
                              handlePacketAction(packet.id, "start")
                            }}
                            disabled={isActionLoading}
                          >
                            {isActionLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        {packet.status === "running" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-orange-400 hover:text-orange-300 hover:bg-orange-400/10"
                            onClick={(e) => {
                              e.stopPropagation()
                              handlePacketAction(packet.id, "stop")
                            }}
                            disabled={isActionLoading}
                          >
                            {isActionLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        {packet.status === "paused" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-green-400 hover:text-green-300 hover:bg-green-400/10"
                            onClick={(e) => {
                              e.stopPropagation()
                              handlePacketAction(packet.id, "start")
                            }}
                            disabled={isActionLoading}
                          >
                            {isActionLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                        )}

                        {/* Thumbs Up/Down - show for completed or running */}
                        {(packet.status === "completed" || packet.status === "running") && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-7 w-7",
                                packet.feedback === "thumbs_up"
                                  ? "text-green-400 bg-green-400/10"
                                  : "text-muted-foreground hover:text-green-400 hover:bg-green-400/10"
                              )}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleFeedback(packet.id, "thumbs_up")
                              }}
                              disabled={isActionLoading}
                            >
                              <ThumbsUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-7 w-7",
                                packet.feedback === "thumbs_down"
                                  ? "text-red-400 bg-red-400/10"
                                  : "text-muted-foreground hover:text-red-400 hover:bg-red-400/10"
                              )}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleFeedback(packet.id, "thumbs_down")
                              }}
                              disabled={isActionLoading}
                            >
                              <ThumbsDown className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              /* TILE VIEW - Grid of fixed-height cards with truncated content */
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                {filteredPackets.map(packet => {
                  const config = statusConfig[packet.status]
                  const Icon = config.icon
                  const isSelected = selectedPacket?.id === packet.id
                  const isActionLoading = actionLoading === packet.id

                  return (
                    <div
                      key={packet.id}
                      onClick={() => setSelectedPacket(packet)}
                      className={cn(
                        "rounded-lg border p-4 cursor-pointer transition-all h-[180px] flex flex-col",
                        isSelected
                          ? "bg-accent border-primary ring-1 ring-primary"
                          : "hover:bg-accent/50 hover:border-primary/50"
                      )}
                    >
                      {/* Header with badges */}
                      <div className="flex items-center justify-between gap-2 mb-2 flex-none">
                        <div className="flex items-center gap-1.5">
                          <Icon className={cn("h-4 w-4", config.color, config.animate && "animate-spin")} />
                          <Badge variant={config.badgeVariant} className="text-xs px-1.5 py-0">
                            {config.label}
                          </Badge>
                        </div>
                        <Badge variant="outline" className="text-xs px-1.5 py-0">
                          {packet.priority}
                        </Badge>
                      </div>

                      {/* Title */}
                      <p className="font-medium text-sm line-clamp-2 mb-2 flex-none">
                        {packet.title}
                      </p>

                      {/* Description - truncated with line-clamp-3 */}
                      <p className="text-xs text-muted-foreground line-clamp-3 flex-1">
                        {packet.summary || "No description available"}
                      </p>

                      {/* Footer with actions */}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t flex-none">
                        <span className="font-mono text-xs text-muted-foreground truncate max-w-[100px]">
                          {packet.packetID || packet.id}
                        </span>
                        <div className="flex items-center gap-1">
                          {packet.feedback && (
                            <span className={cn(
                              "flex items-center",
                              packet.feedback === "thumbs_up" ? "text-green-400" : "text-red-400"
                            )}>
                              {packet.feedback === "thumbs_up" ? (
                                <ThumbsUp className="h-3 w-3" />
                              ) : (
                                <ThumbsDown className="h-3 w-3" />
                              )}
                            </span>
                          )}
                          {/* Quick action button */}
                          {packet.status === "queued" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-green-400 hover:text-green-300 hover:bg-green-400/10"
                              onClick={(e) => {
                                e.stopPropagation()
                                handlePacketAction(packet.id, "start")
                              }}
                              disabled={isActionLoading}
                            >
                              {isActionLoading ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Play className="h-3 w-3" />
                              )}
                            </Button>
                          )}
                          {packet.status === "running" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-orange-400 hover:text-orange-300 hover:bg-orange-400/10"
                              onClick={(e) => {
                                e.stopPropagation()
                                handlePacketAction(packet.id, "stop")
                              }}
                              disabled={isActionLoading}
                            >
                              {isActionLoading ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Square className="h-3 w-3" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail Panel */}
        <Card className="md:col-span-2 flex flex-col min-h-0">
          <CardHeader className="pb-2 flex-none">
            <CardTitle className="text-base font-medium">Packet Details</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {selectedPacket ? (
              <div className="space-y-6">
                {/* Header */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="font-mono">
                      {selectedPacket.packetID || selectedPacket.id}
                    </Badge>
                    {selectedPacket.planRunID && (
                      <Badge variant="outline" className="font-mono text-xs">
                        Run: {selectedPacket.planRunID}
                      </Badge>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold">{selectedPacket.title}</h3>
                  {selectedPacket.summary && (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedPacket.summary}
                    </p>
                  )}
                </div>

                {/* Status */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Status</span>
                    <Badge variant={statusConfig[selectedPacket.status].badgeVariant}>
                      {statusConfig[selectedPacket.status].label}
                    </Badge>
                  </div>

                  {/* Worker Assignment */}
                  {selectedPacket.assignedWorker && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Worker</span>
                      <span className={cn(
                        "text-sm font-medium",
                        workerConfig[selectedPacket.assignedWorker]?.color || "text-muted-foreground"
                      )}>
                        {workerConfig[selectedPacket.assignedWorker]?.label || selectedPacket.assignedWorker}
                      </span>
                    </div>
                  )}

                  {/* Feedback Status */}
                  {selectedPacket.feedback && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Feedback</span>
                      <span className={cn(
                        "flex items-center gap-1 text-sm",
                        selectedPacket.feedback === "thumbs_up" ? "text-green-400" : "text-red-400"
                      )}>
                        {selectedPacket.feedback === "thumbs_up" ? (
                          <>
                            <ThumbsUp className="h-4 w-4" />
                            Approved
                          </>
                        ) : (
                          <>
                            <ThumbsDown className="h-4 w-4" />
                            Rejected
                          </>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* Issues */}
                {selectedPacket.issues.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Issues</span>
                    <div className="space-y-2">
                      {selectedPacket.issues.map((issue, i) => (
                        <div key={i} className="rounded-md border p-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-xs">
                              {issue.id}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium mt-1">{issue.title}</p>
                          {issue.description && (
                            <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                              {issue.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Acceptance Criteria */}
                {selectedPacket.acceptanceCriteria.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">
                      Acceptance Criteria
                    </span>
                    <ul className="space-y-1">
                      {selectedPacket.acceptanceCriteria.map((criterion, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-none" />
                          {criterion}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Risks */}
                {selectedPacket.risks.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Risks</span>
                    <ul className="space-y-1">
                      {selectedPacket.risks.map((risk, i) => (
                        <li key={i} className="text-sm flex items-start gap-2 text-yellow-400">
                          <AlertTriangle className="h-4 w-4 mt-0.5 flex-none" />
                          {risk}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Timestamps */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span className="font-mono text-xs">{formatDate(selectedPacket.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Started</span>
                    <span className="font-mono text-xs">{formatDate(selectedPacket.startedAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Completed</span>
                    <span className="font-mono text-xs">{formatDate(selectedPacket.completedAt)}</span>
                  </div>
                  {selectedPacket.startedAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duration</span>
                      <span className="font-mono text-xs">
                        {formatDuration(selectedPacket.startedAt, selectedPacket.completedAt)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Execution Result */}
                {lastResult && selectedPacket && lastResult.packetId === selectedPacket.id && (
                  <div className={cn(
                    "rounded-lg border p-3 space-y-2",
                    lastResult.success ? "border-green-400/50 bg-green-400/10" : "border-red-400/50 bg-red-400/10"
                  )}>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {lastResult.success ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-400" />
                          <span className="text-green-400">Execution Successful</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-red-400" />
                          <span className="text-red-400">Execution Failed</span>
                        </>
                      )}
                    </div>
                    {lastResult.files.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {lastResult.files.length} files generated
                      </div>
                    )}
                    {lastResult.commitUrl && (
                      <a
                        href={lastResult.commitUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-400 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View Commit
                      </a>
                    )}
                    {lastResult.errors.length > 0 && (
                      <div className="text-xs text-red-400">
                        {lastResult.errors[0]}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-2 pt-2">
                  {selectedPacket.status === "running" && currentPacketId === selectedPacket.id && (
                    <div className="flex items-center gap-2 text-sm text-blue-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Executing...
                    </div>
                  )}

                  {/* Start/Stop/Pause Buttons */}
                  {selectedPacket.status === "queued" && (
                    <Button
                      className="w-full gap-2"
                      onClick={() => handlePacketAction(selectedPacket.id, "start")}
                      disabled={actionLoading === selectedPacket.id}
                    >
                      {actionLoading === selectedPacket.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      Start Packet
                    </Button>
                  )}

                  {selectedPacket.status === "running" && (
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => handlePacketAction(selectedPacket.id, "stop")}
                      disabled={actionLoading === selectedPacket.id}
                    >
                      {actionLoading === selectedPacket.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                      Stop Packet
                    </Button>
                  )}

                  {selectedPacket.status === "paused" && (
                    <Button
                      className="w-full gap-2"
                      onClick={() => handlePacketAction(selectedPacket.id, "start")}
                      disabled={actionLoading === selectedPacket.id}
                    >
                      {actionLoading === selectedPacket.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      Resume Packet
                    </Button>
                  )}

                  {(selectedPacket.status === "failed" || selectedPacket.status === "blocked") && (
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => handlePacketAction(selectedPacket.id, "start")}
                      disabled={actionLoading === selectedPacket.id}
                    >
                      {actionLoading === selectedPacket.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4" />
                      )}
                      Retry Packet
                    </Button>
                  )}

                  {/* Execute with LLM */}
                  {(selectedPacket.status === "queued" || selectedPacket.status === "paused") && (
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => handleExecute(selectedPacket)}
                      disabled={isExecuting || !serverStatus?.available}
                    >
                      {isExecuting && currentPacketId === selectedPacket.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4" />
                      )}
                      Execute with LLM
                    </Button>
                  )}

                  {/* Feedback Buttons */}
                  {(selectedPacket.status === "completed" || selectedPacket.status === "running") && (
                    <div className="flex gap-2">
                      <Button
                        variant={selectedPacket.feedback === "thumbs_up" ? "default" : "outline"}
                        className={cn(
                          "flex-1 gap-2",
                          selectedPacket.feedback === "thumbs_up" && "bg-green-600 hover:bg-green-700"
                        )}
                        onClick={() => handleFeedback(selectedPacket.id, "thumbs_up")}
                        disabled={actionLoading === selectedPacket.id}
                      >
                        <ThumbsUp className="h-4 w-4" />
                        Good
                      </Button>
                      <Button
                        variant={selectedPacket.feedback === "thumbs_down" ? "default" : "outline"}
                        className={cn(
                          "flex-1 gap-2",
                          selectedPacket.feedback === "thumbs_down" && "bg-red-600 hover:bg-red-700"
                        )}
                        onClick={() => handleFeedback(selectedPacket.id, "thumbs_down")}
                        disabled={actionLoading === selectedPacket.id}
                      >
                        <ThumbsDown className="h-4 w-4" />
                        Bad
                      </Button>
                    </div>
                  )}

                  {/* Cancel Button */}
                  {(selectedPacket.status === "queued" || selectedPacket.status === "running" || selectedPacket.status === "paused") && (
                    <Button
                      variant="ghost"
                      className="w-full gap-2 text-destructive"
                      onClick={() => handlePacketAction(selectedPacket.id, "cancel")}
                      disabled={actionLoading === selectedPacket.id}
                    >
                      <XCircle className="h-4 w-4" />
                      Cancel Packet
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Package className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-sm">Select a packet</p>
                <p className="text-xs mt-1">to view details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Execution Logs Panel */}
      {showExecutionLogs && (
        <Card className="flex-none">
          <CardHeader className="py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              Execution Logs
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowExecutionLogs(false)}
            >
              <XCircle className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="py-2">
            <div className="rounded-lg bg-zinc-950 p-3 font-mono text-xs max-h-48 overflow-auto">
              {logs.length === 0 ? (
                <p className="text-zinc-500">No execution logs yet. Start a packet to see output.</p>
              ) : (
                logs.map((log: ExecutionLog, i: number) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-zinc-500 w-20 flex-none">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={cn(
                      "w-12 flex-none uppercase",
                      log.level === "success" && "text-green-400",
                      log.level === "error" && "text-red-400",
                      log.level === "warn" && "text-yellow-400",
                      log.level === "info" && "text-blue-400"
                    )}>
                      {log.level}
                    </span>
                    <span className="text-zinc-300">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
