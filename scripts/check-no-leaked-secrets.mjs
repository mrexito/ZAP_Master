#!/usr/bin/env node
// Lokaler Secret-Scan (Env-Separation-Audit, Abschnitt 10.4: "CI prüft auf ... eingecheckte
// Secrets"). Läuft seit 30.07.2026 automatisch in .github/workflows/ci.yml bei jedem Push/PR;
// bleibt daneben weiterhin manuell (und optional per Git-Hook) ausführbar, ohne neue Abhängigkeiten
// (kein gitleaks/trufflehog-Download). Prüft ausschliesslich GIT-GETRACKTE Dateien -- der reale
// Angriffsvektor ist "eingecheckt", nicht "liegt lokal auf der Platte" (.env* selbst ist bereits
// über .gitignore ausgeschlossen, siehe zweite Prüfung unten als Verteidigung in der Tiefe gegen
// ein versehentliches `git add -f`).
//
// Nutzung: node scripts/check-no-leaked-secrets.mjs

import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const trackedFiles = execFileSync('git', ['ls-files'], { cwd: projectRoot, encoding: 'utf-8' })
  .split('\n')
  .filter(Boolean)

// Verteidigung in der Tiefe: .env* ist über .gitignore ausgeschlossen, aber ein `git add -f`
// würde das umgehen. Erlaubt sind ausschliesslich die Vorlagen mit ".example" im Namen.
const trackedEnvFiles = trackedFiles.filter(
  (f) => /(^|\/)\.env[^/]*$/.test(f) && !f.includes('.example')
)

// Muster fuer die in diesem Projekt tatsaechlich verwendeten Secret-Formate (Supabase-JWTs,
// Anthropic-API-Keys). Bewusst kein pauschales "hochentropischer String"-Muster -- das würde auf
// Hashes, Locale-IDs, Testdaten-UUIDs etc. massiv false-positiven und das Skript unbrauchbar
// machen. Ergänzen, falls neue Secret-Typen (z. B. ein künftiger Mail-Provider-Key) dazukommen.
const SECRET_PATTERNS = [
  { name: 'Supabase/JWT-foermiger Schluessel', regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { name: 'Anthropic API-Key', regex: /sk-ant-[A-Za-z0-9_-]{20,}/g },
  { name: 'AWS Access-Key-ID', regex: /AKIA[0-9A-Z]{16}/g },
]

// Binaerdateien/Assets ueberspringen -- weder relevant noch sinnvoll text-durchsuchbar.
const SKIP_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.pdf', '.woff', '.woff2', '.ttf',
  '.eot', '.zip', '.mp4', '.mp3',
])

let findings = []

for (const relPath of trackedFiles) {
  const ext = relPath.slice(relPath.lastIndexOf('.')).toLowerCase()
  if (SKIP_EXTENSIONS.has(ext)) continue

  const absPath = `${projectRoot}/${relPath}`
  let stat
  try {
    stat = statSync(absPath)
  } catch {
    continue // z.B. bereits geloescht, aber noch im Index (sehr selten)
  }
  if (!stat.isFile() || stat.size > 2 * 1024 * 1024) continue // >2MB: kein Quelltext

  let content
  try {
    content = readFileSync(absPath, 'utf-8')
  } catch {
    continue // vermutlich binaer, ueberspringen statt hart abzubrechen
  }

  for (const { name, regex } of SECRET_PATTERNS) {
    const matches = content.match(regex)
    if (matches) {
      findings.push({ file: relPath, pattern: name, count: matches.length })
    }
  }
}

let hasError = false

if (trackedEnvFiles.length > 0) {
  hasError = true
  console.error('FEHLER: folgende .env*-Dateien sind eingecheckt (nur *.example ist erlaubt):')
  for (const f of trackedEnvFiles) console.error(`  - ${f}`)
}

if (findings.length > 0) {
  hasError = true
  console.error('FEHLER: moegliche Secrets in eingecheckten Dateien gefunden:')
  for (const f of findings) console.error(`  - ${f.file}: ${f.pattern} (${f.count}x)`)
  console.error('\nBei einem echten Fund: Schluessel sofort im jeweiligen Anbieter rotieren, dann erst hier bereinigen.')
}

if (hasError) {
  process.exit(1)
}

console.log(`OK: keine eingecheckten .env-Dateien, keine bekannten Secret-Muster in ${trackedFiles.length} getrackten Dateien.`)
