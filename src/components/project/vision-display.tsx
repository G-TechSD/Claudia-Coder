"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sparkles,
  Target,
  Users,
  Lightbulb,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Gamepad2,
  Star,
  Quote,
  Edit2,
  Save,
  X,
  RefreshCw,
  Loader2,
  Plus,
  Trash2
} from "lucide-react"
import { cn } from "@/lib/utils"

interface VisionPacketMetadata {
  source: string
  projectType: string
  storeDescription: string
  tagline: string
  keyFeatures: string[]
  targetAudience: string
  uniqueSellingPoints: string[]
  isVisionPacket: boolean
  completionGate: boolean
}

// Project types that should show game/creative UI
const GAME_CREATIVE_TYPES = ["game", "vr", "creative", "interactive"]

/**
 * Check if a project type should show game/creative UI
 */
function isGameCreativeType(projectType: string | undefined): boolean {
  if (!projectType) return false
  return GAME_CREATIVE_TYPES.includes(projectType.toLowerCase())
}

interface VisionPacket {
  id: string
  phaseId: string
  title: string
  description: string
  type: "vision"
  priority: string
  status: string
  tasks: Array<{ id: string; description: string; completed: boolean; order: number }>
  acceptanceCriteria: string[]
  metadata: VisionPacketMetadata
}

interface EditableVisionContent {
  tagline: string
  storeDescription: string
  keyFeatures: string[]
  uniqueSellingPoints: string[]
  targetAudience: string
}

interface VisionDisplayProps {
  projectId: string
  className?: string
}

/**
 * Displays the vision/store description for game and creative projects
 * Shows prominently at the top of the project overview when a vision packet exists
 * Now with edit and regenerate capabilities
 */
