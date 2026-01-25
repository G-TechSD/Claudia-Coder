"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  FileText,
  Plus,
  Trash2,
  Edit2,
  Eye,
  Save,
  X,
  FolderOpen,
  RefreshCw,
  Loader2,
  AlertCircle,
  BookOpen,
  Lightbulb,
  ClipboardList,
  FileCode,
  Sparkles,
  Download,
  CheckSquare,
  Square
} from "lucide-react"
import { DocExportButton } from "@/components/export/pdf-export-button"
import { cn } from "@/lib/utils"

// Document template types
type DocTemplate = "vision" | "story" | "notes" | "specs" | "custom"

interface DocFile {
  name: string
  path: string
  content: string
  lastModified?: string
}

interface DocsBrowserProps {
  projectId: string
  workingDirectory: string
  className?: string
}

// Templates for new documents
const DOC_TEMPLATES: Record<DocTemplate, { name: string; icon: typeof FileText; color: string; defaultContent: string }> = {
  vision: {
    name: "Vision",
    icon: Lightbulb,
    color: "text-yellow-500",
    defaultContent: `# Project Vision

## Overview
[Describe the high-level vision for this project]

## Goals
- Goal 1
- Goal 2
- Goal 3

## Success Criteria
- [ ] Criteria 1
- [ ] Criteria 2

## Target Audience
[Who is this for?]

## Key Features
1. Feature 1
2. Feature 2
3. Feature 3
`
  },
  story: {
    name: "User Story",
    icon: BookOpen,
    color: "text-blue-500",
    defaultContent: `# User Story

## As a [type of user]
I want [some goal]
So that [some reason]

## Acceptance Criteria
- [ ] Given [context], when [action], then [result]
- [ ] Given [context], when [action], then [result]

## Notes
[Additional context or considerations]

## Related Stories
- Story 1
- Story 2
`
  },
  notes: {
    name: "Notes",
    icon: ClipboardList,
    color: "text-green-500",
    defaultContent: `# Notes

## Date: ${new Date().toISOString().split("T")[0]}

## Topics
- Topic 1
- Topic 2

## Key Points
1. Point 1
2. Point 2

## Action Items
- [ ] Action 1
- [ ] Action 2

## References
- Link 1
- Link 2
`
  },
  specs: {
    name: "Technical Specs",
    icon: FileCode,
    color: "text-purple-500",
    defaultContent: `# Technical Specification

## Overview
[Brief description of what this spec covers]

## Architecture
\`\`\`
[Architecture diagram or description]
\`\`\`

## Data Models
\`\`\`typescript
interface Example {
  id: string
  name: string
}
\`\`\`

## API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | /api/... | Description |
| POST   | /api/... | Description |

## Dependencies
- Dependency 1
- Dependency 2

## Security Considerations
- [ ] Authentication
- [ ] Authorization
- [ ] Input validation

## Performance Requirements
- Requirement 1
- Requirement 2
`
  },
  custom: {
    name: "Custom",
    icon: FileText,
    color: "text-gray-500",
    defaultContent: `# Document Title

## Section 1

## Section 2

## Section 3
`
  }
}

