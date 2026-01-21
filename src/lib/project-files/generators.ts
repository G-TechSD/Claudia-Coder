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

// ============ Brain Dumps Generator ============

/**
 * Brain dump data structure for generation
 * Matches the BrainDump type from types.ts
 */
interface BrainDumpForGeneration {
  id: string
  projectId: string
  resourceId: string
  status: string
  createdAt: string
  updatedAt: string
  transcription?: {
    text: string
    method: string
    duration: number
    wordCount: number
    confidence?: number
    transcribedAt: string
  }
  processedContent?: {
    summary: string
    structuredMarkdown: string
    sections: Array<{
      id: string
      title: string
      content: string
      type: string
      approved: boolean
    }>
    actionItems: Array<{
      id: string
      description: string
      priority: string
      category: string
      approved: boolean
    }>
    ideas: string[]
    decisions: Array<{
      id: string
      description: string
      rationale: string
      approved: boolean
    }>
    questions: string[]
    rawInsights: string[]
    processedAt: string
    processedBy: string
  }
  reviewNotes?: string
  approvedSections?: string[]
}

/**
 * Generate BRAIN_DUMPS.md content from brain dump data
 *
 * Contains all transcribed brain dumps and processed insights
 * for Claude Code to reference during development.
 */
export function generateBrainDumpsMarkdown(
  brainDumps: BrainDumpForGeneration[],
  project: Project
): string {
  const lines: string[] = []

  // Frontmatter
  lines.push("---")
  lines.push(`title: "Brain Dumps: ${project.name}"`)
  lines.push(`project_id: "${project.id}"`)
  lines.push(`total_dumps: ${brainDumps.length}`)
  lines.push(`generated: "${new Date().toISOString()}"`)
  lines.push("---")
  lines.push("")

  // Title
  lines.push("# Brain Dumps")
  lines.push("")
  lines.push(`This document contains all brain dump recordings and their processed insights for **${project.name}**.`)
  lines.push("")

  if (brainDumps.length === 0) {
    lines.push("*No brain dumps recorded yet.*")
    lines.push("")
    return lines.join("\n")
  }

  // Summary
  lines.push("## Summary")
  lines.push("")
  lines.push(`| Metric | Value |`)
  lines.push(`|--------|-------|`)
  lines.push(`| Total Brain Dumps | ${brainDumps.length} |`)
  lines.push(`| Completed | ${brainDumps.filter(d => d.status === "completed").length} |`)
  lines.push(`| In Review | ${brainDumps.filter(d => d.status === "review").length} |`)
  lines.push("")

  // Each brain dump
  brainDumps.forEach((dump, index) => {
    lines.push(`## Brain Dump ${index + 1}`)
    lines.push("")
    lines.push(`**ID:** ${dump.id}`)
    lines.push(`**Status:** ${dump.status}`)
    lines.push(`**Created:** ${formatDate(dump.createdAt)}`)
    lines.push("")

    // Transcription
    if (dump.transcription) {
      lines.push("### Transcription")
      lines.push("")
      lines.push(`> Duration: ${Math.round(dump.transcription.duration / 60)} minutes | Words: ${dump.transcription.wordCount}`)
      lines.push("")
      lines.push("```")
      lines.push(dump.transcription.text)
      lines.push("```")
      lines.push("")
    }

    // Processed content
    if (dump.processedContent) {
      const pc = dump.processedContent

      // Summary
      if (pc.summary) {
        lines.push("### Summary")
        lines.push("")
        lines.push(pc.summary)
        lines.push("")
      }

      // Structured content
      if (pc.structuredMarkdown) {
        lines.push("### Structured Content")
        lines.push("")
        lines.push(pc.structuredMarkdown)
        lines.push("")
      }

      // Action Items
      if (pc.actionItems && pc.actionItems.length > 0) {
        lines.push("### Action Items")
        lines.push("")
        pc.actionItems.forEach(item => {
          const checkbox = item.approved ? "[x]" : "[ ]"
          const priority = item.priority === "high" ? "(!)" : ""
          lines.push(`- ${checkbox} ${priority} ${item.description} *(${item.category})*`)
        })
        lines.push("")
      }

      // Ideas
      if (pc.ideas && pc.ideas.length > 0) {
        lines.push("### Ideas")
        lines.push("")
        pc.ideas.forEach(idea => {
          lines.push(`- ${idea}`)
        })
        lines.push("")
      }

      // Decisions
      if (pc.decisions && pc.decisions.length > 0) {
        lines.push("### Decisions")
        lines.push("")
        pc.decisions.forEach(decision => {
          const checkbox = decision.approved ? "[x]" : "[ ]"
          lines.push(`- ${checkbox} **${decision.description}**`)
          lines.push(`  - Rationale: ${decision.rationale}`)
        })
        lines.push("")
      }

      // Questions
      if (pc.questions && pc.questions.length > 0) {
        lines.push("### Open Questions")
        lines.push("")
        pc.questions.forEach(q => {
          lines.push(`- ${q}`)
        })
        lines.push("")
      }

      // Raw insights
      if (pc.rawInsights && pc.rawInsights.length > 0) {
        lines.push("### Raw Insights")
        lines.push("")
        pc.rawInsights.forEach(insight => {
          lines.push(`- ${insight}`)
        })
        lines.push("")
      }
    }

    // Review notes
    if (dump.reviewNotes) {
      lines.push("### Review Notes")
      lines.push("")
      lines.push(dump.reviewNotes)
      lines.push("")
    }

    lines.push("---")
    lines.push("")
  })

  // Footer
  lines.push(`*Generated by Claudia Coder on ${formatDate()}*`)

  return lines.join("\n")
}

