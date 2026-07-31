#!/usr/bin/env node
// Read-only Abgleich: klassifiziert eine Live-Momentaufnahme von intensivwoche_kurse (JSON-Datei,
// per `supabase db query --linked` erzeugt) gegen den kompletten kuratierten Angebotskatalog
// (types/marketing.fixtures.ts, ALLE Audiences/Offers -- nicht nur ein einzelnes) und die
// bestehende Bestandskurs-Sichtbarkeitsregel (lib/kurse/mapper.ts). Keine Live-Verbindung, reine
// Offline-Auswertung einer bereits gezogenen Momentaufnahme.
//
// Nutzung: npx tsx scripts/audit-live-course-relation.mjs <live-kurse.json>

import { readFileSync } from 'node:fs'

import { audiences } from '../app/data/marketing-site.ts'
import { getOfferCatalogEntry, getSessionsForOfferId } from '../lib/kurse/offer-catalog.ts'
import { mapKlassenstufeToAudienceIds } from '../lib/kurse/mapper.ts'

const KNOWN_LOCATIONS = new Set(['Zürich HB', 'Winterthur'])

const jsonPath = process.argv[2]
if (!jsonPath) {
  console.error('Nutzung: npx tsx scripts/audit-live-course-relation.mjs <live-kurse.json>')
  process.exit(1)
}
const liveRows = JSON.parse(readFileSync(jsonPath, 'utf-8'))

// 1. Erwartete kuratierte Zeilen aus ALLEN Offers aller sieben Audiences aufbauen.
const expectedById = new Map()
for (const audience of audiences) {
  const entry = getOfferCatalogEntry(audience.id)
  for (const offer of [...entry.offers, ...entry.addOnOffers]) {
    for (const session of getSessionsForOfferId(offer.id)) {
      expectedById.set(session.id, {
        expectedName: `${offer.displayName} – ${session.kurs}`,
        offerId: offer.id,
        audienceId: offer.audienceId,
      })
    }
  }
}

// 2. Jede Live-Zeile klassifizieren.
const buckets = { curatedMatch: [], curatedNameMismatch: [], bestandskursEligible: [], unmatched: [] }

for (const row of liveRows) {
  const expected = expectedById.get(row.id)
  if (expected) {
    if (expected.expectedName === row.name) {
      buckets.curatedMatch.push({ ...row, expected: expected.expectedName })
    } else {
      buckets.curatedNameMismatch.push({ ...row, expected: expected.expectedName })
    }
    continue
  }

  const mappedAudiences = mapKlassenstufeToAudienceIds(row.klassenstufen)
  const isKnownLocation = KNOWN_LOCATIONS.has(row.ort)
  if (mappedAudiences.length > 0 && isKnownLocation) {
    buckets.bestandskursEligible.push(row)
  } else {
    buckets.unmatched.push(row)
  }
}

console.log(`\n=== Kuratiert, Name korrekt (${buckets.curatedMatch.length}) ===`)
for (const r of buckets.curatedMatch) console.log(`  id ${r.id}: "${r.name}"`)

console.log(`\n=== Kuratierte id, Name weicht ab (${buckets.curatedNameMismatch.length}) ===`)
for (const r of buckets.curatedNameMismatch)
  console.log(`  id ${r.id}: ist "${r.name}" -- erwartet "${r.expected}"`)

console.log(
  `\n=== Nicht kuratiert, aber Bestandskurs-fähig (4./5./6. Klasse + bekannter Standort) (${buckets.bestandskursEligible.length}) ===`
)
for (const r of buckets.bestandskursEligible)
  console.log(`  id ${r.id}: "${r.name}" (${r.klassenstufen.join(', ')}, ${r.ort}, Anmeldungen: ${r.aktuelle_teilnehmer})`)

console.log(`\n=== WEDER kuratiert NOCH Bestandskurs-fähig -- Kandidaten für Entfernung (${buckets.unmatched.length}) ===`)
for (const r of buckets.unmatched)
  console.log(`  id ${r.id}: "${r.name}" (${r.klassenstufen.join(', ')}, ${r.ort}, Anmeldungen: ${r.aktuelle_teilnehmer})`)

console.log(`\nGesamt: ${liveRows.length} Zeilen`)
