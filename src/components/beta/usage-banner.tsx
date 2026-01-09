"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { AlertTriangle, Sparkles, Layers, Zap, Info } from "lucide-react"

interface BetaUsageBannerProps {
  type: "projects" | "executions"
  current: number
  limit: number
  className?: string
  showUpgradeButton?: boolean
  compact?: boolean
}

export function BetaUsageBanner({
  type,
  current,
  limit,
  className,
  showUpgradeButton = false,
  compact = false,
}: BetaUsageBannerProps) {
  const percentage = Math.min((current / limit) * 100, 100)
  const remaining = Math.max(limit - current, 0)
  const isNearLimit = percentage >= 80
  const isAtLimit = current >= limit

  const icon = type === "projects" ? Layers : Zap
  const Icon = icon

  const typeLabel = type === "projects" ? "Projects" : "Executions"
  const periodLabel = type === "executions" ? " today" : ""

  // Determine status color
  let statusColor = "text-muted-foreground"
  let progressColor = "bg-primary"
  let borderColor = "border-border"
  let bgColor = "bg-background"

  if (isAtLimit) {
    statusColor = "text-red-500"
    progressColor = "bg-red-500"
    borderColor = "border-red-500/30"
    bgColor = "bg-red-500/5"
  } else if (isNearLimit) {
    statusColor = "text-amber-500"
    progressColor = "bg-amber-500"
    borderColor = "border-amber-500/30"
    bgColor = "bg-amber-500/5"
  }

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 text-sm",
          statusColor,
          className
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        <span className="font-medium">
          {current}/{limit} {typeLabel.toLowerCase()}
        </span>
        {isAtLimit && (
          <Badge variant="outline" className="text-xs bg-red-500/10 text-red-500 border-red-500/20">
            Limit reached
          </Badge>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        borderColor,
        bgColor,
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
          isAtLimit ? "bg-red-500/10" : isNearLimit ? "bg-amber-500/10" : "bg-primary/10"
        )}>
          {isAtLimit ? (
            <AlertTriangle className={cn("h-5 w-5", statusColor)} />
          ) : isNearLimit ? (
            <AlertTriangle className={cn("h-5 w-5", statusColor)} />
          ) : (
            <Icon className="h-5 w-5 text-primary" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{typeLabel} Usage</span>
              <Badge
                variant="outline"
                className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20"
              >
                Beta
              </Badge>
            </div>
            <span className={cn("text-sm font-medium", statusColor)}>
              {current} / {limit}
            </span>
          </div>

          <Progress
            value={percentage}
            className={cn("h-2", progressColor)}
          />

          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-muted-foreground">
              {isAtLimit ? (
                <span className="text-red-500">No {typeLabel.toLowerCase()} remaining{periodLabel}</span>
              ) : isNearLimit ? (
                <span className="text-amber-500">Only {remaining} {typeLabel.toLowerCase()} remaining{periodLabel}</span>
              ) : (
                <span>{remaining} {typeLabel.toLowerCase()} remaining{periodLabel}</span>
              )}
            </p>

            {showUpgradeButton && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto py-1 px-2 text-xs"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Upgrade
              </Button>
            )}
          </div>
        </div>
      </div>

      {isAtLimit && type === "projects" && (
        <div className="mt-3 pt-3 border-t border-red-500/20">
          <p className="text-xs text-muted-foreground flex items-start gap-2">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            Delete an existing project to create a new one, or upgrade to a full account for unlimited projects.
          </p>
        </div>
      )}

      {isAtLimit && type === "executions" && (
        <div className="mt-3 pt-3 border-t border-red-500/20">
          <p className="text-xs text-muted-foreground flex items-start gap-2">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            Your daily execution limit will reset at midnight. Upgrade to a full account for unlimited executions.
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Combined beta usage display for dashboard/sidebar
 */
interface BetaUsageSummaryProps {
  projectsCurrent: number
  projectsLimit: number
  executionsCurrent: number
  executionsLimit: number
  className?: string
}

export function BetaUsageSummary({
  projectsCurrent,
  projectsLimit,
  executionsCurrent,
  executionsLimit,
  className,
}: BetaUsageSummaryProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <Badge
          variant="outline"
          className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20"
        >
          Beta
        </Badge>
        Usage Limits
      </div>

      <div className="space-y-2">
        <BetaUsageBanner
          type="projects"
          current={projectsCurrent}
          limit={projectsLimit}
          compact
        />
        <BetaUsageBanner
          type="executions"
          current={executionsCurrent}
          limit={executionsLimit}
          compact
        />
      </div>
    </div>
  )
}
