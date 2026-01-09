---
packet_id: PKT-002
title: Database Schema and Authentication
status: in_progress
priority: critical
estimated_hours: 4
actual_hours: null
assigned_to: claude-code
created: 2024-01-15
started: 2024-01-16
completed: null
dependencies:
  - PKT-001
tags:
  - database
  - authentication
  - prisma
  - nextauth
---

# PKT-002: Database Schema and Authentication

## Objective

Set up the PostgreSQL database with Prisma ORM and implement user authentication using NextAuth.js v5.

## Acceptance Criteria

- [ ] Prisma schema defined with User and Todo models
- [ ] Database migrations created and applied
- [ ] NextAuth.js v5 configured with credentials provider
- [ ] Sign up API route implemented
- [ ] Sign in flow working
- [ ] Sign out flow working
- [ ] Session management working
- [ ] Protected route middleware configured

## Database Schema

### User Model
```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  passwordHash  String
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  todos         Todo[]
}
```

### Todo Model
```prisma
model Todo {
  id          String    @id @default(cuid())
  title       String
  description String?
  completed   Boolean   @default(false)
  priority    Priority  @default(MEDIUM)
  dueDate     DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  categoryId  String?
  category    Category? @relation(fields: [categoryId], references: [id])
}

enum Priority {
  LOW
  MEDIUM
  HIGH
}
```

### Category Model
```prisma
model Category {
  id        String   @id @default(cuid())
  name      String
  color     String   @default("#6366f1")
  userId    String
  todos     Todo[]
  createdAt DateTime @default(now())
}
```

## Implementation Steps

### 1. Install Prisma

```bash
pnpm add prisma @prisma/client
pnpm add bcryptjs
pnpm add -D @types/bcryptjs
npx prisma init
```

### 2. Configure Database Connection

Update `.env`:
```
DATABASE_URL="postgresql://user:password@localhost:5432/todoapp"
```

### 3. Create Prisma Schema

Create the schema as defined above in `prisma/schema.prisma`

### 4. Run Migrations

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 5. Install and Configure NextAuth.js v5

```bash
pnpm add next-auth@beta
```

Create `src/lib/auth.ts`:
```typescript
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { prisma } from "./db"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Implementation here
      }
    })
  ],
  // ... rest of config
})
```

### 6. Create Auth API Routes

- `src/app/api/auth/[...nextauth]/route.ts`
- `src/app/api/auth/register/route.ts`

### 7. Create Middleware

Create `middleware.ts` for route protection.

## API Endpoints

### POST /api/auth/register
Register a new user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "...",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

## Notes for Claude Code

- Use bcryptjs for password hashing (not bcrypt, for better compatibility)
- Implement proper error handling with meaningful messages
- Add input validation using Zod schemas
- Ensure passwords are never returned in API responses
- Use HTTP-only cookies for session management

## Testing Checklist

1. Can register a new user
2. Cannot register with existing email
3. Can sign in with valid credentials
4. Cannot sign in with invalid credentials
5. Session persists across page refreshes
6. Can sign out successfully
7. Protected routes redirect unauthenticated users

## Current Progress

### 2024-01-16 09:00 - Started
Beginning database schema setup...

### 2024-01-16 11:30 - Milestone
Prisma schema complete, migrations applied. Starting NextAuth setup.

---

**Blocking Issue**: None currently

**Questions for Review**: Should we add email verification in v1?
