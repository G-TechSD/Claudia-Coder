"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  FileText,
  Loader2,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Save,
  Download,
  Plus,
  Trash2,
  Server,
  Cloud,
  Sparkles,
  FileCheck
} from "lucide-react"
import { cn } from "@/lib/utils"
import type {
  PatentSubmission,
  PatentSection,
  PatentClaim,
  PatentSectionType
} from "@/lib/data/types"

// Type for sections stored in PatentSubmission.sections (excludes "claims")
type EditablePatentSectionType = Exclude<PatentSectionType, "claims">

interface ProviderOption {
  name: string
  displayName: string
  status: "online" | "offline" | "checking" | "not-configured"
  model?: string
  type: "local" | "cloud"
}

interface PatentGeneratorProps {
  providers: ProviderOption[]
  selectedProvider: string | null
  onProviderChange: (provider: string) => void
  initialData?: Partial<PatentSubmission>
  priorArtNotes?: string
  className?: string
}

type WizardStep = "invention" | "features" | "generate" | "review" | "export"

const WIZARD_STEPS: { id: WizardStep; label: string; description: string }[] = [
  { id: "invention", label: "Invention Details", description: "Basic information about your invention" },
  { id: "features", label: "Key Features", description: "Define novel aspects and embodiments" },
  { id: "generate", label: "Generate Content", description: "AI generates patent sections" },
  { id: "review", label: "Review & Edit", description: "Review and refine each section" },
  { id: "export", label: "Export", description: "Download complete document" }
]

