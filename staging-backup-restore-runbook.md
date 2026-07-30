# Staging und Backup/Restore (Abschnitt 10.4)

Stand: 22.07.2026. Deckt den Punkt "Staging und Backup: Struktur- und Datenbackup des
Live-Projekts mit dokumentiertem Wiederherstellungstest; alle neuen Migrationen zuerst auf einer
isolierten Staging-Kopie mit anonymisierten/synthetischen Daten." Wie die übrigen 10.4-Dokumente
ein eng begrenzter Teilpunkt, nicht das gesamte Produktions-Gate.

## Staging-Strategie: die lokale Supabase-Instanz IST die Staging-Umgebung

Für dieses Projekt (Einzelperson, Bachelor-/Masterarbeit-Kontext) gibt es bewusst **keine** zweite
gehostete Supabase-Staging-Instanz. Die bereits durchgehend genutzte lokale Docker-Supabase-Instanz
(`supabase start`, siehe CLAUDE.md "Datenbank-Workflow") erfüllt die eigentliche Anforderung
bereits vollständig:

- **Isoliert:** Läuft ausschliesslich in lokalen Docker-Containern, hat keine Netzwerkverbindung
  zum Live-Projekt.
- **Nur synthetische Daten:** `supabase/seed.sql` enthält laut eigenem Kommentar ausschliesslich
  lokale, synthetische Fixtures; echte Kundendaten gelangen nie dorthin.
- **Erste Station für jede neue Migration:** Jede einzelne Migration in diesem Projekt (siehe z. B.
  `20260722092503_mail_outbox_schema.sql`, `20260722084521_grant_authenticated_select_active_kurse.sql`)
  wurde bereits ausschliesslich über `supabase db reset --local` → `db lint --local` →
  `supabase test db --local` verifiziert, **bevor** überhaupt eine Live-Anwendung erwogen wurde --
  das ist exakt "alle neuen Migrationen zuerst auf einer isolierten Kopie mit synthetischen Daten
  testen", nur ohne eine zweite gehostete Instanz dafür zu brauchen.

Dieser Abschnitt fügt deshalb nichts an der Staging-*Praxis* hinzu (die existiert und wird bei
jeder Migration angewendet) -- er ergänzt den bisher fehlenden Teil: einen tatsächlichen,
getesteten Backup-/Restore-Nachweis.

## Backup des Live-Projekts (nur vom Menschen selbst auszuführen)

`scripts/backup-live-database.ps1` -- **nicht vom Assistenten ausgeführt**, weil es das Live-DB-
Passwort braucht, das laut CLAUDE.md nie vom Assistenten gehandhabt werden darf. Das Skript:

- nutzt dieselbe bereits freigegebene, gepinnte `pg_dump`-Binary und dieselbe bereits freigegebene,
  read-only Verbindungskonfiguration (`scripts/approved-db-connection.ps1`,
  `supabase/pg_service.conf`, Rolle `zap_baseline_reader_lernecke.notaqfguhhjpvmagvcic`,
  `sslmode=verify-full` -- aktualisiert 30.07.2026 auf das seit dem Kontowechsel produktive
  Projekt, siehe `docs/migration-evidence/2026-07-29-baseline-adoption-decision.md`), die bereits
  für die Baseline-Adoption verwendet wurde -- keine neue Verbindungsroute, kein neues Vertrauen
  nötig. Die Rolle braucht vor jedem Lauf ein frisch erteiltes
  `grant select on all tables in schema public` und danach ein sofortiges `revoke` (Abschnitt 3.1
  der Baseline-Adoption-Entscheidung) -- sie hat dieses Recht nicht dauerhaft;
- fragt das Passwort interaktiv mit maskierter Eingabe ab (`Read-Host -MaskInput`), hält es nur für
  die Dauer des `pg_dump`-Aufrufs als Prozessvariable und entfernt sie danach in jedem Fall
  (`finally`-Block);
- sichert standardmässig **nur die Struktur** (`--schema-only`, keine personenbezogenen Daten);
- ein vollständiges Datenbackup ist ein bewusster Opt-in über `-IncludeData` -- das Skript warnt
  dabei explizit, dass die Datei dann Namen/E-Mail/Telefon aus `intensivwoche_anmeldungen` enthält
  und ausschliesslich unter `docs/migration-evidence/private/backups/` bleiben darf (per
  `.gitignore` bereits von Git ausgeschlossen -- niemals einchecken, teilen oder verschieben).

```powershell
# Struktur-only (Standard, unbedenklich)
.\scripts\backup-live-database.ps1

# Vollstaendig inkl. Daten -- nur nach bewusster Entscheidung ueber Aufbewahrung/Zugriff
.\scripts\backup-live-database.ps1 -IncludeData
```

**Aufbewahrung/Zugriff bei einem Datenbackup (`-IncludeData`):** Dieses Projekt hat bisher keine
dokumentierte Aufbewahrungsfrist oder Zugriffsrolle für ein solches Backup festgelegt -- das ist
eine eigene, hier bewusst nicht mitentschiedene Richtlinienfrage (analog zu den in
`observability-runbook.md`/`env-separation-audit.md` offen gelassenen Fragen). Bis eine solche
Richtlinie besteht: Backups mit Daten so kurz wie möglich lokal behalten, nach Verifikation löschen,
nie ausserhalb `docs/migration-evidence/private/` ablegen.

## Wiederherstellungstest -- tatsächlich durchgeführt, nicht nur beschrieben

