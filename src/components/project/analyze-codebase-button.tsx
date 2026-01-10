"use client"

import * as React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  Search,
  Sparkles,
  Code2,
  ArrowRight,
  GitBranch,
  Brain,
  Package,
  FileCode,
  Loader2
} from "lucide-react"
import { CodebaseAnalyzer } from "./codebase-analyzer"
import { savePackets, type WorkPacket } from "@/lib/ai/build-plan"
import { createBuildPlan } from "@/lib/data/build-plans"

interface AnalyzeCodebaseButtonProps {
  projectId: string
  projectName: string
  projectDescription: string
  hasLinkedRepo: boolean
  repoPath?: string
  hasBuildPlan: boolean
  onAnalysisComplete?: () => void
  className?: string
}

interface GeneratedBuildPlan {
  packets: Array<{
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
  }>
  documentation: {
    summary: string
    purpose: string
    architecture: string
    techStack: string[]
    keyFeatures: string[]
    entryPoints: string[]
    mainModules: { name: string; purpose: string; files: string[] }[]
    dependencies: string[]
    developmentNotes: string[]
  } | null
  userNotes: string
  direction: string
}

/**
 * AnalyzeCodebaseButton
 *
 * A prominent button that appears when a project has linked repos but no build plan.
 * Opens the CodebaseAnalyzer flow to scan and understand an existing codebase.
 */
