// Schritt 10a: spiegelt exakt die serverseitige Prüfung in publishEditionAction() -- damit die
// Anzeige nie etwas als "bereit" markiert, was der Server ablehnen würde.

import { Check, TriangleAlert } from 'lucide-react'
import type { OfferEditionFormInput } from '@/types/kurs-edition'
import type { Kurstyp } from '@/types/marketing'

function ChecklistItem({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 items-start py-2 text-sm">
      <span
        className={`w-5 h-5 rounded-full grid place-items-center shrink-0 text-xs font-bold ${
          ok ? 'bg-secondary/20 text-secondary-foreground' : 'bg-accent/20 text-accent-foreground'
        }`}
      >
        {ok ? <Check className="h-3 w-3" /> : <TriangleAlert className="h-3 w-3" />}
      </span>
      <span className={ok ? 'text-foreground' : 'text-muted-foreground'}>{children}</span>
    </div>
  )
}

export function PublicationChecklist({
  liveValues,
  kurstyp,
  activeSessionCount,
  isPublished,
}: {
  liveValues: OfferEditionFormInput | null
  kurstyp: Kurstyp
  activeSessionCount: number
  isPublished: boolean
}) {
  const requiredFieldsOk = Boolean(
    liveValues?.publicTitle && liveValues?.tagline && liveValues?.description && liveValues?.schoolYear
  )
  const priceOk = (liveValues?.regularPriceChf ?? 0) > 0
  const needsSession = kurstyp !== 'selbststudium'
  const sessionOk = !needsSession || activeSessionCount > 0

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-[0_14px_36px_rgba(22,35,63,.08)]">
      <h3 className="mb-1 font-serif-marketing text-lg font-semibold text-foreground">Bereit zur Veröffentlichung</h3>
      <ChecklistItem ok={requiredFieldsOk}>Pflichtfelder vollständig</ChecklistItem>
      <ChecklistItem ok={priceOk}>Preis und Währung gesetzt</ChecklistItem>
      {needsSession && <ChecklistItem ok={sessionOk}>Mindestens ein buchbarer Termin</ChecklistItem>}
      <ChecklistItem ok={isPublished}>{isPublished ? 'Bereits veröffentlicht' : 'Öffentliche Vorschau noch prüfen'}</ChecklistItem>
    </section>
  )
}
