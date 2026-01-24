"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useStarredProjects } from "@/hooks/useStarredProjects"
import { useApprovals } from "@/hooks/useApprovals"
import { useAuth } from "@/components/auth/auth-provider"
import { getTrashedProjects } from "@/lib/data/projects"
import { UserMenu } from "@/components/auth/user-menu"
import { BetaUsageSummary } from "@/components/beta/usage-banner"
import {
  LayoutDashboard,
  ChevronLeft,
  Command,
  Layers,
  Star,
  Workflow,
  Terminal,
  Trash2,
  FlaskConical,
  ShieldCheck,
  Shield,
  Lightbulb,
  FileCheck,
  Search,
  ChevronDown,
  FolderKanban,
  Wrench,
  Mic,
  Settings,
  Users,
  UserPlus,
  Gift,
  Briefcase,
  ExternalLink,
  GitBranch,
  Video,
  MessageSquare,
  Database,
  Rocket,
  PlusCircle,
  History,
  Sparkles,
  Code2,
  Film,
  Puzzle,
  Loader2,
  type LucideIcon,
} from "lucide-react"
import { useEmergentModules } from "@/hooks/useEmergentModules"
import { SidebarExecution, useProjectFromPath } from "@/components/sidebar/sidebar-execution"

interface NavItem {
  title: string
  href: string
  icon: React.ElementType
  badgeKey?: string
  external?: boolean
}

interface NavCategory {
  id: string
  title: string
  icon: React.ElementType
  items: NavItem[]
  adminOnly?: boolean
}

// Projects category items
const projectsItems: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Projects", href: "/projects", icon: Layers },
  { title: "Voice", href: "/voice", icon: Mic },
]

// Tools category items
const toolsItems: NavItem[] = [
  { title: "Claude Code", href: "/claude-code", icon: Terminal },
  { title: "Ganesha AI", href: "/dev-tools/ganesha", icon: Sparkles },
  { title: "VS Code", href: "/dev-tools/vscode", icon: Code2 },
  { title: "Run History", href: "/run-history", icon: History },
  { title: "Processes", href: "/processes", icon: Rocket },
]

// Upcoming Features category items (in development)
const upcomingFeaturesItems: NavItem[] = [
  { title: "Business Ideas", href: "/business-ideas", icon: Lightbulb },
  { title: "Business Dev", href: "/business-dev", icon: Briefcase },
  { title: "Research", href: "/research", icon: Search },
  { title: "Patents", href: "/patents", icon: FileCheck },
  { title: "Gitea", href: "/gitea", icon: GitBranch, external: false },
  { title: "n8n", href: "/n8n", icon: Workflow, external: false },
  { title: "Open Web UI", href: "/openwebui", icon: MessageSquare },
]

// Admin category items
const adminItems: NavItem[] = [
  { title: "Admin Panel", href: "/admin", icon: ShieldCheck },
  { title: "Users", href: "/admin/users", icon: Users },
  { title: "Sessions", href: "/admin/sessions", icon: Video },
  { title: "Invites", href: "/admin/invites", icon: UserPlus },
  { title: "Referrals", href: "/admin/referrals", icon: Gift },
  { title: "Migration", href: "/admin/migration", icon: Database },
  { title: "Processes", href: "/admin/processes", icon: Rocket },
  { title: "Cleanup", href: "/admin/cleanup", icon: Trash2 },
  { title: "Settings", href: "/settings", icon: Settings },
  { title: "Security", href: "/settings/security", icon: Shield },
]

const STORAGE_KEY = "sidebar-accordion-state"

function getStoredAccordionState(): Record<string, boolean> {
  if (typeof window === "undefined") return {}
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

function setStoredAccordionState(state: Record<string, boolean>) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage errors
  }
}

interface NavCategoryAccordionProps {
  category: NavCategory
  collapsed: boolean
  pathname: string
  badgeCounts: Record<string, number>
  isOpen: boolean
  onToggle: (id: string) => void
}

function NavCategoryAccordion({
  category,
  collapsed,
  pathname,
  badgeCounts,
  isOpen,
  onToggle,
}: NavCategoryAccordionProps) {
  const hasActiveItem = category.items.some(
    (item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
  )

  if (collapsed) {
    // In collapsed mode, show just the category icon
    return (
      <div className="space-y-0.5">
        <div
          className={cn(
            "flex items-center justify-center rounded-md px-2 py-2 text-sm font-medium",
            hasActiveItem
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground"
          )}
          title={category.title}
        >
          <category.icon className="h-4 w-4" />
        </div>
      </div>
    )
  }

  return (
    <Collapsible open={isOpen} onOpenChange={() => onToggle(category.id)}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
            hasActiveItem ? "text-primary" : "text-muted-foreground"
          )}
        >
          <category.icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">{category.title}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 transition-transform duration-200",
              isOpen ? "rotate-180" : ""
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
        <nav className="ml-4 mt-1 space-y-0.5 border-l pl-3">
          {category.items.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))

            if (item.external) {
              return (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{item.title}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
                </a>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.title}</span>
                {item.badgeKey && badgeCounts[item.badgeKey] > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                    {badgeCounts[item.badgeKey]}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </CollapsibleContent>
    </Collapsible>
  )
}

