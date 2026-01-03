"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  MoreHorizontal
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  ProjectResource,
  ResourceType
} from "@/lib/data/types"
import {
  getResourcesForProject,
  deleteResource,
  getResourceBlobUrl,
  formatFileSize
} from "@/lib/data/resources"

interface ResourceListProps {
  projectId: string
  onTranscribe?: (resource: ProjectResource) => void
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
  className
}: ResourceListProps) {
  const [resources, setResources] = useState<ProjectResource[]>([])
  const [filter, setFilter] = useState<ResourceType | "all">("all")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewResource, setPreviewResource] = useState<ProjectResource | null>(null)

  useEffect(() => {
    loadResources()
  }, [projectId])

  function loadResources() {
    const loaded = getResourcesForProject(projectId)
    setResources(loaded)
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

                  {/* Actions */}
                  <div className="flex items-center gap-1 mt-3 pt-3 border-t opacity-0 group-hover:opacity-100 transition-opacity">
                    {(isImage || isAudio) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePreview(resource)}
                      >
                        {isAudio ? <Play className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                        {isAudio ? "Play" : "View"}
                      </Button>
                    )}

                    {isAudio && !hasTranscription && onTranscribe && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onTranscribe(resource)}
                      >
                        <Mic className="h-4 w-4 mr-1" />
                        Transcribe
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
    </div>
  )
}
