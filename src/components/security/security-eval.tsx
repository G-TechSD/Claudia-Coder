"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  Loader2,
  FileCode,
  ChevronDown,
  ChevronUp,
  Wrench,
  Package,
  ExternalLink,
  Copy,
  Check,
  Cloud,
  Server
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { SecurityScan, SecurityFinding, SecuritySeverity } from "@/lib/data/types"

interface ProviderOption {
  name: string
  displayName: string
  status: "online" | "offline" | "checking" | "not-configured"
  model?: string
  type: "local" | "cloud"
}

interface SecurityEvalProps {
  projectId: string
  projectName: string
  projectDescription?: string
  providers: ProviderOption[]
  selectedProvider: string | null
  onProviderChange: (provider: string) => void
  className?: string
}

const severityConfig: Record<SecuritySeverity, { icon: typeof AlertCircle; color: string; label: string }> = {
  critical: { icon: ShieldAlert, color: "text-red-600 bg-red-500/10 border-red-500/30", label: "Critical" },
  high: { icon: AlertTriangle, color: "text-orange-500 bg-orange-500/10 border-orange-500/30", label: "High" },
  medium: { icon: AlertCircle, color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/30", label: "Medium" },
  low: { icon: Info, color: "text-blue-500 bg-blue-500/10 border-blue-500/30", label: "Low" },
  info: { icon: Info, color: "text-gray-500 bg-gray-500/10 border-gray-500/30", label: "Info" }
}

export function SecurityEval({
  projectId,
  projectName,
  projectDescription,
  providers,
  selectedProvider,
  onProviderChange,
  className
}: SecurityEvalProps) {
  const [codeInput, setCodeInput] = useState("")
  const [isScanning, setIsScanning] = useState(false)
  const [isGeneratingFixes, setIsGeneratingFixes] = useState(false)
  const [scan, setScan] = useState<SecurityScan | null>(null)
  const [fixPackets, setFixPackets] = useState<Record<string, unknown>[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const toggleFinding = (id: string) => {
    setExpandedFindings(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const copyToClipboard = useCallback(async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  const runSecurityScan = async () => {
    if (!codeInput.trim()) {
      setError("Please paste code to analyze")
      return
    }

    setIsScanning(true)
    setError(null)
    setScan(null)
    setFixPackets(null)

    try {
      // Parse code input - assume it's a single file or multiple files separated by markers
      const codeFiles = parseCodeInput(codeInput)

      const response = await fetch("/api/security-eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          projectName,
          projectDescription,
          codeFiles,
          preferredProvider: selectedProvider
        })
      })

      const data = await response.json()

      if (data.error) {
        setError(data.error)
      } else if (data.scan) {
        setScan(data.scan)
        // Auto-expand first critical/high finding
        const firstImportant = data.scan.findings.find(
          (f: SecurityFinding) => f.severity === "critical" || f.severity === "high"
        )
        if (firstImportant) {
          setExpandedFindings(new Set([firstImportant.id]))
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed")
    } finally {
      setIsScanning(false)
    }
  }

  const generateFixes = async () => {
    if (!scan || scan.findings.length === 0) return

    setIsGeneratingFixes(true)

    try {
      const response = await fetch("/api/security-eval/generate-fixes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          findings: scan.findings,
          projectName,
          groupRelated: true,
          preferredProvider: selectedProvider
        })
      })

      const data = await response.json()

      if (data.error) {
        setError(data.error)
      } else if (data.packets) {
        setFixPackets(data.packets)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate fixes")
    } finally {
      setIsGeneratingFixes(false)
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <Card className="bg-gradient-to-r from-red-500/5 to-orange-500/5 border-red-500/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-red-500" />
                Red Team Security Evaluation
              </CardTitle>
              <CardDescription>
                Automated penetration testing and vulnerability analysis
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedProvider || ""} onValueChange={onProviderChange}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue placeholder="Select AI..." />
                </SelectTrigger>
                <SelectContent>
                  {providers.filter(p => p.type === "local").length > 0 && (
                    <div className="px-2 py-1 text-xs text-muted-foreground font-medium">Local</div>
                  )}
                  {providers.filter(p => p.type === "local").map(p => (
                    <SelectItem key={p.name} value={p.name} disabled={p.status !== "online"}>
                      <div className="flex items-center gap-2">
                        <Server className="h-3 w-3 text-muted-foreground" />
                        <span className={cn(
                          "h-2 w-2 rounded-full",
                          p.status === "online" && "bg-green-500",
                          p.status === "offline" && "bg-red-500"
                        )} />
                        {p.displayName}
                      </div>
                    </SelectItem>
                  ))}
                  {providers.filter(p => p.type === "cloud").length > 0 && (
                    <div className="px-2 py-1 text-xs text-muted-foreground font-medium mt-1 border-t">Cloud</div>
                  )}
                  {providers.filter(p => p.type === "cloud").map(p => (
                    <SelectItem key={p.name} value={p.name} disabled={p.status !== "online"}>
                      <div className="flex items-center gap-2">
                        <Cloud className="h-3 w-3 text-blue-500" />
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        {p.displayName}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Code Input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <FileCode className="h-4 w-4" />
            Code to Analyze
          </CardTitle>
          <CardDescription>
            Paste code files to scan. Use &quot;=== FILE: path/to/file.ts ===&quot; markers to separate files.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder={`=== FILE: src/api/users.ts ===
export async function getUser(id: string) {
  const user = await db.query(\`SELECT * FROM users WHERE id = '\${id}'\`)
  return user
}

=== FILE: src/auth/login.ts ===
// Paste more files here...`}
            className="min-h-[200px] font-mono text-sm"
          />

          <div className="flex items-center gap-2">
            <Button
              onClick={runSecurityScan}
              disabled={isScanning || !selectedProvider || !codeInput.trim()}
            >
              {isScanning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <ShieldAlert className="h-4 w-4 mr-2" />
                  Run Security Scan
                </>
              )}
            </Button>

            {scan && scan.findings.length > 0 && (
              <Button
                variant="outline"
                onClick={generateFixes}
                disabled={isGeneratingFixes}
              >
                {isGeneratingFixes ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating Fixes...
                  </>
                ) : (
                  <>
                    <Wrench className="h-4 w-4 mr-2" />
                    Generate Fix Packets
                  </>
                )}
              </Button>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-500">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scan Results */}
      {scan && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                {scan.findings.length === 0 ? (
                  <>
                    <ShieldCheck className="h-4 w-4 text-green-500" />
                    No Vulnerabilities Found
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-4 w-4 text-red-500" />
                    {scan.findings.length} Vulnerabilities Found
                  </>
                )}
              </CardTitle>

              {scan.summary && (
                <div className="flex gap-2">
                  {scan.summary.critical > 0 && (
                    <Badge className="bg-red-600">{scan.summary.critical} Critical</Badge>
                  )}
                  {scan.summary.high > 0 && (
                    <Badge className="bg-orange-500">{scan.summary.high} High</Badge>
                  )}
                  {scan.summary.medium > 0 && (
                    <Badge className="bg-yellow-500">{scan.summary.medium} Medium</Badge>
                  )}
                  {scan.summary.low > 0 && (
                    <Badge variant="secondary">{scan.summary.low} Low</Badge>
                  )}
                </div>
              )}
            </div>
            {scan.generatedBy && (
              <CardDescription>
                Scanned by {scan.generatedBy} in {scan.summary?.scanDuration?.toFixed(1)}s
              </CardDescription>
            )}
          </CardHeader>

          {scan.findings.length > 0 && (
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-3">
                  {scan.findings.map((finding) => {
                    const config = severityConfig[finding.severity]
                    const SeverityIcon = config.icon
                    const isExpanded = expandedFindings.has(finding.id)

                    return (
                      <div
                        key={finding.id}
                        className={cn("border rounded-lg overflow-hidden", config.color)}
                      >
                        <button
                          onClick={() => toggleFinding(finding.id)}
                          className="w-full p-3 flex items-center gap-3 text-left hover:bg-black/5"
                        >
                          <SeverityIcon className="h-5 w-5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{finding.title}</p>
                            {finding.filePath && (
                              <p className="text-xs opacity-70 truncate">
                                {finding.filePath}
                                {finding.lineStart && `:${finding.lineStart}`}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {finding.category}
                            </Badge>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-3 pb-3 space-y-3 border-t bg-background/50">
                            <div className="pt-3">
                              <p className="text-sm">{finding.description}</p>
                            </div>

                            {finding.codeSnippet && (
                              <div>
                                <p className="text-xs font-medium mb-1 text-muted-foreground">Vulnerable Code</p>
                                <pre className="p-2 bg-black/20 rounded text-xs overflow-x-auto">
                                  <code>{finding.codeSnippet}</code>
                                </pre>
                              </div>
                            )}

                            <div>
                              <p className="text-xs font-medium mb-1 text-muted-foreground">Recommendation</p>
                              <p className="text-sm">{finding.recommendation}</p>
                            </div>

                            {finding.fixExample && (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-xs font-medium text-muted-foreground">Fix Example</p>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copyToClipboard(finding.fixExample!, finding.id)}
                                  >
                                    {copiedId === finding.id ? (
                                      <Check className="h-3 w-3" />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                  </Button>
                                </div>
                                <pre className="p-2 bg-green-500/10 border border-green-500/30 rounded text-xs overflow-x-auto">
                                  <code>{finding.fixExample}</code>
                                </pre>
                              </div>
                            )}

                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              {finding.cweId && (
                                <a
                                  href={`https://cwe.mitre.org/data/definitions/${finding.cweId.replace("CWE-", "")}.html`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 hover:text-primary"
                                >
                                  {finding.cweId}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                              {finding.owaspCategory && (
                                <span>{finding.owaspCategory}</span>
                              )}
                              {finding.estimatedEffort && (
                                <Badge variant="outline" className="text-xs">
                                  {finding.estimatedEffort} effort
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          )}
        </Card>
      )}

      {/* Fix Packets */}
      {fixPackets && fixPackets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4" />
              Generated Fix Packets ({fixPackets.length})
            </CardTitle>
            <CardDescription>
              Total estimated effort: {fixPackets.reduce((sum, p) => sum + ((p.estimatedHours as number) || 0), 0)} hours
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {fixPackets.map((packet, i) => (
                  <div key={i} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">{packet.title as string}</h4>
                      <Badge className={cn(
                        packet.priority === "critical" && "bg-red-600",
                        packet.priority === "high" && "bg-orange-500",
                        packet.priority === "medium" && "bg-yellow-500"
                      )}>
                        {packet.priority as string}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{packet.description as string}</p>

                    {(packet.tasks as unknown[])?.length > 0 && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">
                          {(packet.tasks as unknown[]).length} tasks
                        </span>
                        {" | "}
                        <span className="text-muted-foreground">
                          {packet.estimatedHours as number}h estimated
                        </span>
                        {packet.breakingRisk !== "none" && (
                          <>
                            {" | "}
                            <span className={cn(
                              packet.breakingRisk === "high" && "text-red-500",
                              packet.breakingRisk === "medium" && "text-yellow-500"
                            )}>
                              {packet.breakingRisk as string} breaking risk
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="mt-4">
              <Button className="w-full">
                <Package className="h-4 w-4 mr-2" />
                Create All Packets
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Helper to parse code input with file markers
function parseCodeInput(input: string): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = []
  const fileMarkerRegex = /^=== FILE:\s*(.+?)\s*===/gm

  const parts = input.split(fileMarkerRegex)

  if (parts.length === 1) {
    // No markers found, treat as single file
    return [{ path: "untitled.ts", content: input }]
  }

  // parts alternates between content before/after markers and the captured path
  for (let i = 1; i < parts.length; i += 2) {
    const path = parts[i].trim()
    const content = parts[i + 1]?.trim() || ""
    if (path && content) {
      files.push({ path, content })
    }
  }

  return files
}
