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
  Check,
  ExternalLink,
  Settings,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  MapPin,
  Pencil
} from "lucide-react"
import { cn } from "@/lib/utils"
import { listGitLabProjects, type GitLabProject } from "@/lib/gitlab/api"
import { getUserGitLabToken } from "@/lib/data/user-gitlab"
import { linkRepoToProject } from "@/lib/data/projects"
import { useAuth } from "@/components/auth/auth-provider"
import type { LinkedRepo } from "@/lib/data/types"

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

  const handleLinkRepo = async (repo: GitLabProject) => {
    setLinking(repo.id)

    try {
      // Determine the local path: use custom path if enabled, otherwise use auto-mapped path
      let localPath: string | undefined
      if (customPathEnabled[repo.id] && customPaths[repo.id]) {
        localPath = customPaths[repo.id]
      } else if (effectiveBasePath) {
        localPath = getAutoMappedPath(effectiveBasePath, repo.name)
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
    } catch (err) {
      console.error("Failed to link repo:", err)
    } finally {
      setLinking(null)
    }
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
              <Card className="bg-yellow-500/10 border-yellow-500/30">
                <CardContent className="p-3 flex items-start gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-600">No project folder configured</p>
                    <p className="text-muted-foreground text-xs mt-1">
                      Set a working directory in project settings to enable auto-mapping of repo paths.
                    </p>
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

                          <div className="flex items-center gap-1">
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

                            {isLinked ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-primary"
                                disabled
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Linked
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleLinkRepo(repo)}
                                disabled={isLinking}
                              >
                                {isLinking ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                  <Link2 className="h-4 w-4 mr-1" />
                                  Link
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                        </div>

                        {/* Local Path Section - only show for repos that aren't linked yet */}
                        {!isLinked && effectiveBasePath && (
                          <div className="border-t pt-3 space-y-2">
                            {/* Auto-mapped path display */}
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-green-500 flex-shrink-0" />
                              <span className="text-xs text-muted-foreground">Maps to:</span>
                              <code className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded font-mono flex-1 truncate">
                                {isCustomPathMode ? customPaths[repo.id] || autoMappedPath : autoMappedPath}
                              </code>
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
                                  Enter the full path where this repo exists locally
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Show mapped path for already linked repos */}
                        {isLinked && linkedRepos.find(r => r.id === repo.id)?.localPath && (
                          <div className="border-t pt-2 flex items-center gap-2">
                            <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-xs text-muted-foreground">Mapped to:</span>
                            <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono flex-1 truncate">
                              {linkedRepos.find(r => r.id === repo.id)?.localPath}
                            </code>
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
