"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Filter,
  Search,
  Pause,
  Play,
  Trash2,
  Download,
  GitCommit,
  GitPullRequest,
  GitMerge,
  GitBranch,
  ExternalLink,
  FolderGit2,
  MessageSquare,
  RotateCcw,
  Flag,
  RefreshCw,
  Sparkles
} from "lucide-react"
import Link from "next/link"
import { GitActionModal } from "@/components/git-action-modal"
import { InterviewModal } from "@/components/interview/interview-modal"
import { useGitAction, useGitLabProjects, useGitLabCommits } from "@/lib/api/hooks"
import { gitlabApi } from "@/lib/api"
import type { GitLabCommit, GitLabProject } from "@/lib/api"

type ActivityType = "success" | "error" | "pending" | "running" | "info"
type ActivityCategory = "general" | "commit" | "pr" | "merge" | "branch" | "deploy" | "test"

interface ActivityItem {
  id: string
  type: ActivityType
  category: ActivityCategory
  source: string
  message: string
  details?: string
  timestamp: Date
  // Git-related fields
  commitSha?: string
  commitShortSha?: string
  branch?: string
  repo?: string
  repoUrl?: string
  commitUrl?: string
  prNumber?: number
  filesChanged?: number
  additions?: number
  deletions?: number
  packetId?: string
  isReal?: boolean // Distinguishes real GitLab data from mock
}

// Convert a GitLab commit to an ActivityItem
function commitToActivity(commit: GitLabCommit, project: GitLabProject): ActivityItem {
  // Extract Linear issue reference if present (e.g., [GTE-111])
  const linearMatch = commit.title.match(/\[([A-Z]+-\d+)\]/)
  const packetId = linearMatch ? linearMatch[1] : undefined

  return {
    id: `gitlab-${commit.id}`,
    type: "success",
    category: "commit",
    source: commit.author_name,
    message: `Commit: ${commit.title}`,
    timestamp: new Date(commit.created_at),
    commitSha: commit.id,
    commitShortSha: commit.short_id,
    repo: project.name,
    repoUrl: project.web_url,
    commitUrl: commit.web_url,
    branch: project.default_branch || "main",
    additions: commit.stats?.additions,
    deletions: commit.stats?.deletions,
    packetId,
    isReal: true
  }
}

const statusConfig: Record<ActivityType, {
  icon: typeof CheckCircle
  color: string
  bg: string
  label: string
  animate?: boolean
}> = {
  success: {
    icon: CheckCircle,
    color: "text-green-400",
    bg: "bg-green-400",
    label: "Success"
  },
  error: {
    icon: XCircle,
    color: "text-red-400",
    bg: "bg-red-400",
    label: "Error"
  },
  pending: {
    icon: Clock,
    color: "text-yellow-400",
    bg: "bg-yellow-400",
    label: "Pending"
  },
  running: {
    icon: Loader2,
    color: "text-blue-400",
    bg: "bg-blue-400",
    animate: true,
    label: "Running"
  },
  info: {
    icon: CheckCircle,
    color: "text-muted-foreground",
    bg: "bg-muted-foreground",
    label: "Info"
  }
}

const categoryConfig = {
  general: { icon: CheckCircle },
  commit: { icon: GitCommit },
  pr: { icon: GitPullRequest },
  merge: { icon: GitMerge },
  branch: { icon: GitBranch },
  deploy: { icon: CheckCircle },
  test: { icon: CheckCircle }
}

