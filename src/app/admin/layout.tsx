"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth/auth-provider"
import {
  LayoutDashboard,
  Mail,
  Users,
  Settings,
  Shield,
  ShieldAlert,
  ArrowLeft,
  Loader2,
  Briefcase,
} from "lucide-react"

interface NavItem {
  title: string
  href: string
  icon: React.ElementType
}

const adminNavItems: NavItem[] = [
  { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { title: "Invites", href: "/admin/invites", icon: Mail },
  { title: "Users", href: "/admin/users", icon: Users },
  { title: "Referrals", href: "/admin/referrals", icon: Briefcase },
  { title: "Security", href: "/admin/security", icon: ShieldAlert },
  { title: "Settings", href: "/admin/settings", icon: Settings },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isLoading } = useAuth()

  // Redirect non-admin users
  React.useEffect(() => {
    if (!isLoading && (!user || user.role !== "admin")) {
      router.push("/")
    }
  }, [user, isLoading, router])

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Don't render anything if not admin
  if (!user || user.role !== "admin") {
    return null
  }

  return (
    <div className="flex h-full">
      {/* Admin Sidebar */}
      <aside className="w-56 border-r bg-card flex flex-col">
        {/* Header */}
        <div className="h-14 flex items-center gap-2 border-b px-4">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-semibold text-primary">Admin Panel</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-2">
          {adminNavItems.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.title}</span>
              </Link>
            )
          })}
        </nav>

        {/* Back to App */}
        <div className="border-t p-2">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span>Back to App</span>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
