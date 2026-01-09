"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Play,
  Square,
  ExternalLink,
  Camera,
  Send,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Rocket,
  MessageSquare,
  Wrench,
  Eye,
  Monitor,
  Bug,
  Sparkles,
  Clock,
  Terminal
} from "lucide-react"

// Project type configurations with run commands
const PROJECT_TYPES = {
  flutter: {
    name: "Flutter",
    runCommand: "flutter run -d chrome --web-port=8080",
    devCommand: "flutter run -d chrome --web-port=8080",
    buildCommand: "flutter build web",
    defaultPort: 8080,
    icon: "mobile"
  },
  rust: {
    name: "Rust",
    runCommand: "cargo run",
    devCommand: "cargo watch -x run",
    buildCommand: "cargo build --release",
    defaultPort: 8080,
    icon: "rust"
  },
  nextjs: {
    name: "Next.js",
    runCommand: "npm run dev",
    devCommand: "npm run dev",
    buildCommand: "npm run build",
    defaultPort: 3000,
    icon: "react"
  },
  nuxt: {
    name: "Nuxt",
    runCommand: "npm run dev",
    devCommand: "npm run dev",
    buildCommand: "npm run build",
    defaultPort: 3000,
    icon: "vue"
  },
  svelte: {
    name: "SvelteKit",
    runCommand: "npm run dev",
    devCommand: "npm run dev",
    buildCommand: "npm run build",
    defaultPort: 5173,
    icon: "svelte"
  },
  react: {
    name: "React",
    runCommand: "npm start",
    devCommand: "npm start",
    buildCommand: "npm run build",
    defaultPort: 3000,
    icon: "react"
  },
  vue: {
    name: "Vue",
    runCommand: "npm run dev",
    devCommand: "npm run dev",
    buildCommand: "npm run build",
    defaultPort: 5173,
    icon: "vue"
  },
  node: {
    name: "Node.js",
    runCommand: "npm start",
    devCommand: "npm run dev",
    buildCommand: "npm run build",
    defaultPort: 3000,
    icon: "node"
  },
  python: {
    name: "Python",
    runCommand: "python main.py",
    devCommand: "python main.py",
    buildCommand: "pip install -r requirements.txt",
    defaultPort: 8000,
    icon: "python"
  },
  django: {
    name: "Django",
    runCommand: "python manage.py runserver 0.0.0.0:8000",
    devCommand: "python manage.py runserver 0.0.0.0:8000",
    buildCommand: "pip install -r requirements.txt",
    defaultPort: 8000,
    icon: "python"
  },
  fastapi: {
    name: "FastAPI",
    runCommand: "uvicorn main:app --host 0.0.0.0 --port 8000 --reload",
    devCommand: "uvicorn main:app --host 0.0.0.0 --port 8000 --reload",
    buildCommand: "pip install -r requirements.txt",
    defaultPort: 8000,
    icon: "python"
  },
  flask: {
    name: "Flask",
    runCommand: "flask run --host=0.0.0.0 --port=5000",
    devCommand: "flask run --host=0.0.0.0 --port=5000 --debug",
    buildCommand: "pip install -r requirements.txt",
    defaultPort: 5000,
    icon: "python"
  }
} as const

type ProjectType = keyof typeof PROJECT_TYPES

interface FeedbackItem {
  id: string
  text: string
  screenshot?: string
  timestamp: Date
  status: "pending" | "processing" | "fixed" | "failed"
  workPacketId?: string
}

interface LaunchTestPanelProps {
  project: {
    id: string
    name: string
    description: string
    workingDirectory?: string
    repos: Array<{
      provider: string
      id: number
      name: string
      path: string
      url: string
      localPath?: string
    }>
  }
  className?: string
}

type AppStatus = "idle" | "detecting" | "building" | "launching" | "running" | "error" | "stopped"
type VerificationStatus = "idle" | "connecting" | "testing" | "passed" | "failed"

/**
 * Launch & Test Panel
 *
 * One-click launch for any project type with:
 * - Auto-detection of project type (Flutter, Node, Python, etc.)
 * - Live feedback collection with screenshots
 * - Auto-fix workflow with visual verification
 */
