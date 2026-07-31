// Bestandskurs-Mapper (design-reference/architektur-briefing-kursseiten.md Abschnitt 2.10):
// intensivwoche_kurse-Zeilen -> ExistingCourseCardModel/SessionDefinition. Reine, seiteneffektfreie
// Funktionen -- die DB-Abfragen selbst liegen in lib/kurse/catalog.ts (gecacht) bzw.
// lib/kurse/availability.ts (ungecacht).
//
// Ausschlussregeln sind bewusst konservativ: SessionDefinition.standort und AudienceId sind
// strikte Unions. Eine Zeile, die nicht eindeutig hineinpasst (unbekannter Standort, unbekannte
// Klassenstufe), wird nicht falsch typisiert, sondern von der jeweiligen Zuordnung ausgeschlossen
// -- sie bleibt auf der bestehenden Route /kurse weiterhin sichtbar, taucht nur auf den neuen
// Marketingseiten nicht auf, bis sie redaktionell nachgezogen wird (needs_review).

import type { KursDB } from '@/types/kurs-form'
import type {
  AudienceId,
  AvailabilityStatus,
  CourseLocation,
  ExistingCourseCardModel,
  SessionAvailability,
  SessionDefinition,
  Subject,
} from '@/types/marketing'
import { audiences } from '@/app/data/marketing-site'

const FACH_TO_SUBJECT: Record<KursDB['fach'], Exclude<Subject, 'mixed'>> = {
  mathematik: 'ma',
  deutsch: 'de',
  franzoesisch: 'fr',
  'natur-mensch-gesellschaft': 'nmg',
}

/** Für die Wiederverwendung von AnmeldungModal (app/(public)/kurse/), das den rohen `fach`-Enum
 *  erwartet, nicht das gemappte Subject. */
export const SUBJECT_TO_FACH: Record<Exclude<Subject, 'mixed'>, KursDB['fach']> = {
  ma: 'mathematik',
  de: 'deutsch',
  fr: 'franzoesisch',
  nmg: 'natur-mensch-gesellschaft',
}

const KLASSENSTUFE_TO_AUDIENCE: Record<string, AudienceId> = {
  '4. Klasse': '4',
  '5. Klasse': '5',
  '6. Klasse': '6',
}

export type SchulKategorie = 'primar' | 'sek' | 'weiterfuehrend'

const KLASSENSTUFE_TO_KATEGORIE = new Map(audiences.map((a) => [a.displayLabel, a.kategorie]))

/** Ordnet eine Kursverwaltungs-Zeile einer der drei Filterkategorien der Kursübersicht zu
 *  (Primarschule/Sekundarschule/BMS und Matura) -- dieselbe `Audience.kategorie`-Quelle wie
 *  Navigation und KlassenPicker, keine zweite Kategorisierung. `null`, wenn keine Klassenstufe der
 *  Zeile einer bekannten Audience entspricht. */
export function getSchulKategorie(klassenstufen: string[]): SchulKategorie | null {
  for (const stufe of klassenstufen) {
    const kategorie = KLASSENSTUFE_TO_KATEGORIE.get(stufe)
    if (kategorie) return kategorie
  }
  return null
}

const KNOWN_LOCATIONS: readonly CourseLocation[] = ['Zürich HB', 'Winterthur']

function isKnownLocation(ort: string): ort is CourseLocation {
  return (KNOWN_LOCATIONS as readonly string[]).includes(ort)
}

/** Nur die drei live verifizierten, eindeutig abbildbaren Klassenstufen -- Abschnitt 2.10. */
export function mapKlassenstufeToAudienceIds(klassenstufen: string[]): AudienceId[] {
  const mapped = klassenstufen
    .map((stufe) => KLASSENSTUFE_TO_AUDIENCE[stufe])
    .filter((id): id is AudienceId => id != null)
  return Array.from(new Set(mapped))
}

const STATUS_TO_AVAILABILITY: Record<'offen' | 'wenige-plaetze' | 'ausgebucht', AvailabilityStatus> = {
  offen: 'frei',
  'wenige-plaetze': 'wenige',
  ausgebucht: 'voll',
}

export function mapAvailability(row: {
  aktuelle_teilnehmer: number
  max_teilnehmer: number
  status: 'offen' | 'wenige-plaetze' | 'ausgebucht'
  updatedAt?: string
}): SessionAvailability {
  return {
    status: STATUS_TO_AVAILABILITY[row.status],
    bookedCount: row.aktuelle_teilnehmer,
    remainingPlaces: Math.max(row.max_teilnehmer - row.aktuelle_teilnehmer, 0),
    updatedAt: row.updatedAt ?? new Date().toISOString(),
  }
}

