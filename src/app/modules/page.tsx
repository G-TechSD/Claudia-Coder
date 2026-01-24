"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import {
  Puzzle,
  Sparkles,
  Terminal,
  Code2,
  Film,
  Lightbulb,
  Rocket,
  RefreshCw,
  Plus,
  ArrowRight,
  Clock,
  Eye,
  Trash2,
  ExternalLink,
  AlertCircle,
} from "lucide-react"
import Link from "next/link"
import { StoredModule, ModuleCategory } from "@/lib/emergent-modules/types"

// Icon mapping
const ICON_MAP: Record<string, React.ElementType> = {
  Film: Film,
  Sparkles: Sparkles,
  Terminal: Terminal,
  Code2: Code2,
  Lightbulb: Lightbulb,
  Rocket: Rocket,
  Puzzle: Puzzle,
}

// Category colors
const CATEGORY_COLORS: Record<ModuleCategory, string> = {
  creative: "bg-pink-500/10 text-pink-500 border-pink-500/20",
  productivity: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  development: "bg-green-500/10 text-green-500 border-green-500/20",
  data: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  communication: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  experimental: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  other: "bg-gray-500/10 text-gray-500 border-gray-500/20",
}

export default function ModulesPage() {
  const [modules, setModules] = useState<StoredModule[]>([])
  const [loading, setLoading] = useState(true)

  const fetchModules = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/emergent-modules")
      if (response.ok) {
        const data = await response.json()
        setModules(data.modules || [])
      }
    } catch (error) {
      console.error("Failed to fetch modules:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchModules()
  }, [fetchModules])

  const toggleModule = async (moduleId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/emergent-modules/${moduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: enabled ? "active" : "disabled" }),
      })

      if (response.ok) {
        fetchModules()
      }
    } catch (error) {
      console.error("Failed to toggle module:", error)
    }
  }

  const deleteModule = async (moduleId: string) => {
    if (!confirm("Are you sure you want to delete this module?")) return

    try {
      const response = await fetch(`/api/emergent-modules/${moduleId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        fetchModules()
      }
    } catch (error) {
      console.error("Failed to delete module:", error)
    }
  }

  const activeCount = modules.filter((m) => m.status === "active").length

  return (
    <div className="container max-w-5xl py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-600">
                <Puzzle className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Emergent Modules</h1>
                <p className="text-sm text-muted-foreground">
                  Features created from within Claudia Coder
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {activeCount}/{modules.length} active
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchModules}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* What are Emergent Modules */}
        <Card className="bg-gradient-to-br from-purple-500/5 to-pink-500/5 border-purple-500/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10">
                <Sparkles className="h-6 w-6 text-purple-500" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">What are Emergent Modules?</h3>
                <p className="text-sm text-muted-foreground">
                  Emergent modules are features that didn't exist in the original Claudia Coder codebase.
                  They emerge when you work with Claude Code or Ganesha to extend the platform's capabilities.
                  This is the evolution of software: <strong>code that writes code that becomes part of the system</strong>.
                </p>
                <div className="flex items-center gap-4 pt-2">
                  <Link href="/claude-code">
                    <Button variant="outline" size="sm" className="gap-2">
                      <Terminal className="h-4 w-4" />
                      Open Claude Code
                    </Button>
                  </Link>
                  <Link href="/dev-tools/ganesha">
                    <Button variant="outline" size="sm" className="gap-2">
                      <Sparkles className="h-4 w-4" />
                      Open Ganesha AI
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Module Cards */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Installed Modules</h2>

          {modules.length === 0 && !loading && (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Puzzle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="font-medium mb-1">No modules yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create your first emergent module by working with Claude Code or Ganesha
                </p>
                <Link href="/claude-code">
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create Module with Claude Code
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4">
            {modules.map((module) => {
              const IconComponent = ICON_MAP[module.icon] || Sparkles
              const isActive = module.status === "active"

              return (
                <Card key={module.id} className={cn(!isActive && "opacity-60")}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-lg",
                          isActive ? "bg-purple-500/10" : "bg-gray-500/10"
                        )}>
                          <IconComponent className={cn(
                            "h-5 w-5",
                            isActive ? "text-purple-500" : "text-gray-500"
                          )} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base">{module.name}</CardTitle>
                            {module.experimental && (
                              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/20">
                                Experimental
                              </Badge>
                            )}
                            <Badge variant="outline" className={cn("text-[10px]", CATEGORY_COLORS[module.category])}>
                              {module.category}
                            </Badge>
                          </div>
                          <CardDescription className="text-sm mt-1">
                            {module.description}
                          </CardDescription>
                        </div>
                      </div>
                      <Switch
                        checked={isActive}
                        onCheckedChange={(checked) => toggleModule(module.id, checked)}
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Created {new Date(module.createdAt).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {module.accessCount || 0} views
                        </span>
                        <span>by {module.author}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteModule(module.id)}
                          className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <Link href={module.route}>
                          <Button size="sm" disabled={!isActive} className="gap-2">
                            Open
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {/* How to Create a Module */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              How to Create an Emergent Module
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 p-4 rounded-lg bg-muted/50">
                <h4 className="font-medium flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                  Open Claude Code or Ganesha
                </h4>
                <p className="text-sm text-muted-foreground">
                  Start a session with Claude Code or Ganesha AI. The working directory is already set to Claudia Coder's repo.
                </p>
              </div>
              <div className="space-y-2 p-4 rounded-lg bg-muted/50">
                <h4 className="font-medium flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                  Describe Your Module
                </h4>
                <p className="text-sm text-muted-foreground">
                  Tell the AI what you want. For example: "Create a module called ASCII Movies that generates text-based animations."
                </p>
              </div>
              <div className="space-y-2 p-4 rounded-lg bg-muted/50">
                <h4 className="font-medium flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
                  AI Creates the Files
                </h4>
                <p className="text-sm text-muted-foreground">
                  The AI will create the necessary page, components, and register the module in the system.
                </p>
              </div>
              <div className="space-y-2 p-4 rounded-lg bg-muted/50">
                <h4 className="font-medium flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">4</span>
                  Module Appears in Sidebar
                </h4>
                <p className="text-sm text-muted-foreground">
                  Once created, your emergent module will appear in the sidebar under "Emergent Modules" for instant access.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <h4 className="font-medium text-purple-500 mb-2">Example Prompt</h4>
              <code className="block text-sm bg-black/20 p-3 rounded">
                "Create an emergent module for Claudia Coder called 'ASCII Movies' that lets users generate and play ASCII art animations. Include a gallery of pre-made animations and a simple editor to create new ones."
              </code>
            </div>
          </CardContent>
        </Card>
    </div>
  )
}
