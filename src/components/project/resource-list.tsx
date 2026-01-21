"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
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
  AlertCircle,
  Sparkles,
  Rocket,
  CheckSquare,
  Square
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
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
import { PacketApprovalDialog } from "@/components/project/packet-approval-dialog"
import type { ProposedPacket } from "@/app/api/brain-dump/packetize/route"

interface ResourceListProps {
  projectId: string
  projectName?: string
  projectDescription?: string
  onTranscribe?: (resource: ProjectResource) => void
  onPacketCreate?: (transcription: TranscriptionData, resource: ProjectResource) => void
  onMarkdownPacketsCreated?: (packets: ProposedPacket[]) => void
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
  projectName,
  projectDescription,
  onTranscribe,
  onPacketCreate,
  onMarkdownPacketsCreated,
  className
}: ResourceListProps) {
  const router = useRouter()
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

  // Markdown action state
  const [processingMarkdownResourceId, setProcessingMarkdownResourceId] = useState<string | null>(null)
  const [markdownAction, setMarkdownAction] = useState<"kickoff" | "packetize" | null>(null)
  const [proposedPackets, setProposedPackets] = useState<ProposedPacket[]>([])
  const [showPacketApproval, setShowPacketApproval] = useState(false)
  const [packetizeError, setPacketizeError] = useState<string | null>(null)

  // Multi-select state for combining uploads into kickoff
  const [selectedResources, setSelectedResources] = useState<Set<string>>(new Set())
  const [isCreatingCombinedKickoff, setIsCreatingCombinedKickoff] = useState(false)

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

  /**
   * Read markdown file content from IndexedDB
   */
  async function readMarkdownContent(resource: ProjectResource): Promise<string | null> {
    if (!resource.indexedDbKey) {
      console.error("Resource has no IndexedDB key")
      return null
    }

    try {
      const blob = await getResourceBlob(resource.indexedDbKey)
      if (!blob) {
        console.error("Could not load markdown blob")
        return null
      }

      const text = await blob.text()
      return text
    } catch (err) {
      console.error("Failed to read markdown content:", err)
      return null
    }
  }

  /**
   * Handle "Use as Kickoff" action for markdown files
   * Reads file content and navigates to build plan with content pre-filled
   */
  async function handleUseAsKickoff(resource: ProjectResource) {
    console.log("[resource-list] handleUseAsKickoff called for:", resource.name)
    setProcessingMarkdownResourceId(resource.id)
    setMarkdownAction("kickoff")
    setPacketizeError(null)

    try {
      const content = await readMarkdownContent(resource)
      console.log("[resource-list] Read markdown content:", content ? `${content.length} chars` : "null")
      if (!content) {
        setPacketizeError("Failed to read markdown file content")
        return
      }

      // Store the markdown content in sessionStorage for the build plan page to pick up
      const kickoffData = {
        content,
        sourceName: resource.name,
        sourceResourceId: resource.id,
        projectId
      }
      sessionStorage.setItem("claudia_kickoff_content", JSON.stringify(kickoffData))
      console.log("[resource-list] Saved to sessionStorage:", {
        sourceName: kickoffData.sourceName,
        projectId: kickoffData.projectId,
        contentLength: kickoffData.content.length
      })

      // Verify it was saved
      const verify = sessionStorage.getItem("claudia_kickoff_content")
      console.log("[resource-list] Verification - sessionStorage contains:", verify ? "data" : "nothing")

      // Navigate to the project's build plan tab with the content flag
      console.log("[resource-list] Navigating to build plan with source=kickoff")
      router.push(`/projects/${projectId}?tab=plan&source=kickoff`)
    } catch (err) {
      console.error("Failed to use markdown as kickoff:", err)
      setPacketizeError(err instanceof Error ? err.message : "Failed to process markdown file")
    } finally {
      setProcessingMarkdownResourceId(null)
      setMarkdownAction(null)
    }
  }

  /**
   * Toggle selection of a resource
   */
  function toggleResourceSelection(resourceId: string) {
    setSelectedResources(prev => {
      const next = new Set(prev)
      if (next.has(resourceId)) {
        next.delete(resourceId)
      } else {
        next.add(resourceId)
      }
      return next
    })
  }

  /**
   * Select all text-based resources (markdown, json, csv)
   */
  function selectAllTextResources() {
    const textResources = resources.filter(r =>
      r.type === "markdown" || r.type === "json" || r.type === "csv"
    )
    setSelectedResources(new Set(textResources.map(r => r.id)))
  }

  /**
   * Clear all selections
   */
  function clearSelection() {
    setSelectedResources(new Set())
  }

  /**
   * Create a combined kickoff from all selected resources
   */
  async function handleCreateCombinedKickoff() {
    if (selectedResources.size === 0) return

    setIsCreatingCombinedKickoff(true)
    setPacketizeError(null)

    try {
      // Get selected resources in order
      const selected = resources.filter(r => selectedResources.has(r.id))
      console.log(`[resource-list] Creating combined kickoff from ${selected.length} files`)

      // Read content from all selected resources
      const contentParts: { name: string; content: string }[] = []
      for (const resource of selected) {
        const content = await readMarkdownContent(resource)
        if (content) {
          contentParts.push({ name: resource.name, content })
        } else {
          console.warn(`[resource-list] Could not read content from: ${resource.name}`)
        }
      }

      if (contentParts.length === 0) {
        setPacketizeError("Failed to read content from any selected files")
        return
      }

      // Combine content with headers for each file
      const combinedContent = contentParts
        .map(part => `## From: ${part.name}\n\n${part.content}`)
        .join("\n\n---\n\n")

      const sourceNames = contentParts.map(p => p.name).join(", ")

      // Store the combined content in sessionStorage
      const kickoffData = {
        content: combinedContent,
        sourceName: `Combined: ${contentParts.length} files (${sourceNames.length > 50 ? sourceNames.substring(0, 50) + "..." : sourceNames})`,
        sourceResourceId: selected.map(r => r.id).join(","),
        projectId
      }
      sessionStorage.setItem("claudia_kickoff_content", JSON.stringify(kickoffData))
      console.log("[resource-list] Saved combined kickoff to sessionStorage:", {
        sourceName: kickoffData.sourceName,
        projectId: kickoffData.projectId,
        contentLength: kickoffData.content.length,
        fileCount: contentParts.length
      })

      // Clear selection
      setSelectedResources(new Set())

      // Navigate to the project's build plan tab with the content flag
      console.log("[resource-list] Navigating to build plan with source=kickoff")
      router.push(`/projects/${projectId}?tab=plan&source=kickoff`)
    } catch (err) {
      console.error("Failed to create combined kickoff:", err)
      setPacketizeError(err instanceof Error ? err.message : "Failed to create combined kickoff")
    } finally {
      setIsCreatingCombinedKickoff(false)
    }
  }

  /**
   * Handle "Generate Packets" action for markdown files
   * Reads file content and sends to LLM to extract work packets
   */
  async function handleGeneratePackets(resource: ProjectResource) {
    setProcessingMarkdownResourceId(resource.id)
    setMarkdownAction("packetize")
    setPacketizeError(null)

    try {
      const content = await readMarkdownContent(resource)
      if (!content) {
        setPacketizeError("Failed to read markdown file content")
        return
      }

      // Call the packetize API
      const response = await fetch("/api/brain-dump/packetize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: content, // The API expects "transcript" field
          projectId,
          projectName: projectName || "Unknown Project",
          projectDescription: projectDescription || "",
          existingContext: {
            hasBuildPlan: false,
            hasPackets: false
          }
        })
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      if (data.proposedPackets && data.proposedPackets.length > 0) {
        setProposedPackets(data.proposedPackets)
        setShowPacketApproval(true)
      } else {
        setPacketizeError("No actionable items were extracted from the markdown file.")
      }
    } catch (err) {
      console.error("Failed to generate packets from markdown:", err)
      setPacketizeError(err instanceof Error ? err.message : "Failed to extract packets")
    } finally {
      setProcessingMarkdownResourceId(null)
      setMarkdownAction(null)
    }
  }

  /**
   * Handle packet approval from dialog
   */
  const handlePacketsApproved = useCallback((approvedPackets: Array<ProposedPacket & { approvedPriority: string }>) => {
    setShowPacketApproval(false)

    // Save packets to localStorage
    const storedPackets = localStorage.getItem("claudia_packets")
    const allPackets = storedPackets ? JSON.parse(storedPackets) : {}
    const projectPackets = allPackets[projectId] || []

    // Convert ProposedPacket to the format expected by localStorage
    const newPackets = approvedPackets.map(packet => ({
      id: packet.id,
      title: packet.title,
      description: packet.description,
      type: packet.type,
      priority: packet.approvedPriority,
      status: "pending",
      tasks: packet.tasks,
      acceptanceCriteria: packet.acceptanceCriteria,
      createdAt: new Date().toISOString(),
      sourceCategory: packet.category
    }))

    projectPackets.push(...newPackets)
    allPackets[projectId] = projectPackets
    localStorage.setItem("claudia_packets", JSON.stringify(allPackets))

    // Notify parent
    onMarkdownPacketsCreated?.(approvedPackets)

    // Clear state
    setProposedPackets([])
  }, [projectId, onMarkdownPacketsCreated])

  /**
   * Handle dismissing all packets
   */
  const handleDismissPackets = useCallback(() => {
    setShowPacketApproval(false)
    setProposedPackets([])
  }, [])

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

      {/* Selection toolbar */}
      {filteredResources.length > 0 && (
        <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={selectAllTextResources}
              className="h-7 text-xs"
            >
              <CheckSquare className="h-3 w-3 mr-1" />
              Select All Text
            </Button>
            {selectedResources.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                className="h-7 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Clear ({selectedResources.size})
              </Button>
            )}
          </div>
          {selectedResources.size > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={handleCreateCombinedKickoff}
              disabled={isCreatingCombinedKickoff}
              className="h-7 text-xs bg-green-600 hover:bg-green-700"
            >
              {isCreatingCombinedKickoff ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Rocket className="h-3 w-3 mr-1" />
              )}
              Create Kickoff from {selectedResources.size} File{selectedResources.size !== 1 ? "s" : ""}
            </Button>
          )}
        </div>
      )}

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
            const isMarkdown = resource.type === "markdown"
            const hasTranscription = resource.transcription?.text
            const isProcessingMarkdown = processingMarkdownResourceId === resource.id

            const isTextBased = resource.type === "markdown" || resource.type === "json" || resource.type === "csv"
            const isSelected = selectedResources.has(resource.id)

            return (
              <Card
                key={resource.id}
                className={cn(
                  "group hover:border-primary/50 transition-colors",
                  isSelected && "border-primary bg-primary/5"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Selection checkbox for text-based files */}
                    {isTextBased && (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleResourceSelection(resource.id)}
                        className="mt-1"
                      />
                    )}
                    {/* Icon */}
                    <div className={cn(
                      "p-2 rounded-lg",
                      isAudio && "bg-purple-500/10 text-purple-500",
                      isImage && "bg-blue-500/10 text-blue-500",
                      isMarkdown && "bg-green-500/10 text-green-500",
                      !isAudio && !isImage && !isMarkdown && "bg-muted"
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

                  {/* Markdown Processing Status */}
                  {isProcessingMarkdown && (
                    <div className="mt-3 pt-3 border-t space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {markdownAction === "kickoff"
                          ? "Preparing kickoff content..."
                          : "Extracting work packets..."}
                      </div>
                    </div>
                  )}

                  {/* Markdown Error */}
                  {isMarkdown && packetizeError && processingMarkdownResourceId === null && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center gap-2 text-sm text-red-500">
                        <AlertCircle className="h-4 w-4" />
                        {packetizeError}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className={cn(
                    "flex items-center gap-1 mt-3 pt-3 border-t transition-opacity",
                    (transcribingResourceId === resource.id || isProcessingMarkdown) ? "opacity-100" : "opacity-0 group-hover:opacity-100"
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

                    {/* Markdown Actions */}
                    {isMarkdown && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUseAsKickoff(resource)}
                                disabled={isProcessingMarkdown}
                                className="text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                              >
                                {isProcessingMarkdown && markdownAction === "kickoff" ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <Rocket className="h-4 w-4 mr-1" />
                                )}
                                Kickoff
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleGeneratePackets(resource)}
                                disabled={isProcessingMarkdown}
                                className="text-purple-500 hover:text-purple-600 hover:bg-purple-500/10"
                              >
                                {isProcessingMarkdown && markdownAction === "packetize" ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <Package className="h-4 w-4 mr-1" />
                                )}
                                Packets
                              </Button>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[280px]">
                            <p>Use this markdown file to generate a build plan kickoff or extract work packets</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
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

      {/* Packet Approval Dialog for Markdown Files */}
      <PacketApprovalDialog
        open={showPacketApproval}
        onOpenChange={setShowPacketApproval}
        proposedPackets={proposedPackets}
        onApprove={handlePacketsApproved}
        onDismiss={handleDismissPackets}
        isLoading={processingMarkdownResourceId !== null && markdownAction === "packetize"}
        projectName={projectName}
      />
    </div>
  )
}
