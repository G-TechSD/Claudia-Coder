/**
 * Project Scaffolding System
 *
 * "If you want to make an apple pie from scratch, you must first invent the universe."
 * - Carl Sagan
 *
 * This module creates the "universe" (foundational structure) for generated projects.
 * Before features can be generated, the project needs:
 * - Base configuration files
 * - Shared UI components
 * - Navigation/routing structure
 * - Type definitions
 * - Utility functions
 */

import type { FileChange } from "./apply-code"

/**
 * Supported project templates
 */
export type ProjectTemplate =
  | "nextjs-app"      // Next.js 14+ App Router
  | "nextjs-pages"    // Next.js Pages Router
  | "react-vite"      // React + Vite
  | "node-express"    // Node.js + Express API
  | "python-fastapi"  // Python + FastAPI
  | "flutter"         // Flutter mobile app
  | "cli"             // Node.js CLI tool

/**
 * Template configuration
 */
export interface TemplateConfig {
  template: ProjectTemplate
  name: string
  description: string
  features: string[]  // Features to include (auth, database, etc.)
  styling: "tailwind" | "css-modules" | "styled-components" | "none"
  typescript: boolean
}

/**
 * Scaffold result
 */
export interface ScaffoldResult {
  files: FileChange[]
  template: ProjectTemplate
  techStack: string[]
}

/**
 * Template definitions with their scaffold files
 */
const TEMPLATES: Record<ProjectTemplate, {
  name: string
  techStack: string[]
  getFiles: (config: TemplateConfig) => FileChange[]
}> = {
  "nextjs-app": {
    name: "Next.js App Router",
    techStack: ["Next.js 14", "React 18", "TypeScript", "Tailwind CSS"],
    getFiles: getNextJsAppFiles
  },
  "nextjs-pages": {
    name: "Next.js Pages Router",
    techStack: ["Next.js 14", "React 18", "TypeScript", "Tailwind CSS"],
    getFiles: getNextJsPagesFiles
  },
  "react-vite": {
    name: "React + Vite",
    techStack: ["React 18", "Vite", "TypeScript", "Tailwind CSS"],
    getFiles: getReactViteFiles
  },
  "node-express": {
    name: "Node.js + Express",
    techStack: ["Node.js", "Express", "TypeScript"],
    getFiles: getNodeExpressFiles
  },
  "python-fastapi": {
    name: "Python + FastAPI",
    techStack: ["Python 3.11", "FastAPI", "Pydantic"],
    getFiles: getPythonFastAPIFiles
  },
  "flutter": {
    name: "Flutter",
    techStack: ["Flutter", "Dart"],
    getFiles: getFlutterFiles
  },
  "cli": {
    name: "CLI Tool",
    techStack: ["Node.js", "TypeScript", "Commander"],
    getFiles: getCliFiles
  }
}

/**
 * Create project scaffold
 */
export function createScaffold(config: TemplateConfig): ScaffoldResult {
  const template = TEMPLATES[config.template]

  if (!template) {
    throw new Error(`Unknown template: ${config.template}`)
  }

  return {
    files: template.getFiles(config),
    template: config.template,
    techStack: template.techStack
  }
}

/**
 * Detect template from existing files
 */
export function detectTemplate(files: string[]): ProjectTemplate | null {
  // Check for Next.js
  if (files.includes("next.config.js") || files.includes("next.config.ts") || files.includes("next.config.mjs")) {
    // Check if using App Router
    if (files.some(f => f.includes("app/") && f.includes("page."))) {
      return "nextjs-app"
    }
    return "nextjs-pages"
  }

  // Check for Vite/React
  if (files.includes("vite.config.ts") || files.includes("vite.config.js")) {
    return "react-vite"
  }

  // Check for Express
  if (files.some(f => f.includes("express")) || files.includes("app.js") || files.includes("server.js")) {
    return "node-express"
  }

  // Check for Python
  if (files.includes("requirements.txt") || files.includes("pyproject.toml")) {
    if (files.some(f => f.includes("fastapi"))) {
      return "python-fastapi"
    }
  }

  // Check for Flutter
  if (files.includes("pubspec.yaml")) {
    return "flutter"
  }

  return null
}

/**
 * Get list of available templates
 */
export function getAvailableTemplates(): Array<{
  id: ProjectTemplate
  name: string
  techStack: string[]
}> {
  return Object.entries(TEMPLATES).map(([id, template]) => ({
    id: id as ProjectTemplate,
    name: template.name,
    techStack: template.techStack
  }))
}

// ============================================
// Template File Generators
// ============================================

