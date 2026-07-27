// Gecachte Katalog-Loader für die Marketing-Kursseiten (Abschnitt 7, Punkt 1 des
// Architektur-Briefings: stabile Kursdaten über 'use cache'/cacheLife/cacheTag, nie über
// unstable_cache oder Route-Segment-Exports). Verfügbarkeit ist bewusst NICHT hier -- siehe
// lib/kurse/availability.ts, das ungecacht nach connection() aufgerufen wird.

import { createClient } from '@supabase/supabase-js'
import { cacheLife, cacheTag } from 'next/cache'
import type { Database } from '@/types/database'
import type { KursDB } from '@/types/kurs-form'
import type {
  AudienceHeroContent,
  AudienceId,
  CourseOffer,
  ExamSimulationOffer,
  ExistingCourseCardModel,
  SelfStudyOffer,
  SessionDefinition,
} from '@/types/marketing'
import { mapKursRowToExistingCourseCard, mapKlassenstufeToAudienceIds } from './mapper'
import {
  findOfferBySlug,
  findOfferById,
  getAudienceHeroOverride,
  getOfferCatalogEntry,
  getSessionsForOfferId,
} from './offer-catalog'
import { localizeContent, type LocaleOverlay } from '@/lib/i18n/localize-content'
import { AUDIENCE_HERO_TRANSLATIONS, OFFER_TRANSLATIONS, SESSION_TRANSLATIONS } from '@/types/marketing.translations'
import {
  applyFixedIntensiveScheduleToSessions,
  buildFixedIntensiveWeekOptions,
} from '@/lib/kurse/fixed-school-schedule'

// Cookie-freier anon-Client -- innerhalb von 'use cache' ist cookies()/headers() nicht erlaubt.
// Identisches, bereits etabliertes Muster wie getPublicKurse() in app/(public)/kurse/actions.ts.
function createCatalogSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function getExistingCoursesForAudience(
  audienceId: AudienceId
): Promise<ExistingCourseCardModel[]> {
  'use cache'
  cacheLife('hours')
  cacheTag('courses', `courses:audience:${audienceId}`)

  const supabase = createCatalogSupabaseClient()
  const { data, error } = await supabase
    .from('intensivwoche_kurse')
    .select('*')
    .eq('ist_aktiv', true)
    .order('start_datum', { ascending: true })

  if (error) {
    console.error('getExistingCoursesForAudience:', error)
    return []
  }

  return (data as KursDB[])
    .filter((row) => mapKlassenstufeToAudienceIds(row.klassenstufen).includes(audienceId))
    .map(mapKursRowToExistingCourseCard)
    .filter((card): card is ExistingCourseCardModel => card != null)
}

// Abschnitt 2.12: Preise und das Schuljahr der automatischen Intensivkurs-Terminperioden kommen
// über /dashboard/kurse/angebote aus der veröffentlichten Edition. Titel/Tagline/Beschreibung und
// die buchbaren Kursgruppen bleiben bei den Fixtures; nur deren Datumsperioden werden weiter unten
// aus derselben zentralen KW-Logik wie in der Administration erzeugt.
async function applyLivePriceOverrides<T extends CourseOffer | ExamSimulationOffer | SelfStudyOffer>(
  offers: T[]
): Promise<T[]> {
  if (offers.length === 0) return offers

  const supabase = createCatalogSupabaseClient()
  const audienceIds = [...new Set(offers.map((o) => o.audienceId))]

  // Zwei einfache Abfragen statt eines PostgREST-Embeds: robuster gegen die generische
  // Typinferenz der generierten Supabase-Typen bei verschachtelten Selects (bereits an anderer
  // Stelle in diesem Projekt empirisch aufgetreten, siehe
  // app/(dashboard)/dashboard/mail-outbox/actions.ts).
  const { data: offerRows, error: offersError } = await supabase
    .from('offers')
    .select('id, audience_id, kurstyp, slug')
    .in('audience_id', audienceIds)

  if (offersError || !offerRows || offerRows.length === 0) return offers

  const offerIdByKey = new Map<string, number>()
  for (const row of offerRows) {
    offerIdByKey.set(`${row.audience_id}|${row.kurstyp}|${row.slug}`, row.id)
  }

  const { data: editionRows, error: editionsError } = await supabase
    .from('offer_editions')
    .select('offer_id, school_year, regular_price_rappen, early_bird_enabled, early_bird_price_rappen, early_bird_deadline')
    .eq('status', 'published')
    .in('offer_id', offerRows.map((row) => row.id))

  if (editionsError || !editionRows) return offers

  const editionByOfferId = new Map(editionRows.map((row) => [row.offer_id, row]))

  return offers.map((offer) => {
    const offerId = offerIdByKey.get(`${offer.audienceId}|${offer.kurstyp}|${offer.slug}`)
    const liveEdition = offerId != null ? editionByOfferId.get(offerId) : undefined
    if (!liveEdition) return offer

    if (offer.kurstyp === 'selbststudium') {
      return { ...offer, regularPriceRappen: liveEdition.regular_price_rappen }
    }
    const withLivePrice = {
      ...offer,
      regularPriceRappen: liveEdition.regular_price_rappen,
      earlyBirdPriceRappen: liveEdition.early_bird_enabled ? liveEdition.early_bird_price_rappen ?? undefined : undefined,
      earlyBirdDeadline: liveEdition.early_bird_enabled ? liveEdition.early_bird_deadline ?? undefined : undefined,
    }
    return offer.kurstyp === 'intensivkurs'
      ? {
          ...withLivePrice,
          weekOptions: buildFixedIntensiveWeekOptions(liveEdition.school_year, offer.audienceId),
        }
      : withLivePrice
  })
}

