"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Plus,
  RefreshCw,
  Upload,
  Download,
  Terminal,
  Globe,
  FolderOpen,
  ArrowLeft,
  Check,
  AlertCircle
} from "lucide-react"
import Link from "next/link"
import { MCPManagedServer } from "@/lib/mcp/types"
import {
  getMCPServers,
  addMCPServer,
  updateMCPServer,
  deleteMCPServer,
  toggleMCPServer,
  syncToClaudeDesktop,
  importFromClaudeDesktop
} from "@/lib/mcp/storage"
import { getAllProjects } from "@/lib/data/projects"
import type { Project } from "@/lib/data/types"
import { AddMCPServerDialog, MCPServerList, SystemRequirements } from "@/components/mcp"

export default function MCPManagementPage() {
  const [servers, setServers] = useState<MCPManagedServer[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingServer, setEditingServer] = useState<MCPManagedServer | null>(null)
  const [activeTab, setActiveTab] = useState<"all" | "global" | "project">("all")

  // Sync status
  const [syncStatus, setSyncStatus] = useState<{
    type: "success" | "error" | null
    message: string
  } | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  // Load data on mount
  useEffect(() => {
    loadData()
  }, [])

  const loadData = () => {
    setIsLoading(true)
    const loadedServers = getMCPServers()
    const loadedProjects = getAllProjects()
    setServers(loadedServers)
    setProjects(loadedProjects)
    setIsLoading(false)
  }

  const handleAddServer = (server: Omit<MCPManagedServer, "id" | "createdAt" | "updatedAt" | "status">) => {
    if (editingServer) {
      // Update existing server
      updateMCPServer(editingServer.id, server)
    } else {
      // Add new server
      addMCPServer(server)
    }
    loadData()
    setEditingServer(null)
  }

  const handleEditServer = (server: MCPManagedServer) => {
    setEditingServer(server)
    setIsDialogOpen(true)
  }

  const handleDeleteServer = (id: string) => {
    deleteMCPServer(id)
    loadData()
  }

  const handleToggleServer = (id: string) => {
    toggleMCPServer(id)
    loadData()
  }

  const handleSync = async () => {
    setIsSyncing(true)
    setSyncStatus(null)

    const result = await syncToClaudeDesktop()

    setSyncStatus({
      type: result.success ? "success" : "error",
      message: result.success
        ? "Configuration synced to Claude Desktop"
        : result.error || "Failed to sync"
    })
    setIsSyncing(false)

    // Clear status after 5 seconds
    setTimeout(() => setSyncStatus(null), 5000)
  }

  const handleImport = async () => {
    setIsImporting(true)
    setSyncStatus(null)

    const result = await importFromClaudeDesktop()

    if (result.success) {
      loadData()
      setSyncStatus({
        type: "success",
        message:
          result.imported > 0
            ? `Imported ${result.imported} server${result.imported > 1 ? "s" : ""}`
            : "No new servers to import"
      })
    } else {
      setSyncStatus({
        type: "error",
        message: result.error || "Failed to import"
      })
    }
    setIsImporting(false)

    // Clear status after 5 seconds
    setTimeout(() => setSyncStatus(null), 5000)
  }

  // Filter servers based on active tab
  const filteredServers = servers.filter((server) => {
    if (activeTab === "global") return server.scope === "global"
    if (activeTab === "project") return server.scope === "project"
    return true
  })

  const globalCount = servers.filter((s) => s.scope === "global").length
  const projectCount = servers.filter((s) => s.scope === "project").length
  const enabledCount = servers.filter((s) => s.enabled).length

  return (
    <div className="flex flex-col gap-6 p-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/claude-code">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Terminal className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">MCP Server Manager</h1>
            <p className="text-sm text-muted-foreground">
              Configure MCP servers for Claude Code
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleImport}
            disabled={isImporting}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {isImporting ? "Importing..." : "Import from Claude"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            {isSyncing ? "Syncing..." : "Sync to Claude"}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditingServer(null)
              setIsDialogOpen(true)
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Server
          </Button>
        </div>
      </div>

      {/* Sync Status */}
      {syncStatus && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg ${
            syncStatus.type === "success"
              ? "bg-green-500/10 text-green-500 border border-green-500/20"
              : "bg-red-500/10 text-red-500 border border-red-500/20"
          }`}
        >
          {syncStatus.type === "success" ? (
            <Check className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <span className="text-sm">{syncStatus.message}</span>
        </div>
      )}

      {/* System Requirements */}
      <SystemRequirements compact />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Servers</span>
            </div>
            <p className="text-2xl font-bold mt-1">{servers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Global</span>
            </div>
            <p className="text-2xl font-bold mt-1">{globalCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Project-specific</span>
            </div>
            <p className="text-2xl font-bold mt-1">{projectCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Enabled</span>
            </div>
            <p className="text-2xl font-bold mt-1">{enabledCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Server List */}
      <Card className="flex-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Configured Servers</CardTitle>
              <CardDescription>
                MCP servers available to Claude Code
              </CardDescription>
            </div>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "all" | "global" | "project")}>
              <TabsList>
                <TabsTrigger value="all">
                  All
                  <Badge variant="secondary" className="ml-1.5">
                    {servers.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="global">
                  Global
                  <Badge variant="secondary" className="ml-1.5">
                    {globalCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="project">
                  Project
                  <Badge variant="secondary" className="ml-1.5">
                    {projectCount}
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <MCPServerList
            servers={filteredServers}
            onEdit={handleEditServer}
            onDelete={handleDeleteServer}
            onToggle={handleToggleServer}
            isLoading={isLoading}
            projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          />
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <AddMCPServerDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSave={handleAddServer}
        editServer={editingServer}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
      />
    </div>
  )
}
