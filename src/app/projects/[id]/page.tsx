"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
// Accordion components removed - now using sidebar navigation
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  GitBranch,
  Package,
  MessageSquare,
  Clock,
  Edit2,
  Trash2,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  Archive,
  Mic,
  Bot,
  User,
  RefreshCw,
  Link2,
  Unlink,
  Sparkles,
  Zap,
  Brain,
  Loader2,
  FileText,
  FolderOpen,
  FolderPlus,
  Upload,
  Shield,
  Cloud,
  Server,
  Zap as ExecuteIcon,
  Check,
  X,
  Pencil,
  Star,
  Terminal,
  Play,
  AlertTriangle,
  RotateCcw,
  DollarSign,
  Search,
  BookOpen,
  Download,
  ChevronDown,
  ChevronRight,
  Settings,
  Rocket,
  Activity
} from "lucide-react"
import {
  getProject,
  updateProject,
  trashProject,
  restoreProject,
  updateRepoLocalPath,
  toggleProjectStar,
  getEffectiveWorkingDirectory,
  getInterviewsForProject,
  addInterviewToProject,
  deleteInterviewFromProject,
  getCombinedInterviewInsights,
  migrateCreationInterview,
  type CombinedInterviewInsights
} from "@/lib/data/projects"
import { useStarredProjects } from "@/hooks/useStarredProjects"
import { useProjectExport } from "@/hooks/useProjectExport"
import { useAuth } from "@/components/auth/auth-provider"
import { getResourcesForProject, getBrainDumpsForProject } from "@/lib/data/resources"
// PacketCard removed - now using inline list view
import { PacketHistory } from "@/components/packets/packet-history"
import { PacketOutput } from "@/components/packets/packet-output"
import { PacketFeedback } from "@/components/packets/packet-feedback"
import { useLegacyPacketExecution, useBatchExecution, type ExecutionLog } from "@/hooks/usePacketExecution"
import type { PacketRun, PacketRunRating } from "@/lib/data/types"
import { getPacketRunsForProject } from "@/lib/data/packet-runs"
import { ModelAssignment } from "@/components/project/model-assignment"
import { ResourceList } from "@/components/project/resource-list"
import { ResourceUpload } from "@/components/project/resource-upload"
import { RepoBrowser } from "@/components/project/repo-browser"
import { BuildPlanEditor } from "@/components/project/build-plan-editor"
import { ProjectTimeline } from "@/components/project/project-timeline"
import { StartBuildHero } from "@/components/project/start-build-hero"
import { getBuildPlanForProject } from "@/lib/data/build-plans"
// FolderInitializer removed - no longer used
import { BrainDumpList } from "@/components/brain-dump/brain-dump-list"
import { AudioRecorder } from "@/components/brain-dump/audio-recorder"
import { ExecutionPanel, LaunchTestPanel, type ExecutionPanelRef, type RestoredSession } from "@/components/execution"
import { useRunHistory, type RunHistorySummary } from "@/hooks/useActivityPersistence"
import { ClaudeCodeTerminal } from "@/components/claude-code/terminal"
// ClaudiaSyncStatus removed - was only used in the standalone terminal section
import { BusinessDevSection } from "@/components/project/business-dev-section"
import { PriorArtSection } from "@/components/project/prior-art-section"
import { DocsBrowser } from "@/components/project/docs-browser"
import { VisionDisplay } from "@/components/project/vision-display"
import { FileBrowser } from "@/components/project/file-browser"
import { QuickComment } from "@/components/project/quick-comment"
import { MCPSettings } from "@/components/project/mcp-settings"
import { InterviewList } from "@/components/interview/interview-list"
import { AnalyzeCodebaseButton } from "@/components/project/analyze-codebase-button"
import { WhatsNextSection } from "@/components/project/whats-next-section"
import { TouchdownSection } from "@/components/project/touchdown-section"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import type { Project, ProjectStatus, InterviewMessage, InterviewSession, StoredBuildPlan, ProjectMCPSettings } from "@/lib/data/types"

interface ProviderOption {
  name: string
  displayName: string
  status: "online" | "offline" | "checking" | "not-configured"
  model?: string
  type: "local" | "cloud" | "cli"
}

