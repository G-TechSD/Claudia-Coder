"use client"

import { useState, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Lightbulb,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Check,
  Loader2,
  Rocket,
  ArrowLeft,
  AlertCircle
} from "lucide-react"
import { cn } from "@/lib/utils"

interface IdeasExplorerProps {
  projectId: string
  projectName: string
  projectDescription: string
  initialContext?: string
  workingDirectory?: string
  onCreateProject?: (idea: FinalRecommendation) => void
  onSaveDocument?: (title: string, content: string) => Promise<void>
  className?: string
}

interface IdeaChip {
  id: string
  label: string
  description: string
  category?: string
  relevance?: "high" | "medium"
}

interface ExplorationStage {
  id: string
  title: string
  instruction: string
  ideas: IdeaChip[]
  selectedIds: string[]
}

interface FinalRecommendation {
  id: string
  title: string
  description: string
  whyThisWorks?: string
  complexity?: string
  timeEstimate?: string
  keyFeatures: string[]
  nextSteps: string[]
  selectionPath: string[]
}

interface UnderstandingReport {
  summary: string
  keyThemes: string[]
  coreOpportunity?: string
}

export function IdeasExplorer({
  projectId,
  projectName,
  projectDescription,
  initialContext,
  onCreateProject,
  className
}: IdeasExplorerProps) {
  // State
  const [understanding, setUnderstanding] = useState<UnderstandingReport | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [currentStage, setCurrentStage] = useState<ExplorationStage | null>(null)
  const [stageHistory, setStageHistory] = useState<Array<{ stage: ExplorationStage; selections: string[] }>>([])
  const [selectionPath, setSelectionPath] = useState<string[]>([])
  const [confidence, setConfidence] = useState(0)
  const [recommendations, setRecommendations] = useState<FinalRecommendation[] | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedInCurrentStage, setSelectedInCurrentStage] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  // The original context to send with each API call
  const originalInput = initialContext || projectDescription

  // Generate initial understanding on mount
  useEffect(() => {
    if (!understanding && originalInput) {
      analyzeAndGenerateInitialIdeas()
    }
  }, [originalInput])

  // Call LLM to analyze input and generate initial ideas
  const analyzeAndGenerateInitialIdeas = useCallback(async () => {
    setIsAnalyzing(true)
    setError(null)

    try {
      const response = await fetch("/api/ideation/understand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          input: originalInput,
          context: { projectName }
        })
      })

      if (!response.ok) {
        throw new Error("Failed to analyze input")
      }

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      setUnderstanding({
        summary: data.understanding?.summary || "Analyzing your input...",
        keyThemes: data.understanding?.keyThemes || [],
        coreOpportunity: data.understanding?.coreOpportunity
      })

      // Map API response to ideas
      const initialIdeas: IdeaChip[] = (data.initialIdeas || []).map((idea: {
        id: string
        title: string
        description: string
        category?: string
        relevance?: string
      }) => ({
        id: idea.id,
        label: idea.title,
        description: idea.description,
        category: idea.category,
        relevance: idea.relevance as "high" | "medium" | undefined
      }))

      if (initialIdeas.length === 0) {
        throw new Error("No ideas generated. Please try again with more detail.")
      }

      setCurrentStage({
        id: "stage-1",
        title: "What interests you most?",
        instruction: "Select the concepts that resonate with your goals",
        ideas: initialIdeas,
        selectedIds: []
      })
      setConfidence(15)

    } catch (err) {
      console.error("Failed to analyze:", err)
      setError(err instanceof Error ? err.message : "Failed to analyze input. Please try again.")
    } finally {
      setIsAnalyzing(false)
    }
  }, [projectId, projectName, originalInput])

  // Toggle idea selection
  const toggleIdea = useCallback((ideaId: string) => {
    setSelectedInCurrentStage(prev => {
      const next = new Set(prev)
      if (next.has(ideaId)) {
        next.delete(ideaId)
      } else {
        next.add(ideaId)
      }
      return next
    })
  }, [])

  // Proceed to next stage - ALWAYS calls LLM with context
  const proceedWithSelections = useCallback(async () => {
    if (!currentStage || selectedInCurrentStage.size === 0) return

    const selections = Array.from(selectedInCurrentStage)
    const selectedLabels = currentStage.ideas
      .filter(i => selections.includes(i.id))
      .map(i => i.label)

    // Save current stage to history
    setStageHistory(prev => [...prev, {
      stage: currentStage,
      selections: selectedLabels
    }])

    // Update selection path (cumulative)
    const newPath = [...selectionPath, ...selectedLabels]
    setSelectionPath(newPath)

    // Calculate confidence based on depth
    const newConfidence = Math.min(confidence + 20 + (selections.length < 3 ? 10 : 0), 95)
    setConfidence(newConfidence)

    // If confidence is high enough, generate final recommendations
    if (newConfidence >= 75) {
      await generateRecommendations(newPath)
      return
    }

    // Otherwise, call LLM to get more focused ideas based on selections
    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch("/api/ideation/narrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          selectedIdeas: selectedLabels,
          previousSelections: selectionPath,
          originalContext: originalInput,
          stageNumber: stageHistory.length + 2
        })
      })

      if (!response.ok) {
        throw new Error("Failed to narrow ideas")
      }

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      const ideas: IdeaChip[] = (data.ideas || []).map((idea: {
        id: string
        label: string
        description: string
        category?: string
      }) => ({
        id: idea.id,
        label: idea.label,
        description: idea.description,
        category: idea.category
      }))

      if (ideas.length === 0) {
        // If no ideas, go straight to recommendations
        await generateRecommendations(newPath)
        return
      }

      setCurrentStage({
        id: `stage-${stageHistory.length + 2}`,
        title: data.title || "Narrowing down...",
        instruction: data.instruction || "Select what resonates most",
        ideas,
        selectedIds: []
      })

    } catch (err) {
      console.error("Failed to narrow ideas:", err)
      setError(err instanceof Error ? err.message : "Failed to process. Please try again.")
    } finally {
      setSelectedInCurrentStage(new Set())
      setIsGenerating(false)
    }
  }, [currentStage, selectedInCurrentStage, confidence, selectionPath, stageHistory, projectId, originalInput])

  // Generate final recommendations from LLM
  const generateRecommendations = useCallback(async (fullPath: string[]) => {
    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch("/api/ideation/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          explorationHistory: fullPath,
          originalContext: originalInput,
          confidence
        })
      })

      if (!response.ok) {
        throw new Error("Failed to generate recommendations")
      }

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      // Map API response to recommendations
      const recs: FinalRecommendation[] = (data.recommendations || []).map((rec: {
        id: string
        title: string
        description: string
        whyThisWorks?: string
        complexity?: string
        timeEstimate?: string
        keyFeatures?: string[]
        techStack?: string[]
        category?: string
      }) => ({
        id: rec.id,
        title: rec.title,
        description: rec.description,
        whyThisWorks: rec.whyThisWorks,
        complexity: rec.complexity,
        timeEstimate: rec.timeEstimate,
        keyFeatures: rec.keyFeatures || rec.techStack || [],
        nextSteps: data.nextSteps || ["Define requirements", "Create prototype", "Get feedback"],
        selectionPath: fullPath
      }))

      if (recs.length === 0) {
        throw new Error("No recommendations generated")
      }

      setRecommendations(recs)
      setConfidence(90)

    } catch (err) {
      console.error("Failed to generate recommendations:", err)
      setError(err instanceof Error ? err.message : "Failed to generate recommendations")
    } finally {
      setIsGenerating(false)
      setCurrentStage(null)
    }
  }, [projectId, originalInput, confidence])

  // Go back one stage
  const goBack = useCallback(() => {
    if (stageHistory.length === 0) return

    const newHistory = [...stageHistory]
    const lastEntry = newHistory.pop()

    if (lastEntry) {
      setCurrentStage(lastEntry.stage)
      setStageHistory(newHistory)
      setSelectionPath(prev => prev.slice(0, -lastEntry.selections.length))
      setConfidence(Math.max(15, confidence - 20))
      setRecommendations(null)
      setSelectedInCurrentStage(new Set())
    }
  }, [stageHistory, confidence])

  // Start over
  const startOver = useCallback(() => {
    setUnderstanding(null)
    setCurrentStage(null)
    setStageHistory([])
    setSelectionPath([])
    setConfidence(0)
    setRecommendations(null)
    setSelectedInCurrentStage(new Set())
    setError(null)
    analyzeAndGenerateInitialIdeas()
  }, [analyzeAndGenerateInitialIdeas])

  // Create project from recommendation
  const handleCreateProject = useCallback((rec: FinalRecommendation) => {
    if (onCreateProject) {
      onCreateProject(rec)
    }
  }, [onCreateProject])

  // Loading state
  if (isAnalyzing) {
    return (
      <Card className={cn("", className)}>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Analyzing your input...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (error && !currentStage && !recommendations) {
    return (
      <Card className={cn("", className)}>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={startOver}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Understanding Summary */}
      {understanding && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Understanding Your Input
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">{understanding.summary}</p>
            {understanding.keyThemes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {understanding.keyThemes.map((theme, i) => (
                  <Badge key={i} variant="secondary">{theme}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Progress Indicator */}
      {(currentStage || recommendations) && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Understanding your intent</span>
                  <span className="font-medium">{confidence}%</span>
                </div>
                <Progress value={confidence} className="h-2" />
              </div>
            </div>
            {selectionPath.length > 0 && (
              <div className="mt-3 text-xs text-muted-foreground">
                <span className="font-medium">Path: </span>
                {selectionPath.slice(-5).join(" → ")}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Current Stage - Idea Selection */}
      {currentStage && !recommendations && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-yellow-500" />
                  {currentStage.title}
                </CardTitle>
                <CardDescription className="mt-1">
                  {currentStage.instruction}
                </CardDescription>
              </div>
              {stageHistory.length > 0 && (
                <Button variant="ghost" size="sm" onClick={goBack}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Ideas as clickable chips - word cloud style */}
            <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 py-4 px-2">
              {currentStage.ideas.map((idea, index) => {
                const isSelected = selectedInCurrentStage.has(idea.id)
                const isHighRelevance = idea.relevance === "high"

                // Create size variations for visual hierarchy
                const sizeClass = isHighRelevance
                  ? index % 3 === 0 ? "text-lg px-5 py-2.5" : "text-base px-4 py-2"
                  : index % 4 === 0 ? "text-base px-4 py-2" : "text-sm px-3 py-1.5"

                // Subtle color variations for unselected chips
                const colorClass = isSelected
                  ? "bg-primary text-primary-foreground shadow-lg scale-105 ring-2 ring-primary/30"
                  : isHighRelevance
                    ? "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                    : "bg-muted/50 text-foreground/80 hover:bg-muted hover:text-foreground"

                return (
                  <button
                    key={idea.id}
                    onClick={() => toggleIdea(idea.id)}
                    className={cn(
                      "rounded-full font-medium transition-all duration-200 ease-out",
                      "hover:scale-105 active:scale-95",
                      sizeClass,
                      colorClass
                    )}
                    title={idea.description}
                  >
                    {isSelected && <Check className="h-3 w-3 inline mr-1" />}
                    {idea.label}
                  </button>
                )
              })}
            </div>

            {/* Error display */}
            {error && (
              <div className="text-sm text-destructive mt-2 text-center">{error}</div>
            )}

            {/* Continue button */}
            {selectedInCurrentStage.size > 0 && (
              <div className="flex items-center justify-between pt-4 border-t mt-4">
                <span className="text-sm text-muted-foreground">
                  {selectedInCurrentStage.size} selected
                </span>
                <Button onClick={proceedWithSelections} disabled={isGenerating}>
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Thinking...
                    </>
                  ) : (
                    <>
                      Continue
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Final Recommendations */}
      {recommendations && (
        <div className="space-y-4">
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5 text-primary" />
                Recommendations
              </CardTitle>
              <CardDescription>
                Based on your exploration, here are concrete project ideas
              </CardDescription>
            </CardHeader>
          </Card>

          {recommendations.map((rec) => (
            <Card key={rec.id} className="hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-lg">{rec.title}</CardTitle>
                {rec.complexity && (
                  <Badge variant="outline" className="w-fit">{rec.complexity}</Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{rec.description}</p>

                {rec.whyThisWorks && (
                  <p className="text-sm italic text-primary/80">{rec.whyThisWorks}</p>
                )}

                {rec.keyFeatures.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Key Features</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {rec.keyFeatures.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {rec.nextSteps.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Next Steps</h4>
                    <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                      {rec.nextSteps.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={() => handleCreateProject(rec)}
                >
                  Create This Project
                </Button>
              </CardContent>
            </Card>
          ))}

          <Button variant="outline" className="w-full" onClick={startOver}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Start Over with New Exploration
          </Button>
        </div>
      )}
    </div>
  )
}
