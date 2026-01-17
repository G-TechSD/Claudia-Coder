"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  Folder,
  FolderOpen,
  File,
  FileCode,
  FileJson,
  FileText,
  FileImage,
  FileAudio,
  FileVideo,
  FileArchive,
  FileType,
  ChevronRight,
  ChevronDown,
  Download,
  Loader2,
  AlertCircle,
  RefreshCw,
  X,
  FolderTree,
  HardDrive,
  Settings,
  Check,
  type LucideIcon,
} from "lucide-react"

// File tree node interface
export interface FileNode {
  name: string
  path: string
  type: "file" | "directory"
  size?: number
  children?: FileNode[]
  extension?: string
}

interface FileBrowserProps {
  projectId: string
  basePath?: string
  className?: string
  onSetBasePath?: (path: string) => void
}

// Map file extensions to icon type keys
type FileIconType = "code" | "json" | "text" | "image" | "audio" | "video" | "archive" | "font" | "file"

function getFileIconType(extension: string | undefined): FileIconType {
  if (!extension) return "file"

  const ext = extension.toLowerCase()

  // Code files
  if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte", ".py", ".rb", ".go", ".rs", ".java", ".c", ".cpp", ".h", ".cs", ".php", ".swift", ".kt"].includes(ext)) {
    return "code"
  }

  // JSON/Config files
  if ([".json", ".yaml", ".yml", ".toml", ".xml", ".ini", ".env"].includes(ext)) {
    return "json"
  }

  // Text/Documentation files
  if ([".md", ".mdx", ".txt", ".rst", ".doc", ".docx", ".pdf", ".rtf"].includes(ext)) {
    return "text"
  }

  // Image files
  if ([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".bmp", ".tiff"].includes(ext)) {
    return "image"
  }

  // Audio files
  if ([".mp3", ".wav", ".ogg", ".flac", ".m4a", ".aac", ".wma"].includes(ext)) {
    return "audio"
  }

  // Video files
  if ([".mp4", ".webm", ".mkv", ".avi", ".mov", ".wmv", ".flv"].includes(ext)) {
    return "video"
  }

  // Archive files
  if ([".zip", ".tar", ".gz", ".rar", ".7z", ".bz2", ".xz"].includes(ext)) {
    return "archive"
  }

  // Font files
  if ([".ttf", ".otf", ".woff", ".woff2", ".eot"].includes(ext)) {
    return "font"
  }

  return "file"
}

// Icon components map
const FILE_ICONS: Record<FileIconType, LucideIcon> = {
  code: FileCode,
  json: FileJson,
  text: FileText,
  image: FileImage,
  audio: FileAudio,
  video: FileVideo,
  archive: FileArchive,
  font: FileType,
  file: File,
}

