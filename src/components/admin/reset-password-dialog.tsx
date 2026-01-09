"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Loader2, Copy, Check, Key, Eye, EyeOff, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface ResetPasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: {
    id: string
    name: string
    email: string
  } | null
  onSuccess?: () => void
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: ResetPasswordDialogProps) {
  const [autoGenerate, setAutoGenerate] = React.useState(true)
  const [password, setPassword] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [newPassword, setNewPassword] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)

  // Reset state when dialog opens/closes
  React.useEffect(() => {
    if (!open) {
      // Delay reset to allow dialog animation to complete
      const timeout = setTimeout(() => {
        setAutoGenerate(true)
        setPassword("")
        setShowPassword(false)
        setLoading(false)
        setError(null)
        setNewPassword(null)
        setCopied(false)
      }, 200)
      return () => clearTimeout(timeout)
    }
  }, [open])

  const handleResetPassword = async () => {
    if (!user) return

    // Validate password if not auto-generating
    if (!autoGenerate && password.length < 8) {
      setError("Password must be at least 8 characters long")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/users/${user.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          autoGenerate,
          password: autoGenerate ? undefined : password,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to reset password")
      }

      setNewPassword(data.newPassword)
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password")
    } finally {
      setLoading(false)
    }
  }

  const handleCopyPassword = async () => {
    if (!newPassword) return

    try {
      await navigator.clipboard.writeText(newPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement("textarea")
      textArea.value = newPassword
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onClose={handleClose}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Reset Password
          </DialogTitle>
          <DialogDescription>
            Reset password for <span className="font-medium">{user.name}</span> (
            {user.email})
          </DialogDescription>
        </DialogHeader>

        {newPassword ? (
          // Success state - show the new password
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4">
              <p className="text-sm text-green-400 mb-2">
                Password reset successfully!
              </p>
              <p className="text-xs text-muted-foreground">
                Share this password securely with the user. It will not be shown
                again.
              </p>
            </div>

            <div className="space-y-2">
              <Label>New Password</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    readOnly
                    className="font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyPassword}
                  className={cn(
                    "transition-colors",
                    copied && "bg-green-500/20 border-green-500/50"
                  )}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          // Initial state - show reset options
          <div className="space-y-4 py-4">
            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-none" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* Auto-generate toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <div className="space-y-0.5">
                <Label htmlFor="auto-generate">Auto-generate password</Label>
                <p className="text-xs text-muted-foreground">
                  Generate a secure 16-character password
                </p>
              </div>
              <Switch
                id="auto-generate"
                checked={autoGenerate}
                onCheckedChange={setAutoGenerate}
                disabled={loading}
              />
            </div>

            {/* Manual password input */}
            {!autoGenerate && (
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="pr-10"
                    disabled={loading}
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Minimum 8 characters
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {newPassword ? (
            <Button onClick={handleClose}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button
                onClick={handleResetPassword}
                disabled={loading || (!autoGenerate && password.length < 8)}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
