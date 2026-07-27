import { createAdminSupabaseClient } from "@/lib/supabase/server"
import { audiences } from "@/app/data/marketing-site"
import { SUBJECT_TO_FACH } from "@/lib/kurse/mapper"
import { findOfferById, findSessionByKursId } from "@/lib/kurse/offer-catalog"
import { resolveSessionDates } from "@/lib/kurse/session-dates"

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
