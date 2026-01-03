"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Calendar,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  GitBranch
} from "lucide-react"

type EventType = "start" | "complete" | "error" | "approval" | "deploy" | "test"

interface TimelineEvent {
  id: string
  packetId: string
  packetTitle: string
  type: EventType
  agent: string
  timestamp: Date
  duration?: number // in minutes
  details?: string
}

const typeConfig = {
  start: { label: "Started", color: "bg-blue-400", icon: Loader2 },
  complete: { label: "Completed", color: "bg-green-400", icon: CheckCircle },
  error: { label: "Failed", color: "bg-red-400", icon: XCircle },
  approval: { label: "Approval", color: "bg-yellow-400", icon: Clock },
  deploy: { label: "Deployed", color: "bg-purple-400", icon: CheckCircle },
  test: { label: "Tests", color: "bg-cyan-400", icon: CheckCircle }
}

// Generate mock timeline data for the past 24 hours
function generateMockEvents(): TimelineEvent[] {
  const events: TimelineEvent[] = []
  const packets = [
    { id: "PKT-001", title: "User authentication flow" },
    { id: "PKT-002", title: "Dashboard metrics" },
    { id: "PKT-003", title: "API rate limiting" },
    { id: "PKT-004", title: "Login validation fix" },
    { id: "PKT-005", title: "Dark mode toggle" },
    { id: "PKT-006", title: "TypeScript migration" },
  ]
  const agents = ["BEAST", "BEDROOM", "Claude", "n8n"]
  const types: EventType[] = ["start", "complete", "error", "approval", "deploy", "test"]

  const now = new Date()
  for (let i = 0; i < 30; i++) {
    const packet = packets[Math.floor(Math.random() * packets.length)]
    const hoursAgo = Math.random() * 24
    const timestamp = new Date(now.getTime() - hoursAgo * 3600000)

    events.push({
      id: `evt-${i}`,
      packetId: packet.id,
      packetTitle: packet.title,
      type: types[Math.floor(Math.random() * types.length)],
      agent: agents[Math.floor(Math.random() * agents.length)],
      timestamp,
      duration: Math.floor(Math.random() * 60) + 5
    })
  }

  return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
}

const mockEvents = generateMockEvents()

// Group events by hour for the timeline
function groupEventsByHour(events: TimelineEvent[]): Map<string, TimelineEvent[]> {
  const groups = new Map<string, TimelineEvent[]>()

  events.forEach(event => {
    const hour = event.timestamp.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric"
    })
    if (!groups.has(hour)) {
      groups.set(hour, [])
    }
    groups.get(hour)!.push(event)
  })

  return groups
}

