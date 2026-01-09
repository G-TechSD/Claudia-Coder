"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Construction, RefreshCw, Clock } from "lucide-react"

export default function MaintenancePage() {
  const [refreshing, setRefreshing] = React.useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    // Wait a moment then reload
    await new Promise(resolve => setTimeout(resolve, 1000))
    window.location.href = "/"
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md border-yellow-500/30">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10">
            <Construction className="h-8 w-8 text-yellow-500" />
          </div>
          <CardTitle className="text-2xl">System Maintenance</CardTitle>
          <CardDescription className="text-base">
            Claudia Coder is currently undergoing maintenance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center text-sm text-muted-foreground">
            <p>
              We are performing scheduled maintenance to improve your experience.
              The system will be back online shortly.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-muted">
            <div className="flex items-center gap-3 text-sm">
              <Clock className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="font-medium">Expected Duration</p>
                <p className="text-muted-foreground">Usually less than 30 minutes</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              variant="default"
              onClick={handleRefresh}
              className="w-full"
              disabled={refreshing}
            >
              {refreshing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Check Again
                </>
              )}
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            If you are an administrator, please sign in to access the admin panel.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
