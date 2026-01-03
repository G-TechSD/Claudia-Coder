"use client"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { ArrowUp, ArrowDown } from "lucide-react"

interface MetricCardProps {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  icon?: React.ReactNode
  variant?: "default" | "success" | "warning" | "error"
}

export function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  variant = "default",
}: MetricCardProps) {
  const isPositive = change && change > 0
  const isNegative = change && change < 0

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-semibold tracking-tight">{value}</p>
            {change !== undefined && (
              <div className="flex items-center gap-1 text-xs">
                {isPositive && (
                  <ArrowUp className="h-3 w-3 text-green-400" />
                )}
                {isNegative && (
                  <ArrowDown className="h-3 w-3 text-red-400" />
                )}
                <span
                  className={cn(
                    isPositive && "text-green-400",
                    isNegative && "text-red-400",
                    !isPositive && !isNegative && "text-muted-foreground"
                  )}
                >
                  {isPositive && "+"}
                  {change}
                  {changeLabel && ` ${changeLabel}`}
                </span>
              </div>
            )}
          </div>
          {icon && (
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                variant === "default" && "bg-primary/10 text-primary",
                variant === "success" && "bg-green-500/10 text-green-400",
                variant === "warning" && "bg-yellow-500/10 text-yellow-400",
                variant === "error" && "bg-red-500/10 text-red-400"
              )}
            >
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
