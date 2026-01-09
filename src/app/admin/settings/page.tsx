"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Settings, Construction } from "lucide-react"

export default function AdminSettingsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure system-wide settings
        </p>
      </div>

      {/* Coming Soon */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            System Settings
          </CardTitle>
          <CardDescription>
            Configure application-wide settings and defaults
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Construction className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Coming Soon</p>
            <p className="text-sm mt-2 text-center max-w-md">
              Admin settings will include invite defaults, beta program configuration,
              and system-wide preferences.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
