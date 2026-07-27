# Datenbank-Review: aktueller Stand und verbindliche Migrationsentscheidungen

Stand: 19.07.2026. Dieses Dokument ersetzt das Review vom 16.07.2026 vollständig. Grundlage sind
alle 37 HTML-Referenzen, die vier Markdown-Dokumente in `design-reference/`, der aktuelle Code,
`types/database.ts`, sämtliche lokalen SQL-Dateien sowie ein schreibgeschützter Live-Abgleich des
Supabase-Projekts. Die sechs Counts, der Aktivstatus sowie die 27-Tabellen-/Vier-Spalten-Matrix
wurden am 19.07.2026 erneut read-only über HTTP HEAD beziehungsweise die REST-Schemabeschreibung
bestätigt. Die vollständige DB-Migrationshistorie und das DB-Level-Schema stammen weiterhin aus
dem Kataloglauf vom 18.07.2026 und müssen vor der Baseline-Adoption erneut direkt geprüft werden.
Live-Zahlen sind datierte Kontrollwerte und werden vor jeder Migration erneut inventarisiert; sie
sind keine Seeds.

## 1. Verbindlicher Live-Snapshot

| Objekt | Stand 18.07.2026 | Bedeutung |
|---|---:|---|
| `intensivwoche_kurse` | 8, alle aktiv | kanonische bestehende Durchführungen |
| `intensivwoche_anmeldungen` | 48 | personenbezogener Bestand; niemals als Fixture exportieren |
| `subjects` | 10 | `id` ist live `bigint` |
| `mentor_skills` | 3 | `subject_id` ist live `bigint` und per FK verbunden |
| `courses` | 4 | keine Code-Referenz, aber nicht leer und nicht ohne Fachprüfung löschbar |
| `course_occurrences` | 8 | gehört zum zweiten Kurspaar; Herkunft fachlich klären |

Die Live-Kurse enthalten die Fächer `deutsch`, `mathematik`, `franzoesisch` und
`natur-mensch-gesellschaft`, die Klassenlabels 4.–8. Klasse sowie neben `Zürich HB` und
`Winterthur` zwei historische Lernzentrum-Adressen. 4./5./6. Klasse werden eindeutig gemappt;
7./8. Klasse und nicht freigegebene Standorte bleiben unverändert und erhalten `needs_review`.

### 1.1 Verifizierte Abdeckung des Zielschemas

Ein ergänzender schreibgeschützter Abgleich der von PostgREST veröffentlichten OpenAPI-Struktur am
18.07.2026 bestätigt: Das Live-Projekt ist der **Bestandsausgangspunkt**, nicht das fertige
Zielschema. Von den 27 für diese Migration geprüften Zieltabellen sind derzeit 5 vorhanden und 22
noch nicht angelegt.

| Status | Tabellen/Objekte |
|---|---|
| vorhanden | `profiles`, `subjects`, `intensivwoche_kurse`, `intensivwoche_anmeldungen`, `learning_materials` |
| Katalog fehlt | `offers`, `offer_editions`, `course_sessions` |
| Materialzugriff fehlt | `material_areas`, `self_study_enrollments`, `material_access_grants` |
| Tagesfreigaben fehlen | `release_content_catalog`, `course_days`, `daily_releases`, `daily_release_items` |
| Arbeitszeit/Lohn fehlen | `teacher_assignments`, `work_entries`, `teacher_rate_agreements`, `payroll_periods`, `payroll_snapshots`, `payroll_snapshot_lines` |
| Finanzen fehlen | `financial_events`, `expense_entries`, `financial_periods`, `budgets`, `financial_adjustments` |
| Audit fehlt | `audit_log` |

Die Bestandsobjekte sind nur teilweise zielbereit:

- `intensivwoche_anmeldungen` besitzt `booked_price_rappen` und `currency`, aber noch keine
  `idempotency_key`, `edition_id` oder `session_id`.
- `learning_materials` besitzt unter anderem `name`, `subject_id`, `class_levels`, `is_public`,
  `file_url` und `download_path`, aber noch keine FK-gesicherte `area_id`. `name` bleibt beim
  additiven Umbau die kanonische Bestandsbezeichnung; ein zusätzliches `title`-Parallelfeld wird
  nicht allein wegen abweichender View-Model-Namensgebung eingeführt.
- `intensivwoche_kurse` enthält die geprüften Bestandsfelder `id`, `name`, `fach`,
  `klassenstufen`, `start_datum`, `end_datum`, `preis`, `max_teilnehmer` und `created_by`.
- Die View `intensivwoche_kurse_mit_anmeldungen` und die RPC `book_intensivwoche_kurs` werden über
  die REST-Schemabeschreibung veröffentlicht.

