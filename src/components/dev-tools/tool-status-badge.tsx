"use client"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { InstallStatus } from "@/lib/dev-tools/types"
import { Check, X, Loader2, AlertCircle, Download } from "lucide-react"

interface ToolStatusBadgeProps {
  status: InstallStatus
  version?: string
  className?: string
  showLabel?: boolean
}

export function ToolStatusBadge({
  status,
  version,
  className,
  showLabel = true,
}: ToolStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "installed":
        return {
          icon: Check,
          label: version ? `v${version.replace(/^v/, "")}` : "Installed",
          variant: "default" as const,
          className: "bg-green-500/20 text-green-600 border-green-500/30 hover:bg-green-500/30",
        }
      case "not-installed":
        return {
          icon: Download,
          label: "Not Installed",
          variant: "outline" as const,
          className: "bg-gray-500/10 text-gray-500 border-gray-500/30 hover:bg-gray-500/20",
        }
      case "checking":
        return {
          icon: Loader2,
          label: "Checking...",
          variant: "outline" as const,
          className: "bg-blue-500/10 text-blue-500 border-blue-500/30",
          iconClassName: "animate-spin",
        }
      case "installing":
        return {
          icon: Loader2,
          label: "Installing...",
          variant: "outline" as const,
          className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
          iconClassName: "animate-spin",
        }
      case "error":
        return {
          icon: AlertCircle,
          label: "Error",
          variant: "destructive" as const,
          className: "bg-red-500/20 text-red-500 border-red-500/30",
        }
      default:
        return {
          icon: X,
          label: "Unknown",
          variant: "outline" as const,
          className: "bg-gray-500/10 text-gray-500 border-gray-500/30",
        }
    }
  }

  const config = getStatusConfig()
  const Icon = config.icon

  return (
    <Badge
      variant={config.variant}
      className={cn(
        "gap-1 font-normal",
        config.className,
        className
      )}
    >
      <Icon className={cn("h-3 w-3", config.iconClassName)} />
      {showLabel && <span>{config.label}</span>}
    </Badge>
  )
}
