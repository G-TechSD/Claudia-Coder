// Script to create test projects for Claudia testing
// Run with: node scripts/create-test-projects.js

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const testProjects = [
  {
    name: "TaskFlow Pro",
    description: "A modern task management app with real-time collaboration, kanban boards, time tracking, and team analytics. Built with React, Node.js, and PostgreSQL.",
    priority: "high",
    status: "active",
    tags: ["web-app", "productivity", "saas"]
  },
  {
    name: "HealthTrack Mobile",
    description: "Cross-platform fitness tracking app with workout plans, nutrition logging, progress charts, and social challenges. React Native with Firebase backend.",
    priority: "high",
    status: "planning",
    tags: ["mobile-app", "health", "fitness"]
  },
  {
    name: "DevOps Dashboard",
    description: "Real-time infrastructure monitoring dashboard with CI/CD pipeline visualization, log aggregation, and alert management. Next.js with Grafana integration.",
    priority: "critical",
    status: "active",
    tags: ["devops", "monitoring", "dashboard"]
  },
  {
    name: "AI Writing Assistant",
    description: "Browser extension that provides AI-powered writing suggestions, grammar checking, tone adjustment, and content generation. TypeScript with OpenAI API.",
    priority: "medium",
    status: "planning",
    tags: ["ai", "browser-extension", "productivity"]
  },
  {
    name: "E-Commerce API",
    description: "RESTful API for e-commerce with product catalog, inventory management, order processing, payment integration, and admin dashboard. Express.js with MongoDB.",
    priority: "high",
    status: "active",
    tags: ["api", "e-commerce", "backend"]
  },
  {
    name: "Video Conferencing App",
    description: "WebRTC-based video conferencing with screen sharing, virtual backgrounds, recording, and breakout rooms. React with Node.js signaling server.",
    priority: "critical",
    status: "planning",
    tags: ["webrtc", "video", "collaboration"]
  },
  {
    name: "CLI Database Tool",
    description: "Command-line tool for database migrations, backups, query execution, and schema visualization. Go with support for PostgreSQL, MySQL, SQLite.",
    priority: "medium",
    status: "active",
    tags: ["cli", "database", "devtools"]
  },
  {
    name: "Recipe Sharing Platform",
    description: "Social platform for sharing recipes with ingredient scaling, meal planning, shopping lists, and nutritional information. Next.js with Prisma and PostgreSQL.",
    priority: "medium",
    status: "planning",
    tags: ["web-app", "social", "food"]
  },
  {
    name: "IoT Home Automation",
    description: "Home automation system with device management, scheduling, energy monitoring, and voice control integration. Python backend with React dashboard.",
    priority: "high",
    status: "active",
    tags: ["iot", "automation", "smart-home"]
  },
  {
    name: "Code Review Bot",
    description: "GitHub bot that performs automated code reviews using AI, checks for security vulnerabilities, suggests improvements, and enforces coding standards. TypeScript with GitHub Actions.",
    priority: "critical",
    status: "planning",
    tags: ["ai", "devtools", "github"]
  }
];

function generateUUID() {
  return crypto.randomUUID();
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function createProjects() {
  const storageKey = 'claudia_projects'; // Legacy key for simplicity
  const projectsFile = path.join(__dirname, '..', '.local-storage', 'projects.json');

  // Ensure directory exists
  const dir = path.dirname(projectsFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Load existing projects or start fresh
  let existingProjects = [];
  if (fs.existsSync(projectsFile)) {
    try {
      existingProjects = JSON.parse(fs.readFileSync(projectsFile, 'utf8'));
    } catch (e) {
      console.log('Starting with fresh projects list');
    }
  }

  const newProjects = [];
  const now = new Date().toISOString();

  for (const proj of testProjects) {
    const id = generateUUID();
    const slug = slugify(proj.name);

    const project = {
      id,
      name: proj.name,
      description: proj.description,
      status: proj.status,
      priority: proj.priority,
      tags: proj.tags,
      repos: [],
      packetIds: [],
      resourceIds: [],
      workingDirectory: `/home/bill/claudia-projects/${slug}-${id.substring(0, 8)}`,
      createdAt: now,
      updatedAt: now
    };

    newProjects.push(project);
    console.log(`✓ Created: ${project.name} (${project.id.substring(0, 8)})`);
  }

  // Combine with existing
  const allProjects = [...existingProjects, ...newProjects];

  // Save to file
  fs.writeFileSync(projectsFile, JSON.stringify(allProjects, null, 2));
  console.log(`\n✓ Saved ${newProjects.length} new projects to ${projectsFile}`);
  console.log(`  Total projects: ${allProjects.length}`);

  return newProjects;
}

createProjects().catch(console.error);
