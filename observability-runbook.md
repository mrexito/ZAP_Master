# Observability + Runbook (Abschnitt 10.4)

Stand: 22.07.2026. Deckt einen Teilpunkt des Produktions-Gates in Abschnitt 10.4 ab:
"Strukturierte, PII-arme Logs, Fehlertracking, Metriken für Buchungsfehler, RPC-/Rate-Limit-
Ablehnungen, Mailfehler und Verfügbarkeitsdrift sowie Alarmgrenzen ... Ein Runbook benennt
Verantwortliche und Rollbackschritte." Wie `runbook-marketing-cutover.md` und
`env-separation-audit.md` ist dies ein bewusst eng begrenzter Teilpunkt, nicht das gesamte
Produktions-Gate.

## Was jetzt existiert

`lib/observability/logger.ts` schreibt strukturierte, einzeilige JSON-Events nach
stdout/stderr -- kein neuer APM-/Log-Anbieter, kein Account, keine neue Abhängigkeit. Jedes
Hosting mit einem Log-Drain (z. B. Vercel) erfasst diese Zeilen automatisch, ohne weitere
Einrichtung. Die erlaubten Feldwerte sind auf Primitives beschränkt (`string | number | boolean |
null | undefined`), damit ein Aufrufer nicht versehentlich ein ganzes Formular-/DB-Objekt mit
E-Mail, Name, Telefon oder Notiz durchreicht -- TypeScript lehnt einen verschachtelten Objektwert
bereits beim Kompilieren ab.

Verdrahtet in `app/(public)/kurse/actions.ts` (öffentliche Anmeldung, der in Abschnitt 10.4 explizit
genannte Fall "Buchungsfehler, RPC-/Rate-Limit-Ablehnungen"), mit korrektem Level statt eines
einzigen `console.error` für jeden Fall:

| Event | Level | Wann | Felder |
|---|---|---|---|
| `booking_rejected` | `info` | Erwartete Ablehnung: `kurs_nicht_gefunden`, `bereits_angemeldet`, `kurs_inaktiv`, `voll` | `kursId`, `reason` |
| `rate_limit_rejected` | `warn` | `rate_limit_exceeded` von der Buchungs-RPC | `kursId` |
| `booking_unexpected_error` | `error` | Jeder nicht benannte RPC-/DB-Fehler | `kursId`, `code`, `message`, `details`, `hint` (alle bereits PII-frei, kommen direkt aus dem Postgres-Fehlerobjekt) |

**Warum nach Level getrennt statt einem einzigen `console.error`:** `voll`/`bereits_angemeldet`/
`kurs_inaktiv` sind erwartete, tägliche Nutzerausgänge -- als `error` geloggt, würden sie jedes
Error-Dashboard mit Rauschen fluten und eine echte Störung (`booking_unexpected_error`) darin
untergehen lassen. Nur echte, unbenannte RPC-Fehler sind `error`-Level.

**Ergänzt (30.07.2026), seit die E-Mail-Outbox existiert:** Dasselbe Level-Prinzip gilt jetzt auch
für Mailfehler, verdrahtet in `lib/mail/dispatch-outbox.ts` (siehe `mail-outbox-runbook.md`):

| Event | Level | Wann | Felder |
|---|---|---|---|
| `mail_dispatch_failed` | `warn` | Ein einzelner Zustellversuch schlug fehl, Retries sind laut Backoff aber noch möglich (`attempts < max_attempts`) | `anmeldungId`, `templateKey`, `attempts`, `maxAttempts`, `message` (bereits durch `sanitizeErrorMessage()` von E-Mail-Adressen bereinigt) |
| `mail_dispatch_permanently_failed` | `error` | Alle Retry-Versuche ausgeschöpft, oder die referenzierte Anmeldung existiert nicht mehr -- die Zeile bleibt `status='failed'` und braucht menschliches Zutun | `anmeldungId`, `templateKey`, `attempts`, `message` |

`anmeldungId` ist dieselbe reine Referenz-ID, die `mail_outbox` selbst speichert (siehe
`data-retention-runbook.md`) -- kein Name/E-Mail/Telefon wird hier gelogged, genau wie bei
`kursId` oben.

## Empfohlene Alarmgrenzen (dokumentiert, nicht live verdrahtet)

Es ist aktuell **kein** Alerting-Anbieter (Sentry, Datadog, o. Ä.) angebunden -- diese Grenzen sind
eine dokumentierte Empfehlung für den Moment, in dem eines eingerichtet wird, kein aktiver Alarm.

