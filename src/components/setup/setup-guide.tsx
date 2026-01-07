"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import {
  Server,
  Cloud,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
  ArrowRight,
  Loader2,
  ExternalLink,
  Settings,
  Zap
} from "lucide-react"
import {
  getGlobalSettings,
  markSetupComplete,
  isSetupComplete as checkSetupComplete
} from "@/lib/settings/global-settings"

interface SetupStep {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  isComplete: boolean
  href?: string
  action?: string
}

export function SetupGuide() {
  const [isVisible, setIsVisible] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [steps, setSteps] = useState<SetupStep[]>([])

  useEffect(() => {
    checkSetupStatus()
  }, [])

  async function checkSetupStatus() {
    setIsChecking(true)

    // Check if user has dismissed setup
    const dismissed = localStorage.getItem("claudia_setup_dismissed")
    const setupComplete = checkSetupComplete()

    if (dismissed === "true" || setupComplete) {
      setIsVisible(false)
      setIsChecking(false)
      return
    }

    // Check actual setup status
    const settings = getGlobalSettings()
    const newSteps = await buildSetupSteps(settings)
    setSteps(newSteps)

    // Show if any steps are incomplete
    const hasIncompleteSteps = newSteps.some(s => !s.isComplete)
    setIsVisible(hasIncompleteSteps)
    setIsChecking(false)
  }

  async function buildSetupSteps(settings: ReturnType<typeof getGlobalSettings>): Promise<SetupStep[]> {
    // Check local server status
    let localServerOnline = false
    try {
      const response = await fetch("/api/providers")
      const data = await response.json()
      if (data.providers) {
        localServerOnline = data.providers.some(
          (p: { type: string; status: string }) => p.type === "local" && p.status === "online"
        )
      }
    } catch {
      // API not available, use config
      localServerOnline = settings.localServers.some(s => s.enabled)
    }

    // Check cloud providers
    const hasCloudProvider = settings.cloudProviders.some(p => p.enabled && p.apiKey)

    // Check if default model is set
    const hasDefaultModel = !!settings.defaultModel

    return [
      {
        id: "local",
        title: "Connect Local AI",
        description: localServerOnline
          ? "LM Studio or Ollama detected"
          : "Connect LM Studio or Ollama for free, local AI",
        icon: <Server className="h-4 w-4" />,
        isComplete: localServerOnline,
        href: "/settings/providers",
        action: "Configure"
      },
      {
        id: "cloud",
        title: "Add Cloud Provider",
        description: hasCloudProvider
          ? "API key configured"
          : "Add Anthropic, OpenAI, or Google for powerful models",
        icon: <Cloud className="h-4 w-4" />,
        isComplete: hasCloudProvider,
        href: "/settings/providers",
        action: "Add Key"
      },
      {
        id: "default",
        title: "Set Default Model",
        description: hasDefaultModel
          ? `Using ${settings.defaultModel?.displayName}`
          : "Choose your default AI for new projects",
        icon: <Zap className="h-4 w-4" />,
        isComplete: hasDefaultModel,
        href: "/settings/providers",
        action: "Select"
      }
    ]
  }

  function handleDismiss() {
    localStorage.setItem("claudia_setup_dismissed", "true")
    setIsVisible(false)
  }

  function handleComplete() {
    markSetupComplete()
    setIsVisible(false)
  }

  // Calculate progress
  const completedSteps = steps.filter(s => s.isComplete).length
  const totalSteps = steps.length
  const progressPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0
  const allComplete = completedSteps === totalSteps && totalSteps > 0

  if (isChecking) {
    return null
  }

  if (!isVisible) {
    return null
  }

  return (
    <Card className={cn(
      "border-primary/20 bg-gradient-to-br from-primary/5 to-transparent transition-all",
      isCollapsed && "cursor-pointer hover:bg-primary/5"
    )}>
      <CardHeader
        className="pb-2 cursor-pointer select-none"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Quick Setup
                {allComplete && (
                  <Badge className="bg-green-500/10 text-green-600 text-xs">
                    Complete
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                {allComplete
                  ? "You're all set! Click to dismiss."
                  : `${completedSteps} of ${totalSteps} steps completed`
                }
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isCollapsed && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDismiss()
                }}
              >
                Skip for now
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7">
              {isCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Progress bar - always visible */}
        <div className="pt-2">
          <Progress value={progressPercent} className="h-1" />
        </div>
      </CardHeader>

      {!isCollapsed && (
        <CardContent className="pt-2">
          <div className="space-y-2">
            {steps.map((step) => (
              <div
                key={step.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border transition-colors",
                  step.isComplete
                    ? "bg-green-500/5 border-green-500/20"
                    : "bg-muted/30 border-transparent hover:border-border"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    step.isComplete
                      ? "bg-green-500/10 text-green-600"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {step.isComplete ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      step.icon
                    )}
                  </div>
                  <div>
                    <p className={cn(
                      "text-sm font-medium",
                      step.isComplete && "text-green-600"
                    )}>
                      {step.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </div>
                {!step.isComplete && step.href && (
                  <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                    <a href={step.href}>
                      {step.action}
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </a>
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 mt-4 border-t">
            <p className="text-xs text-muted-foreground">
              You can always access this from Settings
            </p>
            {allComplete ? (
              <Button size="sm" onClick={handleComplete}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark Complete
              </Button>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <a href="/settings/providers">
                  <Settings className="h-4 w-4 mr-2" />
                  Open Settings
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
