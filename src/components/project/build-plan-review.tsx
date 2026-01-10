"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  Rocket,
  Loader2,
  Package,
  CheckCircle2,
  Edit2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  FileText,
  X,
  Plus,
  Save,
  Server,
  Cloud,
  Terminal,
  DollarSign,
  Building2,
  Brain,
  Code,
  Zap
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { BuildPlan, WorkPacket, PacketSummary } from "@/lib/ai/build-plan"
import { savePackets, saveBuildPlan } from "@/lib/ai/build-plan"

interface BuildPlanReviewProps {
  projectId: string
  projectName: string
  projectDescription: string
  buildPlan: BuildPlan
  packetSummary?: PacketSummary
  planSource?: { server?: string; model?: string }
  monetizationIntent?: boolean
  onApproveAndStart: (buildPlan: BuildPlan, packets: WorkPacket[]) => void
  onEditBuildPlan: () => void
  onRegenerate: (model?: string) => void
  onCancel: () => void
  isRegenerating?: boolean
  className?: string
}

interface EditableObjective {
  id: string
  text: string
  isEditing: boolean
  isOriginal: boolean
  isDeleted: boolean
}

// Model options for regeneration - matching build-plan-editor.tsx
// Each option can specify both a server (provider) and a specific model
const REGENERATION_MODEL_OPTIONS = [
  // Auto - let system decide
  { value: "auto", label: "Auto (let system decide)", type: "auto", icon: "sparkles", server: null, model: null },
  // Claudia Coder (special paid option)
  { value: "paid_claudecode", label: "Claudia Coder (Paid)", type: "paid", icon: "terminal", server: "paid_claudecode", model: null },
  // Paid cloud models
  { value: "chatgpt", label: "ChatGPT (OpenAI)", type: "paid", icon: "cloud", server: "chatgpt", model: null },
  { value: "gemini", label: "Gemini (Google)", type: "paid", icon: "cloud", server: "gemini", model: null },
  { value: "anthropic", label: "Anthropic Claude", type: "paid", icon: "cloud", server: "anthropic", model: null },
  // Specific local models - Beast server
  { value: "Beast:gpt-oss-20b", label: "gpt-oss-20b (Beast - larger, better structure)", type: "local-model", icon: "brain", server: "Beast", model: "gpt-oss-20b" },
  { value: "Beast:phind-codellama-34b-v2", label: "phind-codellama-34b-v2 (Beast - code focused)", type: "local-model", icon: "code", server: "Beast", model: "phind-codellama-34b-v2" },
  // Specific local models - Bedroom server
  { value: "Bedroom:ministral-3-3b", label: "ministral-3-3b (Bedroom - smaller, faster)", type: "local-model", icon: "zap", server: "Bedroom", model: "ministral-3-3b" },
  // Generic server selection (uses whatever model is loaded)
  { value: "Beast", label: "Beast (use loaded model)", type: "local", icon: "server", server: "Beast", model: null },
  { value: "Bedroom", label: "Bedroom (use loaded model)", type: "local", icon: "server", server: "Bedroom", model: null },
] as const

