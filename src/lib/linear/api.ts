/**
 * Linear API Client
 * One-way import from Linear to Claudia
 */

const LINEAR_API_URL = "https://api.linear.app/graphql"

export interface LinearTeam {
  id: string
  name: string
  key: string
}

export interface LinearProject {
  id: string
  name: string
  description?: string
  state: string
  progress: number
  targetDate?: string
  startedAt?: string
  completedAt?: string
  issueCount?: number
  teams: { nodes: LinearTeam[] }
}

export interface LinearComment {
  id: string
  body: string
  createdAt: string
  updatedAt: string
  user?: {
    id: string
    name: string
    email: string
  }
}

export interface LinearIssue {
  id: string
  identifier: string
  title: string
  description?: string
  priority: number
  priorityLabel: string
  state: {
    id: string
    name: string
    type: string
    color: string
  }
  labels: {
    nodes: Array<{ id: string; name: string; color: string }>
  }
  estimate?: number
  dueDate?: string
  createdAt: string
  updatedAt: string
  assignee?: {
    id: string
    name: string
    email: string
  }
  parent?: {
    id: string
    identifier: string
    title: string
  }
  children?: {
    nodes: LinearIssue[]
  }
  comments?: LinearComment[]
}

export interface LinearImportResult {
  project: LinearProject
  issues: LinearIssue[]
  teams: LinearTeam[]
}

function getApiKey(): string | null {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_LINEAR_API_KEY || null
  }
  return process.env.NEXT_PUBLIC_LINEAR_API_KEY || process.env.LINEAR_API_KEY || null
}

export function hasLinearToken(): boolean {
  return !!getApiKey()
}

async function linearQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error("Linear API key not configured")
  }

  const response = await fetch(LINEAR_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": apiKey
    },
    body: JSON.stringify({ query, variables })
  })

  if (!response.ok) {
    throw new Error(`Linear API error: ${response.status} ${response.statusText}`)
  }

  const result = await response.json()

  if (result.errors) {
    throw new Error(result.errors[0]?.message || "Linear API returned errors")
  }

  return result.data
}

export async function listTeams(): Promise<LinearTeam[]> {
  const query = `
    query {
      teams {
        nodes {
          id
          name
          key
        }
      }
    }
  `

  const data = await linearQuery<{ teams: { nodes: LinearTeam[] } }>(query)
  return data.teams.nodes
}

export async function listProjects(teamId?: string): Promise<LinearProject[]> {
  const query = `
    query ListProjects($filter: ProjectFilter) {
      projects(filter: $filter, first: 100) {
        nodes {
          id
          name
          description
          state
          progress
          targetDate
          startedAt
          completedAt
          teams {
            nodes {
              id
              name
              key
            }
          }
        }
      }
    }
  `

  const filter = teamId ? { team: { id: { eq: teamId } } } : undefined
  const data = await linearQuery<{ projects: { nodes: LinearProject[] } }>(query, { filter })

  // Log projects for debugging
  console.log(`[Linear API] listProjects: Fetched ${data.projects.nodes.length} projects`)
  for (const p of data.projects.nodes) {
    console.log(`  - ${p.name} (${p.id}): state=${p.state}, desc=${p.description?.substring(0, 50) || 'none'}`)
  }

  return data.projects.nodes
}

export async function getProject(projectId: string): Promise<LinearProject | null> {
  const query = `
    query GetProject($id: String!) {
      project(id: $id) {
        id
        name
        description
        state
        progress
        targetDate
        startedAt
        completedAt
        teams {
          nodes {
            id
            name
            key
          }
        }
      }
    }
  `

  try {
    const data = await linearQuery<{ project: LinearProject }>(query, { id: projectId })
    return data.project
  } catch {
    return null
  }
}

export interface GetProjectIssuesOptions {
  includeComments?: boolean
}

