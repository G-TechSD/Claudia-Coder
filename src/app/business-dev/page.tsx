"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  Briefcase,
  Search,
  Filter,
  RefreshCw,
  ArrowUpRight,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Target,
  DollarSign,
  TrendingUp,
  Building2,
  Archive,
  Send,
  Eye,
  Plus,
  Mic,
  MicOff,
  Lightbulb,
  MessageSquare,
  Sparkles,
  Loader2,
  Bot,
  User,
  FolderOpen,
  Download,
  FileDown,
  Handshake,
  Megaphone,
  PiggyBank,
  ArrowLeft,
  X,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Play
} from "lucide-react"
import {
  getAllBusinessDevs,
  getBusinessDev
} from "@/lib/data/business-dev"
import { getAllProjects, fetchProjects, getProject } from "@/lib/data/projects"
import { useAuth } from "@/components/auth/auth-provider"
import type { BusinessDev, BusinessDevStatus, Project } from "@/lib/data/types"

// Web Speech API types
interface WebSpeechRecognitionEvent extends Event {
  results: WebSpeechRecognitionResultList;
  resultIndex: number;
}

interface WebSpeechRecognitionResultList {
  length: number;
  item(index: number): WebSpeechRecognitionResult;
  [index: number]: WebSpeechRecognitionResult;
}

interface WebSpeechRecognitionResult {
  length: number;
  item(index: number): WebSpeechRecognitionAlternative;
  [index: number]: WebSpeechRecognitionAlternative;
  isFinal: boolean;
}

interface WebSpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface WebSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: WebSpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

// Type for getting SpeechRecognition constructor from window
type WebSpeechRecognitionConstructor = new () => WebSpeechRecognition;

// ============ Types ============

type PageMode = "list" | "create" | "braindump" | "interview" | "analysis" | "chat"

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
}

interface AnalysisData {
  monetization: {
    strategies: Array<{
      name: string
      description: string
      pros: string[]
      cons: string[]
      estimatedRevenue: string
      timeToRevenue: string
      recommended: boolean
    }>
    primaryRecommendation: string
  }
  marketing: {
    channels: Array<{
      name: string
      description: string
      cost: string
      effectiveness: string
      timeframe: string
    }>
    strategy: string
    budget: string
  }
  partnerships: Array<{
    type: string
    examples: string[]
    benefits: string[]
    approach: string
  }>
  summary: string
}

// ============ Status Configuration ============

const statusConfig: Record<BusinessDevStatus, {
  label: string
  color: string
  icon: typeof FileText
  bg: string
}> = {
  draft: { label: "Draft", color: "text-yellow-500", icon: FileText, bg: "bg-yellow-500/10" },
  review: { label: "In Review", color: "text-blue-500", icon: Send, bg: "bg-blue-500/10" },
  approved: { label: "Approved", color: "text-green-500", icon: CheckCircle2, bg: "bg-green-500/10" },
  archived: { label: "Archived", color: "text-gray-400", icon: Archive, bg: "bg-gray-500/10" }
}

// ============ Helper Functions ============

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const diff = Date.now() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  return date.toLocaleDateString()
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}

// ============ Main Component ============

interface BusinessDevWithProject extends BusinessDev {
  projectName: string
}

