'use server'

import { unstable_cache } from 'next/cache'
import { after } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { type KursDBMitAnmeldungen } from '@/types/kurs-form'
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from '@/lib/supabase/server'
import {
  intensivwocheAnmeldungSchema,
  type IntensivwocheAnmeldungInput,
} from '@/types/intensivwoche'
import {
  logBookingRejected,
  logRateLimitRejected,
  logBookingUnexpectedError,
} from '@/lib/observability/logger'
import { dispatchOutboxForAnmeldung } from '@/lib/mail/dispatch-outbox'
import { ensureMarketingSessionIsBookable } from '@/lib/kurse/ensure-bookable-session'

export const getPublicKurse = unstable_cache(
  async (): Promise<KursDBMitAnmeldungen[]> => {
    // Cookie-free client inside unstable_cache (public data, no auth needed)
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data, error } = await supabase
      .from('intensivwoche_kurse_mit_anmeldungen')
      .select('*')
      .eq('ist_aktiv', true)
      .order('start_datum', { ascending: true })

    if (error) {
      console.error('Supabase Error:', error)
      return []
    }

    return data as KursDBMitAnmeldungen[]
  },
  ['public-kurse'],
  { revalidate: 300 }
)

export type AnmeldungResult =
  | { success: true; message: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> }

