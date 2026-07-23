import type { CourseOffer } from '@/types/marketing'
import { formatOfferPrice } from '@/lib/pricing'

interface OverviewPriceBoxProps {
  offer: CourseOffer
}

// "Überblick & Preis" (Abschnitt 3 des Architektur-Briefings): offer.overviewBullets neben dem
// über formatOfferPrice berechneten Preis -- dieselbe Preislogik wie CourseHero/CourseCard, damit
// hier kein zweiter, unabhängiger Preiswert entstehen kann (Abschnitt 2.3).
function OverviewPriceBox({ offer }: OverviewPriceBoxProps) {
  const price = formatOfferPrice(offer)

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6 md:flex-row md:items-center md:justify-between">
      <ul className="space-y-1.5">
        {offer.overviewBullets.map((bullet) => (
          <li key={bullet} className="text-sm text-muted-foreground">
            — {bullet}
          </li>
        ))}
      </ul>
      <div className="shrink-0 text-left md:text-right">
        <p className="font-serif text-2xl font-semibold text-foreground">{price.value}</p>
        {price.note ? <p className="text-sm text-muted-foreground">{price.note}</p> : null}
      </div>
    </div>
  )
}

export { OverviewPriceBox }
