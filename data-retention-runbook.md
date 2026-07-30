# Datenschutz und Aufbewahrung (Abschnitt 10.4)

Stand: 22.07.2026. Deckt den Abschnitt-10.4-Punkt "Datenschutz und Aufbewahrung" ab: "Für
Anmeldungen, Einladungen, Zugriffsgrants, Audit-Logs, Rate-Limit-Daten und Exporte sind Zweck,
minimale Felder, Zugriffsrollen, Aufbewahrungsdauer, Lösch-/Anonymisierungsablauf und
Verantwortlichkeit dokumentiert. Logs maskieren E-Mail, Telefon, Namen, Tokens und Notizen.
Support- und Exportpfade sind Admin-only und auditiert." Wie `observability-runbook.md` und
`staging-backup-restore-runbook.md` ist dies ein bewusst eng begrenzter Teilpunkt des
Produktions-Gates, kein vollständiges Datenschutzkonzept und kein Ersatz für eine rechtliche
Prüfung vor dem öffentlichen Cutover (siehe die noch offenen Impressum-/Datenschutz-Publikationsgates
in `design-review-todo.md`).

Dieses Dokument beschreibt den **tatsächlichen Ist-Zustand** des Codes/Schemas per obigem Datum —
es beschreibt kein Zielbild. Wo etwas noch fehlt, steht das explizit im Abschnitt "Was bewusst NICHT
abgedeckt ist" statt stillschweigend übersprungen zu werden.

## Übersicht je Datenkategorie

| Kategorie | Tabelle(n) | Zweck | Zugriffsrollen |
|---|---|---|---|
| Anmeldungen | `intensivwoche_anmeldungen` | Kursbuchung (Kind/Eltern-Daten, Preis-Snapshot) | `anon` nur INSERT über `book_intensivwoche_kurs()`; `authenticated`/`admin` lesen/ändern gemäss Owner-/Admin-RLS |
| Einladungen/Grants | `self_study_enrollments`, `material_access_grants` | Selbststudium-Einschreibung und daraus abgeleiteter Materialzugriff | nur `service_role` schreibt (kein Checkout-Flow live); Betroffene und Admin lesen eigene/alle Zeilen |
| Audit-Log | `audit_log` | Vorher-/Nachher-Diff jeder Admin-Mutation an Kursangeboten | nur Admins lesen (`audit_log_admin_read`); Schreibzugriff nur über Server Actions mit `is_admin()`-Check |
| Rate-Limit-Daten | `intensivwoche_buchungsversuche` | Zähl-Log für den Buchungs-Rate-Limiter | niemand ausser der SECURITY-DEFINER-Funktion selbst — kein Grant an `anon`/`authenticated`, auch nicht lesend |
| Mail-Outbox | `mail_outbox` | Idempotente Zustellung/Retry der Buchungsbestätigung | nur Admins lesen (`mail_outbox_admin_select`); Schreibzugriff nur über Trigger/`service_role`-Dispatcher |
| Exporte | — | siehe "Was bewusst NICHT abgedeckt ist" | — |

### Anmeldungen (`intensivwoche_anmeldungen`)

**Zweck:** Buchung eines Intensivwochen-/Halbjahreskurses durch die Eltern eines Kindes.
**Felder:** `child_firstname`, `child_lastname`, `child_class_level`, `child_gender`,
`parent_email`, `parent_phone`, `notes` (optional, Freitext), plus `booked_price_rappen`/`currency`
(unveränderlicher Preis-Snapshot, Abschnitt 2.10) und `status`. Das sind bereits die laut
Datenmodell minimalen Felder für eine Kursanmeldung — es gibt kein zusätzliches, unbenutztes
personenbezogenes Feld.
**Zugriffsrollen:** `anon` darf ausschliesslich über die SECURITY-DEFINER-Funktion
`book_intensivwoche_kurs()` inserten (keine direkten Client-Inserts, seit Migration `014`
per `REVOKE` unterbunden). Lesend/ändernd greifen Lehrpersonen auf eigene Kurse, Admins auf alle
zu (Owner-RLS, unverändert seit dem Live-Abgleich in `datenmodell-review.md`).
**Aufbewahrungsdauer:** Aktuell **unbefristet** — es existiert kein automatischer Purge-/
Archivierungsjob (kein `pg_cron`, kein Scheduled Trigger im gesamten Migrationsverlauf gefunden).
Buchungen bleiben Buchhaltungs-/Nachweisdaten (Preis-Snapshot, Storno-Historie) und werden nicht
automatisch gelöscht.
**Lösch-/Anonymisierungsablauf:** Es existiert **kein** automatisierter oder UI-gestützter Ablauf.
Eine Löschanfrage würde heute eine manuelle, auditierte `service_role`-Aktion durch die
verantwortliche Person erfordern (siehe Runbook-Abschnitt unten). `status = 'storniert'` storniert
eine Buchung fachlich, löscht aber keine Felder — eine Anonymisierungsfunktion (z. B.
Kindername/E-Mail/Telefon/Notiz auf `NULL`/Platzhalter setzen, `booked_price_rappen`/`currency`
unangetastet lassen) ist nicht gebaut.

