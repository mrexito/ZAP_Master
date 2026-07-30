import type { Metadata } from 'next'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { audiences } from '@/app/data/marketing-site'
import type { CourseOffer, ExamSimulationOffer, SelfStudyOffer, SessionDefinition } from '@/types/marketing'
import { buildPageMetadata } from '@/lib/seo'
import { Section } from '@/app/components/layout/section'
import { Breadcrumb } from '@/app/components/marketing/breadcrumb'
import { CourseHero } from '@/app/components/kurse/course-hero'
import { CourseFlow } from '@/app/components/kurse/course-flow'
import { CourseContent } from '@/app/components/kurse/course-content'
import { OverviewPriceBox } from '@/app/components/kurse/overview-price-box'
import { SectionNumberLabel } from '@/app/components/kurse/section-number-label'
import { WhyUsGrid } from '@/app/components/kurse/why-us-grid'
import { Testimonials } from '@/app/components/kurse/testimonials'
import { ExamSimTimeline } from '@/app/components/kurse/exam-sim-timeline'
import { FaqAccordion } from '@/app/components/marketing/faq-accordion'
import { SelfStudyDetail } from '@/app/components/kurse/self-study-detail'
import { BookingSectionWithModal } from '@/app/components/kurse/booking-section-with-modal'
import { ExamSimulationDetail } from '@/app/components/kurse/exam-simulation-detail'
import { getOfferBySlug, getSessionsForOffer } from '@/lib/kurse/catalog'
import { getSessionAvailability } from '@/lib/kurse/availability'
import { buildSessionRows } from '@/lib/kurse/session-row'
import { listCatalogedOfferParams, getSelfStudyPageExtras } from '@/lib/kurse/offer-catalog'
import { buildCourseJsonLd } from '@/lib/kurse/course-jsonld'

type BookableOffer = CourseOffer | ExamSimulationOffer

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    listCatalogedOfferParams().map(({ audience, angebot }) => ({ locale, audience, angebot }))
  )
}

// Hinweis (Schritt 12, Verifikations-Gate): `dynamicParams = false` ist inkompatibel mit
// `nextConfig.cacheComponents`, siehe ausführliche Begründung bei [audience]/page.tsx. Gleiche
// bekannte, dokumentierte Einschränkung gilt hier: der HTTP-Status einer unbekannten
// Angebotskombination kann unter PPR 200 bleiben, obwohl die 404-UI korrekt gerendert wird.

/** CourseOffer (halbjahreskurs/intensivkurs) und ExamSimulationOffer (pruefungssimulation) teilen
 *  denselben Buchungs-Rendering-Pfad (Hero/Flow/Content/Booking). SelfStudyOffer hat keine
 *  Sessions/booking und wird separat in resolveSelfStudyOffer/renderSelfStudyOffer behandelt. */
async function resolveBookableOffer(
  audienceSlug: string,
  offerSlug: string,
  locale: string
): Promise<BookableOffer | null> {
  const audience = audiences.find((a) => a.slug === audienceSlug)
  if (!audience) return null

  const offer = await getOfferBySlug(audience.id, offerSlug, locale)
  if (
    offer == null ||
    (offer.kurstyp !== 'halbjahreskurs' &&
      offer.kurstyp !== 'intensivkurs' &&
      offer.kurstyp !== 'pruefungssimulation')
  ) {
    return null
  }
  return offer
}

async function resolveSelfStudyOffer(
  audienceSlug: string,
  offerSlug: string,
  locale: string
): Promise<SelfStudyOffer | null> {
  const audience = audiences.find((a) => a.slug === audienceSlug)
  if (!audience) return null

  const offer = await getOfferBySlug(audience.id, offerSlug, locale)
  if (offer == null || offer.kurstyp !== 'selbststudium') return null
  return offer
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; audience: string; angebot: string }>
}): Promise<Metadata> {
  const { locale, audience, angebot } = await params
  const path = `/kurse/${audience}/${angebot}`

  const bookableOffer = await resolveBookableOffer(audience, angebot, locale)
  if (bookableOffer) {
    return buildPageMetadata({ title: bookableOffer.displayName, description: bookableOffer.tagline, path, locale })
  }

  const selfStudyOffer = await resolveSelfStudyOffer(audience, angebot, locale)
  if (selfStudyOffer) {
    return buildPageMetadata({ title: selfStudyOffer.displayName, description: selfStudyOffer.tagline, path, locale })
  }

  return {}
}

function SessionTableSkeleton() {
  return (
    <div className="h-48 w-full animate-pulse rounded-xl border border-border bg-muted/40" />
  )
}

async function BookingSectionLoader({
  offer,
  sessions,
  locale,
}: {
  offer: BookableOffer
  sessions: SessionDefinition[]
  locale: string
}) {
  await connection()
  const availability = await getSessionAvailability(sessions.map((session) => session.source.kursId))
  const rows = buildSessionRows(sessions, availability, offer.regularPriceRappen)
  // JSON-LD hängt von derselben ungecachten Verfügbarkeit ab wie die Terminliste selbst und wird
  // deshalb hier statt in generateMetadata() gebaut (Abschnitt 7: Verfügbarkeit bleibt ausserhalb
  // des gecachten Katalogpfads). buildCourseJsonLd() liefert null, solange Preis/Termine/
  // Verfügbarkeit nicht sämtlich kanonisch sind -- siehe lib/kurse/course-jsonld.ts.
  const jsonLd = buildCourseJsonLd(offer, sessions, availability, locale)
  return (
    <>
      {jsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      ) : null}
      <BookingSectionWithModal offer={offer} sessions={rows} />
    </>
  )
}

