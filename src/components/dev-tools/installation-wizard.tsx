"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToolStatusBadge } from "./tool-status-badge"
import { DevToolId, DevToolStatus, InstallProgressEvent } from "@/lib/dev-tools/types"
import { Terminal, Code2, Sparkles, Download, Copy, Check, ExternalLink, RefreshCw } from "lucide-react"

const TOOL_ICONS: Record<DevToolId, React.ElementType> = {
  "claude-code": Terminal,
  ganesha: Sparkles,
  vscode: Code2,
}

const TOOL_INSTALL_COMMANDS: Record<DevToolId, string> = {
  "claude-code": "npm install -g @anthropic-ai/claude-code",
  ganesha: "curl -sSL https://ganesha.dev/install.sh | bash",
  vscode: "curl -fsSL https://code-server.dev/install.sh | sh",
}

const TOOL_DESCRIPTIONS: Record<DevToolId, string> = {
  "claude-code": "Anthropic's official AI coding assistant CLI. Helps you write, debug, and understand code.",
  ganesha: "Ganesha AI coding assistant with flux mode for continuous autonomous development.",
  vscode: "Visual Studio Code in the browser via code-server. Full IDE experience.",
}

interface InstallationWizardProps {
  tools: DevToolStatus[]
  onRefresh: () => void
  defaultTool?: DevToolId
  className?: string
}

export function InstallationWizard({
  tools,
  onRefresh,
  defaultTool,
  className,
}: InstallationWizardProps) {
  const [selectedTool, setSelectedTool] = useState<DevToolId | null>(defaultTool || null)
  const [installMode, setInstallMode] = useState<"auto" | "manual">("manual")
  const [installing, setInstalling] = useState(false)
  const [installOutput, setInstallOutput] = useState<string>("")
  const [copied, setCopied] = useState(false)
  const outputRef = useRef<HTMLPreElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [installOutput])

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  const copyCommand = useCallback(async (command: string) => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      console.error("Failed to copy command")
    }
  }, [])

  const startAutoInstall = useCallback(async (toolId: DevToolId) => {
    setInstalling(true)
    setInstallOutput("")

    try {
      const response = await fetch("/api/dev-tools/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolId }),
      })

      const data = await response.json()

      if (!response.ok) {
        setInstallOutput(`Error: ${data.error}\n`)
        setInstalling(false)
        return
      }

      if (!data.sessionId) {
        // Tool already installed
        setInstallOutput(data.message + "\n")
        setInstalling(false)
        onRefresh()
        return
      }

      // Connect to SSE stream
      const eventSource = new EventSource(`/api/dev-tools/install?sessionId=${data.sessionId}`)
      eventSourceRef.current = eventSource

      eventSource.onmessage = (event) => {
        try {
          const message: InstallProgressEvent = JSON.parse(event.data)

          if (message.type === "output") {
            setInstallOutput((prev) => prev + (message.content || ""))
          } else if (message.type === "complete") {
            setInstallOutput((prev) => prev + (message.content || "\n\nInstallation complete!\n"))
            setInstalling(false)
            eventSource.close()
            onRefresh()
          } else if (message.type === "error") {
            setInstallOutput((prev) => prev + `\nError: ${message.error}\n`)
            setInstalling(false)
            eventSource.close()
          }
        } catch (e) {
          console.error("Failed to parse SSE message:", e)
        }
      }

      eventSource.onerror = () => {
        if (eventSource.readyState === EventSource.CLOSED) {
          setInstalling(false)
        }
      }
    } catch (error) {
      setInstallOutput(`Error: ${error instanceof Error ? error.message : "Installation failed"}\n`)
      setInstalling(false)
    }
  }, [onRefresh])

  const selectedToolData = selectedTool ? tools.find((t) => t.id === selectedTool) : null

  return (
    <div className={cn("space-y-6", className)}>
      {/* Tool Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {tools.map((tool) => {
          const Icon = TOOL_ICONS[tool.id]
          const isSelected = selectedTool === tool.id
          const isInstalled = tool.status === "installed"

          return (
            <Card
              key={tool.id}
              className={cn(
                "cursor-pointer transition-all hover:border-primary/50",
                isSelected && "border-primary ring-2 ring-primary/20",
                isInstalled && "bg-green-500/5"
              )}
              onClick={() => setSelectedTool(tool.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5" />
                    <CardTitle className="text-base">{tool.name}</CardTitle>
                  </div>
                  <ToolStatusBadge status={tool.status} version={tool.version} />
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">
                  {TOOL_DESCRIPTIONS[tool.id]}
                </CardDescription>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Installation Panel */}
      {selectedTool && selectedToolData && selectedToolData.status !== "installed" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Download className="h-5 w-5" />
              Install {selectedToolData.name}
            </CardTitle>
            <CardDescription>
              Choose how you want to install {selectedToolData.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={installMode} onValueChange={(v) => setInstallMode(v as "auto" | "manual")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="manual">Manual Install</TabsTrigger>
                <TabsTrigger value="auto">Auto Install</TabsTrigger>
              </TabsList>

              <TabsContent value="manual" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Run this command in your terminal to install {selectedToolData.name}:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded bg-muted px-3 py-2 font-mono text-sm">
                      {TOOL_INSTALL_COMMANDS[selectedTool]}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyCommand(TOOL_INSTALL_COMMANDS[selectedTool])}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={onRefresh}
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Check Again
                  </Button>
                  <a
                    href={
                      selectedTool === "claude-code"
                        ? "https://www.npmjs.com/package/@anthropic-ai/claude-code"
                        : selectedTool === "ganesha"
                        ? "https://ganesha.dev"
                        : "https://coder.com/docs/code-server/latest"
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    View Documentation
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </TabsContent>

              <TabsContent value="auto" className="space-y-4 mt-4">
                {!installing && installOutput === "" && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Click the button below to automatically install {selectedToolData.name}.
                      This will run the installation command and show the progress below.
                    </p>
                    <Button
                      onClick={() => startAutoInstall(selectedTool)}
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Install {selectedToolData.name}
                    </Button>
                  </div>
                )}

                {(installing || installOutput !== "") && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Installation Output</span>
                      {installing && (
                        <span className="text-xs text-muted-foreground animate-pulse">
                          Installing...
                        </span>
                      )}
                    </div>
                    <pre
                      ref={outputRef}
                      className="h-64 overflow-auto rounded bg-black p-4 font-mono text-xs text-green-400"
                    >
                      {installOutput || "Starting installation...\n"}
                    </pre>
                    {!installing && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setInstallOutput("")
                          }}
                        >
                          Clear
                        </Button>
                        <Button
                          variant="outline"
                          onClick={onRefresh}
                          className="gap-2"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Check Status
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Already Installed Message */}
      {selectedTool && selectedToolData && selectedToolData.status === "installed" && (
        <Card className="bg-green-500/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Check className="h-8 w-8 text-green-500" />
              <div>
                <p className="font-medium">{selectedToolData.name} is installed!</p>
                <p className="text-sm text-muted-foreground">
                  Version {selectedToolData.version}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
