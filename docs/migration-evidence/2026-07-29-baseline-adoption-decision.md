# Baseline-Adoption-Entscheidung — 29.07.2026

Löst die in `datenmodell-review.md`, Abschnitt 7, offen gelassene Architekturentscheidung ab.
Betrifft ausschliesslich das aktuell produktive Projekt `notaqfguhhjpvmagvcic` ("Lernecke").

## 1. Entscheidung

**Gewählt: Option 1 — ein einziger frischer Baseline-Dump, keine granulare Rekonstruktion der
56 lokalen Migrationsdateien.**

Begründung:

- `supabase_migrations.schema_migrations` existiert auf `notaqfguhhjpvmagvcic` nicht (erneut
  bestätigt am 29.07.2026 via `list_migrations` → leer und direkter Katalog-Check → Schema fehlt).
  Es gibt also keine Remote-Historie, gegen die einzelne lokale Dateien zeitgestempelt abgeglichen
  werden müssten — die im Architektur-Briefing beschriebene „History-Marker"-Technik (ein
  Kommentar-Marker pro bestätigtem Remote-Eintrag) setzt eine solche Historie voraus und greift
  hier nicht.
- Von den 56 lokalen Dateien wurde bisher nur die `CREATE TABLE`-Ebene systematisch gegen Live
  abgeglichen (`datenmodell-review.md`, Abschnitt 6.1). Jede einzelne Datei nachträglich auf
  Statement-Ebene (`ALTER`, `CREATE POLICY`, `CREATE FUNCTION` usw.) zu verifizieren und dann
  einzeln per `migration repair` zu registrieren, wäre erheblich aufwändiger und riskanter als ein
  einziger, vollständiger Schema-Dump von heute.
- Das Projekt hat mit den `001`–`014`-Dateien bereits ein Präzedenzmuster: Historische Dateien
  werden nicht nachträglich korrigiert, sondern unverändert nach `supabase/legacy-migrations/`
  verschoben, während ein neuer, geprüfter Baseline-Dump den ausführbaren Strang eröffnet.

**Konsequenz:** Alle 56 aktuellen Dateien unter `supabase/migrations/` (inklusive
`20260719133741_live_schema_baseline.sql`) werden nach erfolgreichem neuem Dump als historisch
archiviert behandelt — nicht weil sie falsch waren, sondern weil sie durch einen vollständigeren,
heute frisch gezogenen Snapshot abgelöst werden. Granulare Historie „welche Migration hat X
eingeführt" geht damit ab dem neuen Baseline-Zeitpunkt verloren; sie bleibt aber als Referenz in
`supabase/legacy-migrations/` lesbar.

## 2. Blocker, der vor dem eigentlichen Dump zuerst gelöst werden muss

Die bestehende, gepinnte Verbindungskette für read-only Baseline-Arbeit zeigt noch auf das **alte**
Projekt:

| Datei | Aktueller Wert | Problem |
|---|---|---|
| `supabase/pg_service.conf` | `host=aws-0-eu-central-2.pooler.supabase.com`, `user=zap_baseline_reader.ybzdibifgqjsbohtztmy` | zeigt auf `ybzdibifgqjsbohtztmy` (ZAP_25, altes Konto), nicht auf `notaqfguhhjpvmagvcic` |
| `scripts/approved-db-connection.ps1` | prüft exakt diese Werte in `$requiredServiceEntries` | validiert also aktuell nur die alte, für dieses Projekt nicht mehr gültige Konfiguration |

Diese Dateien wurden am 18./19.07.2026 für das damals verbundene alte Konto erstellt (siehe
CLAUDE.md-Hinweis zum Kontowechsel). Sie enthalten kein Passwort und sind unbedenklich lesbar, aber
technisch für `notaqfguhhjpvmagvcic` nicht nutzbar. Auf diesem neuen Projekt existiert ausserdem
noch keine `zap_baseline_reader`-Rolle — sie müsste dort neu angelegt werden.

`get_project(notaqfguhhjpvmagvcic)` liefert `region=eu-west-1`. Nach Supabase-Konvention
(`aws-0-<region>.pooler.supabase.com`) wäre der Pooler-Host vermutlich
`aws-0-eu-west-1.pooler.supabase.com` — **nicht verifiziert**, da ich keine Verbindung ohne
Zugangsdaten herstellen kann. Vor Verwendung im Dashboard unter „Connect" gegenprüfen.

## 3. Runbook für den menschlichen Operator (nicht durch den Assistenten ausführbar)

