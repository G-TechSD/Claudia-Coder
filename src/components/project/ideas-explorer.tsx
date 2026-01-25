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
  AlertCircle,
  Plus,
  X,
  Pencil,
  Save,
  Trash2
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
  ideas: IdeaChip[]  // Currently displayed ideas (based on mode)
  basicIdeas: IdeaChip[]  // Basic/simple ideas for non-developers
  advancedIdeas: IdeaChip[]  // Advanced/technical ideas for developers
  selectedIds: string[]
}

interface FinalRecommendation {
  id: string
  title: string
  description: string
  whyThisWorks?: string
  howSelectionsIncorporated?: Record<string, string>  // Maps each selection to how it's used
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
  // Track selections separately for each mode so they persist when switching
  const [selectedBasic, setSelectedBasic] = useState<Set<string>>(new Set())
  const [selectedAdvanced, setSelectedAdvanced] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [customInput, setCustomInput] = useState("")
  const [llmStatus, setLlmStatus] = useState<string | null>(null) // Shows if LLM was used or fallback
  const [ideaMode, setIdeaMode] = useState<"basic" | "advanced" | "all">("basic") // Basic for non-developers, Advanced for developers, All shows everything

  // State for editing recommendations
  const [editingRecId, setEditingRecId] = useState<string | null>(null)
  const [editedRecs, setEditedRecs] = useState<Record<string, FinalRecommendation>>({})
  const [newFeatureInput, setNewFeatureInput] = useState<Record<string, string>>({}) // For adding new features

  // Track ALL previously shown options to prevent duplicates (fractal behavior)
  const [shownOptions, setShownOptions] = useState<Set<string>>(new Set())

  // The original context to send with each API call
  const originalInput = initialContext || projectDescription

  // Instantly switch displayed ideas when mode changes (selections persist in each mode)
  useEffect(() => {
    if (currentStage &&
        currentStage.basicIdeas &&
        currentStage.advancedIdeas &&
        currentStage.basicIdeas.length > 0 &&
        currentStage.advancedIdeas.length > 0) {
      let newIdeas: IdeaChip[]
      if (ideaMode === "all") {
        // Combine both sets, avoiding duplicates by label
        const seen = new Set<string>()
        newIdeas = []
        for (const idea of [...currentStage.basicIdeas, ...currentStage.advancedIdeas]) {
          if (!seen.has(idea.label.toLowerCase())) {
            seen.add(idea.label.toLowerCase())
            newIdeas.push(idea)
          }
        }
      } else if (ideaMode === "advanced") {
        newIdeas = currentStage.advancedIdeas
      } else {
        newIdeas = currentStage.basicIdeas
      }

      // Only update if the ideas are actually different (compare length and first ID)
      const currentLen = currentStage.ideas.length
      const newLen = newIdeas.length
      const currentFirstId = currentStage.ideas[0]?.id
      const newFirstId = newIdeas[0]?.id
      if (currentLen !== newLen || currentFirstId !== newFirstId) {
        setCurrentStage(prev => prev ? {
          ...prev,
          ideas: newIdeas
        } : null)
        // Don't clear selections - they persist separately for each mode
      }
    }
  }, [ideaMode, currentStage])

  // Get current mode's selections (for "all" mode, combine both sets)
  const currentModeSelections = ideaMode === "all"
    ? new Set([...selectedBasic, ...selectedAdvanced])
    : ideaMode === "advanced" ? selectedAdvanced : selectedBasic

  // For setting selections in "all" mode, we need to determine which set to update based on the idea
  const toggleIdeaInAllMode = (ideaId: string) => {
    if (!currentStage) return
    // Check if this idea is in basic or advanced set
    const isBasicIdea = currentStage.basicIdeas?.some(i => i.id === ideaId)
    const isAdvancedIdea = currentStage.advancedIdeas?.some(i => i.id === ideaId)

    if (isBasicIdea) {
      setSelectedBasic(prev => {
        const next = new Set(prev)
        if (next.has(ideaId)) next.delete(ideaId)
        else next.add(ideaId)
        return next
      })
    }
    if (isAdvancedIdea) {
      setSelectedAdvanced(prev => {
        const next = new Set(prev)
        if (next.has(ideaId)) next.delete(ideaId)
        else next.add(ideaId)
        return next
      })
    }
  }

