import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/guards'
import {
  getAdminOfferList,
  getAdminEditionSummaries,
  getEditionsForOffer,
  getEditionDetail,
  getSchoolHolidayWeeks,
  type AdminOfferListEntry,
} from '@/app/(dashboard)/dashboard/kurse/durchfuehrungen/actions'
import { EditionWorkspace } from './edition-workspace'

export default async function OfferEditionPage({
  params,
}: {
  params: Promise<{ offerId: string; editionId: string }>
}) {
  // Schritt 10a: Preisänderung/Publizieren/Archivieren sind laut Abschnitt 2.12 admin-only --
  // derselbe Massstab wie die zugrundeliegenden RLS-Policies (is_admin(), Migration
  // 20260721074500), nicht nur requireContentManager() wie beim bestehenden /dashboard/kurse-CRUD.
  await requireAdmin()

  const { offerId: offerIdParam, editionId: editionIdParam } = await params
  const offerId = Number(offerIdParam)
  if (!Number.isInteger(offerId)) notFound()

  const [offerListResult, summariesResult] = await Promise.all([
    getAdminOfferList(),
    getAdminEditionSummaries(),
  ])
  if (!offerListResult.success || !offerListResult.data) notFound()
  const offerList = offerListResult.data

  const catalogEntry = offerList.find((entry: AdminOfferListEntry) => entry.offerId === offerId)
  if (!catalogEntry) notFound()

  // Für den "Kursangebot"-Wechsel im Bearbeitungskontext: navigiert auf die neueste Durchführung
  // des NEU gewählten Angebots (wie /dashboard/kurse/angebote/page.tsx beim initialen Redirect),
  // statt immer auf eine leere "neu"-Durchführung -- sonst würde jeder Angebotswechsel den
  // bestehenden Preis/Termine verstecken, obwohl bereits eine Durchführung existiert.
  const summaries = summariesResult.success && summariesResult.data ? summariesResult.data : []
  const latestEditionByOffer = Object.fromEntries(
    summaries.map((summary) => [summary.offerId, summary.latestEditionId])
  )

  const editionsResult = await getEditionsForOffer(offerId)
  const editions = editionsResult.success && editionsResult.data ? editionsResult.data : []

  const holidayWeeksResult = await getSchoolHolidayWeeks()
  const holidayWeeks = holidayWeeksResult.success && holidayWeeksResult.data ? holidayWeeksResult.data : []

  if (editionIdParam === 'neu') {
    return (
      <EditionWorkspace
        key={`${offerId}:neu`}
        offerList={offerList}
        latestEditionByOffer={latestEditionByOffer}
        offerId={offerId}
        catalogEntry={catalogEntry}
        editions={editions}
        edition={null}
        editionIdParam="neu"
        sessions={[]}
        holidayWeeks={holidayWeeks}
      />
    )
  }

  const detailResult = await getEditionDetail(editionIdParam)
  if (!detailResult.success || !detailResult.data) notFound()
  if (detailResult.data.edition.offer_id !== offerId) notFound()

  return (
    <EditionWorkspace
      key={`${offerId}:${editionIdParam}`}
      offerList={offerList}
      latestEditionByOffer={latestEditionByOffer}
      offerId={offerId}
      catalogEntry={catalogEntry}
      editions={editions}
      edition={detailResult.data.edition}
      editionIdParam={editionIdParam}
      sessions={detailResult.data.sessions}
      holidayWeeks={holidayWeeks}
    />
  )
}
