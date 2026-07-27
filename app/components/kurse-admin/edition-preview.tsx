// Schritt 10a: "Live-Vorschau Kachel" aus der Admin-Referenz -- rein präsentational, keine eigene
// Datenquelle. Liest bevorzugt die ungespeicherten Formularwerte (liveValues), damit Preis-/
// Titeländerungen sofort sichtbar sind, genau wie im Mockup-JS.

import type { OfferEditionFormInput } from '@/types/kurs-edition'
import type { AdminOfferCatalogEntry } from '@/lib/kurse/offer-admin-catalog'

function formatChf(amount: number): string {
  return `CHF ${amount.toLocaleString('de-CH')}`
}

export function EditionPreview({
  catalogEntry,
  liveValues,
  activeSessionCount,
}: {
  catalogEntry: AdminOfferCatalogEntry
  liveValues: OfferEditionFormInput | null
  activeSessionCount: number
}) {
  const title = liveValues?.publicTitle || catalogEntry.label
  const tagline = liveValues?.tagline || ''
  const regularPrice = liveValues?.regularPriceChf ?? 0

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_14px_36px_rgba(22,35,63,.08)]">
      <div className="bg-gradient-to-br from-[#16233F] to-[#26395E] p-5 text-white">
        <small className="font-mono text-[10px] uppercase tracking-wide opacity-80">Live-Vorschau Kachel</small>
        <h3 className="mt-1.5 font-serif-marketing text-[25px]">{title}</h3>
        {tagline && <p className="text-xs opacity-85 mt-2">{tagline}</p>}
      </div>
      <div className="p-4 space-y-2 text-sm">
        <div className="flex justify-between border-b border-border pb-2">
          <span className="text-muted-foreground">Aktuelle Auswahl</span>
          <strong>{catalogEntry.label}</strong>
        </div>
        <div className="flex justify-between border-b border-border pb-2">
          <span className="text-muted-foreground">Schuljahr</span>
          <strong>{liveValues?.schoolYear || '–'}</strong>
        </div>
        <div className="flex justify-between border-b border-border pb-2">
          <span className="text-muted-foreground">Termine</span>
          <strong>{activeSessionCount} buchbar</strong>
        </div>
        <div className="flex justify-between border-b border-border pb-2">
          <span className="text-muted-foreground">Preis</span>
          <strong className="font-serif-marketing text-2xl font-semibold text-secondary">{formatChf(regularPrice)}</strong>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Frühbucherrabatt</span>
          <strong>10% ab 6 Wochen vor Kursstart</strong>
        </div>
      </div>
    </section>
  )
}
