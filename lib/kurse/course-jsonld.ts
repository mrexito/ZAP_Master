// Abschnitt 10.4 des Architektur-Briefings (SEO): "Kursdetailseiten erhalten nur dann
// schema.org-Course/Event-JSON-LD, wenn Preis, Anbieter, Termine und Verfügbarkeit aus denselben
// kanonischen Daten stammen; keine Mockupwerte." Dieses Modul ist die einzige Stelle, die diese
// vier Voraussetzungen prüft und JSON-LD baut -- damit keine zweite, abweichende Bewertung
// entsteht.
//
// Alle drei Bedingungen müssen zutreffen, sonst wird gar kein JSON-LD ausgegeben (nie teilweise
// erfundene Werte veröffentlichen):
// - Preis: SHOW_PRICE_PREVIEW_BADGE markiert sitewide, dass aktuell ALLE Preise vorläufig/fiktiv
//   sind (design-reference/design-review-Checkliste, Punkt 1, Stand 23.07.2026). Solange das
//   gilt, würde jeder veröffentlichte Preis Suchmaschinen einen erfundenen Fakt liefern.
// - Termine: nur `session.startAt`/`endAt` als echte ISO-Zeitstempel zählen als kanonisch (bei
//   Intensivkursen aus den echten Ferienwochen/der veröffentlichten Edition abgeleitet, siehe
//   lib/kurse/fixed-school-schedule.ts). Die aus `dateLabel`/`OFFER_DATE_RANGES` geratenen
//   Fallback-Daten aus lib/kurse/session-dates.ts sind nur für die Frühbucher-Anzeige gut genug,
//   nicht für eine an Suchmaschinen kommunizierte Tatsachenbehauptung.
// - Verfügbarkeit: nur kanonisch, wenn tatsächlich in der Live-Abfrage (getSessionAvailability)
//   gefunden -- nicht der optimistische "frei"-Default aus buildSessionRows() für noch nicht
//   materialisierte Vorschau-Sessions.
import type {
  AvailabilityStatus,
  CourseOffer,
  ExamSimulationOffer,
  SessionAvailability,
  SessionDefinition,
} from '@/types/marketing'
import { computeSessionPricing } from '@/lib/pricing'
import { SHOW_PRICE_PREVIEW_BADGE } from '@/lib/kurse/pricing-status'
import { SITE_URL } from '@/lib/seo'

const AVAILABILITY_SCHEMA_URL: Record<AvailabilityStatus, string> = {
  frei: 'https://schema.org/InStock',
  wenige: 'https://schema.org/LimitedAvailability',
  voll: 'https://schema.org/SoldOut',
}

// "Zürich HB" ist der Bahnhof, keine Ortschaft -- für addressLocality dieselbe, bereits an anderer
// Stelle sichtbare Zeichenkette (CourseLocation) auf den eigentlichen Ortsnamen reduzieren.
function addressLocalityFor(standort: SessionDefinition['standort']): string {
  return standort === 'Zürich HB' ? 'Zürich' : standort
}

function courseModeFor(deliveryModes: SessionDefinition['deliveryModes']): 'onsite' | 'online' | 'blended' {
  const hasOnsite = deliveryModes.includes('onsite')
  const hasOnline = deliveryModes.includes('online')
  if (hasOnsite && hasOnline) return 'blended'
  return hasOnline ? 'online' : 'onsite'
}

/**
 * Baut schema.org Course/CourseInstance/Offer-JSON-LD für eine Kurs-/Prüfungssimulations-
 * Detailseite. Liefert `null`, sobald keine einzige Session alle drei Kanonizitäts-Bedingungen
 * erfüllt -- dann gibt es nichts Kanonisches zu veröffentlichen.
 */
export function buildCourseJsonLd(
  offer: CourseOffer | ExamSimulationOffer,
  sessions: SessionDefinition[],
  availabilityByKursId: Map<number, SessionAvailability>,
  locale: string
): string | null {
  if (SHOW_PRICE_PREVIEW_BADGE) return null

  const canonicalUrl = `${SITE_URL}/${locale}${offer.href}`

  const hasCourseInstance = sessions.flatMap((session) => {
    if (!session.startAt || !session.endAt) return []
    const availability = availabilityByKursId.get(session.source.kursId)
    if (!availability) return []

    const pricing = computeSessionPricing(offer.regularPriceRappen, session.startAt)

    return [
      {
        '@type': 'CourseInstance',
        courseMode: courseModeFor(session.deliveryModes),
        startDate: session.startAt,
        endDate: session.endAt,
        location: {
          '@type': 'Place',
          name: session.standort,
          address: {
            '@type': 'PostalAddress',
            addressLocality: addressLocalityFor(session.standort),
            addressCountry: 'CH',
          },
        },
        offers: {
          '@type': 'Offer',
          price: (pricing.effectivePriceRappen / 100).toFixed(2),
          priceCurrency: offer.currency,
          availability: AVAILABILITY_SCHEMA_URL[availability.status],
          url: canonicalUrl,
        },
      },
    ]
  })

  if (hasCourseInstance.length === 0) return null

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: offer.displayName,
    description: offer.description || offer.tagline,
    url: canonicalUrl,
    provider: {
      '@type': 'Organization',
      name: 'Lernecke',
      sameAs: SITE_URL,
    },
    hasCourseInstance,
  }

  // Schutz vor Script-Breakout, falls je ein Textfeld "</script>" enthalten sollte -- Standardmass
  // beim manuellen Einbetten von JSON-LD über dangerouslySetInnerHTML.
  const jsonEscapedLessThan = String.fromCodePoint(92) + 'u003c'
  return JSON.stringify(jsonLd).replaceAll('<', jsonEscapedLessThan)
}
