/**
 * Project File Generators
 *
 * Generate markdown documentation files for Claudia projects:
 * - PRD.md - Product Requirements Document
 * - BUILD_PLAN.md - Development build plan
 * - KICKOFF.md - Project kickoff summary for Claude Code
 * - PKT-XXX-{slug}.md - Individual work packets
 * - .claudia/config.json - Claudia project configuration
 */

import os from "os"
import path from "path"
import type { Project } from "@/lib/data/types"
import type { BuildPlan, WorkPacket } from "@/lib/ai/build-plan"

// ============ Types ============

/**
 * Generated config structure for .claudia/config.json
 * This is the output format used by generateClaudiaConfig
 */
export interface GeneratedClaudiaConfig {
  version: string
  projectId: string
  projectName: string
  createdAt: string
  updatedAt: string

  // Build plan reference
  buildPlanId: string
  buildPlanVersion: number

  // Packet tracking
  packets: {
    id: string
    title: string
    status: string
    phaseId: string
  }[]

  // Directories
  paths: {
    prd: string
    buildPlan: string
    kickoff: string
    packetsDir: string
    statusDir: string
    requestsDir: string
  }

  // Current state
  currentPacketId?: string
  lastActivityAt?: string
}

// ============ Helper Functions ============

/**
 * Generate a slug from a string for use in filenames
 */
