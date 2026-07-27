import type { SessionDefinition } from "@/types/marketing"

// Extrahiert aus ensure-bookable-session.ts, damit dieselbe Datumsauflösung sowohl beim
// Materialisieren von intensivwoche_kurse.start_datum als auch bei der Frühbucher-Anzeige
// (lib/kurse/session-row.ts) verwendet wird. Zwei unabhängige Implementierungen hätten sonst
// auseinanderlaufen können: die Buchungs-RPC hätte einen Rabatt gewährt, den die Terminliste vorher
// nie angezeigt hat (die meisten Fixture-Sessions haben kein strukturiertes startAt, nur ein
// dateLabel).
const OFFER_DATE_RANGES: Record<string, { start: string; end: string }> = {
  "offer-4klasse-halbjahreskurs": { start: "2027-03-01", end: "2027-07-31" },
  "offer-5klasse-halbjahreskurs": { start: "2027-05-01", end: "2027-07-31" },
  "offer-1sek-vorkurs": { start: "2027-05-01", end: "2027-07-31" },
  "offer-2-3sek-halbjahreskurs": { start: "2026-09-01", end: "2027-03-31" },
  "offer-6klasse-halbjahreskurs": { start: "2026-09-01", end: "2027-03-31" },
  "offer-matura-halbjahreskurs": { start: "2026-11-01", end: "2027-04-30" },
}

const MONTHS: Record<string, number> = {
  Feb: 2,
  Februar: 2,
  März: 3,
  April: 4,
  Mai: 5,
}

export function resolveSessionDates(
  session: SessionDefinition
): { start: string; end: string } | null {
  if (session.startAt && session.endAt) {
    return { start: session.startAt.slice(0, 10), end: session.endAt.slice(0, 10) }
  }

  const fixedRange = OFFER_DATE_RANGES[session.offerId]
  if (fixedRange) return fixedRange

  const range = session.dateLabel.match(
    /(\d{1,2})\.\s*[–-]\s*(\d{1,2})\.\s*(Feb(?:ruar)?|März|April|Mai)/
  )
  if (range) {
    const month = MONTHS[range[3]]
    return {
      start: isoDate(2027, month, Number(range[1])),
      end: isoDate(2027, month, Number(range[2])),
    }
  }

  const singleDay = session.dateLabel.match(/(\d{1,2})\.\s*(Februar|März|April|Mai)/)
  if (singleDay) {
    const date = isoDate(2027, MONTHS[singleDay[2]], Number(singleDay[1]))
    return { start: date, end: date }
  }

  return null
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}
