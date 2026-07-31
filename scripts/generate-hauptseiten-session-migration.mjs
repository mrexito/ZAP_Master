#!/usr/bin/env node
// Materialisiert die auf einer Hauptseite unter "Termine" gezeigten Kurstermine als echte
// intensivwoche_kurse-Zeilen -- mit derselben id wie die zugehörige Fixture-Session
// (source.kursId), damit die Relation zwischen Hauptseiten-Terminliste und Kursverwaltung
// (/dashboard/kurse) bereits vor der ersten Anmeldung existiert, statt erst lazy über
// lib/kurse/ensure-bookable-session.ts#ensureMarketingSessionIsBookable() beim ersten
// Buchungsversuch zu entstehen. Erzeugt exakt dieselben Feldwerte wie diese Funktion (Name-Muster,
// Fach-Default, Klassenstufen-Label, Datumsauflösung über
// lib/kurse/session-dates.ts#resolveSessionDates) -- keine Doppelimplementierung, sondern echter
// Import der TS-Module, analog zu scripts/generate-offer-editions-migration.mjs.
//
// `on conflict (id) do nothing` macht die generierte Migration ungefährlich wiederholbar: bereits
// vorher (z.B. durch eine echte Buchung) materialisierte Zeilen werden nicht überschrieben.
//
// Zusätzlich für Halbjahreskurs-Angebote: Vor dem sitewide-Rename "Halbjahreskurs" -> "Vorkurs"
// wurden vermutlich schon reale Zeilen manuell unter dem alten Namen angelegt -- unter einer
// ANDEREN id als der Fixture-Session, `on conflict (id)` greift für sie also nicht (bestätigtes
// Beispiel: eine reale Zeile "Halbjahreskurs – Kurs I" existiert, ihre id ist unbekannt/vermutlich
// nicht 9205). Das Skript erzeugt deshalb zusätzlich `update ... where name = <alter Name>`-
// Anweisungen, die per exaktem Namenstext treffen, unabhängig von der id. Das behebt nur den
// sichtbaren Namen; falls die getroffene Zeile eine andere id als die Fixture-Session hat, bleibt
// nach dieser Migration eine id-Dublette (alte Zeile mit korrigiertem Namen aber falscher id, neue
// Zeile mit Fixture-id) bestehen -- das braucht eine separate, manuelle Entscheidung (siehe
// Migrationskommentar), da ein id-Wechsel bestehende intensivwoche_anmeldungen.kurs_id-Verweise
// beträfe.
//
// Nutzung: npx tsx scripts/generate-hauptseiten-session-migration.mjs [<offerId> ...]
// Ohne Argumente: offer-6klasse-halbjahreskurs (Kurs A/C/E/G/I, 6. Klasse Vorkurs,
// Abschnitt "4 · Termine").

import { writeFileSync } from 'node:fs'
import path from 'node:path'

import { findOfferById, getSessionsForOfferId } from '../lib/kurse/offer-catalog.ts'
import { resolveSessionDates } from '../lib/kurse/session-dates.ts'
import { SUBJECT_TO_FACH } from '../lib/kurse/mapper.ts'
import { audiences } from '../app/data/marketing-site.ts'

const LEGACY_HALBJAHRESKURS_PREFIX = 'Halbjahreskurs'

function sqlString(value) {
  // Dollar-Quoting statt ''-Verdopplung, wie in generate-offer-editions-migration.mjs.
  return `$str$${value}$str$`
}

function sqlTextArray(values) {
  return `ARRAY[${values.map(sqlString).join(', ')}]::text[]`
}

function buildRenameSql(offer, session) {
  const oldName = `${LEGACY_HALBJAHRESKURS_PREFIX} – ${session.kurs}`
  const newName = `${offer.displayName} – ${session.kurs}`
  if (oldName === newName) return null
  return `update public.intensivwoche_kurse set name = ${sqlString(newName)} where name = ${sqlString(oldName)};`
}

