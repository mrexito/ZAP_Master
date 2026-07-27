import { z } from 'zod'

// Schritt 10b (Abschnitt 2.13 des Architektur-Briefings): Domain-Typen fuer die Tagesfreigaben-
// Lehrpersonen-Maske. learning_materials/exercises/trainer_exams werden auf eine gemeinsame
// Anzeigeform abgebildet, damit
// ReleaseMaterialSelector eine einzige Liste durchsuchen kann, ohne dass die UI zwei
// unterschiedliche Quelltypen kennen muss.

export type CourseDayDB = {
  id: string
  session_id: number
  sequence: number
  course_date: string
}

export type ReleaseContentCatalogDB = {
  id: string
  kind: 'learning_material' | 'exercise' | 'trainer_exam'
  learning_material_id: number | null
  exercise_id: number | null
  trainer_exam_id: string | null
  created_at: string
}

export type DailyReleaseStatus = 'draft' | 'scheduled' | 'active' | 'revoked'

export type DailyReleaseDB = {
  id: string
  course_day_id: string
  status: DailyReleaseStatus
  opens_at: string | null
  closes_at: string | null
  version: number
  published_by: string | null
  published_at: string | null
  revoked_at: string | null
  created_at: string
  updated_at: string
}

export type DailyReleaseItemDB = {
  release_id: string
  content_item_id: string
  position: number
}

/** Einheitliche Anzeigeform fuer Lerneinheiten, Übungen und bestehende Prüfungsinhalte. */
export type ReleaseContentItem = {
  kind: 'learning_material' | 'exercise' | 'trainer_exam'
  sourceId: string
  title: string
  subject: string
  typeLabel: string
  /** vorhandene release_content_catalog.id, falls dieses Item schon einmal kuratiert wurde */
  catalogId: string | null
}

/** Ein bereits kuratiertes Item innerhalb einer konkreten Freigabe, mit Reihenfolge. */
export type DailyReleaseItemWithContent = {
  contentItemId: string
  position: number
  content: ReleaseContentItem
}

export const releaseFormSchema = z
  .object({
    mode: z.enum(['now', 'scheduled']),
    opensAt: z.string().optional().nullable(),
    closesAt: z.string().optional().nullable(),
    selectedItems: z
      .array(z.object({ kind: z.enum(['learning_material', 'exercise', 'trainer_exam']), sourceId: z.string() }))
      .min(1, 'Mindestens ein Inhalt muss ausgewählt sein.'),
  })
  .refine((data) => data.mode !== 'scheduled' || (data.opensAt && data.closesAt), {
    message: 'Bei zeitlicher Planung sind Öffnen und Schliessen Pflicht.',
    path: ['opensAt'],
  })
  .refine(
    (data) => data.mode !== 'scheduled' || !data.opensAt || !data.closesAt || data.opensAt < data.closesAt,
    { message: 'Öffnet muss vor Schliesst liegen.', path: ['closesAt'] }
  )

export type ReleaseFormInput = z.infer<typeof releaseFormSchema>

export type TagesfreigabenActionResult<T = void> =
  | { success: true; data?: T; message: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> }
