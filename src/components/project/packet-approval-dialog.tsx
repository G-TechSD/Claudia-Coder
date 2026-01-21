"use client"

import { useState, useCallback, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  Loader2,
  Package,
  Bug,
  Sparkles,
  RefreshCw,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  XCircle
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ProposedPacket, BrainDumpItemCategory } from "@/app/api/brain-dump/packetize/route"

interface PacketApprovalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proposedPackets: ProposedPacket[]
  onApprove: (packets: Array<ProposedPacket & { approvedPriority: string }>) => void
  onDismiss: () => void
  isLoading?: boolean
  projectName?: string
}

// Category display config
const categoryConfig: Record<BrainDumpItemCategory, {
  label: string
  icon: typeof Package
  color: string
}> = {
  feature_request: {
    label: "Feature Request",
    icon: Sparkles,
    color: "bg-blue-500/10 text-blue-500 border-blue-500/30"
  },
  bug_fix: {
    label: "Bug Fix",
    icon: Bug,
    color: "bg-red-500/10 text-red-500 border-red-500/30"
  },
  change_request: {
    label: "Change Request",
    icon: RefreshCw,
    color: "bg-orange-500/10 text-orange-500 border-orange-500/30"
  },
  enhancement: {
    label: "Enhancement",
    icon: Package,
    color: "bg-green-500/10 text-green-500 border-green-500/30"
  },
  feedback: {
    label: "Feedback",
    icon: MessageSquare,
    color: "bg-purple-500/10 text-purple-500 border-purple-500/30"
  }
}

// Priority display config
const priorityConfig: Record<string, {
  label: string
  color: string
}> = {
  critical: { label: "Critical", color: "bg-red-600 text-white" },
  high: { label: "High", color: "bg-orange-500 text-white" },
  medium: { label: "Medium", color: "bg-yellow-500 text-black" },
  low: { label: "Low", color: "bg-gray-500 text-white" }
}

interface PacketSelection {
  selected: boolean
  priority: string
}

