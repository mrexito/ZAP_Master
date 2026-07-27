'use client'

// Schritt 10b: orchestriert CourseDayPicker/ReleaseMaterialSelector/StudentReleasePreview sowie
// den "Freigabestatus"-Bereich und die Notfallsperre aus Layout_Admin_Tagesfreigaben.html.

import { useEffect, useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { CourseDayPicker } from './course-day-picker'
import { ReleaseMaterialSelector, keyOf, type SelectedKey } from './release-material-selector'
import { StudentReleasePreview } from './student-release-preview'
import type { CourseDayDB, DailyReleaseStatus, ReleaseContentItem } from '@/types/kurs-tagesfreigabe'
import {
  getOrCreateCourseDays,
  getReleaseStatusesForSession,
  getReleaseContentOptions,
  getReleaseForDay,
  saveReleaseAction,
  revokeReleaseAction,
  emergencyLockSessionAction,
  type SessionOption,
} from '@/app/(dashboard)/dashboard/kurse/durchfuehrungen/tagesfreigaben-actions'
import { utcIsoToZurichLocal } from '@/lib/utils/zurich-time'

const WEEKDAY_LABELS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

function dayLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00Z')
  return `${WEEKDAY_LABELS[date.getUTCDay()]}, ${date.toLocaleDateString('de-CH', { day: '2-digit', month: 'long', timeZone: 'UTC' })}`
}

