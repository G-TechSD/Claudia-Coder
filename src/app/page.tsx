"use client"

import { useState, useEffect } from "react"
import { MetricCard } from "@/components/dashboard/metric-card"
import { ActivityPreview } from "@/components/dashboard/activity-preview"
import { ProjectsPreview } from "@/components/dashboard/projects-preview"
import { AgentGrid } from "@/components/dashboard/agent-grid"
import { SetupGuide } from "@/components/setup/setup-guide"
import { Package, CheckCircle, AlertTriangle, DollarSign, Layers } from "lucide-react"
import { seedSampleProjects } from "@/lib/data/projects"

interface DashboardMetrics {
  activeProjects: number
  activePackets: number
  completedToday: number
  blocked: number
  budgetRemaining: number
  budgetPercent: number
}

function loadMetrics(): DashboardMetrics {
  if (typeof window === "undefined") {
    return {
      activeProjects: 0,
      activePackets: 0,
      completedToday: 0,
      blocked: 0,
      budgetRemaining: 35,
      budgetPercent: 100
    }
  }

  // Ensure sample projects are seeded (if no projects exist yet)
  seedSampleProjects()

  try {
    // Load projects
    const projectsData = localStorage.getItem("claudia_projects")
    const projects = projectsData ? JSON.parse(projectsData) : []
    const activeProjects = projects.filter((p: { status: string }) =>
      p.status === "active" || p.status === "planning"
    ).length

    // Load packets - stored as { [projectId]: WorkPacket[] }
    const packetsData = localStorage.getItem("claudia_packets")
    const packetsRecord = packetsData ? JSON.parse(packetsData) : {}
    const packets = Object.values(packetsRecord).flat() as Array<{ status: string }>
    const activePackets = packets.filter((p) =>
      p.status === "queued" || p.status === "in_progress"
    ).length

    // Load execution results for today
    const resultsData = localStorage.getItem("claudia_execution_results")
    const results = resultsData ? JSON.parse(resultsData) : []
    const today = new Date().toDateString()
    const completedToday = results.filter((r: { completedAt: string }) =>
      new Date(r.completedAt).toDateString() === today
    ).length

    // Count blocked
    const blocked = packets.filter((p) => p.status === "blocked").length

    return {
      activeProjects,
      activePackets,
      completedToday,
      blocked,
      budgetRemaining: 35,  // Would come from settings/costs
      budgetPercent: 100
    }
  } catch {
    return {
      activeProjects: 0,
      activePackets: 0,
      completedToday: 0,
      blocked: 0,
      budgetRemaining: 35,
      budgetPercent: 100
    }
  }
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    activeProjects: 0,
    activePackets: 0,
    completedToday: 0,
    blocked: 0,
    budgetRemaining: 35,
    budgetPercent: 100
  })

  useEffect(() => {
    setMetrics(loadMetrics())

    // Refresh metrics periodically
    const interval = setInterval(() => {
      setMetrics(loadMetrics())
    }, 5000)

    return () => clearInterval(interval)
  }, [])

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
