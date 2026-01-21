"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Play, Loader2, Zap, Rocket, CheckCircle, AlertTriangle } from "lucide-react"

interface GoButtonProps {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  status?: "idle" | "ready" | "running" | "complete" | "error" | "partial" | "failed" | "stopped"
  progress?: number
  className?: string
  size?: "default" | "large" | "hero"
  /** For partial status: shows X/Y in button text */
  successCount?: number
  totalCount?: number
}

/**
 * The GO Button - The big cyan button that starts it all
 *
 * This is what users came here for - one click to start building
 */
export function GoButton({
  onClick,
  disabled = false,
  loading = false,
  status = "idle",
  progress = 0,
  className,
  size = "default",
  successCount,
  totalCount
}: GoButtonProps) {
  const isRunning = status === "running" || loading
  const isComplete = status === "complete"
  const isPartial = status === "partial"
  const isFailed = status === "failed"
  const isStopped = status === "stopped"
  const isReady = status === "ready"

  const sizeClasses = {
    default: "h-12 px-6 text-lg",
    large: "h-16 px-8 text-xl",
    hero: "h-32 px-16 text-5xl min-w-[280px]"
  }

  const iconSizes = {
    default: "h-5 w-5",
    large: "h-6 w-6",
    hero: "h-14 w-14"
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled || isRunning}
      className={cn(
        // Base styles
        "relative overflow-hidden rounded-xl font-bold tracking-wide",
        "flex items-center justify-center gap-3",
        "transition-all duration-300 ease-out",
        "focus:outline-none focus:ring-4 focus:ring-cyan-500/50",

        // Size
        sizeClasses[size],

        // State-based styles
        isComplete
          ? "bg-green-600 text-white shadow-lg shadow-green-500/30"
          : isPartial
          ? "bg-yellow-600 text-white shadow-lg shadow-yellow-500/30"
          : isFailed
          ? "bg-red-600 text-white shadow-lg shadow-red-500/30"
          : isStopped
          ? "bg-gray-600 text-white shadow-lg shadow-gray-500/30"
          : isRunning
          ? "bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-500 text-white shadow-xl shadow-cyan-500/40 animate-pulse"
          : isReady
          ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-2xl shadow-cyan-500/50 ring-4 ring-cyan-400/30 hover:shadow-[0_0_60px_rgba(6,182,212,0.6)] hover:scale-110 active:scale-95"
          : disabled
          ? "bg-gray-700 text-gray-400 cursor-not-allowed"
          : "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/30 hover:from-cyan-500 hover:to-blue-500 hover:shadow-xl hover:shadow-cyan-500/40 hover:scale-105 active:scale-95",

        className
      )}
    >
      {/* Animated background shine effect */}
      {isReady && !isRunning && (
        <div className="absolute inset-0 -translate-x-full animate-[shine_2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      )}

      {/* Progress bar overlay when running */}
      {isRunning && progress > 0 && (
        <div
          className="absolute inset-0 bg-cyan-400/30 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      )}

      {/* Icon */}
      <span className="relative z-10">
        {isComplete ? (
          <CheckCircle className={cn(iconSizes[size], "text-green-200")} />
        ) : isPartial ? (
          <AlertTriangle className={cn(iconSizes[size], "text-yellow-200")} />
        ) : isFailed ? (
          <Play className={cn(iconSizes[size], "text-red-200")} />
        ) : isStopped ? (
          <Play className={cn(iconSizes[size], "text-gray-300")} />
        ) : isRunning ? (
          <Loader2 className={cn(iconSizes[size], "animate-spin")} />
        ) : isReady ? (
          <Rocket className={cn(iconSizes[size], "animate-pulse")} />
        ) : (
          <Play className={iconSizes[size]} />
        )}
      </span>

      {/* Text */}
      <span className="relative z-10">
        {isComplete
          ? "Complete"
          : isPartial
          ? successCount !== undefined && totalCount !== undefined
            ? `Partial (${successCount}/${totalCount})`
            : "Partial"
          : isFailed
          ? "Resume"
          : isStopped
          ? "Resume"
          : isRunning
          ? progress > 0
            ? `Building... ${progress}%`
            : "Building..."
          : isReady
          ? "GO"
          : "Start Build"}
      </span>

      {/* Sparkle effects when ready */}
      {isReady && !isRunning && (
        <>
          <Zap className={cn("absolute top-2 right-4 text-yellow-300/70 animate-pulse", size === "hero" ? "h-4 w-4" : "h-3 w-3")} />
          <Zap className={cn("absolute bottom-2 left-6 text-yellow-300/70 animate-pulse delay-300", size === "hero" ? "h-3 w-3" : "h-2 w-2")} />
        </>
      )}
    </button>
  )
}

/**
 * Hero GO Button - The prominent version for the project page
 */
export function HeroGoButton({
  projectName,
  packetCount,
  onGo,
  disabled,
  loading,
  status,
  progress,
  successCount,
  totalCount
}: {
  projectName: string
  packetCount: number
  onGo: () => void
  disabled?: boolean
  loading?: boolean
  status?: "idle" | "ready" | "running" | "complete" | "error" | "partial" | "failed" | "stopped"
  progress?: number
  successCount?: number
  totalCount?: number
}) {
  return (
    <div className="flex flex-col items-center gap-6 p-8 rounded-2xl bg-gradient-to-br from-gray-900/50 to-gray-800/30 border border-cyan-500/20">
      {/* Project info */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">{projectName}</h2>
        <p className="text-muted-foreground">
          {packetCount} work packet{packetCount !== 1 ? "s" : ""} ready to process
        </p>
      </div>

      {/* The Button */}
      <div data-go-button>
        <GoButton
          onClick={onGo}
          disabled={disabled || packetCount === 0}
          loading={loading}
          status={packetCount > 0 ? (status || "ready") : "idle"}
          progress={progress}
          size="hero"
          successCount={successCount}
          totalCount={totalCount}
        />
      </div>

      {/* Status text */}
      <p className="text-sm text-muted-foreground text-center max-w-md">
        {status === "running"
          ? "Claudia Coder is building your project. Watch the activity stream for progress."
          : status === "complete"
          ? "All packets completed and verified! Check the results below."
          : status === "partial"
          ? `${successCount || 0} of ${totalCount || 0} packets succeeded. Some had issues.`
          : status === "failed"
          ? "A packet failed quality gates. Click Resume to skip it and continue with remaining packets."
          : status === "stopped"
          ? "Processing was stopped. Click Resume to continue with remaining packets."
          : packetCount === 0
          ? "Add work packets to your project to get started"
          : "Click GO to start autonomous development"}
      </p>
    </div>
  )
}
