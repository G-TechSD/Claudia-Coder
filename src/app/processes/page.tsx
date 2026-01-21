"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  RefreshCw,
  Square,
  Loader2,
  Server,
  AlertTriangle
} from "lucide-react"

interface ActiveProcess {
  port: number
  pid?: string
  command?: string
  tracked: boolean
  projectId?: string
}

export default function ProcessManagerPage() {
  const [processes, setProcesses] = React.useState<ActiveProcess[]>([])
  const [loading, setLoading] = React.useState(true)
  const [stopping, setStopping] = React.useState<number | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const fetchProcesses = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/launch-test/stop")
      const data = await response.json()
      setProcesses(data.processes || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch processes")
    } finally {
      setLoading(false)
    }
  }

  const stopProcess = async (port: number) => {
    setStopping(port)
    try {
      const response = await fetch("/api/launch-test/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ port })
      })
      const data = await response.json()
      if (data.success) {
        // Refresh the list
        await fetchProcesses()
      } else {
        setError(data.error || "Failed to stop process")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop process")
    } finally {
      setStopping(null)
    }
  }

  React.useEffect(() => {
    fetchProcesses()
  }, [])

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Running Processes</h1>
            <p className="text-muted-foreground">
              Manage dev servers and test applications running on common ports
            </p>
          </div>
          <Button
            variant="outline"
            onClick={fetchProcesses}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Refresh</span>
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Active Dev Servers
            </CardTitle>
            <CardDescription>
              Processes found on common development ports (3001, 5000, 8000, 8080, 9000, etc.)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : processes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Server className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No active processes found on common ports</p>
              </div>
            ) : (
              <div className="space-y-3">
                {processes.map((proc) => (
                  <div
                    key={proc.port}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
                  >
                    <div className="flex items-center gap-4">
                      <div className="font-mono text-lg font-bold">
                        :{proc.port}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {proc.command && (
                            <span className="text-sm text-muted-foreground">
                              {proc.command}
                            </span>
                          )}
                          {proc.tracked && (
                            <Badge variant="secondary" className="text-xs">
                              Tracked
                            </Badge>
                          )}
                        </div>
                        {proc.pid && (
                          <div className="text-xs text-muted-foreground">
                            PID: {proc.pid}
                            {proc.projectId && ` | Project: ${proc.projectId.substring(0, 8)}...`}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => stopProcess(proc.port)}
                      disabled={stopping === proc.port}
                    >
                      {stopping === proc.port ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                      <span className="ml-2">Stop</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-xs text-muted-foreground text-center">
          This page scans ports: 3001, 3002, 3003, 5000, 5001, 8000, 8001, 8080, 8081, 9000, 9001, 9020
        </div>
      </div>
    </div>
  )
}
