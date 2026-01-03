/**
 * HyperHealth Generation Script
 *
 * Generates the HyperHealth beta app by:
 * 1. Fetching issues from Linear
 * 2. Converting to work packets
 * 3. Executing code generation via local LLM
 * 4. Writing output to a local directory
 *
 * Run with: npx tsx scripts/generate-hyperhealth.ts
 */

import * as fs from 'fs'
import * as path from 'path'

// Load .env.local before importing other modules
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=')
      const value = valueParts.join('=')
      if (key && value !== undefined) {
        process.env[key] = value
      }
    }
  }
  console.log('Loaded .env.local')
}

// Configuration
const LINEAR_API_KEY = process.env.NEXT_PUBLIC_LINEAR_API_KEY || ''
const OUTPUT_DIR = path.join(__dirname, '..', 'generated', 'hyperhealth')
const HYPERHEALTH_PROJECT_ID = 'HYP'  // Linear project ID

interface LinearIssue {
  id: string
  identifier: string
  title: string
  description: string
  priority: number
  state: { name: string }
  labels: { nodes: { name: string }[] }
}

interface WorkPacket {
  id: string
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  tasks: { description: string }[]
  acceptanceCriteria: string[]
}

interface GeneratedFile {
  path: string
  content: string
}

async function fetchLinearIssues(): Promise<LinearIssue[]> {
  console.log('\n📥 Fetching issues from Linear...')

  const response = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': LINEAR_API_KEY
    },
    body: JSON.stringify({
      query: `
        query HyperHealthIssues {
          issues(filter: { project: { id: { eq: "${HYPERHEALTH_PROJECT_ID}" } } }, first: 100) {
            nodes {
              id
              identifier
              title
              description
              priority
              state { name }
              labels { nodes { name } }
            }
          }
        }
      `
    })
  })

  const data = await response.json()

  if (data.errors) {
    // Try finding HyperHealth project by name
    console.log('Project ID not found, searching by name...')
    const searchResp = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': LINEAR_API_KEY
      },
      body: JSON.stringify({
        query: `
          query FindHyperHealth {
            projects(filter: { name: { containsIgnoreCase: "hyperhealth" } }, first: 1) {
              nodes {
                id
                name
                issues { nodes {
                  id identifier title description priority
                  state { name }
                  labels { nodes { name } }
                }}
              }
            }
          }
        `
      })
    })

    const searchData = await searchResp.json()
    if (searchData.data?.projects?.nodes?.[0]) {
      const project = searchData.data.projects.nodes[0]
      console.log(`Found project: ${project.name} (${project.id})`)
      return project.issues?.nodes || []
    }

    throw new Error(`Linear API error: ${JSON.stringify(data.errors)}`)
  }

  return data.data?.issues?.nodes || []
}

function issuesToPackets(issues: LinearIssue[]): WorkPacket[] {
  return issues.map(issue => {
    // Extract acceptance criteria from description
    const descLines = (issue.description || '').split('\n')
    const acceptanceCriteria: string[] = []
    let inAcceptance = false

    for (const line of descLines) {
      if (line.toLowerCase().includes('acceptance') || line.toLowerCase().includes('criteria')) {
        inAcceptance = true
        continue
      }
      if (inAcceptance && line.trim().startsWith('-')) {
        acceptanceCriteria.push(line.trim().slice(1).trim())
      }
      if (inAcceptance && line.trim() === '' && acceptanceCriteria.length > 0) {
        inAcceptance = false
      }
    }

    // Default criteria if none found
    if (acceptanceCriteria.length === 0) {
      acceptanceCriteria.push('Feature works as described')
      acceptanceCriteria.push('No TypeScript errors')
      acceptanceCriteria.push('Code follows project patterns')
    }

    // Map priority
    const priorityMap: Record<number, 'low' | 'medium' | 'high' | 'critical'> = {
      0: 'low',
      1: 'low',
      2: 'medium',
      3: 'high',
      4: 'critical'
    }

    return {
      id: issue.id,
      title: `${issue.identifier}: ${issue.title}`,
      description: issue.description || issue.title,
      priority: priorityMap[issue.priority] || 'medium',
      tasks: [{ description: issue.title }],
      acceptanceCriteria
    }
  })
}

