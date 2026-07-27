import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import type { AudienceHeroContent } from '@/types/marketing'
import { buildPageMetadata } from '@/lib/seo'
import { Section } from '@/app/components/layout/section'
import { AudienceHero } from '@/app/components/kurse/audience-hero'

// Kein eigenes Mockup und keine freigegebenen vollständigen Adressen vorhanden (analog zu
// kontakt/page.tsx). Die beiden Ortsnamen selbst sind aber kein erfundener Inhalt: "Zürich HB" und
// "Winterthur" sind die im gesamten Projekt bereits verbindlich verwendeten zwei Kursstandorte
// (Architektur-Briefing Abschnitt 2.4 -- jede Session in intensivwoche_kurse/course_sessions nutzt
// ausschliesslich diese zwei Werte). Deshalb hier bewusst mehr als der reine "folgt in Kürze"-
// Platzhalter von Kontakt/Impressum/Datenschutz/AGB, aber ohne Strassen-/Hausnummer-Angaben, die
// tatsächlich noch fehlen.
const STANDORTE = ['Zürich HB', 'Winterthur'] as const

const standortePageContent: AudienceHeroContent = {
  title: 'Standorte',
  description: 'Unsere Kurse finden an folgenden Standorten statt.',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return buildPageMetadata({
    title: standortePageContent.title,
    description: standortePageContent.description,
    path: '/standorte',
    locale,
  })
}

export default async function StandortePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <Section spacing="default">
      <AudienceHero content={standortePageContent} />
      <ul className="mt-8 flex flex-col gap-3">
        {STANDORTE.map((standort) => (
          <li key={standort} className="text-lg font-medium text-foreground">
            {standort}
          </li>
        ))}
      </ul>
      <p className="mt-6 text-muted-foreground">
        Genaue Adressen und Anfahrtshinweise werden in Kürze ergänzt.
      </p>
    </Section>
  )
}
