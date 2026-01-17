/**
 * Project Complete Export API
 *
 * Exports ALL project data as a comprehensive GitHub-ready ZIP file including:
 * - README.md - Project overview and documentation
 * - docs/PRD.md - Product Requirements Document
 * - docs/BUILD_PLAN.md - Development build plan
 * - docs/packets/*.md - Individual work packets as markdown
 * - KICKOFF.md - Project kickoff summary for Claude Code
 * - data/project.json - Project metadata
 * - data/build-plans/*.json - Build plan data
 * - data/packet-runs/*.json - Execution history
 * - brain-dumps/*.md - Brain dumps as markdown
 * - voice-recordings/index.md - Voice recording summaries with transcriptions
 * - resources/* - User uploaded files
 * - interviews/*.md - Interview data and user input
 * - src/ (optional) - Source code from project folder
 *
 * Endpoints:
 * - POST: Generate and download a complete project export ZIP
 *
 * Query params:
 * - includeSourceCode: Whether to include source code (default: true)
 * - format: "github" (default) or "json" for legacy format
 */

import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import os from "os"
import archiver from "archiver"
import { Readable } from "stream"
import type {
  Project,
  StoredBuildPlan,
  PacketRun,
  BrainDump,
  ProjectResource,
  BusinessDev,
  VoiceRecording,
  InterviewSession,
} from "@/lib/data/types"

// Directories to skip when creating archive (for source code)
const SKIP_DIRECTORIES = [
  "node_modules",
  ".git",
  ".next",
  ".cache",
  "__pycache__",
  ".pytest_cache",
  ".venv",
  "venv",
  "dist",
  "build",
  "coverage",
  ".nyc_output",
  ".turbo",
  ".vercel",
  ".output",
  "vendor",
  "target",
  "bin",
  "obj",
]

// Files to skip
const SKIP_FILES = [
  ".DS_Store",
  "Thumbs.db",
]

// Maximum archive size (200MB for complete exports)
const MAX_ARCHIVE_SIZE = 200 * 1024 * 1024

interface RouteParams {
  params: Promise<{ id: string }>
}

// WorkPacket type (from build plans)
interface WorkPacket {
  id: string
  phaseId?: string
  title: string
  description: string
  type: string
  priority: string
  status?: string
  tasks: Array<{ id: string; description: string; completed: boolean; order?: number }>
  acceptanceCriteria: string[]
}

// Request body for complete export
interface ExportRequestBody {
  project: Project
  buildPlans: StoredBuildPlan[]
  packets: WorkPacket[]
  packetRuns: PacketRun[]
  brainDumps: BrainDump[]
  resources: ProjectResource[]
  resourceFiles: Array<{ id: string; name: string; data: string }> // base64 encoded
  businessDev: BusinessDev | null
  voiceRecordings: VoiceRecording[]
  interviews?: InterviewSession[]
}

// ============ Markdown Generation Functions ============

/**
 * Generate a slug from a string for filenames
 */
function generateSlug(text: string, maxLength = 30): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLength)
    || "untitled"
}

/**
 * Format a date for display
 */
function formatDate(dateString?: string): string {
  if (!dateString) return new Date().toISOString().split("T")[0]
  return new Date(dateString).toISOString().split("T")[0]
}

/**
 * Generate README.md for the export
 */
function generateReadme(
  project: Project,
  buildPlan: StoredBuildPlan | null,
  stats: {
    packets: number
    brainDumps: number
    voiceRecordings: number
    resources: number
    packetRuns: number
  }
): string {
  const lines: string[] = []

  lines.push(`# ${project.name}`)
  lines.push("")
  lines.push(project.description || "No description provided.")
  lines.push("")

  // Project Status
  lines.push("## Project Status")
  lines.push("")
  lines.push(`- **Status:** ${project.status}`)
  lines.push(`- **Priority:** ${project.priority}`)
  lines.push(`- **Created:** ${formatDate(project.createdAt)}`)
  lines.push(`- **Last Updated:** ${formatDate(project.updatedAt)}`)
  lines.push("")

  // Quick Stats
  lines.push("## Quick Stats")
  lines.push("")
  lines.push("| Metric | Count |")
  lines.push("|--------|-------|")
  lines.push(`| Work Packets | ${stats.packets} |`)
  lines.push(`| Brain Dumps | ${stats.brainDumps} |`)
  lines.push(`| Voice Recordings | ${stats.voiceRecordings} |`)
  lines.push(`| Resources | ${stats.resources} |`)
  lines.push(`| Execution Runs | ${stats.packetRuns} |`)
  lines.push("")

  // Documentation
  lines.push("## Documentation")
  lines.push("")
  lines.push("This export contains the following documentation:")
  lines.push("")
  lines.push("- [KICKOFF.md](./KICKOFF.md) - Project kickoff summary for Claude Code")
  lines.push("- [docs/PRD.md](./docs/PRD.md) - Product Requirements Document")
  lines.push("- [docs/BUILD_PLAN.md](./docs/BUILD_PLAN.md) - Development build plan")
  lines.push("- [docs/packets/](./docs/packets/) - Individual work packets")
  lines.push("")

  // Objectives
  if (buildPlan?.originalPlan?.spec?.objectives?.length) {
    lines.push("## Objectives")
    lines.push("")
    buildPlan.originalPlan.spec.objectives.forEach((obj, i) => {
      lines.push(`${i + 1}. ${obj}`)
    })
    lines.push("")
  }

  // Tech Stack
  if (buildPlan?.originalPlan?.spec?.techStack?.length) {
    lines.push("## Tech Stack")
    lines.push("")
    buildPlan.originalPlan.spec.techStack.forEach(tech => {
      lines.push(`- ${tech}`)
    })
    lines.push("")
  }

  // Linked Repos
  if (project.repos?.length) {
    lines.push("## Linked Repositories")
    lines.push("")
    project.repos.forEach(repo => {
      lines.push(`- [${repo.name}](${repo.url}) (${repo.provider})`)
    })
    lines.push("")
  }

  // Tags
  if (project.tags?.length) {
    lines.push("## Tags")
    lines.push("")
    lines.push(project.tags.map(t => `\`${t}\``).join(" "))
    lines.push("")
  }

  // Export Structure
  lines.push("## Export Structure")
  lines.push("")
  lines.push("```")
  lines.push("./")
  lines.push("|-- README.md              # This file")
  lines.push("|-- KICKOFF.md             # Project kickoff for Claude Code")
  lines.push("|-- docs/")
  lines.push("|   |-- PRD.md             # Product Requirements Document")
  lines.push("|   |-- BUILD_PLAN.md      # Development build plan")
  lines.push("|   +-- packets/           # Individual work packets")
  lines.push("|-- data/")
  lines.push("|   |-- project.json       # Project metadata")
  lines.push("|   |-- build-plans/       # Build plan data")
  lines.push("|   +-- packet-runs/       # Execution history")
  lines.push("|-- brain-dumps/           # Brain dump transcriptions")
  lines.push("|-- voice-recordings/      # Voice recording summaries")
  lines.push("|-- interviews/            # Interview data")
  lines.push("|-- resources/             # Uploaded files")
  lines.push("+-- src/                   # Source code (if included)")
  lines.push("```")
  lines.push("")

  // Footer
  lines.push("---")
  lines.push("")
  lines.push(`*Exported from Claudia Coder on ${new Date().toISOString()}*`)

  return lines.join("\n")
}

