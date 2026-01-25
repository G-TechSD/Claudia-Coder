"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import {
  BookOpen,
  Search,
  Plus,
  FileText,
  Folder,
  ChevronRight,
  ChevronDown,
  Edit,
  Trash2,
  Save,
  X,
  History,
  Tag,
  Building2,
  Plug,
  Component,
  Terminal,
  Scale,
  File,
  MoreVertical,
  RefreshCw,
  Loader2,
  Eye,
  Code,
  Copy,
  Check,
  FolderTree,
  List,
  ArrowLeft,
} from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import type { WikiDocument, WikiDocType, WikiTreeNode } from "@/lib/data/wiki"
import { WIKI_DOC_TYPE_LABELS, GLOBAL_WIKI_ID, CLAUDIA_CODER_WIKI_ID } from "@/lib/data/wiki"
import { getAllProjects } from "@/lib/data/projects"
import type { Project } from "@/lib/data/types"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

// Wiki scope options
type WikiScope = "all" | "claudia" | "global" | string // string for project IDs

// Icon mapping for document types
const DOC_TYPE_ICONS: Record<WikiDocType, React.ElementType> = {
  architecture: Building2,
  api: Plug,
  component: Component,
  changelog: History,
  guide: BookOpen,
  reference: FileText,
  runbook: Terminal,
  decision: Scale,
  custom: File,
}

// Type colors for badges
const DOC_TYPE_COLORS: Record<WikiDocType, string> = {
  architecture: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  api: "bg-green-500/10 text-green-500 border-green-500/20",
  component: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  changelog: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  guide: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  reference: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  runbook: "bg-red-500/10 text-red-500 border-red-500/20",
  decision: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  custom: "bg-slate-500/10 text-slate-400 border-slate-500/20",
}

interface WikiState {
  documents: WikiDocument[]
  projects: Project[]
  loading: boolean
  error: string | null
  selectedDocId: string | null
  editingDoc: WikiDocument | null
  isCreating: boolean
  searchQuery: string
  filterType: WikiDocType | "all"
  viewMode: "tree" | "list"
  scope: WikiScope // "all", "claudia", "global", or project ID
}

