"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  DollarSign,
  GitPullRequest,
  Shield,
  Zap,
  MessageSquare,
  ChevronRight,
  User,
  Calendar
} from "lucide-react"

type ApprovalStatus = "pending" | "approved" | "rejected" | "expired"
type ApprovalType = "cost" | "deploy" | "security" | "manual" | "quality"

interface Approval {
  id: string
  type: ApprovalType
  title: string
  description: string
  status: ApprovalStatus
  packetId: string
  requestedBy: string
  requestedAt: Date
  respondedAt?: Date
  respondedBy?: string
  expiresAt?: Date
  details: Record<string, string | number>
  urgency: "high" | "normal" | "low"
}

const statusConfig = {
  pending: { label: "Pending", color: "text-yellow-400", bg: "bg-yellow-400", icon: Clock },
  approved: { label: "Approved", color: "text-green-400", bg: "bg-green-400", icon: CheckCircle },
  rejected: { label: "Rejected", color: "text-red-400", bg: "bg-red-400", icon: XCircle },
  expired: { label: "Expired", color: "text-muted-foreground", bg: "bg-muted-foreground", icon: Clock }
}

const typeConfig = {
  cost: { label: "Cost Approval", icon: DollarSign, color: "text-green-400" },
  deploy: { label: "Deployment", icon: Zap, color: "text-blue-400" },
  security: { label: "Security", icon: Shield, color: "text-red-400" },
  manual: { label: "Manual Step", icon: User, color: "text-purple-400" },
  quality: { label: "Quality Gate", icon: GitPullRequest, color: "text-yellow-400" }
}

const mockApprovals: Approval[] = [
  {
    id: "apr-1",
    type: "cost",
    title: "GPU allocation for model training",
    description: "Request to allocate additional GPU resources for parallel model inference",
    status: "pending",
    packetId: "PKT-001",
    requestedBy: "BEAST",
    requestedAt: new Date(Date.now() - 1800000),
    expiresAt: new Date(Date.now() + 7200000),
    details: {
      "Estimated Cost": "$4.50",
      "Duration": "2 hours",
      "GPU Type": "RTX 4090",
      "Reason": "Parallel code generation"
    },
    urgency: "high"
  },
  {
    id: "apr-2",
    type: "deploy",
    title: "Deploy to production environment",
    description: "Ready to deploy v2.1.4 to production after all tests passed",
    status: "pending",
    packetId: "PKT-005",
    requestedBy: "n8n",
    requestedAt: new Date(Date.now() - 3600000),
    details: {
      "Version": "2.1.4",
      "Changes": "12 files",
      "Tests": "47/47 passed",
      "Coverage": "84%"
    },
    urgency: "normal"
  },
  {
    id: "apr-3",
    type: "security",
    title: "External API integration",
    description: "Adding new third-party payment processor API",
    status: "pending",
    packetId: "PKT-003",
    requestedBy: "Claude",
    requestedAt: new Date(Date.now() - 7200000),
    expiresAt: new Date(Date.now() + 86400000),
    details: {
      "API Provider": "Stripe",
      "Scopes": "payments:write",
      "Data Exposed": "customer_id, amount"
    },
    urgency: "high"
  },
  {
    id: "apr-4",
    type: "manual",
    title: "Review generated UI components",
    description: "Human review requested for AI-generated dashboard components",
    status: "pending",
    packetId: "PKT-002",
    requestedBy: "BEDROOM",
    requestedAt: new Date(Date.now() - 10800000),
    details: {
      "Components": "5",
      "Lines of Code": "842",
      "Complexity": "Medium"
    },
    urgency: "low"
  },
  {
    id: "apr-5",
    type: "cost",
    title: "Claude API budget extension",
    description: "Daily budget exhausted, requesting additional allocation",
    status: "approved",
    packetId: "PKT-004",
    requestedBy: "n8n",
    requestedAt: new Date(Date.now() - 86400000),
    respondedAt: new Date(Date.now() - 82800000),
    respondedBy: "Admin",
    details: {
      "Current Spent": "$25.00",
      "Requested": "$10.00",
      "New Budget": "$35.00"
    },
    urgency: "high"
  },
  {
    id: "apr-6",
    type: "deploy",
    title: "Rollback to v2.1.2",
    description: "Critical bug detected in production",
    status: "approved",
    packetId: "PKT-006",
    requestedBy: "n8n",
    requestedAt: new Date(Date.now() - 172800000),
    respondedAt: new Date(Date.now() - 172200000),
    respondedBy: "Admin",
    details: {
      "Current Version": "2.1.3",
      "Target Version": "2.1.2",
      "Reason": "Payment processing error"
    },
    urgency: "high"
  },
  {
    id: "apr-7",
    type: "quality",
    title: "Skip E2E tests for hotfix",
    description: "Request to bypass E2E tests for urgent production fix",
    status: "rejected",
    packetId: "PKT-007",
    requestedBy: "BEAST",
    requestedAt: new Date(Date.now() - 259200000),
    respondedAt: new Date(Date.now() - 255600000),
    respondedBy: "Admin",
    details: {
      "Gate": "E2E Tests",
      "Reason": "Urgent hotfix",
      "Risk": "Medium"
    },
    urgency: "normal"
  }
]