/** Extrahiert den Kurstyp-Anteil eines Kursnamens für die Gruppierung in der Kursverwaltung, z.B.
 *  "Vorkurs – Kurs A" -> "Vorkurs". Trennt nur an einem von Leerzeichen umgebenen
 *  Gedankenstrich/Bindestrich, damit interne Bindestriche wie in "Intensivkurs-Sportferien"
 *  erhalten bleiben. Ohne erkennbaren Trenner gilt der ganze Name als eigene Kurstyp-Gruppe. */
export function getKurstypGruppe(name: string): string {
  const [prefix] = name.split(/\s[–-]\s/)
  return prefix.trim() || 'Sonstige'
}

export type KurstypGruppe<T> = { label: string; kurse: T[] }
export type KlasseGruppe<T> = { label: string; kurstypGruppen: KurstypGruppe<T>[] }

const KLASSEN_REIHENFOLGE = audiences.map((audience) => audience.displayLabel)

/** Gruppiert Kursverwaltungs-Zeilen zweistufig: zuerst nach Klassenstufe(n) (Reihenfolge wie in
 *  der Zielgruppen-Navigation, unbekannte/fehlende Klassenstufen zuletzt als "Ohne Klasse"),
 *  danach innerhalb jeder Klasse nach Kurstyp (getKurstypGruppe, alphabetisch). Die Reihenfolge
 *  innerhalb einer Kurstyp-Gruppe bleibt die der Eingabe (bereits nach start_datum sortiert). */
export function groupKurseNachKlasseUndKurstyp<T extends Pick<KursDB, 'name' | 'klassenstufen'>>(
  kurse: T[]
): KlasseGruppe<T>[] {
  const klasseMap = new Map<string, T[]>()
  for (const kurs of kurse) {
    const key = kurs.klassenstufen.length > 0 ? kurs.klassenstufen.join(', ') : 'Ohne Klasse'
    const bucket = klasseMap.get(key)
    if (bucket) {
      bucket.push(kurs)
    } else {
      klasseMap.set(key, [kurs])
    }
  }

  const klasseLabels = Array.from(klasseMap.keys()).sort((a, b) => {
    if (a === 'Ohne Klasse') return 1
    if (b === 'Ohne Klasse') return -1
    const ai = KLASSEN_REIHENFOLGE.indexOf(a)
    const bi = KLASSEN_REIHENFOLGE.indexOf(b)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return a.localeCompare(b, 'de')
  })

  return klasseLabels.map((klasseLabel) => {
    const kurstypMap = new Map<string, T[]>()
    for (const kurs of klasseMap.get(klasseLabel)!) {
      const key = getKurstypGruppe(kurs.name)
      const bucket = kurstypMap.get(key)
      if (bucket) {
        bucket.push(kurs)
      } else {
        kurstypMap.set(key, [kurs])
      }
    }
    const kurstypGruppen = Array.from(kurstypMap.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'de'))
      .map(([label, kurse]) => ({ label, kurse }))
    return { label: klasseLabel, kurstypGruppen }
  })
}

/** `null`, wenn der Ort nicht einem der zwei freigegebenen Standorte entspricht (needs_review). */
export function mapKursRowToSessionDefinition(row: KursDB): SessionDefinition | null {
  if (!isKnownLocation(row.ort)) return null

  return {
    id: row.id,
    offerId: `bestand-${row.id}`,
    capacity: row.max_teilnehmer,
    source: { kind: 'intensivwoche_kurse', kursId: row.id },
    kurs: row.name,
    dateLabel: `${row.start_datum} – ${row.end_datum}`,
    startAt: row.start_datum,
    endAt: row.end_datum,
    standort: row.ort,
    timeLabel: row.uhrzeit,
    deliveryModes: ['onsite'],
    ablauf: { kind: 'simple', items: [] },
  }
}

/** `null`, wenn der Ort nicht typisierbar ist (siehe mapKursRowToSessionDefinition). */
export function mapKursRowToExistingCourseCard(row: KursDB): ExistingCourseCardModel | null {
  const session = mapKursRowToSessionDefinition(row)
  if (session == null) return null

  return {
    id: `bestand-${row.id}`,
    sourceKursId: row.id,
    title: row.name,
    subject: FACH_TO_SUBJECT[row.fach],
    description: row.beschreibung,
    detailDescription: row.detail_beschreibung ?? undefined,
    classLabels: row.klassenstufen,
    teacher: row.lehrer,
    highlights: row.highlights,
    regularPriceRappen: Math.round(row.preis * 100),
    currency: 'CHF',
    session,
  }
}
