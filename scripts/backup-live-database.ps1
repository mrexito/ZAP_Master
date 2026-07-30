<#
.SYNOPSIS
  Struktur-/Datenbackup des LIVE-Supabase-Projekts (Abschnitt 10.4: "Staging und Backup").

.DESCRIPTION
  Von einem Menschen selbst auszufuehren -- NICHT vom Assistenten. Das Live-DB-Passwort wird laut
  CLAUDE.md ("Datenbank-Workflow") nie vom Assistenten gehandhabt oder in den Chat eingegeben;
  dieses Skript fragt es interaktiv mit maskierter Eingabe ab und haelt es nur fuer die Dauer des
  pg_dump-Aufrufs als Prozessvariable im Speicher.

  Nutzt dieselbe gepinnte, hash-verifizierte pg_dump-Binary und dieselbe bereits freigegebene,
  read-only Verbindungskonfiguration (scripts/approved-db-connection.ps1,
  supabase/pg_service.conf: Rolle zap_baseline_reader_lernecke.notaqfguhhjpvmagvcic,
  sslmode=verify-full -- aktualisiert 30.07.2026, vorher zap_baseline_reader.ybzdibifgqjsbohtztmy
  auf dem seit dem Kontowechsel nicht mehr live genutzten Projekt), die bereits fuer das
  Schritt-0-Baseline-Inventar verwendet wurde -- keine neue Verbindungsroute. Die Rolle braucht vor
  dem Lauf ein frisch erteiltes SELECT auf alle Tabellen in public (siehe
  staging-backup-restore-runbook.md) -- es wird nach jedem Dump absichtlich wieder entzogen.

  Standardmaessig NUR Struktur (--schema-only): enthaelt keine personenbezogenen Daten. Ein
  vollstaendiges Datenbackup (Namen/E-Mails/Telefonnummern aus intensivwoche_anmeldungen) ist ein
  bewusster Opt-in ueber -IncludeData, weil es eine eigene Aufbewahrungs-/Zugriffsentscheidung
  braucht (siehe staging-backup-restore-runbook.md).

.PARAMETER IncludeData
  Nimmt Tabellendaten (inkl. personenbezogener Buchungsdaten) mit in den Dump auf. Ohne diesen
  Schalter wird ausschliesslich die Struktur gesichert.

.PARAMETER OutputDirectory
  Zielverzeichnis fuer die Dump-Datei. Default: docs/migration-evidence/private/backups/ (per
  .gitignore bereits ausgeschlossen -- niemals einchecken).

.EXAMPLE
  .\scripts\backup-live-database.ps1
  Struktur-only-Backup, interaktive Passwortabfrage.

.EXAMPLE
  .\scripts\backup-live-database.ps1 -IncludeData
  Vollstaendiges Backup inkl. Daten -- nur nach bewusster Entscheidung, siehe Runbook.
#>

param(
    [switch] $IncludeData,
    [string] $OutputDirectory = (Join-Path $PSScriptRoot '..\docs\migration-evidence\private\backups')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. "$PSScriptRoot\approved-db-connection.ps1"

if (-not (Test-Path -LiteralPath $OutputDirectory)) {
    New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
}

$timestamp = Get-Date -Format 'yyyy-MM-ddTHH-mm-ss'
$kind = if ($IncludeData) { 'schema-and-data' } else { 'schema-only' }
$outputFile = Join-Path $OutputDirectory "live-backup-$kind-$timestamp.sql"

if ($IncludeData) {
    Write-Warning 'Dieses Backup enthaelt personenbezogene Buchungsdaten (Namen, E-Mail, Telefon aus intensivwoche_anmeldungen).'
    Write-Warning 'Die Datei bleibt lokal unter docs/migration-evidence/private/ (per .gitignore ausgeschlossen) -- niemals einchecken, teilen oder ausserhalb dieses Verzeichnisses ablegen.'
    Write-Warning 'Siehe staging-backup-restore-runbook.md fuer Aufbewahrungs-/Loeschpflichten.'
}

$env:PGSERVICEFILE = $ApprovedPgServiceFile
$env:PGSSLROOTCERT = $ApprovedSupabaseCaPath
$env:PGPASSWORD = Read-Host 'Live-DB-Passwort (zap_baseline_reader_lernecke)' -MaskInput

try {
    $pgDumpArgs = @(
        "service=$ApprovedPgServiceName",
        '--no-password',
        '--no-owner',
        # KEIN --no-acl/--no-privileges hier: docs/migration-evidence/2026-07-29-baseline-adoption-decision.md
        # (Abschnitt 3.3) dokumentiert genau diesen Fehler am eigenen Baseline-Dump -- ein
        # ACL-unterdrueckendes Flag liess den Dump 0 GRANT/REVOKE-Anweisungen enthalten, obwohl der
        # Live-Stand 289 GRANT- und 14 REVOKE-Anweisungen hat. Ein Backup ohne Berechtigungen waere
        # bei einer echten Wiederherstellung unvollstaendig -- derselbe Fehler wird hier bewusst
        # nicht wiederholt.
        # zap_baseline_reader_lernecke hat bewusst keinen Zugriff auf die von Supabase selbst verwalteten
        # System-Schemas (auth/storage/realtime/vault/supabase_migrations/extensions) -- ohne
        # Ausschluss versucht pg_dump trotzdem, alle dort sichtbaren Objekte zu sperren/lesen und
        # bricht beim ersten Permission-Fehler die gesamte Sicherung ab, ohne etwas zu schreiben.
        # Diese Schemas werden separat von Supabase selbst gesichert/verwaltet; relevant fuer diese
        # Migrations sind ausschliesslich Objekte in public.
        '--schema', 'public',
        # Vorsichtsmassnahme aus der Zeit der alten Rolle zap_baseline_reader, die innerhalb von
        # public bewusst kein SELECT auf profiles hatte (Rollen-/Kontaktdaten) -- pg_dump braucht
        # dafuer selbst im --schema-only-Modus mindestens eine ACCESS-SHARE-Sperre, die ohne
        # SELECT-Recht fehlschlaegt und den gesamten Dump abbricht. Ob zap_baseline_reader_lernecke
        # (grant select on ALL tables in schema public, siehe staging-backup-restore-runbook.md)
        # dieselbe Einschraenkung hat, ist nicht verifiziert -- der Ausschluss bleibt konservativ
        # bestehen, macht das Backup aber schwaecher als noetig, falls profiles inzwischen lesbar
        # ist. Vor einer Aenderung erst gegen Live pruefen, nicht raten.
        '--exclude-table', 'public.profiles',
        '--file', $outputFile
    )
    if (-not $IncludeData) {
        $pgDumpArgs += '--schema-only'
    }

    & $ApprovedPgDumpPath @pgDumpArgs

    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump beendete sich mit Exit-Code $LASTEXITCODE."
    }

    Write-Host "Backup geschrieben: $outputFile" -ForegroundColor Green
    Write-Host 'Naechster Schritt: den Wiederherstellungstest (siehe staging-backup-restore-runbook.md) mit dieser Datei durchfuehren.'
}
finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:PGSERVICEFILE -ErrorAction SilentlyContinue
    Remove-Item Env:PGSSLROOTCERT -ErrorAction SilentlyContinue
}
