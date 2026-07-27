import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import type { LegalPageModel } from '@/types/marketing'
import { buildPageMetadata } from '@/lib/seo'
import { Section } from '@/app/components/layout/section'
import { LegalPageContent } from '@/app/components/marketing/legal-page-content'

// Abschnitt 9.1: Betreiber hat am 22.07.2026 ausdrücklich entschieden, ohne separate anwaltliche
// Prüfung zu veröffentlichen ("skip legal review") -- dieselbe Entscheidung wie beim Impressum.
// Generischer DSG-Absatz, identisch mit dem entsprechenden Abschnitt in impressum/page.tsx (dort
// nur die kurze Zusammenfassung, hier die eigene dedizierte Seite). Bewusst NICHT enthalten:
// Google-Analytics-/Google-+1-Klauseln einer fremden Vorlage -- siehe ausführliche Begründung in
// impressum/page.tsx. Diese Seite beschreibt bewusst nur die generische DSG-Grundhaltung, keine
// vollständige Auflistung aller Datenkategorien/Aufbewahrungsfristen -- diese steht bereits
// separat und ausführlich in data-retention-runbook.md (internes Dokument, nicht öffentlich
// verlinkt) und müsste für eine vollständige Datenschutzerklärung noch hierher übertragen werden.
const datenschutzModel: LegalPageModel = {
  title: 'Datenschutz',
  updatedAt: '2026-07-22',
  sections: [
    {
      id: 'datenschutz',
      title: 'Datenschutz',
      groups: [
        {
          id: 'datenschutz-text',
          items: [
            'Gestützt auf Artikel 13 der schweizerischen Bundesverfassung und die datenschutzrechtlichen Bestimmungen des Bundes (Datenschutzgesetz, DSG) hat jede Person Anspruch auf Schutz ihrer Privatsphäre sowie auf Schutz vor Missbrauch ihrer persönlichen Daten. Wir halten diese Bestimmungen ein. Persönliche Daten werden streng vertraulich behandelt und weder an Dritte verkauft noch weitergegeben.',
            'In enger Zusammenarbeit mit unseren Hosting-Providern bemühen wir uns, die Datenbanken so gut wie möglich vor fremden Zugriffen, Verlusten, Missbrauch oder vor Fälschung zu schützen.',
          ],
        },
      ],
    },
    {
      id: 'kontakt',
      title: 'Kontakt',
      groups: [
        {
          id: 'kontakt-text',
          items: ['Fragen zum Datenschutz beantworten wir gerne unter lerneckezueri@gmail.com.'],
        },
      ],
    },
  ],
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return buildPageMetadata({
    title: datenschutzModel.title,
    description: 'Informationen zum Datenschutz auf dieser Lernplattform.',
    path: '/datenschutz',
    locale,
  })
}

export default async function DatenschutzPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <Section spacing="default">
      <LegalPageContent model={datenschutzModel} />
    </Section>
  )
}
