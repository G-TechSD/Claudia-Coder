"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import {
  ChevronDown,
  LayoutDashboard,
  Upload,
  FileText,
  GitBranch,
  Package,
  Terminal,
  Brain,
  Search,
  BookOpen,
  MessageSquare,
  DollarSign,
  Shield,
  Zap,
  Code,
  Briefcase,
  Settings,
  Sparkles,
} from "lucide-react"

export interface NavCategory {
  id: string
  label: string
  icon: React.ElementType
  iconColor?: string
  items: NavItem[]
}

export interface NavItem {
  value: string
  label: string
  icon: React.ElementType
  iconColor?: string
  badge?: React.ReactNode
  indicator?: React.ReactNode
}

interface ProjectNavigationProps {
  activeTab: string
  onTabChange: (value: string) => void
  // Badge counts
  resourceCount?: number
  repoCount?: number
  packetCount?: number
  // Indicators
  hasInterview?: boolean
  className?: string
}

export function ProjectNavigation({
  activeTab,
  onTabChange,
  resourceCount = 0,
  repoCount = 0,
  packetCount = 0,
  hasInterview = false,
  className,
}: ProjectNavigationProps) {
  // Primary tabs - always visible
  const primaryTabs: NavItem[] = [
    {
      value: "overview",
      label: "Overview",
      icon: LayoutDashboard,
    },
    {
      value: "resources",
      label: "User Uploads",
      icon: Upload,
      badge: resourceCount > 0 ? (
        <Badge variant="secondary" className="ml-1.5 text-xs h-5 px-1.5">
          {resourceCount}
        </Badge>
      ) : undefined,
    },
    {
      value: "plan",
      label: "Build Plan",
      icon: FileText,
    },
  ]

  // Grouped categories with dropdowns
  const categories: NavCategory[] = [
    {
      id: "development",
      label: "Development",
      icon: Code,
      iconColor: "text-blue-500",
      items: [
        {
          value: "repos",
          label: "Repositories",
          icon: GitBranch,
          badge: repoCount > 0 ? (
            <Badge variant="secondary" className="ml-auto text-xs h-5 px-1.5">
              {repoCount}
            </Badge>
          ) : undefined,
        },
        {
          value: "packets",
          label: "Work Packets",
          icon: Package,
          badge: packetCount > 0 ? (
            <Badge variant="secondary" className="ml-auto text-xs h-5 px-1.5">
              {packetCount}
            </Badge>
          ) : undefined,
        },
        {
          value: "claude-code",
          label: "Claude Code",
          icon: Terminal,
          iconColor: "text-purple-500",
        },
      ],
    },
    {
      id: "research",
      label: "Research",
      icon: Search,
      iconColor: "text-cyan-500",
      items: [
        {
          value: "models",
          label: "AI Models",
          icon: Brain,
        },
        {
          value: "prior-art",
          label: "Prior Art",
          icon: Search,
          iconColor: "text-cyan-500",
        },
        {
          value: "docs",
          label: "Documentation",
          icon: BookOpen,
          iconColor: "text-orange-500",
        },
      ],
    },
    {
      id: "business",
      label: "Business",
      icon: Briefcase,
      iconColor: "text-green-500",
      items: [
        {
          value: "interview",
          label: "Interview",
          icon: MessageSquare,
          indicator: hasInterview ? (
            <Sparkles className="h-3 w-3 ml-auto text-primary" />
          ) : undefined,
        },
        {
          value: "business-dev",
          label: "Business Dev",
          icon: DollarSign,
          iconColor: "text-green-500",
        },
      ],
    },
    {
      id: "operations",
      label: "Operations",
      icon: Settings,
      iconColor: "text-orange-500",
      items: [
        {
          value: "security",
          label: "Security",
          icon: Shield,
          iconColor: "text-red-500",
        },
        {
          value: "launch-test",
          label: "Launch & Test",
          icon: Zap,
          iconColor: "text-blue-500",
        },
      ],
    },
  ]

  // Check if active tab is within a category
  const getActiveCategory = () => {
    for (const category of categories) {
      if (category.items.some(item => item.value === activeTab)) {
        return category.id
      }
    }
    return null
  }

  const activeCategory = getActiveCategory()

  // Get the currently active item within a category for display
  const getActiveItemInCategory = (category: NavCategory) => {
    return category.items.find(item => item.value === activeTab)
  }

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      {/* Primary Tabs - Core navigation */}
      <div className="inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
        {primaryTabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.value
          return (
            <button
              key={tab.value}
              onClick={() => onTabChange(tab.value)}
              className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium",
                "ring-offset-background transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:pointer-events-none disabled:opacity-50",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "hover:bg-background/60 hover:text-foreground"
              )}
            >
              <Icon className={cn("h-4 w-4 mr-1.5 transition-colors duration-200", tab.iconColor)} />
              {tab.label}
              {tab.badge}
            </button>
          )
        })}
      </div>

      {/* Subtle Divider */}
      <div className="h-6 w-px bg-border/50 mx-1 hidden sm:block" />

      {/* Category Dropdowns - Grouped sections */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {categories.map((category) => {
          const CategoryIcon = category.icon
          const isActive = activeCategory === category.id
          const activeItem = getActiveItemInCategory(category)

          return (
            <DropdownMenu key={category.id}>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium",
                    "ring-offset-background transition-all duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isActive
                      ? "bg-primary/10 text-primary border border-primary/20 shadow-sm"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
                  )}
                >
                  <CategoryIcon className={cn(
                    "h-4 w-4 transition-colors duration-200",
                    isActive ? "text-primary" : category.iconColor
                  )} />
                  <span className="hidden sm:inline">
                    {isActive && activeItem ? activeItem.label : category.label}
                  </span>
                  <ChevronDown className={cn(
                    "h-3 w-3 transition-transform duration-200",
                    "opacity-60"
                  )} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-52 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2"
                sideOffset={8}
              >
                <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground font-normal">
                  <CategoryIcon className={cn("h-3.5 w-3.5", category.iconColor)} />
                  {category.label}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {category.items.map((item) => {
                  const ItemIcon = item.icon
                  const isItemActive = activeTab === item.value
                  return (
                    <DropdownMenuItem
                      key={item.value}
                      onClick={() => onTabChange(item.value)}
                      className={cn(
                        "cursor-pointer flex items-center gap-2 py-2 transition-colors duration-150",
                        isItemActive && "bg-primary/10 text-primary font-medium"
                      )}
                    >
                      <ItemIcon className={cn(
                        "h-4 w-4 transition-colors duration-150",
                        isItemActive ? "text-primary" : item.iconColor
                      )} />
                      <span className="flex-1">{item.label}</span>
                      {item.badge}
                      {item.indicator}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        })}
      </div>
    </div>
  )
}
