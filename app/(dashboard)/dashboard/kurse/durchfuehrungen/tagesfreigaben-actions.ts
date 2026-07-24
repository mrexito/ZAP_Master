'use server'

// Schritt 10b (Abschnitt 2.13 des Architektur-Briefings): Server Actions fuer die
// Tagesfreigaben-Admin-Maske. Wie durchfuehrungen/actions.ts durchgehend admin-only
// (requireAdminAuth()) und createAuthenticatedSupabaseClient() -- deckt sich mit den RLS-Policies
// aus Migration 20260721082939_daily_releases_schema.sql.
//
// Vereinfachung gegenueber dem Mockup: Der "Fach"-Filter im ReleaseMaterialSelector entfaellt --
// exercises.subject_id verweist auf die subjects-Tabelle des Trainer-Bereichs (andere Domaene als
// die Marketing-Fachfarben aus types/kurs.ts); eine echte Fach-Aufloesung dafuer ist nicht Teil
// dieser Runde. Titel-Suche deckt den praktischen Bedarf ab.

import { createAuthenticatedSupabaseClient } from '@/lib/supabase/server'
import { auth } from '@/lib/auth/config'
import { revalidatePath } from 'next/cache'
import { zurichLocalToUtcIso } from '@/lib/utils/zurich-time'
import {
  releaseFormSchema,
  type ReleaseFormInput,
  type CourseDayDB,
  type ReleaseContentItem,
  type DailyReleaseDB,
  type DailyReleaseStatus,
  type DailyReleaseItemWithContent,
  type TagesfreigabenActionResult,
} from '@/types/kurs-tagesfreigabe'

async function requireAdminAuth(): Promise<
  | { authorized: true; userId: string; supabaseAccessToken: string }
  | { authorized: false; error: TagesfreigabenActionResult<never> }
> {
  const session = await auth()
  if (!session?.user || !session.supabaseAccessToken) {
    return { authorized: false, error: { success: false, error: 'Du musst angemeldet sein, um diese Aktion auszuführen.' } }
  }
  if (session.user.role !== 'admin' && session.user.role !== 'lehrperson') {
    return { authorized: false, error: { success: false, error: 'Nur Lehrpersonen sowie Administratorinnen und Administratoren dürfen Tagesfreigaben verwalten.' } }
  }
  return { authorized: true, userId: session.user.id, supabaseAccessToken: session.supabaseAccessToken }
}

export type SessionOption = {
  kursId: number
  label: string
  standort: string
  startDatum: string
  endDatum: string
}

// 1) Kursgruppen (course_sessions) einer Edition, mit Kursdaten fuer die Anzeige.
export async function getSessionsForEdition(editionId: string): Promise<TagesfreigabenActionResult<SessionOption[]>> {
  const authCheck = await requireAdminAuth()
  if (!authCheck.authorized) return authCheck.error

  const supabase = createAuthenticatedSupabaseClient(authCheck.supabaseAccessToken)
  const { data, error } = await supabase
    .from('course_sessions')
    .select('id, kurs:intensivwoche_kurse!course_sessions_id_fkey(id, name, ort, uhrzeit, start_datum, end_datum)')
    .eq('edition_id', editionId)

  if (error) {
    console.error('Supabase Error:', error)
    return { success: false, error: 'Kursgruppen konnten nicht geladen werden.' }
  }

  type Row = { id: number; kurs: { name: string; ort: string; uhrzeit: string; start_datum: string; end_datum: string } | null }
  const options: SessionOption[] = (data as unknown as Row[])
    .filter((row) => row.kurs)
    .map((row) => ({
      kursId: row.id,
      label: `${row.kurs!.ort} · ${row.kurs!.uhrzeit}`,
      standort: row.kurs!.ort,
      startDatum: row.kurs!.start_datum,
      endDatum: row.kurs!.end_datum,
    }))

  return { success: true, data: options, message: 'Kursgruppen geladen' }
}

