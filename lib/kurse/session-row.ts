// SessionDefinition (stabil/cachebar) + request-time SessionAvailability -> SessionRow
// (design-reference/architektur-briefing-kursseiten.md Abschnitt 2.4/2.9). Reine Kombinierfunktion
// -- die Verfügbarkeit selbst kommt ungecacht aus lib/kurse/availability.ts.

import type { BookingAction, SessionAvailability, SessionDefinition, SessionRow } from '@/types/marketing'
import { computeSessionPricing } from '@/lib/pricing'
import { resolveSessionDates } from '@/lib/kurse/session-dates'

// Die konkrete Session wurde auf der Detailseite bereits gewählt. Deshalb öffnet jeder aktive CTA
// unmittelbar das Anmeldeformular; ein Umweg über die allgemeine /kurse-Liste würde diese Auswahl
// verwerfen. Noch nicht materialisierte redaktionelle Sessions werden beim Submit serverseitig
// über ensureMarketingSessionIsBookable() aus dem vertrauenswürdigen Katalog angelegt.
export function buildBookingAction(availability: SessionAvailability | undefined): BookingAction {
  if (availability?.status === 'voll') {
    return { kind: 'disabled', label: 'Anmelden', disabledReason: 'Ausgebucht' }
  }
  return { kind: 'modal', label: 'Anmelden' }
}

// regularPriceRappen kommt vom aufrufenden Offer -- der Frühbucherrabatt ist pro Session
// unterschiedlich (eigenes Startdatum je Durchführung), deshalb hier statt gecacht in
// SessionDefinition berechnet (Betreiberentscheid 27.07.2026, siehe lib/pricing.ts).
export function buildSessionRows(
  sessions: SessionDefinition[],
  availabilityByKursId: Map<number, SessionAvailability>,
  regularPriceRappen: number
): SessionRow[] {
  return sessions.map((session) => {
    const availability = availabilityByKursId.get(session.source.kursId)
    return {
      ...session,
      availability:
        availability ?? {
          status: 'frei',
          bookedCount: 0,
          remainingPlaces: session.capacity,
          updatedAt: new Date().toISOString(),
        },
      bookingAction: buildBookingAction(availability),
      // Dieselbe Datumsauflösung wie beim Materialisieren von intensivwoche_kurse.start_datum
      // (ensure-bookable-session.ts) -- sonst würde die Anzeige einen anderen Rabatt zeigen als
      // die RPC tatsächlich berechnet.
      pricing: computeSessionPricing(regularPriceRappen, resolveSessionDates(session)?.start),
    }
  })
}
