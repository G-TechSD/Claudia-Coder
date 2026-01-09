"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  Briefcase,
  MapPin,
  Star,
  Mail,
  Globe,
  Phone,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Info,
  Filter,
  Search,
  ExternalLink,
} from "lucide-react"

// ============ Types ============

interface Attorney {
  id: string
  name: string
  firm: string
  specialty: string[]
  location: string
  rating: number
  commissionRate: number
  email?: string
  phone?: string
  website?: string
  bio?: string
  active: boolean
}

interface Referral {
  id: string
  userId: string
  patentId: string
  attorneyId: string
  status: "pending" | "contacted" | "consultation_scheduled" | "converted" | "declined" | "expired"
  commissionRate: number
  commissionAmount?: number
  commissionStatus: "pending" | "earned" | "paid"
  referredAt: string
  contactedAt?: string
  convertedAt?: string
  attorneyName: string
  attorneyFirm: string
}

interface AttorneyReferralsProps {
  patentId: string
  patentTitle?: string
  onReferralCreated?: (referral: Referral) => void
}

// ============ Status Configuration ============

const statusConfig = {
  pending: { label: "Pending", color: "text-yellow-400", bg: "bg-yellow-500/20", icon: Clock },
  contacted: { label: "Contacted", color: "text-blue-400", bg: "bg-blue-500/20", icon: Mail },
  consultation_scheduled: { label: "Scheduled", color: "text-purple-400", bg: "bg-purple-500/20", icon: Clock },
  converted: { label: "Engaged", color: "text-green-400", bg: "bg-green-500/20", icon: CheckCircle },
  declined: { label: "Declined", color: "text-red-400", bg: "bg-red-500/20", icon: XCircle },
  expired: { label: "Expired", color: "text-muted-foreground", bg: "bg-muted", icon: Clock },
}

// ============ Helper Functions ============

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function renderStars(rating: number): React.ReactNode {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            "h-3.5 w-3.5",
            star <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"
          )}
        />
      ))}
      <span className="ml-1 text-sm text-muted-foreground">{rating.toFixed(1)}</span>
    </div>
  )
}

// ============ Component ============

