"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  Lightbulb,
  RefreshCw,
  Trash2,
  Edit2,
  Save,
  X,
  Send,
  Bot,
  User,
  TrendingUp,
  Sparkles,
  Target,
  CheckCircle,
  Archive,
  Rocket,
  Clock,
  MessageSquare,
  AlertCircle,
  Plus,
  Loader2,
  Check,
  Building2,
  Code2,
  Link2
} from "lucide-react"
import {
  getBusinessIdea,
  updateBusinessIdea,
  deleteBusinessIdea,
  addMessageToIdea,
  markIdeaAsConverted,
  type BusinessIdea,
  type BusinessIdeaStatus,
  type BusinessIdeaPotential
} from "@/lib/data/business-ideas"
import { createProject } from "@/lib/data/projects"
import type { Project } from "@/lib/data/types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { VoiceChatPanel } from "@/components/business-ideas/voice-chat-panel"
import { ConvertToProjectDialog } from "@/components/business-ideas/convert-to-project-dialog"
import { ExecutiveSummary, ViabilityInterview, type ExecutiveSummaryData } from "@/components/business"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const statusConfig: Record<BusinessIdeaStatus, {
  label: string
  color: string
  bg: string
  icon: typeof Lightbulb
}> = {
  brainstorming: { label: "Brainstorming", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/30", icon: Lightbulb },
  exploring: { label: "Exploring", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/30", icon: Sparkles },
  validating: { label: "Validating", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30", icon: Target },
  ready: { label: "Ready", color: "text-green-400", bg: "bg-green-500/10 border-green-500/30", icon: CheckCircle },
  converted: { label: "Converted", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", icon: Rocket },
  archived: { label: "Archived", color: "text-gray-400", bg: "bg-gray-500/10 border-gray-500/30", icon: Archive }
}

const potentialConfig: Record<BusinessIdeaPotential, {
  label: string
  color: string
}> = {
  low: { label: "Low Potential", color: "text-gray-400" },
  medium: { label: "Medium Potential", color: "text-blue-400" },
  high: { label: "High Potential", color: "text-orange-400" },
  "very-high": { label: "Very High Potential", color: "text-green-400" }
}

export default function BusinessIdeaDetailPage() {
  const params = useParams()
  const router = useRouter()
  const ideaId = Array.isArray(params.id) ? params.id[0] : (params.id as string)

  const [idea, setIdea] = useState<BusinessIdea | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editSummary, setEditSummary] = useState("")
  const [message, setMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [showConvertDialog, setShowConvertDialog] = useState(false)
  const [activeTab, setActiveTab] = useState<"basics" | "executive" | "interview">("basics")
  const [executiveSummaryData, setExecutiveSummaryData] = useState<ExecutiveSummaryData | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ideaId) {
      setLoading(false)
      return
    }

    const found = getBusinessIdea(ideaId)
    setIdea(found)
    if (found) {
      setEditTitle(found.title)
      setEditSummary(found.summary)
    }
    setLoading(false)
  }, [ideaId])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [idea?.messages])

  const handleSaveEdit = () => {
    if (!idea) return
    const updated = updateBusinessIdea(idea.id, {
      title: editTitle,
      summary: editSummary
    })
    if (updated) {
      setIdea(updated)
      setIsEditing(false)
    }
  }

  const handleCancelEdit = () => {
    if (idea) {
      setEditTitle(idea.title)
      setEditSummary(idea.summary)
    }
    setIsEditing(false)
  }

  const handleStatusChange = (newStatus: BusinessIdeaStatus) => {
    if (!idea) return
    const updated = updateBusinessIdea(idea.id, { status: newStatus })
    if (updated) setIdea(updated)
  }

  const handlePotentialChange = (newPotential: BusinessIdeaPotential) => {
    if (!idea) return
    const updated = updateBusinessIdea(idea.id, { potential: newPotential })
    if (updated) setIdea(updated)
  }

  const handleDelete = () => {
    if (!idea) return
    if (confirm(`Permanently delete "${idea.title}"? This cannot be undone.`)) {
      deleteBusinessIdea(idea.id)
      router.push("/business-ideas")
    }
  }

  const handleSendMessage = async () => {
    if (!idea || !message.trim()) return

    setIsSending(true)

    // Add user message
    const updatedWithUser = addMessageToIdea(idea.id, {
      role: "user",
      content: message.trim()
    })

    if (updatedWithUser) {
      setIdea(updatedWithUser)
      setMessage("")
    }

    // Simulate AI response (in real implementation, this would call an AI API)
    setTimeout(() => {
      const aiResponse = generateAIResponse(message.trim(), idea)
      const updatedWithAI = addMessageToIdea(idea.id, {
        role: "assistant",
        content: aiResponse
      })
      if (updatedWithAI) {
        setIdea(updatedWithAI)
      }
      setIsSending(false)
    }, 1000)
  }

  const handleCreateProject = () => {
    if (!idea) return
    setShowConvertDialog(true)
  }

  const handleProjectCreated = (projects: { businessProject?: Project; devProject?: Project }) => {
    // Navigate to the first created project
    if (projects.businessProject) {
      router.push(`/projects/${projects.businessProject.id}`)
    } else if (projects.devProject) {
      router.push(`/projects/${projects.devProject.id}`)
    }
  }

  const handleUpdateExecutiveSummary = (field: string, value: unknown) => {
    if (!idea) return
    const updated = updateBusinessIdea(idea.id, { [field]: value })
    if (updated) {
      setIdea(updated)
      // If updating executive summary data, also update local state
      if (field === "executiveSummaryData" && value) {
        setExecutiveSummaryData(value as ExecutiveSummaryData)
      }
    }
  }

  const handleViabilityComplete = (
    insights: NonNullable<BusinessIdea["viabilityInsights"]>,
    answers: NonNullable<BusinessIdea["viabilityAnswers"]>
  ) => {
    if (!idea) return
    // Store viability interview results
    const updated = updateBusinessIdea(idea.id, {
      viabilityInsights: insights,
      viabilityAnswers: answers
    })
    if (updated) setIdea(updated)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!idea) {
    return (
      <div className="p-6">
        <Card className="bg-destructive/10 border-destructive/30">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Idea Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The business idea you are looking for does not exist or has been deleted.
            </p>
            <Button asChild>
              <Link href="/business-ideas">Back to Business Ideas</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const StatusIcon = statusConfig[idea.status].icon

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/business-ideas">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            {isEditing ? (
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="text-2xl font-bold h-auto py-1 px-2"
              />
            ) : (
              <h1 className="text-2xl font-bold">{idea.title}</h1>
            )}
            <Badge className={cn("border", statusConfig[idea.status].bg, statusConfig[idea.status].color)}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig[idea.status].label}
            </Badge>
            <Badge variant="outline" className={potentialConfig[idea.potential].color}>
              <TrendingUp className="h-3 w-3 mr-1" />
              {potentialConfig[idea.potential].label}
            </Badge>
          </div>
          {isEditing ? (
            <Textarea
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
              className="ml-12 min-h-[60px]"
            />
          ) : (
            <p className="text-muted-foreground ml-12">{idea.summary}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveEdit}>
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
            </>
          ) : (
            <>
              {!idea.convertedProjectId && (
                <Button
                  size="sm"
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleCreateProject}
                >
                  <Rocket className="h-4 w-4" />
                  Convert to Project
                </Button>
              )}
              {idea.convertedProjectId && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/projects/${idea.convertedProjectId}`}>
                    <Rocket className="h-4 w-4 mr-1" />
                    View Project
                  </Link>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit2 className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Status Controls */}
      {idea.status !== "converted" && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">Status:</span>
              <Select value={idea.status} onValueChange={(v) => handleStatusChange(v as BusinessIdeaStatus)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="brainstorming">Brainstorming</SelectItem>
                  <SelectItem value="exploring">Exploring</SelectItem>
                  <SelectItem value="validating">Validating</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>

              <span className="text-sm text-muted-foreground ml-4">Potential:</span>
              <Select value={idea.potential} onValueChange={(v) => handlePotentialChange(v as BusinessIdeaPotential)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="very-high">Very High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "basics" | "executive" | "interview")}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="basics" className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Basics
          </TabsTrigger>
          <TabsTrigger value="executive" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Executive
          </TabsTrigger>
          <TabsTrigger value="interview" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Viability
          </TabsTrigger>
        </TabsList>

        {/* Tab: Basics */}
        <TabsContent value="basics" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Info */}
            <Card className="lg:row-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-primary" />
                  Idea Details
                </CardTitle>
                <CardDescription>
                  Core information about your business idea
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <EditableField
                  label="Problem Statement"
                  value={idea.problemStatement || ""}
                  placeholder="What problem does this solve?"
                  onSave={(v) => handleUpdateExecutiveSummary("problemStatement", v)}
                />
                <EditableField
                  label="Target Audience"
                  value={idea.targetAudience || ""}
                  placeholder="Who is this for?"
                  onSave={(v) => handleUpdateExecutiveSummary("targetAudience", v)}
                />
                <EditableField
                  label="Value Proposition"
                  value={idea.valueProposition || ""}
                  placeholder="What unique value does this provide?"
                  onSave={(v) => handleUpdateExecutiveSummary("valueProposition", v)}
                />
                <EditableField
                  label="Revenue Model"
                  value={idea.revenueModel || ""}
                  placeholder="How will this make money?"
                  onSave={(v) => handleUpdateExecutiveSummary("revenueModel", v)}
                />
                <EditableField
                  label="Competitive Advantage"
                  value={idea.competitiveAdvantage || ""}
                  placeholder="What sets this apart?"
                  onSave={(v) => handleUpdateExecutiveSummary("competitiveAdvantage", v)}
                />
              </CardContent>
            </Card>

            {/* Voice Chat Interface */}
            <VoiceChatPanel
              idea={idea}
              onMessageSent={(msg, resp) => {
                // Add messages to idea for persistence
                const updatedWithUser = addMessageToIdea(idea.id, {
                  role: "user",
                  content: msg
                })
                if (updatedWithUser) {
                  const updatedWithAssistant = addMessageToIdea(idea.id, {
                    role: "assistant",
                    content: resp
                  })
                  if (updatedWithAssistant) {
                    setIdea(updatedWithAssistant)
                  }
                }
              }}
              className="h-[600px]"
            />

            {/* Key Risks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-400" />
                  Key Risks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <EditableList
                  items={idea.keyRisks || []}
                  placeholder="Add a risk..."
                  onSave={(items) => handleUpdateExecutiveSummary("keyRisks", items)}
                />
              </CardContent>
            </Card>

            {/* Next Steps */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  Next Steps
                </CardTitle>
              </CardHeader>
              <CardContent>
                <EditableList
                  items={idea.nextSteps || []}
                  placeholder="Add a next step..."
                  onSave={(items) => handleUpdateExecutiveSummary("nextSteps", items)}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Executive Summary */}
        <TabsContent value="executive" className="mt-6">
          <ExecutiveSummary
            idea={idea}
            onUpdate={handleUpdateExecutiveSummary}
            initialData={executiveSummaryData}
          />
        </TabsContent>

        {/* Tab: Viability Interview */}
        <TabsContent value="interview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="lg:col-span-1">
              <ViabilityInterview
                idea={idea}
                executiveSummary={executiveSummaryData}
                onComplete={handleViabilityComplete}
                onUpdate={handleUpdateExecutiveSummary}
              />
            </div>
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-blue-400" />
                    About Viability Interviews
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                  <p>
                    The viability interview helps fill in gaps and strengthen your business case
                    by asking targeted questions about:
                  </p>
                  <ul className="space-y-2 list-disc list-inside">
                    <li>Problem validation and customer understanding</li>
                    <li>Solution fit and competitive positioning</li>
                    <li>Market opportunity and revenue clarity</li>
                    <li>Execution readiness and next steps</li>
                  </ul>
                  <p>
                    Your answers will be analyzed to generate insights and identify
                    areas that need more attention before moving forward.
                  </p>
                </CardContent>
              </Card>

              {/* Quick Access to Executive Summary */}
              {!executiveSummaryData && (
                <Card className="border-dashed">
                  <CardContent className="p-6 text-center">
                    <Sparkles className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                    <h4 className="font-medium mb-2">Generate Executive Summary First</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      We recommend generating an executive summary before the viability interview
                      for more targeted questions.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab("executive")}
                    >
                      Go to Executive Summary
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Metadata */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Created: {new Date(idea.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              <span>Updated: {new Date(idea.updatedAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span>{idea.messages.length} messages</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Convert to Project Dialog */}
      <ConvertToProjectDialog
        open={showConvertDialog}
        onOpenChange={setShowConvertDialog}
        idea={idea}
        suggestedType={null}
        onSuccess={handleProjectCreated}
      />
    </div>
  )
}

// Helper component for editable fields
function EditableField({
  label,
  value,
  placeholder,
  onSave,
  multiline = false
}: {
  label: string
  value: string
  placeholder: string
  onSave: (value: string) => void
  multiline?: boolean
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)

  const handleSave = () => {
    onSave(editValue)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditValue(value)
    setIsEditing(false)
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-muted-foreground">{label}</label>
        {!isEditing && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            onClick={() => setIsEditing(true)}
          >
            <Edit2 className="h-3 w-3" />
          </Button>
        )}
      </div>
      {isEditing ? (
        <div className="space-y-2">
          {multiline ? (
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={placeholder}
              className="min-h-[100px]"
              autoFocus
            />
          ) : (
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={placeholder}
              autoFocus
            />
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave}>
              <Check className="h-3 w-3 mr-1" />
              Save
            </Button>
            <Button variant="outline" size="sm" onClick={handleCancel}>
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className={cn(
          "text-sm",
          value ? "" : "text-muted-foreground italic"
        )}>
          {value || placeholder}
        </p>
      )}
    </div>
  )
}

// Helper component for editable lists
function EditableList({
  items,
  placeholder,
  onSave
}: {
  items: string[]
  placeholder: string
  onSave: (items: string[]) => void
}) {
  const [newItem, setNewItem] = useState("")

  const handleAdd = () => {
    if (newItem.trim()) {
      onSave([...items, newItem.trim()])
      setNewItem("")
    }
  }

  const handleRemove = (index: number) => {
    const newItems = items.filter((_, i) => i !== index)
    onSave(newItems)
  }

  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No items yet</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item, index) => (
            <li key={index} className="flex items-start gap-2 group">
              <span className="text-muted-foreground">-</span>
              <span className="text-sm flex-1">{item}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-400"
                onClick={() => handleRemove(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder={placeholder}
          className="h-8 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              handleAdd()
            }
          }}
        />
        <Button size="sm" onClick={handleAdd} disabled={!newItem.trim()}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

// Simple AI response generator (placeholder - would be replaced with real AI)
function generateAIResponse(userMessage: string, idea: BusinessIdea): string {
  const lowerMessage = userMessage.toLowerCase()

  if (lowerMessage.includes("market") || lowerMessage.includes("potential")) {
    return `Based on "${idea.title}", here are some thoughts on market potential:

1. **Market Size**: Consider researching the total addressable market (TAM) for your solution.

2. **Growth Trends**: Look into industry growth rates and emerging trends that could support your idea.

3. **Competition**: Analyze existing solutions and identify gaps your idea could fill.

Would you like me to help you think through any of these areas in more detail?`
  }

  if (lowerMessage.includes("risk") || lowerMessage.includes("challenge")) {
    return `Here are some potential risks to consider for "${idea.title}":

1. **Market Risk**: Is there proven demand for this solution?
2. **Technical Risk**: Are there significant technical challenges?
3. **Financial Risk**: What's the runway needed to reach profitability?
4. **Competitive Risk**: How defensible is your position?

What specific risks are you most concerned about?`
  }

  if (lowerMessage.includes("next") || lowerMessage.includes("step")) {
    return `Here are suggested next steps for "${idea.title}":

1. **Validate the Problem**: Talk to potential customers about their pain points
2. **Research Competition**: Understand the current solutions in the market
3. **Define MVP**: Outline the minimum viable product
4. **Estimate Costs**: Create a rough budget for initial development

Which of these would you like to explore first?`
  }

  if (lowerMessage.includes("revenue") || lowerMessage.includes("money") || lowerMessage.includes("business model")) {
    return `Let's think about revenue models for "${idea.title}":

1. **Subscription**: Recurring revenue through monthly/annual plans
2. **Freemium**: Free tier with premium upgrades
3. **Transaction-based**: Fee per transaction or usage
4. **Enterprise Licensing**: B2B licensing deals

What type of model resonates most with your vision?`
  }

  return `That's an interesting point about "${idea.title}".

To help you develop this further, consider:
- What specific problem are you trying to solve?
- Who would benefit most from this solution?
- What makes your approach unique?

Feel free to ask me about market potential, risks, next steps, or business models!`
}