export function BuildPlanReview({
  projectId,
  projectName,
  projectDescription,
  buildPlan,
  packetSummary,
  planSource,
  monetizationIntent,
  onApproveAndStart,
  onEditBuildPlan,
  onRegenerate,
  onCancel,
  isRegenerating = false,
  className
}: BuildPlanReviewProps) {
  // Editable state
  const [editedPlan, setEditedPlan] = useState<BuildPlan>(buildPlan)
  const [objectives, setObjectives] = useState<EditableObjective[]>([])
  const [newObjective, setNewObjective] = useState("")
  const [expandedPackets, setExpandedPackets] = useState<Set<string>>(new Set())
  const [packetPriorities, setPacketPriorities] = useState<Record<string, string>>({})
  const [regenerationModel, setRegenerationModel] = useState<string>("auto")
  const [isApproving, setIsApproving] = useState(false)

  // Initialize editable state from build plan
  useEffect(() => {
    setObjectives(
      buildPlan.spec.objectives.map((obj, i) => ({
        id: `obj-${i}`,
        text: obj,
        isEditing: false,
        isOriginal: true,
        isDeleted: false
      }))
    )

    // Initialize packet priorities
    const priorities: Record<string, string> = {}
    buildPlan.packets.forEach(packet => {
      priorities[packet.id] = packet.priority
    })
    setPacketPriorities(priorities)

    setEditedPlan(buildPlan)
  }, [buildPlan])

  // Objective management
  const addObjective = () => {
    if (!newObjective.trim()) return
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
    setObjectives(objectives.map(o =>
      o.id === id ? { ...o, isDeleted: true } : o
    ))
  }

  const updateObjective = (id: string, text: string) => {
    setObjectives(objectives.map(o =>
      o.id === id ? { ...o, text, isEditing: false } : o
    ))
  }

  const toggleObjectiveEdit = (id: string) => {
    setObjectives(objectives.map(o =>
      o.id === id ? { ...o, isEditing: !o.isEditing } : o
    ))
  }

  // Packet management
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

  const setPacketPriority = (packetId: string, priority: string) => {
    setPacketPriorities(prev => ({ ...prev, [packetId]: priority }))
  }

  // Handle approve and start building
  const handleApproveAndStart = useCallback(async () => {
    setIsApproving(true)

    try {
      // Build final packets with updated priorities
      const finalPackets: WorkPacket[] = editedPlan.packets.map(packet => ({
        ...packet,
        priority: (packetPriorities[packet.id] || packet.priority) as WorkPacket["priority"],
        status: "queued" as const
      }))

      // Update plan with edited objectives
      const finalPlan: BuildPlan = {
        ...editedPlan,
        spec: {
          ...editedPlan.spec,
          objectives: objectives
            .filter(o => !o.isDeleted)
            .map(o => o.text)
        },
        packets: finalPackets,
        status: "approved"
      }

      // Save to localStorage
      saveBuildPlan(projectId, finalPlan)
      savePackets(projectId, finalPackets)

      // Call parent handler
      onApproveAndStart(finalPlan, finalPackets)
    } catch (error) {
      console.error("Failed to approve build plan:", error)
    } finally {
      setIsApproving(false)
    }
  }, [editedPlan, objectives, packetPriorities, projectId, onApproveAndStart])

  const handleRegenerate = () => {
    // Find the selected model option to get server and model info
    const modelOption = REGENERATION_MODEL_OPTIONS.find(m => m.value === regenerationModel)
    // For "auto", pass undefined to let parent decide
    // For specific models, pass a formatted string "server:model" or just "server"
    if (modelOption?.model) {
      onRegenerate(`${modelOption.server}:${modelOption.model}`)
    } else if (modelOption?.server) {
      onRegenerate(modelOption.server)
    } else {
      onRegenerate(undefined) // Auto mode
    }
  }

  const visibleObjectives = objectives.filter(o => !o.isDeleted)
  const totalPackets = editedPlan.packets.length

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-2xl font-bold">Review Build Plan</h1>
          {monetizationIntent && (
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
              <DollarSign className="h-3 w-3 mr-1" />
              Business Ready
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground">
          Review and customize before starting development
        </p>
      </div>

      {/* Plan Source Info */}
      {planSource && (
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {editedPlan.spec.name}
            </CardTitle>
            <CardDescription>{editedPlan.spec.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              <span>Generated by:</span>
              <Badge variant="outline" className="text-xs">
                {planSource.server || "Local"}
              </Badge>
              {planSource.model && (
                <span className="opacity-70">{planSource.model.split("/").pop()}</span>
              )}
            </div>
            {packetSummary && (
              <div className="mt-2 text-xs text-muted-foreground">
                {packetSummary.summary}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Business Development Notice */}
      {monetizationIntent && (
        <Card className="bg-green-500/5 border-green-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-5 w-5 text-green-600" />
              Business Development Included
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              Since you indicated monetization plans, this build includes business development packets:
            </p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Revenue model research & validation</li>
              <li>Payment integration planning</li>
              <li>User analytics & conversion tracking</li>
              <li>Terms of service & privacy policy</li>
            </ul>
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
              {obj.isEditing ? (
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
            </div>
          ))}
          {/* Add new objective */}
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
        </CardContent>
      </Card>

      {/* Tech Stack */}
      {editedPlan.spec.techStack?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tech Stack</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {editedPlan.spec.techStack.map((tech, i) => (
                <Badge key={i} variant="outline">{tech}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Work Packets List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Work Packets ({totalPackets})
              </CardTitle>
              <CardDescription>
                Discrete work items to be executed
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {editedPlan.packets.map((packet) => {
                const isExpanded = expandedPackets.has(packet.id)
                const priority = packetPriorities[packet.id] || packet.priority

                return (
                  <div
                    key={packet.id}
                    className="border rounded-lg overflow-hidden"
                  >
                    {/* Packet header */}
                    <div
                      className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => togglePacketExpand(packet.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{packet.title}</span>
                            <Badge variant="outline" className="text-xs capitalize">
                              {packet.type}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs capitalize",
                                priority === "critical" && "border-red-500 text-red-500",
                                priority === "high" && "border-orange-500 text-orange-500",
                                priority === "medium" && "border-yellow-500 text-yellow-500",
                                priority === "low" && "border-gray-400 text-gray-400"
                              )}
                            >
                              {priority}
                            </Badge>
                            {packet.existing && (
                              <Badge variant="secondary" className="text-xs">Existing</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {packet.description}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm">
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
                      <div className="px-3 pb-3 border-t bg-muted/30 space-y-3">
                        {/* Priority selector */}
                        <div className="flex items-center gap-3 pt-3">
                          <span className="text-xs text-muted-foreground">Priority:</span>
                          {(["low", "medium", "high", "critical"] as const).map((p) => (
                            <label key={p} className="flex items-center gap-1 cursor-pointer">
                              <Checkbox
                                checked={priority === p}
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

                        {/* Tasks */}
                        {packet.tasks?.length > 0 && (
                          <div>
                            <p className="text-xs font-medium mb-1">Tasks:</p>
                            <ul className="text-xs text-muted-foreground space-y-1">
                              {packet.tasks.map((task, i) => (
                                <li key={task.id || i} className="flex items-start gap-1">
                                  <span className="text-muted-foreground">-</span>
                                  {task.description}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Acceptance Criteria */}
                        {packet.acceptanceCriteria?.length > 0 && (
                          <div>
                            <p className="text-xs font-medium mb-1">Acceptance Criteria:</p>
                            <ul className="text-xs text-muted-foreground space-y-1">
                              {packet.acceptanceCriteria.map((criterion, i) => (
                                <li key={i} className="flex items-start gap-1">
                                  <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                                  {criterion}
                                </li>
                              ))}
                            </ul>
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

      {/* Action Buttons */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            {/* Top row: Regenerate options */}
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
                        {model.icon === "terminal" ? (
                          <Terminal className="h-3 w-3 text-purple-500" />
                        ) : (
                          <Cloud className="h-3 w-3 text-blue-500" />
                        )}
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
                onClick={handleRegenerate}
                disabled={isRegenerating}
              >
                {isRegenerating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Regenerate
              </Button>
              <Button variant="outline" onClick={onEditBuildPlan}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit Plan
              </Button>
            </div>

            {/* Bottom row: Main actions */}
            <div className="flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
              <Button
                size="lg"
                className="bg-green-600 hover:bg-green-700 text-white gap-2 px-8"
                onClick={handleApproveAndStart}
                disabled={isApproving || totalPackets === 0}
              >
                {isApproving ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Rocket className="h-5 w-5" />
                )}
                Start Building
                <Badge variant="secondary" className="ml-1 bg-white/20">
                  {totalPackets} packets
                </Badge>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
