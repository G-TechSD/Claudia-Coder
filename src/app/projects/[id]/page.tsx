"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  GitBranch,
  Package,
  MessageSquare,
  Clock,
  Edit2,
  Trash2,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  Archive,
  Mic,
  Bot,
  User,
  RefreshCw,
  Link2,
  Unlink,
  Sparkles,
  Zap,
  Brain,
  Loader2,
  FileText,
  FolderOpen,
  Upload,
  Shield,
  Cloud,
  Server
} from "lucide-react"
import { getProject, updateProject, deleteProject } from "@/lib/data/projects"
import { getResourcesForProject } from "@/lib/data/resources"
import { ModelAssignment } from "@/components/project/model-assignment"
import { ResourceList } from "@/components/project/resource-list"
import { ResourceUpload } from "@/components/project/resource-upload"
import { RepoBrowser } from "@/components/project/repo-browser"
import { BuildPlanEditor } from "@/components/project/build-plan-editor"
import { SecurityEval } from "@/components/security/security-eval"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import type { Project, ProjectStatus, InterviewMessage } from "@/lib/data/types"

interface ProviderOption {
  name: string
  displayName: string
  status: "online" | "offline" | "checking" | "not-configured"
  model?: string
  type: "local" | "cloud"
}

const statusConfig: Record<ProjectStatus, { label: string; color: string; icon: React.ElementType }> = {
  planning: { label: "Planning", color: "bg-blue-500/10 text-blue-500 border-blue-500/30", icon: Clock },
  active: { label: "Active", color: "bg-green-500/10 text-green-500 border-green-500/30", icon: PlayCircle },
  paused: { label: "Paused", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30", icon: PauseCircle },
  completed: { label: "Completed", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30", icon: CheckCircle2 },
  archived: { label: "Archived", color: "bg-gray-500/10 text-gray-500 border-gray-500/30", icon: Archive }
}

const priorityConfig = {
  low: { label: "Low", color: "bg-gray-500/10 text-gray-400" },
  medium: { label: "Medium", color: "bg-blue-500/10 text-blue-400" },
  high: { label: "High", color: "bg-orange-500/10 text-orange-400" },
  critical: { label: "Critical", color: "bg-red-500/10 text-red-400" }
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [resourceCount, setResourceCount] = useState(0)
  const [repoBrowserOpen, setRepoBrowserOpen] = useState(false)
  const [providers, setProviders] = useState<ProviderOption[]>([])
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null)

  useEffect(() => {
    const projectId = params.id as string
    const found = getProject(projectId)
    setProject(found || null)
    setLoading(false)

    // Load resource count
    const resources = getResourcesForProject(projectId)
    setResourceCount(resources.length)
  }, [params.id])

  // Check available providers on mount
  useEffect(() => {
    async function fetchProviders() {
      try {
        const response = await fetch("/api/providers")
        const data = await response.json()

        if (data.providers) {
          const providerOptions: ProviderOption[] = data.providers.map((p: {
            name: string
            displayName: string
            type: "local" | "cloud"
            status: "online" | "offline" | "checking" | "not-configured"
            model?: string
          }) => ({
            name: p.name,
            displayName: p.displayName,
            type: p.type,
            status: p.status,
            model: p.model
          }))

          setProviders(providerOptions)

          // Auto-select first online provider
          const firstOnline = providerOptions.find(p => p.status === "online")
          if (firstOnline && !selectedProvider) {
            setSelectedProvider(firstOnline.name)
          }
        }
      } catch (error) {
        console.error("Failed to fetch providers:", error)
      }
    }

    fetchProviders()
  }, [])

  const refreshResourceCount = () => {
    const resources = getResourcesForProject(params.id as string)
    setResourceCount(resources.length)
  }

  const refreshProject = () => {
    const found = getProject(params.id as string)
    if (found) setProject(found)
  }

  const handleStatusChange = (newStatus: ProjectStatus) => {
    if (!project) return
    const updated = updateProject(project.id, { status: newStatus })
    if (updated) setProject(updated)
  }

  const handleDelete = () => {
    if (!project) return
    if (confirm("Are you sure you want to delete this project?")) {
      deleteProject(project.id)
      router.push("/projects")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-6">
        <Card className="bg-destructive/10 border-destructive/30">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Project Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The project you're looking for doesn't exist or has been deleted.
            </p>
            <Button asChild>
              <Link href="/projects">Back to Projects</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const StatusIcon = statusConfig[project.status].icon

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/projects">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <Badge className={cn("border", statusConfig[project.status].color)}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig[project.status].label}
            </Badge>
            <Badge className={cn(priorityConfig[project.priority].color)}>
              {priorityConfig[project.priority].label}
            </Badge>
          </div>
          <p className="text-muted-foreground ml-12">{project.description}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Edit2 className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </div>
      </div>

      {/* Status Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Change Status:</span>
            {(["planning", "active", "paused", "completed", "archived"] as ProjectStatus[]).map((status) => {
              const config = statusConfig[status]
              const Icon = config.icon
              return (
                <Button
                  key={status}
                  variant={project.status === status ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleStatusChange(status)}
                  className={cn(
                    project.status === status && config.color,
                    "transition-all"
                  )}
                >
                  <Icon className="h-3 w-3 mr-1" />
                  {config.label}
                </Button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="plan">
            Build Plan
          </TabsTrigger>
          <TabsTrigger value="models">
            AI Models
            <Brain className="h-3 w-3 ml-1" />
          </TabsTrigger>
          <TabsTrigger value="repos">
            Repos
            <Badge variant="secondary" className="ml-1 text-xs">
              {project.repos.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="packets">
            Packets
            <Badge variant="secondary" className="ml-1 text-xs">
              {project.packetIds.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="resources">
            Resources
            <Badge variant="secondary" className="ml-1 text-xs">
              {resourceCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="interview">
            Interview
            {project.creationInterview && (
              <Sparkles className="h-3 w-3 ml-1 text-primary" />
            )}
          </TabsTrigger>
          <TabsTrigger value="security">
            Security
            <Shield className="h-3 w-3 ml-1 text-red-500" />
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Linked Repos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{project.repos.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Active Packets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{project.packetIds.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Created
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-medium">
                  {new Date(project.createdAt).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tags */}
          {project.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {project.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Linear Sync */}
          {project.linearSync && project.linearSync.mode !== "none" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Linear Sync
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant={project.linearSync.mode === "two_way" ? "default" : "secondary"}>
                    {project.linearSync.mode === "two_way" ? "Two-Way Sync" : "Imported"}
                  </Badge>
                  {project.linearSync.lastSyncAt && (
                    <span className="text-sm text-muted-foreground">
                      Last synced: {new Date(project.linearSync.lastSyncAt).toLocaleString()}
                    </span>
                  )}
                </div>
                {project.linearSync.syncErrors && project.linearSync.syncErrors.length > 0 && (
                  <div className="text-sm text-destructive">
                    {project.linearSync.syncErrors.join(", ")}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Interview Summary */}
          {project.creationInterview && project.creationInterview.summary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Interview Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">{project.creationInterview.summary}</p>
                {project.creationInterview.keyPoints && project.creationInterview.keyPoints.length > 0 && (
                  <ul className="text-sm space-y-1">
                    {project.creationInterview.keyPoints.map((point, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Build Plan Tab */}
        <TabsContent value="plan" className="space-y-4">
          <BuildPlanEditor
            projectId={project.id}
            projectName={project.name}
            projectDescription={project.description}
            projectStatus={project.status}
            providers={providers}
            selectedProvider={selectedProvider}
            onProviderChange={setSelectedProvider}
          />
        </TabsContent>

        {/* AI Models Tab */}
        <TabsContent value="models" className="space-y-4">
          <ModelAssignment projectId={project.id} />
        </TabsContent>

        {/* Repos Tab */}
        <TabsContent value="repos" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Linked Repositories</h3>
            <Button size="sm" onClick={() => setRepoBrowserOpen(true)}>
              <Link2 className="h-4 w-4 mr-1" />
              Link Repository
            </Button>
          </div>

          {project.repos.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <GitBranch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No repositories linked yet.</p>
                <Button className="mt-4" size="sm" onClick={() => setRepoBrowserOpen(true)}>
                  <Link2 className="h-4 w-4 mr-1" />
                  Link Your First Repository
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {project.repos.map((repo) => (
                <Card key={repo.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <GitBranch className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{repo.name}</p>
                        <p className="text-sm text-muted-foreground">{repo.path}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {repo.provider}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" asChild>
                        <a href={repo.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Unlink className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Packets Tab */}
        <TabsContent value="packets" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Work Packets</h3>
            <Button size="sm">
              <Package className="h-4 w-4 mr-1" />
              Create Packet
            </Button>
          </div>

          {project.packetIds.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No packets created yet.</p>
                <Button className="mt-4" size="sm">
                  <Package className="h-4 w-4 mr-1" />
                  Create Your First Packet
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {project.packetIds.map((packetId) => (
                <Card key={packetId}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Package className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Packet {packetId}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Resources Tab */}
        <TabsContent value="resources" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Project Resources</h3>
          </div>

          <ResourceUpload
            projectId={project.id}
            onUploadComplete={() => refreshResourceCount()}
          />

          <ResourceList
            projectId={project.id}
            onTranscribe={(resource) => {
              // TODO: Open transcription flow
              console.log("Transcribe:", resource.name)
            }}
          />
        </TabsContent>

        {/* Interview Tab */}
        <TabsContent value="interview" className="space-y-4">
          {project.creationInterview ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Creation Interview</h3>
                  <p className="text-sm text-muted-foreground">
                    Completed on {new Date(project.creationInterview.completedAt || project.creationInterview.createdAt).toLocaleString()}
                  </p>
                </div>
                <Badge variant={project.creationInterview.status === "completed" ? "default" : "secondary"}>
                  {project.creationInterview.status}
                </Badge>
              </div>

              {/* Interview Transcript */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Transcript</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 max-h-[400px] overflow-auto">
                  {project.creationInterview.messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                </CardContent>
              </Card>

              {/* Extracted Insights */}
              {(project.creationInterview.summary || project.creationInterview.keyPoints) && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardHeader>
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Extracted Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {project.creationInterview.summary && (
                      <div>
                        <h4 className="text-xs text-muted-foreground uppercase mb-1">Summary</h4>
                        <p className="text-sm">{project.creationInterview.summary}</p>
                      </div>
                    )}
                    {project.creationInterview.keyPoints && project.creationInterview.keyPoints.length > 0 && (
                      <div>
                        <h4 className="text-xs text-muted-foreground uppercase mb-1">Key Points</h4>
                        <ul className="text-sm space-y-1">
                          {project.creationInterview.keyPoints.map((point, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                              {point}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {project.creationInterview.suggestedActions && project.creationInterview.suggestedActions.length > 0 && (
                      <div>
                        <h4 className="text-xs text-muted-foreground uppercase mb-1">Suggested Actions</h4>
                        <ul className="text-sm space-y-1">
                          {project.creationInterview.suggestedActions.map((action, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-muted-foreground">→</span>
                              {action}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  This project was created without an interview.
                </p>
                <Button size="sm">
                  <Mic className="h-4 w-4 mr-1" />
                  Start Interview
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4">
          <SecurityEval
            projectId={project.id}
            projectName={project.name}
            projectDescription={project.description}
            providers={providers}
            selectedProvider={selectedProvider}
            onProviderChange={setSelectedProvider}
          />
        </TabsContent>
      </Tabs>

      {/* Repo Browser Modal */}
      <RepoBrowser
        open={repoBrowserOpen}
        onOpenChange={setRepoBrowserOpen}
        projectId={project.id}
        linkedRepos={project.repos}
        onRepoLinked={() => refreshProject()}
      />
    </div>
  )
}

function MessageBubble({ message }: { message: InterviewMessage }) {
  return (
    <div className={cn(
      "flex gap-3",
      message.role === "user" && "flex-row-reverse"
    )}>
      <div className={cn(
        "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
        message.role === "user" ? "bg-primary" : "bg-muted"
      )}>
        {message.role === "user" ? (
          <User className="h-4 w-4 text-primary-foreground" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>
      <div className={cn(
        "max-w-[80%] rounded-2xl px-4 py-3",
        message.role === "user"
          ? "bg-primary text-primary-foreground"
          : "bg-muted"
      )}>
        <p className="text-sm">{message.content}</p>
        {message.transcribedFrom === "voice" && (
          <div className="flex items-center gap-1 mt-1 opacity-60">
            <Mic className="h-3 w-3" />
            <span className="text-xs">voice</span>
          </div>
        )}
        {message.skipped && (
          <Badge variant="outline" className="mt-1 text-xs">skipped</Badge>
        )}
      </div>
    </div>
  )
}