/**
 * Generate PRD.md from build plan
 */
function generatePRD(project: Project, buildPlan: StoredBuildPlan): string {
  const spec = buildPlan.originalPlan?.spec
  if (!spec) return ""

  const lines: string[] = []

  // Frontmatter
  lines.push("---")
  lines.push(`title: "${spec.name}"`)
  lines.push(`project_id: "${project.id}"`)
  lines.push(`build_plan_id: "${buildPlan.id}"`)
  lines.push(`version: ${buildPlan.revisionNumber || 1}`)
  lines.push(`created: "${formatDate(buildPlan.createdAt)}"`)
  lines.push(`status: "${buildPlan.status}"`)
  lines.push("---")
  lines.push("")

  // Title
  lines.push(`# ${spec.name}`)
  lines.push("")

  // Overview
  lines.push("## Overview")
  lines.push("")
  lines.push(spec.description || project.description || "No description provided.")
  lines.push("")

  // Goals
  lines.push("## Goals")
  lines.push("")
  if (spec.objectives?.length) {
    spec.objectives.forEach((obj, i) => {
      lines.push(`${i + 1}. ${obj}`)
    })
  } else {
    lines.push("*No objectives defined*")
  }
  lines.push("")

  // Non-Goals
  lines.push("## Non-Goals")
  lines.push("")
  lines.push("The following are explicitly **out of scope** for this project:")
  lines.push("")
  if (spec.nonGoals?.length) {
    spec.nonGoals.forEach(ng => {
      lines.push(`- ${ng}`)
    })
  } else {
    lines.push("*No non-goals defined*")
  }
  lines.push("")

  // Tech Stack
  lines.push("## Tech Stack")
  lines.push("")
  if (spec.techStack?.length) {
    spec.techStack.forEach(tech => {
      lines.push(`- ${tech}`)
    })
  } else {
    lines.push("*Tech stack not specified*")
  }
  lines.push("")

  // Assumptions
  lines.push("## Assumptions")
  lines.push("")
  if (spec.assumptions?.length) {
    spec.assumptions.forEach(assumption => {
      lines.push(`- ${assumption}`)
    })
  } else {
    lines.push("*No assumptions documented*")
  }
  lines.push("")

  // Risks
  lines.push("## Risks")
  lines.push("")
  if (spec.risks?.length) {
    lines.push("| Risk | Mitigation |")
    lines.push("|------|------------|")
    spec.risks.forEach(risk => {
      const parts = risk.split(/(?:mitigation:|mitigate by|->|:)/i)
      if (parts.length > 1) {
        lines.push(`| ${parts[0].trim()} | ${parts.slice(1).join(" ").trim()} |`)
      } else {
        lines.push(`| ${risk} | *To be determined* |`)
      }
    })
  } else {
    lines.push("*No risks identified*")
  }
  lines.push("")

  // Footer
  lines.push("---")
  lines.push("")
  lines.push(`*Generated by Claudia Coder on ${formatDate(buildPlan.createdAt)}*`)

  return lines.join("\n")
}

/**
 * Generate BUILD_PLAN.md from build plan
 */
