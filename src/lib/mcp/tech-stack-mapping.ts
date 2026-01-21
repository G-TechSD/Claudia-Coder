/**
 * Tech Stack to MCP Server Mapping
 * Auto-suggests MCP servers based on project technology tags
 */

// Mapping of tech stack tags to suggested MCP server IDs
export const TECH_STACK_MCP_MAPPING: Record<string, string[]> = {
  // Frontend Frameworks
  "react": ["context7"],
  "vue": ["context7"],
  "angular": ["context7"],
  "svelte": ["context7"],
  "nextjs": ["context7"],
  "next.js": ["context7"],
  "nuxt": ["context7"],
  "gatsby": ["context7"],
  "remix": ["context7"],
  "astro": ["context7"],

  // Backend / Runtime
  "node": ["context7", "filesystem"],
  "nodejs": ["context7", "filesystem"],
  "node.js": ["context7", "filesystem"],
  "express": ["context7"],
  "fastify": ["context7"],
  "nest": ["context7"],
  "nestjs": ["context7"],
  "deno": ["context7"],
  "bun": ["context7"],

  // Python
  "python": ["context7"],
  "django": ["context7"],
  "flask": ["context7"],
  "fastapi": ["context7"],

  // Other Languages
  "rust": ["context7"],
  "go": ["context7"],
  "golang": ["context7"],
  "java": ["context7"],
  "kotlin": ["context7"],
  "swift": ["context7"],
  "typescript": ["context7"],
  "javascript": ["context7"],

  // Databases
  "postgresql": ["postgres"],
  "postgres": ["postgres"],
  "supabase": ["supabase"],
  "firebase": ["firebase"],
  "mongodb": ["context7"],
  "mysql": ["context7"],
  "redis": ["context7"],
  "prisma": ["context7"],
  "drizzle": ["context7"],

  // Cloud & Infrastructure
  "aws": ["aws"],
  "gcp": ["gcp"],
  "azure": ["azure"],
  "vercel": ["context7"],
  "netlify": ["context7"],
  "docker": ["context7"],
  "kubernetes": ["context7"],
  "k8s": ["context7"],

  // Version Control & Collaboration
  "github": ["github"],
  "gitlab": ["gitlab"],
  "git": ["context7"],

  // Testing
  "playwright": ["playwright"],
  "cypress": ["context7"],
  "jest": ["context7"],
  "vitest": ["context7"],
  "testing": ["context7"],

  // Payment & Services
  "stripe": ["stripe"],
  "twilio": ["twilio"],

  // Mobile
  "react-native": ["context7"],
  "expo": ["context7"],
  "flutter": ["context7"],
  "ios": ["context7"],
  "android": ["context7"],

  // AI/ML
  "openai": ["context7"],
  "langchain": ["context7"],
  "tensorflow": ["context7"],
  "pytorch": ["context7"],
  "machine-learning": ["context7"],
  "ai": ["context7"],
}

// MCP Server metadata for display in UI
export interface MCPServerInfo {
  id: string
  name: string
  description: string
  category: string
  requiresConfig: boolean
  envVars?: string[]
}

