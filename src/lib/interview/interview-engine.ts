/**
 * Interview Engine
 * Manages interview sessions, generates questions, and extracts insights
 */

import type {
  InterviewSession,
  InterviewMessage,
  InterviewType,
  InterviewTargetType
} from "@/lib/data/types"
import { buildInterviewContext, PROJECT_CREATION_FOLLOW_UPS, EXTRACTION_PROMPT } from "./prompts"

// UUID generator that works in all contexts (HTTP, HTTPS, localhost)
function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// ============ Session Management ============

export function createInterviewSession(
  type: InterviewType,
  targetType?: InterviewTargetType,
  targetId?: string,
  targetTitle?: string,
  targetContext?: Record<string, unknown>
): InterviewSession {
  const { systemPrompt, opener } = buildInterviewContext(type, targetType, targetContext)

  return {
    id: generateUUID(),
    type,
    status: "in_progress",
    targetType,
    targetId,
    targetTitle,
    targetContext,
    messages: [
      {
        id: generateUUID(),
        role: "assistant",
        content: opener,
        timestamp: new Date().toISOString()
      }
    ],
    createdAt: new Date().toISOString()
  }
}

export function addUserMessage(
  session: InterviewSession,
  content: string,
  transcribedFrom: "voice" | "text" = "text"
): InterviewSession {
  const message: InterviewMessage = {
    id: generateUUID(),
    role: "user",
    content,
    timestamp: new Date().toISOString(),
    transcribedFrom
  }

  return {
    ...session,
    messages: [...session.messages, message]
  }
}

export function addAssistantMessage(
  session: InterviewSession,
  content: string
): InterviewSession {
  const message: InterviewMessage = {
    id: generateUUID(),
    role: "assistant",
    content,
    timestamp: new Date().toISOString()
  }

  return {
    ...session,
    messages: [...session.messages, message]
  }
}

export function markSkipped(session: InterviewSession): InterviewSession {
  const messages = [...session.messages]
  if (messages.length > 0) {
    const last = messages[messages.length - 1]
    if (last.role === "assistant") {
      messages[messages.length - 1] = { ...last, skipped: true }
    }
  }
  return { ...session, messages }
}

export function completeInterview(
  session: InterviewSession,
  summary?: string,
  keyPoints?: string[],
  suggestedActions?: string[],
  extractedData?: Record<string, unknown>
): InterviewSession {
  return {
    ...session,
    status: "completed",
    summary,
    keyPoints,
    suggestedActions,
    extractedData,
    completedAt: new Date().toISOString()
  }
}

export function cancelInterview(session: InterviewSession): InterviewSession {
  return {
    ...session,
    status: "cancelled",
    completedAt: new Date().toISOString()
  }
}

// ============ Question Generation ============

/**
 * Generate the next question based on conversation history.
 * In a real implementation, this would call an LLM API.
 * For now, uses smart fallback logic.
 */
export async function generateNextQuestion(
  session: InterviewSession,
  userResponse: string
): Promise<string> {
  const messageCount = session.messages.length

  // Check for commands
  const lowerResponse = userResponse.toLowerCase().trim()
  if (lowerResponse === "skip" || lowerResponse === "next") {
    return getNextFallbackQuestion(session)
  }
  if (lowerResponse.includes("more") || lowerResponse.includes("elaborate")) {
    return generateFollowUp(session, userResponse)
  }
  if (lowerResponse === "done" || lowerResponse === "finish" || lowerResponse === "end") {
    return "Great! Let me summarize what we've discussed. Is there anything else you'd like to add before we wrap up?"
  }

  // For project creation interviews
  if (session.type === "project_creation") {
    return generateProjectQuestion(session, userResponse)
  }

  // For contextual interviews (shorter)
  if (session.type === "contextual") {
    return generateContextualQuestion(session, userResponse)
  }

  return getNextFallbackQuestion(session)
}

function generateProjectQuestion(session: InterviewSession, userResponse: string): string {
  const questionCount = session.messages.filter(m => m.role === "assistant").length
  const userMessages = session.messages.filter(m => m.role === "user")

  // If this is after the first response (project description)
  if (questionCount === 1) {
    return "That sounds interesting! Who would be the main users of this, and what problem are you solving for them?"
  }

  // Check what topics we've covered
  const allUserContent = userMessages.map(m => m.content.toLowerCase()).join(" ")
  const topics = {
    users: /users?|audience|customers?|people/i.test(allUserContent),
    features: /features?|functionality|capability/i.test(allUserContent),
    tech: /tech|stack|framework|language|react|node|python/i.test(allUserContent),
    scale: /scale|users?|traffic|performance|big|large/i.test(allUserContent),
    timeline: /time|deadline|when|schedule|weeks?|months?/i.test(allUserContent),
    integration: /integrat|api|connect|sync/i.test(allUserContent),
    similar: /similar|like|competitor|existing/i.test(allUserContent)
  }

  // Ask about uncovered topics with natural transitions
  if (!topics.features && questionCount >= 2) {
    return "What are the 2-3 most important features this needs to have on day one?"
  }
  if (!topics.tech && questionCount >= 3) {
    return "Do you have any preferences for the tech stack, or should I suggest something based on what you've described?"
  }
  if (!topics.scale && questionCount >= 4) {
    return "How big do you see this getting? Are we building for 10 users or 10,000?"
  }
  if (!topics.integration && questionCount >= 5) {
    return "Will this need to connect to any existing systems or APIs?"
  }
  if (!topics.timeline && questionCount >= 6) {
    return "Is there a target date or deadline we should know about?"
  }
  if (!topics.similar && questionCount >= 7) {
    return "Have you looked at any existing solutions? What did or didn't work about them?"
  }

  // Wrap-up questions
  if (questionCount >= 10) {
    return "We're getting a good picture. What's the single most important thing to get right?"
  }
  if (questionCount >= 12) {
    return "Anything else you want to make sure we capture before I summarize?"
  }
  if (questionCount >= 15) {
    return "I think we have a solid foundation. Ready for me to put together a project summary?"
  }

  // Fallback to follow-up pool
  return getNextFallbackQuestion(session)
}