function generateBuildPlanMarkdown(project: Project, buildPlan: StoredBuildPlan): string {
  const spec = buildPlan.originalPlan?.spec
  const phases = buildPlan.originalPlan?.phases || []
  // Cast to WorkPacket array to allow status property access
  const packets = (buildPlan.originalPlan?.packets || []) as WorkPacket[]

  const lines: string[] = []

  // Frontmatter
  lines.push("---")
  lines.push(`title: "Build Plan: ${spec?.name || project.name}"`)
  lines.push(`project_id: "${project.id}"`)
  lines.push(`build_plan_id: "${buildPlan.id}"`)
  lines.push(`version: ${buildPlan.revisionNumber || 1}`)
  lines.push(`created: "${formatDate(buildPlan.createdAt)}"`)
  lines.push(`status: "${buildPlan.status}"`)
  lines.push(`total_phases: ${phases.length}`)
  lines.push(`total_packets: ${packets.length}`)
  lines.push("---")
  lines.push("")

  // Title
  lines.push(`# Build Plan: ${spec?.name || project.name}`)
  lines.push("")

  // Summary
  lines.push("## Summary")
  lines.push("")
  lines.push(spec?.description || project.description || "No summary available.")
  lines.push("")

  // Stats
  lines.push("### Statistics")
  lines.push("")
  lines.push("| Metric | Value |")
  lines.push("|--------|-------|")
  lines.push(`| Phases | ${phases.length} |`)
  lines.push(`| Total Packets | ${packets.length} |`)
  lines.push(`| Queued | ${packets.filter(p => !p.status || p.status === "queued").length} |`)
  lines.push(`| Completed | ${packets.filter(p => p.status === "completed").length} |`)
  lines.push("")

  // Phases
  lines.push("## Phases")
  lines.push("")

  if (phases.length > 0) {
    const sortedPhases = [...phases].sort((a, b) => a.order - b.order)
    sortedPhases.forEach((phase, idx) => {
      const phasePackets = packets.filter(p => p.phaseId === phase.id)
      lines.push(`### Phase ${idx + 1}: ${phase.name}`)
      lines.push("")
      lines.push(phase.description || "No description")
      lines.push("")
      lines.push(`**Packets:** ${phasePackets.length}`)
      lines.push("")
      if (phasePackets.length > 0) {
        phasePackets.forEach(p => {
          lines.push(`- [ ] ${p.title} (${p.priority})`)
        })
        lines.push("")
      }
    })
  } else {
    lines.push("*No phases defined*")
    lines.push("")
  }

  // All Packets Table
  lines.push("## All Packets")
  lines.push("")
  lines.push("| ID | Title | Type | Priority | Status |")
  lines.push("|----|-------|------|----------|--------|")

  if (packets.length > 0) {
    packets.forEach(packet => {
      lines.push(`| ${packet.id.substring(0, 8)} | ${packet.title} | ${packet.type} | ${packet.priority} | ${packet.status || "queued"} |`)
    })
  } else {
    lines.push("| - | No packets defined | - | - | - |")
  }
  lines.push("")

  // Footer
  lines.push("---")
  lines.push("")
  lines.push(`*Generated by Claudia Coder on ${formatDate(buildPlan.createdAt)}*`)

  return lines.join("\n")
}

/**
 * Generate KICKOFF.md
 */
function generateKickoffMarkdown(project: Project, buildPlan: StoredBuildPlan | null): string {
  // Cast to WorkPacket array to allow status property access
  const packets = (buildPlan?.originalPlan?.packets || []) as WorkPacket[]
  const lines: string[] = []

  // Frontmatter
  lines.push("---")
  lines.push(`title: "Claudia Coder Project Kickoff"`)
  lines.push(`project_id: "${project.id}"`)
  lines.push(`project_name: "${project.name}"`)
  if (buildPlan) {
    lines.push(`build_plan_id: "${buildPlan.id}"`)
  }
  lines.push(`generated: "${new Date().toISOString()}"`)
  lines.push("---")
  lines.push("")

  // Header
  lines.push("# Claudia Coder Project Kickoff")
  lines.push("")
  lines.push(`Welcome to the **${project.name}** project. This document provides everything you need to understand the project and contribute effectively.`)
  lines.push("")

  // Quick Links
  lines.push("## Quick Links")
  lines.push("")
  lines.push("| Document | Description |")
  lines.push("|----------|-------------|")
  lines.push("| [PRD.md](./docs/PRD.md) | Product requirements and goals |")
  lines.push("| [BUILD_PLAN.md](./docs/BUILD_PLAN.md) | Complete build plan with phases and packets |")
  lines.push("| [docs/packets/](./docs/packets/) | Individual work packet details |")
  lines.push("")

  // Project Overview
  lines.push("## Project Overview")
  lines.push("")
  lines.push(project.description || "No description provided.")
  lines.push("")

  // Work Packets
  lines.push("## Work Packets")
  lines.push("")
  if (packets.length > 0) {
    lines.push("| Packet | Type | Priority | Status |")
    lines.push("|--------|------|----------|--------|")
    packets.forEach(p => {
      lines.push(`| ${p.title} | ${p.type} | ${p.priority} | ${p.status || "queued"} |`)
    })
  } else {
    lines.push("*No work packets defined yet.*")
  }
  lines.push("")

  // Tech Stack
  if (buildPlan?.originalPlan?.spec?.techStack?.length) {
    lines.push("## Tech Stack")
    lines.push("")
    buildPlan.originalPlan.spec.techStack.forEach(tech => {
      lines.push(`- ${tech}`)
    })
    lines.push("")
  }

  // Working Guidelines
  lines.push("## Working Guidelines")
  lines.push("")
  lines.push("1. **Read the PRD first** - Understand the goals and non-goals")
  lines.push("2. **Check dependencies** - Ensure blocking packets are complete")
  lines.push("3. **Work incrementally** - Complete tasks one at a time")
  lines.push("4. **Stay in scope** - Reference non-goals if tempted to expand")
  lines.push("5. **Test thoroughly** - Verify acceptance criteria before completing")
  lines.push("")

  // Footer
  lines.push("---")
  lines.push("")
  lines.push("*This kickoff document is auto-generated by Claudia Coder.*")
  lines.push(`*Last updated: ${new Date().toISOString()}*`)

  return lines.join("\n")
}

