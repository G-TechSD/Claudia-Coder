"use client"

import * as React from "react"
import { useState, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import {
  Upload,
  FolderUp,
  FileArchive,
  Loader2,
  CheckCircle2,
  XCircle,
  File,
  Folder,
  AlertTriangle,
  X,
} from "lucide-react"

interface UploadedFile {
  name: string
  path: string
  size: number
  type: "file" | "directory"
}

interface FolderUploadProps {
  projectId: string
  workingDirectory: string
  onUploadComplete?: (files: UploadedFile[]) => void
  onClose?: () => void
  className?: string
}

interface FileWithPath extends File {
  webkitRelativePath: string
}

interface UploadProgress {
  total: number
  uploaded: number
  currentFile: string
  status: "idle" | "uploading" | "extracting" | "complete" | "error"
  error?: string
}

/**
 * FolderUpload Component
 *
 * Allows uploading:
 * - Entire folders (preserving structure)
 * - Zip files (automatically extracted)
 * - Drag and drop support for both
 */
export function FolderUpload({
  projectId,
  workingDirectory,
  onUploadComplete,
  onClose,
  className,
}: FolderUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<FileWithPath[]>([])
  const [selectedZip, setSelectedZip] = useState<File | null>(null)
  const [progress, setProgress] = useState<UploadProgress>({
    total: 0,
    uploaded: 0,
    currentFile: "",
    status: "idle",
  })
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])

  const folderInputRef = useRef<HTMLInputElement>(null)
  const zipInputRef = useRef<HTMLInputElement>(null)

  // Handle folder selection
  const handleFolderSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as FileWithPath[]
    if (files.length > 0) {
      setSelectedFiles(files)
      setSelectedZip(null)
    }
  }, [])

  // Handle zip selection
  const handleZipSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && (file.name.endsWith(".zip") || file.type === "application/zip")) {
      setSelectedZip(file)
      setSelectedFiles([])
    }
  }, [])

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const items = Array.from(e.dataTransfer.items)
    const files: FileWithPath[] = []

    // Check if it's a zip file
    if (items.length === 1 && items[0].kind === "file") {
      const file = items[0].getAsFile()
      if (file && (file.name.endsWith(".zip") || file.type === "application/zip")) {
        setSelectedZip(file)
        setSelectedFiles([])
        return
      }
    }

    // Process folder/files using webkitGetAsEntry for directory support
    for (const item of items) {
      if (item.kind === "file") {
        const entry = item.webkitGetAsEntry?.()
        if (entry) {
          await traverseEntry(entry, "", files)
        } else {
          const file = item.getAsFile()
          if (file) {
            files.push(file as FileWithPath)
          }
        }
      }
    }

    if (files.length > 0) {
      setSelectedFiles(files)
      setSelectedZip(null)
    }
  }, [])

  // Recursively traverse directory entries
  const traverseEntry = async (
    entry: FileSystemEntry,
    path: string,
    files: FileWithPath[]
  ): Promise<void> => {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry
      return new Promise((resolve) => {
        fileEntry.file((file) => {
          const fileWithPath = file as FileWithPath
          // Manually set the path since webkitRelativePath might not be set from drag
          Object.defineProperty(fileWithPath, "webkitRelativePath", {
            value: path ? `${path}/${entry.name}` : entry.name,
            writable: false,
          })
          files.push(fileWithPath)
          resolve()
        })
      })
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry
      const reader = dirEntry.createReader()
      return new Promise((resolve) => {
        reader.readEntries(async (entries) => {
          for (const childEntry of entries) {
            await traverseEntry(
              childEntry,
              path ? `${path}/${entry.name}` : entry.name,
              files
            )
          }
          resolve()
        })
      })
    }
  }

  // Upload files
  const handleUpload = async () => {
    if (selectedZip) {
      await uploadZip()
    } else if (selectedFiles.length > 0) {
      await uploadFiles()
    }
  }

  // Upload folder files
  const uploadFiles = async () => {
    setProgress({
      total: selectedFiles.length,
      uploaded: 0,
      currentFile: "",
      status: "uploading",
    })

    try {
      const formData = new FormData()
      formData.append("workingDirectory", workingDirectory)

      // Add all files with their relative paths
      for (const file of selectedFiles) {
        formData.append("files", file)
        formData.append("paths", file.webkitRelativePath || file.name)
      }

      const response = await fetch(`/api/projects/${projectId}/upload`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Upload failed")
      }

      const result = await response.json()

      setProgress({
        total: selectedFiles.length,
        uploaded: selectedFiles.length,
        currentFile: "",
        status: "complete",
      })

      setUploadedFiles(result.files || [])
      onUploadComplete?.(result.files || [])
    } catch (error) {
      setProgress((prev) => ({
        ...prev,
        status: "error",
        error: error instanceof Error ? error.message : "Upload failed",
      }))
    }
  }

  // Upload and extract zip
  const uploadZip = async () => {
    if (!selectedZip) return

    setProgress({
      total: 1,
      uploaded: 0,
      currentFile: selectedZip.name,
      status: "uploading",
    })

    try {
      const formData = new FormData()
      formData.append("workingDirectory", workingDirectory)
      formData.append("zipFile", selectedZip)

      const response = await fetch(`/api/projects/${projectId}/upload`, {
        method: "POST",
        body: formData,
      })

      setProgress((prev) => ({ ...prev, status: "extracting" }))

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Upload failed")
      }

      const result = await response.json()

      setProgress({
        total: result.fileCount || 1,
        uploaded: result.fileCount || 1,
        currentFile: "",
        status: "complete",
      })

      setUploadedFiles(result.files || [])
      onUploadComplete?.(result.files || [])
    } catch (error) {
      setProgress((prev) => ({
        ...prev,
        status: "error",
        error: error instanceof Error ? error.message : "Upload failed",
      }))
    }
  }

  // Reset state
  const handleReset = () => {
    setSelectedFiles([])
    setSelectedZip(null)
    setProgress({ total: 0, uploaded: 0, currentFile: "", status: "idle" })
    setUploadedFiles([])
    if (folderInputRef.current) folderInputRef.current.value = ""
    if (zipInputRef.current) zipInputRef.current.value = ""
  }

  // Calculate folder structure preview
  const getFolderStructure = () => {
    if (selectedFiles.length === 0) return null

    const structure: { [key: string]: number } = {}
    let rootFolder = ""

    for (const file of selectedFiles) {
      const parts = file.webkitRelativePath.split("/")
      if (parts.length > 0 && !rootFolder) {
        rootFolder = parts[0]
      }
      const folder = parts.length > 1 ? parts.slice(0, -1).join("/") : "/"
      structure[folder] = (structure[folder] || 0) + 1
    }

    return { rootFolder, folders: Object.keys(structure).length, files: selectedFiles.length }
  }

  const folderInfo = getFolderStructure()

  return (
    <Card className={cn("border-2 border-dashed", isDragging && "border-primary bg-primary/5", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/20 border border-blue-500/30">
              <FolderUp className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Upload Files</CardTitle>
              <CardDescription>Upload folders or zip files to your project</CardDescription>
            </div>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Drop Zone */}
        <div
          className={cn(
            "relative rounded-lg border-2 border-dashed p-8 text-center transition-colors",
            isDragging
              ? "border-primary bg-primary/10"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {progress.status === "idle" && !selectedFiles.length && !selectedZip ? (
            <>
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">
                {isDragging ? "Drop files here" : "Drag & drop files or folders"}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Or click the buttons below to select
              </p>
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => folderInputRef.current?.click()}
                >
                  <Folder className="h-4 w-4 mr-2" />
                  Select Folder
                </Button>
                <Button
                  variant="outline"
                  onClick={() => zipInputRef.current?.click()}
                >
                  <FileArchive className="h-4 w-4 mr-2" />
                  Select Zip File
                </Button>
              </div>
            </>
          ) : progress.status === "uploading" || progress.status === "extracting" ? (
            <div className="space-y-4">
              <Loader2 className="h-10 w-10 mx-auto text-primary animate-spin" />
              <p className="text-lg font-medium">
                {progress.status === "extracting" ? "Extracting files..." : "Uploading files..."}
              </p>
              {progress.currentFile && (
                <p className="text-sm text-muted-foreground">{progress.currentFile}</p>
              )}
              <Progress value={(progress.uploaded / progress.total) * 100} className="w-full max-w-xs mx-auto" />
              <p className="text-xs text-muted-foreground">
                {progress.uploaded} / {progress.total} files
              </p>
            </div>
          ) : progress.status === "complete" ? (
            <div className="space-y-4">
              <CheckCircle2 className="h-10 w-10 mx-auto text-green-500" />
              <p className="text-lg font-medium text-green-500">Upload Complete!</p>
              <p className="text-sm text-muted-foreground">
                {uploadedFiles.length} files uploaded successfully
              </p>
              <div className="flex items-center justify-center gap-3">
                <Button variant="outline" onClick={handleReset}>
                  Upload More
                </Button>
                {onClose && (
                  <Button onClick={onClose}>
                    Done
                  </Button>
                )}
              </div>
            </div>
          ) : progress.status === "error" ? (
            <div className="space-y-4">
              <XCircle className="h-10 w-10 mx-auto text-red-500" />
              <p className="text-lg font-medium text-red-500">Upload Failed</p>
              <p className="text-sm text-muted-foreground">{progress.error}</p>
              <Button variant="outline" onClick={handleReset}>
                Try Again
              </Button>
            </div>
          ) : (
            // Selection preview
            <div className="space-y-4">
              {selectedZip ? (
                <>
                  <FileArchive className="h-10 w-10 mx-auto text-amber-500" />
                  <p className="text-lg font-medium">{selectedZip.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedZip.size / 1024 / 1024).toFixed(2)} MB - Will be extracted
                  </p>
                </>
              ) : folderInfo ? (
                <>
                  <Folder className="h-10 w-10 mx-auto text-blue-500" />
                  <p className="text-lg font-medium">{folderInfo.rootFolder}</p>
                  <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                    <span>{folderInfo.folders} folders</span>
                    <span>{folderInfo.files} files</span>
                  </div>
                </>
              ) : null}
              <div className="flex items-center justify-center gap-3">
                <Button variant="outline" onClick={handleReset}>
                  Cancel
                </Button>
                <Button onClick={handleUpload}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Hidden file inputs */}
        <input
          ref={folderInputRef}
          type="file"
          className="hidden"
          onChange={handleFolderSelect}
          // @ts-expect-error - webkitdirectory is not in the types
          webkitdirectory=""
          directory=""
          multiple
        />
        <input
          ref={zipInputRef}
          type="file"
          className="hidden"
          accept=".zip,application/zip"
          onChange={handleZipSelect}
        />

        {/* File list preview */}
        {selectedFiles.length > 0 && progress.status === "idle" && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Files to upload:</p>
            <ScrollArea className="h-32 rounded border p-2">
              {selectedFiles.slice(0, 50).map((file, i) => (
                <div key={i} className="flex items-center gap-2 text-xs py-0.5">
                  <File className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground truncate">{file.webkitRelativePath}</span>
                </div>
              ))}
              {selectedFiles.length > 50 && (
                <p className="text-xs text-muted-foreground mt-2">
                  ... and {selectedFiles.length - 50} more files
                </p>
              )}
            </ScrollArea>
          </div>
        )}

        {/* Uploaded files list */}
        {uploadedFiles.length > 0 && progress.status === "complete" && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Uploaded files:</p>
            <ScrollArea className="h-32 rounded border p-2">
              {uploadedFiles.slice(0, 50).map((file, i) => (
                <div key={i} className="flex items-center gap-2 text-xs py-0.5">
                  {file.type === "directory" ? (
                    <Folder className="h-3 w-3 text-blue-400" />
                  ) : (
                    <File className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span className="text-muted-foreground truncate">{file.path}</span>
                </div>
              ))}
              {uploadedFiles.length > 50 && (
                <p className="text-xs text-muted-foreground mt-2">
                  ... and {uploadedFiles.length - 50} more files
                </p>
              )}
            </ScrollArea>
          </div>
        )}

        {/* Size warning */}
        {(selectedFiles.reduce((sum, f) => sum + f.size, 0) > 100 * 1024 * 1024 ||
          (selectedZip && selectedZip.size > 100 * 1024 * 1024)) && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm text-amber-500">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>Large upload detected. This may take a while.</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Compact upload button for toolbar integration
 */
export function FolderUploadButton({
  projectId,
  workingDirectory,
  onUploadComplete,
}: {
  projectId: string
  workingDirectory: string
  onUploadComplete?: (files: UploadedFile[]) => void
}) {
  const [showUpload, setShowUpload] = useState(false)

  if (showUpload) {
    return (
      <FolderUpload
        projectId={projectId}
        workingDirectory={workingDirectory}
        onUploadComplete={(files) => {
          onUploadComplete?.(files)
          setShowUpload(false)
        }}
        onClose={() => setShowUpload(false)}
      />
    )
  }

  return (
    <Button variant="outline" size="sm" onClick={() => setShowUpload(true)}>
      <FolderUp className="h-4 w-4 mr-2" />
      Upload Folder
    </Button>
  )
}
