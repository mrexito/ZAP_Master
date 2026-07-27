import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import type { CourseOffer } from '@/types/marketing'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardFooter } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { CategoryBadge } from '@/app/components/kurse/category-badge'
import { formatOfferPrice } from '@/lib/pricing'

interface CourseCardProps {
  offer: CourseOffer
  /** Position innerhalb der CourseCardGrid -- steuert die Kopf-Akzentfarbe (Abschnitt design-
   *  reference: .card-head.a/.b wechseln pro Karte, nicht pro Fach). */
  index?: number
}

// Farbfolge sekundär/akzent wie im design-reference-Markup (.card-head.a/.b bzw. .fit-tag/.cc-list
// li::before) -- feste Tailwind-Klassennamen, da die Klasse zur Build-Zeit im Quelltext stehen muss.
const CARD_HEAD_ACCENTS = ['from-secondary to-subject-de', 'from-accent/85 to-accent']
const CARD_TAG_ACCENTS = ['bg-subject-de-pale text-secondary', 'bg-subject-ma-pale text-subject-ma-foreground']
const CARD_DASH_ACCENTS = ['text-secondary', 'text-subject-ma-foreground']

async function CourseCard({ offer, index = 0 }: CourseCardProps) {
  const t = await getTranslations('kurse.courseCard')
  const price = formatOfferPrice({ ...offer, hasSessions: true })

  return (
    <Card className="flex h-full flex-col gap-0 overflow-hidden p-0">
      <div
        className={cn(
          'relative overflow-hidden bg-gradient-to-br px-6 py-7',
          CARD_HEAD_ACCENTS[index % CARD_HEAD_ACCENTS.length]
        )}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(115deg, rgba(255,255,255,.08) 0 2px, transparent 2px 26px)',
          }}
        />
        <h3 className="relative font-serif text-2xl font-semibold text-white">{offer.displayName}</h3>
      </div>
      <CardContent className="flex flex-1 flex-col gap-4 pt-6">
        {offer.tagline ? (
          <Badge
            variant="outline"
            className={cn('self-start border-transparent', CARD_TAG_ACCENTS[index % CARD_TAG_ACCENTS.length])}
          >
            {offer.tagline}
          </Badge>
        ) : null}
        {offer.categoryLabel ? (
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge label={offer.categoryLabel} subject={offer.subject} />
          </div>
        ) : null}
        {offer.dateSummary.length > 0 ? (
          <p className="text-sm font-medium text-foreground">{offer.dateSummary.join(' · ')}</p>
        ) : null}
        <p className="text-sm text-muted-foreground">{offer.description}</p>
        {offer.features.length > 0 ? (
          <ul className="mt-auto space-y-1.5">
            {offer.features.map((feature) => (
              <li
                key={feature}
                className="flex gap-2 border-t border-border pt-1.5 text-sm text-foreground first:border-t-0 first:pt-0"
              >
                <span aria-hidden="true" className={CARD_DASH_ACCENTS[index % CARD_DASH_ACCENTS.length]}>
                  —
                </span>
                {feature}
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
      <CardFooter className="flex items-end justify-between gap-3 border-t pt-6 pb-6">
        <div>
          <p className="flex items-baseline gap-1.5">
            <span className="font-serif text-xl font-semibold text-foreground">{price.value}</span>
          </p>
          {price.note ? <p className="text-xs text-muted-foreground">{price.note}</p> : null}
        </div>
        <Button asChild>
          <Link href={offer.href}>{t('termineAnsehen')}</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

export { CourseCard }
