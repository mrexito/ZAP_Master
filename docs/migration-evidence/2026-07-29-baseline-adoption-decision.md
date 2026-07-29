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
  --no-owner --no-privileges=false `
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

## 4. Was ich (Assistant) jetzt bereits erledigt habe

- Live bestätigt: `supabase_migrations`-Schema fehlt weiterhin auf `notaqfguhhjpvmagvcic`
  (read-only, keine Zugangsdaten nötig).
- Entscheidung dokumentiert und in `datenmodell-review.md` referenziert.
- Blocker (veraltete Verbindungskonfiguration fürs alte Konto) gefunden und hier dokumentiert,
  **ohne** `pg_service.conf`/`approved-db-connection.ps1` selbst zu ändern — das bleibt eine
  bewusste Freigabeentscheidung des Nutzers, analog zum bisherigen Vorgehen bei dieser Kette.
- Keine SQL-Mutation, kein Passwort, kein Rollen-Anlegen gegen Live ausgeführt.

## 5. Offen

- Schritte 3.1–3.4 oben: menschlicher Operator, eigenes Terminal.
- Danach: dieses Dokument um „Nachtrag: Dump erzeugt am ..." ergänzen, analog zum bisherigen Stil.
