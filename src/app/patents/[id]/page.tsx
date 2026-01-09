"use client"

import { useState, useEffect } from "react"
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
  Save,
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
  Clock,
  AlertCircle,
  Lightbulb,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Briefcase
} from "lucide-react"
import { AttorneyReferrals } from "@/components/patents/attorney-referrals"
import {
  getPatent,
  updatePatent,
  deletePatent,
  addPriorArt,
  updatePriorArt,
  removePriorArt,
  addClaim,
  updateClaim,
  removeClaim,
  addAttorney,
  updateAttorney,
  removeAttorney,
  selectAttorney,
  markAttorneyContacted,
  updateInventionDescription,
  updatePatentabilityAnalysis,
  updateFiling,
  completePriorArtSearch,
  type PatentResearch
} from "@/lib/data/patents"
import type { PatentResearchStatus, PatentPriorArt, PatentResearchClaim, PatentAttorney } from "@/lib/data/types"

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

  // Expanded sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    description: true,
    priorArt: true,
    analysis: true,
    claims: true,
    filing: true,
    attorneys: true
  })

  // Load patent
  useEffect(() => {
    loadPatent()
  }, [patentId])

  const loadPatent = () => {
    setIsLoading(true)
    const p = getPatent(patentId)
    if (p) {
      setPatent(p)
      setTitleValue(p.title)
    }
    setIsLoading(false)
  }

  const handleSaveTitle = () => {
    if (!patent || !titleValue.trim()) return
    const updated = updatePatent(patent.id, { title: titleValue })
    if (updated) setPatent(updated)
    setEditingTitle(false)
  }

  const handleStatusChange = (status: PatentResearchStatus) => {
    if (!patent) return
    const updated = updatePatent(patent.id, { status })
    if (updated) setPatent(updated)
  }

  const handleDelete = () => {
    if (!patent) return
    if (confirm(`Permanently delete "${patent.title}"? This cannot be undone.`)) {
      deletePatent(patent.id)
      router.push("/patents")
    }
  }

  const handleUpdateDescription = (field: string, value: string | string[]) => {
    if (!patent) return
    const updated = updateInventionDescription(patent.id, { [field]: value })
    if (updated) setPatent(updated)
  }

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  // Prior Art handlers
  const handleAddPriorArt = () => {
    if (!patent || !priorArtForm.title) return
    const updated = addPriorArt(patent.id, {
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
    })
    if (updated) {
      setPatent(updated)
      setPriorArtForm({})
      setShowAddPriorArt(false)
    }
  }

  const handleRemovePriorArt = (priorArtId: string) => {
    if (!patent) return
    if (confirm("Remove this prior art reference?")) {
      const updated = removePriorArt(patent.id, priorArtId)
      if (updated) setPatent(updated)
    }
  }

  // Claim handlers
  const handleAddClaim = () => {
    if (!patent || !claimForm.text) return
    const claimNumber = patent.claims.length + 1
    const updated = addClaim(patent.id, {
      number: claimNumber,
      type: claimForm.type || "independent",
      dependsOn: claimForm.dependsOn,
      text: claimForm.text,
      status: "draft",
      notes: claimForm.notes
    })
    if (updated) {
      setPatent(updated)
      setClaimForm({})
      setShowAddClaim(false)
    }
  }

  const handleUpdateClaimStatus = (claimId: string, status: PatentResearchClaim["status"]) => {
    if (!patent) return
    const updated = updateClaim(patent.id, claimId, { status })
    if (updated) setPatent(updated)
  }

  const handleRemoveClaim = (claimId: string) => {
    if (!patent) return
    if (confirm("Remove this claim?")) {
      const updated = removeClaim(patent.id, claimId)
      if (updated) setPatent(updated)
    }
  }

  // Attorney handlers
  const handleAddAttorney = () => {
    if (!patent || !attorneyForm.name) return
    const updated = addAttorney(patent.id, {
      name: attorneyForm.name,
      firm: attorneyForm.firm,
      email: attorneyForm.email,
      phone: attorneyForm.phone,
      specializations: attorneyForm.specializations || [],
      notes: attorneyForm.notes,
      rating: attorneyForm.rating,
      contacted: false
    })
    if (updated) {
      setPatent(updated)
      setAttorneyForm({})
      setShowAddAttorney(false)
    }
  }

  const handleSelectAttorney = (attorneyId: string) => {
    if (!patent) return
    const newSelection = patent.selectedAttorneyId === attorneyId ? undefined : attorneyId
    const updated = selectAttorney(patent.id, newSelection)
    if (updated) setPatent(updated)
  }

  const handleMarkContacted = (attorneyId: string) => {
    if (!patent) return
    const updated = markAttorneyContacted(patent.id, attorneyId)
    if (updated) setPatent(updated)
  }

  const handleRemoveAttorney = (attorneyId: string) => {
    if (!patent) return
    if (confirm("Remove this attorney?")) {
      const updated = removeAttorney(patent.id, attorneyId)
      if (updated) setPatent(updated)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!patent) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">Patent not found</p>
        <Button asChild>
          <Link href="/patents">Back to Patents</Link>
        </Button>
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
                <Button size="icon" variant="ghost" onClick={handleSaveTitle}>
                  <Check className="h-4 w-4" />
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
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Status Dropdown */}
            <select
              value={patent.status}
              onChange={(e) => handleStatusChange(e.target.value as PatentResearchStatus)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
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
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5" />
                  Invention Description
                </CardTitle>
                <CardDescription>
                  Describe your invention in detail to help prepare the patent application
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="summary">Summary</Label>
                  <Textarea
                    id="summary"
                    placeholder="Brief summary of the invention..."
                    value={patent.inventionDescription.summary}
                    onChange={(e) => handleUpdateDescription("summary", e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="technicalField">Technical Field</Label>
                  <Input
                    id="technicalField"
                    placeholder="e.g., Computer Software, Medical Devices, etc."
                    value={patent.inventionDescription.technicalField || ""}
                    onChange={(e) => handleUpdateDescription("technicalField", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="background">Background / Prior Art Context</Label>
                  <Textarea
                    id="background"
                    placeholder="Describe the current state of technology and limitations..."
                    value={patent.inventionDescription.background || ""}
                    onChange={(e) => handleUpdateDescription("background", e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="problemSolved">Problem Solved</Label>
                  <Textarea
                    id="problemSolved"
                    placeholder="What specific problem does your invention solve?"
                    value={patent.inventionDescription.problemSolved || ""}
                    onChange={(e) => handleUpdateDescription("problemSolved", e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="solutionDescription">Solution Description</Label>
                  <Textarea
                    id="solutionDescription"
                    placeholder="How does your invention solve the problem?"
                    value={patent.inventionDescription.solutionDescription || ""}
                    onChange={(e) => handleUpdateDescription("solutionDescription", e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Advantages</Label>
                  <div className="space-y-2">
                    {(patent.inventionDescription.advantages || []).map((advantage, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          value={advantage}
                          onChange={(e) => {
                            const newAdvantages = [...(patent.inventionDescription.advantages || [])]
                            newAdvantages[index] = e.target.value
                            handleUpdateDescription("advantages", newAdvantages)
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const newAdvantages = (patent.inventionDescription.advantages || []).filter((_, i) => i !== index)
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
                        const newAdvantages = [...(patent.inventionDescription.advantages || []), ""]
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
                  <Button onClick={() => setShowAddPriorArt(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Prior Art
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search Notes */}
                <div className="space-y-2">
                  <Label>Search Notes</Label>
                  <Textarea
                    placeholder="Document your prior art search methodology and findings..."
                    value={patent.priorArtSearchNotes || ""}
                    onChange={(e) => updatePatent(patent.id, { priorArtSearchNotes: e.target.value })}
                    rows={3}
                  />
                </div>

                {patent.priorArtSearchCompletedAt && (
                  <div className="flex items-center gap-2 text-sm text-green-500">
                    <Check className="h-4 w-4" />
                    Search completed on {new Date(patent.priorArtSearchCompletedAt).toLocaleDateString()}
                  </div>
                )}

                {!patent.priorArtSearchCompletedAt && patent.priorArt.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const updated = completePriorArtSearch(patent.id, patent.priorArtSearchNotes)
                      if (updated) setPatent(updated)
                    }}
                  >
                    Mark Search as Complete
                  </Button>
                )}

                {/* Prior Art List */}
                {patent.priorArt.length === 0 ? (
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
                              {art.assignee && (
                                <p className="text-sm text-muted-foreground">
                                  Assignee: {art.assignee}
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
                          <Label>Assignee</Label>
                          <Input
                            value={priorArtForm.assignee || ""}
                            onChange={(e) => setPriorArtForm({ ...priorArtForm, assignee: e.target.value })}
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
                        <Button onClick={handleAddPriorArt}>Add Prior Art</Button>
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
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  Patentability Analysis
                </CardTitle>
                <CardDescription>
                  Assess whether your invention meets the criteria for patent protection
                </CardDescription>
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
                      <span className="text-sm text-muted-foreground">
                        Analyzed on {new Date(patent.patentabilityAnalysis.analyzedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-base font-semibold">Novelty Assessment</Label>
                        <p className="text-sm text-muted-foreground">
                          {patent.patentabilityAnalysis.noveltyAssessment}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-base font-semibold">Non-Obviousness Assessment</Label>
                        <p className="text-sm text-muted-foreground">
                          {patent.patentabilityAnalysis.nonObviousnessAssessment}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-base font-semibold">Utility Assessment</Label>
                        <p className="text-sm text-muted-foreground">
                          {patent.patentabilityAnalysis.utilityAssessment}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-base font-semibold">Patentable Subject Matter</Label>
                        <p className="text-sm text-muted-foreground">
                          {patent.patentabilityAnalysis.patentableSubjectMatter}
                        </p>
                      </div>
                    </div>

                    {patent.patentabilityAnalysis.recommendations.length > 0 && (
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
                      Complete the invention description and prior art search first
                    </p>
                    <Button
                      onClick={() => {
                        // Create a placeholder analysis
                        const analysis = {
                          noveltyAssessment: "",
                          nonObviousnessAssessment: "",
                          utilityAssessment: "",
                          patentableSubjectMatter: "",
                          overallAssessment: "undetermined" as const,
                          recommendations: [],
                          analyzedAt: new Date().toISOString()
                        }
                        const updated = updatePatentabilityAnalysis(patent.id, analysis as PatentResearch["patentabilityAnalysis"])
                        if (updated) setPatent(updated)
                      }}
                    >
                      Start Analysis
                    </Button>
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
                  <Button onClick={() => setShowAddClaim(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Claim
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Claims Draft Notes</Label>
                  <Textarea
                    placeholder="Notes about your claims strategy..."
                    value={patent.claimsDraftNotes || ""}
                    onChange={(e) => updatePatent(patent.id, { claimsDraftNotes: e.target.value })}
                    rows={2}
                  />
                </div>

                {patent.claims.length === 0 ? (
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
                        <Button onClick={handleAddClaim}>Add Claim</Button>
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
                    <Label>Filing Type</Label>
                    <select
                      value={patent.filing?.type || ""}
                      onChange={(e) => {
                        const updated = updateFiling(patent.id, {
                          ...patent.filing,
                          type: e.target.value as NonNullable<PatentResearch["filing"]>["type"],
                          jurisdiction: patent.filing?.jurisdiction || "US",
                          inventors: patent.filing?.inventors || [],
                          status: patent.filing?.status || "preparing"
                        })
                        if (updated) setPatent(updated)
                      }}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Select type...</option>
                      <option value="provisional">Provisional</option>
                      <option value="non-provisional">Non-Provisional</option>
                      <option value="pct">PCT (International)</option>
                      <option value="continuation">Continuation</option>
                      <option value="divisional">Divisional</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Jurisdiction</Label>
                    <select
                      value={patent.filing?.jurisdiction || "US"}
                      onChange={(e) => {
                        const updated = updateFiling(patent.id, {
                          ...patent.filing,
                          type: patent.filing?.type || "provisional",
                          jurisdiction: e.target.value,
                          inventors: patent.filing?.inventors || [],
                          status: patent.filing?.status || "preparing"
                        })
                        if (updated) setPatent(updated)
                      }}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="US">United States</option>
                      <option value="EU">European Union</option>
                      <option value="PCT">PCT (International)</option>
                      <option value="CN">China</option>
                      <option value="JP">Japan</option>
                      <option value="KR">South Korea</option>
                      <option value="CA">Canada</option>
                      <option value="AU">Australia</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Application Number</Label>
                    <Input
                      value={patent.filing?.applicationNumber || ""}
                      onChange={(e) => {
                        const updated = updateFiling(patent.id, {
                          ...patent.filing,
                          type: patent.filing?.type || "provisional",
                          jurisdiction: patent.filing?.jurisdiction || "US",
                          applicationNumber: e.target.value,
                          inventors: patent.filing?.inventors || [],
                          status: patent.filing?.status || "preparing"
                        })
                        if (updated) setPatent(updated)
                      }}
                      placeholder="Assigned after filing"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Filing Status</Label>
                    <select
                      value={patent.filing?.status || "preparing"}
                      onChange={(e) => {
                        const updated = updateFiling(patent.id, {
                          ...patent.filing,
                          type: patent.filing?.type || "provisional",
                          jurisdiction: patent.filing?.jurisdiction || "US",
                          inventors: patent.filing?.inventors || [],
                          status: e.target.value as NonNullable<PatentResearch["filing"]>["status"]
                        })
                        if (updated) setPatent(updated)
                      }}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="preparing">Preparing</option>
                      <option value="filed">Filed</option>
                      <option value="pending">Pending</option>
                      <option value="granted">Granted</option>
                      <option value="abandoned">Abandoned</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Target Filing Date</Label>
                    <Input
                      type="date"
                      value={patent.targetFilingDate || ""}
                      onChange={(e) => {
                        const updated = updatePatent(patent.id, { targetFilingDate: e.target.value })
                        if (updated) setPatent(updated)
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Estimated Cost</Label>
                    <Input
                      value={patent.estimatedCost || ""}
                      onChange={(e) => {
                        const updated = updatePatent(patent.id, { estimatedCost: e.target.value })
                        if (updated) setPatent(updated)
                      }}
                      placeholder="e.g., $5,000 - $15,000"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Filing Notes</Label>
                  <Textarea
                    value={patent.filing?.notes || ""}
                    onChange={(e) => {
                      const updated = updateFiling(patent.id, {
                        ...patent.filing,
                        type: patent.filing?.type || "provisional",
                        jurisdiction: patent.filing?.jurisdiction || "US",
                        inventors: patent.filing?.inventors || [],
                        status: patent.filing?.status || "preparing",
                        notes: e.target.value
                      })
                      if (updated) setPatent(updated)
                    }}
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
                      Attorney Referrals
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
                {patent.attorneys.length === 0 ? (
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
                              {attorney.specializations.length > 0 && (
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
