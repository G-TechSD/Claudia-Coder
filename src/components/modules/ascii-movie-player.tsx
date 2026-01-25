"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Play, Pause, SkipBack, SkipForward, RefreshCw, Maximize2, Minimize2 } from "lucide-react"
import { AsciiMovie } from "@/lib/ascii-movies/generator"

interface AsciiMoviePlayerProps {
  movie: AsciiMovie
  autoPlay?: boolean
  loop?: boolean
  className?: string
  onEnded?: () => void
}

export function AsciiMoviePlayer({
  movie,
  autoPlay = true,
  loop = true,
  className,
  onEnded,
}: AsciiMoviePlayerProps) {
  const [currentFrame, setCurrentFrame] = useState(0)
  const [isPlaying, setIsPlaying] = useState(autoPlay)
  const [fps, setFps] = useState(movie.defaultFps)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const totalFrames = movie.frames.length

  // Handle frame advancement
  const advanceFrame = useCallback(() => {
    setCurrentFrame((prev) => {
      const next = prev + 1
      if (next >= totalFrames) {
        if (loop) {
          return 0
        } else {
          setIsPlaying(false)
          onEnded?.()
          return prev
        }
      }
      return next
    })
  }, [totalFrames, loop, onEnded])

  // Playback control
  useEffect(() => {
    if (isPlaying) {
      const frameDuration = movie.frames[currentFrame]?.duration || 1000 / fps
      intervalRef.current = setTimeout(advanceFrame, frameDuration)
    }

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current)
      }
    }
  }, [isPlaying, currentFrame, fps, movie.frames, advanceFrame])

  // Controls
  const togglePlay = () => setIsPlaying(!isPlaying)

  const restart = () => {
    setCurrentFrame(0)
    setIsPlaying(true)
  }

  const stepForward = () => {
    setIsPlaying(false)
    setCurrentFrame((prev) => (prev + 1) % totalFrames)
  }

  const stepBackward = () => {
    setIsPlaying(false)
    setCurrentFrame((prev) => (prev - 1 + totalFrames) % totalFrames)
  }

  const toggleFullscreen = async () => {
    if (!containerRef.current) return

    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen()
      setIsFullscreen(true)
    } else {
      await document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  // Fullscreen change handler
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange)
  }, [])

  const frame = movie.frames[currentFrame]

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col bg-black rounded-lg overflow-hidden",
        isFullscreen && "fixed inset-0 z-50",
        className
      )}
    >
      {/* Movie Display */}
      <div className={cn(
        "flex-1 flex items-center justify-center p-4 overflow-auto",
        isFullscreen && "p-8"
      )}>
        <pre
          className={cn(
            "font-mono text-green-400 leading-tight select-none",
            isFullscreen ? "text-lg" : "text-sm"
          )}
          style={{
            textShadow: "0 0 10px rgba(0, 255, 0, 0.3)",
          }}
        >
          {frame?.content.join("\n")}
        </pre>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 p-3 bg-gray-900 border-t border-gray-800">
        <Button
          variant="ghost"
          size="icon"
          onClick={stepBackward}
          className="h-8 w-8 text-gray-400 hover:text-white"
        >
          <SkipBack className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={togglePlay}
          className="h-8 w-8 text-gray-400 hover:text-white"
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={stepForward}
          className="h-8 w-8 text-gray-400 hover:text-white"
        >
          <SkipForward className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={restart}
          className="h-8 w-8 text-gray-400 hover:text-white"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>

        {/* Frame counter */}
        <span className="text-xs text-gray-500 font-mono min-w-[60px]">
          {currentFrame + 1} / {totalFrames}
        </span>

        {/* Progress bar */}
        <div className="flex-1 mx-2">
          <input
            type="range"
            value={currentFrame}
            max={totalFrames - 1}
            step={1}
            onChange={(e) => {
              setIsPlaying(false)
              setCurrentFrame(Number(e.target.value))
            }}
            className="w-full cursor-pointer accent-green-500"
          />
        </div>

        {/* FPS control */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">FPS:</span>
          <input
            type="range"
            value={fps}
            min={1}
            max={30}
            step={1}
            onChange={(e) => setFps(Number(e.target.value))}
            className="w-20 cursor-pointer accent-green-500"
          />
          <span className="text-xs text-gray-400 font-mono w-6">{fps}</span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleFullscreen}
          className="h-8 w-8 text-gray-400 hover:text-white"
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}
