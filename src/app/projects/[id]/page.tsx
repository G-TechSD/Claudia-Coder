"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
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
  Settings
} from "lucide-react"
import { getProject, updateProject, trashProject, restoreProject, seedSampleProjects, updateRepoLocalPath, toggleProjectStar, getEffectiveWorkingDirectory } from "@/lib/data/projects"
import { useStarredProjects } from "@/hooks/useStarredProjects"
import { useProjectExport } from "@/hooks/useProjectExport"
import { useAuth } from "@/components/auth/auth-provider"
import { getResourcesForProject, getBrainDumpsForProject } from "@/lib/data/resources"
import { PacketCard, type Packet } from "@/components/packets/packet-card"
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
import { FolderInitializer } from "@/components/project/folder-initializer"
import { BrainDumpList } from "@/components/brain-dump/brain-dump-list"
import { AudioRecorder } from "@/components/brain-dump/audio-recorder"
import { ExecutionPanel, LaunchTestPanel, type ExecutionPanelRef, type RestoredSession } from "@/components/execution"
import { ClaudeCodeTerminal } from "@/components/claude-code/terminal"
import { ClaudiaSyncStatus } from "@/components/project/claudia-sync-status"
import { BusinessDevSection } from "@/components/project/business-dev-section"
import { PriorArtSection } from "@/components/project/prior-art-section"
import { DocsBrowser } from "@/components/project/docs-browser"
import { VisionDisplay } from "@/components/project/vision-display"
import { FileBrowser } from "@/components/project/file-browser"
import { QuickComment } from "@/components/project/quick-comment"
import { AnalyzeCodebaseButton } from "@/components/project/analyze-codebase-button"
import { WhatsNextSection } from "@/components/project/whats-next-section"
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
import type { Project, ProjectStatus, InterviewMessage, StoredBuildPlan } from "@/lib/data/types"

interface ProviderOption {
  name: string
  displayName: string
  status: "online" | "offline" | "checking" | "not-configured"
  model?: string
  type: "local" | "cloud"
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

  // Navigation state
  const [activeTab, setActiveTab] = useState("overview")
  const [showAdvanced, setShowAdvanced] = useState(false)

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