Die OpenAPI-Struktur beweist keine vollständige Korrektheit von Fremdschlüsseln, Checks, Unique-
Indizes, Triggern, Grants, RLS- oder Storage-Policies. Auch Eigenschaften wie
`security_invoker = true` müssen aus dem kanonischen `pg_catalog`-/Schema-Dump beziehungsweise mit
gezielten SQL-/pgTAP-Tests bestätigt werden. Deshalb ist der Live-REST-Abgleich **kein Ersatz** für
das Baseline-Gate und keine Freigabe für Schritt 5.

## 2. Bereits behobene Live-Befunde

- `intensivwoche_kurse.created_by` existiert live inklusive FK.
- `subjects.id` und `mentor_skills.subject_id` sind beide `bigint`.
- `types/database.ts` ist die einzige kanonische, aus dem Live-Schema generierte Typdatei;
  `lib/supabase/database.types.ts` wurde entfernt.
- Die Mentorship-INSERT-Policies verwenden seit Migration `012` die Rollenwerte `lehrperson` und
  `user` statt `teacher`/`student`.
- `intensivwoche_anmeldungen.booked_price_rappen` und `currency` existieren seit Migration `013`.
- `book_intensivwoche_kurs()` und der partielle Duplikatindex existieren seit Migration `014`;
  die öffentliche Server Action verwendet ausschliesslich die RPC.
- `intensivwoche_kurse_mit_anmeldungen` ist mit `security_invoker = true` gehärtet.

Diese Punkte dürfen nicht mehr als ungeklärte Live-Lücken oder als Auftrag zum erneuten
Überschreiben dargestellt werden. Tests bleiben trotzdem Pflicht.

## 3. Weiterhin offene, verbindlich zu lösende Punkte

### 3.1 Reproduzierbare Baseline

Die lokalen Dateien `001`–`014` sind kein deploybarer Spiegel der Live-Historie: doppelte Version
`002`, falscher historischer FK, fehlende `profiles`-/`subjects`-Baselines, UUID-/Bigint-Drift und
Testbenutzer in `006`. Gleichzeitig weicht die echte Live-Migrationstabelle von diesen Namen ab.

Verbindliche Lösung ist die Baseline-Strategie aus dem Architektur-Briefing:

1. Live-Schema und Migrationstabelle read-only inventarisieren.
2. Geprüften Schema-Dump inklusive Constraints, Indizes, Triggern, Funktionen, Views, Grants, RLS
   und Storage-Policies als neuen lokalen Baseline-Strang anlegen. Die oben genannten 5 vorhandenen
   und 22 fehlenden Zieltabellen werden dabei als maschinenprüfbare Soll-/Ist-Matrix festgehalten.
3. Für jeden erneut bestätigten Remote-Migrationseintrag einen reinen Kommentar-Marker mit
   exakt demselben 14-stelligen Zeitstempel und Namen vor der Baseline ablegen. Die Marker enthalten
   kein SQL und werden nicht aus `statements` erzeugt.
4. `001`–`014` unverändert nach `supabase/legacy-migrations/` verschieben.
5. Nur synthetische Fixtures nach `supabase/seed.sql`.
6. Neue additive Migrationen ausschliesslich mit UTC-Zeitstempelpräfix.
7. Nach grünem lokalen Gate und bewiesener Schema-Gleichheit die neue Baseline-Version in einem
   separat freizugebenden Baseline-Adoption-Gate mit
   `supabase migration repair <baseline-version> --status applied` als bereits vorhanden
   registrieren. Vorher muss `migration list` alle Remote-Zeitstempel gegen die Marker abgleichen;
   vorher/nachher wird die Ausgabe protokolliert. `db push --dry-run` darf danach nur additive
   Post-Baseline-Migrationen anzeigen. Keine Reparatur der historischen Versionen
   `001`–`014`, kein Umbenennen angewandter Remote-Versionen und kein tatsächlicher `db push` ohne
   weitere separate Freigabe.

### 3.2 Rollenmodell

Die kanonischen Werte bleiben `user`, `lehrperson`, `admin`. Für diese Migration wird **kein**
Postgres-Enum eingeführt, weil ein Enum-Umbau unnötig viele bestehende Funktionen, Policies und
generierte Typen gleichzeitig berühren würde. Stattdessen erhält `profiles.role` nach Inventar und
Bereinigung einen `CHECK (role IN ('user','lehrperson','admin'))`; zentrale SQL-Helfer wie
`is_admin()` und `is_lehrperson()` sind die einzige Policy-Quelle. `teacher` und `student` sind in
neuen SQL-Dateien und Policy-Tests verboten.

### 3.3 Geld und Snapshots

Alle neuen Geldwerte werden als ganze Rappen gespeichert und benannt:

- `regular_price_rappen`
- `booked_price_rappen`
- `hourly_rate_rappen`
- `amount_rappen`

**Betreiberentscheid 27.07.2026:** `early_bird_price_rappen` (und `early_bird_enabled`/
`early_bird_deadline`) existieren nicht mehr auf `offer_editions` — der Frühbucherrabatt (10% bei
Anmeldung ≥6 Wochen vor Kursstart) wird automatisch pro Session berechnet, nicht mehr manuell
gepflegt. Siehe `supabase/migrations/20260727170000_automatic_early_bird_discount.sql` und
Abschnitt 2.12 des Architektur-Briefings.

