---
project: todo-app
kickoff_date: 2024-01-15
participants:
  - role: project_owner
    name: Bill
  - role: ai_developer
    name: Claude Code
  - role: orchestrator
    name: Claudia Coder
status: active
---

# Project Kickoff: Todo App

## Welcome

This document initiates the Todo App project. It serves as the starting point for Claude Code to understand the project context and begin work.

## Project Summary

We're building a modern todo application with the following key features:
- User authentication (sign up, sign in, sign out)
- Full CRUD for todo items
- Categories and priority levels
- Due date tracking
- Responsive design

## Key Documents

| Document | Location | Purpose |
|----------|----------|---------|
| PRD | `docs/PRD.md` | Product requirements and user stories |
| Build Plan | `docs/BUILD_PLAN.md` | Technical architecture and packet breakdown |
| Config | `.claudia/config.json` | Project and Claudia Coder configuration |

## Work Packets

The project is divided into 6 packets:

1. **PKT-001**: Project Setup (COMPLETED)
2. **PKT-002**: Database & Auth (IN PROGRESS)
3. **PKT-003**: Todo API Routes
4. **PKT-004**: Todo UI Components
5. **PKT-005**: Categories & Filtering
6. **PKT-006**: Testing & Polish

## Instructions for Claude Code

### Getting Started

1. Read the PRD to understand what we're building
2. Review the BUILD_PLAN for technical decisions
3. Check the current packet's status and requirements
4. Begin implementation following the packet instructions

### Communication Protocol

**Status Updates**: Create status files in `.claudia/status/` when:
- Starting a new packet
- Reaching a significant milestone
- Completing a packet
- Encountering a blocker

**Requests**: Create request files in `.claudia/requests/` when:
- You need clarification on requirements
- You want to propose a technical decision
- You encounter an issue that needs human input
- You need access to external resources

### Quality Standards

- All code must be TypeScript with proper types
- Follow the established project structure
- Write clear commit messages
- Include comments for complex logic
- Test critical paths before marking complete

## Current Assignment

**Active Packet**: PKT-002 - Database Schema and Authentication

Please review `docs/packets/PKT-002-create-api.md` and continue implementation.

## Contact

Questions about requirements? Create a request file.
Technical blockers? Document in status update.
Ready for review? Update packet status to "review".

---

*This kickoff document was created by the project owner and should be referenced throughout development.*
