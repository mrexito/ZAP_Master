'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { CourseOffer, ExamSimulationOffer, SessionColumn, SessionRow } from '@/types/marketing'
import { SessionTable } from '@/app/components/kurse/session-table'
import { WeekFilter, ALL_WEEKS_ID } from '@/app/components/kurse/week-filter'
import { SHOW_PRICE_PREVIEW_BADGE, PREVIEW_BOOKING_NOTE } from '@/lib/kurse/pricing-status'

interface BookingSectionProps {
  // ExamSimulationOffer teilt booking/weekOptions(=never/undefined) mit CourseOffer (Schritt 11).
  offer: CourseOffer | ExamSimulationOffer
  sessions: SessionRow[]
  onBook?: (row: SessionRow) => void
}

// Spalten sind stabile Konfiguration, nicht redaktionell frei wählbar (Abschnitt 2.4) -- die
// Zuordnung passiert hier anhand offer.kurstyp, kein caller-seitiger columns-Prop nötig. Innerhalb
// der Komponente (nicht mehr modul-scope) gebaut, da useTranslations() ein Hook ist.
function columnsForKurstyp(
  kurstyp: (CourseOffer | ExamSimulationOffer)['kurstyp'],
  t: ReturnType<typeof useTranslations<'kurse.columns'>>
): SessionColumn[] {
  if (kurstyp === 'halbjahreskurs') {
    return [
      { key: 'kurs', label: t('kurs') },
      { key: 'time', label: t('tagUndZeit') },
      { key: 'details', label: t('ablauf') },
      { key: 'location', label: t('standort') },
      { key: 'price', label: t('preis') },
      { key: 'status', label: t('status') },
    ]
  }
  // Reduzierte Spalten für Prüfungssimulationen (Abschnitt 4): kein Tagesplan-Popover, die
  // Fixture-Sessions haben ohnehin ein leeres ablauf-Feld.
  if (kurstyp === 'pruefungssimulation') {
    return [
      { key: 'date', label: t('datum') },
      { key: 'time', label: t('zeit') },
      { key: 'location', label: t('standort') },
      { key: 'price', label: t('preis') },
      { key: 'status', label: t('status') },
    ]
  }
  return [
    { key: 'kurs', label: t('kurs') },
    { key: 'date', label: t('datum') },
    { key: 'time', label: t('zeit') },
    { key: 'details', label: t('tagesplan') },
    { key: 'location', label: t('standort') },
    { key: 'price', label: t('preis') },
    { key: 'status', label: t('status') },
  ]
}

function BookingSection({ offer, sessions, onBook }: BookingSectionProps) {
  const [activeWeekId, setActiveWeekId] = useState(ALL_WEEKS_ID)
  const t = useTranslations('kurse.columns')

  const columns = columnsForKurstyp(offer.kurstyp, t)

  const visibleSessions = useMemo(() => {
    if (!offer.weekOptions || activeWeekId === ALL_WEEKS_ID) return sessions
    return sessions.filter((session) => session.weekId === activeWeekId)
  }, [sessions, offer.weekOptions, activeWeekId])

  return (
    <div id={offer.booking.anchorId} className="flex flex-col gap-6">
      {offer.weekOptions ? (
        <WeekFilter weeks={offer.weekOptions} activeWeekId={activeWeekId} onChange={setActiveWeekId} />
      ) : null}
      {visibleSessions.length > 0 ? (
        // offer.booking.title ("Termine und Buchung") ist bereits die SectionNumberLabel-Eyebrow
        // in [angebot]/page.tsx -- hier nur noch als aria-label statt als zweite sichtbare
        // Überschrift, um die Dopplung zu vermeiden.
        <SessionTable columns={columns} rows={visibleSessions} onBook={onBook} ariaLabel={offer.booking.title} />
      ) : (
        <p className="text-sm text-muted-foreground">{offer.booking.emptyState}</p>
      )}
      {offer.booking.note ? <p className="text-xs text-muted-foreground">{offer.booking.note}</p> : null}
      {SHOW_PRICE_PREVIEW_BADGE ? (
        <p className="text-xs text-muted-foreground">{PREVIEW_BOOKING_NOTE}</p>
      ) : null}
    </div>
  )
}

export { BookingSection }