function formatTime(date: Date): string {
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatTimeUntil(date: Date): string {
  const diff = date.getTime() - Date.now()
  if (diff < 0) return "Expired"
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return `${Math.floor(diff / 60000)}m left`
  if (hours < 24) return `${hours}h left`
  return `${Math.floor(hours / 24)}d left`
}

export default function ApprovalsPage() {
  const [approvals] = useState<Approval[]>(mockApprovals)
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null)
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | "all">("pending")

  const filteredApprovals = approvals.filter(a =>
    statusFilter === "all" || a.status === statusFilter
  )

  const pendingCount = approvals.filter(a => a.status === "pending").length
  const urgentCount = approvals.filter(a => a.status === "pending" && a.urgency === "high").length

  return (
    <div className="flex flex-col gap-6 p-6 h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Approvals</h1>
          <p className="text-sm text-muted-foreground">
            Human-in-the-loop approval requests
          </p>
        </div>
        {urgentCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-400/10 text-red-400 shrink-0">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="text-xs sm:text-sm font-medium">{urgentCount} urgent{urgentCount !== 1 ? 's' : ''} waiting</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {(["pending", "approved", "rejected", "expired"] as const).map(status => {
          const config = statusConfig[status]
          const count = approvals.filter(a => a.status === status).length
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? "all" : status)}
              className={cn(
                "p-3 sm:p-4 rounded-lg border text-left transition-colors",
                statusFilter === status ? "border-primary bg-accent" : "hover:bg-accent/50"
              )}
            >
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <config.icon className={cn("h-4 w-4 sm:h-5 sm:w-5", config.color)} />
                <span className={cn("text-xl sm:text-2xl font-semibold", config.color)}>{count}</span>
              </div>
              <p className="text-xs sm:text-sm font-medium capitalize">{status}</p>
            </button>
          )
        })}
      </div>

      {/* Main Content */}
      <div className="grid gap-6 md:grid-cols-5 flex-1 min-h-0">
        {/* Approvals List */}
        <Card className="md:col-span-3 flex flex-col min-h-0">
          <CardHeader className="pb-2 flex-none">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">
                {statusFilter === "all" ? "All Requests" : `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Requests`}
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                {filteredApprovals.length} items
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0">
            <div className="divide-y">
              {filteredApprovals.map(approval => {
                const config = statusConfig[approval.status]
                const typeConf = typeConfig[approval.type]
                const Icon = config.icon
                const TypeIcon = typeConf.icon
                const isSelected = selectedApproval?.id === approval.id

                return (
                  <div
                    key={approval.id}
                    onClick={() => setSelectedApproval(approval)}
                    className={cn(
                      "flex items-start gap-4 p-4 cursor-pointer transition-colors",
                      isSelected ? "bg-accent" : "hover:bg-accent/50"
                    )}
                  >
                    <div className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg flex-none",
                      approval.urgency === "high" ? "bg-red-400/10" : "bg-muted"
                    )}>
                      <TypeIcon className={cn("h-5 w-5", typeConf.color)} />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {approval.packetId}
                        </Badge>
                        {approval.urgency === "high" && (
                          <Badge variant="destructive" className="text-xs px-1.5 py-0">
                            Urgent
                          </Badge>
                        )}
                      </div>
                      <p className="font-medium truncate">{approval.title}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {approval.requestedBy}
                        </span>
                        <span>{formatTime(approval.requestedAt)}</span>
                        {approval.status === "pending" && approval.expiresAt && (
                          <span className={cn(
                            approval.expiresAt.getTime() - Date.now() < 3600000 ? "text-red-400" : ""
                          )}>
                            {formatTimeUntil(approval.expiresAt)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-none">
                      <Badge className={cn(
                        "text-xs",
                        config.bg.replace('bg-', 'bg-') + "/10",
                        config.color
                      )}>
                        {config.label}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                )
              })}

              {filteredApprovals.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-sm">No {statusFilter} approvals</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Detail Panel */}
        <Card className="md:col-span-2 flex flex-col min-h-0">
          <CardHeader className="pb-2 flex-none">
            <CardTitle className="text-base font-medium">Request Details</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {selectedApproval ? (
              <div className="space-y-6">
                {/* Header */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      {selectedApproval.packetId}
                    </Badge>
                    <Badge className={cn(typeConfig[selectedApproval.type].color, "bg-current/10")}>
                      {typeConfig[selectedApproval.type].label}
                    </Badge>
                    {selectedApproval.urgency === "high" && (
                      <Badge variant="destructive">Urgent</Badge>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold">{selectedApproval.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedApproval.description}
                  </p>
                </div>

                {/* Status */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant={
                    selectedApproval.status === "approved" ? "success" :
                    selectedApproval.status === "rejected" ? "destructive" :
                    selectedApproval.status === "pending" ? "warning" : "secondary"
                  }>
                    {statusConfig[selectedApproval.status].label}
                  </Badge>
                </div>

                {/* Details */}
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Details</p>
                  <div className="space-y-2">
                    {Object.entries(selectedApproval.details).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{key}</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Timestamps */}
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Timeline</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Requested by</span>
                      <span className="font-medium">{selectedApproval.requestedBy}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Requested at</span>
                      <span className="font-mono text-xs">
                        {selectedApproval.requestedAt.toLocaleString()}
                      </span>
                    </div>
                    {selectedApproval.expiresAt && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Expires</span>
                        <span className={cn(
                          "font-mono text-xs",
                          selectedApproval.expiresAt.getTime() - Date.now() < 3600000 ? "text-red-400" : ""
                        )}>
                          {selectedApproval.expiresAt.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {selectedApproval.respondedAt && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Responded at</span>
                          <span className="font-mono text-xs">
                            {selectedApproval.respondedAt.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Responded by</span>
                          <span className="font-medium">{selectedApproval.respondedBy}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {selectedApproval.status === "pending" && (
                  <div className="space-y-2 pt-4">
                    <Button className="w-full gap-2 bg-green-600 hover:bg-green-700">
                      <CheckCircle className="h-4 w-4" />
                      Approve
                    </Button>
                    <Button variant="destructive" className="w-full gap-2">
                      <XCircle className="h-4 w-4" />
                      Reject
                    </Button>
                    <Button variant="outline" className="w-full gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Request More Info
                    </Button>
                  </div>
                )}

                {selectedApproval.status !== "pending" && (
                  <div className="pt-4">
                    <Button variant="outline" className="w-full">
                      View Full History
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Clock className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-sm">Select a request</p>
                <p className="text-xs mt-1">to view details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
