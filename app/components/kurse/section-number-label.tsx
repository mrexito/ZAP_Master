interface SectionNumberLabelProps {
  number: number
  label: string
}

// Numerierte Abschnitts-Eyebrow ("1 Kursaufbau", "2 Kursinhalt", ...) wie in den
// design-reference-Unterseiten -- rein visuelle Gliederung, keine Navigation.
function SectionNumberLabel({ number, label }: SectionNumberLabelProps) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-full border border-border font-mono text-sm text-muted-foreground">
        {number}
      </span>
      <span className="font-mono text-lg font-medium tracking-wide text-foreground uppercase">
        {label}
      </span>
    </div>
  )
}

export { SectionNumberLabel }
