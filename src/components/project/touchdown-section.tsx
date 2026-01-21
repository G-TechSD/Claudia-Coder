"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Target,
  CheckCircle,
  XCircle,
  Loader2,
  Play,
  FileText,
  AlertTriangle,
  Sparkles,
  Cloud,
  Server,
  RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface TouchdownSectionProps {
  projectId: string
  projectName: string
  projectDescription?: string
  workingDirectory?: string
  packets: Array<{
    id: string
    title: string
    description: string
    type: string
    priority: string
    status: string
    tasks: Array<{ id: string; description: string; completed: boolean }>
    acceptanceCriteria: string[]
  }>
  onTouchdownComplete?: () => void
  onPacketsGenerated?: (packets: Array<{
    id: string
    title: string
    description: string
    type: string
    priority: string
    status: string
    tasks: Array<{ id: string; description: string; completed: boolean }>
    acceptanceCriteria: string[]
  }>) => void
}

interface QualityGates {
  tests: { passed: boolean; output?: string }
  typeCheck: { passed: boolean; output?: string }
  build: { passed: boolean; output?: string }
}

interface TouchdownResult {
  success: boolean
  touchdownMarkdown: string
  qualityGates?: QualityGates
  codebaseAnalysis?: {
    filesCreated: number
    filesModified: number
    linesOfCode: number
  }
  aiAnalysis?: string
  allGatesPassing?: boolean
  mode?: string
}

/**
 * Touchdown Section - The completion/refinement phase
 *
 * Shows after work packets are complete. Allows running the "Touchdown"
 * which analyzes the codebase, checks quality gates, and refines code.
 */