### Einladungen und Zugriffsgrants (`self_study_enrollments`, `material_access_grants`)

**Zweck:** Nachweis einer bezahlten Selbststudium-Einschreibung und der daraus abgeleitete
Materialzugriff (Abschnitt 2.11).
**Felder:** `self_study_enrollments` speichert `audience_id`, `area_id`, `beneficiary_user_id`,
`status`, `access_until`, `payment_provider_ref` und **nur** einen gehashten Einladungs-Token
(`invite_token_hash`) — nie den Klartext-Token, wie im Architektur-Briefing gefordert.
`material_access_grants` speichert `user_id`, `area_id`, `status`, Gültigkeitszeitraum und
`source_kind`/`source_id`.
**Zugriffsrollen:** Beide Tabellen haben nur SELECT-Policies (`..._select_own_or_admin`); jedes
INSERT/UPDATE/DELETE ist `anon`/`authenticated` per `REVOKE` entzogen. Schreibzugriff ist
ausschliesslich `service_role` vorbehalten, weil der zugehörige Zahlungs-/Admin-Flow noch nicht
gebaut ist — das ist die vom Nutzer explizit bestätigte, aktuell zurückgestellte Entscheidung
("Selbststudium-/Nachhilfe-Checkout: Not decided yet — skip for now").
**Aufbewahrungsdauer:** Da noch keine reale Einschreibung/Grant je erzeugt wurde (kein Checkout-
Flow live), sind diese Tabellen im Praxisbetrieb aktuell leer. Sobald der Checkout gebaut wird,
gilt: `material_access_grants` wird nie hart gelöscht (`revoked_at` setzt den Widerruf, historische
Grants bleiben auditierbar — bereits so im Schema-Kommentar festgelegt), eine Aufbewahrungsfrist
für abgelaufene/widerrufene Grants ist aber noch nicht separat entschieden.
**Lösch-/Anonymisierungsablauf:** Noch nicht relevant (keine Daten vorhanden), muss aber Teil des
künftigen Checkout-Flows werden, bevor dieser produktiv geschaltet wird (Abschnitt 9.1,
Publikationsgate "Selbststudium-Zugang Ende-zu-Ende freigeben").

### Audit-Log (`audit_log`)

**Zweck:** Vorher-/Nachher-Diff jeder Admin-Mutation an `offer_editions`/`course_sessions`
(Abschnitt 2.12) — Nachvollziehbarkeit von Preis-/Publikationsänderungen, kein Nutzer-Tracking.
**Felder:** `actor_user_id`, `occurred_at`, `entity_type`, `entity_id`, `action`, `diff jsonb`. Der
`diff` enthält laut Tabellenkommentar bewusst **keine personenbezogenen Buchungsdaten** — er
protokolliert Preis-/Status-/Textänderungen an Angeboten, nicht an Anmeldungen. Bestätigt durch
Code-Review von `writeAuditLog()` in
`app/(dashboard)/dashboard/kurse/durchfuehrungen/actions.ts`: Der geloggte `before`/`after` stammt
aus dem `OfferEdition`-Formular (Preise, Texte, Status), nie aus `intensivwoche_anmeldungen`.
**Zugriffsrollen:** Nur Admins lesen (`audit_log_admin_read`, `is_admin()`); `anon`/`authenticated`
haben weder INSERT/UPDATE/DELETE-Grants noch eine Read-Policy für Nicht-Admins. Schreibzugriff läuft
über die `authenticated`-Rolle mit einer spoofing-sicheren `WITH CHECK (is_admin() AND
actor_user_id = auth.uid())`-Policy (Migration `20260721074500`) — bewusst nicht über
`service_role`, damit `actor_user_id` nicht gefälscht werden kann.
**Aufbewahrungsdauer:** Unbefristet, kein Purge-Mechanismus. Das ist für ein Audit-Log fachlich
korrekt (Nachvollziehbarkeit soll nicht verfallen) und enthält ohnehin keine personenbezogenen
Anmeldedaten, die eine Löschfrist bräuchten.
**Lösch-/Anonymisierungsablauf:** Kein Ablauf vorgesehen und keiner nötig, solange der `diff` bei
Preis-/Angebotsänderungen bleibt. Sollte künftig ein Audit-Event mit personenbezogenen Daten
entstehen (z. B. bei Grant-Widerruf), muss diese Aussage neu geprüft werden.

