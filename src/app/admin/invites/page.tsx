"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  Plus,
  Copy,
  XCircle,
  CheckCircle,
  Clock,
  Loader2,
  Mail,
  Users,
  AlertTriangle,
  Check,
  Link as LinkIcon,
} from "lucide-react"

interface InviteUsage {
  userId: string
  userName: string
  userEmail: string
  usedAt: string
}

interface Invite {
  id: string
  code: string
  email: string | null
  maxUses: number
  usedCount: number
  expiresAt: string | null
  status: "pending" | "used" | "expired" | "revoked"
  createdBy: string
  createdAt: string
  updatedAt: string
  usages: InviteUsage[]
}

interface InviteStats {
  total: number
  pending: number
  used: number
  expired: number
  revoked: number
  totalCapacity: number
  usedCapacity: number
  remainingCapacity: number
}

const statusConfig = {
  pending: { label: "Pending", color: "text-yellow-400", bg: "bg-yellow-500/20", icon: Clock },
  used: { label: "Used", color: "text-green-400", bg: "bg-green-500/20", icon: CheckCircle },
  expired: { label: "Expired", color: "text-muted-foreground", bg: "bg-muted", icon: Clock },
  revoked: { label: "Revoked", color: "text-red-400", bg: "bg-red-500/20", icon: XCircle },
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

  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days} days ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export default function InvitesPage() {
  const [invites, setInvites] = React.useState<Invite[]>([])
  const [stats, setStats] = React.useState<InviteStats | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [selectedInvite, setSelectedInvite] = React.useState<Invite | null>(null)
  const [copiedId, setCopiedId] = React.useState<string | null>(null)
  const [statusFilter, setStatusFilter] = React.useState<string>("all")

  // Create invite form state
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)
  const [newInviteEmail, setNewInviteEmail] = React.useState("")
  const [newInviteMaxUses, setNewInviteMaxUses] = React.useState("1")
  const [newInviteExpiry, setNewInviteExpiry] = React.useState("")
  const [creating, setCreating] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)

  const fetchInvites = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/invites")
      if (!res.ok) throw new Error("Failed to fetch invites")
      const data = await res.json()
      setInvites(data.invites)
      setStats(data.stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invites")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchInvites()
  }, [fetchInvites])

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)

    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newInviteEmail || undefined,
          maxUses: parseInt(newInviteMaxUses, 10),
          expiresAt: newInviteExpiry || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to create invite")
      }

      // Reset form and close dialog
      setNewInviteEmail("")
      setNewInviteMaxUses("1")
      setNewInviteExpiry("")
      setCreateDialogOpen(false)

      // Refresh invites list
      await fetchInvites()

      // Copy the invite link to clipboard
      await navigator.clipboard.writeText(data.inviteLink)
      setCopiedId(data.invite.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create invite")
    } finally {
      setCreating(false)
    }
  }

  const handleRevokeInvite = async (inviteId: string) => {
    if (!confirm("Are you sure you want to revoke this invite?")) return

    try {
      const res = await fetch(`/api/admin/invites/${inviteId}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to revoke invite")
      }

      await fetchInvites()
      if (selectedInvite?.id === inviteId) {
        setSelectedInvite(null)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to revoke invite")
    }
  }

  const copyInviteLink = async (invite: Invite) => {
    const link = `${window.location.origin}/auth/register?invite=${invite.code}`
    await navigator.clipboard.writeText(link)
    setCopiedId(invite.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const filteredInvites = invites.filter(
    (invite) => statusFilter === "all" || invite.status === statusFilter
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
        <p className="text-lg font-medium">Failed to load invites</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Beta Invites</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage beta invite codes
          </p>
        </div>
        <Button className="gap-2" onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Create Invite
        </Button>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Beta Invite</DialogTitle>
              <DialogDescription>
                Generate a new invite code. The link will be copied to your clipboard.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateInvite} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email (optional)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Restrict to specific email"
                  value={newInviteEmail}
                  onChange={(e) => setNewInviteEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to allow any email
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxUses">Max Uses</Label>
                <Input
                  id="maxUses"
                  type="number"
                  min="1"
                  max="100"
                  value={newInviteMaxUses}
                  onChange={(e) => setNewInviteMaxUses(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiry">Expiry Date (optional)</Label>
                <Input
                  id="expiry"
                  type="datetime-local"
                  value={newInviteExpiry}
                  onChange={(e) => setNewInviteExpiry(e.target.value)}
                />
              </div>
              {createError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  {createError}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create & Copy Link"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(["pending", "used", "expired", "revoked"] as const).map((status) => {
            const config = statusConfig[status]
            const count = stats[status]
            return (
              <button
                key={status}
                onClick={() =>
                  setStatusFilter(statusFilter === status ? "all" : status)
                }
                className={cn(
                  "p-3 rounded-lg border text-left transition-colors",
                  statusFilter === status
                    ? "border-primary bg-accent"
                    : "hover:bg-accent/50"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <config.icon className={cn("h-4 w-4", config.color)} />
                  <span className={cn("text-xl font-semibold", config.color)}>
                    {count}
                  </span>
                </div>
                <p className="text-xs font-medium capitalize">{status}</p>
              </button>
            )
          })}
        </div>
      )}

      {/* Capacity Stats */}
      {stats && (
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Total Invites:</span>
            <span className="font-medium">{stats.total}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Total Capacity:</span>
            <span className="font-medium">{stats.totalCapacity}</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-400" />
            <span className="text-muted-foreground">Used:</span>
            <span className="font-medium">{stats.usedCapacity}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-400" />
            <span className="text-muted-foreground">Remaining:</span>
            <span className="font-medium">{stats.remainingCapacity}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-5 flex-1 min-h-0">
        {/* Invites List */}
        <Card className="lg:col-span-3 flex flex-col min-h-0">
          <CardHeader className="pb-2 flex-none">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">
                {statusFilter === "all"
                  ? "All Invites"
                  : `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Invites`}
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                {filteredInvites.length} items
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0">
            <div className="divide-y">
              {filteredInvites.map((invite) => {
                const config = statusConfig[invite.status]
                const Icon = config.icon
                const isSelected = selectedInvite?.id === invite.id

                return (
                  <div
                    key={invite.id}
                    onClick={() => setSelectedInvite(invite)}
                    className={cn(
                      "flex items-center gap-4 p-4 cursor-pointer transition-colors",
                      isSelected ? "bg-accent" : "hover:bg-accent/50"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg flex-none",
                        config.bg
                      )}
                    >
                      <Icon className={cn("h-5 w-5", config.color)} />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-sm font-medium">
                          {invite.code}
                        </code>
                        {invite.email && (
                          <Badge variant="outline" className="text-xs">
                            {invite.email}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          {invite.usedCount}/{invite.maxUses} uses
                        </span>
                        <span>{formatDateShort(invite.createdAt)}</span>
                        {invite.expiresAt && (
                          <span
                            className={cn(
                              new Date(invite.expiresAt) < new Date()
                                ? "text-red-400"
                                : ""
                            )}
                          >
                            Expires: {formatDateShort(invite.expiresAt)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-none">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation()
                          copyInviteLink(invite)
                        }}
                        disabled={invite.status === "revoked"}
                      >
                        {copiedId === invite.id ? (
                          <Check className="h-4 w-4 text-green-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )
              })}

              {filteredInvites.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Mail className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-sm">No invites found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Detail Panel */}
        <Card className="lg:col-span-2 flex flex-col min-h-0">
          <CardHeader className="pb-2 flex-none">
            <CardTitle className="text-base font-medium">Invite Details</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {selectedInvite ? (
              <div className="space-y-6">
                {/* Header */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-lg font-semibold">
                      {selectedInvite.code}
                    </code>
                    <Badge
                      className={cn(
                        statusConfig[selectedInvite.status].bg,
                        statusConfig[selectedInvite.status].color
                      )}
                    >
                      {statusConfig[selectedInvite.status].label}
                    </Badge>
                  </div>
                  {selectedInvite.email && (
                    <p className="text-sm text-muted-foreground">
                      Restricted to: {selectedInvite.email}
                    </p>
                  )}
                </div>

                {/* Usage Stats */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <span className="text-sm text-muted-foreground">Usage</span>
                  <span className="font-medium">
                    {selectedInvite.usedCount} / {selectedInvite.maxUses}
                  </span>
                </div>

                {/* Details */}
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Details
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Created</span>
                      <span className="font-mono text-xs">
                        {formatDate(selectedInvite.createdAt)}
                      </span>
                    </div>
                    {selectedInvite.expiresAt && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Expires</span>
                        <span
                          className={cn(
                            "font-mono text-xs",
                            new Date(selectedInvite.expiresAt) < new Date()
                              ? "text-red-400"
                              : ""
                          )}
                        >
                          {formatDate(selectedInvite.expiresAt)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Users who used this invite */}
                {selectedInvite.usages.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">
                      Used By
                    </p>
                    <div className="space-y-2">
                      {selectedInvite.usages.map((usage) => (
                        <div
                          key={usage.userId}
                          className="flex items-center justify-between p-2 rounded bg-muted/50"
                        >
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                              {usage.userName?.[0]?.toUpperCase() || "U"}
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {usage.userName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {usage.userEmail}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDateShort(usage.usedAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-2 pt-4">
                  <Button
                    className="w-full gap-2"
                    variant="outline"
                    onClick={() => copyInviteLink(selectedInvite)}
                    disabled={selectedInvite.status === "revoked"}
                  >
                    {copiedId === selectedInvite.id ? (
                      <>
                        <Check className="h-4 w-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <LinkIcon className="h-4 w-4" />
                        Copy Invite Link
                      </>
                    )}
                  </Button>
                  {selectedInvite.status !== "revoked" && (
                    <Button
                      className="w-full gap-2"
                      variant="destructive"
                      onClick={() => handleRevokeInvite(selectedInvite.id)}
                    >
                      <XCircle className="h-4 w-4" />
                      Revoke Invite
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Mail className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-sm">Select an invite</p>
                <p className="text-xs mt-1">to view details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