export default function WikiPage() {
  const { user } = useAuth()
  const [state, setState] = useState<WikiState>({
    documents: [],
    projects: [],
    loading: true,
    error: null,
    selectedDocId: null,
    editingDoc: null,
    isCreating: false,
    searchQuery: "",
    filterType: "all",
    viewMode: "list",
    scope: "all",
  })

  const [editorContent, setEditorContent] = useState("")
  const [editorTitle, setEditorTitle] = useState("")
  const [editorType, setEditorType] = useState<WikiDocType>("guide")
  const [editorTags, setEditorTags] = useState("")
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [docToDelete, setDocToDelete] = useState<WikiDocument | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [hasAttemptedSeed, setHasAttemptedSeed] = useState(false)

  // Fetch documents and projects from server
  const fetchDocuments = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      // Load projects from local storage (projects are still client-side for now)
      const projects = getAllProjects({ userId: user?.id })

      // Fetch wiki documents from server API
      const response = await fetch("/api/wiki")
      if (!response.ok) throw new Error("Failed to fetch documents")
      const data = await response.json()

      setState(s => ({ ...s, documents: data.documents, projects, loading: false }))
      return data.documents as WikiDocument[]
    } catch (err) {
      setState(s => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load documents"
      }))
      return []
    }
  }, [user?.id])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  // Auto-seed when switching to Claudia scope and no docs exist
  useEffect(() => {
    if (state.scope === "claudia" && !state.loading && !seeding && !hasAttemptedSeed) {
      const claudiaDocs = state.documents.filter(d => d.projectId === CLAUDIA_CODER_WIKI_ID)
      if (claudiaDocs.length === 0) {
        // Auto-seed Claudia Coder documentation
        setSeeding(true)
        setHasAttemptedSeed(true)
        fetch("/api/wiki/seed", { method: "POST" })
          .then(async (response) => {
            if (response.ok) {
              // Refresh documents from server
              await fetchDocuments()
            }
          })
          .catch((err) => {
            console.error("Auto-seed error:", err)
          })
          .finally(() => {
            setSeeding(false)
          })
      }
    }
  }, [state.scope, state.loading, state.documents, seeding, hasAttemptedSeed, fetchDocuments])

  // Filter documents based on scope, search and type
  const filteredDocuments = useMemo(() => {
    let docs = state.documents

    // Filter by scope
    if (state.scope === "claudia") {
      docs = docs.filter(d => d.projectId === CLAUDIA_CODER_WIKI_ID)
    } else if (state.scope === "global") {
      docs = docs.filter(d => !d.projectId || d.projectId === GLOBAL_WIKI_ID)
    } else if (state.scope !== "all") {
      // Specific project ID
      docs = docs.filter(d => d.projectId === state.scope)
    }

    if (state.filterType !== "all") {
      docs = docs.filter(d => d.type === state.filterType)
    }

    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase()
      docs = docs.filter(d =>
        d.title.toLowerCase().includes(query) ||
        d.content.toLowerCase().includes(query) ||
        d.tags.some(t => t.toLowerCase().includes(query))
      )
    }

    return docs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [state.documents, state.scope, state.filterType, state.searchQuery])

  // Get current scope label
  const scopeLabel = useMemo(() => {
    if (state.scope === "all") return "All Documentation"
    if (state.scope === "claudia") return "Claudia Coder"
    if (state.scope === "global") return "Global Docs"
    const project = state.projects.find(p => p.id === state.scope)
    return project?.name || "Unknown Project"
  }, [state.scope, state.projects])

  // Build tree structure
  const documentTree = useMemo(() => {
    const docMap = new Map<string, WikiDocument>()
    const childrenMap = new Map<string, WikiDocument[]>()

    filteredDocuments.forEach(doc => {
      docMap.set(doc.id, doc)
      if (doc.parentId) {
        const siblings = childrenMap.get(doc.parentId) || []
        siblings.push(doc)
        childrenMap.set(doc.parentId, siblings)
      }
    })

    function buildNode(doc: WikiDocument): WikiTreeNode {
      const children = childrenMap.get(doc.id) || []
      return {
        document: doc,
        children: children.map(buildNode).sort((a, b) =>
          a.document.title.localeCompare(b.document.title)
        )
      }
    }

    const rootDocs = filteredDocuments.filter(d => !d.parentId)
    return rootDocs.map(buildNode).sort((a, b) =>
      a.document.title.localeCompare(b.document.title)
    )
  }, [filteredDocuments])

  // Get selected document
  const selectedDoc = useMemo(() => {
    return state.documents.find(d => d.id === state.selectedDocId) || null
  }, [state.documents, state.selectedDocId])

  // Start creating new document
  const handleNewDocument = useCallback(() => {
    setEditorTitle("")
    setEditorContent("")
    setEditorType("guide")
    setEditorTags("")
    setPreviewMode(false)
    setState(s => ({ ...s, isCreating: true, editingDoc: null, selectedDocId: null }))
  }, [])

  // Start editing document
  const handleEditDocument = useCallback((doc: WikiDocument) => {
    setEditorTitle(doc.title)
    setEditorContent(doc.content)
    setEditorType(doc.type)
    setEditorTags(doc.tags.join(", "))
    setPreviewMode(false)
    setState(s => ({ ...s, editingDoc: doc, isCreating: false }))
  }, [])

  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    setState(s => ({ ...s, editingDoc: null, isCreating: false }))
    setPreviewMode(false)
  }, [])

  // Save document via API
  const handleSave = useCallback(async () => {
    if (!editorTitle.trim() || !editorContent.trim()) return

    setSaving(true)
    try {
      const tags = editorTags
        .split(",")
        .map(t => t.trim())
        .filter(t => t.length > 0)

      if (state.isCreating) {
        // Determine projectId based on current scope
        let projectId: string | undefined
        if (state.scope === "claudia") {
          projectId = CLAUDIA_CODER_WIKI_ID
        } else if (state.scope === "global" || state.scope === "all") {
          projectId = undefined // Global doc
        } else {
          projectId = state.scope // Project-specific
        }

        // Create new document via API
        const response = await fetch("/api/wiki", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editorTitle,
            content: editorContent,
            type: editorType,
            tags,
            projectId,
            isPublished: true,
          }),
        })

        if (!response.ok) throw new Error("Failed to create document")
        const data = await response.json()

        setState(s => ({
          ...s,
          documents: [...s.documents, data.document],
          selectedDocId: data.document.id,
          isCreating: false,
        }))
      } else if (state.editingDoc) {
        // Update existing document via API
        const response = await fetch(`/api/wiki/${state.editingDoc.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editorTitle,
            content: editorContent,
            type: editorType,
            tags,
          }),
        })

        if (!response.ok) throw new Error("Failed to update document")
        const data = await response.json()

        setState(s => ({
          ...s,
          documents: s.documents.map(d =>
            d.id === data.document.id ? data.document : d
          ),
          editingDoc: null,
        }))
      }
    } catch (err) {
      console.error("Save error:", err)
      alert(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }, [editorTitle, editorContent, editorType, editorTags, state.isCreating, state.editingDoc, state.scope])

  // Delete document via API
  const handleDelete = useCallback(async () => {
    if (!docToDelete) return

    try {
      const response = await fetch(`/api/wiki/${docToDelete.id}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete document")

      setState(s => ({
        ...s,
        documents: s.documents.filter(d => d.id !== docToDelete.id),
        selectedDocId: s.selectedDocId === docToDelete.id ? null : s.selectedDocId,
        editingDoc: s.editingDoc?.id === docToDelete.id ? null : s.editingDoc,
      }))

      setDeleteDialogOpen(false)
      setDocToDelete(null)
    } catch (err) {
      console.error("Delete error:", err)
      alert(err instanceof Error ? err.message : "Failed to delete")
    }
  }, [docToDelete])

  // Copy content to clipboard
  const handleCopy = useCallback(() => {
    if (selectedDoc) {
      navigator.clipboard.writeText(selectedDoc.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [selectedDoc])

  // Render tree node
  const TreeNode = ({ node, depth = 0 }: { node: WikiTreeNode; depth?: number }) => {
    const [isOpen, setIsOpen] = useState(true)
    const hasChildren = node.children.length > 0
    const Icon = DOC_TYPE_ICONS[node.document.type]
    const isSelected = state.selectedDocId === node.document.id

    return (
      <div>
        <button
          className={cn(
            "flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md transition-colors text-left",
            isSelected
              ? "bg-primary/10 text-primary"
              : "hover:bg-accent text-muted-foreground hover:text-foreground"
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => setState(s => ({ ...s, selectedDocId: node.document.id }))}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsOpen(!isOpen)
              }}
              className="p-0.5 hover:bg-accent rounded"
            >
              {isOpen ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate flex-1">{node.document.title}</span>
        </button>
        {hasChildren && isOpen && (
          <div>
            {node.children.map(child => (
              <TreeNode key={child.document.id} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Check if we're in edit mode
  const isEditing = state.isCreating || state.editingDoc !== null

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Documentation Wiki</h1>
            <p className="text-sm text-muted-foreground">
              Code documentation, change logs, and references
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Scope Selector */}
          <Select
            value={state.scope}
            onValueChange={(v) => setState(s => ({ ...s, scope: v as WikiScope, selectedDocId: null }))}
          >
            <SelectTrigger className="w-56">
              <Folder className="h-4 w-4 mr-2 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="Select scope..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  All Documentation
                </div>
              </SelectItem>
              <SelectItem value="claudia">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-primary" />
                  Claudia Coder
                </div>
              </SelectItem>
              <SelectItem value="global">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Global Docs
                </div>
              </SelectItem>
              {state.projects.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">
                    Projects
                  </div>
                  {state.projects.slice(0, 10).map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      <div className="flex items-center gap-2 max-w-[180px]">
                        <Folder className="h-4 w-4 shrink-0" />
                        <span className="truncate">{project.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={fetchDocuments} disabled={state.loading || seeding}>
            <RefreshCw className={cn("h-4 w-4 mr-2", (state.loading || seeding) && "animate-spin")} />
            {seeding ? "Loading docs..." : "Refresh"}
          </Button>
          <Button onClick={handleNewDocument}>
            <Plus className="h-4 w-4 mr-2" />
            New Document
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Sidebar - Document List */}
        <Card className="w-80 flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search docs..."
                  value={state.searchQuery}
                  onChange={(e) => setState(s => ({ ...s, searchQuery: e.target.value }))}
                  className="pl-8 h-9"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Select
                value={state.filterType}
                onValueChange={(v) => setState(s => ({ ...s, filterType: v as WikiDocType | "all" }))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(WIKI_DOC_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex border rounded-md">
                <Button
                  variant={state.viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8 rounded-r-none"
                  onClick={() => setState(s => ({ ...s, viewMode: "list" }))}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={state.viewMode === "tree" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8 rounded-l-none"
                  onClick={() => setState(s => ({ ...s, viewMode: "tree" }))}
                >
                  <FolderTree className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-2">
            <ScrollArea className="h-full">
              {state.loading || seeding ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  {seeding && (
                    <span className="text-sm text-muted-foreground">Loading documentation...</span>
                  )}
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {state.searchQuery || state.filterType !== "all"
                    ? "No matching documents"
                    : "No documents yet. Create your first one!"}
                </div>
              ) : state.viewMode === "tree" ? (
                <div className="space-y-0.5">
                  {documentTree.map(node => (
                    <TreeNode key={node.document.id} node={node} />
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredDocuments.map(doc => {
                    const Icon = DOC_TYPE_ICONS[doc.type]
                    const isSelected = state.selectedDocId === doc.id
                    return (
                      <button
                        key={doc.id}
                        className={cn(
                          "flex items-start gap-3 w-full p-2 rounded-md text-left transition-colors",
                          isSelected
                            ? "bg-primary/10"
                            : "hover:bg-accent"
                        )}
                        onClick={() => setState(s => ({ ...s, selectedDocId: doc.id }))}
                      >
                        <Icon className={cn(
                          "h-4 w-4 mt-0.5 shrink-0",
                          isSelected ? "text-primary" : "text-muted-foreground"
                        )} />
                        <div className="flex-1 min-w-0">
                          <div className={cn(
                            "font-medium text-sm truncate",
                            isSelected && "text-primary"
                          )}>
                            {doc.title}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", DOC_TYPE_COLORS[doc.type])}>
                              {WIKI_DOC_TYPE_LABELS[doc.type]}
                            </Badge>
                            {state.scope === "all" && doc.projectId && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {doc.projectId === CLAUDIA_CODER_WIKI_ID
                                  ? "Claudia"
                                  : doc.projectId === GLOBAL_WIKI_ID
                                  ? "Global"
                                  : state.projects.find(p => p.id === doc.projectId)?.name || "Project"}
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(doc.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Main Panel - Document View/Editor */}
        <Card className="flex-1 flex flex-col min-w-0">
          {isEditing ? (
            <>
              {/* Editor Header */}
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={handleCancelEdit}>
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <CardTitle className="text-base">
                      {state.isCreating ? "New Document" : "Edit Document"}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex border rounded-md">
                      <Button
                        variant={!previewMode ? "secondary" : "ghost"}
                        size="sm"
                        className="rounded-r-none gap-2"
                        onClick={() => setPreviewMode(false)}
                      >
                        <Code className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant={previewMode ? "secondary" : "ghost"}
                        size="sm"
                        className="rounded-l-none gap-2"
                        onClick={() => setPreviewMode(true)}
                      >
                        <Eye className="h-4 w-4" />
                        Preview
                      </Button>
                    </div>
                    <Button variant="outline" onClick={handleCancelEdit}>
                      Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving || !editorTitle.trim() || !editorContent.trim()}>
                      {saving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-4">
                <div className="flex flex-col gap-4 h-full">
                  {/* Metadata Row */}
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Label htmlFor="title" className="text-xs text-muted-foreground mb-1 block">Title</Label>
                      <Input
                        id="title"
                        placeholder="Document title..."
                        value={editorTitle}
                        onChange={(e) => setEditorTitle(e.target.value)}
                      />
                    </div>
                    <div className="w-40">
                      <Label className="text-xs text-muted-foreground mb-1 block">Type</Label>
                      <Select value={editorType} onValueChange={(v) => setEditorType(v as WikiDocType)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(WIKI_DOC_TYPE_LABELS).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-60">
                      <Label htmlFor="tags" className="text-xs text-muted-foreground mb-1 block">Tags (comma separated)</Label>
                      <Input
                        id="tags"
                        placeholder="api, auth, v2..."
                        value={editorTags}
                        onChange={(e) => setEditorTags(e.target.value)}
                      />
                    </div>
                  </div>
                  {/* Editor/Preview */}
                  <div className="flex-1 min-h-0">
                    {previewMode ? (
                      <ScrollArea className="h-full border rounded-md p-4">
                        <article className="prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {editorContent || "*No content yet...*"}
                          </ReactMarkdown>
                        </article>
                      </ScrollArea>
                    ) : (
                      <Textarea
                        placeholder="Write your documentation in Markdown..."
                        value={editorContent}
                        onChange={(e) => setEditorContent(e.target.value)}
                        className="h-full resize-none font-mono text-sm"
                      />
                    )}
                  </div>
                </div>
              </CardContent>
            </>
          ) : selectedDoc ? (
            <>
              {/* Document View Header */}
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const Icon = DOC_TYPE_ICONS[selectedDoc.type]
                      return <Icon className="h-5 w-5 text-muted-foreground" />
                    })()}
                    <div>
                      <CardTitle className="text-lg">{selectedDoc.title}</CardTitle>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className={cn("text-xs", DOC_TYPE_COLORS[selectedDoc.type])}>
                          {WIKI_DOC_TYPE_LABELS[selectedDoc.type]}
                        </Badge>
                        {selectedDoc.projectId && (
                          <Badge variant="secondary" className="text-xs">
                            <Folder className="h-3 w-3 mr-1" />
                            {selectedDoc.projectId === CLAUDIA_CODER_WIKI_ID
                              ? "Claudia Coder"
                              : selectedDoc.projectId === GLOBAL_WIKI_ID
                              ? "Global"
                              : state.projects.find(p => p.id === selectedDoc.projectId)?.name || "Project"}
                          </Badge>
                        )}
                        {selectedDoc.tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            <Tag className="h-3 w-3 mr-1" />
                            {tag}
                          </Badge>
                        ))}
                        <span className="text-xs text-muted-foreground">
                          Updated {new Date(selectedDoc.updatedAt).toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          v{selectedDoc.version}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={handleCopy}>
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEditDocument(selectedDoc)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditDocument(selectedDoc)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleCopy}>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Content
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-500"
                          onClick={() => {
                            setDocToDelete(selectedDoc)
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full p-6">
                  <article className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {selectedDoc.content}
                    </ReactMarkdown>
                  </article>
                </ScrollArea>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">
                  Select a document to view or create a new one
                </p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{docToDelete?.title}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
