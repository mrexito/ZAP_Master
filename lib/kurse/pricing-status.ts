// Punkt 1 aus design-review-todo.md (aufgelöst 2026-07-23): Alle Preise im neuen Angebotskatalog
// gelten bis auf Weiteres als vorläufig/fiktiv und werden vor dem echten Verkaufsstart angepasst.
// SHOW_PRICE_PREVIEW_BADGE steuert ausschliesslich die kosmetische Kennzeichnung (Badge,
// Hinweistext) -- NICHT die Buchbarkeit selbst. Echte Sessions bleiben datengetrieben und öffnen
// bei freien Plätzen direkt das Anmeldeformular; noch nicht verknüpfte Vorschau-Sessions führen
// zur bestehenden /kurse-Auswahl mit den real buchbaren Kursen (lib/kurse/session-row.ts). Ein
// pauschales, datenunabhängiges Modal würde dagegen Platzhalter-IDs an die Buchungs-RPC senden.
// Einziger Umschaltpunkt für die Badge-Anzeige; sobald reale, fachlich freigegebene Preise
// vorliegen, hier auf false setzen.
export const SHOW_PRICE_PREVIEW_BADGE = true

export const PREVIEW_BOOKING_NOTE =
  'Alle Preise und Termine auf dieser Seite sind vorläufig und werden vor dem Verkaufsstart final bestätigt.'