export function PatentGenerator({
  providers,
  selectedProvider,
  onProviderChange,
  initialData,
  priorArtNotes,
  className
}: PatentGeneratorProps) {
  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>("invention")

  // Form state
  const [inventionTitle, setInventionTitle] = useState(initialData?.inventionTitle || "")
  const [inventionDescription, setInventionDescription] = useState(initialData?.inventionDescription || "")
  const [technicalField, setTechnicalField] = useState(initialData?.technicalField || "")
  const [problemSolved, setProblemSolved] = useState("")
  const [keyFeatures, setKeyFeatures] = useState<string[]>([""])
  const [embodiments, setEmbodiments] = useState<string[]>([""])

  // Inventor info
  const [inventors, setInventors] = useState<Array<{ name: string; address: string; citizenship: string }>>([
    { name: "", address: "", citizenship: "" }
  ])

  // Generated content
  const [submission, setSubmission] = useState<Partial<PatentSubmission> | null>(initialData || null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatingSection, setGeneratingSection] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Edit state
  const [editingSection, setEditingSection] = useState<EditablePatentSectionType | null>(null)
  const [editedContent, setEditedContent] = useState<Record<string, string>>({})

  // Review checklist
  const [checklist, setChecklist] = useState({
    abstractComplete: false,
    backgroundComplete: false,
    summaryComplete: false,
    detailedDescriptionComplete: false,
    claimsComplete: false,
    figuresDescribed: false,
    priorArtCited: false,
    inventorInfoComplete: false
  })

  const currentStepIndex = WIZARD_STEPS.findIndex(s => s.id === currentStep)

  const goToNextStep = () => {
    const nextIndex = currentStepIndex + 1
    if (nextIndex < WIZARD_STEPS.length) {
      setCurrentStep(WIZARD_STEPS[nextIndex].id)
    }
  }

  const goToPrevStep = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(WIZARD_STEPS[prevIndex].id)
    }
  }

  const addFeature = () => setKeyFeatures(prev => [...prev, ""])
  const removeFeature = (index: number) => setKeyFeatures(prev => prev.filter((_, i) => i !== index))
  const updateFeature = (index: number, value: string) => {
    setKeyFeatures(prev => prev.map((f, i) => i === index ? value : f))
  }

  const addEmbodiment = () => setEmbodiments(prev => [...prev, ""])
  const removeEmbodiment = (index: number) => setEmbodiments(prev => prev.filter((_, i) => i !== index))
  const updateEmbodiment = (index: number, value: string) => {
    setEmbodiments(prev => prev.map((e, i) => i === index ? value : e))
  }

  const addInventor = () => setInventors(prev => [...prev, { name: "", address: "", citizenship: "" }])
  const removeInventor = (index: number) => setInventors(prev => prev.filter((_, i) => i !== index))
  const updateInventor = (index: number, field: "name" | "address" | "citizenship", value: string) => {
    setInventors(prev => prev.map((inv, i) => i === index ? { ...inv, [field]: value } : inv))
  }

  const generateAllSections = async () => {
    setIsGenerating(true)
    setGeneratingSection("all")
    setError(null)

    try {
      const response = await fetch("/api/patents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventionTitle,
          inventionDescription,
          technicalField,
          problemSolved,
          keyFeatures: keyFeatures.filter(f => f.trim()),
          embodiments: embodiments.filter(e => e.trim()),
          priorArtNotes,
          sectionToGenerate: "all",
          preferredProvider: selectedProvider
        })
      })

      const data = await response.json()

      if (data.error) {
        setError(data.error)
      } else if (data.submission) {
        setSubmission(data.submission)
        // Update checklist based on generated content
        setChecklist(prev => ({
          ...prev,
          abstractComplete: !!data.submission.sections?.abstract,
          backgroundComplete: !!data.submission.sections?.background,
          summaryComplete: !!data.submission.sections?.summary,
          detailedDescriptionComplete: !!data.submission.sections?.detailedDescription,
          claimsComplete: (data.submission.claims?.length || 0) > 0
        }))
        goToNextStep()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed")
    } finally {
      setIsGenerating(false)
      setGeneratingSection(null)
    }
  }

  const regenerateSection = async (section: PatentSectionType | "claims") => {
    setIsGenerating(true)
    setGeneratingSection(section)
    setError(null)

    try {
      const response = await fetch("/api/patents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventionTitle,
          inventionDescription,
          technicalField,
          problemSolved,
          keyFeatures: keyFeatures.filter(f => f.trim()),
          embodiments: embodiments.filter(e => e.trim()),
          priorArtNotes,
          sectionToGenerate: section,
          preferredProvider: selectedProvider
        })
      })

      const data = await response.json()

      if (data.error) {
        setError(data.error)
      } else if (data.submission) {
        // Merge the regenerated section with existing submission
        setSubmission(prev => ({
          ...prev,
          sections: {
            ...prev?.sections,
            ...data.submission.sections
          },
          claims: section === "claims" ? data.submission.claims : prev?.claims
        }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regeneration failed")
    } finally {
      setIsGenerating(false)
      setGeneratingSection(null)
    }
  }

  const saveEditedSection = useCallback((section: EditablePatentSectionType) => {
    if (!editedContent[section]) return

    setSubmission(prev => {
      if (!prev?.sections) return prev

      const updatedSection: PatentSection = {
        ...prev.sections[section]!,
        content: editedContent[section],
        isEdited: true,
        lastEditedAt: new Date().toISOString()
      }

      return {
        ...prev,
        sections: {
          ...prev.sections,
          [section]: updatedSection
        }
      }
    })

    setEditingSection(null)
    setEditedContent(prev => {
      const { [section]: _, ...rest } = prev
      return rest
    })
  }, [editedContent])

  const startEditing = (section: EditablePatentSectionType) => {
    setEditingSection(section)
    setEditedContent(prev => ({
      ...prev,
      [section]: submission?.sections?.[section]?.content || ""
    }))
  }

  const exportDocument = async (format: "text" | "markdown") => {
    if (!submission) return

    let content = ""

    if (format === "markdown") {
      content = `# ${submission.inventionTitle}\n\n`
      content += `**Technical Field:** ${submission.technicalField}\n\n`

      if (submission.sections?.abstract) {
        content += `## ABSTRACT\n\n${submission.sections.abstract.content}\n\n`
      }
      if (submission.sections?.background) {
        content += `## BACKGROUND OF THE INVENTION\n\n${submission.sections.background.content}\n\n`
      }
      if (submission.sections?.summary) {
        content += `## SUMMARY OF THE INVENTION\n\n${submission.sections.summary.content}\n\n`
      }
      if (submission.sections?.detailedDescription) {
        content += `## DETAILED DESCRIPTION\n\n${submission.sections.detailedDescription.content}\n\n`
      }
      if (submission.claims && submission.claims.length > 0) {
        content += `## CLAIMS\n\n`
        submission.claims.forEach(claim => {
          content += `${claim.number}. ${claim.content}\n\n`
        })
      }
    } else {
      content = `${submission.inventionTitle}\n\n`
      content += `Technical Field: ${submission.technicalField}\n\n`

      if (submission.sections?.abstract) {
        content += `ABSTRACT\n\n${submission.sections.abstract.content}\n\n`
      }
      if (submission.sections?.background) {
        content += `BACKGROUND OF THE INVENTION\n\n${submission.sections.background.content}\n\n`
      }
      if (submission.sections?.summary) {
        content += `SUMMARY OF THE INVENTION\n\n${submission.sections.summary.content}\n\n`
      }
      if (submission.sections?.detailedDescription) {
        content += `DETAILED DESCRIPTION\n\n${submission.sections.detailedDescription.content}\n\n`
      }
      if (submission.claims && submission.claims.length > 0) {
        content += `CLAIMS\n\n`
        submission.claims.forEach(claim => {
          content += `${claim.number}. ${claim.content}\n\n`
        })
      }
    }

    // Create download
    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `patent-${submission.inventionTitle?.replace(/\s+/g, "-").toLowerCase()}.${format === "markdown" ? "md" : "txt"}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case "invention":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Invention Title *</Label>
              <Input
                id="title"
                value={inventionTitle}
                onChange={(e) => setInventionTitle(e.target.value)}
                placeholder="e.g., Automated Code Review System Using Machine Learning"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="field">Technical Field *</Label>
              <Input
                id="field"
                value={technicalField}
                onChange={(e) => setTechnicalField(e.target.value)}
                placeholder="e.g., Software Development, Artificial Intelligence"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="problem">Problem Solved *</Label>
              <Textarea
                id="problem"
                value={problemSolved}
                onChange={(e) => setProblemSolved(e.target.value)}
                placeholder="Describe the technical problem your invention solves..."
                className="min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Detailed Description *</Label>
              <Textarea
                id="description"
                value={inventionDescription}
                onChange={(e) => setInventionDescription(e.target.value)}
                placeholder="Provide a comprehensive description of your invention, how it works, and what makes it novel..."
                className="min-h-[150px]"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Inventors</Label>
                <Button variant="outline" size="sm" onClick={addInventor}>
                  <Plus className="h-3 w-3 mr-1" /> Add Inventor
                </Button>
              </div>
              {inventors.map((inv, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <Input
                      placeholder="Name"
                      value={inv.name}
                      onChange={(e) => updateInventor(i, "name", e.target.value)}
                    />
                    <Input
                      placeholder="Address"
                      value={inv.address}
                      onChange={(e) => updateInventor(i, "address", e.target.value)}
                    />
                    <Input
                      placeholder="Citizenship"
                      value={inv.citizenship}
                      onChange={(e) => updateInventor(i, "citizenship", e.target.value)}
                    />
                  </div>
                  {inventors.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeInventor(i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )

      case "features":
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Key Features / Novel Aspects *</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    List the unique features that distinguish your invention from prior art
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={addFeature}>
                  <Plus className="h-3 w-3 mr-1" /> Add Feature
                </Button>
              </div>
              {keyFeatures.map((feature, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder={`Feature ${i + 1}: e.g., Uses transformer architecture for code analysis`}
                    value={feature}
                    onChange={(e) => updateFeature(i, e.target.value)}
                  />
                  {keyFeatures.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFeature(i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Alternative Embodiments</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Describe alternative implementations or variations
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={addEmbodiment}>
                  <Plus className="h-3 w-3 mr-1" /> Add Embodiment
                </Button>
              </div>
              {embodiments.map((embodiment, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder={`Embodiment ${i + 1}: e.g., Cloud-based implementation with distributed processing`}
                    value={embodiment}
                    onChange={(e) => updateEmbodiment(i, e.target.value)}
                  />
                  {embodiments.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeEmbodiment(i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )

      case "generate":
        return (
          <div className="space-y-4">
            <div className="text-center py-8">
              <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Ready to Generate Patent Content</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                The AI will generate professional USPTO-compliant content for all patent sections based on your invention details.
              </p>

              <div className="flex items-center justify-center gap-2 mb-6">
                <Select value={selectedProvider || ""} onValueChange={onProviderChange}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select AI Provider..." />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.filter(p => p.type === "local").map(p => (
                      <SelectItem key={p.name} value={p.name} disabled={p.status !== "online"}>
                        <div className="flex items-center gap-2">
                          <Server className="h-3 w-3" />
                          {p.displayName}
                        </div>
                      </SelectItem>
                    ))}
                    {providers.filter(p => p.type === "cloud").map(p => (
                      <SelectItem key={p.name} value={p.name} disabled={p.status !== "online"}>
                        <div className="flex items-center gap-2">
                          <Cloud className="h-3 w-3 text-blue-500" />
                          {p.displayName}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={generateAllSections}
                disabled={isGenerating || !selectedProvider}
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating {generatingSection}...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate All Sections
                  </>
                )}
              </Button>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-500">
                {error}
              </div>
            )}
          </div>
        )

      case "review":
        return (
          <div className="space-y-4">
            <Tabs defaultValue="abstract" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="abstract" className="text-xs">Abstract</TabsTrigger>
                <TabsTrigger value="background" className="text-xs">Background</TabsTrigger>
                <TabsTrigger value="summary" className="text-xs">Summary</TabsTrigger>
                <TabsTrigger value="detailed" className="text-xs">Detailed</TabsTrigger>
                <TabsTrigger value="claims" className="text-xs">Claims</TabsTrigger>
              </TabsList>

              {(["abstract", "background", "summary", "detailedDescription"] as EditablePatentSectionType[]).map(section => (
                <TabsContent key={section} value={section === "detailedDescription" ? "detailed" : section}>
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">
                          {submission?.sections?.[section]?.title || section.toUpperCase()}
                        </CardTitle>
                        <div className="flex gap-2">
                          {editingSection === section ? (
                            <Button
                              size="sm"
                              onClick={() => saveEditedSection(section)}
                            >
                              <Save className="h-3 w-3 mr-1" /> Save
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => startEditing(section)}
                            >
                              <Edit3 className="h-3 w-3 mr-1" /> Edit
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => regenerateSection(section)}
                            disabled={isGenerating}
                          >
                            {generatingSection === section ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Sparkles className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {editingSection === section ? (
                        <Textarea
                          value={editedContent[section] || ""}
                          onChange={(e) => setEditedContent(prev => ({
                            ...prev,
                            [section]: e.target.value
                          }))}
                          className="min-h-[300px] font-mono text-sm"
                        />
                      ) : (
                        <ScrollArea className="h-[300px]">
                          <div className="prose prose-sm max-w-none">
                            <p className="whitespace-pre-wrap">
                              {submission?.sections?.[section]?.content || "No content generated yet"}
                            </p>
                          </div>
                        </ScrollArea>
                      )}

                      {submission?.sections?.[section]?.warnings?.length ? (
                        <div className="mt-2 flex items-start gap-2 text-xs text-yellow-600">
                          <AlertCircle className="h-4 w-4 flex-shrink-0" />
                          <span>{submission.sections[section]!.warnings!.join("; ")}</span>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}

              <TabsContent value="claims">
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">CLAIMS ({submission?.claims?.length || 0})</CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => regenerateSection("claims")}
                        disabled={isGenerating}
                      >
                        {generatingSection === "claims" ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <Sparkles className="h-3 w-3 mr-1" /> Regenerate
                          </>
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-3">
                        {submission?.claims?.map((claim) => (
                          <div
                            key={claim.id}
                            className={cn(
                              "p-3 border rounded-lg",
                              claim.type === "independent" && "bg-blue-500/5 border-blue-500/20"
                            )}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant={claim.type === "independent" ? "default" : "outline"}>
                                {claim.number}. {claim.type}
                              </Badge>
                              {claim.dependsOn && (
                                <span className="text-xs text-muted-foreground">
                                  (depends on claim {claim.dependsOn})
                                </span>
                              )}
                            </div>
                            <p className="text-sm">{claim.content}</p>
                          </div>
                        ))}
                        {(!submission?.claims || submission.claims.length === 0) && (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            No claims generated yet
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )

      case "export":
        return (
          <div className="space-y-6">
            {/* Review Checklist */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileCheck className="h-4 w-4" />
                  Review Checklist
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(checklist).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <Checkbox
                        id={key}
                        checked={value}
                        onCheckedChange={(checked) =>
                          setChecklist(prev => ({ ...prev, [key]: !!checked }))
                        }
                      />
                      <Label htmlFor={key} className="text-sm font-normal">
                        {key.replace(/([A-Z])/g, " $1").replace(/^./, str => str.toUpperCase())}
                      </Label>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    {Object.values(checklist).every(Boolean) ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <span className="text-sm text-green-600">All items complete - ready to export</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-5 w-5 text-yellow-500" />
                        <span className="text-sm text-yellow-600">
                          {Object.values(checklist).filter(Boolean).length} of {Object.keys(checklist).length} items complete
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Export Options */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Export Patent Document</CardTitle>
                <CardDescription>Download your patent application in various formats</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full"
                  onClick={() => exportDocument("text")}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export as Plain Text (.txt)
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => exportDocument("markdown")}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export as Markdown (.md)
                </Button>
                <p className="text-xs text-muted-foreground text-center pt-2">
                  For DOCX or PDF export, use the text/markdown output with a document converter
                </p>
              </CardContent>
            </Card>
          </div>
        )
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case "invention":
        return inventionTitle.trim() && inventionDescription.trim() && problemSolved.trim() && technicalField.trim()
      case "features":
        return keyFeatures.filter(f => f.trim()).length > 0
      case "generate":
        return submission && submission.sections
      case "review":
        return true
      default:
        return true
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <Card className="bg-gradient-to-r from-purple-500/5 to-pink-500/5 border-purple-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-500" />
            Patent Submission Generator
          </CardTitle>
          <CardDescription>
            Generate USPTO-compliant patent application content
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Progress Steps */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            {WIZARD_STEPS.map((step, i) => (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => setCurrentStep(step.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
                    currentStep === step.id
                      ? "bg-primary text-primary-foreground"
                      : i < currentStepIndex
                      ? "bg-green-500/10 text-green-600"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <span className={cn(
                    "flex items-center justify-center h-6 w-6 rounded-full text-xs font-medium",
                    currentStep === step.id
                      ? "bg-primary-foreground text-primary"
                      : i < currentStepIndex
                      ? "bg-green-500 text-white"
                      : "bg-muted"
                  )}>
                    {i < currentStepIndex ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="hidden md:inline text-sm">{step.label}</span>
                </button>
                {i < WIZARD_STEPS.length - 1 && (
                  <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{WIZARD_STEPS[currentStepIndex].label}</CardTitle>
          <CardDescription>{WIZARD_STEPS[currentStepIndex].description}</CardDescription>
        </CardHeader>
        <CardContent>
          {renderStepContent()}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={goToPrevStep}
          disabled={currentStepIndex === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>

        {currentStep !== "export" && currentStep !== "generate" && (
          <Button
            onClick={goToNextStep}
            disabled={!canProceed()}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  )
}
