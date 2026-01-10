"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  Quote,
  Edit2,
  Save,
  X,
  RefreshCw,
  Loader2,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Gamepad2
} from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Vision packet metadata interface
 */
interface VisionPacketMetadata {
  source?: string
  projectType?: string
  storeDescription?: string
  tagline?: string
  keyFeatures?: string[]
  targetAudience?: string
  uniqueSellingPoints?: string[]
  isVisionPacket?: boolean
  completionGate?: boolean
}

/**
 * Work packet with vision metadata
 */
interface VisionWorkPacket {
  id: string
  phaseId: string
  title: string
  description: string
  type: string
  priority: string
  status: string
  tasks: Array<{ id: string; description: string; completed: boolean; order: number }>
  acceptanceCriteria?: string[]
  metadata?: VisionPacketMetadata
}

/**
 * Editable vision content structure
 */
interface EditableVisionContent {
  tagline: string
  storeDescription: string
  keyFeatures: string[]
  uniqueSellingPoints: string[]
  targetAudience: string
}

interface VisionPacketEditorProps {
  packet: VisionWorkPacket
  isLocked: boolean
  projectId: string
  onSave?: (packetId: string, updatedMetadata: VisionPacketMetadata) => void
  className?: string
}

/**
 * Inline editor for vision packets within the build plan
 * Provides a compact view with expandable editing capabilities
 */