export async function getProjectIssues(
  projectId: string,
  options: GetProjectIssuesOptions = {}
): Promise<LinearIssue[]> {
  const { includeComments = false } = options
  const allIssues: LinearIssue[] = []
  let hasMore = true
  let cursor: string | undefined

  while (hasMore) {
    const query = `
      query GetProjectIssues($projectId: String!, $after: String) {
        project(id: $projectId) {
          issues(first: 50, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              identifier
              title
              description
              priority
              priorityLabel
              estimate
              dueDate
              createdAt
              updatedAt
              state {
                id
                name
                type
                color
              }
              labels {
                nodes {
                  id
                  name
                  color
                }
              }
              assignee {
                id
                name
                email
              }
              parent {
                id
                identifier
                title
              }
            }
          }
        }
      }
    `

    const data = await linearQuery<{
      project: {
        issues: {
          pageInfo: { hasNextPage: boolean; endCursor: string }
          nodes: LinearIssue[]
        }
      } | null
    }>(query, { projectId, after: cursor })

    // Check if project or issues is null
    if (!data.project) {
      console.error(`[Linear API] Project ${projectId} not found or null response`)
      break
    }

    if (!data.project.issues) {
      console.error(`[Linear API] Project ${projectId} has no issues field`)
      break
    }

    const nodes = data.project.issues.nodes || []
    console.log(`[Linear API] Fetched ${nodes.length} issues for project ${projectId} (cursor: ${cursor || 'initial'})`)

    allIssues.push(...nodes)
    hasMore = data.project.issues.pageInfo?.hasNextPage || false
    cursor = data.project.issues.pageInfo?.endCursor
  }

  // Fetch comments for all issues if requested
  if (includeComments) {
    console.log(`[Linear API] Fetching comments for ${allIssues.length} issues...`)
    await Promise.all(
      allIssues.map(async (issue) => {
        issue.comments = await getIssueComments(issue.id)
      })
    )
    const totalComments = allIssues.reduce((sum, issue) => sum + (issue.comments?.length || 0), 0)
    console.log(`[Linear API] Fetched ${totalComments} comments across ${allIssues.length} issues`)
  } else {
    console.log(`[Linear API] Skipping comment fetch (includeComments: false)`)
  }

  return allIssues
}

/**
 * Fetch all comments for an issue with proper pagination
 * Linear uses cursor-based pagination, so we need to fetch all pages
 */
export async function getIssueComments(issueId: string): Promise<LinearComment[]> {
  const allComments: LinearComment[] = []
  let hasMore = true
  let cursor: string | undefined

  while (hasMore) {
    const query = `
      query GetIssueComments($issueId: String!, $after: String) {
        issue(id: $issueId) {
          comments(first: 100, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              body
              createdAt
              updatedAt
              user {
                id
                name
                email
              }
            }
          }
        }
      }
    `

    const data = await linearQuery<{
      issue: {
        comments: {
          pageInfo: { hasNextPage: boolean; endCursor: string }
          nodes: LinearComment[]
        }
      }
    }>(query, { issueId, after: cursor })

    allComments.push(...data.issue.comments.nodes)
    hasMore = data.issue.comments.pageInfo.hasNextPage
    cursor = data.issue.comments.pageInfo.endCursor
  }

  return allComments
}

export interface ImportProjectOptions {
  includeComments?: boolean
}

export async function importProject(
  projectId: string,
  options: ImportProjectOptions = {}
): Promise<LinearImportResult> {
  const { includeComments = false } = options

  const [project, issues] = await Promise.all([
    getProject(projectId),
    getProjectIssues(projectId, { includeComments })
  ])

  if (!project) {
    throw new Error("Project not found")
  }

  return {
    project,
    issues,
    teams: project.teams.nodes
  }
}

// Search projects by name
export async function searchProjects(query: string): Promise<LinearProject[]> {
  const gql = `
    query SearchProjects {
      projects(first: 50) {
        nodes {
          id
          name
          description
          state
          progress
          teams {
            nodes {
              id
              name
              key
            }
          }
        }
      }
    }
  `

  const data = await linearQuery<{ projects: { nodes: LinearProject[] } }>(gql)

  // Filter locally since Linear doesn't have text search for projects
  const lowerQuery = query.toLowerCase()
  return data.projects.nodes.filter(p =>
    p.name.toLowerCase().includes(lowerQuery) ||
    p.description?.toLowerCase().includes(lowerQuery)
  )
}

// Map Linear priority (1-4, 0=none) to Claudia priority
export function mapLinearPriority(priority: number): "critical" | "high" | "medium" | "low" {
  switch (priority) {
    case 1: return "critical" // Urgent
    case 2: return "high"     // High
    case 3: return "medium"   // Medium
    case 4: return "low"      // Low
    default: return "medium"  // No priority
  }
}

// Map Linear state type to Claudia packet status
export function mapLinearState(stateType: string): "queued" | "in_progress" | "completed" | "blocked" {
  switch (stateType) {
    case "completed":
    case "canceled":
      return "completed"
    case "started":
      return "in_progress"
    case "backlog":
    case "unstarted":
    default:
      return "queued"
  }
}
