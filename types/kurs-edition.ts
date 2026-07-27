import { z } from 'zod'
import type { Fach } from './kurs'

// Schritt 10a: Formulare arbeiten in ganzen CHF (wie die Admin-Referenz, "CHF ___"), die Server
// Actions rechnen erst beim Schreiben in offer_editions.regular_price_rappen (ganze Rappen,
// Abschnitt 2.12/3.3) um -- kein Rappen-Eingabefeld in der UI.
//
// Kein Frühbucherpreis-Feld mehr (Betreiberentscheid 27.07.2026): 10% Rabatt gilt automatisch,
// wenn die Anmeldung mindestens 6 Wochen vor dem in Abschnitt 3 ("Termine") hinterlegten
// Kursstart erfolgt -- berechnet in book_intensivwoche_kurs() und lib/pricing.ts, nicht mehr hier
// manuell gepflegt.
export const offerEditionFormSchema = z.object({
  schoolYear: z
    .string()
    .trim()
    .min(4, 'Schul-/Prüfungsjahr ist erforderlich')
    .max(20, 'Schul-/Prüfungsjahr darf maximal 20 Zeichen haben'),
  publicTitle: z
    .string()
    .trim()
    .min(5, 'Titel muss mindestens 5 Zeichen haben')
    .max(150, 'Titel darf maximal 150 Zeichen haben'),
  tagline: z
    .string()
    .trim()
    .min(5, 'Tagline muss mindestens 5 Zeichen haben')
    .max(150, 'Tagline darf maximal 150 Zeichen haben'),
  description: z
    .string()
    .trim()
    .min(10, 'Kurzbeschreibung muss mindestens 10 Zeichen haben')
    .max(600, 'Kurzbeschreibung darf maximal 600 Zeichen haben'),
  regularPriceChf: z.coerce
    .number({ message: 'Preis muss eine Zahl sein' })
    .int('Preis muss eine ganze Zahl sein')
    .min(0, 'Preis darf nicht negativ sein')
    .max(20000, 'Preis darf maximal CHF 20’000 sein'),
  registrationOpensAt: z.string().optional().nullable(),
  registrationClosesAt: z.string().optional().nullable(),
  status: z.enum(['draft', 'published']),
})

export type OfferEditionFormInput = z.infer<typeof offerEditionFormSchema>

export const STANDORT_OPTIONEN = ['Zürich HB', 'Winterthur'] as const
export type Standort = (typeof STANDORT_OPTIONEN)[number]

export const REGISTRATION_STATUS_OPTIONEN = ['bookable', 'waitlist', 'cancelled'] as const
export type RegistrationStatus = (typeof REGISTRATION_STATUS_OPTIONEN)[number]

export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  bookable: 'Buchbar',
  waitlist: 'Warteliste',
  cancelled: 'Abgesagt',
}

// course_sessions ist nur die 1:1-Erweiterung von intensivwoche_kurse (Abschnitt 2.12) -- fach/
// lehrer/beschreibung sind dort NOT NULL, obwohl die Admin-Referenz sie nicht zeigt (das Formular
// dort geht von reinen Deutsch+Mathematik-Klassenstufenkursen aus, waehrend intensivwoche_kurse.fach
// weiterhin nur EIN Einzelfach zulaesst -- ein bestehender Modellkonflikt, keiner, der hier neu
// entsteht). Deshalb bleiben fach/lehrer bewusst sichtbare Pflichtfelder statt eines stillen,
// erfundenen Default-Werts.
export const courseSessionFormSchema = z
  .object({
    kursId: z.number().int().positive().optional().nullable(),
    fach: z.enum(['mathematik', 'deutsch', 'franzoesisch', 'natur-mensch-gesellschaft'] satisfies [Fach, ...Fach[]], {
      message: 'Bitte wähle ein Fach aus',
    }),
    lehrer: z
      .string()
      .trim()
      .min(2, 'Lehrername muss mindestens 2 Zeichen haben')
      .max(100, 'Lehrername darf maximal 100 Zeichen haben'),
    startDatum: z.string().min(1, 'Start ist erforderlich'),
    endDatum: z.string().min(1, 'Ende ist erforderlich'),
    uhrzeit: z
      .string()
      .trim()
      .min(5, 'Kurszeit ist erforderlich')
      .max(30, 'Kurszeit darf maximal 30 Zeichen haben'),
    standort: z.enum(STANDORT_OPTIONEN, { message: 'Bitte Zürich HB oder Winterthur wählen' }),
    maxTeilnehmer: z.coerce
      .number({ message: 'Kapazität muss eine Zahl sein' })
      .int('Kapazität muss eine ganze Zahl sein')
      .min(1, 'Mindestens 1 Platz')
      .max(50, 'Maximal 50 Plätze'),
    registrationStatus: z.enum(REGISTRATION_STATUS_OPTIONEN),
    deliveryModes: z.array(z.enum(['onsite', 'online'])).min(1, 'Mindestens eine Durchführungsform'),
  })
  .refine((data) => data.endDatum >= data.startDatum, {
    message: 'Ende darf nicht vor dem Start liegen.',
    path: ['endDatum'],
  })

export type CourseSessionFormInput = z.infer<typeof courseSessionFormSchema>

// ---------------------------------------------------------------------------------------------
// DB-Row-Typen (spiegeln types/database.ts, domänennah benannt)
// ---------------------------------------------------------------------------------------------

export interface OfferDB {
  id: number
  audience_id: string
  kurstyp: string
  slug: string
  created_at: string
}

export interface OfferEditionDB {
  id: string
  offer_id: number
  school_year: string
  public_title: string
  tagline: string
  description: string
  regular_price_rappen: number
  currency: string
  registration_opens_at: string | null
  registration_closes_at: string | null
  status: 'draft' | 'published' | 'archived'
  version: number
  created_at: string
  updated_at: string
  published_at: string | null
}

export interface CourseSessionDB {
  id: number
  edition_id: string
  delivery_modes: string[]
  registration_status: string
  version: number
  created_at: string
  updated_at: string
}

// course_sessions gejoint mit der kanonischen intensivwoche_kurse-Zeile -- fuer den SessionEditor
// reicht diese flache Sicht, keine zweite Domain-Session-Struktur.
export interface CourseSessionWithKursDB extends CourseSessionDB {
  kurs: {
    id: number
    name: string
    fach: string
    beschreibung: string
    start_datum: string
    end_datum: string
    uhrzeit: string
    ort: string
    max_teilnehmer: number
    lehrer: string
  }
}

export type EditionActionResult<T = void> =
  | { success: true; data?: T; message: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]>; conflict?: boolean }
