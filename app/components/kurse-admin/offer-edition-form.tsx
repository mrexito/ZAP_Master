'use client'

// Schritt 10a: Preise + Veröffentlichung aus Layout_Admin_Kursangebot_Maske.html. Die öffentlichen
// Texte bleiben Teil der Edition, werden nach dem Entfernen des redundanten Grundlagen-Panels aber
// nicht mehr separat bearbeitet. "Interner Code" und "Distance Learning verfügbar" aus dem Mockup sind bewusst
// nicht übernommen -- OfferEdition (Abschnitt 2.12) und course_sessions besitzen dafür kein Feld;
// distanceLearningAvailable gehört zum öffentlichen CourseOffer-Marketingtyp, nicht zur admin-
// seitigen Edition. Kein erfundenes Schema-Feld für eine Mockup-Zeile ohne Typquelle.

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import {
  offerEditionFormSchema,
  type OfferEditionFormInput,
  type OfferEditionDB,
} from '@/types/kurs-edition'
import { saveEditionAction, publishEditionAction, archiveEditionAction } from '@/app/(dashboard)/dashboard/kurse/durchfuehrungen/actions'
import { utcIsoToZurichLocal } from '@/lib/utils/zurich-time'

const inputClass =
  'w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors'
const labelClass = 'block text-sm font-medium text-foreground mb-2'
const errorClass = 'mt-1.5 text-sm text-destructive'

function defaultValuesFor(
  edition: OfferEditionDB | null,
  contentTemplate: OfferEditionDB | null,
  schoolYear: string
): OfferEditionFormInput {
  if (!edition) {
    return {
      schoolYear,
      publicTitle: contentTemplate?.public_title ?? '',
      tagline: contentTemplate?.tagline ?? '',
      description: contentTemplate?.description ?? '',
      regularPriceChf: 0,
      earlyBirdEnabled: true,
      earlyBirdPriceChf: null,
      earlyBirdDeadline: null,
      registrationOpensAt: null,
      registrationClosesAt: null,
      status: 'draft',
    }
  }
  return {
    schoolYear,
    publicTitle: edition.public_title,
    tagline: edition.tagline,
    description: edition.description,
    regularPriceChf: edition.regular_price_rappen / 100,
    earlyBirdEnabled: edition.early_bird_enabled,
    earlyBirdPriceChf: edition.early_bird_price_rappen != null ? edition.early_bird_price_rappen / 100 : null,
    earlyBirdDeadline: edition.early_bird_deadline,
    // Gespeicherter Wert ist UTC -- ein reines .slice(0, 16) würde die UTC-Ziffern unverändert
    // als Zürcher Ortszeit anzeigen und damit um 1-2 Stunden danebenliegen, siehe zurich-time.ts.
    registrationOpensAt: edition.registration_opens_at ? utcIsoToZurichLocal(edition.registration_opens_at) : null,
    registrationClosesAt: edition.registration_closes_at ? utcIsoToZurichLocal(edition.registration_closes_at) : null,
    status: edition.status === 'archived' ? 'draft' : edition.status,
  }
}

