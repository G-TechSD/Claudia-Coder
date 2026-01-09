/**
 * Interview Engine
 * Manages interview sessions, generates questions, and extracts insights
 * Now with real LLM integration via Claude API
 */

import type {
  InterviewSession,
  InterviewMessage,
  InterviewType,
  InterviewTargetType
} from "@/lib/data/types"
import { buildInterviewContext, PROJECT_CREATION_SYSTEM_PROMPT } from "./prompts"
import { generateInterviewQuestion, extractInterviewInsights } from "@/lib/llm/anthropic"

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
 * Generate the next question using Claude LLM
 */
export async function generateNextQuestion(
  session: InterviewSession,
  userResponse: string
): Promise<string> {
  // Check for voice commands first
  const lowerResponse = userResponse.toLowerCase().trim()
  if (lowerResponse === "skip" || lowerResponse === "next") {
    return generateSkipResponse(session)
  }
  if (lowerResponse === "done" || lowerResponse === "finish" || lowerResponse === "end") {
    return "Perfect, I think we have a good picture now. Is there anything else you'd like to add before I put together a summary?"
  }

  // Build system prompt based on interview type
  const { systemPrompt } = buildInterviewContext(
    session.type,
    session.targetType,
    session.targetContext
  )

  // Convert messages for the LLM
  const messages = session.messages.map(m => ({
    role: m.role as "user" | "assistant",
    content: m.content
  }))

  // Try LLM first
  try {
    const response = await generateInterviewQuestion({
      systemPrompt,
      messages,
      context: session.targetContext
    })

    if (response.question && !response.error) {
      return response.question
    }

    // Fall back to local generation on error
    console.warn("LLM error, using fallback:", response.error)
    return generateFallbackQuestion(session, userResponse)
  } catch (error) {
    console.error("LLM call failed:", error)
    return generateFallbackQuestion(session, userResponse)
  }
}

function generateSkipResponse(session: InterviewSession): string {
  const questionCount = session.messages.filter(m => m.role === "assistant").length

  if (questionCount < 5) {
    return "No problem! Let's talk about what features are most important to you."
  }
  if (questionCount < 10) {
    return "Okay, moving on. Is there anything specific about the technical approach you'd like to discuss?"
  }
  return "Got it. We're getting close to wrapping up - anything else on your mind?"
}

function generateFallbackQuestion(session: InterviewSession, userResponse: string): string {
  const questionCount = session.messages.filter(m => m.role === "assistant").length
  const userMessages = session.messages.filter(m => m.role === "user")
  const allContent = userMessages.map(m => m.content.toLowerCase()).join(" ")
  const lastResponse = userResponse.toLowerCase()

  // Broader pattern matching - recognize when a topic has been discussed even indirectly
  const discussed = {
    users: /users?|audience|customers?|people|who|fans?|players?|members?|visitors?|employees?|clients?|everyone|anyone|somebody|teams?|groups?|individuals?/i.test(allContent),
    features: /features?|functionality|capability|do|does|can|will|should|want|need|show|display|track|manage|create|edit|delete|view|search|filter|sort|export|import|share|notify|alert|report/i.test(allContent),
    tech: /tech|stack|framework|language|react|node|python|database|server|cloud|aws|api|rest|graphql|mobile|web|app|backend|frontend|full.?stack/i.test(allContent),
    scale: /scale|size|traffic|performance|big|large|many|thousand|million|growth|handle|capacity|load|concurrent/i.test(allContent),
    timeline: /time|deadline|when|schedule|weeks?|months?|urgent|asap|soon|priority|mvp|launch|release|phase/i.test(allContent),
    integration: /integrat|api|connect|sync|service|third.?party|external|webhook|oauth|auth|payment|stripe|email|notification/i.test(allContent),
    data: /data|store|save|persist|database|storage|backup|import|export|migrate|sync/i.test(allContent),
    security: /secure|security|auth|login|password|permission|role|access|encrypt|private|protect/i.test(allContent),
    monetization: /monetiz|money|revenue|income|paid|free|premium|subscription|pricing|charge|ads?|advertis|business model|profit|earn|sell/i.test(allContent)
  }

  // Count how many topics have been discussed
  const topicsDiscussed = Object.values(discussed).filter(Boolean).length

  // Varied follow-up questions based on what user just said
  const followUpQuestions = [
    "That's interesting! Can you tell me more about that specific aspect?",
    "I'd love to understand that better - what made you decide on that approach?",
    "Great point! How do you see that working in practice?",
    "That makes sense. What would make that experience exceptional?",
    "Interesting! Are there any specific examples or inspirations you're drawing from?"
  ]

  // If we've already discussed most topics, move to wrap-up
  if (topicsDiscussed >= 4 || questionCount >= 8) {
    const wrapUpQuestions = [
      "We've covered a lot of ground! What's the single most critical thing that needs to work perfectly?",
      "Based on everything we've discussed, what would you consider the MVP - the minimum to launch?",
      "Is there anything we haven't touched on that's important to you?",
      "What would success look like six months after launch?",
      "Any concerns or risks you'd like to make sure we address?"
    ]
    return wrapUpQuestions[questionCount % wrapUpQuestions.length]
  }

  // Smart topic progression - pick topics not yet discussed
  const topicQuestions: Array<{ check: boolean; questions: string[] }> = [
    {
      check: !discussed.users,
      questions: [
        "Who's the primary audience for this? Tell me about your ideal user.",
        "Who do you envision using this the most?",
        "Paint me a picture of your target user - what's their day like?"
      ]
    },
    {
      check: !discussed.features,
      questions: [
        "What are the must-have features for the first version?",
        "If you could only ship three things, what would they be?",
        "What's the core experience you want users to have?"
      ]
    },
    {
      check: !discussed.tech,
      questions: [
        "Do you have any technical preferences or constraints?",
        "Any specific technologies you'd like to use or avoid?",
        "Should I recommend a tech stack based on what we've discussed?"
      ]
    },
    {
      check: !discussed.scale,
      questions: [
        "How big do you expect this to get? Hundreds of users? Thousands? More?",
        "What kind of growth are you anticipating?",
        "Should we design for scale from the start or start simple?"
      ]
    },
    {
      check: !discussed.integration,
      questions: [
        "Will this need to connect with any existing systems?",
        "Any third-party services or APIs you'd like to integrate?",
        "How does this fit into your existing ecosystem?"
      ]
    },
    {
      check: !discussed.timeline,
      questions: [
        "What's your timeline looking like?",
        "Any key milestones or deadlines to be aware of?",
        "When would you ideally like to see this live?"
      ]
    },
    {
      check: !discussed.monetization,
      questions: [
        "Do you plan to monetize this app? If so, how?",
        "Is this a passion project or are you thinking about revenue?",
        "Any business model in mind - free, freemium, subscription?",
        "Will users pay for this, or is it free?"
      ]
    }
  ]

  // Find next undiscussed topic
  for (const topic of topicQuestions) {
    if (topic.check) {
      return topic.questions[Math.floor(Math.random() * topic.questions.length)]
    }
  }

  // Default: contextual follow-up
  return followUpQuestions[Math.floor(Math.random() * followUpQuestions.length)]
}