/**
 * Generate packet markdown file
 */
function generatePacketMarkdown(packet: WorkPacket, buildPlan: StoredBuildPlan | null): string {
  const lines: string[] = []
  const phase = buildPlan?.originalPlan?.phases?.find(p => p.id === packet.phaseId)

  // Frontmatter
  lines.push("---")
  lines.push(`title: "${packet.title}"`)
  lines.push(`packet_id: "${packet.id}"`)
  lines.push(`type: "${packet.type}"`)
  lines.push(`priority: "${packet.priority}"`)
  lines.push(`status: "${packet.status || "queued"}"`)
  lines.push("---")
  lines.push("")

  // Title
  lines.push(`# ${packet.title}`)
  lines.push("")
  lines.push(`**Type:** ${packet.type} | **Priority:** ${packet.priority} | **Status:** ${packet.status || "queued"}`)
  lines.push("")

  // Phase context
  if (phase) {
    lines.push(`> Part of **Phase ${phase.order}: ${phase.name}**`)
    lines.push("")
  }

  // Description
  lines.push("## Description")
  lines.push("")
  lines.push(packet.description || "No description provided.")
  lines.push("")

  // Tasks
  lines.push("## Tasks")
  lines.push("")
  if (packet.tasks?.length) {
    packet.tasks.forEach(task => {
      const checkbox = task.completed ? "[x]" : "[ ]"
      lines.push(`- ${checkbox} ${task.description}`)
    })
  } else {
    lines.push("- No tasks defined")
  }
  lines.push("")

  // Acceptance Criteria
  lines.push("## Acceptance Criteria")
  lines.push("")
  if (packet.acceptanceCriteria?.length) {
    packet.acceptanceCriteria.forEach(criterion => {
      lines.push(`- [ ] ${criterion}`)
    })
  } else {
    lines.push("*No acceptance criteria defined*")
  }
  lines.push("")

  // Footer
  lines.push("---")
  lines.push("")
  lines.push(`*Generated by Claudia Coder*`)

  return lines.join("\n")
}

/**
 * Generate brain dump markdown
 */
function generateBrainDumpMarkdown(dump: BrainDump): string {
  const lines: string[] = []

  lines.push("---")
  lines.push(`id: "${dump.id}"`)
  lines.push(`status: "${dump.status}"`)
  lines.push(`created: "${formatDate(dump.createdAt)}"`)
  lines.push("---")
  lines.push("")

  lines.push(`# Brain Dump: ${dump.id.substring(0, 8)}`)
  lines.push("")
  lines.push(`**Status:** ${dump.status} | **Created:** ${formatDate(dump.createdAt)}`)
  lines.push("")

  // Transcription
  if (dump.transcription) {
    lines.push("## Transcription")
    lines.push("")
    lines.push(dump.transcription.text || "*No transcription available*")
    lines.push("")
    lines.push(`- **Method:** ${dump.transcription.method}`)
    lines.push(`- **Duration:** ${dump.transcription.duration} seconds`)
    lines.push(`- **Word Count:** ${dump.transcription.wordCount}`)
    lines.push("")
  }

  // Processed Content
  if (dump.processedContent) {
    const pc = dump.processedContent

    if (pc.summary) {
      lines.push("## Summary")
      lines.push("")
      lines.push(pc.summary)
      lines.push("")
    }

    if (pc.ideas?.length) {
      lines.push("## Ideas")
      lines.push("")
      pc.ideas.forEach(idea => {
        lines.push(`- ${idea}`)
      })
      lines.push("")
    }

    if (pc.actionItems?.length) {
      lines.push("## Action Items")
      lines.push("")
      pc.actionItems.forEach(item => {
        const checkbox = item.approved ? "[x]" : "[ ]"
        lines.push(`- ${checkbox} **[${item.priority}]** ${item.description}`)
      })
      lines.push("")
    }

    if (pc.decisions?.length) {
      lines.push("## Decisions")
      lines.push("")
      pc.decisions.forEach(decision => {
        lines.push(`### ${decision.description}`)
        lines.push("")
        lines.push(`*Rationale:* ${decision.rationale}`)
        lines.push("")
      })
    }

    if (pc.questions?.length) {
      lines.push("## Questions")
      lines.push("")
      pc.questions.forEach(q => {
        lines.push(`- ${q}`)
      })
      lines.push("")
    }

    if (pc.structuredMarkdown) {
      lines.push("## Full Content")
      lines.push("")
      lines.push(pc.structuredMarkdown)
      lines.push("")
    }
  }

  // Review Notes
  if (dump.reviewNotes) {
    lines.push("## Review Notes")
    lines.push("")
    lines.push(dump.reviewNotes)
    lines.push("")
  }

  return lines.join("\n")
}

/**
 * Generate voice recordings index markdown
 */