export function VisionDisplay({ projectId, className }: VisionDisplayProps) {
  const [visionPacket, setVisionPacket] = useState<VisionPacket | null>(null)
  const [isExpanded, setIsExpanded] = useState(true)
  const [loading, setLoading] = useState(true)

  // Edit state
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState<EditableVisionContent | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Regenerate state
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [regeneratedContent, setRegeneratedContent] = useState<EditableVisionContent | null>(null)
  const [showRegeneratePreview, setShowRegeneratePreview] = useState(false)
  const [regenerateError, setRegenerateError] = useState<string | null>(null)

  // New feature/USP input state
  const [newFeature, setNewFeature] = useState("")
  const [newUSP, setNewUSP] = useState("")

  // Load vision packet from localStorage
  useEffect(() => {
    if (!projectId) {
      setLoading(false)
      return
    }

    // Fetch vision packet from server
    const loadVision = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/packets`)
        const data = await response.json()
        if (data.success && Array.isArray(data.packets)) {
          // Find vision packet - it has type: "vision" or metadata.isVisionPacket: true
          const vision = data.packets.find((p: VisionPacket) =>
            p.type === "vision" || p.metadata?.isVisionPacket === true
          )

          if (vision) {
            setVisionPacket(vision)
            // Initialize editable content from the packet
            setEditedContent({
              tagline: vision.metadata?.tagline || "",
              storeDescription: vision.metadata?.storeDescription || "",
              keyFeatures: [...(vision.metadata?.keyFeatures || [])],
              uniqueSellingPoints: [...(vision.metadata?.uniqueSellingPoints || [])],
              targetAudience: vision.metadata?.targetAudience || ""
            })
          }
        }
      } catch (error) {
        console.error("[VisionDisplay] Failed to load vision packet:", error)
      } finally {
        setLoading(false)
      }
    }
    loadVision()
  }, [projectId])

  // Save vision packet to server
  const saveVisionPacket = useCallback(async (updatedMetadata: Partial<VisionPacketMetadata>) => {
    if (!visionPacket || !projectId) return

    try {
      // Use PATCH to update just this packet's metadata
      await fetch(`/api/projects/${projectId}/packets`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packetId: visionPacket.id,
          updates: { metadata: { ...visionPacket.metadata, ...updatedMetadata } }
        })
      })

      // Update local state
      setVisionPacket({
        ...visionPacket,
        metadata: {
          ...visionPacket.metadata,
          ...updatedMetadata
        }
      })
      console.log("[VisionDisplay] Vision packet saved successfully")
    } catch (error) {
      console.error("[VisionDisplay] Failed to save vision packet:", error)
    }
  }, [visionPacket, projectId])

  // Handle entering edit mode
  const handleStartEdit = () => {
    if (!visionPacket) return
    setEditedContent({
      tagline: visionPacket.metadata?.tagline || "",
      storeDescription: visionPacket.metadata?.storeDescription || "",
      keyFeatures: [...(visionPacket.metadata?.keyFeatures || [])],
      uniqueSellingPoints: [...(visionPacket.metadata?.uniqueSellingPoints || [])],
      targetAudience: visionPacket.metadata?.targetAudience || ""
    })
    setIsEditing(true)
    setHasUnsavedChanges(false)
  }

  // Handle canceling edit
  const handleCancelEdit = () => {
    if (!visionPacket) return
    // Reset to original values
    setEditedContent({
      tagline: visionPacket.metadata?.tagline || "",
      storeDescription: visionPacket.metadata?.storeDescription || "",
      keyFeatures: [...(visionPacket.metadata?.keyFeatures || [])],
      uniqueSellingPoints: [...(visionPacket.metadata?.uniqueSellingPoints || [])],
      targetAudience: visionPacket.metadata?.targetAudience || ""
    })
    setIsEditing(false)
    setHasUnsavedChanges(false)
  }

  // Handle saving edits
  const handleSaveEdit = () => {
    if (!editedContent) return

    saveVisionPacket({
      tagline: editedContent.tagline,
      storeDescription: editedContent.storeDescription,
      keyFeatures: editedContent.keyFeatures,
      uniqueSellingPoints: editedContent.uniqueSellingPoints,
      targetAudience: editedContent.targetAudience
    })

    setIsEditing(false)
    setHasUnsavedChanges(false)
  }

  // Handle field changes
  const updateField = (field: keyof EditableVisionContent, value: string | string[]) => {
    if (!editedContent) return
    setEditedContent({ ...editedContent, [field]: value })
    setHasUnsavedChanges(true)
  }

  // Handle adding a new feature
  const addFeature = () => {
    if (!newFeature.trim() || !editedContent) return
    updateField("keyFeatures", [...editedContent.keyFeatures, newFeature.trim()])
    setNewFeature("")
  }

  // Handle removing a feature
  const removeFeature = (index: number) => {
    if (!editedContent) return
    const updated = editedContent.keyFeatures.filter((_, i) => i !== index)
    updateField("keyFeatures", updated)
  }

  // Handle adding a new USP
  const addUSP = () => {
    if (!newUSP.trim() || !editedContent) return
    updateField("uniqueSellingPoints", [...editedContent.uniqueSellingPoints, newUSP.trim()])
    setNewUSP("")
  }

  // Handle removing a USP
  const removeUSP = (index: number) => {
    if (!editedContent) return
    const updated = editedContent.uniqueSellingPoints.filter((_, i) => i !== index)
    updateField("uniqueSellingPoints", updated)
  }

  // Handle regenerating vision content
  const handleRegenerate = async () => {
    if (!editedContent || !visionPacket) return

    setIsRegenerating(true)
    setRegenerateError(null)

    try {
      const response = await fetch("/api/vision/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          currentContent: editedContent,
          projectType: visionPacket.metadata?.projectType || "game"
        })
      })

      const data = await response.json()

      if (data.error) {
        setRegenerateError(data.error)
      } else if (data.regenerated) {
        setRegeneratedContent(data.regenerated)
        setShowRegeneratePreview(true)
      }
    } catch (error) {
      console.error("[VisionDisplay] Regeneration failed:", error)
      setRegenerateError(error instanceof Error ? error.message : "Regeneration failed")
    } finally {
      setIsRegenerating(false)
    }
  }

  // Accept regenerated content
  const handleAcceptRegenerated = () => {
    if (!regeneratedContent) return
    setEditedContent(regeneratedContent)
    setHasUnsavedChanges(true)
    setShowRegeneratePreview(false)
    setRegeneratedContent(null)
  }

  // Reject regenerated content
  const handleRejectRegenerated = () => {
    setShowRegeneratePreview(false)
    setRegeneratedContent(null)
  }

  // Don't render anything if no vision packet
  if (loading || !visionPacket) {
    return null
  }

  const meta = visionPacket.metadata

  // Don't render game UI for non-game projects
  // Only show this component for game, vr, creative, and interactive projects
  const isGameProject = isGameCreativeType(meta?.projectType)

  // Don't render anything for non-game projects
  // This prevents showing "Game Vision & Story" UI for projects like "AI Fish Tank Monitor"
  if (!isGameProject) {
    return null
  }

  const completedTasks = visionPacket.tasks.filter(t => t.completed).length
  const totalTasks = visionPacket.tasks.length
  const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  // Use edited content when editing, otherwise use metadata (with fallbacks for missing meta)
  const displayContent = isEditing && editedContent ? editedContent : {
    tagline: meta?.tagline ?? "",
    storeDescription: meta?.storeDescription ?? "",
    keyFeatures: meta?.keyFeatures || [],
    uniqueSellingPoints: meta?.uniqueSellingPoints || [],
    targetAudience: meta?.targetAudience ?? ""
  }

  return (
    <>
      <Card className={cn(
        "border-2 border-purple-500/30 bg-gradient-to-br from-purple-500/5 via-purple-500/10 to-pink-500/5",
        className
      )}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Gamepad2 className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-yellow-400" />
                  Game Vision & Story
                  {isEditing && (
                    <Badge variant="outline" className="text-xs bg-yellow-500/10 border-yellow-500/30 text-yellow-400">
                      Editing
                    </Badge>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="outline" className="text-xs bg-purple-500/10 border-purple-500/30 text-purple-400">
                    {meta.projectType || "Game"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {completionPercent}% complete
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Edit/Save/Cancel buttons */}
              {isEditing ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelEdit}
                    className="text-red-400 hover:text-red-300"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRegenerate}
                    disabled={isRegenerating}
                    className="text-purple-400 hover:text-purple-300"
                  >
                    {isRegenerating ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-1" />
                    )}
                    Regenerate
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={!hasUnsavedChanges}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStartEdit}
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="space-y-4">
            {/* Regenerate Error */}
            {regenerateError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                {regenerateError}
              </div>
            )}

            {/* Tagline */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <Quote className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
              {isEditing ? (
                <Input
                  value={displayContent.tagline}
                  onChange={(e) => updateField("tagline", e.target.value)}
                  placeholder="Enter a catchy tagline..."
                  className="flex-1 bg-transparent border-yellow-500/30 text-yellow-200 placeholder:text-yellow-400/50"
                />
              ) : (
                <p className="text-sm font-medium italic text-yellow-200">
                  "{displayContent.tagline}"
                </p>
              )}
            </div>

            {/* Store Description */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Star className="h-4 w-4 text-purple-400" />
                About This Game
              </h4>
              {isEditing ? (
                <Textarea
                  value={displayContent.storeDescription}
                  onChange={(e) => updateField("storeDescription", e.target.value)}
                  placeholder="Enter store description..."
                  className="min-h-[200px] bg-background/50 border-border/50"
                />
              ) : (
                <ScrollArea className="h-[200px] rounded-lg border border-border/50 bg-background/50 p-4">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {displayContent.storeDescription}
                    </p>
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* Key Features */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-blue-400" />
                Key Features
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {displayContent.keyFeatures.map((feature, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 p-2 rounded-lg bg-blue-500/5 border border-blue-500/20"
                  >
                    <CheckCircle2 className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    {isEditing ? (
                      <>
                        <Input
                          value={feature}
                          onChange={(e) => {
                            const updated = [...displayContent.keyFeatures]
                            updated[i] = e.target.value
                            updateField("keyFeatures", updated)
                          }}
                          className="flex-1 h-8 text-sm bg-transparent border-blue-500/30"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                          onClick={() => removeFeature(i)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <span className="text-sm">{feature}</span>
                    )}
                  </div>
                ))}
              </div>
              {isEditing && (
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addFeature()}
                    placeholder="Add new feature..."
                    className="flex-1 h-8 text-sm bg-blue-500/5 border-blue-500/20"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addFeature}
                    disabled={!newFeature.trim()}
                    className="h-8"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Unique Selling Points */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Target className="h-4 w-4 text-green-400" />
                What Makes This Special
              </h4>
              <div className="space-y-1">
                {displayContent.uniqueSellingPoints.map((usp, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 p-2 rounded-lg bg-green-500/5 border border-green-500/20"
                  >
                    <Sparkles className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                    {isEditing ? (
                      <>
                        <Input
                          value={usp}
                          onChange={(e) => {
                            const updated = [...displayContent.uniqueSellingPoints]
                            updated[i] = e.target.value
                            updateField("uniqueSellingPoints", updated)
                          }}
                          className="flex-1 h-8 text-sm bg-transparent border-green-500/30"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                          onClick={() => removeUSP(i)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <span className="text-sm">{usp}</span>
                    )}
                  </div>
                ))}
              </div>
              {isEditing && (
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    value={newUSP}
                    onChange={(e) => setNewUSP(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addUSP()}
                    placeholder="Add unique selling point..."
                    className="flex-1 h-8 text-sm bg-green-500/5 border-green-500/20"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addUSP}
                    disabled={!newUSP.trim()}
                    className="h-8"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Target Audience */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
              <Users className="h-4 w-4 text-cyan-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="text-xs text-muted-foreground">Target Audience:</span>
                {isEditing ? (
                  <Input
                    value={displayContent.targetAudience}
                    onChange={(e) => updateField("targetAudience", e.target.value)}
                    placeholder="Who is this for?"
                    className="mt-1 bg-transparent border-cyan-500/30"
                  />
                ) : (
                  <p className="text-sm font-medium">{displayContent.targetAudience}</p>
                )}
              </div>
            </div>

            {/* Completion Criteria */}
            <div className="space-y-2 pt-2 border-t border-border/50">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Vision Completion Criteria
              </h4>
              <div className="grid grid-cols-1 gap-1">
                {visionPacket.tasks.map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg text-sm",
                      task.completed
                        ? "bg-green-500/10 text-green-400"
                        : "bg-muted/50 text-muted-foreground"
                    )}
                  >
                    <CheckCircle2
                      className={cn(
                        "h-4 w-4 flex-shrink-0",
                        task.completed ? "text-green-400" : "text-muted-foreground/50"
                      )}
                    />
                    <span className={task.completed ? "line-through" : ""}>
                      {task.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Regenerate Preview Dialog */}
      <Dialog open={showRegeneratePreview} onOpenChange={setShowRegeneratePreview}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-purple-400" />
              Regenerated Vision Preview
            </DialogTitle>
            <DialogDescription>
              Review the AI-enhanced vision content. Accept to use these changes or reject to keep your current edits.
            </DialogDescription>
          </DialogHeader>

          {regeneratedContent && (
            <div className="space-y-4 py-4">
              {/* Tagline */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Tagline</label>
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-sm font-medium italic text-yellow-200">
                    "{regeneratedContent.tagline}"
                  </p>
                </div>
              </div>

              {/* Store Description */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Store Description</label>
                <ScrollArea className="h-[150px] rounded-lg border border-border/50 bg-background/50 p-4">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {regeneratedContent.storeDescription}
                  </p>
                </ScrollArea>
              </div>

              {/* Key Features */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Key Features</label>
                <div className="grid grid-cols-1 gap-1">
                  {regeneratedContent.keyFeatures.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded bg-blue-500/5 border border-blue-500/20 text-sm">
                      <CheckCircle2 className="h-3 w-3 text-blue-400" />
                      {feature}
                    </div>
                  ))}
                </div>
              </div>

              {/* USPs */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Unique Selling Points</label>
                <div className="grid grid-cols-1 gap-1">
                  {regeneratedContent.uniqueSellingPoints.map((usp, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded bg-green-500/5 border border-green-500/20 text-sm">
                      <Sparkles className="h-3 w-3 text-green-400" />
                      {usp}
                    </div>
                  ))}
                </div>
              </div>

              {/* Target Audience */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Target Audience</label>
                <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
                  <p className="text-sm">{regeneratedContent.targetAudience}</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleRejectRegenerated}>
              <X className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button onClick={handleAcceptRegenerated} className="bg-green-600 hover:bg-green-700">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Accept Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
