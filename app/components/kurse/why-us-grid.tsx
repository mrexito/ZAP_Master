import type { Feature } from '@/types/marketing'
import { cn } from '@/lib/utils'
import { ResponsiveGrid } from '@/app/components/layout/responsive-grid'
import { SectionHeading } from '@/app/components/layout/section-heading'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'

interface WhyUsGridProps {
  features: Feature[]
}

// Farbfolge sekundär/akzent/rust/steel wie im design-reference-Markup (.feature.sage/gold/rust/
// blue) -- feste Tailwind-Klassennamen, da die Klasse zur Build-Zeit im Quelltext stehen muss.
const FEATURE_ACCENTS = ['border-t-secondary', 'border-t-accent', 'border-t-rust', 'border-t-steel']

// "4 Gründe, die zählen" -- Überschrift ist auf allen Kursdetailseiten identisch (design-reference),
// keine offer-spezifischen Daten. ContentCard-basierte Kacheln, keine eigene Card-Implementierung.
function WhyUsGrid({ features }: WhyUsGridProps) {
  return (
    <div className="flex flex-col gap-8">
      <SectionHeading
        eyebrow="Was uns auszeichnet"
        title="4 Gründe, die zählen"
        description="Worauf es bei der Kurswahl wirklich ankommt."
        align="center"
        className="mx-auto"
      />
      <ResponsiveGrid columns={{ base: 1, md: 2 }}>
        {features.map((feature, index) => (
          <Card key={feature.id} className={cn('border-t-4', FEATURE_ACCENTS[index % FEATURE_ACCENTS.length])}>
            <CardHeader>
              <CardTitle className="font-serif text-base">{feature.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </CardContent>
          </Card>
        ))}
      </ResponsiveGrid>
    </div>
  )
}

export { WhyUsGrid }
