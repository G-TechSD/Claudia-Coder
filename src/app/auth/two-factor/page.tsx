"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { twoFactor } from "@/lib/auth/client"
import { Loader2, ShieldCheck, KeyRound, ArrowLeft } from "lucide-react"

export default function TwoFactorPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [code, setCode] = React.useState("")
  const [useBackupCode, setUseBackupCode] = React.useState(false)
  const [rememberDevice, setRememberDevice] = React.useState(false)

  // Handle input for 6-digit code (only allow numbers)
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, useBackupCode ? 10 : 6)
    setCode(value)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      if (useBackupCode) {
        // Verify with backup code
        const result = await twoFactor.verifyBackupCode({
          code,
        })

        if (result.error) {
          setError(result.error.message || "Invalid backup code")
          setIsLoading(false)
          return
        }
      } else {
        // Verify with TOTP code
        const result = await twoFactor.verifyTotp({
          code,
          trustDevice: rememberDevice,
        })

        if (result.error) {
          setError(result.error.message || "Invalid verification code")
          setIsLoading(false)
          return
        }
      }

      // Success - redirect to dashboard
      router.push("/")
      router.refresh()
    } catch (_err) {
      setError("An unexpected error occurred")
      setIsLoading(false)
    }
  }

  // Toggle between TOTP and backup code mode
  const toggleMode = () => {
    setUseBackupCode(!useBackupCode)
    setCode("")
    setError(null)
  }

  return (
    <div className="space-y-6">
      {/* Icon */}
      <div className="flex justify-center">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          {useBackupCode ? (
            <KeyRound className="h-8 w-8 text-primary" />
          ) : (
            <ShieldCheck className="h-8 w-8 text-primary" />
          )}
        </div>
      </div>

      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          {useBackupCode ? "Enter Backup Code" : "Two-Factor Authentication"}
        </h1>
        <p className="text-muted-foreground mt-2">
          {useBackupCode
            ? "Enter one of your backup codes to verify your identity"
            : "Enter the 6-digit code from your authenticator app"}
        </p>
      </div>

      {/* Verification Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="code">
            {useBackupCode ? "Backup Code" : "Verification Code"}
          </Label>
          <Input
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder={useBackupCode ? "Enter backup code" : "000000"}
            value={code}
            onChange={handleCodeChange}
            required
            disabled={isLoading}
            className="text-center text-2xl tracking-[0.5em] font-mono"
          />
        </div>

        {/* Remember Device Option (only for TOTP, not backup codes) */}
        {!useBackupCode && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="rememberDevice"
              checked={rememberDevice}
              onCheckedChange={(checked) => setRememberDevice(checked as boolean)}
              disabled={isLoading}
            />
            <Label
              htmlFor="rememberDevice"
              className="text-sm font-normal cursor-pointer"
            >
              Remember this device for 30 days
            </Label>
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={isLoading || code.length < (useBackupCode ? 1 : 6)}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Verify
            </>
          )}
        </Button>
      </form>

      {/* Toggle between TOTP and Backup Code */}
      <div className="text-center">
        <button
          type="button"
          onClick={toggleMode}
          className="text-sm text-primary hover:underline"
          disabled={isLoading}
        >
          {useBackupCode
            ? "Use authenticator app instead"
            : "Use a backup code instead"}
        </button>
      </div>

      {/* Back to Login */}
      <Button asChild variant="outline" className="w-full">
        <Link href="/auth/login">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Try a different account
        </Link>
      </Button>
    </div>
  )
}
