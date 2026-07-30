// Strukturiertes, PII-armes Logging (Abschnitt 10.4: "Strukturierte, PII-arme Logs ... für
// Buchungsfehler, RPC-/Rate-Limit-Ablehnungen, Mailfehler und Verfügbarkeitsdrift"). Kein neuer
// Log-/APM-Anbieter -- schreibt einzeilige JSON-Events nach stdout/stderr, damit das jeweilige
// Hosting (z. B. Vercel) sie ohne weitere Einrichtung in seinem Log-Drain erfasst. Siehe
// observability-runbook.md für Umfang, Konsum und empfohlene Alarmgrenzen.

type LogLevel = "info" | "warn" | "error"

/**
 * Erlaubte Feldwerte sind bewusst auf Primitives beschränkt (kein `object`/`unknown`). Das
 * verhindert strukturell, dass ein Aufrufer versehentlich ein ganzes Formular-/DB-Objekt (mit
 * E-Mail, Name, Telefon, Notiz) durchreicht, statt einzelne, bewusst ausgewählte Felder zu
 * loggen -- TypeScript lehnt einen verschachtelten Objektwert bereits beim Kompilieren ab.
 */
type LogFields = Record<string, string | number | boolean | null | undefined>

function emit(level: LogLevel, event: string, fields: LogFields) {
  const line = JSON.stringify({
    level,
    event,
    ts: new Date().toISOString(),
    ...fields,
  })
  if (level === "error") console.error(line)
  else if (level === "warn") console.warn(line)
  else console.log(line)
}

/** Erwarteter, nicht alarmwürdiger Ausgang (voll/inaktiv/bereits angemeldet/ungültige Kurs-ID). */
export function logBookingRejected(fields: LogFields & { kursId: number; reason: string }) {
  emit("info", "booking_rejected", fields)
}

/** Rate-Limit hat einen Versuch abgelehnt -- auffällig, aber je nach Häufigkeit kein Vorfall. */
export function logRateLimitRejected(fields: LogFields & { kursId: number }) {
  emit("warn", "rate_limit_rejected", fields)
}

/** Unerwarteter RPC-/DB-Fehler bei einer Buchung -- alarmwürdig. */
export function logBookingUnexpectedError(
  fields: LogFields & { kursId: number; code?: string; message: string; details?: string; hint?: string }
) {
  emit("error", "booking_unexpected_error", fields)
}

/**
 * Ein einzelner Mailversand-Versuch ist fehlgeschlagen, aber Retries sind noch möglich
 * (attempts < max_attempts) -- auffällig, aber durch Backoff/Retry noch kein endgültiger Vorfall.
 * `message` ist bereits durch sanitizeErrorMessage() (lib/mail/dispatch-outbox.ts) von
 * E-Mail-Adressen bereinigt, bevor sie hier ankommt.
 */
export function logMailDispatchFailed(
  fields: LogFields & { anmeldungId: string; templateKey: string; attempts: number; maxAttempts: number; message: string }
) {
  emit("warn", "mail_dispatch_failed", fields)
}

/**
 * Alle Retry-Versuche einer Outbox-Zeile sind ausgeschöpft (oder die zugehörige Anmeldung fehlt) --
 * die Zeile bleibt dauerhaft `status='failed'` im Admin sichtbar und braucht menschliches Zutun.
 */
export function logMailDispatchPermanentlyFailed(
  fields: LogFields & { anmeldungId: string; templateKey: string; attempts: number; message: string }
) {
  emit("error", "mail_dispatch_permanently_failed", fields)
}
