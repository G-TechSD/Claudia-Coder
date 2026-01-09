"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ShieldAlert, ArrowLeft } from "lucide-react"

export default function SignUpPage() {
  return (
    <div className="space-y-6">
      {/* Icon */}
      <div className="flex justify-center">
        <div className="h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center">
          <ShieldAlert className="h-8 w-8 text-amber-500" />
        </div>
      </div>

      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Invite Only</h1>
        <p className="text-muted-foreground mt-2">
          Claudia Code Beta Access
        </p>
      </div>

      {/* Message */}
      <div className="p-4 rounded-lg bg-muted border text-center">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Claudia Code Beta is invite only. All use is monitored. Any account
          here may be revoked at any time for any reason.
        </p>
      </div>

      {/* Info */}
      <div className="text-center text-sm text-muted-foreground">
        <p>
          If you have received an invite link, please use that link to create
          your account.
        </p>
      </div>

      {/* Back to Login Button */}
      <Button asChild variant="outline" className="w-full">
        <Link href="/auth/login">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Login
        </Link>
      </Button>
    </div>
  )
}
