"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signIn } from "@/lib/auth/client"
import { Loader2, Github, Mail } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const result = await signIn.email({
        email,
        password,
      })

      if (result.error) {
        setError(result.error.message || "Failed to sign in")
        setIsLoading(false)
        return
      }

      router.push("/")
      router.refresh()
    } catch (err) {
      setError("An unexpected error occurred")
      setIsLoading(false)
    }
  }

  const handleOAuthLogin = async (provider: "google" | "github") => {
    setIsLoading(true)
    setError(null)

    try {
      await signIn.social({
        provider,
        callbackURL: "/",
      })
    } catch (err) {
      setError("Failed to initiate OAuth login")
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground mt-2">
          Sign in to your account to continue
        </p>
      </div>

      {/* OAuth Buttons */}
      <div className="space-y-3">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => handleOAuthLogin("google")}
          disabled={isLoading}
        >
          <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </Button>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => handleOAuthLogin("github")}
          disabled={isLoading}
        >
          <Github className="h-4 w-4 mr-2" />
          Continue with GitHub
        </Button>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">
            Or continue with email
          </span>
        </div>
      </div>

      {/* Email/Password Form */}
      <form onSubmit={handleEmailLogin} className="space-y-4">
        {error && (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/auth/forgot-password"
              className="text-sm text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              <Mail className="mr-2 h-4 w-4" />
              Sign in with Email
            </>
          )}
        </Button>
      </form>

      {/* Invite Only Notice */}
      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/auth/signup" className="text-primary hover:underline font-medium">
          Learn about access
        </Link>
      </p>
    </div>
  )
}
