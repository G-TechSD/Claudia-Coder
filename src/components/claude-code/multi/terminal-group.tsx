"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Pencil,
  Trash2,
  FoldVertical,
  UnfoldVertical,
  Plus,
} from "lucide-react"
import { TerminalGroup as TerminalGroupType, MultiTerminalSession, GROUP_COLORS } from "@/lib/multi-terminal/types"
import { useMultiTerminal } from "./multi-terminal-provider"
import { TerminalTile } from "./terminal-tile"

interface TerminalGroupProps {
  group: TerminalGroupType
  terminals: MultiTerminalSession[]
  allGroups: TerminalGroupType[]
  gridColumns: 1 | 2 | 3 | 4
  onAddTerminal: () => void
}

// Helper to get actual color value from color name
function getGroupColor(colorName: string): string {
  const colors: Record<string, string> = {
    blue: "#3b82f6",
    green: "#22c55e",
    purple: "#a855f7",
    orange: "#f97316",
    pink: "#ec4899",
    cyan: "#06b6d4",
    yellow: "#eab308",
    red: "#ef4444",
  }
  return colors[colorName] || colors.blue
}

export function TerminalGroupComponent({
  group,
  terminals,
  allGroups,
  gridColumns,
  onAddTerminal,
}: TerminalGroupProps) {
  const { dispatch, deleteGroup } = useMultiTerminal()
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(group.name)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [isEditingName])

  // Update name value when group name changes
  useEffect(() => {
    setNameValue(group.name)
  }, [group.name])

  const handleToggle = useCallback(() => {
    dispatch({ type: "TOGGLE_GROUP", payload: { groupId: group.id } })
  }, [dispatch, group.id])

  const handleNameSubmit = useCallback(() => {
    const trimmedName = nameValue.trim()
    if (trimmedName && trimmedName !== group.name) {
      dispatch({ type: "RENAME_GROUP", payload: { groupId: group.id, name: trimmedName } })
    } else {
      setNameValue(group.name)
    }
    setIsEditingName(false)
  }, [nameValue, group.name, group.id, dispatch])

  const handleNameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleNameSubmit()
    } else if (e.key === "Escape") {
      setNameValue(group.name)
      setIsEditingName(false)
    }
  }, [handleNameSubmit, group.name])

  const handleCollapseAll = useCallback(() => {
    dispatch({ type: "COLLAPSE_ALL", payload: { groupId: group.id } })
  }, [dispatch, group.id])

  const handleExpandAll = useCallback(() => {
    dispatch({ type: "EXPAND_ALL", payload: { groupId: group.id } })
  }, [dispatch, group.id])

  const handleDelete = useCallback(() => {
    deleteGroup(group.id)
  }, [deleteGroup, group.id])

  // Get grid class based on columns
  const getGridClass = () => {
    switch (gridColumns) {
      case 1: return "grid-cols-1"
      case 2: return "grid-cols-1 lg:grid-cols-2"
      case 3: return "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
      case 4: return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      default: return "grid-cols-1 lg:grid-cols-2"
    }
  }

  const groupColor = getGroupColor(group.color)

  return (
    <Collapsible open={group.isExpanded} onOpenChange={handleToggle}>
      <div
        className="rounded-lg border overflow-hidden"
        style={{ borderColor: `${groupColor}40` }}
      >
        {/* Group Header */}
        <CollapsibleTrigger asChild>
          <div
            className="flex items-center px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors"
            style={{ backgroundColor: `${groupColor}10` }}
          >
            {/* Color indicator */}
            <div
              className="h-4 w-1 rounded-full mr-3"
              style={{ backgroundColor: groupColor }}
            />

            {/* Name - editable */}
            {isEditingName ? (
              <Input
                ref={nameInputRef}
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={handleNameSubmit}
                onKeyDown={handleNameKeyDown}
                onClick={(e) => e.stopPropagation()}
                className="h-7 w-48 text-sm font-medium"
              />
            ) : (
              <span className="font-medium">{group.name}</span>
            )}

            {/* Terminal count */}
            <span className="ml-2 text-sm text-muted-foreground">
              ({terminals.length})
            </span>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Actions - stop propagation to prevent toggle */}
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={handleCollapseAll}
                title="Collapse all terminals"
              >
                <FoldVertical className="h-3 w-3 mr-1" />
                Collapse
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={handleExpandAll}
                title="Expand all terminals"
              >
                <UnfoldVertical className="h-3 w-3 mr-1" />
                Expand
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={onAddTerminal}
                title="Add terminal to group"
              >
                <Plus className="h-4 w-4" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditingName(true)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Rename Group
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleDelete}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Group
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Expand/collapse indicator */}
            {group.isExpanded ? (
              <ChevronUp className="h-4 w-4 ml-2 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 ml-2 text-muted-foreground" />
            )}
          </div>
        </CollapsibleTrigger>

        {/* Group Content */}
        <CollapsibleContent>
          <div className="p-4 pt-2">
            {terminals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No terminals in this group</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={onAddTerminal}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Terminal
                </Button>
              </div>
            ) : (
              <div className={cn("grid gap-4", getGridClass())}>
                {terminals.map((terminal) => (
                  <TerminalTile
                    key={terminal.id}
                    terminal={terminal}
                    groups={allGroups}
                  />
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
