import type { SessionDefinition, WeekOption } from '@/types/marketing'

const FIXED_SCHOOL_AUDIENCES = new Set(['4', '5', '6', '1-sek', '2-3-sek'])
const ADVANCED_SCHOOL_AUDIENCES = new Set(['bms', 'matura'])

export type IntensiveScheduleLocation = 'Zürich HB' | 'Winterthur'

// Gruppierung für den Termine-Filter in "3 · Termine" (Admin-Kursverwaltung): Langzeitgymi
// (4./5./6. Klasse, ZAP1), Kurzzeitgymi (1. Sek/2.-3. Sek, ZAP2) und BMS & Matura. Kurzzeitgymi
// verwendet unten vorläufig dieselben Kalenderwochen wie Langzeitgymi -- eigene, fachlich
// bestätigte Wochen sind noch ausstehend (gleiches Muster wie "vorläufige Preise" in
// design-review-todo.md Punkt 1). BMS und Matura besitzen unten in `school_holiday_weeks` seit der
// Ferienwochen-Admin-Maske eigene, unabhängig editierbare Zeilen -- diese UI-Gruppierung bleibt
// dennoch dreiteilig, weil BMS & Matura in der Admin-Referenztabelle gemeinsam als eine Spalte
// dargestellt werden.
export type FixScheduleGroup = 'langzeitgymi' | 'kurzzeitgymi' | 'bms-matura'

export const FIX_SCHEDULE_GROUPS: readonly FixScheduleGroup[] = ['langzeitgymi', 'kurzzeitgymi', 'bms-matura']

export const FIX_SCHEDULE_GROUP_LABELS: Readonly<Record<FixScheduleGroup, string>> = {
  langzeitgymi: 'Langzeitgymi',
  kurzzeitgymi: 'Kurzzeitgymi',
  'bms-matura': 'BMS & Matura',
}

const AUDIENCE_TO_FIX_SCHEDULE_GROUP: Readonly<Record<string, FixScheduleGroup>> = {
  '4': 'langzeitgymi',
  '5': 'langzeitgymi',
  '6': 'langzeitgymi',
  '1-sek': 'kurzzeitgymi',
  '2-3-sek': 'kurzzeitgymi',
  bms: 'bms-matura',
  matura: 'bms-matura',
}

export function getFixScheduleGroup(audienceId: string): FixScheduleGroup | null {
  return AUDIENCE_TO_FIX_SCHEDULE_GROUP[audienceId] ?? null
}

// Repräsentative audienceId je Gruppe für die weiterhin audienceId-parametrisierten
// Intensivkurs-Funktionen unten (buildFixedIntensiveSchedule() etc. bleiben so unverändert
// aufrufbar aus lib/kurse/catalog.ts); die Gruppen-Ansicht in session-editor.tsx nutzt dieselbe
// Berechnung stellvertretend für die ganze Gruppe.
const REPRESENTATIVE_AUDIENCE_BY_GROUP: Readonly<Record<'langzeitgymi' | 'kurzzeitgymi', string>> = {
  langzeitgymi: '6',
  kurzzeitgymi: '2-3-sek',
}

export function getRepresentativeAudienceForGroup(group: 'langzeitgymi' | 'kurzzeitgymi'): string {
  return REPRESENTATIVE_AUDIENCE_BY_GROUP[group]
}

// ---------------------------------------------------------------------------------------------
// Ferienwochen-Lookup: kommt seit school_holiday_weeks (Migration 20260728090000) aus der DB statt
// aus hart codierten Modul-Konstanten -- ein Jahr mit verschobenen Ferien (z.B. Frühlingsferien
// KW 16/17 statt KW 17/18) braucht dadurch nur noch einen Admin-Eintrag statt eines Code-Releases.
// Die vier Storage-Gruppen sind feiner als FixScheduleGroup oben: 'bms' und 'matura' sind seit der
// DB-Migration unabhängig editierbar statt (wie zuvor im Code) implizit auf 'langzeitgymi'
// zurückzufallen.
// ---------------------------------------------------------------------------------------------