export function VisionPacketEditor({
  packet,
  isLocked,
  projectId,
  onSave,
  className
}: VisionPacketEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState<EditableVisionContent>({
    tagline: packet.metadata?.tagline || "",
    storeDescription: packet.metadata?.storeDescription || "",
    keyFeatures: [...(packet.metadata?.keyFeatures || [])],
    uniqueSellingPoints: [...(packet.metadata?.uniqueSellingPoints || [])],
    targetAudience: packet.metadata?.targetAudience || ""
  })
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Regenerate state
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [regeneratedContent, setRegeneratedContent] = useState<EditableVisionContent | null>(null)
  const [showRegeneratePreview, setShowRegeneratePreview] = useState(false)
  const [regenerateError, setRegenerateError] = useState<string | null>(null)

  // New feature/USP input state
  const [newFeature, setNewFeature] = useState("")
  const [newUSP, setNewUSP] = useState("")

  const meta = packet.metadata

  // Handle entering edit mode
  const handleStartEdit = () => {
    setEditedContent({
      tagline: meta?.tagline || "",
      storeDescription: meta?.storeDescription || "",
      keyFeatures: [...(meta?.keyFeatures || [])],
      uniqueSellingPoints: [...(meta?.uniqueSellingPoints || [])],
      targetAudience: meta?.targetAudience || ""
    })
    setIsEditing(true)
    setHasUnsavedChanges(false)
  }

  // Handle canceling edit
  const handleCancelEdit = () => {
    setEditedContent({
      tagline: meta?.tagline || "",
      storeDescription: meta?.storeDescription || "",
      keyFeatures: [...(meta?.keyFeatures || [])],
      uniqueSellingPoints: [...(meta?.uniqueSellingPoints || [])],
      targetAudience: meta?.targetAudience || ""
    })
    setIsEditing(false)
    setHasUnsavedChanges(false)
  }

  // Handle saving edits
  const handleSaveEdit = () => {
    if (!onSave) return

    const updatedMetadata: VisionPacketMetadata = {
      ...meta,
      tagline: editedContent.tagline,
      storeDescription: editedContent.storeDescription,
      keyFeatures: editedContent.keyFeatures,
      uniqueSellingPoints: editedContent.uniqueSellingPoints,
      targetAudience: editedContent.targetAudience
    }

    onSave(packet.id, updatedMetadata)
    setIsEditing(false)
    setHasUnsavedChanges(false)
  }

  // Handle field changes
  const updateField = (field: keyof EditableVisionContent, value: string | string[]) => {
    setEditedContent({ ...editedContent, [field]: value })
    setHasUnsavedChanges(true)
  }

  // Handle adding a new feature
  const addFeature = () => {
    if (!newFeature.trim()) return
    updateField("keyFeatures", [...editedContent.keyFeatures, newFeature.trim()])
    setNewFeature("")
  }

  // Handle removing a feature
  const removeFeature = (index: number) => {
    const updated = editedContent.keyFeatures.filter((_, i) => i !== index)
    updateField("keyFeatures", updated)
  }

  // Handle adding a new USP
  const addUSP = () => {
    if (!newUSP.trim()) return
    updateField("uniqueSellingPoints", [...editedContent.uniqueSellingPoints, newUSP.trim()])
    setNewUSP("")
  }

  // Handle removing a USP
  const removeUSP = (index: number) => {
    const updated = editedContent.uniqueSellingPoints.filter((_, i) => i !== index)
    updateField("uniqueSellingPoints", updated)
  }

  // Handle regenerating vision content
  const handleRegenerate = async () => {
    setIsRegenerating(true)
    setRegenerateError(null)

    try {
      const response = await fetch("/api/vision/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          currentContent: editedContent,
          projectType: meta?.projectType || "game"
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
      console.error("[VisionPacketEditor] Regeneration failed:", error)
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

  // Content to display
  const displayContent = isEditing ? editedContent : {
    tagline: meta?.tagline || "",
    storeDescription: meta?.storeDescription || "",
    keyFeatures: meta?.keyFeatures || [],
    uniqueSellingPoints: meta?.uniqueSellingPoints || [],
    targetAudience: meta?.targetAudience || ""
  }

  return (
    <>
      <div className={cn(
        "border-2 rounded-lg overflow-hidden",
        "border-purple-500/30 bg-gradient-to-br from-purple-500/5 via-purple-500/10 to-pink-500/5",
        className
      )}>
        {/* Header */}
        <div className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Gamepad2 className="h-4 w-4 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-yellow-400" />
                <span className="font-medium text-sm">{packet.title}</span>
                <Badge variant="outline" className="text-xs bg-purple-500/10 border-purple-500/30 text-purple-400">
                  vision
                </Badge>
                {isEditing && (
                  <Badge variant="outline" className="text-xs bg-yellow-500/10 border-yellow-500/30 text-yellow-400">
                    Editing
                  </Badge>
                )}
              </div>
              {displayContent.tagline && (
                <p className="text-xs text-muted-foreground italic mt-0.5">
                  "{displayContent.tagline}"
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isLocked && !isEditing && (
              <Button variant="outline" size="sm" onClick={handleStartEdit}>
                <Edit2 className="h-3 w-3 mr-1" />
                Edit
              </Button>
            )}
            {isEditing && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelEdit}
                  className="text-red-400 hover:text-red-300"
                >
                  <X className="h-3 w-3 mr-1" />
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
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-1" />
                  )}
                  Regenerate
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={!hasUnsavedChanges}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Save className="h-3 w-3 mr-1" />
                  Save
                </Button>
              </>
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

        {/* Expanded content */}
        {isExpanded && (
          <div className="px-3 pb-3 space-y-3 border-t border-purple-500/20">
            {/* Regenerate Error */}
            {regenerateError && (
              <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                {regenerateError}
              </div>
            )}

            {/* Tagline */}
            <div className="flex items-start gap-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 mt-3">
              <Quote className="h-3 w-3 text-yellow-500 flex-shrink-0 mt-1" />
              {isEditing ? (
                <Input
                  value={displayContent.tagline}
                  onChange={(e) => updateField("tagline", e.target.value)}
                  placeholder="Enter a catchy tagline..."
                  className="flex-1 h-8 text-sm bg-transparent border-yellow-500/30 text-yellow-200 placeholder:text-yellow-400/50"
                />
              ) : (
                <p className="text-xs font-medium italic text-yellow-200">
                  "{displayContent.tagline}"
                </p>
              )}
            </div>

            {/* Store Description */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-purple-400" />
                Store Description
              </label>
              {isEditing ? (
                <Textarea
                  value={displayContent.storeDescription}
                  onChange={(e) => updateField("storeDescription", e.target.value)}
                  placeholder="Enter store description..."
                  className="min-h-[100px] text-sm bg-background/50 border-border/50"
                />
              ) : (
                <ScrollArea className="h-[100px] rounded-lg border border-border/50 bg-background/50 p-2">
                  <p className="text-xs leading-relaxed whitespace-pre-wrap">
                    {displayContent.storeDescription}
                  </p>
                </ScrollArea>
              )}
            </div>

            {/* Key Features */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Lightbulb className="h-3 w-3 text-blue-400" />
                Key Features ({displayContent.keyFeatures.length})
              </label>
              <div className="grid grid-cols-1 gap-1">
                {displayContent.keyFeatures.map((feature, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-1.5 rounded bg-blue-500/5 border border-blue-500/20"
                  >
                    <CheckCircle2 className="h-3 w-3 text-blue-400 flex-shrink-0" />
                    {isEditing ? (
                      <>
                        <Input
                          value={feature}
                          onChange={(e) => {
                            const updated = [...displayContent.keyFeatures]
                            updated[i] = e.target.value
                            updateField("keyFeatures", updated)
                          }}
                          className="flex-1 h-7 text-xs bg-transparent border-blue-500/30"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                          onClick={() => removeFeature(i)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs">{feature}</span>
                    )}
                  </div>
                ))}
              </div>
              {isEditing && (
                <div className="flex items-center gap-2">
                  <Input
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addFeature()}
                    placeholder="Add new feature..."
                    className="flex-1 h-7 text-xs bg-blue-500/5 border-blue-500/20"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addFeature}
                    disabled={!newFeature.trim()}
                    className="h-7"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>

            {/* Unique Selling Points */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Target className="h-3 w-3 text-green-400" />
                Unique Selling Points ({displayContent.uniqueSellingPoints.length})
              </label>
              <div className="space-y-1">
                {displayContent.uniqueSellingPoints.map((usp, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-1.5 rounded bg-green-500/5 border border-green-500/20"
                  >
                    <Sparkles className="h-3 w-3 text-green-400 flex-shrink-0" />
                    {isEditing ? (
                      <>
                        <Input
                          value={usp}
                          onChange={(e) => {
                            const updated = [...displayContent.uniqueSellingPoints]
                            updated[i] = e.target.value
                            updateField("uniqueSellingPoints", updated)
                          }}
                          className="flex-1 h-7 text-xs bg-transparent border-green-500/30"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                          onClick={() => removeUSP(i)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs">{usp}</span>
                    )}
                  </div>
                ))}
              </div>
              {isEditing && (
                <div className="flex items-center gap-2">
                  <Input
                    value={newUSP}
                    onChange={(e) => setNewUSP(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addUSP()}
                    placeholder="Add unique selling point..."
                    className="flex-1 h-7 text-xs bg-green-500/5 border-green-500/20"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addUSP}
                    disabled={!newUSP.trim()}
                    className="h-7"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>

            {/* Target Audience */}
            <div className="flex items-start gap-2 p-2 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
              <Users className="h-3 w-3 text-cyan-400 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <span className="text-xs text-muted-foreground">Target Audience:</span>
                {isEditing ? (
                  <Input
                    value={displayContent.targetAudience}
                    onChange={(e) => updateField("targetAudience", e.target.value)}
                    placeholder="Who is this for?"
                    className="h-7 mt-1 text-xs bg-transparent border-cyan-500/30"
                  />
                ) : (
                  <p className="text-xs font-medium">{displayContent.targetAudience}</p>
                )}
              </div>
            </div>

            {/* Tasks */}
            {packet.tasks?.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-purple-500/20">
                <label className="text-xs font-medium text-muted-foreground">
                  Completion Criteria ({packet.tasks.filter(t => t.completed).length}/{packet.tasks.length})
                </label>
                <div className="grid grid-cols-1 gap-1">
                  {packet.tasks.map((task) => (
                    <div
                      key={task.id}
                      className={cn(
                        "flex items-center gap-2 p-1.5 rounded text-xs",
                        task.completed
                          ? "bg-green-500/10 text-green-400"
                          : "bg-muted/50 text-muted-foreground"
                      )}
                    >
                      <CheckCircle2
                        className={cn(
                          "h-3 w-3 flex-shrink-0",
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
            )}
          </div>
        )}
      </div>

      {/* Regenerate Preview Dialog */}
      <Dialog open={showRegeneratePreview} onOpenChange={setShowRegeneratePreview}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
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
            <div className="space-y-3 py-3">
              {/* Tagline */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Tagline</label>
                <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-sm font-medium italic text-yellow-200">
                    "{regeneratedContent.tagline}"
                  </p>
                </div>
              </div>

              {/* Store Description */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Store Description</label>
                <ScrollArea className="h-[100px] rounded-lg border border-border/50 bg-background/50 p-2">
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
                    <div key={i} className="flex items-center gap-2 p-1.5 rounded bg-blue-500/5 border border-blue-500/20 text-xs">
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
                    <div key={i} className="flex items-center gap-2 p-1.5 rounded bg-green-500/5 border border-green-500/20 text-xs">
                      <Sparkles className="h-3 w-3 text-green-400" />
                      {usp}
                    </div>
                  ))}
                </div>
              </div>

              {/* Target Audience */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Target Audience</label>
                <div className="p-2 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
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

/**
 * Check if a packet is a vision packet
 */
export function isVisionPacket(packet: { type?: string; metadata?: { isVisionPacket?: boolean } }): boolean {
  return packet.type === "vision" || packet.metadata?.isVisionPacket === true
}
