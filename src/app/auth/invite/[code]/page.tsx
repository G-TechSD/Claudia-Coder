"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signUp, signIn, useSession } from "@/lib/auth/client"
import {
  Loader2,
  UserPlus,
  Gift,
  AlertCircle,
  CheckCircle2,
  User,
} from "lucide-react"

interface InviteData {
  valid: boolean
  inviter?: {
    name: string
  }
  invitedEmail?: string
  error?: string
}

export default function InviteRedemptionPage() {
  const router = useRouter()
  const params = useParams()
  const code = params.code as string
  const { data: session, isPending: isSessionLoading } = useSession()

  const [inviteData, setInviteData] = React.useState<InviteData | null>(null)
  const [isValidating, setIsValidating] = React.useState(true)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Signup form state
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")

  // Validate invite code on mount
  React.useEffect(() => {
    async function validateInvite() {
      try {
        const response = await fetch(`/api/invite?code=${encodeURIComponent(code)}`)
        const data = await response.json()

        if (!response.ok) {
          setInviteData({ valid: false, error: data.error })
        } else {
          setInviteData(data)
          // Pre-fill email if specified in invite
          if (data.invitedEmail) {
            setEmail(data.invitedEmail)
          }
        }
      } catch (err) {
        setInviteData({ valid: false, error: "Failed to validate invite code" })
      } finally {
        setIsValidating(false)
      }
    }

    if (code) {
      validateInvite()
    }
  }, [code])

  // Check if logged-in user needs to sign NDA or can proceed
  React.useEffect(() => {
    async function checkUserStatus() {
      if (!session?.user || isValidating || !inviteData?.valid) return

      setIsLoading(true)
      try {
        // First, redeem the invite code
        const redeemResponse = await fetch("/api/invite", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        })

        if (!redeemResponse.ok) {
          const data = await redeemResponse.json()
          setError(data.error || "Failed to redeem invite")
          setIsLoading(false)
          return
        }

        // Check if user has signed NDA
        const ndaResponse = await fetch("/api/nda")
        const ndaData = await ndaResponse.json()

        if (!ndaData.hasSigned) {
          // Redirect to NDA page
          router.push("/auth/nda")
        } else {
          // All complete, go to dashboard
          router.push("/")
        }
      } catch (err) {
        setError("An error occurred while processing your invite")
        setIsLoading(false)
      }
    }

    checkUserStatus()
  }, [session, isValidating, inviteData, code, router])

  // Handle email signup
  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    // Validate password length
    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      setIsLoading(false)
      return
    }

    try {
      const result = await signUp.email({
        name,
        email,
        password,
      })

      if (result.error) {
        setError(result.error.message || "Failed to create account")
        setIsLoading(false)
        return
      }

      // Account created, the useEffect will handle the rest
      // by redeeming the invite and checking NDA
      router.refresh()
    } catch (err) {
      setError("An unexpected error occurred")
      setIsLoading(false)
    }
  }

  // Loading state
  if (isValidating || isSessionLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Validating invite code...</p>
      </div>
    )
  }

  // Invalid invite code
  if (!inviteData?.valid) {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invalid Invite</h1>
          <p className="text-muted-foreground mt-2">
            {inviteData?.error || "This invite code is invalid or has expired."}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/auth/login">Go to Login</Link>
        </Button>
      </div>
    )
  }

  // User is logged in - processing invite
  if (session?.user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Processing your invite...</p>
        {error && (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}
      </div>
    )
  }

  // Show signup form for new users
  return (
    <div className="space-y-6">
      {/* Invite Header */}
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Gift className="h-6 w-6 text-primary" />
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          You&apos;re Invited!
        </h1>
        <p className="text-muted-foreground mt-2">
          Join the Claudia Coder beta program
        </p>
      </div>

      {/* Inviter Info */}
      {inviteData.inviter && (
        <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-muted/50 border">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">
            Invited by <strong>{inviteData.inviter.name}</strong>
          </span>
        </div>
      )}

      {/* Email/Password Form */}
      <form onSubmit={handleEmailSignUp} className="space-y-4">
        {error && (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading || !!inviteData.invitedEmail}
          />
          {inviteData.invitedEmail && (
            <p className="text-xs text-muted-foreground">
              This invite was sent to this email address
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="Create a password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating account...
            </>
          ) : (
            <>
              <UserPlus className="mr-2 h-4 w-4" />
              Create Account
            </>
          )}
        </Button>
      </form>

      {/* Sign In Link */}
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={`/auth/login?callbackUrl=/auth/invite/${code}`}
          className="text-primary hover:underline font-medium"
        >
          Sign in
        </Link>
      </p>

      {/* Invite Code Badge */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3 w-3 text-green-500" />
        <span>
          Invite code: <code className="font-mono">{code}</code>
        </span>
      </div>
    </div>
  )
}
