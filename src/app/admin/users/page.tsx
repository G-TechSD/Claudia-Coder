"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
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
  FileCheck,
  XCircle,
  Loader2,
  User,
  Mail,
  Calendar,
  CheckCircle,
  DollarSign,
  Key,
  RefreshCw,
  KeyRound,
} from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/components/auth/auth-provider"
import { ResetPasswordDialog } from "@/components/admin/reset-password-dialog"

interface AdminUser {
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

interface BudgetStatus {
  userId: string
  apiKeySource: "provided" | "own"
  hasOwnApiKey: boolean
  budget: number
  spent: number
  remaining: number
  percentUsed: number
  resetDate: string
  daysUntilReset: number
  isOverBudget: boolean
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

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatDateFull(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount)
}

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = React.useState<AdminUser[]>([])
  const [stats, setStats] = React.useState<UserStats | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [selectedUser, setSelectedUser] = React.useState<AdminUser | null>(null)
  const [updating, setUpdating] = React.useState<string | null>(null)
  const [roleFilter, setRoleFilter] = React.useState<string>("all")

  // Budget management state
  const [userBudget, setUserBudget] = React.useState<BudgetStatus | null>(null)
  const [loadingBudget, setLoadingBudget] = React.useState(false)
  const [editingBudget, setEditingBudget] = React.useState(false)
  const [newBudgetAmount, setNewBudgetAmount] = React.useState("")

  // Password reset state
  const [resetPasswordOpen, setResetPasswordOpen] = React.useState(false)
  const [resetPasswordUser, setResetPasswordUser] = React.useState<AdminUser | null>(null)

  const fetchUsers = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users")
      if (!res.ok) throw new Error("Failed to fetch users")
      const data = await res.json()
      setUsers(data.users)
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