// ============ Insight Extraction ============

/**
 * Extract structured insights from the interview using Claude
 */
export async function extractInsights(session: InterviewSession): Promise<{
  summary: string
  keyPoints: string[]
  suggestedActions: string[]
  extractedData: Record<string, unknown>
}> {
  // Build content from messages
  const content = session.messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n")

  // Try LLM extraction
  try {
    const response = await extractInterviewInsights({
      systemPrompt: PROJECT_CREATION_SYSTEM_PROMPT,
      content,
      type: session.type
    })

    if (!response.error) {
      return {
        summary: response.summary || generateFallbackSummary(session),
        keyPoints: response.keyPoints.length > 0 ? response.keyPoints : extractFallbackKeyPoints(session),
        suggestedActions: response.suggestedActions.length > 0 ? response.suggestedActions : generateFallbackActions(session),
        extractedData: response.extractedData || {}
      }
    }

    console.warn("LLM extraction error, using fallback:", response.error)
  } catch (error) {
    console.error("LLM extraction failed:", error)
  }

  // Fallback extraction
  return {
    summary: generateFallbackSummary(session),
    keyPoints: extractFallbackKeyPoints(session),
    suggestedActions: generateFallbackActions(session),
    extractedData: extractFallbackProjectData(session)
  }
}

function generateFallbackSummary(session: InterviewSession): string {
  const userMessages = session.messages.filter(m => m.role === "user")
  const wordCount = userMessages.map(m => m.content).join(" ").split(/\s+/).length

  return `Interview completed with ${userMessages.length} responses covering project goals, features, and requirements. Total input: approximately ${wordCount} words.`
}

function extractFallbackKeyPoints(session: InterviewSession): string[] {
  const points: string[] = []
  const content = session.messages.filter(m => m.role === "user").map(m => m.content).join(" ")

  if (/need|must|require|essential/i.test(content)) {
    points.push("Core requirements identified")
  }
  if (/user|customer|audience/i.test(content)) {
    points.push("Target users discussed")
  }
  if (/feature|functionality/i.test(content)) {
    points.push("Key features outlined")
  }
  if (/tech|stack|framework/i.test(content)) {
    points.push("Technical preferences noted")
  }

  return points.length > 0 ? points : ["Project details captured from interview"]
}

function generateFallbackActions(session: InterviewSession): string[] {
  if (session.type === "project_creation") {
    return [
      "Review project details and create the project",
      "Set up the repository",
      "Create initial development packets"
    ]
  }
  return ["Review notes and follow up as needed"]
}

function extractFallbackProjectData(session: InterviewSession): Record<string, unknown> {
  const content = session.messages.filter(m => m.role === "user").map(m => m.content).join(" ")
  const data: Record<string, unknown> = {}

  // Extract tech stack mentions
  const techPatterns = [
    { pattern: /react/i, name: "React" },
    { pattern: /next\.?js/i, name: "Next.js" },
    { pattern: /node/i, name: "Node.js" },
    { pattern: /python/i, name: "Python" },
    { pattern: /typescript/i, name: "TypeScript" },
    { pattern: /postgresql|postgres/i, name: "PostgreSQL" },
    { pattern: /mongodb/i, name: "MongoDB" },
    { pattern: /redis/i, name: "Redis" }
  ]

  const tech = techPatterns.filter(t => t.pattern.test(content)).map(t => t.name)
  if (tech.length > 0) {
    data.techStack = tech
  }

  // Extract priority
  if (/urgent|asap|critical|priority|immediately/i.test(content)) {
    data.priority = "high"
  } else if (/eventually|someday|low priority|no rush/i.test(content)) {
    data.priority = "low"
  } else {
    data.priority = "medium"
  }

  return data
}
