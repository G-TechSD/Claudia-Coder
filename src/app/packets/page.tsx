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
  XCircle,
  RotateCcw,
  ChevronDown,
  Clock,
  CheckCircle,
  AlertTriangle,
  Loader2,
  GitBranch,
  User,
  Calendar,
  Hash,
  ExternalLink,
  Terminal,
  Zap
} from "lucide-react"
import { getAllPackets, getPacketsForProject, type WorkPacket } from "@/lib/ai/build-plan"
import { getProjects } from "@/lib/data/projects"
import { usePacketExecution, type ExecutionLog } from "@/hooks/usePacketExecution"

type PacketStatus = "queued" | "running" | "blocked" | "completed" | "failed"
type PacketPriority = "high" | "normal" | "low"

interface Packet {
  id: string
  projectId: string
  title: string
  description: string
  status: PacketStatus
  priority: PacketPriority
  agent: string | null
  createdAt: Date
  startedAt: Date | null
  completedAt: Date | null
  source: string
  branch: string
  tasks: { total: number; completed: number }
  estimatedCost: number
  actualCost: number | null
  blockedReason?: string
  errorMessage?: string
  acceptanceCriteria?: string[]
}

// Convert WorkPacket from build-plan to Packet for display
function workPacketToPacket(wp: WorkPacket, projectId: string): Packet {
  const completedTasks = wp.tasks.filter(t => t.completed).length

  // Map work packet status to display status
  let status: PacketStatus = "queued"
  if (wp.status === "completed") status = "completed"
  else if (wp.status === "in_progress" || wp.status === "assigned") status = "running"
  else if (wp.status === "blocked") status = "blocked"
  else if (wp.status === "review") status = "running"

  // Map priority
  let priority: PacketPriority = "normal"
  if (wp.priority === "critical" || wp.priority === "high") priority = "high"
  else if (wp.priority === "low") priority = "low"

  return {
    id: wp.id,
    projectId,
    title: wp.title,
    description: wp.description,
    status,
    priority,
    agent: wp.assignedModel || null,
    createdAt: new Date(),
    startedAt: wp.status === "in_progress" ? new Date() : null,
    completedAt: wp.status === "completed" ? new Date() : null,
    source: "Linear",
    branch: `claudia/${wp.id.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`,
    tasks: { total: wp.tasks.length, completed: completedTasks },
    estimatedCost: wp.estimatedTokens / 1000 * 0.002, // Rough estimate
    actualCost: wp.status === "completed" ? wp.estimatedTokens / 1000 * 0.002 : null,
    blockedReason: wp.blockedBy?.length > 0 ? `Depends on: ${wp.blockedBy.join(", ")}` : undefined,
    acceptanceCriteria: wp.acceptanceCriteria,
  }
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
  }
}

const priorityConfig = {
  high: { label: "High", color: "text-red-400", bg: "bg-red-400/10" },
  normal: { label: "Normal", color: "text-muted-foreground", bg: "" },
  low: { label: "Low", color: "text-muted-foreground", bg: "bg-muted/50" }
}

// Mock packets are now empty - real packets come from storage
const mockPackets: Packet[] = []

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

