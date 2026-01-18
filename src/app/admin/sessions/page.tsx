"use client"

import * as React from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Play,
  XCircle,
  Loader2,
  Search,
  Clock,
  MousePointer,
  AlertCircle,
  Monitor,
  Users,
  TrendingUp,
  ChevronRight,
  Filter,
  X,
} from "lucide-react"

interface RecordedSession {
  id: string
  userId: string
  userName: string
  userEmail: string
  userImage: string | null
  startedAt: string
  endedAt: string | null
  duration: number | null
  clickCount: number
  errorCount: number
  pageCount: number
  userAgent: string | null
  deviceType: string | null
  browser: string | null
  os: string | null
  screenWidth: number | null
  screenHeight: number | null
  pagesVisited: string | null
  createdAt: string
  updatedAt: string
}

interface SessionStats {
  total: number
  today: number
  thisWeek: number
  thisMonth: number
  totalDuration: number
  avgDuration: number
  totalClicks: number
  totalErrors: number
  uniqueUsers: number
}

interface GroupedSession {
  userId: string
  userName: string
  userEmail: string
  userImage: string | null
  sessionCount: number
  totalDuration: number
  lastSessionAt: string
}

function formatDateShort(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days} days ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "0s"
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

function getDeviceIcon() {
  // Return Monitor icon for any device type
  return <Monitor className="h-4 w-4" />
}

