import { cn } from '@/lib/utils'

// Seitenweites Rhythmus-Element (.rhythm im design-reference-Markup, Layout_4_Klasse_Hauptseite.html)
// -- zeigt den Fach-Rhythmus einmal oberhalb der ganzen Kartenliste statt je Karte (ersetzt den
// früheren Mini-Split pro Karte für 4./5. Klasse). Auf ausdrücklichen Wunsch ohne die farbigen
// Punkte (.dot) der Referenz -- nur die Pill-Badges und "+"-Trenner.
const SEGMENTS = [
  { label: 'Deutsch', style: 'text-secondary' },
  { label: 'Mathematik', style: 'text-subject-ma-foreground' },
  { label: 'Coaching & Spiele', style: 'text-muted-foreground' },
] as const

function SubjectRhythm() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-wrap items-center justify-center gap-2 font-mono text-[11.5px] tracking-wide"
    >
      {SEGMENTS.map((segment, index) => (
        <span key={segment.label} className="contents">
          {index > 0 ? <span className="text-border">+</span> : null}
          <span
            className={cn(
              'inline-flex items-center rounded-full border border-border bg-card px-3 py-1.5',
              segment.style
            )}
          >
            {segment.label}
          </span>
        </span>
      ))}
    </div>
  )
}

export { SubjectRhythm }