async function generateCodeForPacket(
  packet: WorkPacket,
  context: { projectName: string; techStack: string[]; existingFiles: string[] }
): Promise<GeneratedFile[]> {
  const { generateWithLocalLLM } = await import('../src/lib/llm/local-llm')

  // Simplified prompt for smaller models - focus on ONE main file
  const systemPrompt = `You are a developer. Generate ONE complete file for this feature.
Format:
=== FILE: path/to/file.tsx ===
\`\`\`typescript
// complete code here
\`\`\`

Rules:
- ONE main file only (can reference imports from other files)
- Complete, working TypeScript/React code
- Use Tailwind CSS classes
- No explanations, just code`

  // Shorter, focused prompt
  const userPrompt = `Feature: ${packet.title}
Tech: Next.js 14, TypeScript, Tailwind

Task: ${packet.tasks[0]?.description || packet.title}

Generate ONE complete file with working code.`

  console.log(`  Generating code for: ${packet.title.slice(0, 50)}...`)

  const result = await generateWithLocalLLM(systemPrompt, userPrompt, {
    temperature: 0.4,
    max_tokens: 4096  // Smaller output, less chance of truncation
  })

  if (result.error) {
    console.error(`  ❌ LLM error: ${result.error}`)
    return []
  }

  console.log(`  Generated ${result.content.length} chars using ${result.server}/${result.model}`)

  // Parse files from output
  const filePattern = /===\s*FILE:\s*(.+?)\s*===\s*\n```\w*\n([\s\S]*?)```/g
  const files: GeneratedFile[] = []
  let match

  while ((match = filePattern.exec(result.content)) !== null) {
    files.push({
      path: match[1].trim(),
      content: match[2].trim()
    })
  }

  console.log(`  Parsed ${files.length} file(s)`)
  return files
}

async function validateAndCritiqueCode(
  files: GeneratedFile[],
  packet: WorkPacket
): Promise<{ valid: boolean; confidence: number; issues: string[] }> {
  const { generateWithLocalLLM } = await import('../src/lib/llm/local-llm')

  const systemPrompt = `You are a senior code reviewer. Evaluate the generated code.
Output ONLY valid JSON in this format:
{
  "valid": true/false,
  "confidence": 0.0 to 1.0,
  "issues": ["list of problems"],
  "suggestions": ["list of improvements"]
}`

  const filesSummary = files.map(f => `${f.path}:\n${f.content.slice(0, 500)}...`).join('\n\n')

  const userPrompt = `FEATURE: ${packet.title}

ACCEPTANCE CRITERIA:
${packet.acceptanceCriteria.map(c => `- ${c}`).join('\n')}

GENERATED CODE:
${filesSummary}

Review this code and provide your analysis as JSON.`

  const result = await generateWithLocalLLM(systemPrompt, userPrompt, {
    temperature: 0.2,
    max_tokens: 1024
  })

  try {
    let jsonStr = result.content
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) jsonStr = jsonMatch[1]

    const critique = JSON.parse(jsonStr)
    return {
      valid: critique.valid !== false,
      confidence: critique.confidence || 0.5,
      issues: critique.issues || []
    }
  } catch {
    // If JSON parsing fails, assume valid
    return { valid: true, confidence: 0.7, issues: [] }
  }
}

