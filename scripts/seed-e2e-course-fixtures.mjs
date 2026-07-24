#!/usr/bin/env node
// Legt/aktualisiert echte intensivwoche_kurse-Testzeilen an, DIE VOR `npm run build:test` LAUFEN
// MUSS (Abschnitt 10.1). Grund: die Zielgruppen-Katalogseiten (app/[locale]/(marketing)/kurse/
// [audience]/page.tsx) stehen in generateStaticParams() und werden bei `next build` als PPR-Shell
// vorgerendert -- lib/kurse/catalog.ts's getExistingCoursesForAudience() ist 'use cache' und wird
// dabei bereits BEIM BUILD ausgewertet und in die Shell gebacken. Eine erst NACH dem Build über
// service_role eingefügte Zeile taucht dort nie auf, ganz unabhängig von einem `next start`-Neustart
// -- nur ein echtes updateTag('courses') (z.B. über die Admin-Kursverwaltung) regeneriert diesen
// Shell-Ausschnitt. Deshalb müssen diese Fixtures schon vor dem Build existieren.
//
// Nutzung: node scripts/seed-e2e-course-fixtures.mjs

import { createClient } from '@supabase/supabase-js'
import { getLocalSupabaseStatus } from './lib/local-supabase.mjs'

const status = getLocalSupabaseStatus()
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Matcht die editoriale Session-Fixture kursId=9001 ("Kurs B" in sechsKlasseIntensivkursSessions,
// types/marketing.fixtures.ts). Alle Sessions öffnen direkt das Buchungsmodal; diese Live-Zeile
// liefert zusätzlich eine kontrollierte Verfügbarkeit für den Cache-/Buchungsregressionstest.
// capacity=1, damit ein einzelner Test-Booking-Versuch sie sofort auf "ausgebucht" kippt
// (tests/routes.spec.ts).
const AVAILABILITY_KURS_ID = 9001

// Eigenständiger Testkurs für den Preis-/Cache-Invalidierungstest (updateTag('courses') nach
// Admin-Bearbeitung, Abschnitt 7). Stabile ID, damit der Test sie direkt referenzieren kann, statt
// sie erst nachschlagen zu müssen.
const PRICE_TEST_KURS_ID = 9100

const { error: availabilityError } = await admin.from('intensivwoche_kurse').upsert({
  id: AVAILABILITY_KURS_ID,
  name: 'E2E Verfügbarkeitstest',
  beschreibung: 'Automatisch erzeugt von scripts/seed-e2e-course-fixtures.mjs (Buchungsregression).',
  fach: 'mathematik',
  klassenstufen: ['6. Klasse'],
  start_datum: '2027-02-15',
  end_datum: '2027-02-19',
  uhrzeit: '09.00–12.15',
  lehrer: 'E2E Testperson',
  preis: 1195,
  max_teilnehmer: 1,
  ort: 'Zürich HB',
  ist_aktiv: true,
})
if (availabilityError) {
  console.error('Fehler beim Anlegen des Verfügbarkeitstest-Kurses:', availabilityError.message)
  process.exit(1)
}
// Etwaige Buchungen aus einem vorherigen Lauf ohne zwischenzeitlichen db reset entfernen, damit
// der Kurs wieder mit 0 Buchungen startet.
await admin.from('intensivwoche_anmeldungen').delete().eq('kurs_id', AVAILABILITY_KURS_ID)

const { error: priceError } = await admin.from('intensivwoche_kurse').upsert({
  id: PRICE_TEST_KURS_ID,
  name: 'E2E Preistest-Kurs',
  beschreibung: 'Automatisch erzeugt von scripts/seed-e2e-course-fixtures.mjs (Preis-Cache-Regression).',
  fach: 'mathematik',
  klassenstufen: ['6. Klasse'],
  start_datum: '2027-03-01',
  end_datum: '2027-03-05',
  uhrzeit: '09.00–12.15',
  lehrer: 'E2E Testperson',
  preis: 888,
  max_teilnehmer: 10,
  ort: 'Zürich HB',
  ist_aktiv: true,
})
if (priceError) {
  console.error('Fehler beim Anlegen des Preistest-Kurses:', priceError.message)
  process.exit(1)
}

console.log(`OK: E2E-Kursfixtures angelegt (Verfügbarkeit id=${AVAILABILITY_KURS_ID}, Preistest id=${PRICE_TEST_KURS_ID})`)
