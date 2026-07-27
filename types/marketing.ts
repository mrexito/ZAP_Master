// Marketing-/Kursseiten-Domänenmodell aus design-reference/architektur-briefing-kursseiten.md,
// Abschnitt 2.1–2.9. Reine View-Model-Typen für die neuen öffentlichen Marketing-/Kursseiten
// (Schritt 5, Teil 1 des Ausführungsplans) — kein Ersatz für die bestehenden DB-Typen in
// types/kurs-form.ts/types/intensivwoche.ts, die weiterhin die echte Buchung über
// app/(public)/kurse tragen. Spätere Schritte mappen von dort in dieses Modell.

// ---------------------------------------------------------------------------------------------
// 2.1 Zielgruppe
// ---------------------------------------------------------------------------------------------

export type KlassenstufeId = '4' | '5' | '6' | '1-sek' | '2-3-sek'
export type AudienceId = KlassenstufeId | 'bms' | 'matura'

export type AudienceCapabilities = {
  examSimulation: boolean
  selfStudy: boolean
  distanceLearning: boolean
}

export type Audience = {
  id: AudienceId // stabiler fachlicher Key, nie aus Anzeigetext ableiten
  slug: string // "4-klasse", "2-3-sek", "bms", "matura"
  displayLabel: string // reiner Anzeigetext
  navLabel: string // kompakt: "4.Kl", "2./3.Sek", "BMS"
  href: string // logischer Pfad ohne Locale
  kind: 'gymipruefung' | 'bms' | 'matura'
  kategorie: 'primar' | 'sek' | 'weiterfuehrend'
  zielPruefung: string
  placements: ('nav' | 'heroPicker' | 'serviceGrid')[]
  capabilities: AudienceCapabilities
}

export type Klassenstufe = Audience & {
  id: KlassenstufeId
  kind: 'gymipruefung'
}

// ---------------------------------------------------------------------------------------------
// 2.2 Kurstyp / Offer-Varianten
// ---------------------------------------------------------------------------------------------

export type Kurstyp = 'halbjahreskurs' | 'intensivkurs' | 'pruefungssimulation' | 'selbststudium'
export type Subject = 'de' | 'ma' | 'fr' | 'nmg' | 'mixed'

// Abschnitt 2.11 (Materialzugriff) ist noch nicht Teil dieses Schritts. Nur der stabile id-Union
// wird hier vorgezogen, weil SelfStudyOffer ihn referenziert -- das volle Grant-/Access-Modell
// folgt in einer eigenen, separat geplanten Runde.
export type MaterialAreaId = 'langzeitgymi' | 'kurzgymi' | 'bms' | 'matura'

export type OfferBase = {
  id: string // stabiler DB-/Cache-Key
  audienceId: AudienceId
  slug: string // stabiler Route-Teil innerhalb der Zielgruppe
  href: string // logischer Pfad ohne Locale
  displayName: string // "Wochenkurs" / "Vorkurs" / "Halbjahreskurs" -- freier Text
  tagline: string // kurze Card-Zeile
  lede: string // Einleitung im CourseHero
  description: string // Card-/Übersichtstext
  subject?: Subject
  categoryLabel?: string // CategoryBadge, z. B. "Deutsch & Mathematik"
  recommended?: boolean // StatusBadge "empfohlen"
  rhythmus?: string // "wöchentlich"
  laufzeit: string // "6 Monate (März–Juli)"
  dateSummary: string[] // Card-Datumszeilen, kein zusammengesetztes HTML
  features: string[] // CourseCard-Aufzählung
  regularPriceRappen: number // ganze Rappen; NIE Text oder CHF-Float
  earlyBirdPriceRappen?: number
  earlyBirdDeadline?: string // ISO-Datum YYYY-MM-DD
  currency: 'CHF'
  priceUnit?: string // "pro Teilnahme", "Zugang bis März 2027" -- optional
  overviewBullets: string[]
  whyUs: Feature[]
  testimonials?: Testimonial[]
}

