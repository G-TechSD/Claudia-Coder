"use client"

import { useRouter } from "next/navigation"
import { InterviewPanel } from "@/components/interview/interview-panel"
import { createProject } from "@/lib/data/projects"
import type { InterviewSession } from "@/lib/data/types"

export default function NewProjectPage() {
  const router = useRouter()

  const handleComplete = (session: InterviewSession) => {
    // Extract project data from interview
    const extractedData = session.extractedData || {}

    // Create the project with interview data
    const project = createProject({
      name: extractedData.name as string || generateProjectName(session),
      description: extractedData.description as string || session.summary || "",
      status: "planning",
      priority: (extractedData.priority as "low" | "medium" | "high" | "critical") || "medium",
      repos: [],
      packetIds: [],
      tags: (extractedData.techStack as string[]) || [],
      creationInterview: session
    })

    // Navigate to the new project
    router.push(`/projects/${project.id}`)
  }

  const handleCancel = () => {
    router.push("/projects")
  }

  return (
    <div className="h-[calc(100vh-4rem)]">
      <InterviewPanel
        type="project_creation"
        onComplete={handleComplete}
        onCancel={handleCancel}
      />
    </div>
  )
}

// Generate a project name from interview content
function generateProjectName(session: InterviewSession): string {
  // Get first user message (the project description)
  const firstUserMessage = session.messages.find(m => m.role === "user")
  if (!firstUserMessage) return "New Project"

  const content = firstUserMessage.content

  // Try to extract a meaningful name
  // Look for patterns like "I want to build X" or "a X that..."
  const patterns = [
    /(?:build|create|make|develop)\s+(?:a|an)?\s*([^,.!?]{3,30})/i,
    /^(?:a|an)\s+([^,.!?]{3,30})/i,
    /called\s+["']?([^"',!?.]{3,30})["']?/i,
    /named\s+["']?([^"',!?.]{3,30})["']?/i
  ]

  for (const pattern of patterns) {
    const match = content.match(pattern)
    if (match) {
      return capitalizeWords(match[1].trim())
    }
  }

  // Fall back to first few meaningful words
  const words = content
    .split(/\s+/)
    .filter(w => w.length > 3 && !["want", "need", "like", "would", "could", "should", "that", "this", "with"].includes(w.toLowerCase()))
    .slice(0, 3)
    .join(" ")

  return capitalizeWords(words) || "New Project"
}

function capitalizeWords(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}
