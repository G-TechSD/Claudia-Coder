"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  Zap,
  Loader2,
  FileText,
  CheckCircle2,
  Plus,
  X,
  Edit2,
  Save,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Server,
  Cloud,
  RefreshCw,
  Brain,
  Lock,
  Sparkles,
  Info,
  Package,
  Rocket,
  Search,
  Code,
  Upload,
  Mic
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { BuildPlan, ExistingPacketInfo } from "@/lib/ai/build-plan"
import type { StoredBuildPlan, ProjectStatus } from "@/lib/data/types"
import {
  getBuildPlanForProject,
  createBuildPlan,
  updateBuildPlan,
  approveBuildPlan,
  formatFeedbackForRevision
} from "@/lib/data/build-plans"
import { savePackets, getPacketsForProject, type WorkPacket } from "@/lib/ai/build-plan"
import { getProjectDefaultModel, type EnabledInstance } from "@/components/project/model-assignment"
import { VisionPacketEditor, isVisionPacket } from "@/components/project/vision-packet-editor"

interface ProviderOption {
  name: string
  displayName: string
  status: "online" | "offline" | "checking" | "not-configured"
  model?: string
  type: "local" | "cloud"
}

interface BuildPlanEditorProps {
  projectId: string
  projectName: string
  projectDescription: string
  projectStatus: ProjectStatus
  workingDirectory?: string
  providers: ProviderOption[]
  selectedProvider: string | null
  onProviderChange: (provider: string) => void
  onKickoffGenerated?: (kickoffPath: string) => void
  onPriorArtResearch?: () => void  // Callback to trigger prior art research
  className?: string
}

interface EditableObjective {
  id: string
  text: string
  isEditing: boolean
  isOriginal: boolean
  isDeleted: boolean
}

interface EditableNonGoal {
  id: string
  text: string
  isEditing: boolean
  isOriginal: boolean
  isDeleted: boolean
}

interface PacketFeedback {
  approved: boolean | null
  priority: "low" | "medium" | "high" | "critical"
  comment: string
}

// Model options for regeneration - matching .env.local providers
// Each option can specify both a server (provider) and a specific model
const REGENERATION_MODEL_OPTIONS = [
  // Auto - let system decide
  { value: "auto", label: "Auto (let system decide)", type: "auto", icon: "sparkles", server: null, model: null },
  // Claudia Coder (special paid option) - FUTURE: Not yet available as a service
  // { value: "paid_claudecode", label: "Claudia Coder (Paid)", type: "paid", icon: "terminal", server: "paid_claudecode", model: null },
  // Paid cloud models
  { value: "chatgpt", label: "ChatGPT (OpenAI)", type: "paid", icon: "cloud", server: "chatgpt", model: null },
  { value: "gemini", label: "Gemini (Google)", type: "paid", icon: "cloud", server: "gemini", model: null },
  { value: "anthropic", label: "Anthropic Claude", type: "paid", icon: "cloud", server: "anthropic", model: null },
  // Specific local models - Primary LLM server
  { value: "PrimaryLLM:gpt-oss-20b", label: "gpt-oss-20b (Primary LLM - larger, better structure)", type: "local-model", icon: "brain", server: "PrimaryLLM", model: "gpt-oss-20b" },
  { value: "PrimaryLLM:phind-codellama-34b-v2", label: "phind-codellama-34b-v2 (Primary LLM - code focused)", type: "local-model", icon: "code", server: "PrimaryLLM", model: "phind-codellama-34b-v2" },
  // Specific local models - Vision LLM server
  { value: "VisionLLM:ministral-3-3b", label: "ministral-3-3b (Vision LLM - smaller, faster)", type: "local-model", icon: "zap", server: "VisionLLM", model: "ministral-3-3b" },
  // Generic server selection (uses whatever model is loaded)
  { value: "PrimaryLLM", label: "Primary LLM (use loaded model)", type: "local", icon: "server", server: "PrimaryLLM", model: null },
  { value: "VisionLLM", label: "Vision LLM (use loaded model)", type: "local", icon: "server", server: "VisionLLM", model: null },
] as const