function SelfStudyOfferPage({ offer, audienceLabel, audienceHref }: { offer: SelfStudyOffer; audienceLabel: string; audienceHref: string }) {
  const extras = getSelfStudyPageExtras(offer.id)
  // Sollte laut Katalog-Wiring immer gesetzt sein (jeder SelfStudyOffer im Katalog hat einen
  // Eintrag in SELF_STUDY_PAGE_EXTRAS) -- Fallback auf offer.lede nur zur Robustheit.
  const hero = extras?.hero ?? { title: offer.displayName, description: offer.lede }
  const accessAction = extras?.accessAction ?? { kind: 'disabled' as const, label: 'Zugang erhalten', disabledReason: 'Buchung folgt in einer späteren Ausbaustufe' }

  return (
    <>
      <Breadcrumb
        items={[{ label: 'Startseite', href: '/' }, { label: audienceLabel, href: audienceHref }, { label: offer.displayName }]}
      />

      <Section spacing="sm">
        <SelfStudyDetail
          offer={offer}
          hero={hero}
          accessAction={accessAction}
          audienceLabel={audienceLabel}
          audienceHref={audienceHref}
        />
      </Section>
    </>
  )
}

export default async function CourseOfferDetailPage({
  params,
}: {
  params: Promise<{ locale: string; audience: string; angebot: string }>
}) {
  const { locale, audience: audienceSlug, angebot } = await params
  setRequestLocale(locale)

  // Beide resolve*-Funktionen validieren audienceSlug bereits intern (audiences.find) -- ein
  // aufgelöstes Offer garantiert also ein vorhandenes audience-Objekt hier.
  const audience = audiences.find((a) => a.slug === audienceSlug)

  const selfStudyOffer = await resolveSelfStudyOffer(audienceSlug, angebot, locale)
  if (selfStudyOffer && audience) {
    return <SelfStudyOfferPage offer={selfStudyOffer} audienceLabel={audience.displayLabel} audienceHref={audience.href} />
  }

  const offer = await resolveBookableOffer(audienceSlug, angebot, locale)
  if (!offer || !audience) notFound()

  const sessions = await getSessionsForOffer(offer.id, locale)
  const isExamSimulation = offer.kurstyp === 'pruefungssimulation'
  const usesReferenceExamLayout =
    isExamSimulation &&
    (offer.id === 'offer-6klasse-pruefungssimulation' ||
      offer.id === 'offer-2-3sek-pruefungssimulation')

  if (usesReferenceExamLayout) {
    return (
      <>
        <Breadcrumb
          items={[{ label: 'Startseite', href: '/' }, { label: audience.displayLabel, href: audience.href }, { label: offer.displayName }]}
        />
        <Section spacing="sm">
          <ExamSimulationDetail
            offer={offer}
            audience={audience}
            booking={
              <Suspense fallback={<SessionTableSkeleton />}>
                <BookingSectionLoader offer={offer} sessions={sessions} locale={locale} />
              </Suspense>
            }
          />
        </Section>
      </>
    )
  }

  return (
    <>
      <Breadcrumb
        items={[{ label: 'Startseite', href: '/' }, { label: audience.displayLabel, href: audience.href }, { label: offer.displayName }]}
      />

      <Section spacing="default">
        <CourseHero offer={offer} audience={audience} />
      </Section>

      {offer.flowSteps.length > 0 ? (
        <Section spacing="sm" variant="muted">
          {!isExamSimulation ? <SectionNumberLabel number={1} label="Kursaufbau" /> : null}
          <CourseFlow steps={offer.flowSteps} />
        </Section>
      ) : null}

      {isExamSimulation && offer.examTimeline.length > 0 ? (
        <Section spacing="sm">
          <ExamSimTimeline segments={offer.examTimeline} />
        </Section>
      ) : null}

      {isExamSimulation && offer.faq.length > 0 ? (
        <Section spacing="sm" variant="muted">
          <FaqAccordion items={offer.faq} />
        </Section>
      ) : null}

      {!isExamSimulation && offer.contentSections.length > 0 ? (
        // bg-ink-pale statt variant="muted" -- eigener, kühlerer Farbton, damit sich diese
        // Sektion sowohl von "Kursaufbau" darüber als auch von "Überblick & Preis" darunter
        // (beide ohne variant, also default) unterscheidet, statt optisch zu verschmelzen.
        <Section spacing="sm" className="bg-ink-pale/50">
          <SectionNumberLabel number={2} label="Kursinhalt" />
          <CourseContent sections={offer.contentSections} openFirstSection={false} />
        </Section>
      ) : null}

      {offer.kurstyp !== 'pruefungssimulation' ? (
        <Section spacing="sm">
          <SectionNumberLabel number={3} label="Überblick & Preis" />
          <OverviewPriceBox offer={offer} />
        </Section>
      ) : null}

      <Section spacing="sm" variant="muted">
        {!isExamSimulation ? <SectionNumberLabel number={4} label={offer.booking.title} /> : null}
        <Suspense fallback={<SessionTableSkeleton />}>
          <BookingSectionLoader offer={offer} sessions={sessions} locale={locale} />
        </Suspense>
      </Section>

      {offer.whyUs.length > 0 ? (
        <Section spacing="sm">
          <WhyUsGrid features={offer.whyUs} />
        </Section>
      ) : null}

      {offer.testimonials && offer.testimonials.length > 0 ? (
        <Section spacing="sm" variant="muted">
          <Testimonials testimonials={offer.testimonials} />
        </Section>
      ) : null}
    </>
  )
}
