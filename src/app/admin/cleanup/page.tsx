"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Trash2,
  AlertTriangle,
  CheckCircle,
  Loader2,
  RefreshCw,
  Copy,
  Package,
  FileText,
  FolderKanban,
  Sparkles,
} from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"

// Types for cleanup analysis
interface DuplicateProject {
  name: string
  ids: string[]
  count: number
}

interface OrphanedPacketRun {
  id: string
  packetId: string
  projectId: string
}

interface OrphanedBuildPlan {
  id: string
  projectId: string
}

interface OrphanedResource {
  id: string
  projectId: string
  name: string
}

interface CleanupAnalysis {
  duplicateProjects: DuplicateProject[]
  orphanedPacketRuns: OrphanedPacketRun[]
  orphanedBuildPlans: OrphanedBuildPlan[]
  orphanedResources: OrphanedResource[]
  legacyStorageKeys: string[]
  totalProjects: number
  totalPacketRuns: number
  totalBuildPlans: number
  totalResources: number
}

// Storage keys for different data types
const LEGACY_STORAGE_KEYS = [
  "claudia_projects",
  "claudia_build_plans",
  "claudia_packet_runs",
  "claudia_resources",
  "claudia_brain_dumps",
  "claudia_interviews",
  "claudia_research",
  "claudia_business_ideas",
  "claudia_patents",
  "claudia_business_dev",
]

