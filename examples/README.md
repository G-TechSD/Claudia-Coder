# Claudia Examples

This directory contains sample project files that demonstrate how the Claudia system works. These files serve as both documentation and test fixtures.

## Overview

Claudia is an orchestration system that coordinates work between human project owners and Claude Code (an AI coding assistant). It uses a file-based communication protocol where:

- **Humans** define requirements, plans, and work packets
- **Claude Code** implements the work and communicates via status/request files
- **Claudia** monitors the project, routes information, and manages the workflow

## Sample Project Structure

```
sample-project/
├── .claudia/
│   ├── config.json              # Project configuration
│   ├── status/                  # Status updates from Claude Code
│   │   └── sample-update.md
│   └── requests/                # Requests from Claude Code
│       └── sample-request.md
├── docs/
│   ├── PRD.md                   # Product Requirements Document
│   ├── BUILD_PLAN.md            # Technical implementation plan
│   └── packets/                 # Work packets
│       ├── PKT-001-setup-project.md
│       └── PKT-002-create-api.md
└── KICKOFF.md                   # Project initialization document
```

## File Descriptions

### Configuration Files

#### `.claudia/config.json`
The central configuration file for a Claudia-managed project. Contains:
- Project metadata (name, description, type)
- Directory paths for Claudia components
- Technology preferences
- Claude Code settings
- Integration configurations (GitHub, etc.)

### Planning Documents

#### `docs/PRD.md` (Product Requirements Document)
Defines what the project should accomplish:
- Project goals and objectives
- User stories and use cases
- Technical requirements
- Success metrics
- Timeline and scope

#### `docs/BUILD_PLAN.md`
Technical implementation guide:
- Architecture decisions
- Project structure
- Packet breakdown and sequencing
- Risk mitigation strategies
- Quality gates

#### `KICKOFF.md`
Project initialization document that:
- Summarizes the project for Claude Code
- Links to key documents
- Lists work packets and their status
- Provides instructions and protocols
- Sets quality standards

### Work Packets

#### `docs/packets/PKT-XXX-*.md`
Individual work units with YAML frontmatter:
```yaml
---
packet_id: PKT-001
title: Project Setup
status: completed|in_progress|pending|blocked
priority: critical|high|medium|low
estimated_hours: 3
dependencies: [PKT-000]
tags: [setup, configuration]
---
```

Each packet contains:
- Clear objective
- Acceptance criteria
- Implementation steps
- Notes for Claude Code
- Progress tracking

### Communication Files

#### `.claudia/status/` - Status Updates
Created by Claude Code to report progress:
```yaml
---
type: status_update
packet_id: PKT-002
timestamp: 2024-01-16T14:30:00Z
status: in_progress
progress_percent: 65
author: claude-code
---
```

Status updates include:
- Completed tasks
- Work in progress
- Remaining tasks
- Blockers
- Technical notes
- Time tracking

#### `.claudia/requests/` - Requests
Created by Claude Code when human input is needed:
```yaml
---
type: request
request_id: REQ-001
packet_id: PKT-002
priority: medium
status: pending
requires_response: true
---
```

Requests include:
- Context and background
- Options with pros/cons
- Recommendations
- Specific questions
- Response section for humans

## How the System Works

### 1. Project Setup
Human creates:
- `PRD.md` with requirements
- `BUILD_PLAN.md` with technical approach
- Work packets in `docs/packets/`
- `KICKOFF.md` to initialize Claude Code
- `.claudia/config.json` for configuration

### 2. Work Assignment
Claudia:
- Monitors packet status
- Assigns packets to Claude Code
- Provides context from project documents

### 3. Implementation
Claude Code:
- Reads packet requirements
- Implements the specified work
- Creates status updates on milestones
- Creates requests when clarification needed

### 4. Communication Loop
- Claude Code writes to `.claudia/status/` and `.claudia/requests/`
- Claudia monitors these directories
- Humans respond to requests
- Claudia routes responses back to Claude Code

### 5. Completion
- Claude Code updates packet status to "completed"
- Claudia verifies acceptance criteria
- Next packet is assigned

## YAML Frontmatter

All markdown files use YAML frontmatter for machine-readable metadata. This enables:
- Automated status tracking
- Dependency management
- Priority sorting
- Time estimation and tracking
- Filtering and querying

## Best Practices

### For Packet Authors (Humans)
1. Write clear, specific acceptance criteria
2. Break large tasks into smaller packets
3. Define dependencies explicitly
4. Include context Claude Code needs
5. Specify quality requirements

### For Claude Code
1. Create status updates at milestones
2. Use requests for blocking questions only
3. Follow the established project structure
4. Reference packet IDs in commits
5. Update packet status accurately

### For Claudia Integration
1. Use consistent file naming
2. Keep frontmatter schema consistent
3. Maintain directory structure
4. Use ISO timestamps
5. Include author attribution

## Using These Examples

### As Documentation
Read through the files to understand:
- How to structure a Claudia project
- What information goes in each file type
- How communication flows between participants

### As Test Fixtures
These files can be used to:
- Test Claudia's file parsing
- Validate frontmatter schemas
- Simulate project states
- Verify communication protocols

### As Templates
Copy and modify these files for new projects:
1. Copy `sample-project/` to your project
2. Update `config.json` with your settings
3. Replace PRD and BUILD_PLAN content
4. Create your own packets
5. Customize KICKOFF.md

## File Formats

| File Type | Format | Frontmatter |
|-----------|--------|-------------|
| Config | JSON | N/A |
| PRD | Markdown | Optional |
| Build Plan | Markdown | Optional |
| Packets | Markdown | Required |
| Kickoff | Markdown | Required |
| Status | Markdown | Required |
| Requests | Markdown | Required |

## Questions?

If you're implementing a Claudia integration or have questions about the protocol, refer to the main Claudia documentation or examine the sample files in detail.