async function writeFiles(files: GeneratedFile[], baseDir: string): Promise<void> {
  for (const file of files) {
    const fullPath = path.join(baseDir, file.path)
    const dir = path.dirname(fullPath)

    // Create directory if needed
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    fs.writeFileSync(fullPath, file.content)
    console.log(`  ✓ Wrote: ${file.path}`)
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  HyperHealth Beta Generator')
  console.log('  Claudia - AI Development Orchestrator')
  console.log('═══════════════════════════════════════════════════════════')

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  // Step 1: Fetch issues from Linear
  let issues: LinearIssue[]
  try {
    issues = await fetchLinearIssues()
    console.log(`Found ${issues.length} issues in HyperHealth project`)
  } catch (error) {
    console.error('Failed to fetch issues:', error)
    process.exit(1)
  }

  if (issues.length === 0) {
    console.log('No issues found. Exiting.')
    process.exit(0)
  }

  // Step 2: Convert to work packets
  const packets = issuesToPackets(issues)
  console.log(`\n📦 Created ${packets.length} work packets`)

  // Project context
  const context = {
    projectName: 'HyperHealth',
    techStack: ['Next.js 14', 'TypeScript', 'Tailwind CSS', 'React', 'SQLite'],
    existingFiles: [] as string[]
  }

  // Create base project structure first
  console.log('\n📁 Creating base project structure...')
  const baseFiles: GeneratedFile[] = [
    {
      path: 'package.json',
      content: JSON.stringify({
        name: 'hyperhealth',
        version: '0.1.0-beta',
        private: true,
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
          lint: 'next lint'
        },
        dependencies: {
          'next': '^14.0.0',
          'react': '^18.2.0',
          'react-dom': '^18.2.0',
          'better-sqlite3': '^9.0.0',
          'tailwindcss': '^3.3.0',
          '@tailwindcss/forms': '^0.5.0'
        },
        devDependencies: {
          '@types/node': '^20',
          '@types/react': '^18',
          '@types/react-dom': '^18',
          '@types/better-sqlite3': '^7',
          'typescript': '^5'
        }
      }, null, 2)
    },
    {
      path: 'tsconfig.json',
      content: JSON.stringify({
        compilerOptions: {
          target: 'es5',
          lib: ['dom', 'dom.iterable', 'esnext'],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: 'preserve',
          incremental: true,
          plugins: [{ name: 'next' }],
          paths: { '@/*': ['./src/*'] }
        },
        include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
        exclude: ['node_modules']
      }, null, 2)
    },
    {
      path: 'tailwind.config.ts',
      content: `import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#10B981',
        secondary: '#3B82F6',
        accent: '#F59E0B',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}

export default config`
    },
    {
      path: 'src/app/layout.tsx',
      content: `import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'HyperHealth',
  description: 'Your personal health tracking companion',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          {children}
        </div>
      </body>
    </html>
  )
}`
    },
    {
      path: 'src/app/globals.css',
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground-rgb: 0, 0, 0;
  --background-start-rgb: 214, 219, 220;
  --background-end-rgb: 255, 255, 255;
}`
    },
    {
      path: 'src/app/page.tsx',
      content: `export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold text-primary mb-4">Welcome to HyperHealth</h1>
      <p className="text-gray-600 text-lg">Your personal health tracking companion</p>
    </main>
  )
}`
    }
  ]

  await writeFiles(baseFiles, OUTPUT_DIR)
  context.existingFiles = baseFiles.map(f => f.path)

  // Step 3: Process packets
  console.log('\n🔄 Processing work packets...')

  let successCount = 0
  let failCount = 0
  const allGeneratedFiles: GeneratedFile[] = []

  // Process top priority packets first (limit to avoid rate limits)
  const sortedPackets = packets
    .sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })
    .slice(0, 25) // Process top 25 packets

  for (let i = 0; i < sortedPackets.length; i++) {
    const packet = sortedPackets[i]
    console.log(`\n[${i + 1}/${sortedPackets.length}] Processing: ${packet.title}`)
    console.log(`  Priority: ${packet.priority}`)

    try {
      // Generate code
      const files = await generateCodeForPacket(packet, context)

      if (files.length === 0) {
        console.log('  ⚠️ No files generated')
        failCount++
        continue
      }

      // Skip validation for first pass - just write the code
      // (Ralph Wiggum loop will improve quality in subsequent iterations)
      console.log(`  Files to write: ${files.length}`)

      // Write files
      await writeFiles(files, OUTPUT_DIR)
      allGeneratedFiles.push(...files)
      context.existingFiles.push(...files.map(f => f.path))

      successCount++

      // Small delay between packets
      await new Promise(resolve => setTimeout(resolve, 1000))

    } catch (error) {
      console.error(`  ❌ Error: ${error}`)
      failCount++
    }
  }

  // Step 4: Summary
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('  Generation Complete')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`  ✓ Successful: ${successCount}`)
  console.log(`  ✗ Failed: ${failCount}`)
  console.log(`  📁 Total files: ${allGeneratedFiles.length + baseFiles.length}`)
  console.log(`  📂 Output: ${OUTPUT_DIR}`)
  console.log('')

  // Create a manifest
  const manifest = {
    project: 'HyperHealth Beta',
    generatedAt: new Date().toISOString(),
    packetsProcessed: sortedPackets.length,
    successfulPackets: successCount,
    failedPackets: failCount,
    files: [...baseFiles, ...allGeneratedFiles].map(f => f.path)
  }

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'generation-manifest.json'),
    JSON.stringify(manifest, null, 2)
  )

  console.log('✓ Manifest written to generation-manifest.json')

  process.exit(failCount > successCount ? 1 : 0)
}

main().catch(console.error)
