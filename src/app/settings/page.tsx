"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Settings,
  Server,
  Key,
  Bell,
  Shield,
  Palette,
  Save,
  RefreshCw,
  CheckCircle,
  XCircle,
  ExternalLink,
  Cpu,
  Cloud,
  GitBranch,
  Mic,
  DollarSign,
  Zap
} from "lucide-react"

interface ServiceStatus {
  name: string
  url: string
  status: "connected" | "disconnected" | "error"
  latency?: number
}

interface SettingToggle {
  id: string
  label: string
  description: string
  enabled: boolean
}

const mockServices: ServiceStatus[] = [
  { name: "n8n Orchestrator", url: "http://orangepi:5678", status: "connected", latency: 45 },
  { name: "LM Studio BEAST", url: "http://192.168.245.155:1234", status: "connected", latency: 23 },
  { name: "LM Studio BEDROOM", url: "http://192.168.27.182:1234", status: "connected", latency: 31 },
  { name: "GitLab", url: "http://192.168.245.211:8929", status: "connected", latency: 12 },
  { name: "Linear", url: "api.linear.app", status: "connected", latency: 89 },
  { name: "Claude API", url: "api.anthropic.com", status: "connected", latency: 156 },
]

const statusConfig = {
  connected: { label: "Connected", color: "text-green-400", bg: "bg-green-400" },
  disconnected: { label: "Disconnected", color: "text-muted-foreground", bg: "bg-muted-foreground" },
  error: { label: "Error", color: "text-red-400", bg: "bg-red-400" }
}