export function AttorneyReferrals({
  patentId,
  patentTitle,
  onReferralCreated,
}: AttorneyReferralsProps) {
  // State
  const [attorneys, setAttorneys] = React.useState<Attorney[]>([])
  const [userReferrals, setUserReferrals] = React.useState<Referral[]>([])
  const [patentReferrals, setPatentReferrals] = React.useState<Referral[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [commissionDisclosure, setCommissionDisclosure] = React.useState<string>("")

  // Filters
  const [specialties, setSpecialties] = React.useState<string[]>([])
  const [locations, setLocations] = React.useState<string[]>([])
  const [selectedSpecialty, setSelectedSpecialty] = React.useState<string>("")
  const [selectedLocation, setSelectedLocation] = React.useState<string>("")
  const [searchQuery, setSearchQuery] = React.useState("")

  // Referral dialog
  const [selectedAttorney, setSelectedAttorney] = React.useState<Attorney | null>(null)
  const [referralDialogOpen, setReferralDialogOpen] = React.useState(false)
  const [referralNotes, setReferralNotes] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)

  // Fetch attorneys
  const fetchAttorneys = React.useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (selectedSpecialty) params.set("specialty", selectedSpecialty)
      if (selectedLocation) params.set("location", selectedLocation)
      if (patentId) params.set("patentId", patentId)

      const res = await fetch(`/api/patents/attorneys?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to fetch attorneys")

      const data = await res.json()
      setAttorneys(data.attorneys)
      setUserReferrals(data.userReferrals || [])
      setPatentReferrals(data.patentReferrals || [])
      setSpecialties(data.filters?.specialties || [])
      setLocations(data.filters?.locations || [])
      setCommissionDisclosure(data.commissionDisclosure || "")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load attorneys")
    } finally {
      setLoading(false)
    }
  }, [selectedSpecialty, selectedLocation, patentId])

  React.useEffect(() => {
    fetchAttorneys()
  }, [fetchAttorneys])

  // Filter attorneys by search query
  const filteredAttorneys = React.useMemo(() => {
    if (!searchQuery) return attorneys
    const query = searchQuery.toLowerCase()
    return attorneys.filter(
      (a) =>
        a.name.toLowerCase().includes(query) ||
        a.firm.toLowerCase().includes(query) ||
        a.specialty.some((s) => s.toLowerCase().includes(query))
    )
  }, [attorneys, searchQuery])

  // Check if user has an existing referral to an attorney
  const hasExistingReferral = (attorneyId: string): Referral | undefined => {
    return patentReferrals.find(
      (r) =>
        r.attorneyId === attorneyId &&
        ["pending", "contacted", "consultation_scheduled"].includes(r.status)
    )
  }

  // Handle referral submission
  const handleSubmitReferral = async () => {
    if (!selectedAttorney) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      const res = await fetch("/api/patents/attorneys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attorneyId: selectedAttorney.id,
          patentId,
          notes: referralNotes,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit referral")
      }

      // Success - close dialog and refresh
      setReferralDialogOpen(false)
      setReferralNotes("")
      setSelectedAttorney(null)
      await fetchAttorneys()

      if (onReferralCreated && data.referral) {
        onReferralCreated(data.referral)
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to submit referral")
    } finally {
      setSubmitting(false)
    }
  }

  // Open referral dialog
  const openReferralDialog = (attorney: Attorney) => {
    setSelectedAttorney(attorney)
    setReferralNotes("")
    setSubmitError(null)
    setReferralDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg font-medium">Failed to load attorneys</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Patent Attorney Referrals</h2>
        <p className="text-sm text-muted-foreground">
          Connect with experienced patent attorneys who can help protect your invention
        </p>
      </div>

      {/* Commission Disclosure */}
      {commissionDisclosure && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <Info className="h-5 w-5 text-blue-400 flex-none mt-0.5" />
          <p className="text-sm text-blue-400">{commissionDisclosure}</p>
        </div>
      )}

      {/* Existing Referrals for this Patent */}
      {patentReferrals.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Your Referrals</CardTitle>
            <CardDescription>Active and past referrals for this patent</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {patentReferrals.map((referral) => {
                const config = statusConfig[referral.status]
                const Icon = config.icon
                return (
                  <div
                    key={referral.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 rounded-lg", config.bg)}>
                        <Icon className={cn("h-4 w-4", config.color)} />
                      </div>
                      <div>
                        <p className="font-medium">{referral.attorneyName}</p>
                        <p className="text-sm text-muted-foreground">{referral.attorneyFirm}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={cn(config.bg, config.color)}>{config.label}</Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(referral.referredAt)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base font-medium">Filter Attorneys</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Search */}
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Name, firm, or specialty..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Specialty Filter */}
            <div className="space-y-2">
              <Label>Specialty</Label>
              <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                <SelectTrigger>
                  <SelectValue placeholder="All specialties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All specialties</SelectItem>
                  {specialties.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Location Filter */}
            <div className="space-y-2">
              <Label>Location</Label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="All locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All locations</SelectItem>
                  {locations.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attorney List */}
      <div className="grid gap-4 md:grid-cols-2">
        {filteredAttorneys.map((attorney) => {
          const existingReferral = hasExistingReferral(attorney.id)
          return (
            <Card key={attorney.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="p-4 space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{attorney.name}</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Briefcase className="h-3.5 w-3.5" />
                        {attorney.firm}
                      </p>
                    </div>
                    {renderStars(attorney.rating)}
                  </div>

                  {/* Location */}
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {attorney.location}
                  </div>

                  {/* Specialties */}
                  <div className="flex flex-wrap gap-1.5">
                    {attorney.specialty.map((s) => (
                      <Badge key={s} variant="secondary" className="text-xs">
                        {s.replace(/-/g, " ")}
                      </Badge>
                    ))}
                  </div>

                  {/* Bio */}
                  {attorney.bio && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{attorney.bio}</p>
                  )}

                  {/* Contact Links */}
                  <div className="flex items-center gap-3 text-sm">
                    {attorney.email && (
                      <a
                        href={`mailto:${attorney.email}`}
                        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        Email
                      </a>
                    )}
                    {attorney.website && (
                      <a
                        href={attorney.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Globe className="h-3.5 w-3.5" />
                        Website
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {attorney.phone && (
                      <a
                        href={`tel:${attorney.phone}`}
                        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        Call
                      </a>
                    )}
                  </div>

                  {/* Commission Rate */}
                  <div className="text-xs text-muted-foreground">
                    Referral commission: {attorney.commissionRate}%
                  </div>
                </div>

                {/* Action */}
                <div className="p-4 pt-0">
                  {existingReferral ? (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                      <span className="text-sm">Referral {statusConfig[existingReferral.status].label.toLowerCase()}</span>
                      <Badge className={cn(
                        statusConfig[existingReferral.status].bg,
                        statusConfig[existingReferral.status].color
                      )}>
                        {statusConfig[existingReferral.status].label}
                      </Badge>
                    </div>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => openReferralDialog(attorney)}
                    >
                      Request Consultation
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filteredAttorneys.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Briefcase className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-lg font-medium">No attorneys found</p>
          <p className="text-sm text-muted-foreground">
            Try adjusting your filters or search query
          </p>
        </div>
      )}

      {/* Referral Dialog */}
      <Dialog open={referralDialogOpen} onOpenChange={setReferralDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Consultation</DialogTitle>
            <DialogDescription>
              Submit a referral request to {selectedAttorney?.name} at {selectedAttorney?.firm}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Attorney Info */}
            {selectedAttorney && (
              <div className="p-4 rounded-lg bg-muted">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium">{selectedAttorney.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedAttorney.firm}</p>
                  </div>
                  {renderStars(selectedAttorney.rating)}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selectedAttorney.specialty.map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs">
                      {s.replace(/-/g, " ")}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Patent Info */}
            {patentTitle && (
              <div className="space-y-2">
                <Label>Patent/Idea</Label>
                <p className="text-sm p-3 rounded-lg bg-muted">{patentTitle}</p>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes for the Attorney (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Describe your invention or any specific questions..."
                value={referralNotes}
                onChange={(e) => setReferralNotes(e.target.value)}
                rows={4}
              />
            </div>

            {/* Commission Disclosure */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Info className="h-4 w-4 text-blue-400 flex-none mt-0.5" />
              <p className="text-xs text-blue-400">
                A {selectedAttorney?.commissionRate}% referral commission may apply if you engage this
                attorney&apos;s services. This does not affect the fees you pay.
              </p>
            </div>

            {/* Error */}
            {submitError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {submitError}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setReferralDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmitReferral} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Request"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AttorneyReferrals
