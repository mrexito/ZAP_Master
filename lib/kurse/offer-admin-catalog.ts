// Schritt 10a (Abschnitt 2.12/3/6 des Architektur-Briefings): der stabile, zielgruppenunabhaengige
// Angebotskatalog fuer die Admin-Maske "Kursangebot verwalten". Die 20 Eintraege und ihre exakten
// Anzeigetexte sind woertlich aus dem "Kursangebot"-<select> in
// design-reference/Layout_Admin_Kursangebot_Maske.html uebernommen (7 <optgroup>s, 20 <option>s) --
// inklusive der beiden redaktionell noch nicht befuellten Angebote (5. Klasse Lerncamp: Preis-
// konflikt, siehe Kommentar bei fuenfKlasseHalbjahreskurs in types/marketing.fixtures.ts; BMS
// Halbjahreskurs: keine eigene Detailreferenz vorhanden). Diese Liste beschreibt nur die stabile
// Identitaet (audienceId/kurstyp/slug) -- die dazugehoerige DB-Zeile in public.offers wird
// deterministisch in derselben Reihenfolge durch die Migration
// 20260721074103_seed_offer_catalog.sql angelegt, damit offerId (offers.id) vorhersehbar bleibt.
//
// Ein "Neues Kursangebot"-Flow, der diese Liste um weitere Eintraege erweitert, ist laut
// Abschnitt 2.12 ausdruecklich ein separater, spaeterer Schritt und hier nicht enthalten.

import type { AudienceId, Kurstyp } from '@/types/marketing'
import { audiences } from '@/app/data/marketing-site'

export type AdminOfferCatalogEntry = {
  audienceId: AudienceId
  kurstyp: Kurstyp
  slug: string
  /** Anzeigetext im "Kursangebot"-Select, woertlich aus der Admin-Referenz. */
  label: string
}

export const ADMIN_OFFER_CATALOG: readonly AdminOfferCatalogEntry[] = [
  { audienceId: '4', kurstyp: 'halbjahreskurs', slug: 'halbjahreskurs', label: '4. Klasse · Vorkurs' },
  { audienceId: '4', kurstyp: 'intensivkurs', slug: 'lerncamp-sportferien', label: '4. Klasse · Lerncamp Sportferien' },
  { audienceId: '5', kurstyp: 'halbjahreskurs', slug: 'halbjahreskurs', label: '5. Klasse · Vorkurs' },
  { audienceId: '5', kurstyp: 'intensivkurs', slug: 'lerncamp-sportferien', label: '5. Klasse · Lerncamp Sportferien' },
  { audienceId: '6', kurstyp: 'intensivkurs', slug: 'intensivkurs-sportferien', label: '6. Klasse · Intensivkurs' },
  { audienceId: '6', kurstyp: 'halbjahreskurs', slug: 'halbjahreskurs', label: '6. Klasse · Vorkurs' },
  { audienceId: '6', kurstyp: 'pruefungssimulation', slug: 'pruefungssimulation', label: '6. Klasse · Prüfungssimulation' },
  { audienceId: '6', kurstyp: 'selbststudium', slug: 'selbststudium', label: '6. Klasse · Selbststudium' },
  { audienceId: '1-sek', kurstyp: 'halbjahreskurs', slug: 'vorkurs', label: '1. Sek · Vorkurs' },
  { audienceId: '1-sek', kurstyp: 'intensivkurs', slug: 'lerncamp-sportferien', label: '1. Sek · Lerncamp Sportferien' },
  { audienceId: '2-3-sek', kurstyp: 'intensivkurs', slug: 'intensivkurs-sportferien', label: '2./3. Sek · Intensivkurs' },
  { audienceId: '2-3-sek', kurstyp: 'halbjahreskurs', slug: 'halbjahreskurs', label: '2./3. Sek · Vorkurs' },
  { audienceId: '2-3-sek', kurstyp: 'pruefungssimulation', slug: 'pruefungssimulation', label: '2./3. Sek · Prüfungssimulation' },
  { audienceId: '2-3-sek', kurstyp: 'selbststudium', slug: 'selbststudium', label: '2./3. Sek · Selbststudium' },
  { audienceId: 'bms', kurstyp: 'halbjahreskurs', slug: 'halbjahreskurs', label: 'BMS · Vorkurs' },
  { audienceId: 'bms', kurstyp: 'intensivkurs', slug: 'intensivkurs', label: 'BMS · Intensivkurs' },
  { audienceId: 'bms', kurstyp: 'pruefungssimulation', slug: 'pruefungssimulation', label: 'BMS · Prüfungssimulation' },
  { audienceId: 'bms', kurstyp: 'selbststudium', slug: 'selbststudium', label: 'BMS · Selbststudium' },
  { audienceId: 'matura', kurstyp: 'halbjahreskurs', slug: 'halbjahreskurs', label: 'Matura · Vorkurs' },
  { audienceId: 'matura', kurstyp: 'intensivkurs', slug: 'intensivwoche', label: 'Matura · Intensivwoche' },
] as const

export const KURSTYP_LABELS: Record<Kurstyp, string> = {
  halbjahreskurs: 'Vorkurs',
  intensivkurs: 'Intensivkurs',
  pruefungssimulation: 'Prüfungssimulation',
  selbststudium: 'Selbststudium',
}

export function getAudienceDisplayLabel(audienceId: AudienceId): string {
  return audiences.find((audience) => audience.id === audienceId)?.displayLabel ?? audienceId
}

export function findAdminOfferCatalogEntry(
  audienceId: AudienceId,
  kurstyp: Kurstyp,
  slug: string
): AdminOfferCatalogEntry | undefined {
  return ADMIN_OFFER_CATALOG.find(
    (entry) => entry.audienceId === audienceId && entry.kurstyp === kurstyp && entry.slug === slug
  )
}