export default function AdminCleanupPage() {
  const { user } = useAuth()
  const [analysis, setAnalysis] = React.useState<CleanupAnalysis | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [cleaning, setCleaning] = React.useState(false)
  const [cleanupResult, setCleanupResult] = React.useState<string | null>(null)

  // Analyze data for duplicates and orphans
  const analyzeData = React.useCallback(() => {
    if (!user?.id) return

    setLoading(true)
    setCleanupResult(null)

    try {
      // Get user-scoped storage key prefix
      const userPrefix = `claudia_user_${user.id}_`

      // Analyze projects for duplicates
      const projectsKey = `${userPrefix}projects`
      const projectsData = localStorage.getItem(projectsKey)
      const projects: Array<{ id: string; name: string; status: string }> = projectsData
        ? JSON.parse(projectsData)
        : []

      // Find duplicate projects by name
      const projectNameCount = new Map<string, string[]>()
      for (const project of projects) {
        const existing = projectNameCount.get(project.name.toLowerCase()) || []
        existing.push(project.id)
        projectNameCount.set(project.name.toLowerCase(), existing)
      }

      const duplicateProjects: DuplicateProject[] = []
      projectNameCount.forEach((ids, name) => {
        if (ids.length > 1) {
          duplicateProjects.push({
            name,
            ids,
            count: ids.length,
          })
        }
      })

      // Get valid project IDs
      const validProjectIds = new Set(projects.map((p) => p.id))

      // Analyze packet runs for orphans
      const packetRunsKey = `${userPrefix}packet_runs`
      const packetRunsData = localStorage.getItem(packetRunsKey)
      const packetRuns: Array<{ id: string; packetId: string; projectId: string }> = packetRunsData
        ? JSON.parse(packetRunsData)
        : []

      const orphanedPacketRuns = packetRuns.filter((run) => !validProjectIds.has(run.projectId))

      // Analyze build plans for orphans
      const buildPlansKey = `${userPrefix}build_plans`
      const buildPlansData = localStorage.getItem(buildPlansKey)
      const buildPlans: Array<{ id: string; projectId: string }> = buildPlansData
        ? JSON.parse(buildPlansData)
        : []

      const orphanedBuildPlans = buildPlans.filter((plan) => !validProjectIds.has(plan.projectId))

      // Analyze resources for orphans
      const resourcesKey = `${userPrefix}resources`
      const resourcesData = localStorage.getItem(resourcesKey)
      const resources: Array<{ id: string; projectId: string; name: string }> = resourcesData
        ? JSON.parse(resourcesData)
        : []

      const orphanedResources = resources.filter((r) => !validProjectIds.has(r.projectId))

      // Check for legacy storage keys
      const legacyStorageKeys: string[] = []
      for (const key of LEGACY_STORAGE_KEYS) {
        if (localStorage.getItem(key)) {
          legacyStorageKeys.push(key)
        }
      }

      setAnalysis({
        duplicateProjects,
        orphanedPacketRuns,
        orphanedBuildPlans,
        orphanedResources,
        legacyStorageKeys,
        totalProjects: projects.length,
        totalPacketRuns: packetRuns.length,
        totalBuildPlans: buildPlans.length,
        totalResources: resources.length,
      })
    } catch (error) {
      console.error("Failed to analyze data:", error)
      setCleanupResult(`Error analyzing data: ${error}`)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  // Run analysis on mount
  React.useEffect(() => {
    analyzeData()
  }, [analyzeData])

  // Delete duplicate projects (keeps the first one)
  const deleteDuplicates = () => {
    if (!user?.id || !analysis) return

    setCleaning(true)
    let deletedCount = 0

    try {
      const userPrefix = `claudia_user_${user.id}_`
      const projectsKey = `${userPrefix}projects`
      const projectsData = localStorage.getItem(projectsKey)

      if (projectsData) {
        const projects: Array<{ id: string; name: string }> = JSON.parse(projectsData)
        const seenNames = new Set<string>()
        const idsToKeep = new Set<string>()

        // Keep first occurrence of each name
        for (const project of projects) {
          const lowerName = project.name.toLowerCase()
          if (!seenNames.has(lowerName)) {
            seenNames.add(lowerName)
            idsToKeep.add(project.id)
          }
        }

        const filtered = projects.filter((p) => idsToKeep.has(p.id))
        deletedCount = projects.length - filtered.length

        localStorage.setItem(projectsKey, JSON.stringify(filtered))
      }

      setCleanupResult(`Deleted ${deletedCount} duplicate projects`)
      analyzeData()
    } catch (error) {
      console.error("Failed to delete duplicates:", error)
      setCleanupResult(`Error deleting duplicates: ${error}`)
    } finally {
      setCleaning(false)
    }
  }

  // Clean up orphaned data
  const cleanupOrphans = () => {
    if (!user?.id || !analysis) return

    setCleaning(true)
    const results: string[] = []

    try {
      const userPrefix = `claudia_user_${user.id}_`

      // Get valid project IDs
      const projectsKey = `${userPrefix}projects`
      const projectsData = localStorage.getItem(projectsKey)
      const projects: Array<{ id: string }> = projectsData ? JSON.parse(projectsData) : []
      const validProjectIds = new Set(projects.map((p) => p.id))

      // Clean packet runs
      const packetRunsKey = `${userPrefix}packet_runs`
      const packetRunsData = localStorage.getItem(packetRunsKey)
      if (packetRunsData) {
        const packetRuns: Array<{ id: string; projectId: string }> = JSON.parse(packetRunsData)
        const filtered = packetRuns.filter((r) => validProjectIds.has(r.projectId))
        const removed = packetRuns.length - filtered.length
        if (removed > 0) {
          localStorage.setItem(packetRunsKey, JSON.stringify(filtered))
          results.push(`${removed} orphaned packet runs`)
        }
      }

      // Clean build plans
      const buildPlansKey = `${userPrefix}build_plans`
      const buildPlansData = localStorage.getItem(buildPlansKey)
      if (buildPlansData) {
        const buildPlans: Array<{ id: string; projectId: string }> = JSON.parse(buildPlansData)
        const filtered = buildPlans.filter((p) => validProjectIds.has(p.projectId))
        const removed = buildPlans.length - filtered.length
        if (removed > 0) {
          localStorage.setItem(buildPlansKey, JSON.stringify(filtered))
          results.push(`${removed} orphaned build plans`)
        }
      }

      // Clean resources
      const resourcesKey = `${userPrefix}resources`
      const resourcesData = localStorage.getItem(resourcesKey)
      if (resourcesData) {
        const resources: Array<{ id: string; projectId: string }> = JSON.parse(resourcesData)
        const filtered = resources.filter((r) => validProjectIds.has(r.projectId))
        const removed = resources.length - filtered.length
        if (removed > 0) {
          localStorage.setItem(resourcesKey, JSON.stringify(filtered))
          results.push(`${removed} orphaned resources`)
        }
      }

      if (results.length > 0) {
        setCleanupResult(`Cleaned up: ${results.join(", ")}`)
      } else {
        setCleanupResult("No orphaned data to clean up")
      }
      analyzeData()
    } catch (error) {
      console.error("Failed to cleanup orphans:", error)
      setCleanupResult(`Error cleaning orphans: ${error}`)
    } finally {
      setCleaning(false)
    }
  }

  // Clean up legacy storage
  const cleanupLegacy = () => {
    setCleaning(true)
    const cleaned: string[] = []

    try {
      for (const key of LEGACY_STORAGE_KEYS) {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key)
          cleaned.push(key)
        }
      }

      if (cleaned.length > 0) {
        setCleanupResult(`Cleaned ${cleaned.length} legacy storage keys`)
      } else {
        setCleanupResult("No legacy storage to clean")
      }
      analyzeData()
    } catch (error) {
      console.error("Failed to cleanup legacy storage:", error)
      setCleanupResult(`Error cleaning legacy storage: ${error}`)
    } finally {
      setCleaning(false)
    }
  }

  // One-click cleanup all
  const cleanupAll = () => {
    if (!user?.id || !analysis) return

    setCleaning(true)
    const results: string[] = []

    try {
      // Delete duplicates
      const userPrefix = `claudia_user_${user.id}_`
      const projectsKey = `${userPrefix}projects`
      const projectsData = localStorage.getItem(projectsKey)

      if (projectsData) {
        const projects: Array<{ id: string; name: string }> = JSON.parse(projectsData)
        const seenNames = new Set<string>()
        const idsToKeep = new Set<string>()

        for (const project of projects) {
          const lowerName = project.name.toLowerCase()
          if (!seenNames.has(lowerName)) {
            seenNames.add(lowerName)
            idsToKeep.add(project.id)
          }
        }

        const filtered = projects.filter((p) => idsToKeep.has(p.id))
        const deletedDupes = projects.length - filtered.length
        if (deletedDupes > 0) {
          localStorage.setItem(projectsKey, JSON.stringify(filtered))
          results.push(`${deletedDupes} duplicate projects`)
        }

        // Get valid IDs after deduplication
        const validProjectIds = new Set(filtered.map((p) => p.id))

        // Clean packet runs
        const packetRunsKey = `${userPrefix}packet_runs`
        const packetRunsData = localStorage.getItem(packetRunsKey)
        if (packetRunsData) {
          const packetRuns: Array<{ id: string; projectId: string }> = JSON.parse(packetRunsData)
          const filteredRuns = packetRuns.filter((r) => validProjectIds.has(r.projectId))
          const removed = packetRuns.length - filteredRuns.length
          if (removed > 0) {
            localStorage.setItem(packetRunsKey, JSON.stringify(filteredRuns))
            results.push(`${removed} orphaned packet runs`)
          }
        }

        // Clean build plans
        const buildPlansKey = `${userPrefix}build_plans`
        const buildPlansData = localStorage.getItem(buildPlansKey)
        if (buildPlansData) {
          const buildPlans: Array<{ id: string; projectId: string }> = JSON.parse(buildPlansData)
          const filteredPlans = buildPlans.filter((p) => validProjectIds.has(p.projectId))
          const removed = buildPlans.length - filteredPlans.length
          if (removed > 0) {
            localStorage.setItem(buildPlansKey, JSON.stringify(filteredPlans))
            results.push(`${removed} orphaned build plans`)
          }
        }

        // Clean resources
        const resourcesKey = `${userPrefix}resources`
        const resourcesData = localStorage.getItem(resourcesKey)
        if (resourcesData) {
          const resources: Array<{ id: string; projectId: string }> = JSON.parse(resourcesData)
          const filteredResources = resources.filter((r) => validProjectIds.has(r.projectId))
          const removed = resources.length - filteredResources.length
          if (removed > 0) {
            localStorage.setItem(resourcesKey, JSON.stringify(filteredResources))
            results.push(`${removed} orphaned resources`)
          }
        }
      }

      // Clean legacy storage
      let legacyCount = 0
      for (const key of LEGACY_STORAGE_KEYS) {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key)
          legacyCount++
        }
      }
      if (legacyCount > 0) {
        results.push(`${legacyCount} legacy storage keys`)
      }

      if (results.length > 0) {
        setCleanupResult(`Cleaned: ${results.join(", ")}`)
      } else {
        setCleanupResult("No cleanup needed - data is clean!")
      }
      analyzeData()
    } catch (error) {
      console.error("Failed to run full cleanup:", error)
      setCleanupResult(`Error during cleanup: ${error}`)
    } finally {
      setCleaning(false)
    }
  }

  const hasIssues =
    analysis &&
    (analysis.duplicateProjects.length > 0 ||
      analysis.orphanedPacketRuns.length > 0 ||
      analysis.orphanedBuildPlans.length > 0 ||
      analysis.orphanedResources.length > 0 ||
      analysis.legacyStorageKeys.length > 0)

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Data Cleanup</h1>
          <p className="text-sm text-muted-foreground">
            Find and remove duplicate projects and orphaned data
          </p>
        </div>
        <Button variant="outline" onClick={analyzeData} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh Analysis
        </Button>
      </div>

      {/* Result message */}
      {cleanupResult && (
        <div
          className={`p-4 rounded-lg flex items-center gap-3 ${
            cleanupResult.includes("Error")
              ? "bg-destructive/10 text-destructive"
              : "bg-green-500/10 text-green-600 dark:text-green-400"
          }`}
        >
          {cleanupResult.includes("Error") ? (
            <AlertTriangle className="h-5 w-5" />
          ) : (
            <CheckCircle className="h-5 w-5" />
          )}
          <span>{cleanupResult}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : analysis ? (
        <>
          {/* Summary Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analysis.totalProjects}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Packet Runs</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analysis.totalPacketRuns}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Build Plans</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analysis.totalBuildPlans}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Resources</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analysis.totalResources}</div>
              </CardContent>
            </Card>
          </div>

          {/* One-click cleanup */}
          {hasIssues && (
            <Card className="border-primary/50 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  One-Click Cleanup
                </CardTitle>
                <CardDescription>
                  Clean all duplicates, orphaned data, and legacy storage in one action
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={cleanupAll} disabled={cleaning} className="w-full md:w-auto">
                  {cleaning ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Clean Everything
                </Button>
              </CardContent>
            </Card>
          )}

          {/* No issues */}
          {!hasIssues && (
            <Card className="border-green-500/50 bg-green-500/5">
              <CardContent className="py-8">
                <div className="flex flex-col items-center justify-center text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                  <h3 className="text-lg font-medium">All Clean!</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    No duplicate projects or orphaned data found
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Duplicate Projects */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Copy className="h-5 w-5" />
                Duplicate Projects
                {analysis.duplicateProjects.length > 0 && (
                  <Badge variant="warning" className="ml-2">
                    {analysis.duplicateProjects.length} found
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Projects with the same name (case-insensitive comparison)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analysis.duplicateProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No duplicate projects found</p>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    {analysis.duplicateProjects.map((dup, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div>
                          <span className="font-medium">{dup.name}</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            ({dup.count} copies)
                          </span>
                        </div>
                        <Badge variant="secondary">{dup.ids.length} projects</Badge>
                      </div>
                    ))}
                  </div>
                  <Button variant="destructive" onClick={deleteDuplicates} disabled={cleaning}>
                    {cleaning ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Delete Duplicates (Keep First)
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Orphaned Data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Orphaned Data
                {(analysis.orphanedPacketRuns.length > 0 ||
                  analysis.orphanedBuildPlans.length > 0 ||
                  analysis.orphanedResources.length > 0) && (
                  <Badge variant="warning" className="ml-2">
                    {analysis.orphanedPacketRuns.length +
                      analysis.orphanedBuildPlans.length +
                      analysis.orphanedResources.length}{" "}
                    found
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Data referencing projects that no longer exist
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analysis.orphanedPacketRuns.length === 0 &&
              analysis.orphanedBuildPlans.length === 0 &&
              analysis.orphanedResources.length === 0 ? (
                <p className="text-sm text-muted-foreground">No orphaned data found</p>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    {analysis.orphanedPacketRuns.length > 0 && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          <span>Orphaned Packet Runs</span>
                        </div>
                        <Badge>{analysis.orphanedPacketRuns.length}</Badge>
                      </div>
                    )}
                    {analysis.orphanedBuildPlans.length > 0 && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span>Orphaned Build Plans</span>
                        </div>
                        <Badge>{analysis.orphanedBuildPlans.length}</Badge>
                      </div>
                    )}
                    {analysis.orphanedResources.length > 0 && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span>Orphaned Resources</span>
                        </div>
                        <Badge>{analysis.orphanedResources.length}</Badge>
                      </div>
                    )}
                  </div>
                  <Button variant="destructive" onClick={cleanupOrphans} disabled={cleaning}>
                    {cleaning ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Clean Orphaned Data
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Legacy Storage */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                Legacy Storage
                {analysis.legacyStorageKeys.length > 0 && (
                  <Badge variant="warning" className="ml-2">
                    {analysis.legacyStorageKeys.length} found
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Old storage keys from before user-scoped storage migration
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analysis.legacyStorageKeys.length === 0 ? (
                <p className="text-sm text-muted-foreground">No legacy storage found</p>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    {analysis.legacyStorageKeys.map((key, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <code className="text-sm font-mono">{key}</code>
                      </div>
                    ))}
                  </div>
                  <Button variant="destructive" onClick={cleanupLegacy} disabled={cleaning}>
                    {cleaning ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Remove Legacy Storage
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
