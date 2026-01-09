"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  Key,
  DollarSign,
  Calendar,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
  Shield,
  Zap,
} from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"

interface BudgetStatus {
  userId: string
  apiKeySource: "provided" | "own"
  hasOwnApiKey: boolean
  budget: number
  spent: number
  remaining: number
  percentUsed: number
  resetDate: string
  daysUntilReset: number
  isOverBudget: boolean
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount)
}

export default function ApiKeysPage() {
  const { user } = useAuth()
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // API key form
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false)
  const [newApiKey, setNewApiKey] = useState("")
  const [showApiKey, setShowApiKey] = useState(false)
  const [testingKey, setTestingKey] = useState(false)
  const [keyTestResult, setKeyTestResult] = useState<"idle" | "success" | "error">("idle")
  const [keyTestError, setKeyTestError] = useState("")

  const fetchBudgetStatus = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/user/budget")
      if (!res.ok) throw new Error("Failed to fetch budget status")
      const data = await res.json()
      setBudgetStatus(data.budget)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load budget")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBudgetStatus()
  }, [])

  const handleTestApiKey = async () => {
    if (!newApiKey) return
    setTestingKey(true)
    setKeyTestResult("idle")
    setKeyTestError("")

    try {
      const res = await fetch("/api/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "anthropic", apiKey: newApiKey }),
      })
      const data = await res.json()

      if (data.valid) {
        setKeyTestResult("success")
      } else {
        setKeyTestResult("error")
        setKeyTestError(data.error || "Invalid API key")
      }
    } catch {
      setKeyTestResult("error")
      setKeyTestError("Connection failed")
    } finally {
      setTestingKey(false)
    }
  }

  const handleSaveApiKey = async () => {
    if (!newApiKey || keyTestResult !== "success") return
    setSaving(true)

    try {
      const res = await fetch("/api/user/budget", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKeySource: "own",
          anthropicApiKey: newApiKey,
        }),
      })

      if (!res.ok) throw new Error("Failed to save API key")

      // Refresh budget status
      await fetchBudgetStatus()
      setShowApiKeyDialog(false)
      setNewApiKey("")
      setKeyTestResult("idle")
    } catch (err) {
      setKeyTestError(err instanceof Error ? err.message : "Failed to save")
      setKeyTestResult("error")
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveApiKey = async () => {
    if (!confirm("Remove your API key and switch back to the provided budget?")) return
    setSaving(true)

    try {
      const res = await fetch("/api/user/budget", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKeySource: "provided",
          anthropicApiKey: null,
        }),
      })

      if (!res.ok) throw new Error("Failed to remove API key")

      await fetchBudgetStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove key")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <XCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg font-medium">Failed to load API settings</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button onClick={fetchBudgetStatus} className="mt-4 gap-2">
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    )
  }

  const isBetaTester = user?.role === "beta_tester" || user?.role === "beta"

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">API Keys & Budget</h1>
        <p className="text-sm text-muted-foreground">
          Manage your API access and usage budget
        </p>
      </div>

      {/* Budget Status Card - Only for beta testers using provided key */}
      {isBetaTester && budgetStatus && (
        <Card className={cn(
          budgetStatus.isOverBudget && "border-destructive/50 bg-destructive/5"
        )}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <CardTitle>API Usage Budget</CardTitle>
              </div>
              {budgetStatus.hasOwnApiKey ? (
                <Badge variant="success" className="gap-1">
                  <Key className="h-3 w-3" />
                  Using Own Key
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <Shield className="h-3 w-3" />
                  Provided Key
                </Badge>
              )}
            </div>
            <CardDescription>
              {budgetStatus.hasOwnApiKey
                ? "You are using your own Anthropic API key. No budget limits apply."
                : "Track your monthly API usage against your beta tester budget."
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!budgetStatus.hasOwnApiKey && (
              <>
                {/* Usage Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Used</span>
                    <span className="font-medium">
                      {formatCurrency(budgetStatus.spent)} / {formatCurrency(budgetStatus.budget)}
                    </span>
                  </div>
                  <Progress
                    value={budgetStatus.percentUsed}
                    className={cn(
                      "h-3",
                      budgetStatus.percentUsed >= 90 && "[&>div]:bg-destructive",
                      budgetStatus.percentUsed >= 80 && budgetStatus.percentUsed < 90 && "[&>div]:bg-yellow-500"
                    )}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{budgetStatus.percentUsed.toFixed(1)}% used</span>
                    <span>{formatCurrency(budgetStatus.remaining)} remaining</span>
                  </div>
                </div>

                {/* Budget Warning */}
                {budgetStatus.percentUsed >= 80 && (
                  <div className={cn(
                    "flex items-start gap-3 p-4 rounded-lg",
                    budgetStatus.isOverBudget
                      ? "bg-destructive/10 border border-destructive/30"
                      : "bg-yellow-500/10 border border-yellow-500/30"
                  )}>
                    <AlertCircle className={cn(
                      "h-5 w-5 mt-0.5",
                      budgetStatus.isOverBudget ? "text-destructive" : "text-yellow-500"
                    )} />
                    <div>
                      <p className={cn(
                        "font-medium",
                        budgetStatus.isOverBudget ? "text-destructive" : "text-yellow-600"
                      )}>
                        {budgetStatus.isOverBudget
                          ? "Budget Exceeded"
                          : "Budget Warning"
                        }
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {budgetStatus.isOverBudget
                          ? "You have exceeded your monthly API budget. Add your own API key to continue using paid features."
                          : `You have used ${budgetStatus.percentUsed.toFixed(0)}% of your monthly budget. Consider adding your own API key.`
                        }
                      </p>
                    </div>
                  </div>
                )}

                {/* Reset Date */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Budget resets on {formatDate(budgetStatus.resetDate)} ({budgetStatus.daysUntilReset} days)
                  </span>
                </div>
              </>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border text-center">
                <p className="text-2xl font-bold text-primary">
                  {budgetStatus.hasOwnApiKey ? "--" : formatCurrency(budgetStatus.spent)}
                </p>
                <p className="text-xs text-muted-foreground">Spent This Month</p>
              </div>
              <div className="p-4 rounded-lg border text-center">
                <p className="text-2xl font-bold text-green-500">
                  {budgetStatus.hasOwnApiKey ? "Unlimited" : formatCurrency(budgetStatus.remaining)}
                </p>
                <p className="text-xs text-muted-foreground">Remaining</p>
              </div>
              <div className="p-4 rounded-lg border text-center">
                <p className="text-2xl font-bold">
                  {budgetStatus.hasOwnApiKey ? "Own Key" : formatCurrency(budgetStatus.budget)}
                </p>
                <p className="text-xs text-muted-foreground">Monthly Budget</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* API Key Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Anthropic API Key
          </CardTitle>
          <CardDescription>
            Use your own Anthropic API key for unlimited access
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {budgetStatus?.hasOwnApiKey ? (
            <>
              <div className="flex items-center justify-between p-4 rounded-lg border bg-green-500/5 border-green-500/30">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">Your API Key is Active</p>
                    <p className="text-sm text-muted-foreground">
                      All API calls use your personal Anthropic account
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={handleRemoveApiKey}
                  disabled={saving}
                  className="gap-2"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  Remove Key
                </Button>
              </div>

              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  <strong>Benefits of using your own key:</strong>
                </p>
                <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>No monthly budget limits</li>
                  <li>Direct billing to your Anthropic account</li>
                  <li>Access to your personal rate limits</li>
                </ul>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Using Provided API Access</p>
                    <p className="text-sm text-muted-foreground">
                      Subject to monthly budget limits ({formatCurrency(budgetStatus?.budget || 10)}/month)
                    </p>
                  </div>
                </div>
                <Button onClick={() => setShowApiKeyDialog(true)} className="gap-2">
                  <Key className="h-4 w-4" />
                  Add Your Key
                </Button>
              </div>

              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-start gap-3">
                  <Zap className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-primary">Unlock Unlimited Access</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Add your own Anthropic API key to remove budget limits and get unlimited executions.
                      You will be billed directly by Anthropic based on your usage.
                    </p>
                    <a
                      href="https://console.anthropic.com/settings/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline mt-2 inline-block"
                    >
                      Get an API key from Anthropic Console
                    </a>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Usage Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
              <span>
                <strong>Local Mode is Free:</strong> Use LM Studio for unlimited local executions at no cost.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
              <span>
                <strong>Turbo Mode uses API:</strong> Claude Code (Turbo) and N8N modes count against your budget.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
              <span>
                <strong>Budget resets monthly:</strong> Your budget automatically resets on your reset date.
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Add API Key Dialog */}
      <Dialog open={showApiKeyDialog} onOpenChange={(open) => {
        setShowApiKeyDialog(open)
        if (!open) {
          setNewApiKey("")
          setKeyTestResult("idle")
          setKeyTestError("")
          setShowApiKey(false)
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Add Your Anthropic API Key
            </DialogTitle>
            <DialogDescription>
              Enter your personal Anthropic API key to unlock unlimited access
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="apiKey"
                    type={showApiKey ? "text" : "password"}
                    placeholder="sk-ant-api03-..."
                    value={newApiKey}
                    onChange={(e) => {
                      setNewApiKey(e.target.value)
                      setKeyTestResult("idle")
                    }}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  variant="outline"
                  onClick={handleTestApiKey}
                  disabled={!newApiKey || testingKey}
                >
                  {testingKey ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Test"
                  )}
                </Button>
              </div>
              {keyTestResult === "success" && (
                <p className="text-xs text-green-500 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  API key is valid
                </p>
              )}
              {keyTestResult === "error" && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  {keyTestError}
                </p>
              )}
            </div>

            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <p className="text-muted-foreground">
                Your API key is stored securely and only used for API calls from this application.
                You can remove it at any time.
              </p>
            </div>

            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              Get an API key from Anthropic Console
            </a>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApiKeyDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveApiKey}
              disabled={keyTestResult !== "success" || saving}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Save API Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
