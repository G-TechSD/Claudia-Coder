"use client"

import { useState, useCallback, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Upload,
  File,
  FolderOpen,
  X,
  Check,
  Loader2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { uploadResource, addFilePathResource, formatFileSize } from "@/lib/data/resources"
import { ProjectResource } from "@/lib/data/types"

interface ResourceUploadProps {
  projectId: string
  workingDirectory?: string  // If provided, files are also synced to .claudia/uploads/
  onUploadComplete?: (resources: ProjectResource[]) => void
  className?: string
}

type UploadMode = "upload" | "filepath"

interface PendingFile {
  file: File
  status: "pending" | "uploading" | "done" | "error"
  error?: string
}

export function ResourceUpload({
  projectId,
  workingDirectory,
  onUploadComplete,
  className
}: ResourceUploadProps) {
  const [mode, setMode] = useState<UploadMode>("upload")
  const [isDragOver, setIsDragOver] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [isUploading, setIsUploading] = useState(false)

  // File path mode
  const [filePath, setFilePath] = useState("")
  const [fileName, setFileName] = useState("")

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    addFiles(files)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    addFiles(files)
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [])

  function addFiles(files: File[]) {
    const newPending: PendingFile[] = files.map(file => ({
      file,
      status: "pending"
    }))
    setPendingFiles(prev => [...prev, ...newPending])
  }

  function removeFile(index: number) {
    setPendingFiles(prev => prev.filter((_, i) => i !== index))
  }

  async function handleUpload() {
    if (pendingFiles.length === 0) return

    setIsUploading(true)
    const uploadedResources: ProjectResource[] = []

    for (let i = 0; i < pendingFiles.length; i++) {
      const pending = pendingFiles[i]
      if (pending.status !== "pending") continue

      setPendingFiles(prev => prev.map((p, idx) =>
        idx === i ? { ...p, status: "uploading" } : p
      ))

      try {
        // Upload to IndexedDB (browser storage)
        const resource = await uploadResource(projectId, pending.file)
        uploadedResources.push(resource)

        // Also sync to working directory if provided (makes it visible in Browse Files)
        if (workingDirectory) {
          try {
            const formData = new FormData()
            formData.append("workingDirectory", workingDirectory)
            formData.append("file", pending.file)
            formData.append("fileName", pending.file.name)

            await fetch(`/api/projects/${projectId}/sync-upload`, {
              method: "POST",
              body: formData
            })
          } catch (syncError) {
            console.warn("Failed to sync file to working directory:", syncError)
            // Don't fail the upload just because sync failed
          }
        }

        setPendingFiles(prev => prev.map((p, idx) =>
          idx === i ? { ...p, status: "done" } : p
        ))
      } catch (error) {
        setPendingFiles(prev => prev.map((p, idx) =>
          idx === i ? {
            ...p,
            status: "error",
            error: error instanceof Error ? error.message : "Upload failed"
          } : p
        ))
      }
    }

    setIsUploading(false)

    if (uploadedResources.length > 0) {
      onUploadComplete?.(uploadedResources)
    }

    // Clear completed files after a delay
    setTimeout(() => {
      setPendingFiles(prev => prev.filter(p => p.status !== "done"))
    }, 2000)
  }

  async function handleAddFilePath() {
    if (!filePath || !fileName) return

    // Estimate file size (we don't have access to actual file)
    const resource = addFilePathResource(
      projectId,
      filePath,
      fileName,
      guessMimeType(fileName),
      0, // Size unknown for file path references
      undefined
    )

    setFilePath("")
    setFileName("")
    onUploadComplete?.([resource])
  }

  function guessMimeType(filename: string): string {
    const ext = filename.split(".").pop()?.toLowerCase()
    const mimeTypes: Record<string, string> = {
      md: "text/markdown",
      json: "application/json",
      csv: "text/csv",
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      mp3: "audio/mpeg",
      wav: "audio/wav",
      m4a: "audio/mp4",
      webm: "audio/webm",
      ogg: "audio/ogg"
    }
    return mimeTypes[ext || ""] || "application/octet-stream"
  }

  return (
    <Card className={cn("", className)}>
      <CardContent className="p-4">
        {/* Mode tabs */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={mode === "upload" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("upload")}
          >
            <Upload className="h-4 w-4 mr-1" />
            Upload Files
          </Button>
          <Button
            variant={mode === "filepath" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("filepath")}
          >
            <FolderOpen className="h-4 w-4 mr-1" />
            Add File Path
          </Button>
        </div>

        {mode === "upload" ? (
          <>
            {/* Drop zone */}
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
                isDragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className={cn(
                "h-10 w-10 mx-auto mb-3",
                isDragOver ? "text-primary" : "text-muted-foreground"
              )} />
              <p className="text-sm font-medium">
                {isDragOver ? "Drop files here" : "Drag & drop files or click to browse"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports images, audio, documents, and more
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                accept="image/*,audio/*,.md,.json,.csv,.pdf,.txt"
              />
            </div>

            {/* Pending files */}
            {pendingFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                {pendingFiles.map((pending, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                  >
                    <File className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {pending.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(pending.file.size)}
                      </p>
                    </div>

                    {pending.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}

                    {pending.status === "uploading" && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}

                    {pending.status === "done" && (
                      <Check className="h-4 w-4 text-green-500" />
                    )}

                    {pending.status === "error" && (
                      <span className="text-xs text-destructive">
                        {pending.error}
                      </span>
                    )}
                  </div>
                ))}

                {pendingFiles.some(p => p.status === "pending") && (
                  <Button
                    className="w-full mt-2"
                    onClick={handleUpload}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload {pendingFiles.filter(p => p.status === "pending").length} file(s)
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </>
        ) : (
          /* File path mode */
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="filepath">File Path</Label>
              <Input
                id="filepath"
                placeholder="/path/to/your/file.md"
                value={filePath}
                onChange={e => setFilePath(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter the full path to a file on your local system
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filename">Display Name</Label>
              <Input
                id="filename"
                placeholder="My Document.md"
                value={fileName}
                onChange={e => setFileName(e.target.value)}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleAddFilePath}
              disabled={!filePath || !fileName}
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              Add File Reference
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
