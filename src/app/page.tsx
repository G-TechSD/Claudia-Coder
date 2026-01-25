"use client"

import { useState, useEffect } from "react"
import { MetricCard } from "@/components/dashboard/metric-card"
import { ActivityPreview } from "@/components/dashboard/activity-preview"
import { ProjectsPreview } from "@/components/dashboard/projects-preview"
import { AgentGrid } from "@/components/dashboard/agent-grid"
import { SetupGuide } from "@/components/setup/setup-guide"
import { Package, CheckCircle, AlertTriangle, Layers } from "lucide-react"
import { getAllProjects, fetchProjects } from "@/lib/data/projects"
import { useAuth } from "@/components/auth/auth-provider"

interface DashboardMetrics {
  activeProjects: number
  activePackets: number
  completedToday: number
  blocked: number
  budgetRemaining: number
  budgetPercent: number
}

function loadProjectMetrics(userId: string | undefined): { activeProjects: number } {
  if (typeof window === "undefined" || !userId) {
    return { activeProjects: 0 }
  }

  try {
    const projects = getAllProjects({ userId })
    const activeProjects = projects.filter((p) =>
      p.status === "active" || p.status === "planning"
    ).length
    return { activeProjects }
  } catch {
    return { activeProjects: 0 }
  }
}

async function loadPacketMetrics(): Promise<{ activePackets: number; completedToday: number; blocked: number }> {
  try {
    const response = await fetch("/api/packets")
    const data = await response.json()
    if (data.success && data.packets) {
      const packets = data.packets as Array<{ status: string }>
      const activePackets = packets.filter((p) =>
        p.status === "queued" || p.status === "in_progress"
      ).length
      const blocked = packets.filter((p) => p.status === "blocked").length
      // TODO: completedToday would need timestamp tracking
      return { activePackets, completedToday: 0, blocked }
    }
  } catch (error) {
    console.error("[Dashboard] Failed to load packet metrics:", error)
  }
  return { activePackets: 0, completedToday: 0, blocked: 0 }
}

export default function Dashboard() {
  const { user } = useAuth()
  const userId = user?.id
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    activeProjects: 0,
    activePackets: 0,
    completedToday: 0,
    blocked: 0,
    budgetRemaining: 35,
    budgetPercent: 100
  })

  useEffect(() => {
    const loadDashboardMetrics = async () => {
      if (!userId) return

      // Load project metrics from cache
      const projectMetrics = loadProjectMetrics(userId)
      setMetrics(prev => ({ ...prev, activeProjects: projectMetrics.activeProjects }))

      // Fetch packet metrics from server
      const packetMetrics = await loadPacketMetrics()
      setMetrics(prev => ({
        ...prev,
        activePackets: packetMetrics.activePackets,
        completedToday: packetMetrics.completedToday,
        blocked: packetMetrics.blocked
      }))

      // Fetch fresh project data from server
      try {
        await fetchProjects(userId)
        const updatedProjectMetrics = loadProjectMetrics(userId)
        setMetrics(prev => ({ ...prev, activeProjects: updatedProjectMetrics.activeProjects }))
      } catch (error) {
        console.error("[Dashboard] Failed to fetch projects:", error)
      }
    }

    loadDashboardMetrics()

    // Refresh metrics periodically (30s to avoid interrupting user flow)
    const interval = setInterval(loadDashboardMetrics, 30000)

    return () => clearInterval(interval)
  }, [userId])

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Setup Guide - Shows only if setup incomplete */}
      <SetupGuide />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Monitor your autonomous development pipeline
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
          </span>
          All systems operational
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Active Projects"
          value={metrics.activeProjects}
          icon={<Layers className="h-5 w-5" />}
          variant="default"
        />
        <MetricCard
          title="Active Packets"
          value={metrics.activePackets}
          icon={<Package className="h-5 w-5" />}
          variant="default"
        />
        <MetricCard
          title="Completed Today"
          value={metrics.completedToday}
          icon={<CheckCircle className="h-5 w-5" />}
          variant="success"
        />
        <MetricCard
          title="Blocked"
          value={metrics.blocked}
          icon={<AlertTriangle className="h-5 w-5" />}
          variant={metrics.blocked > 0 ? "warning" : "default"}
        />
      </div>

      {/* Projects Section */}
      <ProjectsPreview />

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Activity Preview - Full width */}
        <div className="lg:col-span-3">
          <ActivityPreview />
        </div>
      </div>

      {/* Agent Grid */}
      <AgentGrid />
    </div>
  )
}
