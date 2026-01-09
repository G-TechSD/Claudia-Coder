"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  Check,
  X,
  Edit3,
  Rocket,
  Target,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Save
} from "lucide-react"

export interface ProjectProposalData {
  name: string
  description: string
  type: "web_app" | "mobile_app" | "api" | "saas" | "marketplace" | "tool" | "other"
  keyFeatures: string[]
  targetAudience?: string
  monetizationStrategy?: string
  estimatedComplexity?: "low" | "medium" | "high"
  suggestedTechStack?: string[]
}

interface ProjectProposalProps {
  proposal: ProjectProposalData
  onApprove: (project: ProjectProposalData) => void
  onDeny: () => void
  onEdit?: (editedProject: ProjectProposalData) => void
}

const projectTypeLabels: Record<ProjectProposalData["type"], string> = {
  web_app: "Web Application",
  mobile_app: "Mobile App",
  api: "API / Backend",
  saas: "SaaS Product",
  marketplace: "Marketplace",
  tool: "Developer Tool",
  other: "Other"
}

const projectTypeColors: Record<ProjectProposalData["type"], string> = {
  web_app: "bg-blue-500/20 text-blue-400",
  mobile_app: "bg-purple-500/20 text-purple-400",
  api: "bg-green-500/20 text-green-400",
  saas: "bg-orange-500/20 text-orange-400",
  marketplace: "bg-pink-500/20 text-pink-400",
  tool: "bg-cyan-500/20 text-cyan-400",
  other: "bg-gray-500/20 text-gray-400"
}

const complexityColors: Record<string, string> = {
  low: "bg-green-500/20 text-green-400",
  medium: "bg-yellow-500/20 text-yellow-400",
  high: "bg-red-500/20 text-red-400"
}

export function ProjectProposal({ proposal, onApprove, onDeny, onEdit }: ProjectProposalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedProposal, setEditedProposal] = useState<ProjectProposalData>(proposal)
  const [showDetails, setShowDetails] = useState(true)

  const handleSaveEdit = () => {
    setIsEditing(false)
    onEdit?.(editedProposal)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedProposal(proposal)
  }

  const updateFeature = (index: number, value: string) => {
    const newFeatures = [...editedProposal.keyFeatures]
    newFeatures[index] = value
    setEditedProposal({ ...editedProposal, keyFeatures: newFeatures })
  }

  const addFeature = () => {
    setEditedProposal({
      ...editedProposal,
      keyFeatures: [...editedProposal.keyFeatures, ""]
    })
  }

  const removeFeature = (index: number) => {
    setEditedProposal({
      ...editedProposal,
      keyFeatures: editedProposal.keyFeatures.filter((_, i) => i !== index)
    })
  }

  if (isEditing) {
    return (
      <Card className="border-primary/50 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Edit3 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Edit Project Proposal</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Project Name</Label>
            <Input
              id="name"
              value={editedProposal.name}
              onChange={(e) => setEditedProposal({ ...editedProposal, name: e.target.value })}
              placeholder="Enter project name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={editedProposal.description}
              onChange={(e) => setEditedProposal({ ...editedProposal, description: e.target.value })}
              placeholder="Describe the project"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Project Type</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(projectTypeLabels).map(([value, label]) => (
                <Button
                  key={value}
                  variant={editedProposal.type === value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEditedProposal({ ...editedProposal, type: value as ProjectProposalData["type"] })}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Key Features</Label>
            <div className="space-y-2">
              {editedProposal.keyFeatures.map((feature, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={feature}
                    onChange={(e) => updateFeature(index, e.target.value)}
                    placeholder={`Feature ${index + 1}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFeature(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addFeature}>
                + Add Feature
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="audience">Target Audience</Label>
            <Input
              id="audience"
              value={editedProposal.targetAudience || ""}
              onChange={(e) => setEditedProposal({ ...editedProposal, targetAudience: e.target.value })}
              placeholder="Who is this for?"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="monetization">Monetization Strategy</Label>
            <Input
              id="monetization"
              value={editedProposal.monetizationStrategy || ""}
              onChange={(e) => setEditedProposal({ ...editedProposal, monetizationStrategy: e.target.value })}
              placeholder="How will this make money?"
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleCancelEdit}>
            Cancel
          </Button>
          <Button onClick={handleSaveEdit}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="border-green-500/50 bg-green-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center">
              <Rocket className="h-4 w-4 text-green-400" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {proposal.name}
                <Badge className={cn("ml-2", projectTypeColors[proposal.type])}>
                  {projectTypeLabels[proposal.type]}
                </Badge>
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Sparkles className="h-3 w-3" />
                AI-Generated Project Proposal
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      {showDetails && (
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{proposal.description}</p>

          {/* Key Features */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Layers className="h-4 w-4 text-primary" />
              Key Features
            </div>
            <ul className="space-y-1 pl-6">
              {proposal.keyFeatures.map((feature, index) => (
                <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Target Audience */}
          {proposal.targetAudience && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Target className="h-4 w-4 text-primary" />
                Target Audience
              </div>
              <p className="text-sm text-muted-foreground pl-6">
                {proposal.targetAudience}
              </p>
            </div>
          )}

          {/* Monetization */}
          {proposal.monetizationStrategy && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-primary" />
                Monetization Strategy
              </div>
              <p className="text-sm text-muted-foreground pl-6">
                {proposal.monetizationStrategy}
              </p>
            </div>
          )}

          {/* Metadata Row */}
          <div className="flex flex-wrap gap-2 pt-2">
            {proposal.estimatedComplexity && (
              <Badge className={complexityColors[proposal.estimatedComplexity]}>
                {proposal.estimatedComplexity.charAt(0).toUpperCase() + proposal.estimatedComplexity.slice(1)} Complexity
              </Badge>
            )}
            {proposal.suggestedTechStack?.map((tech, i) => (
              <Badge key={i} variant="outline">
                {tech}
              </Badge>
            ))}
          </div>
        </CardContent>
      )}

      <CardFooter className="flex justify-between gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onDeny}>
          <X className="h-4 w-4 mr-2" />
          Continue Brainstorming
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsEditing(true)}>
            <Edit3 className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button onClick={() => onApprove(proposal)} className="bg-green-600 hover:bg-green-700">
            <Check className="h-4 w-4 mr-2" />
            Approve & Create Project
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
