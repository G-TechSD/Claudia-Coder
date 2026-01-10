"use client"

import * as React from "react"
import { useState, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import {
  Folder,
  FileCode,
  GitCommit,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Brain,
  Package,
  ChevronRight,
  ChevronDown,
  FileText,
  ArrowRight,
  Sparkles,
  MessageSquare,
  ClipboardList,
  Lightbulb,
  Code2,
  History,
  BookOpen,
  Send
} from "lucide-react"

// ============ Types ============

interface FileInfo {
  path: string
  relativePath: string
  name: string
  extension: string
  size: number
  language: string
}

interface FolderInfo {
  path: string
  relativePath: string
  name: string
  fileCount: number
  subfolderCount: number
}

interface CodebaseStructure {
  rootPath: string
  totalFiles: number
  totalFolders: number
  files: FileInfo[]
  folders: FolderInfo[]
  languageBreakdown: Record<string, number>
  topLevelFolders: string[]
  hasPackageJson: boolean
  hasCargoToml: boolean
  hasPyprojectToml: boolean
  hasGoMod: boolean
  hasGitignore: boolean
  hasReadme: boolean
  detectedFrameworks: string[]
}

interface TodoComment {
  type: "TODO" | "FIXME" | "HACK" | "NOTE" | "XXX" | "BUG"
  content: string
  filePath: string
  lineNumber: number
  context: string
  priority: "low" | "medium" | "high"
}

interface CommitInfo {
  hash: string
  shortHash: string
  author: string
  date: string
  message: string
  filesChanged: number
  insertions: number
  deletions: number
}

interface CommitHistory {
  totalCommits: number
  recentCommits: CommitInfo[]
  contributors: { name: string; commits: number }[]
  activitySummary: string
  lastCommitDate: string | null
  primaryBranch: string
}

interface CodebaseAnalysis {
  structure: CodebaseStructure
  todos: TodoComment[]
  commitHistory: CommitHistory | null
  analyzedAt: string
  analysisVersion: string
}

interface ProjectDocumentation {
  summary: string
  purpose: string
  architecture: string
  techStack: string[]
  keyFeatures: string[]
  entryPoints: string[]
  mainModules: { name: string; purpose: string; files: string[] }[]
  dependencies: string[]
  developmentNotes: string[]
}

interface RecommendedPacket {
  id: string
  title: string
  description: string
  type: "feature" | "fix" | "refactor" | "docs" | "test" | "chore"
  priority: "low" | "medium" | "high" | "critical"
  estimatedEffort: "small" | "medium" | "large"
  reasoning: string
  affectedFiles: string[]
  tasks: string[]
  selected?: boolean
}

interface AnalyzerStep {
  id: string
  title: string
  description: string
  status: "pending" | "in_progress" | "completed" | "error"
  progress?: number
}

interface CodebaseAnalyzerProps {
  projectId: string
  projectName: string
  repoPath: string
  onComplete?: (buildPlan: GeneratedBuildPlan) => void
  onCancel?: () => void
  className?: string
}

interface GeneratedBuildPlan {
  packets: RecommendedPacket[]
  documentation: ProjectDocumentation | null
  userNotes: string
  direction: string
}

// ============ Language Colors ============

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "bg-blue-500",
  JavaScript: "bg-yellow-500",
  Python: "bg-green-500",
  Rust: "bg-orange-500",
  Go: "bg-cyan-500",
  Ruby: "bg-red-500",
  Java: "bg-red-600",
  "C++": "bg-purple-500",
  C: "bg-gray-500",
  "C#": "bg-violet-500",
  Swift: "bg-orange-400",
  Kotlin: "bg-purple-400",
  PHP: "bg-indigo-500",
  HTML: "bg-orange-600",
  CSS: "bg-blue-400",
  SCSS: "bg-pink-500",
  JSON: "bg-gray-400",
  YAML: "bg-gray-400",
  Markdown: "bg-gray-500",
  Shell: "bg-green-600",
  Unknown: "bg-gray-600"
}

// ============ Components ============

function StepIndicator({ steps, currentStep }: { steps: AnalyzerStep[]; currentStep: number }) {
  return (
    <div className="flex items-center justify-between mb-6">
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                step.status === "completed" && "bg-green-500 text-white",
                step.status === "in_progress" && "bg-blue-500 text-white animate-pulse",
                step.status === "error" && "bg-red-500 text-white",
                step.status === "pending" && "bg-muted text-muted-foreground"
              )}
            >
              {step.status === "completed" ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : step.status === "in_progress" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : step.status === "error" ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                index + 1
              )}
            </div>
            <span className="text-xs mt-1 text-center max-w-[80px] text-muted-foreground">
              {step.title}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={cn(
                "flex-1 h-0.5 mx-2",
                index < currentStep ? "bg-green-500" : "bg-muted"
              )}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