function generateVoiceRecordingsMarkdown(recordings: VoiceRecording[]): string {
  const lines: string[] = []

  lines.push("# Voice Recordings")
  lines.push("")
  lines.push(`Total recordings: ${recordings.length}`)
  lines.push("")

  recordings.forEach((recording, index) => {
    lines.push(`## ${index + 1}. ${recording.title || "Untitled Recording"}`)
    lines.push("")
    lines.push(`- **ID:** ${recording.id}`)
    lines.push(`- **Created:** ${formatDate(recording.createdAt)}`)
    lines.push(`- **Duration:** ${recording.audioDuration || 0} seconds`)
    lines.push(`- **Source:** ${recording.sourceContext || "unknown"}`)
    lines.push("")

    if (recording.tags?.length) {
      lines.push(`**Tags:** ${recording.tags.map(t => `\`${t}\``).join(" ")}`)
      lines.push("")
    }

    lines.push("### Transcription")
    lines.push("")
    lines.push(recording.transcription || "*No transcription available*")
    lines.push("")
    lines.push("---")
    lines.push("")
  })

  return lines.join("\n")
}

/**
 * Generate interview markdown
 */
function generateInterviewMarkdown(interview: InterviewSession): string {
  const lines: string[] = []

  lines.push("---")
  lines.push(`id: "${interview.id}"`)
  lines.push(`type: "${interview.type}"`)
  lines.push(`status: "${interview.status}"`)
  lines.push(`created: "${formatDate(interview.createdAt)}"`)
  lines.push("---")
  lines.push("")

  lines.push(`# Interview: ${interview.targetTitle || interview.type}`)
  lines.push("")
  lines.push(`**Type:** ${interview.type} | **Status:** ${interview.status}`)
  lines.push("")

  if (interview.targetType) {
    lines.push(`**Target:** ${interview.targetType} (${interview.targetId || "N/A"})`)
    lines.push("")
  }

  // Conversation
  lines.push("## Conversation")
  lines.push("")

  interview.messages?.forEach(msg => {
    const role = msg.role === "assistant" ? "**Claudia:**" : "**User:**"
    lines.push(`${role} ${msg.content}`)
    lines.push("")
  })

  // Summary and Key Points
  if (interview.summary) {
    lines.push("## Summary")
    lines.push("")
    lines.push(interview.summary)
    lines.push("")
  }

  if (interview.keyPoints?.length) {
    lines.push("## Key Points")
    lines.push("")
    interview.keyPoints.forEach(point => {
      lines.push(`- ${point}`)
    })
    lines.push("")
  }

  if (interview.suggestedActions?.length) {
    lines.push("## Suggested Actions")
    lines.push("")
    interview.suggestedActions.forEach(action => {
      lines.push(`- [ ] ${action}`)
    })
    lines.push("")
  }

  return lines.join("\n")
}

/**
 * Generate business development markdown
 */
function generateBusinessDevMarkdown(businessDev: BusinessDev): string {
  const lines: string[] = []

  lines.push("# Business Development Plan")
  lines.push("")
  lines.push(`**Status:** ${businessDev.status}`)
  lines.push(`**Created:** ${formatDate(businessDev.createdAt)}`)
  lines.push("")

  // Executive Summary
  if (businessDev.executiveSummary) {
    const es = businessDev.executiveSummary
    lines.push("## Executive Summary")
    lines.push("")
    if (es.overview) {
      lines.push("### Overview")
      lines.push("")
      lines.push(es.overview)
      lines.push("")
    }
    if (es.problem) {
      lines.push("### Problem")
      lines.push("")
      lines.push(es.problem)
      lines.push("")
    }
    if (es.solution) {
      lines.push("### Solution")
      lines.push("")
      lines.push(es.solution)
      lines.push("")
    }
    if (es.targetMarket) {
      lines.push("### Target Market")
      lines.push("")
      lines.push(es.targetMarket)
      lines.push("")
    }
    if (es.uniqueValue) {
      lines.push("### Unique Value Proposition")
      lines.push("")
      lines.push(es.uniqueValue)
      lines.push("")
    }
  }

  // Features
  if (businessDev.features?.length) {
    lines.push("## Features")
    lines.push("")
    lines.push("| Feature | Description | Priority |")
    lines.push("|---------|-------------|----------|")
    businessDev.features.forEach(f => {
      lines.push(`| ${f.name} | ${f.description} | ${f.priority} |`)
    })
    lines.push("")
  }

  // Market Analysis
  if (businessDev.marketAnalysis) {
    const ma = businessDev.marketAnalysis
    lines.push("## Market Analysis")
    lines.push("")
    if (ma.marketSize) {
      lines.push(`**Market Size:** ${ma.marketSize}`)
      lines.push("")
    }
    if (ma.targetAudience) {
      lines.push(`**Target Audience:** ${ma.targetAudience}`)
      lines.push("")
    }
    if (ma.differentiators?.length) {
      lines.push("### Differentiators")
      lines.push("")
      ma.differentiators.forEach(d => lines.push(`- ${d}`))
      lines.push("")
    }
    if (ma.competitors?.length) {
      lines.push("### Competitors")
      lines.push("")
      ma.competitors.forEach(c => {
        lines.push(`#### ${c.name}`)
        lines.push("")
        lines.push(c.description)
        lines.push("")
      })
    }
  }

  // Monetization
  if (businessDev.monetization) {
    const mon = businessDev.monetization
    lines.push("## Monetization")
    lines.push("")
    lines.push(`**Model:** ${mon.model}`)
    lines.push("")
    if (mon.pricing) {
      lines.push(`**Pricing:** ${mon.pricing}`)
      lines.push("")
    }
    if (mon.pricingTiers?.length) {
      lines.push("### Pricing Tiers")
      lines.push("")
      mon.pricingTiers.forEach(tier => {
        lines.push(`- **${tier.name}** - ${tier.price}`)
        tier.features?.forEach(f => lines.push(`  - ${f}`))
      })
      lines.push("")
    }
  }

  // Pro Forma
  if (businessDev.proForma) {
    const pf = businessDev.proForma
    lines.push("## Financial Projections")
    lines.push("")
    lines.push("| Year | Revenue |")
    lines.push("|------|---------|")
    lines.push(`| Year 1 | ${pf.yearOneRevenue} |`)
    lines.push(`| Year 2 | ${pf.yearTwoRevenue} |`)
    lines.push(`| Year 3 | ${pf.yearThreeRevenue} |`)
    lines.push("")
    if (pf.breakEvenPoint) {
      lines.push(`**Break Even:** ${pf.breakEvenPoint}`)
      lines.push("")
    }
  }

  return lines.join("\n")
}

// Manifest structure
interface ExportManifest {
  exportVersion: string
  exportedAt: string
  projectId: string
  projectName: string
  counts: {
    buildPlans: number
    packets: number
    packetRuns: number
    brainDumps: number
    resources: number
    voiceRecordings: number
    sourceCodeIncluded: boolean
  }
  directories: string[]
}

/**
 * Get the effective project path for source code
 */
async function getProjectPath(projectId: string, basePath?: string): Promise<string | null> {
  if (basePath) {
    try {
      await fs.access(basePath)
      return basePath
    } catch {
      return null
    }
  }

  const claudiaProjectsBase = process.env.CLAUDIA_PROJECTS_BASE || path.join(os.homedir(), "claudia-projects")

  try {
    const entries = await fs.readdir(claudiaProjectsBase, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const claudiaMetaPath = path.join(claudiaProjectsBase, entry.name, ".claudia")
        try {
          const metaContent = await fs.readFile(claudiaMetaPath, "utf-8")
          const meta = JSON.parse(metaContent)
          if (meta.projectId === projectId) {
            return path.join(claudiaProjectsBase, entry.name)
          }
        } catch {
          // No .claudia file or invalid JSON, skip
        }
      }
    }
  } catch {
    // Base directory doesn't exist or not readable
  }

  return null
}

/**
 * Check if a path should be skipped
 */
function shouldSkip(itemPath: string, name: string, isDirectory: boolean): boolean {
  if (name.startsWith(".")) {
    const allowedHidden = [
      ".env",
      ".env.local",
      ".env.example",
      ".gitignore",
      ".dockerignore",
      ".editorconfig",
      ".prettierrc",
      ".eslintrc",
      ".claudia",
    ]
    if (!allowedHidden.some((h) => name.startsWith(h))) {
      return true
    }
  }

  if (isDirectory) {
    return SKIP_DIRECTORIES.includes(name)
  }

  return SKIP_FILES.includes(name)
}

/**
 * Calculate total size of files to be archived
 */
async function calculateTotalSize(dirPath: string): Promise<number> {
  let totalSize = 0

  async function traverse(currentPath: string) {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name)

        if (shouldSkip(fullPath, entry.name, entry.isDirectory())) {
          continue
        }

        if (entry.isDirectory()) {
          await traverse(fullPath)
        } else if (entry.isFile()) {
          try {
            const stats = await fs.stat(fullPath)
            totalSize += stats.size
          } catch {
            // Skip files we can't stat
          }
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  await traverse(dirPath)
  return totalSize
}

/**
 * Convert Node.js stream to Web ReadableStream
 */
function nodeStreamToWebStream(nodeStream: Readable): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk))
      })

      nodeStream.on("end", () => {
        controller.close()
      })

      nodeStream.on("error", (error) => {
        controller.error(error)
      })
    },

    cancel() {
      nodeStream.destroy()
    },
  })
}

