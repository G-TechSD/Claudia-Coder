"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  Settings,
  ChevronRight,
  Code,
  TestTube,
  GitPullRequest,
  Lock,
  Gauge
} from "lucide-react"

type GateStatus = "passed" | "failed" | "warning" | "pending" | "skipped"

interface QualityGate {
  id: string
  name: string
  description: string
  category: "code" | "test" | "security" | "review" | "performance"
  status: GateStatus
  required: boolean
  lastRun: Date | null
  details: {
    passed: number
    failed: number
    warnings: number
  }
  threshold?: string
}

interface GateRun {
  id: string
  gateId: string
  gateName: string
  packetId: string
  status: GateStatus
  timestamp: Date
  duration: number
  message?: string
}

const statusConfig = {
  passed: { label: "Passed", color: "text-green-400", bg: "bg-green-400", icon: CheckCircle },
  failed: { label: "Failed", color: "text-red-400", bg: "bg-red-400", icon: XCircle },
  warning: { label: "Warning", color: "text-yellow-400", bg: "bg-yellow-400", icon: AlertTriangle },
  pending: { label: "Pending", color: "text-muted-foreground", bg: "bg-muted-foreground", icon: Clock },
  skipped: { label: "Skipped", color: "text-muted-foreground", bg: "bg-muted", icon: Clock }
}

const categoryConfig = {
  code: { label: "Code Quality", icon: Code, color: "text-blue-400" },
  test: { label: "Testing", icon: TestTube, color: "text-purple-400" },
  security: { label: "Security", icon: Lock, color: "text-red-400" },
  review: { label: "Review", icon: GitPullRequest, color: "text-yellow-400" },
  performance: { label: "Performance", icon: Gauge, color: "text-cyan-400" }
}

const mockGates: QualityGate[] = [
  {
    id: "gate-1",
    name: "ESLint",
    description: "JavaScript/TypeScript linting with strict rules",
    category: "code",
    status: "passed",
    required: true,
    lastRun: new Date(Date.now() - 300000),
    details: { passed: 156, failed: 0, warnings: 3 },
    threshold: "0 errors, < 10 warnings"
  },
  {
    id: "gate-2",
    name: "TypeScript Strict",
    description: "Type checking with strict mode enabled",
    category: "code",
    status: "passed",
    required: true,
    lastRun: new Date(Date.now() - 300000),
    details: { passed: 89, failed: 0, warnings: 0 },
    threshold: "0 type errors"
  },
  {
    id: "gate-3",
    name: "Unit Tests",
    description: "Jest unit test suite",
    category: "test",
    status: "passed",
    required: true,
    lastRun: new Date(Date.now() - 600000),
    details: { passed: 47, failed: 0, warnings: 0 },
    threshold: "100% pass rate"
  },
  {
    id: "gate-4",
    name: "Integration Tests",
    description: "API and database integration tests",
    category: "test",
    status: "warning",
    required: true,
    lastRun: new Date(Date.now() - 900000),
    details: { passed: 23, failed: 0, warnings: 2 },
    threshold: "100% pass, < 5 flaky"
  },
  {
    id: "gate-5",
    name: "E2E Tests",
    description: "Playwright end-to-end tests",
    category: "test",
    status: "failed",
    required: true,
    lastRun: new Date(Date.now() - 1200000),
    details: { passed: 12, failed: 3, warnings: 0 },
    threshold: "100% pass rate"
  },
  {
    id: "gate-6",
    name: "Dependency Audit",
    description: "npm audit for security vulnerabilities",
    category: "security",
    status: "warning",
    required: true,
    lastRun: new Date(Date.now() - 1800000),
    details: { passed: 145, failed: 0, warnings: 4 },
    threshold: "0 high/critical vulnerabilities"
  },
  {
    id: "gate-7",
    name: "Secret Scanning",
    description: "Detect hardcoded secrets and credentials",
    category: "security",
    status: "passed",
    required: true,
    lastRun: new Date(Date.now() - 1800000),
    details: { passed: 1, failed: 0, warnings: 0 },
    threshold: "0 secrets detected"
  },
  {
    id: "gate-8",
    name: "Code Coverage",
    description: "Test coverage threshold check",
    category: "test",
    status: "passed",
    required: false,
    lastRun: new Date(Date.now() - 600000),
    details: { passed: 1, failed: 0, warnings: 0 },
    threshold: ">= 80% coverage"
  },
  {
    id: "gate-9",
    name: "Bundle Size",
    description: "Check production bundle size limits",
    category: "performance",
    status: "passed",
    required: false,
    lastRun: new Date(Date.now() - 3600000),
    details: { passed: 1, failed: 0, warnings: 0 },
    threshold: "< 500kb gzipped"
  },
  {
    id: "gate-10",
    name: "AI Code Review",
    description: "Claude-powered code review check",
    category: "review",
    status: "pending",
    required: false,
    lastRun: null,
    details: { passed: 0, failed: 0, warnings: 0 },
    threshold: "No critical issues"
  }
]