// Fuer holiday_type='intensiv' bleiben schedule_group die vier Gruppen; fuer holiday_type='vorkurs'
// sind es einzelne Klassenstufen-IDs, weil reale Daten zeigen, dass sich z.B. 4. und 5. Klasse trotz
// gemeinsamer 'langzeitgymi'-Intensivkurs-Gruppe in ihren Vorkurs-Wochen unterscheiden (siehe
// VORKURS_AUDIENCE_LABELS unten).
export type ScheduleGroupKey = 'langzeitgymi' | 'kurzzeitgymi' | 'bms' | 'matura' | VorkursAudienceKey
export type VorkursAudienceKey = '4' | '5' | '6' | '1-sek' | '2-3-sek'
export type HolidayType = 'vorkurs' | 'intensiv'
export type HolidayWeeksLocation = IntensiveScheduleLocation | 'ALL'

// Welche einzelnen Klassenstufen zur jeweiligen FixScheduleGroup-Filteransicht in
// session-editor.tsx gehoeren -- Anzeige-Reihenfolge und -Labels fuer die mehrspaltige
// Vorkurs-Referenztabelle (analog zu den Standort-Spalten bei FixedIntensiveSchedule).
export const VORKURS_AUDIENCES_BY_GROUP: Readonly<Record<'langzeitgymi' | 'kurzzeitgymi', readonly VorkursAudienceKey[]>> = {
  langzeitgymi: ['4', '5', '6'],
  kurzzeitgymi: ['1-sek', '2-3-sek'],
}

export const VORKURS_AUDIENCE_LABELS: Readonly<Record<VorkursAudienceKey, string>> = {
  '4': '4. Klasse',
  '5': '5. Klasse',
  '6': '6. Klasse',
  '1-sek': '1. Sek',
  '2-3-sek': '2./3. Sek',
}

export interface SchoolHolidayWeekRow {
  scheduleGroup: ScheduleGroupKey
  holidayType: HolidayType
  location: HolidayWeeksLocation
  calendarWeeks: number[]
}

// Map-Key: `${scheduleGroup}|${holidayType}|${location}` -- absichtlich ein simpler String-Key
// statt einer verschachtelten Struktur, weil sowohl session-editor.tsx (Client) als auch
// catalog.ts (Server, 'use cache') denselben Lookup nur lesend konsumieren.
export type HolidayWeeksLookup = ReadonlyMap<string, readonly number[]>

function holidayWeeksKey(scheduleGroup: ScheduleGroupKey, holidayType: HolidayType, location: HolidayWeeksLocation): string {
  return `${scheduleGroup}|${holidayType}|${location}`
}

// Feste Domäne aller zwölf (schedule_group, holiday_type, location)-Kombinationen (siehe
// 20260728091000_seed_school_holiday_weeks.sql) -- einzige Quelle für die "Ferienwochen
// verwalten"-Formulare in session-editor.tsx, damit dort keine zweite, potenziell abweichende
// Kombinationsliste gepflegt wird. Vorkurs ist pro einzelner Klassenstufe (nicht pro Gruppe), weil
// sich reale Wochen zwischen z.B. 4. und 5. Klasse unterscheiden.
export interface HolidayWeeksRowDefinition {
  scheduleGroup: ScheduleGroupKey
  holidayType: HolidayType
  location: HolidayWeeksLocation
  label: string
}

