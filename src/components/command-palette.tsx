"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Activity,
  Package,
  Clock,
  Shield,
  CheckCircle,
  DollarSign,
  Settings,
  Mic,
  Search,
  Play,
  Pause,
  Plus,
  RefreshCw,
  ArrowRight,
  Command,
  FolderGit2
} from "lucide-react"

interface CommandItem {
  id: string
  label: string
  description?: string
  icon: React.ReactNode
  shortcut?: string
  action: () => void
  category: "navigation" | "actions" | "settings"
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const router = useRouter()

  const commands: CommandItem[] = [
    // Navigation
    { id: "nav-dashboard", label: "Go to Dashboard", icon: <LayoutDashboard className="h-4 w-4" />, shortcut: "G D", action: () => router.push("/"), category: "navigation" },
    { id: "nav-activity", label: "Go to Activity", icon: <Activity className="h-4 w-4" />, shortcut: "G A", action: () => router.push("/activity"), category: "navigation" },
    { id: "nav-packets", label: "Go to Packets", icon: <Package className="h-4 w-4" />, shortcut: "G P", action: () => router.push("/packets"), category: "navigation" },
    { id: "nav-files", label: "Go to Files", icon: <FolderGit2 className="h-4 w-4" />, shortcut: "G F", action: () => router.push("/files"), category: "navigation" },
    { id: "nav-timeline", label: "Go to Timeline", icon: <Clock className="h-4 w-4" />, shortcut: "G T", action: () => router.push("/timeline"), category: "navigation" },
    { id: "nav-quality", label: "Go to Quality Gates", icon: <Shield className="h-4 w-4" />, shortcut: "G Q", action: () => router.push("/quality"), category: "navigation" },
    { id: "nav-approvals", label: "Go to Approvals", icon: <CheckCircle className="h-4 w-4" />, shortcut: "G R", action: () => router.push("/approvals"), category: "navigation" },
    { id: "nav-costs", label: "Go to Costs", icon: <DollarSign className="h-4 w-4" />, shortcut: "G C", action: () => router.push("/costs"), category: "navigation" },
    { id: "nav-settings", label: "Go to Settings", icon: <Settings className="h-4 w-4" />, shortcut: "G S", action: () => router.push("/settings"), category: "navigation" },
    { id: "nav-voice", label: "Go to Voice Control", icon: <Mic className="h-4 w-4" />, shortcut: "G V", action: () => router.push("/voice"), category: "navigation" },

    // Actions
    { id: "action-new-packet", label: "New Packet", description: "Create a new task packet", icon: <Plus className="h-4 w-4" />, shortcut: "N", action: () => console.log("New packet"), category: "actions" },
    { id: "action-start", label: "Start Next Packet", description: "Begin the next queued packet", icon: <Play className="h-4 w-4" />, action: () => console.log("Start next"), category: "actions" },
    { id: "action-pause", label: "Pause All Agents", description: "Pause all running work", icon: <Pause className="h-4 w-4" />, action: () => console.log("Pause all"), category: "actions" },
    { id: "action-refresh", label: "Refresh Data", description: "Reload all dashboard data", icon: <RefreshCw className="h-4 w-4" />, shortcut: "R", action: () => window.location.reload(), category: "actions" },

    // Settings
    { id: "settings-theme", label: "Toggle Theme", description: "Switch between dark and light mode", icon: <Settings className="h-4 w-4" />, action: () => console.log("Toggle theme"), category: "settings" },
  ]

  const filteredCommands = commands.filter(cmd =>
    cmd.label.toLowerCase().includes(search.toLowerCase()) ||
    cmd.description?.toLowerCase().includes(search.toLowerCase())
  )

  const groupedCommands = {
    navigation: filteredCommands.filter(c => c.category === "navigation"),
    actions: filteredCommands.filter(c => c.category === "actions"),
    settings: filteredCommands.filter(c => c.category === "settings")
  }