  const updateUser = async (
    userId: string,
    updates: { role?: string; disabled?: boolean; ndaSigned?: boolean }
  ) => {
    setUpdating(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to update user")
      }

      // Update local state
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? data.user : u))
      )
      if (selectedUser?.id === userId) {
        setSelectedUser(data.user)
      }

      // Refresh stats
      await fetchUsers()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update user")
    } finally {
      setUpdating(null)
    }
  }

  // Fetch budget status for selected user
  const fetchUserBudget = React.useCallback(async (userId: string) => {
    setLoadingBudget(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}/budget`)
      if (res.ok) {
        const data = await res.json()
        setUserBudget(data.budget)
      } else {
        setUserBudget(null)
      }
    } catch {
      setUserBudget(null)
    } finally {
      setLoadingBudget(false)
    }
  }, [])

  // Fetch budget when selected user changes (only for beta testers)
  React.useEffect(() => {
    if (selectedUser && (selectedUser.role === "beta_tester" || selectedUser.role === "beta")) {
      fetchUserBudget(selectedUser.id)
    } else {
      setUserBudget(null)
    }
  }, [selectedUser, fetchUserBudget])

  // Update user budget
  const updateUserBudget = async (userId: string, newBudget: number) => {
    setUpdating(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}/budget`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiUsageBudget: newBudget }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to update budget")
      }

      // Refresh budget
      await fetchUserBudget(userId)
      setEditingBudget(false)
      setNewBudgetAmount("")
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update budget")
    } finally {
      setUpdating(null)
    }
  }

  // Reset user budget
  const resetUserBudget = async (userId: string) => {
    if (!confirm("Reset this user's spent amount to zero?")) return

    setUpdating(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}/budget`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to reset budget")
      }

      // Refresh budget
      await fetchUserBudget(userId)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reset budget")
    } finally {
      setUpdating(null)
    }
  }

  const filteredUsers = users.filter(
    (user) => roleFilter === "all" || user.role === roleFilter
  )

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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">User Management</h1>
        <p className="text-sm text-muted-foreground">
          Manage user roles, NDA status, and account status
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => setRoleFilter(roleFilter === "admin" ? "all" : "admin")}
            className={cn(
              "p-3 rounded-lg border text-left transition-colors",
              roleFilter === "admin" ? "border-primary bg-accent" : "hover:bg-accent/50"
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-xl font-semibold text-primary">{stats.admins}</span>
            </div>
            <p className="text-xs font-medium">Admins</p>
          </button>

          <button
            onClick={() => setRoleFilter(roleFilter === "beta_tester" ? "all" : "beta_tester")}
            className={cn(
              "p-3 rounded-lg border text-left transition-colors",
              roleFilter === "beta_tester" ? "border-primary bg-accent" : "hover:bg-accent/50"
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <Users className="h-4 w-4 text-green-400" />
              <span className="text-xl font-semibold text-green-400">{stats.betaTesters}</span>
            </div>
            <p className="text-xs font-medium">Beta Testers</p>
          </button>

          <button
            onClick={() => setRoleFilter(roleFilter === "user" ? "all" : "user")}
            className={cn(
              "p-3 rounded-lg border text-left transition-colors",
              roleFilter === "user" ? "border-primary bg-accent" : "hover:bg-accent/50"
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-xl font-semibold">{stats.users}</span>
            </div>
            <p className="text-xs font-medium">Users</p>
          </button>

          <div className="p-3 rounded-lg border">
            <div className="flex items-center justify-between mb-1">
              <FileCheck className="h-4 w-4 text-blue-400" />
              <span className="text-xl font-semibold text-blue-400">{stats.ndaSigned}</span>
            </div>
            <p className="text-xs font-medium">NDA Signed</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-5 flex-1 min-h-0">
        {/* Users List */}
        <Card className="lg:col-span-3 flex flex-col min-h-0">
          <CardHeader className="pb-2 flex-none">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">
                {roleFilter === "all"
                  ? "All Users"
                  : `${roleConfig[roleFilter as keyof typeof roleConfig]?.label || roleFilter}s`}
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                {filteredUsers.length} users
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0">
            <div className="divide-y">
              {filteredUsers.map((user) => {
                const config = roleConfig[user.role as keyof typeof roleConfig] || roleConfig.user
                const Icon = config.icon
                const isSelected = selectedUser?.id === user.id
                const isCurrentUser = user.id === currentUser?.id

                return (
                  <div
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    className={cn(
                      "flex items-center gap-4 p-4 cursor-pointer transition-colors",
                      isSelected ? "bg-accent" : "hover:bg-accent/50",
                      user.disabled ? "opacity-60" : ""
                    )}
                  >
                    {/* Avatar */}
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full flex-none text-sm font-medium",
                        config.bg,
                        config.color
                      )}
                    >
                      {user.image ? (
                        <img
                          src={user.image}
                          alt={user.name}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        user.name?.[0]?.toUpperCase() || "U"
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{user.name}</span>
                        {isCurrentUser && (
                          <Badge variant="outline" className="text-xs">
                            You
                          </Badge>
                        )}
                        {user.disabled ? (
                          <Badge variant="destructive" className="text-xs">
                            Disabled
                          </Badge>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="truncate">{user.email}</span>
                        <Badge
                          variant="secondary"
                          className={cn("text-xs", config.color, config.bg)}
                        >
                          <Icon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                        {user.ndaSigned ? (
                          <Badge variant="success" className="text-xs gap-1">
                            <FileCheck className="h-3 w-3" />
                            NDA
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )
              })}

              {filteredUsers.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-sm">No users found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Detail Panel */}
        <Card className="lg:col-span-2 flex flex-col min-h-0">
          <CardHeader className="pb-2 flex-none">
            <CardTitle className="text-base font-medium">User Details</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {selectedUser ? (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "flex h-16 w-16 items-center justify-center rounded-full text-xl font-medium",
                      roleConfig[selectedUser.role as keyof typeof roleConfig]?.bg || "bg-muted",
                      roleConfig[selectedUser.role as keyof typeof roleConfig]?.color || ""
                    )}
                  >
                    {selectedUser.image ? (
                      <img
                        src={selectedUser.image}
                        alt={selectedUser.name}
                        className="h-16 w-16 rounded-full object-cover"
                      />
                    ) : (
                      selectedUser.name?.[0]?.toUpperCase() || "U"
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{selectedUser.name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                    {selectedUser.id === currentUser?.id && (
                      <Badge variant="outline" className="mt-1">Your Account</Badge>
                    )}
                  </div>
                </div>

                {/* Role Selector */}
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={selectedUser.role}
                    onValueChange={(value) => updateUser(selectedUser.id, { role: value })}
                    disabled={
                      updating === selectedUser.id ||
                      selectedUser.id === currentUser?.id
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-primary" />
                          Admin
                        </div>
                      </SelectItem>
                      <SelectItem value="beta_tester">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-green-400" />
                          Beta Tester
                        </div>
                      </SelectItem>
                      <SelectItem value="user">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          User
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {selectedUser.id === currentUser?.id && (
                    <p className="text-xs text-muted-foreground">
                      You cannot change your own role
                    </p>
                  )}
                </div>

                {/* NDA Status */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <div className="flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-blue-400" />
                    <div>
                      <p className="text-sm font-medium">NDA Status</p>
                      {selectedUser.ndaSignedAt && (
                        <p className="text-xs text-muted-foreground">
                          Signed on {formatDate(selectedUser.ndaSignedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {selectedUser.ndaSigned ? "Signed" : "Not Signed"}
                    </span>
                    <Switch
                      checked={!!selectedUser.ndaSigned}
                      onCheckedChange={(checked) =>
                        updateUser(selectedUser.id, { ndaSigned: checked })
                      }
                      disabled={
                        updating === selectedUser.id ||
                        selectedUser.id === currentUser?.id
                      }
                    />
                  </div>
                </div>

                {/* Account Status */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <div className="flex items-center gap-2">
                    {selectedUser.disabled ? (
                      <XCircle className="h-4 w-4 text-red-400" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    )}
                    <div>
                      <p className="text-sm font-medium">Account Status</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedUser.disabled
                          ? "User cannot sign in"
                          : "User can sign in normally"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {selectedUser.disabled ? "Disabled" : "Enabled"}
                    </span>
                    <Switch
                      checked={!selectedUser.disabled}
                      onCheckedChange={(checked) =>
                        updateUser(selectedUser.id, { disabled: !checked })
                      }
                      disabled={
                        updating === selectedUser.id ||
                        selectedUser.id === currentUser?.id
                      }
                    />
                  </div>
                </div>

                {/* Reset Password - Only for beta testers (non-admin users) */}
                {selectedUser.role === "beta_tester" && selectedUser.id !== currentUser?.id && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-orange-400" />
                      <div>
                        <p className="text-sm font-medium">Password</p>
                        <p className="text-xs text-muted-foreground">
                          Reset user's login password
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setResetPasswordUser(selectedUser)
                        setResetPasswordOpen(true)
                      }}
                      disabled={updating === selectedUser.id}
                      className="gap-1"
                    >
                      <KeyRound className="h-3 w-3" />
                      Reset Password
                    </Button>
                  </div>
                )}

                {/* API Budget - Only for beta testers */}
                {(selectedUser.role === "beta_tester" || selectedUser.role === "beta") && (
                  <div className="space-y-3 p-4 rounded-lg border border-primary/20 bg-primary/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-primary" />
                        <p className="text-sm font-medium">API Budget</p>
                      </div>
                      {userBudget?.hasOwnApiKey && (
                        <Badge variant="success" className="text-xs gap-1">
                          <Key className="h-3 w-3" />
                          Own Key
                        </Badge>
                      )}
                    </div>

                    {loadingBudget ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : userBudget ? (
                      <div className="space-y-3">
                        {!userBudget.hasOwnApiKey && (
                          <>
                            {/* Usage Progress */}
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">
                                  {formatCurrency(userBudget.spent)} spent
                                </span>
                                <span className="text-muted-foreground">
                                  {formatCurrency(userBudget.budget)} budget
                                </span>
                              </div>
                              <Progress
                                value={userBudget.percentUsed}
                                className={cn(
                                  "h-2",
                                  userBudget.isOverBudget && "[&>div]:bg-destructive",
                                  userBudget.percentUsed >= 80 && !userBudget.isOverBudget && "[&>div]:bg-yellow-500"
                                )}
                              />
                              <p className="text-xs text-muted-foreground">
                                {userBudget.percentUsed.toFixed(1)}% used - Resets in {userBudget.daysUntilReset} days
                              </p>
                            </div>

                            {/* Budget Edit */}
                            {editingBudget ? (
                              <div className="flex items-center gap-2">
                                <span className="text-sm">$</span>
                                <Input
                                  type="number"
                                  value={newBudgetAmount}
                                  onChange={(e) => setNewBudgetAmount(e.target.value)}
                                  placeholder={userBudget.budget.toString()}
                                  className="h-8 w-24"
                                  step="0.01"
                                  min="0"
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    if (newBudgetAmount) {
                                      updateUserBudget(selectedUser.id, parseFloat(newBudgetAmount))
                                    }
                                  }}
                                  disabled={updating === selectedUser.id || !newBudgetAmount}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingBudget(false)
                                    setNewBudgetAmount("")
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingBudget(true)
                                    setNewBudgetAmount(userBudget.budget.toString())
                                  }}
                                  disabled={updating === selectedUser.id}
                                >
                                  Edit Budget
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => resetUserBudget(selectedUser.id)}
                                  disabled={updating === selectedUser.id}
                                  className="gap-1"
                                >
                                  <RefreshCw className="h-3 w-3" />
                                  Reset Spent
                                </Button>
                              </div>
                            )}
                          </>
                        )}

                        {userBudget.hasOwnApiKey && (
                          <p className="text-xs text-muted-foreground">
                            User is using their own Anthropic API key. No budget limits apply.
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No budget data available
                      </p>
                    )}
                  </div>
                )}

                {/* Details */}
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Account Info
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Email:</span>
                      <span className="font-medium">{selectedUser.email}</span>
                      {selectedUser.emailVerified ? (
                        <Badge variant="success" className="text-xs">Verified</Badge>
                      ) : (
                        <Badge variant="warning" className="text-xs">Unverified</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Joined:</span>
                      <span className="font-mono text-xs">
                        {formatDateFull(selectedUser.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Updated:</span>
                      <span className="font-mono text-xs">
                        {formatDateFull(selectedUser.updatedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Loading indicator */}
                {updating === selectedUser.id && (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Updating...
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Users className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-sm">Select a user</p>
                <p className="text-xs mt-1">to view details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reset Password Dialog */}
      <ResetPasswordDialog
        open={resetPasswordOpen}
        onOpenChange={setResetPasswordOpen}
        user={resetPasswordUser}
        onSuccess={() => {
          // Dialog handles its own state, just close when done
        }}
      />
    </div>
  )
}
