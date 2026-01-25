"use client"

import * as React from "react"
import { useAuth } from "@/components/auth/auth-provider"
import {
  runAutoMigration,
  getMigrationStatus,
  type MigrationResult,
  type MigrationStatus,
} from "@/lib/data/migrate-user-data"

// ============ Migration Context ============

interface MigrationContextType {
  /** Whether migration is currently running */
  isMigrating: boolean
  /** Whether migration has completed for the current user */
  migrationComplete: boolean
  /** Result of the most recent migration */
  migrationResult: MigrationResult | null
  /** Full migration status */
  migrationStatus: MigrationStatus | null
  /** Error message if migration failed */
  error: string | null
}

const defaultMigrationContext: MigrationContextType = {
  isMigrating: false,
  migrationComplete: false,
  migrationResult: null,
  migrationStatus: null,
  error: null,
}

const MigrationContext = React.createContext<MigrationContextType>(defaultMigrationContext)

// ============ Migration Provider Client ============

interface MigrationProviderProps {
  children: React.ReactNode
  /** Whether to show a toast/notification on successful migration */
  showMigrationNotice?: boolean
}

// Inner component that uses hooks - only rendered on client
function MigrationProviderClient({
  children,
  showMigrationNotice = true,
}: MigrationProviderProps) {
  const { user, isAuthenticated, isLoading } = useAuth()

  const [isMigrating, setIsMigrating] = React.useState(false)
  const [migrationComplete, setMigrationComplete] = React.useState(false)
  const [migrationResult, setMigrationResult] = React.useState<MigrationResult | null>(null)
  const [migrationStatus, setMigrationStatus] = React.useState<MigrationStatus | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [hasAttempted, setHasAttempted] = React.useState(false)

  // Run auto-migration when user is authenticated
  React.useEffect(() => {
    // Skip if already attempted, still loading, or not authenticated
    if (hasAttempted || isLoading || !isAuthenticated || !user?.id) {
      return
    }

    const runMigration = async () => {
      setHasAttempted(true)
      setIsMigrating(true)
      setError(null)

      try {
        // Check current status first
        const status = getMigrationStatus(user.id)
        setMigrationStatus(status)

        if (status.migrated) {
          // Already migrated
          setMigrationComplete(true)
          setMigrationResult(status.summary || null)
          console.log("[MigrationProvider] User already migrated")
          return
        }

        // Run the migration
        console.log("[MigrationProvider] Running auto-migration...")
        const result = runAutoMigration(user.id)

        if (result) {
          setMigrationResult(result)
          setMigrationComplete(result.success)

          if (!result.success) {
            setError(`Migration completed with ${result.errors.length} errors`)
          } else if (showMigrationNotice && result.totalItemsMigrated > 0) {
            // Log successful migration
            console.log(
              `[MigrationProvider] Successfully migrated ${result.totalItemsMigrated} items ` +
              `from ${result.migratedKeys.length} data types`
            )
          }

          // Update status
          setMigrationStatus({
            migrated: result.success,
            migratedAt: result.timestamp,
            summary: result,
          })
        } else {
          // No migration needed or already done
          setMigrationComplete(true)
        }
      } catch (err) {
        console.error("[MigrationProvider] Migration failed:", err)
        setError(err instanceof Error ? err.message : "Migration failed")
      } finally {
        setIsMigrating(false)
      }
    }

    runMigration()
  }, [user?.id, isAuthenticated, isLoading, hasAttempted, showMigrationNotice])

  // Reset state when user changes
  React.useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setHasAttempted(false)
      setMigrationComplete(false)
      setMigrationResult(null)
      setMigrationStatus(null)
      setError(null)
    }
  }, [isAuthenticated, user?.id])

  const value = React.useMemo<MigrationContextType>(
    () => ({
      isMigrating,
      migrationComplete,
      migrationResult,
      migrationStatus,
      error,
    }),
    [isMigrating, migrationComplete, migrationResult, migrationStatus, error]
  )

  return (
    <MigrationContext.Provider value={value}>
      {children}
    </MigrationContext.Provider>
  )
}

// ============ Migration Provider ============

export function MigrationProvider({
  children,
  showMigrationNotice = true,
}: MigrationProviderProps) {
  // During SSR/prerendering, provide static context to avoid hooks
  if (typeof window === "undefined") {
    return (
      <MigrationContext.Provider value={defaultMigrationContext}>
        {children}
      </MigrationContext.Provider>
    )
  }

  // Client-side: use the full implementation with hooks
  return (
    <MigrationProviderClient showMigrationNotice={showMigrationNotice}>
      {children}
    </MigrationProviderClient>
  )
}

// ============ Hook ============

export function useMigration() {
  const context = React.useContext(MigrationContext)
  if (!context) {
    throw new Error("useMigration must be used within a MigrationProvider")
  }
  return context
}

// ============ Migration Banner Component ============

/**
 * Optional component to show migration status to users
 * Can be placed in a layout or page to inform users about data migration
 */
export function MigrationBanner() {
  const { isMigrating, migrationResult, error } = useMigration()

  if (!isMigrating && !migrationResult && !error) {
    return null
  }

  if (isMigrating) {
    return (
      <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-4 py-2 text-sm flex items-center gap-2">
        <div className="h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        <span>Migrating your data...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 text-sm">
        Migration warning: {error}
      </div>
    )
  }

  // Only show success message if items were actually migrated
  if (migrationResult && migrationResult.totalItemsMigrated > 0) {
    return (
      <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-2 text-sm">
        Successfully restored {migrationResult.totalItemsMigrated} items from{" "}
        {migrationResult.migratedKeys.length} data categories
      </div>
    )
  }

  return null
}
