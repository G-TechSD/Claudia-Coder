"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface Agent {
  id: string
  name: string
  model: string
  status: "active" | "idle" | "error"
  tasks: number
}

const mockAgents: Agent[] = [
  { id: "1", name: "BEAST", model: "deepseek-coder", status: "active", tasks: 3 },
  { id: "2", name: "BEDROOM", model: "qwen3-vl", status: "active", tasks: 1 },
  { id: "3", name: "Claude", model: "Sonnet", status: "idle", tasks: 0 },
  { id: "4", name: "GPT", model: "4o", status: "idle", tasks: 0 },
]

const statusConfig = {
  active: { label: "Active", color: "bg-green-400", ring: "ring-green-400/30" },
  idle: { label: "Idle", color: "bg-muted-foreground", ring: "ring-muted-foreground/30" },
  error: { label: "Error", color: "bg-red-400", ring: "ring-red-400/30" },
}

export function AgentGrid() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Active Agents</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {mockAgents.map((agent) => {
            const config = statusConfig[agent.status]
            return (
              <div
                key={agent.id}
                className="flex flex-col items-center gap-2 rounded-lg border bg-card p-3 text-center transition-colors hover:bg-accent/50"
              >
                <div className="relative">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium ring-2",
                      config.ring
                    )}
                  >
                    {agent.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card",
                      config.color
                    )}
                  />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{agent.name}</p>
                  <p className="text-xs text-muted-foreground">{agent.model}</p>
                  {agent.tasks > 0 && (
                    <p className="text-xs text-primary">
                      {agent.tasks} task{agent.tasks !== 1 && "s"}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