export type CourseOffer = OfferBase & {
  kurstyp: 'halbjahreskurs' | 'intensivkurs'
  flowSteps: FlowStep[]
  contentSections: ContentSection[]
  weekOptions?: WeekOption[] // nur wenn tatsächlich filterbar
  distanceLearningAvailable?: boolean // nur geeignete Intensivkurse
  booking: BookingCopy
  faq?: never
  examTimeline?: never
}

export type ExamSimulationOffer = OfferBase & {
  kurstyp: 'pruefungssimulation'
  flowSteps: FlowStep[]
  examTimeline: ExamTimelineSegment[]
  faq: FaqItem[]
  booking: BookingCopy
  contentSections?: never
  weekOptions?: never
  distanceLearningAvailable?: never
}

export type SelfStudyOffer = OfferBase & {
  kurstyp: 'selbststudium'
  materialAreaId: MaterialAreaId
  access: AccessCopy
  earlyBirdPriceRappen?: never
  earlyBirdDeadline?: never
  flowSteps?: never
  contentSections?: never
  examTimeline?: never
  faq?: never
  weekOptions?: never
  distanceLearningAvailable?: never
}

export type Offer = CourseOffer | ExamSimulationOffer | SelfStudyOffer

// ---------------------------------------------------------------------------------------------
// 2.4 Buchungstabelle / Termine
// ---------------------------------------------------------------------------------------------

export type AblaufSimple = {
  kind: 'simple'
  items: { id: string; label: string; value?: string; highlight?: boolean }[]
}

export type AblaufPhased = {
  kind: 'phased' // ab 2./3. Sek: Halbjahreskurs mit 3 Phasen à ~10 Terminen
  phases: {
    id: string
    label: string // "Phase 1 — Basis"
    note?: string // "Standortbestimmung vor dem ersten Kurstag"
    dates: { id: string; date: string; highlight?: boolean }[] // highlight = Probeprüfung/Exam-Tag
  }[]
}

export type Ablauf = AblaufSimple | AblaufPhased

export type AvailabilityStatus = 'frei' | 'wenige' | 'voll'

export type SessionAvailability = {
  status: AvailabilityStatus
  bookedCount: number
  remainingPlaces: number
  updatedAt: string // ISO-Timestamp; volatile, nicht mit dem Katalog cachen
}

export type BookingAction =
  | { kind: 'modal'; label: string }
  | { kind: 'link'; label: string; href: string; localized?: boolean }
  | { kind: 'disabled'; label: string; disabledReason: string }

export type SessionSource = { kind: 'intensivwoche_kurse'; kursId: number }

export type CourseLocation = 'Zürich HB' | 'Winterthur'

export type SessionDefinition = {
  id: number // intensivwoche_kurse.id; global und nie neu nummerieren
  offerId: string
  capacity: number // stabiler gespeicherter Sessionwert; keine Belegung
  source: SessionSource // erhält bei Bestandskursen die echte numerische FK-/Buchungs-ID
  kurs: string // Anzeige, z.B. "Kurs A"
  dateLabel: string // sichtbare Datumsangabe
  startAt?: string // ISO-Timestamp, wenn ein einzelner Startzeitpunkt existiert
  endAt?: string // ISO-Timestamp
  timeLabel: string // sichtbare Zeit-/Rhythmusangabe
  standort: CourseLocation // exakt einer der zwei freigegebenen physischen Standorte
  deliveryModes: ('onsite' | 'online')[]
  weekId?: string // verbindet die Zeile mit WeekFilter/WeekOption
  ablauf: Ablauf
}

export type SessionRow = SessionDefinition & {
  availability: SessionAvailability
  bookingAction: BookingAction
}

// ---------------------------------------------------------------------------------------------
// 2.6 Nachhilfe-Abo
// ---------------------------------------------------------------------------------------------

export type SubscriptionPlan = {
  id: string // "nachhilfe-10er", "nachhilfe-20er"
  title: string
  description: string
  lessons: number // 10, 20
  lessonMinutes: number // 45
  pricePerLessonRappen: number // ganze Rappen
  discountPercent?: number // 10 beim 20er -- Rabatt wird ANGEZEIGT, nicht in pricePerLessonRappen einberechnet
  currency: 'CHF'
  features: string[]
  recommended?: boolean
  cta: UserAction
}