export const HOLIDAY_WEEKS_ROW_DEFINITIONS: readonly HolidayWeeksRowDefinition[] = [
  { scheduleGroup: 'langzeitgymi', holidayType: 'intensiv', location: 'Zürich HB', label: 'Langzeitgymi · Intensiv · Zürich HB' },
  { scheduleGroup: 'langzeitgymi', holidayType: 'intensiv', location: 'Winterthur', label: 'Langzeitgymi · Intensiv · Winterthur' },
  { scheduleGroup: 'kurzzeitgymi', holidayType: 'intensiv', location: 'Zürich HB', label: 'Kurzzeitgymi · Intensiv · Zürich HB' },
  { scheduleGroup: 'kurzzeitgymi', holidayType: 'intensiv', location: 'Winterthur', label: 'Kurzzeitgymi · Intensiv · Winterthur' },
  { scheduleGroup: 'bms', holidayType: 'intensiv', location: 'Zürich HB', label: 'BMS · Intensiv · Zürich HB' },
  { scheduleGroup: 'bms', holidayType: 'intensiv', location: 'Winterthur', label: 'BMS · Intensiv · Winterthur' },
  { scheduleGroup: 'matura', holidayType: 'intensiv', location: 'Zürich HB', label: 'Matura · Intensiv' },
  { scheduleGroup: '4', holidayType: 'vorkurs', location: 'ALL', label: 'Vorkurs · 4. Klasse' },
  { scheduleGroup: '5', holidayType: 'vorkurs', location: 'ALL', label: 'Vorkurs · 5. Klasse' },
  { scheduleGroup: '6', holidayType: 'vorkurs', location: 'ALL', label: 'Vorkurs · 6. Klasse' },
  { scheduleGroup: '1-sek', holidayType: 'vorkurs', location: 'ALL', label: 'Vorkurs · 1. Sek' },
  { scheduleGroup: '2-3-sek', holidayType: 'vorkurs', location: 'ALL', label: 'Vorkurs · 2./3. Sek' },
]

export function buildHolidayWeeksLookup(rows: readonly SchoolHolidayWeekRow[]): HolidayWeeksLookup {
  const lookup = new Map<string, readonly number[]>()
  for (const row of rows) {
    lookup.set(holidayWeeksKey(row.scheduleGroup, row.holidayType, row.location), row.calendarWeeks)
  }
  return lookup
}

const AUDIENCE_TO_SCHEDULE_GROUP_KEY: Readonly<Record<string, ScheduleGroupKey>> = {
  '4': 'langzeitgymi',
  '5': 'langzeitgymi',
  '6': 'langzeitgymi',
  '1-sek': 'kurzzeitgymi',
  '2-3-sek': 'kurzzeitgymi',
  bms: 'bms',
  matura: 'matura',
}

// Unbekannte/nicht gemappte audienceId fällt wie zuvor im Code auf 'langzeitgymi' zurück (siehe
// vorherige getFixedIntensiveCalendarWeeks-Implementierung) -- keine Verhaltensänderung.
function getScheduleGroupKeyForAudience(audienceId: string): ScheduleGroupKey {
  return AUDIENCE_TO_SCHEDULE_GROUP_KEY[audienceId] ?? 'langzeitgymi'
}

export type FixedVorkursScheduleRow = {
  calendarWeek: number
  saturday: string
  wednesday: string
}

export type FixedIntensiveScheduleRow = {
  calendarWeek: number
  startAt: string
  endAt: string
  monday: string
  tuesday: string
  wednesday: string
  thursday: string
  friday: string
}

export function hasFixedSchoolSchedule(audienceId: string): boolean {
  return FIXED_SCHOOL_AUDIENCES.has(audienceId)
}

export function hasFixedIntensiveSchedule(audienceId: string): boolean {
  return FIXED_SCHOOL_AUDIENCES.has(audienceId) || ADVANCED_SCHOOL_AUDIENCES.has(audienceId)
}

function getFixedIntensiveCalendarWeeks(
  weeksLookup: HolidayWeeksLookup,
  audienceId: string,
  location: IntensiveScheduleLocation
): readonly number[] {
  const groupKey = getScheduleGroupKeyForAudience(audienceId)
  // Matura ignoriert (wie zuvor im Code) den übergebenen Standort -- es gibt nur einen Satz Wochen,
  // gepflegt unter dem Sentinel-Standort 'Zürich HB' (buildFixedIntensiveAudienceSchedule ruft für
  // Matura ohnehin ausschliesslich mit diesem Standort auf).
  const lookupLocation = groupKey === 'matura' ? 'Zürich HB' : location
  return weeksLookup.get(holidayWeeksKey(groupKey, 'intensiv', lookupLocation)) ?? []
}

