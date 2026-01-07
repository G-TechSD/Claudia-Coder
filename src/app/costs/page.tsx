"use client"

import { useState } from "react"
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
  ChevronLeft,
  ChevronRight,
  Download,
  Settings,
  Cpu,
  Cloud,
  Database,
  Zap
} from "lucide-react"

interface CostEntry {
  id: string
  category: "api" | "compute" | "storage" | "other"
  provider: string
  amount: number
  timestamp: Date
  packetId?: string
  description: string
}

interface DailySpend {
  date: string
  api: number
  compute: number
  storage: number
  other: number
  total: number
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

// Cost data will be tracked from actual API usage and execution
// Empty by default - populated by execution pipeline
const initialDailyData: DailySpend[] = []

const initialRecentCosts: CostEntry[] = []

function formatTime(date: Date): string {
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return date.toLocaleDateString()
}

export default function CostsPage() {
  const [dailyData] = useState<DailySpend[]>(initialDailyData)
  const [recentCosts] = useState<CostEntry[]>(initialRecentCosts)
  const [selectedPeriod, setSelectedPeriod] = useState<"day" | "week" | "month">("day")

  // Handle empty data state
  const hasData = dailyData.length > 0
  const today = hasData ? dailyData[dailyData.length - 1] : { date: new Date().toISOString(), api: 0, compute: 0, storage: 0, other: 0, total: 0 }
  const yesterday = hasData && dailyData.length > 1 ? dailyData[dailyData.length - 2] : today
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

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cost Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Monitor spending across all services and agents
          </p>
        </div>
        <div className="flex items-center gap-2">
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
            <span className={cn(
              "flex items-center text-xs",
              dailyChange >= 0 ? "text-red-400" : "text-green-400"
            )}>
              {dailyChange >= 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
              {Math.abs(dailyChange).toFixed(0)}%
            </span>
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
            <span className="text-sm text-muted-foreground">Remaining</span>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className={cn(
              "text-2xl font-semibold",
              (budget.daily - today.total) < 0 ? "text-red-400" : "text-green-400"
            )}>
              ${Math.max(0, budget.daily - today.total).toFixed(2)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Daily budget remaining
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
              {dailyData.slice(-14).map((day, i) => {
                const maxTotal = Math.max(...dailyData.slice(-14).map(d => d.total))
                const height = (day.total / maxTotal) * 100
                const isToday = i === dailyData.slice(-14).length - 1

                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className={cn(
                        "w-full rounded-t transition-all",
                        isToday ? "bg-primary" : "bg-muted-foreground/30"
                      )}
                      style={{ height: `${height}%` }}
                      title={`$${day.total.toFixed(2)}`}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(day.date).getDate()}
                    </span>
                  </div>
                )
              })}
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
              const percentage = (amount / weekTotal) * 100
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

      {/* Recent Costs */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-medium">Recent Costs</CardTitle>
          <Button variant="ghost" size="sm">View All</Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentCosts.map(cost => {
              const config = categoryConfig[cost.category]
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
                      {cost.packetId && (
                        <Badge variant="outline" className="font-mono text-xs">
                          {cost.packetId}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {cost.description}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">${cost.amount.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{formatTime(cost.timestamp)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
