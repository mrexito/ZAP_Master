# Datenbank-Review: aktueller Stand und verbindliche Migrationsentscheidungen

Stand: 29.07.2026. Dieses Dokument ersetzt das Review vom 19.07.2026 vollständig. Grundlage ist ein
frischer, schreibgeschützter Live-Abgleich über den Supabase-MCP-Connector nach einem
Kontowechsel — der Connector war zwischenzeitlich mit dem **alten** Supabase-Konto verbunden und
lieferte dadurch veraltete Daten gegen ein Projekt, mit dem die App nicht mehr spricht. Seit
29.07.2026 ist der Connector auf das **neue, tatsächlich produktive** Konto umgehängt.

> **Projektidentität:** Die App (`.env.local` → `NEXT_PUBLIC_SUPABASE_URL`) läuft auf dem Projekt
> `notaqfguhhjpvmagvcic` ("Lernecke", Organisation `fbgaamxetmvkpbjovxwy`, Region `eu-west-1`,
> Postgres 17.6.1.141, `ACTIVE_HEALTHY`). Im selben Konto existiert zusätzlich
> `epiekraadwkxbtadzhnp` ("Gymivergleich_Portal", `INACTIVE`) — ohne Bezug zu dieser App, nicht
> weiter geprüft. Alle Aussagen unten beziehen sich ausschliesslich auf `notaqfguhhjpvmagvcic`.
> Alle früheren Stände dieses Dokuments (16.07./18.07./19.07.2026) bezogen sich auf das alte
> Projekt `ybzdibifgqjsbohtztmy` ("ZAP_25") und sind als Live-Zustand nicht mehr gültig.

**Wichtigstes Ergebnis dieses Abgleichs:** Der Live-Stand ist deutlich weiter als der zuletzt
dokumentierte Zwischenstand vermuten liess. Praktisch das gesamte in
`architektur-briefing-kursseiten.md` beschriebene Zielschema (alle 27 dort genannten Tabellen)
existiert bereits, inklusive der Server-Actions/RPCs aus den Schritten 5 und 10a–10d des
Ausführungsplans. Der Live-Abgleich deckte ausserdem zwei konkrete, mittlerweile behobene Lücken
auf: eine fehlende Tabelle (`school_holiday_weeks`, Abschnitt 6.1) und einen aktiven Preis-Bug in
`book_intensivwoche_kurs()` (Abschnitt 3) — beide entstanden dadurch, dass einzelne lokale
Migrationsdateien nie gegen dieses Projekt ausgeführt wurden. Es gibt weiterhin keine über die
Supabase-CLI nachverfolgte Migrationshistorie (Abschnitt 7) — das grundsätzliche Risiko, dass
weitere, noch nicht entdeckte Migrationsdateien ebenfalls nie angewendet wurden, bleibt bestehen.
Dieses Dokument beschreibt den verifizierten Ist-Zustand; es ersetzt nicht die in Abschnitt 5/6
weiterhin offenen Verifikations- und Freigabeschritte.

## 1. Verbindlicher Live-Snapshot

Exakte Zählungen per `COUNT(*)`, nicht die geschätzten `rows`-Werte aus `list_tables`:

| Tabelle | Anzahl | Bemerkung |
|---|---:|---|
| `intensivwoche_kurse` | 72, alle `ist_aktiv` | vormals 8 — deutlich gewachsen |
| `intensivwoche_anmeldungen` | 49, davon 49 nicht storniert | vormals 48; personenbezogen, nie als Fixture exportieren |
| `subjects` | 10 | unverändert |
| `mentor_skills` | 3 | unverändert |
| `courses` / `course_occurrences` | 4 / 8 | unverändert, weiterhin ohne Code-Referenz, Herkunft ungeklärt |
| `profiles` | 24 | — |
| `learning_materials` | 2 | auffällig niedrig, siehe Abschnitt 4 |
| `offers` | 20 | — |
| `offer_editions` | 20, davon 20 `status='published'` | **alle** Editionen sind veröffentlicht |

