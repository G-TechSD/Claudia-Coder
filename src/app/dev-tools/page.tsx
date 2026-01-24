"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { InstallationWizard } from "@/components/dev-tools/installation-wizard"
import { ToolStatusBadge } from "@/components/dev-tools/tool-status-badge"
import { DevToolStatus, DevToolId } from "@/lib/dev-tools/types"
import { Terminal, Code2, Sparkles, RefreshCw, Wrench, ArrowRight } from "lucide-react"
import Link from "next/link"

const TOOL_ICONS: Record<DevToolId, React.ElementType> = {
  "claude-code": Terminal,
  ganesha: Sparkles,
  vscode: Code2,
}

const TOOL_DESCRIPTIONS: Record<DevToolId, string> = {
  "claude-code": "Anthropic's official AI coding assistant CLI",
  ganesha: "Ganesha AI with flux mode for autonomous development",
  vscode: "Visual Studio Code in the browser",
}

const TOOL_LINKS: Record<DevToolId, string> = {
  "claude-code": "/claude-code",
  ganesha: "/dev-tools/ganesha",
  vscode: "/dev-tools/vscode",
}

export default function DevToolsPage() {
  const searchParams = useSearchParams()
  const installTool = searchParams.get("install") as DevToolId | null

  const [tools, setTools] = useState<DevToolStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [showInstaller, setShowInstaller] = useState(!!installTool)

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/dev-tools/status?refresh=true")
      if (response.ok) {
        const data = await response.json()
        setTools(data.tools)
      }
    } catch (error) {
      console.error("Failed to fetch tool status:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const installedCount = tools.filter((t) => t.status === "installed").length
  const totalCount = tools.length

  return (
    <div className="container max-w-5xl py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                <Wrench className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Dev Tools</h1>
                <p className="text-sm text-muted-foreground">
                  Manage your development tools and IDEs
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {installedCount}/{totalCount} installed
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStatus}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Tool Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {tools.map((tool) => {
            const Icon = TOOL_ICONS[tool.id]
            const isInstalled = tool.status === "installed"

            return (
              <Card
                key={tool.id}
                className={isInstalled ? "border-green-500/20 bg-green-500/5" : ""}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5" />
                      <CardTitle className="text-lg">{tool.name}</CardTitle>
                    </div>
                    <ToolStatusBadge status={tool.status} version={tool.version} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CardDescription>{TOOL_DESCRIPTIONS[tool.id]}</CardDescription>

                  {isInstalled ? (
                    <Link href={TOOL_LINKS[tool.id]}>
                      <Button className="w-full gap-2">
                        Open {tool.name}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowInstaller(true)}
                    >
                      Install
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Installation Wizard */}
        {showInstaller && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Installation</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowInstaller(false)}
                >
                  Close
                </Button>
              </div>
              <CardDescription>
                Install development tools to use them in Claudia Coder
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InstallationWizard
                tools={tools}
                onRefresh={fetchStatus}
                defaultTool={installTool || undefined}
              />
            </CardContent>
          </Card>
        )}

        {/* Quick Access Section */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Access</CardTitle>
            <CardDescription>
              Jump to a tool with a project already open
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {tools
                .filter((t) => t.status === "installed")
                .map((tool) => {
                  const Icon = TOOL_ICONS[tool.id]

                  return (
                    <Link key={tool.id} href={TOOL_LINKS[tool.id]}>
                      <Button variant="outline" className="w-full h-20 gap-3">
                        <Icon className="h-6 w-6" />
                        <div className="text-left">
                          <div className="font-medium">{tool.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Click to open
                          </div>
                        </div>
                      </Button>
                    </Link>
                  )
                })}

              {tools.filter((t) => t.status === "installed").length === 0 && (
                <div className="col-span-3 text-center py-8 text-muted-foreground">
                  <Wrench className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No tools installed yet</p>
                  <Button
                    variant="link"
                    onClick={() => setShowInstaller(true)}
                    className="mt-2"
                  >
                    Install a tool to get started
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
    </div>
  )
}
