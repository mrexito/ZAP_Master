import Link from 'next/link'
import { ArrowRight, CalendarCheck2 } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/guards'
import { Badge } from '@/app/components/ui/badge'
import {
  getAdminEditionSummaries,
  getAdminOfferList,
} from '@/app/(dashboard)/dashboard/kurse/durchfuehrungen/actions'
import { getAudienceDisplayLabel, KURSTYP_LABELS } from '@/lib/kurse/offer-admin-catalog'

const STATUS_LABELS = {
  draft: 'Entwurf',
  published: 'Veröffentlicht',
  archived: 'Archiviert',
} as const

export default async function TagesfreigabenIndexPage() {
  await requireAdmin()

  const [offerListResult, summariesResult] = await Promise.all([
    getAdminOfferList(),
    getAdminEditionSummaries(),
  ])

  if (!offerListResult.success || !offerListResult.data) {
    return (
      <div className="p-6 lg:p-8">
        <div className="rounded-2xl border border-destructive/50 bg-destructive/10 p-6 text-center text-destructive">
          {!offerListResult.success
            ? offerListResult.error
            : 'Kursangebote konnten nicht geladen werden.'}
        </div>
      </div>
    )
  }

  const summaries =
    summariesResult.success && summariesResult.data ? summariesResult.data : []
  const summaryByOfferId = new Map(summaries.map((summary) => [summary.offerId, summary]))
  const availableOffers = offerListResult.data
    .filter((offer) => offer.kurstyp !== 'selbststudium')
    .flatMap((offer) => {
      const summary = summaryByOfferId.get(offer.offerId)
      return summary ? [{ offer, summary }] : []
    })

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2">
            <CalendarCheck2 className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Tagesfreigaben</h1>
        </div>
        <p className="text-muted-foreground">
          Wähle eine Kursdurchführung, um Übungen und Prüfungen pro Kurstag freizuschalten.
        </p>
      </div>

      {availableOffers.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="font-medium text-foreground">Noch keine Kursdurchführung vorhanden.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Lege zuerst bei einem Kursangebot eine Durchführung an.
          </p>
          <Link
            href="/dashboard/kurse/angebote"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80"
          >
            Zu den Kursangeboten
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {availableOffers.map(({ offer, summary }) => (
            <Link
              key={offer.offerId}
              href={`/dashboard/kurse/angebote/${offer.offerId}/durchfuehrungen/${summary.latestEditionId}/tagesfreigaben`}
              className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                    {getAudienceDisplayLabel(offer.audienceId)}
                  </p>
                  <h2 className="mt-1 font-semibold text-foreground transition-colors group-hover:text-primary">
                    {KURSTYP_LABELS[offer.kurstyp]}
                  </h2>
                </div>
                <Badge variant={summary.status === 'published' ? 'default' : 'secondary'}>
                  {STATUS_LABELS[summary.status]}
                </Badge>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-sm">
                <span className="text-muted-foreground">
                  {summary.latestSchoolYear} · {summary.editionCount} Durchführung(en)
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-primary" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