export default function SettingsPage() {
  const [services] = useState<ServiceStatus[]>(mockServices)
  const [activeTab, setActiveTab] = useState<string>("connections")

  const [notifications, setNotifications] = useState<SettingToggle[]>([
    { id: "n1", label: "Approval Requests", description: "Get notified when human approval is needed", enabled: true },
    { id: "n2", label: "Error Alerts", description: "Immediate alerts for build failures and errors", enabled: true },
    { id: "n3", label: "Daily Summary", description: "Daily email summary of all activity", enabled: false },
    { id: "n4", label: "Cost Alerts", description: "Alert when approaching budget limits", enabled: true },
    { id: "n5", label: "Completion Notifications", description: "Notify when packets complete", enabled: false }
  ])

  const [automationSettings, setAutomationSettings] = useState<SettingToggle[]>([
    { id: "a1", label: "Auto-start Queued Packets", description: "Automatically start packets when agents are available", enabled: true },
    { id: "a2", label: "Auto-retry Failed Builds", description: "Retry failed builds up to 3 times", enabled: true },
    { id: "a3", label: "Auto-merge on Approval", description: "Merge PRs automatically after approval", enabled: false },
    { id: "a4", label: "Auto-deploy to Staging", description: "Deploy to staging after tests pass", enabled: true },
    { id: "a5", label: "Ralph Wiggum Loop", description: "Keep iterating until all tests pass", enabled: true }
  ])

  const tabs = [
    { id: "connections", label: "Connections", icon: Server },
    { id: "api-keys", label: "API Keys", icon: Key },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "automation", label: "Automation", icon: Zap },
    { id: "security", label: "Security", icon: Shield },
    { id: "appearance", label: "Appearance", icon: Palette }
  ]

  const toggleSetting = (list: SettingToggle[], setList: React.Dispatch<React.SetStateAction<SettingToggle[]>>, id: string) => {
    setList(list.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s))
  }

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure your development pipeline
          </p>
        </div>
        <Button className="gap-2">
          <Save className="h-4 w-4" />
          Save Changes
        </Button>
      </div>

      {/* Main Layout */}
      <div className="grid gap-6 lg:grid-cols-4">
        {/* Sidebar */}
        <Card className="lg:col-span-1 h-fit">
          <CardContent className="p-2">
            <nav className="space-y-1">
              {tabs.map(tab => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left",
                      activeTab === tab.id
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                )
              })}
            </nav>
          </CardContent>
        </Card>

        {/* Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Connections Tab */}
          {activeTab === "connections" && (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Service Connections</CardTitle>
                      <CardDescription>Manage connections to external services and agents</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" className="gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Test All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {services.map(service => {
                    const config = statusConfig[service.status]
                    return (
                      <div
                        key={service.name}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn("h-2 w-2 rounded-full", config.bg)} />
                          <div>
                            <p className="font-medium">{service.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{service.url}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {service.latency && (
                            <span className="text-xs text-muted-foreground">
                              {service.latency}ms
                            </span>
                          )}
                          <Badge variant={service.status === "connected" ? "success" : "destructive"}>
                            {config.label}
                          </Badge>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Add New Connection</CardTitle>
                  <CardDescription>Connect a new service or agent</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { icon: Cpu, label: "LM Studio", desc: "Local AI model" },
                      { icon: Cloud, label: "API Service", desc: "External API" },
                      { icon: GitBranch, label: "Git Remote", desc: "Repository" }
                    ].map(item => {
                      const Icon = item.icon
                      return (
                        <button
                          key={item.label}
                          className="flex flex-col items-center gap-2 p-4 rounded-lg border border-dashed hover:border-primary hover:bg-accent/50 transition-colors"
                        >
                          <Icon className="h-8 w-8 text-muted-foreground" />
                          <div className="text-center">
                            <p className="font-medium text-sm">{item.label}</p>
                            <p className="text-xs text-muted-foreground">{item.desc}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* API Keys Tab */}
          {activeTab === "api-keys" && (
            <Card>
              <CardHeader>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>Manage API keys for external services</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { name: "n8n API Key", service: "n8n", masked: "eyJhb...5NiJ9", lastUsed: "2 minutes ago" },
                  { name: "Linear API Key", service: "Linear", masked: "lin_api...zFB5", lastUsed: "15 minutes ago" },
                  { name: "Claude API Key", service: "Anthropic", masked: "sk-ant...xxxx", lastUsed: "Just now" },
                  { name: "GitLab SSH Key", service: "GitLab", masked: "SHA256:xxxx...xxxx", lastUsed: "1 hour ago" }
                ].map(key => (
                  <div key={key.name} className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <p className="font-medium">{key.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {key.service} • Last used: {key.lastUsed}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 rounded bg-muted text-xs font-mono">
                        {key.masked}
                      </code>
                      <Button variant="outline" size="sm">Rotate</Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" className="w-full gap-2">
                  <Key className="h-4 w-4" />
                  Add API Key
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Notifications Tab */}
          {activeTab === "notifications" && (
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Control how and when you receive notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {notifications.map(setting => (
                  <div
                    key={setting.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div>
                      <p className="font-medium">{setting.label}</p>
                      <p className="text-sm text-muted-foreground">{setting.description}</p>
                    </div>
                    <button
                      onClick={() => toggleSetting(notifications, setNotifications, setting.id)}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                        setting.enabled ? "bg-primary" : "bg-muted"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                          setting.enabled ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Automation Tab */}
          {activeTab === "automation" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Automation Settings</CardTitle>
                  <CardDescription>Configure automatic behaviors for the pipeline</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {automationSettings.map(setting => (
                    <div
                      key={setting.id}
                      className="flex items-center justify-between p-4 rounded-lg border"
                    >
                      <div>
                        <p className="font-medium">{setting.label}</p>
                        <p className="text-sm text-muted-foreground">{setting.description}</p>
                      </div>
                      <button
                        onClick={() => toggleSetting(automationSettings, setAutomationSettings, setting.id)}
                        className={cn(
                          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                          setting.enabled ? "bg-primary" : "bg-muted"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                            setting.enabled ? "translate-x-6" : "translate-x-1"
                          )}
                        />
                      </button>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Budget Limits</CardTitle>
                  <CardDescription>Set spending limits and alerts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Daily Budget</label>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <input
                          type="number"
                          defaultValue="35.00"
                          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Monthly Budget</label>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <input
                          type="number"
                          defaultValue="750.00"
                          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Alert Threshold</label>
                    <p className="text-xs text-muted-foreground">Alert when this percentage of budget is used</p>
                    <input
                      type="range"
                      min="50"
                      max="100"
                      defaultValue="80"
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>50%</span>
                      <span>80%</span>
                      <span>100%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Security Tab */}
          {activeTab === "security" && (
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>Manage security and access controls</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg border space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Require Approval for Deployments</p>
                      <p className="text-sm text-muted-foreground">All production deployments require human approval</p>
                    </div>
                    <Badge variant="success">Enabled</Badge>
                  </div>
                </div>
                <div className="p-4 rounded-lg border space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Secret Scanning</p>
                      <p className="text-sm text-muted-foreground">Prevent commits containing secrets</p>
                    </div>
                    <Badge variant="success">Enabled</Badge>
                  </div>
                </div>
                <div className="p-4 rounded-lg border space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Dependency Audit</p>
                      <p className="text-sm text-muted-foreground">Block packages with known vulnerabilities</p>
                    </div>
                    <Badge variant="warning">Warn Only</Badge>
                  </div>
                </div>
                <div className="p-4 rounded-lg border space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">API Rate Limiting</p>
                      <p className="text-sm text-muted-foreground">Limit API calls to prevent abuse</p>
                    </div>
                    <Badge variant="success">Enabled</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Appearance Tab */}
          {activeTab === "appearance" && (
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Customize the look and feel</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <label className="text-sm font-medium">Theme</label>
                  <div className="grid grid-cols-3 gap-4">
                    {["Dark", "Light", "System"].map(theme => (
                      <button
                        key={theme}
                        className={cn(
                          "p-4 rounded-lg border text-center transition-colors",
                          theme === "Dark" ? "border-primary bg-accent" : "hover:bg-accent/50"
                        )}
                      >
                        <p className="font-medium">{theme}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-medium">Accent Color</label>
                  <div className="flex gap-3">
                    {["blue", "green", "purple", "orange", "pink"].map(color => (
                      <button
                        key={color}
                        className={cn(
                          "h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-background transition-all",
                          color === "blue" && "bg-blue-500 ring-blue-500",
                          color === "green" && "bg-green-500 ring-transparent hover:ring-green-500",
                          color === "purple" && "bg-purple-500 ring-transparent hover:ring-purple-500",
                          color === "orange" && "bg-orange-500 ring-transparent hover:ring-orange-500",
                          color === "pink" && "bg-pink-500 ring-transparent hover:ring-pink-500"
                        )}
                      />
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-medium">Sidebar</label>
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <p className="font-medium">Collapsed by default</p>
                      <p className="text-sm text-muted-foreground">Start with sidebar collapsed</p>
                    </div>
                    <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-muted">
                      <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
