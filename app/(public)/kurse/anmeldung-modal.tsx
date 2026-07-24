'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  X,
  User,
  Mail,
  Phone,
  GraduationCap,
  MessageSquare,
  Loader2,
  CheckCircle2,
  Calendar,
  MapPin,
  Clock,
  AlertCircle
} from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/app/components/ui/dialog'
import { FACH_LABELS, FACH_FARBEN } from '@/types/kurs'
import {
  intensivwocheAnmeldungSchema,
  type IntensivwocheAnmeldungInput
} from '@/types/intensivwoche'
import { submitIntensivwocheAnmeldung } from './actions'

// Generisches Kurs-Interface für Modal
interface KursForModal {
  id: number
  name: string
  fach: 'mathematik' | 'deutsch' | 'franzoesisch' | 'natur-mensch-gesellschaft'
  startDatum: string
  endDatum: string
  dateLabel?: string
  uhrzeit: string
  ort: string
  preis: number
  klassenstufen: string[]
}

interface AnmeldungModalProps {
  kurs: KursForModal
  onClose: () => void
}

export function AnmeldungModal({ kurs, onClose }: AnmeldungModalProps) {
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [serverMessage, setServerMessage] = useState('')
  // Stabil über Re-Renders/Retries desselben Modal-Öffnens hinweg, neu bei erneutem Öffnen —
  // erlaubt der DB, einen wiederholten Submit (Doppelklick, Netzwerk-Retry) idempotent zu
  // behandeln statt eine doppelte Buchung anzulegen.
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  // Das ausloesende "Anmelden" wird ausserhalb dieser Komponente gerendert (in der jeweiligen
  // SessionTable-Zeile), nicht ueber Radix' eigenes <DialogTrigger>. Radix' eingebaute
  // Fokus-Rueckgabe kennt in diesem Fall kein Trigger-Element; onCloseAutoFocus unten stellt sie
  // deshalb explizit wieder her, statt sich auf einen internen Automatismus zu verlassen, den es
  // fuer extern kontrollierte Trigger nicht gibt.
  const [triggerElement] = useState<HTMLElement | null>(() =>
    typeof document !== 'undefined' ? (document.activeElement as HTMLElement) : null
  )

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<IntensivwocheAnmeldungInput>({
    resolver: zodResolver(intensivwocheAnmeldungSchema),
    defaultValues: {
      kurs_id: String(kurs.id),
      notes: '',
    },
  })

  const onSubmit = async (data: IntensivwocheAnmeldungInput) => {
    setSubmitState('loading')
    setServerMessage('')

    const result = await submitIntensivwocheAnmeldung(data, idempotencyKey)

    if (result.success) {
      setSubmitState('success')
      setServerMessage(result.message)
    } else {
      setSubmitState('error')
      setServerMessage(result.error)
      
      if (result.fieldErrors) {
        Object.entries(result.fieldErrors).forEach(([field, messages]) => {
          setError(field as keyof IntensivwocheAnmeldungInput, {
            message: messages[0],
          })
        })
      }
    }
  }

  // Abschnitt 10.4 (Accessibility-Audit): dieses Modal war zuvor ein handgebautes <div>
  // ohne role="dialog"/aria-modal, ohne Fokus-Trap und ohne Fokus-Rückgabe an das ausloesende
  // Element -- axe-core/eine manuelle Tastaturpruefung fand das Buchungsmodal (das zentrale
  // Interaktionselement der gesamten oeffentlichen Seite) faktisch nicht als Dialog. Jetzt auf
  // Radix Dialog (app/components/ui/dialog.tsx, bereits im Projekt fuer andere Flows verwendet)
  // umgestellt: liefert role="dialog", aria-modal, Fokus-Trap, Escape-Handling, Body-Scroll-Lock
  // und Fokus-Rueckgabe korrekt und getestet, ohne die bisherige Optik/Struktur zu aendern. Der
  // Elternkomponent haelt weiterhin die einzige Zustandsquelle (mount/unmount via `kurs`-Prop);
  // `open` ist deshalb immer true, `onOpenChange(false)` (Escape/Ausserhalb-Klick) ruft `onClose`.
  const handleOpenChange = (open: boolean) => {
    if (!open) onClose()
  }

  const handleCloseAutoFocus = (event: Event) => {
    if (triggerElement) {
      event.preventDefault()
      triggerElement.focus()
    }
  }

  const farben = FACH_FARBEN[kurs.fach]

  const formatDatum = (datum: string) => {
    return new Date(datum).toLocaleDateString('de-CH', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const kursDatum =
    kurs.dateLabel ||
    (kurs.startDatum && kurs.endDatum
      ? `${formatDatum(kurs.startDatum)} – ${formatDatum(kurs.endDatum)}`
      : 'Termin gemäss Kursauswahl')

  // Erfolgs-Ansicht
  if (submitState === 'success') {
    return (
      <Dialog open onOpenChange={handleOpenChange}>
        <DialogContent
          className="max-w-md gap-0 rounded-2xl p-8 text-center"
          showCloseButton={false}
          onCloseAutoFocus={handleCloseAutoFocus}
        >
          <div className="mx-auto w-16 h-16 bg-secondary/15 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="w-8 h-8 text-secondary" />
          </div>
          <DialogTitle asChild>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Anmeldung erfolgreich!
            </h2>
          </DialogTitle>
          <p className="text-muted-foreground mb-2">
            {serverMessage}
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Du bist angemeldet für:<br />
            <span className="font-medium text-foreground">{kurs.name}</span>
          </p>
          <Button onClick={onClose} className="rounded-xl">
            Schliessen
          </Button>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[85vh] gap-0 overflow-y-auto rounded-2xl p-0"
        showCloseButton={false}
        onCloseAutoFocus={handleCloseAutoFocus}
      >
        {/* Header */}
        <div className={`${farben.bg} px-6 py-4 rounded-t-2xl flex items-start justify-between`}>
          <div>
            <span className={`text-xs font-medium ${farben.text} uppercase tracking-wider`}>
              {FACH_LABELS[kurs.fach]}
            </span>
            <DialogTitle asChild>
              <h2 className="text-xl font-bold text-foreground mt-1">
                Anmeldung: {kurs.name}
              </h2>
            </DialogTitle>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schliessen"
            className="p-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5 text-foreground" />
          </button>
        </div>

        {/* Kurs-Info */}
        <div className="px-6 py-4 border-b border-border bg-muted/30">
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {kursDatum}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {kurs.uhrzeit}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {kurs.ort}
            </span>
          </div>
          <div className="mt-2 text-lg font-semibold text-foreground">
            CHF {kurs.preis}
          </div>
        </div>

        {/* Formular */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
          {/* Hidden: kurs_id */}
          <input type="hidden" {...register('kurs_id')} />

          {/* Kind-Daten */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Angaben zum Kind
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Vorname */}
              <div>
                <label htmlFor="child_firstname" className="block text-sm font-medium text-foreground mb-2">
                  Vorname *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    id="child_firstname"
                    type="text"
                    {...register('child_firstname')}
                    placeholder="Max"
                    aria-invalid={!!errors.child_firstname}
                    aria-describedby={errors.child_firstname ? 'child_firstname-error' : undefined}
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                  />
                </div>
                {errors.child_firstname && (
                  <p id="child_firstname-error" className="mt-1.5 text-sm text-destructive">{errors.child_firstname.message}</p>
                )}
              </div>

              {/* Nachname */}
              <div>
                <label htmlFor="child_lastname" className="block text-sm font-medium text-foreground mb-2">
                  Nachname *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    id="child_lastname"
                    type="text"
                    {...register('child_lastname')}
                    placeholder="Muster"
                    aria-invalid={!!errors.child_lastname}
                    aria-describedby={errors.child_lastname ? 'child_lastname-error' : undefined}
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                  />
                </div>
                {errors.child_lastname && (
                  <p id="child_lastname-error" className="mt-1.5 text-sm text-destructive">{errors.child_lastname.message}</p>
                )}
              </div>

              {/* Geschlecht -- fieldset/legend statt <label>, weil ein <label> nur EIN Control
                  beschreiben darf, nicht eine Gruppe von drei Radios (WCAG 1.3.1/4.1.2). Die drei
                  Radios selbst waren bereits korrekt je einzeln in ein eigenes <label> gewrappt. */}
              <fieldset
                className="min-w-0 border-0 p-0 m-0"
                aria-describedby={errors.child_gender ? 'child_gender-error' : undefined}
              >
                <legend className="block text-sm font-medium text-foreground mb-2">
                  Geschlecht *
                </legend>
                <div className="flex gap-4 h-11 items-center">
                  {[
                    { value: 'm', label: 'Männlich' },
                    { value: 'w', label: 'Weiblich' },
                    { value: 'd', label: 'Divers' },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="radio"
                        value={option.value}
                        {...register('child_gender')}
                        className="w-4 h-4 text-primary border-border focus:ring-primary"
                      />
                      <span className="text-sm text-foreground">{option.label}</span>
                    </label>
                  ))}
                </div>
                {errors.child_gender && (
                  <p id="child_gender-error" className="mt-1.5 text-sm text-destructive">{errors.child_gender.message}</p>
                )}
              </fieldset>
            </div>
          </div>

          {/* Eltern-Kontakt */}
          <div className="pt-4 border-t border-border">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Kontaktdaten der Eltern
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* E-Mail */}
              <div>
                <label htmlFor="parent_email" className="block text-sm font-medium text-foreground mb-2">
                  E-Mail *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    id="parent_email"
                    type="email"
                    {...register('parent_email')}
                    placeholder="eltern@beispiel.ch"
                    aria-invalid={!!errors.parent_email}
                    aria-describedby={errors.parent_email ? 'parent_email-error' : undefined}
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                  />
                </div>
                {errors.parent_email && (
                  <p id="parent_email-error" className="mt-1.5 text-sm text-destructive">{errors.parent_email.message}</p>
                )}
              </div>

              {/* Telefon */}
              <div>
                <label htmlFor="parent_phone" className="block text-sm font-medium text-foreground mb-2">
                  Telefon *
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    id="parent_phone"
                    type="tel"
                    {...register('parent_phone')}
                    placeholder="+41 79 123 45 67"
                    aria-invalid={!!errors.parent_phone}
                    aria-describedby={errors.parent_phone ? 'parent_phone-error' : undefined}
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                  />
                </div>
                {errors.parent_phone && (
                  <p id="parent_phone-error" className="mt-1.5 text-sm text-destructive">{errors.parent_phone.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Bemerkungen */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-foreground mb-2">
              Bemerkungen (optional)
            </label>
            <div className="relative">
              <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <textarea
                id="notes"
                {...register('notes')}
                rows={2}
                placeholder="Allergien, besondere Bedürfnisse, etc."
                aria-invalid={!!errors.notes}
                aria-describedby={errors.notes ? 'notes-error' : undefined}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors resize-none"
              />
            </div>
            {errors.notes && (
              <p id="notes-error" className="mt-1.5 text-sm text-destructive">{errors.notes.message}</p>
            )}
          </div>

          {/* Server Error */}
          {submitState === 'error' && serverMessage && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{serverMessage}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 px-6 rounded-xl border border-border font-medium hover:bg-muted transition-colors"
            >
              Abbrechen
            </button>
            <Button 
              type="submit" 
              className="flex-1 h-12 rounded-xl font-semibold"
              disabled={submitState === 'loading'}
            >
              {submitState === 'loading' ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Wird gesendet...
                </>
              ) : (
                <>
                  <GraduationCap className="mr-2 h-5 w-5" />
                  Verbindlich anmelden
                </>
              )}
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Mit der Anmeldung akzeptierst du unsere Datenschutzbestimmungen und AGB.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  )
}
