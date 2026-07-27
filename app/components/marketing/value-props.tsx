import type { Feature } from '@/types/marketing'
import { cn } from '@/lib/utils'
import { ResponsiveGrid } from '@/app/components/layout/responsive-grid'
import { SectionHeading } from '@/app/components/layout/section-heading'

interface ValuePropsProps {
  title: string
  values: Feature[]
}

// Farbfolge 1:1 aus design-reference/Startseite.html (.value-card:nth-child border-top-color:
// sage-deep/ink/gold/sage-deep) -- bewusst NICHT die volle Card-Behandlung von WhyUsGrid
// ("4 Gründe, die zählen" auf den Kursdetailseiten): Die Startseite verwendet dafür laut Vorlage
// nur eine schlichte farbige Oberkante ohne Rahmen/Hintergrund/Schatten, kein zweites
// Card-Markup mit identischem Aussehen wie WhyUsGrid.
const VALUE_ACCENTS = ['border-t-secondary', 'border-t-foreground', 'border-t-accent', 'border-t-secondary']

// Nur Startseite ("Unsere Leistungen") -- flaches 4er-Grid mit farbiger Oberkante je Kachel,
// kollabiert auf 2 bzw. 1 Spalte wie im Original.
function ValueProps({ title, values }: ValuePropsProps) {
  return (
    <div className="flex flex-col gap-8">
      <SectionHeading title={title} align="center" className="mx-auto" />
      <ResponsiveGrid columns={{ base: 1, md: 2, lg: 4 }}>
        {values.map((value, index) => (
          <div
            key={value.id}
            className={cn('flex flex-col gap-2 border-t-2 pt-5', VALUE_ACCENTS[index % VALUE_ACCENTS.length])}
          >
            <h3 className="font-serif text-xl font-semibold text-foreground">{value.title}</h3>
            <p className="text-sm text-muted-foreground">{value.description}</p>
          </div>
        ))}
      </ResponsiveGrid>
    </div>
  )
}

export { ValueProps }
