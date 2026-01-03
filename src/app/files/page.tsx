"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  GitBranch,
  GitCommit,
  GitPullRequest,
  GitMerge,
  Folder,
  File,
  FileCode,
  FileText,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  RefreshCw,
  Search,
  Clock,
  User,
  Check,
  X,
  AlertCircle,
  Play,
  MessageSquare,
  RotateCcw,
  Flag,
  Loader2,
  FolderUp,
  Sparkles
} from "lucide-react"
import { GitActionModal } from "@/components/git-action-modal"
import { InterviewModal } from "@/components/interview/interview-modal"
import { useGitAction } from "@/lib/api/hooks"
import {
  useGitLabProjects,
  useGitLabCommits,
  useGitLabBranches,
  useGitLabTree,
  useGitLabMergeRequests,
  useGitLabPipelines
} from "@/lib/api/hooks"
import type { GitLabProject, GitLabCommit, GitLabBranch, GitLabTreeItem, GitLabPipeline } from "@/lib/api"

type ActionType = "rollback" | "comment" | "approve" | "reject" | "flag"

interface ActionModalState {
  open: boolean
  type: ActionType
  target: {
    type: "commit" | "pr" | "branch" | "activity"
    id: string
    title: string
    sha?: string
    branch?: string
    repo?: string
  }
}

