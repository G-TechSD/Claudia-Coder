"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  ShieldAlert,
  Lock,
  Unlock,
  UserX,
  UserCheck,
  AlertTriangle,
  Clock,
  User,
  Shield,
  Users,
  Loader2,
  XCircle,
  RefreshCw,
} from "lucide-react"

interface AdminUser {
  id: string
  name: string
  email: string
  role: string
  accessRevoked: number
  revokedAt: string | null
  revokedReason: string | null
}

interface LockdownState {
  enabled: boolean
  enabledAt: string | null
  enabledBy: string | null
  reason: string | null
}

interface SecurityEvent {
  id: string
  timestamp: string
  type: "lockdown_enabled" | "lockdown_disabled" | "access_revoked" | "access_restored" | "suspicious_activity"
  userId: string | null
  targetUserId: string | null
  details: string
}

interface UserStats {
  total: number
  accessRevoked: number
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const eventTypeConfig = {
  lockdown_enabled: { label: "Lockdown Enabled", color: "text-red-400", bg: "bg-red-500/20", icon: Lock },
  lockdown_disabled: { label: "Lockdown Disabled", color: "text-green-400", bg: "bg-green-500/20", icon: Unlock },
  access_revoked: { label: "Access Revoked", color: "text-orange-400", bg: "bg-orange-500/20", icon: UserX },
  access_restored: { label: "Access Restored", color: "text-blue-400", bg: "bg-blue-500/20", icon: UserCheck },
  suspicious_activity: { label: "Suspicious Activity", color: "text-yellow-400", bg: "bg-yellow-500/20", icon: AlertTriangle },
}

export default function SecurityPage() {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [lockdown, setLockdown] = React.useState<LockdownState | null>(null)
  const [users, setUsers] = React.useState<AdminUser[]>([])
  const [events, setEvents] = React.useState<SecurityEvent[]>([])
  const [stats, setStats] = React.useState<UserStats | null>(null)
  const [actionLoading, setActionLoading] = React.useState(false)

  // Dialog states
  const [lockdownDialogOpen, setLockdownDialogOpen] = React.useState(false)
  const [revokeDialogOpen, setRevokeDialogOpen] = React.useState(false)
  const [selectedUser, setSelectedUser] = React.useState<AdminUser | null>(null)
  const [lockdownReason, setLockdownReason] = React.useState("")
  const [revokeReason, setRevokeReason] = React.useState("")

  const fetchData = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/security")
      if (!res.ok) throw new Error("Failed to fetch security data")
      const data = await res.json()
      setLockdown(data.lockdown)
      setUsers(data.users)
      setEvents(data.events)
      setStats(data.stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load security data")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const performAction = async (action: string, params: Record<string, string> = {}) => {
    setActionLoading(true)
    try {
      const res = await fetch("/api/admin/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...params }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Action failed")

      // Refresh data
      await fetchData()

      // Close dialogs
      setLockdownDialogOpen(false)
      setRevokeDialogOpen(false)
      setLockdownReason("")
      setRevokeReason("")
      setSelectedUser(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed")
    } finally {
      setActionLoading(false)
    }
  }

  const handleToggleLockdown = () => {
    if (lockdown?.enabled) {
      performAction("disable_lockdown")
    } else {
      setLockdownDialogOpen(true)
    }
  }

  const handleEnableLockdown = () => {
    if (!lockdownReason.trim()) {
      alert("Please provide a reason for the lockdown")
      return
    }
    performAction("enable_lockdown", { reason: lockdownReason })
  }

  const handleRevokeAccess = (user: AdminUser) => {
    setSelectedUser(user)
    setRevokeDialogOpen(true)
  }

  const handleConfirmRevoke = () => {
    if (!revokeReason.trim()) {
      alert("Please provide a reason for revoking access")
      return
    }
    if (selectedUser) {
      performAction("revoke_access", { userId: selectedUser.id, reason: revokeReason })
    }
  }

  const handleRestoreAccess = (user: AdminUser) => {
    if (confirm(`Are you sure you want to restore access for ${user.name}?`)) {
      performAction("restore_access", { userId: user.id })
    }
  }

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
        <p className="text-lg font-medium">Failed to load security data</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  const revokedUsers = users.filter(u => u.accessRevoked)
  const activeUsers = users.filter(u => !u.accessRevoked && u.role !== "admin")

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Security Center</h1>
          <p className="text-sm text-muted-foreground">
            Manage system lockdown and user access controls
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Lockdown Control */}
      <Card className={cn(
        "border-2",
        lockdown?.enabled ? "border-red-500 bg-red-500/5" : "border-green-500/50"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {lockdown?.enabled ? (
                <Lock className="h-6 w-6 text-red-500" />
              ) : (
                <Unlock className="h-6 w-6 text-green-500" />
              )}
              <div>
                <CardTitle>System Lockdown</CardTitle>
                <CardDescription>
                  {lockdown?.enabled
                    ? "System is in lockdown mode - only admins can access"
                    : "System is operating normally"}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant={lockdown?.enabled ? "destructive" : "success"}>
                {lockdown?.enabled ? "ACTIVE" : "INACTIVE"}
              </Badge>
              <Switch
                checked={lockdown?.enabled}
                onCheckedChange={handleToggleLockdown}
                disabled={actionLoading}
              />
            </div>
          </div>
        </CardHeader>
        {lockdown?.enabled && (
          <CardContent className="pt-0">
            <div className="text-sm space-y-1 text-muted-foreground">
              <p><strong>Reason:</strong> {lockdown.reason}</p>
              <p><strong>Enabled at:</strong> {lockdown.enabledAt ? formatDate(lockdown.enabledAt) : "Unknown"}</p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg border">
          <div className="flex items-center justify-between mb-1">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-xl font-semibold">{stats?.total || 0}</span>
          </div>
          <p className="text-xs font-medium text-muted-foreground">Total Users</p>
        </div>
        <div className="p-3 rounded-lg border">
          <div className="flex items-center justify-between mb-1">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-xl font-semibold text-primary">
              {users.filter(u => u.role === "admin").length}
            </span>
          </div>
          <p className="text-xs font-medium text-muted-foreground">Admins</p>
        </div>
        <div className="p-3 rounded-lg border">
          <div className="flex items-center justify-between mb-1">
            <User className="h-4 w-4 text-green-400" />
            <span className="text-xl font-semibold text-green-400">{activeUsers.length}</span>
          </div>
          <p className="text-xs font-medium text-muted-foreground">Active Beta Users</p>
        </div>
        <div className="p-3 rounded-lg border border-red-500/30">
          <div className="flex items-center justify-between mb-1">
            <UserX className="h-4 w-4 text-red-400" />
            <span className="text-xl font-semibold text-red-400">{stats?.accessRevoked || 0}</span>
          </div>
          <p className="text-xs font-medium text-muted-foreground">Access Revoked</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 flex-1 min-h-0">
        {/* Users with Revoke Options */}
        <Card className="flex flex-col min-h-0">
          <CardHeader className="pb-2 flex-none">
            <CardTitle className="text-base font-medium">User Access Control</CardTitle>
            <CardDescription>Revoke or restore user access</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0">
            <div className="divide-y">
              {/* Revoked Users First */}
              {revokedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 bg-red-500/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20 text-red-400 text-sm font-medium">
                      <UserX className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-sm line-through opacity-60">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                      <p className="text-xs text-red-400 mt-0.5">
                        Revoked: {user.revokedReason || "No reason"}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRestoreAccess(user)}
                    disabled={actionLoading}
                  >
                    <UserCheck className="h-4 w-4 mr-1" />
                    Restore
                  </Button>
                </div>
              ))}

              {/* Active Users */}
              {activeUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 hover:bg-accent/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground text-sm font-medium">
                      {user.name?.[0]?.toUpperCase() || "U"}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleRevokeAccess(user)}
                    disabled={actionLoading}
                  >
                    <UserX className="h-4 w-4 mr-1" />
                    Revoke
                  </Button>
                </div>
              ))}

              {activeUsers.length === 0 && revokedUsers.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-sm">No beta users found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Security Event Log */}
        <Card className="flex flex-col min-h-0">
          <CardHeader className="pb-2 flex-none">
            <CardTitle className="text-base font-medium">Security Event Log</CardTitle>
            <CardDescription>Recent security-related events</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0">
            <div className="divide-y">
              {events.map((event) => {
                const config = eventTypeConfig[event.type]
                const Icon = config.icon

                return (
                  <div key={event.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full flex-none",
                        config.bg, config.color
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className={cn("text-xs", config.color, config.bg)}>
                            {config.label}
                          </Badge>
                        </div>
                        <p className="text-sm">{event.details}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDate(event.timestamp)}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}

              {events.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <ShieldAlert className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-sm">No security events</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lockdown Dialog */}
      <Dialog open={lockdownDialogOpen} onOpenChange={setLockdownDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-500" />
              Enable System Lockdown
            </DialogTitle>
            <DialogDescription>
              This will immediately restrict access to admins only. All other users
              will see a maintenance message.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="lockdown-reason">Reason for lockdown</Label>
              <Input
                id="lockdown-reason"
                placeholder="e.g., Security incident investigation"
                value={lockdownReason}
                onChange={(e) => setLockdownReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLockdownDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleEnableLockdown}
              disabled={actionLoading || !lockdownReason.trim()}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Lock className="h-4 w-4 mr-2" />
              )}
              Enable Lockdown
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Access Dialog */}
      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-red-500" />
              Revoke User Access
            </DialogTitle>
            <DialogDescription>
              This will immediately revoke access for {selectedUser?.name}. They will
              be logged out and unable to access the system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg bg-muted">
              <p className="font-medium">{selectedUser?.name}</p>
              <p className="text-sm text-muted-foreground">{selectedUser?.email}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="revoke-reason">Reason for revocation</Label>
              <Input
                id="revoke-reason"
                placeholder="e.g., NDA violation, suspicious activity"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmRevoke}
              disabled={actionLoading || !revokeReason.trim()}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <UserX className="h-4 w-4 mr-2" />
              )}
              Revoke Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
