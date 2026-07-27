import type { SessionDefinition, WeekOption } from '@/types/marketing'

const FIXED_SCHOOL_AUDIENCES = new Set(['4', '5', '6', '1-sek', '2-3-sek'])
const ADVANCED_SCHOOL_AUDIENCES = new Set(['bms', 'matura'])

export type IntensiveScheduleLocation = 'Zürich HB' | 'Winterthur'

// Gruppierung für den Termine-Filter in "3 · Termine" (Admin-Kursverwaltung): Langzeitgymi
// (4./5./6. Klasse, ZAP1), Kurzzeitgymi (1. Sek/2.-3. Sek, ZAP2) und BMS & Matura. Kurzzeitgymi
// verwendet unten vorläufig dieselben Kalenderwochen wie Langzeitgymi -- eigene, fachlich
// bestätigte Wochen sind noch ausstehend (gleiches Muster wie "vorläufige Preise" in
// design-review-todo.md Punkt 1). BMS behält seine bisherigen Werte, Matura ihren eigenen
// Sonderfall -- beide unverändert gegenüber dem bisherigen Verhalten.
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

const VORKURS_CALENDAR_WEEKS_BY_GROUP: Readonly<Record<'langzeitgymi' | 'kurzzeitgymi', readonly number[]>> = {
  langzeitgymi: [10, 11, 13, 14, 15, 16, 20, 21, 22, 23, 24],
  kurzzeitgymi: [10, 11, 13, 14, 15, 16, 20, 21, 22, 23, 24],
}

const INTENSIVE_WEEKS_BY_GROUP: Readonly<Record<'langzeitgymi' | 'kurzzeitgymi', Readonly<Record<IntensiveScheduleLocation, readonly number[]>>>> = {
  langzeitgymi: { 'Zürich HB': [7, 8], Winterthur: [6, 7] },
  kurzzeitgymi: { 'Zürich HB': [7, 8], Winterthur: [6, 7] },
}
const MATURA_INTENSIVE_WEEKS = [6, 7] as const

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
  audienceId: string,
  location: IntensiveScheduleLocation
): readonly number[] {
  if (audienceId === 'matura') return MATURA_INTENSIVE_WEEKS
  // 'bms' fällt wie jede unbekannte/nicht gemappte audienceId auf 'langzeitgymi' zurück -- exakt
  // dieselben Zahlen wie vor der Gruppenaufteilung, keine Verhaltensänderung für Bestandsaufrufer.
  const group = getFixScheduleGroup(audienceId)
  const weeksGroup = group === 'kurzzeitgymi' ? 'kurzzeitgymi' : 'langzeitgymi'
  return INTENSIVE_WEEKS_BY_GROUP[weeksGroup][location]
}

export function getScheduleCalendarYear(schoolYear: string): number | null {
  const parts = schoolYear.match(/\d+/g)
  if (!parts?.length) return null

  const firstYear = Number(parts[0])
  if (!Number.isInteger(firstYear)) return null

  if (parts.length === 1) {
    return firstYear >= 2000 && firstYear <= 2200 ? firstYear : null
  }

  const lastPart = parts.at(-1)!
  let lastYear = Number(lastPart)
  if (lastPart.length === 2 && firstYear >= 1000) {
    lastYear = Math.floor(firstYear / 100) * 100 + lastYear
    if (lastYear < firstYear) lastYear += 100
  }

  return lastYear >= 2000 && lastYear <= 2200 ? lastYear : null
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
// group ist deshalb auf die beiden Gruppen beschränkt, die tatsächlich einen Vorkurs kennen.
export function buildFixedVorkursSchedule(
  schoolYear: string,
  group: 'langzeitgymi' | 'kurzzeitgymi' = 'langzeitgymi'
): FixedVorkursScheduleRow[] {
  const calendarYear = getScheduleCalendarYear(schoolYear)
  if (!calendarYear) return []

  return VORKURS_CALENDAR_WEEKS_BY_GROUP[group].map((calendarWeek) => ({
    calendarWeek,
    saturday: formatSwissDate(isoWeekDate(calendarYear, calendarWeek, 6)),
    wednesday: formatSwissDate(isoWeekDate(calendarYear, calendarWeek, 3)),
  }))
}

export function buildFixedIntensiveSchedule(
  schoolYear: string,
  audienceId: string,
  location: IntensiveScheduleLocation
): FixedIntensiveScheduleRow[] {
  const calendarYear = getScheduleCalendarYear(schoolYear)
  if (!calendarYear || !hasFixedIntensiveSchedule(audienceId)) return []

  const calendarWeeks = getFixedIntensiveCalendarWeeks(audienceId, location)

  return calendarWeeks.map((calendarWeek) => ({
    calendarWeek,
    startAt: formatIsoDate(isoWeekDate(calendarYear, calendarWeek, 1)),
    endAt: formatIsoDate(isoWeekDate(calendarYear, calendarWeek, 5)),
    monday: formatSwissDate(isoWeekDate(calendarYear, calendarWeek, 1)),
    tuesday: formatSwissDate(isoWeekDate(calendarYear, calendarWeek, 2)),
    wednesday: formatSwissDate(isoWeekDate(calendarYear, calendarWeek, 3)),
    thursday: formatSwissDate(isoWeekDate(calendarYear, calendarWeek, 4)),
    friday: formatSwissDate(isoWeekDate(calendarYear, calendarWeek, 5)),
  }))
}

export function buildFixedIntensiveAudienceSchedule(
  schoolYear: string,
  audienceId: string
): FixedIntensiveScheduleRow[] {
  const locations: IntensiveScheduleLocation[] =
    audienceId === 'matura' ? ['Zürich HB'] : ['Zürich HB', 'Winterthur']
  const schedules = locations.flatMap((location) =>
    buildFixedIntensiveSchedule(schoolYear, audienceId, location)
  )

  return Array.from(
    new Map(schedules.map((schedule) => [schedule.calendarWeek, schedule])).values()
  ).sort((left, right) => left.calendarWeek - right.calendarWeek)
}

export function buildFixedIntensiveWeekOptions(
  schoolYear: string,
  audienceId: string
): WeekOption[] {
  return buildFixedIntensiveAudienceSchedule(schoolYear, audienceId).map((schedule) => ({
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
  sessions: SessionDefinition[],
  schoolYear: string,
  audienceId: string
): SessionDefinition[] {
  const scheduleIndexByGroup = new Map<string, number>()

  return sessions.map((session) => {
    const location: IntensiveScheduleLocation =
      session.standort === 'Winterthur' ? 'Winterthur' : 'Zürich HB'
    const schedules = buildFixedIntensiveSchedule(schoolYear, audienceId, location)
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
