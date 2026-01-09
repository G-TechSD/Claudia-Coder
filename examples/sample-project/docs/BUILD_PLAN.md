# Build Plan: Todo App

## Overview

This document outlines the implementation plan for the Todo App, broken down into manageable packets that can be assigned to Claude Code for execution.

## Architecture Decisions

### Tech Stack
- **Runtime**: Node.js 20+
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5.x
- **Database**: PostgreSQL via Prisma
- **Auth**: NextAuth.js v5
- **Styling**: Tailwind CSS + shadcn/ui
- **Testing**: Vitest + Playwright

### Project Structure
```
todo-app/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── (auth)/          # Auth group routes
│   │   ├── (dashboard)/     # Protected routes
│   │   ├── api/             # API routes
│   │   └── layout.tsx
│   ├── components/          # React components
│   │   ├── ui/              # shadcn/ui components
│   │   └── features/        # Feature-specific components
│   ├── lib/                 # Utilities and helpers
│   │   ├── auth.ts
│   │   ├── db.ts
│   │   └── validations.ts
│   └── types/               # TypeScript types
├── prisma/
│   └── schema.prisma
├── tests/
│   ├── unit/
│   └── e2e/
└── public/
```

## Implementation Packets

### PKT-001: Project Setup
**Priority**: Critical
**Estimated Time**: 2-3 hours
**Dependencies**: None

Initialize the Next.js project with all required dependencies and base configuration.

### PKT-002: Database & Authentication
**Priority**: Critical
**Estimated Time**: 3-4 hours
**Dependencies**: PKT-001

Set up Prisma schema, database migrations, and NextAuth.js configuration.

### PKT-003: Todo API Routes
**Priority**: High
**Estimated Time**: 2-3 hours
**Dependencies**: PKT-002

Implement CRUD API routes for todo management.

### PKT-004: Todo UI Components
**Priority**: High
**Estimated Time**: 3-4 hours
**Dependencies**: PKT-003

Build React components for todo list, todo item, and todo forms.

### PKT-005: Categories & Filtering
**Priority**: Medium
**Estimated Time**: 2-3 hours
**Dependencies**: PKT-004

Add category management and filtering functionality.

### PKT-006: Testing & Polish
**Priority**: Medium
**Estimated Time**: 3-4 hours
**Dependencies**: PKT-005

Write tests and polish the UI/UX.

## Packet Sequence

```
PKT-001 (Setup)
    │
    ▼
PKT-002 (Auth & DB)
    │
    ▼
PKT-003 (API)
    │
    ▼
PKT-004 (UI)
    │
    ▼
PKT-005 (Features)
    │
    ▼
PKT-006 (Testing)
```

## Risk Mitigation

1. **Database Connection Issues**: Include fallback to SQLite for local development
2. **Auth Complexity**: Use NextAuth.js templates as starting point
3. **Scope Creep**: Clearly mark features as out-of-scope in packet instructions

## Quality Gates

Each packet must pass these criteria before marked complete:
- [ ] All specified features implemented
- [ ] TypeScript compiles without errors
- [ ] ESLint passes with no warnings
- [ ] Unit tests pass (where applicable)
- [ ] Manual testing of happy path completed
