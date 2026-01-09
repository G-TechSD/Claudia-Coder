"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import {
  MessageSquare,
  Send,
  Mic,
  MicOff,
  Loader2,
  Bot,
  User,
  CheckCircle,
  AlertCircle,
  SkipForward,
  Play,
  Square,
  ClipboardCheck,
  HelpCircle,
  Target,
  Users,
  DollarSign,
  Zap,
  Building2,
  TrendingUp
} from "lucide-react"
import type { BusinessIdea } from "@/lib/data/business-ideas"
import type { ExecutiveSummaryData } from "./executive-summary"

// Interview question categories
type QuestionCategory =
  | "problem"
  | "customer"
  | "solution"
  | "market"
  | "competition"
  | "revenue"
  | "execution"
  | "validation"

interface InterviewQuestion {
  id: string
  category: QuestionCategory
  question: string
  followUp?: string
  hint?: string
  required: boolean
}

interface InterviewAnswer {
  questionId: string
  answer: string
  timestamp: string
  skipped: boolean
}

interface InterviewMessage {
  id: string
  role: "assistant" | "user"
  content: string
  timestamp: string
  questionId?: string
  isFollowUp?: boolean
}

interface ViabilityInsights {
  problemValidation: {
    score: number
    insights: string[]
    gaps: string[]
  }
  customerUnderstanding: {
    score: number
    insights: string[]
    gaps: string[]
  }
  solutionFit: {
    score: number
    insights: string[]
    gaps: string[]
  }
  marketOpportunity: {
    score: number
    insights: string[]
    gaps: string[]
  }
  competitivePosition: {
    score: number
    insights: string[]
    gaps: string[]
  }
  revenueClarity: {
    score: number
    insights: string[]
    gaps: string[]
  }
  executionReadiness: {
    score: number
    insights: string[]
    gaps: string[]
  }
  overallViability: number
  recommendations: string[]
  criticalGaps: string[]
}

interface ViabilityInterviewProps {
  idea: BusinessIdea
  executiveSummary?: ExecutiveSummaryData | null
  onComplete: (insights: ViabilityInsights, answers: InterviewAnswer[]) => void
  onUpdate?: (field: string, value: unknown) => void
}

// Core interview questions that help fill in gaps
const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  // Problem Validation
  {
    id: "problem-1",
    category: "problem",
    question: "What specific problem are you solving, and how do people currently deal with it?",
    hint: "Be specific about the pain point and existing workarounds",
    required: true
  },
  {
    id: "problem-2",
    category: "problem",
    question: "How did you discover this problem? Do you have personal experience with it?",
    hint: "First-hand experience often leads to better solutions",
    required: false
  },
  // Customer Understanding
  {
    id: "customer-1",
    category: "customer",
    question: "Describe your ideal customer in detail. What's their day like? What frustrates them?",
    hint: "Think about demographics, behaviors, and motivations",
    required: true
  },
  {
    id: "customer-2",
    category: "customer",
    question: "Have you talked to potential customers? What did they say about this problem?",
    hint: "Customer conversations are invaluable for validation",
    required: true
  },
  {
    id: "customer-3",
    category: "customer",
    question: "How would you reach these customers? Where do they hang out online/offline?",
    hint: "Think about marketing channels and community presence",
    required: false
  },
  // Solution Fit
  {
    id: "solution-1",
    category: "solution",
    question: "Why is your solution better than what exists today? What's your unique angle?",
    hint: "Focus on differentiation and unique value",
    required: true
  },
  {
    id: "solution-2",
    category: "solution",
    question: "What's the simplest version of this you could build to test the idea?",
    hint: "Think MVP - minimum viable product",
    required: true
  },
  // Market Opportunity
  {
    id: "market-1",
    category: "market",
    question: "How big is this market? Are there similar businesses you can point to?",
    hint: "Market size helps determine growth potential",
    required: false
  },
  {
    id: "market-2",
    category: "market",
    question: "Is this market growing, shrinking, or stable? What trends support your idea?",
    hint: "Riding a wave is easier than fighting against one",
    required: false
  },
  // Competition
  {
    id: "competition-1",
    category: "competition",
    question: "Who are your main competitors? What do they do well and poorly?",
    hint: "No competition can be a warning sign - it may mean no market",
    required: true
  },
  {
    id: "competition-2",
    category: "competition",
    question: "Why would someone choose you over the competition?",
    hint: "Be honest about your advantages and disadvantages",
    required: false
  },
  // Revenue Model
  {
    id: "revenue-1",
    category: "revenue",
    question: "How will you make money? What will you charge and why?",
    hint: "Consider pricing models: subscription, one-time, freemium, etc.",
    required: true
  },
  {
    id: "revenue-2",
    category: "revenue",
    question: "How much would a customer pay over their lifetime? How much does it cost to acquire them?",
    hint: "LTV > CAC is essential for sustainability",
    required: false
  },
  // Execution
  {
    id: "execution-1",
    category: "execution",
    question: "What skills or resources do you have to build this? What's missing?",
    hint: "Be realistic about your capabilities and gaps",
    required: true
  },
  {
    id: "execution-2",
    category: "execution",
    question: "What would you do in the next 30 days to move this forward?",
    hint: "Concrete next steps show commitment and clarity",
    required: true
  },
  // Validation
  {
    id: "validation-1",
    category: "validation",
    question: "How would you know if this idea is working? What metrics matter most?",
    hint: "Think about leading indicators of success",
    required: false
  },
  {
    id: "validation-2",
    category: "validation",
    question: "What would make you abandon this idea? What's the kill criteria?",
    hint: "Knowing when to quit is as important as knowing when to push",
    required: false
  }
]