// ============ Interviews Generator ============

/**
 * Interview session data structure for generation
 * Matches the InterviewSession type from types.ts
 */
interface InterviewForGeneration {
  id: string
  type: string
  status: string
  targetType?: string
  targetId?: string
  targetTitle?: string
  targetContext?: Record<string, unknown>
  messages: Array<{
    id: string
    role: "assistant" | "user"
    content: string
    timestamp: string
    transcribedFrom?: string
    skipped?: boolean
    followUpRequested?: boolean
  }>
  summary?: string
  keyPoints?: string[]
  suggestedActions?: string[]
  extractedData?: Record<string, unknown>
  createdAt: string
  completedAt?: string
}

/**
 * Generate INTERVIEWS.md content from interview data
 *
 * Contains all interview sessions (creation interview and contextual interviews)
 * for Claude Code to reference during development.
 */
export function generateInterviewsMarkdown(
  creationInterview: InterviewForGeneration | undefined,
  contextualInterviews: InterviewForGeneration[],
  project: Project
): string {
  const lines: string[] = []

  // Frontmatter
  lines.push("---")
  lines.push(`title: "Interviews: ${project.name}"`)
  lines.push(`project_id: "${project.id}"`)
  lines.push(`has_creation_interview: ${!!creationInterview}`)
  lines.push(`contextual_interviews: ${contextualInterviews.length}`)
  lines.push(`generated: "${new Date().toISOString()}"`)
  lines.push("---")
  lines.push("")

  // Title
  lines.push("# Project Interviews")
  lines.push("")
  lines.push(`This document contains interview sessions for **${project.name}**. These capture the user's vision, requirements, and contextual feedback.`)
  lines.push("")

  // Creation Interview
  lines.push("## Creation Interview")
  lines.push("")

  if (creationInterview) {
    lines.push("The creation interview captures the initial vision and requirements for this project.")
    lines.push("")
    lines.push(`**Status:** ${creationInterview.status}`)
    lines.push(`**Created:** ${formatDate(creationInterview.createdAt)}`)
    if (creationInterview.completedAt) {
      lines.push(`**Completed:** ${formatDate(creationInterview.completedAt)}`)
    }
    lines.push("")

    // Summary
    if (creationInterview.summary) {
      lines.push("### Summary")
      lines.push("")
      lines.push(creationInterview.summary)
      lines.push("")
    }

    // Key Points
    if (creationInterview.keyPoints && creationInterview.keyPoints.length > 0) {
      lines.push("### Key Points")
      lines.push("")
      creationInterview.keyPoints.forEach(point => {
        lines.push(`- ${point}`)
      })
      lines.push("")
    }

    // Suggested Actions
    if (creationInterview.suggestedActions && creationInterview.suggestedActions.length > 0) {
      lines.push("### Suggested Actions")
      lines.push("")
      creationInterview.suggestedActions.forEach(action => {
        lines.push(`- ${action}`)
      })
      lines.push("")
    }

    // Full Conversation
    lines.push("### Full Conversation")
    lines.push("")
    creationInterview.messages.forEach(msg => {
      const role = msg.role === "assistant" ? "**Claudia:**" : "**User:**"
      const source = msg.transcribedFrom === "voice" ? " *(voice)*" : ""
      lines.push(`${role}${source}`)
      lines.push("")
      lines.push(msg.content)
      lines.push("")
    })
  } else {
    lines.push("*No creation interview recorded.*")
    lines.push("")
  }

  // Contextual Interviews
  lines.push("## Contextual Interviews")
  lines.push("")

  if (contextualInterviews.length === 0) {
    lines.push("*No contextual interviews recorded yet.*")
    lines.push("")
  } else {
    lines.push(`There are ${contextualInterviews.length} contextual interview(s) providing additional context.`)
    lines.push("")

    contextualInterviews.forEach((interview, index) => {
      lines.push(`### Interview ${index + 1}: ${interview.targetTitle || interview.targetType || "General"}`)
      lines.push("")
      lines.push(`**Type:** ${interview.targetType || "N/A"}`)
      lines.push(`**Status:** ${interview.status}`)
      lines.push(`**Created:** ${formatDate(interview.createdAt)}`)
      lines.push("")

      // Summary
      if (interview.summary) {
        lines.push("#### Summary")
        lines.push("")
        lines.push(interview.summary)
        lines.push("")
      }

      // Key Points
      if (interview.keyPoints && interview.keyPoints.length > 0) {
        lines.push("#### Key Points")
        lines.push("")
        interview.keyPoints.forEach(point => {
          lines.push(`- ${point}`)
        })
        lines.push("")
      }

      // Conversation
      lines.push("#### Conversation")
      lines.push("")
      interview.messages.forEach(msg => {
        const role = msg.role === "assistant" ? "**Claudia:**" : "**User:**"
        lines.push(`${role}`)
        lines.push("")
        lines.push(msg.content)
        lines.push("")
      })

      lines.push("---")
      lines.push("")
    })
  }

  // Footer
  lines.push(`*Generated by Claudia Coder on ${formatDate()}*`)

  return lines.join("\n")
}

