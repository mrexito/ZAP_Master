import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { lerncoachingPageModel } from '@/types/marketing.fixtures'
import { buildPageMetadata } from '@/lib/seo'
import { Section } from '@/app/components/layout/section'
import { AudienceHero } from '@/app/components/kurse/audience-hero'
import { CourseFlow } from '@/app/components/kurse/course-flow'
import { CourseContent } from '@/app/components/kurse/course-content'
import { WhyUsGrid } from '@/app/components/kurse/why-us-grid'
import { FaqAccordion } from '@/app/components/marketing/faq-accordion'
import { Button } from '@/app/components/ui/button'
import { Link } from '@/i18n/navigation'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return buildPageMetadata({
    title: lerncoachingPageModel.hero.title,
    description: lerncoachingPageModel.hero.description,
    path: '/lerncoaching',
    locale,
  })
}

export default async function LerncoachingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <>
      <Section spacing="default">
        <AudienceHero content={lerncoachingPageModel.hero} />
      </Section>

      <Section spacing="sm" variant="muted">
        <CourseFlow steps={lerncoachingPageModel.flowSteps} />
      </Section>

      <Section spacing="sm">
        <WhyUsGrid features={lerncoachingPageModel.features} />
      </Section>

      <Section spacing="sm" variant="muted">
        {lerncoachingPageModel.contentSections.map((section) => (
          <CourseContent key={section.id} sections={[section]} />
        ))}
      </Section>

      {lerncoachingPageModel.faq && lerncoachingPageModel.faq.length > 0 ? (
        <Section spacing="sm">
          <FaqAccordion items={lerncoachingPageModel.faq} />
        </Section>
      ) : null}

      {lerncoachingPageModel.relatedActions && lerncoachingPageModel.relatedActions.length > 0 ? (
        <Section spacing="sm" variant="muted">
          <div className="flex flex-wrap gap-3">
            {lerncoachingPageModel.relatedActions.map((action) => (
              <Button key={action.href} asChild variant="outline">
                <Link href={action.href}>{action.label}</Link>
              </Button>
            ))}
          </div>
        </Section>
      ) : null}
    </>
  )
}
