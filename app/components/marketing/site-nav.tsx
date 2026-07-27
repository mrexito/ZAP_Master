'use client'

import { useState } from 'react'
import NextLink from 'next/link'
import { LogIn, Menu } from 'lucide-react'
import type { SiteNavModel } from '@/types/marketing'
import { Link } from '@/i18n/navigation'
import { Button } from '@/app/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/app/components/ui/sheet'

interface SiteNavProps {
  model: SiteNavModel
}

// Genau einmal in app/[locale]/(marketing)/layout.tsx gerendert (Abschnitt 1b). Flache
// Direktlinks, kein Dropdown. /login bleibt bewusst unlokalisiert (next/link statt der
// i18n-Link-Variante) -- alle übrigen Ziele liegen innerhalb des lokalisierten Marketing-Baums
// und nutzen @/i18n/navigation. Der sichtbare EN-Platzhalter erhält erst mit einer vollständig
// aktivierten englischen Locale ein href.
function SiteNav({ model }: SiteNavProps) {
  const [open, setOpen] = useState(false)
  const contactItems = model.primaryItems.filter((item) => item.id === 'kontakt')
  const mainItems = model.primaryItems.filter((item) => item.id !== 'kontakt')

  return (
    <header className="sticky top-0 z-40 bg-primary">
      <nav
        aria-label="Hauptnavigation"
        className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4"
      >
        <Link href={model.home.href} className="font-serif text-xl font-semibold">
          {model.home.label === 'Startseite' ? (
            <>
              <span className="text-brand-on-dark">Lern</span>
              <em className="text-accent">ecke</em>
            </>
          ) : (
            model.home.label
          )}
        </Link>

        <ul className="hidden items-center gap-6 md:flex">
          {model.audiences.map((audience) => (
            <li key={audience.id}>
              <Link
                href={audience.href}
                className="text-sm font-medium text-primary-foreground/85 transition-colors hover:text-primary-foreground"
              >
                {audience.navLabel}
              </Link>
            </li>
          ))}
          {mainItems.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="text-sm font-medium text-primary-foreground/85 transition-colors hover:text-primary-foreground"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <ul aria-label="Service-Navigation" className="hidden items-center gap-4 md:flex">
          {model.localeSwitch?.map((item) => (
            <li key={item.locale}>
              {item.href ? (
                <NextLink
                  href={item.href}
                  className="text-sm font-medium text-primary-foreground/85 transition-colors hover:text-primary-foreground"
                >
                  {item.label}
                </NextLink>
              ) : (
                <span
                  aria-label="Englische Version in Vorbereitung"
                  title="Englische Version in Vorbereitung"
                  className="text-sm font-medium text-primary-foreground/85"
                >
                  {item.label}
                </span>
              )}
            </li>
          ))}
          {contactItems.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="text-sm font-medium text-primary-foreground/85 transition-colors hover:text-primary-foreground"
              >
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <Button
              asChild
              size="sm"
              className="min-h-[44px] rounded-md bg-accent px-5 font-semibold text-accent-foreground shadow-sm hover:bg-accent/90 hover:shadow-md focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
            >
              <NextLink href={model.login.href}>
                <LogIn aria-hidden="true" />
                {model.login.label}
              </NextLink>
            </Button>
          </li>
        </ul>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Menü öffnen"
              className="min-h-[44px] min-w-[44px] text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="brand-marketing">
            <SheetHeader>
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-1 px-4">
              {model.audiences.map((audience) => (
                <Link
                  key={audience.id}
                  href={audience.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-[44px] items-center text-base font-medium text-foreground"
                >
                  {audience.displayLabel}
                </Link>
              ))}
              {mainItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-[44px] items-center text-base font-medium text-foreground"
                >
                  {item.label}
                </Link>
              ))}
              <div className="mt-3 flex min-h-[44px] items-center gap-5 border-t border-border pt-3">
                {model.localeSwitch?.map((item) =>
                  item.href ? (
                    <NextLink
                      key={item.locale}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="text-base font-medium text-foreground"
                    >
                      {item.label}
                    </NextLink>
                  ) : (
                    <span
                      key={item.locale}
                      aria-label="Englische Version in Vorbereitung"
                      title="Englische Version in Vorbereitung"
                      className="text-base font-medium text-foreground"
                    >
                      {item.label}
                    </span>
                  )
                )}
                {contactItems.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="text-base font-medium text-foreground"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
              <Button asChild className="mt-1 min-h-[44px] w-full rounded-md font-semibold">
                <NextLink href={model.login.href} onClick={() => setOpen(false)}>
                  <LogIn aria-hidden="true" />
                  {model.login.label}
                </NextLink>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  )
}

export { SiteNav }