| Signal | Grenze | Begründung |
|---|---|---|
| `booking_unexpected_error` | jedes Vorkommen | Sollte bei korrekter RPC nie auftreten; jedes Vorkommen ist eine echte Störung |
| `rate_limit_rejected` | > 20 Ereignisse / 10 Min. auf demselben Kurs | Einzelne Ablehnungen sind normal (Formular-Doppelklicks); ein Anstieg deutet auf einen Scraping-/Abuse-Versuch hin |
| `booking_rejected` mit `reason=voll` | > 80 % aller Anfragen für einen Kurs innerhalb einer Stunde | Deutet auf eine falsch beworbene/ausverkaufte Session hin (Marketing-/Kapazitätsproblem, kein technischer Vorfall) |
| `mail_dispatch_permanently_failed` | jedes Vorkommen | Eine Buchungsbestätigung erreicht die Familie dauerhaft nicht -- braucht manuelles Nachfassen über `/dashboard/mail-outbox`, kein Rauschen wie bei einzelnen Retry-Versuchen |
| `mail_dispatch_failed` | > 50 % aller Versandversuche innerhalb einer Stunde | Einzelne vorübergehende Fehler (z. B. kurzer Resend-Ausfall) sind normal; eine hohe Quote deutet auf ein systemisches Problem hin (z. B. `RESEND_API_KEY` ungültig, Domain-Verifizierung verloren) |

## Was bewusst NICHT abgedeckt ist (offene Lücken, nicht stillschweigend übersprungen)

- ~~**Mailfehler:** Es existiert noch kein Mail-Provider im Projekt...~~ **Behoben (30.07.2026):**
  Die E-Mail-Outbox existiert inzwischen (`mail-outbox-runbook.md`); `mail_dispatch_failed`/
  `mail_dispatch_permanently_failed` sind oben verdrahtet. Weiterhin offen: kein echter
  Alerting-Anbieter, der die dokumentierte Grenze tatsächlich auswertet (siehe unten), und keine
  Metrik für die *Quote* fehlgeschlagener Versuche über die Zeit -- nur einzelne Log-Events, aus
  denen eine Quote erst durch ein externes Log-Aggregations-/Dashboard-Tool berechnet würde.
- **Verfügbarkeitsdrift:** Erfordert einen periodischen Abgleich zwischen angezeigter/gecachter
  Verfügbarkeit und dem tatsächlichen DB-Stand -- das ist ein eigenständiges Feature (Scheduled
  Job/Cron plus Vergleichslogik), keine Logging-Erweiterung an einer bestehenden Fehlerbehandlung.
  Absichtlich nicht als Attrappe nachgebaut; als offener Folgeschritt dokumentiert.
- **Restliche `console.*`-Aufrufe im Projekt:** Es gibt ca. 125 weitere `console.log`/`warn`/
  `error`-Aufrufe in anderen Server Actions/Routen (Dashboard-Kurse, Aufsätze, Arbeitszeiten,
  Finanzen, Materialien, Mentorship, Auth, Trainer, Übungen). Ein projektweiter Umbau auf
  `lib/observability/logger.ts` wäre eine grosse, risikoreiche Änderung über Dutzende Dateien und
  war nicht Teil dieses Schritts -- bewusst auf den in Abschnitt 10.4 namentlich genannten Fall
  (öffentliche Buchung) begrenzt. Empfehlung: bei zukünftiger Arbeit an einer dieser Stellen dort
  denselben Logger statt eines neuen `console.error` verwenden, kein Big-Bang-Refactor nötig.
- **Kein echtes Fehlertracking (Sentry o. Ä.):** Strukturierte stdout-Logs sind die Grundlage,
  aber kein Ersatz für ein Tool mit Stacktraces, Deduplizierung und Benachrichtigung. Erfordert
  eine Anbieterwahl/einen Account -- absichtlich nicht unilateral entschieden.

## Runbook: Verantwortliche und Rollback

- **Verantwortlich für dieses Projekt:** der Betreiber/Entwickler selbst (Ein-Personen-Projekt zum
  Zeitpunkt dieses Dokuments). Bei einem Teamwechsel diesen Abschnitt aktualisieren.
- **Bei `booking_unexpected_error`-Häufung:** zuerst `runbook-marketing-cutover.md` prüfen, ob das
  Problem mit einem kürzlichen Marketing-Deploy zusammenhängt (Feature-Flag als schneller,
  nicht-destruktiver Rückfall verfügbar). Danach die zugehörige Postgres-Fehlermeldung
  (`code`/`message`/`details`/`hint` im Log-Event) gegen `book_intensivwoche_kurs()`
  (`supabase/migrations/20260719190025_booking_hardening_phase_a.sql` und Folgemigrationen)
  abgleichen.
- **Bei `rate_limit_rejected`-Spitzen:** prüfen, ob es sich um legitimen Andrang (z. B. nach einer
  Marketingaktion) oder Abuse handelt, bevor die Rate-Limit-Konfiguration geändert wird.
- **Kein Schritt hier erfordert eine Datenbankmigration oder einen Rollback von Daten** -- reine
  Log-/Beobachtungsänderung.
