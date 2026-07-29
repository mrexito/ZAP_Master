import { z } from 'zod'
import { MATERIAL_AREA_IDS, type MaterialAreaId } from './kurs-materialien'

// All material category values used in the form and stored in the DB
export const MATERIAL_TYPES = [
  'document',
  'worksheet',
  'exercise',
  'solution',
  'summary',
  'video',
  'link',
  'other',
] as const

export const createMaterialSchema = z.object({
  name: z
    .string()
    .min(1, 'Name ist erforderlich')
    .max(200, 'Name darf maximal 200 Zeichen haben'),
  description: z
    .string()
    .max(500, 'Beschreibung darf maximal 500 Zeichen haben')
    .optional(),
  subject_id: z
    .number({ message: 'Fach muss eine Zahl sein' })
    .int('Fach muss eine ganze Zahl sein')
    .positive('Bitte wähle ein Fach aus'),
  // Upload mode: 'file' for file upload, 'link' for URL bookmark
  type: z.enum(['file', 'link'], {
    message: "Typ muss 'file' oder 'link' sein",
  }),
  url: z
    .string()
    .url('Bitte gib eine gültige URL ein')
    .optional(),
  // Storage-Pfad einer per Signed-Upload-URL hochgeladenen Datei (kein Public-URL mehr,
  // siehe Abschnitt 2.11: der lernmaterialien-Bucket ist privat).
  download_path: z
    .string()
    .optional(),
  file_size: z
    .number({ message: 'Dateigrösse muss eine Zahl sein' })
    .int('Dateigrösse muss eine ganze Zahl sein')
    .min(0, 'Dateigrösse darf nicht negativ sein')
    .optional(),
  // Einer der vier geschützten Materialbereiche (Abschnitt 2.11); leer/undefined bedeutet
  // frei zugängliches Material (is_public = true), kein Materialbereich.
  area_id: z
    .enum(MATERIAL_AREA_IDS as [MaterialAreaId, ...MaterialAreaId[]], {
      message: 'Unbekannter Materialbereich.',
    })
    .optional(),
})

export type CreateMaterialInput = z.infer<typeof createMaterialSchema>
