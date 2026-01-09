"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import {
  Package,
  Terminal,
  Shield,
  FolderKanban,
  Plug,
  Mic,
  ArrowRight,
  CheckCircle,
  Zap,
  Bot,
  GitBranch,
  Play,
  Code2,
  Sparkles,
  ChevronRight,
  ExternalLink,
} from "lucide-react"

const features = [
  {
    icon: Package,
    title: "Packet-Based Development",
    description:
      "Break down complex projects into manageable work packets. AI processes each packet autonomously while maintaining context and dependencies.",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "hover:border-blue-500/30",
  },
  {
    icon: Terminal,
    title: "Claude Code Integration",
    description:
      "Persistent Claude Code sessions with intelligent context management. Your AI agent maintains state across development cycles.",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "hover:border-purple-500/30",
  },
  {
    icon: Shield,
    title: "Quality Gates & Testing",
    description:
      "Automated quality checks, linting, and test execution. Every packet must pass gates before merging, ensuring production-ready code.",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "hover:border-green-500/30",
  },
  {
    icon: FolderKanban,
    title: "Project Build Plans",
    description:
      "Define comprehensive build plans with milestones, deliverables, and acceptance criteria. Track progress from conception to deployment.",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    borderColor: "hover:border-yellow-500/30",
  },
  {
    icon: Plug,
    title: "MCP Server Integrations",
    description:
      "Connect to external tools and services through Model Context Protocol servers. Extend capabilities with Figma, databases, APIs, and more.",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    borderColor: "hover:border-cyan-500/30",
  },
  {
    icon: Mic,
    title: "Voice-to-Code Brain Dump",
    description:
      "Speak your ideas naturally. AI transcribes, analyzes, and converts voice recordings into structured development requirements and code.",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "hover:border-red-500/30",
  },
]

