import { createAdminSupabaseClient } from "@/lib/supabase/server"
import { audiences } from "@/app/data/marketing-site"
import { SUBJECT_TO_FACH } from "@/lib/kurse/mapper"
import { findOfferById, findSessionByKursId } from "@/lib/kurse/offer-catalog"
import type { SessionDefinition } from "@/types/marketing"

const OFFER_DATE_RANGES: Record<string, { start: string; end: string }> = {
  "offer-4klasse-halbjahreskurs": { start: "2027-03-01", end: "2027-07-31" },
  "offer-5klasse-halbjahreskurs": { start: "2027-05-01", end: "2027-07-31" },
  "offer-1sek-vorkurs": { start: "2027-05-01", end: "2027-07-31" },
  "offer-2-3sek-halbjahreskurs": { start: "2026-09-01", end: "2027-03-31" },
  "offer-6klasse-halbjahreskurs": { start: "2026-09-01", end: "2027-03-31" },
  "offer-matura-halbjahreskurs": { start: "2026-11-01", end: "2027-04-30" },
}

const MONTHS: Record<string, number> = {
  Feb: 2,
  Februar: 2,
  März: 3,
  April: 4,
  Mai: 5,
}

/**
 * Redaktionelle Sessions besitzen stabile, serverseitig bekannte IDs. Falls eine solche Session
 * noch nicht in der Legacy-Buchungstabelle existiert, wird sie unmittelbar vor der ersten
 * Anmeldung idempotent materialisiert. Clientdaten bestimmen dabei weder Preis noch Termin.
 */
export async function ensureMarketingSessionIsBookable(kursId: number): Promise<void> {
  const supabase = createAdminSupabaseClient()
  const { data: existing, error: lookupError } = await supabase
    .from("intensivwoche_kurse")
    .select("id")
    .eq("id", kursId)
    .maybeSingle()

  if (lookupError) {
    throw new Error(`Kurs konnte nicht geprüft werden: ${lookupError.message}`)
  }
  if (existing) return

  const session = findSessionByKursId(kursId)
  if (!session) return

  const offer = findOfferById(session.offerId)
  if (!offer || offer.kurstyp === "selbststudium") return

  const dates = resolveSessionDates(session)
  if (!dates) {
    throw new Error(`Für die Session ${kursId} ist kein verbindlicher Zeitraum hinterlegt.`)
  }

  const audienceLabel =
    audiences.find((audience) => audience.id === offer.audienceId)?.displayLabel ?? offer.audienceId
  const fach =
    offer.subject && offer.subject !== "mixed" ? SUBJECT_TO_FACH[offer.subject] : "deutsch"

  const { error: insertError } = await supabase.from("intensivwoche_kurse").upsert(
    {
      id: kursId,
      name: `${offer.displayName} – ${session.kurs}`,
      fach,
      beschreibung: offer.description,
      detail_beschreibung: offer.lede,
      start_datum: dates.start,
      end_datum: dates.end,
      uhrzeit: session.timeLabel,
      ort: session.standort,
      preis: offer.regularPriceRappen / 100,
      max_teilnehmer: session.capacity,
      klassenstufen: [audienceLabel],
      lehrer: "ZAP",
      highlights: offer.features,
      ist_aktiv: true,
    },
    { onConflict: "id", ignoreDuplicates: true }
  )

  if (insertError) {
    throw new Error(`Kurs konnte nicht für die Buchung angelegt werden: ${insertError.message}`)
  }
}

function resolveSessionDates(
  session: SessionDefinition
): { start: string; end: string } | null {
  if (session.startAt && session.endAt) {
    return { start: session.startAt.slice(0, 10), end: session.endAt.slice(0, 10) }
  }

  const fixedRange = OFFER_DATE_RANGES[session.offerId]
  if (fixedRange) return fixedRange

  const range = session.dateLabel.match(
    /(\d{1,2})\.\s*[–-]\s*(\d{1,2})\.\s*(Feb(?:ruar)?|März|April|Mai)/
  )
  if (range) {
    const month = MONTHS[range[3]]
    return {
      start: isoDate(2027, month, Number(range[1])),
      end: isoDate(2027, month, Number(range[2])),
    }
  }

  const singleDay = session.dateLabel.match(/(\d{1,2})\.\s*(Februar|März|April|Mai)/)
  if (singleDay) {
    const date = isoDate(2027, MONTHS[singleDay[2]], Number(singleDay[1]))
    return { start: date, end: date }
  }

  return null
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}
