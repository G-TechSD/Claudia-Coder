"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  Trash2,
  FileCheck,
  FileText,
  Search,
  Scale,
  Send,
  Users,
  Plus,
  Edit,
  X,
  Check,
  ExternalLink,
  Star,
  Phone,
  Mail,
  Building,
  AlertCircle,
  Lightbulb,
  FolderOpen,
  Briefcase,
  RefreshCw,
  Loader2,
  Sparkles
} from "lucide-react"
import { AttorneyReferrals } from "@/components/patents/attorney-referrals"
import type { PatentResearch, PatentResearchStatus, PatentPriorArt, PatentResearchClaim, PatentAttorney } from "@/lib/data/types"

const statusConfig: Record<PatentResearchStatus, {
  label: string
  color: string
  bgColor: string
}> = {
  research: { label: "Research", color: "text-blue-400", bgColor: "bg-blue-400/10" },
  drafting: { label: "Drafting", color: "text-purple-400", bgColor: "bg-purple-400/10" },
  review: { label: "Review", color: "text-yellow-400", bgColor: "bg-yellow-400/10" },
  filed: { label: "Filed", color: "text-orange-400", bgColor: "bg-orange-400/10" },
  approved: { label: "Approved", color: "text-green-400", bgColor: "bg-green-400/10" },
  rejected: { label: "Rejected", color: "text-red-400", bgColor: "bg-red-400/10" }
}

