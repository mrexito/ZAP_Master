'use client'

// Schritt 10a: "3 · Termine & Kapazität" aus Layout_Admin_Kursangebot_Maske.html. fach/lehrer sind
// bewusst sichtbare Pflichtfelder (siehe Kommentar bei courseSessionFormSchema in
// types/kurs-edition.ts) statt eines stillen Default-Werts -- die Mockup-Referenz zeigt sie nicht,
// weil sie von reinen Deutsch+Mathematik-Klassenstufenkursen ausgeht, während
// intensivwoche_kurse.fach weiterhin nur ein Einzelfach zulässt.

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { Loader2, X } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { FACH_LABELS } from '@/types/kurs'
import {
  courseSessionFormSchema,
  STANDORT_OPTIONEN,
  REGISTRATION_STATUS_OPTIONEN,
  REGISTRATION_STATUS_LABELS,
  type CourseSessionFormInput,
  type CourseSessionWithKursDB,
  type OfferEditionDB,
} from '@/types/kurs-edition'
import { saveSessionAction, cancelSessionAction } from '@/app/(dashboard)/dashboard/kurse/durchfuehrungen/actions'
import {
  buildFixedIntensiveAudienceSchedule,
  buildFixedIntensiveSchedule,
  buildFixedVorkursSchedule,
  getFixScheduleGroup,
  getRepresentativeAudienceForGroup,
  hasFixedIntensiveSchedule,
  hasFixedSchoolSchedule,
  FIX_SCHEDULE_GROUPS,
  FIX_SCHEDULE_GROUP_LABELS,
  type FixScheduleGroup,
} from '@/lib/kurse/fixed-school-schedule'

const inputClass =
  'w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors'
const labelClass = 'block text-xs font-semibold text-foreground mb-1.5'
const errorClass = 'mt-1 text-xs text-destructive'

function defaultsFor(session: CourseSessionWithKursDB | null): CourseSessionFormInput {
  if (!session) {
    return {
      kursId: null,
      fach: 'mathematik',
      lehrer: '',
      startDatum: '',
      endDatum: '',
      uhrzeit: '',
      standort: 'Zürich HB',
      maxTeilnehmer: 10,
      registrationStatus: 'bookable',
      deliveryModes: ['onsite'],
    }
  }
  return {
    kursId: session.kurs.id,
    fach: session.kurs.fach as CourseSessionFormInput['fach'],
    lehrer: session.kurs.lehrer,
    startDatum: session.kurs.start_datum,
    endDatum: session.kurs.end_datum,
    uhrzeit: session.kurs.uhrzeit,
    standort: session.kurs.ort as CourseSessionFormInput['standort'],
    maxTeilnehmer: session.kurs.max_teilnehmer,
    registrationStatus: session.registration_status as CourseSessionFormInput['registrationStatus'],
    deliveryModes: (session.delivery_modes.length > 0 ? session.delivery_modes : ['onsite']) as CourseSessionFormInput['deliveryModes'],
  }
}

