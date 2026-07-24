import type { ReactNode } from 'react'
import {
  Award,
  Clock,
  Clock3,
  Coffee,
  FileCheck2,
  Languages,
  ListTree,
  MessageSquareText,
  ScanLine,
  School,
  UserCheck,
  Utensils,
} from 'lucide-react'
import type { Audience, ExamSimulationOffer } from '@/types/marketing'
import { cn } from '@/lib/utils'
import { formatChfRappen } from '@/lib/pricing'

interface ExamSimulationDetailProps {
  offer: ExamSimulationOffer
  audience: Audience
  booking: ReactNode
}

const flowAccents = [
  'border-t-primary',
  'border-t-foreground/70',
  'border-t-accent',
  'border-t-secondary',
]

const flowHeadBackgrounds = [
  'bg-primary/5',
  'bg-foreground/[0.03]',
  'bg-accent/5',
  'bg-secondary/5',
]

const conditionIcons = [Clock, FileCheck2, School]

const resultItems = [
  { title: 'Note', description: 'Gesamtnote des Aufsatzes', icon: Award, accent: 'border-t-primary', head: 'bg-primary/5' },
  { title: 'Inhalt & Aufbau', description: 'Aufgabenbezug, roter Faden und Argumentation', icon: ListTree, accent: 'border-t-accent', head: 'bg-accent/5' },
  { title: 'Sprache & Ausdruck', description: 'Wortwahl, Satzbau und Verständlichkeit', icon: Languages, accent: 'border-t-primary', head: 'bg-primary/5' },
  { title: 'Hinweise', description: 'Grammatik, Rechtschreibung und markierte Textstellen', icon: MessageSquareText, accent: 'border-t-secondary', head: 'bg-secondary/5' },
]

const feedbackItems = [
  { title: '1. Digitalisieren', description: 'Der handschriftliche Aufsatz wird vollständig gescannt.', icon: ScanLine, accent: 'border-t-primary', head: 'bg-primary/5' },
  { title: '2. Rückmeldung', description: 'Die Lehrperson markiert Stärken, Fehler und konkrete Verbesserungen.', icon: MessageSquareText, accent: 'border-t-accent', head: 'bg-accent/5' },
  { title: '3. Freigeben', description: 'Der Teilnehmer erhält eine Benachrichtigung und sieht alles nach dem Login.', icon: UserCheck, accent: 'border-t-secondary', head: 'bg-secondary/5' },
]

