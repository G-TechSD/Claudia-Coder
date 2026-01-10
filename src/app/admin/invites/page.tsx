"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  Send,
  MessageSquare,
  User,
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
  createdByName: string | null
  customMessage: string | null
  emailSent: boolean
  emailSentAt: string | null
  inviterName: string | null
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

const DEFAULT_INVITE_MESSAGE = `You've been invited to join Claudia, an AI-powered development platform that helps you build software faster and smarter.

As a beta tester, you'll get early access to:
- AI-assisted code generation and review
- Intelligent project management
- Automated documentation
- And much more!`

const EXPIRATION_OPTIONS = [
  { value: "1", label: "1 day" },
  { value: "3", label: "3 days" },
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
  { value: "never", label: "Never expires" },
]

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
  const [newInviteExpiryDays, setNewInviteExpiryDays] = React.useState("7")
  const [newInviteMessage, setNewInviteMessage] = React.useState(DEFAULT_INVITE_MESSAGE)
  const [sendEmail, setSendEmail] = React.useState(true)
  const [creating, setCreating] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)
  const [emailConfigured, setEmailConfigured] = React.useState(true)

  const fetchInvites = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/invites")
      if (!res.ok) throw new Error("Failed to fetch invites")
      const data = await res.json()
      setInvites(data.invites)
      setStats(data.stats)
      setEmailConfigured(data.emailConfigured !== false)
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
      // Calculate expiration date
      let expiresAt: string | undefined
      if (newInviteExpiryDays !== "never") {
        const days = parseInt(newInviteExpiryDays, 10)
        const expDate = new Date()
        expDate.setDate(expDate.getDate() + days)
        expiresAt = expDate.toISOString()
      }

      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newInviteEmail || undefined,
          maxUses: parseInt(newInviteMaxUses, 10),
          expiresAt,
          customMessage: newInviteMessage !== DEFAULT_INVITE_MESSAGE ? newInviteMessage : undefined,
          sendEmail: sendEmail && !!newInviteEmail,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to create invite")
      }

      // Reset form and close dialog
      setNewInviteEmail("")
      setNewInviteMaxUses("1")
      setNewInviteExpiryDays("7")
      setNewInviteMessage(DEFAULT_INVITE_MESSAGE)
      setSendEmail(true)
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

  const handleResendEmail = async (invite: Invite) => {
    if (!invite.email) return

    try {
      const res = await fetch(`/api/admin/invites/${invite.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resendEmail: true }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to resend email")
      }

      await fetchInvites()
      alert("Email sent successfully!")
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to resend email")
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
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Beta Invite</DialogTitle>
              <DialogDescription>
                Generate a new invite code. The link will be copied to your clipboard.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateInvite} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="email">Recipient Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={newInviteEmail}
                  onChange={(e) => setNewInviteEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Enter an email to send the invite directly, or leave empty for a generic invite link
                </p>
              </div>

              {/* Custom Message */}
              <div className="space-y-2">
                <Label htmlFor="message">Personal Message</Label>
                <Textarea
                  id="message"
                  placeholder="Add a personal message..."
                  value={newInviteMessage}
                  onChange={(e) => setNewInviteMessage(e.target.value)}
                  rows={5}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  This message will be included in the invitation email
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Max Uses */}
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

                {/* Expiration Days */}
                <div className="space-y-2">
                  <Label htmlFor="expiry">Expires In</Label>
                  <Select
                    value={newInviteExpiryDays}
                    onValueChange={setNewInviteExpiryDays}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select expiration" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPIRATION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Send Email Toggle */}
              {newInviteEmail && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <div className="flex items-center gap-3">
                    <Send className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Send invitation email</p>
                      <p className="text-xs text-muted-foreground">
                        {emailConfigured
                          ? "Automatically send the invite to this email"
                          : "Email not configured - invite link only"}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={sendEmail && emailConfigured}
                    onCheckedChange={setSendEmail}
                    disabled={!emailConfigured}
                  />
                </div>
              )}

              {!emailConfigured && (
                <div className="flex items-center gap-2 text-sm text-yellow-500 bg-yellow-500/10 p-3 rounded-lg">
                  <AlertTriangle className="h-4 w-4 flex-none" />
                  <span>
                    Email not configured. Set RESEND_API_KEY or SMTP variables in .env.local
                  </span>
                </div>
              )}

              {createError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  {createError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
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
                  ) : sendEmail && newInviteEmail && emailConfigured ? (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Create & Send
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
                        {invite.emailSent && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Send className="h-3 w-3" />
                            Sent
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          {invite.usedCount}/{invite.maxUses} uses
                        </span>
                        {invite.inviterName && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {invite.inviterName}
                          </span>
                        )}
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
                      Sent to: {selectedInvite.email}
                    </p>
                  )}
                  {selectedInvite.inviterName && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" />
                      Invited by: {selectedInvite.inviterName}
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

                {/* Custom Message */}
                {selectedInvite.customMessage && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      Custom Message
                    </p>
                    <div className="p-3 rounded-lg bg-muted/50 border-l-2 border-primary">
                      <p className="text-sm whitespace-pre-wrap">
                        {selectedInvite.customMessage}
                      </p>
                    </div>
                  </div>
                )}

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
                    {selectedInvite.emailSent && selectedInvite.emailSentAt && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Email Sent</span>
                        <span className="font-mono text-xs">
                          {formatDate(selectedInvite.emailSentAt)}
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
                  {selectedInvite.email && selectedInvite.status === "pending" && (
                    <Button
                      className="w-full gap-2"
                      variant="outline"
                      onClick={() => handleResendEmail(selectedInvite)}
                    >
                      <Send className="h-4 w-4" />
                      {selectedInvite.emailSent ? "Resend Email" : "Send Email"}
                    </Button>
                  )}
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
