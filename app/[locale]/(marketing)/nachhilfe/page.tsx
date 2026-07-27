import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { nachhilfePageModel } from '@/types/marketing.fixtures'
import { buildPageMetadata } from '@/lib/seo'
import { Section } from '@/app/components/layout/section'
import { AudienceHero } from '@/app/components/kurse/audience-hero'
import { ResponsiveGrid } from '@/app/components/layout/responsive-grid'
import { SubscriptionCard } from '@/app/components/marketing/subscription-card'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return buildPageMetadata({
    title: nachhilfePageModel.hero.title,
    description: nachhilfePageModel.hero.description,
    path: '/nachhilfe',
    locale,
  })
}

export default async function NachhilfePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <>
      <Section spacing="default">
        <AudienceHero content={nachhilfePageModel.hero} />
      </Section>

      <Section spacing="sm" variant="muted">
        <ResponsiveGrid columns={{ base: 1, md: 2 }}>
          {nachhilfePageModel.plans.map((plan) => (
            <SubscriptionCard key={plan.id} plan={plan} />
          ))}
        </ResponsiveGrid>
      </Section>
    </>
  )
}
