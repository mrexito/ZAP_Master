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

// ---------------------------------------------------------------------------------------------
// Ferienwochen-Verwaltung (school_holiday_weeks, Migration 20260728090000). Ersetzt die vormals
// hart codierten Konstanten in lib/kurse/fixed-school-schedule.ts durch admin-pflegbare Daten --
// siehe "Ferienwochen verwalten" in session-editor.tsx.
// ---------------------------------------------------------------------------------------------

// 'langzeitgymi'/'kurzzeitgymi'/'bms'/'matura' fuer holiday_type='intensiv' (mehrere Klassenstufen
// teilen sich denselben Sportferien-Fixplan); '4'/'5'/'6'/'1-sek'/'2-3-sek' fuer holiday_type=
// 'vorkurs' (jede Klassenstufe hat eigene, real bestätigte Wochen -- siehe Kommentar in
// lib/kurse/fixed-school-schedule.ts).
export const SCHEDULE_GROUP_KEY_OPTIONEN = [
  'langzeitgymi',
  'kurzzeitgymi',
  'bms',
  'matura',
  '4',
  '5',
  '6',
  '1-sek',
  '2-3-sek',
] as const
export type ScheduleGroupKeyOption = (typeof SCHEDULE_GROUP_KEY_OPTIONEN)[number]

export const HOLIDAY_TYPE_OPTIONEN = ['vorkurs', 'intensiv'] as const
export type HolidayTypeOption = (typeof HOLIDAY_TYPE_OPTIONEN)[number]

export const HOLIDAY_WEEKS_LOCATION_OPTIONEN = ['Zürich HB', 'Winterthur', 'ALL'] as const
export type HolidayWeeksLocationOption = (typeof HOLIDAY_WEEKS_LOCATION_OPTIONEN)[number]

// calendarWeeksInput bleibt im Formular ein einzelnes komma-getrenntes Textfeld (z.B. "7, 8") --
// einfacher zu bedienen als ein dynamisches Array-Input-Feld für typischerweise 1-11 Werte.
export const schoolHolidayWeeksFormSchema = z
  .object({
    schoolYear: z
      .string()
      .trim()
      .min(4, 'Schul-/Prüfungsjahr ist erforderlich')
      .max(20, 'Schul-/Prüfungsjahr darf maximal 20 Zeichen haben'),
    scheduleGroup: z.enum(SCHEDULE_GROUP_KEY_OPTIONEN, { message: 'Bitte eine Gruppe wählen' }),
    holidayType: z.enum(HOLIDAY_TYPE_OPTIONEN, { message: 'Bitte Vorkurs oder Intensiv wählen' }),
    location: z.enum(HOLIDAY_WEEKS_LOCATION_OPTIONEN, { message: 'Bitte einen Standort wählen' }),
    calendarWeeksInput: z
      .string()
      .trim()
      .min(1, 'Mindestens eine Kalenderwoche ist erforderlich')
      .refine((value) => {
        const weeks = value.split(',').map((part) => part.trim()).filter(Boolean)
        return weeks.length > 0 && weeks.every((week) => /^\d{1,2}$/.test(week) && Number(week) >= 1 && Number(week) <= 53)
      }, 'Kalenderwochen als kommagetrennte Liste von 1–53 angeben, z.B. "7, 8"'),
  })
  // 'vorkurs' ist standortunabhängig (nutzt den Sentinel 'ALL'), 'intensiv' braucht immer einen
  // echten Standort -- vermeidet doppelte Zeilen für denselben Vorkurs unter zwei Standorten.
  .refine((data) => (data.holidayType === 'vorkurs' ? data.location === 'ALL' : data.location !== 'ALL'), {
    message: 'Vorkurs verwendet immer "ALL", Intensiv braucht Zürich HB oder Winterthur.',
    path: ['location'],
  })

export type SchoolHolidayWeeksFormInput = z.infer<typeof schoolHolidayWeeksFormSchema>

export interface SchoolHolidayWeekDB {
  id: string
  school_year: string
  schedule_group: ScheduleGroupKeyOption
  holiday_type: HolidayTypeOption
  location: HolidayWeeksLocationOption
  calendar_weeks: number[]
  updated_by: string | null
  updated_at: string
}