export async function submitIntensivwocheAnmeldung(
  data: IntensivwocheAnmeldungInput,
  idempotencyKey: string
): Promise<AnmeldungResult> {
  const parsed = intensivwocheAnmeldungSchema.safeParse(data)

  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    parsed.error.issues.forEach((err) => {
      const field = err.path[0] as string
      if (!fieldErrors[field]) fieldErrors[field] = []
      fieldErrors[field].push(err.message)
    })
    return {
      success: false,
      error: 'Bitte überprüfe deine Eingaben.',
      fieldErrors,
    }
  }

  const supabase = await createServerSupabaseClient()
  const kursId = parseInt(parsed.data.kurs_id, 10)

  if (isNaN(kursId)) {
    return {
      success: false,
      error: 'Ungültige Kurs-ID.',
      fieldErrors: { kurs_id: ['Bitte wähle einen gültigen Kurs aus.'] },
    }
  }

  // Auf den Marketing-Unterseiten ist der konkrete Termin bereits gewählt. Redaktionelle
  // Sessions werden bei ihrer ersten Anmeldung anhand der ausschließlich serverseitigen
  // Katalogdaten idempotent in der Buchungstabelle materialisiert; Preis und Termin können nicht
  // vom Client manipuliert werden.
  try {
    await ensureMarketingSessionIsBookable(kursId)
  } catch (error) {
    logBookingUnexpectedError({
      kursId,
      message: error instanceof Error ? error.message : 'Session-Materialisierung fehlgeschlagen',
    })
    return {
      success: false,
      error: 'Der ausgewählte Kurs konnte nicht für die Anmeldung vorbereitet werden. Bitte versuche es später erneut.',
    }
  }

  // Die Klassenstufe ist bereits durch den gewählten Kurs festgelegt. Sie wird deshalb nicht
  // erneut im Formular abgefragt, sondern aus den vertrauenswürdigen Kursdaten übernommen.
  // Der Service-Role-Client bleibt vollständig auf dem Server. Er ist hier nötig, weil regulär
  // authentifizierte Nutzer aufgrund der RLS-Regeln die Legacy-Kurstabelle nicht direkt lesen
  // dürfen, die Buchungs-RPC aber dennoch verwenden können.
  const { data: selectedKurs, error: selectedKursError } = await createAdminSupabaseClient()
    .from('intensivwoche_kurse')
    .select('klassenstufen')
    .eq('id', kursId)
    .maybeSingle()

  const childClassLevel = selectedKurs?.klassenstufen?.[0]?.trim()

  if (selectedKursError || !childClassLevel) {
    logBookingUnexpectedError({
      kursId,
      code: selectedKursError?.code,
      message: selectedKursError?.message ?? 'Keine Klassenstufe für den Kurs hinterlegt',
      details: selectedKursError?.details,
      hint: selectedKursError?.hint,
    })
    return {
      success: false,
      error: 'Die Klassenstufe des ausgewählten Kurses konnte nicht ermittelt werden. Bitte versuche es später erneut.',
    }
  }

  // Schreibt ausschliesslich über die atomare Datenbankfunktion
  // (supabase/migrations/20260719190025_booking_hardening_phase_a.sql): sperrt den Kurs,
  // prüft Aktivität/Kapazität/familienfähige Doppelanmeldung atomar, unterstützt idempotente
  // Wiederholungen über idempotencyKey und snapshotted den Preis. Direkte Inserts sind seit der
  // ursprünglichen Migration 014 per REVOKE nicht mehr erlaubt
  // (verifiziert live am 18.07.2026 über den Supabase-Connector).
  const { data: anmeldungId, error } = await supabase.rpc('book_intensivwoche_kurs', {
    p_kurs_id: kursId,
    p_child_firstname: parsed.data.child_firstname.trim(),
    p_child_lastname: parsed.data.child_lastname.trim(),
    p_child_class_level: childClassLevel,
    p_child_gender: parsed.data.child_gender,
    p_parent_email: parsed.data.parent_email.trim().toLowerCase(),
    p_parent_phone: parsed.data.parent_phone.trim(),
    p_notes: parsed.data.notes?.trim() || undefined,
    p_idempotency_key: idempotencyKey,
  })

  if (error) {
    // Abschnitt 10.4 (Observability): erwartete Buchungsablehnungen sind kein Vorfall und würden
    // als durchgehendes console.error nur Alarm-Rauschen erzeugen -- deshalb hier nach Fall
    // korrekt geleveltes strukturiertes Event statt einer einzigen Fehlerausgabe für alles. Keines
    // der Felder unten ist personenbezogen (kein Name/E-Mail/Telefon/Notiz), siehe
    // lib/observability/logger.ts.
    switch (error.message) {
      case 'kurs_nicht_gefunden':
        logBookingRejected({ kursId, reason: error.message })
        return {
          success: false,
          error: 'Der ausgewählte Kurs existiert nicht oder ist nicht mehr verfügbar.',
          fieldErrors: { kurs_id: ['Bitte wähle einen anderen Kurs.'] },
        }
      case 'bereits_angemeldet':
        logBookingRejected({ kursId, reason: error.message })
        return {
          success: false,
          error: 'Du bist bereits für diesen Kurs angemeldet.',
        }
      case 'kurs_inaktiv':
        logBookingRejected({ kursId, reason: error.message })
        return {
          success: false,
          error: 'Der Kurs ist leider nicht mehr für Anmeldungen verfügbar.',
        }
      case 'voll':
        logBookingRejected({ kursId, reason: error.message })
        return {
          success: false,
          error: 'Dieser Kurs ist inzwischen ausgebucht.',
          fieldErrors: { kurs_id: ['Bitte wähle einen anderen Kurs.'] },
        }
      case 'rate_limit_exceeded':
        logRateLimitRejected({ kursId })
        return {
          success: false,
          error: 'Zu viele Anmeldeversuche mit dieser E-Mail-Adresse. Bitte warte einige Minuten und versuche es erneut.',
        }
      default:
        logBookingUnexpectedError({
          kursId,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        })
        return {
          success: false,
          error: 'Die Anmeldung konnte nicht gespeichert werden. Bitte versuche es später erneut.',
        }
    }
  }

  // Abschnitt 10.4 (E-Mail-Outbox): die Outbox-Zeile existiert bereits (Trigger auf
  // intensivwoche_anmeldungen, siehe 20260722092503_mail_outbox_schema.sql) -- das ist die Quelle
  // der Wahrheit, unabhängig davon, ob dieser Best-Effort-Versand jetzt gelingt. "Eine Buchung
  // gilt nicht wegen erfolgreichem Mailversand als gespeichert" heisst hier bewusst nicht nur
  // "ein Mailfehler darf die Erfolgsantwort nicht verändern", sondern auch "die Buchungsantwort
  // darf nicht auf den Mailversand warten" -- next/server after() haengt den Versandversuch NACH
  // der bereits gesendeten Antwort an, statt die Nutzerin durch ein synchrones await zu verzögern
  // (frueher fiel dadurch u. a. tests/routes.spec.ts' Cache-Regressionstest intermittierend unter
  // Systemlast in den Timeout, siehe der bereits dokumentierte Hintergrund in Commit ae03117).
  // Ein Fehler im Dispatch wird dort selbst abgefangen und markiert die Outbox-Zeile als 'failed'
  // mit Backoff -- kein zusätzliches try/catch hier nötig.
  if (anmeldungId) {
    after(() => dispatchOutboxForAnmeldung(anmeldungId))
  }

  return {
    success: true,
    message: 'Vielen Dank für deine Anmeldung! Wir werden uns in Kürze bei dir melden.',
  }
}
