import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { distanceLearningPageModel } from '@/types/marketing.fixtures'
import { buildPageMetadata } from '@/lib/seo'
import { Section } from '@/app/components/layout/section'
import { AudienceHero } from '@/app/components/kurse/audience-hero'
import { CourseFlow } from '@/app/components/kurse/course-flow'
import { CourseContent } from '@/app/components/kurse/course-content'
import { FaqAccordion } from '@/app/components/marketing/faq-accordion'
import { TargetedAudiencePicker } from '@/app/components/marketing/targeted-audience-picker'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return buildPageMetadata({
    title: distanceLearningPageModel.hero.title,
    description: distanceLearningPageModel.hero.description,
    path: '/distance-learning',
    locale,
  })
}

// Beide Optionen zeigen auf die jeweilige Intensivkurs-Sportferien-Detailseite. Die 2./3.-Sek-
// Zielseite hat mangels Schritt-10-Inhalt heute noch keinen realen Katalogeintrag und liefert bis
// dahin notFound() -- eine bekannte, akzeptierte Lücke, siehe Plan.
const pickerOptions = distanceLearningPageModel.eligibleAudiences.map((audience) => ({
  audience,
  href: `/kurse/${audience.slug}/intensivkurs-sportferien`,
}))

export default async function DistanceLearningPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <>
      <Section spacing="default">
        <AudienceHero content={distanceLearningPageModel.hero} />
      </Section>

      <Section spacing="sm" variant="muted">
        <CourseFlow steps={distanceLearningPageModel.flowSteps} />
      </Section>

      <Section spacing="sm">
        <TargetedAudiencePicker options={pickerOptions} />
      </Section>

      <Section spacing="sm" variant="muted">
        {distanceLearningPageModel.contentSections.map((section) => (
          <CourseContent key={section.id} sections={[section]} />
        ))}
      </Section>

      {distanceLearningPageModel.faq && distanceLearningPageModel.faq.length > 0 ? (
        <Section spacing="sm">
          <FaqAccordion items={distanceLearningPageModel.faq} />
        </Section>
      ) : null}
    </>
  )
}
