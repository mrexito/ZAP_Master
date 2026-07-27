#!/usr/bin/env node
// Wiederholt ausfuehrbares Generierungsskript: liest alle publizierbaren Angebote direkt aus
// types/marketing.fixtures.ts (importiert das echte TS-Modul, keine manuelle Abschrift -- das
// waere bei mehreren Datensaetzen mit mehrzeiligen Beschreibungstexten fehleranfaellig) und erzeugt
// daraus eine additive Migration, die offer_editions mit genau diesen aktuellen Werten befuellt.
// Erzeugt keine neuen offers-Zeilen (existieren bereits vollstaendig seit
// 20260721074103_seed_offer_catalog.sql).
//
// Punkt 1 aus design-review-todo.md (aufgeloest 2026-07-23): Preiskonflikte werden nicht mehr
// einzeln fachlich freigegeben, bevor ein Angebot eine offer_editions-Zeile bekommt -- alle Preise
// gelten bis auf Weiteres als vorlaeufig/fiktiv (siehe lib/kurse/pricing-status.ts) und werden
// spaeter angepasst. BMS-Halbjahreskurs ist seit jenem Lauf deshalb enthalten (Inhalt existiert
// seit 22.07.2026). 5. Klasse Lerncamp (Preiskonflikt CHF 950 vs. CHF 890, Nutzer-Entscheid:
// CHF 950) ist seit dem Lauf vom 23.07.2026 ebenfalls enthalten, nachdem das zuvor fehlende
// Fixture (fuenfKlasseLerncampSportferien, types/marketing.fixtures.ts) ergaenzt wurde.
//
// Nutzung: npx tsx scripts/generate-offer-editions-migration.mjs

import { writeFileSync } from 'node:fs'
import path from 'node:path'

import * as fixtures from '../types/marketing.fixtures.ts'

const SCHOOL_YEAR = '2026/27'

function sqlString(value) {
  // Dollar-Quoting statt '' -Verdopplung: robust gegenueber Apostrophen/Anfuehrungszeichen in
  // deutschen Texten, ohne dass ich jede Stelle einzeln escapen muss.
  return `$str$${value}$str$`
}

// Kein Frühbucherpreis-/-Stichtag-Feld mehr (Betreiberentscheid 27.07.2026): 10% Rabatt gilt seit
// supabase/migrations/20260727170000_automatic_early_bird_discount.sql automatisch, wenn die
// Anmeldung mindestens 6 Wochen vor dem hinterlegten Kursstart erfolgt -- offer_editions speichert
// nur noch den Regulärpreis.
function offerEditionInsert(offer) {
  return `insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, currency, status
)
select o.id, ${sqlString(SCHOOL_YEAR)}, ${sqlString(offer.displayName)}, ${sqlString(offer.tagline)}, ${sqlString(offer.description)},
  ${offer.regularPriceRappen}, ${sqlString(offer.currency)}, 'published'
from public.offers o
where o.audience_id = ${sqlString(offer.audienceId)} and o.kurstyp = ${sqlString(offer.kurstyp)} and o.slug = ${sqlString(offer.slug)}
on conflict (offer_id, school_year) do nothing;`
}

// Nur echte Offer-Fixtures (haben kurstyp + regularPriceRappen) -- filtert Sessions-Arrays,
// PageModels usw. automatisch heraus.
const offerEntries = Object.entries(fixtures).filter(
  ([, value]) =>
    value && typeof value === 'object' && !Array.isArray(value) &&
    typeof value.kurstyp === 'string' && typeof value.regularPriceRappen === 'number'
)

console.log(`Gefundene Offer-Fixtures mit Preis: ${offerEntries.length}`)
for (const [name, offer] of offerEntries) {
  console.log(`  ${name}: ${offer.audienceId}/${offer.kurstyp}/${offer.slug} -> ${offer.regularPriceRappen} Rappen`)
}

const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '')
const outFile = path.resolve(
  import.meta.dirname,
  '..',
  'supabase',
  'migrations',
  `${timestamp}_seed_published_offer_editions.sql`
)

const header = `-- Befuellt offer_editions fuer die 18 bereits oeffentlich publizierten Angebote (Abschnitt 2.12)
-- mit den aktuell auf der Website sichtbaren Preisen/Texten aus types/marketing.fixtures.ts --
-- generiert per scripts/generate-offer-editions-migration.mjs, keine manuelle Abschrift. Macht
-- die Preise ab sofort ueber /dashboard/kurse/angebote (Schritt 10a) live editierbar, OHNE die
-- oeffentlich sichtbaren Werte zu aendern (identisch zu den bisherigen Fixture-Werten). Sobald die
-- oeffentlichen Seiten auf offer_editions statt der statischen Fixtures umgestellt sind (separater
-- Schritt), werden Preisaenderungen ueber die Admin-Maske sofort live sichtbar.
--
-- BEWUSST NICHT enthalten: 5. Klasse Lerncamp (dokumentierter Preiskonflikt CHF 950 vs. 890, siehe
-- supabase/seed.sql und den Kommentar bei fuenfKlasseHalbjahreskurs in den Fixtures -- der echte
-- Preis folgt separat, sobald er fachlich freigegeben ist) und BMS-Halbjahreskurs (kein Inhalt,
-- siehe Abschnitt 9.1 des Architektur-Briefings). Beide offers-Zeilen existieren bereits, bleiben
-- hier aber ohne offer_editions-Zeile.
--
-- Alle offers-Zeilen existieren bereits (20260721074103_seed_offer_catalog.sql); ON CONFLICT DO
-- NOTHING macht diese Migration bei einem erneuten Lauf ungefaehrlich wiederholbar.

`

const sql = header + offerEntries.map(([, offer]) => offerEditionInsert(offer)).join('\n\n') + '\n'

writeFileSync(outFile, sql, 'utf-8')
console.log(`\nGeschrieben: ${outFile}`)