export function PacketApprovalDialog({
  open,
  onOpenChange,
  proposedPackets,
  onApprove,
  onDismiss,
  isLoading = false,
  projectName
}: PacketApprovalDialogProps) {
  // Track selection state for each packet
  const [selections, setSelections] = useState<Record<string, PacketSelection>>(() => {
    const initial: Record<string, PacketSelection> = {}
    for (const packet of proposedPackets) {
      initial[packet.id] = {
        selected: true, // Default to selected
        priority: packet.priority
      }
    }
    return initial
  })

  // Update selections when packets change
  const initializeSelections = useCallback(() => {
    const initial: Record<string, PacketSelection> = {}
    for (const packet of proposedPackets) {
      initial[packet.id] = {
        selected: true,
        priority: packet.priority
      }
    }
    setSelections(initial)
  }, [proposedPackets])

  // Re-initialize selections when proposedPackets changes
  useEffect(() => {
    if (proposedPackets.length > 0) {
      initializeSelections()
    }
  }, [proposedPackets, initializeSelections])

  // Toggle packet selection
  const togglePacket = useCallback((packetId: string) => {
    setSelections(prev => ({
      ...prev,
      [packetId]: {
        ...prev[packetId],
        selected: !prev[packetId]?.selected
      }
    }))
  }, [])

  // Update packet priority
  const updatePriority = useCallback((packetId: string, priority: string) => {
    setSelections(prev => ({
      ...prev,
      [packetId]: {
        ...prev[packetId],
        priority
      }
    }))
  }, [])

  // Select all
  const selectAll = useCallback(() => {
    setSelections(prev => {
      const updated = { ...prev }
      for (const id in updated) {
        updated[id] = { ...updated[id], selected: true }
      }
      return updated
    })
  }, [])

  // Deselect all
  const deselectAll = useCallback(() => {
    setSelections(prev => {
      const updated = { ...prev }
      for (const id in updated) {
        updated[id] = { ...updated[id], selected: false }
      }
      return updated
    })
  }, [])

  // Get selected count
  const selectedCount = Object.values(selections).filter(s => s.selected).length

  // Handle approve
  const handleApprove = useCallback(() => {
    const selectedPackets = proposedPackets
      .filter(p => selections[p.id]?.selected)
      .map(p => ({
        ...p,
        approvedPriority: selections[p.id]?.priority || p.priority
      }))

    onApprove(selectedPackets)
  }, [proposedPackets, selections, onApprove])

  // Group packets by category
  const packetsByCategory = proposedPackets.reduce<Record<BrainDumpItemCategory, ProposedPacket[]>>(
    (acc, packet) => {
      if (!acc[packet.category]) {
        acc[packet.category] = []
      }
      acc[packet.category].push(packet)
      return acc
    },
    {} as Record<BrainDumpItemCategory, ProposedPacket[]>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]" onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Proposed Work Packets
          </DialogTitle>
          <DialogDescription>
            {projectName ? `New packets extracted from brain dump for "${projectName}"` : "Review and approve packets to add to your project queue"}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Analyzing brain dump...</p>
          </div>
        ) : proposedPackets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
            <p className="text-muted-foreground">No actionable items were extracted from the brain dump.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Try being more specific about tasks, bugs, or features you want to add.
            </p>
          </div>
        ) : (
          <>
            {/* Selection controls */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="text-sm text-muted-foreground">
                {selectedCount} of {proposedPackets.length} selected
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="ghost" size="sm" onClick={deselectAll}>
                  Deselect All
                </Button>
              </div>
            </div>

            {/* Packets list */}
            <ScrollArea className="max-h-[400px] pr-4">
              <div className="space-y-4">
                {Object.entries(packetsByCategory).map(([category, packets]) => {
                  const config = categoryConfig[category as BrainDumpItemCategory]
                  const CategoryIcon = config.icon

                  return (
                    <div key={category} className="space-y-2">
                      {/* Category header */}
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <CategoryIcon className="h-4 w-4" />
                        {config.label}
                        <Badge variant="secondary" className="text-xs">
                          {packets.length}
                        </Badge>
                      </div>

                      {/* Packets in category */}
                      <div className="space-y-2 pl-6">
                        {packets.map(packet => {
                          const selection = selections[packet.id]
                          const isSelected = selection?.selected ?? true
                          const currentPriority = selection?.priority || packet.priority
                          const priorityInfo = priorityConfig[currentPriority]

                          return (
                            <div
                              key={packet.id}
                              className={cn(
                                "p-3 border rounded-lg transition-colors",
                                isSelected
                                  ? "border-primary/50 bg-primary/5"
                                  : "border-border bg-muted/30 opacity-60"
                              )}
                            >
                              <div className="flex items-start gap-3">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => togglePacket(packet.id)}
                                  className="mt-1"
                                />

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-sm truncate">
                                      {packet.title}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className={cn("text-xs", config.color)}
                                    >
                                      {packet.type}
                                    </Badge>
                                  </div>

                                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                    {packet.description}
                                  </p>

                                  {/* Priority selector */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Priority:</span>
                                    <Select
                                      value={currentPriority}
                                      onValueChange={(value) => updatePriority(packet.id, value)}
                                    >
                                      <SelectTrigger className="h-7 w-28 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="critical">Critical</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="low">Low</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {/* Reasoning (collapsed) */}
                                  {packet.sourceItem.reasoning && (
                                    <p className="text-xs text-muted-foreground mt-2 italic">
                                      {packet.sourceItem.reasoning}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onDismiss}
            disabled={isLoading}
          >
            <XCircle className="h-4 w-4 mr-2" />
            Dismiss All
          </Button>
          <Button
            onClick={handleApprove}
            disabled={isLoading || selectedCount === 0}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Add {selectedCount} to Queue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