function SessionRow({
  index,
  offerId,
  edition,
  session,
  onRemoveNew,
}: {
  index: number
  offerId: number
  edition: OfferEditionDB
  session: CourseSessionWithKursDB | null
  onRemoveNew?: () => void
}) {
  const router = useRouter()
  const [submitState, setSubmitState] = useState<'idle' | 'saving' | 'error'>('idle')
  const [serverMessage, setServerMessage] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CourseSessionFormInput>({
    resolver: zodResolver(courseSessionFormSchema) as never,
    defaultValues: defaultsFor(session),
  })

  const onSubmit = async (data: CourseSessionFormInput) => {
    setSubmitState('saving')
    setServerMessage('')
    const result = await saveSessionAction(offerId, edition.id, edition.public_title, edition.description, data)
    if (result.success) {
      setSubmitState('idle')
      router.refresh()
    } else {
      setSubmitState('error')
      setServerMessage(result.error)
    }
  }

  const onCancel = async () => {
    if (!session) return
    setSubmitState('saving')
    const result = await cancelSessionAction(offerId, edition.id, session.kurs.id)
    if (result.success) {
      setSubmitState('idle')
      router.refresh()
    } else {
      setSubmitState('error')
      setServerMessage(result.error)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="border border-border rounded-xl p-4 bg-muted/20 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
          <span className="w-6 h-6 rounded-md bg-primary text-primary-foreground grid place-items-center text-xs font-mono">
            {String(index + 1).padStart(2, '0')}
          </span>
          {session ? `${session.kurs.ort} · ${session.kurs.uhrzeit}` : 'Neuer Termin'}
        </div>
        <div className="flex items-center gap-2">
          {session && (
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-muted-foreground hover:text-destructive"
              disabled={submitState === 'saving'}
            >
              Absagen
            </button>
          )}
          {!session && onRemoveNew && (
            <button type="button" onClick={onRemoveNew} aria-label="Entwurf entfernen" className="text-muted-foreground hover:text-destructive">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {serverMessage && <p className="text-xs text-destructive">{serverMessage}</p>}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>Start *</label>
          <input type="date" {...register('startDatum')} className={inputClass} />
          {errors.startDatum && <p className={errorClass}>{errors.startDatum.message}</p>}
        </div>
        <div>
          <label className={labelClass}>Ende *</label>
          <input type="date" {...register('endDatum')} className={inputClass} />
          {errors.endDatum && <p className={errorClass}>{errors.endDatum.message}</p>}
        </div>
        <div>
          <label className={labelClass}>Kurszeit *</label>
          <input type="text" placeholder="09.00 – 12.15 Uhr" {...register('uhrzeit')} className={inputClass} />
          {errors.uhrzeit && <p className={errorClass}>{errors.uhrzeit.message}</p>}
        </div>
        <div>
          <label className={labelClass}>Standort *</label>
          <select {...register('standort')} className={inputClass}>
            {STANDORT_OPTIONEN.map((ort) => (
              <option key={ort} value={ort}>
                {ort}
              </option>
            ))}
          </select>
          {errors.standort && <p className={errorClass}>{errors.standort.message}</p>}
        </div>
        <div>
          <label className={labelClass}>Kapazität *</label>
          <input type="number" min={1} max={50} {...register('maxTeilnehmer', { valueAsNumber: true })} className={inputClass} />
          {errors.maxTeilnehmer && <p className={errorClass}>{errors.maxTeilnehmer.message}</p>}
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select {...register('registrationStatus')} className={inputClass}>
            {REGISTRATION_STATUS_OPTIONEN.map((status) => (
              <option key={status} value={status}>
                {REGISTRATION_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Fach *</label>
          <select {...register('fach')} className={inputClass}>
            {Object.entries(FACH_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {errors.fach && <p className={errorClass}>{errors.fach.message}</p>}
        </div>
        <div className="col-span-2">
          <label className={labelClass}>Zuständige Lehrperson *</label>
          <input type="text" {...register('lehrer')} className={inputClass} />
          {errors.lehrer && <p className={errorClass}>{errors.lehrer.message}</p>}
        </div>
      </div>

      <Button type="submit" size="sm" variant="outline" disabled={submitState === 'saving'}>
        {submitState === 'saving' && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
        {session ? 'Termin aktualisieren' : 'Termin speichern'}
      </Button>
    </form>
  )
}

function MissingScheduleYear() {
  return (
    <div className="rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm text-foreground">
      Trage im Bearbeitungskontext ein gültiges Schul-/Prüfungsjahr ein, damit die Fixtermine
      berechnet werden.
    </div>
  )
}

function FixedVorkursSchedule({
  schoolYear,
  group,
}: {
  schoolYear: string
  group: 'langzeitgymi' | 'kurzzeitgymi'
}) {
  const schedule = buildFixedVorkursSchedule(schoolYear, group)

  if (schedule.length === 0) {
    return <MissingScheduleYear />
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="border-b border-border bg-muted/30 px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Vorkurs · Fixtermine</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Wöchentliche Termine am Samstag und Mittwoch, automatisch aus den festen KW berechnet.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#F7F8F3] text-left text-xs text-muted-foreground">
              <th scope="col" className="w-24 px-4 py-2.5 font-semibold">KW</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Samstag</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Mittwoch</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((row) => (
              <tr key={row.calendarWeek} className="border-t border-border first:border-t-0">
                <th scope="row" className="px-4 py-2.5 text-left font-mono-marketing text-xs font-semibold text-foreground">
                  {row.calendarWeek}
                </th>
                <td className="px-4 py-2.5 text-foreground">{row.saturday}</td>
                <td className="px-4 py-2.5 text-foreground">{row.wednesday}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FixedIntensiveSchedule({ schoolYear, group }: { schoolYear: string; group: FixScheduleGroup }) {
  // BMS wird wie Langzeitgymi/Kurzzeitgymi nach Standort in zwei eigene Spalten aufgeteilt
  // (Zürich/Winterthur), statt in einer gemeinsamen "BMS"-Spalte mit Standort-Anmerkung pro
  // Kalenderwoche. Matura kennt nur Zürich HB und bleibt eine eigene Einzelspalte.
  const columns =
    group === 'bms-matura'
      ? ([
          {
            label: 'Zürich',
            schedule: buildFixedIntensiveSchedule(schoolYear, 'bms', 'Zürich HB'),
          },
          {
            label: 'Winterthur',
            schedule: buildFixedIntensiveSchedule(schoolYear, 'bms', 'Winterthur'),
          },
          {
            label: 'Matura',
            schedule: buildFixedIntensiveAudienceSchedule(schoolYear, 'matura'),
          },
        ] as const)
      : ([
          {
            label: 'Zürich',
            schedule: buildFixedIntensiveSchedule(schoolYear, getRepresentativeAudienceForGroup(group), 'Zürich HB'),
          },
          {
            label: 'Winterthur',
            schedule: buildFixedIntensiveSchedule(schoolYear, getRepresentativeAudienceForGroup(group), 'Winterthur'),
          },
        ] as const)
  const weekdays = [
    ['Montag', 'monday'],
    ['Dienstag', 'tuesday'],
    ['Mittwoch', 'wednesday'],
    ['Donnerstag', 'thursday'],
    ['Freitag', 'friday'],
  ] as const

  if (columns.some((column) => column.schedule.length === 0)) {
    return <MissingScheduleYear />
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="border-b border-border bg-muted/30 px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Intensivkurs · Fixwochen</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Kalenderwochen und fünf aufeinanderfolgende Kurstage auf einen Blick.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="bg-[#F7F8F3] text-left text-xs text-muted-foreground">
              <th scope="col" className="w-36 px-3 py-2.5 font-semibold">Termin</th>
              {columns.map((column) => (
                <th key={column.label} scope="col" className="px-3 py-2.5 font-semibold">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border bg-secondary/5">
              <th scope="row" className="px-3 py-3 text-left text-xs font-semibold text-foreground">
                Kalenderwoche
              </th>
              {columns.map((column) => (
                <td key={column.label} className="whitespace-nowrap px-3 py-3 font-mono-marketing text-xs font-semibold text-foreground">
                  {column.schedule.map((week) => `KW ${week.calendarWeek}`).join(' / ')}
                </td>
              ))}
            </tr>
            {weekdays.map(([label, field]) => (
              <tr key={field} className="border-t border-border">
                <th scope="row" className="px-3 py-3 text-left text-xs font-semibold text-foreground">
                  {label}
                </th>
                {columns.map((column) => (
                  <td key={column.label} className="whitespace-nowrap px-3 py-3 text-xs text-foreground">
                    {column.schedule.map((week) => week[field]).join(' / ')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function SessionEditor({
  offerId,
  edition,
  sessions,
  audienceId,
  schoolYear,
  offerType,
}: {
  offerId: number
  edition: OfferEditionDB | null
  sessions: CourseSessionWithKursDB[]
  audienceId: string
  schoolYear: string
  offerType: string
}) {
  const [drafts, setDrafts] = useState<number[]>([])
  // Default: Gruppe des aktuell bearbeiteten Angebots -- der Admin kann trotzdem zu anderen
  // Gruppen wechseln, um deren Fixtermine als Referenz einzusehen.
  const [scheduleGroup, setScheduleGroup] = useState<FixScheduleGroup>(
    getFixScheduleGroup(audienceId) ?? 'langzeitgymi'
  )
  const showVorkursSchedule = hasFixedSchoolSchedule(audienceId) && offerType === 'halbjahreskurs'
  const showIntensiveSchedule = hasFixedIntensiveSchedule(audienceId) && offerType === 'intensivkurs'
  const showAutomaticSchedule = showVorkursSchedule || showIntensiveSchedule

  const scheduleGroupFilter = showAutomaticSchedule ? (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Fixtermine nach Gruppe filtern">
      {FIX_SCHEDULE_GROUPS.map((group) => (
        <button
          key={group}
          type="button"
          onClick={() => setScheduleGroup(group)}
          aria-pressed={scheduleGroup === group}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            scheduleGroup === group
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/70'
          }`}
        >
          {FIX_SCHEDULE_GROUP_LABELS[group]}
        </button>
      ))}
    </div>
  ) : null

  // Die Termine (Fixtermin-Referenztabelle) sind abhängig von der Filterauswahl -- BMS & Matura
  // besitzen keinen Vorkurs-Fixplan (hasFixedSchoolSchedule() deckt sie nicht ab).
  const automaticSchedule = showVorkursSchedule ? (
    scheduleGroup === 'bms-matura' ? (
      <p className="text-sm text-muted-foreground">
        Für BMS &amp; Matura gibt es keinen Vorkurs-Fixplan.
      </p>
    ) : (
      <FixedVorkursSchedule schoolYear={schoolYear} group={scheduleGroup} />
    )
  ) : showIntensiveSchedule ? (
    <FixedIntensiveSchedule schoolYear={schoolYear} group={scheduleGroup} />
  ) : null

  if (!edition) {
    return (
      <div id="termine" className="order-3 scroll-mt-24 rounded-xl border border-border bg-card p-6">
        <h2 className="font-serif-marketing text-[22px] font-semibold text-foreground">3 · Termine &amp; Kapazität</h2>
        {scheduleGroupFilter && <div className="mt-4">{scheduleGroupFilter}</div>}
        {automaticSchedule && (
          <div className="mt-4">
            {automaticSchedule}
          </div>
        )}
        <p className="text-sm text-muted-foreground mt-2">
          Speichere zuerst einen Entwurf, um buchbare Kursgruppen hinzuzufügen.
        </p>
      </div>
    )
  }

  const activeSessions = sessions.filter((s) => s.registration_status !== 'cancelled')

  return (
    <section id="termine" className="order-3 scroll-mt-24 overflow-hidden rounded-xl border border-border bg-card shadow-[0_7px_22px_rgba(22,35,63,.045)]">
      <div className="flex items-start justify-between gap-4 border-b border-border px-[22px] pb-[15px] pt-5">
        <div>
        <h2 className="font-serif-marketing text-[22px] font-semibold text-foreground">3 · Termine &amp; Kapazität</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Eine Durchführung kann mehrere buchbare Termine und Standorte besitzen.
        </p>
        </div>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-subject-de-pale font-mono-marketing text-[11px] font-semibold text-subject-de-foreground">03</span>
      </div>

      <div className="space-y-4 p-[22px]">
      {scheduleGroupFilter}
      {automaticSchedule}
      {showAutomaticSchedule && (
        <div className="border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-foreground">Buchbare Kursgruppen</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Standort, Kurszeit, Kapazität und Status werden weiterhin pro Kursgruppe gepflegt.
          </p>
        </div>
      )}
      <div className="space-y-3">
        {sessions.map((session, index) => (
          <SessionRow key={session.kurs.id} index={index} offerId={offerId} edition={edition} session={session} />
        ))}
        {drafts.map((draftKey, draftIndex) => (
          <SessionRow
            key={`draft-${draftKey}`}
            index={sessions.length + draftIndex}
            offerId={offerId}
            edition={edition}
            session={null}
            onRemoveNew={() => setDrafts((prev) => prev.filter((k) => k !== draftKey))}
          />
        ))}
      </div>

      {activeSessions.length === 0 && drafts.length === 0 && (
        <p className="text-sm text-muted-foreground">Noch keine Termine angelegt.</p>
      )}

      <button
        type="button"
        onClick={() => setDrafts((prev) => [...prev, Date.now()])}
        className="w-full border border-dashed border-secondary bg-secondary/10 text-secondary-foreground rounded-xl p-3 font-semibold text-sm hover:bg-secondary/20 transition-colors"
      >
        ＋ Weiteren Termin hinzufügen
      </button>
      </div>
    </section>
  )
}