## 2. Vollständige Tabelleninventur nach Bounded Context

Alle 27 in `architektur-briefing-kursseiten.md`/dem alten Review als "Zieltabellen" geführten
Tabellen sind vorhanden. Die Soll-/Ist-Matrix aus dem 19.07.2026-Stand (5 vorhanden, 22 fehlend)
ist damit überholt:

| Bounded Context | Tabellen (alle vorhanden) | Zeilen |
|---|---|---|
| Identität | `profiles`, `subjects` | 24, 10 |
| Marketing-Katalog | `offers`, `offer_editions`, `course_sessions`, `school_holiday_weeks` | 20, 20, 0, 12 |
| Buchung | `intensivwoche_kurse`, `intensivwoche_anmeldungen` | 72, 49 |
| Materialzugriff | `material_areas`, `self_study_enrollments`, `material_access_grants` | 4, 0, 0 |
| Tagesfreigaben | `course_days`, `daily_releases`, `daily_release_items`, `release_content_catalog` | 0, 0, 0, 0 |
| Arbeitszeit/Lohn | `teacher_assignments`, `work_entries`, `teacher_rate_agreements`, `payroll_periods`, `payroll_snapshots`, `payroll_snapshot_lines` | alle 0 |
| Finanzen | `financial_events`, `expense_entries`, `financial_periods`, `budgets`, `financial_adjustments` | 1, 0, 1, 0, 0 |
| Audit | `audit_log` | 0 |

Die 0-Zeilen-Tabellen sind schematisch vollständig angelegt (inkl. FKs, siehe Abschnitt 5), aber
fachlich noch ungenutzt — konsistent mit dem Ausführungsplan, der Admin-Mutationen dafür erst über
die noch zu bauenden Masken (Schritt 10a–10d) vorsieht.

### 2.1 Nicht im Zielschema erfasste, aber live vorhandene Lernplattform-Domäne

Weder `architektur-briefing-kursseiten.md` noch das bisherige Review erfassen diese Tabellen —
sie gehören zur bestehenden Lernplattform (Prüfungstrainer, Übungen, Aufsatzkorrektur, Mentoring,
Gamification) ausserhalb des Marketing-Migrationsscopes:

- **Prüfungstrainer/Übungen:** `trainer_exams` (29), `trainer_progress` (2), `exercises` (8),
  `questions` (0), `tasks` (22), `math_solution_steps` (5), `user_exercises` (33)
- **Aufsatzkorrektur:** `student_essays` (7), `essay_ai_corrections` (5), `correction_rubrics` (5)
- **Mentoring:** `mentorship_listings` (5), `mentorship_requests` (3), `mentorship_relations` (4),
  `mentorship_materials` (0), `chat_messages` (0)
- **Gamification/Sonstiges:** `badges` (9), `user_badges` (2), `wake_up` (2), `mail_outbox` (2),
  `intensivwoche_buchungsversuche` (1, Rate-Limiter-Log)

Diese Tabellen sind für die Kursseiten-/Startseiten-Migration nur insoweit relevant, als
`release_content_catalog` (Tagesfreigaben-Feature) per FK auf `exercises` und `trainer_exams`
verweist (siehe Abschnitt 5).

## 3. Widerspruch zu einer dokumentierten Preis-Entscheidung — behoben (29.07.2026)

**Fund:** `offer_editions` besass live weiterhin die Spalten `early_bird_enabled` (boolean),
`early_bird_price_rappen` (integer) und `early_bird_deadline` (date), obwohl der
„Betreiberentscheid 27.07.2026" ihre Entfernung dokumentiert. Codesuche über `.ts`/`.tsx` ergab
keinen einzigen Treffer für diese Spalten (auch nicht camelCase) — `lib/pricing.ts` und das
Admin-Formular implementieren bereits ausschliesslich die automatische 10%/42-Tage-Regel.

