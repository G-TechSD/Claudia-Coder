"use client"

import { Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ShieldAlert, ArrowLeft, Home, Sparkles, Loader2 } from "lucide-react"

function BetaRestrictedContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const from = searchParams.get("from") || "/"
  const message = searchParams.get("message") || "This feature is not available for beta testers."

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background to-muted/30">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center">
            <ShieldAlert className="h-8 w-8 text-amber-500" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <CardTitle className="text-2xl">Access Restricted</CardTitle>
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
              Beta
            </Badge>
          </div>
          <CardDescription className="text-base">
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 rounded-lg bg-muted/50 border border-dashed">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-sm">Want Full Access?</p>
                <p className="text-sm text-muted-foreground mt-1">
                  As a beta tester, you have access to core features. Premium and admin features
                  will be available when you upgrade to a full account.
                </p>
              </div>
            </div>
          </div>

          <div className="text-sm text-muted-foreground text-center">
            <p>You tried to access:</p>
            <code className="text-xs bg-muted px-2 py-1 rounded mt-1 inline-block font-mono">
              {from}
            </code>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => router.back()}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
            <Button
              className="flex-1"
              onClick={() => router.push("/")}
            >
              <Home className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function BetaRestrictedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <BetaRestrictedContent />
    </Suspense>
  )
}
