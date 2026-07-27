import type { SiteFooterModel } from '@/types/marketing'
import { Link } from '@/i18n/navigation'
import { PageContainer } from '@/app/components/layout/page-container'

interface SiteFooterProps {
  model: SiteFooterModel
}

// Genau einmal in app/[locale]/(marketing)/layout.tsx gerendert, nach {children} (Abschnitt 1b).
// Nur reale, durch Linktests geprüfte Ziele -- kein Footer-Markup in einzelnen Pages. Dunkles,
// vollflächiges Band über die projekteigenen Marken-Tokens (bg-primary/text-primary-foreground,
// Abschnitt 1) statt einer neuen, unabhängigen Farbe -- die Farbpalette ist laut Architektur-
// Briefing ein festes System, das nicht pro Komponente neu definiert wird.
function SiteFooter({ model }: SiteFooterProps) {
  return (
    <footer className="bg-primary text-primary-foreground">
      <PageContainer className="flex flex-col gap-10 py-12 md:flex-row md:justify-between">
        <Link href="/" className="font-serif text-xl font-semibold text-primary-foreground">
          {model.brand}
        </Link>

        <div className="flex flex-col gap-8 sm:flex-row sm:gap-16">
          <ul className="flex flex-col gap-3">
            {model.navigation.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="text-sm font-medium text-primary-foreground/80 transition-colors hover:text-primary-foreground"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <ul className="flex flex-col gap-3">
            {model.legal.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm font-medium text-primary-foreground/80 transition-colors hover:text-primary-foreground"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </PageContainer>
    </footer>
  )
}

export { SiteFooter }