**Weiterführender Fund — aktiver Preis-Bug:** Die Live-Funktion `book_intensivwoche_kurs()` hatte
ebenfalls noch den alten Stand: `booked_price_rappen` wurde ausnahmslos als
`round(v_kurs.preis * 100)` berechnet, **ohne** die 42-Tage/10%-Prüfung. Das bedeutete eine aktive
Diskrepanz zwischen Anzeigepreis (Terminliste zeigt bereits den Rabatt über
`computeSessionPricing()`) und tatsächlich belastetem/gespeichertem Preis für **jede neue
Buchung** ab dem 27.07.2026. Eine Prüfung aller 49 bestehenden, nicht stornierten Anmeldungen ergab
jedoch: **keine davon ist retroaktiv betroffen** — alle wurden vor dem 27.07.2026 erstellt, also
bevor die automatische Regel überhaupt beschlossen wurde (der alte manuelle Frühbucherpreis wirkte
sich laut Migrationskommentar nie auf den belasteten Preis aus, das war schon vorher so gewollt).
Kein rückwirkender Korrekturbedarf bei bestehenden Buchungen.

**Ursache (beide Funde):** Die Migration `20260727170000_automatic_early_bird_discount.sql` —
enthält sowohl den Spalten-Drop als auch das `CREATE OR REPLACE FUNCTION
book_intensivwoche_kurs(...)` mit der Rabattlogik — wurde nie gegen `notaqfguhhjpvmagvcic`
ausgeführt. Weiterer Beleg dafür, dass dieses Live-Projekt nicht durch lückenloses Abspielen der
lokalen `supabase/migrations/*.sql` in Reihenfolge entstanden ist (siehe Abschnitt 7).

**Behoben:** Der Nutzer hat die komplette Migrationsdatei am 29.07.2026 über den
Dashboard-SQL-Editor nachgezogen. Verifiziert read-only: `book_intensivwoche_kurs()` enthält jetzt
`v_early_bird`/die Rabattberechnung, `offer_editions` hat 0 verbleibende `early_bird_*`-Spalten.

## 4. Weitere auffällige Punkte

- **`learning_materials` hat nur 2 Zeilen.** Für eine Plattform mit Prüfungstrainer/Übungen/
  Mentoring-Historie ist das auffällig wenig — entweder wurde der Materialbestand beim
  Kontowechsel nicht mitübernommen, oder er war schon vorher so klein. Vor einer Backfill-/
  Migrationsentscheidung (Abschnitt 2.11 des Architektur-Briefings) klären.
- **`courses`/`course_occurrences` unverändert bei 4/8 Zeilen** trotz des Kontowechsels — spricht
  eher für „wurde 1:1 mitmigriert" als für „neu angelegt", bestätigt aber nicht die frühere
  Vermutung zur Herkunft.
- **`offer_editions`: alle 20 Zeilen `status='published'`.** Damit greift die in
  `design-review-todo.md` dokumentierte Preis-Vorschau-Regel (`SHOW_PRICE_PREVIEW_BADGE`)
  vermutlich für alle Angebote gleichzeitig — nicht einzeln neu geprüft in dieser Runde.

## 5. Bereits verifiziert umgesetzte Entscheidungen (mit Beleg)

Diese frühere „offene Punkte"/„Betreiberentscheide" sind auf dem aktuellen Live-Projekt konkret
nachgewiesen, nicht nur laut Migrationsdatei-Historie behauptet:

- **Rollenmodell (vormals Abschnitt 3.2):** `profiles_role_check` ist exakt
  `CHECK (role = ANY (ARRAY['user','lehrperson','admin']))` — kein Enum, keine `teacher`/
  `student`-Werte. `profiles_class_level_check` erlaubt `4./5./6. Klasse`, `1./2./3. Sek`,
  `Gymnasium`, `other`.
