"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Play, Loader2, Zap, Rocket, CheckCircle } from "lucide-react"

interface GoButtonProps {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  status?: "idle" | "ready" | "running" | "complete"
  progress?: number
  className?: string
  size?: "default" | "large" | "hero"
}

/**
 * The GO Button - The big green button that starts it all
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
  size = "default"
}: GoButtonProps) {
  const isRunning = status === "running" || loading
  const isComplete = status === "complete"
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
        "focus:outline-none focus:ring-4 focus:ring-green-500/50",

        // Size
        sizeClasses[size],

        // State-based styles
        isComplete
          ? "bg-green-600 text-white shadow-lg shadow-green-500/30"
          : isRunning
          ? "bg-gradient-to-r from-green-500 via-emerald-500 to-green-500 text-white shadow-xl shadow-green-500/40 animate-pulse"
          : isReady
          ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-2xl shadow-green-500/50 ring-4 ring-green-400/30 hover:shadow-[0_0_60px_rgba(34,197,94,0.6)] hover:scale-110 active:scale-95"
          : disabled
          ? "bg-gray-700 text-gray-400 cursor-not-allowed"
          : "bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg shadow-green-500/30 hover:from-green-500 hover:to-emerald-500 hover:shadow-xl hover:shadow-green-500/40 hover:scale-105 active:scale-95",

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
          className="absolute inset-0 bg-green-400/30 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      )}

      {/* Icon */}
      <span className="relative z-10">
        {isComplete ? (
          <CheckCircle className={cn(iconSizes[size], "animate-bounce")} />
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
          ? "Complete!"
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
  progress
}: {
  projectName: string
  packetCount: number
  onGo: () => void
  disabled?: boolean
  loading?: boolean
  status?: "idle" | "ready" | "running" | "complete"
  progress?: number
}) {
  return (
    <div className="flex flex-col items-center gap-6 p-8 rounded-2xl bg-gradient-to-br from-gray-900/50 to-gray-800/30 border border-green-500/20">
      {/* Project info */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">{projectName}</h2>
        <p className="text-muted-foreground">
          {packetCount} work packet{packetCount !== 1 ? "s" : ""} ready to execute
        </p>
      </div>

      {/* The Button */}
      <GoButton
        onClick={onGo}
        disabled={disabled || packetCount === 0}
        loading={loading}
        status={packetCount > 0 ? (status || "ready") : "idle"}
        progress={progress}
        size="hero"
      />

      {/* Status text */}
      <p className="text-sm text-muted-foreground text-center max-w-md">
        {status === "running"
          ? "Claudia is building your project. Watch the activity stream for progress."
          : status === "complete"
          ? "All packets completed! Check the results below."
          : packetCount === 0
          ? "Add work packets to your project to get started"
          : "Click GO to start autonomous development"}
      </p>
    </div>
  )
}