export default function PacketsPage() {
  const [packets, setPackets] = useState<Packet[]>(mockPackets)
  const [selectedPacket, setSelectedPacket] = useState<Packet | null>(null)
  const [filter, setFilter] = useState<PacketStatus | "all">("all")
  const [search, setSearch] = useState("")
  const [showExecutionLogs, setShowExecutionLogs] = useState(false)

  // Execution hook
  const {
    execute,
    isExecuting,
    currentPacketId,
    lastResult,
    logs,
    error: executionError,
    checkServerStatus
  } = usePacketExecution()

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

  // Load real packets from storage on mount
  const loadPackets = useCallback(() => {
    const projects = getProjects()
    const allPackets: Packet[] = []

    for (const project of projects) {
      const projectPackets = getPacketsForProject(project.id)
      for (const wp of projectPackets) {
        allPackets.push(workPacketToPacket(wp, project.id))
      }
    }

    if (allPackets.length > 0) {
      setPackets(allPackets)
      if (!selectedPacket) {
        setSelectedPacket(allPackets[0])
      }
    }
  }, [selectedPacket])

  useEffect(() => {
    loadPackets()
    // Check server status
    checkServerStatus().then(setServerStatus)
  }, [loadPackets, checkServerStatus])

  // Refresh packets after execution
  useEffect(() => {
    if (lastResult) {
      loadPackets()
    }
  }, [lastResult, loadPackets])

  // Handle packet execution
  const handleExecute = async (packet: Packet) => {
    setShowExecutionLogs(true)
    await execute(packet.id, packet.projectId, {
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
      packet.id.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const stats = {
    queued: packets.filter(p => p.status === "queued").length,
    running: packets.filter(p => p.status === "running").length,
    blocked: packets.filter(p => p.status === "blocked").length,
    completed: packets.filter(p => p.status === "completed").length,
    failed: packets.filter(p => p.status === "failed").length,
  }

  return (
    <div className="flex flex-col gap-6 p-6 h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Packet Queue</h1>
          <p className="text-sm text-muted-foreground">
            Manage and monitor development task packets
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

      {/* Stats Bar */}
      <div className="flex flex-wrap gap-2 sm:gap-4">
        {(["queued", "running", "blocked", "completed", "failed"] as const).map(status => {
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
            placeholder="Search packets..."
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
                {filteredPackets.length} items
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0">
            <div className="divide-y">
              {filteredPackets.map(packet => {
                const config = statusConfig[packet.status]
                const Icon = config.icon
                const isSelected = selectedPacket?.id === packet.id
                const priorityConf = priorityConfig[packet.priority]
                return (
                  <div
                    key={packet.id}
                    onClick={() => setSelectedPacket(packet)}
                    className={cn(
                      "flex items-start gap-4 p-4 cursor-pointer transition-colors",
                      isSelected ? "bg-accent" : "hover:bg-accent/50"
                    )}
                  >
                    <div className="flex-none pt-0.5">
                      <Icon className={cn("h-5 w-5", config.color, config.animate && "animate-spin")} />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {packet.id}
                        </span>
                        {packet.priority === "high" && (
                          <Badge variant="destructive" className="text-xs px-1.5 py-0">
                            High
                          </Badge>
                        )}
                      </div>
                      <p className="font-medium truncate">{packet.title}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <GitBranch className="h-3 w-3" />
                          {packet.branch}
                        </span>
                        {packet.agent && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {packet.agent}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex-none text-right space-y-1">
                      <Badge className={cn("text-xs", `bg-${config.bg.replace('bg-', '')}/10`, config.color)}>
                        {config.label}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {packet.tasks.completed}/{packet.tasks.total} tasks
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
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
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      {selectedPacket.id}
                    </Badge>
                    <Badge className={cn(
                      priorityConfig[selectedPacket.priority].color,
                      priorityConfig[selectedPacket.priority].bg
                    )}>
                      {priorityConfig[selectedPacket.priority].label}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-semibold">{selectedPacket.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedPacket.description}
                  </p>
                </div>

                {/* Status */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Status</span>
                    <Badge variant={statusConfig[selectedPacket.status].badgeVariant}>
                      {statusConfig[selectedPacket.status].label}
                    </Badge>
                  </div>

                  {selectedPacket.blockedReason && (
                    <div className="rounded-md bg-yellow-400/10 p-3 text-sm text-yellow-400">
                      <strong>Blocked:</strong> {selectedPacket.blockedReason}
                    </div>
                  )}

                  {selectedPacket.errorMessage && (
                    <div className="rounded-md bg-red-400/10 p-3 text-sm text-red-400">
                      <strong>Error:</strong> {selectedPacket.errorMessage}
                    </div>
                  )}
                </div>

                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">
                      {selectedPacket.tasks.completed}/{selectedPacket.tasks.total} tasks
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{
                        width: `${(selectedPacket.tasks.completed / selectedPacket.tasks.total) * 100}%`
                      }}
                    />
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Source</p>
                    <p className="font-medium">{selectedPacket.source}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Agent</p>
                    <p className="font-medium">{selectedPacket.agent || "Unassigned"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Branch</p>
                    <p className="font-mono text-xs">{selectedPacket.branch}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Duration</p>
                    <p className="font-medium">
                      {formatDuration(selectedPacket.startedAt, selectedPacket.completedAt)}
                    </p>
                  </div>
                </div>

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
                </div>

                {/* Costs */}
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Estimated Cost</span>
                    <span className="font-medium">${selectedPacket.estimatedCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Actual Cost</span>
                    <span className="font-medium">
                      {selectedPacket.actualCost !== null
                        ? `$${selectedPacket.actualCost.toFixed(2)}`
                        : "-"
                      }
                    </span>
                  </div>
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
                  {selectedPacket.status === "running" && currentPacketId !== selectedPacket.id && (
                    <Button variant="outline" className="w-full gap-2" disabled>
                      <Pause className="h-4 w-4" />
                      Pause Packet
                    </Button>
                  )}
                  {selectedPacket.status === "queued" && (
                    <Button
                      className="w-full gap-2"
                      onClick={() => handleExecute(selectedPacket)}
                      disabled={isExecuting || !serverStatus?.available}
                    >
                      {isExecuting && currentPacketId === selectedPacket.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4" />
                      )}
                      Execute Now
                    </Button>
                  )}
                  {selectedPacket.status === "blocked" && (
                    <Button
                      className="w-full gap-2"
                      onClick={() => handleExecute(selectedPacket)}
                      disabled={isExecuting || !serverStatus?.available}
                    >
                      <CheckCircle className="h-4 w-4" />
                      Retry Execution
                    </Button>
                  )}
                  {selectedPacket.status === "failed" && (
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => handleExecute(selectedPacket)}
                      disabled={isExecuting || !serverStatus?.available}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Retry Packet
                    </Button>
                  )}
                  <Button variant="ghost" className="w-full gap-2 text-destructive">
                    <XCircle className="h-4 w-4" />
                    Cancel Packet
                  </Button>
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
                logs.map((log, i) => (
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
