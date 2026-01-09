"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  FastForward,
  Loader2,
  MousePointer,
  AlertCircle,
  Navigation,
} from "lucide-react"

interface SessionEvent {
  type: number
  data: unknown
  timestamp: number
}

interface EventMarker {
  type: "click" | "error" | "navigation" | "input"
  timestamp: number
  description?: string
}

interface SessionPlayerProps {
  events: SessionEvent[]
  className?: string
  onTimeUpdate?: (currentTime: number) => void
  onEventMarkerClick?: (marker: EventMarker) => void
}

// rrweb event types
const EventType = {
  DomContentLoaded: 0,
  Load: 1,
  FullSnapshot: 2,
  IncrementalSnapshot: 3,
  Meta: 4,
  Custom: 5,
  Plugin: 6,
}

// Incremental snapshot source types
const IncrementalSource = {
  Mutation: 0,
  MouseMove: 1,
  MouseInteraction: 2,
  Scroll: 3,
  ViewportResize: 4,
  Input: 5,
  TouchMove: 6,
  MediaInteraction: 7,
  StyleSheetRule: 8,
  CanvasMutation: 9,
  Font: 10,
  Log: 11,
  Drag: 12,
  StyleDeclaration: 13,
}

// Mouse interaction types
const MouseInteractions = {
  MouseUp: 0,
  MouseDown: 1,
  Click: 2,
  ContextMenu: 3,
  DblClick: 4,
  Focus: 5,
  Blur: 6,
  TouchStart: 7,
  TouchMove_Departed: 8,
  TouchEnd: 9,
  TouchCancel: 10,
}

