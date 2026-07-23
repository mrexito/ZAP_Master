import { Link } from '@/i18n/navigation'

interface BreadcrumbItem {
  label: string
  /** Fehlt beim letzten Eintrag -- die aktuelle Seite ist kein Link. */
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

// Wie design-reference (.crumbs): mono, klein, gedämpft -- Links in Sekundärfarbe, aktuelle Seite
// im Fliesstext-Ton. Rein orientierend, ersetzt keine Navigation.
function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="mx-auto flex max-w-6xl flex-wrap gap-2 px-6 pt-5 font-mono text-xs text-muted-foreground">
      {items.map((item, index) => (
        <span key={item.label} className="flex items-center gap-2">
          {item.href ? (
            <Link href={item.href} className="font-semibold text-secondary hover:underline">
              {item.label}
            </Link>
          ) : (
            <span className="font-semibold text-foreground">{item.label}</span>
          )}
          {index < items.length - 1 ? <span className="text-border">/</span> : null}
        </span>
      ))}
    </nav>
  )
}

export { Breadcrumb }
