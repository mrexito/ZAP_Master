import type { Metadata } from "next"
import { setRequestLocale } from "next-intl/server"
import { homePageModel } from "@/app/data/marketing-site"
import { buildPageMetadata } from "@/lib/seo"
import { Link } from "@/i18n/navigation"
import { PageContainer } from "@/app/components/layout/page-container"
import { Section } from "@/app/components/layout/section"
import { SectionHeading } from "@/app/components/layout/section-heading"
import { Button } from "@/app/components/ui/button"
import { KlassenPicker } from "@/app/components/marketing/klassen-picker"
import { ServiceSubgroup } from "@/app/components/marketing/service-subgroup"
import { FeaturedTestimonial } from "@/app/components/marketing/featured-testimonial"
import { ValueProps } from "@/app/components/marketing/value-props"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return buildPageMetadata({
    // hero.title/description enthalten \n fuer den Zeilenumbruch im h1/Lede (siehe
    // whitespace-pre-line unten) -- fuer <title>/meta description auf eine Zeile normalisiert.
    title: homePageModel.hero.title.replaceAll('\n', ' '),
    description: homePageModel.hero.description.replaceAll('\n', ' '),
    path: '',
    locale,
  })
}

export default async function MarketingHomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <>
      <Section spacing="default">
        <PageContainer>
          <div className="flex flex-col items-center gap-8 text-center">
            <div className="flex flex-col items-center gap-3">
              {/* design-reference/Startseite.html: .eyebrow ist reiner Text ohne Hintergrund
                  (color:var(--sage-deep)), keine gefüllte Badge/Pille. text-secondary (=
                  sage-deep) direkt auf dem Seitenhintergrund erreicht bereits ausreichenden
                  Kontrast (~6:1 auf --background), anders als das frühere weisse
                  text-secondary-foreground auf demselben Hintergrund (1.08:1) -- eine gefüllte
                  Badge war dafür nie nötig. */}
              <p className="font-mono text-xs tracking-wide text-secondary uppercase">
                {homePageModel.hero.eyebrow}
              </p>
              <h1 className="font-serif text-3xl font-semibold whitespace-pre-line text-foreground md:text-4xl">
                {homePageModel.hero.title}
              </h1>
              <p className="mx-auto max-w-2xl whitespace-pre-line text-muted-foreground">
                {homePageModel.hero.description}
              </p>
            </div>
            <div className="w-full max-w-3xl text-left">
              <KlassenPicker audiences={homePageModel.audiences} />
            </div>
          </div>
        </PageContainer>
      </Section>

      {/* bg-ink-pale statt variant="muted" -- eigener, kühlerer Farbton, damit sich diese
          Sektion von "Ergänzend zu unseren Kursen" darunter (bg-muted, wärmeres Grau)
          unterscheidet, statt beide optisch zu einem Block verschmelzen zu lassen. */}
      <Section spacing="sm" className="bg-ink-pale/50">
        <PageContainer>
          <ValueProps title="Unsere Leistungen" values={homePageModel.values} />
        </PageContainer>
      </Section>

      <Section spacing="sm" variant="muted">
        <PageContainer>
          <div className="flex flex-col gap-10">
            <SectionHeading title={homePageModel.servicesTitle} align="center" className="mx-auto" />
            {homePageModel.serviceGroups.map((group) => (
              <ServiceSubgroup key={group.id} group={group} audiences={homePageModel.audiences} />
            ))}
          </div>
        </PageContainer>
      </Section>

      <Section spacing="sm">
        <PageContainer>
          <FeaturedTestimonial testimonial={homePageModel.featuredTestimonial} />
        </PageContainer>
      </Section>

      {/* Bewusst kompakter als zuvor (spacing="sm", kleinere Typografie) und bg-secondary statt
          bg-primary -- sonst wäre der Block farblich nicht vom direkt darunterliegenden
          SiteFooter (ebenfalls bg-primary) zu unterscheiden. */}
      <Section spacing="sm" className="bg-secondary text-secondary-foreground">
        <PageContainer>
          <div className="flex flex-col items-center gap-3 text-center">
            <h2 className="font-serif text-xl font-medium md:text-2xl">
              {homePageModel.finalCta.title}
            </h2>
            <p className="max-w-md text-sm text-secondary-foreground/85">
              {homePageModel.finalCta.description}
            </p>
            <Button
              asChild
              className="bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <Link href={homePageModel.finalCta.action.href}>{homePageModel.finalCta.action.label}</Link>
            </Button>
          </div>
        </PageContainer>
      </Section>
    </>
  )
}
