"use client"

import { useState } from "react"
import { GiteaEmbed } from "@/components/gitea/gitea-embed"
import { GitBranch, Maximize2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function GiteaPage() {
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Show fullscreen embed if active
  if (isFullscreen) {
    return (
      <GiteaEmbed
        className="h-screen"
        onFullscreenChange={(fs) => setIsFullscreen(fs)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20">
            <GitBranch className="h-6 w-6 text-green-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Git Repositories</h1>
            <p className="text-sm text-muted-foreground">
              Gitea - Self-hosted Git service
            </p>
          </div>
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={() => setIsFullscreen(true)}
          className="gap-2"
        >
          <Maximize2 className="h-4 w-4" />
          Fullscreen
        </Button>
      </div>

      {/* Gitea Embed */}
      <div className="flex-1 min-h-[600px]">
        <GiteaEmbed
          className="h-full"
          onFullscreenChange={(fs) => setIsFullscreen(fs)}
        />
      </div>
    </div>
  )
}