function LanguageChart({ breakdown }: { breakdown: Record<string, number> }) {
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0)
  const sorted = Object.entries(breakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  return (
    <div className="space-y-2">
      {sorted.map(([lang, count]) => {
        const percent = Math.round((count / total) * 100)
        return (
          <div key={lang} className="flex items-center gap-2">
            <div className={cn("w-3 h-3 rounded-full", LANGUAGE_COLORS[lang] || "bg-gray-500")} />
            <span className="text-sm flex-1">{lang}</span>
            <span className="text-sm text-muted-foreground">{count} files</span>
            <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn("h-full", LANGUAGE_COLORS[lang] || "bg-gray-500")}
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-8">{percent}%</span>
          </div>
        )
      })}
    </div>
  )
}

function TodoList({ todos }: { todos: TodoComment[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  const groupedByType: Record<string, TodoComment[]> = {}
  for (const todo of todos) {
    if (!groupedByType[todo.type]) {
      groupedByType[todo.type] = []
    }
    groupedByType[todo.type].push(todo)
  }

  const typeColors: Record<string, string> = {
    FIXME: "text-red-400 border-red-500/30 bg-red-500/10",
    BUG: "text-red-400 border-red-500/30 bg-red-500/10",
    HACK: "text-orange-400 border-orange-500/30 bg-orange-500/10",
    XXX: "text-orange-400 border-orange-500/30 bg-orange-500/10",
    TODO: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
    NOTE: "text-blue-400 border-blue-500/30 bg-blue-500/10"
  }

  return (
    <div className="space-y-4">
      {Object.entries(groupedByType).map(([type, items]) => (
        <div key={type} className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={typeColors[type]}>
              {type}
            </Badge>
            <span className="text-sm text-muted-foreground">({items.length})</span>
          </div>
          <div className="space-y-1 pl-2">
            {items.slice(0, 5).map((todo, idx) => {
              const key = `${todo.filePath}-${todo.lineNumber}-${idx}`
              const isExpanded = expanded === key

              return (
                <div
                  key={key}
                  className="p-2 rounded-lg bg-background/50 border border-border/50 cursor-pointer hover:bg-background/80 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : key)}
                >
                  <div className="flex items-start gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{todo.content}</p>
                      <p className="text-xs text-muted-foreground">
                        {todo.filePath}:{todo.lineNumber}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        todo.priority === "high" && "text-red-400 border-red-500/30",
                        todo.priority === "medium" && "text-yellow-400 border-yellow-500/30",
                        todo.priority === "low" && "text-gray-400 border-gray-500/30"
                      )}
                    >
                      {todo.priority}
                    </Badge>
                  </div>
                  {isExpanded && (
                    <pre className="mt-2 p-2 bg-muted/50 rounded text-xs overflow-x-auto">
                      {todo.context}
                    </pre>
                  )}
                </div>
              )
            })}
            {items.length > 5 && (
              <p className="text-xs text-muted-foreground pl-6">
                +{items.length - 5} more {type} comments
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function CommitList({ history }: { history: CommitHistory }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{history.activitySummary}</span>
        <Badge variant="outline">{history.totalCommits} total commits</Badge>
      </div>

      <div className="space-y-2">
        {history.recentCommits.slice(0, 10).map((commit) => (
          <div
            key={commit.hash}
            className="p-3 rounded-lg bg-background/50 border border-border/50"
          >
            <div className="flex items-start gap-3">
              <GitCommit className="h-4 w-4 mt-1 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{commit.message}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span>{commit.author}</span>
                  <span>-</span>
                  <span>{new Date(commit.date).toLocaleDateString()}</span>
                  {commit.filesChanged > 0 && (
                    <>
                      <span>-</span>
                      <span>
                        {commit.filesChanged} files,{" "}
                        <span className="text-green-400">+{commit.insertions}</span>{" "}
                        <span className="text-red-400">-{commit.deletions}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
              <code className="text-xs text-muted-foreground font-mono">
                {commit.shortHash}
              </code>
            </div>
          </div>
        ))}
      </div>

      {history.contributors.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium mb-2">Contributors</h4>
          <div className="flex flex-wrap gap-2">
            {history.contributors.slice(0, 5).map((contributor) => (
              <Badge key={contributor.name} variant="secondary">
                {contributor.name} ({contributor.commits})
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function DocumentationDisplay({ doc }: { doc: ProjectDocumentation }) {
  const [expandedModule, setExpandedModule] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
          <BookOpen className="h-4 w-4" /> Summary
        </h4>
        <p className="text-sm text-muted-foreground">{doc.summary}</p>
      </div>

      <div>
        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
          <Lightbulb className="h-4 w-4" /> Purpose
        </h4>
        <p className="text-sm text-muted-foreground">{doc.purpose}</p>
      </div>

      <div>
        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
          <Code2 className="h-4 w-4" /> Architecture
        </h4>
        <p className="text-sm text-muted-foreground">{doc.architecture}</p>
      </div>

      {doc.techStack.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Tech Stack</h4>
          <div className="flex flex-wrap gap-2">
            {doc.techStack.map((tech) => (
              <Badge key={tech} variant="secondary">
                {tech}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {doc.keyFeatures.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Key Features</h4>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            {doc.keyFeatures.map((feature, idx) => (
              <li key={idx}>{feature}</li>
            ))}
          </ul>
        </div>
      )}

      {doc.mainModules.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Main Modules</h4>
          <div className="space-y-2">
            {doc.mainModules.map((module) => (
              <div
                key={module.name}
                className="p-3 rounded-lg bg-background/50 border border-border/50 cursor-pointer"
                onClick={() =>
                  setExpandedModule(expandedModule === module.name ? null : module.name)
                }
              >
                <div className="flex items-center gap-2">
                  {expandedModule === module.name ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="font-medium text-sm">{module.name}</span>
                </div>
                {expandedModule === module.name && (
                  <div className="mt-2 pl-6 space-y-2">
                    <p className="text-sm text-muted-foreground">{module.purpose}</p>
                    {module.files.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {module.files.map((file) => (
                          <code key={file} className="text-xs bg-muted px-1 rounded">
                            {file}
                          </code>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {doc.developmentNotes.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Development Notes</h4>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            {doc.developmentNotes.map((note, idx) => (
              <li key={idx}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function PacketSelector({
  packets,
  onToggle
}: {
  packets: RecommendedPacket[]
  onToggle: (id: string) => void
}) {
  const typeIcons: Record<string, React.ReactNode> = {
    feature: <Sparkles className="h-4 w-4" />,
    fix: <AlertTriangle className="h-4 w-4" />,
    refactor: <Code2 className="h-4 w-4" />,
    docs: <FileText className="h-4 w-4" />,
    test: <CheckCircle2 className="h-4 w-4" />,
    chore: <Package className="h-4 w-4" />
  }

  const priorityColors: Record<string, string> = {
    critical: "text-red-400 border-red-500/30 bg-red-500/10",
    high: "text-orange-400 border-orange-500/30 bg-orange-500/10",
    medium: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
    low: "text-gray-400 border-gray-500/30 bg-gray-500/10"
  }

  const effortColors: Record<string, string> = {
    small: "text-green-400",
    medium: "text-yellow-400",
    large: "text-red-400"
  }

  return (
    <div className="space-y-3">
      {packets.map((packet) => (
        <div
          key={packet.id}
          className={cn(
            "p-4 rounded-lg border transition-all cursor-pointer",
            packet.selected
              ? "bg-primary/10 border-primary/50"
              : "bg-background/50 border-border/50 hover:bg-background/80"
          )}
          onClick={() => onToggle(packet.id)}
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "mt-0.5 p-1.5 rounded-lg",
                packet.selected ? "bg-primary/20" : "bg-muted"
              )}
            >
              {typeIcons[packet.type] || <Package className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-sm">{packet.title}</h4>
                <Badge variant="outline" className={priorityColors[packet.priority]}>
                  {packet.priority}
                </Badge>
                <span className={cn("text-xs", effortColors[packet.estimatedEffort])}>
                  {packet.estimatedEffort}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{packet.description}</p>
              {packet.tasks.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {packet.tasks.slice(0, 3).map((task, idx) => (
                    <span key={idx} className="text-xs bg-muted px-2 py-0.5 rounded">
                      {task.length > 40 ? task.substring(0, 40) + "..." : task}
                    </span>
                  ))}
                  {packet.tasks.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{packet.tasks.length - 3} more
                    </span>
                  )}
                </div>
              )}
            </div>
            <div
              className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                packet.selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground"
              )}
            >
              {packet.selected && <CheckCircle2 className="h-3 w-3" />}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ============ Main Component ============

export function CodebaseAnalyzer({
  projectId,
  projectName,
  repoPath,
  onComplete,
  onCancel,
  className
}: CodebaseAnalyzerProps) {
  // State
  const [currentStep, setCurrentStep] = useState(0)
  const [analysis, setAnalysis] = useState<CodebaseAnalysis | null>(null)
  const [documentation, setDocumentation] = useState<ProjectDocumentation | null>(null)
  const [packets, setPackets] = useState<RecommendedPacket[]>([])
  const [userNotes, setUserNotes] = useState("")
  const [direction, setDirection] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Analyzer steps
  const [steps, setSteps] = useState<AnalyzerStep[]>([
    { id: "scan", title: "Scanning", description: "Analyzing codebase structure", status: "pending" },
    { id: "structure", title: "Structure", description: "Review discovered structure", status: "pending" },
    { id: "todos", title: "TODOs", description: "Found TODO comments", status: "pending" },
    { id: "commits", title: "History", description: "Git commit history", status: "pending" },
    { id: "docs", title: "Summary", description: "AI-generated documentation", status: "pending" },
    { id: "packets", title: "Packets", description: "Recommended work", status: "pending" },
    { id: "input", title: "Direction", description: "Your input", status: "pending" },
    { id: "plan", title: "Build Plan", description: "Generate plan", status: "pending" }
  ])

  // Update step status
  const updateStep = useCallback((stepId: string, status: AnalyzerStep["status"], progress?: number) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, status, progress } : s))
    )
  }, [])

  // Start analysis
  const startAnalysis = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    updateStep("scan", "in_progress")

    try {
      const response = await fetch("/api/codebase/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoPath, projectId, projectName })
      })

      if (!response.ok) {
        throw new Error("Failed to analyze codebase")
      }

      const data = await response.json()
      setAnalysis(data.analysis)
      setDocumentation(data.documentation)
      setPackets(data.packets.map((p: RecommendedPacket) => ({ ...p, selected: true })))

      updateStep("scan", "completed")
      updateStep("structure", "completed")
      updateStep("todos", "completed")
      updateStep("commits", "completed")
      updateStep("docs", "completed")
      updateStep("packets", "completed")

      setCurrentStep(1) // Move to structure view
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed")
      updateStep("scan", "error")
    } finally {
      setIsLoading(false)
    }
  }, [repoPath, projectId, projectName, updateStep])

  // Start analysis on mount
  useEffect(() => {
    startAnalysis()
  }, [startAnalysis])

  // Toggle packet selection
  const togglePacket = useCallback((id: string) => {
    setPackets((prev) =>
      prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p))
    )
  }, [])

  // Generate build plan
  const generateBuildPlan = useCallback(() => {
    if (!onComplete) return

    updateStep("plan", "in_progress")

    const selectedPackets = packets.filter((p) => p.selected)

    const buildPlan: GeneratedBuildPlan = {
      packets: selectedPackets,
      documentation,
      userNotes,
      direction
    }

    updateStep("plan", "completed")
    onComplete(buildPlan)
  }, [packets, documentation, userNotes, direction, onComplete, updateStep])

  // Navigate between steps
  const goToStep = (step: number) => {
    if (step >= 0 && step <= 7 && analysis) {
      setCurrentStep(step)
    }
  }

  // Render step content
  const renderStepContent = () => {
    if (error) {
      return (
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Analysis Failed</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={startAnalysis}>
            <Loader2 className="h-4 w-4 mr-2" />
            Retry Analysis
          </Button>
        </div>
      )
    }

    if (!analysis && isLoading) {
      return (
        <div className="text-center py-12">
          <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Analyzing Codebase</h3>
          <p className="text-muted-foreground">
            Scanning files, extracting TODOs, reading commit history...
          </p>
        </div>
      )
    }

    if (!analysis) {
      return null
    }

    switch (currentStep) {
      case 0:
      case 1: // Structure
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <FileCode className="h-8 w-8 mx-auto mb-2 text-blue-400" />
                  <div className="text-2xl font-bold">{analysis.structure.totalFiles}</div>
                  <div className="text-sm text-muted-foreground">Files</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Folder className="h-8 w-8 mx-auto mb-2 text-yellow-400" />
                  <div className="text-2xl font-bold">{analysis.structure.totalFolders}</div>
                  <div className="text-sm text-muted-foreground">Folders</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Code2 className="h-8 w-8 mx-auto mb-2 text-green-400" />
                  <div className="text-2xl font-bold">
                    {Object.keys(analysis.structure.languageBreakdown).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Languages</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Package className="h-8 w-8 mx-auto mb-2 text-purple-400" />
                  <div className="text-2xl font-bold">
                    {analysis.structure.detectedFrameworks.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Frameworks</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Language Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <LanguageChart breakdown={analysis.structure.languageBreakdown} />
              </CardContent>
            </Card>

            {analysis.structure.detectedFrameworks.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Detected Frameworks & Tools</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {analysis.structure.detectedFrameworks.map((fw) => (
                      <Badge key={fw} variant="secondary">
                        {fw}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top-Level Structure</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {analysis.structure.topLevelFolders.map((folder) => (
                    <div
                      key={folder}
                      className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg"
                    >
                      <Folder className="h-4 w-4 text-yellow-400" />
                      <span className="text-sm">{folder}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case 2: // TODOs
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                TODO Comments ({analysis.todos.length} found)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analysis.todos.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <TodoList todos={analysis.todos} />
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-400" />
                  <p>No TODO comments found in the codebase</p>
                </div>
              )}
            </CardContent>
          </Card>
        )

      case 3: // Commits
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-5 w-5" />
                Commit History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analysis.commitHistory ? (
                <ScrollArea className="h-[400px]">
                  <CommitList history={analysis.commitHistory} />
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <GitCommit className="h-12 w-12 mx-auto mb-3" />
                  <p>No git repository found or no commit history available</p>
                </div>
              )}
            </CardContent>
          </Card>
        )

      case 4: // Documentation
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI-Generated Documentation
              </CardTitle>
            </CardHeader>
            <CardContent>
              {documentation ? (
                <ScrollArea className="h-[400px]">
                  <DocumentationDisplay doc={documentation} />
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Loader2 className="h-12 w-12 mx-auto mb-3 animate-spin" />
                  <p>Generating documentation...</p>
                </div>
              )}
            </CardContent>
          </Card>
        )

      case 5: // Packets
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-5 w-5" />
                Recommended Work Packets
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Select the packets you want to include in your build plan
              </p>
            </CardHeader>
            <CardContent>
              {packets.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <PacketSelector packets={packets} onToggle={togglePacket} />
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3" />
                  <p>No packet recommendations generated</p>
                </div>
              )}
            </CardContent>
          </Card>
        )

      case 6: // User Input
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Project Direction
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  What do you want to accomplish with this project? What&apos;s your vision?
                </p>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={direction}
                  onChange={(e) => setDirection(e.target.value)}
                  placeholder="Describe your goals, priorities, features you want to add, problems you want to solve..."
                  className="min-h-[120px]"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  Additional Notes
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Any context, constraints, or preferences for the build plan?
                </p>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={userNotes}
                  onChange={(e) => setUserNotes(e.target.value)}
                  placeholder="Technical requirements, timeline constraints, coding standards, dependencies to consider..."
                  className="min-h-[120px]"
                />
              </CardContent>
            </Card>
          </div>
        )

      case 7: // Build Plan Summary
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Build Plan Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-primary">
                      {packets.filter((p) => p.selected).length}
                    </div>
                    <div className="text-sm text-muted-foreground">Selected Packets</div>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-primary">
                      {packets
                        .filter((p) => p.selected)
                        .reduce((acc, p) => acc + p.tasks.length, 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Tasks</div>
                  </div>
                </div>

                {direction && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Project Direction</h4>
                    <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                      {direction}
                    </p>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-medium mb-2">Selected Packets</h4>
                  <div className="space-y-2">
                    {packets
                      .filter((p) => p.selected)
                      .map((packet, idx) => (
                        <div
                          key={packet.id}
                          className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg"
                        >
                          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/20 text-primary text-xs font-medium">
                            {idx + 1}
                          </div>
                          <span className="text-sm flex-1">{packet.title}</span>
                          <Badge variant="outline" className="text-xs">
                            {packet.type}
                          </Badge>
                        </div>
                      ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Codebase Analysis
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Analyzing {projectName} at {repoPath}
          </p>
        </div>
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>

      {/* Step Indicator */}
      <StepIndicator steps={steps} currentStep={currentStep} />

      {/* Step Content */}
      <div className="min-h-[400px]">{renderStepContent()}</div>

      {/* Navigation */}
      {analysis && (
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => goToStep(currentStep - 1)}
            disabled={currentStep === 0}
          >
            Previous
          </Button>

          <div className="flex gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((step) => (
              <button
                key={step}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  currentStep === step ? "bg-primary w-4" : "bg-muted hover:bg-muted-foreground/50"
                )}
                onClick={() => goToStep(step)}
              />
            ))}
          </div>

          {currentStep < 7 ? (
            <Button onClick={() => goToStep(currentStep + 1)}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={generateBuildPlan} className="bg-green-600 hover:bg-green-500">
              <Send className="h-4 w-4 mr-2" />
              Generate Build Plan
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
