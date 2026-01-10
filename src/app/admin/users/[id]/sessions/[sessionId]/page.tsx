"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SessionPlayer } from "@/components/admin/session-player"
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  XCircle,
  Loader2,
  Clock,
  MousePointer,
  AlertCircle,
  Monitor,
  Globe,
  Calendar,
  User,
  Layers,
  ChevronRight,
  Trash2,
  ChevronLeft,
} from "lucide-react"

interface SessionEvent {
  type: number
  data: unknown
  timestamp: number
}

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
  events: SessionEvent[]
}

interface PageVisit {
  url: string
  duration?: number
}

// rrweb event types for filtering
const EventType = {
  DomContentLoaded: 0,
  Load: 1,
  FullSnapshot: 2,
  IncrementalSnapshot: 3,
  Meta: 4,
  Custom: 5,
  Plugin: 6,
}

interface EventLogEntry {
  timestamp: number
  type: string
  description: string
  icon: React.ReactNode
  color: string
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
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

function formatTimeOffset(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
}

export default function SessionPlaybackPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.id as string
  const sessionId = params.sessionId as string

  const [session, setSession] = React.useState<RecordedSession | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [currentTime, setCurrentTime] = React.useState(0)
  const [eventLog, setEventLog] = React.useState<EventLogEntry[]>([])