  // Combined selection count for display
  const totalSelections = selectedBasic.size + selectedAdvanced.size

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
    setLlmStatus(null)

    try {
      const response = await fetch("/api/ideation/understand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          input: originalInput,
          context: { projectName },
          mode: ideaMode  // "technical" or "nontechnical"
        })
      })

      if (!response.ok) {
        throw new Error("Failed to analyze input")
      }

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      // Show LLM source status
      if (data.llmSource === "anthropic") {
        setLlmStatus("✨ Ideas generated by Claude AI")
      } else if (data.llmSource === "local") {
        setLlmStatus("✨ Ideas generated by local LLM")
      } else {
        setLlmStatus("⚠️ Using pattern matching (no API key set)")
      }

      setUnderstanding({
        summary: data.understanding?.summary || "Analyzing your input...",
        keyThemes: data.understanding?.keyThemes || [],
        coreOpportunity: data.understanding?.coreOpportunity
      })

      // Map API response to both sets of ideas
      const mapIdeas = (ideas: Array<{ id: string; title: string; description: string; category?: string }>) =>
        ideas.map(idea => ({
          id: idea.id,
          label: idea.title,
          description: idea.description,
          category: idea.category
        }))

      // API still returns nonTechnicalIdeas/technicalIdeas, map to basic/advanced
      const basicIdeas: IdeaChip[] = mapIdeas(data.nonTechnicalIdeas || data.basicIdeas || data.initialIdeas || [])
      const advancedIdeas: IdeaChip[] = mapIdeas(data.technicalIdeas || data.advancedIdeas || data.initialIdeas || [])

      // Use the appropriate set based on current mode
      let displayedIdeas: IdeaChip[]
      if (ideaMode === "all") {
        // Combine both sets, avoiding duplicates by label
        const seen = new Set<string>()
        displayedIdeas = []
        for (const idea of [...basicIdeas, ...advancedIdeas]) {
          if (!seen.has(idea.label.toLowerCase())) {
            seen.add(idea.label.toLowerCase())
            displayedIdeas.push(idea)
          }
        }
      } else if (ideaMode === "advanced") {
        displayedIdeas = advancedIdeas
      } else {
        displayedIdeas = basicIdeas
      }

      if (displayedIdeas.length === 0) {
        throw new Error("No ideas generated. Please try again with more detail.")
      }

      // Track all initial options as "shown" for fractal deduplication
      const initialShownOptions = new Set<string>()
      basicIdeas.forEach(idea => initialShownOptions.add(idea.label))
      advancedIdeas.forEach(idea => initialShownOptions.add(idea.label))
      setShownOptions(initialShownOptions)

      setCurrentStage({
        id: "stage-1",
        title: "Which features interest you the most?",
        instruction: "Select the concepts that resonate with your goals. Hover over options to see descriptions.",
        ideas: displayedIdeas,
        basicIdeas,
        advancedIdeas,
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

  // Toggle idea selection (in the appropriate mode's selection set)
  const toggleIdea = useCallback((ideaId: string) => {
    if (ideaMode === "all") {
      // In "all" mode, use the special handler that checks which set the idea belongs to
      toggleIdeaInAllMode(ideaId)
    } else {
      const setSelections = ideaMode === "advanced" ? setSelectedAdvanced : setSelectedBasic
      setSelections(prev => {
        const next = new Set(prev)
        if (next.has(ideaId)) {
          next.delete(ideaId)
        } else {
          next.add(ideaId)
        }
        return next
      })
    }
  }, [ideaMode, toggleIdeaInAllMode])

  // Proceed to next stage - ALWAYS calls LLM with context
  const proceedWithSelections = useCallback(async () => {
    if (!currentStage) return

    // Combine selections from BOTH modes
    const basicSelections = Array.from(selectedBasic)
    const advancedSelections = Array.from(selectedAdvanced)

    // Get labels for basic selections
    const basicLabels = (currentStage.basicIdeas || currentStage.ideas)
      .filter(i => basicSelections.includes(i.id))
      .map(i => i.label)

    // Get labels for advanced selections
    const advancedLabels = (currentStage.advancedIdeas || currentStage.ideas)
      .filter(i => advancedSelections.includes(i.id))
      .map(i => i.label)

    // Combine all selections (avoiding duplicates if any)
    const allLabels = [...new Set([...basicLabels, ...advancedLabels])]

    if (allLabels.length === 0) return

    const selectedLabels = allLabels

    // Save current stage to history
    setStageHistory(prev => [...prev, {
      stage: currentStage,
      selections: selectedLabels
    }])

    // Update selection path (cumulative)
    const newPath = [...selectionPath, ...selectedLabels]
    setSelectionPath(newPath)

    // Calculate confidence based on depth
    const newConfidence = Math.min(confidence + 20 + (selectedLabels.length < 3 ? 10 : 0), 95)
    setConfidence(newConfidence)

    // If confidence is high enough, generate final recommendations
    if (newConfidence >= 75) {
      await generateRecommendations(newPath)
      return
    }

    // Otherwise, call LLM to get more focused ideas based on selections
    setIsGenerating(true)
    setError(null)
    setLlmStatus(null)

    // Collect ALL labels from current stage (both basic and advanced) to track as shown
    const allCurrentLabels: string[] = []
    if (currentStage.basicIdeas) {
      allCurrentLabels.push(...currentStage.basicIdeas.map(i => i.label))
    }
    if (currentStage.advancedIdeas) {
      allCurrentLabels.push(...currentStage.advancedIdeas.map(i => i.label))
    }
    if (allCurrentLabels.length === 0 && currentStage.ideas) {
      allCurrentLabels.push(...currentStage.ideas.map(i => i.label))
    }

    // Add to shown options (for fractal deduplication)
    const updatedShownOptions = new Set(shownOptions)
    allCurrentLabels.forEach(label => updatedShownOptions.add(label))
    setShownOptions(updatedShownOptions)

    try {
      const response = await fetch("/api/ideation/narrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          selectedIdeas: selectedLabels,
          previousSelections: selectionPath,
          originalContext: originalInput,
          stageNumber: stageHistory.length + 2,
          mode: ideaMode,  // "basic", "advanced", or "all"
          previouslyShownOptions: Array.from(updatedShownOptions)  // Pass all shown options for fractal deduplication
        })
      })

      if (!response.ok) {
        throw new Error("Failed to narrow ideas")
      }

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      // Show LLM source status
      if (data.llmSource === "anthropic") {
        setLlmStatus("✨ Ideas generated by Claude AI")
      } else if (data.llmSource === "local") {
        setLlmStatus("✨ Ideas generated by local LLM")
      } else {
        setLlmStatus("⚠️ Using pattern matching (no API key set)")
      }

      // Map API response to both sets of ideas for instant mode switching
      const mapIdeas = (ideas: Array<{ id: string; label: string; description: string; category?: string }>) =>
        ideas.map(idea => ({
          id: idea.id,
          label: idea.label,
          description: idea.description,
          category: idea.category
        }))

      // API returns nonTechnicalIdeas/technicalIdeas, map to basic/advanced
      const basicIdeas: IdeaChip[] = mapIdeas(data.nonTechnicalIdeas || data.basicIdeas || data.ideas || [])
      const advancedIdeas: IdeaChip[] = mapIdeas(data.technicalIdeas || data.advancedIdeas || data.ideas || [])

      // Use the appropriate set based on current mode
      let displayedIdeas: IdeaChip[]
      if (ideaMode === "all") {
        const seen = new Set<string>()
        displayedIdeas = []
        for (const idea of [...basicIdeas, ...advancedIdeas]) {
          if (!seen.has(idea.label.toLowerCase())) {
            seen.add(idea.label.toLowerCase())
            displayedIdeas.push(idea)
          }
        }
      } else if (ideaMode === "advanced") {
        displayedIdeas = advancedIdeas
      } else {
        displayedIdeas = basicIdeas
      }

      if (displayedIdeas.length === 0) {
        // If no ideas, go straight to recommendations
        await generateRecommendations(newPath)
        return
      }

      setCurrentStage({
        id: `stage-${stageHistory.length + 2}`,
        title: data.title || "Narrowing down...",
        instruction: data.instruction || "Select what resonates most. Hover over options to see descriptions.",
        ideas: displayedIdeas,
        basicIdeas,
        advancedIdeas,
        selectedIds: []
      })

    } catch (err) {
      console.error("Failed to narrow ideas:", err)
      setError(err instanceof Error ? err.message : "Failed to process. Please try again.")
    } finally {
      // Clear both selection sets when proceeding to next stage
      setSelectedBasic(new Set())
      setSelectedAdvanced(new Set())
      setIsGenerating(false)
    }
  }, [currentStage, selectedBasic, selectedAdvanced, confidence, selectionPath, stageHistory, projectId, originalInput, ideaMode])

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
        howSelectionsIncorporated?: Record<string, string>
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
        howSelectionsIncorporated: rec.howSelectionsIncorporated,
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
      setSelectedBasic(new Set())
      setSelectedAdvanced(new Set())
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
    setSelectedBasic(new Set())
    setSelectedAdvanced(new Set())
    setError(null)
    analyzeAndGenerateInitialIdeas()
  }, [analyzeAndGenerateInitialIdeas])

  // Regenerate options for current stage (different options, same context)
  const regenerateCurrentStage = useCallback(async () => {
    if (!currentStage) return

    setIsGenerating(true)
    setError(null)
    setLlmStatus(null)
    // Clear both selection sets when regenerating
    setSelectedBasic(new Set())
    setSelectedAdvanced(new Set())

    try {
      // Determine if we're at stage 1 or a later stage
      const isInitialStage = stageHistory.length === 0

      if (isInitialStage) {
        // Regenerate initial ideas with regenerate flag
        const response = await fetch("/api/ideation/understand", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            input: originalInput,
            context: { projectName },
            regenerate: true,  // Signal to generate different options
            mode: ideaMode
          })
        })

        if (!response.ok) throw new Error("Failed to regenerate options")

        const data = await response.json()
        if (data.error) throw new Error(data.error)

        // Show LLM source status
        if (data.llmSource === "anthropic") {
          setLlmStatus("✨ Ideas generated by Claude AI")
        } else if (data.llmSource === "local") {
          setLlmStatus("✨ Ideas generated by local LLM")
        } else {
          setLlmStatus("⚠️ Using pattern matching (no API key set)")
        }

        // Map API response to both sets of ideas for instant switching
        const mapIdeas = (ideas: Array<{ id: string; title: string; description: string; category?: string }>) =>
          ideas.map(idea => ({
            id: idea.id,
            label: idea.title,
            description: idea.description,
            category: idea.category
          }))

        const basicIdeas: IdeaChip[] = mapIdeas(data.nonTechnicalIdeas || data.basicIdeas || data.initialIdeas || [])
        const advancedIdeas: IdeaChip[] = mapIdeas(data.technicalIdeas || data.advancedIdeas || data.initialIdeas || [])

        let displayedIdeas: IdeaChip[]
        if (ideaMode === "all") {
          const seen = new Set<string>()
          displayedIdeas = []
          for (const idea of [...basicIdeas, ...advancedIdeas]) {
            if (!seen.has(idea.label.toLowerCase())) {
              seen.add(idea.label.toLowerCase())
              displayedIdeas.push(idea)
            }
          }
        } else if (ideaMode === "advanced") {
          displayedIdeas = advancedIdeas
        } else {
          displayedIdeas = basicIdeas
        }

        if (displayedIdeas.length === 0) throw new Error("No ideas generated")

        // Track regenerated options as shown (add to existing set)
        const updatedShown = new Set(shownOptions)
        basicIdeas.forEach(idea => updatedShown.add(idea.label))
        advancedIdeas.forEach(idea => updatedShown.add(idea.label))
        setShownOptions(updatedShown)

        setCurrentStage({
          ...currentStage,
          ideas: displayedIdeas,
          basicIdeas,
          advancedIdeas
        })
      } else {
        // Regenerate narrowed ideas for current stage
        const lastHistory = stageHistory[stageHistory.length - 1]
        const response = await fetch("/api/ideation/narrow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            selectedIdeas: lastHistory?.selections || [],
            previousSelections: selectionPath,
            originalContext: originalInput,
            stageNumber: stageHistory.length + 1,
            regenerate: true,  // Signal to generate different options
            mode: ideaMode,
            previouslyShownOptions: Array.from(shownOptions)  // Pass all shown options for fractal deduplication
          })
        })

        if (!response.ok) throw new Error("Failed to regenerate options")

        const data = await response.json()
        if (data.error) throw new Error(data.error)

        // Show LLM source status
        if (data.llmSource === "anthropic") {
          setLlmStatus("✨ Ideas generated by Claude AI")
        } else if (data.llmSource === "local") {
          setLlmStatus("✨ Ideas generated by local LLM")
        } else {
          setLlmStatus("⚠️ Using pattern matching (no API key set)")
        }

        // Map API response to both sets of ideas for instant switching
        const mapIdeas = (ideas: Array<{ id: string; label: string; description: string; category?: string }>) =>
          ideas.map(idea => ({
            id: idea.id,
            label: idea.label,
            description: idea.description,
            category: idea.category
          }))

        const basicIdeas: IdeaChip[] = mapIdeas(data.nonTechnicalIdeas || data.basicIdeas || data.ideas || [])
        const advancedIdeas: IdeaChip[] = mapIdeas(data.technicalIdeas || data.advancedIdeas || data.ideas || [])

        let displayedIdeas: IdeaChip[]
        if (ideaMode === "all") {
          const seen = new Set<string>()
          displayedIdeas = []
          for (const idea of [...basicIdeas, ...advancedIdeas]) {
            if (!seen.has(idea.label.toLowerCase())) {
              seen.add(idea.label.toLowerCase())
              displayedIdeas.push(idea)
            }
          }
        } else if (ideaMode === "advanced") {
          displayedIdeas = advancedIdeas
        } else {
          displayedIdeas = basicIdeas
        }

        if (displayedIdeas.length === 0) throw new Error("No ideas generated")

        // Track regenerated options as shown (add to existing set)
        const updatedShown = new Set(shownOptions)
        basicIdeas.forEach(idea => updatedShown.add(idea.label))
        advancedIdeas.forEach(idea => updatedShown.add(idea.label))
        setShownOptions(updatedShown)

        setCurrentStage({
          ...currentStage,
          title: data.title || currentStage.title,
          instruction: data.instruction || currentStage.instruction,
          ideas: displayedIdeas,
          basicIdeas,
          advancedIdeas
        })
      }
    } catch (err) {
      console.error("Failed to regenerate:", err)
      setError(err instanceof Error ? err.message : "Failed to regenerate. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }, [currentStage, stageHistory, selectionPath, projectId, projectName, originalInput, shownOptions, ideaMode])

  // Create project from recommendation
  const handleCreateProject = useCallback((rec: FinalRecommendation) => {
    if (onCreateProject) {
      // Use edited version if available
      const finalRec = editedRecs[rec.id] || rec
      onCreateProject(finalRec)
    }
  }, [onCreateProject, editedRecs])

  // Get the current version of a recommendation (edited or original)
  const getRecommendation = useCallback((rec: FinalRecommendation): FinalRecommendation => {
    return editedRecs[rec.id] || rec
  }, [editedRecs])

  // Start editing a recommendation
  const startEditing = useCallback((rec: FinalRecommendation) => {
    if (!editedRecs[rec.id]) {
      setEditedRecs(prev => ({ ...prev, [rec.id]: { ...rec } }))
    }
    setEditingRecId(rec.id)
  }, [editedRecs])

  // Update a field in the edited recommendation
  const updateRecField = useCallback((recId: string, field: keyof FinalRecommendation, value: unknown) => {
    setEditedRecs(prev => ({
      ...prev,
      [recId]: {
        ...(prev[recId] || recommendations?.find(r => r.id === recId)!),
        [field]: value
      }
    }))
  }, [recommendations])

  // Remove a selection from howSelectionsIncorporated
  const removeSelection = useCallback((recId: string, selectionKey: string) => {
    setEditedRecs(prev => {
      const current = prev[recId] || recommendations?.find(r => r.id === recId)!
      const newSelections = { ...current.howSelectionsIncorporated }
      delete newSelections[selectionKey]
      return {
        ...prev,
        [recId]: {
          ...current,
          howSelectionsIncorporated: newSelections
        }
      }
    })
  }, [recommendations])

  // Add a key feature
  const addKeyFeature = useCallback((recId: string) => {
    const feature = newFeatureInput[recId]?.trim()
    if (!feature) return

    setEditedRecs(prev => {
      const current = prev[recId] || recommendations?.find(r => r.id === recId)!
      return {
        ...prev,
        [recId]: {
          ...current,
          keyFeatures: [...current.keyFeatures, feature]
        }
      }
    })
    setNewFeatureInput(prev => ({ ...prev, [recId]: "" }))
  }, [newFeatureInput, recommendations])

  // Remove a key feature
  const removeKeyFeature = useCallback((recId: string, index: number) => {
    setEditedRecs(prev => {
      const current = prev[recId] || recommendations?.find(r => r.id === recId)!
      const newFeatures = current.keyFeatures.filter((_, i) => i !== index)
      return {
        ...prev,
        [recId]: {
          ...current,
          keyFeatures: newFeatures
        }
      }
    })
  }, [recommendations])

  // Update a key feature
  const updateKeyFeature = useCallback((recId: string, index: number, value: string) => {
    setEditedRecs(prev => {
      const current = prev[recId] || recommendations?.find(r => r.id === recId)!
      const newFeatures = [...current.keyFeatures]
      newFeatures[index] = value
      return {
        ...prev,
        [recId]: {
          ...current,
          keyFeatures: newFeatures
        }
      }
    })
  }, [recommendations])

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
            {/* Mode toggle: Basic / Advanced / All */}
            <div className="flex items-center justify-center gap-1 mt-3 p-1 bg-muted/50 rounded-full w-fit mx-auto">
              <button
                onClick={() => setIdeaMode("basic")}
                className={cn(
                  "px-4 py-1.5 text-sm rounded-full transition-all",
                  ideaMode === "basic"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Basic
              </button>
              <button
                onClick={() => setIdeaMode("advanced")}
                className={cn(
                  "px-4 py-1.5 text-sm rounded-full transition-all",
                  ideaMode === "advanced"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Advanced
              </button>
              <button
                onClick={() => setIdeaMode("all")}
                className={cn(
                  "px-4 py-1.5 text-sm rounded-full transition-all",
                  ideaMode === "all"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                All
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Ideas as clickable chips - all consistent blue ovals */}
            <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 py-4 px-2">
              {currentStage.ideas.map((idea, index) => {
                const isSelected = currentModeSelections.has(idea.id)

                // Slight size variations for visual interest, but all consistent style
                const sizeClass = index % 3 === 0 ? "text-base px-5 py-2.5" : "text-sm px-4 py-2"

                // All chips have consistent blue styling
                const colorClass = isSelected
                  ? "bg-primary text-primary-foreground shadow-lg scale-105 ring-2 ring-primary/30"
                  : "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30"

                // Truncate long labels to ensure proper pill shape
                const displayLabel = idea.label.length > 30
                  ? idea.label.slice(0, 28) + "..."
                  : idea.label

                return (
                  <button
                    key={idea.id}
                    onClick={() => toggleIdea(idea.id)}
                    className={cn(
                      "rounded-full font-medium transition-all duration-200 ease-out whitespace-nowrap",
                      "hover:scale-105 active:scale-95",
                      sizeClass,
                      colorClass
                    )}
                    title={idea.description || idea.label}
                  >
                    {isSelected && <Check className="h-3 w-3 inline mr-1" />}
                    {displayLabel}
                  </button>
                )
              })}
            </div>

            {/* Custom option input */}
            <div className="flex items-center justify-center gap-2 mt-4">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customInput.trim()) {
                    const newIdea: IdeaChip = {
                      id: `custom-${Date.now()}`,
                      label: customInput.trim(),
                      description: `Custom option: ${customInput.trim()}`,
                      category: "custom"
                    }
                    // Add to current stage (displayed ideas, basic, and advanced)
                    setCurrentStage(prev => prev ? {
                      ...prev,
                      ideas: [...prev.ideas, newIdea],
                      basicIdeas: [...(prev.basicIdeas || []), newIdea],
                      advancedIdeas: [...(prev.advancedIdeas || []), newIdea]
                    } : null)
                    // Select in both sets so it stays selected across modes
                    setSelectedBasic(prev => new Set([...prev, newIdea.id]))
                    setSelectedAdvanced(prev => new Set([...prev, newIdea.id]))
                    setCustomInput("")
                  }
                }}
                placeholder="Add your own option..."
                className="flex-1 max-w-xs px-3 py-1.5 text-sm rounded-full border border-primary/30 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (customInput.trim()) {
                    const newIdea: IdeaChip = {
                      id: `custom-${Date.now()}`,
                      label: customInput.trim(),
                      description: `Custom option: ${customInput.trim()}`,
                      category: "custom"
                    }
                    // Add to current stage (displayed ideas, basic, and advanced)
                    setCurrentStage(prev => prev ? {
                      ...prev,
                      ideas: [...prev.ideas, newIdea],
                      basicIdeas: [...(prev.basicIdeas || []), newIdea],
                      advancedIdeas: [...(prev.advancedIdeas || []), newIdea]
                    } : null)
                    // Select in both sets so it stays selected across modes
                    setSelectedBasic(prev => new Set([...prev, newIdea.id]))
                    setSelectedAdvanced(prev => new Set([...prev, newIdea.id]))
                    setCustomInput("")
                  }
                }}
                disabled={!customInput.trim()}
                className="rounded-full"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>

            {/* LLM status indicator */}
            {llmStatus && (
              <div className="text-xs text-muted-foreground mt-2 text-center">{llmStatus}</div>
            )}

            {/* Error display */}
            {error && (
              <div className="text-sm text-destructive mt-2 text-center">{error}</div>
            )}

            {/* Selection status and action buttons */}
            <div className="pt-4 border-t mt-4 space-y-3">
              {/* Selection count */}
              <div className="flex items-center justify-between">
                {totalSelections === 0 ? (
                  <span className="text-sm text-muted-foreground">
                    Click ideas above to select them
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{currentModeSelections.size}</span> selected in {ideaMode === "all" ? "All" : ideaMode === "advanced" ? "Advanced" : "Basic"}
                    {selectedBasic.size > 0 && selectedAdvanced.size > 0 && ideaMode !== "all" && (
                      <span className="ml-1">
                        ({totalSelections} total across modes)
                      </span>
                    )}
                  </span>
                )}
                <Button
                  onClick={proceedWithSelections}
                  disabled={isGenerating || totalSelections === 0}
                  variant={totalSelections > 0 ? "default" : "outline"}
                >
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

              {/* Escape hatches - None of these / Show different */}
              <div className="flex items-center justify-center gap-2 text-sm">
                <button
                  onClick={() => generateRecommendations(selectionPath)}
                  disabled={isGenerating}
                  className="text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  None of these — skip to recommendations
                </button>
                <span className="text-muted-foreground">•</span>
                <button
                  onClick={regenerateCurrentStage}
                  disabled={isGenerating}
                  className="text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  Show different options
                </button>
              </div>
            </div>
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

          {recommendations.map((originalRec) => {
            const rec = getRecommendation(originalRec)
            const isEditing = editingRecId === rec.id

            return (
              <Card key={rec.id} className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      {isEditing ? (
                        <Input
                          value={rec.title}
                          onChange={(e) => updateRecField(rec.id, "title", e.target.value)}
                          className="text-lg font-semibold"
                          placeholder="Project title"
                        />
                      ) : (
                        <CardTitle className="text-lg">{rec.title}</CardTitle>
                      )}
                      {rec.complexity && (
                        <Badge variant="outline" className="w-fit mt-1">{rec.complexity}</Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => isEditing ? setEditingRecId(null) : startEditing(originalRec)}
                    >
                      {isEditing ? (
                        <>
                          <Save className="h-4 w-4 mr-1" />
                          Done
                        </>
                      ) : (
                        <>
                          <Pencil className="h-4 w-4 mr-1" />
                          Edit
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Description */}
                  {isEditing ? (
                    <Textarea
                      value={rec.description}
                      onChange={(e) => updateRecField(rec.id, "description", e.target.value)}
                      className="text-sm min-h-[80px]"
                      placeholder="Project description"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{rec.description}</p>
                  )}

                  {rec.whyThisWorks && !isEditing && (
                    <p className="text-sm italic text-primary/80">{rec.whyThisWorks}</p>
                  )}

                  {/* How Selections Are Incorporated - with remove buttons */}
                  {rec.howSelectionsIncorporated && Object.keys(rec.howSelectionsIncorporated).length > 0 && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <h4 className="text-sm font-medium mb-2">How Your Selections Are Incorporated</h4>
                      <ul className="text-sm text-muted-foreground space-y-2">
                        {Object.entries(rec.howSelectionsIncorporated).map(([selection, explanation], i) => (
                          <li key={i} className="flex items-start gap-2 group">
                            <Badge variant="outline" className="shrink-0 mt-0.5">{selection}</Badge>
                            <span className="flex-1">{explanation}</span>
                            {isEditing && (
                              <button
                                onClick={() => removeSelection(rec.id, selection)}
                                className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-opacity"
                                title="Remove this selection"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Key Features - with add/edit/remove */}
                  {(rec.keyFeatures.length > 0 || isEditing) && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Key Features</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {rec.keyFeatures.map((feature, i) => (
                          <li key={i} className="flex items-start gap-2 group">
                            <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                            {isEditing ? (
                              <>
                                <Input
                                  value={feature}
                                  onChange={(e) => updateKeyFeature(rec.id, i, e.target.value)}
                                  className="flex-1 h-7 text-sm"
                                />
                                <button
                                  onClick={() => removeKeyFeature(rec.id, i)}
                                  className="text-destructive hover:text-destructive/80"
                                  title="Remove feature"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              feature
                            )}
                          </li>
                        ))}
                      </ul>
                      {isEditing && (
                        <div className="flex items-center gap-2 mt-2">
                          <Input
                            value={newFeatureInput[rec.id] || ""}
                            onChange={(e) => setNewFeatureInput(prev => ({ ...prev, [rec.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault()
                                addKeyFeature(rec.id)
                              }
                            }}
                            placeholder="Add a new feature..."
                            className="flex-1 h-8 text-sm"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => addKeyFeature(rec.id)}
                            disabled={!newFeatureInput[rec.id]?.trim()}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
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
            )
          })}

          <Button variant="outline" className="w-full" onClick={startOver}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Start Over with New Exploration
          </Button>
        </div>
      )}
    </div>
  )
}