export function OfferEditionForm({
  offerId,
  edition,
  contentTemplate,
  schoolYear,
  onSchoolYearError,
  onValuesChange,
  onSaved,
}: {
  offerId: number
  edition: OfferEditionDB | null
  contentTemplate: OfferEditionDB | null
  schoolYear: string
  onSchoolYearError?: (message: string) => void
  onValuesChange?: (values: OfferEditionFormInput) => void
  onSaved: (edition: OfferEditionDB) => void
}) {
  const [submitState, setSubmitState] = useState<'idle' | 'saving' | 'publishing' | 'error'>('idle')
  const [serverMessage, setServerMessage] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setError,
    setValue,
    reset,
  } = useForm<OfferEditionFormInput>({
    resolver: zodResolver(offerEditionFormSchema) as never,
    defaultValues: defaultValuesFor(edition, contentTemplate, schoolYear),
  })

  // Kontextwechsel (andere Edition geladen): Formular komplett neu befüllen statt alte Werte
  // stehen zu lassen (Abschnitt 1c: "Beim Kontextwechsel werden alle Felder aus der neuen Edition
  // geladen").
  useEffect(() => {
    reset(defaultValuesFor(edition, contentTemplate, schoolYear))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edition?.id])

  useEffect(() => {
    setValue('schoolYear', schoolYear, { shouldValidate: submitState === 'error' })
  }, [schoolYear, setValue, submitState])

  useEffect(() => {
    onSchoolYearError?.(errors.schoolYear?.message ?? '')
  }, [errors.schoolYear?.message, onSchoolYearError])

  useEffect(() => {
    if (!onValuesChange) return
    const subscription = watch((values) => onValuesChange(values as OfferEditionFormInput))
    return () => subscription.unsubscribe()
  }, [watch, onValuesChange])

  const earlyBirdEnabled = watch('earlyBirdEnabled')

  const onSave = async (data: OfferEditionFormInput) => {
    setSubmitState('saving')
    setServerMessage('')
    const result = await saveEditionAction(offerId, edition?.id ?? null, edition?.version ?? null, data)
    if (result.success && result.data) {
      setSubmitState('idle')
      setServerMessage(result.message)
      onSaved(result.data)
    } else if (!result.success) {
      setSubmitState('error')
      setServerMessage(result.error)
      if (result.fieldErrors) {
        Object.entries(result.fieldErrors).forEach(([field, messages]) => {
          setError(field as keyof OfferEditionFormInput, { message: messages[0] })
        })
      }
    }
  }

  const onPublish = handleSubmit(async (data) => {
    // Veröffentlichen speichert zuerst den aktuellen Formularstand, damit keine ungespeicherten
    // Änderungen live gehen, ohne im Entwurf gestanden zu haben.
    setSubmitState('publishing')
    setServerMessage('')
    const saveResult = await saveEditionAction(offerId, edition?.id ?? null, edition?.version ?? null, data)
    if (!saveResult.success || !saveResult.data) {
      setSubmitState('error')
      setServerMessage(!saveResult.success ? saveResult.error : 'Speichern fehlgeschlagen.')
      return
    }
    onSaved(saveResult.data)
    const publishResult = await publishEditionAction(offerId, saveResult.data.id, saveResult.data.version)
    if (publishResult.success && publishResult.data) {
      setSubmitState('idle')
      setServerMessage(publishResult.message)
      onSaved(publishResult.data)
    } else if (!publishResult.success) {
      setSubmitState('error')
      setServerMessage(publishResult.error)
    }
  })

  const onArchive = async () => {
    if (!edition) return
    setSubmitState('saving')
    const result = await archiveEditionAction(offerId, edition.id, edition.version)
    if (result.success && result.data) {
      setSubmitState('idle')
      setServerMessage(result.message)
      onSaved(result.data)
    } else if (!result.success) {
      setSubmitState('error')
      setServerMessage(result.error)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSave)} className="contents">
      {serverMessage && (
        <div
          className={`order-1 rounded-xl border p-4 text-sm ${
            submitState === 'error'
              ? 'border-destructive/50 bg-destructive/10 text-destructive'
              : 'border-secondary/50 bg-secondary/10 text-secondary-foreground'
          }`}
        >
          {serverMessage}
        </div>
      )}

      <input type="hidden" {...register('schoolYear')} />
      <input type="hidden" {...register('publicTitle')} />
      <input type="hidden" {...register('tagline')} />
      <input type="hidden" {...register('description')} />

      {/* 2 · Preise */}
      <section id="preise" className="order-2 scroll-mt-24 overflow-hidden rounded-xl border border-border bg-card shadow-[0_7px_22px_rgba(22,35,63,.045)]">
        <div className="flex items-start justify-between gap-4 border-b border-border px-[22px] pb-[15px] pt-5">
          <div>
          <h2 className="font-serif-marketing text-[22px] font-semibold text-foreground">2 · Preise</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Preisänderungen gelten nur für neue Buchungen dieser Durchführung.
          </p>
          </div>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-subject-de-pale font-mono-marketing text-[11px] font-semibold text-subject-de-foreground">02</span>
        </div>
        <div className="space-y-5 p-[22px]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Regulärer Preis (CHF) *</label>
            <input type="number" min={0} step={1} {...register('regularPriceChf', { valueAsNumber: true })} className={inputClass} />
            {errors.regularPriceChf && <p className={errorClass}>{errors.regularPriceChf.message}</p>}
          </div>
          <label className="flex gap-3 items-start border border-border rounded-xl p-4 bg-muted/30">
            <input type="checkbox" className="mt-1" {...register('earlyBirdEnabled')} />
            <span>
              <strong className="block text-sm text-foreground">Frühbucherpreis aktivieren</strong>
              <small className="text-xs text-muted-foreground">
                Für Vorkurse und Intensivkurse/Lerncamps empfohlen; für Prüfungssimulation und
                Selbststudium standardmässig deaktiviert.
              </small>
            </span>
          </label>
          {earlyBirdEnabled && (
            <>
              <div>
                <label className={labelClass}>Frühbucherpreis (CHF) *</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  {...register('earlyBirdPriceChf', { valueAsNumber: true })}
                  className={inputClass}
                />
                {errors.earlyBirdPriceChf && <p className={errorClass}>{errors.earlyBirdPriceChf.message}</p>}
              </div>
              <div>
                <label className={labelClass}>Frühbucher bis *</label>
                <input type="date" {...register('earlyBirdDeadline')} className={inputClass} />
                {errors.earlyBirdDeadline && <p className={errorClass}>{errors.earlyBirdDeadline.message}</p>}
              </div>
            </>
          )}
        </div>
        <div className="rounded-xl border-l-4 border-accent bg-accent/10 p-4 text-sm text-foreground">
          <strong>Historie geschützt:</strong> Bestehende Anmeldungen behalten ihren gebuchten Preis.
          Änderungen aktualisieren keine früheren Buchungen.
        </div>
        </div>
      </section>

      {/* 4 · Veröffentlichung; Termine/SessionEditor sitzt als eigene Komponente dazwischen. */}
      <section id="publikation" className="order-4 scroll-mt-24 overflow-hidden rounded-xl border border-border bg-card shadow-[0_7px_22px_rgba(22,35,63,.045)]">
        <div className="flex items-start justify-between gap-4 border-b border-border px-[22px] pb-[15px] pt-5">
          <div>
          <h2 className="font-serif-marketing text-[22px] font-semibold text-foreground">4 · Veröffentlichung</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Entwurf prüfen und kontrolliert auf allen verbundenen Seiten publizieren.
          </p>
          </div>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-subject-de-pale font-mono-marketing text-[11px] font-semibold text-subject-de-foreground">04</span>
        </div>
        <div className="space-y-5 p-[22px]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Anmeldung öffnet</label>
            <input type="datetime-local" {...register('registrationOpensAt')} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Anmeldung schliesst</label>
            <input type="datetime-local" {...register('registrationClosesAt')} className={inputClass} />
          </div>
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button type="submit" variant="outline" className="rounded-[9px]" disabled={submitState === 'saving' || submitState === 'publishing'}>
            {submitState === 'saving' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Entwurf speichern
          </Button>
          <Button type="button" className="rounded-[9px] bg-[#16233F] text-white hover:bg-[#26395E]" onClick={onPublish} disabled={submitState === 'saving' || submitState === 'publishing'}>
            {submitState === 'publishing' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Veröffentlichen
          </Button>
          {edition && edition.status !== 'archived' && (
            <Button type="button" variant="ghost" className="text-destructive" onClick={onArchive}>
              Archivieren
            </Button>
          )}
        </div>
        </div>
      </section>
    </form>
  )
}
