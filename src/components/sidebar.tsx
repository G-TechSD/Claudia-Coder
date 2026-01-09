"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useStarredProjects } from "@/hooks/useStarredProjects"
import { useApprovals } from "@/hooks/useApprovals"
import { useAuth } from "@/components/auth/auth-provider"
import { getTrashedProjects } from "@/lib/data/projects"
import { UserMenu } from "@/components/auth/user-menu"
import { BetaUsageSummary } from "@/components/beta/usage-banner"
import {
  LayoutDashboard,
  Activity,
  Package,
  GitBranch,
  Shield,
  CheckCircle,
  DollarSign,
  Settings,
  Mic,
  ChevronLeft,
  Command,
  Layers,
  Star,
  Workflow,
  Terminal,
  Trash2,
  FlaskConical,
  ShieldCheck,
  Lightbulb,
  FileCheck,
  Search,
} from "lucide-react"

interface NavItem {
  title: string
  href: string
  icon: React.ElementType
  badgeKey?: string // Key to look up dynamic badge count
}

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Projects", href: "/projects", icon: Layers },
  { title: "Research", href: "/research", icon: Search },
  { title: "Business Ideas", href: "/business-ideas", icon: Lightbulb },
  { title: "Patents", href: "/patents", icon: FileCheck },
  { title: "Claude Code", href: "/claude-code", icon: Terminal },
  { title: "Activity", href: "/activity", icon: Activity },
  { title: "Packets", href: "/packets", icon: Package },
  { title: "Timeline", href: "/timeline", icon: GitBranch },
  { title: "N8N", href: "/n8n", icon: Workflow },
  { title: "Quality", href: "/quality", icon: Shield },
  { title: "Approvals", href: "/approvals", icon: CheckCircle, badgeKey: "pendingApprovals" },
  { title: "Costs", href: "/costs", icon: DollarSign },
]

const bottomNavItems: NavItem[] = [
  { title: "Trash", href: "/projects/trash", icon: Trash2, badgeKey: "trashedProjects" },
  { title: "Settings", href: "/settings", icon: Settings },
  { title: "Voice", href: "/voice", icon: Mic },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = React.useState(false)
  const { starredProjects } = useStarredProjects()
  const { pendingCount: pendingApprovals } = useApprovals()
  const { user, isBetaTester, betaLimits } = useAuth()
  const isAdmin = user?.role === "admin"
  const [trashedCount, setTrashedCount] = React.useState(0)

  // Refresh trashed count periodically and on path changes
  React.useEffect(() => {
    const updateTrashedCount = () => {
      setTrashedCount(getTrashedProjects().length)
    }
    updateTrashedCount()

    // Listen for storage changes to update trash count
    const handleStorageChange = () => {
      updateTrashedCount()
    }
    window.addEventListener("storage", handleStorageChange)

    // Also poll every few seconds to catch in-app changes
    const interval = setInterval(updateTrashedCount, 2000)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      clearInterval(interval)
    }
  }, [pathname])

  // Dynamic badge counts lookup
  const badgeCounts: Record<string, number> = {
    pendingApprovals,
    trashedProjects: trashedCount,
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

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                collapsed && "justify-center px-2"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1">{item.title}</span>
                  {item.badgeKey && badgeCounts[item.badgeKey] > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                      {badgeCounts[item.badgeKey]}
                    </span>
                  )}
                </>
              )}
            </Link>
          )
        })}

        {/* Admin Link - Only visible to admins */}
        {isAdmin && (
          <Link
            href="/admin"
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname.startsWith("/admin")
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              collapsed && "justify-center px-2"
            )}
            title={collapsed ? "Admin" : undefined}
          >
            <ShieldCheck className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="flex-1">Admin</span>}
          </Link>
        )}
      </nav>

      {/* Divider */}
      <div className="mx-4 border-t" />

      {/* Bottom Navigation */}
      <nav className="space-y-1 p-2">
        {bottomNavItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                collapsed && "justify-center px-2"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1">{item.title}</span>
                  {item.badgeKey && badgeCounts[item.badgeKey] > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs text-white">
                      {badgeCounts[item.badgeKey]}
                    </span>
                  )}
                </>
              )}
            </Link>
          )
        })}
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
