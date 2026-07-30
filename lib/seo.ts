// Geteilte Metadata-Bausteine fuer Abschnitt 10.4 des Architektur-Briefings ("Jede oeffentliche
// Seite hat eindeutige lokalisierte Metadata, Canonical URL, OpenGraph/Twitter-Daten und
// sinnvolle Social-Fallbackbilder"). Zentral statt pro Seite dupliziert, damit canonical/OG/
// Twitter nicht unabhaengig voneinander abweichen koennen (derselbe Grundsatz wie bei der
// Preisformatierung in lib/pricing.ts).
//
// Das schema.org-Course/Event-JSON-LD aus demselben Abschnitt 10.4 lebt bewusst NICHT hier,
// sondern in lib/kurse/course-jsonld.ts: es haengt von der ungecachten Sessionverfuegbarkeit ab
// (Abschnitt 7) und wird deshalb in der Suspense-Boundary der Kursdetailseite gebaut, nicht in
// generateMetadata().
//
// Bewusst OHNE Social-Vorschaubild: es existiert kein freigegebenes offizielles Marken-/OG-Bild
// im Projekt (Abschnitt 9.1 -- Team-/Testimonial-Fotos sind ausdruecklich noch nicht freigegeben,
// und ein beliebiges vorhandenes Bild als "offizielles" Social-Bild auszugeben waere genau die Art
// von erfundenem Inhalt, die dieses Projekt an anderer Stelle bewusst vermeidet). Social-Plattformen
// fallen ohne "images" auf einen neutralen Platzhalter zurueck, statt ein nicht freigegebenes Foto
// zu verbreiten. Sobald ein freigegebenes Bild vorliegt, hier zentral ergaenzen.

import type { Metadata } from 'next'

/**
 * Basis-URL der Deployment-Umgebung (Prod/Staging/Local getrennt per Abschnitt 10.4 "Umgebungswerte").
 * Fallback auf Localhost, damit lokale Entwicklung ohne gesetzte Env-Variable nicht bricht --
 * die echte Domain wird ausschliesslich ueber NEXT_PUBLIC_APP_URL je Umgebung konfiguriert, nie
 * hier im Code geraten/hartkodiert.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

const SITE_NAME = 'ZAP – Zentrale Aufnahmeprüfung'

interface BuildPageMetadataInput {
  title: string
  description: string
  /** Logischer Pfad OHNE Locale-Praefix, z.B. "/kurse/6-klasse" oder "" fuer die Startseite. */
  path: string
  locale: string
}

/** Liefert vollstaendige Metadata inkl. Canonical-URL und OpenGraph/Twitter-Daten fuer eine
 *  einzelne oeffentliche Seite. Kein "images"-Feld, siehe Kommentar oben. */
export function buildPageMetadata({ title, description, path, locale }: BuildPageMetadataInput): Metadata {
  const canonicalPath = `/${locale}${path}`
  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title,
      description,
      url: canonicalPath,
      siteName: SITE_NAME,
      locale,
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}