export default function SessionsPage() {
  const [sessions, setSessions] = React.useState<RecordedSession[]>([])
  const [groupedSessions, setGroupedSessions] = React.useState<GroupedSession[]>([])
  const [stats, setStats] = React.useState<SessionStats | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null)
  const [viewMode, setViewMode] = React.useState<"users" | "all">("users")

  // Filter state
  const [searchQuery, setSearchQuery] = React.useState("")
  const [startDate, setStartDate] = React.useState("")
  const [endDate, setEndDate] = React.useState("")
  const [showFilters, setShowFilters] = React.useState(false)

  // Fetch sessions
  const fetchSessions = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()

      if (viewMode === "users") {
        params.set("groupBy", "user")
      } else {
        if (selectedUserId) params.set("userId", selectedUserId)
        if (searchQuery) params.set("search", searchQuery)
        if (startDate) params.set("startDate", startDate)
        if (endDate) params.set("endDate", endDate)
      }

      const res = await fetch(`/api/session-tracking?${params}`)
      if (!res.ok) throw new Error("Failed to fetch sessions")

      const data = await res.json()

      if (viewMode === "users") {
        setGroupedSessions(data.groupedSessions || [])
      } else {
        setSessions(data.sessions || [])
      }
      setStats(data.stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions")
    } finally {
      setLoading(false)
    }
  }, [viewMode, selectedUserId, searchQuery, startDate, endDate])

  React.useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const handleUserClick = (userId: string) => {
    setSelectedUserId(userId)
    setViewMode("all")
  }

  const handleClearFilters = () => {
    setSearchQuery("")
    setStartDate("")
    setEndDate("")
    setSelectedUserId(null)
    setViewMode("users")
  }

  const hasActiveFilters = searchQuery || startDate || endDate || selectedUserId

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <XCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg font-medium">Failed to load sessions</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Session Recordings</h1>
          <p className="text-sm text-muted-foreground">
            View and replay beta tester sessions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "users" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setViewMode("users")
              setSelectedUserId(null)
            }}
          >
            <Users className="h-4 w-4 mr-1" />
            By User
          </Button>
          <Button
            variant={viewMode === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("all")}
          >
            <Clock className="h-4 w-4 mr-1" />
            All Sessions
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-1" />
            Filters
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="User name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                    <X className="h-4 w-4 mr-1" />
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3 rounded-lg border">
            <div className="flex items-center justify-between mb-1">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-xl font-semibold text-primary">{stats.total}</span>
            </div>
            <p className="text-xs font-medium">Total Sessions</p>
          </div>
          <div className="p-3 rounded-lg border">
            <div className="flex items-center justify-between mb-1">
              <Users className="h-4 w-4 text-blue-400" />
              <span className="text-xl font-semibold text-blue-400">
                {stats.uniqueUsers}
              </span>
            </div>
            <p className="text-xs font-medium">Unique Users</p>
          </div>
          <div className="p-3 rounded-lg border">
            <div className="flex items-center justify-between mb-1">
              <TrendingUp className="h-4 w-4 text-green-400" />
              <span className="text-xl font-semibold text-green-400">{stats.today}</span>
            </div>
            <p className="text-xs font-medium">Today</p>
          </div>
          <div className="p-3 rounded-lg border">
            <div className="flex items-center justify-between mb-1">
              <MousePointer className="h-4 w-4 text-purple-400" />
              <span className="text-xl font-semibold text-purple-400">
                {stats.totalClicks}
              </span>
            </div>
            <p className="text-xs font-medium">Total Clicks</p>
          </div>
          <div className="p-3 rounded-lg border">
            <div className="flex items-center justify-between mb-1">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <span className="text-xl font-semibold text-red-400">
                {stats.totalErrors}
              </span>
            </div>
            <p className="text-xs font-medium">Total Errors</p>
          </div>
        </div>
      )}

      {/* Selected User Banner */}
      {selectedUserId && viewMode === "all" && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-sm">
            Showing sessions for:{" "}
            <strong>
              {groupedSessions.find((g) => g.userId === selectedUserId)?.userName ||
                "Selected user"}
            </strong>
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 px-2"
            onClick={() => {
              setSelectedUserId(null)
              setViewMode("users")
            }}
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        </div>
      )}

      {/* Main Content */}
      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader className="pb-2 flex-none">
          <CardTitle className="text-base font-medium">
            {viewMode === "users" ? "Users with Sessions" : "All Sessions"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-0">
          {viewMode === "users" ? (
            // Grouped by user view
            <div className="divide-y">
              {groupedSessions.length > 0 ? (
                groupedSessions.map((group) => (
                  <div
                    key={group.userId}
                    onClick={() => handleUserClick(group.userId)}
                    className="flex items-center gap-4 p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                  >
                    {/* Avatar */}
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary flex-none text-sm font-medium">
                      {group.userImage ? (
                        <img
                          src={group.userImage}
                          alt={group.userName}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        group.userName?.[0]?.toUpperCase() || "U"
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{group.userName}</span>
                        <Badge variant="secondary" className="text-xs">
                          {group.sessionCount} sessions
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="truncate">{group.userEmail}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(group.totalDuration)}
                        </span>
                        <span>Last: {formatDateShort(group.lastSessionAt)}</span>
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-none" />
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-sm">No sessions recorded yet</p>
                </div>
              )}
            </div>
          ) : (
            // All sessions view
            <div className="divide-y">
              {sessions.length > 0 ? (
                sessions.map((session) => (
                  <Link
                    key={session.id}
                    href={`/admin/sessions/${session.id}`}
                    className="flex items-center gap-4 p-4 hover:bg-accent/50 transition-colors"
                  >
                    {/* Avatar */}
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary flex-none text-sm font-medium">
                      {session.userImage ? (
                        <img
                          src={session.userImage}
                          alt={session.userName}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        session.userName?.[0]?.toUpperCase() || "U"
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{session.userName}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateShort(session.startedAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(session.duration)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MousePointer className="h-3 w-3" />
                          {session.clickCount} clicks
                        </span>
                        {session.errorCount > 0 && (
                          <span className="flex items-center gap-1 text-red-400">
                            <AlertCircle className="h-3 w-3" />
                            {session.errorCount} errors
                          </span>
                        )}
                        {session.deviceType && (
                          <span className="flex items-center gap-1">
                            {getDeviceIcon()}
                            {session.browser}
                          </span>
                        )}
                      </div>
                    </div>

                    <Button variant="ghost" size="icon" className="flex-none">
                      <Play className="h-4 w-4" />
                    </Button>
                  </Link>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Clock className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-sm">No sessions found</p>
                  {hasActiveFilters && (
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-2"
                      onClick={handleClearFilters}
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
