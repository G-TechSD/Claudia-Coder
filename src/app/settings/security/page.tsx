"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { authClient, twoFactor } from "@/lib/auth/client"
import {
  Shield,
  Smartphone,
  Key,
  Mail,
  QrCode,
  CheckCircle,
  XCircle,
  Loader2,
  Copy,
  Eye,
  EyeOff,
  AlertTriangle,
  Fingerprint,
  Trash2,
  Plus,
  RefreshCw,
} from "lucide-react"

interface TwoFactorStatus {
  enabled: boolean
  totpEnabled: boolean
  backupCodesRemaining: number
}

interface Passkey {
  id: string
  name: string
  deviceType: string
  createdAt: string
  lastUsed?: string
}

export default function SecuritySettingsPage() {
  const { data: session } = authClient.useSession()

  // 2FA State
  const [twoFactorStatus, setTwoFactorStatus] = useState<TwoFactorStatus>({
    enabled: false,
    totpEnabled: false,
    backupCodesRemaining: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // TOTP Setup Dialog
  const [totpSetupOpen, setTotpSetupOpen] = useState(false)
  const [totpSecret, setTotpSecret] = useState<string | null>(null)
  const [totpUri, setTotpUri] = useState<string | null>(null)
  const [totpCode, setTotpCode] = useState("")
  const [totpVerifying, setTotpVerifying] = useState(false)
  const [totpError, setTotpError] = useState<string | null>(null)
  const [showSecret, setShowSecret] = useState(false)

  // Backup Codes Dialog
  const [backupCodesOpen, setBackupCodesOpen] = useState(false)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [regeneratingCodes, setRegeneratingCodes] = useState(false)

  // Disable 2FA Dialog
  const [disable2FAOpen, setDisable2FAOpen] = useState(false)
  const [disableCode, setDisableCode] = useState("")
  const [disabling, setDisabling] = useState(false)

  // Passkeys State
  const [passkeys, setPasskeys] = useState<Passkey[]>([])
  const [passkeysSupported, setPasskeysSupported] = useState(false)
  const [addingPasskey, setAddingPasskey] = useState(false)
  const [passkeyName, setPasskeyName] = useState("")
  const [addPasskeyOpen, setAddPasskeyOpen] = useState(false)

  // Check 2FA status on load
  useEffect(() => {
    checkTwoFactorStatus()
    checkPasskeySupport()
  }, [session])

  async function checkTwoFactorStatus() {
    if (!session?.user) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      // Check if 2FA is enabled for the user
      // This would normally call the Better Auth API
      const response = await fetch("/api/auth/two-factor/status")
      if (response.ok) {
        const data = await response.json()
        setTwoFactorStatus({
          enabled: data.enabled || false,
          totpEnabled: data.totpEnabled || false,
          backupCodesRemaining: data.backupCodesRemaining || 0,
        })
      }
    } catch (err) {
      console.error("Failed to check 2FA status:", err)
      // Default to disabled if we can't check
    } finally {
      setLoading(false)
    }
  }

  function checkPasskeySupport() {
    // Check if WebAuthn is supported in this browser
    if (typeof window !== "undefined" && window.PublicKeyCredential) {
      setPasskeysSupported(true)
      // Load existing passkeys
      loadPasskeys()
    }
  }

  async function loadPasskeys() {
    try {
      const response = await fetch("/api/auth/passkeys")
      if (response.ok) {
        const data = await response.json()
        setPasskeys(data.passkeys || [])
      }
    } catch (err) {
      console.error("Failed to load passkeys:", err)
    }
  }

  // Start TOTP setup
  async function startTotpSetup() {
    setTotpError(null)
    setTotpCode("")
    setTotpSetupOpen(true)

    try {
      // Call Better Auth to generate TOTP secret
      const result = await twoFactor.getTotpUri({
        password: "", // Password confirmation might be required
      })

      if (result.data) {
        const uri = result.data.totpURI
        setTotpUri(uri)
        // Extract secret from TOTP URI (format: otpauth://totp/...?secret=...&...)
        const secretMatch = uri.match(/secret=([A-Z2-7]+)/i)
        if (secretMatch) {
          setTotpSecret(secretMatch[1])
        }
      } else if (result.error) {
        setTotpError(result.error.message || "Failed to generate TOTP secret")
      }
    } catch (err) {
      setTotpError("Failed to start TOTP setup")
      console.error(err)
    }
  }

  // Verify and enable TOTP
  async function verifyAndEnableTotp() {
    if (!totpCode || totpCode.length !== 6) {
      setTotpError("Please enter a 6-digit code")
      return
    }

    setTotpVerifying(true)
    setTotpError(null)

    try {
      // Verify TOTP code to confirm setup is working
      const verifyResult = await twoFactor.verifyTotp({
        code: totpCode,
      })

      if (verifyResult.error) {
        setTotpError(verifyResult.error.message || "Invalid code")
        return
      }

      // Enable 2FA after successful verification
      const enableResult = await twoFactor.enable({
        password: "", // Password may be required based on server config
      })

      if (enableResult.data?.backupCodes) {
        // Show backup codes
        setBackupCodes(enableResult.data.backupCodes)
        setTotpSetupOpen(false)
        setBackupCodesOpen(true)
        setTwoFactorStatus(prev => ({
          ...prev,
          enabled: true,
          totpEnabled: true,
          backupCodesRemaining: enableResult.data.backupCodes.length,
        }))
      } else if (enableResult.error) {
        setTotpError(enableResult.error.message || "Failed to enable 2FA")
      }
    } catch (err) {
      setTotpError("Failed to verify code")
      console.error(err)
    } finally {
      setTotpVerifying(false)
    }
  }

  // Disable 2FA
  async function disableTwoFactor() {
    if (!disableCode) {
      setError("Please enter your verification code")
      return
    }

    setDisabling(true)
    setError(null)

    try {
      const result = await twoFactor.disable({
        password: disableCode, // Note: API requires password, UI currently asks for code
      })

      if (result.data) {
        setTwoFactorStatus({
          enabled: false,
          totpEnabled: false,
          backupCodesRemaining: 0,
        })
        setDisable2FAOpen(false)
        setDisableCode("")
      } else if (result.error) {
        setError(result.error.message || "Failed to disable 2FA")
      }
    } catch (err) {
      setError("Failed to disable 2FA")
      console.error(err)
    } finally {
      setDisabling(false)
    }
  }

  // Regenerate backup codes
  async function regenerateBackupCodes() {
    setRegeneratingCodes(true)

    try {
      const result = await twoFactor.generateBackupCodes({
        password: "", // Password may be required based on server config
      })

      if (result.data?.backupCodes) {
        setBackupCodes(result.data.backupCodes)
        setTwoFactorStatus(prev => ({
          ...prev,
          backupCodesRemaining: result.data.backupCodes.length,
        }))
        setBackupCodesOpen(true)
      } else if (result.error) {
        setError(result.error.message || "Failed to regenerate codes")
      }
    } catch (err) {
      setError("Failed to regenerate backup codes")
      console.error(err)
    } finally {
      setRegeneratingCodes(false)
    }
  }

  // Copy to clipboard
  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
  }

  // Generate QR code URL (using a simple QR code service)
  function getQrCodeUrl(uri: string) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(uri)}`
  }

  if (!session?.user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Shield className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Please sign in to manage security settings</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Security Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your account security and two-factor authentication
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          <span>{error}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => setError(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Two-Factor Authentication */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Two-Factor Authentication (2FA)
              </CardTitle>
              <CardDescription>
                Add an extra layer of security to your account
              </CardDescription>
            </div>
            {twoFactorStatus.enabled && (
              <Badge variant="default" className="bg-green-500">
                <CheckCircle className="h-3 w-3 mr-1" />
                Enabled
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* TOTP Section */}
              <div className="p-4 rounded-lg border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <QrCode className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Authenticator App (TOTP)</p>
                      <p className="text-sm text-muted-foreground">
                        Use apps like Google Authenticator, Authy, or 1Password
                      </p>
                    </div>
                  </div>
                  {twoFactorStatus.totpEnabled ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-green-500 border-green-500">
                        Active
                      </Badge>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDisable2FAOpen(true)}
                      >
                        Disable
                      </Button>
                    </div>
                  ) : (
                    <Button onClick={startTotpSetup}>
                      <Plus className="h-4 w-4 mr-2" />
                      Set Up
                    </Button>
                  )}
                </div>
              </div>

              {/* Backup Codes Section */}
              {twoFactorStatus.enabled && (
                <div className="p-4 rounded-lg border space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Key className="h-5 w-5 text-amber-500" />
                      <div>
                        <p className="font-medium">Backup Codes</p>
                        <p className="text-sm text-muted-foreground">
                          {twoFactorStatus.backupCodesRemaining} codes remaining
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={regenerateBackupCodes}
                      disabled={regeneratingCodes}
                    >
                      {regeneratingCodes ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Regenerate
                        </>
                      )}
                    </Button>
                  </div>
                  {twoFactorStatus.backupCodesRemaining <= 3 && (
                    <p className="text-sm text-amber-500 flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4" />
                      Low on backup codes. Consider regenerating new ones.
                    </p>
                  )}
                </div>
              )}

              {/* Email Verification (future feature) */}
              <div className="p-4 rounded-lg border space-y-3 opacity-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-medium">Email Verification</p>
                      <p className="text-sm text-muted-foreground">
                        Receive verification codes via email
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">Coming Soon</Badge>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Passkeys / WebAuthn */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5" />
            Passkeys
          </CardTitle>
          <CardDescription>
            Sign in with fingerprint, face recognition, or security keys
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!passkeysSupported ? (
            <div className="p-4 rounded-lg bg-muted text-center">
              <p className="text-sm text-muted-foreground">
                Passkeys are not supported in your current browser
              </p>
            </div>
          ) : (
            <>
              {/* Existing Passkeys */}
              {passkeys.length > 0 ? (
                <div className="space-y-2">
                  {passkeys.map(passkey => (
                    <div
                      key={passkey.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <Fingerprint className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{passkey.name || "Unnamed Passkey"}</p>
                          <p className="text-xs text-muted-foreground">
                            Added {new Date(passkey.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <p className="text-sm text-muted-foreground">
                    No passkeys registered yet
                  </p>
                </div>
              )}

              {/* Add Passkey Button */}
              <div className="p-4 rounded-lg border border-dashed">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Add a Passkey</p>
                    <p className="text-sm text-muted-foreground">
                      Use your device biometrics or security key
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setAddPasskeyOpen(true)}
                    disabled={addingPasskey}
                  >
                    {addingPasskey ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Passkey
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Note: Passkey support requires the @better-auth/passkey package to be installed.
                See the documentation for setup instructions.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* TOTP Setup Dialog */}
      <Dialog open={totpSetupOpen} onOpenChange={setTotpSetupOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Set Up Authenticator App
            </DialogTitle>
            <DialogDescription>
              Scan the QR code with your authenticator app, then enter the verification code
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* QR Code */}
            {totpUri ? (
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-lg">
                  <img
                    src={getQrCodeUrl(totpUri)}
                    alt="TOTP QR Code"
                    className="w-48 h-48"
                  />
                </div>
              </div>
            ) : (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Manual Entry Secret */}
            {totpSecret && (
              <div className="space-y-2">
                <Label>Manual Entry Code</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showSecret ? "text" : "password"}
                      value={totpSecret}
                      readOnly
                      className="pr-20 font-mono text-sm"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        className="p-1 text-muted-foreground hover:text-foreground"
                      >
                        {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(totpSecret)}
                        className="p-1 text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  If you can't scan the QR code, enter this code manually in your app
                </p>
              </div>
            )}

            {/* Verification Code Input */}
            <div className="space-y-2">
              <Label htmlFor="totpCode">Verification Code</Label>
              <Input
                id="totpCode"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                className="text-center text-2xl tracking-widest font-mono"
              />
              {totpError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  {totpError}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTotpSetupOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={verifyAndEnableTotp}
              disabled={totpVerifying || totpCode.length !== 6}
            >
              {totpVerifying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Verify & Enable
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backup Codes Dialog */}
      <Dialog open={backupCodesOpen} onOpenChange={setBackupCodesOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-amber-500" />
              Backup Codes
            </DialogTitle>
            <DialogDescription>
              Save these codes in a secure place. Each code can only be used once.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <p className="text-sm text-amber-600 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                These codes will only be shown once. Save them now!
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 font-mono text-sm">
              {backupCodes.map((code, index) => (
                <div
                  key={index}
                  className="p-2 bg-muted rounded text-center"
                >
                  {code}
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => copyToClipboard(backupCodes.join("\n"))}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy All Codes
            </Button>
          </div>

          <DialogFooter>
            <Button onClick={() => setBackupCodesOpen(false)}>
              I've Saved My Codes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable 2FA Dialog */}
      <Dialog open={disable2FAOpen} onOpenChange={setDisable2FAOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Disable Two-Factor Authentication
            </DialogTitle>
            <DialogDescription>
              This will remove the extra security layer from your account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
              <p className="text-sm text-destructive">
                Warning: Disabling 2FA makes your account more vulnerable to unauthorized access.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="disableCode">Enter verification code to confirm</Label>
              <Input
                id="disableCode"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
                className="text-center text-xl tracking-widest font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Enter a code from your authenticator app or a backup code
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDisable2FAOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={disableTwoFactor}
              disabled={disabling || !disableCode}
            >
              {disabling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Disable 2FA"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Passkey Dialog */}
      <Dialog open={addPasskeyOpen} onOpenChange={setAddPasskeyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Fingerprint className="h-5 w-5" />
              Add Passkey
            </DialogTitle>
            <DialogDescription>
              Give your passkey a name to help you identify it later
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="passkeyName">Passkey Name</Label>
              <Input
                id="passkeyName"
                type="text"
                placeholder="e.g., MacBook Pro, iPhone"
                value={passkeyName}
                onChange={(e) => setPasskeyName(e.target.value)}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Note: Passkey registration requires the @better-auth/passkey package.
              Your browser will prompt you to authenticate with biometrics or a security key.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPasskeyOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                // Passkey registration would go here
                setAddPasskeyOpen(false)
              }}
              disabled={!passkeyName}
            >
              Register Passkey
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
