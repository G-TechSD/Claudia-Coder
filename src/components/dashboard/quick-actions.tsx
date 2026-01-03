"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, Pause, Plus, Settings } from "lucide-react"

export function QuickActions() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button variant="outline" className="w-full justify-start gap-2">
          <Play className="h-4 w-4 text-green-400" />
          Resume
        </Button>
        <Button variant="outline" className="w-full justify-start gap-2">
          <Pause className="h-4 w-4 text-yellow-400" />
          Pause All
        </Button>
        <Button variant="outline" className="w-full justify-start gap-2">
          <Plus className="h-4 w-4 text-blue-400" />
          New Task
        </Button>
        <Button variant="outline" className="w-full justify-start gap-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          Settings
        </Button>
      </CardContent>
    </Card>
  )
}
