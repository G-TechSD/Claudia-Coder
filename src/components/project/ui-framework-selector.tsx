"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Sparkles, ArrowRight } from "lucide-react"

// UI Type definitions
export type UIType = "website" | "web_app" | "desktop" | "mobile" | "terminal" | "api_only"

// Framework option structure
export interface FrameworkOption {
  id: string
  name: string
  description: string
  pros: string[]
  bestFor: string
  icon?: string
  recommended?: boolean
}

// Framework options by UI type
export const FRAMEWORK_OPTIONS: Record<string, FrameworkOption[]> = {
  web_app: [
    {
      id: "nextjs",
      name: "Next.js",
      description: "React framework with SSR and full-stack capabilities",
      pros: ["Great DX", "SEO-friendly", "Full-stack"],
      bestFor: "Production web apps",
      recommended: true
    },
    {
      id: "react-vite",
      name: "React + Vite",
      description: "Fast React SPA setup with modern tooling",
      pros: ["Simple", "Fast builds", "Flexible"],
      bestFor: "SPAs, dashboards"
    },
    {
      id: "vue",
      name: "Vue.js",
      description: "Progressive framework for building UIs",
      pros: ["Easy to learn", "Great docs", "Flexible"],
      bestFor: "Gradual adoption"
    },
    {
      id: "svelte",
      name: "SvelteKit",
      description: "Compiled framework with minimal runtime",
      pros: ["Small bundles", "Fast", "Simple syntax"],
      bestFor: "Performance-critical apps"
    },
  ],
  website: [
    {
      id: "nextjs",
      name: "Next.js",
      description: "React with static generation and SSR",
      pros: ["SEO", "Fast", "Flexible"],
      bestFor: "Marketing sites, blogs",
      recommended: true
    },
    {
      id: "astro",
      name: "Astro",
      description: "Content-focused framework with zero JS by default",
      pros: ["Zero JS default", "Fast", "Islands architecture"],
      bestFor: "Content sites"
    },
    {
      id: "hugo",
      name: "Hugo",
      description: "Blazing fast static site generator in Go",
      pros: ["Blazing fast", "No JS needed", "Simple"],
      bestFor: "Blogs, docs"
    },
  ],
  mobile: [
    {
      id: "react-native",
      name: "React Native",
      description: "Build native apps with React",
      pros: ["Shared codebase", "Large ecosystem", "Hot reload"],
      bestFor: "iOS + Android apps",
      recommended: true
    },
    {
      id: "flutter",
      name: "Flutter",
      description: "Google's UI toolkit for beautiful apps",
      pros: ["Beautiful UI", "Fast", "Single codebase"],
      bestFor: "Polished mobile apps"
    },
    {
      id: "expo",
      name: "Expo",
      description: "React Native made easy with managed workflow",
      pros: ["Easy setup", "OTA updates", "Managed"],
      bestFor: "Quick mobile prototypes"
    },
  ],
  desktop: [
    {
      id: "electron",
      name: "Electron",
      description: "Build cross-platform apps with web technologies",
      pros: ["Cross-platform", "Web skills", "Rich ecosystem"],
      bestFor: "Cross-platform desktop",
      recommended: true
    },
    {
      id: "tauri",
      name: "Tauri",
      description: "Rust-based framework for smaller, faster apps",
      pros: ["Small bundles", "Secure", "Fast"],
      bestFor: "Lightweight desktop apps"
    },
  ],
  terminal: [
    {
      id: "ink",
      name: "Ink (React)",
      description: "Build CLI apps with React components",
      pros: ["React patterns", "Components", "Testing"],
      bestFor: "Interactive CLIs",
      recommended: true
    },
    {
      id: "blessed",
      name: "Blessed",
      description: "Full-featured terminal UI library",
      pros: ["Rich widgets", "Curses-like", "Flexible"],
      bestFor: "Complex TUIs"
    },
    {
      id: "commander",
      name: "Commander.js",
      description: "Node.js CLI framework",
      pros: ["Simple", "Popular", "Well-documented"],
      bestFor: "Standard CLIs"
    },
  ],
  api_only: [
    {
      id: "express",
      name: "Express.js",
      description: "Minimalist Node.js web framework",
      pros: ["Simple", "Flexible", "Large ecosystem"],
      bestFor: "REST APIs",
      recommended: true
    },
    {
      id: "fastify",
      name: "Fastify",
      description: "Fast and low overhead web framework",
      pros: ["Fast", "Schema validation", "Plugins"],
      bestFor: "High-performance APIs"
    },
    {
      id: "hono",
      name: "Hono",
      description: "Ultrafast web framework for edge computing",
      pros: ["Edge-ready", "Tiny", "Modern"],
      bestFor: "Edge APIs, serverless"
    },
  ]
}