  // Ref for ExecutionPanel to trigger execution programmatically
  const executionPanelRef = useRef<ExecutionPanelRef>(null)

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
    // Ensure sample data is seeded (important for direct navigation to this page)
    seedSampleProjects()

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
  }, [projectId])

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
            type: "local" | "cloud"
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

          // Auto-select provider: prefer online local, then online cloud, then anthropic as fallback
          const onlineLocal = providerOptions.find(p => p.status === "online" && p.type === "local")
          const onlineCloud = providerOptions.find(p => p.status === "online" && p.type === "cloud")
          const anthropicProvider = providerOptions.find(p => p.name === "anthropic")
          const defaultProvider = onlineLocal || onlineCloud || anthropicProvider
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
  }, [projectId, packets, user?.id])

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

  // Get pending packets count for the "Run All" button
  const pendingPackets = packets.filter(p => p.status !== "completed")

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

  // Handler for Start Build hero - opens packets accordion, scrolls to execution panel, and triggers GO
  const handleStartBuild = useCallback(() => {
    // 1. Open packets accordion so Activity and Build Progress remain visible
    setActiveTab("packets")

    // 2. Find and scroll to the execution panel
    const executionPanel = document.querySelector('[data-execution-panel]')
    if (executionPanel) {
      executionPanel.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    // 3. Trigger execution after scroll completes
    // Use requestAnimationFrame to ensure DOM has updated, then trigger execution
    // This avoids brittle setTimeout and DOM manipulation
    const triggerExecution = () => {
      if (executionPanelRef.current) {
        executionPanelRef.current.triggerExecution()
      }
    }

    // Wait for scroll to complete using scrollend event (with fallback for browsers that don't support it)
    if ('onscrollend' in window) {
      // Modern browsers: use scrollend event
      const handleScrollEnd = () => {
        window.removeEventListener('scrollend', handleScrollEnd)
        // Use rAF to ensure paint is complete
        requestAnimationFrame(triggerExecution)
      }
      window.addEventListener('scrollend', handleScrollEnd, { once: true })
      // Fallback timeout in case scrollend doesn't fire (e.g., if already at position)
      setTimeout(() => {
        window.removeEventListener('scrollend', handleScrollEnd)
        triggerExecution()
      }, 1000)
    } else {
      // Fallback for older browsers: use IntersectionObserver to detect when panel is visible
      const observer = new IntersectionObserver((entries) => {
        const entry = entries[0]
        if (entry && entry.isIntersecting) {
          observer.disconnect()
          // Use rAF to ensure paint is complete
          requestAnimationFrame(triggerExecution)
        }
      }, { threshold: 0.5 })

      if (executionPanel) {
        observer.observe(executionPanel)
        // Fallback timeout in case observation fails
        setTimeout(() => {
          observer.disconnect()
          triggerExecution()
        }, 1000)
      } else {
        // No panel found, trigger immediately
        triggerExecution()
      }
    }
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

  // Handler for launching Claude Code with a specific working directory (e.g., from folder initializer)
  const handleLaunchClaudeCodeWithDir = (workingDirectory: string) => {
    setClaudeCodeWorkDir(workingDirectory)
    setClaudeCodeStarted(true)
    setClaudeCodeKey(prev => prev + 1)
    setClaudeCodeError(null)
  }

  // Handler for folder initialization completion
  const handleFolderInitialized = (workingDirectory: string) => {
    // Update project with the new working directory
    if (project) {
      const updated = updateProject(project.id, { workingDirectory }, user?.id)
      if (updated) {
        setProject(updated)
      }
    }
  }

  const handleAddToQueue = () => {
    if (!project || project.repos.length === 0) {
      alert("Please link at least one repository first")
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
              The project you're looking for doesn't exist or has been deleted.
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

      {/* Accordion Sections */}
      <Accordion
        type="single"
        collapsible
        value={activeTab}
        onValueChange={(value) => setActiveTab(value || "")}
        className="space-y-2"
      >
        {/* Overview Section */}
        <AccordionItem value="overview" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              <span className="font-medium">Overview</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-6 pt-2">
          {/* Vision Display - Shows game/creative vision prominently */}
          <VisionDisplay projectId={project.id} />

          {/* What's Next Section - Shows when queue is empty or all complete */}
          <WhatsNextSection
            projectId={project.id}
            projectName={project.name}
            projectDescription={project.description}
            packets={packets}
            hasBuildPlan={hasBuildPlan}
            workingDirectory={getEffectiveWorkingDirectory(project)}
            onPacketCreated={(packetId) => {
              console.log("Packet created from What's Next:", packetId)
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

          {/* Start Build Hero - Prominent CTA when ready to execute */}
          <StartBuildHero
            projectId={project.id}
            projectName={project.name}
            packets={packets}
            hasBuildPlan={hasBuildPlan}
            buildPlanApproved={buildPlanApproved}
            isExecuting={isExecuting}
            hasLinkedRepo={project.repos.length > 0}
            onStartBuild={handleStartBuild}
          />

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
              // Refresh build plan status
              const buildPlan = getBuildPlanForProject(project.id)
              if (buildPlan) {
                setHasBuildPlan(true)
                setBuildPlanApproved(buildPlan.status === "approved" || buildPlan.status === "locked")
                setCurrentBuildPlan(buildPlan)
              }
              // Refresh packets
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

          {/* Build Plan Section - Prominent for Planning Phase */}
          {project.status === "planning" && (
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-500" />
                  Build Plan
                </CardTitle>
                <CardDescription>
                  Create and approve your build plan before starting execution. Once approved, change status to Active to begin.
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
                    // Optionally refresh or update UI
                  }}
                />
              </CardContent>
            </Card>
          )}

          {/* Folder Initializer - Show when build plan is approved */}
          {buildPlanApproved && (
            <FolderInitializer
              projectId={project.id}
              projectName={project.name}
              projectDescription={project.description}
              buildPlan={currentBuildPlan}
              linkedRepo={project.repos.length > 0 ? {
                name: project.repos[0].name,
                url: project.repos[0].url,
                localPath: project.repos[0].localPath
              } : undefined}
              onInitialized={handleFolderInitialized}
              onLaunchClaudeCode={handleLaunchClaudeCodeWithDir}
            />
          )}

          {/* GO BUTTON - The Star of the Show */}
          <div data-execution-panel>
            <ExecutionPanel
              ref={executionPanelRef}
              project={{
                id: project.id,
                name: project.name,
                description: project.description,
                repos: project.repos
              }}
              packets={packets}
              restoredSession={restoredSession}
            />
          </div>

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
          </AccordionContent>
        </AccordionItem>

        {/* Build Plan Section - Always show (not just in planning) */}
        <AccordionItem value="plan" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              <span className="font-medium">Build Plan</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
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
          </AccordionContent>
        </AccordionItem>

        {/* Work Packets Section */}
        <AccordionItem value="packets" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-purple-500" />
              <span className="font-medium">Work Packets</span>
              {packets.length > 0 && (
                <span className="text-xs text-muted-foreground ml-1">({packets.length})</span>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Work Packets</h3>
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

                <Button size="sm" variant="outline">
                  <Package className="h-4 w-4 mr-1" />
                  Create Packet
                </Button>
              </div>
            </div>

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
              <Card>
                <CardContent className="p-8 text-center">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No packets created yet.</p>
                  <Button className="mt-4" size="sm">
                    <Package className="h-4 w-4 mr-1" />
                    Create Your First Packet
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="flex gap-6">
                {/* Packet Cards Grid */}
                <div className={cn(
                  "transition-all duration-300",
                  selectedPacketId ? "w-1/2" : "w-full"
                )}>
                  <div className={cn(
                    "grid gap-4",
                    selectedPacketId ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                  )}>
                    {packets.map((packet) => {
                      // Convert packet to the format expected by PacketCard
                      const packetForCard: Packet = {
                        id: packet.id,
                        title: packet.title,
                        description: packet.description,
                        type: packet.type,
                        priority: packet.priority as Packet["priority"],
                        status: packet.status as Packet["status"],
                        tasks: packet.tasks.map(t => ({
                          id: t.id,
                          title: t.description,
                          completed: t.completed
                        })),
                        acceptanceCriteria: packet.acceptanceCriteria
                      }

                      const isExecuting = executingPacketId === packet.id
                      const isSelected = selectedPacketId === packet.id

                      return (
                        <div
                          key={packet.id}
                          className={cn(
                            "cursor-pointer transition-all",
                            isSelected && "ring-2 ring-primary rounded-lg"
                          )}
                          onClick={() => setSelectedPacketId(
                            selectedPacketId === packet.id ? null : packet.id
                          )}
                        >
                          <PacketCard
                            packet={packetForCard}
                            onStart={() => handleStartPacket(packet.id)}
                            onStop={() => handleStopPacket(packet.id)}
                            isExecuting={isExecuting}
                            onEdit={() => handleEditPacket(packet.id)}
                            onDelete={() => handleDeletePacket(packet.id)}
                          />
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
                            <p className="text-xs mt-1">Click &quot;Start&quot; on the packet card to begin</p>
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
          </AccordionContent>
        </AccordionItem>

        {/* Claude Code Section */}
        <AccordionItem value="claude-code" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-purple-500" />
              <span className="font-medium">Claude Code</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            {/* Sync Status - Shows Claude Code activity and pending requests */}
            <ClaudiaSyncStatus
              projectId={project.id}
              projectPath={claudeCodeWorkDir || getEffectiveWorkingDirectory(project) || ""}
            />

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Terminal className="h-5 w-5 text-purple-500" />
                      Claude Code Terminal
                    </CardTitle>
                    <CardDescription>
                      Interactive Claude Code session for {project.name}
                    </CardDescription>
                  </div>
                  <Button
                    onClick={handleStartClaudeCode}
                    disabled={claudeCodeLoading}
                    className="gap-2"
                  >
                    {claudeCodeLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Preparing...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        {claudeCodeStarted ? "Restart Session" : "Start Session"}
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Working Directory Info */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" />
                    <span>Working Directory:</span>
                    <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">
                      {claudeCodeWorkDir || getEffectiveWorkingDirectory(project) || "Will be created on start"}
                    </code>
                  </div>
                  {project.repos.length > 0 && (
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4" />
                      <span>{project.repos[0].name}</span>
                    </div>
                  )}
                </div>

                {/* Error Display */}
                {claudeCodeError && (
                  <div className="flex items-center gap-2 text-red-500 text-sm p-3 bg-red-500/10 rounded-lg">
                    <AlertTriangle className="h-4 w-4" />
                    {claudeCodeError}
                  </div>
                )}

                {/* Terminal */}
                {claudeCodeStarted && claudeCodeWorkDir ? (
                  <ClaudeCodeTerminal
                    key={claudeCodeKey}
                    projectId={project.id}
                    projectName={project.name}
                    projectDescription={project.description}
                    workingDirectory={claudeCodeWorkDir}
                    bypassPermissions={bypassPermissions}
                    className="h-[500px]"
                    onSessionEnd={() => setClaudeCodeStarted(false)}
                    currentPacket={selectedPacket ? {
                      id: selectedPacket.id,
                      title: selectedPacket.title,
                      description: selectedPacket.description,
                      type: selectedPacket.type,
                      priority: selectedPacket.priority,
                      tasks: selectedPacket.tasks,
                      acceptanceCriteria: selectedPacket.acceptanceCriteria
                    } : undefined}
                    allPackets={packets.map(p => ({ id: p.id, title: p.title, status: p.status }))}
                  />
                ) : (
                  <div className="h-[500px] rounded-lg bg-zinc-900 border border-zinc-800 p-4 font-mono text-sm flex flex-col">
                    <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
                      {claudeCodeLoading ? (
                        <>
                          <Loader2 className="h-12 w-12 mb-4 animate-spin text-zinc-400" />
                          <p className="text-zinc-400">Preparing working directory...</p>
                        </>
                      ) : (
                        <>
                          <Terminal className="h-12 w-12 mb-4 opacity-50" />
                          <p className="text-zinc-400">Ready to launch Claude Code</p>
                          <p className="mt-2 text-zinc-600 text-sm">Project: {project.name}</p>
                          <p className="text-zinc-600 mt-4 text-sm">Click &quot;Start Session&quot; above to begin...</p>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Options */}
                <div className="flex items-center gap-4 p-3 rounded-lg border border-orange-500/20 bg-orange-500/5">
                  <input
                    type="checkbox"
                    id="bypass-permissions-project"
                    checked={bypassPermissions}
                    onChange={(e) => setBypassPermissions(e.target.checked)}
                    className="rounded"
                  />
                  <div className="space-y-1">
                    <label
                      htmlFor="bypass-permissions-project"
                      className="flex items-center gap-2 cursor-pointer font-medium text-sm"
                    >
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      Dangerously bypass permissions
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Skip permission prompts for file operations. Use with caution.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Advanced Settings Section - Collapsible */}
      <div className="border rounded-lg">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-muted-foreground">Advanced</span>
            <span className="text-xs text-muted-foreground ml-1">(9 sections)</span>
          </div>
          {showAdvanced ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {showAdvanced && (
          <div className="border-t px-4 pb-4">
            <Accordion
              type="single"
              collapsible
              className="space-y-2 pt-2"
            >
              {/* AI Models Section */}
              <AccordionItem value="models" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-pink-500" />
                    <span className="font-medium">AI Models</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                  <ModelAssignment projectId={project.id} />
                </AccordionContent>
              </AccordionItem>

              {/* Repositories Section */}
              <AccordionItem value="repos" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-orange-500" />
              <span className="font-medium">Repositories</span>
              {project.repos.length > 0 && (
                <span className="text-xs text-muted-foreground ml-1">({project.repos.length})</span>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
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
          </AccordionContent>
        </AccordionItem>

        {/* Browse Files Section */}
        <AccordionItem value="files" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-yellow-500" />
              <span className="font-medium">Browse Files</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <FileBrowser
              projectId={project.id}
              basePath={project.basePath || getEffectiveWorkingDirectory(project)}
            />
          </AccordionContent>
        </AccordionItem>

        {/* Documentation Section */}
        <AccordionItem value="docs" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-orange-500" />
              <span className="font-medium">Documentation</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <DocsBrowser
              projectId={project.id}
              workingDirectory={getEffectiveWorkingDirectory(project) || ""}
            />
          </AccordionContent>
        </AccordionItem>

        {/* Interview Section */}
        <AccordionItem value="interview" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-indigo-500" />
              <span className="font-medium">Interview</span>
              {project.creationInterview && (
                <Sparkles className="h-3 w-3 text-primary" />
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            {project.creationInterview ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Creation Interview</h3>
                    <p className="text-sm text-muted-foreground">
                      Completed on {new Date(project.creationInterview.completedAt || project.creationInterview.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={project.creationInterview.status === "completed" ? "default" : "secondary"}>
                    {project.creationInterview.status}
                  </Badge>
                </div>

                {/* Interview Transcript */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Transcript</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 max-h-[400px] overflow-auto">
                    {project.creationInterview.messages.map((message) => (
                      <MessageBubble key={message.id} message={message} />
                    ))}
                  </CardContent>
                </Card>

                {/* Extracted Insights */}
                {(project.creationInterview.summary || project.creationInterview.keyPoints) && (
                  <Card className="bg-primary/5 border-primary/20">
                    <CardHeader>
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Extracted Insights
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {project.creationInterview.summary && (
                        <div>
                          <h4 className="text-xs text-muted-foreground uppercase mb-1">Summary</h4>
                          <p className="text-sm">{project.creationInterview.summary}</p>
                        </div>
                      )}
                      {project.creationInterview.keyPoints && project.creationInterview.keyPoints.length > 0 && (
                        <div>
                          <h4 className="text-xs text-muted-foreground uppercase mb-1">Key Points</h4>
                          <ul className="text-sm space-y-1">
                            {project.creationInterview.keyPoints.map((point, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                                {point}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {project.creationInterview.suggestedActions && project.creationInterview.suggestedActions.length > 0 && (
                        <div>
                          <h4 className="text-xs text-muted-foreground uppercase mb-1">Suggested Actions</h4>
                          <ul className="text-sm space-y-1">
                            {project.creationInterview.suggestedActions.map((action, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-muted-foreground">-&gt;</span>
                                {action}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    This project was created without an interview.
                  </p>
                  <Button size="sm">
                    <Mic className="h-4 w-4 mr-1" />
                    Start Interview
                  </Button>
                </CardContent>
              </Card>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Business Dev Section - Combined with Prior Art */}
        <AccordionItem value="business-dev" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              <span className="font-medium">Business Dev</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-6 pt-2">
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
          </AccordionContent>
        </AccordionItem>

        {/* Security Section */}
        <AccordionItem value="security" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-red-500" />
              <span className="font-medium">Security</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
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
          </AccordionContent>
        </AccordionItem>

        {/* Launch & Test Section */}
        <AccordionItem value="launch-test" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-500" />
              <span className="font-medium">Launch & Test</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <LaunchTestPanel
              project={{
                id: project.id,
                name: project.name,
                description: project.description,
                workingDirectory: getEffectiveWorkingDirectory(project),
                repos: project.repos
              }}
            />
          </AccordionContent>
        </AccordionItem>

        {/* Resources/User Uploads Section */}
        <AccordionItem value="resources" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-teal-500" />
              <span className="font-medium">User Uploads</span>
              {resourceCount > 0 && (
                <span className="text-xs text-muted-foreground ml-1">({resourceCount})</span>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-6 pt-2">
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
          </AccordionContent>
        </AccordionItem>
            </Accordion>
          </div>
        )}
      </div>

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