const statusConfig: Record<ProjectStatus, { label: string; color: string; icon: React.ElementType }> = {
  planning: { label: "Planning", color: "bg-blue-500/10 text-blue-500 border-blue-500/30", icon: Clock },
  active: { label: "Active", color: "bg-green-500/10 text-green-500 border-green-500/30", icon: PlayCircle },
  paused: { label: "Paused", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30", icon: PauseCircle },
  completed: { label: "Completed", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30", icon: CheckCircle2 },
  archived: { label: "Archived", color: "bg-gray-500/10 text-gray-500 border-gray-500/30", icon: Archive },
  trashed: { label: "Trashed", color: "bg-red-500/10 text-red-500 border-red-500/30", icon: Trash2 }
}

const priorityConfig = {
  low: { label: "Low", color: "bg-gray-500/10 text-gray-400" },
  medium: { label: "Medium", color: "bg-blue-500/10 text-blue-400" },
  high: { label: "High", color: "bg-orange-500/10 text-orange-400" },
  critical: { label: "Critical", color: "bg-red-500/10 text-red-400" }
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()

  // Safely extract project ID from params (handle array case for catch-all routes)
  const projectId = Array.isArray(params.id) ? params.id[0] : (params.id as string)

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [resourceCount, setResourceCount] = useState(0)
  const [brainDumpCount, setBrainDumpCount] = useState(0)
  const [isRecordingBrainDump, setIsRecordingBrainDump] = useState(false)
  const [repoBrowserOpen, setRepoBrowserOpen] = useState(false)
  const [providers, setProviders] = useState<ProviderOption[]>([])
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionStatus, setExecutionStatus] = useState<string | null>(null)
  const [packets, setPackets] = useState<Array<{
    id: string
    title: string
    description: string
    type: string
    priority: string
    status: string
    tasks: Array<{ id: string; description: string; completed: boolean }>
    acceptanceCriteria: string[]
    runs?: PacketRun[]
  }>>([])

  // Packet detail panel state
  const [selectedPacketId, setSelectedPacketId] = useState<string | null>(null)
  const [selectedRun, setSelectedRun] = useState<PacketRun | null>(null)
  const [packetRuns, setPacketRuns] = useState<Record<string, PacketRun[]>>({})

  // Packet execution hook
  const {
    execute: executePacket,
    isExecuting: isPacketExecuting,
    currentPacketId: executingPacketId,
    logs: executionLogs,
    error: executionError
  } = useLegacyPacketExecution()

  // Batch execution hook
  const {
    executeBatch,
    isExecuting: isBatchExecuting,
    progress: batchProgress,
    results: batchResults
  } = useBatchExecution()

  // Build plan state
  const [hasBuildPlan, setHasBuildPlan] = useState(false)
  const [buildPlanApproved, setBuildPlanApproved] = useState(false)
  const [currentBuildPlan, setCurrentBuildPlan] = useState<StoredBuildPlan | null>(null)

  // Interview state (multi-interview support)
  const [projectInterviews, setProjectInterviews] = useState<InterviewSession[]>([])
  const [combinedInsights, setCombinedInsights] = useState<CombinedInterviewInsights | null>(null)
  const [isRegeneratingBuildPlan, setIsRegeneratingBuildPlan] = useState(false)

  // State for editing repo local path
  const [editingRepoId, setEditingRepoId] = useState<number | null>(null)
  const [editingLocalPath, setEditingLocalPath] = useState("")

  // State for editing basePath
  const [editingBasePath, setEditingBasePath] = useState(false)
  const [newBasePath, setNewBasePath] = useState("")

  // Claude Code terminal state
  const [claudeCodeStarted, setClaudeCodeStarted] = useState(false)
  const [claudeCodeKey, setClaudeCodeKey] = useState(0)
  const [claudeCodeWorkDir, setClaudeCodeWorkDir] = useState<string | null>(null)
  const [claudeCodeLoading, setClaudeCodeLoading] = useState(false)
  const [claudeCodeError, setClaudeCodeError] = useState<string | null>(null)
  const [bypassPermissions, setBypassPermissions] = useState(false)

  // Navigation state - now for sidebar sections
  const [activeSection, setActiveSection] = useState("overview")
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Run history for this project
  const { history: runHistory, isLoading: runHistoryLoading, refetch: refetchRunHistory } = useRunHistory(projectId)

  // Batch execution state
  const [concurrency, setConcurrency] = useState(1)
  const [customConcurrency, setCustomConcurrency] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)

  // Packet edit/delete state
  const [editingPacket, setEditingPacket] = useState<{
    id: string
    title: string
    description: string
    priority: string
  } | null>(null)
  const [deletePacketId, setDeletePacketId] = useState<string | null>(null)

  // Packet creation state
  const [creatingPacket, setCreatingPacket] = useState(false)
  const [newPacket, setNewPacket] = useState({
    title: '',
    description: '',
    priority: 'medium',
    type: 'feature'
  })

  // Clear generated code state
  const [showClearGenerated, setShowClearGenerated] = useState(false)
  const [clearGeneratedPreview, setClearGeneratedPreview] = useState<{
    deleted: string[]
    preserved: string[]
  } | null>(null)
  const [isClearingGenerated, setIsClearingGenerated] = useState(false)
  const [clearGeneratedError, setClearGeneratedError] = useState<string | null>(null)

  // Ref for the hero-embedded ExecutionPanel
  const heroExecutionPanelRef = useRef<ExecutionPanelRef>(null)

  // State to show execution panel in place of the Ready to Build hero
  const [showExecutionInHero, setShowExecutionInHero] = useState(false)

  // Execution session restoration state
  const [restoredSession, setRestoredSession] = useState<RestoredSession | null>(null)
  // sessionPollingInterval removed - polling is disabled to prevent page disruption

  // Starred projects hook for sidebar sync
  const { toggleStar } = useStarredProjects()

  // Project export hook
  const { exportProject, isExporting, progress } = useProjectExport()

  // Auth hook for user-scoped storage
  const { user } = useAuth()

  // Check for active execution sessions on mount and restore state if found
  useEffect(() => {
    if (!projectId) return

    const checkActiveSession = async () => {
      try {
        const response = await fetch(`/api/execution-sessions?projectId=${projectId}`)

        // Handle non-ok responses gracefully
        if (!response.ok) {
          console.warn(`[ProjectPage] Session check returned ${response.status}, skipping`)
          return
        }

        const data = await response.json()

        if (data.success && data.session && data.session.status === "running") {
          console.log(`[ProjectPage] Found active execution session: ${data.session.id}`)

          // Convert server session to RestoredSession format
          const restored: RestoredSession = {
            id: data.session.id,
            status: data.session.status,
            progress: data.session.progress,
            events: data.session.events || [],
            currentPacketIndex: data.session.currentPacketIndex || 0
          }
          setRestoredSession(restored)

          // Session polling disabled to prevent page disruption
          // The ExecutionPanel component handles its own session state updates
          // via events, so polling is not necessary for UI updates
          console.log(`[ProjectPage] Active session found, polling disabled to prevent page disruption`)
        }
      } catch (error) {
        console.error("[ProjectPage] Error checking for active sessions:", error)
      }
    }

    checkActiveSession()
    // No cleanup needed - polling is disabled
  }, [projectId])

  // Load packets and build plan status for this project
  useEffect(() => {
    if (!projectId) return

    // Load packets
    const storedPackets = localStorage.getItem("claudia_packets")
    if (storedPackets) {
      try {
        const allPackets = JSON.parse(storedPackets)
        // Packets are stored as { [projectId]: WorkPacket[] }, not a flat array
        const projectPackets = allPackets[projectId] || []
        setPackets(projectPackets)
      } catch {
        console.error("Failed to parse packets")
      }
    }

    // Load build plan status
    const buildPlan = getBuildPlanForProject(projectId)
    if (buildPlan) {
      setHasBuildPlan(true)
      setBuildPlanApproved(buildPlan.status === "approved" || buildPlan.status === "locked")
      setCurrentBuildPlan(buildPlan)
    } else {
      setHasBuildPlan(false)
      setBuildPlanApproved(false)
      setCurrentBuildPlan(null)
    }
  }, [projectId])

  useEffect(() => {
    if (!projectId) {
      setLoading(false)
      return
    }

    const found = getProject(projectId, user?.id)
    setProject(found || null)
    setLoading(false)

    // Load resource count
    const resources = getResourcesForProject(projectId)
    setResourceCount(resources.length)

    // Load brain dump count
    const brainDumps = getBrainDumpsForProject(projectId)
    setBrainDumpCount(brainDumps.length)

    // Auto-migrate legacy creationInterview to new interviewIds system (one-time)
    // This is done synchronously before loading interviews
    let projectToUse = found
    if (found?.creationInterview && (!found.interviewIds || found.interviewIds.length === 0)) {
      console.log("[ProjectPage] Migrating legacy creationInterview for project:", projectId)
      const migrated = migrateCreationInterview(projectId, user?.id)
      if (migrated) {
        projectToUse = migrated
        setProject(migrated) // Update state with migrated project
      }
    }

    // Load interviews for this project (multi-interview support)
    const interviews = getInterviewsForProject(projectId, user?.id)
    setProjectInterviews(interviews)

    // Get combined insights from all interviews
    if (interviews.length > 0) {
      const insights = getCombinedInterviewInsights(projectId, user?.id)
      setCombinedInsights(insights)
    }
  }, [projectId, user?.id])

  // Check available providers on mount
  useEffect(() => {
    async function fetchProviders() {
      try {
        const response = await fetch("/api/providers")
        const data = await response.json()

        if (data.providers) {
          const providerOptions: ProviderOption[] = data.providers.map((p: {
            name: string
            displayName: string
            type: "local" | "cloud" | "cli"
            status: "online" | "offline" | "checking" | "not-configured"
            model?: string
          }) => ({
            name: p.name,
            displayName: p.displayName,
            type: p.type,
            status: p.status,
            model: p.model
          }))

          setProviders(providerOptions)

          // Auto-select provider: prefer online local, then CLI (Claude Code), then online cloud, then anthropic as fallback
          const onlineLocal = providerOptions.find(p => p.status === "online" && p.type === "local")
          const onlineCli = providerOptions.find(p => p.status === "online" && p.type === "cli")
          const onlineCloud = providerOptions.find(p => p.status === "online" && p.type === "cloud")
          const anthropicProvider = providerOptions.find(p => p.name === "anthropic")
          const defaultProvider = onlineLocal || onlineCli || onlineCloud || anthropicProvider
          if (defaultProvider) {
            setSelectedProvider(defaultProvider.name)
          }
        }
      } catch (error) {
        console.error("Failed to fetch providers:", error)
      }
    }

    fetchProviders()
  }, [])

  // Load packet runs using user-scoped storage
  useEffect(() => {
    if (!projectId || !user?.id) return

    try {
      // Use user-scoped storage function
      const storedRuns = getPacketRunsForProject(projectId, user.id)
      setPacketRuns(storedRuns)
    } catch (err) {
      console.error("Failed to load packet runs:", err)
    }
  }, [projectId, user?.id]) // Don't include packets - causes cascading updates on every packet completion

  // Get selected packet
  const selectedPacket = selectedPacketId
    ? packets.find(p => p.id === selectedPacketId)
    : null

  // Get runs for selected packet
  const selectedPacketRuns = selectedPacketId
    ? packetRuns[selectedPacketId] || []
    : []

  // Handler for starting packet execution
  const handleStartPacket = async (packetId: string) => {
    if (!projectId) return

    // Create a new run record
    const newRun: PacketRun = {
      id: `run-${Date.now()}`,
      packetId,
      projectId,
      iteration: (packetRuns[packetId]?.length || 0) + 1,
      startedAt: new Date().toISOString(),
      status: "running",
      output: ""
    }

    // Update local state
    setPacketRuns(prev => ({
      ...prev,
      [packetId]: [...(prev[packetId] || []), newRun]
    }))

    // Save to localStorage
    const storedRuns = localStorage.getItem("claudia_packet_runs")
    const allRuns = storedRuns ? JSON.parse(storedRuns) : {}
    allRuns[packetId] = [...(allRuns[packetId] || []), newRun]
    localStorage.setItem("claudia_packet_runs", JSON.stringify(allRuns))

    // Select this packet and run
    setSelectedPacketId(packetId)
    setSelectedRun(newRun)

    try {
      // Execute the packet
      const result = await executePacket(packetId, projectId)

      // Update the run with results
      const completedRun: PacketRun = {
        ...newRun,
        status: result.success ? "completed" : "failed",
        completedAt: new Date().toISOString(),
        output: result.rawOutput || result.logs.map((l: ExecutionLog) => `[${l.level}] ${l.message}`).join("\n"),
        exitCode: result.success ? 0 : 1
      }

      // Update local state
      setPacketRuns(prev => ({
        ...prev,
        [packetId]: prev[packetId].map(r => r.id === newRun.id ? completedRun : r)
      }))

      // Update localStorage
      const updatedStoredRuns = localStorage.getItem("claudia_packet_runs")
      const updatedAllRuns = updatedStoredRuns ? JSON.parse(updatedStoredRuns) : {}
      updatedAllRuns[packetId] = updatedAllRuns[packetId].map((r: PacketRun) =>
        r.id === newRun.id ? completedRun : r
      )
      localStorage.setItem("claudia_packet_runs", JSON.stringify(updatedAllRuns))

      // Update selected run
      setSelectedRun(completedRun)

      // Update packet status
      setPackets(prev => prev.map(p =>
        p.id === packetId
          ? { ...p, status: result.success ? "completed" : "failed" }
          : p
      ))
    } catch (err) {
      console.error("Packet execution failed:", err)
    }
  }

  // Handler for stopping packet execution
  const handleStopPacket = (packetId: string) => {
    // Find the running run
    const runs = packetRuns[packetId] || []
    const runningRun = runs.find(r => r.status === "running")
    if (!runningRun) return

    // Update run status to cancelled
    const cancelledRun: PacketRun = {
      ...runningRun,
      status: "cancelled",
      completedAt: new Date().toISOString()
    }

    // Update local state
    setPacketRuns(prev => ({
      ...prev,
      [packetId]: prev[packetId].map(r => r.id === runningRun.id ? cancelledRun : r)
    }))

    // Update localStorage
    const storedRuns = localStorage.getItem("claudia_packet_runs")
    const allRuns = storedRuns ? JSON.parse(storedRuns) : {}
    allRuns[packetId] = allRuns[packetId].map((r: PacketRun) =>
      r.id === runningRun.id ? cancelledRun : r
    )
    localStorage.setItem("claudia_packet_runs", JSON.stringify(allRuns))

    // Update selected run if it was the running one
    if (selectedRun?.id === runningRun.id) {
      setSelectedRun(cancelledRun)
    }
  }

  // Handler for packet feedback
  const handlePacketFeedback = (run: PacketRun, rating: PacketRunRating, comment?: string) => {
    const updatedRun: PacketRun = {
      ...run,
      rating,
      comment
    }

    // Update local state
    setPacketRuns(prev => ({
      ...prev,
      [run.packetId]: prev[run.packetId].map(r => r.id === run.id ? updatedRun : r)
    }))

    // Update localStorage
    const storedRuns = localStorage.getItem("claudia_packet_runs")
    const allRuns = storedRuns ? JSON.parse(storedRuns) : {}
    allRuns[run.packetId] = allRuns[run.packetId].map((r: PacketRun) =>
      r.id === run.id ? updatedRun : r
    )
    localStorage.setItem("claudia_packet_runs", JSON.stringify(allRuns))

    // Update selected run
    if (selectedRun?.id === run.id) {
      setSelectedRun(updatedRun)
    }
  }

  // Handler for selecting a run from history
  const handleSelectRun = (run: PacketRun) => {
    setSelectedRun(run)
  }

  // Handler for editing a packet
  const handleEditPacket = (packetId: string) => {
    const packet = packets.find(p => p.id === packetId)
    if (packet) {
      setEditingPacket({
        id: packet.id,
        title: packet.title,
        description: packet.description,
        priority: packet.priority
      })
    }
  }

  // Handler for saving packet edits
  const handleSavePacketEdit = () => {
    if (!editingPacket || !projectId) return

    // Update local state
    setPackets(prev => prev.map(p =>
      p.id === editingPacket.id
        ? { ...p, title: editingPacket.title, description: editingPacket.description, priority: editingPacket.priority }
        : p
    ))

    // Update localStorage
    const storedPackets = localStorage.getItem("claudia_packets")
    if (storedPackets) {
      try {
        const allPackets = JSON.parse(storedPackets)
        const projectPackets = allPackets[projectId] || []
        const updatedProjectPackets = projectPackets.map((p: { id: string; title: string; description: string; priority: string }) =>
          p.id === editingPacket.id
            ? { ...p, title: editingPacket.title, description: editingPacket.description, priority: editingPacket.priority }
            : p
        )
        allPackets[projectId] = updatedProjectPackets
        localStorage.setItem("claudia_packets", JSON.stringify(allPackets))
      } catch {
        console.error("Failed to save packet edit")
      }
    }

    // Close dialog
    setEditingPacket(null)
  }

  // Handler for creating a new packet
  const handleCreatePacket = () => {
    if (!newPacket.title.trim() || !projectId) return

    const packet = {
      id: `packet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: newPacket.title.trim(),
      description: newPacket.description.trim(),
      type: newPacket.type,
      priority: newPacket.priority,
      status: 'pending',
      tasks: [],
      acceptanceCriteria: [],
      runs: []
    }

    // Update local state
    setPackets(prev => [...prev, packet])

    // Update localStorage
    const storedPackets = localStorage.getItem("claudia_packets")
    if (storedPackets) {
      try {
        const allPackets = JSON.parse(storedPackets)
        const projectPackets = allPackets[projectId] || []
        allPackets[projectId] = [...projectPackets, packet]
        localStorage.setItem("claudia_packets", JSON.stringify(allPackets))
      } catch {
        console.error("Failed to save new packet")
      }
    } else {
      // Initialize storage with this packet
      const allPackets = { [projectId]: [packet] }
      localStorage.setItem("claudia_packets", JSON.stringify(allPackets))
    }

    // Reset form and close dialog
    setNewPacket({ title: '', description: '', priority: 'medium', type: 'feature' })
    setCreatingPacket(false)
  }

  // Handler for deleting a packet
  const handleDeletePacket = (packetId: string) => {
    setDeletePacketId(packetId)
  }

  // Handler for confirming packet deletion
  const handleConfirmDeletePacket = () => {
    if (!deletePacketId || !projectId) return

    // Update local state
    setPackets(prev => prev.filter(p => p.id !== deletePacketId))

    // Clear selection if deleted packet was selected
    if (selectedPacketId === deletePacketId) {
      setSelectedPacketId(null)
      setSelectedRun(null)
    }

    // Update localStorage
    const storedPackets = localStorage.getItem("claudia_packets")
    if (storedPackets) {
      try {
        const allPackets = JSON.parse(storedPackets)
        const projectPackets = allPackets[projectId] || []
        const updatedProjectPackets = projectPackets.filter((p: { id: string }) => p.id !== deletePacketId)
        allPackets[projectId] = updatedProjectPackets
        localStorage.setItem("claudia_packets", JSON.stringify(allPackets))
      } catch {
        console.error("Failed to delete packet")
      }
    }

    // Also clean up associated runs
    const storedRuns = localStorage.getItem("claudia_packet_runs")
    if (storedRuns) {
      try {
        const allRuns = JSON.parse(storedRuns)
        delete allRuns[deletePacketId]
        localStorage.setItem("claudia_packet_runs", JSON.stringify(allRuns))
        setPacketRuns(prev => {
          const updated = { ...prev }
          delete updated[deletePacketId]
          return updated
        })
      } catch {
        console.error("Failed to delete packet runs")
      }
    }

    // Close dialog
    setDeletePacketId(null)
  }

  // Handler for running all pending packets
  const handleRunAllPackets = async () => {
    if (!projectId) return

    // Filter to only run packets that are not already completed
    const pendingPackets = packets.filter(p => p.status !== "completed")
    if (pendingPackets.length === 0) return

    const packetIds = pendingPackets.map(p => p.id)

    // Get the effective concurrency value
    const effectiveConcurrency = showCustomInput
      ? parseInt(customConcurrency) || 1
      : concurrency

    console.log(`[RunAllPackets] Starting batch execution of ${packetIds.length} packets with concurrency: ${effectiveConcurrency}`)

    // Execute batch with concurrency (note: hook currently runs sequentially,
    // future enhancement would add true concurrency support to the hook)
    await executeBatch(packetIds, projectId)

    // Refresh packets to show updated statuses
    const storedPackets = localStorage.getItem("claudia_packets")
    if (storedPackets) {
      try {
        const allPackets = JSON.parse(storedPackets)
        const projectPackets = allPackets[projectId] || []
        setPackets(projectPackets)
      } catch {
        console.error("Failed to parse packets")
      }
    }
  }

  // Handler for resetting all packets back to queued status
  const handleResetAllPackets = () => {
    if (!projectId || packets.length === 0) return

    // Reset all packets to "queued" status
    const resetPackets = packets.map(p => ({
      ...p,
      status: "queued"
    }))

    // Update local state
    setPackets(resetPackets)

    // Update localStorage
    const storedPackets = localStorage.getItem("claudia_packets")
    if (storedPackets) {
      try {
        const allPackets = JSON.parse(storedPackets)
        allPackets[projectId] = resetPackets
        localStorage.setItem("claudia_packets", JSON.stringify(allPackets))
      } catch {
        console.error("Failed to save reset packets")
      }
    }
  }

  // Get pending packets count for the "Run All" button
  const pendingPackets = packets.filter(p => p.status !== "completed")

  // Get completed packets count for the "Reset All" button
  const completedPackets = packets.filter(p => p.status === "completed")

  // Handle concurrency selection change
  const handleConcurrencyChange = (value: string) => {
    if (value === "custom") {
      setShowCustomInput(true)
      setConcurrency(1)
    } else if (value === "all") {
      setShowCustomInput(false)
      setConcurrency(packets.length || 10)
    } else {
      setShowCustomInput(false)
      setConcurrency(parseInt(value))
    }
  }

  const refreshResourceCount = () => {
    if (!projectId) return
    const resources = getResourcesForProject(projectId)
    setResourceCount(resources.length)
  }

  const refreshBrainDumpCount = () => {
    if (!projectId) return
    const brainDumps = getBrainDumpsForProject(projectId)
    setBrainDumpCount(brainDumps.length)
  }

  const handleBrainDumpRecorded = (resourceId: string, brainDumpId: string) => {
    setIsRecordingBrainDump(false)
    refreshResourceCount()
    refreshBrainDumpCount()
    // TODO: Could navigate to the brain dump review
    console.log("Brain dump created:", brainDumpId, "from resource:", resourceId)
  }

  // Handler for packets approved from brain dump packetize flow
  const handleBrainDumpPacketsApproved = (approvedPackets: Array<{
    id: string
    title: string
    description: string
    type: string
    priority: string
    tasks: Array<{ id: string; description: string; completed: boolean; order: number }>
    acceptanceCriteria: string[]
    approvedPriority?: string
  }>) => {
    if (!project || approvedPackets.length === 0) return

    try {
      // Get existing packets from localStorage
      const storedPackets = localStorage.getItem("claudia_packets")
      const allPackets = storedPackets ? JSON.parse(storedPackets) : {}
      const projectPackets = allPackets[project.id] || []

      // Convert approved packets to work packet format and add them
      const newPackets = approvedPackets.map(p => ({
        id: p.id,
        phaseId: "brain-dump-phase",
        title: p.title,
        description: p.description,
        type: p.type,
        priority: p.approvedPriority || p.priority,
        status: "queued",
        tasks: p.tasks,
        acceptanceCriteria: p.acceptanceCriteria,
        metadata: {
          source: "brain-dump",
          createdAt: new Date().toISOString()
        }
      }))

      // Add new packets to existing ones
      allPackets[project.id] = [...projectPackets, ...newPackets]
      localStorage.setItem("claudia_packets", JSON.stringify(allPackets))

      // Update local state
      setPackets(allPackets[project.id])

      console.log(`Added ${newPackets.length} packets from brain dump`)
    } catch (err) {
      console.error("Failed to save brain dump packets:", err)
    }
  }

  const refreshProject = () => {
    if (!projectId) return
    const found = getProject(projectId, user?.id)
    if (found) setProject(found)
  }

  const handleStatusChange = (newStatus: ProjectStatus) => {
    if (!project) return
    const updated = updateProject(project.id, { status: newStatus }, user?.id)
    if (updated) setProject(updated)
  }

  const handleTrash = () => {
    if (!project) return
    if (confirm("Send this project to trash?")) {
      trashProject(project.id, user?.id)
      router.push("/projects")
    }
  }

  const handleRestore = () => {
    if (!project) return
    const restored = restoreProject(project.id, user?.id)
    if (restored) {
      setProject(restored)
    }
  }

  const handleToggleStar = () => {
    if (!project) return
    const updated = toggleStar(project.id)
    if (updated) {
      setProject(updated)
    }
  }

  const handleStartEditLocalPath = (repoId: number, currentPath: string | undefined) => {
    setEditingRepoId(repoId)
    setEditingLocalPath(currentPath || "")
  }

  const handleSaveLocalPath = (repoId: number) => {
    if (!project) return
    const updated = updateRepoLocalPath(project.id, repoId, editingLocalPath)
    if (updated) {
      setProject(updated)
    }
    setEditingRepoId(null)
    setEditingLocalPath("")
  }

  const handleCancelEditLocalPath = () => {
    setEditingRepoId(null)
    setEditingLocalPath("")
  }

  // Interview handlers
  const handleStartNewInterview = () => {
    // TODO: Open interview modal/panel for new interview
    console.log("Start new interview for project:", projectId)
    // For now, we'd need to integrate with the InterviewPanel component
  }

  const handleContinueInterview = (interview: InterviewSession) => {
    // TODO: Open interview panel with existing session to continue
    console.log("Continue interview:", interview.id)
  }

  const handleDeleteInterview = (interviewId: string) => {
    if (!project) return
    deleteInterviewFromProject(interviewId, project.id, user?.id)
    // Refresh interviews
    const interviews = getInterviewsForProject(project.id, user?.id)
    setProjectInterviews(interviews)
    if (interviews.length > 0) {
      const insights = getCombinedInterviewInsights(project.id, user?.id)
      setCombinedInsights(insights)
    } else {
      setCombinedInsights(null)
    }
  }

  const handleViewInterview = (interview: InterviewSession) => {
    // TODO: Open interview transcript viewer
    console.log("View interview:", interview.id)
  }

  const handleRegenerateBuildPlan = async () => {
    if (!project || projectInterviews.length === 0) return
    setIsRegeneratingBuildPlan(true)
    try {
      // TODO: Call generateBuildPlanFromInterviews
      console.log("Regenerating build plan from", projectInterviews.length, "interviews")
      // For now, just simulate
      await new Promise((resolve) => setTimeout(resolve, 2000))
    } finally {
      setIsRegeneratingBuildPlan(false)
    }
  }

  // MCP settings handler
  const handleMCPSettingsChange = (settings: ProjectMCPSettings) => {
    if (!project) return
    const updated = updateProject(project.id, { mcpSettings: settings }, user?.id)
    if (updated) setProject(updated)
  }

  // Handler for Start Build hero - shows execution panel in place and triggers GO
  const handleStartBuild = useCallback(() => {
    // 1. Show the execution panel in place of the Ready to Build hero
    setShowExecutionInHero(true)

    // 2. Trigger execution after the panel renders
    // Use requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(() => {
      // Another rAF to ensure the component has fully mounted
      requestAnimationFrame(() => {
        if (heroExecutionPanelRef.current) {
          heroExecutionPanelRef.current.triggerExecution()
        }
      })
    })
  }, [])

  // Handler to return to Ready to Build view from execution view
  const handleReturnToReady = useCallback(() => {
    setShowExecutionInHero(false)
  }, [])

  // Handler for starting Claude Code session
  const handleStartClaudeCode = async () => {
    if (!project) return

    setClaudeCodeLoading(true)
    setClaudeCodeError(null)

    try {
      // Get the effective working directory for this project
      const workDir = getEffectiveWorkingDirectory(project)

      // Ensure the directory exists
      const response = await fetch("/api/projects/ensure-working-directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          projectName: project.name,
          existingWorkingDirectory: project.workingDirectory,
          basePath: project.basePath,
          repoLocalPath: project.repos.find(r => r.localPath)?.localPath
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to prepare working directory")
      }

      const data = await response.json()
      setClaudeCodeWorkDir(data.workingDirectory)
      setClaudeCodeStarted(true)
      setClaudeCodeKey(prev => prev + 1)
    } catch (err) {
      setClaudeCodeError(err instanceof Error ? err.message : "Failed to start Claude Code")
    } finally {
      setClaudeCodeLoading(false)
    }
  }

  // Handler for opening the clear generated dialog
  const handleOpenClearGenerated = async () => {
    if (!projectId || !project) return

    setClearGeneratedError(null)
    setClearGeneratedPreview(null)
    setShowClearGenerated(true)

    // Get the working directory from the project
    const workingDirectory = getEffectiveWorkingDirectory(project)

    try {
      // Fetch preview of what would be deleted - POST with dryRun: true
      const response = await fetch(`/api/projects/${projectId}/clear-generated`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: true, workingDirectory })
      })
      const data = await response.json()

      if (data.success || data.dryRun) {
        setClearGeneratedPreview({
          deleted: data.deleted || [],
          preserved: data.preserved || []
        })
      } else {
        setClearGeneratedError(data.error || "Failed to preview")
      }
    } catch (error) {
      setClearGeneratedError(error instanceof Error ? error.message : "Failed to preview")
    }
  }

  // Handler for confirming clear generated code
  const handleConfirmClearGenerated = async () => {
    if (!projectId || !project) return

    setIsClearingGenerated(true)
    setClearGeneratedError(null)

    // Get the working directory from the project
    const workingDirectory = getEffectiveWorkingDirectory(project)

    try {
      const response = await fetch(`/api/projects/${projectId}/clear-generated`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false, workingDirectory })
      })

      const data = await response.json()

      if (data.success) {
        setShowClearGenerated(false)
        setClearGeneratedPreview(null)
        // Show success message
        setExecutionStatus(`Cleared ${data.deleted.length} generated items. Preserved ${data.preserved.length} project files.`)
        setTimeout(() => setExecutionStatus(null), 5000)
      } else {
        setClearGeneratedError(data.error || "Failed to clear generated code")
      }
    } catch (error) {
      setClearGeneratedError(error instanceof Error ? error.message : "Failed to clear generated code")
    } finally {
      setIsClearingGenerated(false)
    }
  }

  const handleAddToQueue = () => {
    if (!project) {
      alert("Project not loaded")
      return
    }

    // Check for any working directory: basePath, workingDirectory, or a linked repo with local path
    const hasWorkingDir = project.basePath || project.workingDirectory || project.repos.some(r => r.localPath)
    if (!hasWorkingDir) {
      alert("Please set up a project folder first (in Settings) or link a repository")
      return
    }

    // Get packets for this project from localStorage
    // Packets are stored as { [projectId]: WorkPacket[] }, not a flat array
    const storedPackets = localStorage.getItem("claudia_packets")
    const allPackets = storedPackets ? JSON.parse(storedPackets) : {}
    const projectPackets = allPackets[project.id] || []

    if (projectPackets.length === 0) {
      alert("No packets found for this project. Create a build plan first.")
      return
    }

    // Add to queue
    try {
      const queueData = localStorage.getItem("claudia_execution_queue")
      const queue = queueData ? JSON.parse(queueData) : []

      // Check if already in queue
      if (queue.some((q: { projectId: string }) => q.projectId === project.id)) {
        setExecutionStatus("Already in queue")
        return
      }

      queue.push({
        projectId: project.id,
        project: {
          id: project.id,
          name: project.name,
          description: project.description
        },
        packets: projectPackets,
        repo: project.repos[0],
        priority: queue.length + 1,
        addedAt: new Date().toISOString(),
        estimatedPackets: projectPackets.length
      })

      localStorage.setItem("claudia_execution_queue", JSON.stringify(queue))
      setExecutionStatus(`Added to queue (position ${queue.length})`)

      // Clear status after a few seconds
      setTimeout(() => setExecutionStatus(null), 3000)
    } catch (error) {
      setExecutionStatus(`Error: ${error instanceof Error ? error.message : "Failed to add to queue"}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-6">
        <Card className="bg-destructive/10 border-destructive/30">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Project Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The project you&apos;re looking for doesn&apos;t exist or has been deleted.
            </p>
            <Button asChild>
              <Link href="/projects">Back to Projects</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const StatusIcon = statusConfig[project.status].icon

  return (
    <div className="p-6 space-y-6 min-h-0 overflow-auto bg-background">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/projects">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8",
                project.starred
                  ? "text-yellow-400 hover:text-yellow-500"
                  : "text-muted-foreground hover:text-yellow-400"
              )}
              onClick={handleToggleStar}
              title={project.starred ? "Unstar project" : "Star project"}
            >
              <Star className={cn("h-5 w-5", project.starred && "fill-current")} />
            </Button>
{project.status !== "trashed" ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-md">
                    <Badge className={cn("border cursor-pointer hover:opacity-80 transition-opacity", statusConfig[project.status].color)}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusConfig[project.status].label}
                    </Badge>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {(["planning", "active", "paused", "completed", "archived"] as ProjectStatus[]).map((status) => {
                    const config = statusConfig[status]
                    const Icon = config.icon
                    return (
                      <DropdownMenuItem
                        key={status}
                        onClick={() => handleStatusChange(status)}
                        className={cn(
                          "cursor-pointer",
                          project.status === status && "bg-accent"
                        )}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        {config.label}
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Badge className={cn("border", statusConfig[project.status].color)}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusConfig[project.status].label}
              </Badge>
            )}
            <Badge className={cn(priorityConfig[project.priority].color)}>
              {priorityConfig[project.priority].label}
            </Badge>
          </div>
          <p className="text-muted-foreground ml-12">{project.description}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportProject(projectId, { includeSourceCode: true })}
            disabled={isExporting}
            className="mr-2"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {progress?.step || "Exporting..."}
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export All
              </>
            )}
          </Button>
          <Button
            size="sm"
            onClick={handleAddToQueue}
            disabled={isExecuting || project.repos.length === 0}
            className="gap-2"
          >
            {isExecuting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ExecuteIcon className="h-4 w-4" />
            )}
            Add to Queue
          </Button>
          <Button variant="outline" size="sm">
            <Edit2 className="h-4 w-4 mr-1" />
            Edit
          </Button>
          {project.status === "trashed" ? (
            <Button variant="outline" size="sm" onClick={handleRestore} className="text-green-500 hover:text-green-600">
              <RotateCcw className="h-4 w-4 mr-1" />
              Restore
            </Button>
          ) : (
            <Button variant="destructive" size="sm" onClick={handleTrash}>
              <Trash2 className="h-4 w-4 mr-1" />
              Trash
            </Button>
          )}
        </div>
      </div>

      {/* Trashed Project Banner */}
      {project.status === "trashed" && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Trash2 className="h-5 w-5 text-red-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-500">This project is in the trash</p>
                <p className="text-xs text-muted-foreground">
                  {project.trashedAt && `Trashed ${new Date(project.trashedAt).toLocaleDateString()}`}
                  {project.previousStatus && ` - was ${statusConfig[project.previousStatus].label}`}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRestore}
                className="text-green-500 hover:text-green-600 gap-1"
              >
                <RotateCcw className="h-4 w-4" />
                Restore Project
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Execution Status */}
      {executionStatus && (
        <Card className="p-3 border-primary/30 bg-primary/5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <p className="text-sm font-medium flex-1">{executionStatus}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExecutionStatus(null)}
            >
              Dismiss
            </Button>
          </div>
        </Card>
      )}

      {/* ==================== TOUCHDOWN SECTION ==================== */}
      {/* Shows when all packets are complete - the final refinement phase */}
      {packets.length > 0 && packets.every(p => p.status === "completed") && !showExecutionInHero && (
        <TouchdownSection
          projectId={project.id}
          projectName={project.name}
          projectDescription={project.description}
          workingDirectory={getEffectiveWorkingDirectory(project)}
          packets={packets.map(p => ({
            id: p.id,
            title: p.title,
            description: p.description,
            type: p.type,
            priority: p.priority,
            status: p.status,
            tasks: p.tasks,
            acceptanceCriteria: p.acceptanceCriteria || []
          }))}
          onTouchdownComplete={() => {
            console.log("Touchdown completed!")
            // Refresh packets after touchdown
            const storedPackets = localStorage.getItem("claudia_packets")
            if (storedPackets) {
              try {
                const allPackets = JSON.parse(storedPackets)
                const projectPackets = allPackets[project.id] || []
                setPackets(projectPackets)
              } catch {
                console.error("Failed to parse packets")
              }
            }
            // Focus on Launch & Test section after touchdown
            setActiveSection("launch")
          }}
        />
      )}

      {/* ==================== READY TO BUILD SECTION ==================== */}
      {/* Only shows when there are packets ready to build OR execution is in progress */}
      {(packets.some(p => p.status === "ready" || p.status === "pending" || p.status === "queued") || showExecutionInHero || packets.length === 0) && (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-emerald-500" />
            Ready to Build
          </CardTitle>
          <CardDescription>
            Start your development workflow here - these tools guide you from planning to execution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* What's Next Section - Shows when queue is empty */}
          {packets.length === 0 && (
            <WhatsNextSection
              projectId={project.id}
              projectName={project.name}
              projectDescription={project.description}
              packets={packets}
              hasBuildPlan={hasBuildPlan}
              workingDirectory={getEffectiveWorkingDirectory(project)}
              onPacketCreated={(packetId) => {
                console.log("Packet created from What's Next:", packetId)
                const storedPackets = localStorage.getItem("claudia_packets")
                if (storedPackets) {
                  try {
                    const allPackets = JSON.parse(storedPackets)
                    const projectPackets = allPackets[project.id] || []
                    setPackets(projectPackets)
                  } catch {
                    console.error("Failed to parse packets")
                  }
                }
              }}
              onResetPackets={handleResetAllPackets}
            />
          )}

          {/* Start Build Hero OR Activity Monitor - Toggle between ready and executing states */}
          {showExecutionInHero ? (
            <Card className="border-2 border-purple-500/50 bg-gradient-to-br from-purple-500/10 via-blue-500/5 to-transparent">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/30">
                      <Activity className="h-6 w-6 text-purple-400" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Activity</CardTitle>
                      <CardDescription>Monitoring build progress in real-time</CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReturnToReady}
                    className="gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Back to Ready
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ExecutionPanel
                  ref={heroExecutionPanelRef}
                  project={{
                    id: project.id,
                    name: project.name,
                    description: project.description,
                    repos: project.repos,
                    basePath: project.basePath,
                    workingDirectory: project.workingDirectory
                  }}
                  packets={packets}
                  restoredSession={restoredSession}
                  onResetPackets={handleResetAllPackets}
                />
              </CardContent>
            </Card>
          ) : (
            <StartBuildHero
              projectId={project.id}
              projectName={project.name}
              packets={packets}
              hasBuildPlan={hasBuildPlan}
              buildPlanApproved={buildPlanApproved}
              isExecuting={isExecuting || showExecutionInHero}
              hasWorkingDirectory={!!(project.basePath || project.workingDirectory || project.repos.some(r => r.localPath))}
              onStartBuild={handleStartBuild}
            />
          )}

          {/* Analyze Existing Codebase - Shows when project has linked repos but no build plan */}
          <AnalyzeCodebaseButton
            projectId={project.id}
            projectName={project.name}
            projectDescription={project.description}
            hasLinkedRepo={project.repos.length > 0}
            repoPath={project.repos.find(r => r.localPath)?.localPath}
            repoCloned={project.repos.some(r => r.localPath)}
            hasBuildPlan={hasBuildPlan}
            onAnalysisComplete={() => {
              const buildPlan = getBuildPlanForProject(project.id)
              if (buildPlan) {
                setHasBuildPlan(true)
                setBuildPlanApproved(buildPlan.status === "approved" || buildPlan.status === "locked")
                setCurrentBuildPlan(buildPlan)
              }
              const storedPackets = localStorage.getItem("claudia_packets")
              if (storedPackets) {
                try {
                  const allPackets = JSON.parse(storedPackets)
                  const projectPackets = allPackets[project.id] || []
                  setPackets(projectPackets)
                } catch {
                  console.error("Failed to parse packets")
                }
              }
            }}
          />

        </CardContent>
      </Card>
      )}

      {/* ==================== SIDEBAR + CONTENT LAYOUT ==================== */}
      <div className="flex gap-6">
        {/* Sidebar Navigation */}
        <div className="w-48 flex-shrink-0">
          <div className="sticky top-6 space-y-1">
            {/* Primary Actions */}
            <button
              onClick={() => setActiveSection("overview")}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                activeSection === "overview"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <FileText className="h-4 w-4" />
              Overview
            </button>

            {/* Claude Code - PROMINENT */}
            <button
              onClick={() => setActiveSection("claude-code")}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors",
                activeSection === "claude-code"
                  ? "bg-purple-600 text-white"
                  : "bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30"
              )}
            >
              <Terminal className="h-4 w-4" />
              Claude Code
            </button>

            <button
              onClick={() => setActiveSection("models")}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                activeSection === "models"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <Brain className="h-4 w-4" />
              AI Models
            </button>

            {/* Build Plan */}
            <button
              onClick={() => setActiveSection("build-plan")}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                activeSection === "build-plan"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <FileText className="h-4 w-4" />
              Build Plan
            </button>

            {/* Work Packets */}
            <button
              onClick={() => setActiveSection("packets")}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                activeSection === "packets"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <Package className="h-4 w-4" />
              Work Packets
              {packets.length > 0 && (
                <span className="ml-auto text-xs opacity-70">({packets.length})</span>
              )}
            </button>

            {/* Divider */}
            <div className="my-2 border-t border-border/50" />

            {/* Secondary Navigation */}
            <button
              onClick={() => setActiveSection("repos")}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                activeSection === "repos"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <GitBranch className="h-4 w-4" />
              Repos
              {project.repos.length > 0 && (
                <span className="ml-auto text-xs opacity-70">({project.repos.length})</span>
              )}
            </button>
            <button
              onClick={() => setActiveSection("files")}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                activeSection === "files"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <FolderOpen className="h-4 w-4" />
              Files
            </button>
            <button
              onClick={() => setActiveSection("docs")}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                activeSection === "docs"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <BookOpen className="h-4 w-4" />
              Docs
            </button>
            <button
              onClick={() => setActiveSection("uploads")}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                activeSection === "uploads"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <Upload className="h-4 w-4" />
              Uploads
              {resourceCount > 0 && (
                <span className="ml-auto text-xs opacity-70">({resourceCount})</span>
              )}
            </button>

            {/* Divider */}
            <div className="my-2 border-t border-border/50" />

            {/* Additional Sections */}
            <button
              onClick={() => setActiveSection("interview")}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                activeSection === "interview"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <MessageSquare className="h-4 w-4" />
              Interview
              {project.creationInterview && (
                <Sparkles className="h-3 w-3 ml-auto" />
              )}
            </button>
            <button
              onClick={() => setActiveSection("business")}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                activeSection === "business"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <DollarSign className="h-4 w-4" />
              Business
            </button>
            <button
              onClick={() => setActiveSection("security")}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                activeSection === "security"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <Shield className="h-4 w-4" />
              Security
            </button>
            <button
              onClick={() => setActiveSection("launch")}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                activeSection === "launch"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <Play className="h-4 w-4" />
              Launch & Test
            </button>
            <button
              onClick={() => setActiveSection("run-history")}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                activeSection === "run-history"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <Activity className="h-4 w-4" />
              Run History
            </button>

            {/* Divider */}
            <div className="my-2 border-t border-border/50" />

            {/* Settings */}
            <button
              onClick={() => setActiveSection("settings")}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                activeSection === "settings"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Overview Section */}
          {activeSection === "overview" && (
            <Card className="border rounded-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-500" />
                  Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
            {/* Vision Display - Shows game/creative vision prominently */}
            <VisionDisplay projectId={project.id} />

            {/* Project Timeline */}
            <ProjectTimeline
              projectId={project.id}
              projectStatus={project.status}
            />

            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Linked Repos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{project.repos.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Active Packets
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{packets.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Created
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-medium">
                    {new Date(project.createdAt).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tags */}
            {project.tags.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Tags</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {project.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant={tag === "created-from-voice" ? "default" : "outline"}
                        className={tag === "created-from-voice" ? "bg-blue-500/20 text-blue-500 border-blue-500/30" : undefined}
                      >
                        {tag === "created-from-voice" ? (
                          <span className="flex items-center gap-1">
                            <Mic className="h-3 w-3" />
                            Created from Voice
                          </span>
                        ) : (
                          tag
                        )}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Project Folder Path (Read-only) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Project Folder
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <code className="text-sm bg-muted px-2 py-1 rounded block font-mono overflow-x-auto">
                  {project.basePath || getEffectiveWorkingDirectory(project) || <span className="text-muted-foreground italic">~/claudia-projects/{project.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}</span>}
                </code>
                <p className="text-xs text-muted-foreground">
                  The folder containing your project files. This is automatically managed by Claudia Coder.
                </p>
              </CardContent>
            </Card>

            {/* Linear Sync */}
            {project.linearSync && project.linearSync.mode !== "none" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Linear Sync
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={project.linearSync.mode === "two_way" ? "default" : "secondary"}>
                      {project.linearSync.mode === "two_way" ? "Two-Way Sync" : "Imported"}
                    </Badge>
                    {project.linearSync.lastSyncAt && (
                      <span className="text-sm text-muted-foreground">
                        Last synced: {new Date(project.linearSync.lastSyncAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  {project.linearSync.syncErrors && project.linearSync.syncErrors.length > 0 && (
                    <div className="text-sm text-destructive">
                      {project.linearSync.syncErrors.join(", ")}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Interview Summary */}
            {project.creationInterview && project.creationInterview.summary && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Interview Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm">{project.creationInterview.summary}</p>
                  {project.creationInterview.keyPoints && project.creationInterview.keyPoints.length > 0 && (
                    <ul className="text-sm space-y-1">
                      {project.creationInterview.keyPoints.map((point, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-primary">•</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}
              </CardContent>
            </Card>
          )}

          {/* Claude Code Section - PROMINENT */}
          {activeSection === "claude-code" && (
            <Card className="border-purple-500/30 border rounded-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="h-5 w-5 text-purple-500" />
                  Claude Code
                </CardTitle>
                <CardDescription>
                  Start an AI-powered development session using Claude Code. This is the primary way to build your project.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Quick Launch Button */}
                {!claudeCodeStarted ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-purple-600/10 border border-purple-500/30">
                      <h3 className="font-medium mb-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-purple-400" />
                        Ready to Build
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Claude Code provides an interactive terminal experience with AI assistance for coding tasks.
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={handleStartClaudeCode}
                          disabled={claudeCodeLoading}
                          className="bg-purple-600 hover:bg-purple-500 gap-2"
                        >
                          {claudeCodeLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Terminal className="h-4 w-4" />
                          )}
                          Start Claude Code Session
                        </Button>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={bypassPermissions}
                            onChange={(e) => setBypassPermissions(e.target.checked)}
                            className="rounded"
                          />
                          Bypass permissions
                        </label>
                      </div>
                      {claudeCodeError && (
                        <p className="text-sm text-red-500 mt-2">{claudeCodeError}</p>
                      )}
                    </div>

                    {/* Working Directory Info */}
                    {project.workingDirectory && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Working Directory: </span>
                        <code className="bg-muted px-2 py-0.5 rounded text-xs">{project.workingDirectory}</code>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                        Session Active
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setClaudeCodeStarted(false)}
                      >
                        Stop Session
                      </Button>
                    </div>
                    <ClaudeCodeTerminal
                      key={claudeCodeKey}
                      projectId={project.id}
                      projectName={project.name}
                      projectDescription={project.description}
                      workingDirectory={claudeCodeWorkDir || getEffectiveWorkingDirectory(project)}
                      bypassPermissions={bypassPermissions}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* AI Models Section */}
          {activeSection === "models" && (
            <Card className="border rounded-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-pink-500" />
                  AI Models
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ModelAssignment projectId={project.id} />
              </CardContent>
            </Card>
          )}

          {/* Repositories Section */}
          {activeSection === "repos" && (
            <Card className="border rounded-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5 text-orange-500" />
                  Repositories
                  {project.repos.length > 0 && (
                    <span className="text-xs text-muted-foreground ml-2">({project.repos.length})</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Linked Repositories</h3>
                  <Button size="sm" onClick={() => setRepoBrowserOpen(true)}>
                    <Link2 className="h-4 w-4 mr-1" />
                    Link Repository
                  </Button>
                </div>

                {project.repos.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <GitBranch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No repositories linked yet.</p>
                      <Button className="mt-4" size="sm" onClick={() => setRepoBrowserOpen(true)}>
                        <Link2 className="h-4 w-4 mr-1" />
                        Link Your First Repository
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {project.repos.map((repo) => (
                      <Card key={repo.id}>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <GitBranch className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <p className="font-medium">{repo.name}</p>
                                <p className="text-sm text-muted-foreground">{repo.path}</p>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {repo.provider}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm" asChild>
                                <a href={repo.url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Unlink className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          {/* Local Path Section (Read-only) */}
                          <div className="flex items-center gap-2 pl-8 border-t pt-3">
                            <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm text-muted-foreground flex-shrink-0">Local Path:</span>
                            <div className="flex items-center gap-2 flex-1">
                              {repo.localPath ? (
                                <code className="text-sm bg-muted px-2 py-1 rounded flex-1 font-mono">
                                  {repo.localPath}
                                </code>
                              ) : project.basePath ? (
                                <code className="text-sm bg-green-500/10 text-green-600 px-2 py-1 rounded flex-1 font-mono">
                                  {project.basePath.replace(/\/+$/, "")}/repos/{repo.name}
                                  <span className="text-muted-foreground ml-2">(auto-mapped)</span>
                                </code>
                              ) : (
                                <code className="text-sm bg-muted px-2 py-1 rounded flex-1 font-mono text-muted-foreground">
                                  ~/claudia-projects/{project.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}/repos/{repo.name}
                                </code>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Browse Files Section */}
          {activeSection === "files" && (
            <Card className="border rounded-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-yellow-500" />
                  Browse Files
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FileBrowser
                  projectId={project.id}
                  projectName={project.name}
                  basePath={project.basePath || getEffectiveWorkingDirectory(project)}
                />
              </CardContent>
            </Card>
          )}

          {/* Documentation Section */}
          {activeSection === "docs" && (
            <Card className="border rounded-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-orange-500" />
                  Documentation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <DocsBrowser
                  projectId={project.id}
                  workingDirectory={getEffectiveWorkingDirectory(project) || ""}
                />
              </CardContent>
            </Card>
          )}

          {/* Interview Section */}
          {activeSection === "interview" && (
            <Card className="border rounded-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-indigo-500" />
                  Interviews
                  {projectInterviews.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {projectInterviews.length}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Conduct interviews to discuss features, get feedback, or refine your project
                </CardDescription>
              </CardHeader>
              <CardContent>
                <InterviewList
                  projectId={project.id}
                  interviews={projectInterviews}
                  combinedInsights={combinedInsights || undefined}
                  onStartNew={handleStartNewInterview}
                  onContinue={handleContinueInterview}
                  onDelete={handleDeleteInterview}
                  onView={handleViewInterview}
                  onRegenerateBuildPlan={handleRegenerateBuildPlan}
                  isRegenerating={isRegeneratingBuildPlan}
                />
              </CardContent>
            </Card>
          )}

          {/* Business Dev Section - Combined with Prior Art */}
          {activeSection === "business" && (
            <Card className="border rounded-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-500" />
                  Business Dev
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Prior Art / Market Research */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <Search className="h-4 w-4 text-cyan-500" />
                    Prior Art & Market Research
                  </h3>
                  <PriorArtSection
                    projectId={project.id}
                    projectName={project.name}
                    projectDescription={project.description}
                    buildPlanObjectives={currentBuildPlan?.originalPlan?.spec?.objectives}
                    techStack={currentBuildPlan?.originalPlan?.spec?.techStack}
                  />
                </div>

                {/* Divider */}
                <div className="border-t" />

                {/* Business Development */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-500" />
                    Business Planning
                  </h3>
                  <BusinessDevSection
                    projectId={project.id}
                    projectName={project.name}
                    projectDescription={project.description}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Security Section */}
          {activeSection === "security" && (
            <Card className="border rounded-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-red-500" />
                  Security
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Card>
                  <CardContent className="p-12 text-center">
                    <Shield className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Red Team Security Scanner</h3>
                    <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                      Automated security scanning of all project files and scripts.
                      Identifies vulnerabilities, code smells, and security risks.
                    </p>
                    <Badge variant="secondary" className="text-base px-4 py-1">
                      Coming Soon
                    </Badge>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          )}

          {/* Launch & Test Section */}
          {activeSection === "launch" && (
            <Card className="border rounded-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-blue-500" />
                  Launch & Test
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <LaunchTestPanel
                  project={{
                    id: project.id,
                    name: project.name,
                    description: project.description,
                    workingDirectory: getEffectiveWorkingDirectory(project),
                    repos: project.repos
                  }}
                />
              </CardContent>
            </Card>
          )}

          {/* Run History Section */}
          {activeSection === "run-history" && (
            <Card className="border rounded-lg">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-purple-500" />
                    Run History
                    {runHistory.length > 0 && (
                      <span className="text-xs text-muted-foreground ml-2">({runHistory.length})</span>
                    )}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => refetchRunHistory()}
                    disabled={runHistoryLoading}
                  >
                    <RefreshCw className={cn("h-4 w-4", runHistoryLoading && "animate-spin")} />
                  </Button>
                </div>
                <CardDescription>
                  Execution history for this project
                </CardDescription>
              </CardHeader>
              <CardContent>
                {runHistoryLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : runHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>No runs yet</p>
                    <p className="text-sm mt-1">Execute work packets to see history here</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {runHistory.map((run: RunHistorySummary) => (
                      <div
                        key={run.id}
                        className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                      >
                        {/* Status indicator */}
                        <div className={cn(
                          "flex items-center justify-center w-8 h-8 rounded-full",
                          run.status === "complete" ? "bg-green-500/10" :
                          run.status === "error" ? "bg-red-500/10" :
                          run.status === "running" ? "bg-blue-500/10" :
                          "bg-amber-500/10"
                        )}>
                          {run.status === "complete" ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : run.status === "error" ? (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          ) : run.status === "running" ? (
                            <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          )}
                        </div>

                        {/* Run info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {run.packetCount} packet{run.packetCount !== 1 ? "s" : ""}
                            </span>
                            <span className="text-xs text-green-500">{run.successCount} passed</span>
                            {run.failedCount > 0 && (
                              <span className="text-xs text-red-500">{run.failedCount} failed</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            Started {new Date(run.startedAt).toLocaleString()}
                          </p>
                        </div>

                        {/* Duration */}
                        {run.duration && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {Math.floor(run.duration / 60000)}m {Math.floor((run.duration % 60000) / 1000)}s
                          </div>
                        )}

                        {/* Status badge */}
                        <Badge variant={
                          run.status === "complete" ? "default" :
                          run.status === "error" ? "destructive" :
                          run.status === "running" ? "secondary" :
                          "outline"
                        }>
                          {run.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Resources/User Uploads Section */}
          {activeSection === "uploads" && (
            <Card className="border rounded-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-teal-500" />
                  User Uploads
                  {resourceCount > 0 && (
                    <span className="text-xs text-muted-foreground ml-2">({resourceCount})</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
            {/* File Uploads Section */}
            <ResourceUpload
              projectId={project.id}
              onUploadComplete={() => refreshResourceCount()}
            />

            {/* Brain Dumps Section - between upload and list */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Voice Brain Dumps
                </span>
              </div>
            </div>

            {isRecordingBrainDump ? (
              <AudioRecorder
                projectId={project.id}
                projectName={project.name}
                projectDescription={project.description}
                onRecordingComplete={handleBrainDumpRecorded}
                onPacketsApproved={handleBrainDumpPacketsApproved}
                onCancel={() => setIsRecordingBrainDump(false)}
                existingProjectContext={{
                  hasBuildPlan: hasBuildPlan,
                  hasPackets: packets.length > 0,
                  currentPhase: currentBuildPlan?.originalPlan?.phases?.[0]?.name
                }}
              />
            ) : (
              <BrainDumpList
                projectId={project.id}
                onSelect={(brainDumpId) => {
                  // TODO: Open brain dump review modal
                  console.log("View brain dump:", brainDumpId)
                }}
                onStartNew={() => setIsRecordingBrainDump(true)}
              />
            )}

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Uploaded Files
                </span>
              </div>
            </div>

            {/* Resource List */}
            <ResourceList
              projectId={project.id}
              projectName={project.name}
              projectDescription={project.description}
              onPacketCreate={(transcription, resource) => {
                console.log("Packet created from transcription:", resource.name)
                // Refresh packets list
                const storedPackets = localStorage.getItem("claudia_packets")
                if (storedPackets) {
                  try {
                    const allPackets = JSON.parse(storedPackets)
                    const projectPackets = allPackets[project.id] || []
                    setPackets(projectPackets)
                  } catch {
                    console.error("Failed to parse packets")
                  }
                }
              }}
              onMarkdownPacketsCreated={(packets) => {
                console.log("Packets created from markdown:", packets.length)
                // Refresh packets list
                const storedPackets = localStorage.getItem("claudia_packets")
                if (storedPackets) {
                  try {
                    const allPackets = JSON.parse(storedPackets)
                    const projectPackets = allPackets[project.id] || []
                    setPackets(projectPackets)
                  } catch {
                    console.error("Failed to parse packets")
                  }
                }
              }}
            />
              </CardContent>
            </Card>
          )}

          {/* Build Plan Section */}
          {activeSection === "build-plan" && (
            <Card className="border-blue-500/30 border rounded-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-500" />
                  Build Plan
                </CardTitle>
                <CardDescription>
                  {project.status === "planning"
                    ? "Create and approve your build plan before starting execution. Once approved, change status to Active to begin."
                    : "Your project's development roadmap and architecture"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BuildPlanEditor
                  projectId={project.id}
                  projectName={project.name}
                  projectDescription={project.description}
                  projectStatus={project.status}
                  workingDirectory={getEffectiveWorkingDirectory(project)}
                  providers={providers}
                  selectedProvider={selectedProvider}
                  onProviderChange={setSelectedProvider}
                  onKickoffGenerated={(kickoffPath) => {
                    console.log(`[project-page] KICKOFF.md generated at: ${kickoffPath}`)
                  }}
                />
              </CardContent>
            </Card>
          )}

          {/* Work Packets Section */}
          {activeSection === "packets" && (
            <Card className="border-purple-500/30 border rounded-lg">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-purple-500" />
                      Work Packets
                      {packets.length > 0 && (
                        <Badge variant="secondary" className="ml-2">{packets.length}</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Discrete units of work to be processed by AI agents
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Concurrency Selector */}
                    <Select
                      value={showCustomInput ? "custom" : concurrency === (packets.length || 10) ? "all" : String(concurrency)}
                      onValueChange={handleConcurrencyChange}
                      disabled={isBatchExecuting}
                    >
                      <SelectTrigger className="w-[140px] h-9">
                        <SelectValue placeholder="Concurrency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 (Sequential)</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="3">3</SelectItem>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="all">All (Parallel)</SelectItem>
                        <SelectItem value="custom">Custom...</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Custom Concurrency Input */}
                    {showCustomInput && (
                      <Input
                        type="number"
                        min="1"
                        max="50"
                        value={customConcurrency}
                        onChange={(e) => setCustomConcurrency(e.target.value)}
                        placeholder="N"
                        className="w-[70px] h-9"
                        disabled={isBatchExecuting}
                      />
                    )}

                    {/* Reset All Packets Button - shows when there are completed packets */}
                    {completedPackets.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleResetAllPackets}
                        disabled={isBatchExecuting}
                        className="gap-2"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Reset All ({completedPackets.length})
                      </Button>
                    )}

                    {/* Run All Packets Button */}
                    <Button
                      size="sm"
                      variant="default"
                      onClick={handleRunAllPackets}
                      disabled={pendingPackets.length === 0 || isBatchExecuting}
                      className="gap-2"
                    >
                      {isBatchExecuting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Running {batchProgress.current}/{batchProgress.total}
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" />
                          Run All ({pendingPackets.length})
                        </>
                      )}
                    </Button>

                    <Button size="sm" variant="outline" onClick={() => setCreatingPacket(true)}>
                      <Package className="h-4 w-4 mr-1" />
                      Create Packet
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Batch Execution Progress */}
                {isBatchExecuting && (
                  <Card className="border-primary/30 bg-primary/5">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            <span className="font-medium">
                              Running packet {batchProgress.current} of {batchProgress.total}
                            </span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {Math.round((batchProgress.current / batchProgress.total) * 100)}%
                          </span>
                        </div>
                        {/* Progress Bar */}
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{
                              width: `${(batchProgress.current / batchProgress.total) * 100}%`
                            }}
                          />
                        </div>
                        {/* Show current packet being processed */}
                        {batchProgress.current > 0 && batchProgress.current <= pendingPackets.length && (
                          <p className="text-sm text-muted-foreground">
                            Processing: {pendingPackets[batchProgress.current - 1]?.title || "..."}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {packets.length === 0 ? (
                  <div className="p-8 text-center border rounded-lg border-dashed">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No packets created yet.</p>
                    <Button className="mt-4" size="sm" onClick={() => setCreatingPacket(true)}>
                      <Package className="h-4 w-4 mr-1" />
                      Create Your First Packet
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-6">
                    {/* Packet List */}
                    <div className={cn(
                      "transition-all duration-300",
                      selectedPacketId ? "w-1/2" : "w-full"
                    )}>
                      <div className="border rounded-lg divide-y">
                        {packets.map((packet) => {
                          const isExecuting = executingPacketId === packet.id
                          const isSelected = selectedPacketId === packet.id
                          const completedTasks = packet.tasks.filter(t => t.completed).length
                          const totalTasks = packet.tasks.length

                          return (
                            <div
                              key={packet.id}
                              className={cn(
                                "flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer transition-colors",
                                isSelected && "bg-primary/5"
                              )}
                              onClick={() => setSelectedPacketId(
                                selectedPacketId === packet.id ? null : packet.id
                              )}
                            >
                              {/* Left side: packet info */}
                              <div className="flex items-center gap-4 flex-1 min-w-0">
                                {/* Status indicator */}
                                {packet.status === "completed" ? (
                                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                                ) : (
                                  <div className={cn(
                                    "w-2 h-2 rounded-full flex-shrink-0",
                                    packet.status === "in_progress" && "bg-blue-500 animate-pulse",
                                    packet.status === "failed" && "bg-red-500",
                                    packet.status === "pending" && "bg-muted-foreground"
                                  )} />
                                )}

                                {/* Title and description */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium truncate">{packet.title}</span>
                                    <Badge variant="outline" className="text-xs flex-shrink-0">
                                      {packet.type}
                                    </Badge>
                                    <Badge
                                      variant={
                                        packet.priority === "critical" ? "destructive" :
                                        packet.priority === "high" ? "default" :
                                        "secondary"
                                      }
                                      className="text-xs flex-shrink-0"
                                    >
                                      {packet.priority}
                                    </Badge>
                                    {/* Status badge */}
                                    <Badge
                                      variant={
                                        packet.status === "completed" ? "default" :
                                        packet.status === "in_progress" ? "default" :
                                        packet.status === "blocked" ? "destructive" :
                                        "secondary"
                                      }
                                      className={cn(
                                        "text-xs flex-shrink-0",
                                        packet.status === "completed" && "bg-green-500/20 text-green-600 border-green-500/30",
                                        packet.status === "in_progress" && "bg-blue-500/20 text-blue-600 border-blue-500/30",
                                        packet.status === "blocked" && "bg-red-500/20 text-red-600 border-red-500/30"
                                      )}
                                    >
                                      {packet.status === "completed" ? "Completed" :
                                       packet.status === "in_progress" ? "Running" :
                                       packet.status === "blocked" ? "Blocked" :
                                       packet.status === "review" ? "Review" :
                                       packet.status === "assigned" ? "Assigned" :
                                       "Ready"}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground truncate mt-0.5">
                                    {packet.description}
                                  </p>
                                </div>

                                {/* Task progress */}
                                {totalTasks > 0 && (
                                  <div className="text-sm text-muted-foreground flex-shrink-0">
                                    {completedTasks}/{totalTasks} tasks
                                  </div>
                                )}
                              </div>

                              {/* Right side: action buttons */}
                              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                                {/* Edit button */}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleEditPacket(packet.id)
                                  }}
                                  title="Edit packet"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>

                                {/* Start/Stop button */}
                                {isExecuting ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleStopPacket(packet.id)
                                    }}
                                  >
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Running...
                                  </Button>
                                ) : packet.status === "completed" ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleStartPacket(packet.id)
                                    }}
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                    Rerun
                                  </Button>
                                ) : (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="gap-2 bg-green-600 hover:bg-green-500"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleStartPacket(packet.id)
                                    }}
                                  >
                                    <Play className="h-4 w-4" />
                                    Start
                                  </Button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Detail Panel - shows when a packet is selected */}
                    {selectedPacketId && selectedPacket && (
                      <div className="w-1/2 space-y-4">
                        <Card>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg">{selectedPacket.title}</CardTitle>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedPacketId(null)
                                  setSelectedRun(null)
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {selectedPacket.description}
                            </p>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {/* Execution History */}
                            <div>
                              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                Execution History
                              </h4>
                              <PacketHistory
                                runs={selectedPacketRuns}
                                onSelectRun={handleSelectRun}
                                selectedRunId={selectedRun?.id}
                                className="max-h-[200px]"
                              />
                            </div>

                            {/* Selected Run Output */}
                            {selectedRun && (
                              <div className="space-y-3">
                                <PacketOutput
                                  run={selectedRun}
                                  onClose={() => setSelectedRun(null)}
                                />

                                {/* Feedback Section */}
                                {selectedRun.status !== "running" && (
                                  <PacketFeedback
                                    run={selectedRun}
                                    onFeedback={(rating, comment) =>
                                      handlePacketFeedback(selectedRun, rating, comment)
                                    }
                                  />
                                )}
                              </div>
                            )}

                            {/* No runs yet message */}
                            {selectedPacketRuns.length === 0 && !selectedRun && (
                              <div className="text-center py-8 text-muted-foreground">
                                <Play className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No execution history yet</p>
                                <p className="text-xs mt-1">Click &quot;Start&quot; on a packet row to begin</p>
                              </div>
                            )}

                            {/* Execution error */}
                            {executionError && executingPacketId === selectedPacketId && (
                              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                                <div className="flex items-center gap-2">
                                  <AlertCircle className="h-4 w-4" />
                                  <span className="font-medium">Execution Error</span>
                                </div>
                                <p className="mt-1">{executionError}</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Settings Section */}
          {activeSection === "settings" && (
            <Card className="border rounded-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-muted-foreground" />
                  Project Settings
                </CardTitle>
                <CardDescription>
                  Manage project configuration and maintenance tasks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Working Directory */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Working Directory</h4>
                  <p className="text-sm text-muted-foreground">
                    {getEffectiveWorkingDirectory(project) || "Not configured"}
                  </p>
                </div>

                {/* Clear Generated Code */}
                <div className="border-t pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Trash2 className="h-4 w-4 text-red-500" />
                        Clear Generated Code
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Delete all AI-generated code while preserving documentation and configuration.
                        Use this to start fresh or regenerate from packets.
                      </p>
                      <div className="text-xs text-muted-foreground mt-2 space-y-1">
                        <p><span className="text-green-500">Preserved:</span> docs/, .claudia/, *.md files, .env files, resources/, brain-dumps/</p>
                        <p><span className="text-red-500">Deleted:</span> src/, lib/, components/, app/, node_modules/, build/, etc.</p>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleOpenClearGenerated}
                      disabled={!getEffectiveWorkingDirectory(project)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear Generated Code
                    </Button>
                  </div>
                </div>

                {/* Base Path Configuration */}
                <div className="border-t pt-6">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Base Path</h4>
                    <p className="text-sm text-muted-foreground">
                      {project.basePath || "Using default path"}
                    </p>
                    {editingBasePath ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={newBasePath}
                          onChange={(e) => setNewBasePath(e.target.value)}
                          placeholder="/path/to/projects"
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={() => {
                            if (project) {
                              updateProject(project.id, { basePath: newBasePath }, user?.id)
                              refreshProject()
                            }
                            setEditingBasePath(false)
                          }}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingBasePath(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setNewBasePath(project.basePath || "")
                          setEditingBasePath(true)
                        }}
                      >
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit Base Path
                      </Button>
                    )}
                  </div>
                </div>

                {/* MCP Server Configuration */}
                <div className="border-t pt-6">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Server className="h-4 w-4 text-primary" />
                      MCP Servers
                    </h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Configure which MCP (Model Context Protocol) servers are available during execution.
                    </p>
                    <MCPSettings
                      projectId={project.id}
                      projectTags={project.tags}
                      currentSettings={project.mcpSettings}
                      onSettingsChange={handleMCPSettingsChange}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        {/* End of Content Area */}
      </div>
      {/* End of Sidebar + Content Layout */}

      {/* Repo Browser Modal */}
      <RepoBrowser
        open={repoBrowserOpen}
        onOpenChange={setRepoBrowserOpen}
        projectId={project.id}
        linkedRepos={project.repos}
        onRepoLinked={() => refreshProject()}
        workingDirectory={getEffectiveWorkingDirectory(project)}
        basePath={project.basePath || project.workingDirectory || getEffectiveWorkingDirectory(project)}
      />

      {/* Quick Comment FAB */}
      <QuickComment
        projectId={project.id}
        projectName={project.name}
        onPacketCreated={(packetId) => {
          console.log("Packet created from comment:", packetId)
          // Refresh packets list
          const storedPackets = localStorage.getItem("claudia_packets")
          if (storedPackets) {
            try {
              const allPackets = JSON.parse(storedPackets)
              const projectPackets = allPackets[project.id] || []
              setPackets(projectPackets)
            } catch {
              console.error("Failed to parse packets")
            }
          }
        }}
        onCommentAdded={(comment) => {
          console.log("Comment added:", comment)
        }}
      />

      {/* Edit Packet Dialog */}
      <Dialog open={!!editingPacket} onOpenChange={(open) => !open && setEditingPacket(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Work Packet</DialogTitle>
            <DialogDescription>
              Make changes to the work packet details below.
            </DialogDescription>
          </DialogHeader>
          {editingPacket && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={editingPacket.title}
                  onChange={(e) => setEditingPacket({ ...editingPacket, title: e.target.value })}
                  placeholder="Packet title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editingPacket.description}
                  onChange={(e) => setEditingPacket({ ...editingPacket, description: e.target.value })}
                  placeholder="Packet description"
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-priority">Priority</Label>
                <Select
                  value={editingPacket.priority}
                  onValueChange={(value) => setEditingPacket({ ...editingPacket, priority: value })}
                >
                  <SelectTrigger id="edit-priority">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPacket(null)}>
              Cancel
            </Button>
            <Button onClick={handleSavePacketEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Packet Confirmation Dialog */}
      <Dialog open={!!deletePacketId} onOpenChange={(open) => !open && setDeletePacketId(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Work Packet</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this work packet? This action cannot be undone.
              All associated execution history will also be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletePacketId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDeletePacket}>
              Delete Packet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Packet Dialog */}
      <Dialog open={creatingPacket} onOpenChange={(open) => {
        if (!open) {
          setCreatingPacket(false)
          setNewPacket({ title: '', description: '', priority: 'medium', type: 'feature' })
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Work Packet</DialogTitle>
            <DialogDescription>
              Add a new work packet to be processed by the AI. Each packet represents a discrete unit of work.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-title">Title</Label>
              <Input
                id="new-title"
                placeholder="e.g., Implement user authentication"
                value={newPacket.title}
                onChange={(e) => setNewPacket({ ...newPacket, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-description">Description</Label>
              <Textarea
                id="new-description"
                placeholder="Describe the work to be done in detail..."
                rows={4}
                value={newPacket.description}
                onChange={(e) => setNewPacket({ ...newPacket, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-type">Type</Label>
                <Select
                  value={newPacket.type}
                  onValueChange={(value) => setNewPacket({ ...newPacket, type: value })}
                >
                  <SelectTrigger id="new-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feature">Feature</SelectItem>
                    <SelectItem value="bugfix">Bug Fix</SelectItem>
                    <SelectItem value="refactor">Refactor</SelectItem>
                    <SelectItem value="test">Test</SelectItem>
                    <SelectItem value="docs">Documentation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-priority">Priority</Label>
                <Select
                  value={newPacket.priority}
                  onValueChange={(value) => setNewPacket({ ...newPacket, priority: value })}
                >
                  <SelectTrigger id="new-priority">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCreatingPacket(false)
              setNewPacket({ title: '', description: '', priority: 'medium', type: 'feature' })
            }}>
              Cancel
            </Button>
            <Button onClick={handleCreatePacket} disabled={!newPacket.title.trim()}>
              Create Packet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear Generated Code Confirmation Dialog */}
      <Dialog open={showClearGenerated} onOpenChange={(open) => {
        if (!open) {
          setShowClearGenerated(false)
          setClearGeneratedPreview(null)
          setClearGeneratedError(null)
        }
      }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              Clear Generated Code
            </DialogTitle>
            <DialogDescription>
              This will permanently delete all AI-generated code from the working directory.
              Documentation and configuration files will be preserved.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {clearGeneratedError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Error</span>
                </div>
                <p className="mt-1">{clearGeneratedError}</p>
              </div>
            )}

            {!clearGeneratedPreview && !clearGeneratedError && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {clearGeneratedPreview && (
              <div className="grid grid-cols-2 gap-4">
                {/* Will be deleted */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-red-500 flex items-center gap-1">
                    <Trash2 className="h-4 w-4" />
                    Will be deleted ({clearGeneratedPreview.deleted.length})
                  </h4>
                  <div className="max-h-[200px] overflow-y-auto border rounded-lg p-2 bg-red-500/5">
                    {clearGeneratedPreview.deleted.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No generated files to delete</p>
                    ) : (
                      <ul className="text-sm space-y-1">
                        {clearGeneratedPreview.deleted.map((item) => (
                          <li key={item} className="text-red-400 flex items-center gap-1">
                            <X className="h-3 w-3" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Will be preserved */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-green-500 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" />
                    Will be preserved ({clearGeneratedPreview.preserved.length})
                  </h4>
                  <div className="max-h-[200px] overflow-y-auto border rounded-lg p-2 bg-green-500/5">
                    {clearGeneratedPreview.preserved.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No files to preserve</p>
                    ) : (
                      <ul className="text-sm space-y-1">
                        {clearGeneratedPreview.preserved.map((item) => (
                          <li key={item} className="text-green-400 flex items-center gap-1">
                            <Check className="h-3 w-3" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowClearGenerated(false)
                setClearGeneratedPreview(null)
                setClearGeneratedError(null)
              }}
              disabled={isClearingGenerated}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmClearGenerated}
              disabled={isClearingGenerated || !clearGeneratedPreview || clearGeneratedPreview.deleted.length === 0}
            >
              {isClearingGenerated ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear {clearGeneratedPreview?.deleted.length || 0} Items
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MessageBubble({ message }: { message: InterviewMessage }) {
  return (
    <div className={cn(
      "flex gap-3",
      message.role === "user" && "flex-row-reverse"
    )}>
      <div className={cn(
        "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
        message.role === "user" ? "bg-primary" : "bg-muted"
      )}>
        {message.role === "user" ? (
          <User className="h-4 w-4 text-primary-foreground" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>
      <div className={cn(
        "max-w-[80%] rounded-2xl px-4 py-3",
        message.role === "user"
          ? "bg-primary text-primary-foreground"
          : "bg-muted"
      )}>
        <p className="text-sm">{message.content}</p>
        {message.transcribedFrom === "voice" && (
          <div className="flex items-center gap-1 mt-1 opacity-60">
            <Mic className="h-3 w-3" />
            <span className="text-xs">voice</span>
          </div>
        )}
        {message.skipped && (
          <Badge variant="outline" className="mt-1 text-xs">skipped</Badge>
        )}
      </div>
    </div>
  )
}