// Human-readable UI type names
export const UI_TYPE_LABELS: Record<UIType, string> = {
  website: "Website",
  web_app: "Web Application",
  desktop: "Desktop Application",
  mobile: "Mobile Application",
  terminal: "Terminal / CLI",
  api_only: "API / Backend Service"
}

interface UIFrameworkSelectorProps {
  uiType: UIType
  suggestedFrameworks?: string[]
  onSelect: (framework: FrameworkOption) => void
  onSkip: () => void
  className?: string
}

export function UIFrameworkSelector({
  uiType,
  suggestedFrameworks,
  onSelect,
  onSkip,
  className
}: UIFrameworkSelectorProps) {
  const [selectedFramework, setSelectedFramework] = React.useState<string | null>(null)
  const options = FRAMEWORK_OPTIONS[uiType] || []

  // Sort options to put recommended and AI-suggested ones first
  const sortedOptions = React.useMemo(() => {
    return [...options].sort((a, b) => {
      // AI suggested first
      const aIsSuggested = suggestedFrameworks?.includes(a.id)
      const bIsSuggested = suggestedFrameworks?.includes(b.id)
      if (aIsSuggested && !bIsSuggested) return -1
      if (!aIsSuggested && bIsSuggested) return 1
      // Then recommended
      if (a.recommended && !b.recommended) return -1
      if (!a.recommended && b.recommended) return 1
      return 0
    })
  }, [options, suggestedFrameworks])

  const handleSelect = (framework: FrameworkOption) => {
    setSelectedFramework(framework.id)
  }

  const handleConfirm = () => {
    const framework = options.find(f => f.id === selectedFramework)
    if (framework) {
      onSelect(framework)
    }
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold">Choose a UI Framework</h3>
        <p className="text-muted-foreground">
          Your project needs a <span className="text-primary font-medium">{UI_TYPE_LABELS[uiType]}</span>.
          Select a framework to get started:
        </p>
      </div>

      {/* Framework Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedOptions.map((option) => {
          const isSelected = selectedFramework === option.id
          const isSuggested = suggestedFrameworks?.includes(option.id)

          return (
            <Card
              key={option.id}
              className={cn(
                "cursor-pointer transition-all duration-200 hover:border-primary/50",
                isSelected && "border-primary ring-2 ring-primary/20",
                isSuggested && "bg-primary/5"
              )}
              onClick={() => handleSelect(option)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {option.name}
                    {isSelected && (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    )}
                  </CardTitle>
                  <div className="flex gap-1">
                    {isSuggested && (
                      <Badge variant="secondary" className="text-xs bg-purple-500/20 text-purple-400">
                        <Sparkles className="h-3 w-3 mr-1" />
                        AI Pick
                      </Badge>
                    )}
                    {option.recommended && !isSuggested && (
                      <Badge variant="secondary" className="text-xs">
                        Popular
                      </Badge>
                    )}
                  </div>
                </div>
                <CardDescription>{option.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Pros */}
                <div className="flex flex-wrap gap-1">
                  {option.pros.map((pro) => (
                    <Badge key={pro} variant="outline" className="text-xs">
                      {pro}
                    </Badge>
                  ))}
                </div>
                {/* Best For */}
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Best for:</span> {option.bestFor}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button variant="ghost" onClick={onSkip}>
          Skip - let AI decide
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={!selectedFramework}
          className="min-w-[140px]"
        >
          Continue
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}

// Export a hook for getting frameworks by UI type
export function getFrameworksForType(uiType: UIType | string): FrameworkOption[] {
  return FRAMEWORK_OPTIONS[uiType] || []
}

// Export UI type detection helper
export function detectUITypeFromDescription(description: string): UIType | null {
  const lowerDesc = description.toLowerCase()

  // Mobile patterns
  if (/\b(mobile|ios|android|phone|tablet|app store|play store)\b/.test(lowerDesc)) {
    return "mobile"
  }

  // Desktop patterns
  if (/\b(desktop|windows|mac|linux|native app|electron|tauri)\b/.test(lowerDesc)) {
    return "desktop"
  }

  // Terminal/CLI patterns
  if (/\b(cli|command.?line|terminal|tui|shell|console)\b/.test(lowerDesc)) {
    return "terminal"
  }

  // API-only patterns
  if (/\b(api|backend|service|server|microservice|headless)\b/.test(lowerDesc) &&
      !/\b(website|web\s*app|frontend|ui|interface|dashboard)\b/.test(lowerDesc)) {
    return "api_only"
  }

  // Web app patterns
  if (/\b(dashboard|app|application|saas|tool|platform|interactive|login|auth)\b/.test(lowerDesc)) {
    return "web_app"
  }

  // Website patterns
  if (/\b(website|site|blog|portfolio|landing|marketing|content)\b/.test(lowerDesc)) {
    return "website"
  }

  return null
}