// Ein Schuljahr wie "2026/27" deckt zwei Kalenderjahre ab. Bislang lagen alle Fixtermine
// (Sportferien KW 6-8, urspruengliche Vorkurs-Platzhalterliste) ausschliesslich im zweiten
// Kalenderjahr (Fruehling), ein einzelnes lastYear genuegte. 6. Klasse & 2./3. Sek starten ihren
// Vorkurs jedoch bereits im Herbst des ERSTEN Kalenderjahres (z.B. KW 36-50) und laufen im zweiten
// Kalenderjahr weiter (z.B. KW 1-6) -- getScheduleCalendarYears() liefert deshalb beide Jahre,
// resolveCalendarYearForWeek() waehlt pro Kalenderwoche das richtige.
export function getScheduleCalendarYears(schoolYear: string): { firstYear: number; lastYear: number } | null {
  const parts = schoolYear.match(/\d+/g)
  if (!parts?.length) return null

  const firstYear = Number(parts[0])
  if (!Number.isInteger(firstYear) || firstYear < 2000 || firstYear > 2200) return null

  if (parts.length === 1) {
    return { firstYear, lastYear: firstYear }
  }

  const lastPart = parts.at(-1)!
  let lastYear = Number(lastPart)
  if (lastPart.length === 2 && firstYear >= 1000) {
    lastYear = Math.floor(firstYear / 100) * 100 + lastYear
    if (lastYear < firstYear) lastYear += 100
  }

  return lastYear >= 2000 && lastYear <= 2200 ? { firstYear, lastYear } : null
}

export function getScheduleCalendarYear(schoolYear: string): number | null {
  return getScheduleCalendarYears(schoolYear)?.lastYear ?? null
}

// Grenze zwischen "gehoert noch zum ersten Kalenderjahr des Schuljahres" (Herbst/Winter, KW 28-53)
// und "gehoert zum zweiten Kalenderjahr" (Fruehling/Sommer, KW 1-27). Alle bisher bekannten
// Vorkurs-/Intensivkurs-Wochen liegen klar auf einer der beiden Seiten dieser Grenze (naechste KW
// nach dem 2026/27-Datenstand: 27 vs. 36), keine Randfall-Woche 27/28 in echten Daten bislang.
const CALENDAR_YEAR_BOUNDARY_WEEK = 27

function resolveCalendarYearForWeek(years: { firstYear: number; lastYear: number }, calendarWeek: number): number {
  return calendarWeek <= CALENDAR_YEAR_BOUNDARY_WEEK ? years.lastYear : years.firstYear
}

function isoWeekDate(year: number, calendarWeek: number, isoWeekday: number): Date {
  const januaryFourth = new Date(Date.UTC(year, 0, 4))
  const januaryFourthWeekday = januaryFourth.getUTCDay() || 7
  const date = new Date(januaryFourth)
  date.setUTCDate(
    januaryFourth.getUTCDate() -
      januaryFourthWeekday +
      1 +
      (calendarWeek - 1) * 7 +
      (isoWeekday - 1)
  )
  return date
}

function formatSwissDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const shortYear = String(date.getUTCFullYear() % 100).padStart(2, '0')
  return `${day}.${month}.${shortYear}`
}

function formatIsoDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// BMS & Matura besitzen keinen Vorkurs-Fixplan (hasFixedSchoolSchedule() deckt sie nicht ab) --
// audienceKey ist deshalb auf die fuenf Klassenstufen beschraenkt, die tatsächlich einen Vorkurs
// kennen. Mittwochs-Termin wird nicht separat gepflegt, sondern aus derselben Kalenderwoche wie
// Samstag abgeleitet (ein Mi/Sa-Paar pro Woche, siehe Kommentar in der Seed-Migration).
export function buildFixedVorkursSchedule(
  weeksLookup: HolidayWeeksLookup,
  schoolYear: string,
  audienceKey: VorkursAudienceKey
): FixedVorkursScheduleRow[] {
  const years = getScheduleCalendarYears(schoolYear)
  if (!years) return []

  const calendarWeeks = weeksLookup.get(holidayWeeksKey(audienceKey, 'vorkurs', 'ALL')) ?? []

  return calendarWeeks.map((calendarWeek) => {
    const year = resolveCalendarYearForWeek(years, calendarWeek)
    return {
      calendarWeek,
      saturday: formatSwissDate(isoWeekDate(year, calendarWeek, 6)),
      wednesday: formatSwissDate(isoWeekDate(year, calendarWeek, 3)),
    }
  })
}

export function buildFixedIntensiveSchedule(
  weeksLookup: HolidayWeeksLookup,
  schoolYear: string,
  audienceId: string,
  location: IntensiveScheduleLocation
): FixedIntensiveScheduleRow[] {
  const years = getScheduleCalendarYears(schoolYear)
  if (!years || !hasFixedIntensiveSchedule(audienceId)) return []

  const calendarWeeks = getFixedIntensiveCalendarWeeks(weeksLookup, audienceId, location)

  return calendarWeeks.map((calendarWeek) => {
    const year = resolveCalendarYearForWeek(years, calendarWeek)
    return {
      calendarWeek,
      startAt: formatIsoDate(isoWeekDate(year, calendarWeek, 1)),
      endAt: formatIsoDate(isoWeekDate(year, calendarWeek, 5)),
      monday: formatSwissDate(isoWeekDate(year, calendarWeek, 1)),
      tuesday: formatSwissDate(isoWeekDate(year, calendarWeek, 2)),
      wednesday: formatSwissDate(isoWeekDate(year, calendarWeek, 3)),
      thursday: formatSwissDate(isoWeekDate(year, calendarWeek, 4)),
      friday: formatSwissDate(isoWeekDate(year, calendarWeek, 5)),
    }
  })
}

export function buildFixedIntensiveAudienceSchedule(
  weeksLookup: HolidayWeeksLookup,
  schoolYear: string,
  audienceId: string
): FixedIntensiveScheduleRow[] {
  const locations: IntensiveScheduleLocation[] =
    audienceId === 'matura' ? ['Zürich HB'] : ['Zürich HB', 'Winterthur']
  const schedules = locations.flatMap((location) =>
    buildFixedIntensiveSchedule(weeksLookup, schoolYear, audienceId, location)
  )

  // Sortiert rein numerisch nach Kalenderwoche -- korrekt fuer alle bislang bekannten
  // Intensivkurs-Fixplaene (KW 6-8, nie ueber den Jahreswechsel hinweg). Ein Intensivkurs mit
  // Wochen auf beiden Seiten von CALENDAR_YEAR_BOUNDARY_WEEK braeuchte hier zusaetzlich das
  // aufgeloeste Kalenderjahr aus resolveCalendarYearForWeek() als Sortierschluessel.
  return Array.from(
    new Map(schedules.map((schedule) => [schedule.calendarWeek, schedule])).values()
  ).sort((left, right) => left.calendarWeek - right.calendarWeek)
}

export function buildFixedIntensiveWeekOptions(
  weeksLookup: HolidayWeeksLookup,
  schoolYear: string,
  audienceId: string
): WeekOption[] {
  return buildFixedIntensiveAudienceSchedule(weeksLookup, schoolYear, audienceId).map((schedule) => ({
    id: `kw-${schedule.calendarWeek}`,
    label: `KW ${schedule.calendarWeek} · ${schedule.monday}–${schedule.friday}`,
  }))
}

const LEGACY_WEEK_BY_ID: Readonly<Record<string, number>> = {
  '0812': 6,
  '1519': 7,
  '2226': 8,
  '0105': 9,
}

const WEEKDAY_FIELDS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const
const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr'] as const

