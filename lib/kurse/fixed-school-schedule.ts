export const FIXED_SCHOOL_CALENDAR_WEEKS = [10, 11, 13, 14, 15, 16, 20, 21, 22, 23, 24] as const

const FIXED_SCHOOL_AUDIENCES = new Set(['4', '5', '6', '1-sek', '2-3-sek'])
const ADVANCED_SCHOOL_AUDIENCES = new Set(['bms', 'matura'])
const ZURICH_INTENSIVE_WEEKS = [7, 8] as const
const WINTERTHUR_INTENSIVE_WEEKS = [6, 7] as const
const ADVANCED_SCHOOL_INTENSIVE_WEEKS = [6, 7] as const

export type IntensiveScheduleLocation = 'Zürich HB' | 'Winterthur'

export type FixedVorkursScheduleRow = {
  calendarWeek: number
  saturday: string
  wednesday: string
}

export type FixedIntensiveScheduleRow = {
  calendarWeek: number
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

  const calendarWeeks = ADVANCED_SCHOOL_AUDIENCES.has(audienceId)
    ? ADVANCED_SCHOOL_INTENSIVE_WEEKS
    : location === 'Zürich HB'
      ? ZURICH_INTENSIVE_WEEKS
      : WINTERTHUR_INTENSIVE_WEEKS

  return calendarWeeks.map((calendarWeek) => ({
    calendarWeek,
    monday: formatSwissDate(isoWeekDate(calendarYear, calendarWeek, 1)),
    tuesday: formatSwissDate(isoWeekDate(calendarYear, calendarWeek, 2)),
    wednesday: formatSwissDate(isoWeekDate(calendarYear, calendarWeek, 3)),
    thursday: formatSwissDate(isoWeekDate(calendarYear, calendarWeek, 4)),
    friday: formatSwissDate(isoWeekDate(calendarYear, calendarWeek, 5)),
  }))
}
