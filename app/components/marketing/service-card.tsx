import type { Audience, ServiceCardModel } from '@/types/marketing'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'

interface ServiceCardProps {
  service: ServiceCardModel
  /** Nur zur Auflösung von navLabel-Texten für den eligibleFor-Hinweis -- keine zweite
   *  Zielgruppenliste, derselbe Audience[]-Datensatz wie SiteNav/KlassenPicker. */
  audiences?: Audience[]
  /** Entspricht der ServiceSubgroupModel.id der umgebenden Gruppe -- steuert 1:1 die
   *  Rahmenfarbe aus design-reference/Startseite.html (.service-card.core/.examprep/.tertiary):
   *  core=Lerncoaching/Nachhilfe (sage-deep), examprep=Distance Learning/Simulationsprüfung
   *  (Gold), tertiary=BMS/Matura (Azure). Unbekannte/fehlende Gruppen fallen auf den neutralen
   *  Standardrahmen zurück, statt eine falsche Farbe zu erraten. */
  variant?: string
}

const VARIANT_BORDER: Record<string, string> = {
  core: 'border-secondary',
  examprep: 'border-accent',
  tertiary: 'border-tertiary',
}

// Ganze Karte klickbar über service.action; eligibleFor rendert einen Hinweis nur, wenn er nicht
// bereits alle sieben Zielgruppen abdeckt (allgemeine Regel, nicht auf eine Karte hartcodiert).
function ServiceCard({ service, audiences = [], variant }: ServiceCardProps) {
  const eligibleLabels =
    service.eligibleFor && service.eligibleFor.length < 7
      ? service.eligibleFor
          .map((id) => audiences.find((audience) => audience.id === id)?.navLabel)
          .filter((label): label is string => Boolean(label))
      : []

  const borderClass = variant ? VARIANT_BORDER[variant] : undefined

  return (
    <Link href={service.action.href} aria-label={service.action.ariaLabel} className="block h-full">
      <Card
        className={cn(
          // gap-2 statt der Card-Standardvorgabe gap-6 -- Vorlage hat nur .service-card h3
          // {margin-bottom:8px} zwischen Titel und Text, keinen grossen Zwischenraum.
          'h-full gap-2 transition-colors hover:shadow-md',
          borderClass ?? 'hover:border-primary',
        )}
      >
        <CardHeader>
          <CardTitle className="font-serif text-lg">{service.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">{service.description}</p>
          {eligibleLabels.length > 0 ? (
            <p className="font-mono text-xs text-secondary-foreground">
              Verfügbar für {eligibleLabels.join(' & ')}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  )
}

export { ServiceCard }