  // Fetch session data
  React.useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch(`/api/session-tracking/${sessionId}`)
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("Session not found")
          }
          throw new Error("Failed to fetch session")
        }

        const data = await res.json()
        setSession(data.session)

        // Build event log from events
        if (data.session.events.length > 0) {
          const startTimestamp = data.session.events[0]?.timestamp || 0
          const log: EventLogEntry[] = []

          data.session.events.forEach((event: SessionEvent) => {
            const relativeTime = event.timestamp - startTimestamp

            // Check for interesting events
            if (event.type === EventType.IncrementalSnapshot) {
              const eventData = event.data as { source?: number; type?: number }
              // Mouse click
              if (eventData.source === 2 && eventData.type === 2) {
                log.push({
                  timestamp: relativeTime,
                  type: "click",
                  description: "Click",
                  icon: <MousePointer className="h-3 w-3" />,
                  color: "text-blue-400",
                })
              }
              // Input
              if (eventData.source === 5) {
                log.push({
                  timestamp: relativeTime,
                  type: "input",
                  description: "Input",
                  icon: <Layers className="h-3 w-3" />,
                  color: "text-purple-400",
                })
              }
            }

            // Custom events
            if (event.type === EventType.Custom) {
              const eventData = event.data as { tag?: string; payload?: { message?: string; url?: string } }
              if (eventData.tag === "error") {
                log.push({
                  timestamp: relativeTime,
                  type: "error",
                  description: eventData.payload?.message || "Error",
                  icon: <AlertCircle className="h-3 w-3" />,
                  color: "text-red-400",
                })
              }
              if (eventData.tag === "navigation") {
                log.push({
                  timestamp: relativeTime,
                  type: "navigation",
                  description: eventData.payload?.url || "Navigation",
                  icon: <Globe className="h-3 w-3" />,
                  color: "text-green-400",
                })
              }
            }
          })

          // Sort by timestamp and limit to reasonable number
          log.sort((a, b) => a.timestamp - b.timestamp)
          setEventLog(log.slice(0, 500))
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load session")
      } finally {
        setLoading(false)
      }
    }

    if (sessionId) {
      fetchSession()
    }
  }, [sessionId])

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this session recording?")) {
      return
    }

    setDeleting(true)
    try {
      const res = await fetch(`/api/session-tracking/${sessionId}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        throw new Error("Failed to delete session")
      }

      router.push(`/admin/users/${userId}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete session")
    } finally {
      setDeleting(false)
    }
  }

  const parsePagesVisited = (): PageVisit[] => {
    if (!session?.pagesVisited) return []
    try {
      const parsed = JSON.parse(session.pagesVisited)
      // Handle both string[] and PageVisit[] formats
      return parsed.map((item: string | PageVisit) =>
        typeof item === "string" ? { url: item } : item
      )
    } catch {
      return []
    }
  }

  const pagesVisited = parsePagesVisited()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <XCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg font-medium">Failed to load session</p>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <Button asChild>
          <Link href={`/admin/users/${userId}`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to User
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/admin/users/${userId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">Session Replay</h1>
              <Badge variant="secondary" className="text-xs">
                {session.browser || "Unknown Browser"}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link
                href={`/admin/users/${userId}`}
                className="hover:text-foreground transition-colors"
              >
                {session.userName}
              </Link>
              <span>-</span>
              <span>{formatDate(session.startedAt)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Delete
          </Button>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Player - takes 2 columns */}
        <div className="lg:col-span-2 space-y-4">
          {session.events.length > 0 ? (
            <SessionPlayer
              events={session.events}
              onTimeUpdate={setCurrentTime}
            />
          ) : (
            <Card className="h-[500px] flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <XCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">No events recorded for this session</p>
              </div>
            </Card>
          )}

          {/* Session Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Clock className="h-4 w-4" />
                Duration
              </div>
              <p className="text-lg font-semibold">{formatDuration(session.duration)}</p>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <MousePointer className="h-4 w-4" />
                Clicks
              </div>
              <p className="text-lg font-semibold">{session.clickCount}</p>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Layers className="h-4 w-4" />
                Pages
              </div>
              <p className="text-lg font-semibold">{session.pageCount}</p>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2 text-sm text-red-400 mb-1">
                <AlertCircle className="h-4 w-4" />
                Errors
              </div>
              <p className={cn("text-lg font-semibold", session.errorCount > 0 && "text-red-400")}>
                {session.errorCount}
              </p>
            </div>
          </div>
        </div>

        {/* Side panel - takes 1 column */}
        <div className="space-y-4">
          {/* Session Metadata */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Session Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* User */}
              <Link
                href={`/admin/users/${userId}`}
                className="flex items-center gap-3 p-2 -m-2 rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
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
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{session.userName}</p>
                  <p className="text-xs text-muted-foreground truncate">{session.userEmail}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>

              {/* Device Info */}
              <div className="space-y-2 text-sm pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Device:</span>
                  <span>{session.deviceType || "Unknown"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Browser:</span>
                  <span>{session.browser || "Unknown"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">OS:</span>
                  <span>{session.os || "Unknown"}</span>
                </div>
                {session.screenWidth && session.screenHeight && (
                  <div className="flex items-center gap-2">
                    <Monitor className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Screen:</span>
                    <span>
                      {session.screenWidth} x {session.screenHeight}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Started:</span>
                  <span className="text-xs">{formatDate(session.startedAt)}</span>
                </div>
                {session.endedAt && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Ended:</span>
                    <span className="text-xs">{formatDate(session.endedAt)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pages Visited */}
          {pagesVisited.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Pages Visited ({pagesVisited.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[200px]">
                  <div className="divide-y">
                    {pagesVisited.map((page, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent/50"
                      >
                        <Globe className="h-3 w-3 text-muted-foreground flex-none" />
                        <span className="truncate flex-1">{page.url}</span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground flex-none" />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Event Log */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Event Log ({eventLog.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[300px]">
                <div className="divide-y">
                  {eventLog.length > 0 ? (
                    eventLog.map((event, index) => (
                      <div
                        key={index}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent/50 transition-colors",
                          currentTime >= event.timestamp &&
                            currentTime < (eventLog[index + 1]?.timestamp || Infinity) &&
                            "bg-accent"
                        )}
                      >
                        <span className={cn("flex-none", event.color)}>{event.icon}</span>
                        <span className="font-mono text-xs text-muted-foreground flex-none w-12">
                          {formatTimeOffset(event.timestamp)}
                        </span>
                        <span className="truncate flex-1">{event.description}</span>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <Clock className="h-8 w-8 mb-2 opacity-50" />
                      <p className="text-xs">No events logged</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Errors */}
          {session.errorCount > 0 && (
            <Card className="border-red-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-red-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Errors Encountered ({session.errorCount})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="max-h-[200px]">
                  <div className="divide-y">
                    {eventLog
                      .filter((e) => e.type === "error")
                      .map((event, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-2 px-4 py-2 text-sm hover:bg-red-500/5"
                        >
                          <AlertCircle className="h-3 w-3 text-red-400 flex-none mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <span className="font-mono text-xs text-muted-foreground">
                              {formatTimeOffset(event.timestamp)}
                            </span>
                            <p className="text-xs text-red-400 truncate">
                              {event.description}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