function getNextJsAppFiles(config: TemplateConfig): FileChange[] {
  const files: FileChange[] = []

  // package.json
  files.push({
    path: "package.json",
    content: JSON.stringify({
      name: config.name.toLowerCase().replace(/\s+/g, "-"),
      version: "0.1.0",
      private: true,
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
        lint: "next lint"
      },
      dependencies: {
        next: "14.2.0",
        react: "^18",
        "react-dom": "^18"
      },
      devDependencies: {
        typescript: "^5",
        "@types/node": "^20",
        "@types/react": "^18",
        "@types/react-dom": "^18",
        tailwindcss: "^3.4.1",
        autoprefixer: "^10.0.1",
        postcss: "^8"
      }
    }, null, 2),
    action: "create"
  })

  // next.config.ts
  files.push({
    path: "next.config.ts",
    content: `import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Enable React Strict Mode for better development experience
  reactStrictMode: true,
}

export default nextConfig
`,
    action: "create"
  })

  // tsconfig.json
  files.push({
    path: "tsconfig.json",
    content: JSON.stringify({
      compilerOptions: {
        lib: ["dom", "dom.iterable", "esnext"],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: "esnext",
        moduleResolution: "bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: "preserve",
        incremental: true,
        plugins: [{ name: "next" }],
        paths: {
          "@/*": ["./src/*"]
        }
      },
      include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
      exclude: ["node_modules"]
    }, null, 2),
    action: "create"
  })

  // tailwind.config.ts
  if (config.styling === "tailwind") {
    files.push({
      path: "tailwind.config.ts",
      content: `import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
export default config
`,
      action: "create"
    })

    files.push({
      path: "postcss.config.mjs",
      content: `/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}

export default config
`,
      action: "create"
    })
  }

  // App layout
  files.push({
    path: "src/app/layout.tsx",
    content: `import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Navigation } from "@/components/navigation"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "${config.name}",
  description: "${config.description}",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-background">
          <Navigation />
          <main className="container mx-auto px-4 py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
`,
    action: "create"
  })

  // Global styles
  files.push({
    path: "src/app/globals.css",
    content: `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;
  --border: 214.3 31.8% 91.4%;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --primary: 210 40% 98%;
  --primary-foreground: 222.2 47.4% 11.2%;
  --secondary: 217.2 32.6% 17.5%;
  --secondary-foreground: 210 40% 98%;
  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;
  --accent: 217.2 32.6% 17.5%;
  --accent-foreground: 210 40% 98%;
  --border: 217.2 32.6% 17.5%;
}

body {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
}
`,
    action: "create"
  })

  // Home page
  files.push({
    path: "src/app/page.tsx",
    content: `export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h1 className="text-4xl font-bold mb-4">${config.name}</h1>
      <p className="text-lg text-muted-foreground max-w-md">
        ${config.description}
      </p>
    </div>
  )
}
`,
    action: "create"
  })

  // Navigation component - critical for app cohesion
  files.push({
    path: "src/components/navigation.tsx",
    content: `"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

// Define your navigation items here
// Features will add their routes to this list
const navItems = [
  { href: "/", label: "Home" },
  // Add feature routes here as they are generated
]

export function Navigation() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <span className="font-bold">${config.name}</span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "transition-colors hover:text-foreground/80",
                  pathname === item.href
                    ? "text-foreground"
                    : "text-foreground/60"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  )
}
`,
    action: "create"
  })

  // Utility functions
  files.push({
    path: "src/lib/utils.ts",
    content: `import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
`,
    action: "create"
  })

  // Types file
  files.push({
    path: "src/types/index.ts",
    content: `// Shared type definitions
// Add your types here as the project grows

export interface User {
  id: string
  name: string
  email: string
}

// Feature types will be added here
`,
    action: "create"
  })

  // Button component (basic UI)
  files.push({
    path: "src/components/ui/button.tsx",
    content: `import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-primary text-primary-foreground shadow hover:bg-primary/90": variant === "default",
            "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80": variant === "secondary",
            "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground": variant === "outline",
            "hover:bg-accent hover:text-accent-foreground": variant === "ghost",
            "text-primary underline-offset-4 hover:underline": variant === "link",
          },
          {
            "h-9 px-4 py-2": size === "default",
            "h-8 rounded-md px-3 text-xs": size === "sm",
            "h-10 rounded-md px-8": size === "lg",
            "h-9 w-9": size === "icon",
          },
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
`,
    action: "create"
  })

  // Card component
  files.push({
    path: "src/components/ui/card.tsx",
    content: `import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border bg-card text-card-foreground shadow",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
`,
    action: "create"
  })

  // Input component
  files.push({
    path: "src/components/ui/input.tsx",
    content: `import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
`,
    action: "create"
  })

  // .gitignore
  files.push({
    path: ".gitignore",
    content: `# dependencies
node_modules
.pnp
.pnp.js

# testing
coverage

# next.js
.next/
out/

# production
build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env*.local

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
`,
    action: "create"
  })

  return files
}

// Placeholder implementations for other templates
function getNextJsPagesFiles(config: TemplateConfig): FileChange[] {
  // Similar to App Router but with pages/ directory structure
  return getNextJsAppFiles(config) // For now, use the same
}

