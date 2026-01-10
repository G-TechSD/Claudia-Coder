"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  Briefcase,
  Code2,
  Rocket,
  Link2,
  Loader2,
  CheckCircle,
  Building2,
  GitBranch
} from "lucide-react"
import { createProject } from "@/lib/data/projects"
import type { Project } from "@/lib/data/types"
import { markIdeaAsConverted, type BusinessIdea } from "@/lib/data/business-ideas"
import { useAuth } from "@/components/auth/auth-provider"

interface ConvertToProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  idea: BusinessIdea
  suggestedType: "business" | "dev" | "both" | null
  onSuccess: (projects: { businessProject?: Project; devProject?: Project }) => void
}

type ProjectType = "business" | "dev" | "both"

export function ConvertToProjectDialog({
  open,
  onOpenChange,
  idea,
  suggestedType,
  onSuccess
}: ConvertToProjectDialogProps) {
  const { user } = useAuth()
  const userId = user?.id
  const [projectType, setProjectType] = useState<ProjectType>(suggestedType || "both")
  const [businessName, setBusinessName] = useState(`${idea.title} - Business`)
  const [devName, setDevName] = useState(`${idea.title} - Dev`)
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    setIsCreating(true)

    try {
      const results: { businessProject?: Project; devProject?: Project } = {}

      // Create business project if needed
      if (projectType === "business" || projectType === "both") {
        const businessProject = createProject({
          name: projectType === "both" ? businessName : idea.title,
          description: idea.executiveSummary || idea.summary,
          status: "planning",
          priority: idea.potential === "very-high" ? "high" :
                    idea.potential === "high" ? "medium" : "low",
          repos: [],
          packetIds: [],
          tags: ["business-planning", "from-business-idea", ...(projectType === "both" ? ["linked-project"] : [])],
          businessDev: {
            id: `bizdev-${Date.now()}`,
            projectId: "", // Will be set after creation
            status: "draft",
            executiveSummary: {
              overview: idea.executiveSummary || idea.summary,
              problem: idea.problemStatement || "",
              solution: idea.valueProposition || "",
              targetMarket: idea.targetAudience || "",
              uniqueValue: idea.competitiveAdvantage || ""
            },
            features: [],
            marketAnalysis: {
              marketSize: "",
              targetAudience: idea.targetAudience || "",
              competitors: [],
              differentiators: [],
              marketTrends: []
            },
            monetization: {
              model: idea.revenueModel || "",
              pricing: "",
              revenueStreams: []
            },
            proForma: {
              yearOneRevenue: "",
              yearTwoRevenue: "",
              yearThreeRevenue: "",
              expenses: [],
              profitMargin: "",
              breakEvenPoint: "",
              assumptions: []
            },
            generatedBy: {
              server: "business-idea-conversion",
              model: "manual"
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        }, userId)
        results.businessProject = businessProject
      }

      // Create dev project if needed
      if (projectType === "dev" || projectType === "both") {
        const devProject = createProject({
          name: projectType === "both" ? devName : idea.title,
          description: idea.executiveSummary || idea.summary,
          status: "planning",
          priority: idea.potential === "very-high" ? "high" :
                    idea.potential === "high" ? "medium" : "low",
          repos: [],
          packetIds: [],
          tags: ["development", "from-business-idea", ...(projectType === "both" ? ["linked-project"] : [])]
        }, userId)
        results.devProject = devProject
      }

      // Mark the idea as converted, linking to the primary project
      const primaryProjectId = results.businessProject?.id || results.devProject?.id
      if (primaryProjectId) {
        markIdeaAsConverted(idea.id, primaryProjectId, userId)
      }

      onSuccess(results)
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to create project(s):", error)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-emerald-500" />
            Convert to Project
          </DialogTitle>
          <DialogDescription>
            Turn "{idea.title}" into an actionable project
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* Suggested badge */}
          {suggestedType && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>AI suggests: </span>
              <Badge variant="secondary" className="capitalize">
                {suggestedType === "both" ? "Business + Dev" : `${suggestedType} Project`}
              </Badge>
            </div>
          )}

          {/* Project Type Selection */}
          <RadioGroup
            value={projectType}
            onValueChange={(v) => setProjectType(v as ProjectType)}
            className="space-y-3"
          >
            {/* Business Project Option */}
            <div className={cn(
              "flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors",
              projectType === "business" ? "border-primary bg-primary/5" : "hover:border-primary/50"
            )}>
              <RadioGroupItem value="business" id="business" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="business" className="flex items-center gap-2 cursor-pointer">
                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <span className="font-medium">Business Project</span>
                    <p className="text-xs text-muted-foreground font-normal">
                      Focus on business planning, market analysis, financials
                    </p>
                  </div>
                </Label>
              </div>
            </div>

            {/* Dev Project Option */}
            <div className={cn(
              "flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors",
              projectType === "dev" ? "border-primary bg-primary/5" : "hover:border-primary/50"
            )}>
              <RadioGroupItem value="dev" id="dev" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="dev" className="flex items-center gap-2 cursor-pointer">
                  <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Code2 className="h-4 w-4 text-purple-500" />
                  </div>
                  <div>
                    <span className="font-medium">Dev Project</span>
                    <p className="text-xs text-muted-foreground font-normal">
                      Software development with build plans and work packets
                    </p>
                  </div>
                </Label>
              </div>
            </div>

            {/* Both Projects Option */}
            <div className={cn(
              "flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors",
              projectType === "both" ? "border-primary bg-primary/5" : "hover:border-primary/50"
            )}>
              <RadioGroupItem value="both" id="both" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="both" className="flex items-center gap-2 cursor-pointer">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Link2 className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div>
                    <span className="font-medium">Both (Linked)</span>
                    <p className="text-xs text-muted-foreground font-normal">
                      Create business and dev projects that work together
                    </p>
                  </div>
                </Label>
              </div>
            </div>
          </RadioGroup>

          {/* Project Names for "Both" option */}
          {projectType === "both" && (
            <div className="space-y-4 p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Link2 className="h-4 w-4" />
                <span>Two linked projects will be created:</span>
              </div>
              <div className="space-y-2">
                <Label htmlFor="business-name" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-500" />
                  Business Project Name
                </Label>
                <Input
                  id="business-name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Business project name..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dev-name" className="flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-purple-500" />
                  Dev Project Name
                </Label>
                <Input
                  id="dev-name"
                  value={devName}
                  onChange={(e) => setDevName(e.target.value)}
                  placeholder="Dev project name..."
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Rocket className="mr-2 h-4 w-4" />
                Create {projectType === "both" ? "Projects" : "Project"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
