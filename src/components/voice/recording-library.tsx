"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  type VoiceRecordingSearchResult,
  getRecordings,
  searchRecordings,
  deleteRecording,
  updateRecording,
  formatDuration as formatRecordingDuration,
  formatFileSize
} from "@/lib/data/voice-recordings-client"
import type { VoiceRecording } from "@/lib/data/types"
import {
  Play,
  Pause,
  Square,
  Trash2,
  Search,
  Tag,
  Calendar,
  Clock,
  Mic,
  FileText,
  Link2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  X,
  FolderOpen,
  Lightbulb,
  Edit2,
  Check,
  MoreVertical
} from "lucide-react"

interface RecordingLibraryProps {
  userId: string
  onRecordingSelect?: (recording: VoiceRecording) => void
  onLinkToProject?: (recording: VoiceRecording) => void
  onCreateProject?: (recording: VoiceRecording) => void
  className?: string
}

interface AudioPlayerState {
  recordingId: string | null
  isPlaying: boolean
  currentTime: number
  duration: number
}

export function RecordingLibrary({
  userId,
  onRecordingSelect,
  onLinkToProject,
  onCreateProject,
  className
}: RecordingLibraryProps) {
  const [recordings, setRecordings] = useState<VoiceRecording[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<VoiceRecordingSearchResult[] | null>(null)
  const [expandedRecordingId, setExpandedRecordingId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null)
  const [editedTitle, setEditedTitle] = useState("")

  // Audio player state
  const [playerState, setPlayerState] = useState<AudioPlayerState>({
    recordingId: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0
  })
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Load recordings on mount
  useEffect(() => {
    loadRecordings()
  }, [userId])

  const loadRecordings = useCallback(() => {
    const userRecordings = getRecordings(userId, { sortBy: "createdAt", sortOrder: "desc" })
    setRecordings(userRecordings)
  }, [userId])

  // Handle search
  useEffect(() => {
    if (searchQuery.trim()) {
      const results = searchRecordings(userId, searchQuery.trim())
      setSearchResults(results)
    } else {
      setSearchResults(null)
    }
  }, [searchQuery, userId])

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const handlePlay = async (recording: VoiceRecording) => {
    // If already playing this recording, pause it
    if (playerState.recordingId === recording.id && playerState.isPlaying) {
      audioRef.current?.pause()
      setPlayerState(prev => ({ ...prev, isPlaying: false }))
      return
    }

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause()
    }

    // Create new audio element and play
    try {
      const audio = new Audio(`/api/voice-recordings/audio/${recording.id}`)
      audioRef.current = audio

      audio.onloadedmetadata = () => {
        setPlayerState({
          recordingId: recording.id,
          isPlaying: true,
          currentTime: 0,
          duration: audio.duration
        })
      }

      audio.ontimeupdate = () => {
        setPlayerState(prev => ({
          ...prev,
          currentTime: audio.currentTime
        }))
      }

      audio.onended = () => {
        setPlayerState(prev => ({
          ...prev,
          isPlaying: false,
          currentTime: 0
        }))
      }

      audio.onerror = () => {
        console.error("Failed to load audio")
        setPlayerState({
          recordingId: null,
          isPlaying: false,
          currentTime: 0,
          duration: 0
        })
      }

      await audio.play()
    } catch (err) {
      console.error("Failed to play audio:", err)
    }
  }

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setPlayerState({
      recordingId: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0
    })
  }

  const handleDelete = async (recordingId: string) => {
    // Call API to delete the audio file
    try {
      const response = await fetch(`/api/voice-recordings/${recordingId}`, {
        method: "DELETE"
      })

      if (response.ok) {
        // Delete from local storage
        deleteRecording(recordingId)
        loadRecordings()
      }
    } catch (err) {
      console.error("Failed to delete recording:", err)
    }

    setDeleteConfirmId(null)
  }

  const handleUpdateTitle = (recordingId: string) => {
    if (editedTitle.trim()) {
      updateRecording(recordingId, { title: editedTitle.trim() })
      loadRecordings()
    }
    setEditingTitleId(null)
    setEditedTitle("")
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined
    })
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit"
    })
  }

  const displayRecordings = searchResults
    ? searchResults.map(r => r.recording)
    : recordings

  if (recordings.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-12 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Mic className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No recordings yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Your voice recordings will appear here. Record your ideas, project descriptions,
            or brainstorming sessions - nothing gets lost.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search recordings by title, transcription, or tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search Results Info */}
      {searchResults !== null && (
        <div className="text-sm text-muted-foreground">
          Found {searchResults.length} recording{searchResults.length !== 1 ? "s" : ""} matching "{searchQuery}"
        </div>
      )}

      {/* Recordings Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {displayRecordings.map((recording) => {
          const isExpanded = expandedRecordingId === recording.id
          const isPlaying = playerState.recordingId === recording.id && playerState.isPlaying
          const searchResult = searchResults?.find(r => r.recording.id === recording.id)

          return (
            <Card
              key={recording.id}
              className={cn(
                "relative overflow-hidden transition-shadow hover:shadow-md",
                isPlaying && "ring-2 ring-primary"
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  {/* Title - Editable */}
                  {editingTitleId === recording.id ? (
                    <div className="flex-1 flex items-center gap-2">
                      <Input
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleUpdateTitle(recording.id)
                          if (e.key === "Escape") setEditingTitleId(null)
                        }}
                        className="h-7 text-sm"
                        autoFocus
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleUpdateTitle(recording.id)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <CardTitle
                      className="text-sm font-medium line-clamp-2 cursor-pointer hover:text-primary"
                      onClick={() => {
                        setEditingTitleId(recording.id)
                        setEditedTitle(recording.title)
                      }}
                      title="Click to edit title"
                    >
                      {recording.title}
                    </CardTitle>
                  )}

                  {/* Play/Pause Button */}
                  <Button
                    size="icon"
                    variant={isPlaying ? "default" : "outline"}
                    className="h-8 w-8 flex-shrink-0"
                    onClick={() => handlePlay(recording)}
                  >
                    {isPlaying ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* Metadata Row */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(recording.createdAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatRecordingDuration(recording.audioDuration)}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="pt-0 pb-3">
                {/* Audio Progress Bar (when playing) */}
                {playerState.recordingId === recording.id && (
                  <div className="mb-3">
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{
                          width: `${(playerState.currentTime / playerState.duration) * 100}%`
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>{formatRecordingDuration(playerState.currentTime)}</span>
                      <span>{formatRecordingDuration(playerState.duration)}</span>
                    </div>
                  </div>
                )}

                {/* Transcription Preview */}
                <div className="relative">
                  <p
                    className={cn(
                      "text-sm text-muted-foreground",
                      !isExpanded && "line-clamp-3"
                    )}
                  >
                    {searchResult?.matchSnippet || recording.transcription}
                  </p>
                  {recording.transcription.length > 150 && (
                    <button
                      onClick={() => setExpandedRecordingId(isExpanded ? null : recording.id)}
                      className="text-xs text-primary hover:underline mt-1"
                    >
                      {isExpanded ? "Show less" : "Show more"}
                    </button>
                  )}
                </div>

                {/* Tags */}
                {recording.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {recording.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Linked Entities */}
                {(recording.linkedProjectId || recording.createdProjectId) && (
                  <div className="flex items-center gap-2 mt-3 pt-2 border-t">
                    {recording.createdProjectId && (
                      <Badge variant="success" className="text-xs gap-1">
                        <Lightbulb className="h-3 w-3" />
                        Created from voice
                      </Badge>
                    )}
                    {recording.linkedProjectId && !recording.createdProjectId && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <Link2 className="h-3 w-3" />
                        Linked to project
                      </Badge>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between mt-3 pt-2 border-t">
                  <div className="flex gap-1">
                    {onLinkToProject && !recording.linkedProjectId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => onLinkToProject(recording)}
                      >
                        <Link2 className="h-3 w-3 mr-1" />
                        Link
                      </Button>
                    )}
                    {onCreateProject && !recording.createdProjectId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => onCreateProject(recording)}
                      >
                        <FolderOpen className="h-3 w-3 mr-1" />
                        Create Project
                      </Button>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteConfirmId(recording.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Recording?
            </DialogTitle>
            <DialogDescription>
              This will permanently delete the voice recording and its audio file.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              Delete Recording
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Compact version for sidebars or previews
interface RecordingPreviewProps {
  recording: VoiceRecording
  onPlay?: () => void
  onSelect?: () => void
  isPlaying?: boolean
  compact?: boolean
}

export function RecordingPreview({
  recording,
  onPlay,
  onSelect,
  isPlaying,
  compact
}: RecordingPreviewProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays} days ago`

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
          "hover:bg-accent",
          isPlaying && "bg-primary/10"
        )}
        onClick={onSelect}
      >
        <Button
          size="icon"
          variant={isPlaying ? "default" : "ghost"}
          className="h-8 w-8 flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            onPlay?.()
          }}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{recording.title}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(recording.createdAt)} - {formatRecordingDuration(recording.audioDuration)}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "p-3 rounded-lg border cursor-pointer transition-all",
        "hover:border-primary/50 hover:shadow-sm",
        isPlaying && "border-primary bg-primary/5"
      )}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        <Button
          size="icon"
          variant={isPlaying ? "default" : "outline"}
          className="h-10 w-10 flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            onPlay?.()
          }}
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5" />
          )}
        </Button>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{recording.title}</p>
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
            {recording.transcription.slice(0, 100)}
            {recording.transcription.length > 100 && "..."}
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <span>{formatDate(recording.createdAt)}</span>
            <span>-</span>
            <span>{formatRecordingDuration(recording.audioDuration)}</span>
            {recording.createdProjectId && (
              <Badge variant="success" className="text-xs ml-2">
                Created project
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
