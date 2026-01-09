"use client"

import * as React from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Mail,
  Users,
  Shield,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  ArrowRight,
} from "lucide-react"

interface InviteStats {
  total: number
  pending: number
  used: number
  expired: number
  revoked: number
  remainingCapacity: number
}

interface UserStats {
  total: number
  admins: number
  betaTesters: number
  users: number
  ndaSigned: number
  disabled: number
}

export default function AdminDashboardPage() {
  const [inviteStats, setInviteStats] = React.useState<InviteStats | null>(null)
  const [userStats, setUserStats] = React.useState<UserStats | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function fetchStats() {
      try {
        const [invitesRes, usersRes] = await Promise.all([
          fetch("/api/admin/invites"),
          fetch("/api/admin/users"),
        ])

        if (!invitesRes.ok || !usersRes.ok) {
          throw new Error("Failed to fetch stats")
        }

        const invitesData = await invitesRes.json()
        const usersData = await usersRes.json()

        setInviteStats(invitesData.stats)
        setUserStats(usersData.stats)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load stats")
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <XCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg font-medium">Failed to load dashboard</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Manage beta invites and users
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userStats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {userStats?.admins || 0} admins, {userStats?.betaTesters || 0} beta testers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Invites</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inviteStats?.pending || 0}</div>
            <p className="text-xs text-muted-foreground">
              {inviteStats?.remainingCapacity || 0} remaining capacity
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">NDA Signed</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userStats?.ndaSigned || 0}</div>
            <p className="text-xs text-muted-foreground">
              {userStats?.total ? Math.round((userStats.ndaSigned / userStats.total) * 100) : 0}% of users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Used Invites</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inviteStats?.used || 0}</div>
            <p className="text-xs text-muted-foreground">
              {inviteStats?.total || 0} total invites created
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Invite Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="success" className="gap-1">
                <Clock className="h-3 w-3" />
                {inviteStats?.pending || 0} Pending
              </Badge>
              <Badge variant="info" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                {inviteStats?.used || 0} Used
              </Badge>
              <Badge variant="warning" className="gap-1">
                <Clock className="h-3 w-3" />
                {inviteStats?.expired || 0} Expired
              </Badge>
              <Badge variant="error" className="gap-1">
                <XCircle className="h-3 w-3" />
                {inviteStats?.revoked || 0} Revoked
              </Badge>
            </div>
            <Link href="/admin/invites">
              <Button className="w-full gap-2">
                Manage Invites
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              User Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="default" className="gap-1">
                <Shield className="h-3 w-3" />
                {userStats?.admins || 0} Admins
              </Badge>
              <Badge variant="success" className="gap-1">
                <Users className="h-3 w-3" />
                {userStats?.betaTesters || 0} Beta Testers
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Users className="h-3 w-3" />
                {userStats?.users || 0} Users
              </Badge>
              {(userStats?.disabled || 0) > 0 && (
                <Badge variant="error" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  {userStats?.disabled || 0} Disabled
                </Badge>
              )}
            </div>
            <Link href="/admin/users">
              <Button className="w-full gap-2" variant="outline">
                Manage Users
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
