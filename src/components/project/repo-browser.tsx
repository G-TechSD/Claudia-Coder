"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  GitBranch,
  Search,
  Loader2,
  AlertCircle,
  Link2,
  ExternalLink,
  Settings,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  MapPin,
  Pencil,
  Download,
  CheckCircle2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { listGitLabProjects, type GitLabProject } from "@/lib/gitlab/api"
import { getUserGitLabToken } from "@/lib/data/user-gitlab"
import { linkRepoToProject } from "@/lib/data/projects"
import { useAuth } from "@/components/auth/auth-provider"
import type { LinkedRepo } from "@/lib/data/types"

type LinkMode = "clone" | "existing" | null

interface RepoBrowserProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  linkedRepos: LinkedRepo[]
  onRepoLinked?: (repo: LinkedRepo) => void
  workingDirectory?: string
  basePath?: string // The project's base folder path (e.g., /home/bill/projects/my-app)
}

/**
 * Generate the auto-mapped local path for a repo
 * Format: <basePath>/repos/<repoName>
 */
function getAutoMappedPath(basePath: string | undefined, repoName: string): string {
  if (!basePath) return ""
  // Normalize: remove trailing slash, add /repos/<repoName>
  const normalizedBase = basePath.replace(/\/+$/, "")
  return `${normalizedBase}/repos/${repoName}`
}

