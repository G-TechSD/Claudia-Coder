"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Loader2, CheckCircle, AlertCircle, HardDrive, RefreshCw, Server } from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"

interface RecoveredProject {
  id: string
  name: string
  description: string
  status: string
  workingDirectory: string
  updatedAt: string
}

export default function RecoverPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [recovering, setRecovering] = useState(false)
  const [diskProjects, setDiskProjects] = useState<RecoveredProject[]>([])
  const [localProjects, setLocalProjects] = useState<string[]>([])
  const [userKeys, setUserKeys] = useState<string[]>([])
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [excludeTrashed, setExcludeTrashed] = useState(true)
  const [excludeDuplicateNames, setExcludeDuplicateNames] = useState(true)
  const [serverProjectCount, setServerProjectCount] = useState(0)

  // Load current state
  useEffect(() => {
    loadState()
  }, [])

  const loadState = async () => {
    setLoading(true)

    // Get projects from disk via API
    try {
      const response = await fetch("/api/projects/recover")
      const data = await response.json()
      if (data.success) {
        setDiskProjects(data.projects || [])
      }
    } catch (e) {
      console.error("Failed to fetch from API:", e)
    }

    // Get server-side project count
    try {
      const response = await fetch(`/api/projects${user?.id ? `?userId=${user.id}` : ""}`)
      const data = await response.json()
      if (data.success) {
        setServerProjectCount(data.count || 0)
      }
    } catch (e) {
      console.error("Failed to fetch server projects:", e)
    }

    // Get localStorage state
    const keys = Object.keys(localStorage).filter(k => k.includes("project"))
    setUserKeys(keys)

    // Get all project names from all localStorage keys
    const allNames: string[] = []
    keys.forEach(k => {
      try {
        const projects = JSON.parse(localStorage.getItem(k) || "[]")
        if (Array.isArray(projects)) {
          projects.forEach((p: { name?: string }) => {
            if (p.name) allNames.push(p.name)
          })
        }
      } catch {}
    })
    setLocalProjects([...new Set(allNames)])

    setLoading(false)
  }

  const handleRecover = async () => {
    setRecovering(true)
    setResult(null)

    try {
      // Use the already filtered projects
      const projectsToRecover = dedupedProjects

      if (!projectsToRecover.length) {
        setResult({ success: false, message: "No projects to recover after applying filters" })
        setRecovering(false)
        return
      }

      // First, save to server-side storage (source of truth)
      let serverSaved = 0
      try {
        const response = await fetch("/api/projects/recover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectIds: projectsToRecover.map(p => p.id),
            userId: user?.id,
            saveToServer: true,
          }),
        })
        const data = await response.json()
        if (data.success) {
          serverSaved = data.savedToServer || 0
          console.log(`[recover] Saved ${serverSaved} projects to server, skipped ${data.skippedDuplicates} duplicates`)
        }
      } catch (e) {
        console.error("Failed to save to server:", e)
      }

      // Also update localStorage for immediate UI feedback
      const userProjectKeys = Object.keys(localStorage).filter(
        k => k.match(/claudia_user_.*_projects/)
      )
      userProjectKeys.push("claudia_projects")

      let totalAdded = 0

      for (const key of userProjectKeys) {
        try {
          const existing = JSON.parse(localStorage.getItem(key) || "[]")
          const existingIds = new Set(existing.map((p: { id: string }) => p.id))

          let added = 0
          for (const project of projectsToRecover) {
            if (!existingIds.has(project.id)) {
              existing.push(project)
              existingIds.add(project.id)
              added++
            }
          }

          if (added > 0) {
            localStorage.setItem(key, JSON.stringify(existing))
            totalAdded += added
          }
        } catch (e) {
          console.error(`Failed to update ${key}:`, e)
        }
      }

      // Trigger storage event to refresh UI
      window.dispatchEvent(new StorageEvent("storage", { key: "claudia_projects" }))

      setResult({
        success: true,
        message: `Recovered ${projectsToRecover.length} projects. Saved ${serverSaved} to server (syncs across browsers). Added ${totalAdded} to localStorage cache. Please refresh the Projects page.`
      })

      // Reload state
      await loadState()

    } catch (error) {
      setResult({
        success: false,
        message: `Recovery failed: ${error instanceof Error ? error.message : "Unknown error"}`
      })
    } finally {
      setRecovering(false)
    }
  }

  const handleClearAndRecover = async () => {
    if (!confirm(`This will clear all existing projects and replace with ${dedupedProjects.length} recovered ones. Continue?`)) {
      return
    }

    setRecovering(true)
    setResult(null)

    try {
      const projectsToRecover = dedupedProjects

      if (!projectsToRecover.length) {
        setResult({ success: false, message: "No projects to recover after applying filters" })
        setRecovering(false)
        return
      }

      // First, save to server-side storage
      let serverSaved = 0
      try {
        const response = await fetch("/api/projects/recover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectIds: projectsToRecover.map(p => p.id),
            userId: user?.id,
            saveToServer: true,
          }),
        })
        const data = await response.json()
        if (data.success) {
          serverSaved = data.savedToServer || 0
        }
      } catch (e) {
        console.error("Failed to save to server:", e)
      }

      // Clear and set all user project keys in localStorage
      const userProjectKeys = Object.keys(localStorage).filter(
        k => k.match(/claudia_user_.*_projects/) || k === "claudia_projects"
      )

      for (const key of userProjectKeys) {
        localStorage.setItem(key, JSON.stringify(projectsToRecover))
        console.log(`Reset ${key} with ${projectsToRecover.length} projects`)
      }

      // Ensure common user IDs have keys
      const commonUserIds = ["admin-bill-001", "beta-admin"]
      for (const userId of commonUserIds) {
        const key = `claudia_user_${userId}_projects`
        localStorage.setItem(key, JSON.stringify(projectsToRecover))
      }

      window.dispatchEvent(new StorageEvent("storage", { key: "claudia_projects" }))

      setResult({
        success: true,
        message: `Cleared and recovered ${projectsToRecover.length} projects. Saved ${serverSaved} new projects to server. Please refresh the Projects page.`
      })

      await loadState()

    } catch (error) {
      setResult({
        success: false,
        message: `Recovery failed: ${error instanceof Error ? error.message : "Unknown error"}`
      })
    } finally {
      setRecovering(false)
    }
  }

  // Filter projects based on options
  const filteredDiskProjects = diskProjects.filter(p => {
    if (excludeTrashed && (p.status === "trashed" || p.status === "archived")) {
      return false
    }
    return true
  })

  // Dedupe by name if enabled (keep most recent)
  const dedupedProjects = excludeDuplicateNames
    ? Array.from(
        filteredDiskProjects.reduce((map, p) => {
          const existing = map.get(p.name)
          if (!existing || new Date(p.updatedAt) > new Date(existing.updatedAt)) {
            map.set(p.name, p)
          }
          return map
        }, new Map<string, RecoveredProject>()).values()
      )
    : filteredDiskProjects

  // Find projects on disk but not in localStorage
  const missingProjects = dedupedProjects.filter(
    dp => !localProjects.includes(dp.name)
  )

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">Project Recovery</h1>
      <p className="text-muted-foreground mb-8">
        Recover projects from ~/claudia-projects/ on disk
      </p>

      {loading ? (
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Scanning...
        </div>
      ) : (
        <div className="space-y-6">
          {/* Filter Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filter Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="excludeTrashed"
                  checked={excludeTrashed}
                  onCheckedChange={(checked) => setExcludeTrashed(checked === true)}
                />
                <Label htmlFor="excludeTrashed">
                  Exclude trashed & archived projects
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="excludeDuplicates"
                  checked={excludeDuplicateNames}
                  onCheckedChange={(checked) => setExcludeDuplicateNames(checked === true)}
                />
                <Label htmlFor="excludeDuplicates">
                  Deduplicate by name (keep most recent)
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                {diskProjects.length} total on disk → {dedupedProjects.length} after filters
              </p>
            </CardContent>
          </Card>

          {/* Status Cards */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  On Disk (filtered)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{dedupedProjects.length}</div>
                <p className="text-xs text-muted-foreground">{diskProjects.length} total, {dedupedProjects.length} after filters</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Server className="h-4 w-4" />
                  On Server
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-500">{serverProjectCount}</div>
                <p className="text-xs text-muted-foreground">synced across all browsers</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  In Browser Cache
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{localProjects.length}</div>
                <p className="text-xs text-muted-foreground">unique names in localStorage</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Missing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-500">{missingProjects.length}</div>
                <p className="text-xs text-muted-foreground">on disk but not in browser</p>
              </CardContent>
            </Card>
          </div>

          {/* Storage Keys */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Storage Keys</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {userKeys.map(key => (
                  <div key={key} className="font-mono text-sm text-muted-foreground">
                    {key}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Missing Projects */}
          {missingProjects.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                  Missing Projects ({missingProjects.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-auto">
                  {missingProjects.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.workingDirectory}</div>
                      </div>
                      <Badge variant="outline">{p.updatedAt?.split("T")[0]}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filtered Projects to Recover */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                Projects to Recover ({dedupedProjects.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-auto">
                {dedupedProjects.slice(0, 30).map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                    <div>
                      <div className="font-medium">{p.name}</div>
                    </div>
                    <Badge variant="outline">{p.updatedAt?.split("T")[0]}</Badge>
                  </div>
                ))}
                {dedupedProjects.length > 30 && (
                  <div className="text-sm text-muted-foreground text-center py-2">
                    ... and {dedupedProjects.length - 30} more
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Result */}
          {result && (
            <Card className={result.success ? "border-green-500" : "border-red-500"}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  {result.success ? (
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                  )}
                  <div>{result.message}</div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <Button
              size="lg"
              onClick={handleRecover}
              disabled={recovering || diskProjects.length === 0}
              className="gap-2"
            >
              {recovering ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <HardDrive className="h-5 w-5" />
              )}
              Recover Missing Projects
            </Button>

            <Button
              size="lg"
              variant="destructive"
              onClick={handleClearAndRecover}
              disabled={recovering || diskProjects.length === 0}
              className="gap-2"
            >
              {recovering ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <RefreshCw className="h-5 w-5" />
              )}
              Clear & Recover All
            </Button>

            <Button
              size="lg"
              variant="outline"
              onClick={loadState}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            After recovery, go to the <a href="/projects" className="text-primary underline">Projects page</a> and refresh.
          </p>
        </div>
      )}
    </div>
  )
}
