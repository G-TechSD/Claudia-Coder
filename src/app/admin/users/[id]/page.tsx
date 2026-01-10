"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  XCircle,
  Loader2,
  Clock,
  MousePointer,
  AlertCircle,
  Video,
  Calendar,
  User,
  Mail,
  Shield,
  Users,
  Play,
  ChevronRight,
  Activity,
  Monitor,
  Globe,
  TrendingUp,
} from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"

interface UserDetails {
  id: string
  name: string
  email: string
  role: string
  image: string | null
  emailVerified: number
  ndaSigned: number
  ndaSignedAt: string | null
  disabled: number
  createdAt: string
  updatedAt: string
}

interface UserSessionStats {
  totalSessions: number
  totalDuration: number
  lastActiveAt: string | null
  totalClicks: number
  totalErrors: number
  avgSessionDuration: number
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
}

interface ActivityEvent {
  type: "session" | "login" | "action"
  timestamp: string
  description: string
  metadata?: {
    sessionId?: string
    clicks?: number
    errors?: number
    browser?: string
    device?: string
  }
}

const roleConfig = {
  admin: { label: "Admin", color: "text-primary", bg: "bg-primary/20", icon: Shield },
  beta_tester: { label: "Beta Tester", color: "text-green-400", bg: "bg-green-500/20", icon: Users },
  user: { label: "User", color: "text-muted-foreground", bg: "bg-muted", icon: User },
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds === 0) return "0s"
  if (seconds < 60) return `${Math.round(seconds)}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

function formatDateRelative(dateString: string | null): string {
  if (!dateString) return "Never"
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor(diff / (1000 * 60))

  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days} days ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
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

function formatDateShort(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) {
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  }
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export default function UserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.id as string
  const { user: currentUser } = useAuth()

  const [user, setUser] = React.useState<UserDetails | null>(null)
  const [stats, setStats] = React.useState<UserSessionStats | null>(null)
  const [sessions, setSessions] = React.useState<RecordedSession[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [activeTab, setActiveTab] = React.useState("sessions")

  // Fetch user data and sessions
  React.useEffect(() => {
    async function fetchUserData() {
      try {
        setLoading(true)

        // Fetch user details and sessions in parallel
        const [userRes, sessionsRes] = await Promise.all([
          fetch(`/api/admin/users/${userId}`),
          fetch(`/api/admin/users/${userId}/sessions`),
        ])

        if (!userRes.ok) {
          if (userRes.status === 404) {
            throw new Error("User not found")
          }
          throw new Error("Failed to fetch user")
        }

        const userData = await userRes.json()
        setUser(userData.user)

        if (sessionsRes.ok) {
          const sessionsData = await sessionsRes.json()
          setSessions(sessionsData.sessions || [])
          setStats(sessionsData.stats)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load user")
      } finally {
        setLoading(false)
      }
    }

    if (userId) {
      fetchUserData()
    }
  }, [userId])

  // Generate activity timeline from sessions
  const activityTimeline = React.useMemo(() => {
    const events: ActivityEvent[] = []

    // Add session events
    sessions.forEach((session) => {
      events.push({
        type: "session",
        timestamp: session.startedAt,
        description: `Session recorded (${formatDuration(session.duration)})`,
        metadata: {
          sessionId: session.id,
          clicks: session.clickCount,
          errors: session.errorCount,
          browser: session.browser || undefined,
          device: session.deviceType || undefined,
        },
      })
    })

    // Sort by timestamp descending
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return events.slice(0, 50) // Limit to 50 most recent
  }, [sessions])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <XCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg font-medium">Failed to load user</p>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <Button asChild>
          <Link href="/admin/users">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Users
          </Link>
        </Button>
      </div>
    )
  }

  const config = roleConfig[user.role as keyof typeof roleConfig] || roleConfig.user
  const Icon = config.icon
  const isCurrentUser = user.id === currentUser?.id

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/users">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-full text-lg font-medium",
                config.bg,
                config.color
              )}
            >
              {user.image ? (
                <img
                  src={user.image}
                  alt={user.name}
                  className="h-14 w-14 rounded-full object-cover"
                />
              ) : (
                user.name?.[0]?.toUpperCase() || "U"
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{user.name}</h1>
                {isCurrentUser && (
                  <Badge variant="outline">You</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{user.email}</span>
                <Badge
                  variant="secondary"
                  className={cn("text-xs gap-1", config.color, config.bg)}
                >
                  <Icon className="h-3 w-3" />
                  {config.label}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3 rounded-lg border bg-card">
          <div className="flex items-center justify-between mb-1">
            <Video className="h-4 w-4 text-primary" />
            <span className="text-xl font-semibold text-primary">
              {stats?.totalSessions || 0}
            </span>
          </div>
          <p className="text-xs font-medium text-muted-foreground">Sessions</p>
        </div>

        <div className="p-3 rounded-lg border bg-card">
          <div className="flex items-center justify-between mb-1">
            <Clock className="h-4 w-4 text-blue-400" />
            <span className="text-xl font-semibold text-blue-400">
              {formatDuration(stats?.totalDuration || 0)}
            </span>
          </div>
          <p className="text-xs font-medium text-muted-foreground">Total Time</p>
        </div>

        <div className="p-3 rounded-lg border bg-card">
          <div className="flex items-center justify-between mb-1">
            <MousePointer className="h-4 w-4 text-green-400" />
            <span className="text-xl font-semibold text-green-400">
              {stats?.totalClicks || 0}
            </span>
          </div>
          <p className="text-xs font-medium text-muted-foreground">Clicks</p>
        </div>

        <div className="p-3 rounded-lg border bg-card">
          <div className="flex items-center justify-between mb-1">
            <TrendingUp className="h-4 w-4 text-purple-400" />
            <span className="text-xl font-semibold text-purple-400">
              {formatDuration(stats?.avgSessionDuration || 0)}
            </span>
          </div>
          <p className="text-xs font-medium text-muted-foreground">Avg Session</p>
        </div>

        <div className="p-3 rounded-lg border bg-card">
          <div className="flex items-center justify-between mb-1">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <span className={cn("text-xl font-semibold", stats?.totalErrors ? "text-red-400" : "")}>
              {stats?.totalErrors || 0}
            </span>
          </div>
          <p className="text-xs font-medium text-muted-foreground">Errors</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3 flex-1 min-h-0">
        {/* Left Panel - User Info & Activity */}
        <div className="space-y-4">
          {/* User Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">User Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium truncate">{user.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Joined:</span>
                <span className="font-mono text-xs">{formatDate(user.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Last Active:</span>
                <span>{formatDateRelative(stats?.lastActiveAt || null)}</span>
              </div>
              {user.ndaSigned ? (
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-400" />
                  <span className="text-green-400">NDA Signed</span>
                  {user.ndaSignedAt && (
                    <span className="text-xs text-muted-foreground">
                      on {formatDate(user.ndaSignedAt)}
                    </span>
                  )}
                </div>
              ) : null}
              {user.disabled ? (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  Account Disabled
                </Badge>
              ) : null}
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Activity Timeline ({activityTimeline.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 min-h-0">
              <ScrollArea className="h-[300px]">
                <div className="divide-y">
                  {activityTimeline.length > 0 ? (
                    activityTimeline.map((event, index) => (
                      <div
                        key={`${event.type}-${event.timestamp}-${index}`}
                        className="flex items-start gap-3 p-3 hover:bg-accent/50 transition-colors"
                      >
                        <div
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full flex-none text-white",
                            event.type === "session" && "bg-primary",
                            event.type === "login" && "bg-green-500",
                            event.type === "action" && "bg-blue-500"
                          )}
                        >
                          {event.type === "session" && <Video className="h-4 w-4" />}
                          {event.type === "login" && <User className="h-4 w-4" />}
                          {event.type === "action" && <Activity className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{event.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateShort(event.timestamp)}
                          </p>
                          {event.metadata?.sessionId && (
                            <Link
                              href={`/admin/users/${userId}/sessions/${event.metadata.sessionId}`}
                              className="text-xs text-primary hover:underline"
                            >
                              View Recording
                            </Link>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <Activity className="h-8 w-8 mb-2 opacity-50" />
                      <p className="text-xs">No activity recorded</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Sessions List */}
        <Card className="lg:col-span-2 flex flex-col min-h-0">
          <CardHeader className="pb-2 flex-none">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">
                Recorded Sessions ({sessions.length})
              </CardTitle>
              {sessions.length > 0 && (
                <Link href={`/admin/users/${userId}/sessions/${sessions[0].id}`}>
                  <Button size="sm" variant="outline" className="gap-1">
                    <Play className="h-4 w-4" />
                    Latest Session
                  </Button>
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0">
            <div className="divide-y">
              {sessions.length > 0 ? (
                sessions.map((session) => (
                  <Link
                    key={session.id}
                    href={`/admin/users/${userId}/sessions/${session.id}`}
                    className="flex items-center gap-4 p-4 hover:bg-accent/50 transition-colors"
                  >
                    {/* Session Icon */}
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary flex-none">
                      <Video className="h-5 w-5" />
                    </div>

                    {/* Session Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatDateShort(session.startedAt)}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(session.startedAt).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
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
                        {session.browser && (
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {session.browser}
                          </span>
                        )}
                        {session.deviceType && (
                          <span className="flex items-center gap-1">
                            <Monitor className="h-3 w-3" />
                            {session.deviceType}
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
                  <Video className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-sm">No sessions recorded</p>
                  <p className="text-xs mt-1">Sessions will appear here when the user is active</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