function getReactViteFiles(config: TemplateConfig): FileChange[] {
  const files: FileChange[] = []

  files.push({
    path: "package.json",
    content: JSON.stringify({
      name: config.name.toLowerCase().replace(/\s+/g, "-"),
      private: true,
      version: "0.0.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "tsc && vite build",
        preview: "vite preview"
      },
      dependencies: {
        react: "^18.2.0",
        "react-dom": "^18.2.0",
        "react-router-dom": "^6.20.0"
      },
      devDependencies: {
        "@types/react": "^18.2.0",
        "@types/react-dom": "^18.2.0",
        "@vitejs/plugin-react": "^4.2.0",
        typescript: "^5.0.0",
        vite: "^5.0.0",
        tailwindcss: "^3.4.0",
        autoprefixer: "^10.4.0",
        postcss: "^8.4.0"
      }
    }, null, 2),
    action: "create"
  })

  files.push({
    path: "index.html",
    content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${config.name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    action: "create"
  })

  files.push({
    path: "src/main.tsx",
    content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`,
    action: "create"
  })

  files.push({
    path: "src/App.tsx",
    content: `function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900">${config.name}</h1>
        <p className="mt-2 text-gray-600">${config.description}</p>
      </div>
    </div>
  )
}

export default App
`,
    action: "create"
  })

  return files
}

function getNodeExpressFiles(config: TemplateConfig): FileChange[] {
  const files: FileChange[] = []

  files.push({
    path: "package.json",
    content: JSON.stringify({
      name: config.name.toLowerCase().replace(/\s+/g, "-"),
      version: "1.0.0",
      main: "dist/index.js",
      scripts: {
        dev: "tsx watch src/index.ts",
        build: "tsc",
        start: "node dist/index.js"
      },
      dependencies: {
        express: "^4.18.0",
        cors: "^2.8.0"
      },
      devDependencies: {
        "@types/express": "^4.17.0",
        "@types/cors": "^2.8.0",
        "@types/node": "^20.0.0",
        typescript: "^5.0.0",
        tsx: "^4.0.0"
      }
    }, null, 2),
    action: "create"
  })

  files.push({
    path: "src/index.ts",
    content: `import express from 'express'
import cors from 'cors'

const app = express()
const port = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.json({ message: '${config.name} API' })
})

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.listen(port, () => {
  console.log(\`Server running on port \${port}\`)
})
`,
    action: "create"
  })

  return files
}

function getPythonFastAPIFiles(config: TemplateConfig): FileChange[] {
  const files: FileChange[] = []

  files.push({
    path: "requirements.txt",
    content: `fastapi>=0.104.0
uvicorn[standard]>=0.24.0
pydantic>=2.5.0
python-dotenv>=1.0.0
`,
    action: "create"
  })

  files.push({
    path: "main.py",
    content: `from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="${config.name}",
    description="${config.description}",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "${config.name} API"}

@app.get("/health")
async def health():
    return {"status": "ok"}
`,
    action: "create"
  })

  return files
}

function getFlutterFiles(config: TemplateConfig): FileChange[] {
  const files: FileChange[] = []

  files.push({
    path: "pubspec.yaml",
    content: `name: ${config.name.toLowerCase().replace(/\s+/g, "_")}
description: ${config.description}
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  cupertino_icons: ^1.0.2

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^2.0.0

flutter:
  uses-material-design: true
`,
    action: "create"
  })

  files.push({
    path: "lib/main.dart",
    content: `import 'package:flutter/material.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '${config.name}',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
        useMaterial3: true,
      ),
      home: const HomePage(),
    );
  }
}

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('${config.name}'),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              '${config.name}',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 16),
            Text(
              '${config.description}',
              style: Theme.of(context).textTheme.bodyLarge,
            ),
          ],
        ),
      ),
    );
  }
}
`,
    action: "create"
  })

  return files
}

function getCliFiles(config: TemplateConfig): FileChange[] {
  const files: FileChange[] = []

  files.push({
    path: "package.json",
    content: JSON.stringify({
      name: config.name.toLowerCase().replace(/\s+/g, "-"),
      version: "1.0.0",
      bin: {
        [config.name.toLowerCase().replace(/\s+/g, "-")]: "./dist/index.js"
      },
      scripts: {
        dev: "tsx src/index.ts",
        build: "tsc",
        start: "node dist/index.js"
      },
      dependencies: {
        commander: "^11.0.0",
        chalk: "^5.3.0"
      },
      devDependencies: {
        "@types/node": "^20.0.0",
        typescript: "^5.0.0",
        tsx: "^4.0.0"
      }
    }, null, 2),
    action: "create"
  })

  files.push({
    path: "src/index.ts",
    content: `#!/usr/bin/env node
import { Command } from 'commander'

const program = new Command()

program
  .name('${config.name.toLowerCase().replace(/\s+/g, "-")}')
  .description('${config.description}')
  .version('1.0.0')

program
  .command('hello')
  .description('Say hello')
  .argument('[name]', 'name to greet', 'World')
  .action((name) => {
    console.log(\`Hello, \${name}!\`)
  })

program.parse()
`,
    action: "create"
  })

  return files
}
