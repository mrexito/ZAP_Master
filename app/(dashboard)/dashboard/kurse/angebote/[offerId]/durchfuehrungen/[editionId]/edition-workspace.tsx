'use client'

// Schritt 10a: orchestriert OfferEditionForm/SessionEditor/EditionPreview/PublicationChecklist
// (Abschnitt 3 des Architektur-Briefings) und den "Bearbeitungskontext"-Block aus Layout_Admin_
// Kursangebot_Maske.html. Ein Kontextwechsel (anderes Angebot/andere Durchführung) navigiert
// vollständig neu -- das erfüllt "Beim Kontextwechsel werden alle Felder aus der neuen Edition
// geladen" ohne einen zweiten, parallelen Client-State-Baum pflegen zu müssen.

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/app/components/ui/button'
import { OfferEditionForm } from '@/app/components/kurse-admin/offer-edition-form'
import { SessionEditor } from '@/app/components/kurse-admin/session-editor'
import { EditionPreview } from '@/app/components/kurse-admin/edition-preview'
import { PublicationChecklist } from '@/app/components/kurse-admin/publication-checklist'
import { duplicateEditionAction, type AdminOfferListEntry } from '@/app/(dashboard)/dashboard/kurse/durchfuehrungen/actions'
import type { OfferEditionDB, OfferEditionFormInput, CourseSessionWithKursDB } from '@/types/kurs-edition'