/**
 * Sanitize filename for safe filesystem use
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .substring(0, 100)
}

/**
 * POST /api/projects/[id]/export-all
 *
 * Generate and stream a complete project export ZIP
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: projectId } = await params
    const { searchParams } = new URL(request.url)
    const includeSourceCode = searchParams.get("includeSourceCode") !== "false"

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      )
    }

    // Parse the request body
    let body: ExportRequestBody
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      )
    }

    const {
      project,
      buildPlans = [],
      packets = [],
      packetRuns = [],
      brainDumps = [],
      resources = [],
      resourceFiles = [],
      businessDev,
      voiceRecordings = [],
    } = body

    if (!project) {
      return NextResponse.json(
        { error: "Project data is required" },
        { status: 400 }
      )
    }

    // Get project path if including source code
    let projectPath: string | null = null
    let sourceCodeSize = 0

    if (includeSourceCode) {
      projectPath = await getProjectPath(projectId, project.basePath || project.workingDirectory)

      if (projectPath) {
        sourceCodeSize = await calculateTotalSize(projectPath)

        if (sourceCodeSize > MAX_ARCHIVE_SIZE) {
          return NextResponse.json(
            {
              error: "Project too large",
              message: `Total file size (${(sourceCodeSize / 1024 / 1024).toFixed(2)} MB) exceeds maximum allowed size (200 MB)`
            },
            { status: 413 }
          )
        }
      }
    }

    // Create safe project name for ZIP
    const safeProjectName = sanitizeFilename(project.name || `project-${projectId}`)
    const exportFolderName = `${safeProjectName}-export`
    const zipFilename = `${safeProjectName}-complete-export.zip`

    // Create archiver instance
    const archive = archiver("zip", {
      zlib: { level: 6 },
    })

    // Handle archive errors
    archive.on("error", (err) => {
      console.error("[export-all] Archive error:", err)
      throw err
    })

    // Track file counts
    const counts = {
      buildPlans: 0,
      packets: 0,
      packetRuns: 0,
      brainDumps: 0,
      resources: 0,
      voiceRecordings: 0,
      sourceFiles: 0,
    }

    // Get the primary build plan (most recent)
    const primaryBuildPlan = buildPlans.length > 0
      ? buildPlans.sort((a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )[0]
      : null

    // Get interviews from project creation
    const interviews: InterviewSession[] = body.interviews || []
    if (project.creationInterview) {
      interviews.unshift(project.creationInterview)
    }

    // === 1. Generate README.md ===
    const readmeContent = generateReadme(project, primaryBuildPlan, {
      packets: packets.length,
      brainDumps: brainDumps.length,
      voiceRecordings: voiceRecordings.length,
      resources: resources.length,
      packetRuns: packetRuns.length,
    })
    archive.append(readmeContent, { name: `${exportFolderName}/README.md` })

    // === 2. Generate KICKOFF.md ===
    const kickoffContent = generateKickoffMarkdown(project, primaryBuildPlan)
    archive.append(kickoffContent, { name: `${exportFolderName}/KICKOFF.md` })

    // === 3. Generate docs/PRD.md ===
    if (primaryBuildPlan) {
      const prdContent = generatePRD(project, primaryBuildPlan)
      archive.append(prdContent, { name: `${exportFolderName}/docs/PRD.md` })

      // === 4. Generate docs/BUILD_PLAN.md ===
      const buildPlanMdContent = generateBuildPlanMarkdown(project, primaryBuildPlan)
      archive.append(buildPlanMdContent, { name: `${exportFolderName}/docs/BUILD_PLAN.md` })
    }

    // === 5. Generate docs/packets/*.md ===
    for (let i = 0; i < packets.length; i++) {
      const packet = packets[i]
      const packetMd = generatePacketMarkdown(packet, primaryBuildPlan)
      const paddedIndex = String(i + 1).padStart(3, "0")
      const slug = generateSlug(packet.title)
      const filename = `PKT-${paddedIndex}-${slug}.md`
      archive.append(packetMd, { name: `${exportFolderName}/docs/packets/${filename}` })
      counts.packets++
    }

    // === 6. Add project metadata (JSON) ===
    archive.append(
      JSON.stringify(project, null, 2),
      { name: `${exportFolderName}/data/project.json` }
    )

    // === 7. Add build plans (JSON) ===
    for (const buildPlan of buildPlans) {
      const filename = `${buildPlan.id}.json`
      archive.append(
        JSON.stringify(buildPlan, null, 2),
        { name: `${exportFolderName}/data/build-plans/${filename}` }
      )
      counts.buildPlans++
    }

    // === 8. Add packet runs (JSON) ===
    for (const run of packetRuns) {
      const filename = `${run.id}.json`
      archive.append(
        JSON.stringify(run, null, 2),
        { name: `${exportFolderName}/data/packet-runs/${filename}` }
      )
      counts.packetRuns++
    }

    // === 9. Generate brain-dumps/*.md ===
    for (const dump of brainDumps) {
      const brainDumpMd = generateBrainDumpMarkdown(dump)
      const filename = `brain-dump-${dump.id.substring(0, 8)}.md`
      archive.append(brainDumpMd, { name: `${exportFolderName}/brain-dumps/${filename}` })
      counts.brainDumps++
    }

    // Also add brain dumps as JSON for data preservation
    if (brainDumps.length > 0) {
      archive.append(
        JSON.stringify(brainDumps, null, 2),
        { name: `${exportFolderName}/data/brain-dumps.json` }
      )
    }

    // === 10. Add resources metadata and files ===
    if (resources.length > 0) {
      archive.append(
        JSON.stringify(resources, null, 2),
        { name: `${exportFolderName}/resources/index.json` }
      )
    }

    // Add actual resource files (base64 decoded)
    for (const resourceFile of resourceFiles) {
      try {
        const buffer = Buffer.from(resourceFile.data, "base64")
        archive.append(buffer, {
          name: `${exportFolderName}/resources/files/${resourceFile.name}`
        })
        counts.resources++
      } catch (err) {
        console.error(`[export-all] Error adding resource file ${resourceFile.name}:`, err)
      }
    }

    // === 11. Generate business-dev/BUSINESS_PLAN.md ===
    if (businessDev) {
      const businessDevMd = generateBusinessDevMarkdown(businessDev)
      archive.append(businessDevMd, { name: `${exportFolderName}/business-dev/BUSINESS_PLAN.md` })

      // Also keep JSON version
      archive.append(
        JSON.stringify(businessDev, null, 2),
        { name: `${exportFolderName}/data/business-dev.json` }
      )
    }

    // === 12. Generate voice-recordings/index.md ===
    if (voiceRecordings.length > 0) {
      const voiceRecordingsMd = generateVoiceRecordingsMarkdown(voiceRecordings)
      archive.append(voiceRecordingsMd, { name: `${exportFolderName}/voice-recordings/index.md` })

      // Also keep JSON version
      archive.append(
        JSON.stringify(voiceRecordings, null, 2),
        { name: `${exportFolderName}/data/voice-recordings.json` }
      )
      counts.voiceRecordings = voiceRecordings.length
    }

    // === 13. Generate interviews/*.md ===
    for (const interview of interviews) {
      const interviewMd = generateInterviewMarkdown(interview)
      const filename = `interview-${interview.id.substring(0, 8)}.md`
      archive.append(interviewMd, { name: `${exportFolderName}/interviews/${filename}` })
    }

    // Also add interviews as JSON
    if (interviews.length > 0) {
      archive.append(
        JSON.stringify(interviews, null, 2),
        { name: `${exportFolderName}/data/interviews.json` }
      )
    }

    // === 14. Add source code (if requested and available) ===
    if (includeSourceCode && projectPath) {
      async function addSourceToArchive(currentPath: string, relativePath: string = "") {
        try {
          const entries = await fs.readdir(currentPath, { withFileTypes: true })

          for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name)
            const entryRelativePath = relativePath
              ? path.join(relativePath, entry.name)
              : entry.name

            if (shouldSkip(fullPath, entry.name, entry.isDirectory())) {
              continue
            }

            if (entry.isDirectory()) {
              await addSourceToArchive(fullPath, entryRelativePath)
            } else if (entry.isFile()) {
              archive.file(fullPath, {
                name: `${exportFolderName}/source-code/${entryRelativePath}`
              })
              counts.sourceFiles++
            }
          }
        } catch (error) {
          console.error(`[export-all] Error adding ${currentPath}:`, error)
        }
      }

      await addSourceToArchive(projectPath)
    }

    // === 15. Create and add manifest ===
    const manifest: ExportManifest = {
      exportVersion: "2.0.0",
      exportedAt: new Date().toISOString(),
      projectId,
      projectName: project.name,
      counts: {
        buildPlans: counts.buildPlans,
        packets: counts.packets,
        packetRuns: counts.packetRuns,
        brainDumps: counts.brainDumps,
        resources: counts.resources,
        voiceRecordings: counts.voiceRecordings,
        sourceCodeIncluded: includeSourceCode && !!projectPath,
      },
      directories: [
        "docs",
        "docs/packets",
        "data",
        "data/build-plans",
        "data/packet-runs",
        "brain-dumps",
        "voice-recordings",
        "interviews",
        "resources",
        "business-dev",
        ...(includeSourceCode && projectPath ? ["src"] : []),
      ],
    }

    archive.append(
      JSON.stringify(manifest, null, 2),
      { name: `${exportFolderName}/manifest.json` }
    )

    // Finalize the archive
    archive.finalize()

    console.log(`[export-all] Created complete export for project ${projectId}:`, {
      buildPlans: counts.buildPlans,
      packets: counts.packets,
      packetRuns: counts.packetRuns,
      brainDumps: counts.brainDumps,
      resources: counts.resources,
      voiceRecordings: counts.voiceRecordings,
      sourceFiles: counts.sourceFiles,
    })

    // Convert Node.js stream to Web ReadableStream
    const webStream = nodeStreamToWebStream(archive as unknown as Readable)

    // Return streaming response
    return new NextResponse(webStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFilename}"`,
        "Cache-Control": "no-cache",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create export archive"
    console.error("[export-all] POST error:", message)

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/projects/[id]/export-all
 *
 * Returns information about the export endpoint
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id: projectId } = await params

  return NextResponse.json({
    message: "Use POST method to export project data",
    projectId,
    version: "2.0.0",
    description: "Exports all project data as a GitHub-ready repository structure",
    usage: {
      method: "POST",
      queryParams: {
        includeSourceCode: "true|false (default: true)"
      },
      body: {
        project: "Project object (required)",
        buildPlans: "Array of StoredBuildPlan objects",
        packets: "Array of WorkPacket objects",
        packetRuns: "Array of PacketRun objects",
        brainDumps: "Array of BrainDump objects",
        resources: "Array of ProjectResource objects",
        resourceFiles: "Array of { id, name, data (base64) } objects",
        businessDev: "BusinessDev object or null",
        voiceRecordings: "Array of VoiceRecording objects",
        interviews: "Array of InterviewSession objects (optional)",
      },
      response: "ZIP file stream",
    },
    zipStructure: {
      "README.md": "Project overview and documentation",
      "KICKOFF.md": "Project kickoff summary for Claude Code",
      "manifest.json": "Index of all exported data with counts",
      "docs/PRD.md": "Product Requirements Document (markdown)",
      "docs/BUILD_PLAN.md": "Development build plan (markdown)",
      "docs/packets/PKT-XXX-*.md": "Individual work packets (markdown)",
      "data/project.json": "Project metadata (JSON)",
      "data/build-plans/*.json": "Build plan data (JSON)",
      "data/packet-runs/*.json": "Execution history (JSON)",
      "data/interviews.json": "Interview data (JSON)",
      "data/brain-dumps.json": "Brain dump data (JSON)",
      "data/voice-recordings.json": "Voice recording metadata (JSON)",
      "data/business-dev.json": "Business development data (JSON)",
      "brain-dumps/*.md": "Brain dumps with transcriptions (markdown)",
      "voice-recordings/index.md": "Voice recording summaries with transcriptions (markdown)",
      "interviews/*.md": "Interview conversations (markdown)",
      "business-dev/BUSINESS_PLAN.md": "Business development plan (markdown)",
      "resources/index.json": "Resource metadata",
      "resources/files/*": "User uploaded files",
      "src/...": "Project source files (if includeSourceCode=true)",
    },
    features: [
      "GitHub-ready repository structure",
      "Human-readable markdown documentation",
      "PRD format build plan",
      "KICKOFF.md for Claude Code",
      "Individual packet markdown files",
      "Brain dump transcriptions as markdown",
      "Voice recording transcriptions",
      "Interview conversation history",
      "Business development plan",
      "Optional source code inclusion",
    ]
  })
}