async function getPublishedSchoolYear(
  offer: CourseOffer | ExamSimulationOffer | SelfStudyOffer
): Promise<string | null> {
  const supabase = createCatalogSupabaseClient()
  const { data: offerRow, error: offerError } = await supabase
    .from('offers')
    .select('id')
    .eq('audience_id', offer.audienceId)
    .eq('kurstyp', offer.kurstyp)
    .eq('slug', offer.slug)
    .maybeSingle()

  if (offerError || !offerRow) return null

  const { data: editionRow, error: editionError } = await supabase
    .from('offer_editions')
    .select('school_year')
    .eq('offer_id', offerRow.id)
    .eq('status', 'published')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return editionError ? null : editionRow?.school_year ?? null
}

// Wendet das englische Uebersetzungs-Overlay (falls vorhanden) auf ein einzelnes Angebot an --
// keyed auf die stabile Fixture-id. Bei locale === "de" oder fehlendem Overlay ein reiner
// Passthrough, siehe lib/i18n/localize-content.ts.
function localizeOffer<T extends CourseOffer | ExamSimulationOffer | SelfStudyOffer>(
  offer: T,
  locale: string
): T {
  const overlay = OFFER_TRANSLATIONS[offer.id] as LocaleOverlay<T> | undefined
  return localizeContent(offer, overlay, locale)
}

export async function getOfferCatalogForAudience(
  audienceId: AudienceId,
  locale: string
): Promise<{
  offers: CourseOffer[]
  addOnOffers: (ExamSimulationOffer | SelfStudyOffer)[]
}> {
  'use cache'
  cacheLife('hours')
  cacheTag('offers', `offers:${audienceId}`)

  const entry = getOfferCatalogEntry(audienceId)
  const [offers, addOnOffers] = await Promise.all([
    applyLivePriceOverrides(entry.offers),
    applyLivePriceOverrides(entry.addOnOffers),
  ])
  return {
    offers: offers.map((offer) => localizeOffer(offer, locale)),
    addOnOffers: addOnOffers.map((offer) => localizeOffer(offer, locale)),
  }
}

export async function getAudienceHero(
  audienceId: AudienceId,
  fallback: AudienceHeroContent,
  locale: string
): Promise<AudienceHeroContent> {
  'use cache'
  cacheLife('hours')
  cacheTag('offers', `offers:${audienceId}`)

  const hero = getAudienceHeroOverride(audienceId) ?? fallback
  return localizeContent(hero, AUDIENCE_HERO_TRANSLATIONS[audienceId], locale)
}

export async function getOfferBySlug(
  audienceId: AudienceId,
  offerSlug: string,
  locale: string
): Promise<CourseOffer | ExamSimulationOffer | SelfStudyOffer | null> {
  'use cache'
  cacheLife('hours')
  cacheTag('offers', `offers:${audienceId}`)

  const offer = findOfferBySlug(audienceId, offerSlug)
  if (!offer) return null
  const [withLivePrice] = await applyLivePriceOverrides([offer])
  return localizeOffer(withLivePrice, locale)
}

export async function getSessionsForOffer(offerId: string, locale: string): Promise<SessionDefinition[]> {
  'use cache'
  cacheLife('hours')
  // Das Schuljahr der generierten Intensivkursperioden kommt aus offer_editions. Admin-Speichern
  // invalidiert den globalen "offers"-Tag; deshalb muss neben Kurs-/Verfügbarkeitsänderungen auch
  // dieser Tag die gecachten öffentlichen Sessionperioden erneuern.
  cacheTag('offers', 'courses', `course:${offerId}`)

  const offer = findOfferById(offerId)
  const fixtureSessions = getSessionsForOfferId(offerId)
  const sessions =
    offer?.kurstyp === 'intensivkurs'
      ? applyFixedIntensiveScheduleToSessions(
          fixtureSessions,
          (await getPublishedSchoolYear(offer)) ?? '2026/27',
          offer.audienceId
        )
      : fixtureSessions

  return sessions.map((session) =>
    localizeContent(session, SESSION_TRANSLATIONS[session.id], locale)
  )
}
