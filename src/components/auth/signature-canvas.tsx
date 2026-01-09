"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Eraser } from "lucide-react"

interface SignatureCanvasProps {
  onSignatureChange: (signature: string | null) => void
  className?: string
}

export function SignatureCanvas({
  onSignatureChange,
  className,
}: SignatureCanvasProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = React.useState(false)
  const [hasSignature, setHasSignature] = React.useState(false)

  const getCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ): { x: number; y: number } | null => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()

    if ("touches" in e) {
      const touch = e.touches[0]
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      }
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
    }
  }

  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const coords = getCoordinates(e)
    if (!coords) return

    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!ctx) return

    ctx.beginPath()
    ctx.moveTo(coords.x, coords.y)
    setIsDrawing(true)
  }

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing) return

    const coords = getCoordinates(e)
    if (!coords) return

    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!ctx) return

    ctx.lineTo(coords.x, coords.y)
    ctx.stroke()
    setHasSignature(true)
  }

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false)
      const canvas = canvasRef.current
      if (canvas && hasSignature) {
        onSignatureChange(canvas.toDataURL("image/png"))
      }
    }
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!ctx || !canvas) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
    onSignatureChange(null)
  }

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set up canvas styling
    ctx.strokeStyle = "#22c55e" // green-500
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
  }, [])

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={400}
          height={150}
          className="w-full border border-input rounded-md bg-background cursor-crosshair touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-muted-foreground text-sm">
              Draw your signature here
            </span>
          </div>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={clearCanvas}
        disabled={!hasSignature}
      >
        <Eraser className="h-4 w-4 mr-2" />
        Clear Signature
      </Button>
    </div>
  )
}
