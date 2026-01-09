"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertTriangle,
  Shield,
  ShieldAlert,
  ShieldX,
  ShieldCheck,
  RefreshCw,
  Download,
  Search,
  Filter,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react"

interface SecurityEvent {
  id?: string
  timestamp: string
  userId: string
  type: string
  eventType?: string
  severity?: string
  details: Record<string, unknown>
  source: string
  ip?: string
  sessionId?: string
}

interface SecurityStats {
  total: number
  byType: Record<string, number>
  bySeverity: Record<string, number>
  criticalEvents: number
  recentAlerts: SecurityEvent[]
}

export default function SecurityLogsPage() {
  const [events, setEvents] = React.useState<SecurityEvent[]>([])
  const [stats, setStats] = React.useState<SecurityStats | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Filters
  const [typeFilter, setTypeFilter] = React.useState<string>("all")
  const [severityFilter, setSeverityFilter] = React.useState<string>("all")
  const [userFilter, setUserFilter] = React.useState("")
  const [searchQuery, setSearchQuery] = React.useState("")

  // Expanded rows for details
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set())

  // Fetch events
  const fetchEvents = React.useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set("limit", "200")
      params.set("includeStats", "true")

      if (typeFilter !== "all") {
        params.set("type", typeFilter)
      }
      if (severityFilter !== "all") {
        params.set("severity", severityFilter)
      }
      if (userFilter) {
        params.set("userId", userFilter)
      }

      const res = await fetch(`/api/admin/security-logs?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch security logs")
      }

      const data = await res.json()
      setEvents(data.events || [])
      setStats(data.stats || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load security logs")
    } finally {
      setLoading(false)
    }
  }, [typeFilter, severityFilter, userFilter])

  React.useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  // Toggle row expansion
  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedRows(newExpanded)
  }

  // Export to CSV
  const handleExport = async () => {
    try {
      const params = new URLSearchParams()
      params.set("format", "csv")
      if (typeFilter !== "all") params.set("type", typeFilter)
      if (severityFilter !== "all") params.set("severity", severityFilter)
      if (userFilter) params.set("userId", userFilter)

      const res = await fetch(`/api/admin/security-logs?${params}`)
      if (!res.ok) throw new Error("Export failed")

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `security-logs-${new Date().toISOString().split("T")[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Export error:", err)
    }
  }

  // Clear old events
  const handleClearOld = async () => {
    if (!confirm("Clear events older than 30 days? This cannot be undone.")) {
      return
    }

    try {
      const res = await fetch("/api/admin/security-logs?olderThanDays=30", {
        method: "DELETE"
      })
      if (!res.ok) throw new Error("Failed to clear events")

      const data = await res.json()
      alert(`Cleared ${data.removed} old events`)
      fetchEvents()
    } catch (err) {
      console.error("Clear error:", err)
    }
  }

  // Get severity badge variant
  const getSeverityBadge = (severity?: string) => {
    switch (severity) {
      case "critical":
        return <Badge variant="error" className="gap-1"><ShieldX className="h-3 w-3" />Critical</Badge>
      case "high":
        return <Badge variant="warning" className="gap-1"><ShieldAlert className="h-3 w-3" />High</Badge>
      case "medium":
        return <Badge variant="info" className="gap-1"><Shield className="h-3 w-3" />Medium</Badge>
      case "low":
        return <Badge variant="secondary" className="gap-1"><ShieldCheck className="h-3 w-3" />Low</Badge>
      default:
        return <Badge variant="secondary">{severity || "Unknown"}</Badge>
    }
  }

  // Get type badge
  const getTypeBadge = (type?: string) => {
    switch (type) {
      case "injection_attempt":
        return <Badge variant="error">Injection</Badge>
      case "path_violation":
        return <Badge variant="warning">Path Violation</Badge>
      case "unauthorized_access":
        return <Badge variant="error">Unauthorized</Badge>
      case "revoked_access":
        return <Badge variant="error">Revoked</Badge>
      case "sandbox_violation":
        return <Badge variant="warning">Sandbox</Badge>
      case "command_blocked":
        return <Badge variant="warning">Command</Badge>
      case "path_blocked":
        return <Badge variant="warning">Path</Badge>
      default:
        return <Badge variant="secondary">{type || "Unknown"}</Badge>
    }
  }

  // Filter events by search query
  const filteredEvents = React.useMemo(() => {
    if (!searchQuery) return events

    const query = searchQuery.toLowerCase()
    return events.filter(event => {
      const searchableText = [
        event.userId,
        event.type,
        event.eventType,
        event.sessionId,
        JSON.stringify(event.details)
      ].join(" ").toLowerCase()

      return searchableText.includes(query)
    })
  }, [events, searchQuery])

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Security Logs
          </h1>
          <p className="text-sm text-muted-foreground">
            Monitor prompt injection attempts and security events
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchEvents} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="destructive" onClick={handleClearOld}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Old
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Events</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical/High</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.criticalEvents}</div>
              <p className="text-xs text-muted-foreground">
                {stats.bySeverity.critical || 0} critical, {stats.bySeverity.high || 0} high
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Injection Attempts</CardTitle>
              <ShieldAlert className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {stats.byType.injection_attempt || 0}
              </div>
              <p className="text-xs text-muted-foreground">Blocked attempts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Alerts</CardTitle>
              <ShieldX className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recentAlerts?.length || 0}</div>
              <p className="text-xs text-muted-foreground">Last 24 hours</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Event Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="injection_attempt">Injection Attempt</SelectItem>
                <SelectItem value="path_violation">Path Violation</SelectItem>
                <SelectItem value="unauthorized_access">Unauthorized</SelectItem>
                <SelectItem value="sandbox_violation">Sandbox Violation</SelectItem>
                <SelectItem value="command_blocked">Command Blocked</SelectItem>
              </SelectContent>
            </Select>

            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="User ID..."
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="w-[180px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Events List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">
            Security Events ({filteredEvents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              <ShieldX className="h-12 w-12 mx-auto mb-4" />
              <p>{error}</p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShieldCheck className="h-12 w-12 mx-auto mb-4" />
              <p>No security events found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredEvents.map((event, index) => {
                const eventId = event.id || `${event.timestamp}-${index}`
                const isExpanded = expandedRows.has(eventId)

                return (
                  <div
                    key={eventId}
                    className="border rounded-lg overflow-hidden"
                  >
                    {/* Event Header */}
                    <div
                      className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleRow(eventId)}
                    >
                      <div className="flex-shrink-0">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          {getTypeBadge(event.type || event.eventType)}
                          {getSeverityBadge(event.severity)}
                          <Badge variant="secondary">{event.source}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <span className="font-mono">{event.userId?.substring(0, 20)}</span>
                          <span className="mx-2">-</span>
                          <span>{new Date(event.timestamp).toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="flex-shrink-0 text-sm text-muted-foreground max-w-[200px] truncate hidden md:block">
                        {typeof event.details === "string"
                          ? event.details
                          : JSON.stringify(event.details).substring(0, 50)}...
                      </div>
                    </div>

                    {/* Event Details (Expanded) */}
                    {isExpanded && (
                      <div className="p-4 bg-muted/30 border-t">
                        <h4 className="font-medium mb-2">Event Details</h4>
                        <pre className="text-sm bg-muted p-3 rounded overflow-auto max-h-[300px]">
                          {JSON.stringify(event.details, null, 2)}
                        </pre>
                        <div className="mt-3 flex flex-wrap gap-4 text-sm">
                          {event.sessionId && (
                            <div>
                              <span className="font-medium">Session:</span>{" "}
                              <code className="bg-muted px-1 rounded">{event.sessionId}</code>
                            </div>
                          )}
                          {event.ip && (
                            <div>
                              <span className="font-medium">IP:</span> {event.ip}
                            </div>
                          )}
                          <div>
                            <span className="font-medium">Full User ID:</span>{" "}
                            <code className="bg-muted px-1 rounded">{event.userId}</code>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