const mockRuns: GateRun[] = [
  { id: "run-1", gateId: "gate-5", gateName: "E2E Tests", packetId: "PKT-001", status: "failed", timestamp: new Date(Date.now() - 300000), duration: 180, message: "3 tests failed: checkout flow timeout" },
  { id: "run-2", gateId: "gate-3", gateName: "Unit Tests", packetId: "PKT-001", status: "passed", timestamp: new Date(Date.now() - 600000), duration: 45 },
  { id: "run-3", gateId: "gate-1", gateName: "ESLint", packetId: "PKT-002", status: "passed", timestamp: new Date(Date.now() - 900000), duration: 12 },
  { id: "run-4", gateId: "gate-4", gateName: "Integration Tests", packetId: "PKT-002", status: "warning", timestamp: new Date(Date.now() - 1200000), duration: 120, message: "2 flaky tests detected" },
  { id: "run-5", gateId: "gate-6", gateName: "Dependency Audit", packetId: "PKT-003", status: "warning", timestamp: new Date(Date.now() - 1800000), duration: 8, message: "4 moderate vulnerabilities" },
]

function formatTime(date: Date | null): string {
  if (!date) return "Never"
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return date.toLocaleDateString()
}

export default function QualityPage() {
  const [gates] = useState<QualityGate[]>(mockGates)
  const [runs] = useState<GateRun[]>(mockRuns)
  const [selectedGate, setSelectedGate] = useState<QualityGate | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>("all")

  const filteredGates = gates.filter(g =>
    categoryFilter === "all" || g.category === categoryFilter
  )

  const stats = {
    total: gates.length,
    passed: gates.filter(g => g.status === "passed").length,
    failed: gates.filter(g => g.status === "failed").length,
    warnings: gates.filter(g => g.status === "warning").length,
  }

  const overallHealth = stats.failed === 0
    ? stats.warnings === 0 ? "healthy" : "warning"
    : "failing"

  return (
    <div className="flex flex-col gap-6 p-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Quality Gates</h1>
            <p className="text-sm text-muted-foreground">
              Automated quality checks and thresholds
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Run All
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="h-4 w-4" />
            Configure
          </Button>
        </div>
      </div>

      {/* Health Status */}
      <Card className={cn(
        "p-4",
        overallHealth === "healthy" && "border-green-400/50 bg-green-400/5",
        overallHealth === "warning" && "border-yellow-400/50 bg-yellow-400/5",
        overallHealth === "failing" && "border-red-400/50 bg-red-400/5"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className={cn(
              "h-8 w-8",
              overallHealth === "healthy" && "text-green-400",
              overallHealth === "warning" && "text-yellow-400",
              overallHealth === "failing" && "text-red-400"
            )} />
            <div>
              <p className="font-semibold capitalize">
                {overallHealth === "healthy" ? "All Gates Passing" :
                  overallHealth === "warning" ? "Some Warnings" : "Gates Failing"}
              </p>
              <p className="text-sm text-muted-foreground">
                {stats.passed} passed, {stats.failed} failed, {stats.warnings} warnings
              </p>
            </div>
          </div>
          <div className="flex gap-8 text-center">
            {[
              { label: "Total", value: stats.total },
              { label: "Passed", value: stats.passed, color: "text-green-400" },
              { label: "Failed", value: stats.failed, color: "text-red-400" },
              { label: "Warnings", value: stats.warnings, color: "text-yellow-400" },
            ].map(stat => (
              <div key={stat.label}>
                <p className={cn("text-2xl font-semibold", stat.color)}>{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Category Filter */}
      <div className="flex items-center gap-2">
        <Button
          variant={categoryFilter === "all" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setCategoryFilter("all")}
        >
          All
        </Button>
        {Object.entries(categoryConfig).map(([key, config]) => {
          const Icon = config.icon
          return (
            <Button
              key={key}
              variant={categoryFilter === key ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setCategoryFilter(key)}
              className="gap-1.5"
            >
              <Icon className={cn("h-4 w-4", config.color)} />
              {config.label}
            </Button>
          )
        })}
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3 flex-1 min-h-0">
        {/* Gates List */}
        <Card className="lg:col-span-2 flex flex-col min-h-0">
          <CardHeader className="pb-2 flex-none">
            <CardTitle className="text-base font-medium">Quality Gates</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0">
            <div className="divide-y">
              {filteredGates.map(gate => {
                const config = statusConfig[gate.status]
                const catConfig = categoryConfig[gate.category]
                const Icon = config.icon
                const CatIcon = catConfig.icon
                const isSelected = selectedGate?.id === gate.id

                return (
                  <div
                    key={gate.id}
                    onClick={() => setSelectedGate(gate)}
                    className={cn(
                      "flex items-center gap-4 p-4 cursor-pointer transition-colors",
                      isSelected ? "bg-accent" : "hover:bg-accent/50"
                    )}
                  >
                    <div className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      gate.status === "passed" && "bg-green-400/10",
                      gate.status === "failed" && "bg-red-400/10",
                      gate.status === "warning" && "bg-yellow-400/10",
                      gate.status === "pending" && "bg-muted"
                    )}>
                      <Icon className={cn("h-5 w-5", config.color)} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{gate.name}</p>
                        {gate.required && (
                          <Badge variant="outline" className="text-xs">Required</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {gate.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <CatIcon className={cn("h-4 w-4", catConfig.color)} />
                      </div>
                      <div className="text-right min-w-[4rem]">
                        <p className={cn("font-medium", config.color)}>{config.label}</p>
                        <p className="text-xs text-muted-foreground">{formatTime(gate.lastRun)}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Detail Panel */}
        <Card className="flex flex-col min-h-0">
          <CardHeader className="pb-2 flex-none">
            <CardTitle className="text-base font-medium">Gate Details</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {selectedGate ? (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-lg",
                    selectedGate.status === "passed" && "bg-green-400/10",
                    selectedGate.status === "failed" && "bg-red-400/10",
                    selectedGate.status === "warning" && "bg-yellow-400/10",
                    selectedGate.status === "pending" && "bg-muted"
                  )}>
                    {(() => {
                      const Icon = statusConfig[selectedGate.status].icon
                      return <Icon className={cn("h-6 w-6", statusConfig[selectedGate.status].color)} />
                    })()}
                  </div>
                  <div>
                    <h3 className="font-semibold">{selectedGate.name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedGate.description}</p>
                  </div>
                </div>

                {/* Status */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 rounded-lg bg-green-400/10">
                    <p className="text-lg font-semibold text-green-400">{selectedGate.details.passed}</p>
                    <p className="text-xs text-muted-foreground">Passed</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-red-400/10">
                    <p className="text-lg font-semibold text-red-400">{selectedGate.details.failed}</p>
                    <p className="text-xs text-muted-foreground">Failed</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-yellow-400/10">
                    <p className="text-lg font-semibold text-yellow-400">{selectedGate.details.warnings}</p>
                    <p className="text-xs text-muted-foreground">Warnings</p>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Threshold</p>
                    <p className="text-sm font-medium">{selectedGate.threshold}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Category</p>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const CatIcon = categoryConfig[selectedGate.category].icon
                        return <CatIcon className={cn("h-4 w-4", categoryConfig[selectedGate.category].color)} />
                      })()}
                      <span className="text-sm font-medium">{categoryConfig[selectedGate.category].label}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Last Run</p>
                    <p className="text-sm font-mono">{selectedGate.lastRun?.toLocaleString() || "Never"}</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Required</span>
                    <Badge variant={selectedGate.required ? "default" : "secondary"}>
                      {selectedGate.required ? "Yes" : "No"}
                    </Badge>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-4">
                  <Button className="w-full gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Run Gate
                  </Button>
                  <Button variant="outline" className="w-full gap-2">
                    <Settings className="h-4 w-4" />
                    Configure
                  </Button>
                  <Button variant="ghost" className="w-full">
                    View History
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Shield className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-sm">Select a gate</p>
                <p className="text-xs mt-1">to view details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Runs */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Recent Gate Runs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {runs.map(run => {
              const config = statusConfig[run.status]
              const Icon = config.icon
              return (
                <div
                  key={run.id}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-accent/50 transition-colors"
                >
                  <Icon className={cn("h-4 w-4", config.color)} />
                  <Badge variant="outline" className="font-mono text-xs">{run.packetId}</Badge>
                  <span className="font-medium text-sm">{run.gateName}</span>
                  {run.message && (
                    <span className="text-sm text-muted-foreground truncate flex-1">{run.message}</span>
                  )}
                  <span className="text-xs text-muted-foreground">{run.duration}s</span>
                  <span className="text-xs text-muted-foreground">{formatTime(run.timestamp)}</span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