// 2) Kurstage einer Session -- werden beim ersten Zugriff aus dem Datumsbereich des Kurses
//    generiert, falls noch keine existieren (Abschnitt 2.13: i.d.R. 5 Wochentage).
export async function getOrCreateCourseDays(kursId: number): Promise<TagesfreigabenActionResult<CourseDayDB[]>> {
  const authCheck = await requireAdminAuth()
  if (!authCheck.authorized) return authCheck.error

  const supabase = createAuthenticatedSupabaseClient(authCheck.supabaseAccessToken)
  const { data: existing, error: existingError } = await supabase
    .from('course_days')
    .select('*')
    .eq('session_id', kursId)
    .order('sequence', { ascending: true })

  if (existingError) {
    console.error('Supabase Error:', existingError)
    return { success: false, error: 'Kurstage konnten nicht geladen werden.' }
  }
  if (existing.length > 0) {
    return { success: true, data: existing as CourseDayDB[], message: 'Kurstage geladen' }
  }

  const { data: kurs, error: kursError } = await supabase
    .from('intensivwoche_kurse')
    .select('start_datum, end_datum')
    .eq('id', kursId)
    .single()

  if (kursError || !kurs) {
    return { success: false, error: 'Kurs für die Tagesgenerierung nicht gefunden.' }
  }

  const days: { session_id: number; sequence: number; course_date: string }[] = []
  const start = new Date(kurs.start_datum)
  const end = new Date(kurs.end_datum)
  let sequence = 1
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push({ session_id: kursId, sequence, course_date: d.toISOString().slice(0, 10) })
    sequence += 1
  }

  const { data: created, error: createError } = await supabase.from('course_days').insert(days).select()

  if (createError) {
    console.error('Supabase Error:', createError)
    return { success: false, error: 'Kurstage konnten nicht angelegt werden.' }
  }

  return { success: true, data: created as CourseDayDB[], message: 'Kurstage generiert' }
}

// 2b) Freigabestatus je Kurstag in einem Rutsch (Punkte im CourseDayPicker) statt einer Anfrage
//     pro Tag.
export async function getReleaseStatusesForSession(
  kursId: number
): Promise<TagesfreigabenActionResult<Record<string, DailyReleaseStatus>>> {
  const authCheck = await requireAdminAuth()
  if (!authCheck.authorized) return authCheck.error

  const supabase = createAuthenticatedSupabaseClient(authCheck.supabaseAccessToken)
  const { data, error } = await supabase
    .from('daily_releases')
    .select('course_day_id, status, course_days!inner(session_id)')
    .eq('course_days.session_id', kursId)

  if (error) {
    console.error('Supabase Error:', error)
    return { success: false, error: 'Freigabestatus konnte nicht geladen werden.' }
  }

  const statuses: Record<string, DailyReleaseStatus> = {}
  for (const row of data as unknown as { course_day_id: string; status: DailyReleaseStatus }[]) {
    statuses[row.course_day_id] = row.status
  }
  return { success: true, data: statuses, message: 'Status geladen' }
}

// 3) Kombinierte Auswahlliste aus exercises + trainer_exams (beide bereits oeffentlich lesbar) fuer
//    ReleaseMaterialSelector, angereichert um eine vorhandene release_content_catalog.id.
export async function getReleaseContentOptions(): Promise<TagesfreigabenActionResult<ReleaseContentItem[]>> {
  const authCheck = await requireAdminAuth()
  if (!authCheck.authorized) return authCheck.error

  const supabase = createAuthenticatedSupabaseClient(authCheck.supabaseAccessToken)
  const [exercisesResult, examsResult, catalogResult] = await Promise.all([
    supabase.from('exercises').select('id, title, type').order('id', { ascending: true }),
    supabase.from('trainer_exams').select('id, title, subject').order('id', { ascending: true }),
    supabase.from('release_content_catalog').select('*'),
  ])

  if (exercisesResult.error || examsResult.error || catalogResult.error) {
    console.error('Supabase Error:', exercisesResult.error, examsResult.error, catalogResult.error)
    return { success: false, error: 'Materialliste konnte nicht geladen werden.' }
  }

  const catalogByExercise = new Map<number, string>()
  const catalogByExam = new Map<string, string>()
  for (const row of catalogResult.data ?? []) {
    if (row.exercise_id != null) catalogByExercise.set(row.exercise_id, row.id)
    if (row.trainer_exam_id != null) catalogByExam.set(row.trainer_exam_id, row.id)
  }

  const items: ReleaseContentItem[] = [
    ...(exercisesResult.data ?? []).map((e) => ({
      kind: 'exercise' as const,
      sourceId: String(e.id),
      title: e.title ?? `Übung #${e.id}`,
      subject: e.type ?? '',
      typeLabel: 'Übung',
      catalogId: catalogByExercise.get(e.id) ?? null,
    })),
    ...(examsResult.data ?? []).map((t) => ({
      kind: 'trainer_exam' as const,
      sourceId: t.id,
      title: t.title,
      subject: t.subject,
      typeLabel: 'Prüfung',
      catalogId: catalogByExam.get(t.id) ?? null,
    })),
  ]

  return { success: true, data: items, message: 'Materialliste geladen' }
}

