import type { Audience, CourseOffer, ExamSimulationOffer } from '@/types/marketing'
import { PageIntro } from '@/app/components/layout/page-intro'
import { StatusBadge } from '@/app/components/kurse/status-badge'
import { formatOfferPrice } from '@/lib/pricing'
import { SHOW_PRICE_PREVIEW_BADGE } from '@/lib/kurse/pricing-status'

interface CourseHeroProps {
  // ExamSimulationOffer teilt alle hier gelesenen Felder mit CourseOffer (Schritt 11) --
  // SelfStudyOffer bewusst ausgeschlossen (kein booking-Preis in derselben Form).
  offer: CourseOffer | ExamSimulationOffer
  audience: Audience
}

// Titel "{Kurstyp} {Zielgruppe} — {Fächer}" wie im design-reference-Markup (z.B.
// Layout_6_Klasse_Halbjahreskurs_Unterseite.html: "Halbjahreskurs 6. Klasse — Deutsch &
// Mathematik") -- nur für reguläre Kursangebote (halbjahreskurs/intensivkurs); Prüfungssimulation
// zeigt in jeder Referenz nur das einfache "Prüfungssimulation" als H1.
// Zielgruppen-Kurzform: volle displayLabel für die fünf Gymiprüfungsstufen ("6. Klasse", "2./3.
// Sek" -- deckt sich dort exakt mit der Referenz), aber die kompaktere navLabel für BMS/Matura, da
// die Referenz dort "BMS"/"Matura" statt des längeren displayLabel
// ("BMS-Aufnahmeprüfung"/"Maturaprüfung") zeigt.
function buildPageTitle(offer: CourseOffer, audience: Audience): string {
  const audienceLabel = audience.kind === 'gymipruefung' ? audience.displayLabel : audience.navLabel
  return offer.categoryLabel ? `${offer.displayName} ${audienceLabel} — ${offer.categoryLabel}` : `${offer.displayName} ${audienceLabel}`
}

function CourseHero({ offer, audience }: CourseHeroProps) {
  const isExamSimulation = offer.kurstyp === 'pruefungssimulation'
  const price = formatOfferPrice(offer)

  return (
    <div className="flex flex-col gap-4">
      <PageIntro
        eyebrow={isExamSimulation && !offer.recommended ? offer.categoryLabel : undefined}
        title={isExamSimulation ? offer.displayName : buildPageTitle(offer, audience)}
        description={offer.lede}
      />
      {/* Preis, "empfohlen" und "Vorschau" nur für Prüfungssimulation -- die hat kein Abschnitt-3-
          "Überblick & Preis" (page.tsx gated auf kurstyp !== 'pruefungssimulation'), Halbjahreskurs/
          Intensivkurs zeigen diese Informationen bereits dort, keine Dopplung im Hero. */}
      {isExamSimulation ? (
        <div className="flex flex-wrap items-center gap-3">
          {offer.recommended ? <StatusBadge status="empfohlen" /> : null}
          {SHOW_PRICE_PREVIEW_BADGE ? <StatusBadge status="vorschau" /> : null}
          <p className="font-serif text-2xl font-semibold text-foreground">{price.value}</p>
          {price.note ? <p className="text-sm text-muted-foreground">{price.note}</p> : null}
        </div>
      ) : null}
    </div>
  )
}

export { CourseHero }