Domainfelder verwenden dieselbe `...Rappen`-Benennung. Das bestehende
`intensivwoche_kurse.preis NUMERIC` wird beim Mapping explizit mit `round(preis * 100)` konvertiert;
es entsteht kein zweites CHF-Float-Feld. `booked_price_rappen`, `currency`, `edition_id`,
`session_id` und `idempotency_key` sind nach dem INSERT per Trigger unveränderlich. Korrekturen
erzeugen auditierte Gegen-/Neubuchungen.

### 3.4 Öffentliche Buchung

Die RPC bleibt die einzige Schreibstelle, wird aber vervollständigt:

- Kurszeile mit `FOR UPDATE` sperren, Aktivität und nicht stornierte Belegung prüfen.
- Mehrere Kinder derselben Familie zulassen. Aktive Doppelbuchung wird über
  `(kurs_id, lower(parent_email), lower(trim(child_firstname)), lower(trim(child_lastname)))`
  verhindert, nicht allein über die Eltern-E-Mail.
- `idempotency_key UUID` verhindert doppelte Verarbeitung desselben Requests.
- DB-seitige Pflichtfeld-, Format- und Maximallängenprüfungen; Zod in der Server Action ist keine
  Sicherheitsgrenze für eine direkt aufrufbare `anon`-RPC.
- Dauerhafter Rate-Limiter mit gehashter, rotierter Netzwerkkennung und Honeypot; keine Roh-IP in
  Anmeldung oder Logs.
- Minimale Grants, leerer fester `search_path`, keine direkten Client-Inserts.
- Automatisierte Tests für Geschwister, identische Doppelbuchung, Idempotenz, ungültige Payload,
  Snapshot-Unveränderlichkeit und zwei parallele Buchungen auf den letzten Platz.

### 3.5 Bestandskurse und zweites Kurspaar

`intensivwoche_kurse`/`intensivwoche_anmeldungen` bleiben bis zu einer separat freigegebenen
Ablösung kanonisch. IDs und FKs bleiben unverändert. Das zweite Paar
`courses`/`course_occurrences` ist zwar ohne Code-Referenz, enthält aber Daten; es wird weder als
Ziel des historischen falschen FKs verwendet noch gelöscht. Herkunft, fachlicher Besitzer und
eventuelle Archivierung werden in einem eigenen `needs_review`-Entscheid dokumentiert.

## 4. Zielmodell nach Bounded Context

- **Identität:** `profiles`, `subjects`, zentrale Rollenhelfer.
- **Marketing-Katalog:** `offers` → `offer_editions`; `course_sessions` ist nur eine 1:1-Erweiterung
  mit PK/FK auf `intensivwoche_kurse.id`, kein zweites Buchungssystem.
- **Buchung:** `intensivwoche_kurse`, `intensivwoche_anmeldungen`, eine atomare RPC,
  Preis-/Editions-/Session-Snapshots und Idempotenz.
- **Materialzugriff:** `material_areas`, `self_study_enrollments`,
  `material_access_grants`, genau eine `area_id` je geschütztem Material, private Storage-Objekte.
- **Tagesfreigaben:** `course_days`, `daily_releases`, `daily_release_items`.
- **Arbeitszeit/Lohn:** `teacher_assignments`, `work_entries`, zeitlich gültige
  `teacher_rate_agreements`, `payroll_periods`, unveränderliche `payroll_snapshots`.
- **Finanzen:** vorzeichenbehaftete `financial_events` mit `event_version`, Kosten, Perioden,
  Budgets und auditierte Anpassungen.
- **Audit:** eine gemeinsame append-only `audit_log`-Tabelle; keine separaten Ad-hoc-Logs.

## 5. Verbindliche Reihenfolge

1. Sicherheits-/Baseline-Gate aus Schritt 0 abschliessen.
2. Live-Inventar, Backup-/Restore-Nachweis und Sentinel-Vergleich erstellen.
3. Rollen-, Buchungs-, Snapshot- und View-Härtung lokal additiv testen.
4. Katalog-/Material-/Admin-Schema in kleinen timestamp-basierten Migrationen aufbauen.
5. Kanonische `types/database.ts` nach jedem Schemaabschnitt regenerieren und Drift in CI prüfen.
6. RLS/pgTAP, Datenmigration, Typecheck, Build, Routen-/Linktests und Produktions-Gate vollständig
   ausführen.
7. Erst danach Staging-Rollout, fachliche Freigabe und feature-flag-gesteuerter Cutover. Der
   Rollback schaltet Routen zurück und löscht keine Daten.

Mit dieser Reihenfolge gibt es genau eine aktuelle Schema-Wahrheit, keine widersprüchlichen
Rollen-/Geldtypen und keinen impliziten Auftrag, den defekten historischen Migrationsordner auf die
Live-Datenbank anzuwenden.
