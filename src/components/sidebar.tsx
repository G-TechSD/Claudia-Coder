"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
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
} from "lucide-react"

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
  { title: "Business Ideas", href: "/business-ideas", icon: Lightbulb },
  { title: "Voice", href: "/voice", icon: Mic },
]

// Tools category items
const toolsItems: NavItem[] = [
  { title: "Claude Code", href: "/claude-code", icon: Terminal },
]

// Upcoming Features category items (in development)
const upcomingFeaturesItems: NavItem[] = [
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

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = React.useState(false)
  const { starredProjects } = useStarredProjects()
  const { pendingCount: pendingApprovals } = useApprovals()
  const { user, isBetaTester, betaLimits } = useAuth()
  const isAdmin = user?.role === "admin"
  const [trashedCount, setTrashedCount] = React.useState(0)
  const [accordionState, setAccordionState] = React.useState<Record<string, boolean>>({
    projects: true,
    tools: true,
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

    const interval = setInterval(updateTrashedCount, 2000)

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
    {
      id: "upcoming",
      title: "Upcoming Features",
      icon: Rocket,
      items: upcomingFeaturesItems,
    },
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
          <div className="flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden bg-gradient-to-br from-green-400/20 to-blue-500/20">
            <Image
              src="/claudia-logo.jpg"
              alt="Claudia Coder"
              width={32}
              height={32}
              className="h-8 w-8 object-cover"
            />
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
      </nav>

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
