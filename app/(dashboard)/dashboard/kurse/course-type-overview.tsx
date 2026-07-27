import Link from 'next/link'
import { BookOpen, CalendarDays, ChevronRight, CirclePlus, Layers3 } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import {
  getAdminEditionSummaries,
  getAdminOfferList,
  type AdminOfferListEntry,
  type EditionSummary,
} from '@/app/(dashboard)/dashboard/kurse/durchfuehrungen/actions'
import { getAudienceDisplayLabel } from '@/lib/kurse/offer-admin-catalog'

type OverviewCourseType = 'intensivkurs' | 'halbjahreskurs'

type CourseTypeOverviewProps = {
  courseType: OverviewCourseType
  title: string
  description: string
  emptyLabel: string
}

const STATUS_LABELS: Record<EditionSummary['status'], string> = {
  draft: 'Entwurf',
  published: 'Veröffentlicht',
  archived: 'Archiviert',
}

const STATUS_STYLES: Record<EditionSummary['status'], string> = {
  draft: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  published: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  archived: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

export async function CourseTypeOverview({
  courseType,
  title,
  description,
  emptyLabel,
}: CourseTypeOverviewProps) {
  const [offersResult, summariesResult] = await Promise.all([
    getAdminOfferList(),
    getAdminEditionSummaries(),
  ])

  if (!offersResult.success) {
    return (
      <div className="rounded-2xl border border-destructive/50 bg-destructive/10 p-6 text-center">
        <p className="text-destructive">{offersResult.error}</p>
      </div>
    )
  }

  if (!summariesResult.success) {
    return (
      <div className="rounded-2xl border border-destructive/50 bg-destructive/10 p-6 text-center">
        <p className="text-destructive">{summariesResult.error}</p>
      </div>
    )
  }

  const offers = (offersResult.data ?? []).filter((offer) => offer.kurstyp === courseType)
  const summariesByOffer = new Map(
    (summariesResult.data ?? []).map((summary) => [summary.offerId, summary])
  )
  const publishedCount = offers.filter(
    (offer) => summariesByOffer.get(offer.offerId)?.status === 'published'
  ).length
  const missingEditionCount = offers.filter(
    (offer) => !summariesByOffer.has(offer.offerId)
  ).length

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            Administration · Kurse
          </p>
          <h1 className="text-3xl font-bold text-foreground">{title}</h1>
          <p className="mt-1 text-muted-foreground">{description}</p>
        </div>
        <Link href="/dashboard/kurse/angebote">
          <Button variant="outline" className="rounded-xl">
            <BookOpen className="mr-2 h-4 w-4" />
            Zentrale Angebotsverwaltung
          </Button>
        </Link>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={Layers3} label="Angebote" value={offers.length} />
        <SummaryCard icon={CalendarDays} label="Veröffentlicht" value={publishedCount} />
        <SummaryCard icon={CirclePlus} label="Ohne Durchführung" value={missingEditionCount} />
      </div>

      {offers.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <BookOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
          <h2 className="text-lg font-semibold text-foreground">{emptyLabel}</h2>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Kursangebot
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Zielgruppe
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Aktuelle Durchführung
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {offers.map((offer) => (
                  <CourseOfferRow
                    key={offer.offerId}
                    offer={offer}
                    summary={summariesByOffer.get(offer.offerId)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: number
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  )
}

function CourseOfferRow({
  offer,
  summary,
}: {
  offer: AdminOfferListEntry
  summary?: EditionSummary
}) {
  const manageHref = `/dashboard/kurse/angebote/${offer.offerId}/durchfuehrungen/${
    summary?.latestEditionId ?? 'neu'
  }`

  return (
    <tr className="transition-colors hover:bg-muted/30">
      <td className="px-4 py-4">
        <p className="font-medium text-foreground">{offer.label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{offer.slug}</p>
      </td>
      <td className="px-4 py-4 text-sm text-foreground">
        {getAudienceDisplayLabel(offer.audienceId)}
      </td>
      <td className="px-4 py-4">
        {summary ? (
          <>
            <p className="text-sm font-medium text-foreground">{summary.latestSchoolYear}</p>
            <p className="text-xs text-muted-foreground">
              {summary.editionCount} Durchführung{summary.editionCount === 1 ? '' : 'en'}
            </p>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Noch nicht angelegt</span>
        )}
      </td>
      <td className="px-4 py-4">
        {summary ? (
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
              STATUS_STYLES[summary.status]
            }`}
          >
            {STATUS_LABELS[summary.status]}
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            Nicht angelegt
          </span>
        )}
      </td>
      <td className="px-4 py-4 text-right">
        <Link
          href={manageHref}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {summary ? 'Verwalten' : 'Durchführung anlegen'}
          <ChevronRight className="h-4 w-4" />
        </Link>
      </td>
    </tr>
  )
}
