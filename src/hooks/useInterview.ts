"use client"

import { useState, useCallback, useRef } from "react"
import type { InterviewSession, InterviewType, InterviewTargetType } from "@/lib/data/types"
import {
  createInterviewSession,
  addUserMessage,
  addAssistantMessage,
  markSkipped,
  completeInterview,
  cancelInterview,
  generateNextQuestion,
  extractInsights
} from "@/lib/interview/interview-engine"
import { saveInterview } from "@/lib/data/projects"

interface UseInterviewOptions {
  type: InterviewType
  targetType?: InterviewTargetType
  targetId?: string
  targetTitle?: string
  targetContext?: Record<string, unknown>
  onComplete?: (session: InterviewSession) => void
  onCancel?: (session: InterviewSession) => void
}

interface UseInterviewReturn {
  session: InterviewSession | null
  isActive: boolean
  isProcessing: boolean
  currentQuestion: string | null
  messageCount: number

  // Actions
  start: () => void
  respond: (content: string, transcribedFrom?: "voice" | "text") => Promise<void>
  skip: () => Promise<void>
  requestMore: () => Promise<void>
  finish: () => Promise<void>
  cancel: () => void
  reset: () => void
}

export function useInterview(options: UseInterviewOptions): UseInterviewReturn {
  const {
    type,
    targetType,
    targetId,
    targetTitle,
    targetContext,
    onComplete,
    onCancel
  } = options

  const [session, setSession] = useState<InterviewSession | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const sessionRef = useRef<InterviewSession | null>(null)

  // DOUBLE-RENDER FIX: Track if start has been called to prevent duplicate initialization
  const hasStartedRef = useRef(false)

  // DOUBLE-SUBMIT FIX: Track the last submitted message to prevent duplicates
  const lastSubmittedContentRef = useRef<string | null>(null)
  const isProcessingRef = useRef(false) // Synchronous flag for immediate checking

  // Keep ref in sync for async operations
  const updateSession = useCallback((newSession: InterviewSession) => {
    sessionRef.current = newSession
    setSession(newSession)
  }, [])

  const start = useCallback(() => {
    // DOUBLE-RENDER FIX: Prevent double initialization from React StrictMode
    if (hasStartedRef.current) {
      console.log("[Interview] Start already called, ignoring duplicate")
      return
    }
    hasStartedRef.current = true

    const newSession = createInterviewSession(
      type,
      targetType,
      targetId,
      targetTitle,
      targetContext
    )
    updateSession(newSession)
  }, [type, targetType, targetId, targetTitle, targetContext, updateSession])

  const respond = useCallback(async (content: string, transcribedFrom: "voice" | "text" = "text") => {
    // DOUBLE-SUBMIT FIX: Use synchronous ref check to prevent race conditions
    // State updates are async, so isProcessing might not be updated immediately
    if (!sessionRef.current || isProcessingRef.current) {
      console.log("[Interview] Ignoring respond - already processing or no session")
      return
    }

    // DOUBLE-SUBMIT FIX: Check if this exact content was just submitted
    const normalizedContent = content.trim()
    if (lastSubmittedContentRef.current === normalizedContent) {
      console.log("[Interview] Ignoring duplicate submission:", normalizedContent.substring(0, 50))
      return
    }

    // DOUBLE-SUBMIT FIX: Also check if this message already exists in history
    const existingUserMessages = sessionRef.current.messages.filter(m => m.role === "user")
    const lastUserMessage = existingUserMessages[existingUserMessages.length - 1]
    if (lastUserMessage && lastUserMessage.content === normalizedContent) {
      console.log("[Interview] Message already in history:", normalizedContent.substring(0, 50))
      return
    }

    // Set synchronous flag immediately to block concurrent calls
    isProcessingRef.current = true
    lastSubmittedContentRef.current = normalizedContent
    setIsProcessing(true)

    try {
      // Add user message
      let updatedSession = addUserMessage(sessionRef.current, content, transcribedFrom)
      updateSession(updatedSession)

      // Check if user wants to finish
      const lowerContent = content.toLowerCase().trim()
      if (lowerContent === "done" || lowerContent === "finish" || lowerContent === "end") {
        // Generate wrap-up question
        const wrapUp = "Great! Let me summarize what we've discussed. Is there anything else you'd like to add before we wrap up?"
        updatedSession = addAssistantMessage(updatedSession, wrapUp)
        updateSession(updatedSession)
        isProcessingRef.current = false
        setIsProcessing(false)
        return
      }

      // Check if this is the final confirmation
      const lastAssistant = [...updatedSession.messages]
        .reverse()
        .find(m => m.role === "assistant")
      if (lastAssistant?.content.includes("anything else") &&
          (lowerContent === "no" || lowerContent === "nope" || lowerContent === "that's it" || lowerContent === "all good")) {
        await finishInterview(updatedSession)
        return
      }

      // Generate next question
      const nextQuestion = await generateNextQuestion(updatedSession, content)
      updatedSession = addAssistantMessage(updatedSession, nextQuestion)
      updateSession(updatedSession)
    } finally {
      // Reset synchronous processing flag
      isProcessingRef.current = false
      setIsProcessing(false)
    }
  }, [updateSession])

  const skip = useCallback(async () => {
    if (!sessionRef.current || isProcessing) return

    setIsProcessing(true)
    try {
      let updatedSession = markSkipped(sessionRef.current)
      const nextQuestion = await generateNextQuestion(updatedSession, "skip")
      updatedSession = addAssistantMessage(updatedSession, nextQuestion)
      updateSession(updatedSession)
    } finally {
      setIsProcessing(false)
    }
  }, [isProcessing, updateSession])

  const requestMore = useCallback(async () => {
    if (!sessionRef.current || isProcessing) return

    setIsProcessing(true)
    try {
      const followUp = await generateNextQuestion(sessionRef.current, "tell me more")
      const updatedSession = addAssistantMessage(sessionRef.current, followUp)
      updateSession(updatedSession)
    } finally {
      setIsProcessing(false)
    }
  }, [isProcessing, updateSession])

  const finishInterview = useCallback(async (currentSession: InterviewSession) => {
    setIsProcessing(true)
    try {
      // Extract insights
      const insights = await extractInsights(currentSession)

      // Complete the session
      const completedSession = completeInterview(
        currentSession,
        insights.summary,
        insights.keyPoints,
        insights.suggestedActions,
        insights.extractedData
      )

      // Save to storage
      saveInterview(completedSession)

      updateSession(completedSession)
      onComplete?.(completedSession)
    } finally {
      setIsProcessing(false)
    }
  }, [updateSession, onComplete])

  const finish = useCallback(async () => {
    if (!sessionRef.current || isProcessing) return
    await finishInterview(sessionRef.current)
  }, [isProcessing, finishInterview])

  const cancel = useCallback(() => {
    if (!sessionRef.current) return

    const cancelledSession = cancelInterview(sessionRef.current)
    saveInterview(cancelledSession)
    updateSession(cancelledSession)
    onCancel?.(cancelledSession)
  }, [updateSession, onCancel])

  const reset = useCallback(() => {
    sessionRef.current = null
    setSession(null)
    // Reset all refs to allow fresh start
    hasStartedRef.current = false
    lastSubmittedContentRef.current = null
    isProcessingRef.current = false
    setIsProcessing(false)
  }, [])

  // Derived state
  const isActive = session?.status === "in_progress"
  const currentQuestion = session?.messages
    .filter(m => m.role === "assistant")
    .slice(-1)[0]?.content || null
  const messageCount = session?.messages.length || 0

  return {
    session,
    isActive,
    isProcessing,
    currentQuestion,
    messageCount,
    start,
    respond,
    skip,
    requestMore,
    finish,
    cancel,
    reset
  }
}
