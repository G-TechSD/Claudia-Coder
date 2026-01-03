"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { VoiceControlPanel } from "./voice-control-panel"
import { Mic, X } from "lucide-react"
import { cn } from "@/lib/utils"

export function GlobalVoiceButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Floating voice button */}
      <Button
        size="icon"
        className={cn(
          "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-40",
          "transition-all hover:scale-110",
          isOpen && "bg-red-500 hover:bg-red-600"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Mic className="h-6 w-6" />
        )}
      </Button>

      {/* Slide-out panel */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 w-full max-w-md z-30 transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Backdrop */}
        <div
          className={cn(
            "absolute inset-0 bg-black/50 transition-opacity",
            isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={() => setIsOpen(false)}
        />

        {/* Panel */}
        <div className="absolute right-0 h-full w-full max-w-md bg-background border-l shadow-xl">
          <VoiceControlPanel
            className="h-full border-0 rounded-none"
            onClose={() => setIsOpen(false)}
          />
        </div>
      </div>
    </>
  )
}