export function SessionPlayer({
  events,
  className,
  onTimeUpdate,
  onEventMarkerClick,
}: SessionPlayerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const playerRef = React.useRef<unknown>(null)
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)
  const [currentTime, setCurrentTime] = React.useState(0)
  const [totalTime, setTotalTime] = React.useState(0)
  const [playbackSpeed, setPlaybackSpeed] = React.useState(1)
  const [eventMarkers, setEventMarkers] = React.useState<EventMarker[]>([])
  const [error, setError] = React.useState<string | null>(null)

  // Extract event markers from events
  React.useEffect(() => {
    if (events.length === 0) return

    const markers: EventMarker[] = []
    const startTimestamp = events[0]?.timestamp || 0

    events.forEach((event) => {
      const relativeTime = event.timestamp - startTimestamp

      // Check for click events
      if (event.type === EventType.IncrementalSnapshot) {
        const data = event.data as { source?: number; type?: number }
        if (
          data.source === IncrementalSource.MouseInteraction &&
          data.type === MouseInteractions.Click
        ) {
          markers.push({
            type: "click",
            timestamp: relativeTime,
            description: "Click",
          })
        }
        if (data.source === IncrementalSource.Input) {
          markers.push({
            type: "input",
            timestamp: relativeTime,
            description: "Input",
          })
        }
      }

      // Check for custom events (errors, navigation)
      if (event.type === EventType.Custom) {
        const data = event.data as { tag?: string; payload?: unknown }
        if (data.tag === "error") {
          markers.push({
            type: "error",
            timestamp: relativeTime,
            description: "Error",
          })
        } else if (data.tag === "navigation") {
          markers.push({
            type: "navigation",
            timestamp: relativeTime,
            description: "Navigation",
          })
        }
      }
    })

    setEventMarkers(markers)
  }, [events])

  // Initialize rrweb player
  React.useEffect(() => {
    if (!containerRef.current || events.length === 0) return

    let player: {
      play: () => void
      pause: () => void
      goto: (timeOffset: number, play?: boolean) => void
      setSpeed: (speed: number) => void
      on: (event: string, handler: (payload: { payload: number }) => void) => void
      getReplayer: () => { getMetaData: () => { totalTime: number } }
      destroy: () => void
    } | null = null

    const initPlayer = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Dynamic import of rrweb-player
        const rrwebPlayer = await import("rrweb-player")
        const RRWebPlayer = rrwebPlayer.default

        // Clear container
        if (containerRef.current) {
          containerRef.current.innerHTML = ""
        }

        // Create player
        const newPlayer = new RRWebPlayer({
          target: containerRef.current!,
          props: {
            events,
            width: containerRef.current?.clientWidth || 800,
            height: 500,
            autoPlay: false,
            showController: false,
            speedOption: [0.5, 1, 2, 4, 8],
            skipInactive: true,
            showWarning: true,
            showDebug: false,
            mouseTail: {
              duration: 500,
              strokeStyle: "rgb(99, 102, 241)",
            },
          },
        }) as unknown as typeof player
        player = newPlayer

        playerRef.current = player

        // Get total time
        const metadata = player!.getReplayer().getMetaData()
        setTotalTime(metadata.totalTime || 0)

        // Listen for time updates
        player!.on("ui-update-current-time", (payload: { payload: number }) => {
          const time = payload.payload
          setCurrentTime(time)
          onTimeUpdate?.(time)
        })

        setIsLoading(false)
      } catch (err) {
        console.error("Failed to initialize rrweb player:", err)
        setError("Failed to load session player. Please try refreshing the page.")
        setIsLoading(false)
      }
    }

    initPlayer()

    return () => {
      if (player && typeof player.destroy === "function") {
        try {
          player.destroy()
        } catch {
          // Ignore destruction errors
        }
      }
    }
  }, [events, onTimeUpdate])

  // Playback controls
  const handlePlay = () => {
    const player = playerRef.current as {
      play: () => void
      pause: () => void
    } | null
    if (player) {
      if (isPlaying) {
        player.pause()
      } else {
        player.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleSpeedChange = () => {
    const speeds = [0.5, 1, 2, 4, 8]
    const currentIndex = speeds.indexOf(playbackSpeed)
    const nextIndex = (currentIndex + 1) % speeds.length
    const newSpeed = speeds[nextIndex]
    setPlaybackSpeed(newSpeed)

    const player = playerRef.current as { setSpeed: (speed: number) => void } | null
    if (player) {
      player.setSpeed(newSpeed)
    }
  }

  const handleSkip = (offset: number) => {
    const player = playerRef.current as { goto: (time: number, play?: boolean) => void } | null
    if (player) {
      const newTime = Math.max(0, Math.min(currentTime + offset, totalTime))
      player.goto(newTime, isPlaying)
      setCurrentTime(newTime)
    }
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const player = playerRef.current as { goto: (time: number, play?: boolean) => void } | null
    if (!player || totalTime === 0) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width
    const newTime = Math.floor(percentage * totalTime)

    player.goto(newTime, isPlaying)
    setCurrentTime(newTime)
  }

  const handleMarkerClick = (marker: EventMarker) => {
    const player = playerRef.current as { goto: (time: number, play?: boolean) => void } | null
    if (player) {
      player.goto(marker.timestamp, false)
      setCurrentTime(marker.timestamp)
      setIsPlaying(false)
    }
    onEventMarkerClick?.(marker)
  }

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  const getMarkerIcon = (type: EventMarker["type"]) => {
    switch (type) {
      case "click":
        return <MousePointer className="h-2.5 w-2.5" />
      case "error":
        return <AlertCircle className="h-2.5 w-2.5" />
      case "navigation":
        return <Navigation className="h-2.5 w-2.5" />
      default:
        return null
    }
  }

  const getMarkerColor = (type: EventMarker["type"]) => {
    switch (type) {
      case "click":
        return "bg-blue-500"
      case "error":
        return "bg-red-500"
      case "navigation":
        return "bg-green-500"
      case "input":
        return "bg-purple-500"
      default:
        return "bg-gray-500"
    }
  }

  if (error) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center h-[500px] bg-muted/50 rounded-lg border",
          className
        )}
      >
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-sm text-muted-foreground text-center">{error}</p>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Player Container */}
      <div className="relative rounded-lg overflow-hidden border bg-background">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        <div
          ref={containerRef}
          className="w-full min-h-[500px] [&_.rr-player]:!w-full [&_.rr-player__frame]:!w-full [&_.replayer-wrapper]:bg-muted/20"
        />
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-2 p-4 border rounded-lg bg-card">
        {/* Progress bar with markers */}
        <div className="relative">
          {/* Timeline */}
          <div
            className="h-2 bg-muted rounded-full cursor-pointer relative overflow-visible"
            onClick={handleSeek}
          >
            {/* Progress */}
            <div
              className="absolute left-0 top-0 h-full bg-primary rounded-full transition-all duration-100"
              style={{
                width: totalTime > 0 ? `${(currentTime / totalTime) * 100}%` : "0%",
              }}
            />

            {/* Event markers */}
            {eventMarkers.map((marker, index) => (
              <button
                key={`${marker.type}-${marker.timestamp}-${index}`}
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full cursor-pointer hover:scale-125 transition-transform z-10 flex items-center justify-center",
                  getMarkerColor(marker.type)
                )}
                style={{
                  left:
                    totalTime > 0
                      ? `${(marker.timestamp / totalTime) * 100}%`
                      : "0%",
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  handleMarkerClick(marker)
                }}
                title={marker.description}
              >
                <span className="text-white">{getMarkerIcon(marker.type)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Control buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => handleSkip(-10000)}>
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button variant="default" size="icon" onClick={handlePlay}>
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleSkip(10000)}>
              <SkipForward className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1"
              onClick={handleSpeedChange}
            >
              <FastForward className="h-4 w-4" />
              <span className="text-xs">{playbackSpeed}x</span>
            </Button>
          </div>

          <div className="flex items-center gap-4">
            {/* Time display */}
            <span className="text-sm font-mono text-muted-foreground">
              {formatTime(currentTime)} / {formatTime(totalTime)}
            </span>

            {/* Marker legend */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span>Click</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span>Error</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span>Nav</span>
              </div>
            </div>
          </div>
        </div>

        {/* Event marker summary */}
        {eventMarkers.length > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t">
            <span className="text-xs text-muted-foreground">Events:</span>
            <Badge variant="secondary" className="text-xs">
              {eventMarkers.filter((m) => m.type === "click").length} clicks
            </Badge>
            <Badge
              variant="secondary"
              className="text-xs bg-red-500/10 text-red-500"
            >
              {eventMarkers.filter((m) => m.type === "error").length} errors
            </Badge>
            <Badge
              variant="secondary"
              className="text-xs bg-green-500/10 text-green-500"
            >
              {eventMarkers.filter((m) => m.type === "navigation").length} navigations
            </Badge>
          </div>
        )}
      </div>
    </div>
  )
}
