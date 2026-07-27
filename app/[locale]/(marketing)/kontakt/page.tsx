import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import type { ContactPageModel } from '@/types/marketing'
import { buildPageMetadata } from '@/lib/seo'
import { Section } from '@/app/components/layout/section'
import { AudienceHero } from '@/app/components/kurse/audience-hero'
import { ContactForm } from '@/app/components/marketing/contact-form'

// Kein HTML-Mockup im Projekt vorhanden (Abschnitt 6 der Routentabelle: "kein Mockup") -- deshalb
// hier lokal statt in app/data/marketing-site.ts (das explizit als "reale Inhalte"-Quelle
// dokumentiert ist). E-Mail-Adresse vom Betreiber am 22.07.2026 bestätigt (dieselbe wie im
// Impressum). Kein Telefon/keine Postadresse -- hier nichts erfinden, solange nicht bestätigt.
// Das Kontaktformular (ContactForm) ist unabhängig davon vollständig gebaut, sendet aber noch
// nirgends hin -- siehe Kommentar dort.
const kontaktPageModel: ContactPageModel = {
  hero: {
    title: 'Kontakt',
    description:
      'Haben Sie Fragen zu den Kursen? Möchten Sie sich für einen Gymivorbereitungskurs anmelden oder sich beraten lassen? Wir helfen Ihnen gerne weiter!',
  },
  channels: [
    {
      id: 'email',
      kind: 'email',
      label: 'E-Mail',
      value: 'lerneckezueri@gmail.com',
      href: 'mailto:lerneckezueri@gmail.com',
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
    title: kontaktPageModel.hero.title,
    description: kontaktPageModel.hero.description,
    path: '/kontakt',
    locale,
  })
}

export default async function KontaktPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <Section spacing="default">
      <AudienceHero content={kontaktPageModel.hero} />
      <ul className="mt-8 flex flex-col gap-3">
        {kontaktPageModel.channels.map((channel) => (
          <li key={channel.id} className="text-foreground">
            <span className="font-medium">{channel.label}:</span>{' '}
            {channel.href ? (
              <a href={channel.href} className="text-primary underline underline-offset-4 hover:no-underline">
                {channel.value}
              </a>
            ) : (
              channel.value
            )}
          </li>
        ))}
      </ul>
      <div className="mt-10">
        <ContactForm />
      </div>
    </Section>
  )
}
