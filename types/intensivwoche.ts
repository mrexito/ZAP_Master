import { z } from 'zod'

// Zod Schema für Formular-Validierung
export const intensivwocheAnmeldungSchema = z.object({
  kurs_id: z.string().min(1, 'Bitte wähle einen Kurs aus'),
  child_firstname: z
    .string()
    .min(2, 'Vorname muss mindestens 2 Zeichen haben')
    .max(50, 'Vorname darf maximal 50 Zeichen haben'),
  child_lastname: z
    .string()
    .min(2, 'Nachname muss mindestens 2 Zeichen haben')
    .max(50, 'Nachname darf maximal 50 Zeichen haben'),
  child_gender: z.enum(['m', 'w', 'd'], {
    message: 'Bitte wähle ein Geschlecht',
  }),
  parent_email: z
    .string()
    .email('Bitte gib eine gültige E-Mail-Adresse ein'),
  parent_phone: z
    .string()
    .min(10, 'Telefonnummer muss mindestens 10 Zeichen haben')
    .max(20, 'Telefonnummer darf maximal 20 Zeichen haben')
    .regex(/^[\d\s+\-()]+$/, 'Bitte gib eine gültige Telefonnummer ein'),
  notes: z
    .string()
    .max(500, 'Bemerkungen dürfen maximal 500 Zeichen haben')
    .optional(),
})

export type IntensivwocheAnmeldungInput = z.infer<typeof intensivwocheAnmeldungSchema>

// Database Row Type (nach INSERT)
export interface IntensivwocheAnmeldung extends IntensivwocheAnmeldungInput {
  id: string
  child_class_level: string
  status: 'eingegangen' | 'bestaetigt' | 'bezahlt' | 'storniert'
  created_at: string
  paid_at: string | null
}
