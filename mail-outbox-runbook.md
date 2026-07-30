# E-Mail-Outbox: Buchungsbestätigungen (Abschnitt 10.4)

Stand: 22.07.2026. Deckt den letzten offenen Punkt aus dem "Produktions-Gate", der rein technisch
lösbar war: "Eine Buchung gilt nicht wegen erfolgreichem Mailversand als gespeichert.
Bestätigungsmails laufen idempotent über Outbox/Retry, enthalten keine unnötigen
personenbezogenen Daten und machen dauerhafte Zustellfehler im Admin sichtbar." Wie die übrigen
10.4-Dokumente (`runbook-marketing-cutover.md`, `env-separation-audit.md`,
`observability-runbook.md`, `accessibility-performance-runbook.md`) ein eng begrenzter Teilpunkt.

## Architektur

```
Buchung (book_intensivwoche_kurs RPC)
  -> AFTER-INSERT-Trigger auf intensivwoche_anmeldungen
  -> mail_outbox-Zeile (status='pending'), idempotent per UNIQUE(anmeldung_id, template_key)
  -> Buchungsantwort geht sofort an die Nutzerin zurück (kein Warten auf den Mailversand)
  -> Best-Effort-Sofortversand danach über next/server after() (app/(public)/kurse/actions.ts)
  -> bei Erfolg: status='sent'
  -> bei Fehler: status='failed', attempts++, next_attempt_at per Backoff, Fehlertext gespeichert
  -> spaeter erneut versucht ueber:
       a) POST /api/mail-outbox/process (secret-geschuetzt, fuer einen externen Scheduler)
       b) "Jetzt verarbeiten"-Button unter /dashboard/mail-outbox (admin-only)
```

**Warum ein DB-Trigger statt eines Codepfads in der Buchungs-Server-Action:** Die Outbox-Zeile
entsteht garantiert für jede neue Anmeldung, unabhängig davon, über welchen Schreibpfad sie
entstanden ist (aktuell nur `book_intensivwoche_kurs()`, aber der Trigger deckt auch einen
künftigen zweiten Pfad automatisch ab) -- und ohne die bereits mehrfach gehärtete RPC-Funktion
selbst anzufassen.

**Warum die Outbox-Zeile nur eine Referenz (`anmeldung_id`) speichert, keine Kopie der Daten:**
Vermeidet eine zweite, unabhängig zu pflegende Kopie von Name/E-Mail/Telefon mit eigener
Aufbewahrungsfrist. Inhalte für den tatsächlichen Versand werden erst beim Senden per JOIN aus
`intensivwoche_anmeldungen`/`intensivwoche_kurse` gelesen (`lib/mail/dispatch-outbox.ts`). Die
E-Mail selbst enthält bewusst **nicht** `parent_phone` oder `notes` (potenziell sensibel, z. B.
"Allergien, besondere Bedürfnisse") -- nur, was für eine Bestätigung tatsächlich nötig ist.

**Idempotenz:** `UNIQUE(anmeldung_id, template_key)` auf `mail_outbox` plus `ON CONFLICT DO
NOTHING` im Trigger. Ein Retry sendet niemals eine zweite E-Mail für dieselbe Anmeldung.

**Retry/Backoff:** `lib/mail/dispatch-outbox.ts` verwendet ein festes exponentielles Backoff (1,
5, 25, 125, 625 Minuten) über `max_attempts = 5` (Tabellen-Default). Nach dem letzten
fehlgeschlagenen Versuch bleibt die Zeile `status='failed'` mit `attempts = max_attempts` --
dauerhaft sichtbar im Admin, kein weiterer automatischer Versuch.

**"Eine Buchung gilt nicht wegen erfolgreichem Mailversand als gespeichert":** Die Buchung ist
mit dem `book_intensivwoche_kurs()`-INSERT bereits vollständig und unabhängig vom Mailversand
gespeichert. Der Best-Effort-Sofortversand läuft über `next/server`s `after()` -- die
Buchungsantwort an die Nutzerin wird nicht durch den Versandversuch verzögert, und ein Fehler
darin (inklusive fehlendem `RESEND_API_KEY`) kann die bereits gesendete Erfolgsantwort nicht mehr
verändern. `dispatchOutboxForAnmeldung()` faengt jeden Fehler selbst ab und markiert die
Outbox-Zeile als `failed` mit Backoff; ein fehlgeschlagener Versuch wird über Retry/Admin-Button
nachgeholt, nie erneut gebucht.

