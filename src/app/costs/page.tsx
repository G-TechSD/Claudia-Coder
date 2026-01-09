"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Calendar,
  Download,
  Settings,
  Cpu,
  Cloud,
  Database,
  Zap,
  RefreshCw,
  Loader2
} from "lucide-react"

interface CostEntry {
  id: string
  sessionId: string
  projectId?: string
  projectName?: string
  packetId?: string
  model: string
  provider: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  cost: number
  timestamp: string
  description: string
}

interface DailySpend {
  date: string
  api: number
  compute: number
  storage: number
  other: number
  total: number
  entries: number
  inputTokens: number
  outputTokens: number
}

interface ProjectCostSummary {
  projectId: string
  projectName: string
  totalCost: number
  totalInputTokens: number
  totalOutputTokens: number
  sessionCount: number
  entryCount: number
  lastActivity: string
}

interface BudgetConfig {
  daily: number
  monthly: number
  alertThreshold: number
}

const categoryConfig = {
  api: { label: "API Calls", icon: Cloud, color: "text-blue-400", bg: "bg-blue-400" },
  compute: { label: "Compute", icon: Cpu, color: "text-purple-400", bg: "bg-purple-400" },
  storage: { label: "Storage", icon: Database, color: "text-green-400", bg: "bg-green-400" },
  other: { label: "Other", icon: Zap, color: "text-yellow-400", bg: "bg-yellow-400" }
}

