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
  FolderOpen
} from "lucide-react"
import { cn } from "@/lib/utils"
import { listGitLabProjects, hasGitLabToken, type GitLabProject } from "@/lib/gitlab/api"
import { linkRepoToProject } from "@/lib/data/projects"
import type { LinkedRepo } from "@/lib/data/types"

interface RepoBrowserProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  linkedRepos: LinkedRepo[]
  onRepoLinked?: (repo: LinkedRepo) => void
  workingDirectory?: string
}

export function RepoBrowser({
  open,
  onOpenChange,
  projectId,
  linkedRepos,
  onRepoLinked,
  workingDirectory
}: RepoBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [repos, setRepos] = useState<GitLabProject[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasToken, setHasToken] = useState(false)
  const [linking, setLinking] = useState<number | null>(null)

  // Check for token on mount
  useEffect(() => {
    setHasToken(hasGitLabToken())
  }, [open])

  // Debounced search
  const searchRepos = useCallback(async (query: string) => {
    if (!hasGitLabToken()) {
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
  }, [])

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
      const linkedRepo: LinkedRepo = {
        provider: "gitlab",
        id: repo.id,
        name: repo.name,
        path: repo.path_with_namespace,
        url: repo.web_url,
        // Auto-fill local path from project's working directory
        localPath: workingDirectory || undefined
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
            {/* Working Directory Info */}
            {workingDirectory && (
              <Card className="bg-blue-500/10 border-blue-500/30">
                <CardContent className="p-3 flex items-center gap-2 text-sm">
                  <FolderOpen className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  <span className="text-muted-foreground">Local path:</span>
                  <code className="bg-muted px-2 py-0.5 rounded font-mono text-xs flex-1 truncate">
                    {workingDirectory}
                  </code>
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

                  return (
                    <Card
                      key={repo.id}
                      className={cn(
                        "cursor-pointer transition-colors",
                        isLinked
                          ? "border-primary/50 bg-primary/5"
                          : "hover:border-primary/30"
                      )}
                    >
                      <CardContent className="p-3 flex items-center gap-3">
                        <GitBranch className={cn(
                          "h-5 w-5",
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
                          {repo.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                              {repo.description}
                            </p>
                          )}
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
