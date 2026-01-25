"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"

interface WordCloudWord {
  text: string
  weight: number
  category?: string
  onClick?: () => void
}

interface WordCloudProps {
  words: WordCloudWord[]
  className?: string
  maxFontSize?: number
  minFontSize?: number
  colors?: string[]
}

export function WordCloud({
  words,
  className,
  maxFontSize = 48,
  minFontSize = 14,
  colors = [
    "text-blue-500",
    "text-purple-500",
    "text-emerald-500",
    "text-amber-500",
    "text-rose-500",
    "text-cyan-500",
    "text-indigo-500",
    "text-teal-500"
  ]
}: WordCloudProps) {
  const processedWords = useMemo(() => {
    if (words.length === 0) return []

    const maxWeight = Math.max(...words.map(w => w.weight))
    const minWeight = Math.min(...words.map(w => w.weight))
    const weightRange = maxWeight - minWeight || 1

    // Shuffle words for visual interest
    const shuffled = [...words].sort(() => Math.random() - 0.5)

    return shuffled.map((word, index) => {
      const normalizedWeight = (word.weight - minWeight) / weightRange
      const fontSize = minFontSize + (normalizedWeight * (maxFontSize - minFontSize))
      const colorClass = colors[index % colors.length]

      return {
        ...word,
        fontSize: Math.round(fontSize),
        colorClass,
        opacity: 0.6 + (normalizedWeight * 0.4)
      }
    })
  }, [words, maxFontSize, minFontSize, colors])

  if (words.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-48 text-muted-foreground", className)}>
        No ideas to display yet
      </div>
    )
  }

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-3 p-6", className)}>
      {processedWords.map((word, index) => (
        <button
          key={`${word.text}-${index}`}
          onClick={word.onClick}
          disabled={!word.onClick}
          className={cn(
            "transition-all duration-200 font-medium",
            word.colorClass,
            word.onClick && "hover:scale-110 cursor-pointer hover:brightness-110",
            !word.onClick && "cursor-default"
          )}
          style={{
            fontSize: `${word.fontSize}px`,
            opacity: word.opacity,
            lineHeight: 1.2
          }}
          title={word.category ? `${word.text} (${word.category})` : word.text}
        >
          {word.text}
        </button>
      ))}
    </div>
  )
}

// Helper to convert ideas to word cloud format
export function ideasToWordCloud(
  ideas: Array<{ id: string; label?: string; title?: string; category?: string }>,
  onSelect?: (id: string) => void
): WordCloudWord[] {
  return ideas.map((idea, index) => ({
    text: idea.label || idea.title || idea.id,
    weight: 1 + Math.random() * 2, // Slight randomization for visual interest
    category: idea.category,
    onClick: onSelect ? () => onSelect(idea.id) : undefined
  }))
}

// Animated version for exploration stages
export function AnimatedWordCloud({
  words,
  className,
  selectedIds = [],
  onSelect
}: {
  words: WordCloudWord[]
  className?: string
  selectedIds?: string[]
  onSelect?: (text: string) => void
}) {
  const processedWords = useMemo(() => {
    const maxWeight = Math.max(...words.map(w => w.weight), 1)
    const minWeight = Math.min(...words.map(w => w.weight), 0)
    const weightRange = maxWeight - minWeight || 1

    return words.map((word, index) => {
      const normalizedWeight = (word.weight - minWeight) / weightRange
      const fontSize = 14 + (normalizedWeight * 32)
      const isSelected = selectedIds.includes(word.text)

      return {
        ...word,
        fontSize: Math.round(fontSize),
        isSelected
      }
    })
  }, [words, selectedIds])

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-2 p-4", className)}>
      {processedWords.map((word, index) => (
        <button
          key={`${word.text}-${index}`}
          onClick={() => onSelect?.(word.text)}
          className={cn(
            "px-3 py-1 rounded-full transition-all duration-300 font-medium",
            word.isSelected
              ? "bg-primary text-primary-foreground scale-110 shadow-lg"
              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-105"
          )}
          style={{
            fontSize: `${word.fontSize}px`,
            animationDelay: `${index * 50}ms`
          }}
        >
          {word.text}
        </button>
      ))}
    </div>
  )
}