// ============ Resources Generator ============

/**
 * Resource data structure for generation
 * Matches the ProjectResource type from types.ts
 */
interface ResourceForGeneration {
  id: string
  projectId: string
  name: string
  type: string
  mimeType: string
  size: number
  createdAt: string
  updatedAt: string
  storage: string
  filePath?: string
  indexedDbKey?: string
  description?: string
  tags: string[]
  transcription?: {
    text: string
    method: string
    duration: number
    wordCount: number
  }
}

/**
 * Generate RESOURCES.md content from resource data
 *
 * An index of all user-uploaded resources with descriptions
 * for Claude Code to reference during development.
 */
export function generateResourcesMarkdown(
  resources: ResourceForGeneration[],
  project: Project
): string {
  const lines: string[] = []

  // Frontmatter
  lines.push("---")
  lines.push(`title: "Resources: ${project.name}"`)
  lines.push(`project_id: "${project.id}"`)
  lines.push(`total_resources: ${resources.length}`)
  lines.push(`generated: "${new Date().toISOString()}"`)
  lines.push("---")
  lines.push("")

  // Title
  lines.push("# Project Resources")
  lines.push("")
  lines.push(`This document indexes all resources uploaded for **${project.name}**. Resources include documents, images, audio files, and other reference materials.`)
  lines.push("")

  if (resources.length === 0) {
    lines.push("*No resources uploaded yet.*")
    lines.push("")
    return lines.join("\n")
  }

  // Summary by type
  lines.push("## Summary")
  lines.push("")
  const byType: Record<string, number> = {}
  let totalSize = 0
  resources.forEach(r => {
    byType[r.type] = (byType[r.type] || 0) + 1
    totalSize += r.size
  })

  lines.push("| Type | Count |")
  lines.push("|------|-------|")
  Object.entries(byType).forEach(([type, count]) => {
    lines.push(`| ${type} | ${count} |`)
  })
  lines.push(`| **Total** | **${resources.length}** |`)
  lines.push("")
  lines.push(`**Total Size:** ${formatFileSize(totalSize)}`)
  lines.push("")

  // Group resources by type
  const grouped: Record<string, ResourceForGeneration[]> = {}
  resources.forEach(r => {
    if (!grouped[r.type]) grouped[r.type] = []
    grouped[r.type].push(r)
  })

  // Resources by type
  Object.entries(grouped).forEach(([type, typeResources]) => {
    lines.push(`## ${type.charAt(0).toUpperCase() + type.slice(1)} Resources`)
    lines.push("")

    typeResources.forEach(resource => {
      lines.push(`### ${resource.name}`)
      lines.push("")
      lines.push(`- **ID:** ${resource.id}`)
      lines.push(`- **Type:** ${resource.mimeType}`)
      lines.push(`- **Size:** ${formatFileSize(resource.size)}`)
      lines.push(`- **Added:** ${formatDate(resource.createdAt)}`)

      if (resource.filePath) {
        lines.push(`- **Location:** \`resources/${resource.name}\``)
      }

      if (resource.tags && resource.tags.length > 0) {
        lines.push(`- **Tags:** ${resource.tags.map(t => `\`${t}\``).join(", ")}`)
      }

      if (resource.description) {
        lines.push("")
        lines.push(`> ${resource.description}`)
      }

      // For audio with transcription
      if (resource.transcription) {
        lines.push("")
        lines.push("**Transcription:**")
        lines.push("")
        lines.push("```")
        lines.push(resource.transcription.text)
        lines.push("```")
      }

      lines.push("")
    })
  })

  // Footer
  lines.push("---")
  lines.push("")
  lines.push("**Note:** Actual resource files are stored in the `resources/` directory.")
  lines.push("")
  lines.push(`*Generated by Claudia Coder on ${formatDate()}*`)

  return lines.join("\n")
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
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