function generateContextualQuestion(session: InterviewSession, userResponse: string): string {
  const questionCount = session.messages.filter(m => m.role === "assistant").length

  // Contextual interviews are shorter
  if (questionCount >= 5) {
    return "Thanks for the context. Any final thoughts before I summarize my understanding?"
  }

  // Generate based on target type
  if (session.targetType === "commit") {
    if (questionCount === 1) return "Were there any alternative approaches you considered?"
    if (questionCount === 2) return "How confident are you in the testing coverage for this change?"
    if (questionCount === 3) return "Anything you'd do differently if you had more time?"
  }

  if (session.targetType === "activity") {
    if (questionCount === 1) return "Was this expected behavior, or did something surprise you?"
    if (questionCount === 2) return "What's the next step here?"
    if (questionCount === 3) return "Should we flag this for anyone else's attention?"
  }

  return "Anything else relevant to add?"
}

function generateFollowUp(session: InterviewSession, userResponse: string): string {
  const lastAssistantMessage = [...session.messages]
    .reverse()
    .find(m => m.role === "assistant")

  if (lastAssistantMessage?.content.includes("feature")) {
    return "Tell me more about that feature - what makes it essential?"
  }
  if (lastAssistantMessage?.content.includes("user")) {
    return "What's a day in the life of your typical user? What frustrates them?"
  }
  if (lastAssistantMessage?.content.includes("tech")) {
    return "Are there specific requirements driving that tech choice?"
  }

  return "Can you give me an example of what you mean?"
}

function getNextFallbackQuestion(session: InterviewSession): string {
  const askedQuestions = session.messages
    .filter(m => m.role === "assistant")
    .map(m => m.content)

  // Find a question we haven't asked yet
  for (const question of PROJECT_CREATION_FOLLOW_UPS) {
    const alreadyAsked = askedQuestions.some(
      asked => asked.toLowerCase().includes(question.toLowerCase().slice(0, 20))
    )
    if (!alreadyAsked) {
      return question
    }
  }

  // All questions asked
  return "Is there anything else important about the project you'd like to share?"
}

// ============ Insight Extraction ============

/**
 * Extract structured insights from the interview.
 * In a real implementation, this would call an LLM.
 * For now, uses pattern matching.
 */
export async function extractInsights(session: InterviewSession): Promise<{
  summary: string
  keyPoints: string[]
  suggestedActions: string[]
  extractedData: Record<string, unknown>
}> {
  const userMessages = session.messages
    .filter(m => m.role === "user")
    .map(m => m.content)
    .join(" ")

  // Basic extraction (would be replaced with LLM call)
  const summary = generateSummary(userMessages, session.type)
  const keyPoints = extractKeyPoints(userMessages)
  const suggestedActions = generateSuggestedActions(session.type)
  const extractedData = extractProjectData(userMessages)

  return { summary, keyPoints, suggestedActions, extractedData }
}

function generateSummary(content: string, type: InterviewType): string {
  const wordCount = content.split(/\s+/).length
  if (type === "project_creation") {
    return `Project interview completed with ${wordCount} words of input covering goals, features, and requirements.`
  }
  return `Contextual interview completed covering the key discussion points.`
}

function extractKeyPoints(content: string): string[] {
  const points: string[] = []

  // Extract what seem like important statements
  if (content.includes("need") || content.includes("must")) {
    points.push("Requirements identified for core functionality")
  }
  if (content.includes("user") || content.includes("customer")) {
    points.push("Target audience discussed")
  }
  if (content.includes("integrate") || content.includes("connect")) {
    points.push("Integration requirements noted")
  }
  if (content.includes("deadline") || content.includes("timeline")) {
    points.push("Timeline constraints mentioned")
  }

  return points.length > 0 ? points : ["Key details captured from interview"]
}

function generateSuggestedActions(type: InterviewType): string[] {
  if (type === "project_creation") {
    return [
      "Review and refine project description",
      "Link relevant repositories",
      "Create initial packets for development"
    ]
  }
  return ["Review interview notes", "Follow up if needed"]
}

function extractProjectData(content: string): Record<string, unknown> {
  // Basic pattern matching for project data
  const data: Record<string, unknown> = {}

  // Look for tech stack mentions
  const techPatterns = [
    /react/i, /next\.?js/i, /node/i, /python/i, /typescript/i,
    /postgresql/i, /mongodb/i, /redis/i, /docker/i
  ]
  const tech = techPatterns
    .filter(p => p.test(content))
    .map(p => p.source.replace(/\\|\./g, ""))
  if (tech.length > 0) {
    data.techStack = tech
  }

  // Extract priority hints
  if (/urgent|asap|critical|priority/i.test(content)) {
    data.priority = "high"
  } else if (/eventually|when.*time|low priority/i.test(content)) {
    data.priority = "low"
  } else {
    data.priority = "medium"
  }

  return data
}
