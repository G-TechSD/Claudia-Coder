import { MetricCard } from "@/components/dashboard/metric-card"
import { ActivityPreview } from "@/components/dashboard/activity-preview"
import { AgentGrid } from "@/components/dashboard/agent-grid"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { Package, CheckCircle, AlertTriangle, DollarSign } from "lucide-react"

export default function Dashboard() {
  return (
    <div className="flex flex-col gap-6 p-6">
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
          title="Active Packets"
          value={12}
          change={3}
          icon={<Package className="h-5 w-5" />}
          variant="default"
        />
        <MetricCard
          title="Completed Today"
          value={47}
          change={12}
          icon={<CheckCircle className="h-5 w-5" />}
          variant="success"
        />
        <MetricCard
          title="Blocked"
          value={2}
          change={-1}
          icon={<AlertTriangle className="h-5 w-5" />}
          variant="warning"
        />
        <MetricCard
          title="Budget Remaining"
          value="$23.40"
          changeLabel="68%"
          icon={<DollarSign className="h-5 w-5" />}
          variant="default"
        />
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Activity Preview - Takes 2 columns */}
        <div className="lg:col-span-2">
          <ActivityPreview />
        </div>

        {/* Quick Actions */}
        <div>
          <QuickActions />
        </div>
      </div>

      {/* Agent Grid */}
      <AgentGrid />
    </div>
  )
}
