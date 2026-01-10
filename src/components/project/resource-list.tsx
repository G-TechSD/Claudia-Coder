"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip"
import {
  FileText,
  Braces,
  Table,
  Image as ImageIcon,
  Mic,
  File,
  Download,
  Trash2,
  Play,
  Eye,
  MoreHorizontal,
  Loader2,
  X,
  Package,
  CheckCircle2,
  AlertCircle
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  ProjectResource,
  ResourceType,
  TranscriptionData
} from "@/lib/data/types"
import {
  getResourcesForProject,
  deleteResource,
  getResourceBlobUrl,
  getResourceBlob,
  updateResource,
  formatFileSize
} from "@/lib/data/resources"
import { useTranscription } from "@/hooks/useTranscription"

interface ResourceListProps {
  projectId: string
  onTranscribe?: (resource: ProjectResource) => void
  onPacketCreate?: (transcription: TranscriptionData, resource: ProjectResource) => void
  className?: string
}

const resourceIcons: Record<ResourceType, typeof FileText> = {
  markdown: FileText,
  json: Braces,
  csv: Table,
  image: ImageIcon,
  audio: Mic,
  pdf: FileText,
  other: File
}

const filterOptions: { value: ResourceType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "audio", label: "Audio" },
  { value: "image", label: "Images" },
  { value: "markdown", label: "Markdown" },
  { value: "json", label: "JSON" },
  { value: "csv", label: "CSV" },
  { value: "pdf", label: "PDF" },
  { value: "other", label: "Other" }
]