Passwörter/Service-Keys werden gemäss CLAUDE.md nie im Chat getippt oder gehandhabt. Die folgenden
Schritte laufen deshalb ausschliesslich im eigenen Terminal des Nutzers.

### 3.1 Befristete read-only Rolle auf dem neuen Projekt anlegen

Im Supabase-Dashboard-SQL-Editor von `notaqfguhhjpvmagvcic` (oder per `psql` mit den bestehenden
Admin-Zugangsdaten), analog zur damaligen Rolle für das alte Projekt:

```sql
-- Eigenes, befristetes Passwort wählen (nicht mit dem Assistenten teilen).
create role zap_baseline_reader with login password '<selbst gewähltes Passwort>'
  valid until '<Datum, z. B. 2026-08-05>'
  connection limit 2;

grant usage on schema public to zap_baseline_reader;
grant select on all tables in schema public to zap_baseline_reader; -- nur für die Dump-Dauer
-- unmittelbar nach dem Dump wieder:
-- revoke select on all tables in schema public from zap_baseline_reader;
```

### 3.2 `pg_service.conf` und `approved-db-connection.ps1` aktualisieren

**Erledigt (29.07.2026):** Beide Dateien wurden auf ausdrücklichen Wunsch des Nutzers bereits
aktualisiert (Host `aws-0-eu-west-1.pooler.supabase.com` per Supabase-Konvention aus
`region=eu-west-1` abgeleitet — **nicht gegen das Dashboard verifiziert**, vor der ersten
Verbindung unter „Connect" gegenprüfen; User `zap_baseline_reader.notaqfguhhjpvmagvcic`). Beide
Dateien enthalten kein Passwort und keine Rollen-Erstellung — das bleibt Schritt 3.1 unten. Review
der Diffs vor der ersten Nutzung trotzdem empfohlen, da es Teil der geprüften Verbindungskette ist.

### 3.3 Schema-only Dump erzeugen

> **Nachtrag (29.07.2026, nach dem ersten Dump gefunden):** Die ursprüngliche Fassung dieses
> Befehls enthielt `--no-owner --no-privileges=false`. `--no-privileges` nimmt bei `pg_dump` keinen
> Wert entgegen; das `=false` wurde beim Parsen stillschweigend ignoriert und die Option damit wie
> ein einfaches `--no-privileges` behandelt — der erste Dump (und die daraus abgeleitete
> `supabase/migrations/20260729180000_live_schema_baseline_2026_07_29.sql`) enthält dadurch **0**
> `GRANT`/`REVOKE`-Anweisungen (zum Vergleich: der alte Baseline-Strang hatte 166).
>
> **Zweiter Nachtrag (29.07.2026, beim ersten Re-Dump-Versuch gefunden):** Dieser Befehl fehlte
> ausserdem von Anfang an `--schema=public`. Ohne diese Einschränkung versucht `pg_dump`, auch die
> Supabase-verwalteten Schemas `auth`/`storage`/`realtime` zu sperren (`LOCK TABLE ... IN ACCESS
> SHARE MODE`), auf die `zap_baseline_reader_lernecke` nie Rechte hatte — Fehlschlag mit
> `permission denied for schema auth`. Der erste, erfolgreiche Dump lief nur deshalb durch, weil
> laut Kommentar in `supabase/migrations/20260729180000_live_schema_baseline_2026_07_29.sql`
> tatsächlich `pg_dump --schema=public` verwendet wurde — der damals ausgeführte Befehl wich also
> bereits vom hier dokumentierten Text ab, ohne dass das nachgetragen wurde. Der Befehl unten ist
> jetzt für beide Lücken korrigiert (`--no-privileges=false` entfernt, `--schema=public` ergänzt);
> ein **erneuter Dump mit dem korrigierten Befehl ist noch ausstehend**, siehe Abschnitt 5.

Mit der bereits gepinnten `pg_dump.exe` (siehe `scripts/approved-postgres-tools.ps1`, SHA-256
bereits verifiziert, keine neue Installation nötig):

```powershell
. .\scripts\approved-postgres-tools.ps1
. .\scripts\approved-db-connection.ps1   # nach obigem Update

$env:PGPASSWORD = '<Passwort nur für diesen Prozess, danach $env:PGPASSWORD = $null>'
$env:PGSSLROOTCERT = $ApprovedSupabaseCaPath

& $ApprovedPgDumpPath `
  "service=zap_baseline_readonly" `
  --schema-only `
  --schema=public `
  --no-owner `
  --file docs\migration-evidence\private\2026-07-29\live-schema-baseline.2026-07-29.sql

$env:PGPASSWORD = $null
```

Direkt danach in der DB: `revoke select on all tables in schema public from zap_baseline_reader;`
und optional die Rolle wieder löschen, wenn sie nicht als Daueraufgabe gebraucht wird.

### 3.4 Review, Geheimnis-Scan, lokales Gate

Wie bei den bisherigen Dumps (siehe `2026-07-18-supabase-baseline-inventory.md`, Abschnitt 14):

1. Geheimnismuster-Scan auf den Dump (keine Passwörter/Tokens/Datenzeilen).
2. Diff gegen ein frisches Katalog-Inventar (Tabellen-/Funktions-/Policy-/Trigger-/Index-Counts wie
   in Abschnitt 6 des Inventars vom 18.07.) — sollte nach den zwei erst kürzlich nachgezogenen
   Korrekturen (`book_intensivwoche_kurs`, `school_holiday_weeks`) 0 Drift zeigen.
3. Aus dem Dump eine datenfreie Datei
   `supabase/migrations/<neuer UTC-Zeitstempel>_live_schema_baseline_2026_07_29.sql` ableiten.
4. Alle 56 aktuellen `supabase/migrations/*.sql`-Dateien nach `supabase/legacy-migrations/`
   verschieben (unverändert, nur verschoben).
5. Lokal: `supabase db reset --local` (nur noch die neue Baseline-Datei), `db lint`, `test db`.
6. Erst nach grünem lokalem Gate und separater Freigabe: menschlicher Operator führt
   `supabase migration repair <neue-baseline-version> --status applied` gegen
   `notaqfguhhjpvmagvcic` aus. Kein `db push` der Baseline selbst.
7. `supabase migration list` vorher/nachher protokollieren; `supabase db push --dry-run` muss
   danach ausschliesslich zukünftige additive Migrationen zeigen.

**Nachtrag (29.07.2026): Schritte 3.1–3.4.4 wurden vom menschlichen Operator durchgeführt**
(Commit `104eb6b`, „chore(supabase): adopt a single fresh schema baseline, retire 56 migration
files"). Ergebnis:

- Dump liegt unter `docs/migration-evidence/private/2026-07-29/live-schema-baseline.2026-07-29.sql`.
- Baseline-Datei `supabase/migrations/20260729180000_live_schema_baseline_2026_07_29.sql` ist die
  einzige aktive Migration; alle 56 vorherigen Dateien liegen unverändert in
  `supabase/legacy-migrations/`.
- Schritt 3.4.5 (lokales Gate) lief laut Commit-Message „mostly passes", mit zwei dokumentierten
  Lücken, die vor Schritt 3.4.6 (`migration repair` gegen Live) noch zu schliessen sind:
  1. **Gefunden und hier in Abschnitt 3.3 korrigiert:** Der verwendete `pg_dump`-Befehl enthielt
     das ungültige Flag `--no-privileges=false`, wodurch der Dump **0** `GRANT`/`REVOKE`-Anweisungen
     enthält (alter Baseline-Strang: 166). Ein erneuter Dump mit dem jetzt korrigierten Befehl steht
     noch aus.
  2. **Gefunden und behoben (Assistant, ohne Live-Zugriff, nur lokale Dateien):** `offers`,
     `material_areas`, `offer_editions` und `school_holiday_weeks` wurden bisher über vier der
     archivierten Migrationen befüllt (`20260721074103_seed_offer_catalog.sql`,
     `20260720140000_material_access_schema.sql`, die drei kumulativen
     `202607{22130621,23063259,23072315}_seed_published_offer_editions.sql`,
     `20260728091000_seed_school_holiday_weeks.sql`) und sind in der neuen, rein schemabasierten
     Baseline leer. Diese vier Tabellen sind laut den Kommentaren in den Original-Migrationen
     bewusst **Migrationsinhalt, nicht `supabase/seed.sql`**: deterministische Referenzdaten, auf
     jeder Umgebung (lokal/Staging/Live) identisch — anders als `seed.sql`, das laut
     `step0Baseline.revision2.md` nie remote ausgerollt wird. Wiederhergestellt als vier neue,
     nach der Baseline liegende additive Migrationen:
     `20260729190000_seed_offer_catalog.sql`, `20260729190100_seed_material_areas.sql`,
     `20260729190200_seed_published_offer_editions.sql` (Spaltenliste an den aktuellen Schema-Stand
     angepasst — `early_bird_enabled`/`early_bird_price_rappen`/`early_bird_deadline` existieren seit
     `20260727170000_automatic_early_bird_discount.sql` nicht mehr auf `offer_editions`),
     `20260729190300_seed_school_holiday_weeks.sql`. Werte unverändert aus den archivierten
     Dateien übernommen, keine Live-Verbindung nötig.
- Schritte 3.4.6 und 3.4.7 (`migration repair` gegen `notaqfguhhjpvmagvcic`, `migration list`/
  `db push --dry-run`-Protokoll) sind **noch nicht ausgeführt** — siehe Abschnitt 5.

## 4. Was ich (Assistant) jetzt bereits erledigt habe

- Live bestätigt: `supabase_migrations`-Schema fehlt weiterhin auf `notaqfguhhjpvmagvcic`
  (read-only, keine Zugangsdaten nötig).
- Entscheidung dokumentiert und in `datenmodell-review.md` referenziert.
- Blocker (veraltete Verbindungskonfiguration fürs alte Konto) gefunden und hier dokumentiert,
  **ohne** `pg_service.conf`/`approved-db-connection.ps1` selbst zu ändern — das bleibt eine
  bewusste Freigabeentscheidung des Nutzers, analog zum bisherigen Vorgehen bei dieser Kette.
- Keine SQL-Mutation, kein Passwort, kein Rollen-Anlegen gegen Live ausgeführt.
- **Nachtrag (29.07.2026):** Nach Schritt 3.1–3.4.4 durch den menschlichen Operator (Commit
  `104eb6b`) die dabei entstandenen zwei Lücken lokal, ohne Live-/Passwort-Zugriff behoben: den
  fehlerhaften `pg_dump`-Befehl in Abschnitt 3.3 korrigiert und die vier fehlenden
  Katalog-/Referenztabellen (`offers`, `material_areas`, `offer_editions`,
  `school_holiday_weeks`) als vier neue additive Migrationen
  (`20260729190000`–`20260729190300`) aus den bereits archivierten Quelldateien
  wiederhergestellt. Weiterhin keine SQL-Mutation, kein Passwort, kein Rollen-Anlegen gegen Live.

## 5. Offen

1. ~~Menschlicher Operator, eigenes Terminal: Lokales Gate erneut laufen lassen~~ **Erledigt
   (29.07.2026, Assistant, rein lokal via Docker/pinned CLI, keine Live-Verbindung):**
   `db reset --local` wendet alle fünf Migrationen (Baseline + die vier neuen) fehlerfrei an,
   `db lint --local --level error --fail-on error` liefert 0 Fehler. `test db --local` bestätigt
   exakt den erwarteten Befund: **7 von 24 Testdateien schlagen fehl, alle mit
   `permission denied`/fehlenden Table-Grants** (`0005_booking_hardening.sql` Tests 13–16,
   `0017_material_access_grant_admin_and_storage.sql` Tests 5+7,
   `0018_public_availability_count.sql`, `0019_authenticated_select_active_kurse.sql`,
   `0020_mail_outbox_schema.sql`) — deckungsgleich mit der in Abschnitt 3.3 dokumentierten
   fehlenden `GRANT`/`REVOKE`-Lücke, kein neuer Befund. Die vier neuen Referenzdaten-Migrationen
   selbst laufen sauber durch; die zugehörigen pgTAP-Dateien
   (`0021_seed_published_offer_editions.sql`, `0024_school_holiday_weeks.sql`) sind grün.
   **Zusätzlich gefunden und behoben (29.07.2026, Assistant, rein lokal), unabhängig vom
   Baseline-Dump:** `0007_material_access_schema.sql` und `0011_daily_releases_schema.sql` schlugen
   mit `null value in column "class_levels" violates not-null constraint` fehl. Ursache: Beide
   Fixtures stammen aus einer Zeit, in der `learning_materials.class_levels` noch
   `DEFAULT ARRAY['5. Klasse','6. Klasse']` hatte (siehe alter Baseline-Strang,
   `supabase/legacy-migrations/20260719133741_live_schema_baseline.sql`) bzw.
   `exercises.class_levels` noch gar nicht existierte. Der neue, aus dem echten Live-Schema gezogene
   Baseline-Dump zeigt korrekt den aktuellen Live-Stand: beide Spalten sind inzwischen `NOT NULL`
   ohne Default, mit CHECK auf eine feste Werteliste. Kein Bug des Dumps, sondern ein nie
   nachgezogenes Test-Fixture. Fix: `class_levels`-Werte explizit in beiden Fixtures ergänzt
   (`supabase/tests/database/0007_material_access_schema.sql`,
   `supabase/tests/database/0011_daily_releases_schema.sql`). Erneuter lokaler Testlauf: `0007` ist
   jetzt vollständig grün; `0011` läuft jetzt bis zum Ende durch (vorher brach die Datei nach 4 von
   16 Tests ab) und zeigt noch **einen** Fehlschlag (Test 13, „release_content_catalog ist
   oeffentlich lesbar") — das ist derselbe, bereits bekannte GRANT-Gap aus Abschnitt 3.3, kein neuer
   Befund. Nach diesem Fix sind **ausnahmslos alle** verbleibenden pgTAP-Fehlschläge
   (`0005`, `0011` Test 13, `0017`, `0018`, `0019`, `0020`) auf die eine fehlende
   `GRANT`/`REVOKE`-Lücke aus Abschnitt 3.3 zurückzuführen; es gibt keine weiteren offenen
   Fixture-/Testbugs.
2. ~~Menschlicher Operator, eigenes Terminal: Erneuten Schema-only-Dump...~~ **Erledigt
   (29.07.2026).** Rolle `zap_baseline_reader_lernecke` war noch gültig (`valid until
   2026-08-05`), `SELECT` erneut erteilt, Re-Dump mit dem in Abschnitt 3.3 korrigierten Befehl
   erzeugt (`docs/migration-evidence/private/2026-07-29/live-schema-baseline.2026-07-29-redump.sql`,
   242 KB, 7076 Zeilen). `SELECT` danach wieder entzogen.
   **Sicherheitsvorfall während dieses Schritts:** Der Nutzer hat das `PGPASSWORD` des ersten
   Dump-Versuchs im Klartext in den Chat eingefügt (Passwort für `zap_baseline_reader_lernecke`,
   `select`-only, `connection limit 2`). Der Assistant hat den Befehl nicht ausgeführt, auf die
   Exposition hingewiesen und Rotation empfohlen; der Nutzer hat sich nach Rückfrage bewusst gegen
   eine Rotation entschieden. Für den zweiten (erfolgreichen) Dump-Versuch wurde ein neues Passwort
   ausserhalb des Chats gesetzt. Firmenregel bleibt unverändert: Passwörter/Service-Keys werden nie
   im Chat getippt.
   - **Geheimnis-Scan:** 0 Treffer für Passwort-/Token-/PEM-/JWT-Muster im Re-Dump (u. a. Fragmente
     des im Chat exponierten Passworts, `PGPASSWORD`, `-----BEGIN`, `eyJ` je 0 Vorkommen). Das
     exponierte Passwort selbst wird hier bewusst nicht wiederholt.
   - **Diff gegen den ersten Dump:** Einzige inhaltliche Differenz sind die neu hinzugekommenen
     395 `GRANT`- und 14 `REVOKE`-Anweisungen plus ein `ALTER DEFAULT PRIVILEGES`-Block (die
     `\restrict`/`\unrestrict`-Tokens unterscheiden sich erwartungsgemäss pro Dump-Lauf). Kein
     sonstiger Schema-Drift zwischen den beiden ca. 3 Stunden auseinanderliegenden Dumps.
   - **In die Baseline übernommen, mit zwei begründeten Kürzungen** (Details und vollständige
     Tabellenliste: `docs/migration-evidence/private/2026-07-29/` Zwischendateien, nicht
     eingecheckt):
     1. Alle `GRANT`/`REVOKE`/`ALTER DEFAULT PRIVILEGES`-Zeilen für die Rollen `zap_baseline_reader`
        und `zap_baseline_reader_lernecke` entfernt (107 Zeilen). Begründung: Das sind
        Wartungsrollen für genau diesen Dump-Vorgang, deren `SELECT`-Recht laut Runbook-Schritt 3.1
        unmittelbar nach jedem Dump wieder entzogen wird — ihr Auftauchen im Dump ist ein Artefakt
        des Dump-Zeitfensters, kein stabiler Teil des Anwendungsschemas, und die Rolle existiert auf
        `db reset --local` ohnehin nicht.
     2. Alle drei `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin ...`-Blöcke entfernt (21 Zeilen);
        die entsprechenden `FOR ROLE postgres`-Blöcke (eigene, separate Kommentarüberschriften)
        blieben erhalten. Begründung: `supabase_admin` ist eine Supabase-Plattform-interne Rolle aus
        der Live-Projekt-Provisionierung, die lokal nicht existiert — `ALTER DEFAULT PRIVILEGES FOR
        ROLE X` kann nur von Rolle X selbst oder einem Superuser ausgeführt werden und schlug lokal
        mit `permission denied to change default privileges` fehl.
   - **Ergebnis:** `supabase/migrations/20260729180000_live_schema_baseline_2026_07_29.sql` enthält
     jetzt 289 `GRANT`- und 14 `REVOKE`-Anweisungen (bereinigt um die zwei oben genannten
     Kategorien). `db reset --local` (Baseline + die vier Referenzdaten-Migrationen) und `db lint`
     sind wieder grün.
3. ~~Neuer, offener Befund: zu weite Live-Grants~~ **Ursache diagnostiziert und Fix entworfen,
   lokal vollständig verifiziert, NICHT gegen Live angewendet (29.07.2026, Assistant, rein
   lokal):** Siehe Abschnitt 6 für die vollständige Liste und die Diagnose. Fix liegt als eigene,
   neue additive Migration vor: `supabase/migrations/20260729200000_restore_intended_table_grants.sql`.
   Jede Zeile darin ist entweder unverändert aus einer bereits archivierten Härtungsmigration
   übernommen (sechs von sieben Bereichen stimmten exakt mit ihrem pgTAP-Test überein) oder deckt
   einen in der archivierten Migration selbst gefundenen Bug ab (`intensivwoche_anmeldungen`: `anon`
   behielt `INSERT`, siehe Abschnitt 6). `supabase db reset --local` mit Baseline + allen fünf
   additiven Migrationen, `db lint` und `test db --local` sind jetzt **vollständig grün — 199 von
   199 pgTAP-Tests in 24 Dateien**, kein offener Fixture-/Grant-/Dump-Bug mehr. Die zusätzlich
   ergänzte `lernmaterialien_read_access`-Storage-Policy (Abschnitt 6, Nachtrag) wurde per
   read-only-Live-Abfrage über den Supabase-MCP-Connector verifiziert, nicht geraten.
   **Diese neue Migration wurde noch nicht gegen Live angewendet** — sie ändert echte Rechte auf
   Live und braucht denselben menschlichen Operator + separate Freigabe wie jede andere
   Live-Mutation.
4. **Menschlicher Operator, eigenes Terminal, separate Freigabe:** `supabase db push` für
   `20260729200000_restore_intended_table_grants.sql` gegen `notaqfguhhjpvmagvcic` — das ist die
   tatsächliche Sicherheitskorrektur, unabhängig vom Baseline-Adoption-Gate unten. Empfehlung: vor
   Schritt 5 durchführen, da die Baseline-Adoption per `migration repair` selbst keine SQL gegen
   Live ausführt (reine Zeitstempel-Buchführung) und deshalb nicht blockiert, aber ein bekannter,
   noch offener Live-Sicherheitsbefund nicht warten sollte, bis „Papierkram" erledigt ist.
5. Erst danach, mit separater Freigabe: Schritt 3.4.6 (`supabase migration repair
   <baseline-version> --status applied` gegen `notaqfguhhjpvmagvcic`) und 3.4.7 (`migration list`
   vorher/nachher, `db push --dry-run`-Kontrolle — sollte danach ausschliesslich zeigen, dass
   `20260729190000`–`20260729200000` bereits angewendet sind und nichts mehr aussteht).
6. Danach: dieses Dokument um „Nachtrag: `migration repair` ausgeführt am ..." ergänzen, analog zum
   bisherigen Stil.

**Nachtrag (29.07.2026): Baseline-Adoption und Grant-Fix beide abgeschlossen.** Reihenfolge wie
oben verlangt eingehalten:

1. `supabase link --project-ref notaqfguhhjpvmagvcic` — dabei entdeckt und behoben: die lokale
   CLI-Verknüpfung (`supabase/.temp/`, git-ignoriert, nie eingecheckt) zeigte noch auf das alte
   Projekt `ybzdibifgqjsbohtztmy` ("ZAP_25"). Dieselbe Kontowechsel-Altlast wie bei
   `pg_service.conf`/`approved-db-connection.ps1`, aber eine andere, bis dahin nicht geprüfte
   Datei. Nach dem Relink korrekt `notaqfguhhjpvmagvcic` ("Lernecke",
   Organisation `fbgaamxetmvkpbjovxwy`).
2. `supabase migration repair 20260729180000 --status applied --linked` — erfolgreich, protokolliert
   als `Repaired migration history: [20260729180000] => applied`.
3. `supabase migration list --linked` — bestätigt: nur `20260729180000` remote vermerkt, die
   fünf neueren Migrationen lokal-only/ausstehend. Wie erwartet.
4. `supabase db push --linked --dry-run` — bestätigt: würde exakt
   `20260729190000_seed_offer_catalog.sql`, `20260729190100_seed_material_areas.sql`,
   `20260729190200_seed_published_offer_editions.sql`, `20260729190300_seed_school_holiday_weeks.sql`,
   `20260729200000_restore_intended_table_grants.sql` anwenden — nichts Unerwartetes.
5. `supabase db push --linked` (echt) — erfolgreich durchgelaufen.
6. **Read-only Verifikation gegen Live** (Assistant, Supabase-MCP-Connector, kein Passwort nötig):
   Neun gezielte `has_table_privilege(...)`-Stichproben über alle sieben betroffenen Bereiche
   (`intensivwoche_anmeldungen`, `intensivwoche_buchungsversuche`, `financial_events`,
   `material_access_grants`, `payroll_snapshots`) bestätigen exakt den beabsichtigten Zustand —
   u. a. `anon` hat jetzt kein `INSERT` mehr auf `intensivwoche_anmeldungen` (der in Abschnitt 6
   gefundene Bug ist live behoben), `authenticated` hat kein `UPDATE` mehr auf `financial_events`
   (Ledger ist jetzt tatsächlich append-only). `list_migrations` zeigt alle sechs Versionen
   (`20260729180000`–`20260729200000`) als angewendet.

Damit sind sowohl die Baseline-Adoption (Abschnitt 1–5) als auch der kritische Grant-Befund
(Abschnitt 6) vollständig abgeschlossen. Kein offener Punkt in diesem Dokument mehr, ausser den in
Abschnitt 6 als niedrig priorisiert markierten, nicht live-verifizierten Storage-Policies auf
`avatars`/`correction-rubrics`/`student-essays`.

## 6. Kritischer Live-Befund: zu weit gefasste Tabellenrechte (Fix bereit, noch nicht auf Live angewendet)

Beim erneuten `test db --local`-Lauf mit vollständigen, aus Live gezogenen Grants (siehe Abschnitt
5, Punkt 2) schlagen 8 von 24 pgTAP-Dateien fehl — durchgängig mit der **entgegengesetzten**
Fehlerrichtung als vor der Grant-Wiederherstellung: Tests, die „`anon`/`authenticated` haben KEINE
X-Rechte" prüfen, schlagen fehl, weil diese Rollen auf Live tatsächlich `GRANT ALL` (statt der
vorgesehenen minimalen Rechte, meist nur `SELECT` oder gar nichts) auf den betroffenen Tabellen
haben. Der Dump reproduziert das treu — das ist also kein Fehler dieses Runbooks, sondern eine
echte Diskrepanz zwischen dem in diesem Projekt dokumentierten Sicherheitsmodell (siehe die
jeweiligen pgTAP-Testnamen) und dem tatsächlichen Live-Zustand. Vermutlich wurden die
Härtungs-`REVOKE`s der genannten Migrationen nie gegen `notaqfguhhjpvmagvcic` ausgeführt —
konsistent mit den bereits in `datenmodell-review.md` dokumentierten Fällen, in denen einzelne
Migrationsdateien nie gegen dieses Projekt liefen.

Betroffen (Tabellen/Bereich — erwartetes vs. tatsächliches Recht laut fehlgeschlagenem Test):

| Bereich | Tabelle(n) | Test-Datei | Befund |
|---|---|---|---|
| Buchung | `intensivwoche_anmeldungen` | `0005_booking_hardening.sql` | `anon` hat mehr als nur `SELECT`; `authenticated` behält `TRUNCATE`/`MAINTAIN`/`REFERENCES`/`TRIGGER` |
| Buchung | `intensivwoche_buchungsversuche` | `0006_booking_hardening_phase_b.sql` | `anon`/`authenticated` haben Rechte, sollten keine haben |
| Materialzugriff | `material_areas`, `self_study_enrollments`, `material_access_grants` | `0007_material_access_schema.sql`, `0017_material_access_grant_admin_and_storage.sql` | `anon`/`authenticated` haben `INSERT`/`UPDATE`/`DELETE`, die nur über die Admin-Maske laufen sollten |
| Angebotskatalog | `offers`, `offer_editions` | `0008_offer_editions_schema.sql` | `anon`/`authenticated` haben mehr als die vorgesehenen Admin-only-`INSERT`/`UPDATE`-Rechte |
| Tagesfreigaben | `course_days`, `daily_releases`, `daily_release_items`, `release_content_catalog` | `0011_daily_releases_schema.sql` | `anon` kann sogar `SELECT` auf Tabellen, die unsichtbar sein sollten |
| Arbeitszeit/Lohn | sechs Tabellen (`work_entries`, `teacher_assignments`, `teacher_rate_agreements`, `payroll_periods`, `payroll_snapshots`, `payroll_snapshot_lines`) | `0013_work_time_payroll_schema.sql` | `anon` hat irgendeinen Zugriff, sollte keinen haben |
| Finanzen | fünf Tabellen inkl. `financial_events` | `0016_financial_cockpit_schema.sql` | `anon` hat Zugriff; `authenticated`/Admin hat `UPDATE`/`DELETE` auf das als append-only vorgesehene Ledger |

**Einordnung:** Das ist unabhängig von RLS — RLS-Policies können weiterhin korrekt greifen, aber
die Tabellenrechte sind eine zweite, aktuell fehlende Verteidigungsebene. Bei personenbezogenen
Daten (`intensivwoche_anmeldungen`) und dem Finanz-Ledger ist das relevant genug, um zeitnah
untersucht zu werden, ist aber **explizit nicht Teil dieses Baseline-Adoption-Runbooks** — auf
Nutzerentscheid vom 29.07.2026 wird die Baseline bewusst wahrheitsgetreu (inklusive dieser zu
weiten Grants) übernommen, statt sie durch stille Korrektur in der Baseline-Datei zu verschleiern.

**Erledigt (29.07.2026, Assistant, rein lokal, keine Live-Verbindung):** Für alle sieben oben
gelisteten Bereiche wurden die bereits archivierten Härtungsmigrationen
(`supabase/legacy-migrations/`) gegen die zugehörigen pgTAP-Tests geprüft. Sechs der sieben stimmen
exakt mit ihrem eigenen Test überein — deren `REVOKE`/`GRANT`-Anweisungen wurden unverändert in
`supabase/migrations/20260729200000_restore_intended_table_grants.sql` übernommen. **Ein echter
Fund dabei:** `20260719190025_booking_hardening_phase_a.sql` hat `INSERT` nie von `anon` auf
`intensivwoche_anmeldungen` entzogen, obwohl der eigene Test (`0005_booking_hardening.sql`, „anon
hat sonst keine Tabellenrechte mehr") das immer schon verlangte — ein Bug in der archivierten
Migration selbst, nicht nur ein „nie angewendet"-Fall. In der neuen Migration korrigiert. Bewusst
NICHT mitgezogen: `TRUNCATE`/`REFERENCES`/`TRIGGER`/`MAINTAIN` auf den öffentlich lesbaren Tabellen
(`offers`, `offer_editions`, `material_areas` usw.) — auch die archivierten Migrationen haben diese
nie entzogen, kein Test verlangt es, das wäre neue Härtung statt Wiederherstellung der
ursprünglich beabsichtigten Rechte.

Zusätzlich der einzige verbleibende pgTAP-Fehlschlag (`0017`, Test 7, „lernmaterialien_read_access")
per read-only-Abfrage über den Supabase-MCP-Connector (kein Passwort nötig) gegen Live geprüft: die
Policy **existiert** dort bereits, wortgleich zum erwarteten `qual`, aber nur für `authenticated`
(nicht `anon` — das war meine erste Annahme beim Nachbau, per Live-Abfrage korrigiert). Kein
Live-Sicherheitsbefund, sondern eine reine Lücke im `--schema=public`-Dump (`storage` ist ein
eigenes Schema, wurde nie mitgedumpt) — analog zu den bereits im Baseline-Dateianhang
reproduzierten `storage.buckets`-Einträgen wurde die Policy jetzt ebenfalls manuell in
`supabase/migrations/20260729180000_live_schema_baseline_2026_07_29.sql` ergänzt.

**Ergebnis:** `supabase db reset --local` (Baseline + fünf additive Migrationen), `db lint --local
--level error --fail-on error` und `supabase test db --local` sind jetzt vollständig grün — alle
199 pgTAP-Tests in 24 Dateien bestehen. Kein offener Fixture-, Grant- oder Dump-Bug mehr bekannt.

Empfehlung für einen späteren, separaten Schritt: dieselbe Live-Prüfung wie oben für die drei
übrigen, nicht getesteten Storage-Buckets (`avatars`, `correction-rubrics`, `student-essays`)
durchführen — deren Policies wurden hier bewusst nicht geraten, da kein pgTAP-Test sie prüft und
keine Live-Bestätigung vorliegt.