// 4) Aktuelle Freigabe eines Kurstags inkl. kuratierter Inhalte.
export async function getReleaseForDay(
  courseDayId: string
): Promise<TagesfreigabenActionResult<{ release: DailyReleaseDB | null; items: DailyReleaseItemWithContent[] }>> {
  const authCheck = await requireAdminAuth()
  if (!authCheck.authorized) return authCheck.error

  const supabase = createAuthenticatedSupabaseClient(authCheck.supabaseAccessToken)
  const { data: release, error: releaseError } = await supabase
    .from('daily_releases')
    .select('*')
    .eq('course_day_id', courseDayId)
    .maybeSingle()

  if (releaseError) {
    console.error('Supabase Error:', releaseError)
    return { success: false, error: 'Freigabe konnte nicht geladen werden.' }
  }
  if (!release) {
    return { success: true, data: { release: null, items: [] }, message: 'Kein Entwurf vorhanden' }
  }

  const { data: items, error: itemsError } = await supabase
    .from('daily_release_items')
    .select('position, content_item_id, catalog:release_content_catalog(*)')
    .eq('release_id', release.id)
    .order('position', { ascending: true })

  if (itemsError) {
    console.error('Supabase Error:', itemsError)
    return { success: false, error: 'Freigabe-Inhalte konnten nicht geladen werden.' }
  }

  type ItemRow = {
    position: number
    content_item_id: string
    catalog: { id: string; kind: 'exercise' | 'trainer_exam'; exercise_id: number | null; trainer_exam_id: string | null } | null
  }

  const exerciseIds = (items as unknown as ItemRow[])
    .map((i) => i.catalog?.exercise_id)
    .filter((v): v is number => v != null)
  const examIds = (items as unknown as ItemRow[])
    .map((i) => i.catalog?.trainer_exam_id)
    .filter((v): v is string => v != null)

  const [exercisesResult, examsResult] = await Promise.all([
    exerciseIds.length > 0
      ? supabase.from('exercises').select('id, title, type').in('id', exerciseIds)
      : Promise.resolve({ data: [], error: null }),
    examIds.length > 0
      ? supabase.from('trainer_exams').select('id, title, subject').in('id', examIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  const exerciseById = new Map((exercisesResult.data ?? []).map((e) => [e.id, e]))
  const examById = new Map((examsResult.data ?? []).map((t) => [t.id, t]))

  const detailed: DailyReleaseItemWithContent[] = (items as unknown as ItemRow[])
    .map((row): DailyReleaseItemWithContent | null => {
      if (!row.catalog) return null
      if (row.catalog.kind === 'exercise' && row.catalog.exercise_id != null) {
        const ex = exerciseById.get(row.catalog.exercise_id)
        return {
          contentItemId: row.content_item_id,
          position: row.position,
          content: {
            kind: 'exercise' as const,
            sourceId: String(row.catalog.exercise_id),
            title: ex?.title ?? `Übung #${row.catalog.exercise_id}`,
            subject: ex?.type ?? '',
            typeLabel: 'Übung',
            catalogId: row.catalog.id,
          },
        }
      }
      if (row.catalog.kind === 'trainer_exam' && row.catalog.trainer_exam_id != null) {
        const exam = examById.get(row.catalog.trainer_exam_id)
        return {
          contentItemId: row.content_item_id,
          position: row.position,
          content: {
            kind: 'trainer_exam' as const,
            sourceId: row.catalog.trainer_exam_id,
            title: exam?.title ?? row.catalog.trainer_exam_id,
            subject: exam?.subject ?? '',
            typeLabel: 'Prüfung',
            catalogId: row.catalog.id,
          },
        }
      }
      return null
    })
    .filter((v): v is DailyReleaseItemWithContent => v !== null)

  return { success: true, data: { release: release as DailyReleaseDB, items: detailed }, message: 'Freigabe geladen' }
}

// 5) Freigabe speichern (draft/scheduled/active) -- atomar ueber die RPC.
export async function saveReleaseAction(
  courseDayId: string,
  offerId: number,
  editionId: string,
  status: 'draft' | 'scheduled' | 'active',
  input: ReleaseFormInput
): Promise<TagesfreigabenActionResult<string>> {
  const authCheck = await requireAdminAuth()
  if (!authCheck.authorized) return authCheck.error

  const parsed = releaseFormSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    parsed.error.issues.forEach((issue) => {
      const field = issue.path[0] as string
      if (!fieldErrors[field]) fieldErrors[field] = []
      fieldErrors[field].push(issue.message)
    })
    return { success: false, error: 'Bitte überprüfe deine Eingaben.', fieldErrors }
  }

  const data = parsed.data
  const supabase = createAuthenticatedSupabaseClient(authCheck.supabaseAccessToken)

  const { data: releaseId, error } = await supabase.rpc('admin_save_daily_release', {
    p_course_day_id: courseDayId,
    p_status: status,
    // datetime-local trägt keine Zeitzone -- roh übergeben würde die RPC den String beim Cast auf
    // timestamptz in der Session-timezone (UTC) statt in Europe/Zurich interpretieren.
    p_opens_at: data.mode === 'scheduled' && data.opensAt ? zurichLocalToUtcIso(data.opensAt) : undefined,
    p_closes_at: data.mode === 'scheduled' && data.closesAt ? zurichLocalToUtcIso(data.closesAt) : undefined,
    p_items: data.selectedItems.map((item) => ({
      kind: item.kind,
      exercise_id: item.kind === 'exercise' ? Number(item.sourceId) : undefined,
      trainer_exam_id: item.kind === 'trainer_exam' ? item.sourceId : undefined,
    })),
  })

  if (error) {
    console.error('Supabase RPC Error:', error)
    return { success: false, error: 'Freigabe konnte nicht gespeichert werden.' }
  }

  revalidatePath(`/dashboard/kurse/angebote/${offerId}/durchfuehrungen/${editionId}/tagesfreigaben`)
  return {
    success: true,
    data: releaseId as string,
    message: status === 'active' ? 'Inhalte für diese Kursgruppe freigegeben.' : status === 'scheduled' ? 'Freigabe verbindlich geplant.' : 'Entwurf gespeichert.',
  }
}

// 6) Widerruf -- bewusst kein RPC-Aufruf (siehe Migrationskommentar): einfaches Einzeltabellen-
//    UPDATE, das die Item-Liste fuer die Audit-Historie unangetastet laesst.
export async function revokeReleaseAction(
  courseDayId: string,
  offerId: number,
  editionId: string
): Promise<TagesfreigabenActionResult> {
  const authCheck = await requireAdminAuth()
  if (!authCheck.authorized) return authCheck.error

  const supabase = createAuthenticatedSupabaseClient(authCheck.supabaseAccessToken)
  const { error } = await supabase
    .from('daily_releases')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('course_day_id', courseDayId)

  if (error) {
    console.error('Supabase Error:', error)
    return { success: false, error: 'Freigabe konnte nicht zurückgezogen werden.' }
  }

  revalidatePath(`/dashboard/kurse/angebote/${offerId}/durchfuehrungen/${editionId}/tagesfreigaben`)
  return { success: true, message: 'Freigabe zurückgezogen · Zugriff beendet.' }
}

// 7) Notfallsperre: alle nicht bereits widerrufenen Freigaben dieser Kursgruppe sperren.
export async function emergencyLockSessionAction(
  kursId: number,
  offerId: number,
  editionId: string
): Promise<TagesfreigabenActionResult> {
  const authCheck = await requireAdminAuth()
  if (!authCheck.authorized) return authCheck.error

  const supabase = createAuthenticatedSupabaseClient(authCheck.supabaseAccessToken)
  const { data: days, error: daysError } = await supabase.from('course_days').select('id').eq('session_id', kursId)

  if (daysError) {
    console.error('Supabase Error:', daysError)
    return { success: false, error: 'Kurstage konnten nicht geladen werden.' }
  }

  const dayIds = (days ?? []).map((d) => d.id)
  if (dayIds.length === 0) {
    return { success: true, message: 'Keine Kurstage vorhanden.' }
  }

  const { error } = await supabase
    .from('daily_releases')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .in('course_day_id', dayIds)
    .neq('status', 'revoked')

  if (error) {
    console.error('Supabase Error:', error)
    return { success: false, error: 'Notfallsperre konnte nicht ausgeführt werden.' }
  }

  revalidatePath(`/dashboard/kurse/angebote/${offerId}/durchfuehrungen/${editionId}/tagesfreigaben`)
  return { success: true, message: 'Alle Freigaben dieser Kursgruppe gesperrt.' }
}
