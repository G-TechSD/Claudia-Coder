"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  Briefcase,
  DollarSign,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Mail,
  Loader2,
  AlertCircle,
  TrendingUp,
  ArrowRight,
  Calendar,
  FileText,
} from "lucide-react"

// ============ Types ============

type ReferralStatus = "pending" | "contacted" | "consultation_scheduled" | "converted" | "declined" | "expired"
type CommissionStatus = "pending" | "earned" | "paid"

interface Referral {
  id: string
  userId: string
  patentId: string
  attorneyId: string
  status: ReferralStatus
  commissionRate: number
  commissionAmount?: number
  commissionStatus: CommissionStatus
  referredAt: string
  contactedAt?: string
  convertedAt?: string
  paidAt?: string
  notes?: string
  attorneyName: string
  attorneyFirm: string
}

interface Attorney {
  id: string
  name: string
  firm: string
  specialty: string[]
  location: string
  rating: number
  commissionRate: number
  active: boolean
}

interface ReferralStats {
  total: number
  byStatus: Record<ReferralStatus, number>
  pendingCommissions: number
  earnedCommissions: number
  paidCommissions: number
  totalCommissionValue: number
}

// ============ Status Configuration ============

const statusConfig = {
  pending: { label: "Pending", color: "text-yellow-400", bg: "bg-yellow-500/20", icon: Clock },
  contacted: { label: "Contacted", color: "text-blue-400", bg: "bg-blue-500/20", icon: Mail },
  consultation_scheduled: { label: "Scheduled", color: "text-purple-400", bg: "bg-purple-500/20", icon: Calendar },
  converted: { label: "Converted", color: "text-green-400", bg: "bg-green-500/20", icon: CheckCircle },
  declined: { label: "Declined", color: "text-red-400", bg: "bg-red-500/20", icon: XCircle },
  expired: { label: "Expired", color: "text-muted-foreground", bg: "bg-muted", icon: Clock },
}

const commissionStatusConfig = {
  pending: { label: "Pending", color: "text-yellow-400", bg: "bg-yellow-500/20" },
  earned: { label: "Earned", color: "text-blue-400", bg: "bg-blue-500/20" },
  paid: { label: "Paid", color: "text-green-400", bg: "bg-green-500/20" },
}

// ============ Helper Functions ============

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

// ============ Component ============