export function EditionWorkspace({
  offerList,
  offerId,
  catalogEntry,
  editions,
  edition,
  editionIdParam,
  sessions,
}: {
  offerList: AdminOfferListEntry[]
  offerId: number
  catalogEntry: AdminOfferListEntry
  editions: OfferEditionDB[]
  edition: OfferEditionDB | null
  editionIdParam: string
  sessions: CourseSessionWithKursDB[]
}) {
  const router = useRouter()
  const [liveValues, setLiveValues] = useState<OfferEditionFormInput | null>(null)
  const [schoolYear, setSchoolYear] = useState(edition?.school_year ?? '')
  const [schoolYearError, setSchoolYearError] = useState('')
  const [showDuplicate, setShowDuplicate] = useState(false)
  const [duplicateYear, setDuplicateYear] = useState('')
  const [duplicateState, setDuplicateState] = useState<'idle' | 'saving' | 'error'>('idle')
  const [duplicateError, setDuplicateError] = useState('')

  const handleValuesChange = useCallback((values: OfferEditionFormInput) => setLiveValues(values), [])

  const handleEditionSaved = (saved: OfferEditionDB) => {
    if (editionIdParam === 'neu') {
      router.replace(`/dashboard/kurse/angebote/${offerId}/durchfuehrungen/${saved.id}`)
    } else {
      router.refresh()
    }
  }

  const handleDuplicate = async () => {
    if (!edition || !duplicateYear.trim()) return
    setDuplicateState('saving')
    setDuplicateError('')
    const result = await duplicateEditionAction(offerId, edition.id, duplicateYear.trim())
    if (result.success && result.data) {
      setDuplicateState('idle')
      setShowDuplicate(false)
      router.push(`/dashboard/kurse/angebote/${offerId}/durchfuehrungen/${result.data.id}`)
    } else if (!result.success) {
      setDuplicateState('error')
      setDuplicateError(result.error)
    }
  }

  const activeSessionCount = sessions.filter((s) => s.registration_status === 'bookable').length
  const statusLabel =
    edition?.status === 'published' ? 'Veröffentlicht · öffentlich' : edition?.status === 'archived' ? 'Archiviert' : 'Entwurf · nicht öffentlich'

  return (
    <div className="brand-marketing admin-course-editor min-h-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1440px]">
      <div className="mb-6 flex items-start justify-between gap-5">
        <div>
          <div className="mb-2 font-mono-marketing text-[11px] font-medium uppercase tracking-[.08em] text-secondary">
            Zentrale Angebotsverwaltung
          </div>
          <h1 className="font-serif-marketing text-[34px] font-semibold leading-[1.15] text-foreground">
            Kursangebot verwalten
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Alle Kursangebote, Preise, Termine und Veröffentlichungen an einem Ort bearbeiten.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {edition && catalogEntry.kurstyp !== 'selbststudium' && (
            <Link href={`/dashboard/kurse/angebote/${offerId}/durchfuehrungen/${edition.id}/tagesfreigaben`}>
              <Button variant="outline" size="sm" className="border-border bg-card">
                Tagesfreigaben
              </Button>
            </Link>
          )}
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 font-mono-marketing text-[11px] font-medium ${
              edition?.status === 'published'
                ? 'bg-subject-de-pale text-subject-de-foreground'
                : 'bg-subject-ma-pale text-subject-ma-foreground'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                edition?.status === 'published' ? 'bg-subject-de' : 'bg-subject-ma'
              }`}
            />
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Bearbeitungskontext */}
      <section className="mb-[18px] grid grid-cols-1 items-end gap-3 rounded-xl border border-border bg-card p-[15px] shadow-[0_14px_36px_rgba(22,35,63,.08)] md:grid-cols-[1.3fr_.7fr_.7fr_auto]">
        <div className="flex flex-col gap-1 border-b border-border pb-2 md:col-span-4 md:flex-row md:items-baseline md:justify-between">
          <strong className="font-serif-marketing text-[17px] font-semibold">Bearbeitungskontext</strong>
          <span className="text-[11.5px] text-muted-foreground">
            Bestimmt, welches stabile Angebot und welche Jahresdurchführung bearbeitet werden.
          </span>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-foreground">Kursangebot</label>
          <select
            className="h-[42px] w-full rounded-[9px] border border-border bg-white px-3 text-sm outline-none focus:border-secondary focus:ring-3 focus:ring-secondary/15"
            value={offerId}
            onChange={(event) => router.push(`/dashboard/kurse/angebote/${event.target.value}/durchfuehrungen/neu`)}
          >
            {offerList.map((entry) => (
              <option key={entry.offerId} value={entry.offerId}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-foreground">Durchführung</label>
          <select
            className="h-[42px] w-full rounded-[9px] border border-border bg-white px-3 text-sm outline-none focus:border-secondary focus:ring-3 focus:ring-secondary/15"
            value={editionIdParam}
            onChange={(event) => router.push(`/dashboard/kurse/angebote/${offerId}/durchfuehrungen/${event.target.value}`)}
          >
            {editions.map((e) => (
              <option key={e.id} value={e.id}>
                {e.school_year} {e.status === 'archived' ? '(archiviert)' : ''}
              </option>
            ))}
            <option value="neu">Neue Durchführung …</option>
          </select>
        </div>
        <div>
          <label htmlFor="school-year" className="mb-1.5 block text-xs font-semibold text-foreground">
            Schul-/Prüfungsjahr
          </label>
          <input
            id="school-year"
            type="text"
            required
            minLength={4}
            maxLength={20}
            placeholder="z.B. 2026/27"
            value={schoolYear}
            onChange={(event) => {
              setSchoolYear(event.target.value)
              setSchoolYearError('')
            }}
            aria-invalid={schoolYearError ? true : undefined}
            aria-describedby={schoolYearError ? 'school-year-error' : undefined}
            className="h-[42px] w-full rounded-[9px] border border-border bg-white px-3 text-sm outline-none focus:border-secondary focus:ring-3 focus:ring-secondary/15"
          />
          {schoolYearError && (
            <p id="school-year-error" className="mt-1 text-xs text-destructive">
              {schoolYearError}
            </p>
          )}
        </div>
        <Button type="button" variant="outline" className="h-[42px] rounded-[9px] bg-card" disabled={!edition} onClick={() => setShowDuplicate((v) => !v)}>
          Vorjahr duplizieren
        </Button>
        {showDuplicate && (
          <div className="flex flex-wrap items-end gap-3 border-t border-border pt-2 md:col-span-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Neues Schuljahr</label>
              <input
                type="text"
                placeholder="z.B. 2027/28"
                value={duplicateYear}
                onChange={(event) => setDuplicateYear(event.target.value)}
                className="h-10 px-3 rounded-lg border border-border bg-background text-sm"
              />
            </div>
            <Button type="button" size="sm" onClick={handleDuplicate} disabled={duplicateState === 'saving' || !duplicateYear.trim()}>
              Duplizieren
            </Button>
            {duplicateError && <p className="text-xs text-destructive">{duplicateError}</p>}
          </div>
        )}
      </section>

      <nav className="mb-[18px] flex gap-1 overflow-x-auto rounded-[10px] bg-[#E9EBE4] p-[5px]" aria-label="Formularabschnitte">
        {[
          ['preise', '2 · Preise'],
          ['termine', '3 · Termine'],
          ['publikation', '4 · Veröffentlichung'],
        ].map(([target, label], index) => (
          <a
            key={target}
            href={`#${target}`}
            className={`whitespace-nowrap rounded-[7px] px-[13px] py-[9px] text-sm font-semibold ${
              index === 0
                ? 'bg-card text-foreground shadow-[0_2px_8px_rgba(22,35,63,.07)]'
                : 'text-muted-foreground hover:bg-card hover:text-foreground'
            }`}
          >
            {label}
          </a>
        ))}
      </nav>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="flex flex-col gap-6">
          <OfferEditionForm
            key={`${offerId}:${editionIdParam}`}
            offerId={offerId}
            edition={edition}
            contentTemplate={edition ? null : editions[0] ?? null}
            schoolYear={schoolYear}
            onSchoolYearError={setSchoolYearError}
            onValuesChange={handleValuesChange}
            onSaved={handleEditionSaved}
          />

          {catalogEntry.kurstyp !== 'selbststudium' && (
            <SessionEditor
              offerId={offerId}
              edition={edition}
              sessions={sessions}
              audienceId={catalogEntry.audienceId}
              schoolYear={schoolYear}
              offerType={catalogEntry.kurstyp}
            />
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6">
          <EditionPreview catalogEntry={catalogEntry} liveValues={liveValues} activeSessionCount={activeSessionCount} />
          <PublicationChecklist
            liveValues={liveValues}
            kurstyp={catalogEntry.kurstyp}
            activeSessionCount={activeSessionCount}
            isPublished={edition?.status === 'published'}
          />
          <section className="rounded-xl bg-[#16233F] p-5 text-white">
            <h3 className="font-serif-marketing text-lg font-semibold">Änderungen erscheinen auf</h3>
            <p className="text-xs opacity-80 mt-1">Eine zentrale Durchführung aktualisiert alle Verbraucher des gewählten Angebots.</p>
            <ul className="text-xs opacity-90 mt-3 space-y-1 list-disc list-inside">
              <li>Zugehörige Zielgruppen-Hauptseite</li>
              <li>Kursdetailseite</li>
              <li>Termin- und Buchungsdialog</li>
              <li>Admin-Anmeldungsübersicht</li>
            </ul>
          </section>
        </aside>
      </div>
      </div>
    </div>
  )
}
