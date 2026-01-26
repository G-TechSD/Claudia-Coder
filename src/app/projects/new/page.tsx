"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { InterviewPanel } from "@/components/interview/interview-panel"
import { detectIdeationIntent } from "@/lib/interview/prompts"
import { detectProjectType, generateQuickUnderstanding, type UnderstandingReport } from "@/lib/ai/ideation-detector"
import { generateQuickIdeationPlan, ideationPacketsToWorkPackets, createIdeationBuildPlan } from "@/lib/ai/ideation-plan"
import { VoiceInput } from "@/components/voice/voice-input"
import { createProject, updateProject, linkRepoToProject, configureLinearSync } from "@/lib/data/projects"
import { savePackets, saveBuildPlan, type BuildPlan, type WorkPacket, type PacketSummary } from "@/lib/ai/build-plan"
import { BuildPlanReview } from "@/components/project/build-plan-review"
import { IdeasExplorer } from "@/components/project/ideas-explorer"
import { UIFrameworkSelector, UIType, FrameworkOption, getFrameworksForType, detectUITypeFromDescription } from "@/components/project/ui-framework-selector"
import { createGitLabRepo, setGitLabToken, validateGitLabToken, listGitLabProjects } from "@/lib/gitlab/api"
import { getUserGitLabToken } from "@/lib/data/user-gitlab"
import { useSettings } from "@/hooks/useSettings"
import { getGlobalSettings } from "@/lib/settings/global-settings"
import { useAuth } from "@/components/auth/auth-provider"
import { LLMStatusBadge } from "@/components/llm/llm-status"
import { BetaUsageBanner } from "@/components/beta/usage-banner"
import type { InterviewSession, Project, VoiceRecording } from "@/lib/data/types"
import { getRecording, markProjectCreated } from "@/lib/data/voice-recordings-client"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  GitBranch,
  Loader2,
  AlertCircle,
  Key,
  Sparkles,
  MessageSquare,
  Zap,
  X,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Download,
  Search,
  Package,
  FolderOpen,
  Link2,
  ExternalLink,
  Plus,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Rocket,
  DollarSign,
  Mic,
  Lightbulb,
  Pencil,
  FileText
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type Mode = "choose" | "quick" | "interview" | "ideation" | "ideation_review" | "linear" | "setup" | "complete" | "build_review" | "ui_selection"

interface GeneratedPlan {
  name: string
  description: string
  features: string[]
  techStack: string[]
  priority: "low" | "medium" | "high" | "critical"
}

interface LinearProjectPreview {
  id: string
  name: string
  description?: string
  state: string
  progress: number
  teams: { nodes: Array<{ id: string; name: string; key: string }> }
}

interface LinearWorkPacket {
  id: string
  phaseId: string
  title: string
  description: string
  type: "feature" | "bugfix" | "refactor" | "test" | "docs" | "config" | "research" | "vision"
  priority: "critical" | "high" | "medium" | "low"
  status: "queued" | "in_progress" | "completed" | "blocked"
  tasks: Array<{ id: string; description: string; completed: boolean; order: number }>
  suggestedTaskType: string
  acceptanceCriteria: string[]
  estimatedTokens: number
  dependencies: string[]
  blockedBy?: string[]
  blocks?: string[]
  metadata: {
    source: "linear" | "vision-generation"
    linearId?: string
    linearIdentifier?: string
    linearState?: string
    linearLabels?: string[]
    linearAssignee?: string
    linearParentId?: string
    isVisionPacket?: boolean
    completionGate?: boolean
    projectType?: string
    storeDescription?: string
    tagline?: string
    keyFeatures?: string[]
    targetAudience?: string
    uniqueSellingPoints?: string[]
  }
}

interface LinearImportProject {
  name: string
  description: string
  linearProjectId: string
  teamIds: string[]
  progress: number
}

interface LinearImportData {
  projects: LinearImportProject[]
  phases: Array<{
    id: string
    name: string
    description: string
    order: number
    status: "not_started"
    isVisionPhase?: boolean
  }>
  packets: LinearWorkPacket[]
  summary: {
    totalIssues: number
    totalComments: number
    commentsImported: boolean
    nuanceExtraction?: {
      enabled: boolean
      issuesWithComments?: number
      processed?: number
      failed?: number
    }
    gameDetection?: {
      isGameOrCreative: boolean
      confidence: number
      projectType: string
      suggestedCategory: string
      matchedKeywords: string[]
      visionPacket?: {
        generated: boolean
        packetId?: string
        error?: string
      }
    }
    byPriority: Record<string, number>
    byStatus: Record<string, number>
    byType: Record<string, number>
  }
}

function NewProjectContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isBetaTester, betaLimits, refreshBetaLimits } = useAuth()
  const [mode, setMode] = useState<Mode>("choose")
  const [interviewSession, setInterviewSession] = useState<InterviewSession | null>(null)

  // Voice recording support - create project from voice recording
  const [sourceVoiceRecording, setSourceVoiceRecording] = useState<VoiceRecording | null>(null)

  // Quick mode state
  const [quickDescription, setQuickDescription] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(null)
  const [ideationReport, setIdeationReport] = useState<UnderstandingReport | null>(null)
  const [ideationFeedback, setIdeationFeedback] = useState("")
  const [planError, setPlanError] = useState("")
  const [isVoiceMode, setIsVoiceMode] = useState(false)

  // Settings for paid API access
  const { settings } = useSettings()

  // Beta tester project limit check
  const canCreateProject = !isBetaTester || (betaLimits?.canCreateProject ?? true)

  // Project setup state
  const [projectName, setProjectName] = useState("")
  const [projectDescription, setProjectDescription] = useState("")
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "critical">("medium")

  // Repo creation state - disabled by default, repos are set up after project creation
  const [createRepo, setCreateRepo] = useState(false)
  const [repoName, setRepoName] = useState("")
  const [repoVisibility, setRepoVisibility] = useState<"private" | "internal" | "public">("private")
  const [initWithReadme, setInitWithReadme] = useState(true)

  // Local repo linking state
  const [localRepoPath, setLocalRepoPath] = useState("")

  // Project folder path state (basePath for file browser)
  const [projectFolderPath, setProjectFolderPath] = useState("")

  // GitLab token state
  const [hasToken, setHasToken] = useState(false)
  const [showTokenInput, setShowTokenInput] = useState(false)
  const [tokenInput, setTokenInput] = useState("")
  const [tokenValidating, setTokenValidating] = useState(false)
  const [tokenError, setTokenError] = useState("")

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [createdProject, setCreatedProject] = useState<Project | null>(null)

  // Linear import state
  const [linearProjects, setLinearProjects] = useState<LinearProjectPreview[]>([])
  const [linearSearch, setLinearSearch] = useState("")
  const [linearLoading, setLinearLoading] = useState(false)
  const [linearError, setLinearError] = useState("")
  const [selectedLinearProjectId, setSelectedLinearProjectId] = useState<string | null>(null)
  const [linearImportData, setLinearImportData] = useState<LinearImportData | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importCategory, setImportCategory] = useState<string>("auto") // "auto" uses keyword detection, others override

  // Auto-generate build plan state
  const [autoGenerateBuildPlan, setAutoGenerateBuildPlan] = useState(() => {
    if (typeof window === "undefined") return true
    const stored = localStorage.getItem("claudia_auto_build_plan")
    return stored !== null ? stored === "true" : true
  })
  const [monetizationIntent, setMonetizationIntent] = useState(false)
  const [generatedBuildPlan, setGeneratedBuildPlan] = useState<BuildPlan | null>(null)
  const [buildPlanPacketSummary, setBuildPlanPacketSummary] = useState<PacketSummary | undefined>(undefined)
  const [buildPlanSource, setBuildPlanSource] = useState<{ server?: string; model?: string } | null>(null)
  const [isGeneratingBuildPlan, setIsGeneratingBuildPlan] = useState(false)
  const [buildPlanError, setBuildPlanError] = useState("")

  // UI Framework selection state
  const [detectedUIType, setDetectedUIType] = useState<UIType | null>(null)
  const [detectedUIAudience, setDetectedUIAudience] = useState<string | null>(null)
  const [suggestedFrameworks, setSuggestedFrameworks] = useState<string[]>([])
  const [selectedFramework, setSelectedFramework] = useState<FrameworkOption | null>(null)

  // Repo linking state (for Linear import flow)
  const [showRepoLinkDialog, setShowRepoLinkDialog] = useState(false)
  const [availableRepos, setAvailableRepos] = useState<Array<{
    provider: "gitlab"
    id: number
    name: string
    path: string
    url: string
    http_url_to_repo?: string
  }>>([])
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [selectedRepoIds, setSelectedRepoIds] = useState<Set<number>>(new Set())

  // Cloning state for Linear import flow
  const [isCloningRepos, setIsCloningRepos] = useState(false)
  const [cloningProgress, setCloningProgress] = useState<{ current: number; total: number; repoName: string }>({ current: 0, total: 0, repoName: "" })

  // Check for GitLab token on mount - use getUserGitLabToken which checks both personal and shared instance tokens
  useEffect(() => {
    if (user?.id) {
      const token = getUserGitLabToken(user.id)
      setHasToken(!!token)
    } else {
      setHasToken(false)
    }
  }, [user?.id])

  // Load voice recording if creating from voice
  useEffect(() => {
    const voiceRecordingId = searchParams.get("voiceRecordingId")
    if (voiceRecordingId) {
      const recording = getRecording(voiceRecordingId)
      if (recording) {
        setSourceVoiceRecording(recording)
        // Pre-populate description with transcription
        setQuickDescription(recording.transcription)
      }
    }
  }, [searchParams])

  // Handle "Create Project from Idea" flow
  useEffect(() => {
    const ideaName = searchParams.get("idea")
    const ideaContext = searchParams.get("context")

    if (ideaName) {
      // Pre-populate with idea data and go straight to quick mode
      setProjectName(ideaName)
      if (ideaContext) {
        // Create a prompt from the idea context
        const prompt = `Build a project based on this idea:\n\n**${ideaName}**\n\n${decodeURIComponent(ideaContext)}`
        setQuickDescription(prompt)
      } else {
        setQuickDescription(`Build: ${ideaName}`)
      }
      // Switch to quick mode automatically
      setMode("quick")
    }
  }, [searchParams])

  // Persist auto-generate build plan preference
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("claudia_auto_build_plan", String(autoGenerateBuildPlan))
    }
  }, [autoGenerateBuildPlan])

  // Session persistence key
  const SESSION_STORAGE_KEY = "claudia_new_project_session"
  const SESSION_MAX_AGE_MS = 30 * 60 * 1000 // 30 minutes

  // Restore session on mount
  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY)
      if (stored) {
        const session = JSON.parse(stored)
        const now = Date.now()

        // Only restore if session is less than 30 minutes old
        if (session.timestamp && (now - session.timestamp) < SESSION_MAX_AGE_MS) {
          // Only restore if we're in the initial "choose" mode (not already navigated elsewhere)
          if (mode === "choose" && session.mode && session.mode !== "complete") {
            setMode(session.mode)
            if (session.quickDescription) {
              setQuickDescription(session.quickDescription)
            }
          }
        } else {
          // Session expired, clear it
          sessionStorage.removeItem(SESSION_STORAGE_KEY)
        }
      }
    } catch {
      // Invalid session data, clear it
      sessionStorage.removeItem(SESSION_STORAGE_KEY)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount

  // Save session when mode or quickDescription changes
  useEffect(() => {
    if (typeof window === "undefined") return

    // Clear session when project is successfully created
    if (mode === "complete") {
      sessionStorage.removeItem(SESSION_STORAGE_KEY)
      return
    }

    // Don't save if we're still in the initial choose mode with no progress
    if (mode === "choose" && !quickDescription) {
      return
    }

    // Save current state to session storage
    const session = {
      mode,
      quickDescription,
      timestamp: Date.now()
    }
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
  }, [mode, quickDescription])

  // Load Linear projects when entering Linear mode
  useEffect(() => {
    if (mode === "linear") {
      loadLinearProjects()
    }
  }, [mode])

  const loadLinearProjects = async () => {
    setLinearLoading(true)
    setLinearError("")

    try {
      const response = await fetch("/api/linear/projects")
      if (!response.ok) {
        throw new Error("Failed to load Linear projects")
      }
      const data = await response.json()
      setLinearProjects(data.projects || [])
    } catch (err) {
      setLinearError(err instanceof Error ? err.message : "Failed to load projects")
    } finally {
      setLinearLoading(false)
    }
  }

  const selectLinearProject = (projectId: string) => {
    // Single select - toggle off if already selected
    setSelectedLinearProjectId(prev => prev === projectId ? null : projectId)
  }

  const handleLinearImport = async () => {
    if (!selectedLinearProjectId) return

    setIsImporting(true)
    setLinearError("")

    try {
      const response = await fetch("/api/linear/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedLinearProjectId,
          syncComments: true,       // Always import comments for full context
          extractNuance: true,      // Extract key decisions/requirements from comments
          generateVision: true,     // Generate vision packets for game/creative projects
          saveToMarkdown: false,    // Don't save markdown yet - we'll do it after project creation
          explicitCategory: importCategory !== "auto" ? importCategory : undefined // Override keyword detection if set
        })
      })

      if (!response.ok) {
        throw new Error("Failed to import projects")
      }

      const data = await response.json()
      setLinearImportData(data)

      // Pre-fill project details from import
      if (data.projects.length === 1) {
        setProjectName(data.projects[0].name)
        setProjectDescription(data.projects[0].description || `Imported from Linear with ${data.summary.totalIssues} issues`)
        setRepoName(toRepoName(data.projects[0].name))
      } else {
        setProjectName(`Linear Import (${data.projects.length} projects)`)
        setProjectDescription(`Imported ${data.projects.length} projects from Linear with ${data.summary.totalIssues} total issues`)
        setRepoName(toRepoName(`linear-import-${Date.now()}`))
      }
      setPriority("medium")

    } catch (err) {
      setLinearError(err instanceof Error ? err.message : "Import failed")
    } finally {
      setIsImporting(false)
    }
  }

  // Auto-save a Linear import project immediately
  const autoSaveLinearProject = async (repoToLink?: { id: number; name: string; path: string; url: string } | null) => {
    if (!linearImportData) return
    if (!user?.id) {
      setSubmitError("You must be logged in to create a project")
      return
    }

    setIsSubmitting(true)
    setSubmitError("")

    try {
      // Create the project immediately with imported data
      // Pass userId to ensure project is saved to user-scoped storage
      const project = createProject({
        name: projectName || linearImportData.projects[0]?.name || "Linear Import",
        description: projectDescription || linearImportData.projects[0]?.description || `Imported from Linear with ${linearImportData.summary.totalIssues} issues`,
        status: "planning",
        priority: priority || "medium",
        repos: [],
        packetIds: [],
        tags: ["imported-from-linear"],
        basePath: projectFolderPath.trim() || localRepoPath.trim() || undefined
      }, user.id)

      // Configure Linear sync
      if (linearImportData.projects.length > 0) {
        configureLinearSync(project.id, {
          mode: "imported",
          projectId: linearImportData.projects[0].linearProjectId,
          teamId: linearImportData.projects[0].teamIds[0],
          syncIssues: false,
          syncComments: false,
          syncStatus: false,
          importedAt: new Date().toISOString(),
          importedIssueCount: linearImportData.summary.totalIssues
        })
      }

      // Save the build plan with phases
      saveBuildPlan(project.id, {
        id: `plan-${Date.now()}`,
        projectId: project.id,
        version: 1,
        status: "approved",
        spec: {
          name: project.name,
          description: project.description,
          objectives: [],
          nonGoals: [],
          assumptions: [],
          risks: [],
          techStack: []
        },
        phases: linearImportData.phases.map(p => ({
          ...p,
          packetIds: linearImportData.packets
            .filter(pkt => pkt.status !== "completed")
            .map(pkt => pkt.id),
          dependencies: [],
          estimatedEffort: { optimistic: 8, realistic: 16, pessimistic: 32, confidence: "medium" as const },
          successCriteria: ["All packets completed"]
        })),
        packets: linearImportData.packets.map(pkt => ({
          ...pkt,
          blockedBy: pkt.dependencies || [],
          blocks: []
        })),
        modelAssignments: [],
        constraints: {
          requireLocalFirst: true,
          requireHumanApproval: ["planning", "deployment"],
          maxParallelPackets: 2
        },
        generatedBy: "linear-import",
        createdAt: new Date().toISOString()
      })

      // Save all the packets
      const packetsToSave = linearImportData.packets.map(pkt => ({
        ...pkt,
        blockedBy: pkt.dependencies || [],
        blocks: []
      }))
      await await savePackets(project.id, packetsToSave)

      // Update project with packet IDs
      updateProject(project.id, {
        packetIds: packetsToSave.map(p => p.id)
      }, user.id)

      // Link repo if one was selected
      if (repoToLink) {
        linkRepoToProject(project.id, {
          provider: "gitlab",
          id: repoToLink.id,
          name: repoToLink.name,
          path: repoToLink.path,
          url: repoToLink.url
        }, user.id)
      }

      setCreatedProject(project)
      setMode("complete")
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to create project")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLinearConfirm = async () => {
    if (!linearImportData) return

    // Check if there are existing repos in GitLab that could be linked
    if (hasToken) {
      setLoadingRepos(true)
      try {
        const repos = await listGitLabProjects({ perPage: 20 })
        if (repos.length > 0) {
          setAvailableRepos(repos.map(r => ({
            provider: "gitlab" as const,
            id: r.id,
            name: r.name,
            path: r.path_with_namespace,
            url: r.web_url,
            http_url_to_repo: r.http_url_to_repo
          })))
          setSelectedRepoIds(new Set()) // Reset selection
          setShowRepoLinkDialog(true)
          setLoadingRepos(false)
          return
        }
      } catch (err) {
        console.error("Failed to load repos:", err)
      }
      setLoadingRepos(false)
    }

    // No repos available or no token - auto-save immediately
    await autoSaveLinearProject(null)
  }

  const handleRepoLinkChoice = async (choice: "link" | "create" | "skip") => {
    if (choice === "link" && selectedRepoIds.size > 0) {
      // Clone and link all selected repos, then save project
      setShowRepoLinkDialog(false)
      setIsCloningRepos(true)

      const selectedRepos = availableRepos.filter(r => selectedRepoIds.has(r.id))
      const clonedRepos: Array<{
        provider: "gitlab"
        id: number
        name: string
        path: string
        url: string
        localPath?: string
      }> = []

      // Determine basePath - use explicitly set folder or create default
      // The server will resolve ~/claudia-projects to the actual home directory path
      const basePath = projectFolderPath.trim() || localRepoPath.trim() || `~/claudia-projects/${toRepoName(projectName)}`

      for (let i = 0; i < selectedRepos.length; i++) {
        const repo = selectedRepos[i]
        setCloningProgress({ current: i + 1, total: selectedRepos.length, repoName: repo.name })

        try {
          // Call the clone API
          const cloneResponse = await fetch("/api/projects/clone-repo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: `temp-${Date.now()}`, // Temp ID since project isn't created yet
              basePath,
              repo: {
                id: repo.id,
                name: repo.name,
                url: repo.http_url_to_repo || repo.url,
                path_with_namespace: repo.path
              },
              skipClone: false
            })
          })

          const cloneResult = await cloneResponse.json()

          if (cloneResult.success) {
            clonedRepos.push({
              provider: "gitlab",
              id: repo.id,
              name: repo.name,
              path: repo.path,
              url: repo.url,
              localPath: cloneResult.localPath
            })
          } else {
            console.error(`Failed to clone ${repo.name}:`, cloneResult.error)
            // Still add repo without localPath if clone fails
            clonedRepos.push({
              provider: "gitlab",
              id: repo.id,
              name: repo.name,
              path: repo.path,
              url: repo.url
            })
          }
        } catch (err) {
          console.error(`Failed to clone ${repo.name}:`, err)
          // Still add repo without localPath if clone fails
          clonedRepos.push({
            provider: "gitlab",
            id: repo.id,
            name: repo.name,
            path: repo.path,
            url: repo.url
          })
        }
      }

      setIsCloningRepos(false)
      setCloningProgress({ current: 0, total: 0, repoName: "" })

      // Update project folder path if it wasn't set
      if (!projectFolderPath.trim() && !localRepoPath.trim()) {
        setProjectFolderPath(basePath)
      }

      // Save project with all cloned repos
      await autoSaveLinearProjectWithRepos(clonedRepos, basePath)
    } else if (choice === "create") {
      // User wants to create a new repo - go to setup for repo creation options
      setShowRepoLinkDialog(false)
      setCreateRepo(true)
      setSelectedRepoIds(new Set())
      setMode("setup")
    } else {
      // Skip repo linking - save project immediately without repo
      setShowRepoLinkDialog(false)
      setSelectedRepoIds(new Set())
      setCreateRepo(false)
      await autoSaveLinearProject(null)
    }
  }

  // Auto-save a Linear import project with multiple repos
  const autoSaveLinearProjectWithRepos = async (repos: Array<{
    provider: "gitlab"
    id: number
    name: string
    path: string
    url: string
    localPath?: string
  }>, basePath?: string) => {
    if (!linearImportData) return
    if (!user?.id) {
      setSubmitError("You must be logged in to create a project")
      return
    }

    setIsSubmitting(true)
    setSubmitError("")

    try {
      // Create the project immediately with imported data
      // Pass userId to ensure project is saved to user-scoped storage
      const project = createProject({
        name: projectName || linearImportData.projects[0]?.name || "Linear Import",
        description: projectDescription || linearImportData.projects[0]?.description || `Imported from Linear with ${linearImportData.summary.totalIssues} issues`,
        status: "planning",
        priority: priority || "medium",
        repos: repos,
        packetIds: [],
        tags: ["imported-from-linear"],
        basePath: basePath || projectFolderPath.trim() || localRepoPath.trim() || undefined
      }, user.id)

      // Configure Linear sync
      if (linearImportData.projects.length > 0) {
        configureLinearSync(project.id, {
          mode: "imported",
          projectId: linearImportData.projects[0].linearProjectId,
          teamId: linearImportData.projects[0].teamIds[0],
          syncIssues: false,
          syncComments: false,
          syncStatus: false,
          importedAt: new Date().toISOString(),
          importedIssueCount: linearImportData.summary.totalIssues
        })
      }

      // Save the build plan with phases
      saveBuildPlan(project.id, {
        id: `plan-${Date.now()}`,
        projectId: project.id,
        version: 1,
        status: "approved",
        spec: {
          name: project.name,
          description: project.description,
          objectives: [],
          nonGoals: [],
          assumptions: [],
          risks: [],
          techStack: []
        },
        phases: linearImportData.phases.map(p => ({
          ...p,
          packetIds: linearImportData.packets
            .filter(pkt => pkt.status !== "completed")
            .map(pkt => pkt.id),
          dependencies: [],
          estimatedEffort: { optimistic: 8, realistic: 16, pessimistic: 32, confidence: "medium" as const },
          successCriteria: ["All packets completed"]
        })),
        packets: linearImportData.packets.map(pkt => ({
          ...pkt,
          blockedBy: pkt.dependencies || [],
          blocks: []
        })),
        modelAssignments: [],
        constraints: {
          requireLocalFirst: true,
          requireHumanApproval: ["planning", "deployment"],
          maxParallelPackets: 2
        },
        generatedBy: "linear-import",
        createdAt: new Date().toISOString()
      })

      // Save all the packets
      const packetsToSave = linearImportData.packets.map(pkt => ({
        ...pkt,
        blockedBy: pkt.dependencies || [],
        blocks: []
      }))
      await await savePackets(project.id, packetsToSave)

      // Update project with packet IDs
      updateProject(project.id, {
        packetIds: packetsToSave.map(p => p.id)
      }, user.id)

      setCreatedProject(project)
      setMode("complete")
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to create project")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Generate plan from quick description - auto-detects ideation vs build
  const handleFeelingLucky = async () => {
    if (!quickDescription.trim()) return

    setIsGenerating(true)
    setPlanError("")

    try {
      // Use LLM-powered detection instead of code-based heuristics
      const detectResponse = await fetch("/api/ideation/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: quickDescription.trim(),
          projectName: projectName || undefined
        })
      })

      if (detectResponse.ok) {
        const detection = await detectResponse.json()
        console.log("[Quick Start] LLM Detection:", detection)

        // If ideation detected with reasonable confidence, go to ideation flow
        if (detection.type === "ideation" && detection.confidence >= 0.4) {
          setIsGenerating(false)
          // Use the LLM-generated understanding report
          setIdeationReport({
            title: detection.title,
            summary: detection.summary,
            keyPoints: detection.keyPoints || [],
            questions: detection.questions || [],
            suggestedPackets: detection.suggestedPackets || []
          })
          setMode("ideation_review")
          return
        }
      } else {
        // Fallback to code-based detection if API fails
        const detection = detectProjectType(quickDescription.trim())
        console.log("[Quick Start] Fallback Detection:", detection)

        if (detection.type === "ideation" && detection.confidence >= 0.4) {
          setIsGenerating(false)
          const report = generateQuickUnderstanding(quickDescription.trim())
          setIdeationReport(report)
          setMode("ideation_review")
          return
        }
      }
    } catch (detectError) {
      console.warn("Detection API failed, using fallback:", detectError)
      // Fallback to code-based detection
      const detection = detectProjectType(quickDescription.trim())
      if (detection.type === "ideation" && detection.confidence >= 0.4) {
        setIsGenerating(false)
        const report = generateQuickUnderstanding(quickDescription.trim())
        setIdeationReport(report)
        setMode("ideation_review")
        return
      }
    }

    // Otherwise, continue with build plan generation
    try {
      const response = await fetch("/api/llm/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: quickDescription,
          allowPaidFallback: settings.allowPaidLLM
        })
      })

      if (!response.ok) {
        throw new Error("Failed to generate plan")
      }

      const plan = await response.json()
      setGeneratedPlan(plan)
      setMode("quick")
    } catch (error) {
      // Fallback to basic plan generation
      const words = quickDescription.split(/\s+/)
      const name = words.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ")

      setGeneratedPlan({
        name: name || "New Project",
        description: quickDescription,
        features: ["Core functionality as described"],
        techStack: [],
        priority: "medium"
      })
      setMode("quick")
    } finally {
      setIsGenerating(false)
    }
  }

  // Auto-save a project from "Quick Start" quick creation
  const autoSaveQuickProject = async (plan: GeneratedPlan) => {
    if (!user?.id) {
      setSubmitError("You must be logged in to create a project")
      return
    }

    setIsSubmitting(true)
    setSubmitError("")

    try {
      // Always set a basePath - use explicit path or generate a default
      const effectiveBasePath = projectFolderPath.trim() || localRepoPath.trim() || `~/claudia-projects/${toRepoName(plan.name)}`

      // Pass userId to ensure project is saved to user-scoped storage
      const project = createProject({
        name: plan.name,
        description: plan.description,
        status: "planning", // Start as planning since it's a quick create
        priority: plan.priority,
        repos: [],
        packetIds: [],
        tags: plan.techStack || [],
        basePath: effectiveBasePath
      }, user.id)

      // Ensure the working directory exists and is initialized as a git repo
      try {
        await fetch("/api/projects/ensure-working-directory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: project.id,
            projectName: project.name,
            projectDescription: project.description,
            basePath: effectiveBasePath
          })
        })
      } catch (ensureError) {
        console.warn("Failed to ensure working directory:", ensureError)
        // Non-fatal - continue with project creation
      }

      // Link voice recording if project was created from voice
      if (sourceVoiceRecording) {
        markProjectCreated(sourceVoiceRecording.id, project.id)
        updateProject(project.id, {
          tags: [...(project.tags || []), "created-from-voice"]
        }, user.id)
      }

      setCreatedProject(project)
      setMode("complete")
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to create project")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleApprovePlan = async () => {
    if (!generatedPlan) return

    // Auto-save the project immediately
    await autoSaveQuickProject(generatedPlan)
  }

  // Create an Ideas project with research packets
  const handleApproveIdeation = async () => {
    if (!ideationReport || !user?.id) {
      setSubmitError("You must be logged in to create a project")
      return
    }

    setIsSubmitting(true)
    setSubmitError("")

    try {
      // Generate a comprehensive ideation plan with better packets
      const userInput = ideationReport.summary + (ideationFeedback ? `\n\nAdditional context: ${ideationFeedback}` : "")
      const { plan: ideationPlan, packets: ideationPackets } = generateQuickIdeationPlan(
        userInput,
        ideationReport.title
      )

      // Create the ideas project
      const project = createProject({
        name: ideationPlan.title,
        description: ideationPlan.summary.slice(0, 500),
        status: "planning",
        priority: "medium",
        repos: [],
        packetIds: [],
        tags: ["ideas", "research"],
        category: "ideas",
        basePath: projectFolderPath.trim() || undefined
      }, user.id)

      // Convert ideation packets to work packets using the new converter
      const workPackets = ideationPacketsToWorkPackets(ideationPackets, "ideation")

      // Add user feedback to packet metadata
      if (ideationFeedback) {
        workPackets.forEach(p => {
          if (p.metadata) {
            p.metadata.userFeedback = ideationFeedback
          }
        })
      }

      // Create and save the ideation build plan
      const buildPlan = createIdeationBuildPlan(project.id, ideationPlan.title, workPackets)
      saveBuildPlan(project.id, buildPlan)

      // Save the packets
      await await savePackets(project.id, workPackets)

      // Update project with packet IDs
      updateProject(project.id, {
        packetIds: workPackets.map(p => p.id)
      }, user.id)

      // Save understanding report as a doc
      try {
        const reportMarkdown = `# ${ideationPlan.title}

## What We're Exploring

${ideationPlan.summary}

## Key Questions

${ideationPlan.questions.map(q => `- ${q}`).join("\n")}

${ideationFeedback ? `## Additional Context from User

${ideationFeedback}` : ""}

## Research Plan

This exploration will go through ${workPackets.length} research tasks:

${workPackets.map((p, i) => `### ${i + 1}. ${p.title}
${p.description}

**Expected Output:** ${p.acceptanceCriteria[1] || "Comprehensive markdown document"}
`).join("\n")}

---
*Generated by Claudia Ideation Engine*
`
        await fetch(`/api/projects/${project.id}/docs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "exploration-plan.md",
            content: reportMarkdown
          })
        })
      } catch (err) {
        console.warn("Failed to save exploration plan:", err)
      }

      setCreatedProject(project)
      setMode("complete")
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to create ideas project")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRejectPlan = () => {
    setGeneratedPlan(null)
    setMode("choose")
  }

  const handleRegeneratePlan = async () => {
    await handleFeelingLucky()
  }

  // Auto-save a project from interview completion (when build plan is disabled)
  const autoSaveInterviewProject = async (
    name: string,
    description: string,
    extractedPriority: "low" | "medium" | "high" | "critical",
    techStack: string[],
    session: InterviewSession
  ) => {
    if (!user?.id) {
      setSubmitError("You must be logged in to create a project")
      return
    }

    setIsSubmitting(true)
    setSubmitError("")

    try {
      // Pass userId to ensure project is saved to user-scoped storage
      const project = createProject({
        name,
        description,
        status: "planning", // Start as planning since no build plan was generated
        priority: extractedPriority,
        repos: [],
        packetIds: [],
        tags: techStack,
        basePath: projectFolderPath.trim() || localRepoPath.trim() || undefined,
        creationInterview: session
      }, user.id)

      // Link voice recording if project was created from voice
      if (sourceVoiceRecording) {
        markProjectCreated(sourceVoiceRecording.id, project.id)
        updateProject(project.id, {
          tags: [...(project.tags || []), "created-from-voice"]
        }, user.id)
      }

      setCreatedProject(project)
      setMode("complete")
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to create project")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInterviewComplete = async (session: InterviewSession) => {
    setInterviewSession(session)

    const extractedData = session.extractedData || {}
    const name = (extractedData.name as string) || generateProjectName(session)
    const description = (extractedData.description as string) || session.summary || ""

    // Check for monetization intent from interview
    const hasMonetizationIntent = Boolean(extractedData.monetization || extractedData.monetizationIntent)
    setMonetizationIntent(hasMonetizationIntent)

    setProjectName(name)
    setProjectDescription(description)
    setRepoName(toRepoName(name))
    const extractedPriority = (extractedData.priority as "low" | "medium" | "high" | "critical") || "medium"
    setPriority(extractedPriority)
    const techStack = (extractedData.techStack as string[]) || []

    // Check for UI detection from interview
    const needsUI = Boolean(extractedData.needsUI)
    const uiType = (extractedData.uiType as UIType | null) || detectUITypeFromDescription(description)
    const uiAudience = extractedData.uiAudience as string | null
    const frameworks = (extractedData.suggestedFrameworks as string[]) || []

    // If UI was detected, show UI framework selection before build plan
    if (needsUI && uiType && uiType !== "api_only") {
      setDetectedUIType(uiType)
      setDetectedUIAudience(uiAudience)
      setSuggestedFrameworks(frameworks)
      setMode("ui_selection")
      return // Don't generate build plan yet - wait for framework selection
    }

    // If auto-generate is enabled, generate build plan and show review
    if (autoGenerateBuildPlan) {
      await generateBuildPlanForProject(name, description, hasMonetizationIntent)
    } else {
      // Auto-save project immediately without build plan
      await autoSaveInterviewProject(name, description, extractedPriority, techStack, session)
    }
  }

  // Handle UI framework selection
  const handleUIFrameworkSelect = async (framework: FrameworkOption) => {
    setSelectedFramework(framework)

    // Add framework to tech stack and regenerate build plan with UI context
    const techStack = (interviewSession?.extractedData?.techStack as string[]) || []
    if (!techStack.includes(framework.id)) {
      techStack.push(framework.id)
    }

    // Generate build plan with UI context
    if (autoGenerateBuildPlan) {
      await generateBuildPlanForProject(
        projectName,
        projectDescription,
        monetizationIntent,
        undefined,
        {
          needsUI: true,
          uiType: detectedUIType,
          selectedFramework: framework.id,
          uiAudience: detectedUIAudience
        }
      )
    } else {
      setMode("setup")
    }
  }

  // Handle skipping UI framework selection
  const handleUIFrameworkSkip = async () => {
    // Generate build plan without specific framework selection (AI will decide)
    if (autoGenerateBuildPlan) {
      await generateBuildPlanForProject(
        projectName,
        projectDescription,
        monetizationIntent,
        undefined,
        {
          needsUI: true,
          uiType: detectedUIType,
          uiAudience: detectedUIAudience
        }
      )
    } else {
      setMode("setup")
    }
  }

  // Generate build plan for a project
  const generateBuildPlanForProject = async (
    name: string,
    description: string,
    includeBusinessDev: boolean = false,
    preferredModelString?: string,
    uiContext?: {
      needsUI: boolean
      uiType: UIType | null
      selectedFramework?: string
      uiAudience?: string | null
    }
  ) => {
    setIsGeneratingBuildPlan(true)
    setBuildPlanError("")

    try {
      // Add business context to description if monetization is intended
      let enhancedDescription = description
      if (includeBusinessDev) {
        enhancedDescription += "\n\nBusiness Requirements: This app will be monetized. Include business development tasks such as revenue model research, payment integration planning, analytics setup, and legal documentation (terms of service, privacy policy)."
      }

      // Add UI context if provided
      if (uiContext?.needsUI && uiContext?.uiType) {
        enhancedDescription += `\n\n=== UI PROJECT CONTEXT ===\nUI Type: ${uiContext.uiType}`
        if (uiContext.uiAudience) {
          enhancedDescription += `\nTarget Audience: ${uiContext.uiAudience}`
        }
        if (uiContext.selectedFramework) {
          enhancedDescription += `\nSelected Framework: ${uiContext.selectedFramework}`
        }
        enhancedDescription += `\n\nIMPORTANT: Since this is a ${uiContext.uiType} project:
1. Start with UI scaffolding - First packet should set up the UI framework and basic structure
2. Include design system packet - Colors, typography, components, spacing
3. Prioritize user-visible features - Users should see progress early
4. Order packets so users can see and interact with the UI early in development`
      }

      // Parse the model string to extract server and model
      // Format can be "server:model" or just "server" or undefined (auto)
      let preferredProvider: string | null = null
      let preferredModel: string | null = null

      if (preferredModelString) {
        if (preferredModelString.includes(":")) {
          const [server, model] = preferredModelString.split(":")
          preferredProvider = server
          preferredModel = model
        } else {
          preferredProvider = preferredModelString
        }
      }

      // Get cloud provider API keys from user settings
      const globalSettings = getGlobalSettings()
      const enabledCloudProviders = globalSettings.cloudProviders
        .filter(p => p.enabled && p.apiKey)
        .map(p => ({ provider: p.provider, apiKey: p.apiKey }))

      const response = await fetch("/api/build-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: `temp-${Date.now()}`,
          projectName: name,
          projectDescription: enhancedDescription,
          preferredProvider,
          preferredModel,
          allowPaidFallback: settings.allowPaidLLM,
          cloudProviders: enabledCloudProviders,
          constraints: {
            requireLocalFirst: !preferredProvider, // Auto mode uses local first
            requireHumanApproval: ["planning", "deployment"]
          }
        })
      })

      const data = await response.json()

      if (data.error) {
        setBuildPlanError(data.error)
        setMode("setup") // Fall back to setup mode
      } else if (data.plan) {
        setGeneratedBuildPlan(data.plan)
        setBuildPlanPacketSummary(data.packetSummary)
        setBuildPlanSource({
          server: data.server,
          model: data.model
        })
        setMode("build_review")
      }
    } catch (err) {
      setBuildPlanError(err instanceof Error ? err.message : "Failed to generate build plan")
      setMode("setup") // Fall back to setup mode
    } finally {
      setIsGeneratingBuildPlan(false)
    }
  }

  // Handle regenerating build plan with different model
  const handleRegenerateBuildPlan = async (model?: string) => {
    await generateBuildPlanForProject(projectName, projectDescription, monetizationIntent, model)
  }

  // Handle approving build plan and starting project
  const handleApproveBuildPlanAndStart = async (approvedPlan: BuildPlan, packets: WorkPacket[]) => {
    if (!user?.id) {
      setSubmitError("You must be logged in to create a project")
      return
    }

    setIsSubmitting(true)
    setSubmitError("")

    try {
      // Create the project
      const tags = approvedPlan.spec.techStack || []
      const initialRepos = localRepoPath.trim() ? [{
        provider: "local" as const,
        id: Date.now(),
        name: projectName,
        path: localRepoPath.trim(),
        url: "",
        localPath: localRepoPath.trim()
      }] : []

      // Determine basePath: use explicitly set folder, or fall back to local repo path
      const basePath = projectFolderPath.trim() || localRepoPath.trim() || undefined

      // Pass userId to ensure project is saved to user-scoped storage
      const project = createProject({
        name: projectName,
        description: projectDescription,
        status: "planning", // Stay in planning until user starts the build
        priority,
        repos: initialRepos,
        packetIds: packets.map(p => p.id),
        tags,
        basePath,
        creationInterview: interviewSession || undefined
      }, user.id)

      // Update plan with correct project ID and save
      const finalPlan: BuildPlan = {
        ...approvedPlan,
        projectId: project.id
      }
      saveBuildPlan(project.id, finalPlan)

      // Save packets with correct project association
      const finalPackets = packets.map(p => ({ ...p }))
      await await savePackets(project.id, finalPackets)

      // Create GitLab repo if enabled
      if (createRepo && hasToken) {
        try {
          const repo = await createGitLabRepo({
            name: repoName,
            description: projectDescription,
            visibility: repoVisibility,
            initializeWithReadme: initWithReadme
          })

          linkRepoToProject(project.id, {
            provider: "gitlab",
            id: repo.id,
            name: repo.name,
            path: repo.path,
            url: repo.web_url
          }, user.id)
        } catch (repoError) {
          console.error("Failed to create repo:", repoError)
          setSubmitError(`Project created, but repo creation failed: ${repoError instanceof Error ? repoError.message : "Unknown error"}`)
        }
      }

      // Link voice recording if project was created from voice
      if (sourceVoiceRecording) {
        markProjectCreated(sourceVoiceRecording.id, project.id)
        // Add "created-from-voice" tag
        updateProject(project.id, {
          tags: [...(project.tags || []), "created-from-voice"]
        }, user.id)
      }

      setCreatedProject(project)
      setMode("complete")
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to create project")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInterviewCancel = () => {
    setMode("choose")
  }

  // Handle ideation interview completion - creates an Ideas project with markdown deliverables
  const handleIdeationComplete = async (session: InterviewSession) => {
    if (!user?.id) {
      setSubmitError("You must be logged in to create a project")
      return
    }

    setIsSubmitting(true)
    setSubmitError("")

    try {
      const extractedData = session.extractedData || {}
      const name = (extractedData.name as string) || `Ideas: ${session.summary?.slice(0, 50) || "Brainstorming Session"}`
      const description = session.summary || "Ideation and brainstorming session"

      // Create an Ideas project (no code packets, just markdown deliverables)
      const project = createProject({
        name,
        description,
        status: "planning", // Stay in planning until user starts work
        priority: "medium",
        repos: [],
        packetIds: [],
        tags: ["ideas", "brainstorming"],
        category: "ideas", // This is an ideas project, not code
        creationInterview: session
      }, user.id)

      // Generate ideas markdown from the session
      const ideasMarkdown = generateIdeasMarkdown(session)

      // Save the ideas markdown to the project docs
      try {
        await fetch(`/api/projects/${project.id}/docs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "ideas.md",
            content: ideasMarkdown
          })
        })
      } catch (err) {
        console.warn("Failed to save ideas markdown:", err)
        // Non-fatal - project still created
      }

      setCreatedProject(project)
      setMode("complete")
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to create ideas project")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Generate markdown document from ideation session
  function generateIdeasMarkdown(session: InterviewSession): string {
    const extractedData = session.extractedData || {}
    const lines: string[] = []

    lines.push(`# ${extractedData.name || "Ideas & Brainstorming"}`)
    lines.push("")
    lines.push(`*Generated: ${new Date().toLocaleDateString()}*`)
    lines.push("")

    // Problem/Opportunity Statement
    lines.push("## Problem / Opportunity")
    lines.push(session.summary || extractedData.description as string || "No summary available")
    lines.push("")

    // Ideas list
    const ideas = extractedData.ideas as string[] || extractedData.features as string[] || []
    if (ideas.length > 0) {
      lines.push("## Ideas")
      lines.push("")
      ideas.forEach((idea, i) => {
        lines.push(`### ${i + 1}. ${idea}`)
        lines.push("")
      })
    }

    // Goals
    const goals = extractedData.goals as string[] || []
    if (goals.length > 0) {
      lines.push("## Goals")
      goals.forEach(goal => {
        lines.push(`- ${goal}`)
      })
      lines.push("")
    }

    // Constraints
    const constraints = extractedData.constraints as string[] || []
    if (constraints.length > 0) {
      lines.push("## Constraints & Considerations")
      constraints.forEach(constraint => {
        lines.push(`- ${constraint}`)
      })
      lines.push("")
    }

    // Research topics
    const researchTopics = extractedData.researchTopics as string[] || []
    if (researchTopics.length > 0) {
      lines.push("## Research Topics")
      researchTopics.forEach(topic => {
        lines.push(`- [ ] ${topic}`)
      })
      lines.push("")
    }

    // Next steps
    lines.push("## Next Steps")
    lines.push("")
    lines.push("- [ ] Review and prioritize ideas")
    lines.push("- [ ] Conduct research on top ideas")
    lines.push("- [ ] Create coding project from selected idea (if applicable)")
    lines.push("")

    // Full conversation for reference
    lines.push("---")
    lines.push("")
    lines.push("## Interview Transcript")
    lines.push("")
    session.messages.forEach(msg => {
      const prefix = msg.role === "assistant" ? "**Claudia:**" : "**You:**"
      lines.push(`${prefix} ${msg.content}`)
      lines.push("")
    })

    return lines.join("\n")
  }

  const handleTokenSave = async () => {
    if (!tokenInput.trim()) {
      setTokenError("Please enter a token")
      return
    }

    setTokenValidating(true)
    setTokenError("")

    const isValid = await validateGitLabToken(tokenInput.trim())

    if (isValid) {
      setGitLabToken(tokenInput.trim())
      setHasToken(true)
      setShowTokenInput(false)
      setTokenInput("")
    } else {
      setTokenError("Invalid token. Please check and try again.")
    }

    setTokenValidating(false)
  }

  const handleSubmit = async () => {
    if (!user?.id) {
      setSubmitError("You must be logged in to create a project")
      return
    }

    setIsSubmitting(true)
    setSubmitError("")

    try {
      // Determine tags based on source
      let tags = generatedPlan?.techStack || (interviewSession?.extractedData?.techStack as string[]) || []
      if (linearImportData) {
        tags = ["imported-from-linear"]
      }

      // Set up initial repos array with local path if provided
      const initialRepos = localRepoPath.trim() ? [{
        provider: "local" as const,
        id: Date.now(),
        name: projectName,
        path: localRepoPath.trim(),
        url: "",
        localPath: localRepoPath.trim()
      }] : []

      // Determine basePath: use explicitly set folder, or fall back to local repo path
      const basePath = projectFolderPath.trim() || localRepoPath.trim() || undefined

      // Pass userId to ensure project is saved to user-scoped storage
      const project = createProject({
        name: projectName,
        description: projectDescription,
        status: "planning", // Stay in planning until user starts the build
        priority,
        repos: initialRepos,
        packetIds: [],
        tags,
        basePath,
        creationInterview: interviewSession || undefined
      }, user.id)

      // Handle Linear import data
      if (linearImportData && linearImportData.projects.length > 0) {
        // Configure Linear sync (use first project for primary sync config)
        configureLinearSync(project.id, {
          mode: "imported",
          projectId: linearImportData.projects[0].linearProjectId,
          teamId: linearImportData.projects[0].teamIds[0],
          syncIssues: false,
          syncComments: false,
          syncStatus: false,
          importedAt: new Date().toISOString(),
          importedIssueCount: linearImportData.summary.totalIssues
        })

        // Save the build plan with phases
        saveBuildPlan(project.id, {
          id: `plan-${Date.now()}`,
          projectId: project.id,
          version: 1,
          status: "approved",
          spec: {
            name: projectName,
            description: projectDescription,
            objectives: [],
            nonGoals: [],
            assumptions: [],
            risks: [],
            techStack: []
          },
          phases: linearImportData.phases.map(p => ({
            ...p,
            packetIds: linearImportData.packets
              .filter(pkt => pkt.status !== "completed")
              .map(pkt => pkt.id),
            dependencies: [],
            estimatedEffort: { optimistic: 8, realistic: 16, pessimistic: 32, confidence: "medium" as const },
            successCriteria: ["All packets completed"]
          })),
          packets: linearImportData.packets.map(pkt => ({
            ...pkt,
            blockedBy: pkt.dependencies || [],
            blocks: []
          })),
          modelAssignments: [],
          constraints: {
            requireLocalFirst: true,
            requireHumanApproval: ["planning", "deployment"],
            maxParallelPackets: 2
          },
          generatedBy: "linear-import",
          createdAt: new Date().toISOString()
        })

        // Save all the packets
        const packetsToSave = linearImportData.packets.map(pkt => ({
          ...pkt,
          blockedBy: pkt.dependencies || [],
          blocks: []
        }))
        await await savePackets(project.id, packetsToSave)

        // Update project with packet IDs
        updateProject(project.id, {
          packetIds: packetsToSave.map(p => p.id)
        }, user.id)
      }

      // Link existing repos if any were selected from the dialog
      if (selectedRepoIds.size > 0 && availableRepos.length > 0) {
        for (const repoId of selectedRepoIds) {
          const repoToLink = availableRepos.find(r => r.id === repoId)
          if (repoToLink) {
            linkRepoToProject(project.id, {
              provider: "gitlab",
              id: repoToLink.id,
              name: repoToLink.name,
              path: repoToLink.path,
              url: repoToLink.url
            }, user.id)
          }
        }
      } else if (createRepo && hasToken) {
        // Create a new repo if that option was selected
        try {
          const repo = await createGitLabRepo({
            name: repoName,
            description: projectDescription,
            visibility: repoVisibility,
            initializeWithReadme: initWithReadme
          })

          linkRepoToProject(project.id, {
            provider: "gitlab",
            id: repo.id,
            name: repo.name,
            path: repo.path,
            url: repo.web_url
          }, user.id)
        } catch (repoError) {
          console.error("Failed to create repo:", repoError)
          setSubmitError(`Project created, but repo creation failed: ${repoError instanceof Error ? repoError.message : "Unknown error"}`)
        }
      }

      // Link voice recording if project was created from voice
      if (sourceVoiceRecording) {
        markProjectCreated(sourceVoiceRecording.id, project.id)
        // Add "created-from-voice" tag
        updateProject(project.id, {
          tags: [...(project.tags || []), "created-from-voice"]
        }, user.id)
      }

      setCreatedProject(project)
      setMode("complete")
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to create project")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Mode: Choose - initial screen with description input
  if (mode === "choose") {
    // If beta tester has reached project limit, show limit reached screen
    if (isBetaTester && !canCreateProject) {
      return (
        <div className="p-6 max-w-2xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-3xl font-bold">New Project</h1>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                Beta
              </Badge>
            </div>
          </div>

          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center">
                <ShieldAlert className="h-8 w-8 text-amber-500" />
              </div>
              <CardTitle className="text-xl">Project Limit Reached</CardTitle>
              <CardDescription className="text-base">
                You have reached your beta tester limit of {betaLimits?.limits.projects || 3} projects.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center text-sm text-muted-foreground">
                <p>Current usage: {betaLimits?.current.projects || 0} / {betaLimits?.limits.projects || 3} projects</p>
              </div>

              <div className="p-4 rounded-lg bg-muted/50 border border-dashed">
                <p className="text-sm text-muted-foreground text-center">
                  To create more projects, you can delete existing projects or upgrade to a full account when available.
                </p>
              </div>

              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => router.push("/projects")}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Projects
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return (
      <div className="p-6 max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-3xl font-bold">New Project</h1>
            <LLMStatusBadge />
            {isBetaTester && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                Beta
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            Describe what you want to build, then choose your path
          </p>
          <p className="text-sm text-muted-foreground/80 max-w-lg mx-auto mt-3">
            Claudia generates complete, production-ready code — not just scaffolding.
            From your description to working software with tests, documentation, and quality gates.
          </p>
        </div>

        {/* Beta usage banner */}
        {isBetaTester && betaLimits && (
          <BetaUsageBanner
            type="projects"
            current={betaLimits.current.projects}
            limit={betaLimits.limits.projects}
          />
        )}

        {/* Voice Recording Source Banner */}
        {sourceVoiceRecording && (
          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Mic className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Creating from voice recording</p>
                  <p className="text-xs text-muted-foreground">{sourceVoiceRecording.title}</p>
                </div>
                <Badge variant="outline" className="text-blue-500 border-blue-500/30">
                  From Voice
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* Toggle between text and voice input */}
            <div className="flex justify-center gap-2 pb-2">
              <Button
                variant={!isVoiceMode ? "default" : "outline"}
                size="sm"
                onClick={() => setIsVoiceMode(false)}
              >
                Type
              </Button>
              <Button
                variant={isVoiceMode ? "default" : "outline"}
                size="sm"
                onClick={() => setIsVoiceMode(true)}
              >
                Speak
              </Button>
            </div>

            {!isVoiceMode ? (
              /* Text Input Mode */
              <Textarea
                placeholder="Describe your project in a sentence or two... e.g., 'A mobile app for tracking daily habits with social accountability features'"
                value={quickDescription}
                onChange={(e) => setQuickDescription(e.target.value)}
                rows={4}
                className="text-lg"
              />
            ) : (
              /* Voice Input Mode */
              <div className="py-4">
                <VoiceInput
                  onTranscript={(text) => {
                    setQuickDescription(prev => (prev ? prev + " " + text : text).trim())
                  }}
                  onListeningChange={(listening) => {
                    // Could show additional UI feedback
                  }}
                  size="lg"
                  pauseTimeout={2500}
                />
                {quickDescription && (
                  <div className="mt-4">
                    <Label className="text-sm text-muted-foreground mb-1">Captured (editable):</Label>
                    <Textarea
                      value={quickDescription}
                      onChange={(e) => setQuickDescription(e.target.value)}
                      rows={4}
                      className="text-sm mt-1"
                      placeholder="Edit your description here..."
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                className="flex-1"
                onClick={handleFeelingLucky}
                disabled={!quickDescription.trim() || isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Zap className="mr-2 h-5 w-5" />
                )}
                Quick Start
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  // Detect if this is an ideation/exploration request
                  if (quickDescription.trim() && detectIdeationIntent(quickDescription.trim())) {
                    setMode("ideation")
                  } else {
                    setMode("interview")
                  }
                }}
              >
                <MessageSquare className="mr-2 h-5 w-5" />
                Full Interview
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              <strong>Quick Start</strong> auto-detects if you need code or ideas • <strong>Full Interview</strong> asks detailed questions
            </p>

            {/* Auto-generate Build Plan Toggle */}
            <div className="pt-4 mt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Rocket className="h-4 w-4 text-green-500" />
                  <div>
                    <Label htmlFor="auto-build-plan" className="text-sm font-medium">
                      Auto-generate Build Plan
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically create a build plan with work packets after interview
                    </p>
                  </div>
                </div>
                <Switch
                  id="auto-build-plan"
                  checked={autoGenerateBuildPlan}
                  onCheckedChange={setAutoGenerateBuildPlan}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Import from Linear */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-[#5E6AD2]/10 flex items-center justify-center">
                <Download className="h-5 w-5 text-[#5E6AD2]" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Import from Linear</p>
                <p className="text-sm text-muted-foreground">
                  Import an existing project with all its issues
                </p>
              </div>
              <Button onClick={() => setMode("linear")}>
                Import
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button variant="ghost" onClick={() => router.push("/projects")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Button>
        </div>
      </div>
    )
  }

  // Cloning repositories loading state (for Linear import flow)
  if (isCloningRepos) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="h-16 w-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Cloning Repositories...</h2>
            <p className="text-muted-foreground mb-4">
              {cloningProgress.total > 1
                ? `Cloning ${cloningProgress.current} of ${cloningProgress.total} repositories`
                : `Cloning repository`}
            </p>
            {cloningProgress.repoName && (
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-center gap-2">
                  <GitBranch className="h-4 w-4 text-muted-foreground" />
                  <code className="text-sm font-mono">{cloningProgress.repoName}</code>
                </div>
              </div>
            )}
            {cloningProgress.total > 1 && (
              <div className="mt-4">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${(cloningProgress.current / cloningProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-4">
              <Download className="h-4 w-4" />
              <span>This may take a minute for large repositories</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Mode: Linear - import from Linear
  if (mode === "linear") {
    const filteredProjects = linearSearch
      ? linearProjects.filter(p =>
          p.name.toLowerCase().includes(linearSearch.toLowerCase()) ||
          p.description?.toLowerCase().includes(linearSearch.toLowerCase())
        )
      : linearProjects

    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => {
            setMode("choose")
            setSelectedLinearProjectId(null)
            setLinearImportData(null)
          }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Import from Linear</h1>
            <p className="text-sm text-muted-foreground">
              Select a project to import with all its issues
            </p>
          </div>
        </div>

        {linearError && (
          <div className="p-4 rounded-lg bg-red-500/10 text-red-600 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 flex-none mt-0.5" />
            <p className="text-sm">{linearError}</p>
          </div>
        )}

        {!linearImportData ? (
          /* Project Selection with Checkboxes */
          <Card>
            <CardHeader className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects..."
                  value={linearSearch}
                  onChange={(e) => setLinearSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {selectedLinearProjectId && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    1 project selected
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedLinearProjectId(null)}
                  >
                    Clear
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {linearLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {linearSearch ? "No projects match your search" : "No projects found in Linear"}
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {filteredProjects.map((project) => {
                      const isSelected = selectedLinearProjectId === project.id
                      return (
                        <div
                          key={project.id}
                          className={cn(
                            "p-4 rounded-lg border cursor-pointer transition-colors",
                            isSelected ? "border-primary bg-primary/5" : "hover:border-primary/50"
                          )}
                          onClick={() => selectLinearProject(project.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                              isSelected ? "border-primary" : "border-muted-foreground/30"
                            )}>
                              {isSelected && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{project.name}</p>
                              {project.description && (
                                <p className="text-sm text-muted-foreground line-clamp-1">
                                  {project.description}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="text-xs">
                                  {project.state}
                                </Badge>
                                {project.teams.nodes.map(team => (
                                  <Badge key={team.id} variant="secondary" className="text-xs">
                                    {team.key}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <div className="text-2xl font-bold text-primary">
                                {Math.round(project.progress * 100)}%
                              </div>
                              <p className="text-xs text-muted-foreground">progress</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
            <div className="px-6 pb-6 space-y-4">
              {/* Project Category Selector - determines if game/creative detection runs */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Project Type</Label>
                <Select value={importCategory} onValueChange={setImportCategory}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select project type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-detect from content</SelectItem>
                    <SelectItem value="game">Game (enables game dev kickoff)</SelectItem>
                    <SelectItem value="vr">VR/AR Experience</SelectItem>
                    <SelectItem value="creative">Creative Project</SelectItem>
                    <SelectItem value="interactive">Interactive Experience</SelectItem>
                    <SelectItem value="web">Web Application</SelectItem>
                    <SelectItem value="mobile">Mobile App</SelectItem>
                    <SelectItem value="desktop">Desktop Application</SelectItem>
                    <SelectItem value="api">API/Backend Service</SelectItem>
                    <SelectItem value="tool">Developer Tool</SelectItem>
                    <SelectItem value="standard">Standard Software</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {importCategory === "auto"
                    ? "Will analyze content to detect if this is a game/creative project"
                    : importCategory === "game" || importCategory === "vr" || importCategory === "creative" || importCategory === "interactive"
                      ? "Will generate game dev kickoff with vision and implementation packets"
                      : "Standard project workflow without game-specific features"}
                </p>
              </div>

              <Button
                className="w-full"
                onClick={handleLinearImport}
                disabled={!selectedLinearProjectId || isImporting}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Import Project
                  </>
                )}
              </Button>
            </div>
          </Card>
        ) : (
          /* Import Preview */
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                {linearImportData.projects.length === 1
                  ? linearImportData.projects[0].name
                  : `${linearImportData.projects.length} Projects`}
              </CardTitle>
              <CardDescription>
                {linearImportData.projects.length === 1
                  ? linearImportData.projects[0].description || "No description"
                  : linearImportData.projects.map(p => p.name).join(", ")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <div className="text-3xl font-bold">{linearImportData.summary.totalIssues}</div>
                  <p className="text-xs text-muted-foreground">Total Issues</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <div className="text-3xl font-bold text-red-500">
                    {linearImportData.summary.byPriority.critical || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Critical</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <div className="text-3xl font-bold text-orange-500">
                    {linearImportData.summary.byPriority.high || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">High Priority</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <div className="text-3xl font-bold text-green-500">
                    {linearImportData.summary.byStatus.completed || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase">By Type</Label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(linearImportData.summary.byType).map(([type, count]) => (
                    count > 0 && (
                      <Badge key={type} variant="secondary">
                        {type}: {count}
                      </Badge>
                    )
                  ))}
                </div>
              </div>

              {/* Imported Packets List with Short Titles */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase flex items-center gap-2">
                  <Package className="h-3 w-3" />
                  Work Packets ({linearImportData.packets.length})
                </Label>
                <ScrollArea className="h-[300px] border rounded-lg">
                  <div className="p-2 space-y-1">
                    {linearImportData.packets.map((packet) => (
                      <div
                        key={packet.id}
                        className="p-3 rounded-md border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            {/* Short Title - Prominently Displayed */}
                            <p className="font-medium text-sm truncate" title={packet.title}>
                              {packet.title}
                            </p>
                            {/* Metadata badges */}
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs capitalize",
                                  packet.priority === "critical" && "border-red-500 text-red-500",
                                  packet.priority === "high" && "border-orange-500 text-orange-500",
                                  packet.priority === "medium" && "border-yellow-500 text-yellow-500",
                                  packet.priority === "low" && "border-gray-400 text-gray-400"
                                )}
                              >
                                {packet.priority}
                              </Badge>
                              <Badge variant="secondary" className="text-xs capitalize">
                                {packet.type}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {packet.metadata.linearIdentifier}
                              </span>
                            </div>
                          </div>
                          {/* Status indicator */}
                          <div className={cn(
                            "px-2 py-0.5 rounded text-xs font-medium",
                            packet.status === "completed" && "bg-green-500/10 text-green-600",
                            packet.status === "in_progress" && "bg-blue-500/10 text-blue-600",
                            packet.status === "queued" && "bg-gray-500/10 text-gray-600"
                          )}>
                            {packet.status === "in_progress" ? "In Progress" : packet.status}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setLinearImportData(null)
                  }}
                >
                  Choose Different
                </Button>
                <Button className="flex-1" onClick={handleLinearConfirm} disabled={loadingRepos}>
                  {loadingRepos ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Checking repos...
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Repo Linking Dialog */}
        <Dialog open={showRepoLinkDialog} onOpenChange={setShowRepoLinkDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-primary" />
                Link Repositories
              </DialogTitle>
              <DialogDescription>
                Select repositories to clone and link to this project. They will be cloned to your project folder.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {/* Selection controls */}
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedRepoIds(new Set(availableRepos.map(r => r.id)))}
                    disabled={selectedRepoIds.size === availableRepos.length}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedRepoIds(new Set())}
                    disabled={selectedRepoIds.size === 0}
                  >
                    Deselect All
                  </Button>
                </div>
                {selectedRepoIds.size > 0 && (
                  <Badge variant="secondary">
                    {selectedRepoIds.size} selected
                  </Badge>
                )}
              </div>

              {/* Repo List with Checkboxes */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Available Repositories</Label>
                <ScrollArea className="h-[250px] border rounded-lg">
                  <div className="p-2 space-y-1">
                    {availableRepos.map((repo) => {
                      const isSelected = selectedRepoIds.has(repo.id)
                      return (
                        <div
                          key={repo.id}
                          className={cn(
                            "p-3 rounded-md border cursor-pointer transition-colors",
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "hover:border-primary/50"
                          )}
                          onClick={() => {
                            setSelectedRepoIds(prev => {
                              const next = new Set(prev)
                              if (next.has(repo.id)) {
                                next.delete(repo.id)
                              } else {
                                next.add(repo.id)
                              }
                              return next
                            })
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0",
                              isSelected
                                ? "bg-primary border-primary"
                                : "border-muted-foreground/30"
                            )}>
                              {isSelected && (
                                <Check className="h-3 w-3 text-primary-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{repo.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{repo.path}</p>
                            </div>
                            <a
                              href={repo.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </div>

              {/* Clone info */}
              {selectedRepoIds.size > 0 && (
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-start gap-2">
                    <Download className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-blue-600">
                        {selectedRepoIds.size === 1 ? "Repository" : `${selectedRepoIds.size} repositories`} will be cloned
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Repos will be cloned to: <code className="bg-muted px-1 rounded">{projectFolderPath.trim() || localRepoPath.trim() || `~/claudia-projects/${toRepoName(projectName)}`}/repos/</code>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleRepoLinkChoice("skip")}
              >
                Skip for Now
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setSelectedRepoIds(new Set())
                  setCreateRepo(true)
                  handleRepoLinkChoice("create")
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create New Repo
              </Button>
              <Button
                className="flex-1"
                onClick={() => handleRepoLinkChoice("link")}
                disabled={selectedRepoIds.size === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                Clone & Link ({selectedRepoIds.size})
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // Mode: Clarification - help user provide more info before building
  if (mode === "ideation_review" && ideationReport) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setMode("choose")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Lightbulb className="h-6 w-6 text-yellow-500" />
              Let's Clarify Before Building
            </h1>
            <p className="text-sm text-muted-foreground">
              We need a bit more detail to build great software. Choose how you'd like to fill in the blanks.
            </p>
          </div>
        </div>

        {/* What we understood and what's missing */}
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              What we understood
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">{ideationReport.summary}</p>
            {ideationReport.keyPoints.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {ideationReport.keyPoints.slice(0, 4).map((point, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {point.length > 40 ? point.slice(0, 40) + "..." : point}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* What's missing */}
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              What we need to build effective software
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ideationReport.questions && ideationReport.questions.length > 0 ? (
              <ul className="space-y-2">
                {ideationReport.questions.map((question, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className="text-orange-500 font-medium">{i + 1}.</span>
                    {question}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Use the <strong>Explore & Narrow Down</strong> option below to help us understand exactly what you want to build. We'll ask targeted questions based on your selections.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Clarification Options */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Choose a way to add more detail</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {/* Option 1: Explore Ideas (Fractal) */}
            <button
              onClick={() => setMode("ideation")}
              className="flex items-start gap-4 p-4 rounded-lg border hover:border-primary hover:bg-muted/50 transition-colors text-left"
            >
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <h4 className="font-medium">Explore & Narrow Down</h4>
                <p className="text-sm text-muted-foreground">
                  Click on related concepts to help us understand what you want to build
                </p>
              </div>
            </button>

            {/* Option 2: Brain Dump */}
            <button
              onClick={() => {
                setIdeationFeedback(quickDescription + "\n\n")
                setMode("choose")
                // Focus on the description input
                setTimeout(() => {
                  const textarea = document.querySelector("textarea")
                  if (textarea) {
                    textarea.focus()
                    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
                  }
                }, 100)
              }}
              className="flex items-start gap-4 p-4 rounded-lg border hover:border-primary hover:bg-muted/50 transition-colors text-left"
            >
              <div className="p-2 rounded-lg bg-blue-500/10">
                <FileText className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h4 className="font-medium">Brain Dump</h4>
                <p className="text-sm text-muted-foreground">
                  Write freely about what you want — features, goals, context, anything
                </p>
              </div>
            </button>

            {/* Option 3: Guided Interview */}
            <button
              onClick={() => {
                // Store the current description and switch to interview mode
                setQuickDescription(quickDescription + (ideationFeedback ? "\n" + ideationFeedback : ""))
                setMode("interview")
              }}
              className="flex items-start gap-4 p-4 rounded-lg border hover:border-primary hover:bg-muted/50 transition-colors text-left"
            >
              <div className="p-2 rounded-lg bg-green-500/10">
                <MessageSquare className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <h4 className="font-medium">Answer Questions</h4>
                <p className="text-sm text-muted-foreground">
                  We'll ask a few targeted questions to clarify your requirements
                </p>
              </div>
            </button>

            {/* Option 4: Quick Clarification */}
            <div className="p-4 rounded-lg border space-y-3">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Pencil className="h-5 w-5 text-purple-500" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium">Quick Clarification</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Add a sentence or two to clarify what you want
                  </p>
                  <Textarea
                    value={ideationFeedback}
                    onChange={(e) => setIdeationFeedback(e.target.value)}
                    placeholder="e.g., 'I want a web app for tracking expenses with receipt photo uploads'"
                    rows={2}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => {
            setIdeationReport(null)
            setIdeationFeedback("")
            setMode("choose")
          }}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Start Over
          </Button>
          <Button
            className="flex-1"
            disabled={!ideationFeedback.trim()}
            onClick={async () => {
              // Combine original with clarification and try again
              const enrichedDescription = quickDescription + "\n\nAdditional context: " + ideationFeedback.trim()
              setQuickDescription(enrichedDescription)
              setIdeationReport(null)
              setIdeationFeedback("")
              // Go directly to plan generation, bypassing ideation detection
              setIsGenerating(true)
              try {
                const response = await fetch("/api/llm/plan", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    description: enrichedDescription,
                    allowPaidFallback: settings.allowPaidLLM
                  })
                })
                if (response.ok) {
                  const plan = await response.json()
                  setGeneratedPlan(plan)
                  setMode("quick")
                } else {
                  throw new Error("Failed to generate plan")
                }
              } catch {
                // Fallback
                const words = enrichedDescription.split(/\s+/)
                const name = words.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ")
                setGeneratedPlan({
                  name: name || "New Project",
                  description: enrichedDescription,
                  features: ["Core functionality as described"],
                  techStack: [],
                  priority: "medium"
                })
                setMode("quick")
              } finally {
                setIsGenerating(false)
              }
            }}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating plan...
              </>
            ) : (
              <>
                <Rocket className="mr-2 h-4 w-4" />
                Continue with Clarification
              </>
            )}
          </Button>
        </div>
      </div>
    )
  }

  // Mode: Quick - show generated plan for approval
  if (mode === "quick" && generatedPlan) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setMode("choose")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Review Your Plan</h1>
            <p className="text-sm text-muted-foreground">
              Generated from: "{quickDescription.slice(0, 50)}..."
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {generatedPlan.name}
            </CardTitle>
            <CardDescription>{generatedPlan.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {generatedPlan.features.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground uppercase">Suggested Features</Label>
                <ul className="mt-1 space-y-1">
                  {generatedPlan.features.map((feature, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {generatedPlan.techStack.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground uppercase">Tech Stack</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {generatedPlan.techStack.map((tech, i) => (
                    <Badge key={i} variant="secondary">{tech}</Badge>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs text-muted-foreground uppercase">Priority</Label>
              <Badge
                className={cn(
                  "mt-1 capitalize",
                  generatedPlan.priority === "critical" && "bg-red-500",
                  generatedPlan.priority === "high" && "bg-orange-500"
                )}
              >
                {generatedPlan.priority}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={handleRejectPlan} disabled={isSubmitting}>
            <ThumbsDown className="mr-2 h-4 w-4" />
            Start Over
          </Button>
          <Button variant="outline" onClick={handleRegeneratePlan} disabled={isGenerating || isSubmitting}>
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          <Button className="flex-1" onClick={handleApprovePlan} disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ThumbsUp className="mr-2 h-4 w-4" />
            )}
            {isSubmitting ? "Creating Project..." : "Looks Good"}
          </Button>
        </div>
      </div>
    )
  }

  // Mode: Interview
  if (mode === "interview") {
    // Show generating overlay if building plan
    if (isGeneratingBuildPlan) {
      return (
        <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] p-6">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Generating Build Plan</h2>
              <p className="text-muted-foreground mb-4">
                Creating a comprehensive development plan based on your interview...
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="h-4 w-4" />
                <span>This may take 30-60 seconds</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return (
      <div className="h-[calc(100vh-4rem)]">
        <InterviewPanel
          type="project_creation"
          initialDescription={quickDescription.trim() || undefined}
          onComplete={handleInterviewComplete}
          onCancel={handleInterviewCancel}
        />
      </div>
    )
  }

  // Mode: Ideation - Explore and narrow ideas to clarify requirements
  if (mode === "ideation") {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setMode("ideation_review")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Lightbulb className="h-6 w-6 text-yellow-500" />
              Explore & Clarify
            </h1>
            <p className="text-sm text-muted-foreground">
              Select concepts that match what you want to build
            </p>
          </div>
        </div>

        <IdeasExplorer
          projectId="clarification"
          projectName="Clarification"
          projectDescription={quickDescription}
          initialContext={quickDescription}
          onCreateProject={async (rec) => {
            // Build comprehensive context from all fractal ideation data
            const selectionsWithExplanations = rec.howSelectionsIncorporated
              ? Object.entries(rec.howSelectionsIncorporated)
                  .map(([selection, explanation]) => `- ${selection}: ${explanation}`)
                  .join("\n")
              : rec.selectionPath?.map(s => `- ${s}`).join("\n") || ""

            // Clean project description (stored in project) - NO LLM instructions
            const cleanDescription = `${rec.description}

## Selected Features & Requirements
${selectionsWithExplanations}

## Key Features
${rec.keyFeatures.map(f => `- ${f}`).join("\n")}
${rec.whyThisWorks ? `\n## Approach\n${rec.whyThisWorks}` : ""}`

            // LLM prompt with full context (only for build plan generation)
            const llmBuildPlanPrompt = `# Project: ${rec.title}

## Project Description
${rec.description}

## Complexity Level
${rec.complexity || "moderate"}

## User's Selected Features & Requirements
The user selected the following features/concepts during fractal ideation exploration. Each MUST be implemented as work packets:

${selectionsWithExplanations}

## Key Features to Implement
${rec.keyFeatures.map(f => `- ${f}`).join("\n")}

## Selection Path (User's Exploration Journey)
${rec.selectionPath?.join(" → ") || "Direct selection"}

---
CRITICAL INSTRUCTIONS FOR BUILD PLAN GENERATION:

1. PACKET QUANTITY: Create MANY work packets, NOT FEW. Each user selection above should generate 2-4 packets minimum:
   - One packet for core implementation
   - One packet for UI/interface
   - One packet for testing/validation
   - Additional packets for complex features

2. PACKET GRANULARITY: Each packet should be SMALL and FOCUSED:
   - A single file or small group of related files
   - 1-2 hours of work maximum
   - Clear, specific acceptance criteria
   - 3-5 concrete tasks per packet

3. FEATURE DECOMPOSITION: Break down each feature into implementation components:
   - Data models/types
   - API endpoints/services
   - UI components
   - State management
   - Tests

4. EXPECTED OUTPUT: For ${rec.keyFeatures.length} key features and ${(rec.selectionPath?.length || 0)} user selections, generate at least ${Math.max(25, (rec.selectionPath?.length || 0) * 2)} work packets. More packets = better code quality because each packet is focused.

5. PACKET TYPES: Include a mix of:
   - "feature" packets for new functionality
   - "setup" packets for infrastructure/project scaffolding
   - "testing" packets for quality assurance
   - "documentation" packets for README, API docs
   - "chore" packets for configuration, deployment`

            // Store clean description (without LLM instructions)
            setQuickDescription(cleanDescription)
            setProjectDescription(cleanDescription)
            setProjectName(rec.title)
            setRepoName(toRepoName(rec.title))
            setIdeationReport(null)

            // Auto-generate FULL build plan with LLM-specific context
            setIsGeneratingBuildPlan(true)
            try {
              // Get cloud provider API keys from user settings
              const globalSettings = getGlobalSettings()
              const enabledCloudProviders = globalSettings.cloudProviders
                .filter(p => p.enabled && p.apiKey)
                .map(p => ({ provider: p.provider, apiKey: p.apiKey }))

              const response = await fetch("/api/build-plan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  projectId: `ideation-${Date.now()}`,
                  projectName: rec.title,
                  projectDescription: llmBuildPlanPrompt, // Use LLM prompt, not clean description
                  allowPaidFallback: settings.allowPaidLLM,
                  cloudProviders: enabledCloudProviders,
                  constraints: {
                    requireLocalFirst: true,
                    requireHumanApproval: ["planning", "deployment"]
                  }
                })
              })

              const data = await response.json()

              if (data.plan) {
                setGeneratedBuildPlan(data.plan)
                setBuildPlanPacketSummary(data.packetSummary)
                setBuildPlanSource({
                  server: data.server,
                  model: data.model
                })
                setMode("build_review")
              } else if (data.error) {
                console.error("Build plan generation failed:", data.error)
                // Fall back to basic plan generation
                const basicResponse = await fetch("/api/llm/plan", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    description: llmBuildPlanPrompt,
                    allowPaidFallback: settings.allowPaidLLM
                  })
                })
                if (basicResponse.ok) {
                  const plan = await basicResponse.json()
                  setGeneratedPlan(plan)
                  setMode("quick")
                } else {
                  setMode("choose")
                }
              }
            } catch {
              setMode("choose")
            } finally {
              setIsGeneratingBuildPlan(false)
              setIsGenerating(false)
            }
          }}
        />
      </div>
    )
  }

  // Mode: UI Framework Selection
  if (mode === "ui_selection" && detectedUIType) {
    // Show generating overlay if building plan
    if (isGeneratingBuildPlan) {
      return (
        <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] p-6">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Generating Build Plan</h2>
              <p className="text-muted-foreground mb-4">
                Creating a UI-focused development plan with {selectedFramework?.name || "your chosen framework"}...
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="h-4 w-4" />
                <span>This may take 30-60 seconds</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Button variant="ghost" size="sm" onClick={() => setMode("interview")}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              UI Framework Selection
            </CardTitle>
            <CardDescription>
              We detected your project needs a user interface. Choose a framework to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UIFrameworkSelector
              uiType={detectedUIType}
              suggestedFrameworks={suggestedFrameworks}
              onSelect={handleUIFrameworkSelect}
              onSkip={handleUIFrameworkSkip}
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  // Mode: Build Plan Review
  if (mode === "build_review" && generatedBuildPlan) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        {/* Show error if project creation failed */}
        {submitError && (
          <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600">
            <div className="flex items-center gap-2 font-medium mb-1">
              <AlertCircle className="h-4 w-4" />
              Failed to create project
            </div>
            <p className="text-sm">{submitError}</p>
          </div>
        )}
        {/* Show warning if user is not logged in */}
        {!user?.id && (
          <div className="mb-4 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-600">
            <div className="flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4" />
              You must be logged in to create a project
            </div>
          </div>
        )}
        <BuildPlanReview
          projectId={`temp-${Date.now()}`}
          projectName={projectName}
          projectDescription={projectDescription}
          buildPlan={generatedBuildPlan}
          packetSummary={buildPlanPacketSummary}
          planSource={buildPlanSource || undefined}
          monetizationIntent={monetizationIntent}
          onApproveAndStart={handleApproveBuildPlanAndStart}
          onEditBuildPlan={() => setMode("setup")}
          onRegenerate={handleRegenerateBuildPlan}
          onCancel={() => setMode("choose")}
          isRegenerating={isGeneratingBuildPlan}
          isSubmitting={isSubmitting}
        />
      </div>
    )
  }

  // Mode: Complete
  if (mode === "complete" && createdProject) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] p-6">
        <Card className="max-w-lg w-full">
          <CardContent className="pt-6 text-center">
            <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Project Created!</h2>
            <p className="text-muted-foreground mb-6">
              {createdProject.name} is ready to go.
              {createdProject.repos.length > 0 && (
                <> A GitLab repository has been created and linked.</>
              )}
            </p>
            {submitError && (
              <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 text-yellow-600 text-sm">
                {submitError}
              </div>
            )}
            <div className="flex flex-col gap-3 items-center">
              <Button
                size="lg"
                className="bg-green-600 hover:bg-green-700 text-white gap-2 px-8"
                onClick={() => router.push(`/projects/${createdProject.id}?startBuild=true`)}
              >
                <Rocket className="h-5 w-5" />
                Start Build
              </Button>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => router.push("/projects")}>
                  All Projects
                </Button>
                <Button variant="outline" onClick={() => router.push(`/projects/${createdProject.id}`)}>
                  View Project
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Mode: Setup
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setMode("choose")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Set Up Your Project</h1>
          <p className="text-sm text-muted-foreground">
            Review and finalize your project details
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project Details</CardTitle>
          <CardDescription>Basic information about your project</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Project Name</Label>
            <Input
              id="name"
              value={projectName}
              onChange={(e) => {
                setProjectName(e.target.value)
                setRepoName(toRepoName(e.target.value))
              }}
              placeholder="My Awesome Project"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              placeholder="What does this project do?"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Priority</Label>
            <div className="flex gap-2">
              {(["low", "medium", "high", "critical"] as const).map((p) => (
                <Badge
                  key={p}
                  variant={priority === p ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer capitalize",
                    priority === p && p === "critical" && "bg-red-500",
                    priority === p && p === "high" && "bg-orange-500",
                    priority === p && p === "low" && "bg-slate-500"
                  )}
                  onClick={() => setPriority(p)}
                >
                  {p}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                GitLab Repository
              </CardTitle>
              <CardDescription>Optionally create a new repository for this project</CardDescription>
            </div>
            <Switch
              checked={createRepo}
              onCheckedChange={setCreateRepo}
            />
          </div>
        </CardHeader>
        {createRepo && (
          <CardContent className="space-y-4">
            {!hasToken ? (
              <div className="p-4 rounded-lg border border-dashed space-y-3">
                <div className="flex items-start gap-3">
                  <Key className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">GitLab Access Token Required</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      To create repositories, you need to configure a GitLab personal access token with API scope.
                    </p>
                  </div>
                </div>

                {showTokenInput ? (
                  <div className="space-y-3">
                    <Input
                      type="password"
                      placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                    />
                    {tokenError && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {tokenError}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleTokenSave}
                        disabled={tokenValidating}
                      >
                        {tokenValidating && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                        Save Token
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setShowTokenInput(false)
                          setTokenInput("")
                          setTokenError("")
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setShowTokenInput(true)}>
                    Configure Token
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="repoName">Repository Name</Label>
                  <Input
                    id="repoName"
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                    placeholder="my-project"
                  />
                  <p className="text-xs text-muted-foreground">
                    Will be created at: {process.env.NEXT_PUBLIC_GITLAB_URL || ""}/gtechsd/{repoName}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Visibility</Label>
                  <div className="flex gap-2">
                    {(["private", "internal", "public"] as const).map((v) => (
                      <Badge
                        key={v}
                        variant={repoVisibility === v ? "default" : "outline"}
                        className="cursor-pointer capitalize"
                        onClick={() => setRepoVisibility(v)}
                      >
                        {v}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="readme">Initialize with README</Label>
                    <p className="text-xs text-muted-foreground">Create an initial README.md file</p>
                  </div>
                  <Switch
                    id="readme"
                    checked={initWithReadme}
                    onCheckedChange={setInitWithReadme}
                  />
                </div>
              </>
            )}
          </CardContent>
        )}
      </Card>

      {/* Project Folder - Auto-managed based on project name */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Project Folder
          </CardTitle>
          <CardDescription>
            The project folder is automatically managed by Claudia Coder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-3 rounded-lg bg-muted/50 border border-dashed">
            <p className="text-sm text-muted-foreground">
              Your project files will be stored at:
            </p>
            <code className="text-sm font-mono mt-1 block text-primary">
              ~/claudia-projects/{toRepoName(projectName) || 'project-name'}
            </code>
          </div>
        </CardContent>
      </Card>

      {submitError && (
        <div className="p-4 rounded-lg bg-red-500/10 text-red-600 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 flex-none mt-0.5" />
          <p className="text-sm">{submitError}</p>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push("/projects")}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !projectName.trim()}
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {createRepo && hasToken ? "Create Project & Repository" : "Create Project"}
          <Check className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// Generate a project name from interview content
function generateProjectName(session: InterviewSession): string {
  const firstUserMessage = session.messages.find(m => m.role === "user")
  if (!firstUserMessage) return "New Project"

  const content = firstUserMessage.content

  const patterns = [
    /(?:build|create|make|develop)\s+(?:a|an)?\s*([^,.!?]{3,30})/i,
    /^(?:a|an)\s+([^,.!?]{3,30})/i,
    /called\s+["']?([^"',!?.]{3,30})["']?/i,
    /named\s+["']?([^"',!?.]{3,30})["']?/i
  ]

  for (const pattern of patterns) {
    const match = content.match(pattern)
    if (match) {
      return capitalizeWords(match[1].trim())
    }
  }

  const words = content
    .split(/\s+/)
    .filter(w => w.length > 3 && !["want", "need", "like", "would", "could", "should", "that", "this", "with"].includes(w.toLowerCase()))
    .slice(0, 3)
    .join(" ")

  return capitalizeWords(words) || "New Project"
}

function capitalizeWords(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function toRepoName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50)
}

export default function NewProjectPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Loading...</h2>
            <p className="text-muted-foreground">
              Preparing project creation...
            </p>
          </CardContent>
        </Card>
      </div>
    }>
      <NewProjectContent />
    </Suspense>
  )
}
