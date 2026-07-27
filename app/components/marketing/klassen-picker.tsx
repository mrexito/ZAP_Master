import { Fragment } from 'react'
import type { Audience } from '@/types/marketing'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

interface KlassenPickerProps {
  audiences: Audience[]
}

const categoryLabels: Record<'primar' | 'sek', string> = {
  primar: 'Primarschule',
  sek: 'Sekundarschule',
}

const trackLabels: Record<'primar' | 'sek', string> = {
  primar: 'Langzeitgymnasium',
  sek: 'Kurzzeitgymnasium',
}

// Farbcodierung 1:1 aus design-reference/Startseite.html (.picker-group-head/-foot.primar =
// sage-onDark + Ink-Text, .sek = akzentuiertes Gold + dessen bereits app-weit etabliertes,
// kontrastgeprüftes Text-Pendant) -- keine neuen, unabgestimmten Einzelfarben pro Komponente.
const groupStyles: Record<'primar' | 'sek', { band: string; tileBorder: string; tileHover: string; gridCols: string }> = {
  primar: {
    band: 'bg-brand-on-dark text-foreground',
    tileBorder: 'border-secondary',
    tileHover: 'hover:bg-subject-de-pale hover:text-subject-de-foreground',
    gridCols: 'grid-cols-3',
  },
  sek: {
    band: 'bg-accent text-accent-foreground',
    tileBorder: 'border-accent',
    tileHover: 'hover:bg-subject-ma-pale hover:text-subject-ma-foreground',
    gridCols: 'grid-cols-2',
  },
}

// Nur Startseite (Hero), 5er-Grid der schulischen Zielgruppen -- filtert placements.includes
// ("heroPicker") aus derselben Audience[]-Quelle wie SiteNav, keine zweite Datenquelle. Die zwei
// sichtbaren Gruppen (Primarschule/Sekundarschule) leiten sich aus dem bestehenden
// kategorie-Feld ab, statt eine eigene Gruppierungsliste zu pflegen.
function KlassenPicker({ audiences }: KlassenPickerProps) {
  const heroAudiences = audiences.filter((audience) => audience.placements.includes('heroPicker'))
  // BMS/Matura sind keine Klassenstufen und stehen deshalb nicht im Picker-Grid selbst, sondern
  // als Hinweiszeile darunter -- dieselbe Audience[]-Quelle wie SiteNav/ServiceCard (Abschnitt 2.1).
  // In der Vorlage (Startseite.html) liegt .picker-alt ausserhalb der weissen Picker-Kachel, nicht
  // darin -- deshalb hier als eigenes Geschwister-Element unterhalb der Karte, nicht innerhalb.
  const alternativeAudiences = audiences.filter((audience) => audience.placements.includes('serviceGrid'))
  const groups: ('primar' | 'sek')[] = ['primar', 'sek']

  return (
    <Fragment>
      <div className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6 shadow-sm">
        <p className="text-center font-serif text-lg font-semibold text-foreground">
          In welcher Klasse ist Ihr Kind aktuell?
        </p>
        <div className="grid gap-4 md:grid-cols-[3fr_2fr] md:items-start">
          {groups.map((kategorie) => {
            const items = heroAudiences.filter((audience) => audience.kategorie === kategorie)
            if (items.length === 0) return null
            const styles = groupStyles[kategorie]

            return (
              <div key={kategorie} className="flex flex-col overflow-hidden rounded-lg border border-border">
                <p
                  className={cn(
                    'px-3.5 py-2 text-center font-mono text-[11px] font-semibold tracking-wide uppercase',
                    styles.band,
                  )}
                >
                  {categoryLabels[kategorie]}
                </p>
                <div className={cn('grid gap-2.5 p-3.5', styles.gridCols)}>
                  {items.map((audience) => (
                    <Link
                      key={audience.id}
                      href={audience.href}
                      className={cn(
                        'flex min-h-[44px] items-center justify-center rounded-lg border bg-background px-2 py-3 text-center text-sm font-semibold text-foreground transition-colors',
                        styles.tileBorder,
                        styles.tileHover,
                      )}
                    >
                      {audience.displayLabel}
                    </Link>
                  ))}
                </div>
                <p
                  className={cn(
                    'px-3.5 py-2 text-center font-mono text-[10.5px] font-semibold tracking-wide uppercase',
                    styles.band,
                  )}
                >
                  {trackLabels[kategorie]}
                </p>
              </div>
            )
          })}
        </div>
      </div>
      {alternativeAudiences.length > 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Bereits in der Lehre oder am Gymnasium? Zur{' '}
          {alternativeAudiences.map((audience, index) => (
            <span key={audience.id}>
              <Link
                href={audience.href}
                className="font-semibold text-foreground underline underline-offset-2 hover:text-primary"
              >
                {audience.displayLabel}
              </Link>
              {index < alternativeAudiences.length - 1 ? ' oder ' : '.'}
            </span>
          ))}
        </p>
      ) : null}
    </Fragment>
  )
}

export { KlassenPicker }
