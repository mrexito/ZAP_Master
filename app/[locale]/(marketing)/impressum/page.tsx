import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import type { LegalPageModel } from '@/types/marketing'
import { buildPageMetadata } from '@/lib/seo'
import { Section } from '@/app/components/layout/section'
import { LegalPageContent } from '@/app/components/marketing/legal-page-content'

// Abschnitt 9.1: Kontaktadresse ist die vom Betreiber bestätigte reale Adresse (Lernecke,
// Bolleystrasse 33, 8006 Zürich, lerneckezueri@gmail.com). Die übrigen Klauseln (Haftungsausschluss,
// Haftung für Links, Urheberrechte, allgemeiner DSG-Absatz) sind branchenübliches, generisches
// Schweizer Impressum-Boilerplate ohne Bezug zu einer fremden Identität. Bewusst NICHT übernommen:
// Google-Analytics-/Google-+1-Abschnitte einer fremden Vorlage -- Google+1 wurde 2019 eingestellt
// und diese Website bindet aktuell kein Analytics-Tool ein; eine Datenschutzerklärung muss die
// tatsächliche Datenverarbeitung beschreiben, nicht die einer anderen Seite.
const impressumModel: LegalPageModel = {
  title: 'Impressum',
  updatedAt: '2026-07-22',
  sections: [
    {
      id: 'kontaktadresse',
      title: 'Kontaktadresse',
      groups: [
        {
          id: 'adresse',
          items: [
            'Lernecke',
            'Bolleystrasse 33',
            '8006 Zürich',
            'Schweiz',
            'E-Mail: lerneckezueri@gmail.com',
          ],
        },
      ],
    },
    {
      id: 'haftungsausschluss',
      title: 'Haftungsausschluss',
      groups: [
        {
          id: 'haftungsausschluss-text',
          items: [
            'Der Autor übernimmt keinerlei Gewähr hinsichtlich der inhaltlichen Richtigkeit, Genauigkeit, Aktualität, Zuverlässigkeit und Vollständigkeit der Informationen.',
            'Haftungsansprüche gegen den Autor wegen Schäden materieller oder immaterieller Art, welche aus dem Zugriff oder der Nutzung bzw. Nichtnutzung der veröffentlichten Informationen, durch Missbrauch der Verbindung oder durch technische Störungen entstanden sind, werden ausgeschlossen.',
            'Alle Angebote sind unverbindlich. Der Autor behält es sich ausdrücklich vor, Teile der Seiten oder das gesamte Angebot ohne gesonderte Ankündigung zu verändern, zu ergänzen, zu löschen oder die Veröffentlichung zeitweise oder endgültig einzustellen.',
          ],
        },
      ],
    },
    {
      id: 'haftung-links',
      title: 'Haftung für Links',
      groups: [
        {
          id: 'haftung-links-text',
          items: [
            'Verweise und Links auf Webseiten Dritter liegen ausserhalb unseres Verantwortungsbereichs. Es wird jegliche Verantwortung für solche Webseiten abgelehnt. Der Zugriff und die Nutzung solcher Webseiten erfolgen auf eigene Gefahr des Nutzers oder der Nutzerin.',
          ],
        },
      ],
    },
    {
      id: 'urheberrechte',
      title: 'Urheberrechte',
      groups: [
        {
          id: 'urheberrechte-text',
          items: [
            'Die Urheber- und alle anderen Rechte an Inhalten, Bildern, Fotos oder anderen Dateien auf dieser Website gehören ausschliesslich Lernecke oder den speziell genannten Rechtsinhabern. Für die Reproduktion jeglicher Elemente ist die schriftliche Zustimmung der Urheberrechtsträger im Voraus einzuholen.',
          ],
        },
      ],
    },
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
  ],
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return buildPageMetadata({
    title: impressumModel.title,
    description: 'Rechtliche Angaben zum Anbieter dieser Lernplattform.',
    path: '/impressum',
    locale,
  })
}

export default async function ImpressumPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <Section spacing="default">
      <LegalPageContent model={impressumModel} />
    </Section>
  )
}
