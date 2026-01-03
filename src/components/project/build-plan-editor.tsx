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
  Info
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { BuildPlan } from "@/lib/ai/build-plan"
import type { StoredBuildPlan, ProjectStatus } from "@/lib/data/types"
import {
  getBuildPlanForProject,
  createBuildPlan,
  updateBuildPlan,
  approveBuildPlan,
  formatFeedbackForRevision
} from "@/lib/data/build-plans"

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
  providers: ProviderOption[]
  selectedProvider: string | null
  onProviderChange: (provider: string) => void
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

export function BuildPlanEditor({
  projectId,
  projectName,
  projectDescription,
  projectStatus,
  providers,
  selectedProvider,
  onProviderChange,
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

  // Auto-save timer
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Check if plan is locked (project is active or beyond)
  const isLocked = storedPlan?.status === "locked" ||
    projectStatus === "active" ||
    projectStatus === "completed" ||
    projectStatus === "archived"

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
      const newPlan = createBuildPlan({
        projectId,
        originalPlan: {
          spec: buildPlan.spec,
          phases: buildPlan.phases.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            order: p.order
          })),
          packets: buildPlan.packets.map(p => ({
            id: p.id,
            phaseId: p.phaseId,
            title: p.title,
            description: p.description,
            type: p.type,
            priority: p.priority,
            tasks: p.tasks,
            acceptanceCriteria: p.acceptanceCriteria
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
    setGenerationStatus("Connecting to AI provider...")

    try {
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
          preferredProvider: selectedProvider
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
        const newPlan = createBuildPlan({
          projectId,
          originalPlan: {
            spec: data.plan.spec,
            phases: data.plan.phases.map((p: { id: string; name: string; description: string; order: number }) => ({
              id: p.id,
              name: p.name,
              description: p.description,
              order: p.order
            })),
            packets: data.plan.packets.map((p: { id: string; phaseId: string; title: string; description: string; type: string; priority: string; tasks: Array<{ id: string; description: string; completed: boolean; order: number }>; acceptanceCriteria: string[] }) => ({
              id: p.id,
              phaseId: p.phaseId,
              title: p.title,
              description: p.description,
              type: p.type,
              priority: p.priority,
              tasks: p.tasks,
              acceptanceCriteria: p.acceptanceCriteria
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
  const approvedCount = Object.values(packetFeedback).filter(f => f.approved === true).length
  const rejectedCount = Object.values(packetFeedback).filter(f => f.approved === false).length
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
                <SelectContent>
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
                <div className="flex items-center gap-2">
                  <Badge variant={storedPlan?.status === "approved" ? "default" : "secondary"}>
                    {storedPlan?.status || "draft"}
                  </Badge>
                  {!isLocked && (
                    <Button variant="outline" size="sm" onClick={generateBuildPlan} disabled={isGenerating || isRevising}>
                      <RefreshCw className={cn("h-4 w-4 mr-1", isGenerating && "animate-spin")} />
                      Regenerate
                    </Button>
                  )}
                </div>
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
                              <p className="text-sm text-muted-foreground">{packet.description}</p>

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

          {/* Actions */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {approvedCount} packets approved, {rejectedCount} rejected
                  {hasChanges && !isLocked && (
                    <span className="ml-2 text-primary">• You have pending changes</span>
                  )}
                </div>
                <div className="flex gap-2">
                  {!isLocked && (
                    <>
                      {hasChanges && storedPlan && (
                        <Button
                          variant="outline"
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
                      )}
                      <Button
                        onClick={handleApprovePlan}
                        disabled={approvedCount === 0 || storedPlan?.status === "approved"}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        {storedPlan?.status === "approved" ? "Approved" : `Approve Plan (${approvedCount} packets)`}
                      </Button>
                    </>
                  )}
                  {isLocked && (
                    <Badge variant="outline" className="text-amber-600">
                      <Lock className="h-3 w-3 mr-1" />
                      Locked
                    </Badge>
                  )}
                </div>
              </div>

              {/* Loading status for revision */}
              {isRevising && generationStatus && (
                <div className="mt-4 p-4 bg-primary/5 rounded-lg">
                  <div className="flex items-center justify-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-sm">{generationStatus}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