- **Booking-RPC-Härtung (vormals Abschnitt 3.4):** `book_intensivwoche_kurs(...)` hat
  `p_idempotency_key uuid` als Pflichtparameter. `idx_anmeldungen_idempotency_key_unique` ist ein
  partieller Unique-Index auf `idempotency_key WHERE idempotency_key IS NOT NULL`.
  `idx_anmeldungen_kurs_email_child_unique` ist exakt der dokumentierte familienfähige
  Duplikatschlüssel: `(kurs_id, lower(parent_email), lower(trim(child_firstname)),
  lower(trim(child_lastname))) WHERE status <> 'storniert'`. `intensivwoche_buchungsversuche`
  belegt den Rate-Limiter (Kommentar: „max. 5 Versuche / 10 Minuten je parent_email").
  `enforce_anmeldung_price_snapshot_immutable()` existiert als Trigger-Funktion.
- **Geld/Snapshots (vormals Abschnitt 3.3):** `intensivwoche_anmeldungen.booked_price_rappen`
  (integer), `.currency`, `.idempotency_key`, `.edition_id`, `.session_id` sind alle vorhanden —
  die im alten Review als „fehlend" geführten drei letzten Spalten existieren jetzt.
  `offer_editions.regular_price_rappen`, `financial_events.amount_rappen`,
  `payroll_snapshot_lines.hourly_rate_rappen`/`.amount_rappen`,
  `teacher_rate_agreements.hourly_rate_rappen` folgen konsistent der `..._rappen`-Konvention.
- **View-Härtung:** `intensivwoche_kurse_mit_anmeldungen` hat laut `pg_class.reloptions`
  tatsächlich `security_invoker=true` (nicht nur laut `view_definition`-Text geprüft — das allein
  wäre kein verlässlicher Nachweis für ein Reloption).
- **Admin-Maske-Backing existiert bereits als RPC:** `admin_upsert_course_session(...)`,
  `admin_save_daily_release(...)`, `admin_save_rate_agreement(...)`,
  `admin_close_payroll_period(...)` sind vorhandene Funktionen (nicht `SECURITY DEFINER`, laufen
  also unter der aufrufenden Rolle — RLS der Zieltabellen greift). Das deckt sich mit Schritt
  10a/10b/10c des Ausführungsplans.
- **`link_anmeldung_beneficiary()`** existiert — deckt den in Abschnitt 2.11 des
  Architektur-Briefings beschriebenen Eltern-ohne-Konto-Zuordnungsflow ab.

## 6. FK-Graph nach Bounded Context (verifiziert, 29.07.2026)

- `course_sessions.id` → `intensivwoche_kurse.id` (1:1-Erweiterung, PK=FK, wie in Abschnitt 2.12
  des Architektur-Briefings gefordert) UND `course_sessions.edition_id` → `offer_editions.id`.
- `offer_editions.offer_id` → `offers.id`.
- `intensivwoche_anmeldungen.kurs_id` → `intensivwoche_kurse.id`,
  `.edition_id` → `offer_editions.id`, `.session_id` → `course_sessions.id` — alle drei FKs aktiv.
- `learning_materials.area_id` → `material_areas.id`, `.subject_id` → `subjects.id`.
- `self_study_enrollments.area_id` → `material_areas.id`;
  `material_access_grants.area_id` → `material_areas.id`.
- `course_days.session_id` → `course_sessions.id`; `daily_releases.course_day_id` →
  `course_days.id`; `daily_release_items.release_id` → `daily_releases.id`,
  `.content_item_id` → `release_content_catalog.id`.
- `release_content_catalog` hat sowohl `exercise_id` → `exercises.id` als auch `trainer_exam_id`
  → `trainer_exams.id` (XOR-Check aus Abschnitt 2.13 nicht separat verifiziert, aber beide FKs
  wie vorgesehen vorhanden).
- `teacher_assignments.session_id` / `work_entries.session_id` → `course_sessions.id`;
  `work_entries.submission_id` → `student_essays.id` (Aufsatzkorrektur als Arbeitszeit-Quelle).
- `payroll_snapshot_lines` → `work_entries.id`, `teacher_rate_agreements.id`,
  `payroll_snapshots.id`; `payroll_snapshots.period_id` → `payroll_periods.id`.
- `financial_events.edition_id` → `offer_editions.id`, `.session_id` → `course_sessions.id`;
  `expense_entries.edition_id`/`.session_id` analog; `budgets.period_id`/
  `financial_adjustments.period_id` → `financial_periods.id`.

Die Bounded-Context-Trennung aus dem alten Review (Abschnitt 4 dort) ist damit strukturell exakt
so umgesetzt, wie sie beschrieben war — `course_sessions` ist tatsächlich nur eine 1:1-Erweiterung,
kein zweites Buchungssystem.

### 6.1 Nachgezogene Migration: `school_holiday_weeks` (29.07.2026, erledigt)

Ein systematischer Abgleich aller `CREATE TABLE`-Anweisungen in `supabase/migrations/*.sql` gegen
die Live-Tabellenliste ergab genau eine Abweichung: `school_holiday_weeks` aus der jüngsten lokalen
Migration (`20260728090000_school_holiday_weeks_schema.sql` +
`20260728091000_seed_school_holiday_weeks.sql`) fehlte live, obwohl der zugehörige Code
(`app/(dashboard)/dashboard/kurse/durchfuehrungen/actions.ts`, `lib/kurse/catalog.ts`,
`lib/kurse/fixed-school-schedule.ts`) bereits committed ist (Commit `d4efe25`) — das
Admin-Ferienwochen-Feature war dadurch potenziell defekt. Der Nutzer hat beide Dateien am
29.07.2026 manuell über den Dashboard-SQL-Editor nachgezogen; verifiziert: 12 Zeilen, 9
`schedule_group`-Werte, 2 `holiday_type`-Werte — exakt wie im Seed vorgesehen.

Alle übrigen 53 lokalen Migrationsdateien (inkl. `20260719133741_live_schema_baseline.sql`) sind
auf Ebene der `CREATE TABLE`-Anweisungen jetzt vollständig deckungsgleich mit dem Live-Schema.
Das bedeutet **nicht**, dass jede einzelne `ALTER`/`CREATE POLICY`/`CREATE FUNCTION`-Anweisung
darin geprüft wurde — nur die Tabellenebene wurde systematisch abgeglichen.

## 7. Migrationshistorie: keine — Konsequenz für die Baseline-Strategie

`list_migrations` liefert eine leere Liste. Ein direkter Check bestätigt: Das Schema
`supabase_migrations` existiert auf diesem Projekt **gar nicht** (`relation
"supabase_migrations.schema_migrations" does not exist`). Das Schema wurde also nicht über
CLI-getrackte, zeitgestempelte Migrationen aufgebaut, sondern vermutlich direkt per SQL
(Dashboard-SQL-Editor oder MCP `apply_migration`, das ohne vorhandenes Tracking-Schema keine
Historie hinterlässt).

**Konsequenz:** Die im Architektur-Briefing verbindlich vorgeschriebene Baseline-Strategie („für
jeden erneut bestätigten Remote-Migrationseintrag einen History-Marker mit identischem
14-stelligem Zeitstempel ablegen", `migration list`/`db push --dry-run`-Abgleich) setzt eine
vorhandene Remote-Migrationshistorie voraus, die es hier nicht gibt. Bevor Schritt 0 des
Ausführungsplans für dieses Projekt fortgesetzt wird, muss geklärt werden, ob:

1. `supabase_migrations.schema_migrations` bewusst nie initialisiert wurde und der gesamte
   bisherige Schema-Aufbau nachträglich in getrackte Migrationsdateien überführt werden soll
   (einmaliger, sorgfältig geprüfter Nachzieh-Schritt), oder
2. ein anderer, für dieses Projekt passender Baseline-Ansatz gewählt wird, der ohne
   Remote-Zeitstempel-Abgleich auskommt.

Dies ist eine Architekturentscheidung, keine reine Doku-Korrektur — nicht im Rahmen dieses
Live-Abgleichs vorweggenommen.

## 8. Security-Advisor — Kurzfassung (Detailprüfung auf Wunsch zurückgestellt)

Read-only `get_advisors(type=security)` liefert zusätzlich zu den in Abschnitt 5 bereits als
gewollt eingeordneten `anon`-aufrufbaren `SECURITY DEFINER`-RPCs (`book_intensivwoche_kurs` etc.):

- 2× `rls_enabled_no_policy` (INFO): `profiles.profiles` (vermutlich ein Schema-Artefakt, zu
  prüfen) und `public.intensivwoche_buchungsversuche` (laut Tabellenkommentar bewusst ohne
  Policies, nur service-intern beschrieben/gelesen).
- 6× `function_search_path_mutable` (WARN): u. a. `get_upcoming_courses`,
  `set_essay_review_timestamp`, `update_updated_at_column` — kein fester `search_path` gesetzt.
- `auth_leaked_password_protection` (WARN): HaveIBeenPwned-Check ist deaktiviert.

Vertiefte Bewertung (welche `SECURITY DEFINER`-Freigaben tatsächlich gewollt sind, Umgang mit den
`search_path`-Warnungen) ist auf Wunsch des Nutzers für eine separate Runde zurückgestellt.

## 9. Weiterhin offen / in dieser Runde nicht verifiziert

- Vollständige RLS-Policy-Texte pro Tabelle (nur Tabellenkommentare und `rls_enabled`-Flag
  geprüft, nicht jede einzelne Policy-Definition).
- Storage-Bucket-Policies (`avatars`, `lernmaterialien`, `student-essays`,
  `correction-rubrics`).
- Trigger-Vollständigkeit über die in Abschnitt 5 gefundenen hinaus.
- Ob `courses`/`course_occurrences` weiterhin als „nicht ohne Fachprüfung löschbar" gilt oder
  inzwischen eine Entscheidung dazu getroffen wurde.
- Das komplette Zwölf-Befehle-Verifikationsgate aus Abschnitt 10 des Architektur-Briefings
  (`db reset --local`, pgTAP, `typecheck`, `build`, Routen-/Linktests) wurde in dieser Runde nicht
  ausgeführt — dieser Live-Abgleich ersetzt das Gate nicht.

## 10. Empfohlene nächste Schritte

1. ~~Early-Bird-Preis-Bug und tote Spalten beheben~~ **Erledigt (29.07.2026):** siehe Abschnitt 3 —
   Migration nachgezogen, Funktion berechnet jetzt korrekt, Spalten gedroppt, verifiziert.
2. ~~`school_holiday_weeks` fehlte live~~ **Erledigt (29.07.2026):** siehe Abschnitt 6.1 —
   nachgezogen und verifiziert (12 Zeilen).
3. Migrationshistorie-Lücke (Abschnitt 7) als eigene Entscheidung mit dem Nutzer klären, bevor
   Schritt 0 des Ausführungsplans für dieses Projekt fortgesetzt wird. Punkt 1 und 2 waren beide
   Symptome derselben Ursache (einzelne Migrationsdateien nie angewendet) — ohne Tracking bleibt
   das Risiko, dass weitere, noch nicht entdeckte Lücken existieren.
4. `learning_materials`-Bestand (Abschnitt 4) klären — bewusst klein oder Datenverlust beim
   Kontowechsel?
5. Bei Bedarf: Security-Advisor-Befunde aus Abschnitt 8 in einer eigenen, fokussierten Runde
   vertiefen.