// ---------------------------------------------------------------------------------------------
// 2.7 Gemeinsame Inhalts- und Aktionsmodelle
// ---------------------------------------------------------------------------------------------

export type LinkAction = {
  label: string
  href: string
  ariaLabel?: string
  external?: boolean
}

export type DisabledAction = {
  label: string
  disabledReason: string
}

export type UserAction = ({ kind: 'link' } & LinkAction) | ({ kind: 'disabled' } & DisabledAction)

export type AudienceHeroContent = {
  eyebrow?: string
  title: string
  description: string
}

export type FlowStep = { id: string; title: string; body: string }

export type ContentGroup = {
  id: string
  subhead?: string
  items: string[]
}

export type ContentSection = {
  id: string
  title: string
  lede?: string
  groups: ContentGroup[]
}

export type Feature = {
  id: string
  title: string
  description: string
  icon?: string // Key aus zentraler Icon-Map, kein JSX in DB/Seed-Daten
}

export type Testimonial = {
  id: string
  quote: string
  author: string
  role?: string
  avatar?: ImageAsset // nur freigegebenes Asset mit passendem Alt-Text
}

export type ImageAsset = {
  id: string
  src: string
  alt: string
  width: number
  height: number
}

export type FaqItem = { id: string; question: string; answer: string }

export type ExamTimelineSegment = {
  id: string
  subject: 'de' | 'ma' | 'pause'
  label: string
  minutes: number
}

export type WeekOption = {
  id: string
  label: string
  startDate?: string // ISO-Datum
  endDate?: string // ISO-Datum
}

export type SessionColumn = {
  key: 'kurs' | 'date' | 'time' | 'details' | 'location' | 'status' | 'booking'
  label: string
  mobileLabel?: string
}

export type BookingCopy = {
  anchorId: 'buchung'
  title: string
  description?: string
  note?: string // Zusatzhinweis, darf keinen zweiten manuell gepflegten Preis enthalten
  emptyState: string
}

export type AccessCopy = {
  title: string
  description?: string
  note?: string
}

export type ServiceCardModel = {
  id: string
  title: string
  description: string
  action: LinkAction // alle Startseiten-Services besitzen eine reale Inhaltsroute
  eligibleFor?: AudienceId[]
  subject?: Subject
}

export type ServiceSubgroupModel = {
  id: string
  // Optional: nur die beiden Nur-für-Zielgruppe-Untergruppen ("Nur 6. Klasse & 2./3. Sek",
  // "Berufsmatura & Gymnasium") tragen laut design-reference/Startseite.html eine eigene
  // .service-subgroup-label. Die erste Gruppe (Lerncoaching/Nachhilfe) steht direkt unter dem
  // Section-h2 und hat keine eigene Unterüberschrift.
  label?: string
  eligibleFor?: AudienceId[]
  cards: ServiceCardModel[]
}

export type TeamGroup = {
  id: string
  title: string
  description: string
  image?: ImageAsset
}

export type NavItem = {
  id: string
  label: string
  href: string
  children?: NavItem[]
}

export type SiteNavModel = {
  home: LinkAction
  audiences: Audience[]
  primaryItems: NavItem[]
  login: LinkAction // href bleibt "/login"
  localeSwitch?: { locale: 'de' | 'en'; label: string; href?: string }[]
}

export type SiteFooterModel = {
  brand: string
  navigation: NavItem[]
  legal: LinkAction[] // nur reale Ziele; keine #-/Mockup-Links
}

export type ExistingCourseCardModel = {
  id: string // `bestand-${sourceKursId}`
  sourceKursId: number // echte intensivwoche_kurse.id; niemals neu nummerieren
  title: string
  subject: Exclude<Subject, 'mixed'>
  description: string
  detailDescription?: string
  classLabels: string[] // Originalwerte verlustfrei behalten
  teacher: string
  highlights: string[]
  regularPriceRappen: number
  currency: 'CHF'
  session: SessionDefinition // stabil; Availability wird request-time ergänzt
}

// ---------------------------------------------------------------------------------------------
// 2.8 Vollständige Seiten-View-Models
// ---------------------------------------------------------------------------------------------