// Icon mapping for emergent modules
const EMERGENT_ICON_MAP: Record<string, LucideIcon> = {
  Film: Film,
  Sparkles: Sparkles,
  Terminal: Terminal,
  Code2: Code2,
  Lightbulb: Lightbulb,
  Rocket: Rocket,
  Puzzle: Puzzle,
  // Add more as needed
}

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = React.useState(false)
  const { starredProjects } = useStarredProjects()
  const { pendingCount: pendingApprovals } = useApprovals()
  const { user, isBetaTester, betaLimits } = useAuth()
  const isAdmin = user?.role === "admin"
  const [trashedCount, setTrashedCount] = React.useState(0)
  const { projectId, isProjectPage } = useProjectFromPath()
  const { activeModules, isLoading: modulesLoading } = useEmergentModules()
  const [accordionState, setAccordionState] = React.useState<Record<string, boolean>>({
    projects: true,
    tools: true,
    modules: true,
    upcoming: false,
    admin: false,
  })

  // Initialize accordion state from localStorage
  React.useEffect(() => {
    const stored = getStoredAccordionState()
    if (Object.keys(stored).length > 0) {
      setAccordionState(stored)
    }
  }, [])

  const handleAccordionToggle = React.useCallback((id: string) => {
    setAccordionState((prev) => {
      const newState = { ...prev, [id]: !prev[id] }
      setStoredAccordionState(newState)
      return newState
    })
  }, [])

  // Refresh trashed count periodically and on path changes
  React.useEffect(() => {
    const updateTrashedCount = () => {
      if (user?.id) {
        setTrashedCount(getTrashedProjects(user.id).length)
      }
    }
    updateTrashedCount()

    const handleStorageChange = () => {
      updateTrashedCount()
    }
    window.addEventListener("storage", handleStorageChange)

    // Refresh periodically (30s to avoid interrupting user flow)
    const interval = setInterval(updateTrashedCount, 30000)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      clearInterval(interval)
    }
  }, [pathname, user?.id])

  // Dynamic badge counts lookup
  const badgeCounts: Record<string, number> = {
    pendingApprovals,
    trashedProjects: trashedCount,
  }

  // Define navigation categories
  const navCategories: NavCategory[] = [
    {
      id: "projects",
      title: "Projects",
      icon: FolderKanban,
      items: projectsItems,
    },
    {
      id: "tools",
      title: "Tools",
      icon: Wrench,
      items: toolsItems,
    },
    // Upcoming Features hidden until ready to ship
    // {
    //   id: "upcoming",
    //   title: "Upcoming Features",
    //   icon: Rocket,
    //   items: upcomingFeaturesItems,
    // },
  ]

  // Add admin category only for admin users
  if (isAdmin) {
    navCategories.push({
      id: "admin",
      title: "Admin",
      icon: ShieldCheck,
      items: adminItems,
      adminOnly: true,
    })
  }

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r bg-card transition-all duration-300",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
            <Command className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <span className="font-semibold tracking-tight bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
                Claudia Coder
              </span>
              {isBetaTester && (
                <Badge
                  variant="outline"
                  className="h-5 text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20 px-1.5"
                >
                  <FlaskConical className="h-3 w-3 mr-0.5" />
                  Beta
                </Badge>
              )}
            </div>
          )}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className={cn("ml-auto h-8 w-8", collapsed && "hidden")}
          onClick={() => setCollapsed(true)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Starred Projects */}
      {starredProjects.length > 0 && (
        <div className="border-b p-2">
          {!collapsed && (
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              Starred
            </div>
          )}
          <nav className="space-y-0.5">
            {starredProjects.map((project) => {
              const isActive = pathname === `/projects/${project.id}`
              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-yellow-400/10 text-yellow-500"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    collapsed && "justify-center px-2"
                  )}
                  title={collapsed ? project.name : undefined}
                >
                  <Star className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    isActive ? "fill-yellow-400 text-yellow-400" : "fill-yellow-400/50 text-yellow-400/50"
                  )} />
                  {!collapsed && (
                    <span className="flex-1 truncate">{project.name}</span>
                  )}
                </Link>
              )
            })}
          </nav>
        </div>
      )}

      {/* New Project Button - Prominent CTA */}
      <div className="p-2 border-b">
        <Link
          href="/projects/new"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition-all",
            "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-sm",
            "hover:from-green-600 hover:to-emerald-600 hover:shadow-md",
            pathname === "/projects/new" && "ring-2 ring-green-400 ring-offset-2 ring-offset-background",
            collapsed && "justify-center px-2"
          )}
          title={collapsed ? "New Project" : undefined}
        >
          <PlusCircle className="h-5 w-5 shrink-0" />
          {!collapsed && <span>New Project</span>}
        </Link>
      </div>

      {/* Main Navigation with Accordion Categories */}
      <nav className="flex-1 space-y-2 overflow-y-auto p-2">
        {navCategories.map((category) => (
          <NavCategoryAccordion
            key={category.id}
            category={category}
            collapsed={collapsed}
            pathname={pathname}
            badgeCounts={badgeCounts}
            isOpen={accordionState[category.id] ?? true}
            onToggle={handleAccordionToggle}
          />
        ))}

        {/* Emergent Modules Section - Always show manager link */}
        <Collapsible open={accordionState.modules} onOpenChange={() => handleAccordionToggle("modules")}>
          <CollapsibleTrigger asChild>
            <button
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                activeModules.some(m => pathname.startsWith(m.route)) ? "text-primary" : "text-muted-foreground"
              )}
            >
              {collapsed ? (
                <Puzzle className="h-4 w-4 shrink-0" />
              ) : (
                <>
                  <Puzzle className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">Emergent Modules</span>
                  {activeModules.length > 0 && (
                    <Badge variant="outline" className="h-5 text-[10px] px-1.5 bg-purple-500/10 text-purple-500 border-purple-500/20">
                      {activeModules.length}
                    </Badge>
                  )}
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform duration-200",
                      accordionState.modules ? "rotate-180" : ""
                    )}
                  />
                </>
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <nav className="ml-4 mt-1 space-y-0.5 border-l pl-3">
              {modulesLoading ? (
                <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Loading...</span>
                </div>
              ) : activeModules.length === 0 ? (
                <div className="px-3 py-1.5 text-sm text-muted-foreground/60 italic">
                  No active modules
                </div>
              ) : (
                activeModules.map((module) => {
                  const isActive = pathname === module.route || pathname.startsWith(module.route + "/")
                  const IconComponent = EMERGENT_ICON_MAP[module.icon] || Sparkles

                  return (
                    <Link
                      key={module.id}
                      href={module.route}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-purple-500/10 text-purple-500"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <IconComponent className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{module.name}</span>
                      {module.experimental && (
                        <Badge variant="outline" className="h-4 text-[9px] px-1 bg-amber-500/10 text-amber-500 border-amber-500/20">
                          New
                        </Badge>
                      )}
                    </Link>
                  )
                })
              )}
              {/* Link to modules management */}
              <Link
                href="/modules"
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  pathname === "/modules"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground/60 hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Settings className="h-4 w-4 shrink-0" />
                <span className="flex-1">Manage Modules</span>
              </Link>
            </nav>
          </CollapsibleContent>
        </Collapsible>
      </nav>

      {/* Execution Controls - Only shown on project pages */}
      {isProjectPage && projectId && (
        <SidebarExecution
          projectId={projectId}
          collapsed={collapsed}
        />
      )}

      {/* Divider */}
      <div className="mx-4 border-t" />

      {/* Bottom Navigation - Trash */}
      <nav className="space-y-1 p-2">
        <Link
          href="/projects/trash"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            pathname === "/projects/trash"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            collapsed && "justify-center px-2"
          )}
          title={collapsed ? "Trash" : undefined}
        >
          <Trash2 className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1">Trash</span>
              {trashedCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs text-white">
                  {trashedCount}
                </span>
              )}
            </>
          )}
        </Link>
      </nav>

      {/* Beta Usage Summary */}
      {isBetaTester && betaLimits && !collapsed && (
        <div className="border-t p-3">
          <BetaUsageSummary
            projectsCurrent={betaLimits.current.projects}
            projectsLimit={betaLimits.limits.projects}
            executionsCurrent={betaLimits.current.executions}
            executionsLimit={betaLimits.limits.executions}
          />
        </div>
      )}

      {/* Command Palette Hint */}
      <div className="border-t p-2">
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-2 text-muted-foreground",
            collapsed && "justify-center px-2"
          )}
        >
          <Command className="h-4 w-4" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left text-xs">Search</span>
              <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 sm:flex">
                <span className="text-xs">⌘</span>K
              </kbd>
            </>
          )}
        </Button>
      </div>

      {/* User Menu */}
      <div className="border-t p-2">
        <UserMenu collapsed={collapsed} />
      </div>

      {/* Collapse Toggle (when collapsed) */}
      {collapsed && (
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="icon"
            className="w-full"
            onClick={() => setCollapsed(false)}
          >
            <ChevronLeft className="h-4 w-4 rotate-180" />
          </Button>
        </div>
      )}
    </aside>
  )
}