`scripts/verify-local-backup-restore.mjs` läuft ausschliesslich gegen die lokale Instanz
(127.0.0.1) und wurde als Teil dieser Arbeit tatsächlich ausgeführt, nicht nur geschrieben. Erster
Versuch (ein vollständiger `pg_dump`/`createdb`/`pg_restore`-Zyklus der ganzen Instanz) scheiterte
an Supabase-Plattform-internen Schemas (`vault`, `realtime`), die Rechte voraussetzen, die eine
frisch mit `createdb` angelegte Datenbank nicht hat ("permission denied for table secrets" beim
Wiederherstellen von `vault.secrets`) -- dokumentiert im Skriptkommentar, nicht stillschweigend
verworfen.

**Das tatsächlich funktionierende, realistischere Modell für ein Supabase-Projekt:**

1. **Schema kommt aus den Migrationen**, nicht aus einem Rohdump der ganzen Instanz -- das ist
   bereits bei jedem Gate-Lauf dieses Projekts bewiesen reproduzierbar
   (`supabase db reset --local`).
2. **"Backup" bedeutet die dynamischen, nutzergenerierten Daten** (`profiles`,
   `intensivwoche_kurse`, `intensivwoche_anmeldungen`) -- nicht Referenz-/Katalogdaten wie `offers`,
   die bereits per Migration (`20260721074103_seed_offer_catalog.sql`) angelegt werden. Ein
   Restore-Versuch dieser Referenzdaten kollidierte empirisch mit den durch die Migration bereits
   vorhandenen Zeilen ("duplicate key value violates unique constraint offers_pkey") -- ein
   Datenbackup deckt deshalb bewusst nur die nutzergenerierten Tabellen ab.
3. **`mail_outbox` wird nicht direkt restauriert**, sondern vom Enqueue-Trigger
   (`20260722092503_mail_outbox_schema.sql`) automatisch aus den restaurierten
   `intensivwoche_anmeldungen`-Zeilen neu erzeugt -- und wurde als solches geprüft (abgeleitete
   Zeilenzahl ≥ Anzahl restaurierter Anmeldungen), nicht als exakter 1:1-Zeilenabgleich.

**Tatsächlicher Testlauf (22.07.2026, gegen die lokale Instanz mit einer echten, über
`book_intensivwoche_kurs()` erzeugten Test-Buchung):**

```
Vor dem Reset:  2 profiles, 2 intensivwoche_kurse, 1 intensivwoche_anmeldungen
Nach Restore:   2 profiles, 2 intensivwoche_kurse, 1 intensivwoche_anmeldungen
mail_outbox nach Restore (vom Trigger abgeleitet, nicht direkt restauriert): 1

BESTANDEN: Ein Datenexport der dynamischen Tabellen der laufenden Instanz liess sich vollstaendig
in ein frisch aus den Migrationen aufgebautes Schema restaurieren; abgeleitete Daten (mail_outbox)
wurden korrekt vom Trigger nachgebildet.
```

Ablauf im Detail: (1) Datenexport der drei genannten Tabellen aus der laufenden Instanz, (2)
`supabase db reset --local --no-seed` (frisches, ausschliesslich aus Migrationen aufgebautes Schema
ohne synthetische Fixtures, die sonst mit den gleich restaurierten Zeilen kollidieren würden), (3)
Restore des Datenexports per `psql`, (4) Zeilenzahl-Abgleich gegen die vor Schritt 2 eingefrorenen
Referenzwerte, (5) unabhängig vom Ergebnis abschliessend `supabase db reset --local` **mit** Seed,
damit die Instanz danach im gewohnten kanonischen Zustand für die restliche Arbeit bereitsteht.

```powershell
node scripts/verify-local-backup-restore.mjs
```

## Tatsächlich durchgeführtes Live-Backup (30.07.2026)

Der menschliche Betreiber hat `scripts/backup-live-database.ps1` nach der Korrektur der beiden
oben genannten Lücken (stale Rollenreferenz, `--no-acl`) selbst gegen `notaqfguhhjpvmagvcic`
ausgeführt (`grant select`/`revoke select` davor/danach über den Dashboard-SQL-Editor, wie in
Abschnitt 3.1 der Baseline-Adoption-Entscheidung vorgesehen). Ergebnis
(`docs/migration-evidence/private/backups/live-backup-schema-only-2026-07-30T21-22-10.sql`,
gitignored, 238 KB), read-only vom Assistenten geprüft:

```
GRANT-Anweisungen:            374 (vorheriger Lauf vom 23.07.2026: 0)
REVOKE-Anweisungen:            14 (vorheriger Lauf vom 23.07.2026: 0)
school_holiday_weeks vorhanden: ja (aktueller Schema-Stand, nicht stale)
public.profiles enthalten:     nein (Ausschluss wirkt wie vorgesehen)
Geheimnismuster (JWT/Anthropic-Key/AWS-Key/Passwort-Literal): 0 Treffer

BESTANDEN: Erster tatsächlich vollständiger Live-Struktur-Dump gegen das seit dem Kontowechsel
produktive Projekt, mit Berechtigungen, aktuellem Schema-Stand und ohne erkennbare Geheimnisse.
```

Der frühere, unvollständige Lauf vom 23.07.2026 bleibt zu Vergleichszwecken lokal liegen
(gitignored, keine personenbezogenen Daten in einem Struktur-only-Dump).

## Was bewusst NICHT abgedeckt ist

- **Keine dokumentierte Aufbewahrungsfrist für Datenbackups:** Siehe Hinweis oben -- eine
  Richtlinienentscheidung, kein technisches Defizit.
- **Kein automatisierter, wiederkehrender Backup-Zeitplan:** Wie beim Mail-Outbox-Cron
  (`mail-outbox-runbook.md`) ist "wer/was löst das regelmässig aus" eine Hosting-/
  Betriebsentscheidung, die hier nicht getroffen wird. `scripts/backup-live-database.ps1` ist
  manuell auszuführen, bis eine solche Entscheidung fällt.