export default function PatentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const patentId = params.id as string

  const [patent, setPatent] = useState<PatentResearch | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("invention")

  // Form states for editing
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState("")

  // Prior Art form
  const [showAddPriorArt, setShowAddPriorArt] = useState(false)
  const [priorArtForm, setPriorArtForm] = useState<Partial<PatentPriorArt>>({})

  // Claim form
  const [showAddClaim, setShowAddClaim] = useState(false)
  const [claimForm, setClaimForm] = useState<Partial<PatentResearchClaim>>({})

  // Attorney form
  const [showAddAttorney, setShowAddAttorney] = useState(false)
  const [attorneyForm, setAttorneyForm] = useState<Partial<PatentAttorney>>({})

  // Load patent from API
  const loadPatent = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/patents/${patentId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch patent")
      }

      setPatent(data.patent)
      setTitleValue(data.patent.title)
    } catch (err) {
      console.error("[Patent Detail] Load error:", err)
      setError(err instanceof Error ? err.message : "Failed to load patent")
    } finally {
      setIsLoading(false)
    }
  }, [patentId])

  // Load patent on mount
  useEffect(() => {
    loadPatent()
  }, [loadPatent])

  // Update payload types for different actions
  type AddPriorArtPayload = {
    _action: "addPriorArt"
    priorArt: Omit<PatentPriorArt, "id" | "addedAt">
  }

  type RemovePriorArtPayload = {
    _action: "removePriorArt"
    priorArtId: string
  }

  type UpdateInventionDescriptionPayload = {
    _action: "updateInventionDescription"
    description: PatentResearch["inventionDescription"]
  }

  type RegularUpdatePayload = Partial<Omit<PatentResearch, "priorArt">> & { _action?: never }

  type PatentUpdatePayload =
    | AddPriorArtPayload
    | RemovePriorArtPayload
    | UpdateInventionDescriptionPayload
    | RegularUpdatePayload

  // Generic update function for patent
  const updatePatentApi = async (updates: PatentUpdatePayload) => {
    if (!patent) return null
    setIsSaving(true)

    try {
      const response = await fetch(`/api/patents/${patent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update patent")
      }

      setPatent(data.patent)
      return data.patent
    } catch (err) {
      console.error("[Patent Detail] Update error:", err)
      alert(err instanceof Error ? err.message : "Failed to update patent")
      return null
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveTitle = async () => {
    if (!patent || !titleValue.trim()) return
    await updatePatentApi({ title: titleValue })
    setEditingTitle(false)
  }

  const handleStatusChange = async (status: PatentResearchStatus) => {
    await updatePatentApi({ status })
  }

  const handleDelete = async () => {
    if (!patent) return
    if (!confirm(`Permanently delete "${patent.title}"? This cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/patents/${patent.id}`, {
        method: "DELETE"
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete patent")
      }

      router.push("/patents")
    } catch (err) {
      console.error("[Patent Detail] Delete error:", err)
      alert(err instanceof Error ? err.message : "Failed to delete patent")
    }
  }

  const handleUpdateDescription = async (field: string, value: string | string[]) => {
    if (!patent) return
    const updatedDescription = {
      ...patent.inventionDescription,
      [field]: value
    }
    await updatePatentApi({
      _action: "updateInventionDescription",
      description: updatedDescription
    })
  }

  // Prior Art handlers
  const handleAddPriorArt = async () => {
    if (!patent || !priorArtForm.title) return
    await updatePatentApi({
      _action: "addPriorArt",
      priorArt: {
        title: priorArtForm.title,
        patentNumber: priorArtForm.patentNumber,
        applicationNumber: priorArtForm.applicationNumber,
        inventor: priorArtForm.inventor,
        assignee: priorArtForm.assignee,
        filingDate: priorArtForm.filingDate,
        publicationDate: priorArtForm.publicationDate,
        abstract: priorArtForm.abstract,
        url: priorArtForm.url,
        relevance: priorArtForm.relevance || "medium",
        notes: priorArtForm.notes || ""
      }
    })
    setPriorArtForm({})
    setShowAddPriorArt(false)
  }

  const handleRemovePriorArt = async (priorArtId: string) => {
    if (!patent) return
    if (!confirm("Remove this prior art reference?")) return
    await updatePatentApi({
      _action: "removePriorArt",
      priorArtId
    })
  }

  // Claim handlers
  const handleAddClaim = async () => {
    if (!patent || !claimForm.text) return

    try {
      setIsSaving(true)
      const response = await fetch(`/api/patents/${patent.id}/claims`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: claimForm.type || "independent",
          dependsOn: claimForm.dependsOn,
          text: claimForm.text,
          status: "draft",
          notes: claimForm.notes
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to add claim")
      }

      // Reload patent to get updated claims
      await loadPatent()
      setClaimForm({})
      setShowAddClaim(false)
    } catch (err) {
      console.error("[Patent Detail] Add claim error:", err)
      alert(err instanceof Error ? err.message : "Failed to add claim")
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateClaimStatus = async (claimId: string, status: PatentResearchClaim["status"]) => {
    if (!patent) return

    try {
      setIsSaving(true)
      const response = await fetch(`/api/patents/${patent.id}/claims`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimId, status })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update claim")
      }

      await loadPatent()
    } catch (err) {
      console.error("[Patent Detail] Update claim error:", err)
      alert(err instanceof Error ? err.message : "Failed to update claim")
    } finally {
      setIsSaving(false)
    }
  }

  const handleRemoveClaim = async (claimId: string) => {
    if (!patent) return
    if (!confirm("Remove this claim?")) return

    try {
      setIsSaving(true)
      const response = await fetch(`/api/patents/${patent.id}/claims?claimId=${claimId}`, {
        method: "DELETE"
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete claim")
      }

      await loadPatent()
    } catch (err) {
      console.error("[Patent Detail] Delete claim error:", err)
      alert(err instanceof Error ? err.message : "Failed to delete claim")
    } finally {
      setIsSaving(false)
    }
  }

  // Attorney handlers - managed locally since full attorney API isn't implemented
  const handleAddAttorney = () => {
    if (!patent || !attorneyForm.name) return
    const newAttorney: PatentAttorney = {
      id: `attorney-${Date.now()}`,
      name: attorneyForm.name,
      firm: attorneyForm.firm,
      email: attorneyForm.email,
      phone: attorneyForm.phone,
      specializations: attorneyForm.specializations || [],
      notes: attorneyForm.notes,
      rating: attorneyForm.rating,
      contacted: false
    }

    setPatent(prev => prev ? {
      ...prev,
      attorneys: [...(prev.attorneys || []), newAttorney]
    } : null)

    setAttorneyForm({})
    setShowAddAttorney(false)
  }

  const handleSelectAttorney = (attorneyId: string) => {
    if (!patent) return
    const newSelection = patent.selectedAttorneyId === attorneyId ? undefined : attorneyId
    setPatent(prev => prev ? { ...prev, selectedAttorneyId: newSelection } : null)
  }

  const handleMarkContacted = (attorneyId: string) => {
    if (!patent) return
    setPatent(prev => prev ? {
      ...prev,
      attorneys: (prev.attorneys || []).map(a =>
        a.id === attorneyId ? { ...a, contacted: true, contactedAt: new Date().toISOString() } : a
      )
    } : null)
  }

  const handleRemoveAttorney = (attorneyId: string) => {
    if (!patent) return
    if (!confirm("Remove this attorney?")) return
    setPatent(prev => prev ? {
      ...prev,
      attorneys: (prev.attorneys || []).filter(a => a.id !== attorneyId),
      selectedAttorneyId: prev.selectedAttorneyId === attorneyId ? undefined : prev.selectedAttorneyId
    } : null)
  }

  // Generate content using LLM API
  const handleGenerate = async (type: string) => {
    if (!patent) return

    setIsSaving(true)
    try {
      const response = await fetch("/api/patents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patentId: patent.id,
          type,
          context: {
            title: patent.title,
            summary: patent.inventionDescription?.summary,
            technicalField: patent.inventionDescription?.technicalField,
            priorArt: patent.priorArt,
            claims: patent.claims
          }
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate content")
      }

      // Reload patent to get updated data
      await loadPatent()
    } catch (err) {
      console.error("[Patent Detail] Generate error:", err)
      alert(err instanceof Error ? err.message : "Failed to generate content")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !patent) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-lg font-medium">{error || "Patent not found"}</p>
        <div className="flex gap-2">
          <Button onClick={loadPatent} variant="outline">
            Retry
          </Button>
          <Button asChild>
            <Link href="/patents">Back to Patents</Link>
          </Button>
        </div>
      </div>
    )
  }

  const statusConf = statusConfig[patent.status]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/patents">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>

          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <Input
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  className="text-xl font-semibold"
                  autoFocus
                />
                <Button size="icon" variant="ghost" onClick={handleSaveTitle} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setEditingTitle(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold truncate">{patent.title}</h1>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => setEditingTitle(true)}
                >
                  <Edit className="h-3 w-3" />
                </Button>
              </div>
            )}

            <div className="flex items-center gap-2 mt-1">
              <Badge className={cn("gap-1", statusConf.color, statusConf.bgColor)}>
                {statusConf.label}
              </Badge>
              {patent.projectId && (
                <Link
                  href={`/projects/${patent.projectId}`}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:underline"
                >
                  <FolderOpen className="h-3 w-3" />
                  Linked Project
                </Link>
              )}
              {patent.businessIdeaId && (
                <Link
                  href={`/business-ideas/${patent.businessIdeaId}`}
                  className="flex items-center gap-1 text-xs text-yellow-400 hover:underline"
                >
                  <Lightbulb className="h-3 w-3" />
                  Business Idea
                </Link>
              )}
              {isSaving && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving...
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Status Dropdown */}
            <select
              value={patent.status}
              onChange={(e) => handleStatusChange(e.target.value as PatentResearchStatus)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              disabled={isSaving}
            >
              <option value="research">Research</option>
              <option value="drafting">Drafting</option>
              <option value="review">Review</option>
              <option value="filed">Filed</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>

            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content with Tabs */}
      <div className="flex-1 overflow-auto p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-4xl grid-cols-7">
            <TabsTrigger value="invention" className="gap-2">
              <FileCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Invention</span>
            </TabsTrigger>
            <TabsTrigger value="priorart" className="gap-2">
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Prior Art</span>
            </TabsTrigger>
            <TabsTrigger value="analysis" className="gap-2">
              <Scale className="h-4 w-4" />
              <span className="hidden sm:inline">Analysis</span>
            </TabsTrigger>
            <TabsTrigger value="claims" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Claims</span>
            </TabsTrigger>
            <TabsTrigger value="filing" className="gap-2">
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Filing</span>
            </TabsTrigger>
            <TabsTrigger value="attorneys" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Attorneys</span>
            </TabsTrigger>
            <TabsTrigger value="referrals" className="gap-2">
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">Referrals</span>
            </TabsTrigger>
          </TabsList>

          {/* Invention Description Tab */}
          <TabsContent value="invention" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileCheck className="h-5 w-5" />
                      Invention Description
                    </CardTitle>
                    <CardDescription>
                      Describe your invention in detail to help prepare the patent application
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleGenerate("description")}
                    disabled={isSaving}
                    className="gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    AI Enhance
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="summary">Summary</Label>
                  <Textarea
                    id="summary"
                    placeholder="Brief summary of the invention..."
                    value={patent.inventionDescription?.summary || ""}
                    onChange={(e) => handleUpdateDescription("summary", e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="technicalField">Technical Field</Label>
                  <Input
                    id="technicalField"
                    placeholder="e.g., Computer Software, Medical Devices, etc."
                    value={patent.inventionDescription?.technicalField || ""}
                    onChange={(e) => handleUpdateDescription("technicalField", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="background">Background / Prior Art Context</Label>
                  <Textarea
                    id="background"
                    placeholder="Describe the current state of technology and limitations..."
                    value={patent.inventionDescription?.background || ""}
                    onChange={(e) => handleUpdateDescription("background", e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="problemSolved">Problem Solved</Label>
                  <Textarea
                    id="problemSolved"
                    placeholder="What specific problem does your invention solve?"
                    value={patent.inventionDescription?.problemSolved || ""}
                    onChange={(e) => handleUpdateDescription("problemSolved", e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="solutionDescription">Solution Description</Label>
                  <Textarea
                    id="solutionDescription"
                    placeholder="How does your invention solve the problem?"
                    value={patent.inventionDescription?.solutionDescription || ""}
                    onChange={(e) => handleUpdateDescription("solutionDescription", e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Advantages</Label>
                  <div className="space-y-2">
                    {(patent.inventionDescription?.advantages || []).map((advantage, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          value={advantage}
                          onChange={(e) => {
                            const newAdvantages = [...(patent.inventionDescription?.advantages || [])]
                            newAdvantages[index] = e.target.value
                            handleUpdateDescription("advantages", newAdvantages)
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const newAdvantages = (patent.inventionDescription?.advantages || []).filter((_, i) => i !== index)
                            handleUpdateDescription("advantages", newAdvantages)
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newAdvantages = [...(patent.inventionDescription?.advantages || []), ""]
                        handleUpdateDescription("advantages", newAdvantages)
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Advantage
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Prior Art Tab */}
          <TabsContent value="priorart" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Search className="h-5 w-5" />
                      Prior Art Search
                    </CardTitle>
                    <CardDescription>
                      Document existing patents and publications related to your invention
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerate("priorart")}
                      disabled={isSaving}
                      className="gap-2"
                    >
                      <Sparkles className="h-4 w-4" />
                      AI Search
                    </Button>
                    <Button onClick={() => setShowAddPriorArt(true)} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add Prior Art
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Prior Art List */}
                {(!patent.priorArt || patent.priorArt.length === 0) ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No prior art documented yet</p>
                    <p className="text-sm">Add references to existing patents and publications</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {patent.priorArt.map((art) => (
                      <Card key={art.id} className="bg-muted/30">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{art.title}</h4>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    art.relevance === "high" && "text-red-400 border-red-400/30",
                                    art.relevance === "medium" && "text-yellow-400 border-yellow-400/30",
                                    art.relevance === "low" && "text-green-400 border-green-400/30"
                                  )}
                                >
                                  {art.relevance} relevance
                                </Badge>
                              </div>
                              {art.patentNumber && (
                                <p className="text-sm text-muted-foreground">
                                  Patent #: {art.patentNumber}
                                </p>
                              )}
                              {art.inventor && (
                                <p className="text-sm text-muted-foreground">
                                  Inventor: {art.inventor}
                                </p>
                              )}
                              {art.abstract && (
                                <p className="text-sm mt-2">{art.abstract}</p>
                              )}
                              {art.notes && (
                                <p className="text-sm text-muted-foreground italic">
                                  Notes: {art.notes}
                                </p>
                              )}
                              {art.url && (
                                <a
                                  href={art.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-400 hover:underline flex items-center gap-1"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  View Source
                                </a>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-400"
                              onClick={() => handleRemovePriorArt(art.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Add Prior Art Form */}
                {showAddPriorArt && (
                  <Card className="border-primary">
                    <CardHeader>
                      <CardTitle className="text-lg">Add Prior Art Reference</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Title *</Label>
                          <Input
                            value={priorArtForm.title || ""}
                            onChange={(e) => setPriorArtForm({ ...priorArtForm, title: e.target.value })}
                            placeholder="Patent or publication title"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Patent Number</Label>
                          <Input
                            value={priorArtForm.patentNumber || ""}
                            onChange={(e) => setPriorArtForm({ ...priorArtForm, patentNumber: e.target.value })}
                            placeholder="e.g., US10,123,456"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Inventor</Label>
                          <Input
                            value={priorArtForm.inventor || ""}
                            onChange={(e) => setPriorArtForm({ ...priorArtForm, inventor: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>URL</Label>
                          <Input
                            value={priorArtForm.url || ""}
                            onChange={(e) => setPriorArtForm({ ...priorArtForm, url: e.target.value })}
                            placeholder="https://..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Relevance</Label>
                          <select
                            value={priorArtForm.relevance || "medium"}
                            onChange={(e) => setPriorArtForm({ ...priorArtForm, relevance: e.target.value as "low" | "medium" | "high" })}
                            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Abstract / Summary</Label>
                        <Textarea
                          value={priorArtForm.abstract || ""}
                          onChange={(e) => setPriorArtForm({ ...priorArtForm, abstract: e.target.value })}
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Notes</Label>
                        <Textarea
                          value={priorArtForm.notes || ""}
                          onChange={(e) => setPriorArtForm({ ...priorArtForm, notes: e.target.value })}
                          placeholder="How does this relate to your invention?"
                          rows={2}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowAddPriorArt(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleAddPriorArt} disabled={isSaving}>
                          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Add Prior Art
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Patentability Analysis Tab */}
          <TabsContent value="analysis" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Scale className="h-5 w-5" />
                      Patentability Analysis
                    </CardTitle>
                    <CardDescription>
                      Assess whether your invention meets the criteria for patent protection
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => handleGenerate("analysis")}
                    disabled={isSaving}
                    className="gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    {patent.patentabilityAnalysis ? "Re-analyze" : "Run Analysis"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {patent.patentabilityAnalysis ? (
                  <>
                    <div className="flex items-center gap-4">
                      <Badge
                        className={cn(
                          "text-lg px-4 py-2",
                          patent.patentabilityAnalysis.overallAssessment === "strong" && "bg-green-500/20 text-green-400",
                          patent.patentabilityAnalysis.overallAssessment === "moderate" && "bg-yellow-500/20 text-yellow-400",
                          patent.patentabilityAnalysis.overallAssessment === "weak" && "bg-orange-500/20 text-orange-400",
                          patent.patentabilityAnalysis.overallAssessment === "not-patentable" && "bg-red-500/20 text-red-400"
                        )}
                      >
                        Overall Assessment: {patent.patentabilityAnalysis.overallAssessment.replace("-", " ")}
                      </Badge>
                      {patent.patentabilityAnalysis.analyzedAt && (
                        <span className="text-sm text-muted-foreground">
                          Analyzed on {new Date(patent.patentabilityAnalysis.analyzedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-base font-semibold">Novelty Assessment</Label>
                        <p className="text-sm text-muted-foreground">
                          {patent.patentabilityAnalysis.noveltyAssessment || "Not assessed"}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-base font-semibold">Non-Obviousness Assessment</Label>
                        <p className="text-sm text-muted-foreground">
                          {patent.patentabilityAnalysis.nonObviousnessAssessment || "Not assessed"}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-base font-semibold">Utility Assessment</Label>
                        <p className="text-sm text-muted-foreground">
                          {patent.patentabilityAnalysis.utilityAssessment || "Not assessed"}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-base font-semibold">Patentable Subject Matter</Label>
                        <p className="text-sm text-muted-foreground">
                          {patent.patentabilityAnalysis.patentableSubjectMatter || "Not assessed"}
                        </p>
                      </div>
                    </div>

                    {patent.patentabilityAnalysis.recommendations && patent.patentabilityAnalysis.recommendations.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-base font-semibold">Recommendations</Label>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                          {patent.patentabilityAnalysis.recommendations.map((rec, i) => (
                            <li key={i}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <Scale className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-lg font-medium">No analysis yet</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Complete the invention description and prior art search first, then run the AI analysis
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Claims Tab */}
          <TabsContent value="claims" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Patent Claims
                    </CardTitle>
                    <CardDescription>
                      Draft the claims that define the scope of your patent protection
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerate("claims")}
                      disabled={isSaving}
                      className="gap-2"
                    >
                      <Sparkles className="h-4 w-4" />
                      AI Draft
                    </Button>
                    <Button onClick={() => setShowAddClaim(true)} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add Claim
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {(!patent.claims || patent.claims.length === 0) ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No claims drafted yet</p>
                    <p className="text-sm">Start with independent claims, then add dependent claims</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {patent.claims
                      .sort((a, b) => a.number - b.number)
                      .map((claim) => (
                        <Card key={claim.id} className="bg-muted/30">
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">Claim {claim.number}</Badge>
                                  <Badge
                                    variant="outline"
                                    className={claim.type === "independent" ? "text-blue-400" : "text-purple-400"}
                                  >
                                    {claim.type}
                                  </Badge>
                                  {claim.dependsOn && (
                                    <span className="text-sm text-muted-foreground">
                                      (depends on claim {claim.dependsOn})
                                    </span>
                                  )}
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      claim.status === "approved" && "text-green-400 border-green-400/30",
                                      claim.status === "reviewed" && "text-yellow-400 border-yellow-400/30",
                                      claim.status === "draft" && "text-gray-400 border-gray-400/30"
                                    )}
                                  >
                                    {claim.status}
                                  </Badge>
                                </div>
                                <p className="text-sm whitespace-pre-wrap">{claim.text}</p>
                                {claim.notes && (
                                  <p className="text-sm text-muted-foreground italic">
                                    Notes: {claim.notes}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col gap-1">
                                <select
                                  value={claim.status}
                                  onChange={(e) => handleUpdateClaimStatus(claim.id, e.target.value as PatentResearchClaim["status"])}
                                  className="text-xs rounded border px-2 py-1"
                                  disabled={isSaving}
                                >
                                  <option value="draft">Draft</option>
                                  <option value="reviewed">Reviewed</option>
                                  <option value="approved">Approved</option>
                                </select>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-400"
                                  onClick={() => handleRemoveClaim(claim.id)}
                                  disabled={isSaving}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                )}

                {/* Add Claim Form */}
                {showAddClaim && (
                  <Card className="border-primary">
                    <CardHeader>
                      <CardTitle className="text-lg">Add Claim</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Claim Type</Label>
                          <select
                            value={claimForm.type || "independent"}
                            onChange={(e) => setClaimForm({ ...claimForm, type: e.target.value as "independent" | "dependent" })}
                            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                          >
                            <option value="independent">Independent</option>
                            <option value="dependent">Dependent</option>
                          </select>
                        </div>
                        {claimForm.type === "dependent" && (
                          <div className="space-y-2">
                            <Label>Depends On Claim #</Label>
                            <Input
                              type="number"
                              min={1}
                              value={claimForm.dependsOn || ""}
                              onChange={(e) => setClaimForm({ ...claimForm, dependsOn: parseInt(e.target.value) || undefined })}
                            />
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Claim Text *</Label>
                        <Textarea
                          value={claimForm.text || ""}
                          onChange={(e) => setClaimForm({ ...claimForm, text: e.target.value })}
                          placeholder="What is claimed is..."
                          rows={4}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Notes</Label>
                        <Textarea
                          value={claimForm.notes || ""}
                          onChange={(e) => setClaimForm({ ...claimForm, notes: e.target.value })}
                          placeholder="Internal notes about this claim..."
                          rows={2}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowAddClaim(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleAddClaim} disabled={isSaving}>
                          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Add Claim
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Filing Tab */}
          <TabsContent value="filing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Filing Assistance
                </CardTitle>
                <CardDescription>
                  Prepare and track your patent application filing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Target Filing Date</Label>
                    <Input
                      type="date"
                      value={patent.targetFilingDate || ""}
                      onChange={(e) => updatePatentApi({ targetFilingDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Estimated Cost</Label>
                    <Input
                      value={patent.estimatedCost || ""}
                      onChange={(e) => updatePatentApi({ estimatedCost: e.target.value })}
                      placeholder="e.g., $5,000 - $15,000"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Filing Notes</Label>
                  <Textarea
                    value={patent.notes || ""}
                    onChange={(e) => updatePatentApi({ notes: e.target.value })}
                    placeholder="Notes about the filing process..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attorneys Tab */}
          <TabsContent value="attorneys" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Attorney Contacts
                    </CardTitle>
                    <CardDescription>
                      Track patent attorneys and their contact information
                    </CardDescription>
                  </div>
                  <Button onClick={() => setShowAddAttorney(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Attorney
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {(!patent.attorneys || patent.attorneys.length === 0) ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No attorneys added yet</p>
                    <p className="text-sm">Add patent attorneys to contact for your application</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {patent.attorneys.map((attorney) => (
                      <Card
                        key={attorney.id}
                        className={cn(
                          "bg-muted/30",
                          patent.selectedAttorneyId === attorney.id && "border-primary"
                        )}
                      >
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{attorney.name}</h4>
                                {patent.selectedAttorneyId === attorney.id && (
                                  <Badge className="bg-primary/20 text-primary">Selected</Badge>
                                )}
                                {attorney.contacted && (
                                  <Badge variant="outline" className="text-green-400 border-green-400/30">
                                    Contacted
                                  </Badge>
                                )}
                              </div>
                              {attorney.firm && (
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Building className="h-3 w-3" />
                                  {attorney.firm}
                                </p>
                              )}
                              {attorney.email && (
                                <a
                                  href={`mailto:${attorney.email}`}
                                  className="text-sm text-blue-400 hover:underline flex items-center gap-1"
                                >
                                  <Mail className="h-3 w-3" />
                                  {attorney.email}
                                </a>
                              )}
                              {attorney.phone && (
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {attorney.phone}
                                </p>
                              )}
                              {attorney.specializations && attorney.specializations.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {attorney.specializations.map((spec) => (
                                    <Badge key={spec} variant="outline" className="text-xs">
                                      {spec}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              {attorney.rating && (
                                <div className="flex items-center gap-1 mt-2">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <Star
                                      key={i}
                                      className={cn(
                                        "h-4 w-4",
                                        i < attorney.rating!
                                          ? "text-yellow-400 fill-yellow-400"
                                          : "text-gray-400"
                                      )}
                                    />
                                  ))}
                                </div>
                              )}
                              {attorney.notes && (
                                <p className="text-sm text-muted-foreground italic mt-2">
                                  {attorney.notes}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSelectAttorney(attorney.id)}
                                className={patent.selectedAttorneyId === attorney.id ? "text-primary" : ""}
                              >
                                {patent.selectedAttorneyId === attorney.id ? "Deselect" : "Select"}
                              </Button>
                              {!attorney.contacted && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleMarkContacted(attorney.id)}
                                >
                                  Mark Contacted
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-400"
                                onClick={() => handleRemoveAttorney(attorney.id)}
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Add Attorney Form */}
                {showAddAttorney && (
                  <Card className="border-primary">
                    <CardHeader>
                      <CardTitle className="text-lg">Add Attorney</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Name *</Label>
                          <Input
                            value={attorneyForm.name || ""}
                            onChange={(e) => setAttorneyForm({ ...attorneyForm, name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Firm</Label>
                          <Input
                            value={attorneyForm.firm || ""}
                            onChange={(e) => setAttorneyForm({ ...attorneyForm, firm: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input
                            type="email"
                            value={attorneyForm.email || ""}
                            onChange={(e) => setAttorneyForm({ ...attorneyForm, email: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Phone</Label>
                          <Input
                            value={attorneyForm.phone || ""}
                            onChange={(e) => setAttorneyForm({ ...attorneyForm, phone: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Specializations (comma-separated)</Label>
                        <Input
                          value={(attorneyForm.specializations || []).join(", ")}
                          onChange={(e) =>
                            setAttorneyForm({
                              ...attorneyForm,
                              specializations: e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                            })
                          }
                          placeholder="e.g., Software Patents, Medical Devices"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Notes</Label>
                        <Textarea
                          value={attorneyForm.notes || ""}
                          onChange={(e) => setAttorneyForm({ ...attorneyForm, notes: e.target.value })}
                          rows={2}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowAddAttorney(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleAddAttorney}>Add Attorney</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Referrals Tab - Attorney Referral System with Commission Tracking */}
          <TabsContent value="referrals" className="space-y-6">
            <AttorneyReferrals
              patentId={patent.id}
              patentTitle={patent.title}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
