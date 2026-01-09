# Claudia Coder Project Structure Specification

> Version: 1.0.0
> Last Updated: 2026-01-09
> Status: Draft

## Overview

This document defines the complete folder structure and file format specification for Claudia Coder-managed projects. Claudia Coder is a project orchestration system that manages AI-assisted software development through structured work packets, status tracking, and bidirectional communication with Claude Code agents.

---

## Table of Contents

1. [Directory Structure](#directory-structure)
2. [File Format Specifications](#file-format-specifications)
   - [config.json](#configjson)
   - [PRD.md](#prdmd)
   - [BUILD_PLAN.md](#build_planmd)
   - [Packet Files](#packet-files-pkt-xxx-slugmd)
   - [KICKOFF.md](#kickoffmd)
   - [Status Update Files](#status-update-files)
   - [Request Files](#request-files)
   - [CLAUDE.md](#claudemd)
3. [Naming Conventions](#naming-conventions)
4. [Workflow States](#workflow-states)
5. [Implementation Notes](#implementation-notes)

---

## Directory Structure

```
/projects/{project-slug}/
├── .claudia/                    # Claudia Coder metadata (scanned for updates)
│   ├── config.json              # Project configuration and packet index
│   ├── status/                  # Status updates FROM Claude Code TO Claudia Coder
│   │   └── {timestamp}-{packet-id}.md
│   └── requests/                # Requests FROM Claude Code TO Claudia Coder
│       └── {timestamp}-{type}.md
├── docs/
│   ├── PRD.md                   # Product Requirements Document
│   ├── BUILD_PLAN.md            # Approved build plan with all details
│   └── packets/                 # Individual packet files
│       ├── PKT-001-{slug}.md
│       ├── PKT-002-{slug}.md
│       └── ...
├── KICKOFF.md                   # Instructions for Claude Code agents
├── CLAUDE.md                    # Claude Code memory file (native mode)
└── repo/                        # Git repository (cloned or initialized)
    └── ...
```

### Directory Descriptions

| Directory | Purpose | Scanned By |
|-----------|---------|------------|
| `.claudia/` | Claudia Coder system metadata and communication | Claudia Coder (polling) |
| `.claudia/status/` | Agent progress reports | Claudia Coder |
| `.claudia/requests/` | Agent requests for human/system action | Claudia Coder |
| `docs/` | Project documentation | Human, Claude Code |
| `docs/packets/` | Work packet definitions | Claude Code |
| `repo/` | Actual source code repository | Claude Code, Git |

---

## File Format Specifications

### config.json

Location: `.claudia/config.json`

The central configuration file for project metadata and packet tracking.

```json
{
  "version": "1.0",
  "project": {
    "id": "uuid-v4",
    "slug": "project-slug",
    "name": "Project Display Name",
    "description": "Brief project description",
    "created_at": "2026-01-09T12:00:00Z",
    "updated_at": "2026-01-09T12:00:00Z"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/org/repo.git",
    "branch": "main",
    "initialized": true
  },
  "packets": {
    "PKT-001": {
      "slug": "initial-setup",
      "status": "completed",
      "phase": 1,
      "assigned_at": "2026-01-09T12:00:00Z",
      "completed_at": "2026-01-09T14:00:00Z"
    },
    "PKT-002": {
      "slug": "core-api",
      "status": "in_progress",
      "phase": 1,
      "assigned_at": "2026-01-09T14:00:00Z",
      "completed_at": null
    }
  },
  "current_packet": "PKT-002",
  "current_phase": 1,
  "settings": {
    "auto_approve_minor": false,
    "require_tests": true,
    "status_poll_interval_ms": 5000
  }
}
```

#### Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | Yes | Config schema version |
| `project.id` | string (UUID) | Yes | Unique project identifier |
| `project.slug` | string | Yes | URL-safe project identifier |
| `project.name` | string | Yes | Human-readable name |
| `project.description` | string | No | Brief description |
| `repository.type` | string | Yes | Version control type (currently only "git") |
| `repository.url` | string | No | Remote repository URL |
| `repository.branch` | string | Yes | Primary working branch |
| `repository.initialized` | boolean | Yes | Whether repo has been initialized |
| `packets` | object | Yes | Map of packet IDs to metadata |
| `current_packet` | string | No | Currently active packet ID |
| `current_phase` | number | Yes | Current development phase |
| `settings` | object | Yes | Project-specific settings |

---

### PRD.md

Location: `docs/PRD.md`

The Product Requirements Document defines WHAT needs to be built.

```markdown
---
title: "Project Name"
version: "1.0"
status: "approved"  # draft | review | approved | archived
created: "2026-01-09"
updated: "2026-01-09"
authors:
  - "Author Name"
stakeholders:
  - "Stakeholder Name"
---

# Product Requirements Document: {Project Name}

## Executive Summary

A 2-3 paragraph overview of the product, its purpose, and key value proposition.

## Problem Statement

### Current State
Description of the existing situation or pain points.

### Desired State
Description of the ideal outcome after the product is built.

## Goals and Objectives

### Primary Goals
1. Goal 1 with measurable success criteria
2. Goal 2 with measurable success criteria

### Secondary Goals
1. Nice-to-have goal 1
2. Nice-to-have goal 2

### Non-Goals
- Explicit list of what this project will NOT address

## User Personas

### Persona 1: {Name}
- **Role**: Description
- **Goals**: What they want to achieve
- **Pain Points**: Current frustrations
- **Technical Level**: Novice / Intermediate / Expert

### Persona 2: {Name}
...

## Functional Requirements

### FR-001: {Requirement Title}
- **Priority**: P0 (Critical) | P1 (High) | P2 (Medium) | P3 (Low)
- **Description**: Detailed description
- **User Story**: As a [persona], I want [feature] so that [benefit]
- **Acceptance Criteria**:
  - [ ] Criterion 1
  - [ ] Criterion 2

### FR-002: {Requirement Title}
...

## Non-Functional Requirements

### Performance
- Response time expectations
- Throughput requirements
- Scalability needs

### Security
- Authentication requirements
- Authorization model
- Data protection needs

### Reliability
- Uptime requirements
- Disaster recovery needs
- Backup requirements

### Compatibility
- Browser support
- Device support
- Integration requirements

## Technical Constraints

- Technology stack requirements or restrictions
- Infrastructure constraints
- Third-party service dependencies

## Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Metric 1 | Target value | How it will be measured |
| Metric 2 | Target value | How it will be measured |

## Timeline

| Milestone | Target Date | Description |
|-----------|-------------|-------------|
| Milestone 1 | YYYY-MM-DD | Description |
| Milestone 2 | YYYY-MM-DD | Description |

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Risk 1 | High/Med/Low | High/Med/Low | Mitigation strategy |

## Appendix

### Glossary
- **Term**: Definition

### References
- [Reference 1](url)
```

---

### BUILD_PLAN.md

Location: `docs/BUILD_PLAN.md`

The Build Plan defines HOW the project will be built, organized into phases and packets.

```markdown
---
title: "Build Plan: {Project Name}"
version: "1.0"
status: "approved"  # draft | review | approved | in_progress | completed
prd_version: "1.0"
created: "2026-01-09"
updated: "2026-01-09"
total_phases: 3
total_packets: 12
estimated_hours: 40
---

# Build Plan: {Project Name}

## Overview

Brief description of the implementation approach and key architectural decisions.

## Technology Stack

| Component | Technology | Version | Rationale |
|-----------|------------|---------|-----------|
| Frontend | React | 18.x | Component-based, team familiarity |
| Backend | Node.js | 20.x | JavaScript ecosystem consistency |
| Database | PostgreSQL | 15.x | ACID compliance, JSON support |

## Architecture Overview

High-level description of the system architecture. Include a diagram reference if available.

```
[Component Diagram or ASCII representation]
```

## Development Phases

### Phase 1: Foundation
**Objective**: Establish core infrastructure and project scaffolding
**Estimated Duration**: X hours
**Dependencies**: None

| Packet | Title | Est. Hours | Priority |
|--------|-------|------------|----------|
| PKT-001 | Project Setup & Configuration | 2 | P0 |
| PKT-002 | Database Schema Design | 3 | P0 |
| PKT-003 | Core API Structure | 4 | P0 |

**Phase 1 Exit Criteria**:
- [ ] Development environment fully configured
- [ ] Database migrations runnable
- [ ] API skeleton responding to health checks

---

### Phase 2: Core Features
**Objective**: Implement primary functionality
**Estimated Duration**: X hours
**Dependencies**: Phase 1 complete

| Packet | Title | Est. Hours | Priority |
|--------|-------|------------|----------|
| PKT-004 | User Authentication | 4 | P0 |
| PKT-005 | Core Data Models | 3 | P0 |
| PKT-006 | Primary API Endpoints | 5 | P1 |

**Phase 2 Exit Criteria**:
- [ ] Users can authenticate
- [ ] Core CRUD operations functional
- [ ] API documentation generated

---

### Phase 3: Polish & Deployment
**Objective**: Finalize features, testing, and deployment
**Estimated Duration**: X hours
**Dependencies**: Phase 2 complete

| Packet | Title | Est. Hours | Priority |
|--------|-------|------------|----------|
| PKT-007 | UI Refinements | 3 | P1 |
| PKT-008 | Testing Suite | 4 | P0 |
| PKT-009 | Deployment Configuration | 3 | P0 |

**Phase 3 Exit Criteria**:
- [ ] All P0/P1 features complete
- [ ] Test coverage > 80%
- [ ] Deployment pipeline functional

---

## Packet Summary

| ID | Title | Phase | Status | Hours |
|----|-------|-------|--------|-------|
| PKT-001 | Project Setup & Configuration | 1 | completed | 2 |
| PKT-002 | Database Schema Design | 1 | in_progress | 3 |
| PKT-003 | Core API Structure | 1 | pending | 4 |
| ... | ... | ... | ... | ... |

## Dependencies Graph

```
PKT-001 ─┬─> PKT-002 ─┬─> PKT-004
         │            │
         └─> PKT-003 ─┴─> PKT-005 ─> PKT-006
                                        │
                              PKT-007 <─┴─> PKT-008 ─> PKT-009
```

## Risk Register

| Risk | Packet(s) | Mitigation |
|------|-----------|------------|
| API integration complexity | PKT-006 | Allocate buffer time, create mocks early |

## Notes

Additional implementation notes, decisions, or context for developers.
```

---

### Packet Files (PKT-XXX-{slug}.md)

Location: `docs/packets/PKT-XXX-{slug}.md`

Individual work packets define specific, atomic units of work.

```markdown
---
id: "PKT-001"
title: "Project Setup & Configuration"
slug: "project-setup"
phase: 1
status: "pending"  # pending | assigned | in_progress | review | completed | blocked
priority: "P0"     # P0 | P1 | P2 | P3
estimated_hours: 2
actual_hours: null
assigned_to: null
created: "2026-01-09"
updated: "2026-01-09"
started: null
completed: null
dependencies: []
blocks: ["PKT-002", "PKT-003"]
tags: ["setup", "infrastructure"]
---

# PKT-001: Project Setup & Configuration

## Objective

Clear, concise statement of what this packet accomplishes. One to two sentences.

## Context

Background information needed to understand this work. Reference relevant PRD sections or prior packets.

## Scope

### In Scope
- Specific deliverable 1
- Specific deliverable 2
- Specific deliverable 3

### Out of Scope
- Explicitly excluded item 1
- Explicitly excluded item 2

## Tasks

### Required Tasks
- [ ] Task 1: Description of specific work
- [ ] Task 2: Description of specific work
- [ ] Task 3: Description of specific work

### Optional Tasks (If Time Permits)
- [ ] Optional task 1
- [ ] Optional task 2

## Technical Specifications

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `src/config/index.ts` | Create | Configuration management |
| `package.json` | Modify | Add dependencies |

### Dependencies to Add
```json
{
  "dependencies": {
    "package-name": "^1.0.0"
  }
}
```

### Environment Variables
| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgres://...` |

## Acceptance Criteria

All criteria must pass for packet completion:

- [ ] **AC-1**: Criterion description with specific, testable outcome
- [ ] **AC-2**: Criterion description with specific, testable outcome
- [ ] **AC-3**: Criterion description with specific, testable outcome

## Testing Requirements

- [ ] Unit tests for new functions
- [ ] Integration test for configuration loading
- [ ] Manual verification: Application starts without errors

## References

- PRD Section: [FR-001](#fr-001-requirement-title)
- Related Packets: PKT-002, PKT-003
- External Docs: [Link to relevant documentation]

---

## Work Log

### Session 1 - 2026-01-09
**Agent**: Claude Code
**Duration**: 1.5 hours
**Status**: In Progress

**Completed**:
- Task 1 completed
- Task 2 completed

**Blockers**:
- None

**Notes**:
- Discovered additional configuration needed for X

### Session 2 - 2026-01-09
**Agent**: Claude Code
**Duration**: 0.5 hours
**Status**: Completed

**Completed**:
- Task 3 completed
- All acceptance criteria verified

**Files Changed**:
- `src/config/index.ts` (created)
- `package.json` (modified)
- `src/config/index.test.ts` (created)

---

## Review Notes

**Reviewer**: [Name]
**Date**: 2026-01-09
**Decision**: Approved / Changes Requested

**Comments**:
- Review comments here

**Required Changes**:
- None / List of required changes
```

---

### KICKOFF.md

Location: `KICKOFF.md` (project root)

Instructions provided to Claude Code agents when starting work.

```markdown
---
project: "project-slug"
packet: "PKT-002"
generated: "2026-01-09T12:00:00Z"
expires: "2026-01-10T12:00:00Z"
---

# KICKOFF: {Project Name}

## Current Assignment

**Packet**: PKT-002 - Core API Structure
**Phase**: 1 of 3
**Priority**: P0 (Critical)
**Estimated Time**: 4 hours

## Objectives

Complete the following deliverables for this packet:

1. Primary objective 1
2. Primary objective 2
3. Primary objective 3

## Context

Brief context about where this fits in the overall project. What was completed before, what comes next.

### Completed Work (Prior Packets)
- PKT-001: Project Setup - Initial scaffolding complete
- Database connected and migrations ready

### Upcoming Work (Future Packets)
- PKT-003: User Authentication - Depends on this packet
- PKT-004: Core Data Models - Can start in parallel

## Working Directory

```
repo/                    # Your working directory
├── src/
│   ├── api/            # API route handlers (your focus)
│   ├── config/         # Configuration (from PKT-001)
│   └── models/         # Data models (future packet)
└── tests/
```

## Key Files

| File | Purpose | Action |
|------|---------|--------|
| `docs/packets/PKT-002-core-api.md` | Full packet details | Read first |
| `docs/PRD.md` | Requirements reference | Consult as needed |
| `repo/src/api/` | API implementation | Create/modify |

## Reporting Requirements

### Status Updates

Report progress by creating files in `.claudia/status/`:

**Filename**: `{timestamp}-PKT-002.md`
**Frequency**: After completing each major task or every 30 minutes

### Requesting Help

If you need assistance, create a request in `.claudia/requests/`:

**Filename**: `{timestamp}-{request-type}.md`
**Types**: `approval_needed`, `quality_review`, `blocked`, `new_packet`

## Constraints

- Do NOT modify files outside `repo/` without approval
- Do NOT commit directly to `main` branch
- Do NOT skip writing tests for new functionality
- Do NOT exceed the estimated hours without reporting

## Success Criteria

This assignment is complete when:

- [ ] All tasks in PKT-002 are checked off
- [ ] All acceptance criteria pass
- [ ] Tests are written and passing
- [ ] Final status update submitted
- [ ] No blocking issues remain

## Getting Started

1. Read the full packet: `docs/packets/PKT-002-core-api.md`
2. Review any referenced PRD sections
3. Submit initial status update confirming assignment received
4. Begin work on first task
5. Report progress regularly

---

*This kickoff file is auto-generated by Claudia Coder. Do not edit manually.*
```

---

### Status Update Files

Location: `.claudia/status/{timestamp}-{packet-id}.md`

**Filename Format**: `YYYYMMDD-HHMMSS-PKT-XXX.md`
**Example**: `20260109-143022-PKT-002.md`

```markdown
---
type: "status_update"
packet: "PKT-002"
timestamp: "2026-01-09T14:30:22Z"
session_id: "uuid-v4"
agent: "claude-code"
---

# Status Update: PKT-002

## Progress Summary

**Overall Status**: in_progress
**Completion**: 60%
**Time Spent This Session**: 45 minutes
**Total Time Spent**: 1.5 hours

## Tasks Completed This Session

- [x] Set up Express router structure
- [x] Created base API response helpers
- [x] Implemented health check endpoint

## Tasks In Progress

- [ ] RESTful endpoint structure (70% complete)
  - Routes defined
  - Controllers scaffolded
  - Middleware pending

## Tasks Remaining

- [ ] Error handling middleware
- [ ] Request validation
- [ ] API documentation setup

## Files Changed

| File | Status | Lines | Description |
|------|--------|-------|-------------|
| `src/api/router.ts` | Created | +85 | Main API router |
| `src/api/health.ts` | Created | +23 | Health check endpoint |
| `src/api/helpers.ts` | Created | +45 | Response helpers |
| `src/middleware/error.ts` | Modified | +12, -3 | Error handling |

## Blockers

None currently.

<!-- If blockers exist:
### Blocker 1: Description
- **Type**: technical | external | clarification_needed
- **Impact**: Cannot proceed with [specific task]
- **Proposed Resolution**: [If known]
-->

## Notes

- Discovered that the existing error handling needed refactoring
- Considered using express-validator for request validation
- API structure follows REST best practices from PRD

## Next Steps

1. Complete error handling middleware
2. Add request validation to endpoints
3. Set up Swagger/OpenAPI documentation
4. Run full test suite

## Questions for Review

None at this time.

<!-- If questions exist:
1. Should we use express-validator or joi for validation?
2. What authentication strategy is preferred?
-->
```

---

### Request Files

Location: `.claudia/requests/{timestamp}-{type}.md`

**Filename Format**: `YYYYMMDD-HHMMSS-{type}.md`
**Example**: `20260109-150000-approval_needed.md`

#### Request Types

| Type | Purpose | Urgency |
|------|---------|---------|
| `approval_needed` | Requires human decision | High |
| `quality_review` | Code review requested | Medium |
| `new_packet` | Suggests additional work | Low |
| `blocked` | Cannot proceed without help | High |
| `clarification` | Question about requirements | Medium |
| `activity` | General activity notification | Low |

#### approval_needed

```markdown
---
type: "request"
request_type: "approval_needed"
packet: "PKT-002"
timestamp: "2026-01-09T15:00:00Z"
urgency: "high"
status: "pending"  # pending | approved | rejected | deferred
---

# Approval Request

## Summary

Brief description of what needs approval.

## Context

Why this decision point was reached. What led to this request.

## Options

### Option A: {Description}
- **Pros**: List of advantages
- **Cons**: List of disadvantages
- **Estimated Impact**: Time/effort impact

### Option B: {Description}
- **Pros**: List of advantages
- **Cons**: List of disadvantages
- **Estimated Impact**: Time/effort impact

## Recommendation

Which option is recommended and why.

## Impact of Delay

What happens if this decision is delayed.

## Deadline

When a decision is needed by: `2026-01-09T18:00:00Z`

---

## Response

**Decision**: [To be filled by approver]
**Approved By**: [Name]
**Date**: [Date]
**Notes**: [Additional context]
```

#### quality_review

```markdown
---
type: "request"
request_type: "quality_review"
packet: "PKT-002"
timestamp: "2026-01-09T16:00:00Z"
urgency: "medium"
status: "pending"  # pending | reviewing | approved | changes_requested
---

# Quality Review Request

## Summary

Request for code review of completed work.

## Scope

### Files for Review
| File | Lines Changed | Complexity |
|------|---------------|------------|
| `src/api/router.ts` | +85 | Medium |
| `src/api/users.ts` | +120 | High |

### Focus Areas
- API design consistency
- Error handling approach
- Test coverage adequacy

## Changes Overview

High-level description of what was implemented.

## Testing Done

- [x] Unit tests passing
- [x] Integration tests passing
- [ ] Manual testing (describe what was tested)

## Known Issues

- Issue 1: Description and why it's acceptable
- Issue 2: Description and why it's acceptable

## Self-Review Checklist

- [x] Code follows project style guide
- [x] No console.logs or debug code
- [x] Error handling is comprehensive
- [x] Documentation is updated
- [x] Tests cover happy path and edge cases

---

## Review Response

**Reviewer**: [Name]
**Date**: [Date]
**Decision**: Approved / Changes Requested

### Comments
[Review comments]

### Required Changes
[If any]
```

#### new_packet

```markdown
---
type: "request"
request_type: "new_packet"
packet: "PKT-002"
timestamp: "2026-01-09T15:30:00Z"
urgency: "low"
status: "pending"  # pending | accepted | rejected | deferred
---

# New Packet Suggestion

## Summary

During work on PKT-002, discovered need for additional work packet.

## Proposed Packet

**Suggested ID**: PKT-010
**Suggested Title**: API Rate Limiting
**Suggested Phase**: 2
**Estimated Hours**: 3

## Rationale

Why this work is needed. What prompted the discovery.

## Scope

### Proposed Tasks
- Task 1
- Task 2
- Task 3

### Dependencies
- Depends on: PKT-002, PKT-004
- Blocks: PKT-008

## Priority Assessment

**Suggested Priority**: P1 (High)
**Justification**: Rate limiting is important for API security and should be implemented before public release.

## Alternatives Considered

- Alternative 1: Description
- Alternative 2: Description

---

## Response

**Decision**: Accepted / Rejected / Deferred
**Decided By**: [Name]
**Date**: [Date]
**Assigned ID**: [If accepted]
**Notes**: [Additional context]
```

#### blocked

```markdown
---
type: "request"
request_type: "blocked"
packet: "PKT-002"
timestamp: "2026-01-09T14:45:00Z"
urgency: "high"
status: "pending"  # pending | resolved | workaround_applied
---

# Blocked: {Brief Description}

## Summary

Clear description of what is blocking progress.

## Blocker Details

**Type**: technical | external_dependency | clarification_needed | access_required | other
**Severity**: Cannot proceed | Can proceed partially | Minor inconvenience

## Impact

### Affected Tasks
- Task X: Cannot start until resolved
- Task Y: Can work around but suboptimal

### Timeline Impact
Estimated delay if not resolved: X hours/days

## Investigation Done

Steps already taken to try to resolve:

1. Attempted solution 1 - Result
2. Attempted solution 2 - Result
3. Research done - Findings

## Proposed Resolution

If known, how this could be resolved.

## Help Needed

Specific ask - what action is needed from the team.

---

## Resolution

**Status**: Resolved / Workaround Applied
**Resolved By**: [Name]
**Date**: [Date]
**Solution**: [Description of resolution]
```

#### clarification

```markdown
---
type: "request"
request_type: "clarification"
packet: "PKT-002"
timestamp: "2026-01-09T13:15:00Z"
urgency: "medium"
status: "pending"  # pending | answered
---

# Clarification Request

## Summary

Question about requirements or implementation approach.

## Context

What prompted this question. Reference to specific PRD section or packet task.

## Question(s)

1. Primary question with full context
2. Secondary question (if related)

## Current Understanding

What is currently understood about this topic.

## Options Being Considered

- Option A: Description and implications
- Option B: Description and implications

## Impact on Work

How the answer affects the current work. What will change based on the response.

---

## Response

**Answered By**: [Name]
**Date**: [Date]
**Answer**: [Response to questions]
**Additional Context**: [Any extra information]
```

#### activity

```markdown
---
type: "request"
request_type: "activity"
packet: "PKT-002"
timestamp: "2026-01-09T12:00:00Z"
urgency: "low"
status: "acknowledged"  # pending | acknowledged
---

# Activity: {Brief Description}

## Event Type

session_start | session_end | milestone_reached | commit_made | test_results

## Details

Description of the activity or event.

## Metrics (if applicable)

| Metric | Value |
|--------|-------|
| Tests Run | 45 |
| Tests Passed | 44 |
| Tests Failed | 1 |
| Coverage | 82% |

## Notes

Any additional context or information.
```

---

### CLAUDE.md

Location: `CLAUDE.md` (project root)

Optional memory file for native Claude Code usage. This file is read by Claude Code at the start of each session.

```markdown
# Project: {Project Name}

## Quick Reference

- **Current Phase**: 1
- **Current Packet**: PKT-002
- **Primary Language**: TypeScript
- **Framework**: Next.js

## Project Overview

Brief description of the project purpose and architecture.

## Key Commands

```bash
# Development
npm run dev          # Start development server
npm run test         # Run test suite
npm run lint         # Run linter

# Database
npm run db:migrate   # Run migrations
npm run db:seed      # Seed database
```

## Important Directories

- `repo/src/api/` - API endpoints
- `repo/src/models/` - Data models
- `repo/src/components/` - React components
- `docs/packets/` - Work packet definitions

## Conventions

- Use TypeScript strict mode
- Follow ESLint configuration
- Write tests for all new functions
- Use conventional commit messages

## Current Focus

Working on PKT-002: Core API Structure. Priority tasks:
1. Complete RESTful endpoint structure
2. Add error handling middleware
3. Set up API documentation

## Notes

- Database is PostgreSQL 15
- Using Express for API routes
- Authentication will use JWT (future packet)

## Do Not

- Modify production database directly
- Commit to main branch
- Skip test coverage for new code
- Change project configuration without approval
```

---

## Naming Conventions

### Project Slug
- Lowercase letters, numbers, hyphens only
- 3-50 characters
- Must start with a letter
- Example: `my-awesome-project`

### Packet IDs
- Format: `PKT-XXX` where XXX is zero-padded number
- Sequential within project
- Example: `PKT-001`, `PKT-042`, `PKT-100`

### Packet Slug
- Lowercase letters, numbers, hyphens only
- Descriptive of packet content
- 3-30 characters
- Example: `initial-setup`, `user-auth`, `api-endpoints`

### Timestamps
- ISO 8601 format for frontmatter: `2026-01-09T14:30:22Z`
- Filename format: `YYYYMMDD-HHMMSS`
- Example: `20260109-143022`

### File Naming

| File Type | Pattern | Example |
|-----------|---------|---------|
| Packet | `PKT-{NNN}-{slug}.md` | `PKT-001-initial-setup.md` |
| Status Update | `{timestamp}-{packet-id}.md` | `20260109-143022-PKT-002.md` |
| Request | `{timestamp}-{type}.md` | `20260109-150000-approval_needed.md` |

---

## Workflow States

### Packet Status Flow

```
pending -> assigned -> in_progress -> review -> completed
                           |            |
                           v            v
                       blocked      changes_requested
                           |            |
                           v            v
                      in_progress   in_progress
```

| Status | Description |
|--------|-------------|
| `pending` | Not yet started, may have unmet dependencies |
| `assigned` | Assigned to an agent, not yet started |
| `in_progress` | Active work being done |
| `review` | Work complete, awaiting review |
| `completed` | All acceptance criteria met, approved |
| `blocked` | Cannot proceed due to external factor |
| `changes_requested` | Review completed, changes needed |

### Request Status Flow

```
pending -> processing -> resolved
              |
              v
          deferred
```

| Status | Description |
|--------|-------------|
| `pending` | Awaiting response |
| `processing` | Being actively addressed |
| `resolved` | Request handled |
| `deferred` | Postponed for later |

---

## Implementation Notes

### Polling Strategy

Claudia Coder should poll the following directories for changes:

1. `.claudia/status/` - New status update files
2. `.claudia/requests/` - New request files
3. `docs/packets/` - Packet status changes (via frontmatter)

**Recommended Poll Interval**: 5 seconds (configurable in config.json)

### File Locking

When updating files, use atomic write operations:
1. Write to temporary file
2. Rename to target filename

### Cleanup Policy

- Status files older than 7 days may be archived
- Resolved request files older than 30 days may be archived
- Archive location: `.claudia/archive/`

### Validation

All markdown files with frontmatter should be validated:
- YAML frontmatter must be parseable
- Required fields must be present
- Status values must be from allowed set
- Timestamps must be valid ISO 8601

---

## Changelog

### Version 1.0.0 (2026-01-09)
- Initial specification release
- Defined core directory structure
- Specified all file formats
- Established naming conventions
- Documented workflow states
