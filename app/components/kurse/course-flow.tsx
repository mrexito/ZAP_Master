import type { FlowStep } from '@/types/marketing'
import { cn } from '@/lib/utils'

interface CourseFlowProps {
  steps: FlowStep[]
}

// Farbfolge sekundär/primär/akzent wie im design-reference-Markup (.phase:nth-child(1/2/3)) --
// feste Tailwind-Klassennamen, da die Klasse zur Build-Zeit im Quelltext stehen muss.
const FLOW_STEP_ACCENTS = ['border-t-secondary', 'border-t-primary', 'border-t-accent']

// Pfeile zwischen den Schritten sind rein visuell, keine Navigation (Abschnitt 3).
function CourseFlow({ steps }: CourseFlowProps) {
  return (
    <ol className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
      {steps.map((step, index) => (
        <li
          key={step.id}
          className={cn(
            'relative flex flex-col gap-2 border-t-4 bg-card p-6',
            FLOW_STEP_ACCENTS[index % FLOW_STEP_ACCENTS.length]
          )}
        >
          <span className="font-mono text-xs font-semibold tracking-wide text-secondary-foreground uppercase">
            Schritt {index + 1}
          </span>
          <h3 className="font-serif text-lg font-semibold text-foreground">{step.title}</h3>
          <p className="text-sm text-muted-foreground">{step.body}</p>
          {index < steps.length - 1 ? (
            <span
              aria-hidden="true"
              className={cn(
                'absolute top-1/2 z-10 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-sm text-secondary-foreground md:flex',
                '-right-3'
              )}
            >
              →
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  )
}

export { CourseFlow }
