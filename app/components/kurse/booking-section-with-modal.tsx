'use client'

// Schritt 8: analoger Wrapper zu existing-course-booking.tsx, für Sessions, die aus dem
// editorialen CourseOffer-Katalog stammen. Öffnet dieselbe AnmeldungModal, keine zweite
// Buchungsmodalität (Abschnitt 1b des Architektur-Briefings).

import { useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import type { CourseOffer, ExamSimulationOffer, SessionRow } from '@/types/marketing'
import { AnmeldungModal } from '@/app/(public)/kurse/anmeldung-modal'
import { BookingSection } from '@/app/components/kurse/booking-section'
import { SUBJECT_TO_FACH } from '@/lib/kurse/mapper'
import { audiences } from '@/app/data/marketing-site'
import { resolveSessionDates } from '@/lib/kurse/session-dates'

interface BookingSectionWithModalProps {
  // ExamSimulationOffer teilt booking/Preisfelder mit CourseOffer (Schritt 11).
  offer: CourseOffer | ExamSimulationOffer
  sessions: SessionRow[]
}

function BookingSectionWithModal({ offer, sessions }: BookingSectionWithModalProps) {
  const router = useRouter()
  const [selectedSession, setSelectedSession] = useState<SessionRow | null>(null)

  return (
    <>
      <BookingSection offer={offer} sessions={sessions} onBook={setSelectedSession} />
      {selectedSession ? (
        <AnmeldungModal
          kurs={{
            id: selectedSession.source.kursId,
            name: selectedSession.kurs,
            // Kombinierte Angebote (offer.subject undefined/'mixed') haben aktuell noch keine
            // real verknüpfte, fachlich eindeutige Session -- bekannte Einschränkung, siehe
            // step0Baseline.revision2.md-Notiz zu Schritt 10a (Admin-Maske erzeugt künftig
            // fachlich eindeutige course_sessions).
            fach:
              offer.subject && offer.subject !== 'mixed' ? SUBJECT_TO_FACH[offer.subject] : 'deutsch',
            // Dieselbe Datumsauflösung wie beim Materialisieren von intensivwoche_kurse.start_datum
            // (lib/kurse/session-dates.ts) -- sonst würde der im Modal angezeigte Frühbucherpreis
            // vom tatsächlich belasteten Preis abweichen können.
            startDatum: resolveSessionDates(selectedSession)?.start ?? selectedSession.startAt ?? '',
            endDatum: selectedSession.endAt ?? '',
            dateLabel: selectedSession.dateLabel,
            uhrzeit: selectedSession.timeLabel,
            ort: selectedSession.standort,
            preis: offer.regularPriceRappen / 100,
            klassenstufen: [
              audiences.find((audience) => audience.id === offer.audienceId)?.displayLabel ??
                offer.audienceId,
            ],
          }}
          onClose={() => {
            setSelectedSession(null)
            router.refresh()
          }}
        />
      ) : null}
    </>
  )
}

export { BookingSectionWithModal }