## Observability

Jeder fehlgeschlagene Zustellversuch erzeugt ausserdem ein strukturiertes Log-Event
(`mail_dispatch_failed` bei noch möglichem Retry, `mail_dispatch_permanently_failed` bei
ausgeschöpften Versuchen oder fehlender Anmeldung) über `lib/observability/logger.ts` --
level-getrennt wie die Buchungsereignisse. Details, Felder und empfohlene Alarmgrenze siehe
`observability-runbook.md`. Dies schliesst die dort bis 30.07.2026 offen dokumentierte
"Mailfehler"-Lücke.

## Admin-Sichtbarkeit

`/dashboard/mail-outbox` (admin-only, `requireAdmin()` plus RLS-Policy `mail_outbox_admin_select`
auf `is_admin()`): Tabelle aller Outbox-Zeilen mit Status, Kurs, Kind, Fehlermeldung und
Zeitpunkten; ein Banner hebt dauerhaft fehlgeschlagene Zeilen hervor; ein "Jetzt verarbeiten"-
Button löst denselben Dispatcher aus wie der Cron-Endpunkt.

## Offene Punkte, die eine Entscheidung von dir brauchen

Diese drei Punkte sind bewusst **nicht** unilateral entschieden:

1. **Resend-API-Key:** `RESEND_API_KEY` muss in `.env.local` (lokal) bzw. den Secrets der
   jeweiligen Umgebung gesetzt werden -- siehe `.env.example`. Ohne gesetzten Wert wirft
   `lib/mail/resend-client.ts` erst beim tatsächlichen Sendeversuch einen Fehler; die betroffene
   Outbox-Zeile landet dann als `failed` im Admin, der Rest der Anwendung bleibt unberührt.
2. **Absenderadresse/-domain:** `MAIL_FROM_ADDRESS` ist aktuell ein klar erkennbarer Platzhalter
   (`noreply@example.ch`). Für echten Versand muss eine reale Domain bei Resend verifiziert und
   der Wert in `.env.local`/den Produktions-Secrets ersetzt werden.
3. **Externer Scheduler für automatische Retries:** `POST /api/mail-outbox/process` (geschützt
   durch `MAIL_OUTBOX_CRON_SECRET`) ist die Schnittstelle für einen periodischen Trigger, aber
   *welcher* Scheduler das ist (Vercel Cron, GitHub Actions Cron, ein anderer Dienst) ist eine
   Hosting-Entscheidung. Beispiel, falls Vercel Hosting genutzt wird (rein illustrativ, nicht
   angelegt):
   ```json
   // vercel.json
   { "crons": [{ "path": "/api/mail-outbox/process", "schedule": "*/15 * * * *" }] }
   ```
   Bis ein Scheduler eingerichtet ist, deckt der Best-Effort-Sofortversand plus der manuelle
   Admin-Button den häufigsten Fall (ein einzelner vorübergehender Fehler) bereits ab; nur
   *automatische* Retries ohne menschliches Zutun fehlen ohne Scheduler.

## Was bewusst NICHT abgedeckt ist

- **Kein automatisierter Test für den tatsächlichen Versand:** Ein echter Test würde entweder die
  echte Resend-API treffen (nicht sinnvoll in einem lokalen/CI-Lauf) oder einen HTTP-Mock
  erfordern, den dieses Projekt aktuell nicht einsetzt (kein Vitest/Jest, siehe CLAUDE.md). Die
  DB-seitige Logik (Trigger, Idempotenz, RLS) ist per pgTAP getestet
  (`supabase/tests/database/0020_mail_outbox_schema.sql`); der eigentliche Versandpfad ist manuell
  zu verifizieren, sobald ein echter `RESEND_API_KEY` vorliegt.
- **Kein zweiter Mail-Typ:** Nur `booking_confirmation`. Weitere Vorlagen (z. B. Erinnerungen,
  Stornobestätigungen) sind strukturell vorbereitet (`template_key` ist bereits ein freies Feld),
  aber nicht Teil dieses Schritts.
- **Kein Bounce-/Beschwerde-Handling (Resend-Webhooks):** Dauerhafte Zustellfehler werden nur
  durch fehlgeschlagene Sendeversuche erkannt (z. B. ungültige Adresse zum Sendezeitpunkt), nicht
  durch asynchrone Bounce-Events von Resend. Ein Webhook-Endpunkt dafür ist ein möglicher
  Folgeschritt, sobald ein Resend-Konto existiert.
