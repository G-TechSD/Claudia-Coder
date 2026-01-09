"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Bot,
  Volume2,
  VolumeX
} from "lucide-react"

// LocalStorage key for sound preference
const STORAGE_KEY_MINI_ME_SOUNDS = "mini-me-sounds-enabled"

export type MiniMeStatus = "spawning" | "running" | "completed" | "failed" | "pending"

export interface MiniMeAgent {
  id: string
  index?: number  // For staggered animation and color assignment
  status: MiniMeStatus
  task: string
  startedAt?: Date
  completedAt?: Date
  error?: string
  result?: string  // Optional result message on completion
}

interface MiniMeProps {
  agent: MiniMeAgent
  index?: number  // Index for staggered animation
  soundEnabled?: boolean
  className?: string
}

// Mini-Me avatar color schemes for visual distinction
const MINI_ME_COLORS = [
  { bg: "bg-blue-500/15", border: "border-blue-500/40", text: "text-blue-400", glow: "shadow-blue-500/40", accent: "blue" },
  { bg: "bg-purple-500/15", border: "border-purple-500/40", text: "text-purple-400", glow: "shadow-purple-500/40", accent: "purple" },
  { bg: "bg-green-500/15", border: "border-green-500/40", text: "text-green-400", glow: "shadow-green-500/40", accent: "green" },
  { bg: "bg-orange-500/15", border: "border-orange-500/40", text: "text-orange-400", glow: "shadow-orange-500/40", accent: "orange" },
  { bg: "bg-cyan-500/15", border: "border-cyan-500/40", text: "text-cyan-400", glow: "shadow-cyan-500/40", accent: "cyan" },
  { bg: "bg-pink-500/15", border: "border-pink-500/40", text: "text-pink-400", glow: "shadow-pink-500/40", accent: "pink" },
  { bg: "bg-yellow-500/15", border: "border-yellow-500/40", text: "text-yellow-400", glow: "shadow-yellow-500/40", accent: "yellow" },
  { bg: "bg-indigo-500/15", border: "border-indigo-500/40", text: "text-indigo-400", glow: "shadow-indigo-500/40", accent: "indigo" },
  { bg: "bg-teal-500/15", border: "border-teal-500/40", text: "text-teal-400", glow: "shadow-teal-500/40", accent: "teal" },
  { bg: "bg-rose-500/15", border: "border-rose-500/40", text: "text-rose-400", glow: "shadow-rose-500/40", accent: "rose" },
]

// Sound effects utility
export const playMiniMeSound = (type: "spawn" | "complete" | "fail", enabled: boolean) => {
  if (!enabled || typeof window === "undefined") return

  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContext) return

    const audioContext = new AudioContext()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    switch (type) {
      case "spawn":
        // Cheerful ascending chirp
        oscillator.type = "sine"
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime)
        oscillator.frequency.exponentialRampToValueAtTime(880, audioContext.currentTime + 0.1)
        gainNode.gain.setValueAtTime(0.08, audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15)
        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.15)
        break
      case "complete":
        // Pleasant success chime (C5 to E5)
        oscillator.type = "sine"
        oscillator.frequency.setValueAtTime(523, audioContext.currentTime)
        oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.08)
        gainNode.gain.setValueAtTime(0.08, audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)
        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.2)
        break
      case "fail":
        // Low descending tone
        oscillator.type = "sawtooth"
        oscillator.frequency.setValueAtTime(280, audioContext.currentTime)
        oscillator.frequency.exponentialRampToValueAtTime(140, audioContext.currentTime + 0.2)
        gainNode.gain.setValueAtTime(0.06, audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25)
        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.25)
        break
    }
  } catch (e) {
    // Silently fail if audio is not available
    console.debug("[MiniMe] Sound not available:", e)
  }
}

// Hook to manage sound preference
export function useMiniMeSounds() {
  const [soundEnabled, setSoundEnabled] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY_MINI_ME_SOUNDS)
      setSoundEnabled(saved === "true")
    }
  }, [])

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const newValue = !prev
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY_MINI_ME_SOUNDS, String(newValue))
      }
      return newValue
    })
  }, [])

  return { soundEnabled, toggleSound }
}

