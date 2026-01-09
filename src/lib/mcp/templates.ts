/**
 * MCP Server Templates
 * Pre-configured templates for common MCP servers
 */

import { MCPServerTemplate } from "./types"

export const mcpServerTemplates: MCPServerTemplate[] = [
  // ============================================
  // Filesystem & File Access
  // ============================================
  {
    id: "filesystem",
    name: "Filesystem",
    description: "Read and write files, create directories, and manage the local filesystem",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/home"],
    category: "Filesystem",
    icon: "FolderOpen",
    documentation: "https://github.com/anthropics/mcp-servers/tree/main/packages/mcp-server-filesystem"
  },
  {
    id: "filesystem-readonly",
    name: "Filesystem (Read-only)",
    description: "Read-only access to the local filesystem for safer operations",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "--read-only", "/home"],
    category: "Filesystem",
    icon: "FileText",
    documentation: "https://github.com/anthropics/mcp-servers/tree/main/packages/mcp-server-filesystem"
  },

  // ============================================
  // Version Control
  // ============================================
  {
    id: "github",
    name: "GitHub",
    description: "Interact with GitHub repositories, issues, pull requests, and more",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env: {
      GITHUB_TOKEN: ""
    },
    envPlaceholders: {
      GITHUB_TOKEN: "Your GitHub personal access token"
    },
    category: "Version Control",
    icon: "Github",
    documentation: "https://github.com/anthropics/mcp-servers/tree/main/packages/mcp-server-github"
  },
  {
    id: "git",
    name: "Git",
    description: "Execute git commands and manage local repositories",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-git"],
    category: "Version Control",
    icon: "GitBranch",
    documentation: "https://github.com/anthropics/mcp-servers/tree/main/packages/mcp-server-git"
  },
  {
    id: "gitlab",
    name: "GitLab",
    description: "Interact with GitLab repositories, issues, and merge requests",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-gitlab"],
    env: {
      GITLAB_TOKEN: "",
      GITLAB_URL: "https://gitlab.com"
    },
    envPlaceholders: {
      GITLAB_TOKEN: "Your GitLab personal access token",
      GITLAB_URL: "GitLab instance URL (default: https://gitlab.com)"
    },
    category: "Version Control",
    icon: "GitMerge",
    documentation: "https://github.com/anthropics/mcp-servers/tree/main/packages/mcp-server-gitlab"
  },

  // ============================================
  // Databases
  // ============================================
  {
    id: "postgres",
    name: "PostgreSQL",
    description: "Query and manage PostgreSQL databases",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-postgres"],
    env: {
      POSTGRES_URL: ""
    },
    envPlaceholders: {
      POSTGRES_URL: "PostgreSQL connection string (e.g., postgresql://user:pass@localhost/db)"
    },
    category: "Databases",
    icon: "Database",
    documentation: "https://github.com/anthropics/mcp-servers/tree/main/packages/mcp-server-postgres"
  },
  {
    id: "sqlite",
    name: "SQLite",
    description: "Query and manage SQLite databases",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sqlite", "--db-path", "/path/to/database.db"],
    category: "Databases",
    icon: "Database",
    documentation: "https://github.com/anthropics/mcp-servers/tree/main/packages/mcp-server-sqlite"
  },

  // ============================================
  // Web & API
  // ============================================
  {
    id: "fetch",
    name: "Fetch",
    description: "Fetch web pages and convert HTML to markdown for analysis",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-fetch"],
    category: "Web & API",
    icon: "Globe",
    documentation: "https://github.com/anthropics/mcp-servers/tree/main/packages/mcp-server-fetch"
  },
  {
    id: "brave-search",
    name: "Brave Search",
    description: "Search the web using Brave Search API",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-brave-search"],
    env: {
      BRAVE_API_KEY: ""
    },
    envPlaceholders: {
      BRAVE_API_KEY: "Your Brave Search API key"
    },
    category: "Web & API",
    icon: "Search",
    documentation: "https://github.com/anthropics/mcp-servers/tree/main/packages/mcp-server-brave-search"
  },

  // ============================================
  // Productivity & Communication
  // ============================================
  {
    id: "slack",
    name: "Slack",
    description: "Send messages and interact with Slack workspaces",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-slack"],
    env: {
      SLACK_BOT_TOKEN: "",
      SLACK_TEAM_ID: ""
    },
    envPlaceholders: {
      SLACK_BOT_TOKEN: "Your Slack bot token (xoxb-...)",
      SLACK_TEAM_ID: "Your Slack team/workspace ID"
    },
    category: "Productivity",
    icon: "MessageSquare",
    documentation: "https://github.com/anthropics/mcp-servers/tree/main/packages/mcp-server-slack"
  },
  {
    id: "google-drive",
    name: "Google Drive",
    description: "Access and manage files in Google Drive",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-google-drive"],
    env: {
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: ""
    },
    envPlaceholders: {
      GOOGLE_CLIENT_ID: "Google OAuth client ID",
      GOOGLE_CLIENT_SECRET: "Google OAuth client secret"
    },
    category: "Productivity",
    icon: "Cloud",
    documentation: "https://github.com/anthropics/mcp-servers/tree/main/packages/mcp-server-google-drive"
  },

  // ============================================
  // Development Tools
  // ============================================
  {
    id: "puppeteer",
    name: "Puppeteer",
    description: "Control a headless browser for web automation and testing",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-puppeteer"],
    category: "Development",
    icon: "Monitor",
    documentation: "https://github.com/anthropics/mcp-servers/tree/main/packages/mcp-server-puppeteer"
  },
  {
    id: "memory",
    name: "Memory",
    description: "Persistent memory storage for maintaining context across sessions",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
    category: "Development",
    icon: "Brain",
    documentation: "https://github.com/anthropics/mcp-servers/tree/main/packages/mcp-server-memory"
  },
  {
    id: "sequential-thinking",
    name: "Sequential Thinking",
    description: "Enable step-by-step reasoning and problem-solving",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
    category: "Development",
    icon: "Lightbulb",
    documentation: "https://github.com/anthropics/mcp-servers/tree/main/packages/mcp-server-sequential-thinking"
  },

  // ============================================
  // Cloud & Infrastructure
  // ============================================
  {
    id: "aws",
    name: "AWS",
    description: "Interact with AWS services (S3, EC2, Lambda, etc.)",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-aws-kb-retrieval"],
    env: {
      AWS_ACCESS_KEY_ID: "",
      AWS_SECRET_ACCESS_KEY: "",
      AWS_REGION: "us-east-1"
    },
    envPlaceholders: {
      AWS_ACCESS_KEY_ID: "Your AWS access key ID",
      AWS_SECRET_ACCESS_KEY: "Your AWS secret access key",
      AWS_REGION: "AWS region (e.g., us-east-1)"
    },
    category: "Cloud",
    icon: "Cloud",
    documentation: "https://github.com/anthropics/mcp-servers"
  },

  // ============================================
  // Design Tools
  // ============================================
  {
    id: "figma",
    name: "Figma",
    description: "Access Figma designs and convert them to code",
    command: "npx",
    args: ["-y", "@anthropic/mcp-server-figma"],
    env: {
      FIGMA_ACCESS_TOKEN: ""
    },
    envPlaceholders: {
      FIGMA_ACCESS_TOKEN: "Your Figma personal access token"
    },
    category: "Design",
    icon: "Palette",
    documentation: "https://github.com/anthropics/mcp-servers"
  }
]

// Get templates by category
export function getTemplatesByCategory(): Record<string, MCPServerTemplate[]> {
  const byCategory: Record<string, MCPServerTemplate[]> = {}

  for (const template of mcpServerTemplates) {
    if (!byCategory[template.category]) {
      byCategory[template.category] = []
    }
    byCategory[template.category].push(template)
  }

  return byCategory
}

// Get all unique categories
export function getTemplateCategories(): string[] {
  return [...new Set(mcpServerTemplates.map(t => t.category))]
}

// Find template by ID
export function getTemplateById(id: string): MCPServerTemplate | undefined {
  return mcpServerTemplates.find(t => t.id === id)
}