  const flatFiltered = [...groupedCommands.navigation, ...groupedCommands.actions, ...groupedCommands.settings]

  const executeCommand = useCallback((cmd: CommandItem) => {
    cmd.action()
    setIsOpen(false)
    setSearch("")
    setSelectedIndex(0)
  }, [])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open command palette with Cmd/Ctrl + K
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setIsOpen(prev => !prev)
        return
      }

      if (!isOpen) return

      // Navigate with arrow keys
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, flatFiltered.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
      } else if (e.key === "Enter") {
        e.preventDefault()
        if (flatFiltered[selectedIndex]) {
          executeCommand(flatFiltered[selectedIndex])
        }
      } else if (e.key === "Escape") {
        setIsOpen(false)
        setSearch("")
        setSelectedIndex(0)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, selectedIndex, flatFiltered, executeCommand])

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [search])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={() => {
          setIsOpen(false)
          setSearch("")
        }}
      />

      {/* Command Palette */}
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-xl z-50">
        <div className="bg-card border rounded-xl shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 border-b">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search commands..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 h-14 bg-transparent text-lg outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            <kbd className="px-2 py-1 rounded bg-muted text-xs font-mono text-muted-foreground">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-auto p-2">
            {flatFiltered.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <p>No commands found</p>
              </div>
            ) : (
              <>
                {groupedCommands.navigation.length > 0 && (
                  <div className="mb-2">
                    <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase">
                      Navigation
                    </p>
                    {groupedCommands.navigation.map((cmd, i) => {
                      const globalIndex = i
                      return (
                        <button
                          key={cmd.id}
                          onClick={() => executeCommand(cmd)}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                            selectedIndex === globalIndex ? "bg-accent" : "hover:bg-accent/50"
                          )}
                        >
                          <span className="text-muted-foreground">{cmd.icon}</span>
                          <span className="flex-1 font-medium">{cmd.label}</span>
                          {cmd.shortcut && (
                            <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono text-muted-foreground">
                              {cmd.shortcut}
                            </kbd>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}

                {groupedCommands.actions.length > 0 && (
                  <div className="mb-2">
                    <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase">
                      Actions
                    </p>
                    {groupedCommands.actions.map((cmd, i) => {
                      const globalIndex = groupedCommands.navigation.length + i
                      return (
                        <button
                          key={cmd.id}
                          onClick={() => executeCommand(cmd)}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                            selectedIndex === globalIndex ? "bg-accent" : "hover:bg-accent/50"
                          )}
                        >
                          <span className="text-muted-foreground">{cmd.icon}</span>
                          <div className="flex-1">
                            <p className="font-medium">{cmd.label}</p>
                            {cmd.description && (
                              <p className="text-xs text-muted-foreground">{cmd.description}</p>
                            )}
                          </div>
                          {cmd.shortcut && (
                            <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono text-muted-foreground">
                              {cmd.shortcut}
                            </kbd>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}

                {groupedCommands.settings.length > 0 && (
                  <div>
                    <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase">
                      Settings
                    </p>
                    {groupedCommands.settings.map((cmd, i) => {
                      const globalIndex = groupedCommands.navigation.length + groupedCommands.actions.length + i
                      return (
                        <button
                          key={cmd.id}
                          onClick={() => executeCommand(cmd)}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                            selectedIndex === globalIndex ? "bg-accent" : "hover:bg-accent/50"
                          )}
                        >
                          <span className="text-muted-foreground">{cmd.icon}</span>
                          <div className="flex-1">
                            <p className="font-medium">{cmd.label}</p>
                            {cmd.description && (
                              <p className="text-xs text-muted-foreground">{cmd.description}</p>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-muted font-mono">↑</kbd>
                <kbd className="px-1 py-0.5 rounded bg-muted font-mono">↓</kbd>
                to navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-muted font-mono">↵</kbd>
                to select
              </span>
            </div>
            <span className="flex items-center gap-1">
              <Command className="h-3 w-3" />K to toggle
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