const statusConfig: Record<MiniMeStatus, {
  label: string
  bgColor: string
  borderColor: string
  textColor: string
  iconColor: string
  icon: React.ElementType
  animate?: boolean
}> = {
  pending: {
    label: "Pending",
    bgColor: "bg-gray-500/10",
    borderColor: "border-gray-500/30",
    textColor: "text-gray-400",
    iconColor: "text-gray-400",
    icon: Clock,
    animate: false
  },
  spawning: {
    label: "Spawning",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    textColor: "text-blue-400",
    iconColor: "text-blue-400",
    icon: Sparkles,
    animate: true
  },
  running: {
    label: "Running",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/40",
    textColor: "text-blue-400",
    iconColor: "text-blue-400",
    icon: Loader2,
    animate: true
  },
  completed: {
    label: "Completed",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    textColor: "text-green-400",
    iconColor: "text-green-400",
    icon: CheckCircle2,
    animate: false
  },
  failed: {
    label: "Failed",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    textColor: "text-red-400",
    iconColor: "text-red-400",
    icon: XCircle,
    animate: false
  }
}

// Format agent ID to short form (first 8 chars)
function formatAgentId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}...` : id
}

// Calculate duration between two dates
function formatDuration(start?: Date, end?: Date): string {
  if (!start) return "--"

  const endTime = end || new Date()
  const durationMs = endTime.getTime() - new Date(start).getTime()

  const seconds = Math.floor(durationMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}

// Truncate task description
function truncateTask(task: string, maxLength: number = 60): string {
  if (task.length <= maxLength) return task
  return `${task.slice(0, maxLength)}...`
}

export function MiniMe({ agent, index = 0, soundEnabled = false, className }: MiniMeProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [showSparkles, setShowSparkles] = useState(false)
  const [prevStatus, setPrevStatus] = useState<MiniMeStatus | null>(null)
  const config = statusConfig[agent.status]
  const StatusIcon = config.icon

  // Get unique color scheme based on agent index
  const agentIndex = agent.index ?? index
  const colorScheme = MINI_ME_COLORS[agentIndex % MINI_ME_COLORS.length]

  // Animated entrance effect with stagger
  useEffect(() => {
    const delay = agentIndex * 80 // Stagger by 80ms per agent
    const timer = setTimeout(() => setIsVisible(true), delay)
    return () => clearTimeout(timer)
  }, [agentIndex])

  // Handle status changes for sounds and effects
  useEffect(() => {
    if (prevStatus === null) {
      setPrevStatus(agent.status)
      // Play spawn sound on initial creation if spawning or running
      if (agent.status === "spawning" || agent.status === "running") {
        playMiniMeSound("spawn", soundEnabled)
      }
      return
    }

    if (prevStatus !== agent.status) {
      // Status changed
      if (agent.status === "spawning" || agent.status === "running") {
        playMiniMeSound("spawn", soundEnabled)
      } else if (agent.status === "completed") {
        playMiniMeSound("complete", soundEnabled)
        // Show sparkle celebration
        setShowSparkles(true)
        setTimeout(() => setShowSparkles(false), 1200)
      } else if (agent.status === "failed") {
        playMiniMeSound("fail", soundEnabled)
      }
      setPrevStatus(agent.status)
    }
  }, [agent.status, prevStatus, soundEnabled])

  return (
    <div
      className={cn(
        "relative p-3 rounded-lg border transition-all duration-300 ease-out",
        // Use color scheme for personalized appearance
        colorScheme.bg,
        colorScheme.border,
        // Animation classes
        isVisible
          ? "opacity-100 translate-y-0 scale-100"
          : "opacity-0 translate-y-4 scale-95",
        // Status-specific animations
        agent.status === "spawning" && "mini-me-spawn",
        agent.status === "running" && "mini-me-working",
        agent.status === "completed" && "mini-me-complete",
        agent.status === "failed" && "mini-me-fail",
        className
      )}
      style={{
        animationDelay: `${agentIndex * 80}ms`,
      }}
    >
      {/* Animated glow effect for running/spawning states */}
      {config.animate && (
        <div className={cn(
          "absolute inset-0 rounded-lg opacity-30 animate-pulse",
          agent.status === "running" ? `bg-${colorScheme.accent}-500` : "bg-blue-400"
        )} />
      )}

      {/* Sparkle celebration on completion */}
      {showSparkles && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
          {[...Array(8)].map((_, i) => (
            <Sparkles
              key={i}
              className={cn(
                "absolute h-4 w-4 text-yellow-400 mini-me-sparkle-particle",
              )}
              style={{
                left: `${10 + Math.random() * 80}%`,
                top: `${10 + Math.random() * 80}%`,
                animationDelay: `${i * 80}ms`,
              }}
            />
          ))}
        </div>
      )}

      {/* Header: Agent ID + Status */}
      <div className="relative flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {/* Numbered avatar */}
          <div className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold",
            colorScheme.bg,
            colorScheme.border,
            colorScheme.text,
            "border"
          )}>
            #{agentIndex + 1}
          </div>
          <span className="text-xs font-mono text-gray-400">
            {formatAgentId(agent.id)}
          </span>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] px-1.5 py-0 h-5",
            config.textColor,
            config.borderColor
          )}
        >
          <StatusIcon className={cn(
            "h-3 w-3 mr-1",
            config.iconColor,
            config.animate && agent.status === "running" && "animate-spin"
          )} />
          {config.label}
        </Badge>
      </div>

      {/* Task Description */}
      <p className={cn(
        "text-sm mb-2 line-clamp-2",
        agent.status === "completed" ? "text-gray-400" : "text-gray-200"
      )}>
        {truncateTask(agent.task)}
      </p>

      {/* Footer: Duration/Time */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">
          {agent.status === "completed" || agent.status === "failed"
            ? "Completed in"
            : agent.status === "running" || agent.status === "spawning"
            ? "Running for"
            : "Waiting"}
        </span>
        <span className={cn("font-mono", config.textColor)}>
          {agent.status === "pending"
            ? "--"
            : formatDuration(agent.startedAt, agent.completedAt)}
        </span>
      </div>

      {/* Success result message */}
      {agent.status === "completed" && agent.result && (
        <div className="mt-2 p-2 rounded bg-green-500/10 border border-green-500/20">
          <p className="text-xs text-green-400 line-clamp-2">{agent.result}</p>
        </div>
      )}

      {/* Error message if failed */}
      {agent.status === "failed" && agent.error && (
        <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/20">
          <p className="text-xs text-red-400 line-clamp-2">{agent.error}</p>
        </div>
      )}

      {/* Mini avatar/robot indicator - top right corner */}
      <div className={cn(
        "absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 bg-[#161b22]",
        colorScheme.border,
        colorScheme.text,
        agent.status === "running" && "shadow-lg",
        agent.status === "running" && colorScheme.glow
      )}>
        {agent.status === "running" && (
          <div className="animate-bounce">
            <Bot className="h-3.5 w-3.5" />
          </div>
        )}
        {agent.status === "completed" && <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />}
        {agent.status === "failed" && <XCircle className="h-3.5 w-3.5 text-red-400" />}
        {agent.status === "pending" && <Clock className="h-3.5 w-3.5 text-gray-400" />}
        {agent.status === "spawning" && (
          <div className="animate-pulse">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
        )}
      </div>
    </div>
  )
}

// Export a skeleton for loading states
export function MiniMeSkeleton() {
  return (
    <div className="p-3 rounded-lg border border-gray-700/50 bg-gray-800/50 animate-pulse">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-gray-700" />
          <div className="h-3 w-16 rounded bg-gray-700" />
        </div>
        <div className="h-5 w-16 rounded bg-gray-700" />
      </div>
      <div className="h-4 w-full rounded bg-gray-700 mb-2" />
      <div className="h-4 w-2/3 rounded bg-gray-700 mb-2" />
      <div className="flex items-center justify-between">
        <div className="h-3 w-20 rounded bg-gray-700" />
        <div className="h-3 w-12 rounded bg-gray-700" />
      </div>
    </div>
  )
}