export function LaunchTestPanel({ project, className }: LaunchTestPanelProps) {
  // App launch state
  const [appStatus, setAppStatus] = React.useState<AppStatus>("idle")
  const [projectType, setProjectType] = React.useState<ProjectType | null>(null)
  const [appUrl, setAppUrl] = React.useState<string | null>(null)
  const [appPort, setAppPort] = React.useState<number>(3000)
  const [launchError, setLaunchError] = React.useState<string | null>(null)
  const [processId, setProcessId] = React.useState<string | null>(null)
  const [launchLogs, setLaunchLogs] = React.useState<string[]>([])

  // Feedback state
  const [feedbackText, setFeedbackText] = React.useState("")
  const [feedbackItems, setFeedbackItems] = React.useState<FeedbackItem[]>([])
  const [isCapturingScreenshot, setIsCapturingScreenshot] = React.useState(false)
  const [currentScreenshot, setCurrentScreenshot] = React.useState<string | null>(null)

  // Auto-fix state
  const [isFixing, setIsFixing] = React.useState(false)
  const [fixProgress, setFixProgress] = React.useState(0)
  const [fixStage, setFixStage] = React.useState<string>("")

  // Visual verification state
  const [verificationStatus, setVerificationStatus] = React.useState<VerificationStatus>("idle")
  const [verificationScreenshot, setVerificationScreenshot] = React.useState<string | null>(null)
  const [verificationResult, setVerificationResult] = React.useState<{
    passed: boolean
    issues?: string[]
  } | null>(null)

  // Visual Testing VM config
  const VISUAL_TEST_VM = {
    host: "172.18.22.114",
    user: "johnny-test",
    display: ":1"
  }

  // Get working directory - priority: workingDirectory > repo localPath > fallback
  // NOTE: repo.path is the REMOTE path (e.g., "user/repo"), not local!
  const workingDirectory = React.useMemo(() => {
    // 1. Project's explicit working directory (best option)
    if (project.workingDirectory) {
      return project.workingDirectory
    }
    // 2. Repo's local path (if cloned locally)
    const repoWithLocalPath = project.repos.find(r => r.localPath)
    if (repoWithLocalPath?.localPath) {
      return repoWithLocalPath.localPath
    }
    // 3. Fallback - but this likely won't work
    return null
  }, [project.workingDirectory, project.repos])

  // For backwards compatibility
  const repoPath = workingDirectory || `/tmp/claudia-projects/${project.id}`

  // Detect project type on mount - only if we have a valid working directory
  React.useEffect(() => {
    if (workingDirectory) {
      detectProjectType()
    } else {
      addLog("No working directory configured - set it in project settings or link a repo with local path")
    }
  }, [workingDirectory])

  const addLog = (message: string) => {
    setLaunchLogs(prev => [...prev.slice(-50), `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  const detectProjectType = async () => {
    if (!workingDirectory) {
      addLog("Cannot detect project type: no working directory set")
      return
    }

    setAppStatus("detecting")
    addLog(`Scanning: ${workingDirectory}`)

    try {
      const response = await fetch("/api/launch-test/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoPath: workingDirectory,
          projectId: project.id
        })
      })

      const data = await response.json()

      if (data.projectType && PROJECT_TYPES[data.projectType as ProjectType]) {
        setProjectType(data.projectType)
        setAppPort(PROJECT_TYPES[data.projectType as ProjectType]?.defaultPort || 3000)
        const detectedBy = data.detectedBy ? ` (via ${data.detectedBy})` : ""
        addLog(`Detected: ${PROJECT_TYPES[data.projectType as ProjectType]?.name}${detectedBy}`)
      } else if (data.error) {
        addLog(`Detection failed: ${data.error}`)
        if (data.suggestion) {
          addLog(`Suggestion: ${data.suggestion}`)
        }
      } else {
        addLog("Could not auto-detect project type - select manually")
      }

      setAppStatus("idle")
    } catch (error) {
      addLog(`Detection error: ${error instanceof Error ? error.message : "Unknown"}`)
      setAppStatus("idle")
    }
  }

  const handleLaunch = async () => {
    if (!projectType) {
      setLaunchError("Please select a project type first")
      return
    }

    if (!workingDirectory) {
      setLaunchError("No working directory configured. Set it in project settings or link a repo with local path.")
      return
    }

    setAppStatus("launching")
    setLaunchError(null)
    addLog(`Launching ${PROJECT_TYPES[projectType].name} app in ${workingDirectory}...`)

    try {
      const response = await fetch("/api/launch-test/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          repoPath: workingDirectory,
          projectType,
          command: PROJECT_TYPES[projectType].runCommand,
          port: appPort
        })
      })

      const data = await response.json()

      if (data.success) {
        setProcessId(data.processId)
        setAppUrl(data.url || `http://localhost:${appPort}`)
        setAppStatus("running")
        addLog(`App running at ${data.url || `http://localhost:${appPort}`}`)
      } else {
        setLaunchError(data.error || "Failed to launch app")
        setAppStatus("error")
        addLog(`Launch failed: ${data.error}`)
        if (data.stderr) {
          addLog(`stderr: ${data.stderr.substring(0, 200)}`)
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Launch failed"
      setLaunchError(message)
      setAppStatus("error")
      addLog(`Error: ${message}`)
    }
  }

  const handleStop = async () => {
    if (!processId) return

    addLog("Stopping app...")

    try {
      await fetch("/api/launch-test/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processId })
      })

      setAppStatus("stopped")
      setProcessId(null)
      setAppUrl(null)
      addLog("App stopped")
    } catch (error) {
      addLog(`Stop error: ${error instanceof Error ? error.message : "Unknown"}`)
    }
  }

  const handleCaptureScreenshot = async () => {
    setIsCapturingScreenshot(true)

    try {
      // Capture screenshot from the visual testing VM
      const response = await fetch("/api/launch-test/screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vmHost: VISUAL_TEST_VM.host,
          vmUser: VISUAL_TEST_VM.user,
          display: VISUAL_TEST_VM.display,
          url: appUrl
        })
      })

      const data = await response.json()

      if (data.screenshot) {
        setCurrentScreenshot(data.screenshot)
        addLog("Screenshot captured")
      } else {
        addLog("Failed to capture screenshot")
      }
    } catch (error) {
      addLog(`Screenshot error: ${error instanceof Error ? error.message : "Unknown"}`)
    } finally {
      setIsCapturingScreenshot(false)
    }
  }

  const handleSubmitFeedback = () => {
    if (!feedbackText.trim()) return

    const newFeedback: FeedbackItem = {
      id: `feedback-${Date.now()}`,
      text: feedbackText.trim(),
      screenshot: currentScreenshot || undefined,
      timestamp: new Date(),
      status: "pending"
    }

    setFeedbackItems(prev => [...prev, newFeedback])
    setFeedbackText("")
    setCurrentScreenshot(null)
    addLog(`Feedback recorded: "${feedbackText.substring(0, 50)}..."`)
  }

  const handleAutoFix = async () => {
    const pendingFeedback = feedbackItems.filter(f => f.status === "pending")
    if (pendingFeedback.length === 0) return

    setIsFixing(true)
    setFixProgress(0)
    setFixStage("Converting feedback to work packets...")

    try {
      // Step 1: Convert feedback to work packets
      addLog(`Converting ${pendingFeedback.length} feedback items to work packets...`)

      const packetsResponse = await fetch("/api/launch-test/create-packets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          projectName: project.name,
          feedbackItems: pendingFeedback
        })
      })

      const packetsData = await packetsResponse.json()
      setFixProgress(20)

      if (!packetsData.packets?.length) {
        throw new Error("Failed to create work packets from feedback")
      }

      // Update feedback items with packet IDs
      setFeedbackItems(prev => prev.map(f => {
        const packet = packetsData.packets.find((p: { feedbackId: string; id: string }) => p.feedbackId === f.id)
        if (packet) {
          return { ...f, status: "processing" as const, workPacketId: packet.id }
        }
        return f
      }))

      // Step 2: Execute fixes
      setFixStage("Executing fixes...")
      addLog(`Executing ${packetsData.packets.length} work packets...`)

      for (let i = 0; i < packetsData.packets.length; i++) {
        const packet = packetsData.packets[i]

        setFixProgress(20 + Math.round((i / packetsData.packets.length) * 40))
        addLog(`Fixing: ${packet.title}`)

        const executeResponse = await fetch("/api/claude-execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: project.id,
            projectName: project.name,
            repoPath,
            packet: {
              id: packet.id,
              title: packet.title,
              description: packet.description,
              type: "bug_fix",
              priority: "high",
              tasks: packet.tasks || [],
              acceptanceCriteria: packet.acceptanceCriteria || []
            },
            options: {
              maxIterations: 5,
              runTests: true,
              createCommit: true,
              mode: "auto"
            }
          })
        })

        const executeData = await executeResponse.json()

        if (executeData.success) {
          setFeedbackItems(prev => prev.map(f =>
            f.workPacketId === packet.id ? { ...f, status: "fixed" as const } : f
          ))
          addLog(`Fixed: ${packet.title}`)
        } else {
          setFeedbackItems(prev => prev.map(f =>
            f.workPacketId === packet.id ? { ...f, status: "failed" as const } : f
          ))
          addLog(`Failed to fix: ${packet.title} - ${executeData.error}`)
        }
      }

      setFixProgress(60)

      // Step 3: Rebuild and restart
      setFixStage("Rebuilding application...")
      addLog("Rebuilding application...")

      // Stop current app if running
      if (processId) {
        await handleStop()
      }

      // Rebuild
      const buildResponse = await fetch("/api/launch-test/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          repoPath,
          projectType,
          command: PROJECT_TYPES[projectType!].buildCommand
        })
      })

      const buildData = await buildResponse.json()
      setFixProgress(75)

      if (!buildData.success) {
        addLog(`Build warning: ${buildData.error}`)
      } else {
        addLog("Build completed successfully")
      }

      // Restart app
      setFixStage("Restarting application...")
      await handleLaunch()
      setFixProgress(85)

      // Step 4: Visual verification
      setFixStage("Running visual verification...")
      await runVisualVerification()
      setFixProgress(100)

      setFixStage("Complete!")
      addLog("Auto-fix cycle completed")

    } catch (error) {
      const message = error instanceof Error ? error.message : "Auto-fix failed"
      addLog(`Auto-fix error: ${message}`)
      setFixStage(`Error: ${message}`)
    } finally {
      setIsFixing(false)
    }
  }

  const runVisualVerification = async () => {
    setVerificationStatus("connecting")
    addLog("Connecting to visual testing VM...")

    try {
      // Take screenshot on visual testing VM
      setVerificationStatus("testing")
      addLog(`Taking verification screenshot at ${appUrl}...`)

      const response = await fetch("/api/launch-test/visual-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vmHost: VISUAL_TEST_VM.host,
          vmUser: VISUAL_TEST_VM.user,
          display: VISUAL_TEST_VM.display,
          url: appUrl,
          projectId: project.id,
          feedbackItems: feedbackItems.filter(f => f.status === "fixed")
        })
      })

      const data = await response.json()

      if (data.screenshot) {
        setVerificationScreenshot(data.screenshot)
      }

      setVerificationResult({
        passed: data.passed ?? true,
        issues: data.issues || []
      })

      if (data.passed) {
        setVerificationStatus("passed")
        addLog("Visual verification PASSED - all fixes verified!")
      } else {
        setVerificationStatus("failed")
        addLog(`Visual verification found issues: ${data.issues?.join(", ")}`)
      }

    } catch (error) {
      setVerificationStatus("failed")
      setVerificationResult({
        passed: false,
        issues: [error instanceof Error ? error.message : "Verification failed"]
      })
      addLog(`Verification error: ${error instanceof Error ? error.message : "Unknown"}`)
    }
  }

  const getStatusColor = () => {
    switch (appStatus) {
      case "running": return "text-green-500"
      case "launching": return "text-yellow-500"
      case "building": return "text-blue-500"
      case "error": return "text-red-500"
      case "stopped": return "text-gray-500"
      default: return "text-gray-400"
    }
  }

  const getStatusIcon = () => {
    switch (appStatus) {
      case "running": return <CheckCircle className="h-5 w-5 text-green-500" />
      case "launching": return <Loader2 className="h-5 w-5 text-yellow-500 animate-spin" />
      case "building": return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
      case "error": return <XCircle className="h-5 w-5 text-red-500" />
      case "stopped": return <Square className="h-5 w-5 text-gray-500" />
      case "detecting": return <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
      default: return <Monitor className="h-5 w-5 text-gray-400" />
    }
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Warning if no working directory */}
      {!workingDirectory && (
        <Card className="border-yellow-500/30 bg-yellow-500/10">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-400">No Working Directory Configured</p>
                <p className="text-sm text-yellow-400/70 mt-1">
                  To launch and test your app, you need to configure a working directory:
                </p>
                <ul className="text-sm text-yellow-400/70 mt-2 ml-4 list-disc space-y-1">
                  <li>Set the local path for a linked repository in the Repos tab</li>
                  <li>Or initialize a project folder in the Overview tab</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Launch Section */}
      <Card className="border-blue-500/20 bg-gradient-to-br from-blue-950/30 to-gray-900/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-blue-400" />
            Launch & Test
          </CardTitle>
          {workingDirectory && (
            <p className="text-xs text-muted-foreground font-mono mt-1">
              {workingDirectory}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Project Type Detection */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm text-muted-foreground mb-2 block">Project Type</label>
              <div className="flex items-center gap-2">
                <select
                  value={projectType || ""}
                  onChange={(e) => setProjectType(e.target.value as ProjectType)}
                  className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  disabled={appStatus === "running"}
                >
                  <option value="">Auto-detect...</option>
                  {Object.entries(PROJECT_TYPES).map(([key, config]) => (
                    <option key={key} value={key}>
                      {config.name}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={detectProjectType}
                  disabled={!workingDirectory || appStatus === "detecting" || appStatus === "running"}
                  title={!workingDirectory ? "Set working directory first" : "Re-detect project type"}
                >
                  <RefreshCw className={cn("h-4 w-4", appStatus === "detecting" && "animate-spin")} />
                </Button>
              </div>
            </div>
            <div className="w-32">
              <label className="text-sm text-muted-foreground mb-2 block">Port</label>
              <input
                type="number"
                value={appPort}
                onChange={(e) => setAppPort(parseInt(e.target.value) || 3000)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={appStatus === "running"}
              />
            </div>
          </div>

          {/* Launch Controls */}
          <div className="flex items-center gap-4">
            <Button
              size="lg"
              className={cn(
                "flex-1 h-14 text-lg font-bold",
                appStatus === "running"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500"
              )}
              onClick={appStatus === "running" ? handleStop : handleLaunch}
              disabled={!workingDirectory || !projectType || appStatus === "launching" || appStatus === "building"}
            >
              {appStatus === "running" ? (
                <>
                  <Square className="h-5 w-5 mr-2" />
                  Stop App
                </>
              ) : appStatus === "launching" ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Launching...
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 mr-2" />
                  Launch App
                </>
              )}
            </Button>

            {/* Status Badge */}
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className={cn("text-sm font-medium capitalize", getStatusColor())}>
                {appStatus}
              </span>
            </div>
          </div>

          {/* App URL */}
          {appUrl && appStatus === "running" && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-400">App running at:</span>
              <a
                href={appUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-green-300 hover:text-green-200 underline flex items-center gap-1"
              >
                {appUrl}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Error Display */}
          {launchError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
              <div>
                <p className="text-sm text-red-400 font-medium">Launch Error</p>
                <p className="text-xs text-red-400/70">{launchError}</p>
              </div>
            </div>
          )}

          {/* Launch Logs */}
          <div className="p-3 rounded-lg bg-gray-900/50 border border-gray-700/50">
            <div className="flex items-center gap-2 mb-2">
              <Terminal className="h-4 w-4 text-gray-400" />
              <span className="text-xs text-gray-400">Launch Log</span>
            </div>
            <ScrollArea className="h-24">
              <div className="font-mono text-xs text-gray-500 space-y-0.5">
                {launchLogs.length === 0 ? (
                  <p className="text-gray-600">Waiting for launch...</p>
                ) : (
                  launchLogs.map((log, i) => (
                    <p key={i} className={cn(
                      log.includes("Error") || log.includes("Failed") ? "text-red-400" :
                      log.includes("running") || log.includes("success") ? "text-green-400" :
                      "text-gray-500"
                    )}>
                      {log}
                    </p>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      {/* Feedback Section */}
      <Card className="border-orange-500/20 bg-gradient-to-br from-orange-950/30 to-gray-900/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-orange-400" />
            Report Issues
            {feedbackItems.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {feedbackItems.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Feedback Input */}
          <div className="space-y-3">
            <Textarea
              placeholder="Describe what you don't like or what's broken... (e.g., 'The button color is too dark' or 'The form doesn't submit properly')"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              className="min-h-[80px] resize-none"
            />

            {/* Screenshot Preview */}
            {currentScreenshot && (
              <div className="relative rounded-lg overflow-hidden border border-orange-500/30">
                <img
                  src={currentScreenshot}
                  alt="Screenshot"
                  className="w-full max-h-48 object-contain bg-gray-900"
                />
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => setCurrentScreenshot(null)}
                >
                  Remove
                </Button>
              </div>
            )}

            {/* Feedback Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCaptureScreenshot}
                disabled={appStatus !== "running" || isCapturingScreenshot}
              >
                {isCapturingScreenshot ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4 mr-2" />
                )}
                Capture Screenshot
              </Button>
              <div className="flex-1" />
              <Button
                onClick={handleSubmitFeedback}
                disabled={!feedbackText.trim()}
              >
                <Send className="h-4 w-4 mr-2" />
                Add Issue
              </Button>
            </div>
          </div>

          {/* Feedback List */}
          {feedbackItems.length > 0 && (
            <div className="space-y-2 pt-4 border-t border-gray-700/50">
              <h4 className="text-sm font-medium text-gray-300">Reported Issues</h4>
              <ScrollArea className="max-h-48">
                <div className="space-y-2">
                  {feedbackItems.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "p-3 rounded-lg border",
                        item.status === "fixed" ? "bg-green-500/10 border-green-500/30" :
                        item.status === "failed" ? "bg-red-500/10 border-red-500/30" :
                        item.status === "processing" ? "bg-blue-500/10 border-blue-500/30" :
                        "bg-gray-800/50 border-gray-700/50"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {item.screenshot && (
                          <img
                            src={item.screenshot}
                            alt="Screenshot"
                            className="w-16 h-16 object-cover rounded border border-gray-600"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-200">{item.text}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="h-3 w-3 text-gray-500" />
                            <span className="text-xs text-gray-500">
                              {item.timestamp.toLocaleTimeString()}
                            </span>
                            <Badge
                              variant={
                                item.status === "fixed" ? "default" :
                                item.status === "failed" ? "destructive" :
                                item.status === "processing" ? "secondary" :
                                "outline"
                              }
                              className="text-xs"
                            >
                              {item.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auto-Fix Section */}
      <Card className="border-purple-500/20 bg-gradient-to-br from-purple-950/30 to-gray-900/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-purple-400" />
            Auto-Fix & Verify
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Fix Progress */}
          {isFixing && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 text-purple-400 animate-spin" />
                <span className="text-sm text-purple-300">{fixStage}</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                  style={{ width: `${fixProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Fix Button */}
          <Button
            size="lg"
            className="w-full h-14 text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
            onClick={handleAutoFix}
            disabled={
              isFixing ||
              feedbackItems.filter(f => f.status === "pending").length === 0 ||
              appStatus !== "running"
            }
          >
            {isFixing ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Fixing...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 mr-2" />
                Fix All Issues ({feedbackItems.filter(f => f.status === "pending").length})
              </>
            )}
          </Button>

          <p className="text-xs text-gray-500 text-center">
            This will convert feedback to work packets, execute fixes, rebuild the app,
            and run visual verification on the testing VM
          </p>

          {/* Visual Verification Status */}
          {verificationStatus !== "idle" && (
            <div className={cn(
              "p-4 rounded-lg border",
              verificationStatus === "passed" ? "bg-green-500/10 border-green-500/30" :
              verificationStatus === "failed" ? "bg-red-500/10 border-red-500/30" :
              "bg-blue-500/10 border-blue-500/30"
            )}>
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  verificationStatus === "passed" ? "bg-green-500/20" :
                  verificationStatus === "failed" ? "bg-red-500/20" :
                  "bg-blue-500/20"
                )}>
                  {verificationStatus === "passed" ? (
                    <Eye className="h-5 w-5 text-green-400" />
                  ) : verificationStatus === "failed" ? (
                    <Bug className="h-5 w-5 text-red-400" />
                  ) : (
                    <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={cn(
                    "font-medium",
                    verificationStatus === "passed" ? "text-green-300" :
                    verificationStatus === "failed" ? "text-red-300" :
                    "text-blue-300"
                  )}>
                    {verificationStatus === "passed" ? "Visual Verification Passed!" :
                     verificationStatus === "failed" ? "Visual Verification Failed" :
                     verificationStatus === "testing" ? "Running Visual Tests..." :
                     "Connecting to Testing VM..."}
                  </p>
                  {verificationResult?.issues && verificationResult.issues.length > 0 && (
                    <ul className="text-xs text-red-400/70 mt-1">
                      {verificationResult.issues.map((issue, i) => (
                        <li key={i}>- {issue}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Verification Screenshot */}
              {verificationScreenshot && (
                <div className="mt-3 rounded-lg overflow-hidden border border-gray-600">
                  <img
                    src={verificationScreenshot}
                    alt="Verification Screenshot"
                    className="w-full object-contain bg-gray-900"
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default LaunchTestPanel
