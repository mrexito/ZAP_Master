import { Link } from '@/i18n/navigation'
import type { ExamSimulationOffer, SelfStudyOffer } from '@/types/marketing'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardFooter } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { ResponsiveGrid } from '@/app/components/layout/responsive-grid'
import { formatOfferPrice } from '@/lib/pricing'

interface AddOnCoursesProps {
  offers: (ExamSimulationOffer | SelfStudyOffer)[]
}

const ADD_ON_STYLES = {
  pruefungssimulation: {
    header: 'from-steel to-tertiary',
    tag: 'bg-tertiary-pale text-tertiary',
  },
  selbststudium: {
    header: 'from-rust to-subject-fr',
    tag: 'bg-subject-fr-pale text-rust',
  },
} as const

// Rendert nichts bei leerer Liste -- der Mapper liefert AddOnOffers nur für Zielgruppen mit
// passender Capability (Abschnitt 2.5), keine Sonderfall-Logik hier im Component.
function AddOnCourses({ offers }: AddOnCoursesProps) {
  if (offers.length === 0) return null

  return (
    <ResponsiveGrid columns={{ base: 1, md: 2 }} gap="sm">
      {offers.map((offer) => {
        const price = formatOfferPrice({ ...offer, hasSessions: offer.kurstyp === 'pruefungssimulation' })
        const styles = ADD_ON_STYLES[offer.kurstyp]

        return (
          <Card
            key={offer.id}
            data-offer-kind={offer.kurstyp}
            className="flex h-full flex-col gap-0 overflow-hidden p-0"
          >
            <div
              className={cn(
                'relative overflow-hidden bg-gradient-to-br px-6 py-7',
                styles.header
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
              <h3 className="relative font-serif text-2xl font-semibold text-white">
                {offer.displayName}
              </h3>
            </div>
            <CardContent className="flex flex-1 flex-col gap-4 pt-6">
              <Badge
                variant="outline"
                className={cn('self-start border-transparent', styles.tag)}
              >
                {offer.tagline}
              </Badge>
              <p className="text-sm text-muted-foreground">{offer.description}</p>
            </CardContent>
            <CardFooter className="flex items-end justify-between gap-3 border-t pt-6 pb-6">
              <div>
                <p className="font-serif text-xl font-semibold text-foreground">{price.value}</p>
                {price.note ? <p className="text-xs text-muted-foreground">{price.note}</p> : null}
              </div>
              <Button asChild>
                <Link href={offer.href}>Mehr erfahren</Link>
              </Button>
            </CardFooter>
          </Card>
        )
      })}
    </ResponsiveGrid>
  )
}

export { AddOnCourses }
