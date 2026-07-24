import { ChevronDown } from 'lucide-react'
import type { Ablauf } from '@/types/marketing'
import { cn } from '@/lib/utils'

interface SessionDetailsProps {
  ablauf: Ablauf
  label?: string
}

// Natives <details>/<summary> statt shadcn Collapsible -- bereits so entschieden (Abschnitt 1b):
// Collapsible ist für Fälle mit echtem gesteuertem Zustand reserviert, dieser Popover braucht
// keinen. Übernimmt das Markup-Muster aus dem gelieferten SessionTable.jsx-Prototyp.
function SessionDetails({ ablauf, label = 'Details' }: SessionDetailsProps) {
  return (
    <details className="group relative">
      <summary
        className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 whitespace-nowrap rounded border border-border px-3 py-2 font-mono text-[11.5px] text-muted-foreground marker:hidden hover:border-primary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring group-open:border-secondary group-open:bg-secondary/10 group-open:text-secondary-foreground"
      >
        {label}
        <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
      </summary>
      <div className="absolute top-[calc(100%+6px)] left-0 z-10 w-max min-w-[230px] rounded-md border border-border bg-card p-3 shadow-lg max-md:right-0 max-md:left-auto max-md:w-full">
        {ablauf.kind === 'simple' ? (
          <div className="space-y-1">
            {ablauf.items.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'flex justify-between gap-3.5 py-1 text-[12.5px] whitespace-nowrap text-foreground',
                  item.highlight && 'rounded-sm bg-secondary/15 px-1.5 font-semibold text-foreground'
                )}
              >
                <span>{item.label}</span>
                {item.value && <strong className="font-semibold">{item.value}</strong>}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {ablauf.phases.map((phase) => (
              <div key={phase.id}>
                <p className="font-mono text-[11px] font-semibold tracking-wide text-secondary-foreground uppercase">
                  {phase.label}
                </p>
                {phase.note ? (
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">{phase.note}</p>
                ) : null}
                <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
                  {phase.dates.map((date) => (
                    <span
                      key={date.id}
                      className={cn(
                        'text-[12px] whitespace-nowrap text-foreground',
                        date.highlight &&
                          'rounded-sm bg-secondary/15 px-1.5 font-semibold text-foreground'
                      )}
                    >
                      {date.date}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  )
}

export { SessionDetails }
