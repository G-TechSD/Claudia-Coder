"use client"

import * as React from "react"
import Link from "next/link"
import { useRunHistory, RunHistorySummary } from "@/hooks/useActivityPersistence"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  History,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Download,
  ExternalLink,
  Search,
  Filter,
  RefreshCw,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"

const statusConfig = {
  running: {
    label: "Running",
    icon: Loader2,
    color: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    iconClass: "animate-spin",
  },
  complete: {
    label: "Complete",
    icon: CheckCircle,
    color: "text-green-400 bg-green-500/10 border-green-500/30",
    iconClass: "",
  },
  error: {
    label: "Failed",
    icon: XCircle,
    color: "text-red-400 bg-red-500/10 border-red-500/30",
    iconClass: "",
  },
  cancelled: {
    label: "Cancelled",
    icon: AlertTriangle,
    color: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    iconClass: "",
  },
}

function formatDuration(ms?: number): string {
  if (!ms) return "-"
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

interface RunHistoryRowProps {
  run: RunHistorySummary
  onExport: (id: string, format: "markdown" | "json") => void
}

function RunHistoryRow({ run, onExport }: RunHistoryRowProps) {
  const config = statusConfig[run.status]
  const StatusIcon = config.icon

  return (
    <div className="flex items-center gap-4 p-4 border-b border-gray-800 hover:bg-gray-900/50 transition-colors">
      {/* Status */}
      <div className={cn("flex items-center gap-2 w-28", config.color)}>
        <StatusIcon className={cn("h-4 w-4", config.iconClass)} />
        <span className="text-sm font-medium">{config.label}</span>
      </div>

      {/* Project */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/projects/${run.projectId}`}
          className="text-sm font-medium text-white hover:text-green-400 transition-colors truncate block"
        >
          {run.projectName || run.projectId}
        </Link>
        <p className="text-xs text-muted-foreground truncate">
          {run.id}
        </p>
      </div>

      {/* Packets */}
      <div className="flex items-center gap-2 w-32">
        <span className="text-sm text-green-400">{run.successCount} passed</span>
        {run.failedCount > 0 && (
          <span className="text-sm text-red-400">{run.failedCount} failed</span>
        )}
      </div>

      {/* Duration */}
      <div className="w-20 text-sm text-muted-foreground">
        {formatDuration(run.duration)}
      </div>

      {/* Started */}
      <div className="w-32 text-sm text-muted-foreground">
        {formatDate(run.startedAt)}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onExport(run.id, "markdown")}
          title="Export as Markdown"
        >
          <Download className="h-4 w-4" />
        </Button>
        <Link href={`/projects/${run.projectId}`}>
          <Button variant="ghost" size="sm" title="View Project">
            <ExternalLink className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  )
}

export default function RunHistoryPage() {
  const { history, isLoading, error, refetch } = useRunHistory()
  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")

  // Filter history
  const filteredHistory = React.useMemo(() => {
    return history.filter((run) => {
      // Status filter
      if (statusFilter !== "all" && run.status !== statusFilter) {
        return false
      }
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return (
          run.projectName?.toLowerCase().includes(query) ||
          run.projectId.toLowerCase().includes(query) ||
          run.id.toLowerCase().includes(query)
        )
      }
      return true
    })
  }, [history, searchQuery, statusFilter])

  // Handle export
  const handleExport = async (id: string, format: "markdown" | "json") => {
    try {
      const response = await fetch(`/api/run-history/${id}/export?format=${format}`)
      if (!response.ok) throw new Error("Export failed")

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `run-${id}.${format === "markdown" ? "md" : "json"}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Export failed:", err)
    }
  }

  // Stats
  const stats = React.useMemo(() => {
    return {
      total: history.length,
      running: history.filter((r) => r.status === "running").length,
      complete: history.filter((r) => r.status === "complete").length,
      failed: history.filter((r) => r.status === "error").length,
      cancelled: history.filter((r) => r.status === "cancelled").length,
    }
  }, [history])

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <History className="h-6 w-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Run History</h1>
            <p className="text-sm text-muted-foreground">
              View past execution runs and their results
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={refetch} disabled={isLoading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total Runs</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-400">{stats.running}</div>
            <div className="text-xs text-muted-foreground">Running</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-400">{stats.complete}</div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-400">{stats.failed}</div>
            <div className="text-xs text-muted-foreground">Failed</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-amber-400">{stats.cancelled}</div>
            <div className="text-xs text-muted-foreground">Cancelled</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6 bg-gray-900/50 border-gray-800">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by project name or run ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-gray-800 border-gray-700"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40 bg-gray-800 border-gray-700">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="complete">Completed</SelectItem>
                  <SelectItem value="error">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* History List */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader className="border-b border-gray-800">
          <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <div className="w-28">Status</div>
            <div className="flex-1">Project / Run ID</div>
            <div className="w-32">Results</div>
            <div className="w-20">Duration</div>
            <div className="w-32">Started</div>
            <div className="w-20">Actions</div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-red-400">
              <XCircle className="h-8 w-8 mb-2" />
              <p>{error}</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <History className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-lg font-medium">No runs found</p>
              <p className="text-sm">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Execute some packets to see run history"}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              {filteredHistory.map((run) => (
                <RunHistoryRow
                  key={run.id}
                  run={run}
                  onExport={handleExport}
                />
              ))}
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
