"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Brain,
  FileText,
  CheckCircle2,
  Lightbulb,
  HelpCircle,
  Loader2,
  AlertCircle,
  Play,
  Pause,
  ChevronDown,
  ChevronUp,
  Package,
  RefreshCw,
  Mic,
  Sparkles
} from "lucide-react"
import { cn } from "@/lib/utils"
import type {
  BrainDump,
  ProcessedBrainDump,
  BrainDumpSection,
  ActionItem,
  Decision
} from "@/lib/data/types"
import {
  getBrainDump,
  updateBrainDump,
  getResourceBlob,
  getResourceBlobUrl
} from "@/lib/data/resources"
import { PacketApprovalDialog } from "@/components/project/packet-approval-dialog"
import type { ProposedPacket } from "@/app/api/brain-dump/packetize/route"

interface ProjectContext {
  hasBuildPlan: boolean
  hasPackets: boolean
  currentPhase?: string
  recentActivity?: string[]
}

interface BrainDumpReviewProps {
  brainDumpId: string
  projectId?: string
  projectName?: string
  projectDescription?: string
  existingProjectContext?: ProjectContext  // If provided, enables smart packetize
  onComplete?: () => void
  onConvertToPackets?: (items: ActionItem[]) => void
  onPacketsApproved?: (packets: ProposedPacket[]) => void
  className?: string
}

