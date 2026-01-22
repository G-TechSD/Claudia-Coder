"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import {
  Lightbulb,
  Play,
  FileText,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Plus,
  Rocket,
  Brain,
  BarChart3,
  ListChecks,
  Eye,
  Download,
  Copy,
  Check
} from "lucide-react"
import { cn } from "@/lib/utils"

// Minimal packet type for ideation - works with both WorkPacket and simplified packets
interface IdeationPacket {
  id: string
  title: string
  description: string
  type: string
  status: string
  tasks: { id: string; description: string; completed: boolean }[]
  metadata?: {
    originalPrompt?: string
    outputFormat?: string
  }
}

interface IdeasModuleProps {
  projectId: string
  projectName: string
  projectDescription: string
  packets: IdeationPacket[]
  workingDirectory?: string
  onPacketUpdate?: (packetId: string, updates: Partial<IdeationPacket>) => void
  onCreateCodingProject?: (idea: string, description: string) => void
  className?: string
}

interface PacketResult {
  packetId: string
  content: string
  generatedAt: string
  status: "pending" | "generating" | "complete" | "error"
  error?: string
}

// Get icon for packet type
function getPacketIcon(type: string) {
  switch (type) {
    case "brainstorm":
      return Lightbulb
    case "analysis":
      return BarChart3
    case "research":
      return Brain
    case "report":
      return FileText
    default:
      return ListChecks
  }
}

// Get color for packet type
function getPacketColor(type: string) {
  switch (type) {
    case "brainstorm":
      return "text-yellow-500"
    case "analysis":
      return "text-blue-500"
    case "research":
      return "text-purple-500"
    case "report":
      return "text-green-500"
    default:
      return "text-muted-foreground"
  }
}