// Simple markdown renderer
function renderMarkdown(content: string): string {
  const html = content
    // Escape HTML
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Code blocks (before other processing)
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre class="bg-zinc-900 text-zinc-100 p-4 rounded-lg overflow-x-auto my-4 text-sm"><code class="language-${lang || "text"}">${code.trim()}</code></pre>`
    })
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-6 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold mt-8 mb-3 pb-2 border-b">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>')
    // Bold and italic
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>')
    // Checkboxes
    .replace(/^- \[x\] (.+)$/gm, '<div class="flex items-center gap-2 my-1"><input type="checkbox" checked disabled class="rounded" /><span class="line-through text-muted-foreground">$1</span></div>')
    .replace(/^- \[ \] (.+)$/gm, '<div class="flex items-center gap-2 my-1"><input type="checkbox" disabled class="rounded" /><span>$1</span></div>')
    // Lists
    .replace(/^- (.+)$/gm, '<li class="ml-4 my-1">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 my-1 list-decimal">$2</li>')
    // Tables (simple support)
    .replace(/^\|(.+)\|$/gm, (match, content) => {
      const cells = content.split("|").map((c: string) => c.trim())
      const isHeader = cells.some((c: string) => c.match(/^-+$/))
      if (isHeader) return ""
      const cellType = "td"
      return `<tr class="border-b">${cells.map((c: string) => `<${cellType} class="px-3 py-2 text-sm">${c}</${cellType}>`).join("")}</tr>`
    })
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="my-6 border-t" />')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
    // Paragraphs (wrap remaining text)
    .split("\n\n")
    .map(p => {
      if (p.trim() && !p.startsWith("<")) {
        return `<p class="my-3 leading-relaxed">${p}</p>`
      }
      return p
    })
    .join("\n")
    // Wrap list items
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul class="my-3">$&</ul>')

  return html
}

export function DocsBrowser({
  projectId,
  workingDirectory,
  className
}: DocsBrowserProps) {
  const [docs, setDocs] = useState<DocFile[]>([])
  const [selectedDoc, setSelectedDoc] = useState<DocFile | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newDocName, setNewDocName] = useState("")
  const [newDocTemplate, setNewDocTemplate] = useState<DocTemplate>("custom")

  // Multi-select state for batch deletion
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set())
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Load docs from working directory
  const loadDocs = useCallback(async () => {
    if (!workingDirectory) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/docs`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      })

      if (!response.ok) {
        throw new Error("Failed to load documents")
      }

      const data = await response.json()
      setDocs(data.docs || [])
    } catch (err) {
      console.error("Failed to load docs:", err)
      setError(err instanceof Error ? err.message : "Failed to load documents")
      // Fall back to empty state
      setDocs([])
    } finally {
      setIsLoading(false)
    }
  }, [projectId, workingDirectory])

  useEffect(() => {
    loadDocs()
  }, [loadDocs])

  // Save document
  const handleSave = async () => {
    if (!selectedDoc) return

    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/docs`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: selectedDoc.path,
          content: editContent
        })
      })

      if (!response.ok) {
        throw new Error("Failed to save document")
      }

      // Update local state
      setSelectedDoc({ ...selectedDoc, content: editContent })
      setDocs(docs.map(d =>
        d.path === selectedDoc.path
          ? { ...d, content: editContent, lastModified: new Date().toISOString() }
          : d
      ))
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setIsSaving(false)
    }
  }

  // Create new document
  const handleCreate = async () => {
    if (!newDocName.trim()) return

    const fileName = newDocName.endsWith(".md") ? newDocName : `${newDocName}.md`
    const template = DOC_TEMPLATES[newDocTemplate]

    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/docs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fileName,
          content: template.defaultContent.replace("# Document Title", `# ${newDocName.replace(".md", "")}`),
          template: newDocTemplate
        })
      })

      if (!response.ok) {
        throw new Error("Failed to create document")
      }

      const data = await response.json()

      // Add to local state and select it
      const newDoc: DocFile = {
        name: fileName,
        path: data.path,
        content: template.defaultContent,
        lastModified: new Date().toISOString()
      }
      setDocs([...docs, newDoc])
      setSelectedDoc(newDoc)
      setEditContent(template.defaultContent)
      setIsEditing(true)
      setIsCreating(false)
      setNewDocName("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create")
    } finally {
      setIsSaving(false)
    }
  }

  // Delete single document
  const handleDelete = async (doc: DocFile) => {
    if (!confirm(`Delete "${doc.name}"?`)) return

    setError(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/docs`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: doc.path })
      })

      if (!response.ok) {
        throw new Error("Failed to delete document")
      }

      // Update local state
      setDocs(docs.filter(d => d.path !== doc.path))
      if (selectedDoc?.path === doc.path) {
        setSelectedDoc(null)
        setIsEditing(false)
      }
      // Remove from selection if selected
      setSelectedDocs(prev => {
        const updated = new Set(prev)
        updated.delete(doc.path)
        return updated
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete")
    }
  }

  // Toggle document selection for multi-select
  const toggleDocSelection = (docPath: string) => {
    setSelectedDocs(prev => {
      const updated = new Set(prev)
      if (updated.has(docPath)) {
        updated.delete(docPath)
      } else {
        updated.add(docPath)
      }
      return updated
    })
  }

  // Select all documents
  const selectAllDocs = () => {
    setSelectedDocs(new Set(docs.map(d => d.path)))
  }

  // Deselect all documents
  const deselectAllDocs = () => {
    setSelectedDocs(new Set())
  }

  // Batch delete selected documents
  const handleBatchDelete = async () => {
    if (selectedDocs.size === 0) return

    setIsDeleting(true)
    setError(null)

    const docsToDelete = docs.filter(d => selectedDocs.has(d.path))
    const failedDeletes: string[] = []

    for (const doc of docsToDelete) {
      try {
        const response = await fetch(`/api/projects/${projectId}/docs`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: doc.path })
        })

        if (!response.ok) {
          failedDeletes.push(doc.name)
        }
      } catch {
        failedDeletes.push(doc.name)
      }
    }

    // Update local state - remove successfully deleted docs
    const deletedPaths = docsToDelete
      .filter(d => !failedDeletes.includes(d.name))
      .map(d => d.path)

    setDocs(prev => prev.filter(d => !deletedPaths.includes(d.path)))

    // Clear selection for successfully deleted docs
    setSelectedDocs(prev => {
      const updated = new Set(prev)
      deletedPaths.forEach(path => updated.delete(path))
      return updated
    })

    // If currently viewing doc was deleted, clear selection
    if (selectedDoc && deletedPaths.includes(selectedDoc.path)) {
      setSelectedDoc(null)
      setIsEditing(false)
    }

    if (failedDeletes.length > 0) {
      setError(`Failed to delete: ${failedDeletes.join(", ")}`)
    }

    setIsDeleting(false)
    setIsDeleteDialogOpen(false)
  }

  // Select a document
  const handleSelectDoc = (doc: DocFile) => {
    setSelectedDoc(doc)
    setEditContent(doc.content)
    setIsEditing(false)
  }

  // Start editing
  const handleStartEdit = () => {
    if (selectedDoc) {
      setEditContent(selectedDoc.content)
      setIsEditing(true)
    }
  }

  // Cancel editing
  const handleCancelEdit = () => {
    setIsEditing(false)
    if (selectedDoc) {
      setEditContent(selectedDoc.content)
    }
  }

  // Get icon for a document based on its name
  const getDocIcon = (name: string) => {
    const lowerName = name.toLowerCase()
    if (lowerName.includes("vision") || lowerName.includes("goal")) {
      return { icon: Lightbulb, color: "text-yellow-500" }
    }
    if (lowerName.includes("story") || lowerName.includes("user")) {
      return { icon: BookOpen, color: "text-blue-500" }
    }
    if (lowerName.includes("note") || lowerName.includes("meeting")) {
      return { icon: ClipboardList, color: "text-green-500" }
    }
    if (lowerName.includes("spec") || lowerName.includes("tech") || lowerName.includes("api")) {
      return { icon: FileCode, color: "text-purple-500" }
    }
    if (lowerName.includes("kickoff") || lowerName.includes("prd") || lowerName.includes("build")) {
      return { icon: Sparkles, color: "text-primary" }
    }
    return { icon: FileText, color: "text-muted-foreground" }
  }

  if (!workingDirectory) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            No working directory configured. Initialize a project folder first.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn("flex gap-4 h-[600px]", className)}>
      {/* Sidebar - Document List */}
      <Card className="w-64 flex-shrink-0">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documents
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={loadDocs}
                disabled={isLoading}
              >
                <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsCreating(true)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-2">
          {/* Create new doc form */}
          {isCreating && (
            <div className="p-2 mb-2 border rounded-lg space-y-2">
              <Input
                placeholder="document-name.md"
                value={newDocName}
                onChange={(e) => setNewDocName(e.target.value)}
                className="h-8 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate()
                  if (e.key === "Escape") setIsCreating(false)
                }}
              />
              <div className="flex flex-wrap gap-1">
                {(Object.keys(DOC_TEMPLATES) as DocTemplate[]).map((template) => {
                  const t = DOC_TEMPLATES[template]
                  const Icon = t.icon
                  return (
                    <Button
                      key={template}
                      variant={newDocTemplate === template ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setNewDocTemplate(template)}
                    >
                      <Icon className={cn("h-3 w-3 mr-1", t.color)} />
                      {t.name}
                    </Button>
                  )
                })}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  className="flex-1 h-7"
                  onClick={handleCreate}
                  disabled={!newDocName.trim() || isSaving}
                >
                  {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Create"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7"
                  onClick={() => {
                    setIsCreating(false)
                    setNewDocName("")
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Selection controls - show when docs exist */}
          {docs.length > 0 && (
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={selectedDocs.size === docs.length ? deselectAllDocs : selectAllDocs}
                >
                  {selectedDocs.size === docs.length ? (
                    <>
                      <Square className="h-3 w-3 mr-1" />
                      Deselect
                    </>
                  ) : (
                    <>
                      <CheckSquare className="h-3 w-3 mr-1" />
                      Select All
                    </>
                  )}
                </Button>
                {selectedDocs.size > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {selectedDocs.size} selected
                  </span>
                )}
              </div>
              {selectedDocs.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={() => setIsDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              )}
            </div>
          )}

          {/* Document list */}
          <ScrollArea className="h-[440px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : docs.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-xs text-muted-foreground">No documents yet</p>
                <Button
                  variant="link"
                  size="sm"
                  className="text-xs"
                  onClick={() => setIsCreating(true)}
                >
                  Create your first doc
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {docs.map((doc) => {
                  const { icon: Icon, color } = getDocIcon(doc.name)
                  const isSelected = selectedDoc?.path === doc.path
                  const isChecked = selectedDocs.has(doc.path)

                  return (
                    <div
                      key={doc.path}
                      className={cn(
                        "group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors",
                        isSelected
                          ? "bg-primary/10 border border-primary/30"
                          : isChecked
                          ? "bg-muted/50 border border-muted-foreground/20"
                          : "hover:bg-muted"
                      )}
                      onClick={() => handleSelectDoc(doc)}
                    >
                      {/* Checkbox for multi-select */}
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleDocSelection(doc.path)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 flex-shrink-0"
                      />
                      <Icon className={cn("h-4 w-4 flex-shrink-0", color)} />
                      <span className="text-sm truncate flex-1">{doc.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(doc)
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Main Panel - Editor/Viewer */}
      <Card className="flex-1 flex flex-col">
        {selectedDoc ? (
          <>
            <CardHeader className="pb-2 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    {(() => {
                      const { icon: Icon, color } = getDocIcon(selectedDoc.name)
                      return <Icon className={cn("h-4 w-4", color)} />
                    })()}
                    {selectedDoc.name}
                  </CardTitle>
                  {selectedDoc.lastModified && (
                    <CardDescription className="text-xs">
                      Last modified: {new Date(selectedDoc.lastModified).toLocaleString()}
                    </CardDescription>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelEdit}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-1" />
                        )}
                        Save
                      </Button>
                    </>
                  ) : (
                    <>
                      <DocExportButton
                        docContent={selectedDoc.content}
                        docTitle={selectedDoc.name.replace(/\.md$/, "")}
                        projectName={projectId}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleStartEdit}
                      >
                        <Edit2 className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </>
                  )}
                  <Badge variant={isEditing ? "default" : "secondary"}>
                    {isEditing ? (
                      <><Edit2 className="h-3 w-3 mr-1" /> Edit</>
                    ) : (
                      <><Eye className="h-3 w-3 mr-1" /> Preview</>
                    )}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              {isEditing ? (
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="h-full w-full resize-none rounded-none border-0 border-t font-mono text-sm p-4"
                  placeholder="Write your markdown here..."
                />
              ) : (
                <ScrollArea className="h-full">
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none p-4"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedDoc.content) }}
                  />
                </ScrollArea>
              )}
            </CardContent>
          </>
        ) : (
          <CardContent className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Select a document to view or edit</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Or create a new one from the sidebar
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Error display */}
      {error && (
        <div className="fixed bottom-4 right-4 max-w-sm p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">Error</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setError(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Batch delete confirmation dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete {selectedDocs.size} Document{selectedDocs.size !== 1 ? "s" : ""}
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. The following documents will be permanently deleted:
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="max-h-[200px] overflow-y-auto border rounded-lg p-2 bg-destructive/5">
              <ul className="text-sm space-y-1">
                {docs
                  .filter(d => selectedDocs.has(d.path))
                  .map(doc => {
                    const { icon: Icon, color } = getDocIcon(doc.name)
                    return (
                      <li key={doc.path} className="flex items-center gap-2 text-muted-foreground">
                        <Icon className={cn("h-4 w-4 flex-shrink-0", color)} />
                        <span className="truncate">{doc.name}</span>
                      </li>
                    )
                  })}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBatchDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete {selectedDocs.size} Document{selectedDocs.size !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
