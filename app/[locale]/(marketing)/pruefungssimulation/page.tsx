import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { pruefungssimulationPageModel } from '@/types/marketing.fixtures'
import { buildPageMetadata } from '@/lib/seo'
import { Section } from '@/app/components/layout/section'
import { AudienceHero } from '@/app/components/kurse/audience-hero'
import { CourseFlow } from '@/app/components/kurse/course-flow'
import { CourseContent } from '@/app/components/kurse/course-content'
import { WhyUsGrid } from '@/app/components/kurse/why-us-grid'
import { FaqAccordion } from '@/app/components/marketing/faq-accordion'
import { TargetedAudiencePicker } from '@/app/components/marketing/targeted-audience-picker'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return buildPageMetadata({
    title: pruefungssimulationPageModel.hero.title,
    description: pruefungssimulationPageModel.hero.description,
    path: '/pruefungssimulation',
    locale,
  })
}

// Beide Optionen zeigen auf die jeweilige Prüfungssimulations-Detailseite; beide haben seit der
// separaten Extraktionsrunde für Layout_2_Sek_Pruefungssimulation.html einen realen Katalogeintrag.
const pickerOptions = pruefungssimulationPageModel.eligibleAudiences.map((audience) => ({
  audience,
  href: `/kurse/${audience.slug}/pruefungssimulation`,
}))

export default async function PruefungssimulationPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <>
      <Section spacing="default">
        <AudienceHero content={pruefungssimulationPageModel.hero} />
      </Section>

      <Section spacing="sm" variant="muted">
        <CourseFlow steps={pruefungssimulationPageModel.flowSteps} />
      </Section>

      <Section spacing="sm">
        <TargetedAudiencePicker options={pickerOptions} />
      </Section>

      <Section spacing="sm" variant="muted">
        <WhyUsGrid features={pruefungssimulationPageModel.features} />
      </Section>

      <Section spacing="sm">
        {pruefungssimulationPageModel.contentSections.map((section) => (
          <CourseContent key={section.id} sections={[section]} />
        ))}
      </Section>

      {pruefungssimulationPageModel.faq && pruefungssimulationPageModel.faq.length > 0 ? (
        <Section spacing="sm" variant="muted">
          <FaqAccordion items={pruefungssimulationPageModel.faq} />
        </Section>
      ) : null}
    </>
  )
}