export function IdeasModule({
  projectId,
  projectName,
  projectDescription,
  packets,
  workingDirectory,
  onPacketUpdate,
  onCreateCodingProject,
  className
}: IdeasModuleProps) {
  const [results, setResults] = useState<Record<string, PacketResult>>({})
  const [selectedPacket, setSelectedPacket] = useState<string | null>(null)
  const [isExecutingAll, setIsExecutingAll] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Filter to only ideation packets
  const ideationPackets = packets.filter(p =>
    ["brainstorm", "analysis", "research", "report"].includes(p.type)
  )

  // Execute a single ideation packet
  const executePacket = useCallback(async (packet: IdeationPacket) => {
    const packetId = packet.id

    setResults(prev => ({
      ...prev,
      [packetId]: {
        packetId,
        content: "",
        generatedAt: "",
        status: "generating"
      }
    }))

    try {
      // Get the prompt from the packet
      const prompt = packet.metadata?.originalPrompt ||
        packet.tasks[0]?.description ||
        `${packet.title}: ${packet.description}`

      // Call the ideation execution API
      const response = await fetch("/api/ideation/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          packetId,
          prompt,
          outputFormat: packet.metadata?.outputFormat || "markdown",
          workingDirectory,
          context: {
            projectName,
            projectDescription,
            packetTitle: packet.title,
            packetType: packet.type
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate content")
      }

      const data = await response.json()

      setResults(prev => ({
        ...prev,
        [packetId]: {
          packetId,
          content: data.content,
          generatedAt: new Date().toISOString(),
          status: "complete"
        }
      }))

      // Update packet status
      onPacketUpdate?.(packetId, { status: "completed" })

    } catch (error) {
      setResults(prev => ({
        ...prev,
        [packetId]: {
          packetId,
          content: "",
          generatedAt: "",
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error"
        }
      }))
    }
  }, [projectId, projectName, projectDescription, workingDirectory, onPacketUpdate])

  // Execute all pending packets
  const executeAll = useCallback(async () => {
    setIsExecutingAll(true)

    const pendingPackets = ideationPackets.filter(p =>
      p.status !== "completed" && results[p.id]?.status !== "complete"
    )

    for (const packet of pendingPackets) {
      await executePacket(packet)
    }

    setIsExecutingAll(false)
  }, [ideationPackets, results, executePacket])

  // Copy content to clipboard
  const copyContent = useCallback(async (packetId: string, content: string) => {
    await navigator.clipboard.writeText(content)
    setCopiedId(packetId)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  // Download as markdown file
  const downloadMarkdown = useCallback((packet: IdeationPacket, content: string) => {
    const filename = `${packet.title.toLowerCase().replace(/\s+/g, "-")}.md`
    const blob = new Blob([content], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  // Calculate progress
  const completedCount = ideationPackets.filter(p =>
    p.status === "completed" || results[p.id]?.status === "complete"
  ).length
  const progressPercent = ideationPackets.length > 0
    ? Math.round((completedCount / ideationPackets.length) * 100)
    : 0

  if (ideationPackets.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-12 text-center">
          <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-medium mb-2">No Research Tasks</h3>
          <p className="text-sm text-muted-foreground">
            This project doesn't have any ideation or research packets.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with progress */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                Ideas & Research
              </CardTitle>
              <CardDescription>
                {completedCount} of {ideationPackets.length} tasks complete
              </CardDescription>
            </div>
            <Button
              onClick={executeAll}
              disabled={isExecutingAll || completedCount === ideationPackets.length}
            >
              {isExecutingAll ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run All
                </>
              )}
            </Button>
          </div>
          <Progress value={progressPercent} className="mt-3" />
        </CardHeader>
      </Card>

      {/* Packets list */}
      <div className="grid gap-4 md:grid-cols-2">
        {ideationPackets.map((packet) => {
          const Icon = getPacketIcon(packet.type)
          const color = getPacketColor(packet.type)
          const result = results[packet.id]
          const isComplete = packet.status === "completed" || result?.status === "complete"
          const isGenerating = result?.status === "generating"
          const hasError = result?.status === "error"

          return (
            <Card
              key={packet.id}
              className={cn(
                "cursor-pointer transition-all",
                selectedPacket === packet.id && "ring-2 ring-primary",
                isComplete && "bg-green-500/5 border-green-500/30"
              )}
              onClick={() => setSelectedPacket(
                selectedPacket === packet.id ? null : packet.id
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-5 w-5", color)} />
                    <div>
                      <CardTitle className="text-base">{packet.title}</CardTitle>
                      <Badge variant="outline" className="mt-1 capitalize text-xs">
                        {packet.type}
                      </Badge>
                    </div>
                  </div>
                  {isComplete && (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  )}
                  {isGenerating && (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  {packet.description}
                </p>

                {/* Error display */}
                {hasError && (
                  <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-500 mb-3">
                    {result.error}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {!isComplete && !isGenerating && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        executePacket(packet)
                      }}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Generate
                    </Button>
                  )}
                  {isComplete && result?.content && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedPacket(packet.id)
                        }}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          copyContent(packet.id, result.content)
                        }}
                      >
                        {copiedId === packet.id ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          downloadMarkdown(packet, result.content)
                        }}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                  {isGenerating && (
                    <Button size="sm" variant="outline" disabled>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Generating...
                    </Button>
                  )}
                  {(isComplete || hasError) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        executePacket(packet)
                      }}
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Content viewer */}
      {selectedPacket && results[selectedPacket]?.content && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {ideationPackets.find(p => p.id === selectedPacket)?.title}
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyContent(selectedPacket, results[selectedPacket].content)}
                >
                  {copiedId === selectedPacket ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const packet = ideationPackets.find(p => p.id === selectedPacket)
                    if (packet) downloadMarkdown(packet, results[selectedPacket].content)
                  }}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] border rounded-lg">
              <div className="p-4 prose prose-sm dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm">
                  {results[selectedPacket].content}
                </pre>
              </div>
            </ScrollArea>

            {/* Create project from this idea */}
            {onCreateCodingProject && (
              <div className="mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    const packet = ideationPackets.find(p => p.id === selectedPacket)
                    if (packet) {
                      onCreateCodingProject(packet.title, results[selectedPacket].content)
                    }
                  }}
                >
                  <Rocket className="h-4 w-4 mr-2" />
                  Create Coding Project from this Idea
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
