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
  supabase/pg_service.conf: Rolle zap_baseline_reader.ybzdibifgqjsbohtztmy, sslmode=verify-full),
  die bereits fuer das Schritt-0-Baseline-Inventar verwendet wurde -- keine neue Verbindungsroute.

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
$env:PGPASSWORD = Read-Host 'Live-DB-Passwort (zap_baseline_reader)' -MaskInput

try {
    $pgDumpArgs = @(
        "service=$ApprovedPgServiceName",
        '--no-password',
        '--no-owner',
        '--no-acl',
        # zap_baseline_reader hat bewusst keinen Zugriff auf die von Supabase selbst verwalteten
        # System-Schemas (auth/storage/realtime/vault/supabase_migrations/extensions) -- ohne
        # Ausschluss versucht pg_dump trotzdem, alle dort sichtbaren Objekte zu sperren/lesen und
        # bricht beim ersten Permission-Fehler die gesamte Sicherung ab, ohne etwas zu schreiben.
        # Diese Schemas werden separat von Supabase selbst gesichert/verwaltet; relevant fuer diese
        # Migrations sind ausschliesslich Objekte in public.
        '--schema', 'public',
        # zap_baseline_reader hat auch innerhalb von public kein SELECT auf profiles (vermutlich
        # bewusst, da dort Rollen-/Kontaktdaten liegen) -- pg_dump braucht dafuer aber selbst im
        # --schema-only-Modus mindestens eine ACCESS-SHARE-Sperre, die ohne SELECT-Recht fehlschlaegt
        # und den gesamten Dump abbricht. Keine der 19 anstehenden Migrationen aendert profiles,
        # daher schwaecht der Ausschluss dieses einen Backups nicht, wovor es tatsaechlich schuetzt.
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