// Mock activity generator for demo
function generateMockActivity(): ActivityItem {
  const types: ActivityType[] = ["success", "error", "pending", "running", "info"]
  const sources = ["BEAST", "BEDROOM", "Claude", "n8n", "GitLab", "Linear"]
  const repos = ["claudia-admin-panel", "claudia-backend", "n8n-workflows"]
  const branches = ["main", "feature/auth-flow", "feature/dashboard-charts", "fix/login-validation"]

  const messages = [
    { type: "success", category: "commit", msgs: [
      "Commit pushed: feat: implement user authentication",
      "Commit pushed: fix: resolve sidebar collapse state",
      "Commit pushed: test: add unit tests for auth"
    ]},
    { type: "success", category: "merge", msgs: [
      "PR merged: Feature/dashboard-redesign",
      "PR merged: Fix/login-validation",
      "Branch merged: feature/auth-flow → main"
    ]},
    { type: "success", category: "deploy", msgs: [
      "Deployment successful: Production v2.1.4",
      "Deployed to staging: v2.1.5-beta"
    ]},
    { type: "success", category: "test", msgs: [
      "Build passed: All 47 tests green",
      "E2E tests passed: 12/12 scenarios"
    ]},
    { type: "error", category: "test", msgs: [
      "Build failed: Type error in LoginForm.tsx",
      "Test failed: API integration timeout",
      "Lint error: Unused variable in utils.ts"
    ]},
    { type: "pending", category: "pr", msgs: [
      "Awaiting approval: PR #142 needs review",
      "PR ready for review: #145 Dashboard metrics"
    ]},
    { type: "running", category: "commit", msgs: [
      "Generating: Dashboard component layout",
      "Building: Production bundle"
    ]},
    { type: "info", category: "general", msgs: [
      "Agent connected: BEAST online",
      "Config updated: API rate limit increased",
      "Cache cleared: Static assets refreshed"
    ]}
  ]

  const type = types[Math.floor(Math.random() * types.length)]
  const source = sources[Math.floor(Math.random() * sources.length)]
  const msgGroup = messages.find(m => m.type === type)!
  const message = msgGroup.msgs[Math.floor(Math.random() * msgGroup.msgs.length)]
  const repo = repos[Math.floor(Math.random() * repos.length)]
  const branch = branches[Math.floor(Math.random() * branches.length)]

  // Generate a random short sha
  const chars = "abcdef0123456789"
  const shortSha = Array.from({ length: 7 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")

  const isGitActivity = ["commit", "pr", "merge", "branch"].includes(msgGroup.category as string)

  return {
    id: crypto.randomUUID(),
    type,
    category: (msgGroup.category || "general") as ActivityCategory,
    source,
    message,
    timestamp: new Date(),
    ...(isGitActivity && {
      commitShortSha: shortSha,
      branch,
      repo,
      filesChanged: Math.floor(Math.random() * 10) + 1,
      additions: Math.floor(Math.random() * 200) + 10,
      deletions: Math.floor(Math.random() * 50),
      packetId: Math.random() > 0.5 ? `PKT-00${Math.floor(Math.random() * 9) + 1}` : undefined
    })
  }
}

// Initial mock data with git-related info
const initialActivities: ActivityItem[] = [
  {
    id: "1",
    type: "success",
    category: "commit",
    source: "BEAST",
    message: "Commit pushed: feat: implement user authentication flow",
    timestamp: new Date(Date.now() - 120000),
    commitShortSha: "a1b2c3d",
    branch: "feature/auth-flow",
    repo: "claudia-admin-panel",
    filesChanged: 8,
    additions: 342,
    deletions: 45,
    packetId: "PKT-001"
  },
  {
    id: "2",
    type: "success",
    category: "pr",
    source: "Claude",
    message: "Code review approved: PR #138",
    timestamp: new Date(Date.now() - 300000),
    prNumber: 138,
    repo: "claudia-admin-panel",
    branch: "feature/dashboard-charts"
  },
  {
    id: "3",
    type: "running",
    category: "commit",
    source: "BEAST",
    message: "Generating: Dashboard metrics visualization",
    timestamp: new Date(Date.now() - 420000),
    branch: "feature/dashboard-charts",
    repo: "claudia-admin-panel",
    packetId: "PKT-002"
  },
  {
    id: "4",
    type: "pending",
    category: "deploy",
    source: "n8n",
    message: "Awaiting approval: Deploy to staging",
    timestamp: new Date(Date.now() - 600000),
    branch: "main",
    repo: "claudia-backend"
  },
  {
    id: "5",
    type: "error",
    category: "test",
    source: "BEDROOM",
    message: "Build failed: Missing dependency @radix-ui/react-dialog",
    timestamp: new Date(Date.now() - 720000),
    commitShortSha: "f6e5d4c",
    branch: "feature/voice-commands",
    repo: "n8n-workflows"
  },
  {
    id: "6",
    type: "success",
    category: "merge",
    source: "GitLab",
    message: "Branch merged: fix/login-validation → main",
    timestamp: new Date(Date.now() - 900000),
    branch: "main",
    repo: "claudia-admin-panel",
    prNumber: 135
  },
  {
    id: "7",
    type: "info",
    category: "general",
    source: "Linear",
    message: "Issue CLU-42 status changed to In Progress",
    timestamp: new Date(Date.now() - 1080000)
  },
  {
    id: "8",
    type: "running",
    category: "commit",
    source: "Claude",
    message: "Analyzing: Codebase structure for refactoring",
    timestamp: new Date(Date.now() - 1200000),
    repo: "claudia-backend"
  },
]

function formatTimestamp(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (seconds < 60) return `${seconds}s ago`
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return date.toLocaleDateString()
}

type GitActionType = "rollback" | "comment" | "approve" | "reject" | "flag"

interface ActionModalState {
  open: boolean
  type: GitActionType
  target: {
    type: "commit" | "pr" | "branch" | "activity"
    id: string
    title: string
    sha?: string
    branch?: string
    repo?: string
  }
}

export default function ActivityPage() {
  const [simulatedActivities, setSimulatedActivities] = useState<ActivityItem[]>(initialActivities)
  const [isStreaming, setIsStreaming] = useState(true)
  const [filter, setFilter] = useState<ActivityType | "all">("all")
  const [search, setSearch] = useState("")
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Fetch real GitLab data
  const { projects, isLoading: projectsLoading, refresh: refreshProjects } = useGitLabProjects()
  const [gitLabActivities, setGitLabActivities] = useState<ActivityItem[]>([])
  const [loadingCommits, setLoadingCommits] = useState(false)

  // Fetch commits from all projects
  useEffect(() => {
    async function fetchAllCommits() {
      if (projects.length === 0) return

      setLoadingCommits(true)
      try {
        const allActivities: ActivityItem[] = []

        // Fetch commits from each project (limit to first 5 projects for performance)
        for (const project of projects.slice(0, 5)) {
          try {
            const commits = await gitlabApi.getCommits(project.id, { perPage: 10 })
            const activities = commits.map(commit => commitToActivity(commit, project))
            allActivities.push(...activities)
          } catch (err) {
            console.error(`Failed to fetch commits for ${project.name}:`, err)
          }
        }

        // Sort by timestamp descending
        allActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        setGitLabActivities(allActivities)
      } finally {
        setLoadingCommits(false)
      }
    }

    fetchAllCommits()
  }, [projects])

  // Merge simulated and real activities, sorted by timestamp
  const activities = useMemo(() => {
    const all = [...simulatedActivities, ...gitLabActivities]
    return all.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }, [simulatedActivities, gitLabActivities])

  // Action modal state
  const [actionModal, setActionModal] = useState<ActionModalState | null>(null)
  const gitAction = useGitAction()

  // Interview modal state
  const [interviewModal, setInterviewModal] = useState<{
    open: boolean
    activity: ActivityItem | null
  }>({ open: false, activity: null })

  const openActionModal = (type: GitActionType, activity: ActivityItem) => {
    setActionModal({
      open: true,
      type,
      target: {
        type: activity.category === "commit" ? "commit" : activity.category === "pr" ? "pr" : "activity",
        id: activity.id,
        title: activity.message,
        sha: activity.commitShortSha,
        branch: activity.branch,
        repo: activity.repo
      }
    })
  }

  const handleActionSubmit = async (
    action: GitActionType,
    data: { comment?: string; reason?: string }
  ) => {
    if (!actionModal) return

    await gitAction.execute(action, {
      type: actionModal.target.type,
      id: actionModal.target.id,
      sha: actionModal.target.sha,
      branch: actionModal.target.branch,
      repo: actionModal.target.repo
    }, data)
  }

  // Simulate WebSocket streaming for non-git activities
  useEffect(() => {
    if (!isStreaming) return

    const interval = setInterval(() => {
      const newActivity = generateMockActivity()
      setSimulatedActivities(prev => [newActivity, ...prev].slice(0, 50)) // Keep last 50 simulated
    }, 5000 + Math.random() * 5000) // Random 5-10s interval

    return () => clearInterval(interval)
  }, [isStreaming])

  const handleRefresh = () => {
    refreshProjects()
  }

  // Filter and search activities
  const filteredActivities = activities.filter(activity => {
    const matchesFilter = filter === "all" || activity.type === filter
    const matchesSearch = search === "" ||
      activity.message.toLowerCase().includes(search.toLowerCase()) ||
      activity.source.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const stats = {
    total: activities.length,
    success: activities.filter(a => a.type === "success").length,
    error: activities.filter(a => a.type === "error").length,
    running: activities.filter(a => a.type === "running").length,
    pending: activities.filter(a => a.type === "pending").length,
  }

  return (
    <div className="flex flex-col gap-6 p-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Activity Feed</h1>
          <p className="text-sm text-muted-foreground">
            Real-time stream of all agent and system activity
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsStreaming(!isStreaming)}
            className="gap-2"
          >
            {isStreaming ? (
              <>
                <Pause className="h-4 w-4" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Resume
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="gap-2"
            disabled={projectsLoading || loadingCommits}
          >
            <RefreshCw className={cn("h-4 w-4", (projectsLoading || loadingCommits) && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSimulatedActivities([])}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Clear Simulated
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Success", value: stats.success, color: "text-green-400" },
          { label: "Errors", value: stats.error, color: "text-red-400" },
          { label: "Running", value: stats.running, color: "text-blue-400" },
          { label: "Pending", value: stats.pending, color: "text-yellow-400" },
        ].map(stat => (
          <Card key={stat.label} className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{stat.label}</span>
              <span className={cn("text-lg font-semibold", stat.color)}>{stat.value}</span>
            </div>
          </Card>
        ))}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search activities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent pl-10 pr-4 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="h-4 w-4 text-muted-foreground mr-2" />
          {(["all", "success", "error", "running", "pending"] as const).map(type => (
            <Button
              key={type}
              variant={filter === type ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setFilter(type)}
              className="capitalize"
            >
              {type}
            </Button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3 flex-1 min-h-0">
        {/* Activity List */}
        <Card className="lg:col-span-2 flex flex-col min-h-0">
          <CardHeader className="pb-2 flex-none flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium">
              Live Stream
              {isStreaming && (
                <span className="ml-2 inline-flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
                  </span>
                </span>
              )}
            </CardTitle>
            <span className="text-sm text-muted-foreground">
              {filteredActivities.length} items
            </span>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto min-h-0" ref={scrollRef}>
            <div className="space-y-1">
              {filteredActivities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <p className="text-sm">No activities to display</p>
                  <p className="text-xs mt-1">Activity will appear here as it happens</p>
                </div>
              ) : (
                filteredActivities.map((activity) => {
                  const config = statusConfig[activity.type]
                  const Icon = config.icon
                  const isSelected = selectedActivity?.id === activity.id
                  return (
                    <div
                      key={activity.id}
                      onClick={() => setSelectedActivity(activity)}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm cursor-pointer transition-colors",
                        isSelected ? "bg-accent" : "hover:bg-accent/50"
                      )}
                    >
                      <div className="relative flex h-2 w-2 flex-none">
                        <span
                          className={cn(
                            "absolute inline-flex h-full w-full rounded-full opacity-75",
                            config.bg,
                            config.animate && "animate-ping"
                          )}
                        />
                        <span
                          className={cn(
                            "relative inline-flex h-2 w-2 rounded-full",
                            config.bg
                          )}
                        />
                      </div>
                      <Badge variant="outline" className={cn("font-mono text-xs flex-none", activity.isReal && "border-orange-400/50")}>
                        {activity.source}
                      </Badge>
                      <span className="flex-1 truncate text-foreground">
                        {activity.message}
                      </span>
                      {activity.isReal && (
                        <Badge variant="secondary" className="text-xs flex-none">GitLab</Badge>
                      )}
                      <span className="text-xs text-muted-foreground flex-none">
                        {formatTimestamp(activity.timestamp)}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Detail Panel */}
        <Card className="flex flex-col min-h-0">
          <CardHeader className="pb-2 flex-none">
            <CardTitle className="text-base font-medium">Details</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {selectedActivity ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p>
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", statusConfig[selectedActivity.type].bg)} />
                    <span className="font-medium capitalize">{selectedActivity.type}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Source</p>
                  <Badge variant="outline" className="font-mono">
                    {selectedActivity.source}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Message</p>
                  <p className="text-sm">{selectedActivity.message}</p>
                </div>

                {/* Git-related details */}
                {selectedActivity.repo && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Repository</p>
                    <div className="flex items-center gap-2">
                      <Link
                        href="/files"
                        className="flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <FolderGit2 className="h-4 w-4" />
                        {selectedActivity.repo}
                      </Link>
                      {selectedActivity.repoUrl && (
                        <a
                          href={selectedActivity.repoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {selectedActivity.isReal && (
                  <Badge variant="outline" className="w-fit text-xs">
                    <GitCommit className="h-3 w-3 mr-1" />
                    GitLab
                  </Badge>
                )}

                {selectedActivity.branch && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Branch</p>
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-muted-foreground" />
                      <code className="text-sm font-mono bg-muted px-1.5 py-0.5 rounded">
                        {selectedActivity.branch}
                      </code>
                    </div>
                  </div>
                )}

                {selectedActivity.commitShortSha && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Commit</p>
                    {selectedActivity.commitUrl ? (
                      <a
                        href={selectedActivity.commitUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm hover:underline"
                      >
                        <GitCommit className="h-4 w-4 text-muted-foreground" />
                        <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-primary">
                          {selectedActivity.commitShortSha}
                        </code>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </a>
                    ) : (
                      <Link
                        href="/files"
                        className="flex items-center gap-2 text-sm hover:underline"
                      >
                        <GitCommit className="h-4 w-4 text-muted-foreground" />
                        <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-primary">
                          {selectedActivity.commitShortSha}
                        </code>
                      </Link>
                    )}
                  </div>
                )}

                {selectedActivity.prNumber && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Pull Request</p>
                    <div className="flex items-center gap-2">
                      <GitPullRequest className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">#{selectedActivity.prNumber}</span>
                    </div>
                  </div>
                )}

                {(selectedActivity.filesChanged || selectedActivity.additions || selectedActivity.deletions) && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Changes</p>
                    <div className="flex items-center gap-3 text-sm">
                      {selectedActivity.filesChanged && (
                        <span>{selectedActivity.filesChanged} files</span>
                      )}
                      {selectedActivity.additions !== undefined && (
                        <span className="text-green-400">+{selectedActivity.additions}</span>
                      )}
                      {selectedActivity.deletions !== undefined && (
                        <span className="text-red-400">-{selectedActivity.deletions}</span>
                      )}
                    </div>
                  </div>
                )}

                {selectedActivity.packetId && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Packet</p>
                    <Link href="/packets">
                      <Badge variant="outline" className="font-mono cursor-pointer hover:bg-accent">
                        {selectedActivity.packetId}
                      </Badge>
                    </Link>
                  </div>
                )}

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Timestamp</p>
                  <p className="text-sm font-mono">
                    {selectedActivity.timestamp.toLocaleString()}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">ID</p>
                  <p className="text-xs font-mono text-muted-foreground break-all">
                    {selectedActivity.id}
                  </p>
                </div>
                {/* Actions for git-related activities */}
                {(selectedActivity.repo || selectedActivity.commitShortSha) && (
                  <div className="space-y-2 pt-2 border-t">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Actions</p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1.5"
                        onClick={() => openActionModal("comment", selectedActivity)}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Comment
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1.5"
                        onClick={() => openActionModal("flag", selectedActivity)}
                      >
                        <Flag className="h-3.5 w-3.5" />
                        Flag
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-1.5 text-primary hover:text-primary hover:bg-primary/10"
                      onClick={() => setInterviewModal({ open: true, activity: selectedActivity })}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Interview AI
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-1.5 text-red-400 hover:text-red-400 hover:bg-red-400/10"
                      onClick={() => openActionModal("rollback", selectedActivity)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Request Rollback
                    </Button>
                  </div>
                )}

                <div className="pt-4 space-y-2">
                  {selectedActivity.repo && (
                    <Button variant="outline" size="sm" className="w-full gap-2" asChild>
                      <Link href="/files">
                        <FolderGit2 className="h-4 w-4" />
                        View in Files
                      </Link>
                    </Button>
                  )}
                  {selectedActivity.packetId && (
                    <Button variant="outline" size="sm" className="w-full gap-2" asChild>
                      <Link href="/packets">
                        View Packet
                      </Link>
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="w-full">
                    Copy Details
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <p className="text-sm">Select an activity</p>
                <p className="text-xs mt-1">to view details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Modal */}
      {actionModal && (
        <GitActionModal
          open={actionModal.open}
          onOpenChange={(open) => !open && setActionModal(null)}
          actionType={actionModal.type}
          target={actionModal.target}
          onSubmit={handleActionSubmit}
        />
      )}

      {/* Interview Modal */}
      {interviewModal.activity && (
        <InterviewModal
          open={interviewModal.open}
          onOpenChange={(open) => setInterviewModal({ open, activity: open ? interviewModal.activity : null })}
          targetType="activity"
          targetId={interviewModal.activity.id}
          targetTitle={interviewModal.activity.message}
          targetContext={{
            status: interviewModal.activity.type,
            source: interviewModal.activity.source,
            repo: interviewModal.activity.repo,
            branch: interviewModal.activity.branch,
            commitSha: interviewModal.activity.commitShortSha,
            additions: interviewModal.activity.additions,
            deletions: interviewModal.activity.deletions
          }}
        />
      )}
    </div>
  )
}
