import type { CourseOffer } from '@/types/marketing'

// Gemeinsame Datengrundlage für das seitenweite Rhythmus-Element (SubjectRhythm,
// Layout_4_Klasse_Hauptseite.html: .rhythm) -- prüft anhand des tatsächlichen Angebotstexts, ob
// eine Zielgruppe wirklich Deutsch UND Mathematik kombiniert (z.B. nicht Matura, das nur
// Mathematik abdeckt), statt das Element blind auf jeder Hauptseite zu zeigen.
export function coversDeutschUndMathematik(offer: CourseOffer): boolean {
  const haystack = [offer.tagline, offer.description, ...offer.features].join(' ').toLowerCase()
  return haystack.includes('deutsch') && haystack.includes('mathematik')
}
