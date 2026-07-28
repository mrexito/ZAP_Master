import type { FlowStep } from '@/types/marketing'
import { cn } from '@/lib/utils'

interface CourseFlowProps {
  steps: FlowStep[]
}

// Dieselben Kopf-Farbverläufe wie bei den Hauptseiten-Cards (CourseCard/AddOnCourses) --
// feste Tailwind-Klassennamen, da die Klasse zur Build-Zeit im Quelltext stehen muss.
const FLOW_STEP_HEADER_ACCENTS = [
  'from-secondary to-subject-de',
  'from-accent/85 to-accent',
  'from-steel to-tertiary',
  'from-rust to-subject-fr',
]

// Spaltenzahl richtet sich nach der Anzahl Schritte; feste Klassennamen aus demselben Grund wie oben.
const FLOW_GRID_COLS: Record<number, string> = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
}

// Pfeile zwischen den Schritten sind rein visuell, keine Navigation (Abschnitt 3).
function CourseFlow({ steps }: CourseFlowProps) {
  return (
    <ol
      className={cn(
        'grid gap-px overflow-hidden rounded-xl border border-border bg-border',
        FLOW_GRID_COLS[steps.length] ?? 'md:grid-cols-3'
      )}
    >
      {steps.map((step, index) => (
        <li key={step.id} className="relative flex flex-col bg-card">
          <div
            className={cn(
              'relative overflow-hidden bg-gradient-to-br px-6 py-4',
              FLOW_STEP_HEADER_ACCENTS[index % FLOW_STEP_HEADER_ACCENTS.length]
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
            <span className="relative block font-mono text-xs font-semibold tracking-wide text-white/90 uppercase">
              Schritt {index + 1}
            </span>
            <h3 className="relative font-serif text-lg font-semibold text-white">{step.title}</h3>
          </div>
          <p className="p-6 text-sm text-muted-foreground">{step.body}</p>
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