export const MCP_SERVER_INFO: Record<string, MCPServerInfo> = {
  "context7": {
    id: "context7",
    name: "Context7",
    description: "Access up-to-date documentation for any library or framework",
    category: "Documentation",
    requiresConfig: false,
  },
  "filesystem": {
    id: "filesystem",
    name: "Filesystem",
    description: "Read, write, and manage files in specified directories",
    category: "File System",
    requiresConfig: true,
    envVars: ["ALLOWED_DIRECTORIES"],
  },
  "postgres": {
    id: "postgres",
    name: "PostgreSQL",
    description: "Query and manage PostgreSQL databases",
    category: "Database",
    requiresConfig: true,
    envVars: ["POSTGRES_CONNECTION_STRING"],
  },
  "supabase": {
    id: "supabase",
    name: "Supabase",
    description: "Interact with Supabase projects and databases",
    category: "Database",
    requiresConfig: true,
    envVars: ["SUPABASE_URL", "SUPABASE_KEY"],
  },
  "firebase": {
    id: "firebase",
    name: "Firebase",
    description: "Interact with Firebase services",
    category: "Cloud",
    requiresConfig: true,
    envVars: ["FIREBASE_PROJECT_ID"],
  },
  "github": {
    id: "github",
    name: "GitHub",
    description: "Access GitHub repositories, issues, and pull requests",
    category: "Version Control",
    requiresConfig: true,
    envVars: ["GITHUB_TOKEN"],
  },
  "gitlab": {
    id: "gitlab",
    name: "GitLab",
    description: "Access GitLab repositories, issues, and merge requests",
    category: "Version Control",
    requiresConfig: true,
    envVars: ["GITLAB_TOKEN"],
  },
  "playwright": {
    id: "playwright",
    name: "Playwright",
    description: "Browser automation and testing with Playwright",
    category: "Testing",
    requiresConfig: false,
  },
  "stripe": {
    id: "stripe",
    name: "Stripe",
    description: "Manage Stripe payments, subscriptions, and customers",
    category: "Payment",
    requiresConfig: true,
    envVars: ["STRIPE_API_KEY"],
  },
  "twilio": {
    id: "twilio",
    name: "Twilio",
    description: "Send SMS, voice calls, and other communications",
    category: "Communication",
    requiresConfig: true,
    envVars: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"],
  },
  "aws": {
    id: "aws",
    name: "AWS",
    description: "Interact with Amazon Web Services",
    category: "Cloud",
    requiresConfig: true,
    envVars: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION"],
  },
  "gcp": {
    id: "gcp",
    name: "Google Cloud",
    description: "Interact with Google Cloud Platform",
    category: "Cloud",
    requiresConfig: true,
    envVars: ["GOOGLE_APPLICATION_CREDENTIALS"],
  },
  "azure": {
    id: "azure",
    name: "Azure",
    description: "Interact with Microsoft Azure services",
    category: "Cloud",
    requiresConfig: true,
    envVars: ["AZURE_SUBSCRIPTION_ID"],
  },
}

/**
 * Suggest MCP servers based on a project's tech stack tags
 * @param techStack Array of technology tags (e.g., ["react", "nextjs", "postgresql"])
 * @returns Array of unique suggested MCP server IDs
 */
export function suggestMCPServers(techStack: string[]): string[] {
  const suggested = new Set<string>()

  for (const tech of techStack) {
    const normalizedTech = tech.toLowerCase().trim()
    const servers = TECH_STACK_MCP_MAPPING[normalizedTech]
    if (servers) {
      servers.forEach((s) => suggested.add(s))
    }
  }

  return Array.from(suggested)
}

/**
 * Get MCP server info for a list of server IDs
 * @param serverIds Array of MCP server IDs
 * @returns Array of MCPServerInfo objects
 */
export function getMCPServerInfo(serverIds: string[]): MCPServerInfo[] {
  return serverIds
    .map((id) => MCP_SERVER_INFO[id])
    .filter((info): info is MCPServerInfo => info !== undefined)
}

/**
 * Get all available MCP servers
 * @returns Array of all MCPServerInfo objects
 */
export function getAllMCPServers(): MCPServerInfo[] {
  return Object.values(MCP_SERVER_INFO)
}

/**
 * Group MCP servers by category
 * @returns Record of category -> MCPServerInfo[]
 */
export function getMCPServersByCategory(): Record<string, MCPServerInfo[]> {
  const byCategory: Record<string, MCPServerInfo[]> = {}

  for (const server of Object.values(MCP_SERVER_INFO)) {
    if (!byCategory[server.category]) {
      byCategory[server.category] = []
    }
    byCategory[server.category].push(server)
  }

  return byCategory
}