const CATEGORY_CONFIG: Record<QuestionCategory, {
  label: string
  icon: typeof MessageSquare
  color: string
}> = {
  problem: { label: "Problem", icon: AlertCircle, color: "text-red-400" },
  customer: { label: "Customer", icon: Users, color: "text-blue-400" },
  solution: { label: "Solution", icon: Zap, color: "text-yellow-400" },
  market: { label: "Market", icon: TrendingUp, color: "text-green-400" },
  competition: { label: "Competition", icon: Target, color: "text-purple-400" },
  revenue: { label: "Revenue", icon: DollarSign, color: "text-emerald-400" },
  execution: { label: "Execution", icon: Building2, color: "text-orange-400" },
  validation: { label: "Validation", icon: ClipboardCheck, color: "text-cyan-400" }
}

export function ViabilityInterview({
  idea,
  executiveSummary,
  onComplete,
  onUpdate
}: ViabilityInterviewProps) {
  const [isActive, setIsActive] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [messages, setMessages] = useState<InterviewMessage[]>([])
  const [answers, setAnswers] = useState<InterviewAnswer[]>([])
  const [input, setInput] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [insights, setInsights] = useState<ViabilityInsights | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Determine which questions to ask based on gaps in executive summary
  const [questionsToAsk, setQuestionsToAsk] = useState<InterviewQuestion[]>([])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Analyze gaps and determine questions on mount
  useEffect(() => {
    const questions = determineQuestionsFromGaps(idea, executiveSummary)
    setQuestionsToAsk(questions)
  }, [idea, executiveSummary])

  // Determine which questions are needed based on gaps
  function determineQuestionsFromGaps(
    idea: BusinessIdea,
    summary?: ExecutiveSummaryData | null
  ): InterviewQuestion[] {
    const neededQuestions: InterviewQuestion[] = []

    // Check for gaps in problem understanding
    if (!idea.problemStatement || idea.problemStatement.length < 50) {
      neededQuestions.push(...INTERVIEW_QUESTIONS.filter(q => q.category === "problem"))
    }

    // Check for gaps in customer understanding
    if (!idea.targetAudience || idea.targetAudience.length < 50) {
      neededQuestions.push(...INTERVIEW_QUESTIONS.filter(q => q.category === "customer"))
    }

    // Check for gaps in solution clarity
    if (!idea.valueProposition || idea.valueProposition.length < 50) {
      neededQuestions.push(...INTERVIEW_QUESTIONS.filter(q => q.category === "solution"))
    }

    // Check market understanding from executive summary
    if (!summary?.marketAnalysis?.marketSize || summary.marketAnalysis.marketSize.length < 30) {
      neededQuestions.push(...INTERVIEW_QUESTIONS.filter(q => q.category === "market"))
    }

    // Check competitive understanding
    if (!idea.competitiveAdvantage || idea.competitiveAdvantage.length < 30) {
      neededQuestions.push(...INTERVIEW_QUESTIONS.filter(q => q.category === "competition"))
    }

    // Check revenue model
    if (!idea.revenueModel || idea.revenueModel.length < 30) {
      neededQuestions.push(...INTERVIEW_QUESTIONS.filter(q => q.category === "revenue"))
    }

    // Always include execution and validation questions
    neededQuestions.push(...INTERVIEW_QUESTIONS.filter(q => q.category === "execution"))
    neededQuestions.push(...INTERVIEW_QUESTIONS.filter(q => q.category === "validation" && q.required))

    // Remove duplicates and return
    const uniqueQuestions = neededQuestions.filter(
      (q, i, arr) => arr.findIndex(x => x.id === q.id) === i
    )

    // If we have very few questions, add some optional ones for depth
    if (uniqueQuestions.length < 5) {
      const optionalQuestions = INTERVIEW_QUESTIONS.filter(
        q => !q.required && !uniqueQuestions.find(u => u.id === q.id)
      ).slice(0, 3)
      return [...uniqueQuestions, ...optionalQuestions]
    }

    return uniqueQuestions
  }

  // Start the interview
  const startInterview = useCallback(() => {
    if (questionsToAsk.length === 0) {
      // No gaps to fill
      const defaultInsights: ViabilityInsights = {
        problemValidation: { score: 8, insights: ["Well defined"], gaps: [] },
        customerUnderstanding: { score: 8, insights: ["Clear audience"], gaps: [] },
        solutionFit: { score: 8, insights: ["Good fit"], gaps: [] },
        marketOpportunity: { score: 7, insights: ["Promising market"], gaps: [] },
        competitivePosition: { score: 7, insights: ["Clear positioning"], gaps: [] },
        revenueClarity: { score: 7, insights: ["Model defined"], gaps: [] },
        executionReadiness: { score: 6, insights: ["Ready to start"], gaps: ["Validate assumptions"] },
        overallViability: 75,
        recommendations: ["Proceed to validation phase", "Build MVP to test core assumptions"],
        criticalGaps: []
      }
      setInsights(defaultInsights)
      return
    }

    setIsActive(true)
    setCurrentQuestionIndex(0)

    // Add intro message
    const introMessage: InterviewMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: `Great! Let's dive deeper into "${idea.title}" to validate its viability. I'll ask you ${questionsToAsk.length} questions to fill in some gaps and strengthen your business case.\n\nTake your time with each answer - the more detail you provide, the better insights I can offer.\n\nReady? Let's start!`,
      timestamp: new Date().toISOString()
    }

    // Add first question
    const firstQuestion = questionsToAsk[0]
    const questionMessage: InterviewMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: firstQuestion.question + (firstQuestion.hint ? `\n\n*Hint: ${firstQuestion.hint}*` : ""),
      timestamp: new Date().toISOString(),
      questionId: firstQuestion.id
    }

    setMessages([introMessage, questionMessage])
  }, [questionsToAsk, idea.title])

  // Handle user response
  const handleResponse = useCallback(async () => {
    if (!input.trim() || isProcessing) return

    const currentQuestion = questionsToAsk[currentQuestionIndex]
    if (!currentQuestion) return

    setIsProcessing(true)

    // Add user message
    const userMessage: InterviewMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString()
    }
    setMessages(prev => [...prev, userMessage])

    // Record answer
    const answer: InterviewAnswer = {
      questionId: currentQuestion.id,
      answer: input.trim(),
      timestamp: new Date().toISOString(),
      skipped: false
    }
    setAnswers(prev => [...prev, answer])

    setInput("")

    // Generate acknowledgment and move to next question
    await new Promise(resolve => setTimeout(resolve, 500))

    const acknowledgments = [
      "Great insight!",
      "That's helpful context.",
      "I see, that makes sense.",
      "Good to know!",
      "Thanks for sharing that.",
      "Interesting perspective!"
    ]
    const ack = acknowledgments[Math.floor(Math.random() * acknowledgments.length)]

    const nextIndex = currentQuestionIndex + 1

    if (nextIndex >= questionsToAsk.length) {
      // Interview complete
      const completeMessage: InterviewMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `${ack}\n\nThat's all the questions I have. Let me analyze your responses and generate viability insights...`,
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, completeMessage])

      // Generate insights
      await generateInsights([...answers, answer])
    } else {
      // Next question
      const nextQuestion = questionsToAsk[nextIndex]
      const nextMessage: InterviewMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `${ack}\n\n${nextQuestion.question}${nextQuestion.hint ? `\n\n*Hint: ${nextQuestion.hint}*` : ""}`,
        timestamp: new Date().toISOString(),
        questionId: nextQuestion.id
      }
      setMessages(prev => [...prev, nextMessage])
      setCurrentQuestionIndex(nextIndex)
    }

    setIsProcessing(false)
  }, [input, isProcessing, currentQuestionIndex, questionsToAsk, answers])

  // Skip current question
  const skipQuestion = useCallback(() => {
    const currentQuestion = questionsToAsk[currentQuestionIndex]
    if (!currentQuestion) return

    // Record skipped answer
    const answer: InterviewAnswer = {
      questionId: currentQuestion.id,
      answer: "",
      timestamp: new Date().toISOString(),
      skipped: true
    }
    setAnswers(prev => [...prev, answer])

    const nextIndex = currentQuestionIndex + 1

    if (nextIndex >= questionsToAsk.length) {
      // Complete interview
      generateInsights([...answers, answer])
    } else {
      // Next question
      const nextQuestion = questionsToAsk[nextIndex]
      const skipMessage: InterviewMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `No problem, let's move on.\n\n${nextQuestion.question}${nextQuestion.hint ? `\n\n*Hint: ${nextQuestion.hint}*` : ""}`,
        timestamp: new Date().toISOString(),
        questionId: nextQuestion.id
      }
      setMessages(prev => [...prev, skipMessage])
      setCurrentQuestionIndex(nextIndex)
    }
  }, [currentQuestionIndex, questionsToAsk, answers])

  // Generate insights from answers
  const generateInsights = async (allAnswers: InterviewAnswer[]) => {
    setIsProcessing(true)

    try {
      // Call API to analyze answers
      const response = await fetch("/api/business/executive-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ideaId: idea.id,
          title: idea.title,
          summary: idea.summary,
          problemStatement: idea.problemStatement,
          targetAudience: idea.targetAudience,
          valueProposition: idea.valueProposition,
          revenueModel: idea.revenueModel,
          competitiveAdvantage: idea.competitiveAdvantage,
          tags: idea.tags,
          chatContext: allAnswers.filter(a => !a.skipped).map(a => {
            const q = INTERVIEW_QUESTIONS.find(q => q.id === a.questionId)
            return `Q: ${q?.question || "Unknown"}\nA: ${a.answer}`
          }).join("\n\n")
        })
      })

      // For now, generate local insights based on answer analysis
      const insights = analyzeAnswers(allAnswers)
      setInsights(insights)

      // Add completion message
      const insightMessage: InterviewMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Analysis complete!\n\n**Overall Viability Score: ${insights.overallViability}%**\n\n${insights.recommendations.slice(0, 3).map((r, i) => `${i + 1}. ${r}`).join("\n")}`,
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, insightMessage])

      // Complete the interview
      onComplete(insights, allAnswers)
      setIsActive(false)

    } catch (error) {
      console.error("Failed to generate insights:", error)
      // Generate fallback insights
      const fallbackInsights = analyzeAnswers(allAnswers)
      setInsights(fallbackInsights)
      onComplete(fallbackInsights, allAnswers)
      setIsActive(false)
    } finally {
      setIsProcessing(false)
    }
  }

  // Analyze answers locally (fallback/supplement to API)
  function analyzeAnswers(allAnswers: InterviewAnswer[]): ViabilityInsights {
    const answersByCategory: Record<QuestionCategory, InterviewAnswer[]> = {
      problem: [],
      customer: [],
      solution: [],
      market: [],
      competition: [],
      revenue: [],
      execution: [],
      validation: []
    }

    // Group answers by category
    for (const answer of allAnswers) {
      const question = INTERVIEW_QUESTIONS.find(q => q.id === answer.questionId)
      if (question) {
        answersByCategory[question.category].push(answer)
      }
    }

    // Score each category
    function scoreCategory(answers: InterviewAnswer[]): { score: number; insights: string[]; gaps: string[] } {
      if (answers.length === 0) {
        return { score: 5, insights: [], gaps: ["No information provided"] }
      }

      const answered = answers.filter(a => !a.skipped)
      const avgLength = answered.reduce((sum, a) => sum + a.answer.length, 0) / (answered.length || 1)

      let score = 5
      const insights: string[] = []
      const gaps: string[] = []

      // Score based on response depth
      if (avgLength > 200) {
        score += 3
        insights.push("Detailed responses provided")
      } else if (avgLength > 100) {
        score += 2
        insights.push("Good level of detail")
      } else if (avgLength > 50) {
        score += 1
      } else {
        gaps.push("Could use more detail")
      }

      // Penalize skipped questions
      const skippedCount = answers.filter(a => a.skipped).length
      if (skippedCount > 0) {
        score -= skippedCount
        gaps.push(`${skippedCount} question(s) skipped`)
      }

      // Clamp score
      score = Math.max(1, Math.min(10, score))

      return { score, insights, gaps }
    }

    const categories = {
      problemValidation: scoreCategory(answersByCategory.problem),
      customerUnderstanding: scoreCategory(answersByCategory.customer),
      solutionFit: scoreCategory(answersByCategory.solution),
      marketOpportunity: scoreCategory(answersByCategory.market),
      competitivePosition: scoreCategory(answersByCategory.competition),
      revenueClarity: scoreCategory(answersByCategory.revenue),
      executionReadiness: scoreCategory(answersByCategory.execution)
    }

    // Calculate overall viability
    const scores = Object.values(categories).map(c => c.score)
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length
    const overallViability = Math.round(avgScore * 10)

    // Generate recommendations
    const recommendations: string[] = []
    const criticalGaps: string[] = []

    if (categories.problemValidation.score < 6) {
      criticalGaps.push("Problem definition needs more clarity")
      recommendations.push("Conduct more customer interviews to validate the problem")
    }
    if (categories.customerUnderstanding.score < 6) {
      criticalGaps.push("Target customer needs better definition")
      recommendations.push("Create detailed customer personas")
    }
    if (categories.solutionFit.score < 6) {
      recommendations.push("Refine the value proposition with more specificity")
    }
    if (categories.revenueClarity.score < 6) {
      recommendations.push("Develop a clearer pricing strategy")
    }
    if (categories.executionReadiness.score < 6) {
      recommendations.push("Create a 30-60-90 day action plan")
    }

    // Add positive recommendations if doing well
    if (overallViability >= 70) {
      recommendations.unshift("Strong foundation - proceed to MVP development")
    } else if (overallViability >= 50) {
      recommendations.unshift("Promising idea - address key gaps before building")
    } else {
      recommendations.unshift("Needs more validation before significant investment")
    }

    return {
      ...categories,
      overallViability,
      recommendations,
      criticalGaps
    }
  }

  // Toggle voice input
  const toggleVoice = () => {
    setIsListening(!isListening)
    // Voice integration would connect here
  }

  // Calculate progress
  const progress = questionsToAsk.length > 0
    ? Math.round((currentQuestionIndex / questionsToAsk.length) * 100)
    : 0

  // Not started yet
  if (!isActive && !insights) {
    const gapCount = questionsToAsk.length
    const categories = [...new Set(questionsToAsk.map(q => q.category))]

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Viability Interview
          </CardTitle>
          <CardDescription>
            Answer a few questions to strengthen your business case
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 space-y-3">
            <p className="text-sm">
              Based on your executive summary, I've identified <strong>{gapCount} questions</strong> that
              will help fill in gaps and validate your idea.
            </p>

            {categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {categories.map(cat => {
                  const config = CATEGORY_CONFIG[cat]
                  const Icon = config.icon
                  return (
                    <Badge key={cat} variant="outline" className="flex items-center gap-1">
                      <Icon className={cn("h-3 w-3", config.color)} />
                      {config.label}
                    </Badge>
                  )
                })}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Estimated time: {Math.ceil(gapCount * 1.5)} minutes
            </p>
          </div>

          <Button onClick={startInterview} className="w-full">
            <Play className="h-4 w-4 mr-2" />
            Start Viability Interview
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Show insights after completion
  if (insights && !isActive) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-400" />
            Viability Assessment Complete
          </CardTitle>
          <CardDescription>
            Based on your responses, here's the analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Overall Score */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div>
              <p className="text-sm text-muted-foreground">Overall Viability</p>
              <p className={cn(
                "text-3xl font-bold",
                insights.overallViability >= 70 ? "text-green-400" :
                insights.overallViability >= 50 ? "text-yellow-400" : "text-red-400"
              )}>
                {insights.overallViability}%
              </p>
            </div>
            <div className="w-24 h-24">
              <Progress
                value={insights.overallViability}
                className="h-3"
              />
            </div>
          </div>

          {/* Category Scores */}
          <div className="grid grid-cols-2 gap-3">
            {Object.entries({
              problemValidation: "Problem",
              customerUnderstanding: "Customer",
              solutionFit: "Solution",
              marketOpportunity: "Market",
              competitivePosition: "Competition",
              revenueClarity: "Revenue",
              executionReadiness: "Execution"
            }).map(([key, label]) => {
              const data = insights[key as keyof typeof insights] as { score: number; insights: string[]; gaps: string[] }
              return (
                <div key={key} className="flex items-center justify-between p-2 rounded border">
                  <span className="text-sm">{label}</span>
                  <Badge variant={data.score >= 7 ? "default" : data.score >= 5 ? "secondary" : "destructive"}>
                    {data.score}/10
                  </Badge>
                </div>
              )
            })}
          </div>

          {/* Critical Gaps */}
          {insights.criticalGaps.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-400" />
                Critical Gaps
              </h4>
              <ul className="space-y-1">
                {insights.criticalGaps.map((gap, i) => (
                  <li key={i} className="text-sm text-muted-foreground">- {gap}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-400" />
              Recommendations
            </h4>
            <ul className="space-y-1">
              {insights.recommendations.map((rec, i) => (
                <li key={i} className="text-sm">
                  <span className="text-muted-foreground mr-2">{i + 1}.</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>

          {/* Restart Interview */}
          <Button variant="outline" onClick={() => {
            setInsights(null)
            setMessages([])
            setAnswers([])
            setCurrentQuestionIndex(0)
          }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retake Interview
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Active interview
  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-400" />
            Viability Interview
          </CardTitle>
          <Badge variant="outline">
            {currentQuestionIndex + 1} / {questionsToAsk.length}
          </Badge>
        </div>
        <Progress value={progress} className="h-1" />
      </CardHeader>

      <CardContent className="flex-1 flex flex-col overflow-hidden p-3">
        {/* Messages */}
        <div className="flex-1 overflow-auto space-y-3 mb-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-2",
                msg.role === "user" && "flex-row-reverse"
              )}
            >
              <div className={cn(
                "h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0",
                msg.role === "user" ? "bg-primary" : "bg-muted"
              )}>
                {msg.role === "user" ? (
                  <User className="h-3 w-3 text-primary-foreground" />
                ) : (
                  <Bot className="h-3 w-3" />
                )}
              </div>
              <div className={cn(
                "max-w-[85%] rounded-xl px-3 py-2",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              )}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {isProcessing && (
            <div className="flex gap-2">
              <div className="h-7 w-7 rounded-full flex items-center justify-center bg-muted">
                <Bot className="h-3 w-3" />
              </div>
              <div className="bg-muted rounded-xl px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleVoice}
              className={cn(isListening && "bg-red-500 text-white border-red-500")}
            >
              {isListening ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your answer..."
              className="min-h-[60px] resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleResponse()
                }
              }}
            />
            <div className="flex flex-col gap-1">
              <Button
                size="icon"
                onClick={handleResponse}
                disabled={isProcessing || !input.trim()}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={skipQuestion}
                disabled={isProcessing}
                title="Skip this question"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsActive(false)
                setMessages([])
                setAnswers([])
                setCurrentQuestionIndex(0)
              }}
            >
              <Square className="h-3 w-3 mr-1" />
              End Interview
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Missing import
import { Lightbulb, RefreshCw } from "lucide-react"