### Rate-Limit-Daten (`intensivwoche_buchungsversuche`)

**Zweck:** Zähl-Log für den Buchungs-Rate-Limiter (max. 5 Versuche / 10 Minuten je E-Mail,
Abschnitt 3.4 in `datenmodell-review.md`).
**Felder:** `email_hash`, `attempted_at`. **Behoben (30.07.2026,
`20260730130000_hash_and_purge_rate_limit_attempts.sql`):** Die Tabelle speicherte bis dahin
`parent_email` im Klartext — eine Abweichung vom ursprünglich im Architektur-Briefing beschriebenen
Design ("gehashter, rotierter Netzwerkkennung" als Schlüssel). Jetzt wird nur noch ein SHA-256-Hash
der kleingeschriebenen/getrimmten E-Mail gespeichert; `book_intensivwoche_kurs()` berechnet und
vergleicht ausschliesslich diesen Hash. Der Rate-Limiter zählt weiterhin pro E-Mail (nicht pro
Netzwerkkennung/IP) — eine Umstellung auf IP-basierte Zählung bliebe eine separate, grössere
Design-Entscheidung mit eigenen Tradeoffs (NAT/Shared-IP-Familien, VPNs) und ist bewusst nicht Teil
dieser Migration.
**Zugriffsrollen:** Niemand ausser der SECURITY-DEFINER-Funktion `book_intensivwoche_kurs()` selbst
— `REVOKE ALL ... FROM PUBLIC, anon, authenticated` gilt auch für `SELECT`. Selbst Admins können
diese Tabelle nicht über PostgREST/den Dashboard-Client lesen; ein Zugriff wäre nur über eine
direkte, separat zu autorisierende DB-Verbindung möglich.
**Aufbewahrungsdauer:** **Behoben (30.07.2026):** War zuvor unbefristet und ausdrücklich bewusst
nicht bereinigt (Zitat aus dem ursprünglichen Tabellenkommentar der Migration `20260720090000`:
"Wird bewusst nicht automatisch bereinigt (Phase B); künftiges Pruning ist ein separater, additiver
Schritt."). `book_intensivwoche_kurs()` löscht jetzt bei jedem Aufruf opportunistisch alle Zeilen
älter als 1 Tag — kein `pg_cron`/externer Scheduler nötig, da die Funktion ohnehin bei jedem
Buchungsversuch läuft. Lokal per pgTAP bewiesen
(`supabase/tests/database/0026_rate_limit_hash_and_purge.sql`): eine 2 Tage alte Zeile wird beim
nächsten Aufruf entfernt, eine 30 Minuten alte Zeile bleibt erhalten.
**Lösch-/Anonymisierungsablauf:** Siehe Aufbewahrungsdauer oben — der opportunistische Purge deckt
diesen Punkt jetzt vollständig ab, kein manueller Ablauf nötig.

### Mail-Outbox (`mail_outbox`)

**Zweck:** Idempotente Zustellung/Retry der Buchungsbestätigungsmail (Abschnitt 10.4).
**Felder:** bewusst **keine Kopie** von Name/E-Mail/Telefon/Notiz — nur `anmeldung_id` als
Referenz, plus Versand-Metadaten (`status`, `attempts`, `last_error`, `provider_message_id`,
Zeitstempel). Das ist laut Tabellenkommentar eine explizite Architekturentscheidung: die
tatsächlichen Empfängerdaten werden erst zum Sendezeitpunkt per JOIN aus
`intensivwoche_anmeldungen`/`intensivwoche_kurse` gelesen, nie dauerhaft dupliziert.
**Zugriffsrollen:** Nur Admins lesen (`mail_outbox_admin_select`); Schreibzugriff nur über den
`SECURITY DEFINER`-Enqueue-Trigger bzw. den `service_role`-Dispatcher
(`lib/mail/dispatch-outbox.ts`) — kein INSERT/UPDATE/DELETE-Grant für `anon`/`authenticated`.
**Aufbewahrungsdauer:** Unbefristet, kein Purge. Zeilen mit `status = 'sent'` haben nach
erfolgreicher Zustellung keinen weiteren fachlichen Zweck mehr ausser Nachvollziehbarkeit
("wurde diese Anmeldung bestätigt?").
**Lösch-/Anonymisierungsablauf:** Über `ON DELETE CASCADE` auf `anmeldung_id` wird die zugehörige
Outbox-Zeile automatisch mitgelöscht, falls die Anmeldung selbst gelöscht wird (siehe
`loadAnmeldungContext`-Kommentar in `dispatch-outbox.ts`: "kann bei kaskadiertem Löschen
vorkommen"). Es gibt aber keinen aktiven Prozess, der Anmeldungen tatsächlich löscht — die
Kaskade ist vorbereitet, wird aber mangels Löschablauf für Anmeldungen selbst nie ausgelöst.

## Log-Masking (Querverweis)

`observability-runbook.md` beschreibt `lib/observability/logger.ts` bereits im Detail: erlaubte
Feldwerte sind auf `string | number | boolean | null | undefined` beschränkt, sodass ein Aufrufer
strukturell kein Formular-/DB-Objekt mit E-Mail/Name/Telefon/Notiz durchreichen kann — TypeScript
lehnt einen verschachtelten Objektwert bereits beim Kompilieren ab. Die tatsächlich geloggten
Felder (`kursId`, `reason`, `code`, `message`, `details`, `hint`) stammen direkt aus Kurs-ID und
Postgres-Fehlerobjekt, nie aus Formulardaten. Das erfüllt "Logs maskieren E-Mail, Telefon, Namen,
Tokens und Notizen" für den einen Aufrufer, der diesen Logger nutzt
(`app/(public)/kurse/actions.ts`).

**Eine Lücke dieser Zusicherung, gefunden bei der Recherche zu diesem Dokument und seither
behoben (30.07.2026):** `lib/mail/dispatch-outbox.ts` schrieb `last_error: err.message` direkt aus
einer geworfenen Exception (Resend-SDK-Fehler oder ein generischer Catch) in `mail_outbox.last_error`.
Ein Provider-Fehler kann die Empfängeradresse im Fehlertext enthalten (z. B. bei einer ungültigen
`to`-Adresse). Diese Spalte ist zwar Admin-only (`mail_outbox_admin_select`), umging damit aber die
sonst durchgesetzte "keine Formulardaten in Logs/Fehlerspalten"-Regel teilweise. `dispatch-outbox.ts`
redigiert jetzt jede E-Mail-Adresse im Fehlertext (`sanitizeErrorMessage()`, einfaches Regex-Ersetzen
durch `[redacted-email]`) unmittelbar vor dem Schreiben nach `last_error`; der statische Fallback-Text
für gelöschte Anmeldungen und der Erfolgsfall (`last_error: null`) waren nie betroffen. Diese
strukturelle Garantie ist bewusst schwächer als `logger.ts` (kein kompilierzeitlicher Typzwang,
nur ein Muster-Ersatz) — sie deckt E-Mail-Adressen ab, nicht jedes denkbare PII-Muster in einer
Provider-Fehlermeldung.

## Was bewusst NICHT abgedeckt ist (offene Lücken)

- **Kein automatischer Purge/Retention-Job für irgendeine Tabelle.** Weder `pg_cron` noch ein
  Scheduled Trigger existiert im gesamten Migrationsverlauf. Jede oben genannte Aufbewahrungsdauer
  ist faktisch "unbefristet, bis jemand manuell eingreift" — das ist für ein Audit-Log
  akzeptabel, für Rate-Limit-Zähldaten und potenziell für alte stornierte Anmeldungen aber ein
  offener Punkt vor einem echten Produktions-Cutover mit realen Nutzerdaten.
- **Kein Nutzer-initiierter Lösch-/Auskunftsablauf (DSAR) existiert.** Es gibt keine
  "Konto löschen"-Funktion, keinen Datenexport-Self-Service und keinen dokumentierten internen
  Prozess ausser der manuellen Vorgehensweise unten. Ein Test auf `DELETE FROM auth.users` zeigt
  ausserdem: Von allen Fremdschlüsseln auf `auth.users(id)` im Schema hat nur
  `trainer_progress.user_id` `ON DELETE CASCADE`; alle anderen (`material_access_grants.user_id`,
  `self_study_enrollments.beneficiary_user_id`, `offer_editions`/`work_entries`/
  `financial_adjustments`-Actor-Spalten usw.) haben keine explizite `ON DELETE`-Aktion und würden
  ein Löschen des `auth.users`-Datensatzes mit einer FK-Verletzung blockieren, sobald eine
  verknüpfte Zeile existiert. Ein Löschvorgang müsste diese Tabellen also zuerst gezielt bereinigen
  oder anonymisieren — dieser Ablauf ist nicht gebaut.
- ~~Rate-Limit-Tabelle wird nie bereinigt und speichert die E-Mail im Klartext~~ **Behoben
  (30.07.2026):** siehe Abschnitt oben — Hash statt Klartext, opportunistischer Purge bei jedem
  Funktionsaufruf, kein `pg_cron`/Scheduler nötig.
- ~~`mail_outbox.last_error` kann Empfängerdaten aus Provider-Fehlermeldungen enthalten~~
  **Behoben (30.07.2026):** siehe oben — E-Mail-Adressen werden vor dem Schreiben redigiert.
  Weiterhin nicht dieselbe strukturelle (kompilierzeitliche) Garantie wie `logger.ts`, nur ein
  Muster-Ersatz für E-Mail-Adressen; andere PII-Formen (Namen, Telefonnummern) in einer
  Provider-Fehlermeldung würden davon nicht erfasst.
- **Exporte existieren noch gar nicht.** Abschnitt 10.4 verlangt, dass "Support- und Exportpfade
  Admin-only und auditiert" sind. Im aktuellen Code gibt es aber keine CSV-/Datenexport-Funktion
  irgendwo im Dashboard (Finanz-Cockpit, Zeiterfassung, Kurs-/Anmeldungsverwaltung sind reine
  On-Screen-Tabellen ohne Download-/Export-Button) — geprüft per Suche nach `export`/`csv` in
  `app/(dashboard)/dashboard/finanzen` und verwandten Bereichen; alle Treffer waren TypeScript-
  `export`-Schlüsselwörter, keine Exportfunktion. Diese Anforderung ist also aktuell **erfüllt,
  weil es (noch) nichts zu exportieren gibt** — nicht, weil ein Exportpfad gebaut und geprüft
  wurde. Sobald eine Exportfunktion entsteht, muss sie Admin-only sein und einen `audit_log`-Eintrag
  erzeugen, analog zu den bestehenden Admin-Mutationen.
- **Kein rechtlich geprüftes Datenschutzkonzept.** Dieses Dokument beschreibt technisches
  Ist-Verhalten, ersetzt aber keine Datenschutzerklärung, keine Auftragsverarbeitungsverträge (z. B.
  mit Resend/Supabase) und keine Rechtsgrundlagenprüfung — das bleibt Teil des noch offenen
  Impressum/Datenschutz-Publikationsgates.

## Runbook: Verantwortliche und Vorgehen bei einer Löschanfrage heute

- **Verantwortlich:** der Betreiber/Entwickler selbst (Ein-Personen-Projekt zum Zeitpunkt dieses
  Dokuments, wie in `observability-runbook.md` vermerkt).
- **Heutiges (manuelles) Vorgehen bei einer eingehenden Löschanfrage**, bis ein automatisierter
  Ablauf existiert:
  1. Betroffene Zeilen in `intensivwoche_anmeldungen` anhand `parent_email`/Kindname identifizieren
     (per `service_role`, ausserhalb der App — kein UI dafür).
  2. Personenbezogene Felder (`child_firstname`, `child_lastname`, `parent_email`, `parent_phone`,
     `notes`) durch Platzhalter ersetzen statt die Zeile zu löschen — `booked_price_rappen`,
     `currency`, `status`, `kurs_id` und `id` bleiben für Buchhaltungs-/Kapazitätshistorie
     unverändert erhalten. Kein `DELETE`, um Fremdschlüssel (`mail_outbox.anmeldung_id`) und
     historische Belegungszahlen nicht zu brechen.
  3. Zugehörige `mail_outbox`-Zeile bleibt bestehen (enthält ohnehin keine Kopie der Daten).
  4. Falls die Person ein `auth.users`-Konto besitzt: vor einem `auth.admin.deleteUser`-Aufruf
     zuerst `profiles`, `material_access_grants`, `self_study_enrollments` und alle sonstigen
     Fremdschlüssel auf diese `user_id` prüfen und bereinigen (siehe FK-Liste oben) — sonst schlägt
     das Löschen mit einer Fremdschlüsselverletzung fehl.
  5. Diesen Vorgang (wer, wann, welche Zeilen) ausserhalb der App dokumentieren, bis ein
     auditierter Admin-Flow dafür existiert.
- **Kein Schritt hier erfordert eine Schemaänderung** — das ist reine Prozessdokumentation für den
  aktuellen Stand. Die oben gelisteten Lücken (Purge-Job, DSAR-Self-Service, Rate-Limit-Pruning)
  sind mögliche spätere additive Migrationen/Features, keine Sofortkorrekturen.