function closestCalendarWeek(preferredWeek: number, schedules: FixedIntensiveScheduleRow[]) {
  return schedules.reduce((closest, candidate) =>
    Math.abs(candidate.calendarWeek - preferredWeek) <
    Math.abs(closest.calendarWeek - preferredWeek)
      ? candidate
      : closest
  )
}

export function applyFixedIntensiveScheduleToSessions(
  weeksLookup: HolidayWeeksLookup,
  sessions: SessionDefinition[],
  schoolYear: string,
  audienceId: string
): SessionDefinition[] {
  const scheduleIndexByGroup = new Map<string, number>()

  return sessions.map((session) => {
    const location: IntensiveScheduleLocation =
      session.standort === 'Winterthur' ? 'Winterthur' : 'Zürich HB'
    const schedules = buildFixedIntensiveSchedule(weeksLookup, schoolYear, audienceId, location)
    if (schedules.length === 0) return session

    const groupKey = ADVANCED_SCHOOL_AUDIENCES.has(audienceId) ? audienceId : location
    const groupIndex = scheduleIndexByGroup.get(groupKey) ?? 0
    scheduleIndexByGroup.set(groupKey, groupIndex + 1)

    const preferredWeek = session.weekId ? LEGACY_WEEK_BY_ID[session.weekId] : undefined
    const schedule =
      preferredWeek != null
        ? closestCalendarWeek(preferredWeek, schedules)
        : schedules[groupIndex % schedules.length]

    const ablauf =
      session.ablauf.kind === 'simple'
        ? {
            ...session.ablauf,
            items: session.ablauf.items.map((item, index) => {
              const field = WEEKDAY_FIELDS[index]
              if (!field) return item
              const suffix = item.label.match(/\s*(\(.*\))\s*$/)?.[0] ?? ''
              return {
                ...item,
                label: `${WEEKDAY_LABELS[index]}, ${schedule[field]}${suffix}`,
              }
            }),
          }
        : session.ablauf

    return {
      ...session,
      dateLabel: `${schedule.monday} – ${schedule.friday}`,
      startAt: schedule.startAt,
      endAt: schedule.endAt,
      weekId: `kw-${schedule.calendarWeek}`,
      ablauf,
    }
  })
}

// ---------------------------------------------------------------------------------------------
// Ostermontag-Vorschlag: reiner Anzeige-Hinweis für die Admin-UI (Abschnitt "Ferienwochen
// verwalten" in session-editor.tsx), schreibt nichts automatisch in school_holiday_weeks. Kanton
// Zürich: Frühlingsferien liegen im Regelfall in KW 17/18, Ausnahme KW 16/17, wenn Ostermontag in
// KW 16 fällt. Die offiziellen kantonalen Ferientermine können von dieser reinen Formel abweichen
// -- der Admin bestätigt/korrigiert den Vorschlag manuell, bevor er gespeichert wird.
// ---------------------------------------------------------------------------------------------

export interface OstermontagWeekSuggestion {
  ostermontagCalendarWeek: number
  isExceptionYear: boolean
  standardWeeks: readonly [number, number]
  exceptionWeeks: readonly [number, number]
}

// Gauss/Meeus-Osterformel (proleptisch gregorianisch, gültig 1583–4099).
function computeEasterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(year, month - 1, day))
}

function isoCalendarWeek(date: Date): number {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNumber = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber)
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

export function suggestOstermontagAdjacentWeeks(calendarYear: number): OstermontagWeekSuggestion {
  const easterSunday = computeEasterSunday(calendarYear)
  const ostermontag = new Date(easterSunday)
  ostermontag.setUTCDate(ostermontag.getUTCDate() + 1)
  const ostermontagCalendarWeek = isoCalendarWeek(ostermontag)

  return {
    ostermontagCalendarWeek,
    isExceptionYear: ostermontagCalendarWeek === 16,
    standardWeeks: [17, 18],
    exceptionWeeks: [16, 17],
  }
}