export type AudiencePageModel = {
  audience: Audience
  hero: AudienceHeroContent
  offers: CourseOffer[]
  addOnOffers: (ExamSimulationOffer | SelfStudyOffer)[]
  existingCourses: ExistingCourseCardModel[] // aktive, zur Stufe gemappte Bestandskurse
}

export type CourseDetailPageModel = {
  audience: Audience
  offer: CourseOffer
  sessions: SessionDefinition[] // stabil/cachebar; keine Belegung enthalten
}

export type MarketingLayoutModel = {
  nav: SiteNavModel
  footer: SiteFooterModel
}

export type HomePageModel = {
  hero: AudienceHeroContent
  audiences: Audience[] // Platzierung steuert KlassenPicker, Nav und BMS-/Matura-Karten
  values: Feature[] // "Unsere Leistungen" -- 4 Value-Props unter dem Hero-Picker
  servicesTitle: string // Section-h2 "Ergänzend zu unseren Kursen" -- kein ServiceSubgroupModel.label
  serviceGroups: ServiceSubgroupModel[]
  featuredTestimonial: Testimonial
  finalCta: {
    title: string
    description: string
    action: LinkAction
  }
}

export type TargetedServicePageModel = {
  id: string
  hero: AudienceHeroContent
  eligibleAudiences: Audience[] // z. B. 6. Klasse, 2./3. Sek oder BMS
  flowSteps: FlowStep[]
  contentSections: ContentSection[]
  features: Feature[]
  faq?: FaqItem[]
  relatedActions?: LinkAction[] // z. B. Lerncoaching -> Nachhilfe
}

export type ExamSimulationPageModel = {
  audience: Audience
  offer: ExamSimulationOffer
  sessions: SessionDefinition[] // stabil/cachebar; keine Belegung enthalten
}

export type SelfStudyPageModel = {
  audience: Audience
  hero: AudienceHeroContent
  offer: SelfStudyOffer
  accessAction: UserAction
}

export type SubscriptionPageModel = {
  hero: AudienceHeroContent
  plans: SubscriptionPlan[]
}

export type TipPreview = {
  id: string
  title: string
  excerpt: string
  action?: LinkAction // fehlt, solange keine reale Zielroute existiert
}

export type TipCategory = {
  id: string
  title: string
  description?: string
  tips: TipPreview[]
}

export type TipsPageModel = {
  hero: AudienceHeroContent
  categories: TipCategory[]
  faq: FaqItem[]
}

export type AboutPageModel = {
  hero: AudienceHeroContent
  storySections: ContentSection[]
  principles: Feature[]
  teamGroups: TeamGroup[]
  cta?: LinkAction // nur setzen, wenn ein reales Beratungs-/Kontaktziel existiert
}

export type ContactChannel = {
  id: string
  kind: 'email' | 'phone' | 'address'
  label: string
  value: string
  href?: string
}

export type ContactPageModel = {
  hero: AudienceHeroContent
  channels: ContactChannel[]
  officeHours?: string
  note?: string
}

export type LegalPageModel = {
  title: string
  updatedAt: string
  sections: ContentSection[]
}

// ---------------------------------------------------------------------------------------------
// 2.12 Jährliche Angebotsverwaltung (Admin-Maske) -- stabiles Offer vs. jährliche Durchführung
// ---------------------------------------------------------------------------------------------

export type OfferEditionStatus = 'draft' | 'published' | 'archived'

export type OfferEdition = {
  id: string
  offerId: string // stabiles Offer, z. B. 6. Klasse / Intensivkurs
  schoolYear: string // "2026/27"
  publicTitle: string
  tagline: string
  description: string
  regularPriceRappen: number
  earlyBirdEnabled: boolean
  earlyBirdPriceRappen: number | null
  earlyBirdDeadline: string | null // ISO-Datum
  currency: 'CHF'
  registrationOpensAt?: string
  registrationClosesAt?: string
  status: OfferEditionStatus
  version: number // Optimistic Concurrency
  createdAt: string
  updatedAt: string
  publishedAt?: string
}

export type CourseSessionDefinition = SessionDefinition & {
  editionId: string
  registrationStatus: 'bookable' | 'waitlist' | 'cancelled'
}
