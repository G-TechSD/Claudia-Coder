"use client"

import * as React from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/components/auth/auth-provider"
import { useMigration } from "@/components/data/migration-provider"
import {
  forceMigration,
  resetMigrationFlag,
  getLegacyDataSummary,
  getMigrationStatus,
  cleanupLegacyData,
  hasLegacyDataToMigrate,
  type MigrationResult,
} from "@/lib/data/migrate-user-data"
import {
  Database,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Trash2,
  Loader2,
  ArrowRight,
  Clock,
  Package,
} from "lucide-react"

export default function AdminMigrationPage() {
  const { user } = useAuth()
  const { migrationStatus, migrationResult: autoResult } = useMigration()

  const [isRunning, setIsRunning] = React.useState(false)
  const [manualResult, setManualResult] = React.useState<MigrationResult | null>(null)
  const [legacySummary, setLegacySummary] = React.useState<
    Array<{ key: string; baseKey: string; itemCount: number; hasData: boolean }>
  >([])
  const [hasLegacy, setHasLegacy] = React.useState(false)
  const [currentStatus, setCurrentStatus] = React.useState(migrationStatus)
  const [cleanupComplete, setCleanupComplete] = React.useState(false)

  // Load initial data
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setLegacySummary(getLegacyDataSummary())
      setHasLegacy(hasLegacyDataToMigrate())
      if (user?.id) {
        setCurrentStatus(getMigrationStatus(user.id))
      }
    }
  }, [user?.id])

  // Update status when auto-migration completes
  React.useEffect(() => {
    if (migrationStatus) {
      setCurrentStatus(migrationStatus)
    }
  }, [migrationStatus])

  const handleRunMigration = async () => {
    if (!user?.id) return

    setIsRunning(true)
    setManualResult(null)

    try {
      // Small delay to show loading state
      await new Promise((resolve) => setTimeout(resolve, 500))

      const result = forceMigration(user.id)
      setManualResult(result)
      setCurrentStatus(getMigrationStatus(user.id))
      setLegacySummary(getLegacyDataSummary())
      setHasLegacy(hasLegacyDataToMigrate())
    } catch (error) {
      console.error("Migration failed:", error)
    } finally {
      setIsRunning(false)
    }
  }

  const handleResetFlag = () => {
    if (!user?.id) return

    resetMigrationFlag(user.id)
    setCurrentStatus({ migrated: false })
    setManualResult(null)
  }

  const handleCleanup = () => {
    if (!user?.id) return

    if (
      confirm(
        "WARNING: This will permanently delete ALL legacy data. " +
          "This cannot be undone. Are you sure?"
      )
    ) {
      const deleted = cleanupLegacyData(user.id, true)
      if (deleted.length > 0) {
        setCleanupComplete(true)
        setLegacySummary(getLegacyDataSummary())
        setHasLegacy(hasLegacyDataToMigrate())
      }
    }
  }

  const result = manualResult || autoResult

  // Calculate totals for legacy data
  const totalLegacyItems = legacySummary.reduce((sum, item) => sum + item.itemCount, 0)
  const legacyKeysWithData = legacySummary.filter((item) => item.hasData).length

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Data Migration</h1>
        <p className="text-sm text-muted-foreground">
          Migrate legacy localStorage data to user-scoped storage
        </p>
      </div>

      {/* Migration Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Migration Status
          </CardTitle>
          <CardDescription>
            Current migration status for user: {user?.email || "Unknown"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            {currentStatus?.migrated ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-green-500 font-medium">Migration Complete</span>
                {currentStatus.migratedAt && (
                  <Badge variant="secondary" className="ml-2">
                    <Clock className="h-3 w-3 mr-1" />
                    {new Date(currentStatus.migratedAt).toLocaleString()}
                  </Badge>
                )}
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <span className="text-yellow-500 font-medium">Migration Pending</span>
              </>
            )}
          </div>

          {/* Summary of last migration */}
          {currentStatus?.summary && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-sm">Last Migration Summary</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Migrated Keys:</span>
                  <p className="font-mono">{currentStatus.summary.migratedKeys.length}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Items:</span>
                  <p className="font-mono">{currentStatus.summary.totalItemsMigrated}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Skipped:</span>
                  <p className="font-mono">{currentStatus.summary.skippedKeys.length}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Errors:</span>
                  <p className="font-mono">{currentStatus.summary.errors.length}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legacy Data Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Legacy Data Summary
          </CardTitle>
          <CardDescription>
            Overview of data in legacy (non-user-scoped) storage keys
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasLegacy ? (
            <>
              <div className="flex items-center gap-2 text-yellow-500">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">
                  Found {totalLegacyItems} items across {legacyKeysWithData} legacy keys
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium">Legacy Key</th>
                      <th className="text-left py-2 px-2 font-medium">Target Key</th>
                      <th className="text-right py-2 px-2 font-medium">Items</th>
                      <th className="text-center py-2 px-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {legacySummary.map((item) => (
                      <tr key={item.key} className="border-b border-muted/50">
                        <td className="py-2 px-2 font-mono text-xs">{item.key}</td>
                        <td className="py-2 px-2 font-mono text-xs text-muted-foreground">
                          {item.baseKey}
                        </td>
                        <td className="py-2 px-2 text-right font-mono">{item.itemCount}</td>
                        <td className="py-2 px-2 text-center">
                          {item.hasData ? (
                            <Badge variant="warning" className="text-xs">
                              Has Data
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              Empty
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-green-500">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">No legacy data found</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Migration Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Migration Actions
          </CardTitle>
          <CardDescription>
            Manually trigger or reset the data migration process
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleRunMigration}
              disabled={isRunning || !hasLegacy}
              className="gap-2"
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              {isRunning ? "Migrating..." : "Run Migration"}
            </Button>

            <Button
              onClick={handleResetFlag}
              variant="outline"
              disabled={!currentStatus?.migrated}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Reset Migration Flag
            </Button>

            <Button
              onClick={handleCleanup}
              variant="destructive"
              disabled={!currentStatus?.migrated || !hasLegacy}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete Legacy Data
            </Button>
          </div>

          {cleanupComplete && (
            <div className="flex items-center gap-2 text-green-500">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">Legacy data has been deleted</span>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Note: Run Migration will re-migrate all legacy data. Reset Flag allows re-running
            migration. Delete Legacy Data permanently removes the backup data after successful
            migration.
          </p>
        </CardContent>
      </Card>

      {/* Migration Result */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              Migration Result
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`p-4 rounded-lg ${
                result.success ? "bg-green-500/10" : "bg-red-500/10"
              }`}
            >
              <p className={result.success ? "text-green-500" : "text-red-500"}>
                {result.success
                  ? `Successfully migrated ${result.totalItemsMigrated} items`
                  : `Migration completed with ${result.errors.length} errors`}
              </p>
            </div>

            {result.migratedKeys.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2">Migrated Keys:</h4>
                <div className="flex flex-wrap gap-1">
                  {result.migratedKeys.map((key) => (
                    <Badge key={key} variant="success" className="text-xs">
                      {key}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {result.skippedKeys.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2">Skipped Keys (already had data):</h4>
                <div className="flex flex-wrap gap-1">
                  {result.skippedKeys.map((key) => (
                    <Badge key={key} variant="secondary" className="text-xs">
                      {key}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {result.errors.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2 text-red-500">Errors:</h4>
                <div className="space-y-1">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-xs text-red-400 font-mono">
                      {err.key}: {err.error}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle>How Migration Works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-3">
          <p>
            Previously, all data was stored in global localStorage keys like{" "}
            <code className="bg-muted px-1 rounded">claudia_projects</code>. This meant all users
            shared the same data on a device.
          </p>
          <p>
            With user-scoped storage, each user has their own data namespace:{" "}
            <code className="bg-muted px-1 rounded">claudia_user_{"<userId>"}_projects</code>
          </p>
          <p>The migration process:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Reads data from legacy global keys</li>
            <li>Adds userId to each data item for ownership tracking</li>
            <li>Writes to new user-scoped keys</li>
            <li>Keeps legacy data as backup (not deleted automatically)</li>
            <li>Sets a migration flag to prevent re-running</li>
          </ol>
          <p className="text-yellow-500/80">
            Auto-migration runs automatically when you log in. Use this admin page to manually
            re-run or troubleshoot migration issues.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
