// Zentrale Preisformatierung für Offer-Preise (design-reference/architektur-briefing-kursseiten.md
// Abschnitt 2.2/2.3). Preise sind immer berechnete Werte, nie ein fertig gepflegter Satz -- diese
// Datei ist die einzige Stelle, die Frühbucherlogik anstellt, damit CourseCard, CourseHero und die
// Terminliste nicht unabhängig voneinander abweichen können (der genaue Bug, den Abschnitt 2.3
// dokumentiert).
//
// Frühbucherrabatt (Betreiberentscheid 27.07.2026): kein manuell gepflegter Frühbucherpreis/
// -Stichtag mehr, sondern automatisch 10% Rabatt, wenn die Anmeldung mindestens 6 Wochen vor dem
// Kursstart der jeweiligen Session erfolgt. Der Stichtag ist damit pro Session unterschiedlich
// (jede Durchführung hat ihr eigenes Startdatum) -- siehe computeSessionPricing(). Die identische
// Regel (10% / 42 Tage) ist serverseitig in book_intensivwoche_kurs() nachgebildet
// (supabase/migrations/20260727170000_automatic_early_bird_discount.sql), wo sie den tatsächlich
// belasteten Preis bestimmt; hier dient sie nur der Anzeige, bevor gebucht wird.
import type { SessionPricing } from '@/types/marketing'

export const EARLY_BIRD_DISCOUNT_PERCENT = 10
export const EARLY_BIRD_LEAD_DAYS = 42

interface OfferPriceInput {
  regularPriceRappen: number
  currency: 'CHF'
  priceUnit?: string
  /** Zeigt an, ob dieses Angebot überhaupt Termine mit Startdatum hat (Selbststudium: nein). */
  hasSessions?: boolean
}

export interface FormattedOfferPrice {
  /** Prominent anzuzeigender Preis (immer der Regulärpreis -- der Rabatt ist pro Session unterschiedlich, siehe SessionRow.pricing). */
  value: string
  /** Zusatzzeile: Frühbucher-Hinweistext bei Angeboten mit Terminen, sonst offer.priceUnit falls gesetzt. */
  note?: string
}

/**
 * Berechnet den tatsächlich geltenden Preis einer einzelnen Session zum Referenzzeitpunkt
 * (Standard: jetzt). 10% Rabatt, wenn der Referenztag höchstens 42 Tage vor startDateIso liegt --
 * ohne bekanntes Startdatum bewusst kein Rabatt (sicherer Default statt versehentlicher Discount).
 */
export function computeSessionPricing(
  regularPriceRappen: number,
  startDateIso: string | undefined,
  referenceDate: Date = new Date()
): SessionPricing {
  const isEarlyBird = isEarlyBirdEligible(startDateIso, referenceDate)
  const effectivePriceRappen = isEarlyBird
    ? Math.round(regularPriceRappen * (1 - EARLY_BIRD_DISCOUNT_PERCENT / 100))
    : regularPriceRappen

  return { regularPriceRappen, effectivePriceRappen, isEarlyBird }
}

const ZURICH_TZ = 'Europe/Zurich'

// en-CA formattiert als YYYY-MM-DD -- praktisch für lexikografischen Datumsvergleich.
function toZurichDateOnly(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZURICH_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

// Kalendertag-Vergleich (nicht Zeitpunkt-Vergleich), damit der Grenztag selbst noch als
// Frühbucher zählt und die Anzeige mit dem ::date-Vergleich in book_intensivwoche_kurs()
// übereinstimmt (supabase/migrations/20260727170000_automatic_early_bird_discount.sql).
function isEarlyBirdEligible(startDateIso: string | undefined, referenceDate: Date): boolean {
  if (!startDateIso) return false

  // Ein reines Datum (z.B. intensivwoche_kurse.start_datum) direkt übernehmen; ein voller
  // ISO-Timestamp wird zuerst auf den Zürcher Kalendertag reduziert.
  const startDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(startDateIso)
    ? startDateIso
    : toZurichDateOnly(new Date(startDateIso))

  // Auf Mittag UTC verankern, damit setUTCDate() nicht durch DST-Randfälle einen Tag verschiebt.
  const startDate = new Date(`${startDateOnly}T12:00:00Z`)
  if (Number.isNaN(startDate.getTime())) return false

  const deadline = new Date(startDate)
  deadline.setUTCDate(deadline.getUTCDate() - EARLY_BIRD_LEAD_DAYS)
  const deadlineDateOnly = deadline.toISOString().slice(0, 10)

  return toZurichDateOnly(referenceDate) <= deadlineDateOnly
}

export function formatChfRappen(rappen: number, locale = 'de-CH'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: rappen % 100 === 0 ? 0 : 2,
  }).format(rappen / 100)
}

interface SubscriptionPlanPriceInput {
  lessons: number
  pricePerLessonRappen: number
  discountPercent?: number
  currency: 'CHF'
}

export function formatSubscriptionPrice(plan: SubscriptionPlanPriceInput, locale = 'de-CH'): FormattedOfferPrice {
  const totalRappen = Math.round(
    plan.pricePerLessonRappen * plan.lessons * (1 - (plan.discountPercent ?? 0) / 100)
  )

  return {
    value: formatChfRappen(totalRappen, locale),
    note: plan.discountPercent
      ? `${formatChfRappen(plan.pricePerLessonRappen, locale)} pro Lektion · ${plan.discountPercent}% Rabatt`
      : `${formatChfRappen(plan.pricePerLessonRappen, locale)} pro Lektion`,
  }
}

export function formatOfferPrice(offer: OfferPriceInput, locale = 'de-CH'): FormattedOfferPrice {
  if (offer.hasSessions) {
    return {
      value: formatChfRappen(offer.regularPriceRappen, locale),
      note: `${EARLY_BIRD_DISCOUNT_PERCENT}% Rabatt bei Anmeldung mindestens 6 Wochen vor Kursstart`,
    }
  }

  return {
    value: formatChfRappen(offer.regularPriceRappen, locale),
    note: offer.priceUnit,
  }
}
