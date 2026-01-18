"use client"

import * as React from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  Users,
  Shield,
  XCircle,
  Loader2,
  User,
  Clock,
  MousePointer,
  AlertCircle,
  Video,
  Search,
  ChevronRight,
  Calendar,
  Activity,
  TrendingUp,
} from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"

interface UserWithSessionStats {
  userId: string
  userName: string
  userEmail: string
  userImage: string | null
  userRole: string
  sessionCount: number
  totalDuration: number
  lastActiveAt: string | null
  totalClicks: number
  totalErrors: number
  avgSessionDuration: number
  createdAt: string
}

interface UserStats {
  total: number
  admins: number
  betaTesters: number
  users: number
  ndaSigned: number
  disabled: number
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
  })
}

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = React.useState<UserWithSessionStats[]>([])
  const [stats, setStats] = React.useState<UserStats | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [roleFilter, setRoleFilter] = React.useState<string>("all")
  const [sortBy, setSortBy] = React.useState<string>("lastActive")

  const fetchUsers = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users?includeSessionStats=true")
      if (!res.ok) throw new Error("Failed to fetch users")
      const data = await res.json()
      setUsers(data.usersWithStats || [])
      setStats(data.stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Filter and sort users
  const filteredUsers = React.useMemo(() => {
    const result = users.filter((user) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (
          !user.userName.toLowerCase().includes(query) &&
          !user.userEmail.toLowerCase().includes(query)
        ) {
          return false
        }
      }

      // Role filter
      if (roleFilter !== "all" && user.userRole !== roleFilter) {
        return false
      }

      return true
    })

    // Sort
    switch (sortBy) {
      case "lastActive":
        result.sort((a, b) => {
          if (!a.lastActiveAt && !b.lastActiveAt) return 0
          if (!a.lastActiveAt) return 1
          if (!b.lastActiveAt) return -1
          return new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
        })
        break
      case "sessions":
        result.sort((a, b) => b.sessionCount - a.sessionCount)
        break
      case "duration":
        result.sort((a, b) => b.totalDuration - a.totalDuration)
        break
      case "name":
        result.sort((a, b) => a.userName.localeCompare(b.userName))
        break
      case "created":
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
    }

    return result
  }, [users, searchQuery, roleFilter, sortBy])

  // Calculate summary stats
  const summaryStats = React.useMemo(() => {
    const activeToday = users.filter((u) => {
      if (!u.lastActiveAt) return false
      const lastActive = new Date(u.lastActiveAt)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return lastActive >= today
    }).length

    const totalSessions = users.reduce((sum, u) => sum + u.sessionCount, 0)
    const totalTime = users.reduce((sum, u) => sum + u.totalDuration, 0)

    return { activeToday, totalSessions, totalTime }
  }, [users])

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
        <p className="text-lg font-medium">Failed to load users</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">User Session Monitoring</h1>
          <p className="text-sm text-muted-foreground">
            View user activity and session recordings
          </p>
        </div>
        <Link href="/admin">
          <Button variant="outline" size="sm">
            <Activity className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg border bg-card">
          <div className="flex items-center justify-between mb-1">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-xl font-semibold text-primary">{stats?.total || 0}</span>
          </div>
          <p className="text-xs font-medium text-muted-foreground">Total Users</p>
        </div>

        <div className="p-3 rounded-lg border bg-card">
          <div className="flex items-center justify-between mb-1">
            <TrendingUp className="h-4 w-4 text-green-400" />
            <span className="text-xl font-semibold text-green-400">{summaryStats.activeToday}</span>
          </div>
          <p className="text-xs font-medium text-muted-foreground">Active Today</p>
        </div>

        <div className="p-3 rounded-lg border bg-card">
          <div className="flex items-center justify-between mb-1">
            <Video className="h-4 w-4 text-blue-400" />
            <span className="text-xl font-semibold text-blue-400">{summaryStats.totalSessions}</span>
          </div>
          <p className="text-xs font-medium text-muted-foreground">Total Sessions</p>
        </div>

        <div className="p-3 rounded-lg border bg-card">
          <div className="flex items-center justify-between mb-1">
            <Clock className="h-4 w-4 text-purple-400" />
            <span className="text-xl font-semibold text-purple-400">
              {formatDuration(summaryStats.totalTime)}
            </span>
          </div>
          <p className="text-xs font-medium text-muted-foreground">Total Time</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admins</SelectItem>
            <SelectItem value="beta_tester">Beta Testers</SelectItem>
            <SelectItem value="user">Users</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lastActive">Last Active</SelectItem>
            <SelectItem value="sessions">Most Sessions</SelectItem>
            <SelectItem value="duration">Most Time</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="created">Newest</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users List */}
      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader className="pb-2 flex-none">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">Users</CardTitle>
            <span className="text-sm text-muted-foreground">
              {filteredUsers.length} of {users.length} users
            </span>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-0">
          <div className="divide-y">
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => {
                const config = roleConfig[user.userRole as keyof typeof roleConfig] || roleConfig.user
                const Icon = config.icon
                const isCurrentUser = user.userId === currentUser?.id

                return (
                  <Link
                    key={user.userId}
                    href={`/admin/users/${user.userId}`}
                    className="flex items-center gap-4 p-4 hover:bg-accent/50 transition-colors"
                  >
                    {/* Avatar */}
                    <div
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-full flex-none text-sm font-medium",
                        config.bg,
                        config.color
                      )}
                    >
                      {user.userImage ? (
                        <img
                          src={user.userImage}
                          alt={user.userName}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        user.userName?.[0]?.toUpperCase() || "U"
                      )}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{user.userName}</span>
                        {isCurrentUser && (
                          <Badge variant="outline" className="text-xs">You</Badge>
                        )}
                        <Badge
                          variant="secondary"
                          className={cn("text-xs gap-1", config.color, config.bg)}
                        >
                          <Icon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="truncate max-w-[200px]">{user.userEmail}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDateRelative(user.lastActiveAt)}
                        </span>
                      </div>
                    </div>

                    {/* Session Stats */}
                    <div className="hidden sm:flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <div className="font-semibold">{user.sessionCount}</div>
                        <div className="text-xs text-muted-foreground">Sessions</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold">{formatDuration(user.totalDuration)}</div>
                        <div className="text-xs text-muted-foreground">Total Time</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold">{user.totalClicks}</div>
                        <div className="text-xs text-muted-foreground">Clicks</div>
                      </div>
                      {user.totalErrors > 0 && (
                        <div className="text-center">
                          <div className="font-semibold text-red-400">{user.totalErrors}</div>
                          <div className="text-xs text-red-400">Errors</div>
                        </div>
                      )}
                    </div>

                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-none" />
                  </Link>
                )
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-sm">No users found</p>
                {(searchQuery || roleFilter !== "all") && (
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      setSearchQuery("")
                      setRoleFilter("all")
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