export default function AdminReferralsPage() {
  // State
  const [referrals, setReferrals] = React.useState<Referral[]>([])
  const [stats, setStats] = React.useState<ReferralStats | null>(null)
  const [attorneys, setAttorneys] = React.useState<Attorney[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [commissionFilter, setCommissionFilter] = React.useState<string>("all")

  // Selected referral
  const [selectedReferral, setSelectedReferral] = React.useState<Referral | null>(null)

  // Action dialogs
  const [updateStatusDialogOpen, setUpdateStatusDialogOpen] = React.useState(false)
  const [commissionDialogOpen, setCommissionDialogOpen] = React.useState(false)
  const [newStatus, setNewStatus] = React.useState<ReferralStatus>("pending")
  const [serviceAmount, setServiceAmount] = React.useState("")
  const [updating, setUpdating] = React.useState(false)
  const [updateError, setUpdateError] = React.useState<string | null>(null)

  // Fetch referrals
  const fetchReferrals = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/referrals")
      if (!res.ok) throw new Error("Failed to fetch referrals")

      const data = await res.json()
      setReferrals(data.referrals)
      setStats(data.stats)
      setAttorneys(data.attorneys)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load referrals")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchReferrals()
  }, [fetchReferrals])

  // Filter referrals
  const filteredReferrals = React.useMemo(() => {
    let filtered = referrals

    if (statusFilter !== "all") {
      filtered = filtered.filter((r) => r.status === statusFilter)
    }

    if (commissionFilter !== "all") {
      filtered = filtered.filter((r) => r.commissionStatus === commissionFilter)
    }

    return filtered
  }, [referrals, statusFilter, commissionFilter])

  // Handle status update
  const handleUpdateStatus = async () => {
    if (!selectedReferral) return

    setUpdating(true)
    setUpdateError(null)

    try {
      const res = await fetch("/api/admin/referrals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referralId: selectedReferral.id,
          action: "update_status",
          status: newStatus,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update status")

      setUpdateStatusDialogOpen(false)
      await fetchReferrals()
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : "Failed to update status")
    } finally {
      setUpdating(false)
    }
  }

  // Handle commission calculation
  const handleCalculateCommission = async () => {
    if (!selectedReferral) return

    const amount = parseFloat(serviceAmount)
    if (isNaN(amount) || amount <= 0) {
      setUpdateError("Please enter a valid service amount")
      return
    }

    setUpdating(true)
    setUpdateError(null)

    try {
      const res = await fetch("/api/admin/referrals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referralId: selectedReferral.id,
          action: "calculate_commission",
          serviceAmount: amount,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to calculate commission")

      setCommissionDialogOpen(false)
      setServiceAmount("")
      await fetchReferrals()
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : "Failed to calculate commission")
    } finally {
      setUpdating(false)
    }
  }

  // Handle mark as paid
  const handleMarkPaid = async (referralId: string) => {
    try {
      const res = await fetch("/api/admin/referrals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referralId,
          action: "mark_paid",
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to mark as paid")

      await fetchReferrals()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to mark as paid")
    }
  }

  // Open dialogs
  const openUpdateStatusDialog = (referral: Referral) => {
    setSelectedReferral(referral)
    setNewStatus(referral.status)
    setUpdateError(null)
    setUpdateStatusDialogOpen(true)
  }

  const openCommissionDialog = (referral: Referral) => {
    setSelectedReferral(referral)
    setServiceAmount("")
    setUpdateError(null)
    setCommissionDialogOpen(true)
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
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg font-medium">Failed to load referrals</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 h-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Referral Management</h1>
        <p className="text-sm text-muted-foreground">
          Track attorney referrals and manage commissions
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                {stats.byStatus.converted} converted
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Commissions</CardTitle>
              <Clock className="h-4 w-4 text-yellow-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.pendingCommissions)}</div>
              <p className="text-xs text-muted-foreground">
                Awaiting conversion
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Earned Commissions</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.earnedCommissions)}</div>
              <p className="text-xs text-muted-foreground">
                Ready to pay
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Paid Commissions</CardTitle>
              <DollarSign className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.paidCommissions)}</div>
              <p className="text-xs text-muted-foreground">
                Total paid out
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Status Stats */}
      {stats && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {(Object.keys(statusConfig) as ReferralStatus[]).map((status) => {
            const config = statusConfig[status]
            const Icon = config.icon
            const count = stats.byStatus[status]
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
                  <Icon className={cn("h-4 w-4", config.color)} />
                  <span className={cn("text-xl font-semibold", config.color)}>
                    {count}
                  </span>
                </div>
                <p className="text-xs font-medium">{config.label}</p>
              </button>
            )
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <Label className="text-xs">Commission Status</Label>
          <Select value={commissionFilter} onValueChange={setCommissionFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="earned">Earned</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Referrals List */}
      <Card className="flex-1 min-h-0">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-medium">Referrals</CardTitle>
              <CardDescription>{filteredReferrals.length} referrals</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-auto">
          <div className="space-y-3">
            {filteredReferrals.map((referral) => {
              const config = statusConfig[referral.status]
              const Icon = config.icon
              const commConfig = commissionStatusConfig[referral.commissionStatus]

              return (
                <div
                  key={referral.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={cn("p-2 rounded-lg", config.bg)}>
                      <Icon className={cn("h-5 w-5", config.color)} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{referral.attorneyName}</p>
                        <Badge className={cn(config.bg, config.color, "text-xs")}>
                          {config.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{referral.attorneyFirm}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          Patent: {referral.patentId.slice(0, 8)}...
                        </span>
                        <span>{formatDate(referral.referredAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Commission Info */}
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {referral.commissionAmount
                            ? formatCurrency(referral.commissionAmount)
                            : `${referral.commissionRate}%`}
                        </span>
                        <Badge className={cn(commConfig.bg, commConfig.color, "text-xs")}>
                          {commConfig.label}
                        </Badge>
                      </div>
                      {referral.paidAt && (
                        <p className="text-xs text-muted-foreground">
                          Paid: {formatDate(referral.paidAt)}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openUpdateStatusDialog(referral)}
                      >
                        Status
                      </Button>
                      {referral.status === "converted" && !referral.commissionAmount && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openCommissionDialog(referral)}
                        >
                          Calculate
                        </Button>
                      )}
                      {referral.commissionStatus === "earned" && referral.commissionAmount && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleMarkPaid(referral.id)}
                        >
                          Mark Paid
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {filteredReferrals.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Briefcase className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-sm">No referrals found</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Update Status Dialog */}
      <Dialog open={updateStatusDialogOpen} onOpenChange={setUpdateStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Referral Status</DialogTitle>
            <DialogDescription>
              Update the status for {selectedReferral?.attorneyName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>New Status</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as ReferralStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(statusConfig) as ReferralStatus[]).map((status) => (
                    <SelectItem key={status} value={status}>
                      <div className="flex items-center gap-2">
                        {React.createElement(statusConfig[status].icon, {
                          className: cn("h-4 w-4", statusConfig[status].color),
                        })}
                        {statusConfig[status].label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {newStatus === "converted" && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 text-green-400 text-sm">
                <ArrowRight className="h-4 w-4" />
                Setting to &quot;Converted&quot; will mark the commission as earned
              </div>
            )}

            {updateError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {updateError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setUpdateStatusDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleUpdateStatus} disabled={updating}>
                {updating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Status"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Calculate Commission Dialog */}
      <Dialog open={commissionDialogOpen} onOpenChange={setCommissionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Calculate Commission</DialogTitle>
            <DialogDescription>
              Enter the service amount to calculate the {selectedReferral?.commissionRate}% commission
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="serviceAmount">Service Amount ($)</Label>
              <Input
                id="serviceAmount"
                type="number"
                min="0"
                step="0.01"
                placeholder="Enter the total service amount..."
                value={serviceAmount}
                onChange={(e) => setServiceAmount(e.target.value)}
              />
            </div>

            {serviceAmount && parseFloat(serviceAmount) > 0 && selectedReferral && (
              <div className="p-4 rounded-lg bg-muted">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Service Amount:</span>
                  <span>{formatCurrency(parseFloat(serviceAmount))}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Commission Rate:</span>
                  <span>{selectedReferral.commissionRate}%</span>
                </div>
                <div className="flex justify-between text-base font-semibold mt-2 pt-2 border-t">
                  <span>Commission:</span>
                  <span className="text-green-400">
                    {formatCurrency(
                      (parseFloat(serviceAmount) * selectedReferral.commissionRate) / 100
                    )}
                  </span>
                </div>
              </div>
            )}

            {updateError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {updateError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setCommissionDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleCalculateCommission} disabled={updating}>
                {updating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  "Set Commission"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