export function TouchdownSection({
  projectId,
  projectName,
  projectDescription,
  workingDirectory,
  packets,
  onTouchdownComplete,
  onPacketsGenerated,
}: TouchdownSectionProps) {
  const [isRunning, setIsRunning] = React.useState(false)
  const [result, setResult] = React.useState<TouchdownResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [isProcessingRefinements, setIsProcessingRefinements] = React.useState(false)
  const [processedPacketsCount, setProcessedPacketsCount] = React.useState<number | null>(null)
  const [processedMessage, setProcessedMessage] = React.useState<string | null>(null)

  // Options
  const [mode, setMode] = React.useState<"auto" | "local" | "cloud">("auto")
  const [runQualityGates, setRunQualityGates] = React.useState(true)
  const [generateAnalysis, setGenerateAnalysis] = React.useState(true)

  const completedPackets = packets.filter(p => p.status === "completed")
  const hasCompletedWork = completedPackets.length > 0

  const handleRunTouchdown = async () => {
    if (!workingDirectory) {
      setError("No working directory configured for this project")
      return
    }

    setIsRunning(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/touchdown`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workingDirectory,
          packets,
          mode,
          runQualityGates,
          generateAnalysis,
          // Pass project info since server can't access localStorage
          project: {
            id: projectId,
            name: projectName,
            description: projectDescription,
          },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Touchdown failed")
      }

      setResult(data)
      onTouchdownComplete?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Touchdown failed")
    } finally {
      setIsRunning(false)
    }
  }

  // Process the touchdown analysis into refinement packets
  const handleProcessRefinements = async () => {
    if (!result) return

    setIsProcessingRefinements(true)
    setError(null)
    setProcessedPacketsCount(null)
    setProcessedMessage(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/touchdown/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          projectName,
          qualityGates: result.qualityGates,
          aiAnalysis: result.aiAnalysis,
          touchdownMarkdown: result.touchdownMarkdown,
        }),
      })

      const data = await response.json()
      console.log("[touchdown] Process refinements response:", data)

      if (!response.ok) {
        throw new Error(data.error || "Failed to process refinements")
      }

      setProcessedPacketsCount(data.count || 0)

      if (data.packets && data.packets.length > 0) {
        setProcessedMessage(`Created ${data.packets.length} refinement packet${data.packets.length > 1 ? "s" : ""}!`)
        onPacketsGenerated?.(data.packets)
      } else {
        // No packets generated - explain why
        const reasons: string[] = []
        if (result.qualityGates?.tests.passed) reasons.push("tests passing")
        if (result.qualityGates?.typeCheck.passed) reasons.push("no TypeScript errors")
        if (result.qualityGates?.build.passed) reasons.push("build succeeding")
        if (!result.aiAnalysis || result.aiAnalysis.length < 100) reasons.push("no AI suggestions")

        if (reasons.length > 0) {
          setProcessedMessage(`No refinement packets needed - ${reasons.join(", ")}. Project looks good!`)
        } else {
          setProcessedMessage("No actionable refinements could be extracted. Review the AI analysis manually.")
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process refinements")
    } finally {
      setIsProcessingRefinements(false)
    }
  }

  // Check if there are issues that could become refinement packets
  const hasIssues = result && (
    (result.qualityGates && (!result.qualityGates.tests.passed || !result.qualityGates.typeCheck.passed || !result.qualityGates.build.passed)) ||
    (result.aiAnalysis && result.aiAnalysis.length > 100)
  )

  return (
    <Card className="border-2 border-sky-500/30 bg-gradient-to-br from-sky-500/5 via-blue-500/5 to-transparent relative overflow-hidden">
      {/* Decorative runway/landing strip */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-sky-500/30 to-transparent" />
      <div className="absolute bottom-2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sky-500/20 to-transparent" />

      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Football transforming to jet touchdown visual */}
            <div className="p-3 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-500/20 border border-sky-500/30 relative">
              <div className="flex items-center gap-1">
                <span className="text-2xl opacity-50">🏈</span>
                <span className="text-sky-400 text-xs">→</span>
                <span className="text-2xl">✈️</span>
              </div>
              {/* Landing effect */}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-sky-500/50 rounded-full blur-sm" />
            </div>
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <span className="text-sky-400">🏈</span> Touchdown!
                {result?.allGatesPassing && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
                    All Passing
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Mission complete — reviewing and landing your project
              </CardDescription>
            </div>
          </div>
          {result && (
            <Badge variant="outline" className="text-muted-foreground">
              {result.mode === "cloud" ? (
                <><Cloud className="h-3 w-3 mr-1" /> Cloud</>
              ) : (
                <><Server className="h-3 w-3 mr-1" /> Local</>
              )}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Work Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 rounded-lg bg-gray-900/50 border border-gray-800">
            <div className="text-2xl font-bold text-white">{packets.length}</div>
            <div className="text-xs text-muted-foreground">Total Packets</div>
          </div>
          <div className="p-3 rounded-lg bg-gray-900/50 border border-gray-800">
            <div className="text-2xl font-bold text-green-400">{completedPackets.length}</div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </div>
          <div className="p-3 rounded-lg bg-gray-900/50 border border-gray-800">
            <div className="text-2xl font-bold text-sky-400">{packets.length - completedPackets.length}</div>
            <div className="text-xs text-muted-foreground">Remaining</div>
          </div>
        </div>

        {/* Quality Gates Display */}
        {result?.qualityGates && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Quality Gates</h4>
            <div className="grid grid-cols-3 gap-3">
              <QualityGateCard
                name="Tests"
                passed={result.qualityGates.tests.passed}
                output={result.qualityGates.tests.output}
              />
              <QualityGateCard
                name="TypeScript"
                passed={result.qualityGates.typeCheck.passed}
                output={result.qualityGates.typeCheck.output}
              />
              <QualityGateCard
                name="Build"
                passed={result.qualityGates.build.passed}
                output={result.qualityGates.build.output}
              />
            </div>
          </div>
        )}

        {/* Codebase Stats */}
        {result?.codebaseAnalysis && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{result.codebaseAnalysis.filesCreated} files</span>
            <span className="text-gray-600">•</span>
            <span>{result.codebaseAnalysis.linesOfCode.toLocaleString()} lines of code</span>
          </div>
        )}

        {/* AI Analysis */}
        {result?.aiAnalysis && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Sparkles className="h-4 w-4 text-purple-400" />
              AI Analysis
            </div>
            <ScrollArea className="h-48 rounded-lg border border-gray-800 bg-gray-900/50 p-3">
              <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">
                {result.aiAnalysis}
              </pre>
            </ScrollArea>
          </div>
        )}

        {/* Options */}
        <div className="space-y-4 pt-2 border-t border-gray-800">
          <h4 className="text-sm font-medium text-muted-foreground">Options</h4>

          <div className="grid grid-cols-2 gap-4">
            {/* Mode Selection */}
            <div className="space-y-2">
              <Label htmlFor="mode" className="text-xs">Execution Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
                <SelectTrigger id="mode" className="bg-gray-900 border-gray-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (Local first)</SelectItem>
                  <SelectItem value="local">Local Only (LM Studio)</SelectItem>
                  <SelectItem value="cloud">Cloud (Claude Code)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Toggles */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="quality-gates" className="text-xs">Run Quality Gates</Label>
                <Switch
                  id="quality-gates"
                  checked={runQualityGates}
                  onCheckedChange={setRunQualityGates}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="ai-analysis" className="text-xs">Generate AI Analysis</Label>
                <Switch
                  id="ai-analysis"
                  checked={generateAnalysis}
                  onCheckedChange={setGenerateAnalysis}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
            <XCircle className="h-4 w-4 inline mr-2" />
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleRunTouchdown}
            disabled={isRunning || !workingDirectory}
            className="flex-1 bg-sky-600 hover:bg-sky-500 text-white"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running Touchdown...
              </>
            ) : result ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Run Again
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run Touchdown
              </>
            )}
          </Button>

          {result && (
            <Button
              variant="outline"
              onClick={() => {
                // Open TOUCHDOWN.md
                const blob = new Blob([result.touchdownMarkdown], { type: "text/markdown" })
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = `TOUCHDOWN-${projectName.toLowerCase().replace(/\s+/g, "-")}.md`
                a.click()
                URL.revokeObjectURL(url)
              }}
            >
              <FileText className="h-4 w-4 mr-2" />
              Download
            </Button>
          )}
        </div>

        {/* Process Refinements Button - appears after touchdown completes with issues */}
        {result && hasIssues && (
          <div className="pt-4 border-t border-gray-800 space-y-3">
            <Button
              onClick={handleProcessRefinements}
              disabled={isProcessingRefinements}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white"
            >
              {isProcessingRefinements ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing Refinements...
                </>
              ) : processedPacketsCount !== null ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Process Again
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Process Refinements into Packets
                </>
              )}
            </Button>

            {/* Feedback after processing */}
            {processedMessage && (
              <div className={cn(
                "p-3 rounded-lg text-sm",
                processedPacketsCount && processedPacketsCount > 0
                  ? "bg-green-500/10 border border-green-500/30 text-green-400"
                  : "bg-blue-500/10 border border-blue-500/30 text-blue-400"
              )}>
                {processedPacketsCount && processedPacketsCount > 0 ? (
                  <CheckCircle className="h-4 w-4 inline mr-2" />
                ) : (
                  <Target className="h-4 w-4 inline mr-2" />
                )}
                {processedMessage}
              </div>
            )}

            {!processedMessage && (
              <p className="text-xs text-muted-foreground text-center">
                Create work packets from quality gate failures and AI-detected issues
              </p>
            )}
          </div>
        )}

        {!workingDirectory && (
          <p className="text-xs text-muted-foreground text-center">
            Configure a working directory to enable Touchdown
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function QualityGateCard({
  name,
  passed,
  output,
}: {
  name: string
  passed: boolean
  output?: string
}) {
  const [expanded, setExpanded] = React.useState(false)

  return (
    <div
      className={cn(
        "p-3 rounded-lg border cursor-pointer transition-colors",
        passed
          ? "bg-green-500/10 border-green-500/30"
          : "bg-red-500/10 border-red-500/30"
      )}
      onClick={() => output && setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{name}</span>
        {passed ? (
          <CheckCircle className="h-4 w-4 text-green-400" />
        ) : (
          <XCircle className="h-4 w-4 text-red-400" />
        )}
      </div>
      {expanded && output && (
        <pre className="mt-2 text-[10px] text-gray-400 whitespace-pre-wrap max-h-32 overflow-y-auto">
          {output.slice(0, 1000)}
        </pre>
      )}
    </div>
  )
}