export function AnalyzeCodebaseButton({
  projectId,
  projectName,
  projectDescription,
  hasLinkedRepo,
  repoPath,
  hasBuildPlan,
  onAnalysisComplete,
  className
}: AnalyzeCodebaseButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)

  // Don't show if no linked repo or already has a build plan
  if (!hasLinkedRepo || hasBuildPlan) {
    return null
  }

  const handleAnalysisComplete = async (buildPlan: GeneratedBuildPlan) => {
    setIsCompleting(true)

    // Map packet types from analyzer to WorkPacket types
    const mapPacketType = (type: string): "feature" | "bugfix" | "refactor" | "test" | "docs" | "config" | "research" => {
      switch (type) {
        case "fix": return "bugfix"
        case "chore": return "config"
        case "feature": return "feature"
        case "refactor": return "refactor"
        case "test": return "test"
        case "docs": return "docs"
        default: return "feature"
      }
    }

    try {
      // Convert recommended packets to work packets
      const workPackets: WorkPacket[] = buildPlan.packets.map((packet, index) => ({
        id: packet.id,
        phaseId: "phase-analysis",
        title: packet.title,
        description: packet.description,
        type: mapPacketType(packet.type),
        priority: packet.priority,
        status: "queued" as const,
        tasks: packet.tasks.map((task, taskIndex) => ({
          id: `${packet.id}-task-${taskIndex}`,
          description: task,
          completed: false,
          order: taskIndex
        })),
        suggestedTaskType: packet.type === "docs" ? "documentation" : "coding",
        blockedBy: [],
        blocks: [],
        estimatedTokens: packet.estimatedEffort === "large" ? 3000 : packet.estimatedEffort === "medium" ? 1500 : 500,
        acceptanceCriteria: [],
        order: index
      }))

      // Save packets
      savePackets(projectId, workPackets)

      // Create a build plan from the analysis
      if (buildPlan.documentation) {
        createBuildPlan({
          projectId,
          originalPlan: {
            spec: {
              name: projectName,
              description: buildPlan.documentation.summary || projectDescription,
              objectives: buildPlan.documentation.keyFeatures || [],
              nonGoals: [],
              assumptions: [],
              risks: [],
              techStack: buildPlan.documentation.techStack || []
            },
            phases: [{
              id: "phase-analysis",
              name: "Codebase Analysis Results",
              description: "Work packets generated from codebase analysis",
              order: 0
            }],
            packets: buildPlan.packets.map((p, i) => ({
              id: p.id,
              phaseId: "phase-analysis",
              title: p.title,
              description: p.description,
              type: p.type,
              priority: p.priority,
              tasks: p.tasks.map((task, taskIndex) => ({
                id: `${p.id}-task-${taskIndex}`,
                description: task,
                completed: false,
                order: taskIndex
              })),
              acceptanceCriteria: [],
              order: i
            }))
          },
          generatedBy: {
            server: "Codebase Analyzer",
            model: "AI Analysis"
          }
        })
      }

      setIsOpen(false)

      if (onAnalysisComplete) {
        onAnalysisComplete()
      }
    } catch (error) {
      console.error("Error completing analysis:", error)
    } finally {
      setIsCompleting(false)
    }
  }

  return (
    <>
      {/* Prominent Card with CTA */}
      <Card className={cn(
        "relative overflow-hidden",
        "border-2 border-cyan-500/50",
        "bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-transparent",
        className
      )}>
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

        <CardHeader className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-cyan-500/20 border border-cyan-500/30">
              <Search className="h-5 w-5 text-cyan-400" />
            </div>
            <Badge variant="outline" className="text-cyan-400 border-cyan-500/30 bg-cyan-500/10">
              <GitBranch className="h-3 w-3 mr-1" />
              Existing Codebase Detected
            </Badge>
          </div>
          <CardTitle className="text-xl">Analyze Existing Codebase</CardTitle>
          <CardDescription className="text-base">
            Scan your linked repository to understand its structure, extract TODOs,
            review commit history, and generate AI-powered work recommendations.
          </CardDescription>
        </CardHeader>

        <CardContent className="relative">
          {/* Features list */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileCode className="h-4 w-4 text-cyan-400" />
              <span>File Structure</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Code2 className="h-4 w-4 text-yellow-400" />
              <span>TODO Extraction</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <GitBranch className="h-4 w-4 text-purple-400" />
              <span>Commit History</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Brain className="h-4 w-4 text-blue-400" />
              <span>AI Analysis</span>
            </div>
          </div>

          {/* CTA Button */}
          <div className="flex items-center gap-4">
            <Button
              size="lg"
              onClick={() => setIsOpen(true)}
              className={cn(
                "h-12 px-6 text-lg font-semibold",
                "bg-gradient-to-r from-cyan-600 to-blue-600",
                "hover:from-cyan-500 hover:to-blue-500",
                "shadow-lg shadow-cyan-500/25",
                "border border-cyan-400/30",
                "transition-all duration-300",
                "hover:scale-105 hover:shadow-xl hover:shadow-cyan-500/30"
              )}
            >
              <Sparkles className="h-5 w-5 mr-2" />
              Analyze Codebase
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>

            {repoPath && (
              <div className="text-sm text-muted-foreground">
                <span className="text-xs opacity-70">Repository:</span>
                <code className="ml-2 text-xs bg-muted px-2 py-1 rounded font-mono">
                  {repoPath.split("/").slice(-2).join("/")}
                </code>
              </div>
            )}
          </div>

          {/* Info text */}
          <p className="mt-4 text-xs text-muted-foreground">
            Works with any language: TypeScript, Rust, Python, Go, and more.
            AI will understand your code and suggest intelligent work packets.
          </p>
        </CardContent>
      </Card>

      {/* Analyzer Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-cyan-500" />
              Codebase Analysis
            </DialogTitle>
          </DialogHeader>

          {isCompleting ? (
            <div className="py-12 text-center">
              <Loader2 className="h-12 w-12 mx-auto animate-spin text-cyan-500 mb-4" />
              <p className="text-lg font-medium">Creating build plan from analysis...</p>
              <p className="text-muted-foreground">
                Converting recommendations to work packets
              </p>
            </div>
          ) : repoPath ? (
            <CodebaseAnalyzer
              projectId={projectId}
              projectName={projectName}
              repoPath={repoPath}
              onComplete={handleAnalysisComplete}
              onCancel={() => setIsOpen(false)}
            />
          ) : (
            <div className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No Repository Path</p>
              <p className="text-muted-foreground">
                Please set a local path for your linked repository first.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * Compact version for sidebar or smaller spaces
 */
export function AnalyzeCodebaseCompact({
  projectId,
  projectName,
  hasLinkedRepo,
  repoPath,
  hasBuildPlan,
  onAnalysisComplete
}: Omit<AnalyzeCodebaseButtonProps, 'className' | 'projectDescription'>) {
  const [isOpen, setIsOpen] = useState(false)

  if (!hasLinkedRepo || hasBuildPlan) {
    return null
  }

  return (
    <>
      <div className="p-4 rounded-lg border-2 border-cyan-500/50 bg-cyan-500/5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Search className="h-5 w-5 text-cyan-400" />
            <div>
              <p className="font-medium text-sm">Analyze Codebase</p>
              <p className="text-xs text-muted-foreground">
                Scan and understand existing code
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setIsOpen(true)}
            className="bg-cyan-600 hover:bg-cyan-500"
          >
            <Sparkles className="h-4 w-4 mr-1" />
            Analyze
          </Button>
        </div>
      </div>

      {/* Analyzer Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-cyan-500" />
              Codebase Analysis
            </DialogTitle>
          </DialogHeader>

          {repoPath ? (
            <CodebaseAnalyzer
              projectId={projectId}
              projectName={projectName}
              repoPath={repoPath}
              onComplete={() => {
                setIsOpen(false)
                onAnalysisComplete?.()
              }}
              onCancel={() => setIsOpen(false)}
            />
          ) : (
            <div className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No Repository Path</p>
              <p className="text-muted-foreground">
                Please set a local path for your linked repository first.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
