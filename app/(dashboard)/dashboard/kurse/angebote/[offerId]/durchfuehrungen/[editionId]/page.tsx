import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/guards'
import {
  getAdminOfferList,
  getEditionsForOffer,
  getEditionDetail,
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

  const offerListResult = await getAdminOfferList()
  if (!offerListResult.success || !offerListResult.data) notFound()
  const offerList = offerListResult.data

  const catalogEntry = offerList.find((entry: AdminOfferListEntry) => entry.offerId === offerId)
  if (!catalogEntry) notFound()

  const editionsResult = await getEditionsForOffer(offerId)
  const editions = editionsResult.success && editionsResult.data ? editionsResult.data : []

  if (editionIdParam === 'neu') {
    return (
      <EditionWorkspace
        key={`${offerId}:neu`}
        offerList={offerList}
        offerId={offerId}
        catalogEntry={catalogEntry}
        editions={editions}
        edition={null}
        editionIdParam="neu"
        sessions={[]}
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
      offerId={offerId}
      catalogEntry={catalogEntry}
      editions={editions}
      edition={detailResult.data.edition}
      editionIdParam={editionIdParam}
      sessions={detailResult.data.sessions}
    />
  )
}
