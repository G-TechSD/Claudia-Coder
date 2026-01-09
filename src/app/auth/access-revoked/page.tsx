"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ShieldOff, Mail, LogOut } from "lucide-react"
import Link from "next/link"

export default function AccessRevokedPage() {
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/sign-out", { method: "POST" })
      // Clear all auth-related cookies
      document.cookie = "better-auth.session_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
      document.cookie = "claudia-access-revoked=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
      document.cookie = "claudia-user-role=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
      window.location.href = "/auth/login"
    } catch {
      window.location.href = "/auth/login"
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md border-red-500/30">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
            <ShieldOff className="h-8 w-8 text-red-500" />
          </div>
          <CardTitle className="text-2xl text-red-500">Access Revoked</CardTitle>
          <CardDescription className="text-base">
            Your access to Claudia Coder has been revoked
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center text-sm text-muted-foreground">
            <p>
              Your account access has been revoked by an administrator. This may be due to
              a violation of our terms of service or NDA agreement.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-muted">
            <h3 className="font-medium mb-2">What you can do:</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <Mail className="h-4 w-4 mt-0.5 text-primary" />
                <span>Contact support at <strong>support@claudia.dev</strong> if you believe this is a mistake</span>
              </li>
              <li className="flex items-start gap-2">
                <ShieldOff className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <span>Review any communications from our team regarding this action</span>
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <Button variant="outline" onClick={handleLogout} className="w-full">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
            <Link href="mailto:support@claudia.dev" className="w-full">
              <Button variant="default" className="w-full">
                <Mail className="h-4 w-4 mr-2" />
                Contact Support
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