export default function TimelinePage() {
  const [events] = useState<TimelineEvent[]>(mockEvents)
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [filter, setFilter] = useState<EventType | "all">("all")

  const filteredEvents = events.filter(e => filter === "all" || e.type === filter)
  const groupedEvents = groupEventsByHour(filteredEvents)

  const stats = {
    total: events.length,
    completed: events.filter(e => e.type === "complete").length,
    failed: events.filter(e => e.type === "error").length,
    approvals: events.filter(e => e.type === "approval").length
  }

  return (
    <div className="flex flex-col gap-6 p-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Timeline</h1>
          <p className="text-sm text-muted-foreground">
            Visual history of packet execution and events
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Calendar className="h-4 w-4" />
            Today
          </Button>
          <div className="flex items-center border rounded-md">
            <Button variant="ghost" size="sm" className="rounded-r-none">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="rounded-none border-x">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center border rounded-md ml-2">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-r-none"
              onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.25))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="px-2 text-sm text-muted-foreground min-w-[3rem] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-l-none"
              onClick={() => setZoomLevel(z => Math.min(2, z + 0.25))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Events", value: stats.total, color: "text-foreground" },
          { label: "Completed", value: stats.completed, color: "text-green-400" },
          { label: "Failed", value: stats.failed, color: "text-red-400" },
          { label: "Approvals", value: stats.approvals, color: "text-yellow-400" },
        ].map(stat => (
          <Card key={stat.label} className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{stat.label}</span>
              <span className={cn("text-lg font-semibold", stat.color)}>{stat.value}</span>
            </div>
          </Card>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {(["all", "start", "complete", "error", "approval", "deploy", "test"] as const).map(type => (
          <Button
            key={type}
            variant={filter === type ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilter(type)}
            className="capitalize gap-1.5"
          >
            {type !== "all" && (
              <span className={cn("h-2 w-2 rounded-full", typeConfig[type].color)} />
            )}
            {type}
          </Button>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3 flex-1 min-h-0">
        {/* Timeline View */}
        <Card className="lg:col-span-2 flex flex-col min-h-0">
          <CardHeader className="pb-2 flex-none">
            <CardTitle className="text-base font-medium">Event Timeline</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            <div className="relative" style={{ transform: `scale(${zoomLevel})`, transformOrigin: "top left" }}>
              {Array.from(groupedEvents.entries()).map(([hour, hourEvents]) => (
                <div key={hour} className="mb-6">
                  {/* Hour Header */}
                  <div className="sticky top-0 bg-card z-10 py-2 mb-3 border-b">
                    <span className="text-sm font-medium text-muted-foreground">{hour}</span>
                  </div>

                  {/* Events */}
                  <div className="relative pl-6 space-y-3">
                    {/* Vertical line */}
                    <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />

                    {hourEvents.map(event => {
                      const config = typeConfig[event.type]
                      const isSelected = selectedEvent?.id === event.id
                      return (
                        <div
                          key={event.id}
                          onClick={() => setSelectedEvent(event)}
                          className={cn(
                            "relative flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                            isSelected ? "bg-accent" : "hover:bg-accent/50"
                          )}
                        >
                          {/* Dot on timeline */}
                          <div
                            className={cn(
                              "absolute left-[-18px] top-4 h-3 w-3 rounded-full border-2 border-card",
                              config.color
                            )}
                          />

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="font-mono text-xs">
                                {event.packetId}
                              </Badge>
                              <Badge className={cn("text-xs", `${config.color}/10`, `text-${config.color.replace('bg-', '')}`)}>
                                {config.label}
                              </Badge>
                            </div>
                            <p className="font-medium text-sm truncate">{event.packetTitle}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span>{event.agent}</span>
                              <span>•</span>
                              <span>{event.timestamp.toLocaleTimeString()}</span>
                              {event.duration && (
                                <>
                                  <span>•</span>
                                  <span>{event.duration}m</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Detail Panel */}
        <Card className="flex flex-col min-h-0">
          <CardHeader className="pb-2 flex-none">
            <CardTitle className="text-base font-medium">Event Details</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {selectedEvent ? (
              <div className="space-y-6">
                {/* Event Type */}
                <div className="flex items-center gap-3">
                  <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", typeConfig[selectedEvent.type].color)}>
                    {(() => {
                      const Icon = typeConfig[selectedEvent.type].icon
                      return <Icon className="h-5 w-5 text-white" />
                    })()}
                  </div>
                  <div>
                    <p className="font-semibold">{typeConfig[selectedEvent.type].label}</p>
                    <p className="text-sm text-muted-foreground">{selectedEvent.packetTitle}</p>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Packet</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">{selectedEvent.packetId}</Badge>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Agent</p>
                    <p className="font-medium">{selectedEvent.agent}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Timestamp</p>
                    <p className="font-mono text-sm">{selectedEvent.timestamp.toLocaleString()}</p>
                  </div>

                  {selectedEvent.duration && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Duration</p>
                      <p className="font-medium">{selectedEvent.duration} minutes</p>
                    </div>
                  )}

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Event ID</p>
                    <p className="font-mono text-xs text-muted-foreground">{selectedEvent.id}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-4">
                  <Button variant="outline" className="w-full gap-2">
                    <GitBranch className="h-4 w-4" />
                    View Packet
                  </Button>
                  <Button variant="outline" className="w-full">
                    View Logs
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Calendar className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-sm">Select an event</p>
                <p className="text-xs mt-1">to view details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