export function generateSlug(text: string, maxLength = 30): string {
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
 * Format a date for display in documents
 */
function formatDate(dateString?: string): string {
  if (!dateString) return new Date().toISOString().split("T")[0]
  return new Date(dateString).toISOString().split("T")[0]
}

/**
 * Get priority indicator
 */
function priorityIndicator(priority: string): string {
  switch (priority) {
    case "critical": return "[!!!]"
    case "high": return "[!!]"
    case "medium": return "[!]"
    case "low": return ""
    default: return ""
  }
}

/**
 * Get status badge
 */
function statusBadge(status: string): string {
  switch (status) {
    case "completed": return "[DONE]"
    case "in_progress": return "[IN PROGRESS]"
    case "review": return "[REVIEW]"
    case "blocked": return "[BLOCKED]"
    case "assigned": return "[ASSIGNED]"
    case "queued": return "[QUEUED]"
    default: return `[${status.toUpperCase()}]`
  }
}

// ============ PRD Generator ============

/**
 * Generate PRD.md content from build plan
 *
 * The PRD (Product Requirements Document) provides a high-level overview
 * of what we're building and why. Includes:
 * - Project overview, goals, non-goals
 * - Tech stack
 * - Success criteria
 * - Assumptions and risks
 */
export function generatePRD(buildPlan: BuildPlan, project: Project): string {
  const { spec } = buildPlan
  const lines: string[] = []

  // Frontmatter
  lines.push("---")
  lines.push(`title: "${spec.name}"`)
  lines.push(`project_id: "${project.id}"`)
  lines.push(`build_plan_id: "${buildPlan.id}"`)
  lines.push(`version: ${buildPlan.version}`)
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

  // Project Goals / Objectives
  lines.push("## Goals")
  lines.push("")
  if (spec.objectives && spec.objectives.length > 0) {
    spec.objectives.forEach((obj, i) => {
      lines.push(`${i + 1}. ${obj}`)
    })
  } else {
    lines.push("*No objectives defined*")
  }
  lines.push("")

  // Non-Goals (Explicit scope boundaries)
  lines.push("## Non-Goals")
  lines.push("")
  lines.push("The following are explicitly **out of scope** for this project:")
  lines.push("")
  if (spec.nonGoals && spec.nonGoals.length > 0) {
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
  if (spec.techStack && spec.techStack.length > 0) {
    spec.techStack.forEach(tech => {
      lines.push(`- ${tech}`)
    })
  } else {
    lines.push("*Tech stack not specified*")
  }
  lines.push("")

  // Success Criteria (derived from phase success criteria)
  lines.push("## Success Criteria")
  lines.push("")
  lines.push("The project is considered successful when:")
  lines.push("")
  const allCriteria = buildPlan.phases?.flatMap(p => p.successCriteria || []) || []
  if (allCriteria.length > 0) {
    allCriteria.forEach(criterion => {
      lines.push(`- [ ] ${criterion}`)
    })
  } else {
    lines.push("- [ ] All work packets completed")
    lines.push("- [ ] All acceptance criteria met")
  }
  lines.push("")

  // Assumptions
  lines.push("## Assumptions")
  lines.push("")
  if (spec.assumptions && spec.assumptions.length > 0) {
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
  if (spec.risks && spec.risks.length > 0) {
    lines.push("| Risk | Mitigation |")
    lines.push("|------|------------|")
    spec.risks.forEach(risk => {
      // Try to split on common patterns like "Mitigation:", "-", etc.
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

  // Linked Resources
  lines.push("## Linked Resources")
  lines.push("")
  lines.push("### Repositories")
  if (project.repos && project.repos.length > 0) {
    project.repos.forEach(r => {
      lines.push(`- [${r.name}](${r.url}) (${r.provider})`)
    })
  } else {
    lines.push("- No repositories linked")
  }
  lines.push("")
  lines.push("### Tags")
  if (project.tags && project.tags.length > 0) {
    lines.push(project.tags.map(t => `\`${t}\``).join(" "))
  } else {
    lines.push("No tags")
  }
  lines.push("")

  // Metadata footer
  lines.push("---")
  lines.push("")
  lines.push(`*Generated by Claudia Coder on ${formatDate(buildPlan.createdAt)}*`)
  lines.push(`*Model: ${buildPlan.generatedBy}*`)

  return lines.join("\n")
}

// ============ Build Plan Markdown Generator ============

/**
 * Generate BUILD_PLAN.md content
 *
 * The build plan provides the complete breakdown of work:
 * - All phases with descriptions
 * - Packet summary table
 * - Dependencies
 * - Timeline/ordering
 */
export function generateBuildPlanMarkdown(buildPlan: BuildPlan, project: Project): string {
  const { spec, phases, packets } = buildPlan
  const lines: string[] = []

  // Frontmatter
  lines.push("---")
  lines.push(`title: "Build Plan: ${spec.name}"`)
  lines.push(`project_id: "${project.id}"`)
  lines.push(`build_plan_id: "${buildPlan.id}"`)
  lines.push(`version: ${buildPlan.version}`)
  lines.push(`created: "${formatDate(buildPlan.createdAt)}"`)
  lines.push(`status: "${buildPlan.status}"`)
  lines.push(`total_phases: ${phases?.length || 0}`)
  lines.push(`total_packets: ${packets?.length || 0}`)
  lines.push("---")
  lines.push("")

  // Title
  lines.push(`# Build Plan: ${spec.name}`)
  lines.push("")

  // Summary
  lines.push("## Summary")
  lines.push("")
  lines.push(spec.description || project.description || "No summary available.")
  lines.push("")

  // Stats table
  const packetList = packets || []
  lines.push("### Statistics")
  lines.push("")
  lines.push("| Metric | Value |")
  lines.push("|--------|-------|")
  lines.push(`| Phases | ${phases?.length || 0} |`)
  lines.push(`| Total Packets | ${packetList.length} |`)
  lines.push(`| Queued | ${packetList.filter(p => p.status === "queued").length} |`)
  lines.push(`| In Progress | ${packetList.filter(p => p.status === "in_progress").length} |`)
  lines.push(`| Completed | ${packetList.filter(p => p.status === "completed").length} |`)
  lines.push("")

  // Phases
  lines.push("## Phases")
  lines.push("")

  const sortedPhases = [...(phases || [])].sort((a, b) => a.order - b.order)

  if (sortedPhases.length > 0) {
    sortedPhases.forEach((phase, phaseIdx) => {
      const phasePackets = packetList.filter(p => p.phaseId === phase.id)
      const completedCount = phasePackets.filter(p => p.status === "completed").length
      const progress = phasePackets.length > 0
        ? Math.round((completedCount / phasePackets.length) * 100)
        : 0

      lines.push(`### Phase ${phaseIdx + 1}: ${phase.name}`)
      lines.push("")
      lines.push(phase.description || "No description")
      lines.push("")
      lines.push(`**Progress:** ${completedCount}/${phasePackets.length} packets (${progress}%)`)
      lines.push("")

      // Dependencies
      if (phase.dependencies && phase.dependencies.length > 0) {
        const depNames = phase.dependencies
          .map(depId => phases?.find(p => p.id === depId)?.name || depId)
          .join(", ")
        lines.push(`**Depends on:** ${depNames}`)
        lines.push("")
      }

      // Effort estimate
      if (phase.estimatedEffort) {
        const effort = phase.estimatedEffort
        lines.push(`**Estimated Effort:** ${effort.optimistic}-${effort.pessimistic}h (realistic: ${effort.realistic}h, confidence: ${effort.confidence})`)
        lines.push("")
      }

      // Success criteria
      if (phase.successCriteria && phase.successCriteria.length > 0) {
        lines.push("**Success Criteria:**")
        phase.successCriteria.forEach(criterion => {
          lines.push(`- [ ] ${criterion}`)
        })
        lines.push("")
      }

      // Packets in this phase
      if (phasePackets.length > 0) {
        lines.push("**Packets:**")
        lines.push("")
        phasePackets.forEach(packet => {
          const priority = priorityIndicator(packet.priority)
          const status = statusBadge(packet.status)
          lines.push(`- ${status} ${packet.title} ${priority}`.trim())
        })
        lines.push("")
      }
    })
  } else {
    lines.push("### Implementation Phase")
    lines.push("")
    lines.push("All work packets are organized in a single implementation phase.")
    lines.push("")
    lines.push("**Packets:**")
    if (packetList.length > 0) {
      packetList.forEach(p => {
        lines.push(`- [ ] [${p.id}] ${p.title} (${p.priority})`)
      })
    } else {
      lines.push("- No packets defined yet")
    }
    lines.push("")
  }

  // Full Packet Table
  lines.push("## All Packets")
  lines.push("")
  lines.push("| ID | Title | Type | Priority | Status | Dependencies |")
  lines.push("|----|-------|------|----------|--------|--------------|")

  if (packetList.length > 0) {
    packetList.forEach(packet => {
      const deps = packet.blockedBy && packet.blockedBy.length > 0 ? packet.blockedBy.join(", ") : "-"
      lines.push(`| ${packet.id} | ${packet.title} | ${packet.type} | ${packet.priority} | ${packet.status} | ${deps} |`)
    })
  } else {
    lines.push("| - | No packets defined | - | - | - | - |")
  }
  lines.push("")

  // Dependency Graph (text representation)
  lines.push("## Dependency Graph")
  lines.push("")
  lines.push("```mermaid")
  lines.push("graph LR")

  const packetsWithDeps = packetList.filter(p => (p.blockedBy && p.blockedBy.length > 0) || (p.blocks && p.blocks.length > 0))
  if (packetsWithDeps.length > 0) {
    packetList.forEach(packet => {
      if (packet.blockedBy && packet.blockedBy.length > 0) {
        packet.blockedBy.forEach(depId => {
          const depPacket = packetList.find(p => p.id === depId)
          const depTitle = (depPacket?.title || depId).replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 20)
          const packetTitle = packet.title.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 20)
          lines.push(`    ${depId}["${depTitle}"] --> ${packet.id}["${packetTitle}"]`)
        })
      }
    })
  } else {
    lines.push("    A[No dependencies between packets]")
  }
  lines.push("```")
  lines.push("")

  // Timeline / Ordering
  lines.push("## Execution Order")
  lines.push("")
  lines.push("Recommended execution sequence based on dependencies and priorities:")
  lines.push("")

  // Group packets by priority
  const criticalPackets = packetList.filter(p => p.priority === "critical")
  const highPackets = packetList.filter(p => p.priority === "high")
  const mediumPackets = packetList.filter(p => p.priority === "medium")
  const lowPackets = packetList.filter(p => p.priority === "low")

  let order = 1

  if (criticalPackets.length > 0) {
    lines.push("### Critical (Must Complete First)")
    lines.push("")
    criticalPackets.forEach(p => {
      const desc = p.description?.substring(0, 80) || "No description"
      lines.push(`${order}. **${p.title}** - ${desc}${(p.description?.length || 0) > 80 ? "..." : ""}`)
      order++
    })
    lines.push("")
  }

  if (highPackets.length > 0) {
    lines.push("### High Priority")
    lines.push("")
    highPackets.forEach(p => {
      const desc = p.description?.substring(0, 80) || "No description"
      lines.push(`${order}. **${p.title}** - ${desc}${(p.description?.length || 0) > 80 ? "..." : ""}`)
      order++
    })
    lines.push("")
  }

  if (mediumPackets.length > 0) {
    lines.push("### Medium Priority")
    lines.push("")
    mediumPackets.forEach(p => {
      const desc = p.description?.substring(0, 80) || "No description"
      lines.push(`${order}. **${p.title}** - ${desc}${(p.description?.length || 0) > 80 ? "..." : ""}`)
      order++
    })
    lines.push("")
  }

  if (lowPackets.length > 0) {
    lines.push("### Low Priority (Can Defer)")
    lines.push("")
    lowPackets.forEach(p => {
      const desc = p.description?.substring(0, 80) || "No description"
      lines.push(`${order}. **${p.title}** - ${desc}${(p.description?.length || 0) > 80 ? "..." : ""}`)
      order++
    })
    lines.push("")
  }

  // Generation Metadata
  lines.push("## Generation Metadata")
  lines.push("")
  lines.push(`- **Generated by:** ${buildPlan.generatedBy || "Unknown"}`)
  lines.push(`- **Build Plan ID:** ${buildPlan.id}`)
  lines.push(`- **Version:** ${buildPlan.version}`)
  lines.push("")

  // Footer
  lines.push("---")
  lines.push("")
  lines.push(`*Generated by Claudia Coder on ${formatDate(buildPlan.createdAt)}*`)

  return lines.join("\n")
}

// ============ Packet Markdown Generator ============

/**
 * Generate individual packet markdown file
 *
 * Each packet gets its own file with full details for Claude Code to work on.
 */
export function generatePacketMarkdown(packet: WorkPacket, buildPlan: BuildPlan): string {
  const lines: string[] = []
  const phase = buildPlan.phases?.find(p => p.id === packet.phaseId)
  const packetList = buildPlan.packets || []

  // Frontmatter
  lines.push("---")
  lines.push(`title: "${packet.title}"`)
  lines.push(`packet_id: "${packet.id}"`)
  lines.push(`phase_id: "${packet.phaseId}"`)
  lines.push(`type: "${packet.type}"`)
  lines.push(`priority: "${packet.priority}"`)
  lines.push(`status: "${packet.status}"`)
  lines.push(`suggested_model: "${packet.suggestedTaskType || "coding"}"`)
  lines.push(`estimated_tokens: ${packet.estimatedTokens || 0}`)
  if (packet.blockedBy && packet.blockedBy.length > 0) {
    lines.push(`blocked_by: [${packet.blockedBy.map(b => `"${b}"`).join(", ")}]`)
  }
  if (packet.blocks && packet.blocks.length > 0) {
    lines.push(`blocks: [${packet.blocks.map(b => `"${b}"`).join(", ")}]`)
  }
  lines.push("---")
  lines.push("")

  // Title with status
  lines.push(`# ${packet.title}`)
  lines.push("")
  lines.push(`**Status:** ${statusBadge(packet.status)} | **Type:** ${packet.type} | **Priority:** ${packet.priority}`)
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

  // Tasks (checklist)
  lines.push("## Tasks")
  lines.push("")
  const sortedTasks = [...(packet.tasks || [])].sort((a, b) => a.order - b.order)
  if (sortedTasks.length > 0) {
    sortedTasks.forEach(task => {
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
  if (packet.acceptanceCriteria && packet.acceptanceCriteria.length > 0) {
    packet.acceptanceCriteria.forEach(criterion => {
      lines.push(`- [ ] ${criterion}`)
    })
  } else {
    lines.push("*No acceptance criteria defined*")
  }
  lines.push("")

  // Dependencies
  if (packet.blockedBy && packet.blockedBy.length > 0) {
    lines.push("## Dependencies")
    lines.push("")
    lines.push("This packet is blocked by:")
    lines.push("")
    packet.blockedBy.forEach(depId => {
      const depPacket = packetList.find(p => p.id === depId)
      if (depPacket) {
        lines.push(`- **${depPacket.title}** (${depPacket.status})`)
      } else {
        lines.push(`- ${depId}`)
      }
    })
    lines.push("")
  }

  // Blocking others
  if (packet.blocks && packet.blocks.length > 0) {
    lines.push("## Blocks")
    lines.push("")
    lines.push("Completing this packet unblocks:")
    lines.push("")
    packet.blocks.forEach(blockId => {
      const blockedPacket = packetList.find(p => p.id === blockId)
      if (blockedPacket) {
        lines.push(`- **${blockedPacket.title}**`)
      } else {
        lines.push(`- ${blockId}`)
      }
    })
    lines.push("")
  }

  // Suggested Model Type
  lines.push("## Suggested Model Type")
  lines.push("")
  lines.push(`**${packet.suggestedTaskType || "coding"}**`)
  lines.push("")
  lines.push(`This packet is best suited for a model specialized in ${packet.suggestedTaskType || "coding"} tasks.`)
  lines.push("")

  // Estimation
  lines.push("## Estimation")
  lines.push("")
  lines.push(`- **Estimated Tokens:** ${packet.estimatedTokens?.toLocaleString() || "Unknown"}`)
  lines.push(`- **Estimated Cost:** ${packet.estimatedCost ? `$${packet.estimatedCost.toFixed(4)}` : "N/A"}`)
  lines.push("")

  // Implementation Notes section
  lines.push("## Implementation Notes")
  lines.push("")
  lines.push("*Add implementation notes here as work progresses...*")
  lines.push("")

  // Footer
  lines.push("---")
  lines.push("")
  lines.push(`*Generated by Claudia Coder on ${formatDate()}*`)

  return lines.join("\n")
}

// ============ Kickoff Generator ============

/**
 * Generate KICKOFF.md for Claude Code
 *
 * This is the primary instruction file that Claude Code reads to understand
 * how to work on this project. It includes:
 * - Clear instructions for Claude Code on how to work
 * - How to report progress (create files in .claudia/status/)
 * - How to request things (create files in .claudia/requests/)
 * - Current packet details if one is assigned
 * - Links to all relevant docs
 */
export function generateKickoffMarkdown(
  project: Project,
  buildPlan: BuildPlan,
  currentPacket?: WorkPacket
): string {
  const lines: string[] = []
  const packetList = buildPlan.packets || []

  // Frontmatter
  lines.push("---")
  lines.push(`title: "Claudia Coder Project Kickoff"`)
  lines.push(`project_id: "${project.id}"`)
  lines.push(`project_name: "${project.name}"`)
  lines.push(`build_plan_id: "${buildPlan.id}"`)
  lines.push(`generated: "${new Date().toISOString()}"`)
  if (currentPacket) {
    lines.push(`current_packet: "${currentPacket.id}"`)
  }
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
  if (currentPacket) {
    lines.push(`| [Current Packet](./docs/packets/${generateSlug(currentPacket.title)}.md) | Your assigned work packet |`)
  }
  lines.push("| [.claudia/status/](./.claudia/status/) | Status update directory |")
  lines.push("| [.claudia/requests/](./.claudia/requests/) | Request directory |")
  lines.push("")

  // Project Overview
  lines.push("## Project Overview")
  lines.push("")
  lines.push(project.description || buildPlan.spec?.description || "No description provided.")
  lines.push("")

  // Current Assignment
  if (currentPacket) {
    lines.push("## Your Current Assignment")
    lines.push("")
    lines.push(`You are assigned to work on: **${currentPacket.title}**`)
    lines.push("")
    lines.push(`**Type:** ${currentPacket.type} | **Priority:** ${currentPacket.priority}`)
    lines.push("")
    lines.push("### Description")
    lines.push("")
    lines.push(currentPacket.description || "No description provided.")
    lines.push("")
    lines.push("### Tasks")
    lines.push("")
    if (currentPacket.tasks && currentPacket.tasks.length > 0) {
      currentPacket.tasks.forEach(task => {
        const checkbox = task.completed ? "[x]" : "[ ]"
        lines.push(`- ${checkbox} ${task.description}`)
      })
    } else {
      lines.push("- No tasks defined")
    }
    lines.push("")
    lines.push("### Acceptance Criteria")
    lines.push("")
    if (currentPacket.acceptanceCriteria && currentPacket.acceptanceCriteria.length > 0) {
      currentPacket.acceptanceCriteria.forEach(criterion => {
        lines.push(`- [ ] ${criterion}`)
      })
    } else {
      lines.push("- No acceptance criteria defined")
    }
    lines.push("")

    // Dependencies
    if (currentPacket.blockedBy && currentPacket.blockedBy.length > 0) {
      lines.push("### Dependencies")
      lines.push("")
      lines.push("This packet depends on these being completed first:")
      lines.push("")
      currentPacket.blockedBy.forEach(depId => {
        const dep = packetList.find(p => p.id === depId)
        lines.push(`- ${dep ? dep.title : depId} (${dep?.status || "unknown"})`)
      })
      lines.push("")
    }
  } else {
    lines.push("## Available Packets")
    lines.push("")
    lines.push("No specific packet is assigned. Here are packets ready to work on:")
    lines.push("")
    const readyPackets = packetList.filter(p =>
      p.status === "queued" &&
      (!p.blockedBy || p.blockedBy.every(depId => {
        const dep = packetList.find(dp => dp.id === depId)
        return dep?.status === "completed"
      }))
    )
    if (readyPackets.length > 0) {
      readyPackets.slice(0, 5).forEach(packet => {
        const desc = packet.description?.substring(0, 60) || "No description"
        lines.push(`- **${packet.title}** (${packet.priority}) - ${desc}...`)
      })
    } else {
      lines.push("*No packets currently available. Check BUILD_PLAN.md for blocked items.*")
    }
    lines.push("")
  }

  // Communication Protocol
  lines.push("## How to Communicate")
  lines.push("")
  lines.push("Claudia Coder monitors the `.claudia/` directory for status updates and requests. Use the following protocols:")
  lines.push("")

  // Status Updates
  lines.push("### Reporting Progress")
  lines.push("")
  lines.push("Create files in `.claudia/status/` to report your progress:")
  lines.push("")
  lines.push("```")
  lines.push(".claudia/status/")
  lines.push("  YYYY-MM-DD-HHMMSS-status.md   # Status update")
  lines.push("  YYYY-MM-DD-HHMMSS-complete.md # Completion report")
  lines.push("  YYYY-MM-DD-HHMMSS-blocked.md  # Blocked notification")
  lines.push("```")
  lines.push("")
  lines.push("**Status update format:**")
  lines.push("")
  lines.push("```markdown")
  lines.push("---")
  lines.push("type: status")
  lines.push("packet_id: \"<current-packet-id>\"")
  lines.push("timestamp: \"<ISO-8601>\"")
  lines.push("---")
  lines.push("")
  lines.push("## Progress")
  lines.push("")
  lines.push("- [x] Task 1 completed")
  lines.push("- [x] Task 2 completed")
  lines.push("- [ ] Task 3 in progress")
  lines.push("")
  lines.push("## Notes")
  lines.push("")
  lines.push("<Any relevant notes about progress>")
  lines.push("```")
  lines.push("")

  lines.push("**Completion report format:**")
  lines.push("")
  lines.push("```markdown")
  lines.push("---")
  lines.push("type: complete")
  lines.push("packet_id: \"<packet-id>\"")
  lines.push("timestamp: \"<ISO-8601>\"")
  lines.push("---")
  lines.push("")
  lines.push("## Summary")
  lines.push("")
  lines.push("<Brief summary of what was accomplished>")
  lines.push("")
  lines.push("## Files Changed")
  lines.push("")
  lines.push("- path/to/file1.ts")
  lines.push("- path/to/file2.ts")
  lines.push("")
  lines.push("## Acceptance Criteria Met")
  lines.push("")
  lines.push("- [x] Criteria 1")
  lines.push("- [x] Criteria 2")
  lines.push("```")
  lines.push("")

  // Requests
  lines.push("### Making Requests")
  lines.push("")
  lines.push("Create files in `.claudia/requests/` to request help or resources:")
  lines.push("")
  lines.push("```")
  lines.push(".claudia/requests/")
  lines.push("  YYYY-MM-DD-HHMMSS-clarification.md  # Need clarification")
  lines.push("  YYYY-MM-DD-HHMMSS-resource.md       # Need a resource")
  lines.push("  YYYY-MM-DD-HHMMSS-approval.md       # Need approval")
  lines.push("  YYYY-MM-DD-HHMMSS-blocked.md        # Blocked, need help")
  lines.push("```")
  lines.push("")
  lines.push("**Request format:**")
  lines.push("")
  lines.push("```markdown")
  lines.push("---")
  lines.push("type: clarification | resource | approval | blocked")
  lines.push("packet_id: \"<packet-id>\"")
  lines.push("priority: low | medium | high | critical")
  lines.push("timestamp: \"<ISO-8601>\"")
  lines.push("---")
  lines.push("")
  lines.push("## Request")
  lines.push("")
  lines.push("<Describe what you need>")
  lines.push("")
  lines.push("## Context")
  lines.push("")
  lines.push("<Why you need it, what you've tried>")
  lines.push("```")
  lines.push("")

  // Working Guidelines
  lines.push("## Working Guidelines")
  lines.push("")
  lines.push("1. **Read the PRD first** - Understand the goals and non-goals")
  lines.push("2. **Check dependencies** - Ensure blocking packets are complete")
  lines.push("3. **Work incrementally** - Complete tasks one at a time")
  lines.push("4. **Report progress** - Create status files regularly")
  lines.push("5. **Ask for help** - Create request files when blocked")
  lines.push("6. **Stay in scope** - Reference non-goals if tempted to expand")
  lines.push("7. **Test thoroughly** - Verify acceptance criteria before completing")
  lines.push("")

  // Tech Stack
  lines.push("## Tech Stack")
  lines.push("")
  if (buildPlan.spec?.techStack && buildPlan.spec.techStack.length > 0) {
    buildPlan.spec.techStack.forEach(tech => {
      lines.push(`- ${tech}`)
    })
  } else {
    lines.push("*See PRD.md for tech stack details*")
  }
  lines.push("")

  // Project Structure
  lines.push("## Project Structure")
  lines.push("")
  lines.push("```")
  lines.push(`${project.workingDirectory || path.join(os.homedir(), "claudia-projects") + "/" + generateSlug(project.name)}/`)
  lines.push("|-- .claudia/")
  lines.push("|   |-- config.json      # Project configuration")
  lines.push("|   |-- status/          # Execution status files")
  lines.push("|   +-- requests/        # Pending requests")
  lines.push("|-- docs/")
  lines.push("|   |-- PRD.md           # Product Requirements")
  lines.push("|   |-- BUILD_PLAN.md    # Development plan")
  lines.push("|   +-- packets/         # Individual work packets")
  lines.push("|-- KICKOFF.md           # This file")
  lines.push("+-- src/                 # Source code")
  lines.push("```")
  lines.push("")

  // Repository Info
  if (project.repos && project.repos.length > 0) {
    lines.push("## Repositories")
    lines.push("")
    project.repos.forEach(repo => {
      lines.push(`- **${repo.name}** (${repo.provider})`)
      if (repo.localPath) {
        lines.push(`  - Local: \`${repo.localPath}\``)
      }
      if (repo.url) {
        lines.push(`  - Remote: ${repo.url}`)
      }
    })
    lines.push("")
  }

  // Work Summary
  lines.push("## Work Summary")
  lines.push("")
  const totalPackets = packetList.length
  const criticalPackets = packetList.filter(p => p.priority === "critical").length
  const highPackets = packetList.filter(p => p.priority === "high").length
  const completedPackets = packetList.filter(p => p.status === "completed").length

  lines.push(`- **Total Work Packets:** ${totalPackets}`)
  lines.push(`- **Completed:** ${completedPackets}`)
  lines.push(`- **Critical Priority:** ${criticalPackets}`)
  lines.push(`- **High Priority:** ${highPackets}`)
  lines.push("")

  // Footer
  lines.push("---")
  lines.push("")
  lines.push("*This kickoff document is auto-generated by Claudia Coder. Do not edit directly.*")
  lines.push(`*Last updated: ${new Date().toISOString()}*`)

  return lines.join("\n")
}

// ============ Config Generator ============

/**
 * Generate the .claudia/config.json file
 *
 * This JSON config file is used for programmatic access to project metadata.
 */
export function generateClaudiaConfig(
  project: Project,
  buildPlan: BuildPlan,
  packets: WorkPacket[]
): GeneratedClaudiaConfig {
  const now = new Date().toISOString()

  return {
    version: "1.0.0",
    projectId: project.id,
    projectName: project.name,
    createdAt: buildPlan.createdAt,
    updatedAt: now,

    buildPlanId: buildPlan.id,
    buildPlanVersion: buildPlan.version,

    packets: packets.map(p => ({
      id: p.id,
      title: p.title,
      status: p.status,
      phaseId: p.phaseId
    })),

    paths: {
      prd: "docs/PRD.md",
      buildPlan: "docs/BUILD_PLAN.md",
      kickoff: "KICKOFF.md",
      packetsDir: "docs/packets/",
      statusDir: ".claudia/status/",
      requestsDir: ".claudia/requests/"
    },

    currentPacketId: packets.find(p => p.status === "in_progress")?.id,
    lastActivityAt: now
  }
}

// ============ Utility Functions ============

/**
 * Get the filename for a packet
 */
export function getPacketFilename(packet: WorkPacket, index: number): string {
  const paddedIndex = String(index).padStart(3, "0")
  const slug = generateSlug(packet.title)
  return `PKT-${paddedIndex}-${slug}.md`
}

/**
 * Generate the .claudia/config.json as a string
 */
export function generateConfigJSON(
  project: Project,
  buildPlan: BuildPlan
): string {
  const config = generateClaudiaConfig(project, buildPlan, buildPlan.packets || [])
  return JSON.stringify(config, null, 2)
}
