"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Terminal,
  Plus,
  Grid2X2,
  Grid3X3,
  LayoutGrid,
  Rows,
  FoldVertical,
  UnfoldVertical,
  FolderPlus,
  Palette,
  Trash2,
  RefreshCw,
  Settings,
  Shield,
  Server,
  XCircle,
  RotateCw,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { clearRecentPaths } from "./path-autocomplete"
import { useMultiTerminal } from "./multi-terminal-provider"
import { TerminalTile } from "./terminal-tile"
import { TerminalGroupComponent } from "./terminal-group"
import { AddTerminalDialog } from "./add-terminal-dialog"
import { MAX_TERMINALS, GROUP_COLORS, GroupColor } from "@/lib/multi-terminal/types"

// Tmux session info type
interface TmuxSessionInfo {
  name: string
  created: string
  attached: boolean
  windows: number
}

export function MultiTerminalDashboard() {
  const {
    terminals,
    groups,
    gridColumns,
    addTerminal,
    setGridColumns,
    createGroup,
    dispatch,
  } = useMultiTerminal()

  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showGroupDialog, setShowGroupDialog] = useState(false)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [newGroupColor, setNewGroupColor] = useState<GroupColor>(GROUP_COLORS[0])

  // Settings state
  const [bypassPermissionsDefault, setBypassPermissionsDefault] = useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem("claude-code-bypass-permissions-default") === "true"
  })

  // Tmux persistence setting (default: true)
  const [useTmuxDefault, setUseTmuxDefault] = useState(() => {
    if (typeof window === "undefined") return true
    const stored = localStorage.getItem("claude-code-use-tmux-default")
    return stored === null ? true : stored === "true"
  })

  // Tmux session management
  const [tmuxSessions, setTmuxSessions] = useState<TmuxSessionInfo[]>([])
  const [tmuxAvailable, setTmuxAvailable] = useState(false)
  const [isLoadingTmux, setIsLoadingTmux] = useState(false)

  // Save bypass permissions setting
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("claude-code-bypass-permissions-default", String(bypassPermissionsDefault))
    }
  }, [bypassPermissionsDefault])

  // Save tmux setting
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("claude-code-use-tmux-default", String(useTmuxDefault))
    }
  }, [useTmuxDefault])

  // Fetch tmux sessions
  const fetchTmuxSessions = useCallback(async () => {
    setIsLoadingTmux(true)
    try {
      const response = await fetch("/api/claude-code/tmux-sessions")
      const data = await response.json()
      setTmuxAvailable(data.tmuxAvailable ?? false)
      setTmuxSessions(data.tmuxSessions ?? [])
    } catch (error) {
      console.error("[Dashboard] Failed to fetch tmux sessions:", error)
      setTmuxSessions([])
    } finally {
      setIsLoadingTmux(false)
    }
  }, [])

  // Get orphan tmux sessions (not connected to any terminal)
  const orphanTmuxSessions = useMemo(() => {
    const connectedSessionNames = new Set(
      terminals
        .filter((t) => t.tmuxSessionName)
        .map((t) => t.tmuxSessionName)
    )
    return tmuxSessions.filter((s) => !connectedSessionNames.has(s.name))
  }, [terminals, tmuxSessions])

  // Kill all tmux sessions
  const handleKillAllTmuxSessions = useCallback(async () => {
    if (!window.confirm(`Kill all ${tmuxSessions.length} tmux sessions? This will stop all Claude Code instances.`)) {
      return
    }
    try {
      const response = await fetch("/api/claude-code/tmux-sessions?all=true", {
        method: "DELETE",
      })
      const data = await response.json()
      console.log(`[Dashboard] Killed ${data.killed} tmux sessions`)
      // Refresh the list
      fetchTmuxSessions()
      // Also clear all terminals
      dispatch({ type: "CLEAR_ALL" })
    } catch (error) {
      console.error("[Dashboard] Failed to kill all tmux sessions:", error)
    }
  }, [tmuxSessions.length, fetchTmuxSessions, dispatch])

  // Load tmux sessions on mount
  useEffect(() => {
    fetchTmuxSessions()
  }, [fetchTmuxSessions])

  // Get ungrouped terminals (terminals not in any group)
  const ungroupedTerminals = useMemo(() => {
    const groupedIds = new Set(
      groups.flatMap((g) => g.terminalOrder)
    )
    return terminals.filter((t) => !groupedIds.has(t.id) && t.groupId === null)
  }, [terminals, groups])

  // Get terminals for each group
  const getGroupTerminals = useCallback((groupId: string) => {
    const group = groups.find((g) => g.id === groupId)
    if (!group) return []
    return group.terminalOrder
      .map((id) => terminals.find((t) => t.id === id))
      .filter((t): t is NonNullable<typeof t> => !!t)
  }, [terminals, groups])

  const handleAddTerminal = useCallback((options: {
    projectId?: string
    projectName?: string
    workingDirectory: string
    label?: string
  }) => {
    addTerminal(options)
  }, [addTerminal])

  const handleCreateGroup = useCallback(() => {
    if (!newGroupName.trim()) return
    createGroup(newGroupName.trim(), newGroupColor)
    setNewGroupName("")
    setNewGroupColor(GROUP_COLORS[0])
    setShowGroupDialog(false)
  }, [newGroupName, newGroupColor, createGroup])

  const handleCollapseAll = useCallback(() => {
    dispatch({ type: "COLLAPSE_ALL" })
  }, [dispatch])

  const handleExpandAll = useCallback(() => {
    dispatch({ type: "EXPAND_ALL" })
  }, [dispatch])

  const handleClearAll = useCallback(() => {
    if (window.confirm("Are you sure you want to close all terminals?")) {
      dispatch({ type: "CLEAR_ALL" })
    }
  }, [dispatch])

  // Get grid class based on columns
  const getGridClass = useCallback(() => {
    switch (gridColumns) {
      case 1: return "grid-cols-1"
      case 2: return "grid-cols-1 lg:grid-cols-2"
      case 3: return "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
      case 4: return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      default: return "grid-cols-1 lg:grid-cols-2"
    }
  }, [gridColumns])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + N - New terminal
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault()
        setShowAddDialog(true)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Terminal className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Multi-Terminal Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              {terminals.length} of {MAX_TERMINALS} terminals
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2">
          {/* Grid columns selector */}
          <div className="flex items-center gap-1 border rounded-md p-1">
            <Button
              variant={gridColumns === 1 ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => setGridColumns(1)}
              title="1 column"
            >
              <Rows className="h-4 w-4" />
            </Button>
            <Button
              variant={gridColumns === 2 ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => setGridColumns(2)}
              title="2 columns"
            >
              <Grid2X2 className="h-4 w-4" />
            </Button>
            <Button
              variant={gridColumns === 3 ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => setGridColumns(3)}
              title="3 columns"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={gridColumns === 4 ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => setGridColumns(4)}
              title="4 columns"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>

          {/* Collapse/Expand all */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCollapseAll}
            title="Collapse all terminals"
          >
            <FoldVertical className="h-4 w-4 mr-1" />
            Collapse
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExpandAll}
            title="Expand all terminals"
          >
            <UnfoldVertical className="h-4 w-4 mr-1" />
            Expand
          </Button>

          {/* Settings */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowSettingsDialog(true)}
            title="Settings"
            className="h-8 w-8"
          >
            <Settings className="h-4 w-4" />
          </Button>

          {/* Tmux sessions indicator and controls */}
          {tmuxAvailable && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Server className="h-4 w-4" />
                  <span className="text-xs">
                    {tmuxSessions.length} tmux
                  </span>
                  {isLoadingTmux && <RotateCw className="h-3 w-3 animate-spin" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  {tmuxSessions.length} tmux session{tmuxSessions.length !== 1 ? "s" : ""} running
                  {orphanTmuxSessions.length > 0 && (
                    <span className="text-orange-500 ml-1">
                      ({orphanTmuxSessions.length} orphan)
                    </span>
                  )}
                </div>
                <DropdownMenuSeparator />

                {orphanTmuxSessions.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                      Reopen Orphan Sessions
                    </div>
                    {orphanTmuxSessions.map((session) => (
                      <DropdownMenuItem
                        key={session.name}
                        onClick={() => {
                          // Create a terminal that reconnects to this tmux session
                          const label = session.name.replace(/^claude-code-/, "").replace(/-[a-z0-9]{4}$/, "")
                          addTerminal({
                            workingDirectory: process.env.HOME || "~",
                            label: label || session.name,
                          })
                        }}
                      >
                        <Terminal className="h-4 w-4 mr-2 text-orange-500" />
                        <span className="truncate">{session.name}</span>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                  </>
                )}

                <DropdownMenuItem onClick={fetchTmuxSessions}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </DropdownMenuItem>

                {tmuxSessions.length > 0 && (
                  <DropdownMenuItem
                    onClick={handleKillAllTmuxSessions}
                    className="text-destructive focus:text-destructive"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    End All Sessions
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* More actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowGroupDialog(true)}>
                <FolderPlus className="h-4 w-4 mr-2" />
                Create Group
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleClearAll}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Close All Terminals
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Add terminal button */}
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Terminal
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {terminals.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-4">
              <Terminal className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No Terminals Open</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              Launch multiple Claude Code sessions to work on different projects simultaneously.
              You can organize them into groups and pop them out to separate windows.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Terminal
              </Button>
              <Button variant="outline" onClick={() => setShowGroupDialog(true)}>
                <FolderPlus className="h-4 w-4 mr-2" />
                Create Group
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Ctrl+N</kbd> to quickly add a terminal
            </p>
          </div>
        ) : (
          <>
            {/* Groups */}
            {groups.map((group) => (
              <TerminalGroupComponent
                key={group.id}
                group={group}
                terminals={getGroupTerminals(group.id)}
                allGroups={groups}
                gridColumns={gridColumns}
                onAddTerminal={() => setShowAddDialog(true)}
              />
            ))}

            {/* Ungrouped terminals */}
            {ungroupedTerminals.length > 0 && (
              <div className="space-y-4">
                {groups.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Ungrouped Terminals</span>
                    <span>({ungroupedTerminals.length})</span>
                  </div>
                )}
                <div className={cn("grid gap-4", getGridClass())}>
                  {ungroupedTerminals.map((terminal) => (
                    <TerminalTile
                      key={terminal.id}
                      terminal={terminal}
                      groups={groups}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Terminal Dialog */}
      <AddTerminalDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onAdd={handleAddTerminal}
        currentTerminalCount={terminals.length}
      />

      {/* Create Group Dialog */}
      <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Create New Group</DialogTitle>
            <DialogDescription>
              Organize your terminals into groups for better management.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Group Name</label>
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="e.g., Backend Services"
                onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Color</label>
              <div className="flex gap-2 flex-wrap">
                {GROUP_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewGroupColor(color)}
                    className={cn(
                      "h-8 w-8 rounded-full transition-all",
                      newGroupColor === color && "ring-2 ring-offset-2 ring-primary"
                    )}
                    style={{ backgroundColor: getColorValue(color) }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGroupDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateGroup} disabled={!newGroupName.trim()}>
              Create Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Multi-Terminal Settings
            </DialogTitle>
            <DialogDescription>
              Configure defaults for Claude Code terminals.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Tmux Session Persistence */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="use-tmux" className="text-sm font-medium flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Session Persistence (tmux)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Keep sessions alive across reconnects and pop-outs. Requires tmux installed.
                </p>
              </div>
              <Switch
                id="use-tmux"
                checked={useTmuxDefault}
                onCheckedChange={setUseTmuxDefault}
              />
            </div>

            {/* Bypass Permissions Default */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="bypass-permissions" className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Bypass Permissions by Default
                </Label>
                <p className="text-xs text-muted-foreground">
                  New terminals will have permission bypass enabled automatically.
                </p>
              </div>
              <Switch
                id="bypass-permissions"
                checked={bypassPermissionsDefault}
                onCheckedChange={setBypassPermissionsDefault}
              />
            </div>

            {/* Clear Recent Paths */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Recent Paths</p>
                <p className="text-xs text-muted-foreground">
                  Clear saved paths for autocomplete
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (window.confirm("Clear all recent paths?")) {
                    clearRecentPaths()
                  }
                }}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowSettingsDialog(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Helper to get actual color value from color name
function getColorValue(colorName: string): string {
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
