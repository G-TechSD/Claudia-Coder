"use client"

import { useState, useEffect, useCallback } from "react"
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
  Gauge,
  Trash2
} from "lucide-react"
import {
  loadQualityGates,
  loadQualityRuns,
  resetQualityGates,
  type QualityGate,
  type QualityGateRun
} from "@/lib/quality-gates/store"


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

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "Never"
  const date = new Date(dateStr)
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return date.toLocaleDateString()
}

export default function QualityPage() {
  // Initialize state with data from localStorage (runs synchronously on first render)
  const [gates, setGates] = useState<QualityGate[]>(() => {
    if (typeof window === "undefined") return []
    return loadQualityGates()
  })
  const [runs, setRuns] = useState<QualityGateRun[]>(() => {
    if (typeof window === "undefined") return []
    return loadQualityRuns().slice().reverse()
  })
  const [selectedGate, setSelectedGate] = useState<QualityGate | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(false)

  // Set up refresh interval for live updates
  useEffect(() => {
    const interval = setInterval(() => {
      const updatedGates = loadQualityGates()
      const updatedRuns = loadQualityRuns()
      setGates(updatedGates)
      setRuns(updatedRuns.slice().reverse())
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = useCallback(() => {
    setIsLoading(true)
    // Use setTimeout to show loading state briefly
    setTimeout(() => {
      const storedGates = loadQualityGates()
      const storedRuns = loadQualityRuns()
      setGates(storedGates)
      setRuns(storedRuns.slice().reverse())
      setIsLoading(false)
    }, 100)
  }, [])

  const handleReset = useCallback(() => {
    if (confirm("Reset all quality gate data? This will clear all history.")) {
      resetQualityGates()
      const storedGates = loadQualityGates()
      const storedRuns = loadQualityRuns()
      setGates(storedGates)
      setRuns(storedRuns.slice().reverse())
    }
  }, [])

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
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleReset}
          >
            <Trash2 className="h-4 w-4" />
            Reset
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shield className={cn(
              "h-8 w-8 shrink-0",
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
          <div className="grid grid-cols-4 gap-4 sm:gap-6 md:gap-8 text-center w-full sm:w-auto">
            {[
              { label: "Total", value: stats.total },
              { label: "Passed", value: stats.passed, color: "text-green-400" },
              { label: "Failed", value: stats.failed, color: "text-red-400" },
              { label: "Warnings", value: stats.warnings, color: "text-yellow-400" },
            ].map(stat => (
              <div key={stat.label}>
                <p className={cn("text-xl sm:text-2xl font-semibold", stat.color)}>{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Category Filter */}
      <div className="flex flex-wrap items-center gap-2">
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
              <span className="hidden sm:inline">{config.label}</span>
            </Button>
          )
        })}
      </div>

      {/* Main Content */}
      <div className="grid gap-6 md:grid-cols-5 lg:grid-cols-3 flex-1 min-h-0">
        {/* Gates List */}
        <Card className="md:col-span-3 lg:col-span-2 flex flex-col min-h-0">
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

                    <div className="flex items-center gap-2 sm:gap-4 text-sm shrink-0">
                      <div className="hidden sm:flex items-center gap-1.5 text-muted-foreground">
                        <CatIcon className={cn("h-4 w-4", catConfig.color)} />
                      </div>
                      <div className="text-right">
                        <p className={cn("font-medium text-xs sm:text-sm", config.color)}>{config.label}</p>
                        <p className="text-xs text-muted-foreground hidden sm:block">{formatTime(gate.lastRun)}</p>
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
        <Card className="md:col-span-2 lg:col-span-1 flex flex-col min-h-0">
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
                    <p className="text-sm font-mono">
                      {selectedGate.lastRun
                        ? new Date(selectedGate.lastRun).toLocaleString()
                        : "Never"}
                    </p>
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
          {runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No quality gate runs yet</p>
              <p className="text-xs mt-1">Execute a packet to see quality gate results</p>
            </div>
          ) : (
            <div className="space-y-2">
              {runs.slice(0, 20).map(run => {
                const config = statusConfig[run.status]
                const Icon = config.icon
                return (
                  <div
                    key={run.id}
                    className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 p-2 rounded-md hover:bg-accent/50 transition-colors"
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", config.color)} />
                    <Badge variant="outline" className="font-mono text-xs">
                      {run.packetId.length > 12 ? `${run.packetId.slice(0, 12)}...` : run.packetId}
                    </Badge>
                    <span className="font-medium text-sm">{run.gateName}</span>
                    {run.message && (
                      <span className="text-xs sm:text-sm text-muted-foreground truncate flex-1 basis-full sm:basis-auto order-last sm:order-none mt-1 sm:mt-0 pl-6 sm:pl-0">{run.message}</span>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto sm:ml-0">
                      {run.duration < 1000 ? `${run.duration}ms` : `${Math.round(run.duration / 1000)}s`}
                    </span>
                    <span className="text-xs text-muted-foreground hidden sm:inline">{formatTime(run.timestamp)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