function todayInZurich(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Zurich',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

const STATUS_COPY: Record<DailyReleaseStatus | 'empty', { title: string; copy: string }> = {
  draft: { title: 'Entwurf', copy: 'Noch nicht für Lernende sichtbar' },
  scheduled: { title: 'Geplant', copy: 'Öffnet automatisch zum gewählten Zeitpunkt' },
  active: { title: 'Freigegeben', copy: 'Für Lernende sichtbar (innerhalb des Zeitfensters)' },
  revoked: { title: 'Zurückgezogen', copy: 'Zugriff beendet' },
  empty: { title: 'Nicht vorbereitet', copy: 'Noch keine Inhalte ausgewählt' },
}

export function DailyReleaseManager({
  offerId,
  editionId,
  sessions,
}: {
  offerId: number
  editionId: string
  sessions: SessionOption[]
}) {
  const [kursId, setKursId] = useState<number | null>(sessions[0]?.kursId ?? null)
  const [days, setDays] = useState<CourseDayDB[]>([])
  const [statusByDayId, setStatusByDayId] = useState<Record<string, DailyReleaseStatus | 'empty'>>({})
  const [activeDayId, setActiveDayId] = useState<string | null>(null)
  const [contentOptions, setContentOptions] = useState<ReleaseContentItem[]>([])
  const [selectedKeys, setSelectedKeys] = useState<Set<SelectedKey>>(new Set())
  const [selectedByKey, setSelectedByKey] = useState<Map<SelectedKey, ReleaseContentItem>>(new Map())
  const [mode, setMode] = useState<'now' | 'scheduled'>('now')
  const [opensAt, setOpensAt] = useState('')
  const [closesAt, setClosesAt] = useState('')
  const [loading, startLoadingTransition] = useTransition()
  const [submitState, setSubmitState] = useState<'idle' | 'saving' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [currentStatus, setCurrentStatus] = useState<DailyReleaseStatus | 'empty'>('empty')

  useEffect(() => {
    getReleaseContentOptions().then((result) => {
      if (result.success && result.data) setContentOptions(result.data)
    })
  }, [])

  useEffect(() => {
    if (kursId == null) return
    let ignore = false
    // startTransition mit einer async Funktion (React 19): isPending bleibt waehrend der gesamten
    // await-Kette wahr, ohne dass hier ein direkter setLoading-Aufruf im Effect-Koerper noetig ist
    // -- das ist der von react-hooks/set-state-in-effect sanktionierte Weg fuer genau diesen
    // "Session gewechselt, neu laden"-Fall.
    startLoadingTransition(async () => {
      const [daysResult, statusResult] = await Promise.all([
        getOrCreateCourseDays(kursId),
        getReleaseStatusesForSession(kursId),
      ])
      if (ignore) return
      if (daysResult.success && daysResult.data) {
        setDays(daysResult.data)
        const today = todayInZurich()
        setActiveDayId(daysResult.data.find((day) => day.course_date === today)?.id ?? daysResult.data[0]?.id ?? null)
      }
      if (statusResult.success && statusResult.data) {
        setStatusByDayId(statusResult.data)
      }
    })
    return () => {
      ignore = true
    }
  }, [kursId])

  useEffect(() => {
    if (!activeDayId) return
    getReleaseForDay(activeDayId).then((result) => {
      setMessage('')
      if (!result.success || !result.data) return
      const { release, items } = result.data
      const keys = new Set<SelectedKey>()
      const byKey = new Map<SelectedKey, ReleaseContentItem>()
      for (const item of items) {
        const key = keyOf(item.content.kind, item.content.sourceId)
        keys.add(key)
        byKey.set(key, item.content)
      }
      setSelectedKeys(keys)
      setSelectedByKey(byKey)
      setCurrentStatus(release?.status ?? 'empty')
      setMode(release?.status === 'scheduled' ? 'scheduled' : 'now')
      // Gespeicherter Wert ist UTC -- ein reines .slice(0, 16) würde die UTC-Ziffern unverändert
      // als Zürcher Ortszeit anzeigen und damit um 1-2 Stunden danebenliegen, siehe zurich-time.ts.
      setOpensAt(release?.opens_at ? utcIsoToZurichLocal(release.opens_at) : '')
      setClosesAt(release?.closes_at ? utcIsoToZurichLocal(release.closes_at) : '')
    })
  }, [activeDayId])

  const handleToggle = (item: ReleaseContentItem) => {
    const key = keyOf(item.kind, item.sourceId)
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
    setSelectedByKey((prev) => {
      const next = new Map(prev)
      if (next.has(key)) next.delete(key)
      else next.set(key, item)
      return next
    })
  }

  const handleSave = async (status: 'draft' | 'scheduled' | 'active') => {
    if (!activeDayId) return
    setSubmitState('saving')
    setMessage('')
    const selectedItems = Array.from(selectedKeys).map((key) => {
      const [kind, sourceId] = key.split(':') as [ReleaseContentItem['kind'], string]
      return { kind, sourceId }
    })
    const result = await saveReleaseAction(activeDayId, offerId, editionId, status, {
      mode: status === 'scheduled' ? 'scheduled' : 'now',
      opensAt: opensAt || null,
      closesAt: closesAt || null,
      selectedItems,
    })
    if (result.success) {
      setSubmitState('idle')
      setMessage(result.message)
      setCurrentStatus(status)
      setStatusByDayId((prev) => ({ ...prev, [activeDayId]: status }))
    } else {
      setSubmitState('error')
      setMessage(result.error)
    }
  }

  const handleRevoke = async () => {
    if (!activeDayId) return
    setSubmitState('saving')
    const result = await revokeReleaseAction(activeDayId, offerId, editionId)
    if (result.success) {
      setSubmitState('idle')
      setMessage(result.message)
      setCurrentStatus('revoked')
      setStatusByDayId((prev) => ({ ...prev, [activeDayId]: 'revoked' }))
    } else {
      setSubmitState('error')
      setMessage(result.error)
    }
  }

  const handleEmergencyLock = async () => {
    if (kursId == null) return
    setSubmitState('saving')
    const result = await emergencyLockSessionAction(kursId, offerId, editionId)
    if (result.success) {
      setSubmitState('idle')
      setMessage(result.message)
      setStatusByDayId((prev) => {
        const next = { ...prev }
        for (const day of days) next[day.id] = 'revoked'
        return next
      })
      setCurrentStatus('revoked')
    } else {
      setSubmitState('error')
      setMessage(result.error)
    }
  }

  const activeDay = days.find((d) => d.id === activeDayId) ?? null
  const statusCopy = STATUS_COPY[currentStatus]
  const selectedItems = Array.from(selectedByKey.values())

  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">Tagesfreigaben</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Diese Durchführung hat noch keine Termine. Lege zuerst Termine unter „3 · Termine &amp; Kapazität“ an.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-5 flex flex-wrap items-end gap-4 justify-between">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs font-semibold text-foreground mb-1.5">Kursgruppe</label>
          <select
            className="w-full h-11 px-3 rounded-xl border border-border bg-background text-sm"
            value={kursId ?? ''}
            onChange={(event) => setKursId(Number(event.target.value))}
          >
            {sessions.map((session) => (
              <option key={session.kursId} value={session.kursId}>
                {session.label}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" variant="outline" className="text-destructive" onClick={handleEmergencyLock} disabled={submitState === 'saving'}>
          Alle Freigaben dieser Kursgruppe sperren
        </Button>
      </section>

      <div className="rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm text-foreground flex gap-3">
        <span>ⓘ</span>
        <span>
          <strong className="block">Zugriff folgt der Kursanmeldung.</strong>
          Nur aktiv eingeschriebene Lernende dieser Kursgruppe sehen freigegebene Inhalte.
        </span>
      </div>

      {message && (
        <div className={`rounded-xl border p-3 text-sm ${submitState === 'error' ? 'border-destructive/50 bg-destructive/10 text-destructive' : 'border-secondary/50 bg-secondary/10'}`}>
          {message}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm p-6">
          <Loader2 className="h-4 w-4 animate-spin" /> Kurstage werden geladen …
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[230px_minmax(0,1fr)_330px] gap-4 items-start">
          <CourseDayPicker days={days} activeDayId={activeDayId} statusByDayId={statusByDayId} onSelect={setActiveDayId} />

          <ReleaseMaterialSelector items={contentOptions} selectedKeys={selectedKeys} onToggle={handleToggle} />

          <aside className="space-y-4">
            <section className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="p-4 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
                <small className="font-mono text-[10px] uppercase tracking-wide opacity-80">Freigabestatus</small>
                <h2 className="text-lg mt-1">{statusCopy.title}</h2>
                <p className="text-xs opacity-85 mt-1">{statusCopy.copy}</p>
              </div>
              <div className="p-4 space-y-3">
                <label className="flex gap-2.5 items-start border border-border rounded-lg p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input type="radio" name="release-mode" checked={mode === 'now'} onChange={() => setMode('now')} className="mt-1" />
                  <span>
                    <strong className="block text-sm">Jetzt freigeben</strong>
                    <small className="text-xs text-muted-foreground">Sofort im Schüler-Dashboard sichtbar</small>
                  </span>
                </label>
                <label className="flex gap-2.5 items-start border border-border rounded-lg p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input type="radio" name="release-mode" checked={mode === 'scheduled'} onChange={() => setMode('scheduled')} className="mt-1" />
                  <span>
                    <strong className="block text-sm">Zeitlich planen</strong>
                    <small className="text-xs text-muted-foreground">Automatisch öffnen und schliessen</small>
                  </span>
                </label>
                {mode === 'scheduled' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Öffnet</label>
                      <input type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} className="w-full h-9 px-2 rounded-lg border border-border bg-background text-xs" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Schliesst</label>
                      <input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} className="w-full h-9 px-2 rounded-lg border border-border bg-background text-xs" />
                    </div>
                  </div>
                )}
                <Button
                  type="button"
                  className="w-full"
                  disabled={submitState === 'saving' || selectedKeys.size === 0}
                  onClick={() => handleSave(mode === 'scheduled' ? 'scheduled' : 'active')}
                >
                  {submitState === 'saving' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {selectedKeys.size} Inhalte {mode === 'scheduled' ? 'planen' : 'jetzt freigeben'}
                </Button>
                <Button type="button" variant="outline" className="w-full" disabled={submitState === 'saving'} onClick={() => handleSave('draft')}>
                  Als Entwurf speichern
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-destructive"
                  disabled={submitState === 'saving' || currentStatus === 'revoked' || currentStatus === 'empty'}
                  onClick={handleRevoke}
                >
                  Freigabe zurückziehen
                </Button>
                <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                  <strong className="text-foreground">Sicherheitsprüfung:</strong> Die Freigabe gilt nur für diese
                  Durchführung, Kursgruppe und diesen Tag. Zeitzone: Europe/Zurich.
                </p>
              </div>
            </section>

            <StudentReleasePreview dayLabel={activeDay ? dayLabel(activeDay.course_date) : ''} selectedItems={selectedItems} />
          </aside>
        </div>
      )}
    </div>
  )
}