export default function BusinessDevPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [businessDevs, setBusinessDevs] = useState<BusinessDevWithProject[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [statusFilter, setStatusFilter] = useState<BusinessDevStatus | "all">("all")
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  // Mode state
  const [mode, setMode] = useState<PageMode>("list")
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [brainDumpContent, setBrainDumpContent] = useState("")
  const [ideaTitle, setIdeaTitle] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)

  // Voice recording state
  const [isListening, setIsListening] = useState(false)
  const [isVoiceSupported, setIsVoiceSupported] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const recognitionRef = useRef<WebSpeechRecognition | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const animationRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState("")
  const chatEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Active analysis tab
  const [activeAnalysisTab, setActiveAnalysisTab] = useState("monetization")

  // ============ Effects ============

  // Load initial data
  useEffect(() => {
    loadData()
  }, [])

  // Check voice support
  useEffect(() => {
    // Access SpeechRecognition from window with type assertion
    const windowWithSpeech = window as typeof window & {
      SpeechRecognition?: WebSpeechRecognitionConstructor;
      webkitSpeechRecognition?: WebSpeechRecognitionConstructor;
    }
    const SpeechRecognitionAPI = windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition
    setIsVoiceSupported(!!SpeechRecognitionAPI)

    if (SpeechRecognitionAPI) {
      const recognition = new SpeechRecognitionAPI() as WebSpeechRecognition
      recognitionRef.current = recognition
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = "en-US"

      recognition.onresult = (event: WebSpeechRecognitionEvent) => {
        let finalText = ""
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            finalText += result[0].transcript
          }
        }
        if (finalText) {
          setBrainDumpContent(prev => (prev + " " + finalText).trim())
        }
      }

      recognition.onerror = () => {
        stopListening()
      }

      recognition.onend = () => {
        setIsListening(false)
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
      stopAudioVisualization()
    }
  }, [])

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages, streamingContent])

  // ============ Data Loading ============

  const loadData = async () => {
    setIsLoading(true)

    // Load business devs
    const allDevs = getAllBusinessDevs()
    const enrichedDevs: BusinessDevWithProject[] = allDevs.map(dev => {
      const project = getProject(dev.projectId, user?.id)
      return {
        ...dev,
        projectName: project?.name || "Unknown Project"
      }
    }).sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    setBusinessDevs(enrichedDevs)

    // Show cached projects immediately
    const cachedProjects = getAllProjects({ userId: user?.id, includeTrashed: false })
    setProjects(cachedProjects)

    // Fetch fresh data from server
    if (user?.id) {
      try {
        const serverProjects = await fetchProjects(user.id, { includeTrashed: false })
        setProjects(serverProjects)
      } catch (error) {
        console.error("[BusinessDev] Failed to fetch projects:", error)
      }
    }

    setIsLoading(false)
  }

  // ============ Voice Recording ============

  const startListening = useCallback(async () => {
    if (!recognitionRef.current) return

    try {
      recognitionRef.current.start()
      setIsListening(true)

      // Start audio visualization
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const audioContext = new AudioContext()
      audioContextRef.current = audioContext
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)
      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      const updateLevel = () => {
        if (!streamRef.current) return
        analyser.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length
        setAudioLevel(average / 255)
        animationRef.current = requestAnimationFrame(updateLevel)
      }
      updateLevel()
    } catch (err) {
      console.error("Failed to start voice recording:", err)
    }
  }, [])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // Ignore
      }
    }
    setIsListening(false)
    stopAudioVisualization()
  }, [])

  const stopAudioVisualization = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    setAudioLevel(0)
  }

  // ============ Filter Logic ============

  const filteredDevs = useMemo(() => {
    let result = businessDevs

    if (statusFilter !== "all") {
      result = result.filter(d => d.status === statusFilter)
    }

    if (search) {
      const lower = search.toLowerCase()
      result = result.filter(d =>
        d.projectName.toLowerCase().includes(lower) ||
        d.executiveSummary.overview.toLowerCase().includes(lower) ||
        d.executiveSummary.problem.toLowerCase().includes(lower)
      )
    }

    return result
  }, [businessDevs, statusFilter, search])

  // Stats
  const stats = useMemo(() => {
    const total = businessDevs.length
    const byStatus = {
      draft: businessDevs.filter(d => d.status === "draft").length,
      review: businessDevs.filter(d => d.status === "review").length,
      approved: businessDevs.filter(d => d.status === "approved").length,
      archived: businessDevs.filter(d => d.status === "archived").length
    }
    return { total, byStatus }
  }, [businessDevs])

  // ============ Analysis Generation ============

  const handleGenerateAnalysis = async () => {
    if (!brainDumpContent.trim() && !selectedProjectId) return

    setIsGenerating(true)
    setMode("analysis")

    try {
      // Get project context if selected
      let projectContext = ""
      if (selectedProjectId) {
        const project = getProject(selectedProjectId, user?.id)
        if (project) {
          projectContext = `Project: ${project.name}\nDescription: ${project.description || "No description"}\n`
          const existingBizDev = getBusinessDev(selectedProjectId)
          if (existingBizDev) {
            projectContext += `Existing Overview: ${existingBizDev.executiveSummary.overview}\n`
            projectContext += `Problem: ${existingBizDev.executiveSummary.problem}\n`
            projectContext += `Solution: ${existingBizDev.executiveSummary.solution}\n`
          }
        }
      }

      const response = await fetch("/api/business-dev/brain-dump", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId || `standalone-${Date.now()}`,
          projectName: ideaTitle || "Business Idea",
          projectDescription: projectContext,
          brainDumpContent: brainDumpContent,
          allowPaidFallback: true
        })
      })

      if (!response.ok) {
        throw new Error("Failed to generate analysis")
      }

      const data = await response.json()

      // Transform response to our AnalysisData format
      const analysis: AnalysisData = {
        monetization: {
          strategies: data.businessDev.revenueStreams?.map((r: { name: string; description: string; estimatedRevenue: string; timeframe: string; confidence: string }) => ({
            name: r.name,
            description: r.description,
            pros: ["Validated revenue model", "Scalable approach"],
            cons: ["Requires initial investment", "Market validation needed"],
            estimatedRevenue: r.estimatedRevenue,
            timeToRevenue: r.timeframe,
            recommended: r.confidence === "high"
          })) || [],
          primaryRecommendation: data.businessDev.revenueStreams?.[0]?.name || "Subscription Model"
        },
        marketing: {
          channels: [
            { name: "Content Marketing", description: "Blog posts, tutorials, case studies", cost: "$500-2000/mo", effectiveness: "High", timeframe: "3-6 months" },
            { name: "Social Media", description: "LinkedIn, Twitter, targeted ads", cost: "$300-1500/mo", effectiveness: "Medium", timeframe: "1-3 months" },
            { name: "SEO", description: "Organic search optimization", cost: "$200-1000/mo", effectiveness: "High", timeframe: "6-12 months" },
            { name: "Email Marketing", description: "Newsletter, drip campaigns", cost: "$50-500/mo", effectiveness: "High", timeframe: "1-2 months" }
          ],
          strategy: "Focus on content marketing and SEO for long-term growth, with targeted social media for initial traction.",
          budget: "$1,000-3,000/month recommended for early stage"
        },
        partnerships: [
          {
            type: "Technology Partners",
            examples: ["API integrations", "Platform partnerships", "White-label solutions"],
            benefits: ["Extended reach", "Technical credibility", "Shared development costs"],
            approach: "Identify complementary products and propose mutual integration benefits"
          },
          {
            type: "Channel Partners",
            examples: ["Resellers", "Consultants", "Agencies"],
            benefits: ["Sales leverage", "Market access", "Customer referrals"],
            approach: "Create partner program with clear incentives and support"
          },
          {
            type: "Strategic Partners",
            examples: ["Industry leaders", "Trade associations", "Enterprise customers"],
            benefits: ["Market validation", "Brand association", "Large contracts"],
            approach: "Start with pilot programs and case studies"
          }
        ],
        summary: data.businessDev.executiveSummary || "Analysis complete. Review the monetization strategies, marketing channels, and partnership opportunities below."
      }

      setAnalysisData(analysis)

      // Initialize chat with context
      const greeting: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: `I've analyzed your business idea${ideaTitle ? ` "${ideaTitle}"` : ""}. I can see several promising monetization opportunities and marketing strategies. What aspect would you like to explore further? I can help with:

- Deep dive into specific monetization models
- Marketing channel recommendations and budget allocation
- Partnership strategy and outreach approaches
- Risk analysis and mitigation strategies
- Go-to-market planning`,
        timestamp: new Date().toISOString()
      }
      setChatMessages([greeting])

    } catch (error) {
      console.error("Analysis generation error:", error)
      setAnalysisData(null)
    } finally {
      setIsGenerating(false)
    }
  }

  // ============ Chat Functionality ============

  const sendChatMessage = useCallback(async () => {
    if (!chatInput.trim() || isChatLoading) return

    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content: chatInput.trim(),
      timestamp: new Date().toISOString()
    }

    setChatMessages(prev => [...prev, userMessage])
    setChatInput("")
    setIsChatLoading(true)
    setStreamingContent("")

    try {
      const response = await fetch("/api/business-ideas/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...chatMessages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          ideaContext: {
            title: ideaTitle || "Business Development Analysis",
            summary: analysisData?.summary || brainDumpContent,
            revenueModel: analysisData?.monetization?.primaryRecommendation
          }
        })
      })

      if (!response.ok) throw new Error("Chat failed")

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No response body")

      const decoder = new TextDecoder()
      let fullContent = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split("\n")

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6)
            if (data === "[DONE]") continue

            try {
              const parsed = JSON.parse(data)
              if (parsed.type === "content") {
                fullContent += parsed.content
                setStreamingContent(fullContent)
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: fullContent,
        timestamp: new Date().toISOString()
      }

      setChatMessages(prev => [...prev, assistantMessage])
      setStreamingContent("")

    } catch (error) {
      console.error("Chat error:", error)
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "I apologize, but I encountered an issue. Please try again.",
        timestamp: new Date().toISOString()
      }
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setIsChatLoading(false)
      setStreamingContent("")
    }
  }, [chatInput, isChatLoading, chatMessages, ideaTitle, analysisData, brainDumpContent])

  // ============ Export Functions ============

  const handleExport = async (format: "pdf" | "markdown" | "json") => {
    if (!analysisData) return

    try {
      if (format === "json") {
        const dataStr = JSON.stringify({
          title: ideaTitle,
          brainDump: brainDumpContent,
          analysis: analysisData,
          chatHistory: chatMessages,
          exportedAt: new Date().toISOString()
        }, null, 2)
        const blob = new Blob([dataStr], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${(ideaTitle || "business-analysis").toLowerCase().replace(/\s+/g, "-")}.json`
        a.click()
        URL.revokeObjectURL(url)
      } else if (format === "markdown") {
        const markdown = generateMarkdownExport()
        const blob = new Blob([markdown], { type: "text/markdown" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${(ideaTitle || "business-analysis").toLowerCase().replace(/\s+/g, "-")}.md`
        a.click()
        URL.revokeObjectURL(url)
      } else if (format === "pdf") {
        // For PDF, we'll use the export API if there's a project, otherwise generate locally
        if (selectedProjectId) {
          const response = await fetch(`/api/business-dev/export?projectId=${selectedProjectId}&format=html`)
          const data = await response.json()
          // Open in new window for printing
          const printWindow = window.open("", "_blank")
          if (printWindow) {
            printWindow.document.write(data.html)
            printWindow.document.close()
            printWindow.print()
          }
        } else {
          // Generate HTML for standalone
          const html = generateHtmlExport()
          const printWindow = window.open("", "_blank")
          if (printWindow) {
            printWindow.document.write(html)
            printWindow.document.close()
            printWindow.print()
          }
        }
      }
    } catch (error) {
      console.error("Export error:", error)
    }
  }

  const generateMarkdownExport = (): string => {
    if (!analysisData) return ""

    return `# ${ideaTitle || "Business Development Analysis"}

*Generated: ${new Date().toLocaleDateString()}*

## Summary

${analysisData.summary}

---

## Monetization Strategies

${analysisData.monetization.strategies.map(s => `
### ${s.name} ${s.recommended ? "(Recommended)" : ""}

${s.description}

- **Estimated Revenue:** ${s.estimatedRevenue}
- **Time to Revenue:** ${s.timeToRevenue}

**Pros:**
${s.pros.map(p => `- ${p}`).join("\n")}

**Cons:**
${s.cons.map(c => `- ${c}`).join("\n")}
`).join("\n")}

---

## Marketing Strategy

### Recommended Channels

| Channel | Cost | Effectiveness | Timeframe |
|---------|------|---------------|-----------|
${analysisData.marketing.channels.map(c => `| ${c.name} | ${c.cost} | ${c.effectiveness} | ${c.timeframe} |`).join("\n")}

**Strategy:** ${analysisData.marketing.strategy}

**Recommended Budget:** ${analysisData.marketing.budget}

---

## Partnership Opportunities

${analysisData.partnerships.map(p => `
### ${p.type}

**Examples:** ${p.examples.join(", ")}

**Benefits:**
${p.benefits.map(b => `- ${b}`).join("\n")}

**Approach:** ${p.approach}
`).join("\n")}

---

*Generated by Claudia Coder Business Development*
`
  }

  const generateHtmlExport = (): string => {
    if (!analysisData) return ""

    return `<!DOCTYPE html>
<html>
<head>
  <title>${ideaTitle || "Business Development Analysis"}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #8B5CF6; padding-bottom: 12px; }
    h2 { color: #333; margin-top: 24px; }
    h3 { color: #666; }
    .summary { background: #f8f8f8; padding: 20px; border-radius: 8px; margin: 20px 0; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { padding: 10px; text-align: left; border: 1px solid #e5e5e5; }
    th { background: #f5f5f5; }
    .recommended { background: #d1fae5; }
    .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <h1>${ideaTitle || "Business Development Analysis"}</h1>
  <p><em>Generated: ${new Date().toLocaleDateString()}</em></p>

  <div class="summary">
    <h2>Summary</h2>
    <p>${analysisData.summary}</p>
  </div>

  <h2>Monetization Strategies</h2>
  ${analysisData.monetization.strategies.map(s => `
    <div class="${s.recommended ? 'recommended' : ''}" style="padding: 16px; margin: 12px 0; border: 1px solid #e5e5e5; border-radius: 8px;">
      <h3>${s.name} ${s.recommended ? "(Recommended)" : ""}</h3>
      <p>${s.description}</p>
      <p><strong>Estimated Revenue:</strong> ${s.estimatedRevenue}</p>
      <p><strong>Time to Revenue:</strong> ${s.timeToRevenue}</p>
    </div>
  `).join("")}

  <h2>Marketing Channels</h2>
  <table>
    <thead><tr><th>Channel</th><th>Cost</th><th>Effectiveness</th><th>Timeframe</th></tr></thead>
    <tbody>
      ${analysisData.marketing.channels.map(c => `<tr><td>${c.name}</td><td>${c.cost}</td><td>${c.effectiveness}</td><td>${c.timeframe}</td></tr>`).join("")}
    </tbody>
  </table>

  <h2>Partnership Opportunities</h2>
  ${analysisData.partnerships.map(p => `
    <div style="padding: 16px; margin: 12px 0; border: 1px solid #e5e5e5; border-radius: 8px;">
      <h3>${p.type}</h3>
      <p><strong>Examples:</strong> ${p.examples.join(", ")}</p>
      <p><strong>Benefits:</strong> ${p.benefits.join(", ")}</p>
      <p><strong>Approach:</strong> ${p.approach}</p>
    </div>
  `).join("")}

  <div class="footer">
    <p>Generated by Claudia Coder Business Development</p>
  </div>
</body>
</html>`
  }

  // ============ Navigation ============

  const handleBackToList = () => {
    setMode("list")
    setBrainDumpContent("")
    setIdeaTitle("")
    setSelectedProjectId(null)
    setAnalysisData(null)
    setChatMessages([])
    stopListening()
  }

  // ============ Render: Create Mode ============

  if (mode === "create" || mode === "braindump") {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBackToList}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Briefcase className="h-6 w-6 text-purple-500" />
              Business Development Analysis
            </h1>
            <p className="text-sm text-muted-foreground">
              Explore monetization, marketing strategies, and partnerships
            </p>
          </div>
        </div>

        {/* Input Options */}
        <div className="grid gap-6">
          {/* Project Selection */}
          <Card className="border-purple-500/20">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-purple-500" />
                Start from Existing Project
              </CardTitle>
              <CardDescription>
                Select a project to analyze or enhance its business development
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedProjectId || ""}
                onValueChange={(value) => setSelectedProjectId(value || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a project (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Start Fresh (No Project)</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Idea Title */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                Idea Title
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="Give your idea a name..."
                value={ideaTitle}
                onChange={(e) => setIdeaTitle(e.target.value)}
              />
            </CardContent>
          </Card>

          {/* Brain Dump */}
          <Card className="border-2 border-dashed border-purple-500/30 bg-purple-500/5">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-purple-500" />
                Brain Dump
              </CardTitle>
              <CardDescription>
                Describe your idea freely - type or speak your thoughts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Textarea
                  placeholder="What's your business idea? Describe the problem you're solving, who it's for, how it could make money, potential partners... anything that comes to mind."
                  className="min-h-[200px] text-base resize-none pr-14"
                  value={brainDumpContent}
                  onChange={(e) => setBrainDumpContent(e.target.value)}
                />
                {isVoiceSupported && (
                  <div className="absolute right-2 top-2">
                    <div className="relative">
                      {isListening && (
                        <>
                          <div
                            className="absolute inset-0 rounded-full bg-red-500/20 animate-ping"
                            style={{ animationDuration: "1.5s" }}
                          />
                          <div
                            className="absolute rounded-full bg-red-500/30 transition-all duration-100"
                            style={{ inset: `-${Math.max(4, audioLevel * 20)}px` }}
                          />
                        </>
                      )}
                      <Button
                        type="button"
                        variant={isListening ? "destructive" : "outline"}
                        size="icon"
                        onClick={isListening ? stopListening : startListening}
                        className={cn("relative", isListening && "scale-110")}
                      >
                        {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {isListening && (
                <div className="flex items-center justify-center gap-2">
                  <div className="flex items-end gap-0.5 h-4">
                    {[0.3, 0.5, 0.7, 1, 0.7, 0.5, 0.3].map((multiplier, i) => (
                      <div
                        key={i}
                        className="w-0.5 bg-red-500 rounded-full transition-all duration-75"
                        style={{ height: `${Math.max(4, audioLevel * 16 * multiplier)}px` }}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Listening... Click mic to stop
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{brainDumpContent.length} characters</span>
                <Badge variant="outline" className="text-xs">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Tips: Problem, Audience, Revenue, Partners
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleBackToList}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerateAnalysis}
              disabled={!brainDumpContent.trim() && !selectedProjectId}
              className="gap-2"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Generate Analysis
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ============ Render: Analysis Mode ============

  if (mode === "analysis" && (analysisData || isGenerating)) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-4 p-4 border-b shrink-0">
          <Button variant="ghost" size="icon" onClick={handleBackToList}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-purple-500" />
              {ideaTitle || "Business Analysis"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {analysisData ? "Review and discuss your analysis" : "Generating analysis..."}
            </p>
          </div>
          {analysisData && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => handleExport("markdown")} className="gap-1">
                <FileDown className="h-4 w-4" />
                Markdown
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} className="gap-1">
                <Download className="h-4 w-4" />
                PDF
              </Button>
            </div>
          )}
        </div>

        {isGenerating ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-purple-500 mx-auto" />
              <p className="text-muted-foreground">Analyzing your business idea...</p>
              <p className="text-sm text-muted-foreground">This may take 30-60 seconds</p>
            </div>
          </div>
        ) : analysisData ? (
          <div className="flex-1 flex overflow-hidden">
            {/* Analysis Panels */}
            <div className="flex-1 overflow-auto p-4">
              <Tabs value={activeAnalysisTab} onValueChange={setActiveAnalysisTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="monetization" className="gap-1">
                    <PiggyBank className="h-4 w-4" />
                    Monetization
                  </TabsTrigger>
                  <TabsTrigger value="marketing" className="gap-1">
                    <Megaphone className="h-4 w-4" />
                    Marketing
                  </TabsTrigger>
                  <TabsTrigger value="partnerships" className="gap-1">
                    <Handshake className="h-4 w-4" />
                    Partnerships
                  </TabsTrigger>
                </TabsList>

                {/* Monetization Tab */}
                <TabsContent value="monetization" className="space-y-4">
                  <Card className="border-green-500/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2 text-green-500">
                        <DollarSign className="h-4 w-4" />
                        Recommended: {analysisData.monetization.primaryRecommendation}
                      </CardTitle>
                    </CardHeader>
                  </Card>

                  <div className="grid gap-4">
                    {analysisData.monetization.strategies.map((strategy, i) => (
                      <Card key={i} className={cn(strategy.recommended && "border-green-500/30 bg-green-500/5")}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                              {strategy.name}
                              {strategy.recommended && (
                                <Badge variant="outline" className="text-green-500 border-green-500/30">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Recommended
                                </Badge>
                              )}
                            </CardTitle>
                          </div>
                          <CardDescription>{strategy.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Est. Revenue:</span>
                              <span className="ml-2 font-medium">{strategy.estimatedRevenue}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Time to Revenue:</span>
                              <span className="ml-2 font-medium">{strategy.timeToRevenue}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-medium text-green-500 mb-1">Pros</p>
                              <ul className="text-sm space-y-1">
                                {strategy.pros.map((pro, j) => (
                                  <li key={j} className="flex items-start gap-1 text-muted-foreground">
                                    <span className="text-green-500">+</span> {pro}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-red-500 mb-1">Cons</p>
                              <ul className="text-sm space-y-1">
                                {strategy.cons.map((con, j) => (
                                  <li key={j} className="flex items-start gap-1 text-muted-foreground">
                                    <span className="text-red-500">-</span> {con}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                {/* Marketing Tab */}
                <TabsContent value="marketing" className="space-y-4">
                  <Card className="border-blue-500/20">
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2 text-blue-500">
                        <Target className="h-4 w-4" />
                        Marketing Strategy
                      </CardTitle>
                      <CardDescription>{analysisData.marketing.strategy}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Recommended Budget:</span>
                        <span className="font-medium">{analysisData.marketing.budget}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Marketing Channels</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {analysisData.marketing.channels.map((channel, i) => (
                          <div key={i} className="flex items-start gap-4 p-3 rounded-lg bg-muted/30">
                            <div className="flex-1">
                              <h4 className="font-medium">{channel.name}</h4>
                              <p className="text-sm text-muted-foreground">{channel.description}</p>
                            </div>
                            <div className="text-right text-sm">
                              <div className="font-medium">{channel.cost}</div>
                              <div className="text-muted-foreground">{channel.effectiveness} effectiveness</div>
                              <div className="text-muted-foreground">{channel.timeframe}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Partnerships Tab */}
                <TabsContent value="partnerships" className="space-y-4">
                  {analysisData.partnerships.map((partnership, i) => (
                    <Card key={i}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Handshake className="h-4 w-4 text-purple-500" />
                          {partnership.type}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Examples</p>
                          <div className="flex flex-wrap gap-2">
                            {partnership.examples.map((ex, j) => (
                              <Badge key={j} variant="outline">{ex}</Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Benefits</p>
                          <ul className="text-sm space-y-1">
                            {partnership.benefits.map((benefit, j) => (
                              <li key={j} className="flex items-start gap-1 text-muted-foreground">
                                <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5" /> {benefit}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
                          <p className="text-xs font-medium text-purple-500 mb-1">Approach</p>
                          <p className="text-sm">{partnership.approach}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>
              </Tabs>
            </div>

            {/* Chat Panel */}
            <div className="w-[400px] border-l flex flex-col">
              <div className="p-3 border-b">
                <h3 className="font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-purple-500" />
                  Discuss Analysis
                </h3>
              </div>

              <ScrollArea className="flex-1 p-3">
                <div className="space-y-4">
                  {chatMessages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex gap-3",
                        message.role === "user" && "flex-row-reverse"
                      )}
                    >
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                        message.role === "user" ? "bg-primary" : "bg-purple-500/20"
                      )}>
                        {message.role === "user" ? (
                          <User className="h-4 w-4 text-primary-foreground" />
                        ) : (
                          <Bot className="h-4 w-4 text-purple-500" />
                        )}
                      </div>
                      <div className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-3",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}>
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      </div>
                    </div>
                  ))}

                  {isChatLoading && streamingContent && (
                    <div className="flex gap-3">
                      <div className="h-8 w-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-purple-500" />
                      </div>
                      <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-muted">
                        <p className="text-sm whitespace-pre-wrap">{streamingContent}</p>
                        <span className="inline-block w-2 h-4 bg-purple-500 animate-pulse ml-1" />
                      </div>
                    </div>
                  )}

                  {isChatLoading && !streamingContent && (
                    <div className="flex gap-3">
                      <div className="h-8 w-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-purple-500" />
                      </div>
                      <div className="bg-muted rounded-2xl px-4 py-3">
                        <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                      </div>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>

              <div className="p-3 border-t">
                <div className="flex gap-2">
                  <Textarea
                    ref={textareaRef}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        sendChatMessage()
                      }
                    }}
                    placeholder="Ask about monetization, marketing..."
                    disabled={isChatLoading}
                    className="min-h-[44px] max-h-[100px] resize-none"
                    rows={1}
                  />
                  <Button
                    size="icon"
                    disabled={!chatInput.trim() || isChatLoading}
                    onClick={sendChatMessage}
                  >
                    {isChatLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  // ============ Render: List Mode (Default) ============

  return (
    <div className="flex flex-col gap-4 p-6 h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-purple-500" />
            Business Development
          </h1>

          {/* Inline stats */}
          <div className="hidden xl:flex items-center gap-1">
            {[
              { label: "Total", value: stats.total, color: "text-foreground" },
              { label: "Draft", value: stats.byStatus.draft, color: "text-yellow-500" },
              { label: "Review", value: stats.byStatus.review, color: "text-blue-500" },
              { label: "Approved", value: stats.byStatus.approved, color: "text-green-500" }
            ].map(stat => (
              <div
                key={stat.label}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 text-xs"
              >
                <span className="text-muted-foreground">{stat.label}</span>
                <span className={cn("font-semibold", stat.color)}>{stat.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button size="sm" onClick={() => setMode("create")} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Analysis</span>
          </Button>
        </div>
      </div>

      {/* Quick Start Card */}
      <Card className="border-2 border-dashed border-purple-500/30 bg-purple-500/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-purple-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Start Business Development Analysis</h3>
              <p className="text-sm text-muted-foreground">
                Explore monetization strategies, marketing channels, and partnership opportunities for any idea
              </p>
            </div>
            <Button onClick={() => setMode("create")} className="gap-2">
              <Play className="h-4 w-4" />
              Start Now
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards - visible on smaller screens */}
      <div className="grid grid-cols-4 gap-2 xl:hidden">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Draft", value: stats.byStatus.draft, color: "text-yellow-500" },
          { label: "Review", value: stats.byStatus.review, color: "text-blue-500" },
          { label: "Approved", value: stats.byStatus.approved, color: "text-green-500" }
        ].map(stat => (
          <div key={stat.label} className="p-2 rounded-md border bg-card text-center">
            <div className={cn("text-lg font-semibold", stat.color)}>{stat.value}</div>
            <div className="text-xs text-muted-foreground truncate">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filter & Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search business plans..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent pl-10 pr-4 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="h-4 w-4 text-muted-foreground mr-2" />
          {(["all", "draft", "review", "approved"] as const).map(status => (
            <Button
              key={status}
              variant={statusFilter === status ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter(status)}
              className="capitalize"
            >
              {status}
            </Button>
          ))}
        </div>
      </div>

      {/* Business Dev Grid */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredDevs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Building2 className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No business development plans yet</p>
            <p className="text-sm">Click "New Analysis" to get started with monetization and marketing strategies</p>
            <Button className="mt-4 gap-2" onClick={() => setMode("create")}>
              <Plus className="h-4 w-4" />
              New Analysis
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredDevs.map(dev => {
              const statusConf = statusConfig[dev.status]
              const StatusIcon = statusConf.icon

              return (
                <Card key={dev.id} className="group hover:border-purple-500/50 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1 min-w-0">
                        <Link
                          href={`/projects/${dev.projectId}`}
                          className="font-semibold hover:text-purple-500 truncate block"
                        >
                          {dev.projectName}
                        </Link>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {dev.executiveSummary.overview || "No overview available"}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Status */}
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={cn("gap-1", statusConf.color, statusConf.bg)}>
                        <StatusIcon className="h-3 w-3" />
                        {statusConf.label}
                      </Badge>
                      {dev.approvedAt && (
                        <Badge variant="outline" className="text-green-500 border-green-500/30">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Approved
                        </Badge>
                      )}
                    </div>

                    {/* Key Metrics */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1.5 p-2 rounded bg-muted/50">
                        <Target className="h-3.5 w-3.5 text-blue-500" />
                        <span>{dev.features.length} Features</span>
                      </div>
                      <div className="flex items-center gap-1.5 p-2 rounded bg-muted/50">
                        <DollarSign className="h-3.5 w-3.5 text-green-500" />
                        <span className="truncate">{dev.monetization.model}</span>
                      </div>
                    </div>

                    {/* Value Proposition Preview */}
                    {dev.executiveSummary.uniqueValue && !dev.executiveSummary.uniqueValue.includes("[") && (
                      <div className="text-xs text-muted-foreground border-l-2 border-purple-500/50 pl-2 line-clamp-2">
                        {dev.executiveSummary.uniqueValue}
                      </div>
                    )}

                    {/* Risks indicator */}
                    {dev.risks && dev.risks.risks.length > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                        <span>{dev.risks.risks.length} risks identified</span>
                      </div>
                    )}

                    {/* Stats Row */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{formatDate(dev.updatedAt)}</span>
                      </div>
                      {dev.generatedBy && (
                        <div className="flex items-center gap-1 text-xs">
                          <TrendingUp className="h-3.5 w-3.5" />
                          <span className="truncate">{dev.generatedBy.model}</span>
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-xs text-muted-foreground">
                        Created {formatDate(dev.createdAt)}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-7 px-2 gap-1" asChild>
                          <Link href={`/projects/${dev.projectId}`}>
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                          <Link href={`/projects/${dev.projectId}`}>
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