// ============ Touchdown Document ============

export interface TouchdownContext {
  // Only the minimal project info needed for touchdown (avoids needing full Project type from localStorage)
  project: {
    id: string
    name: string
    description?: string
  }
  buildPlan?: BuildPlan
  packets: WorkPacket[]
  runHistory?: {
    totalRuns: number
    successfulRuns: number
    failedRuns: number
    lastRunAt?: string
  }
  qualityGates?: {
    tests: { passed: boolean; output?: string }
    typeCheck: { passed: boolean; output?: string }
    build: { passed: boolean; output?: string }
  }
  codebaseAnalysis?: {
    filesCreated: number
    filesModified: number
    linesOfCode: number
    testCoverage?: number
    errors?: string[]
    warnings?: string[]
  }
}

/**
 * Generate TOUCHDOWN.md - The completion/refinement document
 *
 * Touchdown is the counterpart to Kickoff:
 * - Kickoff plans the work
 * - Touchdown reviews, refines, and completes the work
 *
 * This document guides the AI through:
 * 1. Reviewing completed work packets
 * 2. Analyzing the codebase for issues
 * 3. Fixing any errors found
 * 4. Refining code with obvious additions
 * 5. Final quality checks
 */
export function generateTouchdownMarkdown(context: TouchdownContext): string {
  const { project, buildPlan, packets, runHistory, qualityGates, codebaseAnalysis } = context
  const completedPackets = packets.filter(p => p.status === "completed")
  const incompletePackets = packets.filter(p => p.status !== "completed")
  const now = new Date().toISOString()

  const lines: string[] = [
    `# TOUCHDOWN: ${project.name}`,
    "",
    `> Project completion and refinement document`,
    `> Generated: ${formatDate(now)}`,
    "",
    "---",
    "",
    "## Overview",
    "",
    "This document guides the final review and refinement phase. The primary work packets",
    "have been executed. Now it's time to:",
    "",
    "1. **Review** - Verify all acceptance criteria are met",
    "2. **Analyze** - Check the codebase for issues and gaps",
    "3. **Fix** - Address any errors or failing tests",
    "4. **Refine** - Add obvious improvements and polish",
    "5. **Verify** - Run final quality gates",
    "",
    "---",
    "",
    "## Work Summary",
    "",
    `- **Total Packets:** ${packets.length}`,
    `- **Completed:** ${completedPackets.length}`,
    `- **Failed/Incomplete:** ${incompletePackets.length}`,
  ]

  if (runHistory) {
    lines.push(
      `- **Total Runs:** ${runHistory.totalRuns}`,
      `- **Successful Runs:** ${runHistory.successfulRuns}`,
      `- **Failed Runs:** ${runHistory.failedRuns}`,
    )
    if (runHistory.lastRunAt) {
      lines.push(`- **Last Run:** ${formatDate(runHistory.lastRunAt)}`)
    }
  }

  lines.push("")

  // Completed packets summary
  if (completedPackets.length > 0) {
    lines.push(
      "### Completed Work",
      "",
      "| Packet | Type | Priority | Tasks |",
      "|--------|------|----------|-------|",
    )
    for (const packet of completedPackets) {
      const tasksCompleted = packet.tasks.filter(t => t.completed).length
      lines.push(
        `| ${packet.title} | ${packet.type} | ${packet.priority} | ${tasksCompleted}/${packet.tasks.length} |`
      )
    }
    lines.push("")
  }

  // Failed/incomplete packets
  if (incompletePackets.length > 0) {
    lines.push(
      "### ⚠️ Incomplete Work (Needs Attention)",
      "",
    )
    for (const packet of incompletePackets) {
      const incompleteTasks = packet.tasks.filter(t => !t.completed)
      lines.push(
        `#### ${packet.title}`,
        "",
        "**Incomplete Tasks:**",
        ...incompleteTasks.map(t => `- [ ] ${t.description}`),
        "",
        "**Acceptance Criteria Still Needed:**",
        ...packet.acceptanceCriteria.map(c => `- ${c}`),
        "",
      )
    }
  }

  // Quality Gates Status
  lines.push(
    "---",
    "",
    "## Quality Gates Status",
    "",
  )

  if (qualityGates) {
    lines.push(
      `- **Tests:** ${qualityGates.tests.passed ? "✅ Passing" : "❌ Failing"}`,
      `- **TypeScript:** ${qualityGates.typeCheck.passed ? "✅ Passing" : "❌ Failing"}`,
      `- **Build:** ${qualityGates.build.passed ? "✅ Passing" : "❌ Failing"}`,
      "",
    )

    // Show any errors
    if (!qualityGates.tests.passed && qualityGates.tests.output) {
      lines.push(
        "### Test Failures",
        "```",
        qualityGates.tests.output.slice(0, 2000),
        "```",
        "",
      )
    }
    if (!qualityGates.typeCheck.passed && qualityGates.typeCheck.output) {
      lines.push(
        "### TypeScript Errors",
        "```",
        qualityGates.typeCheck.output.slice(0, 2000),
        "```",
        "",
      )
    }
    if (!qualityGates.build.passed && qualityGates.build.output) {
      lines.push(
        "### Build Errors",
        "```",
        qualityGates.build.output.slice(0, 2000),
        "```",
        "",
      )
    }
  } else {
    lines.push(
      "Quality gates have not been run yet. Please verify:",
      "",
      "```bash",
      "# Run tests",
      "npm test",
      "",
      "# Check TypeScript",
      "npx tsc --noEmit",
      "",
      "# Build project",
      "npm run build",
      "```",
      "",
    )
  }

  // Codebase Analysis
  if (codebaseAnalysis) {
    lines.push(
      "---",
      "",
      "## Codebase Analysis",
      "",
      `- **Files Created:** ${codebaseAnalysis.filesCreated}`,
      `- **Files Modified:** ${codebaseAnalysis.filesModified}`,
      `- **Lines of Code:** ${codebaseAnalysis.linesOfCode}`,
    )
    if (codebaseAnalysis.testCoverage !== undefined) {
      lines.push(`- **Test Coverage:** ${codebaseAnalysis.testCoverage}%`)
    }
    lines.push("")

    if (codebaseAnalysis.errors && codebaseAnalysis.errors.length > 0) {
      lines.push(
        "### ❌ Errors Found",
        "",
        ...codebaseAnalysis.errors.map(e => `- ${e}`),
        "",
      )
    }

    if (codebaseAnalysis.warnings && codebaseAnalysis.warnings.length > 0) {
      lines.push(
        "### ⚠️ Warnings",
        "",
        ...codebaseAnalysis.warnings.map(w => `- ${w}`),
        "",
      )
    }
  }

  // Touchdown Tasks
  lines.push(
    "---",
    "",
    "## Touchdown Tasks",
    "",
    "Complete the following tasks to finish this project:",
    "",
    "### 1. Fix All Errors",
    "",
    "- [ ] Resolve all TypeScript errors",
    "- [ ] Fix all failing tests",
    "- [ ] Ensure build completes successfully",
    "",
    "### 2. Code Review & Refinement",
    "",
    "- [ ] Review all new code for obvious improvements",
    "- [ ] Add missing error handling",
    "- [ ] Improve code documentation where unclear",
    "- [ ] Optimize any obviously inefficient code",
    "",
    "### 3. Missing Features Check",
    "",
    "Review the original objectives and ensure nothing is missing:",
    "",
  )

  if (buildPlan?.spec?.objectives) {
    for (const obj of buildPlan.spec.objectives) {
      lines.push(`- [ ] ${obj}`)
    }
  } else {
    lines.push("- [ ] Verify all planned features are implemented")
  }

  lines.push(
    "",
    "### 4. Final Quality Verification",
    "",
    "- [ ] All tests passing",
    "- [ ] No TypeScript errors",
    "- [ ] Build succeeds",
    "- [ ] Manual testing completed",
    "- [ ] Code is production-ready",
    "",
    "---",
    "",
    "## AI Instructions",
    "",
    "When executing the touchdown phase:",
    "",
    "1. **Start by running quality gates** to understand current state",
    "2. **Fix issues in order:** errors → warnings → improvements",
    "3. **Test after each fix** to ensure no regressions",
    "4. **Document any significant changes** made",
    "5. **Run final verification** before marking complete",
    "",
    "The goal is to leave the codebase in a polished, production-ready state.",
    "",
    "---",
    "",
    `*Generated by Claudia Coder - ${formatDate(now)}*`,
  )

  return lines.join("\n")
}

/**
 * Generate a prompt for AI-powered touchdown analysis
 *
 * This prompt asks the AI to analyze the codebase and suggest improvements
 */
export function generateTouchdownAnalysisPrompt(context: TouchdownContext): string {
  const { project, buildPlan, packets } = context
  const completedPackets = packets.filter(p => p.status === "completed")

  return `You are reviewing a codebase after the initial development phase is complete.

PROJECT: ${project.name}
DESCRIPTION: ${project.description}

COMPLETED WORK:
${completedPackets.map(p => `- ${p.title}: ${p.description}`).join("\n")}

ORIGINAL OBJECTIVES:
${buildPlan?.spec?.objectives?.map(o => `- ${o}`).join("\n") || "Not specified"}

Your task is to:

1. **Analyze the codebase** for:
   - Code quality issues
   - Missing error handling
   - Performance concerns
   - Security vulnerabilities
   - Missing features based on objectives

2. **Identify improvements** that are:
   - Obvious additions that were missed
   - Code that needs refactoring
   - Documentation that should be added
   - Tests that should be written

3. **Create an action plan** to:
   - Fix any issues found
   - Implement missing features
   - Polish the codebase

Be specific and actionable. Focus on high-impact improvements.
Format your response as a structured analysis with clear sections.`
}