const pipelineStatusConfig = {
  success: { label: "Passed", color: "text-green-400", bg: "bg-green-400", icon: Check },
  failed: { label: "Failed", color: "text-red-400", bg: "bg-red-400", icon: X },
  running: { label: "Running", color: "text-blue-400", bg: "bg-blue-400", icon: Play },
  pending: { label: "Pending", color: "text-yellow-400", bg: "bg-yellow-400", icon: Clock },
  created: { label: "Created", color: "text-gray-400", bg: "bg-gray-400", icon: Clock },
  canceled: { label: "Canceled", color: "text-gray-400", bg: "bg-gray-400", icon: X },
  skipped: { label: "Skipped", color: "text-gray-400", bg: "bg-gray-400", icon: X }
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function getFileIcon(type: "tree" | "blob", name: string) {
  if (type === "tree") return Folder
  if (name.endsWith(".ts") || name.endsWith(".tsx") || name.endsWith(".js") || name.endsWith(".jsx")) return FileCode
  if (name.endsWith(".md")) return FileText
  if (name.endsWith(".json") || name.endsWith(".yaml") || name.endsWith(".yml")) return FileCode
  return File
}

function FileTreeItem({
  item,
  onNavigate,
  projectUrl,
  currentRef
}: {
  item: GitLabTreeItem
  onNavigate: (path: string) => void
  projectUrl: string
  currentRef?: string
}) {
  const Icon = getFileIcon(item.type, item.name)
  const isFolder = item.type === "tree"

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent/50 rounded transition-colors",
        isFolder && "cursor-pointer"
      )}
      onClick={() => isFolder && onNavigate(item.path)}
    >
      <Icon className={cn(
        "h-4 w-4 flex-none",
        isFolder ? "text-blue-400" : "text-muted-foreground"
      )} />
      <span className="truncate flex-1">{item.name}</span>
      {!isFolder && (
        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" asChild>
          <a
            href={`${projectUrl}/-/blob/${currentRef || "main"}/${item.path}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </Button>
      )}
      {isFolder && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
    </div>
  )
}

export default function FilesPage() {
  // API hooks
  const { projects, isLoading: projectsLoading, error: projectsError, refresh: refreshProjects } = useGitLabProjects()

  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<"commits" | "branches" | "files">("commits")
  const [search, setSearch] = useState("")
  const [currentBranch, setCurrentBranch] = useState<string | undefined>(undefined)
  const [currentPath, setCurrentPath] = useState("")

  // Select first project once loaded
  const selectedProject = useMemo(() => {
    if (selectedProjectId) {
      return projects.find(p => p.id === selectedProjectId) || null
    }
    if (projects.length > 0 && !selectedProjectId) {
      // Auto-select first project
      return projects[0]
    }
    return null
  }, [projects, selectedProjectId])

  // Use project's default branch or current selection
  const activeBranch = currentBranch || selectedProject?.default_branch || "main"

  // Data hooks for selected project
  const { commits, isLoading: commitsLoading, refresh: refreshCommits, loadMore, hasMore } = useGitLabCommits(
    selectedProject?.id || null,
    { ref: activeBranch }
  )
  const { branches, isLoading: branchesLoading, refresh: refreshBranches } = useGitLabBranches(selectedProject?.id || null)
  const { tree, isLoading: treeLoading, refresh: refreshTree } = useGitLabTree(
    selectedProject?.id || null,
    { ref: activeBranch }
  )
  const { mergeRequests } = useGitLabMergeRequests(selectedProject?.id || null, "opened")
  const { latestPipeline } = useGitLabPipelines(selectedProject?.id || null)

  // Get tree for current path
  const [treeItems, setTreeItems] = useState<GitLabTreeItem[]>([])
  const { tree: pathTree, isLoading: pathTreeLoading } = useGitLabTree(
    selectedProject?.id || null,
    { ref: activeBranch }
  )

  // Action modal state
  const [actionModal, setActionModal] = useState<ActionModalState | null>(null)
  const gitAction = useGitAction()

  // Interview modal state
  const [interviewModal, setInterviewModal] = useState<{
    open: boolean
    commit: GitLabCommit | null
  }>({ open: false, commit: null })

  const openActionModal = (type: ActionType, commit: GitLabCommit) => {
    setActionModal({
      open: true,
      type,
      target: {
        type: "commit",
        id: commit.id,
        title: commit.title,
        sha: commit.short_id,
        branch: activeBranch,
        repo: selectedProject?.name || ""
      }
    })
  }

  const handleActionSubmit = async (
    action: ActionType,
    data: { comment?: string; reason?: string }
  ) => {
    if (!actionModal) return

    await gitAction.execute(action, {
      type: actionModal.target.type,
      id: actionModal.target.id,
      sha: actionModal.target.sha,
      branch: actionModal.target.branch,
      repo: actionModal.target.repo
    }, data)
  }

  const handleRefreshAll = () => {
    refreshProjects()
    if (selectedProject) {
      refreshCommits()
      refreshBranches()
      refreshTree()
    }
  }

  const handleSelectProject = (project: GitLabProject) => {
    setSelectedProjectId(project.id)
    setCurrentBranch(project.default_branch || undefined)
    setCurrentPath("")
  }

  const navigateToPath = (path: string) => {
    setCurrentPath(path)
  }

  const navigateUp = () => {
    const parts = currentPath.split("/")
    parts.pop()
    setCurrentPath(parts.join("/"))
  }

  // Filter commits by search
  const filteredCommits = useMemo(() => {
    if (!search) return commits
    const lower = search.toLowerCase()
    return commits.filter(c =>
      c.title.toLowerCase().includes(lower) ||
      c.author_name.toLowerCase().includes(lower) ||
      c.short_id.toLowerCase().includes(lower)
    )
  }, [commits, search])

  // Filter branches by search
  const filteredBranches = useMemo(() => {
    if (!search) return branches
    const lower = search.toLowerCase()
    return branches.filter(b => b.name.toLowerCase().includes(lower))
  }, [branches, search])

  // Sort tree: folders first, then files
  const sortedTree = useMemo(() => {
    return [...tree].sort((a, b) => {
      if (a.type === "tree" && b.type !== "tree") return -1
      if (a.type !== "tree" && b.type === "tree") return 1
      return a.name.localeCompare(b.name)
    })
  }, [tree])

  // Get pipeline status config
  const getPipelineConfig = (pipeline: GitLabPipeline | null) => {
    if (!pipeline) return pipelineStatusConfig.pending
    return pipelineStatusConfig[pipeline.status] || pipelineStatusConfig.pending
  }

  const pipelineConf = getPipelineConfig(latestPipeline)
  const PipelineIcon = pipelineConf.icon

  if (projectsLoading && projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading repositories from GitLab...</p>
        </div>
      </div>
    )
  }

  if (projectsError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <div>
            <p className="text-lg font-medium">Failed to load repositories</p>
            <p className="text-sm text-muted-foreground">{projectsError.message}</p>
          </div>
          <Button onClick={() => refreshProjects()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Files & Repositories</h1>
          <p className="text-sm text-muted-foreground">
            {projects.length} repositories from GitLab
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleRefreshAll}>
            <RefreshCw className={cn("h-4 w-4", projectsLoading && "animate-spin")} />
            Sync All
          </Button>
        </div>
      </div>

      {/* Repository Selector */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {projects.map(project => {
          const isSelected = selectedProject?.id === project.id

          return (
            <button
              key={project.id}
              onClick={() => handleSelectProject(project)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg border min-w-[280px] transition-colors text-left",
                isSelected ? "border-primary bg-accent" : "hover:bg-accent/50"
              )}
            >
              <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-orange-500/10">
                <GitBranch className="h-5 w-5 text-orange-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{project.name}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{project.default_branch || "main"}</span>
                  <span>•</span>
                  <span>{formatTime(project.last_activity_at)}</span>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-none" asChild>
                <a href={project.web_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </button>
          )
        })}
      </div>

      {/* Main Content */}
      {selectedProject && (
        <div className="grid gap-6 lg:grid-cols-3 flex-1 min-h-0">
          {/* Left Panel - Commits/Branches/Files */}
          <Card className="lg:col-span-2 flex flex-col min-h-0">
            <CardHeader className="pb-2 flex-none">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {(["commits", "branches", "files"] as const).map(tab => (
                    <Button
                      key={tab}
                      variant={activeTab === tab ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setActiveTab(tab)}
                      className="capitalize"
                    >
                      {tab === "commits" && <GitCommit className="h-4 w-4 mr-1.5" />}
                      {tab === "branches" && <GitBranch className="h-4 w-4 mr-1.5" />}
                      {tab === "files" && <Folder className="h-4 w-4 mr-1.5" />}
                      {tab}
                    </Button>
                  ))}
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder={`Search ${activeTab}...`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 w-48 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              {/* Commits Tab */}
              {activeTab === "commits" && (
                <div>
                  {commitsLoading && commits.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : commits.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <GitCommit className="h-8 w-8 mb-2" />
                      <p>No commits found</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredCommits.map(commit => (
                        <div
                          key={commit.id}
                          className="flex items-start gap-4 p-4 hover:bg-accent/50 transition-colors group"
                        >
                          <div className="h-8 w-8 rounded-full flex items-center justify-center flex-none bg-green-400/10">
                            <GitCommit className="h-4 w-4 text-green-400" />
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{commit.title}</p>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <a
                                href={commit.web_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono bg-muted px-1.5 py-0.5 rounded hover:text-primary"
                              >
                                {commit.short_id}
                              </a>
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {commit.author_name}
                              </span>
                              <span>{formatTime(commit.created_at)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-none">
                            {/* Stats */}
                            {commit.stats && (
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mr-2">
                                <span className="text-green-400">+{commit.stats.additions}</span>
                                <span className="text-red-400">-{commit.stats.deletions}</span>
                              </div>
                            )}
                            {/* Action buttons - visible on hover */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => { e.stopPropagation(); openActionModal("comment", commit) }}
                                title="Add comment"
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10"
                                onClick={(e) => { e.stopPropagation(); setInterviewModal({ open: true, commit }) }}
                                title="Interview AI about this commit"
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => { e.stopPropagation(); openActionModal("flag", commit) }}
                                title="Flag for review"
                              >
                                <Flag className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-400 hover:text-red-400 hover:bg-red-400/10"
                                onClick={(e) => { e.stopPropagation(); openActionModal("rollback", commit) }}
                                title="Request rollback"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {hasMore && (
                        <div className="p-4 text-center">
                          <Button variant="outline" size="sm" onClick={() => loadMore()} disabled={commitsLoading}>
                            {commitsLoading ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : null}
                            Load More
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Branches Tab */}
              {activeTab === "branches" && (
                <div>
                  {branchesLoading && branches.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : branches.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <GitBranch className="h-8 w-8 mb-2" />
                      <p>No branches found</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredBranches.map(branch => (
                        <div
                          key={branch.name}
                          className="flex items-center gap-4 p-4 hover:bg-accent/50 transition-colors cursor-pointer"
                          onClick={() => setCurrentBranch(branch.name)}
                        >
                          <GitBranch className={cn(
                            "h-5 w-5 flex-none",
                            branch.default ? "text-primary" : "text-muted-foreground"
                          )} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{branch.name}</p>
                              {branch.default && (
                                <Badge variant="secondary" className="text-xs">default</Badge>
                              )}
                              {branch.protected && (
                                <Badge variant="outline" className="text-xs">protected</Badge>
                              )}
                              {activeBranch === branch.name && (
                                <Badge className="text-xs">selected</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {branch.commit.title} - {formatTime(branch.commit.created_at)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 text-xs flex-none">
                            <a
                              href={branch.web_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-primary"
                              onClick={e => e.stopPropagation()}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Files Tab */}
              {activeTab === "files" && (
                <div>
                  {/* Breadcrumb */}
                  {currentPath && (
                    <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/50">
                      <Button variant="ghost" size="sm" onClick={navigateUp} className="h-7 px-2">
                        <FolderUp className="h-4 w-4 mr-1" />
                        Up
                      </Button>
                      <span className="text-sm text-muted-foreground font-mono">/{currentPath}</span>
                    </div>
                  )}

                  {treeLoading && tree.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : tree.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Folder className="h-8 w-8 mb-2" />
                      <p>No files found</p>
                    </div>
                  ) : (
                    <div className="p-2">
                      {sortedTree.map(item => (
                        <FileTreeItem
                          key={item.id}
                          item={item}
                          onNavigate={navigateToPath}
                          projectUrl={selectedProject.web_url}
                          currentRef={activeBranch}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right Panel - Repository Details */}
          <Card className="flex flex-col min-h-0">
            <CardHeader className="pb-2 flex-none">
              <CardTitle className="text-base font-medium">Repository Info</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto space-y-6">
              {/* Repo Header */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">{selectedProject.name}</h3>
                <p className="text-sm text-muted-foreground font-mono">
                  {selectedProject.path_with_namespace}
                </p>
                {selectedProject.description && (
                  <p className="text-sm text-muted-foreground">
                    {selectedProject.description}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <Badge variant="default">GitLab</Badge>
                </div>
              </div>

              {/* Pipeline Status */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Pipeline</p>
                <div className={cn(
                  "flex items-center gap-2 p-3 rounded-lg",
                  `${pipelineConf.bg}/10`
                )}>
                  <PipelineIcon className={cn("h-5 w-5", pipelineConf.color)} />
                  <span className={cn("font-medium", pipelineConf.color)}>
                    {latestPipeline ? pipelineConf.label : "No pipelines"}
                  </span>
                </div>
              </div>

              {/* Current Branch */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Current Branch</p>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                  <GitBranch className="h-4 w-4 text-primary" />
                  <span className="font-mono text-sm">{activeBranch}</span>
                </div>
              </div>

              {/* Last Commit */}
              {commits.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Last Commit</p>
                  <div className="p-3 rounded-lg border space-y-2">
                    <p className="text-sm">{commits[0].title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <code className="font-mono bg-muted px-1.5 py-0.5 rounded">
                        {commits[0].short_id}
                      </code>
                      <span>by {commits[0].author_name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(commits[0].created_at)}
                    </p>
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-lg bg-muted">
                  <p className="text-lg font-semibold">{branches.length}</p>
                  <p className="text-xs text-muted-foreground">Branches</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted">
                  <p className="text-lg font-semibold">{selectedProject.star_count}</p>
                  <p className="text-xs text-muted-foreground">Stars</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted">
                  <p className="text-lg font-semibold">{mergeRequests.length}</p>
                  <p className="text-xs text-muted-foreground">Open MRs</p>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2">
                <Button className="w-full gap-2" asChild>
                  <a href={`${selectedProject.web_url}/-/merge_requests/new`} target="_blank" rel="noopener noreferrer">
                    <GitPullRequest className="h-4 w-4" />
                    Create Merge Request
                  </a>
                </Button>
                <Button variant="outline" className="w-full gap-2" asChild>
                  <a href={`${selectedProject.web_url}/-/network/${activeBranch}`} target="_blank" rel="noopener noreferrer">
                    <GitMerge className="h-4 w-4" />
                    View Graph
                  </a>
                </Button>
                <Button variant="ghost" className="w-full gap-2" asChild>
                  <a href={selectedProject.web_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Open in GitLab
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Action Modal */}
      {actionModal && (
        <GitActionModal
          open={actionModal.open}
          onOpenChange={(open) => !open && setActionModal(null)}
          actionType={actionModal.type}
          target={actionModal.target}
          onSubmit={handleActionSubmit}
        />
      )}

      {/* Interview Modal */}
      {interviewModal.commit && (
        <InterviewModal
          open={interviewModal.open}
          onOpenChange={(open) => setInterviewModal({ open, commit: open ? interviewModal.commit : null })}
          targetType="commit"
          targetId={interviewModal.commit.id}
          targetTitle={interviewModal.commit.title}
          targetContext={{
            sha: interviewModal.commit.short_id,
            author: interviewModal.commit.author_name,
            additions: interviewModal.commit.stats?.additions,
            deletions: interviewModal.commit.stats?.deletions,
            repo: selectedProject?.name,
            branch: activeBranch
          }}
        />
      )}
    </div>
  )
}