const steps = [
  {
    number: "01",
    title: "Create a Project",
    description:
      "Initialize your project with a Git repository, define the tech stack, and let Claudia understand your codebase structure.",
    icon: FolderKanban,
  },
  {
    number: "02",
    title: "Define Build Plan",
    description:
      "Break down your vision into milestones, features, and acceptance criteria. Add context through brain dumps or documentation.",
    icon: GitBranch,
  },
  {
    number: "03",
    title: "Generate Packets",
    description:
      "AI analyzes your build plan and generates focused work packets with clear specifications, dependencies, and test requirements.",
    icon: Package,
  },
  {
    number: "04",
    title: "Execute & Iterate",
    description:
      "Hit GO and watch autonomous development happen. Review outputs, provide feedback, and let quality gates ensure excellence.",
    icon: Play,
  },
]

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Background gradient effects */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-blue-500/8 blur-[100px]" />
        <div className="absolute top-1/3 -left-40 h-[500px] w-[500px] rounded-full bg-purple-500/8 blur-[100px]" />
        <div className="absolute -bottom-40 right-1/3 h-[500px] w-[500px] rounded-full bg-cyan-500/8 blur-[100px]" />
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/landing" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/20">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-semibold tracking-tight">Claudia Coder</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
              <Link href="/">Dashboard</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
              <Link href="/projects">Projects</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/projects/new">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pb-24 sm:pt-20">
        <div className="flex flex-col items-center text-center">
          <Badge variant="secondary" className="mb-6 gap-2 px-4 py-1.5 text-sm">
            <Sparkles className="h-3.5 w-3.5 text-blue-400" />
            AI-Powered Development Orchestration
          </Badge>

          <h1 className="max-w-4xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl">
            Build Software with
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              {" "}Autonomous AI Agents
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg lg:text-xl">
            Claudia Coder orchestrates Claude AI to transform your ideas into production-ready code.
            Define your vision, set quality gates, and let intelligent agents handle the implementation.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <Button size="lg" asChild className="h-12 w-full px-8 text-base sm:w-auto">
              <Link href="/projects/new">
                Start Building
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="h-12 w-full px-8 text-base sm:w-auto">
              <Link href="/">
                View Dashboard
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {/* Stats */}
          <div className="mt-16 grid w-full max-w-lg grid-cols-3 gap-4 sm:gap-8 lg:gap-16">
            <div className="text-center">
              <div className="text-2xl font-bold sm:text-3xl lg:text-4xl">10x</div>
              <div className="mt-1 text-xs text-muted-foreground sm:text-sm">Faster Development</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold sm:text-3xl lg:text-4xl">100%</div>
              <div className="mt-1 text-xs text-muted-foreground sm:text-sm">Quality Assured</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold sm:text-3xl lg:text-4xl">24/7</div>
              <div className="mt-1 text-xs text-muted-foreground sm:text-sm">Autonomous Operation</div>
            </div>
          </div>
        </div>

        {/* Hero Visual - Terminal Preview */}
        <div className="relative mt-16 sm:mt-20">
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
          <Card className="mx-auto max-w-5xl border-border/50 bg-card/80 shadow-2xl shadow-black/20 backdrop-blur">
            <CardContent className="p-0">
              {/* Terminal Header */}
              <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500/80" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                  <div className="h-3 w-3 rounded-full bg-green-500/80" />
                </div>
                <span className="ml-4 font-mono text-xs text-muted-foreground sm:text-sm">
                  claudia-coder - Development Session
                </span>
              </div>
              {/* Terminal Content */}
              <div className="p-4 font-mono text-xs sm:p-6 sm:text-sm">
                <div className="flex items-start gap-2 text-green-400">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Project initialized: e-commerce-platform</span>
                </div>
                <div className="mt-3 flex items-start gap-2 text-blue-400">
                  <Package className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Generated 12 work packets from build plan</span>
                </div>
                <div className="mt-3 flex items-start gap-2 text-purple-400">
                  <Zap className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Executing: PKT-001 - User Authentication Module</span>
                </div>
                <div className="mt-3 flex items-start gap-2 text-cyan-400">
                  <Code2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Claude Code: Writing auth service with JWT tokens...</span>
                </div>
                <div className="mt-3 flex items-start gap-2 text-green-400">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Quality gate passed: All 24 tests passing</span>
                </div>
                <div className="mt-4 flex items-center gap-2 text-muted-foreground">
                  <span className="inline-block h-4 w-2 animate-pulse bg-foreground/70" />
                  <span>Awaiting next packet approval...</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 border-t border-border/40 bg-background/50 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center">
            <Badge variant="secondary" className="mb-4">Features</Badge>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              Everything You Need for AI-Driven Development
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
              A comprehensive platform that combines powerful AI capabilities with robust project
              management and quality assurance tools.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:mt-16 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {features.map((feature) => (
              <Card
                key={feature.title}
                className={`group relative border-border/50 bg-card/50 transition-all duration-300 hover:bg-card ${feature.borderColor}`}
              >
                <CardContent className="p-5 sm:p-6">
                  <div
                    className={`mb-4 flex h-11 w-11 items-center justify-center rounded-lg ${feature.bgColor} transition-transform duration-300 group-hover:scale-110 sm:h-12 sm:w-12`}
                  >
                    <feature.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${feature.color}`} />
                  </div>
                  <h3 className="mb-2 text-base font-semibold sm:text-lg">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground sm:text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="relative z-10 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center">
            <Badge variant="secondary" className="mb-4">Process</Badge>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              How Claudia Coder Works
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
              From idea to implementation in four streamlined steps. Define once, deploy excellence.
            </p>
          </div>

          <div className="mt-12 grid gap-8 sm:mt-16 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <div key={step.number} className="relative">
                {/* Connector line (hidden on mobile, visible on lg) */}
                {index < steps.length - 1 && (
                  <div className="absolute right-0 top-12 hidden h-px w-full translate-x-1/2 bg-gradient-to-r from-border to-transparent lg:block" />
                )}
                <div className="relative flex flex-col items-center text-center">
                  <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-border/50 bg-card/50 shadow-lg transition-all duration-300 hover:border-blue-500/30 hover:shadow-blue-500/10 sm:h-24 sm:w-24">
                    <step.icon className="h-8 w-8 text-blue-400 sm:h-10 sm:w-10" />
                  </div>
                  <div className="mb-2 font-mono text-xs text-blue-400 sm:text-sm">{step.number}</div>
                  <h3 className="mb-2 text-base font-semibold sm:text-lg">{step.title}</h3>
                  <p className="text-xs text-muted-foreground sm:text-sm">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Getting Started CTA Section */}
      <section className="relative z-10 border-t border-border/40 bg-background/50 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-cyan-500/10 p-8 sm:p-12">
            {/* Background glows */}
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/20 blur-[80px]" />
            <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-purple-500/20 blur-[80px]" />

            <div className="relative grid gap-8 lg:grid-cols-2 lg:items-center">
              <div>
                <Badge variant="secondary" className="mb-4">Get Started</Badge>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                  Ready to Transform Your Development Workflow?
                </h2>
                <p className="mt-4 text-sm text-muted-foreground sm:text-base">
                  Set up your first project in minutes. Connect your repository, define your build
                  plan, and let Claudia Coder handle the rest. Experience the future of software
                  development today.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
                  <Button size="lg" asChild className="w-full sm:w-auto">
                    <Link href="/projects/new">
                      Create First Project
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
                    <Link href="/settings">
                      Configure Settings
                    </Link>
                  </Button>
                </div>
              </div>

              {/* Setup checklist */}
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-card/50 p-3 backdrop-blur sm:gap-4 sm:p-4">
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />
                  <div>
                    <div className="text-sm font-medium sm:text-base">Connect Your Git Repository</div>
                    <div className="text-xs text-muted-foreground sm:text-sm">
                      Link GitHub, GitLab, or local repositories
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-card/50 p-3 backdrop-blur sm:gap-4 sm:p-4">
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />
                  <div>
                    <div className="text-sm font-medium sm:text-base">Configure Claude API</div>
                    <div className="text-xs text-muted-foreground sm:text-sm">
                      Set up your Anthropic API key for AI capabilities
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-card/50 p-3 backdrop-blur sm:gap-4 sm:p-4">
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />
                  <div>
                    <div className="text-sm font-medium sm:text-base">Enable MCP Integrations</div>
                    <div className="text-xs text-muted-foreground sm:text-sm">
                      Extend functionality with tool integrations
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/40 py-10 sm:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold">Claudia Coder</span>
            </div>

            {/* Navigation */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground sm:gap-6">
              <Link href="/" className="transition-colors hover:text-foreground">
                Dashboard
              </Link>
              <Link href="/projects" className="transition-colors hover:text-foreground">
                Projects
              </Link>
              <Link href="/packets" className="transition-colors hover:text-foreground">
                Packets
              </Link>
              <Link href="/settings" className="transition-colors hover:text-foreground">
                Settings
              </Link>
              <Link href="/claude-code" className="transition-colors hover:text-foreground">
                Claude Code
              </Link>
            </div>

            {/* Developer credit */}
            <div className="text-center text-sm text-muted-foreground sm:text-right">
              Developed by{" "}
              <span className="font-medium text-foreground">Bill Griffith</span>
              <span className="block text-xs sm:inline sm:text-sm"> - G-Tech SD</span>
            </div>
          </div>

          {/* Bottom footer */}
          <div className="mt-8 border-t border-border/40 pt-8 text-center text-xs text-muted-foreground sm:text-sm">
            <p className="font-medium">claudiacoder.com - AI-Powered Development Orchestration Platform</p>
            <p className="mt-2">Built with Next.js, Tailwind CSS, and Claude AI</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