export function RepoBrowser({
  open,
  onOpenChange,
  projectId,
  linkedRepos,
  onRepoLinked,
  workingDirectory,
  basePath
}: RepoBrowserProps) {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [repos, setRepos] = useState<GitLabProject[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasToken, setHasToken] = useState(false)
  const [linking, setLinking] = useState<number | null>(null)

  // Custom path state - tracks which repos have custom path enabled and their custom values
  const [customPathEnabled, setCustomPathEnabled] = useState<Record<number, boolean>>({})
  const [customPaths, setCustomPaths] = useState<Record<number, string>>({})

  // Link mode state - tracks which mode user selected for each repo
  const [linkModes, setLinkModes] = useState<Record<number, LinkMode>>({})

  // Clone status tracking
  const [cloneStatus, setCloneStatus] = useState<Record<number, { status: "cloning" | "success" | "error"; message?: string }>>({})

  // Effective base path: prefer basePath prop, fall back to workingDirectory
  const effectiveBasePath = basePath || workingDirectory

  // Check for token on mount - use getUserGitLabToken which checks both personal and shared instance tokens
  useEffect(() => {
    if (user?.id) {
      const token = getUserGitLabToken(user.id)
      setHasToken(!!token)
    } else {
      setHasToken(false)
    }
  }, [open, user?.id])

  // Debounced search
  const searchRepos = useCallback(async (query: string) => {
    if (!user?.id || !getUserGitLabToken(user.id)) {
      setError("GitLab token not configured")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const results = await listGitLabProjects({
        search: query || undefined,
        perPage: 20,
        owned: false
      })
      setRepos(results)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load repositories")
      setRepos([])
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  // Initial load when dialog opens
  useEffect(() => {
    if (open && hasToken) {
      searchRepos("")
    }
  }, [open, hasToken, searchRepos])

  // Debounced search effect
  useEffect(() => {
    if (!open || !hasToken) return

    const timer = setTimeout(() => {
      searchRepos(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, open, hasToken, searchRepos])

  const isRepoLinked = (repoId: number) => {
    return linkedRepos.some(r => r.provider === "gitlab" && r.id === repoId)
  }

  const handleLinkRepo = async (repo: GitLabProject, mode: LinkMode = "existing") => {
    if (!effectiveBasePath) {
      setError("Set project folder first before linking repositories")
      return
    }

    setLinking(repo.id)
    setLinkModes(prev => ({ ...prev, [repo.id]: mode }))

    try {
      // Determine the local path: use custom path if enabled, otherwise use auto-mapped path
      let localPath: string
      if (customPathEnabled[repo.id] && customPaths[repo.id]) {
        localPath = customPaths[repo.id]
      } else {
        localPath = getAutoMappedPath(effectiveBasePath, repo.name)
      }

      // If cloning, call the clone API first
      if (mode === "clone") {
        setCloneStatus(prev => ({ ...prev, [repo.id]: { status: "cloning" } }))

        const cloneResponse = await fetch("/api/projects/clone-repo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            basePath: effectiveBasePath,
            repo: {
              id: repo.id,
              name: repo.name,
              url: repo.http_url_to_repo || repo.web_url,
              path_with_namespace: repo.path_with_namespace
            },
            customPath: customPathEnabled[repo.id] ? customPaths[repo.id] : undefined,
            skipClone: false
          })
        })

        const cloneResult = await cloneResponse.json()

        if (!cloneResult.success) {
          setCloneStatus(prev => ({ ...prev, [repo.id]: { status: "error", message: cloneResult.error } }))
          setLinking(null)
          return
        }

        // Use the path from clone result
        localPath = cloneResult.localPath
        setCloneStatus(prev => ({ ...prev, [repo.id]: { status: "success", message: cloneResult.alreadyExists ? "Already cloned" : "Cloned successfully" } }))
      }

      const linkedRepo: LinkedRepo = {
        provider: "gitlab",
        id: repo.id,
        name: repo.name,
        path: repo.path_with_namespace,
        url: repo.web_url,
        localPath
      }

      const updated = linkRepoToProject(projectId, linkedRepo)
      if (updated) {
        onRepoLinked?.(linkedRepo)
      }

      // Reset link mode after successful link
      setLinkModes(prev => ({ ...prev, [repo.id]: null }))
    } catch (err) {
      console.error("Failed to link repo:", err)
      setCloneStatus(prev => ({ ...prev, [repo.id]: { status: "error", message: err instanceof Error ? err.message : "Failed to link" } }))
    } finally {
      setLinking(null)
    }
  }

  // Helper to set link mode for a repo
  const setLinkMode = (repoId: number, mode: LinkMode) => {
    setLinkModes(prev => ({ ...prev, [repoId]: mode }))
    // Clear any previous status when changing mode
    setCloneStatus(prev => {
      const newStatus = { ...prev }
      delete newStatus[repoId]
      return newStatus
    })
  }

  // Helper to toggle custom path for a repo
  const toggleCustomPath = (repoId: number, repoName: string) => {
    setCustomPathEnabled(prev => {
      const newState = { ...prev, [repoId]: !prev[repoId] }
      // Initialize custom path with auto-mapped path when enabling
      if (newState[repoId] && !customPaths[repoId]) {
        setCustomPaths(prevPaths => ({
          ...prevPaths,
          [repoId]: getAutoMappedPath(effectiveBasePath, repoName)
        }))
      }
      return newState
    })
  }

  // Helper to update custom path
  const updateCustomPath = (repoId: number, path: string) => {
    setCustomPaths(prev => ({ ...prev, [repoId]: path }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Link Repository
          </DialogTitle>
          <DialogDescription>
            Search and link GitLab repositories to this project
          </DialogDescription>
        </DialogHeader>

        {!hasToken ? (
          <Card className="bg-yellow-500/10 border-yellow-500/30">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">GitLab Token Required</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure your GitLab access token in Settings to browse repositories.
                </p>
                <Button size="sm" variant="outline" className="mt-3" asChild>
                  <a href="/settings">
                    <Settings className="h-4 w-4 mr-1" />
                    Go to Settings
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Auto-mapping Info */}
            {effectiveBasePath && (
              <Card className="bg-green-500/10 border-green-500/30">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="font-medium text-green-600">Auto-mapping enabled</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground">Project folder:</span>
                    <code className="bg-muted px-2 py-0.5 rounded font-mono text-xs flex-1 truncate">
                      {effectiveBasePath}
                    </code>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Repos will be mapped to: <code className="bg-muted px-1 py-0.5 rounded font-mono">{effectiveBasePath}/repos/&lt;repo-name&gt;</code>
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Warning if no base path configured */}
            {!effectiveBasePath && (
              <Card className="bg-orange-500/10 border-orange-500/30">
                <CardContent className="p-4 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-orange-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-orange-600">Set Project Folder First</p>
                    <p className="text-muted-foreground text-sm mt-1">
                      You need to set a base folder for this project before you can link repositories.
                      Repos will be cloned to <code className="bg-muted px-1 py-0.5 rounded font-mono text-xs">&lt;project-folder&gt;/repos/&lt;repo-name&gt;</code>
                    </p>
                    <Button size="sm" variant="outline" className="mt-3" asChild>
                      <a href={`/projects/${projectId}`}>
                        <Settings className="h-4 w-4 mr-1" />
                        Go to Project Settings
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search repositories..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Error */}
            {error && (
              <Card className="bg-red-500/10 border-red-500/30">
                <CardContent className="p-3 flex items-center gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  {error}
                </CardContent>
              </Card>
            )}

            {/* Results */}
            <div className="flex-1 overflow-auto space-y-2 min-h-[200px]">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : repos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? "No repositories found" : "No repositories available"}
                </div>
              ) : (
                repos.map(repo => {
                  const isLinked = isRepoLinked(repo.id)
                  const isLinking = linking === repo.id
                  const autoMappedPath = getAutoMappedPath(effectiveBasePath, repo.name)
                  const isCustomPathMode = customPathEnabled[repo.id]
                  const currentLinkMode = linkModes[repo.id]
                  const currentCloneStatus = cloneStatus[repo.id]

                  return (
                    <Card
                      key={repo.id}
                      className={cn(
                        "transition-colors",
                        isLinked
                          ? "border-primary/50 bg-primary/5"
                          : "hover:border-primary/30"
                      )}
                    >
                      <CardContent className="p-3 space-y-3">
                        {/* Repo Header */}
                        <div className="flex items-center gap-3">
                          <GitBranch className={cn(
                            "h-5 w-5 flex-shrink-0",
                            isLinked ? "text-primary" : "text-muted-foreground"
                          )} />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{repo.name}</p>
                              <Badge variant="outline" className="text-xs shrink-0">
                                {repo.visibility}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {repo.path_with_namespace}
                            </p>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            asChild
                          >
                            <a
                              href={repo.web_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>

                        {/* Already linked state */}
                        {isLinked && (
                          <div className="flex items-center gap-2 text-sm text-primary">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="font-medium">Linked</span>
                            {linkedRepos.find(r => r.id === repo.id)?.localPath && (
                              <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono flex-1 truncate ml-2">
                                {linkedRepos.find(r => r.id === repo.id)?.localPath}
                              </code>
                            )}
                          </div>
                        )}

                        {/* Link options - only show for repos that aren't linked yet and have basePath */}
                        {!isLinked && effectiveBasePath && (
                          <div className="border-t pt-3 space-y-3">
                            {/* Auto-mapped path display */}
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-green-500 flex-shrink-0" />
                              <span className="text-xs text-muted-foreground">Will be at:</span>
                              <code className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded font-mono flex-1 truncate">
                                {isCustomPathMode ? customPaths[repo.id] || autoMappedPath : autoMappedPath}
                              </code>
                            </div>

                            {/* Clone status message */}
                            {currentCloneStatus && (
                              <div className={cn(
                                "flex items-center gap-2 text-sm p-2 rounded",
                                currentCloneStatus.status === "cloning" && "bg-blue-500/10 text-blue-600",
                                currentCloneStatus.status === "success" && "bg-green-500/10 text-green-600",
                                currentCloneStatus.status === "error" && "bg-red-500/10 text-red-600"
                              )}>
                                {currentCloneStatus.status === "cloning" && <Loader2 className="h-4 w-4 animate-spin" />}
                                {currentCloneStatus.status === "success" && <CheckCircle2 className="h-4 w-4" />}
                                {currentCloneStatus.status === "error" && <AlertCircle className="h-4 w-4" />}
                                <span>{currentCloneStatus.message || (currentCloneStatus.status === "cloning" ? "Cloning repository..." : "")}</span>
                              </div>
                            )}

                            {/* Action buttons - Clone or Link Existing */}
                            <div className="flex items-center gap-2">
                              <Button
                                variant="default"
                                size="sm"
                                className="flex-1"
                                onClick={() => handleLinkRepo(repo, "clone")}
                                disabled={isLinking || !effectiveBasePath}
                              >
                                {isLinking && currentLinkMode !== "existing" ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4 mr-1" />
                                )}
                                Clone Here
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => handleLinkRepo(repo, "existing")}
                                disabled={isLinking || !effectiveBasePath}
                              >
                                {isLinking && currentLinkMode === "existing" ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <Link2 className="h-4 w-4 mr-1" />
                                )}
                                Already There
                              </Button>
                            </div>

                            {/* Custom path toggle */}
                            <div className="flex items-center justify-between">
                              <button
                                type="button"
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                onClick={() => toggleCustomPath(repo.id, repo.name)}
                              >
                                <Pencil className="h-3 w-3" />
                                <span>Custom path</span>
                                {isCustomPathMode ? (
                                  <ChevronUp className="h-3 w-3" />
                                ) : (
                                  <ChevronDown className="h-3 w-3" />
                                )}
                              </button>

                              {isCustomPathMode && (
                                <button
                                  type="button"
                                  className="text-xs text-blue-500 hover:text-blue-600"
                                  onClick={() => {
                                    setCustomPathEnabled(prev => ({ ...prev, [repo.id]: false }))
                                  }}
                                >
                                  Use auto-mapped
                                </button>
                              )}
                            </div>

                            {/* Custom path input (collapsed by default) */}
                            {isCustomPathMode && (
                              <div className="space-y-1">
                                <Input
                                  value={customPaths[repo.id] || ""}
                                  onChange={(e) => updateCustomPath(repo.id, e.target.value)}
                                  placeholder="/path/to/local/repo"
                                  className="h-8 text-sm font-mono"
                                />
                                <p className="text-xs text-muted-foreground">
                                  Enter the full path where this repo exists or should be cloned
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Disabled state when no basePath */}
                        {!isLinked && !effectiveBasePath && (
                          <div className="border-t pt-3">
                            <p className="text-xs text-muted-foreground">
                              Set a project folder to enable linking
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