export function ResourceList({
  projectId,
  onTranscribe,
  onPacketCreate,
  className
}: ResourceListProps) {
  const [resources, setResources] = useState<ProjectResource[]>([])
  const [filter, setFilter] = useState<ResourceType | "all">("all")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewResource, setPreviewResource] = useState<ProjectResource | null>(null)

  // Transcription state
  const [transcribingResourceId, setTranscribingResourceId] = useState<string | null>(null)
  const [transcriptionModalOpen, setTranscriptionModalOpen] = useState(false)
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionData | null>(null)
  const [transcriptionResource, setTranscriptionResource] = useState<ProjectResource | null>(null)
  const [creatingPacket, setCreatingPacket] = useState(false)

  const {
    isTranscribing,
    progress,
    method,
    result: transcriptionHookResult,
    error: transcriptionError,
    transcribe,
    reset: resetTranscription
  } = useTranscription()

  useEffect(() => {
    loadResources()
  }, [projectId])

  function loadResources() {
    const loaded = getResourcesForProject(projectId)
    setResources(loaded)
  }

  // Handle transcription for a resource
  async function handleTranscribe(resource: ProjectResource) {
    if (!resource.indexedDbKey) {
      console.error("Resource has no IndexedDB key")
      return
    }

    setTranscribingResourceId(resource.id)
    setTranscriptionResource(resource)

    try {
      // Get the audio blob from IndexedDB
      const blob = await getResourceBlob(resource.indexedDbKey)
      if (!blob) {
        console.error("Could not load audio blob")
        setTranscribingResourceId(null)
        return
      }

      // Run transcription
      const result = await transcribe(blob)

      if (result) {
        // Save transcription to resource
        updateResource(resource.id, { transcription: result })

        // Update local state
        setResources(prev => prev.map(r =>
          r.id === resource.id ? { ...r, transcription: result } : r
        ))

        // Show result modal
        setTranscriptionResult(result)
        setTranscriptionModalOpen(true)
      }
    } catch (err) {
      console.error("Transcription failed:", err)
    } finally {
      setTranscribingResourceId(null)
    }
  }

  // Handle creating a packet from transcription
  async function handleCreatePacket() {
    if (!transcriptionResult || !transcriptionResource) return

    setCreatingPacket(true)

    try {
      // Create a packet from the transcription
      const packet = {
        id: `packet-${Date.now()}`,
        title: `From: ${transcriptionResource.name}`,
        description: transcriptionResult.text.slice(0, 200) + (transcriptionResult.text.length > 200 ? "..." : ""),
        type: "feature",
        priority: "medium",
        status: "pending",
        tasks: [
          {
            id: `task-${Date.now()}`,
            description: "Review transcription content",
            completed: false
          }
        ],
        acceptanceCriteria: ["Transcription content has been reviewed and processed"],
        createdAt: new Date().toISOString(),
        sourceResourceId: transcriptionResource.id,
        fullTranscription: transcriptionResult.text
      }

      // Save packet to localStorage
      const storedPackets = localStorage.getItem("claudia_packets")
      const allPackets = storedPackets ? JSON.parse(storedPackets) : {}
      const projectPackets = allPackets[projectId] || []
      projectPackets.push(packet)
      allPackets[projectId] = projectPackets
      localStorage.setItem("claudia_packets", JSON.stringify(allPackets))

      // Callback to parent
      onPacketCreate?.(transcriptionResult, transcriptionResource)

      // Close modal
      setTranscriptionModalOpen(false)
      setTranscriptionResult(null)
      setTranscriptionResource(null)
      resetTranscription()
    } catch (err) {
      console.error("Failed to create packet:", err)
    } finally {
      setCreatingPacket(false)
    }
  }

  function closeTranscriptionModal() {
    setTranscriptionModalOpen(false)
    setTranscriptionResult(null)
    setTranscriptionResource(null)
    resetTranscription()
  }

  const filteredResources = filter === "all"
    ? resources
    : resources.filter(r => r.type === filter)

  async function handlePreview(resource: ProjectResource) {
    if (resource.storage === "indexeddb" && resource.indexedDbKey) {
      const url = await getResourceBlobUrl(resource.indexedDbKey)
      if (url) {
        setPreviewUrl(url)
        setPreviewResource(resource)
      }
    }
  }

  async function handleDownload(resource: ProjectResource) {
    if (resource.storage === "indexeddb" && resource.indexedDbKey) {
      const url = await getResourceBlobUrl(resource.indexedDbKey)
      if (url) {
        const a = document.createElement("a")
        a.href = url
        a.download = resource.name
        a.click()
        URL.revokeObjectURL(url)
      }
    } else if (resource.storage === "filepath" && resource.filePath) {
      // For file paths, we'd need system integration
      alert(`File path: ${resource.filePath}`)
    }
  }

  async function handleDelete(resource: ProjectResource) {
    if (confirm(`Delete "${resource.name}"?`)) {
      await deleteResource(resource.id)
      loadResources()
    }
  }

  function closePreview() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(null)
    setPreviewResource(null)
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    })
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {filterOptions.map(option => {
          const count = option.value === "all"
            ? resources.length
            : resources.filter(r => r.type === option.value).length

          if (count === 0 && option.value !== "all") return null

          return (
            <Button
              key={option.value}
              variant={filter === option.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(option.value)}
              className="h-7"
            >
              {option.label}
              <Badge
                variant="secondary"
                className={cn(
                  "ml-1.5 h-5 px-1.5",
                  filter === option.value && "bg-primary-foreground/20"
                )}
              >
                {count}
              </Badge>
            </Button>
          )
        })}
      </div>

      {/* Resource grid */}
      {filteredResources.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <File className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {filter === "all"
                ? "No resources attached yet."
                : `No ${filter} files.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredResources.map(resource => {
            const Icon = resourceIcons[resource.type]
            const isAudio = resource.type === "audio"
            const isImage = resource.type === "image"
            const hasTranscription = resource.transcription?.text

            return (
              <Card key={resource.id} className="group hover:border-primary/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={cn(
                      "p-2 rounded-lg",
                      isAudio && "bg-purple-500/10 text-purple-500",
                      isImage && "bg-blue-500/10 text-blue-500",
                      !isAudio && !isImage && "bg-muted"
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{resource.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(resource.size)} • {formatDate(resource.createdAt)}
                      </p>
                      {resource.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {resource.description}
                        </p>
                      )}
                      {hasTranscription && (
                        <Badge variant="secondary" className="mt-2 text-xs">
                          Transcribed
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Transcription Progress Bar */}
                  {transcribingResourceId === resource.id && isTranscribing && (
                    <div className="mt-3 pt-3 border-t space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Transcribing...
                        </span>
                        <span className="text-muted-foreground">{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                      {method && (
                        <p className="text-xs text-muted-foreground">
                          Using: {method === "whisper-local"
                            ? "Local Whisper"
                            : method === "openai-whisper"
                              ? "OpenAI Whisper"
                              : "Browser Speech Recognition"}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Transcription Error */}
                  {transcribingResourceId === resource.id && transcriptionError && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center gap-2 text-sm text-red-500">
                        <AlertCircle className="h-4 w-4" />
                        {transcriptionError}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className={cn(
                    "flex items-center gap-1 mt-3 pt-3 border-t transition-opacity",
                    transcribingResourceId === resource.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  )}>
                    {(isImage || isAudio) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePreview(resource)}
                        disabled={transcribingResourceId === resource.id}
                      >
                        {isAudio ? <Play className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                        {isAudio ? "Play" : "View"}
                      </Button>
                    )}

                    {isAudio && !hasTranscription && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTranscribe(resource)}
                              disabled={transcribingResourceId === resource.id || isTranscribing}
                            >
                              {transcribingResourceId === resource.id ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <Mic className="h-4 w-4 mr-1" />
                              )}
                              {transcribingResourceId === resource.id ? "Transcribing..." : "Transcribe"}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[250px]">
                            <p>Transcribe spoken word audio. Not intended for music or other sounds.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}

                    {/* View existing transcription */}
                    {isAudio && hasTranscription && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setTranscriptionResult(resource.transcription!)
                          setTranscriptionResource(resource)
                          setTranscriptionModalOpen(true)
                        }}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        View Transcript
                      </Button>
                    )}

                    <div className="flex-1" />

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDownload(resource)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(resource)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Preview modal */}
      {previewUrl && previewResource && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={closePreview}
        >
          <div
            className="bg-background rounded-lg max-w-4xl max-h-[90vh] overflow-auto p-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">{previewResource.name}</h3>
              <Button variant="ghost" size="sm" onClick={closePreview}>
                Close
              </Button>
            </div>

            {previewResource.type === "image" && (
              <img
                src={previewUrl}
                alt={previewResource.name}
                className="max-w-full rounded"
              />
            )}

            {previewResource.type === "audio" && (
              <div className="space-y-4">
                <audio
                  src={previewUrl}
                  controls
                  className="w-full"
                  autoPlay
                />
                {previewResource.transcription?.text && (
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">Transcription</h4>
                    <p className="text-sm whitespace-pre-wrap">
                      {previewResource.transcription.text}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transcription Result Modal */}
      {transcriptionModalOpen && transcriptionResult && transcriptionResource && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={closeTranscriptionModal}
        >
          <div
            className="bg-background rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <h3 className="font-semibold">Transcription Complete</h3>
                  <p className="text-sm text-muted-foreground">{transcriptionResource.name}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={closeTranscriptionModal}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 px-4 py-3 bg-muted/50 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Words:</span>
                <span className="font-medium">{transcriptionResult.wordCount}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Duration:</span>
                <span className="font-medium">{Math.round(transcriptionResult.duration)}s</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Method:</span>
                <Badge variant="secondary" className="text-xs">
                  {transcriptionResult.method === "whisper-local"
                    ? "Local Whisper"
                    : transcriptionResult.method === "openai-whisper"
                      ? "OpenAI Whisper"
                      : "Browser"}
                </Badge>
              </div>
            </div>

            {/* Transcription Text */}
            <div className="flex-1 overflow-auto p-4">
              <div className="p-4 bg-muted/30 rounded-lg border">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {transcriptionResult.text}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 p-4 border-t bg-muted/20">
              <Button variant="outline" onClick={closeTranscriptionModal}>
                Close
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(transcriptionResult.text)
                  }}
                >
                  Copy Text
                </Button>
                <Button
                  onClick={handleCreatePacket}
                  disabled={creatingPacket}
                  className="gap-2"
                >
                  {creatingPacket ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Package className="h-4 w-4" />
                      Create Packet
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