export function BuildPlanEditor({
  projectId,
  projectName,
  projectDescription,
  projectStatus,
  workingDirectory,
  providers,
  selectedProvider,
  onProviderChange,
  onKickoffGenerated,
  onPriorArtResearch,
  className
}: BuildPlanEditorProps) {
  const [storedPlan, setStoredPlan] = useState<StoredBuildPlan | null>(null)
  const [buildPlan, setBuildPlan] = useState<BuildPlan | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRevising, setIsRevising] = useState(false)
  const [generationStatus, setGenerationStatus] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [planSource, setPlanSource] = useState<{ server?: string; model?: string } | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Editable state
  const [objectives, setObjectives] = useState<EditableObjective[]>([])
  const [nonGoals, setNonGoals] = useState<EditableNonGoal[]>([])
  const [newObjective, setNewObjective] = useState("")
  const [newNonGoal, setNewNonGoal] = useState("")
  const [packetFeedback, setPacketFeedback] = useState<Record<string, PacketFeedback>>({})
  const [sectionComments, setSectionComments] = useState<Record<string, string>>({})
  const [expandedPackets, setExpandedPackets] = useState<Set<string>>(new Set())

  // Regeneration model selection - default to "auto" (let system decide)
  const [regenerationModel, setRegenerationModel] = useState<string>("auto")
  const [isGeneratingPackets, setIsGeneratingPackets] = useState(false)
  const [packetGenerationStatus, setPacketGenerationStatus] = useState("")
  const [userDefaultModel, setUserDefaultModel] = useState<EnabledInstance | null>(null)
  const [autoResearchPriorArt, setAutoResearchPriorArt] = useState(true)  // Auto-research prior art on acceptance

  // Build plan generation sources - which data to include when generating
  const [buildPlanSources, setBuildPlanSources] = useState({
    existingPackets: true,
    userUploads: true,
    interviewData: true
  })

  // Auto-save timer
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Check if plan is locked (project is active or beyond)
  const isLocked = storedPlan?.status === "locked" ||
    projectStatus === "active" ||
    projectStatus === "completed" ||
    projectStatus === "archived"

  // Load user's default model from model assignment on mount
  // If user has a default model set, use it; otherwise keep "auto"
  useEffect(() => {
    const defaultModel = getProjectDefaultModel(projectId)
    setUserDefaultModel(defaultModel)

    if (defaultModel) {
      // Map the user's default model to a regeneration model value
      // Check if it matches a known provider pattern
      const provider = defaultModel.provider?.toLowerCase() || ""
      const serverName = defaultModel.serverName?.toLowerCase() || ""

      if (provider === "anthropic" || serverName.includes("anthropic")) {
        setRegenerationModel("anthropic")
      } else if (provider === "openai" || serverName.includes("openai") || serverName.includes("chatgpt")) {
        setRegenerationModel("chatgpt")
      } else if (provider === "google" || serverName.includes("google") || serverName.includes("gemini")) {
        setRegenerationModel("gemini")
      } else if (serverName.includes("primary-llm") || serverName.includes("primaryllm")) {
        setRegenerationModel("PrimaryLLM")
      } else if (serverName.includes("vision-llm") || serverName.includes("visionllm")) {
        setRegenerationModel("VisionLLM")
      } else if (defaultModel.type === "local" && defaultModel.baseUrl) {
        // For other local servers, try to use the server name or default to auto
        setRegenerationModel(defaultModel.serverName || "auto")
      } else {
        // Default fallback - use auto (let system decide)
        setRegenerationModel("auto")
      }
    }
    // If no user default, keep the initial "auto" value - don't override it
  }, [projectId])

  // Load existing plan on mount
  useEffect(() => {
    const existing = getBuildPlanForProject(projectId)
    if (existing) {
      setStoredPlan(existing)
      setPlanSource(existing.generatedBy)
      setLastSaved(new Date(existing.updatedAt))

      // Reconstruct the build plan from stored data
      const reconstructedPlan: BuildPlan = {
        id: existing.id,
        projectId: existing.projectId,
        createdAt: existing.createdAt,
        status: existing.status === "approved" ? "approved" : "draft",
        spec: existing.originalPlan.spec,
        phases: existing.originalPlan.phases.map(p => ({
          ...p,
          packetIds: [],
          dependencies: [],
          estimatedEffort: { optimistic: 8, realistic: 16, pessimistic: 32, confidence: "medium" as const },
          successCriteria: []
        })),
        packets: existing.originalPlan.packets.map(p => ({
          ...p,
          type: p.type as BuildPlan["packets"][0]["type"],
          priority: p.priority as BuildPlan["packets"][0]["priority"],
          status: "queued" as const,
          suggestedTaskType: "coding",
          blockedBy: [],
          blocks: [],
          estimatedTokens: 1000,
          acceptanceCriteria: p.acceptanceCriteria || []
        })),
        modelAssignments: [],
        constraints: {
          requireLocalFirst: true,
          requireHumanApproval: ["planning"],
          maxParallelPackets: 3
        },
        generatedBy: `${existing.generatedBy.server}:${existing.generatedBy.model}`,
        version: existing.revisionNumber
      }
      setBuildPlan(reconstructedPlan)

      // Load editable state from stored plan
      setObjectives(existing.editedObjectives.map(o => ({
        ...o,
        isEditing: false
      })))
      setNonGoals(existing.editedNonGoals.map(ng => ({
        ...ng,
        isEditing: false
      })))

      // Load packet feedback
      const feedback: Record<string, PacketFeedback> = {}
      existing.packetFeedback.forEach(pf => {
        feedback[pf.packetId] = {
          approved: pf.approved,
          priority: pf.priority,
          comment: pf.comment
        }
      })
      setPacketFeedback(feedback)

      // Load section comments
      const comments: Record<string, string> = {}
      existing.sectionComments.forEach(sc => {
        comments[sc.sectionId] = sc.comment
      })
      setSectionComments(comments)
    }
  }, [projectId])

  // Initialize editable state when build plan loads (for new plans)
  useEffect(() => {
    if (buildPlan && !storedPlan) {
      setObjectives(
        buildPlan.spec.objectives.map((obj, i) => ({
          id: `obj-${i}`,
          text: obj,
          isEditing: false,
          isOriginal: true,
          isDeleted: false
        }))
      )
      setNonGoals(
        (buildPlan.spec.nonGoals || []).map((ng, i) => ({
          id: `ng-${i}`,
          text: ng,
          isEditing: false,
          isOriginal: true,
          isDeleted: false
        }))
      )
      const feedback: Record<string, PacketFeedback> = {}
      buildPlan.packets.forEach(packet => {
        feedback[packet.id] = {
          approved: null,
          priority: packet.priority || "medium",
          comment: ""
        }
      })
      setPacketFeedback(feedback)
    }
  }, [buildPlan, storedPlan])

  // Auto-save function
  const saveToStorage = useCallback(() => {
    if (!buildPlan || isLocked) return

    const now = new Date().toISOString()

    if (storedPlan) {
      // Update existing plan
      updateBuildPlan(storedPlan.id, {
        editedObjectives: objectives.map(o => ({
          id: o.id,
          text: o.text,
          isOriginal: o.isOriginal,
          isDeleted: o.isDeleted
        })),
        editedNonGoals: nonGoals.map(ng => ({
          id: ng.id,
          text: ng.text,
          isOriginal: ng.isOriginal,
          isDeleted: ng.isDeleted
        })),
        packetFeedback: Object.entries(packetFeedback).map(([packetId, fb]) => ({
          packetId,
          approved: fb.approved,
          priority: fb.priority,
          comment: fb.comment
        })),
        sectionComments: Object.entries(sectionComments)
          .filter(([, comment]) => comment.trim())
          .map(([sectionId, comment]) => ({
            sectionId,
            comment,
            createdAt: now
          }))
      })
    } else if (planSource) {
      // Create new stored plan
      // Ensure all spec fields have defaults to prevent save errors
      const safeSpec = {
        name: buildPlan.spec.name || "",
        description: buildPlan.spec.description || "",
        objectives: buildPlan.spec.objectives || [],
        nonGoals: buildPlan.spec.nonGoals || [],
        assumptions: buildPlan.spec.assumptions || [],
        risks: buildPlan.spec.risks || [],
        techStack: buildPlan.spec.techStack || []
      }
      const newPlan = createBuildPlan({
        projectId,
        originalPlan: {
          spec: safeSpec,
          phases: (buildPlan.phases || []).map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            order: p.order
          })),
          packets: (buildPlan.packets || []).map(p => ({
            id: p.id,
            phaseId: p.phaseId,
            title: p.title,
            description: p.description,
            type: p.type,
            priority: p.priority,
            tasks: p.tasks || [],
            acceptanceCriteria: p.acceptanceCriteria || []
          }))
        },
        generatedBy: {
          server: planSource.server || "Unknown",
          model: planSource.model || "Unknown"
        }
      })
      setStoredPlan(newPlan)
    }

    setLastSaved(new Date())
    setHasUnsavedChanges(false)
  }, [buildPlan, storedPlan, objectives, nonGoals, packetFeedback, sectionComments, planSource, projectId, isLocked])

  // Trigger auto-save on changes
  useEffect(() => {
    if (!buildPlan || isLocked) return

    setHasUnsavedChanges(true)

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    // Set new timer for 2 seconds
    autoSaveTimerRef.current = setTimeout(() => {
      saveToStorage()
    }, 2000)

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [objectives, nonGoals, packetFeedback, sectionComments, buildPlan, isLocked, saveToStorage])

  const generateBuildPlan = async () => {
    if (!selectedProvider) return

    setIsGenerating(true)
    setError(null)
    setGenerationStatus("Loading existing packets...")

    try {
      // Load existing packets from ALL sources (N8N, .local-storage files, and localStorage)
      // First try the API which aggregates from multiple sources
      let existingPackets: ExistingPacketInfo[] = []

      try {
        const packetsResponse = await fetch(`/api/packets?projectID=${encodeURIComponent(projectId)}&limit=500`)
        const packetsData = await packetsResponse.json()

        if (packetsData.success && packetsData.packets) {
          existingPackets = packetsData.packets.map((p: { id: string; title: string; summary?: string; description?: string; status?: string }) => ({
            id: p.id,
            title: p.title,
            description: p.summary || p.description || "",
            type: "feature",
            status: p.status || "queued",
            source: "api"
          }))
          console.log(`[build-plan-editor] Loaded ${existingPackets.length} packets from API (sources: N8N=${packetsData.sources?.n8n || 0}, localStorage=${packetsData.sources?.localStorage || 0})`)
        }
      } catch (apiError) {
        console.warn("[build-plan-editor] API fetch failed, falling back to localStorage:", apiError)
      }

      // Also include packets from client-side localStorage (may have newer packets not yet synced)
      const localWorkPackets = getPacketsForProject(projectId)
      const localPackets: ExistingPacketInfo[] = localWorkPackets.map(p => ({
        id: p.id,
        title: p.title,
        description: p.description,
        type: p.type,
        status: p.status,
        source: "localStorage"
      }))

      // Merge packets, avoiding duplicates by ID
      const seenIds = new Set(existingPackets.map(p => p.id))
      for (const packet of localPackets) {
        if (!seenIds.has(packet.id)) {
          existingPackets.push(packet)
          seenIds.add(packet.id)
        }
      }

      console.log(`[build-plan-editor] Total ${existingPackets.length} existing packets for project ${projectId} (after merging localStorage)`)

      const provider = providers.find(p => p.name === selectedProvider)
      setGenerationStatus(`Generating with ${provider?.displayName || selectedProvider}...`)

      const response = await fetch("/api/build-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          projectName,
          projectDescription,
          preferredProvider: selectedProvider,
          preferredModel: userDefaultModel?.modelId || null,  // Pass specific model ID from user's default model
          existingPackets: buildPlanSources.existingPackets ? existingPackets : [],  // Only pass if enabled
          sources: buildPlanSources,  // Pass source flags for API to handle user uploads and interview data
          constraints: {
            requireLocalFirst: true,
            requireHumanApproval: ["planning", "deployment"]
          }
        })
      })

      setGenerationStatus("Processing response...")

      const data = await response.json()

      if (data.error) {
        setError(data.error)
      } else if (data.plan) {
        setBuildPlan(data.plan)
        setPlanSource({
          server: data.server,
          model: data.model
        })
        setStoredPlan(null) // Reset stored plan so it creates a new one
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate plan")
    } finally {
      setIsGenerating(false)
      setGenerationStatus("")
    }
  }

  const reviseWithFeedback = async () => {
    if (!selectedProvider || !buildPlan || !storedPlan) return

    setIsRevising(true)
    setError(null)
    setGenerationStatus("Preparing revision request...")

    try {
      // Format feedback for the revision prompt
      const context = {
        editedObjectives: objectives.map(o => ({
          id: o.id,
          text: o.text,
          isOriginal: o.isOriginal,
          isDeleted: o.isDeleted
        })),
        editedNonGoals: nonGoals.map(ng => ({
          id: ng.id,
          text: ng.text,
          isOriginal: ng.isOriginal,
          isDeleted: ng.isDeleted
        })),
        packetFeedback: Object.entries(packetFeedback).map(([packetId, fb]) => ({
          packetId,
          approved: fb.approved,
          priority: fb.priority,
          comment: fb.comment
        })),
        sectionComments: Object.entries(sectionComments)
          .filter(([, comment]) => comment.trim())
          .map(([sectionId, comment]) => ({
            sectionId,
            comment,
            createdAt: new Date().toISOString()
          }))
      }

      const userFeedback = formatFeedbackForRevision(context)

      const provider = providers.find(p => p.name === selectedProvider)
      setGenerationStatus(`Revising with ${provider?.displayName || selectedProvider}...`)

      const response = await fetch("/api/build-plan/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          projectName,
          projectDescription,
          originalPlan: storedPlan.originalPlan,
          userFeedback,
          preferredProvider: selectedProvider,
          preferredModel: userDefaultModel?.modelId || null  // Pass specific model ID from user's default model
        })
      })

      setGenerationStatus("Processing revised plan...")

      const data = await response.json()

      if (data.error) {
        setError(data.error)
      } else if (data.plan) {
        setBuildPlan(data.plan)
        setPlanSource({
          server: data.server,
          model: data.model
        })

        // Create new stored plan as revision
        // Ensure all spec fields have defaults to prevent save errors
        const revisedSpec = {
          name: data.plan.spec?.name || "",
          description: data.plan.spec?.description || "",
          objectives: data.plan.spec?.objectives || [],
          nonGoals: data.plan.spec?.nonGoals || [],
          assumptions: data.plan.spec?.assumptions || [],
          risks: data.plan.spec?.risks || [],
          techStack: data.plan.spec?.techStack || []
        }
        const newPlan = createBuildPlan({
          projectId,
          originalPlan: {
            spec: revisedSpec,
            phases: (data.plan.phases || []).map((p: { id: string; name: string; description: string; order: number }) => ({
              id: p.id,
              name: p.name,
              description: p.description,
              order: p.order
            })),
            packets: (data.plan.packets || []).map((p: { id: string; phaseId: string; title: string; description: string; type: string; priority: string; tasks: Array<{ id: string; description: string; completed: boolean; order: number }>; acceptanceCriteria: string[] }) => ({
              id: p.id,
              phaseId: p.phaseId,
              title: p.title,
              description: p.description,
              type: p.type,
              priority: p.priority,
              tasks: p.tasks || [],
              acceptanceCriteria: p.acceptanceCriteria || []
            }))
          },
          generatedBy: {
            server: data.server || "Unknown",
            model: data.model || "Unknown"
          },
          previousVersionId: storedPlan.id,
          revisionNotes: "Revised based on user feedback"
        })
        setStoredPlan(newPlan)

        // Reset feedback since we have a new plan
        const feedback: Record<string, PacketFeedback> = {}
        data.plan.packets.forEach((packet: { id: string; priority?: string }) => {
          feedback[packet.id] = {
            approved: null,
            priority: (packet.priority as PacketFeedback["priority"]) || "medium",
            comment: ""
          }
        })
        setPacketFeedback(feedback)
        setSectionComments({})
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revise plan")
    } finally {
      setIsRevising(false)
      setGenerationStatus("")
    }
  }

  const handleApprovePlan = () => {
    if (!storedPlan) return
    approveBuildPlan(storedPlan.id)
    setStoredPlan({ ...storedPlan, status: "approved", approvedAt: new Date().toISOString() })
  }

  // Accept build plan and generate packets
  const handleAcceptAndGeneratePackets = async () => {
    if (!storedPlan || !buildPlan) return

    setIsGeneratingPackets(true)
    setPacketGenerationStatus("Approving build plan...")

    try {
      // First approve the plan
      approveBuildPlan(storedPlan.id)
      setStoredPlan({ ...storedPlan, status: "approved", approvedAt: new Date().toISOString() })

      setPacketGenerationStatus("Converting approved packets to work packets...")

      // Get approved packets only (or all if none explicitly rejected)
      // If packetFeedback is empty, include all packets
      const feedbackKeys = Object.keys(packetFeedback)
      const approvedPacketIds = feedbackKeys.length > 0
        ? Object.entries(packetFeedback)
            .filter(([, fb]) => fb.approved === true || fb.approved === null)
            .map(([id]) => id)
        : buildPlan.packets.map(p => p.id) // Include all if no feedback yet

      // Convert build plan packets to work packets
      const workPackets: WorkPacket[] = buildPlan.packets
        .filter(p => approvedPacketIds.includes(p.id))
        .map(packet => {
          const feedback = packetFeedback[packet.id]
          return {
            id: packet.id,
            phaseId: packet.phaseId,
            title: packet.title,
            description: packet.description,
            type: packet.type,
            priority: feedback?.priority || packet.priority,
            status: "queued" as const,
            tasks: packet.tasks || [],
            suggestedTaskType: packet.suggestedTaskType || "coding",
            blockedBy: packet.blockedBy || [],
            blocks: packet.blocks || [],
            estimatedTokens: packet.estimatedTokens || 1000,
            acceptanceCriteria: packet.acceptanceCriteria || []
          }
        })

      setPacketGenerationStatus(`Saving ${workPackets.length} packets to queue...`)

      // Save packets to storage
      savePackets(projectId, workPackets)

      // Generate KICKOFF.md if working directory is available
      if (workingDirectory) {
        setPacketGenerationStatus("Generating KICKOFF.md...")

        try {
          const kickoffResponse = await fetch(`/api/projects/${projectId}/generate-kickoff`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workingDirectory,
              project: {
                id: projectId,
                name: projectName,
                description: projectDescription,
                status: projectStatus,
                priority: "medium",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                workingDirectory,
                repos: [],
                packetIds: [],
                tags: []
              },
              buildPlan: storedPlan,
              generateAllDocs: true // Generate PRD, BUILD_PLAN, and packet files too
            })
          })

          const kickoffData = await kickoffResponse.json()

          if (kickoffResponse.ok && kickoffData.success) {
            console.log(`[build-plan-editor] Generated KICKOFF.md at: ${kickoffData.kickoffPath}`)
            if (onKickoffGenerated) {
              onKickoffGenerated(kickoffData.kickoffPath)
            }
          } else {
            console.warn("[build-plan-editor] Failed to generate KICKOFF.md:", kickoffData.error)
          }
        } catch (kickoffErr) {
          console.warn("[build-plan-editor] Error generating KICKOFF.md:", kickoffErr)
          // Don't fail the whole operation just because kickoff generation failed
        }
      }

      setPacketGenerationStatus(`Generated ${workPackets.length} packets successfully!`)

      // Trigger prior art research if enabled
      if (autoResearchPriorArt && onPriorArtResearch) {
        setPacketGenerationStatus("Starting prior art research...")
        setTimeout(() => {
          onPriorArtResearch()
          setPacketGenerationStatus("")
          setIsGeneratingPackets(false)
        }, 1000)
      } else {
        // Show success briefly then clear
        setTimeout(() => {
          setPacketGenerationStatus("")
          setIsGeneratingPackets(false)
        }, 2000)
      }

    } catch (err) {
      setPacketGenerationStatus("")
      setIsGeneratingPackets(false)
      setError(err instanceof Error ? err.message : "Failed to generate packets")
    }
  }

  // Regenerate build plan with selected model
  const regenerateWithSelectedModel = async () => {
    if (!regenerationModel) return

    setIsGenerating(true)
    setError(null)
    setGenerationStatus("Loading existing packets...")

    try {
      // Load existing packets from ALL sources (N8N, .local-storage files, and localStorage)
      // First try the API which aggregates from multiple sources
      let existingPackets: ExistingPacketInfo[] = []

      try {
        const packetsResponse = await fetch(`/api/packets?projectID=${encodeURIComponent(projectId)}&limit=500`)
        const packetsData = await packetsResponse.json()

        if (packetsData.success && packetsData.packets) {
          existingPackets = packetsData.packets.map((p: { id: string; title: string; summary?: string; description?: string; status?: string }) => ({
            id: p.id,
            title: p.title,
            description: p.summary || p.description || "",
            type: "feature",
            status: p.status || "queued",
            source: "api"
          }))
          console.log(`[build-plan-editor] Regenerate: Loaded ${existingPackets.length} packets from API (sources: N8N=${packetsData.sources?.n8n || 0}, localStorage=${packetsData.sources?.localStorage || 0})`)
        }
      } catch (apiError) {
        console.warn("[build-plan-editor] API fetch failed, falling back to localStorage:", apiError)
      }

      // Also include packets from client-side localStorage (may have newer packets not yet synced)
      const localWorkPackets = getPacketsForProject(projectId)
      const localPackets: ExistingPacketInfo[] = localWorkPackets.map(p => ({
        id: p.id,
        title: p.title,
        description: p.description,
        type: p.type,
        status: p.status,
        source: "localStorage"
      }))

      // Merge packets, avoiding duplicates by ID
      const seenIds = new Set(existingPackets.map(p => p.id))
      for (const packet of localPackets) {
        if (!seenIds.has(packet.id)) {
          existingPackets.push(packet)
          seenIds.add(packet.id)
        }
      }

      console.log(`[build-plan-editor] Regenerating with ${existingPackets.length} total existing packets for project ${projectId}`)

      // Find the selected model option to get server and model info
      const modelOption = REGENERATION_MODEL_OPTIONS.find(m => m.value === regenerationModel)
      setGenerationStatus(`Regenerating with ${modelOption?.label || regenerationModel}...`)

      // Determine the provider and model to use
      // For "auto", let the system decide (pass null for both)
      // For specific models like "PrimaryLLM:gpt-oss-20b", extract server and model
      const preferredServer = modelOption?.server || null
      const preferredModelId = modelOption?.model || null
      const isPaidModel = modelOption?.type === "paid" || regenerationModel.startsWith("paid_") ||
        ["chatgpt", "gemini", "anthropic"].includes(regenerationModel)

      console.log(`[build-plan-editor] Selected: ${regenerationModel}, Server: ${preferredServer}, Model: ${preferredModelId}`)

      const response = await fetch("/api/build-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          projectName,
          projectDescription,
          preferredProvider: preferredServer,  // The server/provider to use
          preferredModel: preferredModelId,     // The specific model ID to use
          existingPackets: buildPlanSources.existingPackets ? existingPackets : [],  // Only pass if enabled
          sources: buildPlanSources,  // Pass source flags for API to handle user uploads and interview data
          allowPaidFallback: isPaidModel,
          constraints: {
            requireLocalFirst: regenerationModel === "auto",
            requireHumanApproval: ["planning", "deployment"]
          }
        })
      })

      setGenerationStatus("Processing response...")

      const data = await response.json()

      if (data.error) {
        setError(data.error)
      } else if (data.plan) {
        setBuildPlan(data.plan)
        setPlanSource({
          server: data.server,
          model: data.model
        })
        setStoredPlan(null) // Reset stored plan so it creates a new one

        // Reset feedback for new plan
        const feedback: Record<string, PacketFeedback> = {}
        data.plan.packets.forEach((packet: { id: string; priority?: string }) => {
          feedback[packet.id] = {
            approved: null,
            priority: (packet.priority as PacketFeedback["priority"]) || "medium",
            comment: ""
          }
        })
        setPacketFeedback(feedback)
        setSectionComments({})
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate plan")
    } finally {
      setIsGenerating(false)
      setGenerationStatus("")
    }
  }

  // Objective management
  const addObjective = () => {
    if (!newObjective.trim() || isLocked) return
    setObjectives([...objectives, {
      id: `obj-${Date.now()}`,
      text: newObjective.trim(),
      isEditing: false,
      isOriginal: false,
      isDeleted: false
    }])
    setNewObjective("")
  }

  const removeObjective = (id: string) => {
    if (isLocked) return
    setObjectives(objectives.map(o =>
      o.id === id ? { ...o, isDeleted: true } : o
    ))
  }

  const updateObjective = (id: string, text: string) => {
    if (isLocked) return
    setObjectives(objectives.map(o =>
      o.id === id ? { ...o, text, isEditing: false } : o
    ))
  }

  const toggleObjectiveEdit = (id: string) => {
    if (isLocked) return
    setObjectives(objectives.map(o =>
      o.id === id ? { ...o, isEditing: !o.isEditing } : o
    ))
  }

  // Non-goal management
  const addNonGoal = () => {
    if (!newNonGoal.trim() || isLocked) return
    setNonGoals([...nonGoals, {
      id: `ng-${Date.now()}`,
      text: newNonGoal.trim(),
      isEditing: false,
      isOriginal: false,
      isDeleted: false
    }])
    setNewNonGoal("")
  }

  const removeNonGoal = (id: string) => {
    if (isLocked) return
    setNonGoals(nonGoals.map(ng =>
      ng.id === id ? { ...ng, isDeleted: true } : ng
    ))
  }

  const updateNonGoal = (id: string, text: string) => {
    if (isLocked) return
    setNonGoals(nonGoals.map(ng =>
      ng.id === id ? { ...ng, text, isEditing: false } : ng
    ))
  }

  const toggleNonGoalEdit = (id: string) => {
    if (isLocked) return
    setNonGoals(nonGoals.map(ng =>
      ng.id === id ? { ...ng, isEditing: !ng.isEditing } : ng
    ))
  }

  // Packet feedback
  const setPacketApproval = (packetId: string, approved: boolean | null) => {
    if (isLocked) return
    setPacketFeedback(prev => ({
      ...prev,
      [packetId]: { ...prev[packetId], approved }
    }))
  }

  const setPacketPriority = (packetId: string, priority: "low" | "medium" | "high" | "critical") => {
    if (isLocked) return
    setPacketFeedback(prev => ({
      ...prev,
      [packetId]: { ...prev[packetId], priority }
    }))
  }

  const setPacketComment = (packetId: string, comment: string) => {
    if (isLocked) return
    setPacketFeedback(prev => ({
      ...prev,
      [packetId]: { ...prev[packetId], comment }
    }))
  }

  // Vision packet metadata save handler
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleVisionPacketSave = useCallback((packetId: string, updatedMetadata: any) => {
    if (!buildPlan || isLocked) return

    // Update the build plan's packet with new metadata
    const updatedPackets = buildPlan.packets.map(packet => {
      if (packet.id === packetId) {
        return {
          ...packet,
          metadata: {
            ...packet.metadata,
            ...updatedMetadata
          }
        }
      }
      return packet
    })

    setBuildPlan({
      ...buildPlan,
      packets: updatedPackets
    })

    // Also save to localStorage (claudia_packets) for persistence
    try {
      const storedPackets = localStorage.getItem("claudia_packets")
      if (storedPackets) {
        const allPackets = JSON.parse(storedPackets)
        const projectPackets = allPackets[projectId] || []

        const packetIndex = projectPackets.findIndex((p: { id: string }) => p.id === packetId)
        if (packetIndex !== -1) {
          projectPackets[packetIndex] = {
            ...projectPackets[packetIndex],
            metadata: {
              ...projectPackets[packetIndex].metadata,
              ...updatedMetadata
            }
          }
          allPackets[projectId] = projectPackets
          localStorage.setItem("claudia_packets", JSON.stringify(allPackets))
          console.log("[BuildPlanEditor] Vision packet saved to localStorage")
        }
      }
    } catch (error) {
      console.error("[BuildPlanEditor] Failed to save vision packet:", error)
    }

    setHasUnsavedChanges(true)
  }, [buildPlan, isLocked, projectId])

  const togglePacketExpand = (packetId: string) => {
    setExpandedPackets(prev => {
      const next = new Set(prev)
      if (next.has(packetId)) {
        next.delete(packetId)
      } else {
        next.add(packetId)
      }
      return next
    })
  }

  // Section comments
  const updateSectionComment = (sectionId: string, comment: string) => {
    if (isLocked) return
    setSectionComments(prev => ({ ...prev, [sectionId]: comment }))
  }

  const visibleObjectives = objectives.filter(o => !o.isDeleted)
  const visibleNonGoals = nonGoals.filter(ng => !ng.isDeleted)
  // Count packets that will be included (not explicitly rejected)
  // Fall back to buildPlan.packets.length if packetFeedback is not yet populated
  const feedbackEntries = Object.values(packetFeedback)
  const packetsToInclude = feedbackEntries.length > 0
    ? feedbackEntries.filter(f => f.approved === true || f.approved === null).length
    : (buildPlan?.packets?.length || 0)
  // For display, show explicitly approved count
  const approvedCount = feedbackEntries.filter(f => f.approved === true).length
  const rejectedCount = feedbackEntries.filter(f => f.approved === false).length
  const hasChanges = objectives.some(o => !o.isOriginal || o.isDeleted) ||
    nonGoals.some(ng => !ng.isOriginal || ng.isDeleted) ||
    Object.values(packetFeedback).some(f => f.approved !== null || f.comment) ||
    Object.values(sectionComments).some(c => c.trim())

  return (
    <div className={cn("space-y-4", className)}>
      {/* Locked state banner */}
      {isLocked && (
        <Alert className="bg-amber-500/10 border-amber-500/30">
          <Lock className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700">
            This build plan is locked because the project is {projectStatus}.
            Build plans become read-only once development begins.
          </AlertDescription>
        </Alert>
      )}

      {/* No plan yet - show generator */}
      {!buildPlan && !error && (
        <Card>
          <CardContent className="p-8 text-center">
            <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              Generate a comprehensive build plan using AI. Select a provider and click generate.
            </p>

            {/* Model capability note */}
            <Alert className="mb-6 text-left bg-blue-500/5 border-blue-500/20">
              <Info className="h-4 w-4 text-blue-500" />
              <AlertDescription className="text-sm">
                <strong>Model capability matters:</strong> Larger, more capable models (Claude Opus, GPT-4, large local models)
                create more detailed and accurate build plans. Smaller models may produce simpler plans that need more revision.
              </AlertDescription>
            </Alert>

            <div className="flex items-center justify-center gap-3">
              <Select value={selectedProvider || ""} onValueChange={onProviderChange}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select AI provider..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border z-50">
                  {providers.filter(p => p.type === "local").length > 0 && (
                    <div className="px-2 py-1 text-xs text-muted-foreground font-medium">Local</div>
                  )}
                  {providers.filter(p => p.type === "local").map(provider => (
                    <SelectItem
                      key={provider.name}
                      value={provider.name}
                      disabled={provider.status !== "online"}
                    >
                      <div className="flex items-center gap-2">
                        <Server className="h-3 w-3 text-muted-foreground" />
                        <span className={cn(
                          "h-2 w-2 rounded-full",
                          provider.status === "online" && "bg-green-500",
                          provider.status === "offline" && "bg-red-500"
                        )} />
                        <span>{provider.displayName}</span>
                      </div>
                    </SelectItem>
                  ))}
                  {providers.filter(p => p.type === "cloud").length > 0 && (
                    <div className="px-2 py-1 text-xs text-muted-foreground font-medium mt-1 border-t">Cloud</div>
                  )}
                  {providers.filter(p => p.type === "cloud").map(provider => (
                    <SelectItem
                      key={provider.name}
                      value={provider.name}
                      disabled={provider.status !== "online"}
                    >
                      <div className="flex items-center gap-2">
                        <Cloud className="h-3 w-3 text-blue-500" />
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        <span>{provider.displayName}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={generateBuildPlan} disabled={isGenerating || !selectedProvider}>
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                Generate Build Plan
              </Button>
            </div>

            {/* Build plan source checkboxes */}
            <div className="flex items-center justify-center gap-4 mt-4 text-xs">
              <span className="text-muted-foreground">Include:</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={buildPlanSources.existingPackets}
                  onCheckedChange={(checked) => setBuildPlanSources(prev => ({ ...prev, existingPackets: checked === true }))}
                />
                <Package className="h-3 w-3 text-blue-500" />
                <span>Existing Packets</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={buildPlanSources.userUploads}
                  onCheckedChange={(checked) => setBuildPlanSources(prev => ({ ...prev, userUploads: checked === true }))}
                />
                <Upload className="h-3 w-3 text-green-500" />
                <span>User Uploads</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={buildPlanSources.interviewData}
                  onCheckedChange={(checked) => setBuildPlanSources(prev => ({ ...prev, interviewData: checked === true }))}
                />
                <Mic className="h-3 w-3 text-purple-500" />
                <span>Interview Data</span>
              </label>
            </div>

            {/* Loading status */}
            {isGenerating && generationStatus && (
              <div className="mt-6 p-4 bg-primary/5 rounded-lg">
                <div className="flex items-center justify-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm">{generationStatus}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  This may take 30-60 seconds depending on the model...
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error state */}
      {error && (
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-500">Failed to generate plan</p>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => setError(null)}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Build Plan Display & Editor */}
      {buildPlan && (
        <div className="space-y-4">
          {/* Header with source info */}
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    {buildPlan.spec.name}
                    {isLocked && <Lock className="h-4 w-4 text-amber-500" />}
                  </CardTitle>
                  <CardDescription>{buildPlan.spec.description}</CardDescription>
                  {planSource && (
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <Brain className="h-3 w-3" />
                      <span>Generated by:</span>
                      <Badge variant="outline" className="text-xs">
                        {planSource.server || "Local"}
                      </Badge>
                      {planSource.model && (
                        <span className="opacity-70">{planSource.model.split("/").pop()}</span>
                      )}
                      {storedPlan?.revisionNumber && storedPlan.revisionNumber > 1 && (
                        <Badge variant="secondary" className="text-xs">
                          Revision {storedPlan.revisionNumber}
                        </Badge>
                      )}
                    </div>
                  )}
                  {/* Auto-save status */}
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    {hasUnsavedChanges ? (
                      <span className="text-amber-500">Saving...</span>
                    ) : lastSaved ? (
                      <span className="text-green-600">
                        Saved {lastSaved.toLocaleTimeString()}
                      </span>
                    ) : null}
                  </div>
                </div>
                <Badge variant={storedPlan?.status === "approved" ? "default" : "secondary"}>
                  {storedPlan?.status || "draft"}
                </Badge>
              </div>
            </CardHeader>
          </Card>

          {/* Model capability note (inline) */}
          {!isLocked && (
            <Alert className="bg-blue-500/5 border-blue-500/20">
              <Sparkles className="h-4 w-4 text-blue-500" />
              <AlertDescription className="text-sm">
                <strong>Tip:</strong> Larger models produce more detailed plans. If this plan seems incomplete,
                try regenerating with a more capable model like Claude Opus or a large local model.
              </AlertDescription>
            </Alert>
          )}

          {/* TOP Action Bar */}
          {!isLocked && storedPlan && (
            <Card className="border-border/50 bg-muted/30">
              <CardContent className="p-3">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  {/* Left side: Model Selector + Regenerate */}
                  <div className="flex items-center gap-2">
                    <Select value={regenerationModel} onValueChange={setRegenerationModel}>
                      <SelectTrigger className="w-[280px]">
                        <SelectValue placeholder="Select model..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border border-border z-50">
                        {/* Auto option */}
                        {REGENERATION_MODEL_OPTIONS.filter(m => m.type === "auto").map(model => (
                          <SelectItem key={model.value} value={model.value}>
                            <div className="flex items-center gap-2">
                              <Sparkles className="h-3 w-3 text-yellow-500" />
                              <span>{model.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                        {/* Paid Models */}
                        <div className="px-2 py-1 text-xs text-muted-foreground font-medium mt-1 border-t">Paid Models</div>
                        {REGENERATION_MODEL_OPTIONS.filter(m => m.type === "paid").map(model => (
                          <SelectItem key={model.value} value={model.value}>
                            <div className="flex items-center gap-2">
                              <Cloud className="h-3 w-3 text-blue-500" />
                              <span>{model.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                        {/* Specific Local Models */}
                        <div className="px-2 py-1 text-xs text-muted-foreground font-medium mt-1 border-t">Specific Local Models</div>
                        {REGENERATION_MODEL_OPTIONS.filter(m => m.type === "local-model").map(model => (
                          <SelectItem key={model.value} value={model.value}>
                            <div className="flex items-center gap-2">
                              {model.icon === "brain" ? (
                                <Brain className="h-3 w-3 text-purple-400" />
                              ) : model.icon === "code" ? (
                                <Code className="h-3 w-3 text-cyan-500" />
                              ) : (
                                <Zap className="h-3 w-3 text-yellow-500" />
                              )}
                              <span>{model.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                        {/* Generic Local Servers */}
                        <div className="px-2 py-1 text-xs text-muted-foreground font-medium mt-1 border-t">Local Servers</div>
                        {REGENERATION_MODEL_OPTIONS.filter(m => m.type === "local").map(model => (
                          <SelectItem key={model.value} value={model.value}>
                            <div className="flex items-center gap-2">
                              <Server className="h-3 w-3 text-green-500" />
                              <span>{model.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      onClick={regenerateWithSelectedModel}
                      disabled={isGenerating || isRevising || !regenerationModel}
                    >
                      {isGenerating ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Regenerate
                    </Button>
                    {/* Build plan source checkboxes - compact */}
                    <div className="flex items-center gap-3 text-xs ml-2">
                      <label className="flex items-center gap-1 cursor-pointer" title="Existing Work Packets">
                        <Checkbox
                          checked={buildPlanSources.existingPackets}
                          onCheckedChange={(checked) => setBuildPlanSources(prev => ({ ...prev, existingPackets: checked === true }))}
                        />
                        <Package className="h-3 w-3 text-blue-500" />
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer" title="User Uploads">
                        <Checkbox
                          checked={buildPlanSources.userUploads}
                          onCheckedChange={(checked) => setBuildPlanSources(prev => ({ ...prev, userUploads: checked === true }))}
                        />
                        <Upload className="h-3 w-3 text-green-500" />
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer" title="Interview Data">
                        <Checkbox
                          checked={buildPlanSources.interviewData}
                          onCheckedChange={(checked) => setBuildPlanSources(prev => ({ ...prev, interviewData: checked === true }))}
                        />
                        <Mic className="h-3 w-3 text-purple-500" />
                      </label>
                    </div>
                  </div>

                  {/* Visual separator */}
                  <div className="hidden sm:block h-8 w-px bg-border" />

                  {/* Right side: Accept Build Plan button */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <Button
                        size="default"
                        className="bg-green-600 hover:bg-green-700 text-white gap-2"
                        onClick={handleAcceptAndGeneratePackets}
                        disabled={isGeneratingPackets || packetsToInclude === 0 || storedPlan?.status === "approved"}
                      >
                        {isGeneratingPackets ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : storedPlan?.status === "approved" ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <Rocket className="h-4 w-4" />
                        )}
                        {storedPlan?.status === "approved"
                          ? "Packets Added"
                          : "Accept Build Plan & Add Packets"}
                      </Button>
                      {storedPlan?.status !== "approved" && (
                        <span className="text-xs text-muted-foreground hidden md:inline">
                          ({packetsToInclude} packets)
                        </span>
                      )}
                    </div>
                    {/* Auto-research prior art checkbox */}
                    {storedPlan?.status !== "approved" && (
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground">
                        <Checkbox
                          checked={autoResearchPriorArt}
                          onCheckedChange={(checked) => setAutoResearchPriorArt(checked === true)}
                        />
                        <Search className="h-3 w-3 text-cyan-500" />
                        <span>Auto-research prior art</span>
                      </label>
                    )}
                  </div>
                </div>

                {/* Generation status messages */}
                {(packetGenerationStatus || (isGenerating && generationStatus)) && (
                  <div className="mt-3 p-3 bg-primary/5 rounded-lg">
                    <div className="flex items-center gap-2">
                      {isGeneratingPackets || isGenerating ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : (
                        <Package className="h-4 w-4 text-green-600" />
                      )}
                      <span className="text-sm">{packetGenerationStatus || generationStatus}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Editable Objectives */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Objectives
              </CardTitle>
              <CardDescription>What this project will accomplish</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {visibleObjectives.map((obj) => (
                <div key={obj.id} className="flex items-center gap-2 group">
                  {obj.isEditing && !isLocked ? (
                    <>
                      <Input
                        value={obj.text}
                        onChange={(e) => setObjectives(objectives.map(o =>
                          o.id === obj.id ? { ...o, text: e.target.value } : o
                        ))}
                        className="flex-1"
                        autoFocus
                      />
                      <Button size="sm" variant="ghost" onClick={() => updateObjective(obj.id, obj.text)}>
                        <Save className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className={cn("text-sm flex-1", !obj.isOriginal && "text-primary")}>
                        {obj.text}
                        {!obj.isOriginal && <Badge variant="outline" className="ml-2 text-xs">Added</Badge>}
                      </span>
                      {!isLocked && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => toggleObjectiveEdit(obj.id)}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500"
                            onClick={() => removeObjective(obj.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </div>
              ))}
              {/* Add new objective */}
              {!isLocked && (
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Input
                    placeholder="Add new objective..."
                    value={newObjective}
                    onChange={(e) => setNewObjective(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addObjective()}
                    className="flex-1"
                  />
                  <Button size="sm" onClick={addObjective} disabled={!newObjective.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Editable Non-Goals */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <X className="h-4 w-4 text-red-400" />
                Out of Scope
              </CardTitle>
              <CardDescription>What this project will NOT include</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {visibleNonGoals.map((ng) => (
                <div key={ng.id} className="flex items-center gap-2 group">
                  {ng.isEditing && !isLocked ? (
                    <>
                      <Input
                        value={ng.text}
                        onChange={(e) => setNonGoals(nonGoals.map(n =>
                          n.id === ng.id ? { ...n, text: e.target.value } : n
                        ))}
                        className="flex-1"
                        autoFocus
                      />
                      <Button size="sm" variant="ghost" onClick={() => updateNonGoal(ng.id, ng.text)}>
                        <Save className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-red-400">✗</span>
                      <span className={cn("text-sm flex-1 text-muted-foreground", !ng.isOriginal && "text-primary")}>
                        {ng.text}
                        {!ng.isOriginal && <Badge variant="outline" className="ml-2 text-xs">Added</Badge>}
                      </span>
                      {!isLocked && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => toggleNonGoalEdit(ng.id)}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500"
                            onClick={() => removeNonGoal(ng.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </div>
              ))}
              {/* Add new non-goal */}
              {!isLocked && (
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Input
                    placeholder="Add item to exclude..."
                    value={newNonGoal}
                    onChange={(e) => setNewNonGoal(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addNonGoal()}
                    className="flex-1"
                  />
                  <Button size="sm" onClick={addNonGoal} disabled={!newNonGoal.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tech Stack */}
          {buildPlan.spec.techStack?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tech Stack</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {buildPlan.spec.techStack.map((tech, i) => (
                    <Badge key={i} variant="outline">{tech}</Badge>
                  ))}
                </div>
                {/* Comment on tech stack */}
                {!isLocked && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <MessageSquare className="h-3 w-3" />
                      <span>Your comments</span>
                    </div>
                    <Textarea
                      placeholder="Add notes about tech choices..."
                      value={sectionComments["tech-stack"] || ""}
                      onChange={(e) => updateSectionComment("tech-stack", e.target.value)}
                      className="text-sm min-h-[60px]"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Work Packets with Voting */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Work Packets ({buildPlan.packets.length})</CardTitle>
                  <CardDescription>
                    {approvedCount} approved, {rejectedCount} rejected
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-3">
                  {buildPlan.packets.map((packet) => {
                    const feedback = packetFeedback[packet.id] || { approved: null, priority: "medium", comment: "" }
                    const isExpanded = expandedPackets.has(packet.id)

                    // Use VisionPacketEditor for vision packets
                    if (isVisionPacket(packet)) {
                      return (
                        <VisionPacketEditor
                          key={packet.id}
                          packet={packet}
                          isLocked={isLocked}
                          projectId={projectId}
                          onSave={handleVisionPacketSave}
                        />
                      )
                    }

                    return (
                      <div
                        key={packet.id}
                        className={cn(
                          "border rounded-lg overflow-hidden",
                          feedback.approved === true && "border-green-500/50 bg-green-500/5",
                          feedback.approved === false && "border-red-500/50 bg-red-500/5 opacity-60"
                        )}
                      >
                        {/* Packet header */}
                        <div className="p-3">
                          <div className="flex items-start gap-3">
                            {/* Voting buttons */}
                            {!isLocked && (
                              <div className="flex flex-col gap-1">
                                <Button
                                  size="sm"
                                  variant={feedback.approved === true ? "default" : "ghost"}
                                  className={cn(
                                    "h-8 w-8 p-0",
                                    feedback.approved === true && "bg-green-500 hover:bg-green-600"
                                  )}
                                  onClick={() => setPacketApproval(packet.id, feedback.approved === true ? null : true)}
                                >
                                  <ThumbsUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant={feedback.approved === false ? "default" : "ghost"}
                                  className={cn(
                                    "h-8 w-8 p-0",
                                    feedback.approved === false && "bg-red-500 hover:bg-red-600"
                                  )}
                                  onClick={() => setPacketApproval(packet.id, feedback.approved === false ? null : false)}
                                >
                                  <ThumbsDown className="h-4 w-4" />
                                </Button>
                              </div>
                            )}

                            {/* Packet content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-sm">{packet.title}</span>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {packet.type}
                                  </Badge>
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{packet.description}</p>

                              {/* Priority selector */}
                              {!isLocked && (
                                <div className="flex items-center gap-3 mt-2">
                                  <span className="text-xs text-muted-foreground">Priority:</span>
                                  {(["low", "medium", "high", "critical"] as const).map((p) => (
                                    <label key={p} className="flex items-center gap-1 cursor-pointer">
                                      <Checkbox
                                        checked={feedback.priority === p}
                                        onCheckedChange={() => setPacketPriority(packet.id, p)}
                                      />
                                      <span className={cn(
                                        "text-xs capitalize",
                                        p === "critical" && "text-red-500",
                                        p === "high" && "text-orange-500",
                                        p === "medium" && "text-yellow-500",
                                        p === "low" && "text-gray-500"
                                      )}>
                                        {p}
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Expand button */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => togglePacketExpand(packet.id)}
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="px-3 pb-3 pt-0 border-t bg-muted/30">
                            {/* Tasks */}
                            {packet.tasks?.length > 0 && (
                              <div className="mt-3">
                                <p className="text-xs font-medium mb-1">Tasks:</p>
                                <ul className="text-xs text-muted-foreground space-y-1">
                                  {packet.tasks.map((task, i) => (
                                    <li key={task.id || i} className="flex items-start gap-1">
                                      <span className="text-muted-foreground">•</span>
                                      {task.description}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Comment input */}
                            {!isLocked && (
                              <div className="mt-3">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                  <MessageSquare className="h-3 w-3" />
                                  <span>Your notes on this packet</span>
                                </div>
                                <Textarea
                                  placeholder="Add comments or concerns..."
                                  value={feedback.comment}
                                  onChange={(e) => setPacketComment(packet.id, e.target.value)}
                                  className="text-sm min-h-[60px]"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* BOTTOM Action Bar */}
          <Card className="border-border/50 bg-muted/30">
            <CardContent className="p-3">
              <div className="space-y-3">
                {/* Summary Stats Row */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {approvedCount} approved, {rejectedCount} rejected
                    {hasChanges && !isLocked && (
                      <span className="ml-2 text-primary">- pending changes</span>
                    )}
                  </span>
                  {isLocked && (
                    <Badge variant="outline" className="text-amber-600">
                      <Lock className="h-3 w-3 mr-1" />
                      Locked
                    </Badge>
                  )}
                </div>

                {/* Main Action Bar */}
                {!isLocked && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    {/* Left side: Model Selector + Regenerate */}
                    <div className="flex items-center gap-2">
                      <Select value={regenerationModel} onValueChange={setRegenerationModel}>
                        <SelectTrigger className="w-[280px]">
                          <SelectValue placeholder="Select model..." />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border border-border z-50">
                          {/* Auto option */}
                          {REGENERATION_MODEL_OPTIONS.filter(m => m.type === "auto").map(model => (
                            <SelectItem key={model.value} value={model.value}>
                              <div className="flex items-center gap-2">
                                <Sparkles className="h-3 w-3 text-yellow-500" />
                                <span>{model.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                          {/* Paid Models */}
                          <div className="px-2 py-1 text-xs text-muted-foreground font-medium mt-1 border-t">Paid Models</div>
                          {REGENERATION_MODEL_OPTIONS.filter(m => m.type === "paid").map(model => (
                            <SelectItem key={model.value} value={model.value}>
                              <div className="flex items-center gap-2">
                                <Cloud className="h-3 w-3 text-blue-500" />
                                <span>{model.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                          {/* Specific Local Models */}
                          <div className="px-2 py-1 text-xs text-muted-foreground font-medium mt-1 border-t">Specific Local Models</div>
                          {REGENERATION_MODEL_OPTIONS.filter(m => m.type === "local-model").map(model => (
                            <SelectItem key={model.value} value={model.value}>
                              <div className="flex items-center gap-2">
                                {model.icon === "brain" ? (
                                  <Brain className="h-3 w-3 text-purple-400" />
                                ) : model.icon === "code" ? (
                                  <Code className="h-3 w-3 text-cyan-500" />
                                ) : (
                                  <Zap className="h-3 w-3 text-yellow-500" />
                                )}
                                <span>{model.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                          {/* Generic Local Servers */}
                          <div className="px-2 py-1 text-xs text-muted-foreground font-medium mt-1 border-t">Local Servers</div>
                          {REGENERATION_MODEL_OPTIONS.filter(m => m.type === "local").map(model => (
                            <SelectItem key={model.value} value={model.value}>
                              <div className="flex items-center gap-2">
                                <Server className="h-3 w-3 text-green-500" />
                                <span>{model.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        onClick={regenerateWithSelectedModel}
                        disabled={isGenerating || isRevising || !regenerationModel}
                      >
                        {isGenerating ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Regenerate
                      </Button>
                      {/* Build plan source checkboxes - compact */}
                      <div className="flex items-center gap-3 text-xs ml-2">
                        <label className="flex items-center gap-1 cursor-pointer" title="Existing Work Packets">
                          <Checkbox
                            checked={buildPlanSources.existingPackets}
                            onCheckedChange={(checked) => setBuildPlanSources(prev => ({ ...prev, existingPackets: checked === true }))}
                          />
                          <Package className="h-3 w-3 text-blue-500" />
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer" title="User Uploads">
                          <Checkbox
                            checked={buildPlanSources.userUploads}
                            onCheckedChange={(checked) => setBuildPlanSources(prev => ({ ...prev, userUploads: checked === true }))}
                          />
                          <Upload className="h-3 w-3 text-green-500" />
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer" title="Interview Data">
                          <Checkbox
                            checked={buildPlanSources.interviewData}
                            onCheckedChange={(checked) => setBuildPlanSources(prev => ({ ...prev, interviewData: checked === true }))}
                          />
                          <Mic className="h-3 w-3 text-purple-500" />
                        </label>
                      </div>
                    </div>

                    {/* Visual separator */}
                    <div className="hidden sm:block h-8 w-px bg-border" />

                    {/* Right side: Accept Build Plan button */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <Button
                          size="default"
                          className="bg-green-600 hover:bg-green-700 text-white gap-2"
                          onClick={handleAcceptAndGeneratePackets}
                          disabled={isGeneratingPackets || packetsToInclude === 0 || storedPlan?.status === "approved"}
                        >
                          {isGeneratingPackets ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : storedPlan?.status === "approved" ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <Rocket className="h-4 w-4" />
                          )}
                          {storedPlan?.status === "approved"
                            ? "Packets Added"
                            : "Accept Build Plan & Add Packets"}
                        </Button>
                        {storedPlan?.status !== "approved" && (
                          <span className="text-xs text-muted-foreground hidden md:inline">
                            ({packetsToInclude} packets)
                          </span>
                        )}
                      </div>
                      {/* Auto-research prior art checkbox */}
                      {storedPlan?.status !== "approved" && (
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground">
                          <Checkbox
                            checked={autoResearchPriorArt}
                            onCheckedChange={(checked) => setAutoResearchPriorArt(checked === true)}
                          />
                          <Search className="h-3 w-3 text-cyan-500" />
                          <span>Auto-research prior art</span>
                        </label>
                      )}
                    </div>
                  </div>
                )}

                {/* Revise Based on Feedback Button */}
                {!isLocked && hasChanges && storedPlan && (
                  <div className="flex justify-end pt-2 border-t border-border/50">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={reviseWithFeedback}
                      disabled={isRevising || isGenerating || !selectedProvider}
                    >
                      {isRevising ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      Revise Based on Feedback
                    </Button>
                  </div>
                )}

                {/* Generation status messages */}
                {(packetGenerationStatus || (isRevising && generationStatus)) && (
                  <div className="p-3 bg-primary/5 rounded-lg">
                    <div className="flex items-center gap-2">
                      {isGeneratingPackets || isRevising ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : (
                        <Package className="h-4 w-4 text-green-600" />
                      )}
                      <span className="text-sm">{packetGenerationStatus || generationStatus}</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
