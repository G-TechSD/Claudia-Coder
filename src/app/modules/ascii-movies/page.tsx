"use client"

import { useState, useMemo } from "react"
import { AsciiMoviePlayer } from "@/components/modules/ascii-movie-player"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  Film,
  Play,
  Sparkles,
  Plus,
  Grid,
  Maximize2,
  Wand2,
} from "lucide-react"
import {
  ASCII_MOVIE_GALLERY,
  AsciiMovie,
  createTextAnimation,
  createCustomAnimation,
} from "@/lib/ascii-movies/generator"

export default function AsciiMoviesPage() {
  const [selectedMovie, setSelectedMovie] = useState<AsciiMovie | null>(null)
  const [activeTab, setActiveTab] = useState("gallery")

  // Text animation creator state
  const [textLines, setTextLines] = useState("Hello, World!\nWelcome to ASCII Movies\nCreated with Claudia Coder")
  const [typingSpeed, setTypingSpeed] = useState(50)

  // Custom animation creator state
  const [customFrames, setCustomFrames] = useState(`Frame 1:
  ___
 /o o\\
 \\_^_/

Frame 2:
  ___
 /- -\\
 \\_^_/

Frame 3:
  ___
 /o o\\
 \\___/`)
  const [customName, setCustomName] = useState("My Animation")
  const [customFps, setCustomFps] = useState(4)

  // Parse custom frames from textarea
  const parseCustomFrames = (): string[][] => {
    const frameBlocks = customFrames.split(/Frame \d+:/i).filter(f => f.trim())
    return frameBlocks.map(block => block.trim().split("\n"))
  }

  // Create text animation preview
  const textAnimation = useMemo(() => {
    const lines = textLines.split("\n").filter(l => l.trim())
    if (lines.length === 0) return null
    return createTextAnimation(lines, { typingSpeed, pauseAfter: 3000 })
  }, [textLines, typingSpeed])

  // Create custom animation preview
  const customAnimation = useMemo(() => {
    try {
      const frames = parseCustomFrames()
      if (frames.length === 0) return null
      return createCustomAnimation(customName, frames, customFps)
    } catch {
      return null
    }
  }, [customFrames, customName, customFps])

  return (
    <div className="container max-w-6xl py-8 space-y-8 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-emerald-600">
              <Film className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">ASCII Movies</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                Generate and play ASCII art animations
                <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/20">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Emergent Module
                </Badge>
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left: Player */}
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Play className="h-4 w-4" />
                  {selectedMovie ? selectedMovie.name : "Select a Movie"}
                </CardTitle>
                {selectedMovie && (
                  <CardDescription>{selectedMovie.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {selectedMovie ? (
                  <AsciiMoviePlayer
                    movie={selectedMovie}
                    autoPlay={true}
                    loop={true}
                    className="h-[350px]"
                  />
                ) : (
                  <div className="h-[350px] bg-black rounded-lg flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <Film className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">Select a movie from the gallery</p>
                      <p className="text-xs mt-1">or create your own animation</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {selectedMovie && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Tags:</span>
                {selectedMovie.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px]">
                    {tag}
                  </Badge>
                ))}
                <span className="ml-auto">by {selectedMovie.author}</span>
              </div>
            )}
          </div>

          {/* Right: Gallery & Creator */}
          <div className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="gallery" className="gap-2">
                  <Grid className="h-4 w-4" />
                  Gallery
                </TabsTrigger>
                <TabsTrigger value="text" className="gap-2">
                  <Wand2 className="h-4 w-4" />
                  Text
                </TabsTrigger>
                <TabsTrigger value="custom" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Custom
                </TabsTrigger>
              </TabsList>

              {/* Gallery Tab */}
              <TabsContent value="gallery" className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {ASCII_MOVIE_GALLERY.map((movie) => (
                    <Card
                      key={movie.id}
                      className={cn(
                        "cursor-pointer transition-all hover:border-primary",
                        selectedMovie?.id === movie.id && "border-primary bg-primary/5"
                      )}
                      onClick={() => setSelectedMovie(movie)}
                    >
                      <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Film className="h-3.5 w-3.5" />
                          {movie.name}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {movie.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{movie.frames.length} frames</span>
                          <span>{movie.defaultFps} FPS</span>
                          <span>{movie.width}×{movie.height}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* Text Animation Tab */}
              <TabsContent value="text" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Create Text Animation</CardTitle>
                    <CardDescription>
                      Type text and watch it appear with a typewriter effect
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="text-lines">Text (one line per row)</Label>
                      <Textarea
                        id="text-lines"
                        value={textLines}
                        onChange={(e) => setTextLines(e.target.value)}
                        rows={4}
                        className="font-mono text-sm"
                        placeholder="Enter your text here..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="typing-speed">
                        Typing Speed: {typingSpeed}ms per character
                      </Label>
                      <Input
                        id="typing-speed"
                        type="range"
                        min={10}
                        max={200}
                        value={typingSpeed}
                        onChange={(e) => setTypingSpeed(Number(e.target.value))}
                        className="cursor-pointer"
                      />
                    </div>
                    <Button
                      onClick={() => textAnimation && setSelectedMovie(textAnimation)}
                      disabled={!textAnimation}
                      className="w-full gap-2"
                    >
                      <Play className="h-4 w-4" />
                      Preview Animation
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Custom Animation Tab */}
              <TabsContent value="custom" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Create Custom Animation</CardTitle>
                    <CardDescription>
                      Define your own frames using ASCII art
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="custom-name">Animation Name</Label>
                        <Input
                          id="custom-name"
                          value={customName}
                          onChange={(e) => setCustomName(e.target.value)}
                          placeholder="My Animation"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="custom-fps">FPS: {customFps}</Label>
                        <Input
                          id="custom-fps"
                          type="range"
                          min={1}
                          max={30}
                          value={customFps}
                          onChange={(e) => setCustomFps(Number(e.target.value))}
                          className="cursor-pointer"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="custom-frames">
                        Frames (separate with "Frame N:")
                      </Label>
                      <Textarea
                        id="custom-frames"
                        value={customFrames}
                        onChange={(e) => setCustomFrames(e.target.value)}
                        rows={12}
                        className="font-mono text-xs"
                        placeholder="Frame 1:&#10;ASCII art here&#10;&#10;Frame 2:&#10;ASCII art here"
                      />
                    </div>
                    <Button
                      onClick={() => customAnimation && setSelectedMovie(customAnimation)}
                      disabled={!customAnimation}
                      className="w-full gap-2"
                    >
                      <Play className="h-4 w-4" />
                      Preview Animation
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Info Section */}
        <Card className="bg-gradient-to-br from-green-500/5 to-emerald-500/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                <Sparkles className="h-5 w-5 text-green-500" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold">About This Module</h3>
                <p className="text-sm text-muted-foreground">
                  ASCII Movies is an <strong>emergent module</strong> - it was created from within Claudia Coder
                  using Claude Code or Ganesha AI. This demonstrates how the platform can extend itself
                  with new features through AI-assisted development. The code for this module lives in:
                </p>
                <ul className="text-xs text-muted-foreground mt-2 space-y-1 font-mono">
                  <li>• src/lib/ascii-movies/generator.ts</li>
                  <li>• src/components/modules/ascii-movie-player.tsx</li>
                  <li>• src/app/modules/ascii-movies/page.tsx</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
    </div>
  )
}
