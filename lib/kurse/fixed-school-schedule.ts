import type { SessionDefinition, WeekOption } from '@/types/marketing'

export const FIXED_SCHOOL_CALENDAR_WEEKS = [10, 11, 13, 14, 15, 16, 20, 21, 22, 23, 24] as const

const FIXED_SCHOOL_AUDIENCES = new Set(['4', '5', '6', '1-sek', '2-3-sek'])
const ADVANCED_SCHOOL_AUDIENCES = new Set(['bms', 'matura'])
const ZURICH_INTENSIVE_WEEKS = [7, 8] as const
const WINTERTHUR_INTENSIVE_WEEKS = [6, 7] as const
const MATURA_INTENSIVE_WEEKS = [6, 7] as const

export type IntensiveScheduleLocation = 'Zürich HB' | 'Winterthur'

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
  return location === 'Zürich HB' ? ZURICH_INTENSIVE_WEEKS : WINTERTHUR_INTENSIVE_WEEKS
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

export function buildFixedVorkursSchedule(schoolYear: string): FixedVorkursScheduleRow[] {
  const calendarYear = getScheduleCalendarYear(schoolYear)
  if (!calendarYear) return []

  return FIXED_SCHOOL_CALENDAR_WEEKS.map((calendarWeek) => ({
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

export function getFixedIntensiveLocations(
  audienceId: string,
  calendarWeek: number
): IntensiveScheduleLocation[] {
  const locations: IntensiveScheduleLocation[] =
    audienceId === 'matura' ? ['Zürich HB'] : ['Zürich HB', 'Winterthur']

  return locations.filter((location) =>
    getFixedIntensiveCalendarWeeks(audienceId, location).includes(calendarWeek)
  )
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
