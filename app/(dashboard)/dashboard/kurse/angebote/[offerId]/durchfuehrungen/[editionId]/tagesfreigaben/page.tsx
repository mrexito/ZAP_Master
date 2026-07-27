import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireContentManager } from '@/lib/auth/guards'
import { getAdminOfferList, getEditionDetail } from '@/app/(dashboard)/dashboard/kurse/durchfuehrungen/actions'
import { getSessionsForEdition } from '@/app/(dashboard)/dashboard/kurse/durchfuehrungen/tagesfreigaben-actions'
import { DailyReleaseManager } from '@/app/components/kurse-admin/daily-release-manager'

export default async function TagesfreigabenPage({
  params,
}: {
  params: Promise<{ offerId: string; editionId: string }>
}) {
  await requireContentManager()

  const { offerId: offerIdParam, editionId } = await params
  const offerId = Number(offerIdParam)
  if (!Number.isInteger(offerId)) notFound()

  const [offerListResult, editionResult] = await Promise.all([getAdminOfferList(), getEditionDetail(editionId)])

  if (!offerListResult.success || !offerListResult.data) notFound()
  const catalogEntry = offerListResult.data.find((entry) => entry.offerId === offerId)
  if (!catalogEntry) notFound()

  if (!editionResult.success || !editionResult.data) notFound()
  if (editionResult.data.edition.offer_id !== offerId) notFound()

  const sessionsResult = await getSessionsForEdition(editionId)
  const sessions = sessionsResult.success && sessionsResult.data ? sessionsResult.data : []

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <Link
          href={`/dashboard/kurse/angebote/${offerId}/durchfuehrungen/${editionId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {catalogEntry.label} · {editionResult.data.edition.school_year}
        </Link>
        <h1 className="text-2xl font-bold text-foreground mt-1">Tagesfreigaben</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Lerneinheiten und Übungen gezielt für die heutige Sitzung freigeben.
        </p>
      </div>

      <DailyReleaseManager offerId={offerId} editionId={editionId} sessions={sessions} />
    </div>
  )
}
