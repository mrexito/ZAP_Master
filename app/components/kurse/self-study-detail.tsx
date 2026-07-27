import type { AudienceHeroContent, SelfStudyOffer, UserAction } from '@/types/marketing'
import { Link } from '@/i18n/navigation'
import { formatOfferPrice } from '@/lib/pricing'
import { Button } from '@/app/components/ui/button'

interface SelfStudyDetailProps {
  offer: SelfStudyOffer
  hero: AudienceHeroContent
  accessAction: UserAction
  audienceLabel: string
  audienceHref: string
}

const featureMarks: Record<string, string> = {
  uebungen: 'Übungen',
  pruefungen: 'Prüfungen',
  archiv: 'Prüfungen',
  feedback: 'Feedback',
}

function SelfStudyDetail({
  offer,
  hero,
  accessAction,
  audienceLabel,
  audienceHref,
}: SelfStudyDetailProps) {
  const price = formatOfferPrice(offer)
  const isBms = offer.audienceId === 'bms'
  const examLabel = isBms ? 'BMS-Aufnahmeprüfung' : 'Gymiprüfung'
  const faq = [
    {
      id: 'kursteilnahme',
      question: 'Ist das Selbststudium an eine Kursteilnahme gebunden?',
      answer:
        'Nein. Das Selbststudium ist ein eigenständiges Angebot und kann unabhängig von einer Teilnahme an einem Vor- oder Intensivkurs gebucht werden.',
    },
    {
      id: 'zugang',
      question: 'Wie lange ist der Zugang gültig?',
      answer: `Der Zugang gilt ab Erhalt der Zugangsdaten bis zur ${examLabel} im März 2027. Danach wird er automatisch deaktiviert.`,
    },
    {
      id: 'feedback',
      question: 'Wie funktioniert das Aufsatz-Feedback?',
      answer:
        'Du reichst deinen Aufsatz über die Plattform ein und erhältst innerhalb weniger Tage eine schriftliche Rückmeldung mit konkreten Verbesserungshinweisen. Insgesamt können bis zu drei Aufsätze eingereicht werden.',
    },
    {
      id: 'loesungen',
      question: 'Sind die Lösungen zu allen Aufgaben enthalten?',
      answer:
        'Ja, zu sämtlichen Übungsaufgaben und alten Prüfungen liegen vollständige Lösungen bei, sodass eigenständig kontrolliert werden kann.',
    },
  ]

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-14 pb-4">
      <header className="mx-auto w-full max-w-2xl">
        {hero.eyebrow ? (
          <p className="relative mb-6 inline-block overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#A6772A_0%,#C89B3C_55%,#DAB569_100%)] px-8 py-6 font-serif text-2xl font-semibold leading-tight text-white shadow-sm before:pointer-events-none before:absolute before:inset-0 before:bg-[repeating-linear-gradient(115deg,rgba(255,255,255,0.08)_0_2px,transparent_2px_26px)] md:px-9 md:py-7 md:text-4xl">
            <span className="relative">{hero.eyebrow}</span>
          </p>
        ) : null}
        <h1 className="text-3xl font-semibold leading-tight text-foreground md:text-4xl">
          {hero.title}
        </h1>
        <p className="mt-4 max-w-[52ch] text-[15.5px] leading-relaxed text-muted-foreground">
          {hero.description}
        </p>
        <div className="mt-5 flex flex-wrap gap-x-7 gap-y-2 text-sm">
          <p>
            <span className="font-serif text-base font-semibold text-subject-ma-foreground">
              3
            </span>
            {' '}
            <span className="font-medium">Aufsätze mit Feedback</span>
          </p>
        </div>
      </header>

      <section aria-labelledby="self-study-materials">
        <div className="mx-auto mb-7 max-w-2xl text-center">
          <p className="mb-3 font-mono text-xs tracking-[0.08em] text-subject-ma-foreground uppercase">
            Was ist inbegriffen
          </p>
          <h2 id="self-study-materials" className="text-2xl font-medium leading-tight md:text-3xl">
            Alle Materialien an einem Ort
          </h2>
          <p className="mx-auto mt-3 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
            Kein Kurs, keine festen Termine — nur die Unterlagen und die Rückmeldung, die es für
            ein selbstständiges Training braucht.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {offer.whyUs.map((feature) => (
            <article
              key={feature.id}
              className="rounded-xl border border-border bg-card px-5 py-6 shadow-[0_1px_0_rgba(22,35,63,0.02)]"
            >
              <p className="mb-3 inline-flex rounded-full bg-subject-ma-pale px-2.5 py-1 font-mono text-[11px] text-subject-ma-foreground">
                {featureMarks[feature.id] ?? 'Material'}
              </p>
              <h3 className="text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <aside
        className="flex items-start gap-4 rounded-xl border border-[#E4CE9C] bg-subject-ma-pale px-5 py-5"
        aria-label="Hinweis zum Zugang"
      >
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-subject-ma-foreground font-mono text-xs text-white"
        >
          i
        </span>
        <p className="text-[13.5px] leading-relaxed text-foreground">
          <strong className="text-subject-ma-foreground">{offer.access.title}:</strong>{' '}
          {offer.access.description}
        </p>
      </aside>

      <section
        aria-label="Preis und Zugang"
        className="flex flex-wrap items-center justify-between gap-6 rounded-xl border border-subject-de bg-card px-6 py-8 md:px-9"
      >
        <div>
          <p className="mb-2 font-mono text-[11px] tracking-wide text-subject-ma-foreground uppercase">
            Selbststudium
          </p>
          <p className="font-serif text-3xl font-semibold text-foreground">{price.value}</p>
          {price.note ? (
            <p className="mt-1 text-xs text-muted-foreground">{price.note}</p>
          ) : null}
        </div>
        {accessAction.kind === 'link' ? (
          <Button asChild size="lg" className="rounded-sm">
            <Link href={accessAction.href}>{accessAction.label}</Link>
          </Button>
        ) : (
          <Button size="lg" className="rounded-sm disabled:opacity-70" disabled aria-disabled="true">
            {accessAction.label}
            <span className="sr-only"> — {accessAction.disabledReason}</span>
          </Button>
        )}
      </section>

      <section aria-labelledby="self-study-faq" className="mx-auto w-full max-w-3xl">
        <h2 id="self-study-faq" className="mb-7 text-center text-2xl font-medium md:text-3xl">
          Häufige Fragen
        </h2>
        <div className="flex flex-col gap-3">
          {faq.map((item, index) => (
            <details
              key={item.id}
              className="group rounded-xl border border-border bg-card px-5 py-4"
              open={index === 0}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold marker:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                {item.question}
                <span aria-hidden="true" className="font-serif text-xl text-subject-ma-foreground">
                  <span className="group-open:hidden">+</span>
                  <span className="hidden group-open:inline">–</span>
                </span>
              </summary>
              <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <p className="text-center">
        <Link
          href={audienceHref}
          className="font-mono text-xs font-medium text-secondary hover:text-foreground"
        >
          ← Zurück zur Übersicht {audienceLabel}
        </Link>
      </p>
    </div>
  )
}

export { SelfStudyDetail }
