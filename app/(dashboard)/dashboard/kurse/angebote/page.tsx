import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/guards'
import {
  getAdminEditionSummaries,
  getAdminOfferList,
} from '@/app/(dashboard)/dashboard/kurse/durchfuehrungen/actions'

export default async function KursangeboteAdminPage() {
  await requireAdmin()

  const [offersResult, summariesResult] = await Promise.all([
    getAdminOfferList(),
    getAdminEditionSummaries(),
  ])

  const firstOffer = offersResult.success ? offersResult.data?.[0] : null

  if (!firstOffer) {
    return (
      <div className="p-6 lg:p-8">
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-6 text-center text-destructive">
          {!offersResult.success
            ? offersResult.error
            : 'Der Angebotskatalog enthält noch keine Kursangebote.'}
        </div>
      </div>
    )
  }

  const summaries =
    summariesResult.success && summariesResult.data ? summariesResult.data : []
  const summary = summaries.find((entry) => entry.offerId === firstOffer.offerId)

  redirect(
    `/dashboard/kurse/angebote/${firstOffer.offerId}/durchfuehrungen/${summary?.latestEditionId ?? 'neu'}`
  )
}