// Format file size
function formatSize(bytes: number | undefined): string {
  if (bytes === undefined || bytes === 0) return ""
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

// Check if file is previewable as text
function isTextPreviewable(extension: string | undefined): boolean {
  if (!extension) return false
  const ext = extension.toLowerCase()
  return [
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte",
    ".py", ".rb", ".go", ".rs", ".java", ".c", ".cpp", ".h", ".cs", ".php", ".swift", ".kt",
    ".json", ".yaml", ".yml", ".toml", ".xml", ".ini", ".env",
    ".md", ".mdx", ".txt", ".rst",
    ".html", ".htm", ".css", ".scss", ".sass", ".less",
    ".sh", ".bash", ".zsh", ".fish", ".ps1", ".bat", ".cmd",
    ".sql", ".graphql", ".prisma",
    ".gitignore", ".dockerignore", ".editorconfig",
    ".lock", ".log",
  ].includes(ext) || ext === "" // No extension often means config file
}

// File icon component - renders the appropriate icon based on file type
function FileIcon({ node, isExpanded }: { node: FileNode; isExpanded: boolean }) {
  const isDirectory = node.type === "directory"

  if (isDirectory) {
    return isExpanded ? (
      <FolderOpen className="h-4 w-4 flex-shrink-0 text-yellow-500" />
    ) : (
      <Folder className="h-4 w-4 flex-shrink-0 text-yellow-500" />
    )
  }

  const iconType = getFileIconType(node.extension)
  const IconComponent = FILE_ICONS[iconType]
  return <IconComponent className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
}

// File tree item component
function FileTreeItem({
  node,
  level = 0,
  onPreview,
  expandedFolders,
  toggleFolder,
}: {
  node: FileNode
  level?: number
  onPreview: (node: FileNode) => void
  expandedFolders: Set<string>
  toggleFolder: (path: string) => void
}) {
  const isExpanded = expandedFolders.has(node.path)
  const isDirectory = node.type === "directory"
  const canPreview = !isDirectory && isTextPreviewable(node.extension)

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors",
          "hover:bg-muted/50",
          canPreview && "hover:bg-primary/10"
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => {
          if (isDirectory) {
            toggleFolder(node.path)
          } else if (canPreview) {
            onPreview(node)
          }
        }}
      >
        {isDirectory ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleFolder(node.path)
            }}
            className="p-0.5 hover:bg-muted rounded"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}

        <FileIcon node={node} isExpanded={isExpanded} />

        <span className="flex-1 truncate text-sm">{node.name}</span>

        {!isDirectory && node.size !== undefined && node.size > 0 && (
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {formatSize(node.size)}
          </span>
        )}
      </div>

      {isDirectory && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              level={level + 1}
              onPreview={onPreview}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// File preview modal
function FilePreviewModal({
  file,
  projectId,
  basePath,
  onClose,
}: {
  file: FileNode
  projectId: string
  basePath?: string
  onClose: () => void
}) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadContent() {
      try {
        setLoading(true)
        setError(null)

        const url = new URL(`/api/projects/${projectId}/files`, window.location.origin)
        url.searchParams.set("path", file.path)
        if (basePath) {
          url.searchParams.set("basePath", basePath)
        }
        const response = await fetch(url.toString())

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Failed to load file")
        }

        const data = await response.json()
        setContent(data.content)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load file")
      } finally {
        setLoading(false)
      }
    }

    loadContent()
  }, [file.path, projectId, basePath])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <FileCode className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-medium truncate">{file.name}</h3>
            {file.size && (
              <Badge variant="secondary" className="text-xs">
                {formatSize(file.size)}
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-4">
              <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
              <p className="text-red-500">{error}</p>
            </div>
          ) : (
            <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-words bg-muted/30">
              {content}
            </pre>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t">
          <code className="text-xs text-muted-foreground flex-1 truncate">
            {file.path}
          </code>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

export function FileBrowser({ projectId, basePath, className, onSetBasePath }: FileBrowserProps) {
  const [files, setFiles] = useState<FileNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [attemptedPath, setAttemptedPath] = useState<string | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [previewFile, setPreviewFile] = useState<FileNode | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [stats, setStats] = useState<{ totalFiles: number; totalSize: number } | null>(null)
  const [showPathInput, setShowPathInput] = useState(false)
  const [newBasePath, setNewBasePath] = useState("")

  const loadFiles = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setErrorCode(null)
      setAttemptedPath(null)

      const url = new URL(`/api/projects/${projectId}/files`, window.location.origin)
      if (basePath) {
        url.searchParams.set("basePath", basePath)
      }

      const response = await fetch(url.toString())

      if (!response.ok) {
        const data = await response.json()
        setErrorCode(data.code || null)
        setAttemptedPath(data.attemptedPath || null)
        throw new Error(data.message || data.error || "Failed to load files")
      }

      const data = await response.json()
      setFiles(data.files || [])
      setStats(data.stats || null)

      // Auto-expand root folders
      if (data.files && data.files.length > 0) {
        const rootFolders = data.files
          .filter((f: FileNode) => f.type === "directory")
          .slice(0, 3) // Expand first 3 folders
          .map((f: FileNode) => f.path)
        setExpandedFolders(new Set(rootFolders))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files")
    } finally {
      setLoading(false)
    }
  }, [projectId, basePath])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const expandAll = () => {
    const allFolders = new Set<string>()
    const addFolders = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.type === "directory") {
          allFolders.add(node.path)
          if (node.children) {
            addFolders(node.children)
          }
        }
      }
    }
    addFolders(files)
    setExpandedFolders(allFolders)
  }

  const collapseAll = () => {
    setExpandedFolders(new Set())
  }

  const handleDownload = async () => {
    try {
      setDownloading(true)

      const url = new URL(`/api/projects/${projectId}/download`, window.location.origin)
      if (basePath) {
        url.searchParams.set("basePath", basePath)
      }

      const response = await fetch(url.toString())

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Failed to download files")
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get("Content-Disposition")
      let filename = "project-files.zip"
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (match) {
          filename = match[1].replace(/['"]/g, "")
        }
      }

      // Download the file
      const blob = await response.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download")
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Loading files...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    // Special UI when basePath is not configured
    if (errorCode === "BASEPATH_NOT_SET") {
      const folderDoesNotExist = !!attemptedPath
      return (
        <Card className={className}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderTree className="h-5 w-5 text-primary" />
              Project Files
            </CardTitle>
            <CardDescription>
              {folderDoesNotExist
                ? "The configured folder does not exist on disk"
                : "Configure the project folder location to browse files"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center justify-center text-center py-4">
              {folderDoesNotExist ? (
                <AlertCircle className="h-12 w-12 text-orange-500/50 mb-4" />
              ) : (
                <Settings className="h-12 w-12 text-muted-foreground/50 mb-4" />
              )}
              <h3 className="font-medium mb-2">
                {folderDoesNotExist ? "Folder Does Not Exist" : "Project Folder Not Configured"}
              </h3>
              {folderDoesNotExist ? (
                <>
                  <p className="text-muted-foreground mb-2 max-w-md">
                    The configured path does not exist on disk:
                  </p>
                  <code className="text-sm bg-muted px-3 py-1.5 rounded font-mono mb-4 text-orange-600 dark:text-orange-400">
                    {attemptedPath}
                  </code>
                  <p className="text-muted-foreground text-sm max-w-md">
                    Create this folder manually, or configure a different path below.
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground mb-4 max-w-md">
                  To browse files, you need to set the project folder path. This is the directory containing your project&apos;s source code.
                </p>
              )}
            </div>

            {showPathInput ? (
              <div className="space-y-4 max-w-md mx-auto">
                <div className="space-y-2">
                  <Label htmlFor="basePath">Project Folder Path</Label>
                  <Input
                    id="basePath"
                    value={newBasePath}
                    onChange={(e) => setNewBasePath(e.target.value)}
                    placeholder="/home/bill/projects/my-project"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the full path to your project folder (e.g., /home/bill/projects/my-app)
                  </p>
                </div>
                <div className="flex gap-2 justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowPathInput(false)
                      setNewBasePath("")
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (newBasePath.trim() && onSetBasePath) {
                        onSetBasePath(newBasePath.trim())
                      }
                    }}
                    disabled={!newBasePath.trim()}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Set Path
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <Button onClick={() => setShowPathInput(true)}>
                  <Settings className="h-4 w-4 mr-2" />
                  Configure Project Folder
                </Button>
                <p className="text-xs text-muted-foreground max-w-sm text-center">
                  Set the path to an existing project folder on your local filesystem.
                  If you need to create a new folder, use the &quot;Initialize Folder&quot; option in the Build Plan tab.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )
    }

    // Generic error UI
    return (
      <Card className={className}>
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="font-medium mb-2">Failed to Load Files</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={loadFiles} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (files.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center text-center">
            <FolderTree className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium mb-2">No Files Found</h3>
            <p className="text-muted-foreground mb-4">
              This project doesn&apos;t have any files yet, or the project folder doesn&apos;t exist.
            </p>
            <Button onClick={loadFiles} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FolderTree className="h-5 w-5 text-primary" />
              Project Files
            </CardTitle>
            <div className="flex items-center gap-2">
              {stats && (
                <div className="flex items-center gap-4 text-sm text-muted-foreground mr-4">
                  <span className="flex items-center gap-1">
                    <File className="h-3.5 w-3.5" />
                    {stats.totalFiles} files
                  </span>
                  <span className="flex items-center gap-1">
                    <HardDrive className="h-3.5 w-3.5" />
                    {formatSize(stats.totalSize)}
                  </span>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={expandAll}
                title="Expand all folders"
              >
                Expand All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={collapseAll}
                title="Collapse all folders"
              >
                Collapse All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadFiles}
                title="Refresh file list"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleDownload}
                disabled={downloading}
                size="sm"
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Download ZIP
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] border rounded-lg">
            <div className="p-2">
              {files.map((node) => (
                <FileTreeItem
                  key={node.path}
                  node={node}
                  onPreview={setPreviewFile}
                  expandedFolders={expandedFolders}
                  toggleFolder={toggleFolder}
                />
              ))}
            </div>
          </ScrollArea>

          {basePath && (
            <div className="mt-3 text-xs text-muted-foreground">
              <code className="bg-muted px-2 py-1 rounded">{basePath}</code>
            </div>
          )}
        </CardContent>
      </Card>

      {/* File preview modal */}
      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          projectId={projectId}
          basePath={basePath}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </>
  )
}