export function BrainDumpReview({
  brainDumpId,
  projectId,
  projectName,
  projectDescription,
  existingProjectContext,
  onComplete,
  onConvertToPackets,
  onPacketsApproved,
  className
}: BrainDumpReviewProps) {
  const [brainDump, setBrainDump] = useState<BrainDump | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isPacketizing, setIsPacketizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  // Packetize state
  const [proposedPackets, setProposedPackets] = useState<ProposedPacket[]>([])
  const [showPacketApproval, setShowPacketApproval] = useState(false)

  // Check if this is an existing project
  const isExistingProject = existingProjectContext?.hasBuildPlan || existingProjectContext?.hasPackets

  // Audio element ref
  const audioRef = useState<HTMLAudioElement | null>(null)

  useEffect(() => {
    loadBrainDump()
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [brainDumpId])

  async function loadBrainDump() {
    const dump = getBrainDump(brainDumpId)
    if (dump) {
      setBrainDump(dump)

      // Load audio URL for playback
      if (dump.resourceId) {
        try {
          const resource = await import("@/lib/data/resources").then(m => m.getResource(dump.resourceId))
          if (resource?.storage === "indexeddb" && resource.indexedDbKey) {
            const blob = await getResourceBlob(resource.indexedDbKey)
            if (blob) {
              setAudioBlob(blob)
              const url = URL.createObjectURL(blob)
              setAudioUrl(url)
            }
          }
        } catch (err) {
          console.error("Failed to load audio:", err)
        }
      }
    }
  }

  async function retryTranscription() {
    if (!audioBlob || !brainDump) return

    setIsTranscribing(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("file", audioBlob, "recording.webm")

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData
      })

      const data = await response.json()

      if (data.success && data.transcription) {
        const updated = updateBrainDump(brainDumpId, {
          transcription: data.transcription,
          status: "review"
        })
        if (updated) setBrainDump(updated)
      } else if (data.useBrowserFallback) {
        setError("No transcription service available. Configure NEXT_PUBLIC_WHISPER_URL or OPENAI_API_KEY.")
      } else {
        throw new Error(data.error || "Transcription failed")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed")
    } finally {
      setIsTranscribing(false)
    }
  }

  async function processTranscript() {
    if (!brainDump?.transcription?.text) return

    setIsProcessing(true)
    setError(null)

    try {
      const response = await fetch("/api/brain-dump/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: brainDump.transcription.text,
          projectName,
          projectDescription
        })
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      if (data.processedContent) {
        const updated = updateBrainDump(brainDumpId, {
          processedContent: data.processedContent,
          status: "review"
        })
        if (updated) setBrainDump(updated)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed")
    } finally {
      setIsProcessing(false)
    }
  }

  function toggleSection(sectionId: string) {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      return next
    })
  }

  function toggleSectionApproval(sectionId: string, approved: boolean) {
    if (!brainDump?.processedContent) return

    const updatedSections = brainDump.processedContent.sections.map(s =>
      s.id === sectionId ? { ...s, approved } : s
    )

    const updated = updateBrainDump(brainDumpId, {
      processedContent: {
        ...brainDump.processedContent,
        sections: updatedSections
      }
    })
    if (updated) setBrainDump(updated)
  }

  function toggleActionApproval(actionId: string, approved: boolean) {
    if (!brainDump?.processedContent) return

    const updatedActions = brainDump.processedContent.actionItems.map(a =>
      a.id === actionId ? { ...a, approved } : a
    )

    const updated = updateBrainDump(brainDumpId, {
      processedContent: {
        ...brainDump.processedContent,
        actionItems: updatedActions
      }
    })
    if (updated) setBrainDump(updated)
  }

  function toggleDecisionApproval(decisionId: string, approved: boolean) {
    if (!brainDump?.processedContent) return

    const updatedDecisions = brainDump.processedContent.decisions.map(d =>
      d.id === decisionId ? { ...d, approved } : d
    )

    const updated = updateBrainDump(brainDumpId, {
      processedContent: {
        ...brainDump.processedContent,
        decisions: updatedDecisions
      }
    })
    if (updated) setBrainDump(updated)
  }

  function handleConvertToPackets() {
    if (!brainDump?.processedContent) return

    const approvedActions = brainDump.processedContent.actionItems.filter(a => a.approved)
    if (approvedActions.length > 0) {
      onConvertToPackets?.(approvedActions)
    }
  }

  function markComplete() {
    if (!brainDump) return

    updateBrainDump(brainDumpId, { status: "completed" })
    onComplete?.()
  }

  /**
   * Smart packetize using LLM to extract categorized work items
   */
  async function smartPacketize() {
    if (!brainDump?.transcription?.text || !projectId) return

    setIsPacketizing(true)
    setError(null)

    try {
      const response = await fetch("/api/brain-dump/packetize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: brainDump.transcription.text,
          projectId,
          projectName,
          projectDescription,
          existingContext: existingProjectContext
        })
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      if (data.proposedPackets && data.proposedPackets.length > 0) {
        setProposedPackets(data.proposedPackets)
        setShowPacketApproval(true)
      } else {
        setError("No actionable items were extracted from the transcript.")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Packetization failed")
    } finally {
      setIsPacketizing(false)
    }
  }

  /**
   * Handle packet approval from dialog
   */
  const handlePacketsApproved = useCallback((approvedPackets: Array<ProposedPacket & { approvedPriority: string }>) => {
    setShowPacketApproval(false)

    // Update brain dump status
    updateBrainDump(brainDumpId, {
      status: "completed"
    })
    setBrainDump(prev => prev ? { ...prev, status: "completed" } : null)

    // Notify parent of approved packets
    onPacketsApproved?.(approvedPackets)
  }, [brainDumpId, onPacketsApproved])

  /**
   * Handle dismissing all packets
   */
  const handleDismissPackets = useCallback(() => {
    setShowPacketApproval(false)
    setProposedPackets([])
  }, [])

  if (!brainDump) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Loading brain dump...</p>
        </CardContent>
      </Card>
    )
  }

  const processed = brainDump.processedContent

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                Brain Dump Review
              </CardTitle>
              <CardDescription>
                Review and approve extracted content
              </CardDescription>
            </div>
            <Badge variant={
              brainDump.status === "completed" ? "default" :
              brainDump.status === "review" ? "secondary" :
              "outline"
            }>
              {brainDump.status}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Transcript */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Transcript
              </span>
              {audioUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const audio = document.getElementById("brain-dump-audio") as HTMLAudioElement
                    if (audio) {
                      if (isPlaying) {
                        audio.pause()
                      } else {
                        audio.play()
                      }
                      setIsPlaying(!isPlaying)
                    }
                  }}
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {audioUrl && (
              <audio
                id="brain-dump-audio"
                src={audioUrl}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
              />
            )}

            {brainDump.transcription?.text ? (
              <ScrollArea className="h-[400px]">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {brainDump.transcription.text}
                </p>
              </ScrollArea>
            ) : (
              <div className="text-center py-8">
                <Mic className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">No transcription available yet</p>
                {audioBlob && (
                  <Button
                    onClick={retryTranscription}
                    disabled={isTranscribing}
                  >
                    {isTranscribing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Transcribing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Transcribe Now
                      </>
                    )}
                  </Button>
                )}
                {!audioBlob && (
                  <p className="text-sm text-yellow-600">Audio file not found in storage</p>
                )}
              </div>
            )}

            {brainDump.transcription?.text && !processed && (
              <Button
                className="w-full mt-4"
                onClick={processTranscript}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing with AI...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    Process with AI
                  </>
                )}
              </Button>
            )}

            {error && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-500">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Processed Content */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Structured Content
            </CardTitle>
          </CardHeader>
          <CardContent>
            {processed ? (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="p-3 bg-primary/5 rounded-lg">
                    <p className="text-sm font-medium mb-1">Summary</p>
                    <p className="text-sm text-muted-foreground">{processed.summary}</p>
                  </div>

                  {/* Sections */}
                  {processed.sections.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Sections ({processed.sections.length})</p>
                      <div className="space-y-2">
                        {processed.sections.map(section => (
                          <div
                            key={section.id}
                            className={cn(
                              "p-3 border rounded-lg",
                              section.approved && "border-green-500/50 bg-green-500/5"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={section.approved}
                                onCheckedChange={(checked) =>
                                  toggleSectionApproval(section.id, checked as boolean)
                                }
                              />
                              <button
                                onClick={() => toggleSection(section.id)}
                                className="flex-1 flex items-center justify-between text-left"
                              >
                                <span className="text-sm font-medium">{section.title}</span>
                                {expandedSections.has(section.id) ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </button>
                              <Badge variant="outline" className="text-xs">
                                {section.type}
                              </Badge>
                            </div>
                            {expandedSections.has(section.id) && (
                              <p className="mt-2 text-sm text-muted-foreground pl-6">
                                {section.content}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Items */}
                  {processed.actionItems.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Action Items ({processed.actionItems.length})</p>
                      <div className="space-y-2">
                        {processed.actionItems.map(action => (
                          <div
                            key={action.id}
                            className={cn(
                              "p-2 border rounded-lg flex items-center gap-2",
                              action.approved && "border-green-500/50 bg-green-500/5"
                            )}
                          >
                            <Checkbox
                              checked={action.approved}
                              onCheckedChange={(checked) =>
                                toggleActionApproval(action.id, checked as boolean)
                              }
                            />
                            <span className="text-sm flex-1">{action.description}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs",
                                action.priority === "high" && "border-red-500 text-red-500",
                                action.priority === "medium" && "border-yellow-500 text-yellow-500"
                              )}
                            >
                              {action.priority}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ideas */}
                  {processed.ideas.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2 flex items-center gap-1">
                        <Lightbulb className="h-4 w-4 text-yellow-500" />
                        Ideas ({processed.ideas.length})
                      </p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {processed.ideas.map((idea, i) => (
                          <li key={i}>• {idea}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Questions */}
                  {processed.questions.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2 flex items-center gap-1">
                        <HelpCircle className="h-4 w-4 text-blue-500" />
                        Questions ({processed.questions.length})
                      </p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {processed.questions.map((q, i) => (
                          <li key={i}>• {q}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </ScrollArea>
            ) : (
              <div className="h-[400px] flex items-center justify-center text-center text-muted-foreground">
                <div>
                  <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Process the transcript to see structured content</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      {brainDump.transcription?.text && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {processed
                  ? `${processed.actionItems.filter(a => a.approved).length} action items approved`
                  : "Process transcript to extract action items"}
              </div>
              <div className="flex gap-2">
                {/* Smart Packetize for existing projects */}
                {isExistingProject && projectId && (
                  <Button
                    variant="outline"
                    onClick={smartPacketize}
                    disabled={isPacketizing}
                    className="border-primary/50 text-primary hover:bg-primary/10"
                  >
                    {isPacketizing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Extracting...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Smart Packetize
                      </>
                    )}
                  </Button>
                )}
                {/* Regular create packets (requires processed content) */}
                {processed && (
                  <Button
                    variant="outline"
                    onClick={handleConvertToPackets}
                    disabled={!processed.actionItems.some(a => a.approved)}
                  >
                    <Package className="h-4 w-4 mr-2" />
                    Create Packets
                  </Button>
                )}
                <Button onClick={markComplete} disabled={isPacketizing}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Mark Complete
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Packet Approval Dialog */}
      <PacketApprovalDialog
        open={showPacketApproval}
        onOpenChange={setShowPacketApproval}
        proposedPackets={proposedPackets}
        onApprove={handlePacketsApproved}
        onDismiss={handleDismissPackets}
        isLoading={isPacketizing}
        projectName={projectName}
      />
    </div>
  )
}