function NumberedHeading({
  number,
  title,
  description,
}: {
  number: number
  title: string
  description?: string
}) {
  return (
    <div className="grid max-w-[62ch] grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1">
      <span
        aria-hidden="true"
        className="grid h-[26px] w-[26px] place-items-center rounded-full border border-border font-mono text-[13px] text-muted-foreground"
      >
        {number}
      </span>
      <h2 className="font-serif text-2xl font-semibold text-foreground">{title}</h2>
      {description ? (
        <p className="col-start-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}

function ExamTimeline({ offer }: { offer: ExamSimulationOffer }) {
  const isSek = offer.audienceId === '2-3-sek'
  const note = isSek
    ? 'Prüfung am Vor- und Nachmittag mit prüfungsnaher Sitzordnung, Aufsicht, zugelassenen Hilfsmitteln und Mittagspause.'
    : 'Vormittagsprüfung mit prüfungsnaher Sitzordnung, Aufsicht, zugelassenen Hilfsmitteln und Pausen.'

  return (
    <div className="grid gap-3">
      <ol
        aria-label={isSek ? 'Zeitstrahl der Prüfung für die Sekundarschule' : 'Zeitstrahl der Prüfung für die 6. Klasse'}
        className={cn(
          'grid grid-cols-1 items-stretch gap-1.5 md:grid-cols-[1.1fr_auto_1.25fr_auto_.9fr]',
          isSek && 'md:grid-cols-[45fr_90fr_auto_90fr]'
        )}
      >
        {offer.examTimeline.map((segment) => {
          if (segment.subject === 'pause') {
            const PauseIcon = segment.label === 'Mittagspause' ? Utensils : Coffee
            return (
              <li
                key={segment.id}
                aria-label={segment.label}
                className="grid min-h-6 place-items-center text-muted-foreground md:min-h-10"
              >
                <span className="col-start-1 row-start-1 h-px w-full bg-border md:h-full md:w-px" />
                <PauseIcon
                  aria-hidden="true"
                  className="col-start-1 row-start-1 h-4 w-4 bg-background"
                />
              </li>
            )
          }

          return (
            <li
              key={segment.id}
              className={cn(
                'grid min-w-0 content-start gap-1 overflow-hidden border-t-2 px-3 py-2.5',
                segment.subject === 'ma'
                  ? 'border-t-subject-ma bg-subject-ma-pale/40'
                  : 'border-t-subject-de bg-subject-de-pale/40'
              )}
            >
              <strong className="font-medium">{segment.label}</strong>
              <span className="text-sm text-muted-foreground">{segment.minutes} Minuten</span>
            </li>
          )
        })}
      </ol>
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Clock3 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{note}</span>
      </p>
    </div>
  )
}

function ExamSimulationDetail({ offer, audience, booking }: ExamSimulationDetailProps) {
  const audienceDescription =
    offer.audienceId === '2-3-sek'
      ? 'Sekundarschule · Kurzgymnasium'
      : '6. Klasse · Langgymnasium'

  return (
    <article className="mx-auto grid w-full max-w-[900px] gap-6">
      <header className="grid gap-3 border-b border-border pb-5 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary px-3 py-1 font-mono text-xs font-medium text-primary-foreground">
            Gymiprüfung 2027
          </span>
          <span className="font-mono text-xs text-muted-foreground">{audienceDescription}</span>
        </div>
        <h1 className="max-w-3xl font-serif text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Prüfungssimulation unter realistischen Bedingungen
        </h1>
        <p className="max-w-[62ch] text-base leading-relaxed text-muted-foreground">{offer.lede}</p>
      </header>

      <section id="ablauf" className="grid gap-4">
        <NumberedHeading number={1} title="Ablauf der Prüfungssimulation" />
        <ol
          aria-label="Ablauf in vier Schritten"
          className="grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-4"
        >
          {offer.flowSteps.map((step, index) => (
            <li
              key={step.id}
              className={cn('grid content-start border-t-2 bg-background', flowAccents[index])}
            >
              <div
                className={cn(
                  'grid grid-cols-[auto_1fr] items-center gap-2.5 px-4 py-3',
                  flowHeadBackgrounds[index]
                )}
              >
                <span className="grid h-5 w-5 place-items-center rounded-full border border-border font-mono text-xs text-muted-foreground">
                  {index + 1}
                </span>
                <h3 className="font-serif text-lg font-semibold">{step.title}</h3>
              </div>
              <p className="px-4 pb-4 pt-3 text-sm leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
        <ExamTimeline offer={offer} />
      </section>

      <section className="grid gap-4">
        <h2 className="font-serif text-2xl font-semibold">Prüfungsnahe Bedingungen</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {offer.whyUs.map((feature, index) => {
            const Icon = conditionIcons[index] ?? FileCheck2
            return (
              <article
                key={feature.id}
                className={cn(
                  'grid content-start overflow-hidden border-t-2 bg-background',
                  index === 0
                    ? 'border-t-primary'
                    : index === 1
                      ? 'border-t-accent'
                      : 'border-t-secondary'
                )}
              >
                <div
                  className={cn(
                    'flex items-center gap-2 px-4 py-3',
                    index === 0 ? 'bg-primary/5' : index === 1 ? 'bg-accent/5' : 'bg-secondary/5'
                  )}
                >
                  <Icon aria-hidden="true" className="h-4 w-4" />
                  <h3 className="font-serif text-lg font-semibold">{feature.title}</h3>
                </div>
                <p className="px-4 pb-4 pt-3 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="grid gap-4 border-y border-border py-4">
        <NumberedHeading
          number={2}
          title="Auswertung und Aufsatzkorrektur"
          description="Der Aufsatz wird anhand eines einheitlichen Bewertungsrasters benotet und mit konkreten Korrekturhinweisen versehen."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {resultItems.map((item) => (
            <article
              key={item.title}
              className={cn('grid content-start overflow-hidden border-t-2 bg-background', item.accent)}
            >
              <div className={cn('flex items-center gap-2 px-4 py-3', item.head)}>
                <item.icon aria-hidden="true" className="h-4 w-4" />
                <h3 className="font-serif text-base font-semibold">{item.title}</h3>
              </div>
              <p className="px-4 pb-4 pt-3 text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4">
        <div className="grid max-w-[62ch] gap-1.5">
          <h2 className="font-serif text-2xl font-semibold">Aufsatzkorrektur im persönlichen Portal</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Die Prüfungsunterlagen nimmt der Schüler nach Hause. Nur der Aufsatz bleibt zur
            Korrektur beim Team, wird danach gescannt und zusammen mit der fachlichen Rückmeldung
            dem persönlichen Teilnehmerkonto zugeordnet.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3" aria-label="Feedbackprozess in drei Schritten">
          {feedbackItems.map((item) => (
            <article
              key={item.title}
              className={cn('grid content-start overflow-hidden border-t-2 bg-background', item.accent)}
            >
              <div className={cn('flex items-center gap-2 px-4 py-3', item.head)}>
                <item.icon aria-hidden="true" className="h-4 w-4" />
                <h3 className="font-serif text-lg font-semibold">{item.title}</h3>
              </div>
              <p className="px-4 pb-4 pt-3 text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section id="termine" className="grid gap-4 border-t border-border pt-7">
        <NumberedHeading number={3} title="Termine und Buchung" />
        {booking}
        <div className="flex justify-end border-t border-border pt-3">
          <p className="font-serif text-3xl font-semibold">{formatChfRappen(offer.regularPriceRappen)}</p>
        </div>
        <details className="group border-b border-border py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-mono text-sm font-medium marker:hidden">
            Wie viele Simulationen sind sinnvoll?
            <span
              aria-hidden="true"
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border text-base transition-transform group-open:rotate-45 group-open:border-secondary group-open:text-secondary"
            >
              +
            </span>
          </summary>
          <p className="mt-3 max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
            Eine erste Simulation zeigt den Standort. Eine zweite kann später prüfen, ob
            Zeitmanagement und Lernschwerpunkte verbessert wurden.
          </p>
        </details>
      </section>

      <section className="grid gap-4">
        <h2 className="font-serif text-2xl font-semibold">Häufige Fragen</h2>
        <div className="grid gap-1">
          {offer.faq.map((item) => (
            <details key={item.id} className="group border-b border-border py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-mono text-sm font-medium marker:hidden">
                {item.question}
                <span
                  aria-hidden="true"
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border text-base transition-transform group-open:rotate-45 group-open:border-secondary group-open:text-secondary"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </section>

      <p className="sr-only">Angebot für {audience.displayLabel}</p>
    </article>
  )
}

export { ExamSimulationDetail }