function buildRowSql(offer, session) {
  const dates = resolveSessionDates(session)
  if (!dates) {
    throw new Error(`Kein Zeitraum für Session ${session.id} (${session.kurs}) auflösbar.`)
  }
  const fach = offer.subject && offer.subject !== 'mixed' ? SUBJECT_TO_FACH[offer.subject] : 'deutsch'
  const audienceLabel =
    audiences.find((a) => a.id === offer.audienceId)?.displayLabel ?? offer.audienceId
  const name = `${offer.displayName} – ${session.kurs}`

  return `insert into public.intensivwoche_kurse (
  id, name, fach, beschreibung, detail_beschreibung, start_datum, end_datum,
  uhrzeit, ort, preis, max_teilnehmer, klassenstufen, lehrer, highlights, ist_aktiv
)
values (
  ${session.id}, ${sqlString(name)}, ${sqlString(fach)}, ${sqlString(offer.description)}, ${sqlString(offer.lede)},
  ${sqlString(dates.start)}, ${sqlString(dates.end)}, ${sqlString(session.timeLabel)}, ${sqlString(session.standort)},
  ${offer.regularPriceRappen / 100}, ${session.capacity}, ${sqlTextArray([audienceLabel])}, ${sqlString('ZAP')},
  ${sqlTextArray(offer.features)}, true
)
on conflict (id) do nothing;`
}

const cliOfferIds = process.argv.slice(2)
const targetOfferIds = cliOfferIds.length > 0 ? cliOfferIds : ['offer-6klasse-halbjahreskurs']

const rows = []
const renames = []
for (const offerId of targetOfferIds) {
  const offer = findOfferById(offerId)
  if (!offer) throw new Error(`Unbekannte offerId: ${offerId}`)
  if (offer.kurstyp === 'selbststudium') {
    console.warn(`Übersprungen: ${offerId} ist ein Selbststudium-Angebot ohne Termine.`)
    continue
  }
  const sessions = getSessionsForOfferId(offerId)
  if (sessions.length === 0) {
    console.warn(`Warnung: ${offerId} hat keine Fixture-Sessions -- nichts zu generieren.`)
    continue
  }
  console.log(`${offerId} (${offer.displayName}): ${sessions.length} Termine`)
  for (const session of sessions) {
    console.log(`  id ${session.id} -- ${session.kurs} -- ${session.standort} -- ${session.timeLabel}`)
    rows.push(buildRowSql(offer, session))
    const rename = buildRenameSql(offer, session)
    if (rename) renames.push(rename)
  }
}

if (rows.length === 0) {
  console.log('Keine Zeilen generiert.')
  process.exit(0)
}

const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '')
const outFile = path.resolve(
  import.meta.dirname,
  '..',
  'supabase',
  'migrations',
  `${timestamp}_materialize_hauptseiten_sessions.sql`
)

const header = `-- Materialisiert die auf den Hauptseiten (Abschnitt "Termine") gezeigten Kurstermine als echte
-- intensivwoche_kurse-Zeilen -- mit derselben id wie die Fixture-Session (source.kursId), damit die
-- Kursverwaltung (/dashboard/kurse) dieselbe ID zeigt wie die öffentliche Terminliste, statt dass
-- die Relation erst bei der ersten Anmeldung lazy über
-- lib/kurse/ensure-bookable-session.ts#ensureMarketingSessionIsBookable() entsteht.
-- Generiert per scripts/generate-hauptseiten-session-migration.mjs aus
-- types/marketing.fixtures.ts -- keine manuelle Abschrift.
--
-- \`on conflict (id) do nothing\` macht die insert-Anweisungen ungefährlich wiederholbar: bereits
-- vorher (z.B. durch eine echte Buchung) materialisierte Zeilen werden nicht überschrieben.
--
-- Enthaltene Angebote: ${targetOfferIds.join(', ')}

`

const renameHeader = renames.length > 0
  ? `\n\n-- Korrigiert reale Zeilen, die noch unter dem alten Namen "${LEGACY_HALBJAHRESKURS_PREFIX} – <Kurs>"
-- existieren (vor dem sitewide-Rename "Halbjahreskurs" -> "Vorkurs"), auf den aktuell auf der
-- Hauptseite gezeigten Namen. Trifft per exaktem Namenstext, unabhängig von der id der betroffenen
-- Zeile -- deckt damit auch Zeilen ab, die unter einer anderen id als der Fixture-Session existieren
-- und von \`on conflict (id) do nothing\` oben nicht erreicht würden. Bewusst NICHT enthalten: eine
-- Änderung der id dieser Zeilen -- das würde intensivwoche_anmeldungen.kurs_id-Verweise betreffen
-- und braucht eine separate, manuelle Entscheidung.

`
  : ''

const sql = header + rows.join('\n\n') + renameHeader + renames.join('\n') + '\n'

writeFileSync(outFile, sql, 'utf-8')
console.log(`\nGeschrieben: ${outFile}`)
if (renames.length > 0) {
  console.log(`\n${renames.length} Umbenennung(en) für Alt-Namen mit Präfix "${LEGACY_HALBJAHRESKURS_PREFIX}":`)
  for (const rename of renames) console.log(`  ${rename}`)
}