// Budget configuration - can be set by user in settings
const budget: BudgetConfig = {
  daily: 35.00,
  monthly: 750.00,
  alertThreshold: 0.8
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return date.toLocaleDateString()
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`
  return tokens.toString()
}

export default function CostsPage() {
  const [dailyData, setDailyData] = useState<DailySpend[]>([])
  const [recentCosts, setRecentCosts] = useState<CostEntry[]>([])
  const [projects, setProjects] = useState<ProjectCostSummary[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<"day" | "week" | "month">("day")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const fetchCostData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Fetch daily data and entries in parallel
      const [dailyRes, entriesRes, projectsRes] = await Promise.all([
        fetch("/api/costs?view=daily&limit=30"),
        fetch("/api/costs?view=entries&limit=20"),
        fetch("/api/costs?view=projects&limit=10")
      ])

      if (!dailyRes.ok || !entriesRes.ok || !projectsRes.ok) {
        throw new Error("Failed to fetch cost data")
      }

      const dailyResult = await dailyRes.json()
      const entriesResult = await entriesRes.json()
      const projectsResult = await projectsRes.json()

      setDailyData(dailyResult.dailySpend || [])
      setRecentCosts(entriesResult.entries || [])
      setProjects(projectsResult.projects || [])
      setLastRefresh(new Date())
    } catch (err) {
      console.error("[costs] Failed to fetch data:", err)
      setError(err instanceof Error ? err.message : "Failed to load cost data")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCostData()

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchCostData, 30000)
    return () => clearInterval(interval)
  }, [fetchCostData])

  // Handle empty data state
  const hasData = dailyData.length > 0
  const todayStr = new Date().toISOString().split("T")[0]
  const today = dailyData.find(d => d.date === todayStr) || { date: todayStr, api: 0, compute: 0, storage: 0, other: 0, total: 0, entries: 0, inputTokens: 0, outputTokens: 0 }

  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split("T")[0]
  const yesterday = dailyData.find(d => d.date === yesterdayStr) || today

  const monthTotal = dailyData.reduce((sum, d) => sum + d.total, 0)
  const weekTotal = dailyData.slice(-7).reduce((sum, d) => sum + d.total, 0)

  const dailyChange = yesterday.total > 0 ? ((today.total - yesterday.total) / yesterday.total) * 100 : 0
  const budgetUsedDaily = (today.total / budget.daily) * 100
  const budgetUsedMonthly = (monthTotal / budget.monthly) * 100

  const isOverBudget = budgetUsedDaily > 100
  const isNearBudget = budgetUsedDaily > budget.alertThreshold * 100

  // Calculate category breakdown for current period
  const categoryTotals = {
    api: dailyData.slice(-7).reduce((sum, d) => sum + d.api, 0),
    compute: dailyData.slice(-7).reduce((sum, d) => sum + d.compute, 0),
    storage: dailyData.slice(-7).reduce((sum, d) => sum + d.storage, 0),
    other: dailyData.slice(-7).reduce((sum, d) => sum + d.other, 0)
  }

  // Calculate total tokens
  const totalInputTokens = dailyData.reduce((sum, d) => sum + d.inputTokens, 0)
  const totalOutputTokens = dailyData.reduce((sum, d) => sum + d.outputTokens, 0)

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cost Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Monitor Claude Code spending across all projects and sessions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={fetchCostData}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="h-4 w-4" />
            Budgets
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Card className="p-4 border-red-400/50 bg-red-400/5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div>
              <p className="font-medium text-red-400">Failed to load cost data</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Budget Alert */}
      {(isOverBudget || isNearBudget) && (
        <Card className={cn(
          "p-4",
          isOverBudget ? "border-red-400/50 bg-red-400/5" : "border-yellow-400/50 bg-yellow-400/5"
        )}>
          <div className="flex items-center gap-3">
            <AlertTriangle className={cn("h-5 w-5", isOverBudget ? "text-red-400" : "text-yellow-400")} />
            <div>
              <p className={cn("font-medium", isOverBudget ? "text-red-400" : "text-yellow-400")}>
                {isOverBudget ? "Daily Budget Exceeded" : "Approaching Daily Budget"}
              </p>
              <p className="text-sm text-muted-foreground">
                {isOverBudget
                  ? `You've spent $${today.total.toFixed(2)} of your $${budget.daily.toFixed(2)} daily budget`
                  : `You've used ${budgetUsedDaily.toFixed(0)}% of your daily budget`
                }
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Today</span>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold">${today.total.toFixed(2)}</span>
            {yesterday.total > 0 && (
              <span className={cn(
                "flex items-center text-xs",
                dailyChange >= 0 ? "text-red-400" : "text-green-400"
              )}>
                {dailyChange >= 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
                {Math.abs(dailyChange).toFixed(0)}%
              </span>
            )}
          </div>
          <div className="mt-2">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Budget: ${budget.daily}</span>
              <span>{budgetUsedDaily.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all",
                  isOverBudget ? "bg-red-400" : isNearBudget ? "bg-yellow-400" : "bg-green-400"
                )}
                style={{ width: `${Math.min(budgetUsedDaily, 100)}%` }}
              />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">This Week</span>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold">${weekTotal.toFixed(2)}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Avg: ${(weekTotal / 7).toFixed(2)}/day
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">This Month</span>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold">${monthTotal.toFixed(2)}</span>
          </div>
          <div className="mt-2">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Budget: ${budget.monthly}</span>
              <span>{budgetUsedMonthly.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all",
                  budgetUsedMonthly > 100 ? "bg-red-400" : budgetUsedMonthly > 80 ? "bg-yellow-400" : "bg-green-400"
                )}
                style={{ width: `${Math.min(budgetUsedMonthly, 100)}%` }}
              />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Total Tokens</span>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold">{formatTokens(totalInputTokens + totalOutputTokens)}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            In: {formatTokens(totalInputTokens)} / Out: {formatTokens(totalOutputTokens)}
          </p>
        </Card>
      </div>

      {/* Chart and Breakdown */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Spending Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium">Spending Over Time</CardTitle>
            <div className="flex items-center gap-1">
              {(["day", "week", "month"] as const).map(period => (
                <Button
                  key={period}
                  variant={selectedPeriod === period ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setSelectedPeriod(period)}
                  className="capitalize"
                >
                  {period}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {/* Simple bar chart */}
            <div className="h-48 flex items-end gap-1">
              {hasData ? (
                dailyData.slice(-14).map((day, i) => {
                  const maxTotal = Math.max(...dailyData.slice(-14).map(d => d.total), 0.01)
                  const height = (day.total / maxTotal) * 100
                  const isToday = day.date === todayStr

                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className={cn(
                          "w-full rounded-t transition-all min-h-[2px]",
                          isToday ? "bg-primary" : "bg-muted-foreground/30"
                        )}
                        style={{ height: `${height}%` }}
                        title={`$${day.total.toFixed(2)} - ${day.entries} entries`}
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(day.date).getDate()}
                      </span>
                    </div>
                  )
                })
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                  No cost data yet. Costs will appear here when Claude Code reports them.
                </div>
              )}
            </div>
            <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
              {Object.entries(categoryConfig).map(([key, config]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full", config.bg)} />
                  {config.label}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">By Category (7d)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(categoryConfig).map(([key, config]) => {
              const amount = categoryTotals[key as keyof typeof categoryTotals]
              const percentage = weekTotal > 0 ? (amount / weekTotal) * 100 : 0
              const Icon = config.icon

              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-4 w-4", config.color)} />
                      <span className="text-sm font-medium">{config.label}</span>
                    </div>
                    <span className="text-sm font-semibold">${amount.toFixed(2)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full transition-all", config.bg)}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-right">
                    {percentage.toFixed(1)}%
                  </p>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Projects by Cost */}
      {projects.length > 0 && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium">Costs by Project</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {projects.map(project => (
                <div
                  key={project.projectId}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-accent/50 transition-colors"
                >
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-blue-400/10">
                    <Cloud className="h-4 w-4 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{project.projectName}</span>
                      <Badge variant="outline" className="text-xs">
                        {project.sessionCount} sessions
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {formatTokens(project.totalInputTokens)} in / {formatTokens(project.totalOutputTokens)} out tokens
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">${project.totalCost.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{formatTime(project.lastActivity)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Costs */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-medium">Recent Costs</CardTitle>
          <Button variant="ghost" size="sm">View All</Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentCosts.length > 0 ? (
              recentCosts.map(cost => {
                const config = categoryConfig.api // All Claude Code costs are API
                const Icon = config.icon

                return (
                  <div
                    key={cost.id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-accent/50 transition-colors"
                  >
                    <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", `${config.bg}/10`)}>
                      <Icon className={cn("h-4 w-4", config.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{cost.provider}</span>
                        <Badge variant="outline" className="font-mono text-xs">
                          {cost.model.split("-").slice(0, 2).join("-")}
                        </Badge>
                        {cost.projectName && (
                          <Badge variant="secondary" className="text-xs">
                            {cost.projectName}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {cost.description} ({formatTokens(cost.inputTokens)} in / {formatTokens(cost.outputTokens)} out)
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">${cost.cost.toFixed(4)}</p>
                      <p className="text-xs text-muted-foreground">{formatTime(cost.timestamp)}</p>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Cloud className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No cost data recorded yet</p>
                <p className="text-xs mt-1">
                  Costs will appear here when Claude Code uses the report_costs tool
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Last Updated */}
      <div className="text-center text-xs text-muted-foreground">
        Last updated: {lastRefresh.toLocaleTimeString()}
      </div>
    </div>
  )
}
