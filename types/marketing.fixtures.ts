// Fixtures für das Domänenmodell aus types/marketing.ts (Schritt 5, Teil 1 des
// Ausführungsplans). Beweisen per `satisfies`, dass jede strukturelle Variante aus Abschnitt 2.9
// kompiliert -- Inhalte sind, wo vorhanden, wortgetreu aus den genannten HTML-Referenzdateien unter
// design-reference/ übernommen, nicht erfunden. Keine Verfügbarkeit/Belegung enthalten (die wird
// laut Abschnitt 2.9 immer request-time ergänzt).
//
// TargetedServicePageModel (Lerncoaching/Distance Learning) und TipsPageModel kamen in Schritt 9
// dazu, wörtlich aus Layout_Lerncoaching_Seite.html/Layout_DistanceLearning_Seite.html/
// Layout_Tipps_Uebersichtsseite.html übernommen.
//
// Bewusst weiterhin NICHT abgedeckt: LegalPageModel und ein inhaltlich befüllter
// ContactPageModel-Fixture (im Repo existieren keine echten, verifizierten Kontaktkanäle oder
// Rechtstexte -- ein Fixture dafür würde Daten erfinden müssen, was ausdrücklich nicht erlaubt
// ist; /kontakt, /impressum und /datenschutz definieren ihren ehrlichen Platzhalter-Inhalt
// deshalb lokal in der jeweiligen page.tsx, nicht hier).
//
// SessionDefinition.id: intensivwoche_kurse.id ist laut Abschnitt 2.4 global und darf nie neu
// nummeriert werden. Für diese Kurse existieren noch keine echten DB-Zeilen (das folgt erst mit
// dem additiven Editions-/Sessions-Schema aus Abschnitt 2.12, einer eigenen späteren Runde) --
// die IDs hier sind daher bewusst hohe, audienceweise getrennte Platzhalterwerte (8xxx für
// 4. Klasse, 9xxx für 6. Klasse), nicht mit echten Bestandskursen
// zu verwechseln.

import type {
  Audience,
  AudiencePageModel,
  AboutPageModel,
  CourseDetailPageModel,
  CourseOffer,
  ExamSimulationOffer,
  ExamSimulationPageModel,
  SelfStudyOffer,
  SelfStudyPageModel,
  SessionDefinition,
  SubscriptionPageModel,
  SubscriptionPlan,
  TargetedServicePageModel,
  TipsPageModel,
} from './marketing'

// 2.1/2.7/2.8 Audience[], serviceGroups, homePageModel, siteNav, siteFooter,
// marketingLayoutModel -- reale Produktionsdaten, jetzt in app/data/marketing-site.ts gepflegt
// (Schritt 7). Re-exportiert hier, damit die bestehende Struktur-Abdeckung dieser Datei (Schritt
// 6 Smoke-Test etc.) unverändert bleibt, ohne den Inhalt zu duplizieren.
import {
  audiences,
  serviceGroups,
  homePageModel,
  siteNav,
  siteFooter,
  marketingLayoutModel,
} from '@/app/data/marketing-site'

export { audiences, serviceGroups, homePageModel, siteNav, siteFooter, marketingLayoutModel }

const vierKlasse: Audience = audiences[0]
const fuenfKlasse: Audience = audiences[1]
const sechsKlasse: Audience = audiences[2]
const einsSek: Audience = audiences[3]
const zweiDreiSek: Audience = audiences[4]
const bms: Audience = audiences[5]
const matura: Audience = audiences[6]

// ---------------------------------------------------------------------------------------------
// 2.2/2.4 CourseOffer + SessionDefinition -- Layout_6_Klasse_Hauptseite.html +
// Layout_6_Klasse_Intensivkurs_Unterseite.html
// ---------------------------------------------------------------------------------------------

const sechsKlasseIntensivkursWeekOptions = [
  { id: '0812', label: '8.–12. Februar' },
  { id: '1519', label: '15.–19. Februar' },
  { id: '2226', label: '22.–26. Februar' },
  { id: '0105', label: '01.–05. März' },
] satisfies { id: string; label: string }[]

const sechsKlasseIntensivkursWeekDates: Record<string, { startAt: string; endAt: string }> = {
  '0812': { startAt: '2027-02-08', endAt: '2027-02-12' },
  '1519': { startAt: '2027-02-15', endAt: '2027-02-19' },
  '2226': { startAt: '2027-02-22', endAt: '2027-02-26' },
  '0105': { startAt: '2027-03-01', endAt: '2027-03-05' },
}

function sechsKlasseIntensivkursTagesplan(
  monat: string,
  startTag: number,
  timeLabel: string,
  pruefungTimeLabel: string
) {
  const tage = ['Mo', 'Di', 'Mi', 'Do', 'Fr']

  return {
    kind: 'simple' as const,
    items: tage.map((tag, index) => ({
      id: tag.toLowerCase(),
      label: `${tag}, ${String(startTag + index).padStart(2, '0')}. ${monat}.`,
      value: tag === 'Mi' ? pruefungTimeLabel : timeLabel,
      highlight: tag === 'Mi',
    })),
  }
}

export const sechsKlasseIntensivkursSessions = [
  {
    id: 9001,
    kurs: 'Kurs B',
    weekId: '1519',
    dateLabel: '15.–19. Feb.',
    timeLabel: '09.00–12.15',
    standort: 'Zürich HB' as const,
    ablauf: sechsKlasseIntensivkursTagesplan('Feb', 15, '09.00–12.15', '08.30–12.30'),
  },
  {
    id: 9003,
    kurs: 'Kurs C',
    weekId: '1519',
    dateLabel: '15.–19. Feb.',
    timeLabel: '13.15–16.30',
    standort: 'Zürich HB' as const,
    ablauf: sechsKlasseIntensivkursTagesplan('Feb', 15, '13.15–16.30', '13.15–17.15'),
  },
  {
    id: 9004,
    kurs: 'Kurs D',
    weekId: '1519',
    dateLabel: '15.–19. Feb.',
    timeLabel: '09.00–12.15',
    standort: 'Winterthur' as const,
    ablauf: sechsKlasseIntensivkursTagesplan('Feb', 15, '09.00–12.15', '08.30–12.30'),
  },
  {
    id: 9005,
    kurs: 'Kurs E',
    weekId: '2226',
    dateLabel: '22.–26. Feb.',
    timeLabel: '09.00–12.15',
    standort: 'Winterthur' as const,
    ablauf: sechsKlasseIntensivkursTagesplan('Feb', 22, '09.00–12.15', '08.30–12.30'),
  },
  {
    id: 9006,
    kurs: 'Kurs F',
    weekId: '2226',
    dateLabel: '22.–26. Feb.',
    timeLabel: '13.15–16.30',
    standort: 'Winterthur' as const,
    ablauf: sechsKlasseIntensivkursTagesplan('Feb', 22, '13.15–16.30', '13.15–17.15'),
  },
  {
    id: 9007,
    kurs: 'Kurs G',
    weekId: '0105',
    dateLabel: '01.–05. März',
    timeLabel: '09.00–12.15',
    standort: 'Zürich HB' as const,
    ablauf: sechsKlasseIntensivkursTagesplan('März', 1, '09.00–12.15', '08.30–12.30'),
  },
  {
    id: 9002,
    kurs: 'Kurs A',
    weekId: '0812',
    dateLabel: '08.–12. Feb.',
    timeLabel: '09.00–12.15',
    standort: 'Winterthur' as const,
    ablauf: sechsKlasseIntensivkursTagesplan('Feb', 8, '09.00–12.15', '08.30–12.30'),
  },
  {
    id: 9008,
    kurs: 'Kurs H',
    weekId: '0105',
    dateLabel: '01.–05. März',
    timeLabel: '13.15–16.30',
    standort: 'Zürich HB' as const,
    ablauf: sechsKlasseIntensivkursTagesplan('März', 1, '13.15–16.30', '13.15–17.15'),
  },
].map((row) => ({
  ...row,
  ...sechsKlasseIntensivkursWeekDates[row.weekId],
  offerId: 'offer-6klasse-intensivkurs-sportferien',
  capacity: 10,
  source: { kind: 'intensivwoche_kurse' as const, kursId: row.id },
  deliveryModes: ['onsite' as const],
})) satisfies SessionDefinition[]

export const sechsKlasseHalbjahreskursSessions = [
  {
    id: 9201,
    offerId: 'offer-6klasse-halbjahreskurs',
    capacity: 10,
    source: { kind: 'intensivwoche_kurse', kursId: 9201 },
    kurs: 'Kurs A',
    dateLabel: 'Samstag, 09:00–10:30',
    timeLabel: '09:00–10:30',
    standort: 'Zürich HB',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'deutsch', label: 'Deutsch', value: '45 Min.' },
        { id: 'mathematik', label: 'Mathematik', value: '30 Min.' },
        { id: 'mentale-vorbereitung', label: 'Mentale Vorbereitung', value: '15 Min.' },
      ],
    },
  },
  {
    id: 9202,
    offerId: 'offer-6klasse-halbjahreskurs',
    capacity: 10,
    source: { kind: 'intensivwoche_kurse', kursId: 9202 },
    kurs: 'Kurs C',
    dateLabel: 'Samstag, 11:00–12:30',
    timeLabel: '11:00–12:30',
    standort: 'Winterthur',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'deutsch', label: 'Deutsch', value: '45 Min.' },
        { id: 'mathematik', label: 'Mathematik', value: '30 Min.' },
        { id: 'mentale-vorbereitung', label: 'Mentale Vorbereitung', value: '15 Min.' },
      ],
    },
  },
  {
    id: 9203,
    offerId: 'offer-6klasse-halbjahreskurs',
    capacity: 10,
    source: { kind: 'intensivwoche_kurse', kursId: 9203 },
    kurs: 'Kurs E',
    dateLabel: 'Mittwoch, 14:00–15:30',
    timeLabel: '14:00–15:30',
    standort: 'Zürich HB',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'deutsch', label: 'Deutsch', value: '45 Min.' },
        { id: 'mathematik', label: 'Mathematik', value: '30 Min.' },
        { id: 'mentale-vorbereitung', label: 'Mentale Vorbereitung', value: '15 Min.' },
      ],
    },
  },
  {
    id: 9204,
    offerId: 'offer-6klasse-halbjahreskurs',
    capacity: 10,
    source: { kind: 'intensivwoche_kurse', kursId: 9204 },
    kurs: 'Kurs G',
    dateLabel: 'Mittwoch, 16:00–17:30',
    timeLabel: '16:00–17:30',
    standort: 'Winterthur',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'deutsch', label: 'Deutsch', value: '45 Min.' },
        { id: 'mathematik', label: 'Mathematik', value: '30 Min.' },
        { id: 'mentale-vorbereitung', label: 'Mentale Vorbereitung', value: '15 Min.' },
      ],
    },
  },
  {
    id: 9205,
    offerId: 'offer-6klasse-halbjahreskurs',
    capacity: 10,
    source: { kind: 'intensivwoche_kurse', kursId: 9205 },
    kurs: 'Kurs I',
    dateLabel: 'Mittwoch, 18:00–19:30',
    timeLabel: '18:00–19:30',
    standort: 'Winterthur',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'deutsch', label: 'Deutsch', value: '45 Min.' },
        { id: 'mathematik', label: 'Mathematik', value: '30 Min.' },
        { id: 'mentale-vorbereitung', label: 'Mentale Vorbereitung', value: '15 Min.' },
      ],
    },
  },
] satisfies SessionDefinition[]

export const sechsKlasseIntensivkurs = {
  id: 'offer-6klasse-intensivkurs-sportferien',
  audienceId: '6',
  slug: 'intensivkurs-sportferien',
  href: '/kurse/6-klasse/intensivkurs-sportferien',
  displayName: 'Intensivkurs-Sportferien',
  tagline: 'Intensives Training in den Sportferien',
  lede: 'Möchte sich Ihr Kind explizit auf die Prüfungsaufgaben und Prüfungssituation an der Gymiprüfung vorbereiten? Im Kurs werden typische Aufgaben erklärt und Prüfungen simuliert.',
  description:
    'Ideal für Kinder, die sich intensiv auf die Prüfungsaufgaben und die Prüfungssituation vorbereiten wollen – inklusive praktischer Tipps & Tricks für die Gymiprüfung.',
  categoryLabel: 'Deutsch & Mathematik',
  laufzeit: '5 Kurstage in den Sportferien',
  dateSummary: ['Feb. – März 2027'],
  features: [
    'Prüfungsaufgaben & Prüfungssituation trainieren',
    '5 aufeinanderfolgende Kurstage in einer Schulferienwoche',
    'Kurszeit: 09.00 – 12.15 Uhr oder 13.15 – 16.30 Uhr',
    'Tipps & Tricks zur Prüfung',
  ],
  regularPriceRappen: 119500,
  currency: 'CHF',
  overviewBullets: [
    '5 Kurstage in den Sportferien',
    'Kurszeit: 09.00 – 12.15 Uhr oder 13.15 – 16.30 Uhr',
    'Kleingruppen: 3 bis max. 10 Kinder',
    'Zürich HB · Winterthur',
  ],
  whyUs: [
    {
      id: 'standortbestimmung',
      title: 'Standortbestimmung zu Kursbeginn',
      description:
        'Wir stellen fest, wo Lücken bestehen, bevor wir mit dem Training starten — nicht danach.',
    },
    {
      id: 'pruefungssimulation',
      title: 'Eine echte Prüfungssimulation',
      description:
        'Reale Prüfungsbedingungen, korrigiert und Schritt für Schritt besprochen — einmal reicht, wenn sie gut gemacht ist.',
    },
    {
      id: 'strategien',
      title: 'Praktische Lern- und Prüfungsstrategien',
      description:
        'Von der richtigen Lernumgebung über den Umgang mit Prüfungsangst und Blackouts bis zu Konzentrationsübungen und der Herangehensweise an typische Prüfungsaufgaben.',
    },
    {
      id: 'betreuung',
      title: 'Betreuung auch ausserhalb der Kurszeit',
      description:
        'Eine gute Begleitung endet für uns nicht mit dem Kursende. Unsere Lehrpersonen stehen bei Fragen auch ausserhalb der Kurszeiten jederzeit per Chat zur Verfügung.',
    },
  ],
  testimonials: [
    {
      id: 'testi-1',
      quote:
        'Die Prüfungssimulation hat mir die Nervosität genommen — ich wusste danach, was mich erwartet.',
      author: 'Teilnehmer, Intensivkurs Sportferien',
    },
    {
      id: 'testi-2',
      quote:
        'In fünf Tagen habe ich mehr gelernt als ich erwartet hätte, ohne dass es sich wie Ferien-Stress anfühlte.',
      author: 'Teilnehmerin, Intensivkurs Sportferien',
    },
  ],
  kurstyp: 'intensivkurs',
  weekOptions: sechsKlasseIntensivkursWeekOptions,
  flowSteps: [
    {
      id: 'schritt-1',
      title: 'Wissen aneignen',
      body: 'Prüfungsrelevante Grundlagen in Deutsch und Mathematik im Schnelldurchgang repetieren, typische Aufgabentypen kennenlernen.',
    },
    {
      id: 'schritt-2',
      title: 'Wissen umsetzen',
      body: 'Aufgaben im Unterricht und im Selbststudium trainieren, echte Prüfungssimulation durchführen.',
    },
    {
      id: 'schritt-3',
      title: 'Wissen prüfen',
      body: 'Individuelles Feedback zur Simulation, gemeinsame Besprechung — Ihr Kind weiss danach genau, wo noch Übungsbedarf besteht.',
    },
  ],
  contentSections: [],
  booking: {
    anchorId: 'buchung',
    title: 'Termine und Buchung',
    emptyState: 'Aktuell sind keine Termine verfügbar.',
  },
} as const satisfies CourseOffer

export const sechsKlasseHalbjahreskurs = {
  id: 'offer-6klasse-halbjahreskurs',
  audienceId: '6',
  slug: 'halbjahreskurs',
  href: '/kurse/6-klasse/halbjahreskurs',
  displayName: 'Halbjahreskurs',
  tagline: 'Breite Vorbereitung über das ganze Semester',
  categoryLabel: 'Deutsch & Mathematik',
  lede: 'Umfassende und optimale Vorbereitung auf die Aufnahmeprüfung ins Langzeitgymnasium — gezielte, individuelle Förderung in Deutsch und Mathematik.',
  description:
    'Umfassende und optimale Vorbereitung auf die Aufnahmeprüfung ins Langzeitgymnasium — gezielte, individuelle Förderung in Deutsch und Mathematik.',
  recommended: true,
  laufzeit: 'Sept. 2026 – März 2027',
  dateSummary: ['Sept. 2026 – März 2027'],
  features: [
    'Deutsch (inkl. Aufsatztraining) & Mathematik',
    'Samstag oder Mittwochnachmittag',
    'Standortbestimmung, Lerncoaching & Prüfungssimulation inbegriffen',
    'Betreuung auch ausserhalb der Kurszeiten',
  ],
  regularPriceRappen: 349000,
  earlyBirdPriceRappen: 339000,
  earlyBirdDeadline: '2026-07-31',
  currency: 'CHF',
  overviewBullets: [
    'Deutsch (inkl. Aufsatztraining) & Mathematik',
    'Samstag oder Mittwochnachmittag',
    'Standortbestimmung, Lerncoaching & Prüfungssimulation inbegriffen',
  ],
  whyUs: [
    {
      id: 'standortbestimmung-kursbeginn',
      title: 'Standortbestimmung zu Kursbeginn',
      description: 'Wir stellen fest, wo Lücken bestehen, bevor wir mit dem Training starten — nicht danach.',
    },
    {
      id: 'echte-pruefungssimulation',
      title: 'Eine echte Prüfungssimulation',
      description: 'Reale Prüfungsbedingungen, korrigiert und Schritt für Schritt besprochen — einmal reicht, wenn sie gut gemacht ist.',
    },
    {
      id: 'praktische-lern-pruefungsstrategien',
      title: 'Praktische Lern- und Prüfungsstrategien',
      description: 'Von der richtigen Lernumgebung über den Umgang mit Prüfungsangst und Blackouts bis zu Konzentrationsübungen und der Herangehensweise an typische Prüfungsaufgaben.',
    },
    {
      id: 'betreuung-ausserhalb-kurszeit',
      title: 'Betreuung auch ausserhalb der Kurszeit',
      description: 'Eine gute Begleitung endet für uns nicht mit dem Kursende. Unsere Lehrpersonen stehen bei Fragen auch ausserhalb der Kurszeiten jederzeit per Chat zur Verfügung.',
    },
  ],
  kurstyp: 'halbjahreskurs',
  flowSteps: [
    {
      id: 'standortbestimmung',
      title: 'Standortbestimmung',
      body: 'Vor dem ersten Kurstag stellen wir fest, wo Ihr Kind aktuell steht, um die Kurszeit von Beginn an gezielt zu nutzen.',
    },
    {
      id: 'semestertraining',
      title: 'Semestertraining',
      body: 'Von September bis März wird wöchentlich an Deutsch, Mathematik und den mentalen Prüfungskompetenzen gearbeitet.',
    },
    {
      id: 'pruefungssimulation-feedback',
      title: 'Prüfungssimulation & Feedback',
      body: 'Eine echte Prüfungssimulation zeigt den aktuellen Stand — inklusive individueller Besprechung und Empfehlungen für die letzten Wochen vor der Prüfung.',
    },
  ],
  contentSections: [
    {
      id: 'mathematik',
      title: 'Mathematik',
      lede: 'Aufbau, Übung und schrittweise Anleitung zum Lösen der verschiedenen Aufgabentypen der Prüfung.',
      groups: [
        {
          id: 'zahl-variable',
          subhead: 'Zahl und Variable',
          items: [
            'Fachbegriffe und Symbole sicher anwenden',
            'Schriftliche Rechenverfahren — Addition, Subtraktion, Multiplikation, Division',
            'Bruchrechnen',
            'Dezimalzahlen',
          ],
        },
        {
          id: 'form-raum',
          subhead: 'Form und Raum',
          items: [
            'Geometrische Grundbegriffe, Symbole, Figuren und Körper',
            'Umfang und Flächeninhalt von Rechtecken berechnen',
            'Volumen von Würfeln und Quadern berechnen',
            'Raumvorstellung trainieren',
            'Konstruktionsaufgaben',
            'Arbeiten mit Koordinatensystem und Raster',
          ],
        },
        {
          id: 'groessen-funktionen-daten',
          subhead: 'Grössen, Funktionen und Daten',
          items: ['Masseinheiten', 'Textaufgaben mit Dreisatz und Proportionalität', 'Kombinatorik- und Knobelaufgaben'],
        },
      ],
    },
    {
      id: 'deutsch',
      title: 'Deutsch',
      groups: [
        {
          id: 'aufsatz',
          subhead: 'Aufsatz',
          items: [
            'Prüfungsrelevante Textsorten — Erzählung, Beschreibung, Bericht, Brief',
            'Schreibprozess: Ideen finden, planen, formulieren, überarbeiten',
            'Passender Einsatz von Redewendungen und Vergleichen',
            'Sichere Anwendung der Rechtschreiberegeln',
          ],
        },
        {
          id: 'textverstaendnis',
          subhead: 'Textverständnis',
          items: [
            'Komplexe Texte verstehen, Fragen zu Inhalt & sprachlicher Form beantworten',
            'Strategien für unterschiedliche Textarten',
            'Wortschatz und Ausdruck in eigenen Worten wiedergeben',
            'Informationen "zwischen den Zeilen" erschliessen',
          ],
        },
        {
          id: 'sprachbetrachtung-grammatik',
          subhead: 'Sprachbetrachtung & Grammatik',
          items: [
            'Wortstamm, Wortfelder, Wortfamilien und Wortarten',
            'Zeitformen — Präsens, Präteritum, Perfekt',
            'Direkte Rede inkl. Satzzeichen',
          ],
        },
      ],
    },
    {
      id: 'mentale-vorbereitung',
      title: 'Mentale Vorbereitung',
      lede: 'Neben dem Fachwissen fördern wir gezielt die Lernkompetenzen Ihres Kindes — integriert im Kursprogramm, ergänzt durch ein freiwilliges Online-Zusatzangebot, das bereits in den Kurskosten inbegriffen ist. Die genauen Kursinhalte können sich noch anpassen — die Schwerpunkte richten sich nach dem Stand der jeweiligen Kursgruppe.',
      groups: [
        {
          id: 'lernkompetenzen',
          items: ['Selbstorganisation', 'Lernmethoden und Lernroutine', 'Konzentration', 'Motivation', 'Umgang mit Stress und Druck', 'Weitere mentale Tipps für die Prüfung'],
        },
      ],
    },
  ],
  booking: {
    anchorId: 'buchung',
    title: 'Termine und Buchung',
    emptyState: 'Aktuell sind keine Termine verfügbar.',
  },
} as const satisfies CourseOffer

export const sechsKlasseAudiencePageModel = {
  audience: sechsKlasse,
  hero: {
    title: 'Vorbereitungskurse für Gymiprüfung 2027',
    description:
      'Zwei Wege zur Vorbereitung auf die Aufnahmeprüfung ins Langzeitgymnasium — ganzjährige Begleitung oder intensives Training in den Sportferien.',
  },
  offers: [sechsKlasseHalbjahreskurs, sechsKlasseIntensivkurs],
  addOnOffers: [],
  existingCourses: [],
} as const satisfies AudiencePageModel

export const sechsKlasseIntensivkursDetailPageModel = {
  audience: sechsKlasse,
  offer: sechsKlasseIntensivkurs,
  sessions: sechsKlasseIntensivkursSessions,
} as const satisfies CourseDetailPageModel

// ---------------------------------------------------------------------------------------------
// 2.2/2.8 ExamSimulationOffer -- Layout_6_Klasse_Pruefungssimulation.html (reicheres Timeline-/
// FAQ-Inhalt als die Kurzfassung auf der Hauptseite; derselbe Preis CHF 145 wird dort UND auf der
// BMS-Prüfungssimulationsseite genannt. Diese Detailseite folgt bewusst ihrer eigenen Vorlage
// und verwendet deshalb CHF 125.
// ---------------------------------------------------------------------------------------------

export const sechsKlassePruefungssimulation = {
  id: 'offer-6klasse-pruefungssimulation',
  audienceId: '6',
  slug: 'pruefungssimulation',
  href: '/kurse/6-klasse/pruefungssimulation',
  displayName: 'Prüfungssimulation',
  tagline: 'Offen für alle',
  lede: 'Die echte Prüfungssituation kennenlernen, Zeitmanagement trainieren und gezielt erkennen, wo bis zur Gymiprüfung noch Lernbedarf besteht.',
  description:
    'Eine echte Aufnahmeprüfung unter realen Bedingungen — inklusive schriftlicher Bewertung. Auch ohne vorherige Kursteilnahme buchbar.',
  laufzeit: 'Ein Prüfungstermin, halbtags',
  dateSummary: ['Vormittagsprüfung'],
  features: [
    'Prüfungssimulation nach aktuellem Prüfungsformat',
    'Durchführung unter Prüfungsbedingungen',
    'Schriftliche Bewertung des Aufsatzes',
  ],
  regularPriceRappen: 12500,
  currency: 'CHF',
  priceUnit: 'pro Teilnahme',
  overviewBullets: [
    'Echte Zeitvorgaben, ohne Unterbrechung',
    'Aufgabentypen, Umfang und Schwierigkeitsgrad orientieren sich an der Aufnahmeprüfung',
    'Ruhige, kontrollierte Umgebung',
  ],
  whyUs: [
    {
      id: 'zeitvorgaben',
      title: 'Echte Zeitvorgaben',
      description: 'Die Aufgaben werden im vorgesehenen Zeitrahmen und ohne Unterbrechung gelöst.',
    },
    {
      id: 'aufgaben',
      title: 'Aufgaben',
      description:
        'Aufgabentypen, Umfang und Schwierigkeitsgrad orientieren sich an der Aufnahmeprüfung.',
    },
    {
      id: 'umgebung',
      title: 'Ruhige Umgebung',
      description:
        'Eine kontrollierte Durchführung hilft, Nervosität und Konzentration realistisch zu erleben.',
    },
  ],
  kurstyp: 'pruefungssimulation',
  flowSteps: [
    { id: 'einfuehrung', title: 'Einführung', body: 'Ablauf, Regeln und Material werden kurz erklärt.' },
    { id: 'pruefung', title: 'Prüfung', body: 'Deutsch und Mathematik unter echten Zeitvorgaben.' },
    { id: 'korrektur', title: 'Korrektur', body: 'Fachliche Bewertung mit nachvollziehbarer Punktevergabe.' },
    { id: 'auswertung', title: 'Auswertung', body: 'Stärken, Lücken und nächste Lernschritte werden sichtbar.' },
  ],
  examTimeline: [
    { id: 'deutsch-sprache', subject: 'de', label: 'Deutsch Sprachprüfung', minutes: 45 },
    { id: 'pause-1', subject: 'pause', label: 'Pause', minutes: 0 },
    { id: 'mathematik', subject: 'ma', label: 'Mathematik', minutes: 60 },
    { id: 'pause-2', subject: 'pause', label: 'Pause', minutes: 0 },
    { id: 'deutsch-aufsatz', subject: 'de', label: 'Deutsch Aufsatz', minutes: 60 },
  ],
  faq: [
    {
      id: 'faq-aufgaben',
      question: 'Entsprechen die Aufgaben der echten Gymiprüfung?',
      answer:
        'Die Aufgaben orientieren sich an den relevanten Aufgabentypen, Anforderungen und Zeitvorgaben. Es werden keine zukünftigen Originalprüfungen verwendet.',
    },
    {
      id: 'faq-korrektur',
      question: 'Wird die gesamte Prüfung korrigiert?',
      answer:
        'Der Aufsatz wird persönlich durch eine Lehrperson korrigiert und mit schriftlichem Feedback ins Portal geladen. Für Mathematik und Deutsch Sprache stehen detaillierte Lösungen zur Selbstkorrektur bereit.',
    },
    {
      id: 'faq-scan-portal',
      question: 'Wann erscheint der gescannte Aufsatz im Portal?',
      answer:
        'Nach der fachlichen Korrektur wird der Scan dem persönlichen Teilnehmerkonto zugeordnet. Sobald er freigegeben ist, erhält der Teilnehmer eine Benachrichtigung.',
    },
    {
      id: 'faq-feedback-sichtbarkeit',
      question: 'Wer kann das Feedback sehen?',
      answer:
        'Nur berechtigte Personen im geschützten Teilnehmerkonto sowie die zuständigen Lehrpersonen können auf die Prüfungsunterlagen zugreifen.',
    },
    {
      id: 'faq-besprechung',
      question: 'Kann das Feedback mit einer Lehrperson besprochen werden?',
      answer: 'Optional kann ein persönliches Auswertungsgespräch oder eine Nachbesprechung gebucht werden.',
    },
    {
      id: 'faq-ohne-kurs',
      question: 'Kann man auch ohne laufenden Vorbereitungskurs teilnehmen?',
      answer: 'Ja. Die Prüfungssimulation eignet sich auch als unabhängige Standortbestimmung.',
    },
  ],
  booking: {
    anchorId: 'buchung',
    title: 'Termine und Buchung',
    emptyState: 'Aktuell sind keine Termine verfügbar.',
  },
} as const satisfies ExamSimulationOffer

export const sechsKlassePruefungssimulationSessions = [
  {
    id: 9101,
    offerId: 'offer-6klasse-pruefungssimulation',
    capacity: 20,
    source: { kind: 'intensivwoche_kurse', kursId: 9101 },
    kurs: 'Dienstag, 16. Februar',
    dateLabel: 'Dienstag, 16. Februar',
    timeLabel: '08.00–11.45',
    standort: 'Zürich HB',
    deliveryModes: ['onsite'],
    ablauf: { kind: 'simple', items: [] },
  },
  {
    id: 9102,
    offerId: 'offer-6klasse-pruefungssimulation',
    capacity: 20,
    source: { kind: 'intensivwoche_kurse', kursId: 9102 },
    kurs: 'Donnerstag, 18. Februar',
    dateLabel: 'Donnerstag, 18. Februar',
    timeLabel: '08.00–11.45',
    standort: 'Winterthur',
    deliveryModes: ['onsite'],
    ablauf: { kind: 'simple', items: [] },
  },
  {
    id: 9103,
    offerId: 'offer-6klasse-pruefungssimulation',
    capacity: 20,
    source: { kind: 'intensivwoche_kurse', kursId: 9103 },
    kurs: 'Dienstag, 23. Februar',
    dateLabel: 'Dienstag, 23. Februar',
    timeLabel: '08.00–11.45',
    standort: 'Zürich HB',
    deliveryModes: ['onsite'],
    ablauf: { kind: 'simple', items: [] },
  },
  {
    id: 9104,
    offerId: 'offer-6klasse-pruefungssimulation',
    capacity: 20,
    source: { kind: 'intensivwoche_kurse', kursId: 9104 },
    kurs: 'Samstag, 27. Februar',
    dateLabel: 'Samstag, 27. Februar',
    timeLabel: '08.00–11.45',
    standort: 'Winterthur',
    deliveryModes: ['onsite'],
    ablauf: { kind: 'simple', items: [] },
  },
] satisfies SessionDefinition[]

export const sechsKlassePruefungssimulationPageModel = {
  audience: sechsKlasse,
  offer: sechsKlassePruefungssimulation,
  sessions: sechsKlassePruefungssimulationSessions,
} as const satisfies ExamSimulationPageModel

// ---------------------------------------------------------------------------------------------
// 2.2/2.8 SelfStudyOffer -- Layout_BMS_Selbststudium_Unterseite.html
// ---------------------------------------------------------------------------------------------

export const bmsSelbststudium = {
  id: 'offer-bms-selbststudium',
  audienceId: 'bms',
  slug: 'selbststudium',
  href: '/kurse/bms/selbststudium',
  displayName: 'Selbststudium',
  tagline: 'Selbststudium · BMS',
  lede: 'Eigenständig für die BMS-Aufnahmeprüfung trainieren',
  description:
    'Übungsaufgaben für Deutsch und Mathematik, bisherige BMS-Aufnahmeprüfungen mit Lösungen und persönliches Feedback zu eigenen Aufsätzen — flexibel und im eigenen Tempo.',
  laufzeit: 'Zugang bis zur Prüfung im März 2027',
  dateSummary: ['Einmalig · Zugang bis März 2027'],
  features: [
    'Prüfungsnahe Übungen in Deutsch & Mathematik',
    'Bisherige BMS-Aufnahmeprüfungen mit vollständigen Lösungswegen',
    'Bis zu drei eigene Aufsätze einreichen und Feedback erhalten',
  ],
  regularPriceRappen: 19000,
  currency: 'CHF',
  priceUnit: 'Zugang bis März 2027',
  overviewBullets: [
    'Deutsch & Mathematik: prüfungsnahe Übungen',
    'Prüfungsarchiv mit vollständigen Lösungen',
    'Persönliches Aufsatz-Feedback (bis zu 3 Aufsätze)',
  ],
  whyUs: [
    {
      id: 'uebungen',
      title: 'Prüfungsnahe Übungen',
      description:
        'Aufgaben zu Sprachkompetenz, Textverständnis und Aufsatz sowie zu Arithmetik, Algebra, Geometrie und Sachaufgaben.',
    },
    {
      id: 'archiv',
      title: 'Bisherige Prüfungen & Lösungen',
      description:
        'Ausgewählte BMS-Aufnahmeprüfungen mit vollständigen Lösungswegen für eine realistische Standortbestimmung.',
    },
    {
      id: 'feedback',
      title: 'Persönliches Aufsatz-Feedback',
      description:
        'Bis zu drei eigene Aufsätze einreichen und konkrete Hinweise zu Aufbau, Sprache, Argumentation und Ausdruck erhalten.',
    },
  ],
  kurstyp: 'selbststudium',
  materialAreaId: 'bms',
  access: {
    title: 'Zugang bis zur BMS-Aufnahmeprüfung',
    description:
      'Die Materialplattform bleibt bis zur Prüfung im März 2027 freigeschaltet und wird danach automatisch deaktiviert.',
  },
} as const satisfies SelfStudyOffer

export const bmsSelbststudiumPageModel = {
  audience: bms,
  hero: {
    eyebrow: 'Selbststudium · BMS',
    title: 'Eigenständig für die BMS-Aufnahmeprüfung trainieren',
    description:
      'Übungsaufgaben für Deutsch und Mathematik, bisherige BMS-Aufnahmeprüfungen mit Lösungen und persönliches Feedback zu eigenen Aufsätzen — flexibel und im eigenen Tempo.',
  },
  offer: bmsSelbststudium,
  accessAction: { kind: 'disabled', label: 'Zugang erhalten', disabledReason: 'Buchung folgt in einer späteren Ausbaustufe' },
} as const satisfies SelfStudyPageModel

// ---------------------------------------------------------------------------------------------
// 2.6 SubscriptionPlan -- Layout_Nachhilfe_Seite.html
// ---------------------------------------------------------------------------------------------

export const nachhilfeZehnerAbo = {
  id: 'nachhilfe-10er',
  title: '10er Abo',
  description: '10 Lektionen à 45 Minuten',
  lessons: 10,
  lessonMinutes: 45,
  pricePerLessonRappen: 9500,
  currency: 'CHF',
  features: [
    'Frei einteilbar über das Semester',
    'Individuelle Terminvereinbarung',
    'Deutsch, Mathematik und Französisch',
  ],
  // Abschnitt 9.1: kein realer Checkout vorhanden -- "Abo buchen" bleibt disabled statt auf einen
  // toten #buchung-Anker zu verlinken (Schritt 9, Korrektur beim Verdrahten von /nachhilfe).
  cta: { kind: 'disabled', label: 'Abo buchen', disabledReason: 'Checkout folgt in einer späteren Ausbaustufe' },
} as const satisfies SubscriptionPlan

export const nachhilfeZwanzigerAbo = {
  id: 'nachhilfe-20er',
  title: '20er Abo',
  description: '20 Lektionen à 45 Minuten',
  lessons: 20,
  lessonMinutes: 45,
  pricePerLessonRappen: 9500,
  discountPercent: 10,
  currency: 'CHF',
  features: [
    'Frei einteilbar über das Semester',
    'Individuelle Terminvereinbarung',
    'Deutsch, Mathematik und Französisch',
  ],
  recommended: true,
  // Abschnitt 9.1: kein realer Checkout vorhanden -- "Abo buchen" bleibt disabled statt auf einen
  // toten #buchung-Anker zu verlinken (Schritt 9, Korrektur beim Verdrahten von /nachhilfe).
  cta: { kind: 'disabled', label: 'Abo buchen', disabledReason: 'Checkout folgt in einer späteren Ausbaustufe' },
} as const satisfies SubscriptionPlan

export const nachhilfePageModel = {
  hero: {
    eyebrow: 'Zusatzangebot · Für alle Klassenstufen',
    title: 'Nachhilfe-Abo',
    description:
      'Gezielte 1:1-Unterstützung in Deutsch, Mathematik oder Französisch — unabhängig davon, ob Ihr Kind sonst einen Kurs bei uns besucht. Buchbar als Lektionen-Abo, einlösbar über das ganze Semester.',
  },
  plans: [nachhilfeZehnerAbo, nachhilfeZwanzigerAbo],
} as const satisfies SubscriptionPageModel

// ---------------------------------------------------------------------------------------------
// 2.8 AboutPageModel -- Layout_UeberUns_Seite.html
// ---------------------------------------------------------------------------------------------

export const aboutPageModel = {
  hero: {
    title: 'Gymivorbereitung mit Herz und System',
    description:
      'Wir begleiten Kinder von der 4. Klasse bis zur 2./3. Sek auf dem Weg zur Aufnahmeprüfung — mit individueller Förderung in Kleingruppen statt Frontalunterricht.',
  },
  storySections: [
    {
      id: 'warum-wir-das-tun',
      title: 'Warum wir das tun',
      groups: [
        {
          id: 'motivation',
          items: [
            'Die Aufnahmeprüfung ins Gymnasium ist für viele Kinder der erste grosse Prüfungsmoment ihres Lebens — und für Eltern oft eine Zeit voller offener Fragen: Wo steht mein Kind wirklich? Welcher Weg passt? Wie viel Vorbereitung braucht es wirklich?',
            'Genau hier setzen wir an. Statt Frontalunterricht für alle gleich zu gestalten, beginnen wir mit einer ehrlichen Standortbestimmung und passen die Förderung an die tatsächlichen Lücken an — in Kleingruppen, mit persönlicher Betreuung auch ausserhalb der Kurszeiten.',
          ],
        },
      ],
    },
    {
      id: 'unser-anspruch',
      title: 'Unser Anspruch',
      groups: [
        {
          id: 'anspruch',
          items: [
            'Wir wollen nicht einfach auf eine Prüfung trainieren, sondern Kinder in ihrer Selbstständigkeit stärken — mit Strategien, die auch nach der Prüfung noch tragen.',
            'Dazu gehört für uns eine enge Zusammenarbeit mit den Eltern, transparente Rückmeldungen zum Lernfortschritt und Kursleitende, die den aktuellen Prüfungsstoff aus erster Hand kennen.',
          ],
        },
      ],
    },
  ],
  principles: [
    {
      id: 'naehe-zur-pruefung',
      title: 'Nähe zur Prüfung',
      description:
        'Unsere Kursinhalte orientieren sich direkt am aktuellen Prüfungsformat — keine generischen Übungen von der Stange.',
    },
    {
      id: 'transparenz',
      title: 'Transparenz',
      description:
        'Eltern erhalten regelmässig eine ehrliche Einschätzung des Lernstands — auch wenn sie unbequem ist.',
    },
    {
      id: 'langfristige-begleitung',
      title: 'Langfristige Begleitung',
      description:
        'Wir denken über die einzelne Kurslektion hinaus und begleiten Kinder bis zum Prüfungstag — und darüber hinaus.',
    },
  ],
  teamGroups: [
    {
      id: 'lehrpersonen',
      title: 'Lehrpersonen',
      description:
        'ETH-, Uni- oder PH-Studierende, die sich sowohl durch gute Fachkenntnisse als auch durch gute Umgangsformen auszeichnen. Sie sorgen für den erfolgreichen Unterricht.',
    },
    {
      id: 'expertinnen',
      title: 'Expert:innen',
      description:
        'Führungskräfte entweder aus der Wirtschaft oder aus der Wissenschaft, die sich den Anforderungen moderner Gesellschaften bewusst sind. Sie sind an der Erstellung passender Lernmaterialien mitbeteiligt.',
    },
  ],
  // /kontakt existiert seit Schritt 9 -- ein reales, erreichbares Ziel (Abschnitt 2.8: "nur setzen,
  // wenn ein reales Beratungs-/Kontaktziel existiert").
  cta: { label: 'Kontakt aufnehmen', href: '/kontakt' },
} as const satisfies AboutPageModel

// ---------------------------------------------------------------------------------------------
// 2.8 TargetedServicePageModel -- Layout_Lerncoaching_Seite.html
// ---------------------------------------------------------------------------------------------

export const lerncoachingPageModel = {
  id: 'lerncoaching',
  hero: {
    eyebrow: 'Zusatzangebot · Für alle Klassenstufen',
    title: 'Lerncoaching',
    description:
      'Gute Vorbereitung ist mehr als Fachwissen. Wir stärken, wie Ihr Kind lernt — Struktur, Konzentration und Motivation — und begleiten es damit über die Gymiprüfung hinaus.',
  },
  eligibleAudiences: audiences.filter((audience) => audience.kind === 'gymipruefung'),
  flowSteps: [
    {
      id: 'fachlich-praezise',
      title: 'Fachlich präzise',
      body: 'Deutsch und Mathematik so vermittelt, dass Kinder das Prinzip dahinter verstehen — nicht nur ein Ergebnis auswendig lernen.',
    },
    {
      id: 'wissenschaftlich-abgestuetzt',
      title: 'Wissenschaftlich abgestützt',
      body: 'Unsere Lernstrategien beruhen auf anerkannten Erkenntnissen der Lernpsychologie und wirken über die Prüfung hinaus.',
    },
    {
      id: 'auf-das-kind-zugeschnitten',
      title: 'Auf das Kind zugeschnitten',
      body: 'Jedes Kind bringt andere Voraussetzungen mit — die Begleitung richtet sich danach, statt ein Standardprogramm durchzuziehen.',
    },
  ],
  features: [
    {
      id: 'selbstorganisation',
      title: 'Selbstorganisation',
      description: 'Ein klarer Lernplan und feste Routinen, statt Lernen nach Zufall.',
    },
    {
      id: 'lernstrategien-motivation',
      title: 'Lernstrategien & Motivation',
      description:
        'Konkrete Methoden fürs Behalten und Anwenden — sowie ein gesunder Umgang mit Prüfungsdruck.',
    },
    {
      id: 'individuelle-foerderbedarfe',
      title: 'Individuelle Förderbedarfe',
      description: 'Gezielte Unterstützung bei ADHS, LRS oder Dyskalkulie, bei Bedarf mit Lernstandsanalyse.',
    },
  ],
  contentSections: [
    {
      id: 'einordnung',
      title: 'Lerncoaching einordnen',
      groups: [
        {
          id: 'bereits-inbegriffen',
          subhead: 'Bereits inbegriffen',
          items: [
            'Lerncoaching ist fester Bestandteil unserer Vor- und Halbjahreskurse — ohne Aufpreis, in regelmässigen Zusatzlektionen.',
          ],
        },
        {
          id: 'nachhilfe-gesucht',
          subhead: 'Gezielte Nachhilfe gesucht?',
          items: [
            'Nachhilfe ≠ Lerncoaching: Für konkreten Fachstoff in Deutsch, Mathematik oder Französisch gibt es unser eigenständiges Nachhilfe-Abo (10er/20er).',
          ],
        },
        {
          id: 'beratung',
          subhead: 'Nicht sicher, was zu Ihrem Kind passt?',
          items: [
            'Wir beraten Sie unverbindlich, ob Kurs, Lerncoaching oder Nachhilfe-Abo die passende Wahl ist.',
          ],
        },
      ],
    },
  ],
  faq: [
    {
      id: 'unterschied-nachhilfe',
      question: 'Was unterscheidet Lerncoaching von Nachhilfe?',
      answer:
        'Lerncoaching stärkt, wie Ihr Kind lernt — Struktur, Strategie, Motivation. Nachhilfe vertieft konkreten Fachstoff in Deutsch, Mathematik oder Französisch. Beides ergänzt sich gut.',
    },
    {
      id: 'zusatzkosten',
      question: 'Kostet Lerncoaching zusätzlich zum Kurs?',
      answer: 'Nein — Lerncoaching ist fester Bestandteil unserer Vor- und Halbjahreskurse, ohne Aufpreis.',
    },
  ],
  relatedActions: [
    { label: 'Zu unseren Kursen', href: '/' },
    { label: 'Zum Nachhilfe-Abo', href: '/nachhilfe' },
    { label: 'Beratungsgespräch vereinbaren', href: '/kontakt' },
  ],
} as const satisfies TargetedServicePageModel

// ---------------------------------------------------------------------------------------------
// 2.8 TargetedServicePageModel -- Layout_DistanceLearning_Seite.html
// ---------------------------------------------------------------------------------------------

export const distanceLearningPageModel = {
  id: 'distance-learning',
  hero: {
    eyebrow: 'Zusatzoption · Nur Intensivkurs Sportferien',
    title: 'Distance Learning',
    description:
      'Der Intensivkurs in den Sportferien lässt sich auch von zu Hause oder vom Ferienort aus per Video-Unterricht besuchen — mit denselben Inhalten wie vor Ort.',
  },
  eligibleAudiences: audiences.filter((audience) => audience.id === '6' || audience.id === '2-3-sek'),
  flowSteps: [
    {
      id: 'live-per-video',
      title: 'Live per Video',
      body: 'Teilnahme in Echtzeit am selben Unterricht wie die Kinder vor Ort — keine Aufzeichnung, kein Nacharbeiten im Nachhinein.',
    },
    {
      id: 'gleiche-inhalte',
      title: 'Gleiche Inhalte',
      body: 'Derselbe Ablauf, dieselben Übungen und Materialien wie im Präsenzunterricht am Kursstandort.',
    },
    {
      id: 'keine-zusatzkosten',
      title: 'Keine Zusatzkosten',
      body: 'Distance Learning ist eine Teilnahmeform des Intensivkurses, kein separat zu buchendes Angebot.',
    },
  ],
  features: [],
  contentSections: [
    {
      id: 'fuer-wen',
      title: 'Für wen es ist',
      groups: [
        {
          id: 'verfuegbarkeit',
          items: ['Verfügbar für den Intensivkurs Sportferien von zwei Prüfungsjahren.'],
        },
        {
          id: 'ausschluss',
          items: [
            'Bei allen anderen Kursen (Wochenkurse, Halbjahreskurse, Lerncamp der 4./5. Klasse und 1. Sek) ist Distance Learning aktuell nicht verfügbar — dort findet der Unterricht ausschliesslich vor Ort statt.',
          ],
        },
      ],
    },
  ],
  faq: [
    {
      id: 'extra-kosten',
      question: 'Kostet die Teilnahme per Distance Learning extra?',
      answer: 'Nein — es ist dieselbe Kursbuchung wie vor Ort, nur die Teilnahmeform ändert sich.',
    },
    {
      id: 'wechsel',
      question: 'Kann ich zwischen den Kurstagen wechseln — mal vor Ort, mal online?',
      answer:
        'Die Teilnahmeform wird bei der Anmeldung festgelegt; ein spontaner Wechsel während des Kurses ist nicht vorgesehen.',
    },
    {
      id: 'warum-nicht-ueberall',
      question: 'Warum gibt es Distance Learning nicht bei allen Kursen?',
      answer:
        'Der Intensivkurs in den Sportferien fällt oft mit Familienferien zusammen — deshalb bieten wir hier gezielt die Möglichkeit, von unterwegs teilzunehmen. Bei den länger laufenden Wochen- und Halbjahreskursen ist die Präsenz vor Ort Teil des Konzepts.',
    },
  ],
} as const satisfies TargetedServicePageModel

// ---------------------------------------------------------------------------------------------
// 2.8 TipsPageModel -- Layout_Tipps_Uebersichtsseite.html
// ---------------------------------------------------------------------------------------------

export const tipsPageModel = {
  hero: {
    eyebrow: 'Wissen & Orientierung',
    title: 'Tipps rund um die Gymivorbereitung',
    description:
      'Kurze, konkrete Einblicke aus unserer Praxis — zur Prüfungsplanung, zum Lernen zu Hause, zu Deutsch und Mathematik sowie zu besonderen Förderbedarfen. Für Eltern, die sich einen Überblick verschaffen möchten, bevor sie ins Detail gehen.',
  },
  categories: [
    {
      id: 'pruefung-planung',
      title: 'Prüfung & Planung',
      tips: [
        {
          id: 'langzeit-kurzzeit',
          title: 'Langzeit- oder Kurzzeitgymnasium — welcher Weg passt?',
          excerpt:
            'Beide Wege führen ans Gymnasium, unterscheiden sich aber deutlich in Tempo, Einstiegsalter und Anforderungsprofil. Eine Übersicht der wichtigsten Unterschiede, damit die Entscheidung leichter fällt.',
        },
        {
          id: 'wann-beginnen',
          title: 'Wann sollte die Vorbereitung beginnen?',
          excerpt:
            'Ein früher Einstieg schon in der 5. Klasse gibt vielen Kindern Sicherheit und Zeit, Lücken in Ruhe zu schliessen — muss aber nicht für jedes Kind der richtige Zeitpunkt sein.',
        },
        {
          id: 'pruefungsformat-aenderungen',
          title: 'Was sich am Prüfungsformat zuletzt geändert hat',
          excerpt:
            'Prüfungsreglemente werden periodisch angepasst. Die wichtigsten Änderungen im Überblick, damit Sie mit aktuellem Wissen planen.',
        },
      ],
    },
    {
      id: 'lernen-motivation',
      title: 'Lernen & Motivation',
      tips: [
        {
          id: 'lernen-zuhause-kraftakt',
          title: 'Wenn Lernen zu Hause zum Kraftakt wird',
          excerpt:
            'Streit ums Üben ist oft ein Beziehungsthema, kein Fleissproblem. Warum Struktur und ein klar getrennter Rahmen zwischen Eltern- und Lernrolle hier oft mehr bewirken als zusätzlicher Druck.',
        },
        {
          id: 'struktur-die-hilft',
          title: 'Struktur, die wirklich hilft',
          excerpt:
            'Ein realistischer Wochenplan mit festen Lernblöcken schafft Verlässlichkeit — für Kinder wie für Eltern. Konkrete Ansätze für den Alltag zu Hause.',
        },
        {
          id: 'mental-stark',
          title: 'Mental stark in die Prüfung',
          excerpt:
            'Nervosität vor der Prüfung ist normal — entscheidend ist, wie gut ein Kind lernt, damit umzugehen. Einfache Techniken, die sich in den Alltag einbauen lassen.',
        },
      ],
    },
    {
      id: 'deutsch-aufsatz',
      title: 'Deutsch & Aufsatz',
      tips: [
        {
          id: 'guter-aufsatz',
          title: 'Was einen guten Aufsatz ausmacht',
          excerpt:
            'Nicht Perfektion zählt, sondern ein klarer roter Faden, eigene Sprache und ein glaubwürdiger Inhalt. Worauf es bei der Bewertung wirklich ankommt.',
        },
        {
          id: 'kommasetzung',
          title: 'Kommasetzung ohne Grammatikstress',
          excerpt:
            'Mit einem einfachen Bild statt trockener Regeln verstehen viele Kinder Satzgrenzen deutlich schneller. Ein praktischer Ansatz fürs Üben zu Hause.',
        },
        {
          id: 'rechtschreibung-verstehen',
          title: 'Rechtschreibung verstehen statt auswendig lernen',
          excerpt: 'Wer die Logik hinter Regeln erkennt, muss weniger pauken. Wie Kinder ein echtes Gefühl für Rechtschreibung entwickeln.',
        },
      ],
    },
    {
      id: 'mathematik',
      title: 'Mathematik',
      tips: [
        {
          id: 'loesungsweg-zaehlt',
          title: 'Der Lösungsweg zählt so viel wie das Resultat',
          excerpt:
            'Ein richtiges Ergebnis allein reicht an der Prüfung oft nicht — die Nachvollziehbarkeit des Rechenwegs bringt zusätzliche Punkte. Was das für die Vorbereitung bedeutet.',
        },
        {
          id: 'textaufgaben-meistern',
          title: 'Textaufgaben Schritt für Schritt meistern',
          excerpt:
            'Die grösste Hürde ist oft nicht das Rechnen, sondern das Verstehen der Aufgabenstellung. Eine Herangehensweise, die Kindern hier Sicherheit gibt.',
        },
      ],
    },
    {
      id: 'foerderbedarfe',
      title: 'Besondere Förderbedarfe',
      tips: [
        {
          id: 'konzentration-schwerfaellt',
          title: 'Wenn Konzentration besonders schwerfällt',
          excerpt:
            'Manche Kinder brauchen mehr Struktur und kürzere Lerneinheiten, um ihr Potenzial zu zeigen. Was in der Vorbereitung dann besonders hilft.',
        },
        {
          id: 'nachteilsausgleich',
          title: 'Nachteilsausgleich — was Eltern wissen sollten',
          excerpt:
            'Bei bestimmten Diagnosen können Anpassungen bei der Prüfung beantragt werden. Ein Überblick, was dafür nötig ist und wie der Ablauf funktioniert.',
        },
      ],
    },
    // Neue Kategorie auf Wunsch des Betreibers (22.07.2026): sinngemäss und stark gekürzt aus den
    // öffentlich einsehbaren F-Antworten von
    // https://gymivorbereitung-zuerich.ch/tipps/haeufige-fragen-und-antworten übernommen, in
    // eigenen Worten neu formuliert -- keine Übernahme von Sätzen/Formulierungen der Quelle.
    {
      id: 'nach-der-pruefung',
      title: 'Nach der Prüfung',
      tips: [
        {
          id: 'wenn-es-nicht-klappt',
          title: 'Und wenn die Prüfung nicht klappt?',
          excerpt:
            'Ein Nicht-Bestehen ist nicht das Ende des Weges: Je nach Ausgangslage bleiben ein späterer Anlauf über die Kurzzeit-Aufnahmeprüfung oder gleichwertige Wege wie BMS, FMS, IMS oder die Passerelle offen.',
        },
        {
          id: 'erstes-semester-gymi',
          title: 'Der Sprung ins erste Gymi-Semester',
          excerpt:
            'Am Gymnasium liegt die Verantwortung fürs Lernen deutlich stärker beim Kind selbst — Stoffmenge und Tempo steigen spürbar. Wer sich bereits in der Vorbereitung eine gute Lernstruktur angewöhnt hat, tut sich beim Einstieg leichter.',
        },
      ],
    },
  ],
  faq: [
    {
      id: 'kurs-noetig',
      question: 'Muss ich zuerst einen Kurs buchen, um diese Tipps zu nutzen?',
      answer: 'Nein — die Tipps stehen allen Eltern offen, unabhängig davon, ob Ihr Kind bereits einen Kurs bei uns besucht.',
    },
    {
      id: 'klassenstufen',
      question: 'Für welche Klassenstufen sind die Tipps relevant?',
      answer:
        'Die meisten Beiträge sind für alle Stufen zwischen 4. Klasse und 2./3. Sek hilfreich; einzelne Themen (z. B. Prüfungsformat-Änderungen) sind spezifisch für das jeweilige Prüfungsjahr gekennzeichnet.',
    },
    {
      id: 'neue-beitraege',
      question: 'Wie oft kommen neue Beiträge dazu?',
      answer: 'Wir ergänzen die Sammlung laufend um neue Themen aus unserer Beratungs- und Kurspraxis.',
    },
  ],
} as const satisfies TipsPageModel

// ---------------------------------------------------------------------------------------------
// 2.8 TargetedServicePageModel -- Layout_Pruefungssimulation_Landingpage.html
// ---------------------------------------------------------------------------------------------

export const pruefungssimulationPageModel = {
  id: 'pruefungssimulation',
  hero: {
    eyebrow: 'Zusatzangebot · Ohne Kursverpflichtung',
    title: 'Prüfungssimulation',
    description:
      'Eine echte Aufnahmeprüfung unter realen Bedingungen — inklusive schriftlicher Bewertung und individuellem Feedback. Auch ohne vorherige Kursteilnahme buchbar.',
  },
  eligibleAudiences: audiences.filter((audience) => audience.id === '6' || audience.id === '2-3-sek'),
  flowSteps: [
    {
      id: 'anmeldung',
      title: 'Anmeldung',
      body: 'Buchung eines einzelnen Prüfungstermins — unabhängig davon, ob Ihr Kind sonst einen Kurs bei uns besucht.',
    },
    {
      id: 'durchfuehrung',
      title: 'Durchführung',
      body: 'Die vollständige Aufnahmeprüfung nach aktuellem Prüfungsformat, unter denselben zeitlichen und organisatorischen Bedingungen wie am echten Prüfungstag.',
    },
    {
      id: 'auswertung-feedback',
      title: 'Auswertung & Feedback',
      body: 'Schriftliche Korrektur aller Teile, eine Einschätzung des aktuellen Leistungsstands und konkrete Hinweise, woran Ihr Kind bis zur echten Prüfung noch arbeiten kann.',
    },
  ],
  features: [
    {
      id: 'pruefungsnahe-bedingungen',
      title: 'Prüfungsnahe Bedingungen',
      description: 'Gleicher Zeitrahmen, gleiches Format und gleiche Aufgabentypen wie an der echten Aufnahmeprüfung.',
    },
    {
      id: 'schriftliche-bewertung',
      title: 'Schriftliche Bewertung',
      description: 'Detaillierte Korrektur inkl. Aufsatz, mit Einschätzung des aktuellen Leistungsstands.',
    },
    {
      id: 'offen-fuer-alle',
      title: 'Offen für alle',
      description: 'Keine vorherige Kursteilnahme nötig — buchbar für jedes Kind der passenden Klassenstufe.',
    },
  ],
  contentSections: [
    {
      id: 'fuer-wen',
      title: 'Für wen es ist',
      groups: [
        {
          id: 'zwei-pruefungsjahre',
          items: ['Die Prüfungssimulation richtet sich an zwei Prüfungsjahre.'],
        },
        {
          id: 'ausschluss',
          items: [
            'Für alle anderen Klassenstufen (4./5. Klasse, 1. Sek) ist dieses Angebot noch nicht relevant — die jeweilige Aufnahmeprüfung findet erst nach 6. Klasse bzw. 2./3. Sek statt.',
          ],
        },
      ],
    },
  ],
  faq: [
    {
      id: 'vorheriger-kurs',
      question: 'Muss mein Kind vorher einen Kurs bei Ihnen besucht haben?',
      answer: 'Nein. Die Prüfungssimulation ist ein eigenständiges Angebot und unabhängig von einer Kursteilnahme buchbar.',
    },
    {
      id: 'klassenstufen',
      question: 'Für welche Klassenstufen gibt es die Prüfungssimulation?',
      answer:
        'Nur für 6. Klasse (Vorbereitung Langzeitgymnasium, ZAP1) und 2./3. Sek (Vorbereitung Kurzzeitgymnasium, ZAP2) — da nur in diesen beiden Jahren die jeweilige Aufnahmeprüfung stattfindet.',
    },
    {
      id: 'auswertung-tempo',
      question: 'Wie schnell erhalten wir die Auswertung?',
      answer: 'Die schriftliche Bewertung inkl. Einschätzung des Leistungsstands erhalten Sie zeitnah nach der Simulation.',
    },
  ],
} as const satisfies TargetedServicePageModel

// ---------------------------------------------------------------------------------------------
// Schritt 10, Runde 1/6 -- 4. Klasse: Layout_4_Klasse_Hauptseite.html +
// Layout_4_Klasse_Halbjahreskurs_Unterseite.html + Layout_4_Klasse_Intensivkurs_Unterseite.html.
// Frühbucher-Deadline "bis Juli" ist in der Quelle nur unpräzise angegeben (kein Tagesdatum) --
// dieselbe Regel wie beim 6.-Klasse-Halbjahreskurs angewendet: der Juli VOR Kursbeginn
// (Kurslaufzeit "März – Juli 2027" -> Deadline 2026-07-31).
// ---------------------------------------------------------------------------------------------

export const vierKlasseHalbjahreskursSessions = [
  {
    id: 8001,
    offerId: 'offer-4klasse-halbjahreskurs',
    capacity: 8,
    source: { kind: 'intensivwoche_kurse', kursId: 8001 },
    kurs: 'Kurs A',
    dateLabel: 'Samstag, 13:15–15:00',
    timeLabel: '13:15–15:00',
    standort: 'Zürich HB',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'deutsch', label: 'Deutsch', value: '45 Min.' },
        { id: 'mathematik', label: 'Mathematik', value: '45 Min.' },
        { id: 'lerncoaching', label: 'Lerncoaching', value: '15 Min.' },
      ],
    },
  },
  {
    id: 8002,
    offerId: 'offer-4klasse-halbjahreskurs',
    capacity: 8,
    source: { kind: 'intensivwoche_kurse', kursId: 8002 },
    kurs: 'Kurs B',
    dateLabel: 'Samstag, 08:45–10:30',
    timeLabel: '08:45–10:30',
    standort: 'Winterthur',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'deutsch', label: 'Deutsch', value: '45 Min.' },
        { id: 'mathematik', label: 'Mathematik', value: '45 Min.' },
        { id: 'lerncoaching', label: 'Lerncoaching', value: '15 Min.' },
      ],
    },
  },
  {
    id: 8003,
    offerId: 'offer-4klasse-halbjahreskurs',
    capacity: 8,
    source: { kind: 'intensivwoche_kurse', kursId: 8003 },
    kurs: 'Kurs C',
    dateLabel: 'Mittwoch, 15:45–17:30',
    timeLabel: '15:45–17:30',
    standort: 'Zürich HB',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'deutsch', label: 'Deutsch', value: '45 Min.' },
        { id: 'mathematik', label: 'Mathematik', value: '45 Min.' },
        { id: 'lerncoaching', label: 'Lerncoaching', value: '15 Min.' },
      ],
    },
  },
  {
    id: 8004,
    offerId: 'offer-4klasse-halbjahreskurs',
    capacity: 8,
    source: { kind: 'intensivwoche_kurse', kursId: 8004 },
    kurs: 'Kurs D',
    dateLabel: 'Mittwoch, 13:45–15:30',
    timeLabel: '13:45–15:30',
    standort: 'Winterthur',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'deutsch', label: 'Deutsch', value: '45 Min.' },
        { id: 'mathematik', label: 'Mathematik', value: '45 Min.' },
        { id: 'lerncoaching', label: 'Lerncoaching', value: '15 Min.' },
      ],
    },
  },
] satisfies SessionDefinition[]

export const vierKlasseHalbjahreskurs = {
  id: 'offer-4klasse-halbjahreskurs',
  audienceId: '4',
  slug: 'halbjahreskurs',
  href: '/kurse/4-klasse/halbjahreskurs',
  displayName: 'Halbjahreskurs',
  categoryLabel: 'Deutsch, Mathematik & Lerncoaching',
  tagline: 'Breite Vorbereitung über das ganze Semester',
  lede: 'Lücken in Deutsch und Mathematik frühzeitig erkennen und schliessen, dazu erste Lernstrategien fürs Lerncoaching mitgeben — alles in einem wöchentlichen Termin, damit ein stabiles Fundament für die weiteren Schuljahre entsteht.',
  description:
    'Deutsch, Mathematik und spielerisches Lernen in einem Termin — je 45 Minuten pro Bereich, mit Fachwechsel für maximale Aufmerksamkeit. Ob Wortschatz-Spiele oder Kopfrechen-Wettbewerbe: Lernen mit Spass statt nur Pauken.',
  recommended: true,
  laufzeit: 'März – Juli 2027',
  dateSummary: ['März – Juli 2027'],
  features: [
    'Lücken in Grammatik, Rechtschreibung & Aufsatz schliessen',
    'Grundrechenarten, Sachaufgaben & Textverständnis vertiefen',
    'Lerncoaching & Lernspiele pro Termin',
    'Samstag- oder Mittwochnachmittag',
  ],
  regularPriceRappen: 349000,
  earlyBirdPriceRappen: 269000,
  earlyBirdDeadline: '2026-07-31',
  currency: 'CHF',
  overviewBullets: [
    '14 Kurstage zwischen März und Juli 2027',
    'Kleingruppen',
    'Standortbestimmung & Abschlusstest inbegriffen',
  ],
  whyUs: [
    {
      id: 'lerncoaching-jeder-termin',
      title: 'Lerncoaching bei jedem Termin',
      description:
        '15 Minuten pro Termin für Selbstorganisation, Lernmethoden und Konzentration — die Basis, um von den fachlichen Inhalten wirklich zu profitieren.',
    },
    {
      id: 'lernen-mit-spass',
      title: 'Lernen mit Spass statt Druck',
      description: 'Lernspiele und Wettbewerbe sorgen dafür, dass Üben sich nicht wie ein Test anfühlt.',
    },
    {
      id: 'praktische-strategien',
      title: 'Praktische Lern- und Prüfungsstrategien',
      description:
        'Von der richtigen Lernumgebung über Konzentrationsübungen bis zur Herangehensweise an typische Aufgaben — Grundlagen, die auch später an der Gymiprüfung helfen.',
    },
    {
      id: 'kleingruppen',
      title: 'Kleingruppen von höchstens 8 Kindern',
      description: 'Genug Raum für individuelle Fragen, ohne dass ein Kind im Kurs untergeht.',
    },
  ],
  kurstyp: 'halbjahreskurs',
  flowSteps: [
    {
      id: 'standortbestimmung',
      title: 'Standortbestimmung',
      body: 'Vor dem ersten Kurstag stellen wir fest, wo Ihr Kind aktuell steht — besonders hilfreich bei anderer Erstsprache oder kürzlichem Zuzug in die Schweiz.',
    },
    {
      id: 'woechentliches-training',
      title: 'Wöchentliches Training',
      body: 'Von März bis Juli wird an 14 Terminen in Deutsch, Mathematik und Lerncoaching gearbeitet — mit den offiziellen DUDEN-Lehrmitteln für Deutsch.',
    },
    {
      id: 'abschlusstest-feedback',
      title: 'Abschlusstest & Feedback',
      body: 'Nach dem letzten Kurstag zeigt ein Abschlusstest den aktuellen Lernstand — inklusive Empfehlung, was über die Sommerferien noch geübt werden sollte.',
    },
  ],
  contentSections: [
    {
      id: 'mathematik',
      title: 'Mathematik',
      groups: [
        {
          id: 'themen',
          items: [
            'Zahlen & Ziffern — Zahlenraum erweitern, Stellenwerte verstehen',
            'Addition & Subtraktion — mündliche und schriftliche Rechenstrategien',
            'Multiplikation & Division — Einmaleins festigen, Rechenwege verstehen',
            'Grössen & Daten — Zeit, Geld, Gewicht, Länge; Daten lesen und darstellen',
            'Geometrie — Formen, Körper, Symmetrie',
          ],
        },
      ],
    },
    {
      id: 'deutsch',
      title: 'Deutsch',
      groups: [
        {
          id: 'grammatik',
          subhead: 'Grammatik',
          items: [
            'Wortarten — Nomen, Pronomen, Adjektive, Verben',
            'Wortbildung',
            'Bausteine eines Satzes',
            'Sätze verbinden',
          ],
        },
        {
          id: 'rechtschreibung',
          subhead: 'Rechtschreibung',
          items: [
            'Gross- und Kleinschreibung',
            'Schwierige Laute',
            'Langer und kurzer Vokal',
            'Getrennt- und Zusammenschreibung',
            'Zeichensetzung',
          ],
        },
        {
          id: 'aufsatz',
          subhead: 'Aufsatz (Schreiben)',
          items: [
            'Erlebniserzählung',
            'Bildergeschichte',
            'Reizwortgeschichte',
            'Tiere & Gegenstände beschreiben',
            'Berichte verfassen',
            'Eigene Meinung bilden (inkl. Schreibkonferenz)',
          ],
        },
        {
          id: 'lesen',
          subhead: 'Lesen — Trainieren & Strategien nutzen',
          items: [
            'Vorwissen nutzen',
            'Gezielt lesen',
            'Handlungsschritte herausfinden',
            'Stichwörter notieren',
            'Texte vergleichen',
            'Zu einem Thema recherchieren',
            'Eigene Meinung bilden',
          ],
        },
      ],
    },
    {
      id: 'lerncoaching',
      title: 'Lerncoaching',
      groups: [
        {
          id: 'themen',
          items: [
            'Selbstorganisation — Planung und Struktur für den Lernalltag',
            'Lernumgebung — den passenden Lernort finden',
            'Lernmethoden — Techniken und Tricks fürs Lernen',
            'Motivation — Ziele setzen und dranbleiben, auch wenn es mal harzt',
            'Konzentration — Übungen für mehr Fokus',
            'Bei LRS — gezielte Tipps für Lesen und Rechtschreibung',
            'Sommer-Smart — erholen, repetieren und gestärkt weitermachen',
          ],
        },
      ],
    },
  ],
  booking: {
    anchorId: 'buchung',
    title: 'Termine und Buchung',
    note: 'Jeder Termin folgt demselben Ablauf — Details dazu unter "Ablauf".',
    emptyState: 'Aktuell sind keine Termine verfügbar.',
  },
} as const satisfies CourseOffer

export const vierKlasseHalbjahreskursDetailPageModel = {
  audience: vierKlasse,
  offer: vierKlasseHalbjahreskurs,
  sessions: vierKlasseHalbjahreskursSessions,
} as const satisfies CourseDetailPageModel

export const vierKlasseLerncampSessions = [
  {
    id: 8101,
    offerId: 'offer-4klasse-lerncamp-sportferien',
    capacity: 8,
    source: { kind: 'intensivwoche_kurse', kursId: 8101 },
    kurs: 'Kurs A',
    dateLabel: '08.–12. Feb.',
    timeLabel: '09.00–12.00',
    standort: 'Zürich HB',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'mo', label: 'Mo, 08. Feb.', value: '09.00–12.00' },
        { id: 'di', label: 'Di, 09. Feb.', value: '09.00–12.00' },
        { id: 'mi', label: 'Mi, 10. Feb.', value: '09.00–12.00' },
        { id: 'do', label: 'Do, 11. Feb.', value: '09.00–12.00' },
        { id: 'fr', label: 'Fr, 12. Feb.', value: '09.00–12.00', highlight: true },
      ],
    },
  },
  {
    id: 8102,
    offerId: 'offer-4klasse-lerncamp-sportferien',
    capacity: 8,
    source: { kind: 'intensivwoche_kurse', kursId: 8102 },
    kurs: 'Kurs B',
    dateLabel: '15.–19. Feb.',
    timeLabel: '13.30–16.30',
    standort: 'Winterthur',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'mo', label: 'Mo, 15. Feb.', value: '13.30–16.30' },
        { id: 'di', label: 'Di, 16. Feb.', value: '13.30–16.30' },
        { id: 'mi', label: 'Mi, 17. Feb.', value: '13.30–16.30' },
        { id: 'do', label: 'Do, 18. Feb.', value: '13.30–16.30' },
        { id: 'fr', label: 'Fr, 19. Feb.', value: '13.30–16.30', highlight: true },
      ],
    },
  },
  {
    id: 8103,
    offerId: 'offer-4klasse-lerncamp-sportferien',
    capacity: 8,
    source: { kind: 'intensivwoche_kurse', kursId: 8103 },
    kurs: 'Kurs C',
    dateLabel: '22.–26. Feb.',
    timeLabel: '09.00–12.00',
    standort: 'Zürich HB',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'mo', label: 'Mo, 22. Feb.', value: '09.00–12.00' },
        { id: 'di', label: 'Di, 23. Feb.', value: '09.00–12.00' },
        { id: 'mi', label: 'Mi, 24. Feb.', value: '09.00–12.00' },
        { id: 'do', label: 'Do, 25. Feb.', value: '09.00–12.00' },
        { id: 'fr', label: 'Fr, 26. Feb.', value: '09.00–12.00', highlight: true },
      ],
    },
  },
  {
    id: 8104,
    offerId: 'offer-4klasse-lerncamp-sportferien',
    capacity: 8,
    source: { kind: 'intensivwoche_kurse', kursId: 8104 },
    kurs: 'Kurs D',
    dateLabel: '22.–26. Feb.',
    timeLabel: '13.30–16.30',
    standort: 'Winterthur',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'mo', label: 'Mo, 22. Feb.', value: '13.30–16.30' },
        { id: 'di', label: 'Di, 23. Feb.', value: '13.30–16.30' },
        { id: 'mi', label: 'Mi, 24. Feb.', value: '13.30–16.30' },
        { id: 'do', label: 'Do, 25. Feb.', value: '13.30–16.30' },
        { id: 'fr', label: 'Fr, 26. Feb.', value: '13.30–16.30', highlight: true },
      ],
    },
  },
] satisfies SessionDefinition[]

export const vierKlasseLerncampSportferien = {
  id: 'offer-4klasse-lerncamp-sportferien',
  audienceId: '4',
  slug: 'lerncamp-sportferien',
  href: '/kurse/4-klasse/lerncamp-sportferien',
  displayName: 'Lerncamp – Sportferien',
  tagline: 'Spielerisch, ohne Prüfungsdruck',
  lede: 'Grundlagen in Deutsch und Mathematik auffrischen — spielerisch, ohne Prüfungsdruck, mit spürbarem Fortschritt in einer Woche.',
  description:
    'Ideal für Kinder, die ihre Grundlagen in Deutsch und Mathematik stärken und Lücken schliessen möchten — spielerisch, ohne Prüfungsdruck, mit spürbarem Fortschritt in einer Woche.',
  laufzeit: 'Sportferien 2027',
  dateSummary: ['Sportferien 2027'],
  features: [
    '5 aufeinanderfolgende Halbtage in den Ferien',
    'Kurszeit: 09.00 – 12.00 Uhr oder 13.30 – 16.30 Uhr',
    'Standortbestimmung zu Kursbeginn',
    'Lerncoaching inbegriffen',
    'Wettbewerbe & Lernspiele für mehr Motivation',
  ],
  regularPriceRappen: 89000,
  currency: 'CHF',
  overviewBullets: [
    '5 Halbtage in den Ferien',
    'Kurszeit: 09.00 – 12.00 Uhr oder 13.30 – 16.30 Uhr',
    'Kleingruppen: 3 bis max. 8 Kinder',
    'Zürich HB · Winterthur',
  ],
  whyUs: [
    {
      id: 'standortbestimmung',
      title: 'Standortbestimmung zu Kursbeginn',
      description: 'Wir stellen fest, wo Lücken bestehen, bevor wir mit dem Training starten — nicht danach.',
    },
    {
      id: 'lernen-mit-spass',
      title: 'Lernen mit Spass statt Druck',
      description: 'Lernspiele und Wettbewerbe sorgen dafür, dass Üben sich nicht wie ein Test anfühlt.',
    },
    {
      id: 'praktische-strategien',
      title: 'Praktische Lern- und Prüfungsstrategien',
      description:
        'Von der richtigen Lernumgebung über Konzentrationsübungen bis zur Herangehensweise an typische Aufgaben — Grundlagen, die auch später an der Gymiprüfung helfen.',
    },
    {
      id: 'kleingruppen',
      title: 'Kleingruppen von höchstens 8 Kindern',
      description: 'Genug Raum für individuelle Fragen, ohne dass ein Kind im Kurs untergeht.',
    },
  ],
  kurstyp: 'intensivkurs',
  flowSteps: [
    {
      id: 'ankommen-einschaetzen',
      title: 'Ankommen & Einschätzen',
      body: 'Ein kurzer, spielerischer Check am ersten Tag zeigt der Lehrperson, wo Ihr Kind in Deutsch und Mathematik steht.',
    },
    {
      id: 'ueben-vertiefen',
      title: 'Üben & Vertiefen',
      body: 'An jedem Halbtag wechseln sich Deutsch, Mathematik und eine spielerische Vertiefung ab — Lernspiele und Wettbewerbe halten die Motivation hoch.',
    },
    {
      id: 'zeigen-was-man-kann',
      title: 'Zeigen, was man kann',
      body: 'Kein Test-Druck, aber ein kurzer, positiver Rückblick am letzten Tag zeigt, was Ihr Kind dazugelernt hat und woran es dranbleiben kann.',
    },
  ],
  contentSections: [],
  booking: {
    anchorId: 'buchung',
    title: 'Termine und Buchung',
    emptyState: 'Aktuell sind keine Termine verfügbar.',
  },
} as const satisfies CourseOffer

export const vierKlasseLerncampDetailPageModel = {
  audience: vierKlasse,
  offer: vierKlasseLerncampSportferien,
  sessions: vierKlasseLerncampSessions,
} as const satisfies CourseDetailPageModel

export const vierKlasseAudiencePageModel = {
  audience: vierKlasse,
  hero: {
    title: 'Grundlagen stärken — 4. Klasse',
    description:
      'Grundlagen in Deutsch und Mathematik frühzeitig festigen — im wöchentlichen Rhythmus oder kompakt in den Ferien.',
  },
  offers: [vierKlasseHalbjahreskurs, vierKlasseLerncampSportferien],
  addOnOffers: [],
  existingCourses: [],
} as const satisfies AudiencePageModel

// ---------------------------------------------------------------------------------------------
// Schritt 10, Runde 2/6 -- 5. Klasse: Layout_5_Klasse_Hauptseite.html +
// Layout_5_Klasse_Halbjahreskurs_Unterseite.html +
// Layout_5_Klasse_Intensivkurs_Unterseite.html (Lerncamp).
//
// Lerncamp-Preiskonflikt aufgelöst am 23.07.2026: Hauptseite und Unterseite zeigten für dasselbe
// Angebot widersprüchliche Preise (CHF 950 vs. CHF 890, kein "regulär"-Anker wie beim
// Halbjahreskurs) -- ursprünglich dokumentiert in Abschnitt 2.3 des Architektur-Briefings und
// deshalb komplett aus dem Katalog ausgeschlossen. Punkt 1 aus design-review-todo.md (ebenfalls
// 23.07.2026) hat die Grundlage dieses Ausschlusses ersetzt: Alle Katalogpreise gelten seither
// ohnehin als vorläufig/fiktiv und tragen ein "Vorschau"-Badge, eine einzelne fachliche
// Preisfreigabe ist damit keine Voraussetzung mehr, um ein Angebot aufzunehmen. Nutzer-Entscheid:
// CHF 950 (Hauptseiten-Wert) wird verwendet, siehe fuenfKlasseLerncampSportferien unten.
//
// Beim Halbjahreskurs ist der Konflikt auflösbar: Haupt- und Unterseite stimmen im "regulär
// CHF 3'490"-Wert überein, nur der angezeigte Frühbucherpreis weicht ab (CHF 3'190 vs. CHF 1'980,
// zusätzlich nur "bis Juli" ohne Tagesdatum). regularPriceRappen wird deshalb gesetzt,
// earlyBirdPriceRappen/-Deadline bleiben bewusst unset -- kein Preis wird produktiv beworben, der
// nicht auf beiden Seiten übereinstimmt. Die Kurslaufzeit "Mai – Juli 2027" aus der spezifischeren
// Unterseite wird verwendet, nicht die vagere Hauptseiten-Angabe "Nov. 2026 – Juli 2027".
// ---------------------------------------------------------------------------------------------

export const fuenfKlasseHalbjahreskursSessions = [
  {
    id: 7001,
    offerId: 'offer-5klasse-halbjahreskurs',
    capacity: 8,
    source: { kind: 'intensivwoche_kurse', kursId: 7001 },
    kurs: 'Kurs A',
    dateLabel: 'Samstag, 08:30–10:15',
    timeLabel: '08:30–10:15',
    standort: 'Zürich HB',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'deutsch', label: 'Deutsch', value: '45 Min.' },
        { id: 'mathematik', label: 'Mathematik', value: '45 Min.' },
        { id: 'lerncoaching', label: 'Lerncoaching', value: '15 Min.' },
      ],
    },
  },
  {
    id: 7002,
    offerId: 'offer-5klasse-halbjahreskurs',
    capacity: 8,
    source: { kind: 'intensivwoche_kurse', kursId: 7002 },
    kurs: 'Kurs D',
    dateLabel: 'Samstag, 08:30–10:15',
    timeLabel: '08:30–10:15',
    standort: 'Winterthur',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'deutsch', label: 'Deutsch', value: '45 Min.' },
        { id: 'mathematik', label: 'Mathematik', value: '45 Min.' },
        { id: 'lerncoaching', label: 'Lerncoaching', value: '15 Min.' },
      ],
    },
  },
  {
    id: 7003,
    offerId: 'offer-5klasse-halbjahreskurs',
    capacity: 8,
    source: { kind: 'intensivwoche_kurse', kursId: 7003 },
    kurs: 'Kurs I',
    dateLabel: 'Mittwoch, 13:45–15:30',
    timeLabel: '13:45–15:30',
    standort: 'Zürich HB',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'deutsch', label: 'Deutsch', value: '45 Min.' },
        { id: 'mathematik', label: 'Mathematik', value: '45 Min.' },
        { id: 'lerncoaching', label: 'Lerncoaching', value: '15 Min.' },
      ],
    },
  },
  {
    id: 7004,
    offerId: 'offer-5klasse-halbjahreskurs',
    capacity: 8,
    source: { kind: 'intensivwoche_kurse', kursId: 7004 },
    kurs: 'Kurs K',
    dateLabel: 'Mittwoch, 13:45–15:30',
    timeLabel: '13:45–15:30',
    standort: 'Winterthur',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'deutsch', label: 'Deutsch', value: '45 Min.' },
        { id: 'mathematik', label: 'Mathematik', value: '45 Min.' },
        { id: 'lerncoaching', label: 'Lerncoaching', value: '15 Min.' },
      ],
    },
  },
  {
    id: 7005,
    offerId: 'offer-5klasse-halbjahreskurs',
    capacity: 8,
    source: { kind: 'intensivwoche_kurse', kursId: 7005 },
    kurs: 'Kurs N',
    dateLabel: 'Mittwoch, 18:00–19:45',
    timeLabel: '18:00–19:45',
    standort: 'Winterthur',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'deutsch', label: 'Deutsch', value: '45 Min.' },
        { id: 'mathematik', label: 'Mathematik', value: '45 Min.' },
        { id: 'lerncoaching', label: 'Lerncoaching', value: '15 Min.' },
      ],
    },
  },
] satisfies SessionDefinition[]

export const fuenfKlasseHalbjahreskurs = {
  id: 'offer-5klasse-halbjahreskurs',
  audienceId: '5',
  slug: 'halbjahreskurs',
  href: '/kurse/5-klasse/halbjahreskurs',
  displayName: 'Halbjahreskurs',
  categoryLabel: 'Deutsch, Mathematik & Lerncoaching',
  tagline: 'Breite Vorbereitung über das ganze Semester',
  lede: 'Bereits in der 5. Klasse starten und einen Vorsprung für die 6. Klasse erarbeiten: Grundlagen in Deutsch und Mathematik festigen, dazu gezieltes Lerncoaching für Selbstorganisation und Lernstrategien — alles in einem wöchentlichen Termin.',
  description:
    'Deutsch, Mathematik und spielerisches Lernen in einem Termin — je 45 Minuten pro Bereich, mit Fachwechsel für maximale Aufmerksamkeit. Ob Wortschatz-Spiele oder Kopfrechen-Wettbewerbe: Lernen mit Spass statt nur Pauken.',
  recommended: true,
  laufzeit: 'Mai – Juli 2027',
  dateSummary: ['Mai – Juli 2027'],
  features: [
    'Grammatik, Rechtschreibung & Aufsatztraining vertiefen',
    'Bruchrechnen, Sachaufgaben & Geometrie vertiefen',
    'Lerncoaching & Lernspiele pro Termin',
    'Samstag- oder Mittwochnachmittag',
  ],
  // Nur der auf beiden Quellseiten übereinstimmende "regulär"-Preis wird geführt -- der
  // Frühbucherpreis ist zwischen Haupt- und Unterseite widersprüchlich (siehe Kommentar oben) und
  // bleibt deshalb bewusst unset.
  regularPriceRappen: 349000,
  currency: 'CHF',
  overviewBullets: [
    '8 Kurstage zwischen Frühlings- und Sommerferien (Mai – Juli 2027)',
    'Kleingruppen',
    'Standortbestimmung & Abschlusstest inbegriffen',
  ],
  whyUs: [
    {
      id: 'lerncoaching-jeder-termin',
      title: 'Lerncoaching bei jedem Termin',
      description:
        '15 Minuten pro Termin für Selbstorganisation, Lernmethoden und Konzentration — die Basis, um von den fachlichen Inhalten wirklich zu profitieren.',
    },
    {
      id: 'lernen-mit-spass',
      title: 'Lernen mit Spass statt Druck',
      description: 'Lernspiele und Wettbewerbe sorgen dafür, dass Üben sich nicht wie ein Test anfühlt.',
    },
    {
      id: 'praktische-strategien',
      title: 'Praktische Lern- und Prüfungsstrategien',
      description:
        'Von der richtigen Lernumgebung über Konzentrationsübungen bis zur Herangehensweise an typische Aufgaben — Grundlagen, die auch später an der Gymiprüfung helfen.',
    },
    {
      id: 'kleingruppen',
      title: 'Kleingruppen von höchstens 8 Kindern',
      description: 'Genug Raum für individuelle Fragen, ohne dass ein Kind im Kurs untergeht.',
    },
  ],
  kurstyp: 'halbjahreskurs',
  flowSteps: [
    {
      id: 'standortbestimmung',
      title: 'Standortbestimmung',
      body: 'Vor dem ersten Kurstag stellen wir fest, wo Ihr Kind aktuell steht — insbesondere hilfreich nach Lehrerwechseln oder bei Unsicherheit über den Wissensstand.',
    },
    {
      id: 'woechentliches-training',
      title: 'Wöchentliches Training',
      body: 'Von Mai bis Juli wird an 8 Terminen in Deutsch, Mathematik und Lerncoaching gearbeitet — mit regelmässigen Zwischentests zur Lernstandskontrolle.',
    },
    {
      id: 'abschlusstest-feedback',
      title: 'Abschlusstest & Feedback',
      body: 'Nach dem letzten Kurstag zeigt ein Abschlusstest den aktuellen Lernstand — inklusive Empfehlung, was bis zur 6. Klasse noch gezielt geübt werden sollte.',
    },
  ],
  contentSections: [
    {
      id: 'mathematik',
      title: 'Mathematik',
      groups: [
        {
          id: 'themen',
          items: [
            'Natürliche Zahlen',
            'Grundrechenarten — Multiplikation, Division, Addition, Subtraktion',
            'Rechen-Check — Strategien, um bei der Prüfung die volle Punktzahl zu erreichen',
            'Grössen',
            'Geometrische Grundbegriffe',
            'Brüche',
            'Würfel & Quader',
            'Sachaufgaben — mit Fokus auf Grössen',
            'Textaufgaben — zu allen behandelten Themen',
          ],
        },
      ],
    },
    {
      id: 'deutsch',
      title: 'Deutsch',
      lede: 'Die Themenschwerpunkte werden individuell auf den Lernstand des Kindes abgestimmt.',
      groups: [
        {
          id: 'themen',
          items: [
            'Aufsatz — Prüfungsanforderungen und verlangte Textsorten kennenlernen',
            'Erzählung — Ideen sammeln, planen, schreiben und überarbeiten',
            'Satzglieder — Satzproben, Satzanfänge und Satzverbindungen üben',
            'Textverständnis — Lesestrategien aufbauen und gezielt trainieren',
            'Rechtschreibung — zentrale Regeln und passende Übungen',
            'Verben — Konjugation, Zeitformen und Wortstammprinzip',
            'Nomen & Adjektive — inkl. Wortschatzübungen',
          ],
        },
      ],
    },
    {
      id: 'lerncoaching',
      title: 'Lerncoaching',
      groups: [
        {
          id: 'themen',
          items: [
            'Selbstorganisation — Planung und Struktur für den Lernalltag',
            'Lernumgebung — den passenden Lernort finden',
            'Lernmethoden — Techniken und Tricks fürs Lernen',
            'Motivation — Ziele setzen und dranbleiben, auch wenn es mal harzt',
            'Konzentration — Übungen für mehr Fokus',
            'Bei LRS — gezielte Tipps für Lesen und Rechtschreibung',
            'Sommer-Smart — erholen, repetieren und gestärkt in die 6. Klasse starten',
          ],
        },
      ],
    },
  ],
  booking: {
    anchorId: 'buchung',
    title: 'Termine und Buchung',
    note: 'Jeder Termin folgt demselben Ablauf — Details dazu unter "Ablauf".',
    emptyState: 'Aktuell sind keine Termine verfügbar.',
  },
} as const satisfies CourseOffer

export const fuenfKlasseHalbjahreskursDetailPageModel = {
  audience: fuenfKlasse,
  offer: fuenfKlasseHalbjahreskurs,
  sessions: fuenfKlasseHalbjahreskursSessions,
} as const satisfies CourseDetailPageModel

// Layout_5_Klasse_Intensivkurs_Unterseite.html -- inhaltlich (Ablauf/Features/whyUs) wortgleich
// mit vierKlasseLerncampSportferien oben, nur Termine und Preis unterscheiden sich; Session-IDs
// 7101-7104 kollisionsfrei neben fuenfKlasseHalbjahreskursSessions (7001-7005).
export const fuenfKlasseLerncampSessions = [
  {
    id: 7101,
    offerId: 'offer-5klasse-lerncamp-sportferien',
    capacity: 8,
    source: { kind: 'intensivwoche_kurse', kursId: 7101 },
    kurs: 'Kurs A',
    dateLabel: '08.–12. Feb.',
    timeLabel: '09.00–12.00',
    standort: 'Zürich HB',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'mo', label: 'Mo, 08. Feb.', value: '09.00–12.00' },
        { id: 'di', label: 'Di, 09. Feb.', value: '09.00–12.00' },
        { id: 'mi', label: 'Mi, 10. Feb.', value: '09.00–12.00' },
        { id: 'do', label: 'Do, 11. Feb.', value: '09.00–12.00' },
        { id: 'fr', label: 'Fr, 12. Feb.', value: '09.00–12.00', highlight: true },
      ],
    },
  },
  {
    id: 7102,
    offerId: 'offer-5klasse-lerncamp-sportferien',
    capacity: 8,
    source: { kind: 'intensivwoche_kurse', kursId: 7102 },
    kurs: 'Kurs B',
    dateLabel: '15.–19. Feb.',
    timeLabel: '13.30–16.30',
    standort: 'Winterthur',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'mo', label: 'Mo, 15. Feb.', value: '13.30–16.30' },
        { id: 'di', label: 'Di, 16. Feb.', value: '13.30–16.30' },
        { id: 'mi', label: 'Mi, 17. Feb.', value: '13.30–16.30' },
        { id: 'do', label: 'Do, 18. Feb.', value: '13.30–16.30' },
        { id: 'fr', label: 'Fr, 19. Feb.', value: '13.30–16.30', highlight: true },
      ],
    },
  },
  {
    id: 7103,
    offerId: 'offer-5klasse-lerncamp-sportferien',
    capacity: 8,
    source: { kind: 'intensivwoche_kurse', kursId: 7103 },
    kurs: 'Kurs C',
    dateLabel: '22.–26. Feb.',
    timeLabel: '09.00–12.00',
    standort: 'Zürich HB',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'mo', label: 'Mo, 22. Feb.', value: '09.00–12.00' },
        { id: 'di', label: 'Di, 23. Feb.', value: '09.00–12.00' },
        { id: 'mi', label: 'Mi, 24. Feb.', value: '09.00–12.00' },
        { id: 'do', label: 'Do, 25. Feb.', value: '09.00–12.00' },
        { id: 'fr', label: 'Fr, 26. Feb.', value: '09.00–12.00', highlight: true },
      ],
    },
  },
  {
    id: 7104,
    offerId: 'offer-5klasse-lerncamp-sportferien',
    capacity: 8,
    source: { kind: 'intensivwoche_kurse', kursId: 7104 },
    kurs: 'Kurs D',
    dateLabel: '22.–26. Feb.',
    timeLabel: '13.30–16.30',
    standort: 'Winterthur',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'mo', label: 'Mo, 22. Feb.', value: '13.30–16.30' },
        { id: 'di', label: 'Di, 23. Feb.', value: '13.30–16.30' },
        { id: 'mi', label: 'Mi, 24. Feb.', value: '13.30–16.30' },
        { id: 'do', label: 'Do, 25. Feb.', value: '13.30–16.30' },
        { id: 'fr', label: 'Fr, 26. Feb.', value: '13.30–16.30', highlight: true },
      ],
    },
  },
] satisfies SessionDefinition[]

export const fuenfKlasseLerncampSportferien = {
  id: 'offer-5klasse-lerncamp-sportferien',
  audienceId: '5',
  slug: 'lerncamp-sportferien',
  href: '/kurse/5-klasse/lerncamp-sportferien',
  displayName: 'Lerncamp – Sportferien',
  tagline: 'Spielerisch, ohne Prüfungsdruck',
  lede: 'Grundlagen in Deutsch und Mathematik auffrischen — spielerisch, ohne Prüfungsdruck, mit spürbarem Fortschritt in einer Woche.',
  description:
    'Ideal für Kinder, die ihre Grundlagen in Deutsch und Mathematik stärken und Lücken schliessen möchten — spielerisch, ohne Prüfungsdruck, mit spürbarem Fortschritt in einer Woche.',
  laufzeit: 'Sportferien 2027',
  dateSummary: ['Sportferien 2027'],
  features: [
    '5 aufeinanderfolgende Halbtage in den Ferien',
    'Kurszeit: 09.00 – 12.00 Uhr oder 13.30 – 16.30 Uhr',
    'Standortbestimmung zu Kursbeginn',
    'Lerncoaching inbegriffen',
    'Wettbewerbe & Lernspiele für mehr Motivation',
  ],
  // Nutzer-Entscheid (2026-07-23): Hauptseiten-Preis CHF 950 statt Unterseiten-Preis CHF 890, siehe
  // Kommentar oben. Kein Frühbucherpreis im Mockup vorhanden.
  regularPriceRappen: 95000,
  currency: 'CHF',
  overviewBullets: [
    '5 Halbtage in den Ferien',
    'Kurszeit: 09.00 – 12.00 Uhr oder 13.30 – 16.30 Uhr',
    'Kleingruppen: 3 bis max. 8 Kinder',
    'Zürich HB · Winterthur',
  ],
  whyUs: [
    {
      id: 'standortbestimmung',
      title: 'Standortbestimmung zu Kursbeginn',
      description: 'Wir stellen fest, wo Lücken bestehen, bevor wir mit dem Training starten — nicht danach.',
    },
    {
      id: 'lernen-mit-spass',
      title: 'Lernen mit Spass statt Druck',
      description: 'Lernspiele und Wettbewerbe sorgen dafür, dass Üben sich nicht wie ein Test anfühlt.',
    },
    {
      id: 'praktische-strategien',
      title: 'Praktische Lern- und Prüfungsstrategien',
      description:
        'Von der richtigen Lernumgebung über Konzentrationsübungen bis zur Herangehensweise an typische Aufgaben — Grundlagen, die auch später an der Gymiprüfung helfen.',
    },
    {
      id: 'kleingruppen',
      title: 'Kleingruppen von höchstens 8 Kindern',
      description: 'Genug Raum für individuelle Fragen, ohne dass ein Kind im Kurs untergeht.',
    },
  ],
  kurstyp: 'intensivkurs',
  flowSteps: [
    {
      id: 'ankommen-einschaetzen',
      title: 'Ankommen & Einschätzen',
      body: 'Ein kurzer, spielerischer Check am ersten Tag zeigt der Lehrperson, wo Ihr Kind in Deutsch und Mathematik steht.',
    },
    {
      id: 'ueben-vertiefen',
      title: 'Üben & Vertiefen',
      body: 'An jedem Halbtag wechseln sich Deutsch, Mathematik und eine spielerische Vertiefung ab — Lernspiele und Wettbewerbe halten die Motivation hoch.',
    },
    {
      id: 'zeigen-was-man-kann',
      title: 'Zeigen, was man kann',
      body: 'Kein Test-Druck, aber ein kurzer, positiver Rückblick am letzten Tag zeigt, was Ihr Kind dazugelernt hat und woran es dranbleiben kann.',
    },
  ],
  contentSections: [],
  booking: {
    anchorId: 'buchung',
    title: 'Termine und Buchung',
    emptyState: 'Aktuell sind keine Termine verfügbar.',
  },
} as const satisfies CourseOffer

export const fuenfKlasseLerncampDetailPageModel = {
  audience: fuenfKlasse,
  offer: fuenfKlasseLerncampSportferien,
  sessions: fuenfKlasseLerncampSessions,
} as const satisfies CourseDetailPageModel

export const fuenfKlasseAudiencePageModel = {
  audience: fuenfKlasse,
  hero: {
    title: 'Grundlagen stärken — 5. Klasse',
    description:
      'Grundlagen in Deutsch und Mathematik frühzeitig festigen — im wöchentlichen Rhythmus oder kompakt in den Ferien.',
  },
  offers: [fuenfKlasseHalbjahreskurs, fuenfKlasseLerncampSportferien],
  addOnOffers: [],
  existingCourses: [],
} as const satisfies AudiencePageModel

// ---------------------------------------------------------------------------------------------
// Schritt 10, Runde 3/6 -- 1. Sek: Layout_1_Sek_Hauptseite.html +
// Layout_1_Sek_Halbjahesrkurs_Unterseite.html (Tippfehler im Original-Dateinamen selbst) +
// Layout_1_Sek_Intensivkurs_Unterseite.html.
//
// Der in Abschnitt 2.3 dokumentierte Preis-Bug ist hier -- anders als beim 5.-Klasse-Lerncamp --
// eindeutig auflösbar: CHF 990 erscheint konsistent auf Haupt- UND Unterseite (kein Widerspruch
// beim Kernpreis). Die begleitende Notiz "regulär CHF 3'490" ist nachweislich ein
// Copy-Paste-Rest aus der 6.-Klasse-Vorlage (dort: CHF 3'390 Frühbucher / "regulär CHF 3'490" --
// eine plausible CHF-100-Differenz; bei 1. Sek wurde nur der Hauptpreis auf CHF 990 geändert, die
// Notiz aber unverändert übernommen und bezieht sich auf nichts Reales mehr). regularPriceRappen
// wird deshalb auf den einzigen echten, konsistenten Wert (990) gesetzt; die fehlerhafte Notiz
// wird nicht übernommen, kein earlyBirdPriceRappen/-Deadline gesetzt.
// ---------------------------------------------------------------------------------------------

export const einsSekVorkursSessions = [
  {
    id: 6001,
    offerId: 'offer-1sek-vorkurs',
    capacity: 8,
    source: { kind: 'intensivwoche_kurse', kursId: 6001 },
    kurs: 'Kurs A',
    dateLabel: 'Samstag, 09:00–10:30',
    timeLabel: '09:00–10:30',
    standort: 'Zürich HB',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'deutsch', label: 'Deutsch', value: '45 Min.' },
        { id: 'mathematik', label: 'Mathematik', value: '30 Min.' },
        { id: 'lerncoaching', label: 'Lerncoaching', value: '15 Min.' },
      ],
    },
  },
  {
    id: 6002,
    offerId: 'offer-1sek-vorkurs',
    capacity: 8,
    source: { kind: 'intensivwoche_kurse', kursId: 6002 },
    kurs: 'Kurs B',
    dateLabel: 'Samstag, 11:00–12:30',
    timeLabel: '11:00–12:30',
    standort: 'Winterthur',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'deutsch', label: 'Deutsch', value: '45 Min.' },
        { id: 'mathematik', label: 'Mathematik', value: '30 Min.' },
        { id: 'lerncoaching', label: 'Lerncoaching', value: '15 Min.' },
      ],
    },
  },
  {
    id: 6003,
    offerId: 'offer-1sek-vorkurs',
    capacity: 8,
    source: { kind: 'intensivwoche_kurse', kursId: 6003 },
    kurs: 'Kurs C',
    dateLabel: 'Mittwoch, 14:00–15:30',
    timeLabel: '14:00–15:30',
    standort: 'Zürich HB',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'deutsch', label: 'Deutsch', value: '45 Min.' },
        { id: 'mathematik', label: 'Mathematik', value: '30 Min.' },
        { id: 'lerncoaching', label: 'Lerncoaching', value: '15 Min.' },
      ],
    },
  },
  {
    id: 6004,
    offerId: 'offer-1sek-vorkurs',
    capacity: 8,
    source: { kind: 'intensivwoche_kurse', kursId: 6004 },
    kurs: 'Kurs D',
    dateLabel: 'Mittwoch, 16:00–17:30',
    timeLabel: '16:00–17:30',
    standort: 'Winterthur',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'deutsch', label: 'Deutsch', value: '45 Min.' },
        { id: 'mathematik', label: 'Mathematik', value: '30 Min.' },
        { id: 'lerncoaching', label: 'Lerncoaching', value: '15 Min.' },
      ],
    },
  },
] satisfies SessionDefinition[]

export const einsSekVorkurs = {
  id: 'offer-1sek-vorkurs',
  audienceId: '1-sek',
  slug: 'vorkurs',
  href: '/kurse/1-sek/vorkurs',
  displayName: 'Vorkurs',
  categoryLabel: 'Deutsch & Mathematik',
  tagline: 'Breite Vorbereitung über das ganze Semester',
  lede: 'Beste Voraussetzungen für die Gymivorbereitung auf die Kurzzeit-Prüfung 2028 schaffen: Grundlagen in Deutsch und Mathematik festigen, dazu eine umfassende Standortbestimmung zum Einstieg und Lerncoaching für die Selbstorganisation.',
  description:
    'Ideal für Kinder, die sich frühzeitig und ohne Druck auf die Kurzzeit-Prüfung 2028 vorbereiten möchten — mit viel Vorlauf und einer Standortbestimmung zum Einstieg.',
  recommended: true,
  laufzeit: 'Mai – Juli 2027',
  dateSummary: ['Mai – Juli 2027'],
  features: [
    'Deutsch & Mathematik',
    'Samstag oder Mittwochnachmittag',
    'Lerncoaching inbegriffen',
    'Umfassende Standortbestimmung inbegriffen',
  ],
  regularPriceRappen: 99000,
  currency: 'CHF',
  overviewBullets: ['Mai – Juli 2027', 'Kleingruppen', 'Standortbestimmung & Lerncoaching inbegriffen'],
  whyUs: [
    {
      id: 'standortbestimmung',
      title: 'Standortbestimmung zu Kursbeginn',
      description: 'Wir stellen fest, wo Lücken bestehen, bevor wir mit dem Training starten — nicht danach.',
    },
    {
      id: 'lerncoaching-inbegriffen',
      title: 'Lerncoaching inbegriffen',
      description:
        'Selbstorganisation, Lernmethoden und Konzentration — die Basis, um von den fachlichen Inhalten wirklich zu profitieren.',
    },
    {
      id: 'kleingruppen',
      title: 'Kleingruppen von höchstens 8 Kindern',
      description: 'Genug Raum für individuelle Fragen, ohne dass ein Kind im Kurs untergeht.',
    },
    {
      id: 'betreuung-ausserhalb',
      title: 'Betreuung auch ausserhalb der Kurszeit',
      description:
        'Eine gute Begleitung endet für uns nicht mit dem Kursende. Unsere Lehrpersonen stehen bei Fragen auch ausserhalb der Kurszeiten jederzeit per Chat zur Verfügung.',
    },
  ],
  kurstyp: 'halbjahreskurs',
  flowSteps: [
    {
      id: 'standortbestimmung',
      title: 'Standortbestimmung',
      body: 'Vor dem ersten Kurstag stellen wir fest, wo Ihr Kind aktuell steht — besonders hilfreich, wenn die Prüfung schon einmal knapp nicht bestanden wurde.',
    },
    {
      id: 'woechentliches-training',
      title: 'Wöchentliches Training',
      body: 'Von Mai bis Juli wird an Deutsch, Mathematik und Lerncoaching gearbeitet — mit Blick auf die Anforderungen der Kurzzeit-Prüfung 2028.',
    },
    {
      id: 'abschlussgespraech-empfehlung',
      title: 'Abschlussgespräch & Empfehlung',
      body: 'Nach dem letzten Kurstag besprechen wir den aktuellen Lernstand und empfehlen, wie es bis zur Prüfung optimal weitergeht — z. B. mit dem Halbjahreskurs in der 2./3. Sek.',
    },
  ],
  contentSections: [
    {
      id: 'mathematik',
      title: 'Mathematik',
      lede: 'Die genauen Schwerpunkte richten sich nach dem individuellen Stand der Schülerinnen und Schüler.',
      groups: [
        {
          id: 'themen',
          items: [
            'Rechnen mit Brüchen',
            'Terme',
            'Geometrische Grundbegriffe',
            'Proportionale Zuordnungen',
            'Statistik',
            'Umfang und Fläche',
            'Rauminhalt und Oberfläche',
            'Textaufgaben',
          ],
        },
      ],
    },
    {
      id: 'deutsch',
      title: 'Deutsch',
      lede: 'Die genauen Schwerpunkte richten sich nach dem individuellen Stand der Schülerinnen und Schüler.',
      groups: [
        {
          id: 'themen',
          items: [
            'Aufsatz — Einführung in Prüfungsbedingungen und geforderte Textsorten',
            'Erzählung — Ideen finden, planen, formulieren und überarbeiten',
            'Satzlehre — Satzglieder inkl. der vier Fälle, Satzproben, Satzanfänge und Satzverbindungen',
            'Textverständnis — Lesestrategien aufbauen und gezielt üben',
            'Rechtschreibung — zentrale Regeln und passende Übungen',
            'Verben — Konjugation, Zeitformen, Wortstammprinzip, Aktiv/Passiv und Verbformen',
            'Wortlehre — inkl. Wortschatzübungen',
          ],
        },
      ],
    },
    {
      id: 'lerncoaching',
      title: 'Lerncoaching',
      groups: [
        {
          id: 'themen',
          items: [
            'Selbstorganisation — Planung und Struktur für den Lernalltag',
            'Lernumgebung — den passenden Lernort finden',
            'Lernmethoden — Techniken und Tricks fürs Lernen',
            'Motivation',
            'Konzentration',
            'Bei LRS — gezielte Tipps für Lesen und Rechtschreibung',
            'Sommer-Smart — erholen, repetieren und gestärkt weitermachen',
          ],
        },
      ],
    },
  ],
  booking: {
    anchorId: 'buchung',
    title: 'Termine und Buchung',
    note: 'Jeder Termin folgt demselben Ablauf — Details dazu unter "Ablauf".',
    emptyState: 'Aktuell sind keine Termine verfügbar.',
  },
} as const satisfies CourseOffer

export const einsSekVorkursDetailPageModel = {
  audience: einsSek,
  offer: einsSekVorkurs,
  sessions: einsSekVorkursSessions,
} as const satisfies CourseDetailPageModel

const einsSekLerncampWeekOptions = [
  { id: '0812', label: '8.–12. Februar' },
  { id: '1519', label: '15.–19. Februar' },
  { id: '2226', label: '22.–26. Februar' },
] satisfies { id: string; label: string }[]

export const einsSekLerncampSessions = [
  {
    id: 6101,
    offerId: 'offer-1sek-lerncamp-sportferien',
    capacity: 8,
    source: { kind: 'intensivwoche_kurse', kursId: 6101 },
    kurs: 'Kurs A',
    weekId: '0812',
    dateLabel: '08.–12. Feb.',
    startAt: '2027-02-08',
    endAt: '2027-02-12',
    timeLabel: '09.00–12.00',
    standort: 'Zürich HB',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'mo', label: 'Mo, 08. Feb.', value: '09.00–12.00' },
        { id: 'di', label: 'Di, 09. Feb.', value: '09.00–12.00' },
        { id: 'mi', label: 'Mi, 10. Feb.', value: '09.00–12.00' },
        { id: 'do', label: 'Do, 11. Feb.', value: '09.00–12.00' },
        { id: 'fr', label: 'Fr, 12. Feb.', value: '09.00–12.00', highlight: true },
      ],
    },
  },
  {
    id: 6102,
    offerId: 'offer-1sek-lerncamp-sportferien',
    capacity: 8,
    source: { kind: 'intensivwoche_kurse', kursId: 6102 },
    kurs: 'Kurs B',
    weekId: '1519',
    dateLabel: '15.–19. Feb.',
    startAt: '2027-02-15',
    endAt: '2027-02-19',
    timeLabel: '13.30–16.30',
    standort: 'Winterthur',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'mo', label: 'Mo, 15. Feb.', value: '13.30–16.30' },
        { id: 'di', label: 'Di, 16. Feb.', value: '13.30–16.30' },
        { id: 'mi', label: 'Mi, 17. Feb.', value: '13.30–16.30' },
        { id: 'do', label: 'Do, 18. Feb.', value: '13.30–16.30' },
        { id: 'fr', label: 'Fr, 19. Feb.', value: '13.30–16.30', highlight: true },
      ],
    },
  },
  {
    id: 6103,
    offerId: 'offer-1sek-lerncamp-sportferien',
    capacity: 8,
    source: { kind: 'intensivwoche_kurse', kursId: 6103 },
    kurs: 'Kurs C',
    weekId: '2226',
    dateLabel: '22.–26. Feb.',
    startAt: '2027-02-22',
    endAt: '2027-02-26',
    timeLabel: '13.30–16.30',
    standort: 'Winterthur',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'mo', label: 'Mo, 22. Feb.', value: '13.30–16.30' },
        { id: 'di', label: 'Di, 23. Feb.', value: '13.30–16.30' },
        { id: 'mi', label: 'Mi, 24. Feb.', value: '13.30–16.30' },
        { id: 'do', label: 'Do, 25. Feb.', value: '13.30–16.30' },
        { id: 'fr', label: 'Fr, 26. Feb.', value: '13.30–16.30', highlight: true },
      ],
    },
  },
] satisfies SessionDefinition[]

export const einsSekLerncampSportferien = {
  id: 'offer-1sek-lerncamp-sportferien',
  audienceId: '1-sek',
  slug: 'lerncamp-sportferien',
  href: '/kurse/1-sek/lerncamp-sportferien',
  displayName: 'Lerncamp – Sportferien',
  tagline: 'Spielerisch, ohne Prüfungsdruck',
  lede: 'Grundlagen in Deutsch und Mathematik auffrischen — spielerisch, ohne Prüfungsdruck, mit spürbarem Fortschritt in einer Woche. Ideal für einen Frühstart oder als Ergänzung zum Vorkurs.',
  description:
    'Ideal für Kinder, die ihre Grundlagen in Deutsch und Mathematik stärken und Lücken schliessen möchten — spielerisch, ohne Prüfungsdruck, mit spürbarem Fortschritt in einer Woche.',
  laufzeit: 'Feb. – März 2027',
  dateSummary: ['Feb. – März 2027'],
  features: [
    '5 aufeinanderfolgende Halbtage in den Ferien',
    'Kurszeit: 09.00 – 12.00 Uhr oder 13.30 – 16.30 Uhr',
    'Standortbestimmung zu Kursbeginn',
    'Lernspiele & Wettbewerbe zur Auflockerung',
  ],
  regularPriceRappen: 89000,
  currency: 'CHF',
  overviewBullets: [
    '5 Halbtage in den Ferien',
    'Kurszeit: 09.00 – 12.00 Uhr oder 13.30 – 16.30 Uhr',
    'Kleingruppen: 3 bis max. 8 Kinder',
    'Zürich HB · Winterthur',
  ],
  whyUs: [
    {
      id: 'standortbestimmung',
      title: 'Standortbestimmung zu Kursbeginn',
      description: 'Wir stellen fest, wo Lücken bestehen, bevor wir mit dem Training starten — nicht danach.',
    },
    {
      id: 'lernen-mit-spass',
      title: 'Lernen mit Spass statt Druck',
      description: 'Lernspiele und Wettbewerbe sorgen dafür, dass Üben sich nicht wie ein Test anfühlt.',
    },
    {
      id: 'praktische-strategien',
      title: 'Praktische Lern- und Prüfungsstrategien',
      description:
        'Von der richtigen Lernumgebung über Konzentrationsübungen bis zur Herangehensweise an typische Aufgaben — Grundlagen, die auch später an der Gymiprüfung helfen.',
    },
    {
      id: 'kleingruppen',
      title: 'Kleingruppen von höchstens 8 Kindern',
      description: 'Genug Raum für individuelle Fragen, ohne dass ein Kind im Kurs untergeht.',
    },
  ],
  kurstyp: 'intensivkurs',
  weekOptions: einsSekLerncampWeekOptions,
  flowSteps: [
    {
      id: 'ankommen-einschaetzen',
      title: 'Ankommen & Einschätzen',
      body: 'Ein kurzer, spielerischer Check am ersten Tag zeigt der Lehrperson, wo Ihr Kind in Deutsch und Mathematik steht.',
    },
    {
      id: 'ueben-vertiefen',
      title: 'Üben & Vertiefen',
      body: 'An jedem Halbtag wechseln sich Deutsch, Mathematik und eine spielerische Vertiefung ab — Lernspiele und Wettbewerbe halten die Motivation hoch.',
    },
    {
      id: 'zeigen-was-man-kann',
      title: 'Zeigen, was man kann',
      body: 'Kein Test-Druck, aber ein kurzer, positiver Rückblick am letzten Tag zeigt, was Ihr Kind dazugelernt hat und woran es dranbleiben kann.',
    },
  ],
  contentSections: [],
  booking: {
    anchorId: 'buchung',
    title: 'Termine und Buchung',
    emptyState: 'Aktuell sind keine Termine verfügbar.',
  },
} as const satisfies CourseOffer

export const einsSekLerncampDetailPageModel = {
  audience: einsSek,
  offer: einsSekLerncampSportferien,
  sessions: einsSekLerncampSessions,
} as const satisfies CourseDetailPageModel

export const einsSekAudiencePageModel = {
  audience: einsSek,
  hero: {
    title: 'Vorbereitungskurse für Gymiprüfung 2028',
    description:
      'Zwei Wege zur Vorbereitung auf die Aufnahmeprüfung ins Kurzzeitgymnasium — der ganzheitliche Halbjahreskurs oder ein kompaktes Ferien-Lerncamp.',
  },
  offers: [einsSekVorkurs, einsSekLerncampSportferien],
  addOnOffers: [],
  existingCourses: [],
} as const satisfies AudiencePageModel

// ---------------------------------------------------------------------------------------------
// Schritt 10, Runde 4/6 -- 2./3. Sek: Layout_2_Sek__Hauptseite.html +
// Layout_2_Sek_Halbjahreskurs_Unterseite.html + Layout_2_Sek_Intensivkurs_Unterseite.html.
// Prüfungssimulation/Selbststudium-Zusatzangebote dieser Zielgruppe bewusst NICHT in dieser Runde
// -- Layout_2_Sek_Pruefungssimulation.html nutzt laut Abschnitt 4 ein fremdes Design-System und
// braucht eine eigene, separate Extraktionsrunde (analog zur bereits erfolgten 6.-Klasse-Trennung
// in Schritt 11).
//
// Preis-Notiz-Bug (Abschnitt 2.3, hier verifiziert): Halbjahreskurs zeigt auf Haupt- UND
// Unterseite identisch "CHF 3'490" mit Notiz "Frühbucherrabatt bis Juli · regulär CHF 3'490" --
// beide Zahlen sind gleich, der Rabatt beträgt also 0. Anders als beim 5.-Klasse-Lerncamp
// (zwei widersprüchliche Zahlen) gibt es hier nur EINE Zahl im Quellmaterial; die Notiz behauptet
// nur fälschlich einen Rabatt, der nicht existiert. earlyBirdPriceRappen/-Deadline bleiben deshalb
// unset (kein zweiter, tieferer Preis wird erfunden), nur der reale, einzige Preis wird geführt.
//
// AblaufPhased (Halbjahreskurs): alle 6 Terminzeilen teilen sich denselben 3-Phasen-/21-Termine-
// Ablauf (kein pro-Kurs-Unterschied in der Quelle) -- als eine gemeinsame Konstante definiert.
// ---------------------------------------------------------------------------------------------

const zweiDreiSekHalbjahreskursAblauf = {
  kind: 'phased',
  phases: [
    {
      id: 'phase-1-basis',
      label: 'Phase 1 — Basis',
      note: 'Standortbestimmung vor dem ersten Kurstag',
      dates: [
        { id: 'p1-1', date: '29.08.2026' },
        { id: 'p1-2', date: '19.09.2026' },
        { id: 'p1-3', date: '05.09.2026' },
        { id: 'p1-4', date: '26.09.2026' },
        { id: 'p1-5', date: '12.09.2026' },
        { id: 'p1-6', date: '03.10.2026' },
      ],
    },
    {
      id: 'phase-2-aufbau',
      label: 'Phase 2 — Aufbau',
      dates: [
        { id: 'p2-1', date: '24.10.2026' },
        { id: 'p2-2', date: '21.11.2026' },
        { id: 'p2-3', date: '31.10.2026' },
        { id: 'p2-4', date: '28.11.2026' },
        { id: 'p2-5', date: '07.11.2026' },
        { id: 'p2-6', date: '05.12.2026' },
        { id: 'p2-7', date: '14.11.2026' },
        { id: 'p2-8', date: '12.12.2026' },
      ],
    },
    {
      id: 'phase-3-repetition',
      label: 'Phase 3 — Repetition',
      dates: [
        { id: 'p3-1', date: '09.01.2027 (Probeprüfung)', highlight: true },
        { id: 'p3-2', date: '30.01.2027' },
        { id: 'p3-3', date: '16.01.2027' },
        { id: 'p3-4', date: '06.02.2027' },
        { id: 'p3-5', date: '23.01.2027' },
        { id: 'p3-6', date: '13.02.2027' },
        { id: 'p3-7', date: '06.03.2027' },
      ],
    },
  ],
} satisfies { kind: 'phased'; phases: unknown[] }

export const zweiDreiSekHalbjahreskursSessions = [
  { kurs: 'Kurs A', id: 5001, dateLabel: 'Samstag, 11:00–12:30', timeLabel: '11:00–12:30', standort: 'Zürich HB' as const },
  { kurs: 'Kurs B', id: 5002, dateLabel: 'Samstag, 13:15–14:45', timeLabel: '13:15–14:45', standort: 'Zürich HB' as const },
  { kurs: 'Kurs C', id: 5003, dateLabel: 'Samstag, 15:00–16:30', timeLabel: '15:00–16:30', standort: 'Zürich HB' as const },
  { kurs: 'Kurs D', id: 5004, dateLabel: 'Samstag, 11:00–12:30', timeLabel: '11:00–12:30', standort: 'Winterthur' as const },
  { kurs: 'Kurs E', id: 5005, dateLabel: 'Samstag, 13:15–14:45', timeLabel: '13:15–14:45', standort: 'Winterthur' as const },
  { kurs: 'Kurs F', id: 5006, dateLabel: 'Samstag, 15:00–16:30', timeLabel: '15:00–16:30', standort: 'Winterthur' as const },
].map((row) => ({
  id: row.id,
  offerId: 'offer-2-3sek-halbjahreskurs',
  capacity: 10,
  source: { kind: 'intensivwoche_kurse' as const, kursId: row.id },
  kurs: row.kurs,
  dateLabel: row.dateLabel,
  timeLabel: row.timeLabel,
  standort: row.standort,
  deliveryModes: ['onsite' as const],
  ablauf: zweiDreiSekHalbjahreskursAblauf,
})) satisfies SessionDefinition[]

export const zweiDreiSekHalbjahreskurs = {
  id: 'offer-2-3sek-halbjahreskurs',
  audienceId: '2-3-sek',
  slug: 'halbjahreskurs',
  href: '/kurse/2-3-sek/halbjahreskurs',
  displayName: 'Halbjahreskurs',
  categoryLabel: 'Deutsch & Mathematik',
  tagline: 'Breite Vorbereitung über das ganze Semester',
  lede: 'Umfassende Vorbereitung auf die Aufnahmeprüfung ins Kurzzeitgymnasium: fachliches Training in Deutsch und Mathematik, dazu gezielte Unterstützung beim Umgang mit Prüfungsdruck — begleitet über das ganze Semester.',
  description:
    'Optimale und nachhaltige Vorbereitung auf die Aufnahmeprüfung ins Kurzzeitgymnasium — gezielte, individuelle Förderung in Mathematik und Deutsch.',
  recommended: true,
  laufzeit: 'Sept. 2026 – März 2027',
  dateSummary: ['Sept. 2026 – März 2027'],
  features: [
    'Mathematik & Deutsch inkl. Aufsatztraining',
    'Samstag oder Mittwochnachmittag',
    'Standortbestimmung & Prüfungssimulation inbegriffen',
    'Betreuung auch ausserhalb der Kurszeiten',
  ],
  // Die Frühbucher-Notiz auf beiden Quellseiten nennt denselben Betrag (CHF 3'490) als "regulär"
  // -- kein realer Rabatt, deshalb bleibt earlyBirdPriceRappen/-Deadline unset (siehe Kommentar
  // oben).
  regularPriceRappen: 349000,
  currency: 'CHF',
  overviewBullets: [
    'Sept. 2026 – März 2027',
    'Kleingruppen',
    'Standortbestimmung & Prüfungssimulation inbegriffen',
    'Betreuung auch ausserhalb der Kurszeiten',
  ],
  whyUs: [
    {
      id: 'standortbestimmung',
      title: 'Standortbestimmung zu Kursbeginn',
      description: 'Wir stellen fest, wo Lücken bestehen, bevor wir mit dem Training starten — nicht danach.',
    },
    {
      id: 'pruefungssimulation',
      title: 'Eine echte Prüfungssimulation',
      description:
        'Reale Prüfungsbedingungen, korrigiert und Schritt für Schritt besprochen — einmal reicht, wenn sie gut gemacht ist.',
    },
    {
      id: 'strategien',
      title: 'Praktische Lern- und Prüfungsstrategien',
      description:
        'Von der richtigen Lernumgebung über den Umgang mit Prüfungsangst und Blackouts bis zu Konzentrationsübungen und der Herangehensweise an typische Prüfungsaufgaben.',
    },
    {
      id: 'betreuung-ausserhalb',
      title: 'Betreuung auch ausserhalb der Kurszeit',
      description:
        'Eine gute Begleitung endet für uns nicht mit dem Kursende. Unsere Lehrpersonen stehen bei Fragen auch ausserhalb der Kurszeiten jederzeit per Chat zur Verfügung.',
    },
  ],
  testimonials: [
    {
      id: 'testi-1',
      quote: 'Über das ganze Semester hinweg habe ich richtig gemerkt, wie ich in Mathe sicherer wurde.',
      author: 'Teilnehmerin, Halbjahreskurs 2./3. Sek',
    },
    {
      id: 'testi-2',
      quote: 'Die Prüfungssimulation hat mir die Nervosität genommen — ich wusste danach, was mich erwartet.',
      author: 'Teilnehmer, Halbjahreskurs 2./3. Sek',
    },
    {
      id: 'testi-3',
      quote: 'Auch bei Prüfungsangst habe ich konkrete Tipps bekommen, die wirklich geholfen haben.',
      author: 'Teilnehmerin, Halbjahreskurs 2./3. Sek',
    },
  ],
  kurstyp: 'halbjahreskurs',
  flowSteps: [
    {
      id: 'standortbestimmung',
      title: 'Standortbestimmung',
      body: 'Vor dem ersten Kurstag stellen wir fest, wo Ihr Kind aktuell steht, um die Kurszeit von Beginn an gezielt zu nutzen.',
    },
    {
      id: 'semestertraining',
      title: 'Semestertraining',
      body: 'Von September bis März wird wöchentlich an Deutsch, Mathematik und den mentalen Prüfungskompetenzen gearbeitet.',
    },
    {
      id: 'pruefungssimulation-feedback',
      title: 'Prüfungssimulation & Feedback',
      body: 'Eine echte Prüfungssimulation zeigt den aktuellen Stand — inklusive individueller Besprechung und Empfehlungen für die letzten Wochen vor der Prüfung.',
    },
  ],
  contentSections: [
    {
      id: 'mathematik',
      title: 'Mathematik',
      lede: 'Aufbauend auf der Standortbestimmung zu Kursbeginn: schrittweise Anleitung zum sicheren Lösen der Aufgabentypen, die an der Prüfung vorkommen.',
      groups: [
        {
          id: 'zahl-variable',
          subhead: 'Zahl und Variable — Arithmetik und Algebra',
          items: [
            'Fachbegriffe und Symbole korrekt anwenden',
            'Rechenregeln sicher anwenden (Punkt-vor-Strich, Klammerregeln) und Grundoperationen ausführen',
            'Terme und Gleichungen ableiten, umformen und berechnen',
          ],
        },
        {
          id: 'groessen-funktionen',
          subhead: 'Grössen, Funktionen, Daten und Zufall — Sachrechnen',
          items: [
            'Absolute und relative Häufigkeit sowie Wahrscheinlichkeit verstehen und anwenden',
            'Sachaufgaben zu Längen, Flächen, Volumen, Gewichten und Zeiten lösen',
            'Berechnungen mit Prozenten und Anteilen',
            'Proportionale und umgekehrt proportionale Zusammenhänge',
          ],
        },
        {
          id: 'form-raum',
          subhead: 'Form und Raum — Geometrie',
          items: [
            'Symmetrie von Figuren',
            'Umfang und Fläche spezieller Dreiecke und Vierecke',
            'Winkel berechnen, Koordinatensystem',
            'Satz von Pythagoras und Satz von Thales anwenden',
            'Konstruktionsaufgaben',
            'Geometrische Körper — Würfel, Quader, Pyramide, Prismen',
          ],
        },
      ],
    },
    {
      id: 'deutsch',
      title: 'Deutsch',
      groups: [
        {
          id: 'aufsatz',
          subhead: 'Aufsatz',
          items: [
            'Aufbauend auf der Standortbestimmung: Grundlagen des Aufsatzschreibens werden vermittelt und intensiv geübt — inkl. Korrekturen, Feedback und individuellen Tipps.',
            'Prüfungsrelevante Textsorten — Erzählung, Beschreibung, Bericht, Argumentation/Stellungnahme',
            'Aktueller Schreibprozess: Ideen finden, planen, formulieren, überarbeiten',
            'Inhalte reflektieren und in einen grösseren Zusammenhang stellen',
            'Passender Einsatz von Redewendungen und Vergleichen',
            'Orthografisch und grammatikalisch korrekte Schlussfassung',
          ],
        },
        {
          id: 'textverstaendnis',
          subhead: 'Textverständnis',
          items: [
            'Systematischer Aufbau anhand literarischer Texte und Sachtexte, analog zur Prüfung.',
            'Komplexe Texte verstehen, Fragen zu Inhalt & sprachlicher Form beantworten',
            'Strategien für unterschiedliche Textarten',
            'Wortschatz und Ausdruck in eigenen Worten wiedergeben',
            'Textinhalt kritisch reflektieren und interpretieren',
          ],
        },
        {
          id: 'sprachbetrachtung',
          subhead: 'Sprachbetrachtung & Grammatik',
          items: [
            'Verfahren und Fachbegriffe, um Sprachstrukturen gezielt zu analysieren.',
            'Sprachstrukturen in Wörtern und Sätzen untersuchen und erklären',
            'Differenzierten Wortschatz nutzen',
            'Wort- und Satzlehre: Fachbegriffe kennen, bestimmen und anwenden',
          ],
        },
      ],
    },
    {
      id: 'mentale-vorbereitung',
      title: 'Mentale Vorbereitung',
      lede: 'Neben dem Fachwissen fördern wir gezielt die Lernkompetenzen Ihres Kindes — integriert im Kursprogramm, ergänzt durch ein freiwilliges Online-Zusatzangebot, das bereits in den Kurskosten inbegriffen ist. Die genauen Kursinhalte können sich noch anpassen — die Schwerpunkte richten sich nach dem Stand der jeweiligen Kursgruppe.',
      groups: [
        {
          id: 'themen',
          items: [
            'Selbstorganisation',
            'Lernmethoden und Lernroutine',
            'Konzentration',
            'Motivation',
            'Umgang mit Stress und Druck',
            'Weitere mentale Tipps für die Prüfung',
          ],
        },
      ],
    },
  ],
  booking: {
    anchorId: 'buchung',
    title: 'Termine und Buchung',
    note: 'Alle Kurse folgen demselben Terminplan (3 Phasen, Aug. 2026 – März 2027) — Details dazu unter "Ablauf".',
    emptyState: 'Aktuell sind keine Termine verfügbar.',
  },
} as const satisfies CourseOffer

export const zweiDreiSekHalbjahreskursDetailPageModel = {
  audience: zweiDreiSek,
  offer: zweiDreiSekHalbjahreskurs,
  sessions: zweiDreiSekHalbjahreskursSessions,
} as const satisfies CourseDetailPageModel

// Intensivkurs: Wochenfilter -- die 4 realen Kalenderwochen aus der Quelle (data-week-Werte),
// "all" wird bereits zentral von WeekFilter/ALL_WEEKS_ID verwaltet und hier nicht dupliziert.
const zweiDreiSekIntensivkursWeekOptions = [
  { id: '0812', label: '8.–12. Februar' },
  { id: '1519', label: '15.–19. Februar' },
  { id: '2226', label: '22.–26. Februar' },
  { id: '0105', label: '01.–05. März' },
] satisfies { id: string; label: string }[]

function zweiDreiSekTagesplan(monat: string, tage: { tag: string; datum: string }[]) {
  return {
    kind: 'simple' as const,
    items: tage.map(({ tag, datum }) => ({
      id: `${tag}-${datum}`.toLowerCase(),
      label: `${tag}, ${datum}. ${monat}.`,
      value: tag === 'Mi' ? '13:05–18:00 (Prüfungssimulation)' : '13:15–16:30',
      highlight: tag === 'Mi',
    })),
  }
}

const zweiDreiSekWochentage = [
  { tag: 'Mo', datum: '' },
  { tag: 'Di', datum: '' },
  { tag: 'Mi', datum: '' },
  { tag: 'Do', datum: '' },
  { tag: 'Fr', datum: '' },
]

export const zweiDreiSekIntensivkursSessions = [
  {
    id: 5101,
    kurs: 'Kurs B',
    weekId: '1519',
    dateLabel: '15.–19. Feb.',
    standort: 'Zürich HB' as const,
    ablauf: zweiDreiSekTagesplan(
      'Feb',
      zweiDreiSekWochentage.map((d, i) => ({ tag: d.tag, datum: String(15 + i).padStart(2, '0') }))
    ),
  },
  {
    id: 5102,
    kurs: 'Kurs C',
    weekId: '1519',
    dateLabel: '15.–19. Feb.',
    standort: 'Winterthur' as const,
    ablauf: zweiDreiSekTagesplan(
      'Feb',
      zweiDreiSekWochentage.map((d, i) => ({ tag: d.tag, datum: String(15 + i).padStart(2, '0') }))
    ),
  },
  {
    id: 5103,
    kurs: 'Kurs D',
    weekId: '2226',
    dateLabel: '22.–26. Feb.',
    standort: 'Winterthur' as const,
    ablauf: zweiDreiSekTagesplan(
      'Feb',
      zweiDreiSekWochentage.map((d, i) => ({ tag: d.tag, datum: String(22 + i).padStart(2, '0') }))
    ),
  },
  {
    id: 5104,
    kurs: 'Kurs A',
    weekId: '0812',
    dateLabel: '08.–12. Feb.',
    standort: 'Winterthur' as const,
    ablauf: zweiDreiSekTagesplan(
      'Feb',
      zweiDreiSekWochentage.map((d, i) => ({ tag: d.tag, datum: String(8 + i).padStart(2, '0') }))
    ),
  },
  {
    id: 5105,
    kurs: 'Kurs F',
    weekId: '0105',
    dateLabel: '01.–05. März',
    standort: 'Zürich HB' as const,
    ablauf: zweiDreiSekTagesplan(
      'März',
      zweiDreiSekWochentage.map((d, i) => ({ tag: d.tag, datum: String(1 + i).padStart(2, '0') }))
    ),
  },
].map((row) => ({
  id: row.id,
  offerId: 'offer-2-3sek-intensivkurs-sportferien',
  capacity: 10,
  source: { kind: 'intensivwoche_kurse' as const, kursId: row.id },
  kurs: row.kurs,
  dateLabel: row.dateLabel,
  timeLabel: '13:15–16:30',
  standort: row.standort,
  deliveryModes: ['onsite' as const],
  weekId: row.weekId,
  ablauf: row.ablauf,
})) satisfies SessionDefinition[]

export const zweiDreiSekIntensivkurs = {
  id: 'offer-2-3sek-intensivkurs-sportferien',
  audienceId: '2-3-sek',
  slug: 'intensivkurs-sportferien',
  href: '/kurse/2-3-sek/intensivkurs-sportferien',
  displayName: 'Intensivkurs-Sportferien',
  categoryLabel: 'Deutsch & Mathematik',
  tagline: 'Intensives Training in den Sportferien',
  lede: 'Möchte sich Ihr Kind explizit auf die Prüfungsaufgaben und Prüfungssituation an der Gymiprüfung vorbereiten? Im Kurs werden typische Aufgaben erklärt und Prüfungen simuliert.',
  description:
    'Ideal für Kinder, die sich intensiv auf die Prüfungsaufgaben und die Prüfungssituation vorbereiten wollen – inklusive praktischer Tipps & Tricks für die Gymiprüfung.',
  laufzeit: 'Feb. – März 2027',
  dateSummary: ['Feb. – März 2027'],
  features: [
    'Prüfungsaufgaben & Prüfungssituation trainieren',
    '5 aufeinanderfolgende Kurstage in einer Schulferienwoche',
    'Kurszeit: 13.15 – 16.30 Uhr',
    'Tipps & Tricks zur Prüfung',
  ],
  regularPriceRappen: 119500,
  currency: 'CHF',
  overviewBullets: [
    '5 Kurstage in den Sportferien',
    'Kurszeit: 13:15 – 16:30 Uhr',
    'Kleingruppen: 3 bis max. 10 Kinder',
    'Zürich HB · Winterthur',
  ],
  whyUs: [
    {
      id: 'standortbestimmung',
      title: 'Standortbestimmung zu Kursbeginn',
      description: 'Wir stellen fest, wo Lücken bestehen, bevor wir mit dem Training starten — nicht danach.',
    },
    {
      id: 'pruefungssimulation',
      title: 'Eine echte Prüfungssimulation',
      description:
        'Reale Prüfungsbedingungen, korrigiert und Schritt für Schritt besprochen — einmal reicht, wenn sie gut gemacht ist.',
    },
    {
      id: 'strategien',
      title: 'Praktische Lern- und Prüfungsstrategien',
      description:
        'Von der richtigen Lernumgebung über den Umgang mit Prüfungsangst und Blackouts bis zu Konzentrationsübungen und der Herangehensweise an typische Prüfungsaufgaben.',
    },
    {
      id: 'betreuung-ausserhalb',
      title: 'Betreuung auch ausserhalb der Kurszeit',
      description:
        'Eine gute Begleitung endet für uns nicht mit dem Kursende. Unsere Lehrpersonen stehen bei Fragen auch ausserhalb der Kurszeiten jederzeit per Chat zur Verfügung.',
    },
  ],
  testimonials: [
    {
      id: 'testi-1',
      quote: 'Die Prüfungssimulation hat mir die Nervosität genommen — ich wusste danach, was mich erwartet.',
      author: 'Teilnehmer, Intensivkurs Sportferien',
    },
    {
      id: 'testi-2',
      quote: 'In fünf Tagen habe ich mehr gelernt als ich erwartet hätte, ohne dass es sich wie Ferien-Stress anfühlte.',
      author: 'Teilnehmerin, Intensivkurs Sportferien',
    },
    {
      id: 'testi-3',
      quote: 'Auch nach dem Kurs konnte ich noch Fragen stellen, wenn mir etwas unklar war.',
      author: 'Teilnehmer, Intensivkurs Sportferien',
    },
  ],
  kurstyp: 'intensivkurs',
  weekOptions: zweiDreiSekIntensivkursWeekOptions,
  flowSteps: [
    {
      id: 'wissen-aneignen',
      title: 'Wissen aneignen',
      body: 'Prüfungsrelevante Grundlagen in Deutsch und Mathematik im Schnelldurchgang repetieren, typische Aufgabentypen kennenlernen.',
    },
    {
      id: 'wissen-umsetzen',
      title: 'Wissen umsetzen',
      body: 'Aufgaben im Unterricht und im Selbststudium trainieren, echte Prüfungssimulation durchführen.',
    },
    {
      id: 'wissen-pruefen',
      title: 'Wissen prüfen',
      body: 'Individuelles Feedback zur Simulation, gemeinsame Besprechung — Ihr Kind weiss danach genau, wo noch Übungsbedarf besteht.',
    },
  ],
  contentSections: [],
  booking: {
    anchorId: 'buchung',
    title: 'Termine und Buchung',
    emptyState: 'Aktuell sind keine Termine verfügbar.',
  },
} as const satisfies CourseOffer

export const zweiDreiSekIntensivkursDetailPageModel = {
  audience: zweiDreiSek,
  offer: zweiDreiSekIntensivkurs,
  sessions: zweiDreiSekIntensivkursSessions,
} as const satisfies CourseDetailPageModel

export const zweiDreiSekAudiencePageModel = {
  audience: zweiDreiSek,
  hero: {
    title: 'Vorbereitungskurse für Gymiprüfung 2027',
    description:
      'Zwei Wege zur Vorbereitung auf die Aufnahmeprüfung ins Kurzzeitgymnasium — ganzjährige Begleitung oder intensives Training in den Sportferien.',
  },
  offers: [zweiDreiSekHalbjahreskurs, zweiDreiSekIntensivkurs],
  addOnOffers: [],
  existingCourses: [],
} as const satisfies AudiencePageModel

// ---------------------------------------------------------------------------------------------
// Schritt 10, Runde 5/6 -- BMS: Layout_BMS_Hauptseite.html + Layout_BMS_Intensivkurs_Unterseite.html
// (die verbindliche BMS-Kurs-Unterseite) + Layout_BMS_Pruefungssimulation_Seite.html.
//
// Kleine, eindeutig gerechtfertigte Korrektur: Die Hauptseiten-Kartenbeschreibung des
// Intensivkurses endet in der Quelle auf "...für die Gymiprüfung" (Kopier-Rest aus einer
// Gymnasium-Vorlage -- BMS bereitet nicht auf die "Gymiprüfung" vor). Ersetzt durch
// "BMS-Aufnahmeprüfung", exakt der Begriff, den dieselbe reale Unterseite für dasselbe Angebot an
// jeder anderen Stelle verwendet -- keine neue Information, nur ein einzelnes falsches Wort
// korrigiert.
// ---------------------------------------------------------------------------------------------

// BMS-Halbjahreskurs (Publikationsgate aus design-review-todo.md, aufgelöst 22.07.2026): die
// Hauptseiten-Karte (Layout_BMS_Hauptseite.html) hatte bereits reale Tagline/Beschreibung/
// Leistungen/Preis, verlinkte aber fälschlich auf die Intensivkurs-Unterseite, weil kein echter
// Detailinhalt existierte. Tagline/Beschreibung/Leistungen/Preis unten kommen unverändert aus
// dieser bereits vorhandenen Karte (Preis CHF 2'890 Frühbucher / regulär CHF 2'990 -- anders als
// beim 2./3.-Sek-Halbjahreskurs hier ein echter, nicht kaputter Rabatt). Die fehlenden
// Curriculum-Inhalte (Kursaufbau, Mathematik/Deutsch/Mentale-Vorbereitung-Abschnitte) sind auf
// ausdrückliche Weisung des Betreibers identisch mit dem 2./3.-Sek-Halbjahreskurs übernommen
// (zweiDreiSekHalbjahreskurs unten) -- keine eigene BMS-Curriculumsvorlage vorhanden. Sessions
// bleiben bewusst leer (kein `id` in OFFER_SESSIONS, siehe lib/kurse/offer-catalog.ts): anders als
// die Curriculumsinhalte wurden für Kurstermine/Standorte/Kapazität keine echten BMS-Werte
// bestätigt, dieselbe Zurückhaltung wie bereits bei bmsPruefungssimulation.
export const bmsHalbjahreskurs = {
  id: 'offer-bms-halbjahreskurs',
  audienceId: 'bms',
  slug: 'halbjahreskurs',
  href: '/kurse/bms/halbjahreskurs',
  displayName: 'Halbjahreskurs',
  categoryLabel: 'Deutsch & Mathematik',
  tagline: 'Breite Vorbereitung über das ganze Semester',
  lede: 'Umfassende Vorbereitung auf die BM1- oder BM2-Aufnahmeprüfung: fachliches Training in Deutsch und Mathematik, dazu gezielte Unterstützung beim Umgang mit Prüfungsdruck — begleitet über das ganze Semester.',
  description:
    'Umfassende Vorbereitung auf die BM1- oder BM2-Aufnahmeprüfung — gezielte, individuelle Förderung in Deutsch und Mathematik mit einem festen Termin pro Woche.',
  recommended: true,
  laufzeit: 'Sept. 2026 – Feb. 2027',
  dateSummary: ['Sept. 2026 – Feb. 2027'],
  features: [
    'Deutsch & Mathematik, je 90 Minuten pro Termin',
    'Ein fester Wochentermin, Nachmittag oder Samstagvormittag',
    'Eigenes Lernunterlagen-Dossier pro Fach',
    'Prüfungssimulation & laufendes Feedback inbegriffen',
  ],
  regularPriceRappen: 299000,
  earlyBirdPriceRappen: 289000,
  earlyBirdDeadline: '2026-07-31',
  currency: 'CHF',
  overviewBullets: [
    'Sept. 2026 – Feb. 2027',
    'Ein fester Wochentermin',
    'Prüfungssimulation & laufendes Feedback inbegriffen',
    'Eigenes Lernunterlagen-Dossier pro Fach',
  ],
  whyUs: [
    {
      id: 'standortbestimmung',
      title: 'Standortbestimmung zu Kursbeginn',
      description: 'Wir stellen fest, wo Lücken bestehen, bevor wir mit dem Training starten — nicht danach.',
    },
    {
      id: 'pruefungssimulation',
      title: 'Eine echte Prüfungssimulation',
      description:
        'Reale Prüfungsbedingungen, korrigiert und Schritt für Schritt besprochen — einmal reicht, wenn sie gut gemacht ist.',
    },
    {
      id: 'strategien',
      title: 'Praktische Lern- und Prüfungsstrategien',
      description:
        'Von der richtigen Lernumgebung über den Umgang mit Prüfungsangst und Blackouts bis zu Konzentrationsübungen und der Herangehensweise an typische Prüfungsaufgaben.',
    },
    {
      id: 'betreuung-ausserhalb',
      title: 'Betreuung auch ausserhalb der Kurszeit',
      description:
        'Eine gute Begleitung endet für uns nicht mit dem Kursende. Unsere Lehrpersonen stehen bei Fragen auch ausserhalb der Kurszeiten jederzeit per Chat zur Verfügung.',
    },
  ],
  testimonials: [
    {
      id: 'testi-1',
      quote: 'Über das ganze Semester hinweg habe ich richtig gemerkt, wie ich in Mathe sicherer wurde.',
      author: 'Teilnehmerin, Halbjahreskurs BM2',
    },
    {
      id: 'testi-2',
      quote: 'Die Prüfungssimulation hat mir die Nervosität genommen — ich wusste danach, was mich erwartet.',
      author: 'Teilnehmer, Halbjahreskurs BM1',
    },
    {
      id: 'testi-3',
      quote: 'Auch bei Prüfungsangst habe ich konkrete Tipps bekommen, die wirklich geholfen haben.',
      author: 'Teilnehmerin, Halbjahreskurs BM2',
    },
  ],
  kurstyp: 'halbjahreskurs',
  flowSteps: [
    {
      id: 'standortbestimmung',
      title: 'Standortbestimmung',
      body: 'Vor dem ersten Kurstag stellen wir fest, wo Sie aktuell stehen, um die Kurszeit von Beginn an gezielt zu nutzen.',
    },
    {
      id: 'semestertraining',
      title: 'Semestertraining',
      body: 'Von September bis Februar wird wöchentlich an Deutsch, Mathematik und den mentalen Prüfungskompetenzen gearbeitet.',
    },
    {
      id: 'pruefungssimulation-feedback',
      title: 'Prüfungssimulation & Feedback',
      body: 'Eine echte Prüfungssimulation zeigt den aktuellen Stand — inklusive individueller Besprechung und Empfehlungen für die letzten Wochen vor der Prüfung.',
    },
  ],
  // Identisch mit zweiDreiSekHalbjahreskurs.contentSections weiter unten (ausdrückliche Weisung
  // des Betreibers, siehe Kommentar oben) -- bewusst dupliziert statt referenziert, damit beide
  // Angebote unabhängig voneinander redaktionell weitergepflegt werden können, ohne sich
  // gegenseitig zu beeinflussen.
  contentSections: [
    {
      id: 'mathematik',
      title: 'Mathematik',
      lede: 'Aufbauend auf der Standortbestimmung zu Kursbeginn: schrittweise Anleitung zum sicheren Lösen der Aufgabentypen, die an der Prüfung vorkommen.',
      groups: [
        {
          id: 'zahl-variable',
          subhead: 'Zahl und Variable — Arithmetik und Algebra',
          items: [
            'Fachbegriffe und Symbole korrekt anwenden',
            'Rechenregeln sicher anwenden (Punkt-vor-Strich, Klammerregeln) und Grundoperationen ausführen',
            'Terme und Gleichungen ableiten, umformen und berechnen',
          ],
        },
        {
          id: 'groessen-funktionen',
          subhead: 'Grössen, Funktionen, Daten und Zufall — Sachrechnen',
          items: [
            'Absolute und relative Häufigkeit sowie Wahrscheinlichkeit verstehen und anwenden',
            'Sachaufgaben zu Längen, Flächen, Volumen, Gewichten und Zeiten lösen',
            'Berechnungen mit Prozenten und Anteilen',
            'Proportionale und umgekehrt proportionale Zusammenhänge',
          ],
        },
        {
          id: 'form-raum',
          subhead: 'Form und Raum — Geometrie',
          items: [
            'Symmetrie von Figuren',
            'Umfang und Fläche spezieller Dreiecke und Vierecke',
            'Winkel berechnen, Koordinatensystem',
            'Satz von Pythagoras und Satz von Thales anwenden',
            'Konstruktionsaufgaben',
            'Geometrische Körper — Würfel, Quader, Pyramide, Prismen',
          ],
        },
      ],
    },
    {
      id: 'deutsch',
      title: 'Deutsch',
      groups: [
        {
          id: 'aufsatz',
          subhead: 'Aufsatz',
          items: [
            'Aufbauend auf der Standortbestimmung: Grundlagen des Aufsatzschreibens werden vermittelt und intensiv geübt — inkl. Korrekturen, Feedback und individuellen Tipps.',
            'Prüfungsrelevante Textsorten — Erzählung, Beschreibung, Bericht, Argumentation/Stellungnahme',
            'Aktueller Schreibprozess: Ideen finden, planen, formulieren, überarbeiten',
            'Inhalte reflektieren und in einen grösseren Zusammenhang stellen',
            'Passender Einsatz von Redewendungen und Vergleichen',
            'Orthografisch und grammatikalisch korrekte Schlussfassung',
          ],
        },
        {
          id: 'textverstaendnis',
          subhead: 'Textverständnis',
          items: [
            'Systematischer Aufbau anhand literarischer Texte und Sachtexte, analog zur Prüfung.',
            'Komplexe Texte verstehen, Fragen zu Inhalt & sprachlicher Form beantworten',
            'Strategien für unterschiedliche Textarten',
            'Wortschatz und Ausdruck in eigenen Worten wiedergeben',
            'Textinhalt kritisch reflektieren und interpretieren',
          ],
        },
        {
          id: 'sprachbetrachtung',
          subhead: 'Sprachbetrachtung & Grammatik',
          items: [
            'Verfahren und Fachbegriffe, um Sprachstrukturen gezielt zu analysieren.',
            'Sprachstrukturen in Wörtern und Sätzen untersuchen und erklären',
            'Differenzierten Wortschatz nutzen',
            'Wort- und Satzlehre: Fachbegriffe kennen, bestimmen und anwenden',
          ],
        },
      ],
    },
    {
      id: 'mentale-vorbereitung',
      title: 'Mentale Vorbereitung',
      lede: 'Neben dem Fachwissen fördern wir gezielt die Lernkompetenzen — integriert im Kursprogramm, ergänzt durch ein freiwilliges Online-Zusatzangebot, das bereits in den Kurskosten inbegriffen ist. Die genauen Kursinhalte können sich noch anpassen — die Schwerpunkte richten sich nach dem Stand der jeweiligen Kursgruppe.',
      groups: [
        {
          id: 'themen',
          items: [
            'Selbstorganisation',
            'Lernmethoden und Lernroutine',
            'Konzentration',
            'Motivation',
            'Umgang mit Stress und Druck',
            'Weitere mentale Tipps für die Prüfung',
          ],
        },
      ],
    },
  ],
  booking: {
    anchorId: 'buchung',
    title: 'Termine und Buchung',
    emptyState: 'Aktuell sind keine Termine verfügbar.',
  },
} as const satisfies CourseOffer

export const bmsHalbjahreskursDetailPageModel = {
  audience: bms,
  offer: bmsHalbjahreskurs,
  sessions: [],
} as const satisfies CourseDetailPageModel

export const bmsIntensivkursSessions = [
  {
    id: 3001,
    offerId: 'offer-bms-intensivkurs-sportferien',
    capacity: 8,
    source: { kind: 'intensivwoche_kurse', kursId: 3001 },
    kurs: 'Kurs A',
    dateLabel: '15.–19. Feb.',
    timeLabel: '08.30–12.30',
    standort: 'Zürich HB',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'mo', label: 'Mo, 15. Feb.', value: '08.30–12.30' },
        { id: 'di', label: 'Di, 16. Feb.', value: '08.30–12.30' },
        { id: 'mi', label: 'Mi, 17. Feb. (Prüfungssimulation)', value: '08.30–12.30', highlight: true },
        { id: 'do', label: 'Do, 18. Feb.', value: '08.30–12.30' },
        { id: 'fr', label: 'Fr, 19. Feb.', value: '08.30–12.30' },
      ],
    },
  },
  {
    id: 3002,
    offerId: 'offer-bms-intensivkurs-sportferien',
    capacity: 8,
    source: { kind: 'intensivwoche_kurse', kursId: 3002 },
    kurs: 'Kurs B',
    dateLabel: '22.–26. Feb.',
    timeLabel: '08.30–12.30',
    standort: 'Winterthur',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'mo', label: 'Mo, 22. Feb.', value: '08.30–12.30' },
        { id: 'di', label: 'Di, 23. Feb.', value: '08.30–12.30' },
        { id: 'mi', label: 'Mi, 24. Feb. (Prüfungssimulation)', value: '08.30–12.30', highlight: true },
        { id: 'do', label: 'Do, 25. Feb.', value: '08.30–12.30' },
        { id: 'fr', label: 'Fr, 26. Feb.', value: '08.30–12.30' },
      ],
    },
  },
  {
    id: 3003,
    offerId: 'offer-bms-intensivkurs-sportferien',
    capacity: 8,
    source: { kind: 'intensivwoche_kurse', kursId: 3003 },
    kurs: 'Kurs C',
    dateLabel: '01.–05. März',
    timeLabel: '08.30–12.30',
    standort: 'Zürich HB',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'mo', label: 'Mo, 01. März', value: '08.30–12.30' },
        { id: 'di', label: 'Di, 02. März', value: '08.30–12.30' },
        { id: 'mi', label: 'Mi, 03. März (Prüfungssimulation)', value: '08.30–12.30', highlight: true },
        { id: 'do', label: 'Do, 04. März', value: '08.30–12.30' },
        { id: 'fr', label: 'Fr, 05. März', value: '08.30–12.30' },
      ],
    },
  },
] satisfies SessionDefinition[]

export const bmsIntensivkurs = {
  id: 'offer-bms-intensivkurs-sportferien',
  audienceId: 'bms',
  slug: 'intensivkurs',
  href: '/kurse/bms/intensivkurs',
  displayName: 'Intensivkurs-Sportferien',
  categoryLabel: 'Deutsch & Mathematik',
  tagline: 'Kompaktes Training in den Schulferien',
  lede: 'Möchten Sie sich explizit auf die BMS-Aufnahmeprüfung vorbereiten? Im Kurs werden typische Aufgaben in Deutsch (inkl. Aufsatz) und Mathematik erklärt und Prüfungen simuliert — geeignet für BM1 und BM2 gleichermassen.',
  description:
    'Ideal für alle, die sich kurz vor der Prüfung nochmals intensiv mit dem Prüfungsformat und typischen Aufgaben auseinandersetzen möchten – inklusive praktischer Tipps & Tricks für die BMS-Aufnahmeprüfung.',
  laufzeit: 'Feb. 2027',
  dateSummary: ['Feb. 2027'],
  features: [
    'Prüfungsnahe Aufgaben & Prüfungsbedingungen trainieren',
    '5 aufeinanderfolgende Kurstage in einer Schulferienwoche',
    'Kurszeit: 08.30 – 12.30 Uhr',
    'Inklusive Prüfungssimulation',
  ],
  regularPriceRappen: 99000,
  currency: 'CHF',
  overviewBullets: [
    '5 Kurstage in einer Schulferienwoche',
    'Kurszeit: 08.30 – 12.30 Uhr',
    'Kleingruppen: max. 8 Teilnehmende',
    'Zürich HB · Winterthur',
  ],
  whyUs: [
    {
      id: 'standortbestimmung',
      title: 'Standortbestimmung zu Kursbeginn',
      description: 'Wir stellen fest, wo Lücken bestehen, bevor wir mit dem Training starten — nicht danach.',
    },
    {
      id: 'pruefungssimulation',
      title: 'Eine echte Prüfungssimulation',
      description:
        'Reale Prüfungsbedingungen, korrigiert und Schritt für Schritt besprochen — einmal reicht, wenn sie gut gemacht ist.',
    },
    {
      id: 'strategien',
      title: 'Praktische Lern- und Prüfungsstrategien',
      description:
        'Von der richtigen Lernumgebung über den Umgang mit Prüfungsangst und Blackouts bis zu Konzentrationsübungen und der Herangehensweise an typische Prüfungsaufgaben.',
    },
    {
      id: 'betreuung-ausserhalb',
      title: 'Betreuung auch ausserhalb der Kurszeit',
      description:
        'Eine gute Begleitung endet für uns nicht mit dem Kursende. Unsere Lehrpersonen stehen bei Fragen auch ausserhalb der Kurszeiten jederzeit per Chat zur Verfügung.',
    },
  ],
  testimonials: [
    {
      id: 'testi-1',
      quote: 'Die Prüfungssimulation hat mir die Nervosität genommen — ich wusste danach, was mich erwartet.',
      author: 'Teilnehmerin, Intensivwoche BM2',
    },
    {
      id: 'testi-2',
      quote: 'In fünf Tagen habe ich mehr gelernt als ich erwartet hätte, ohne dass es sich wie Ferien-Stress anfühlte.',
      author: 'Teilnehmer, Intensivwoche BM1',
    },
    {
      id: 'testi-3',
      quote: 'Auch nach dem Kurs konnte ich noch Fragen stellen, wenn mir etwas unklar war.',
      author: 'Teilnehmerin, Intensivwoche BM1',
    },
  ],
  kurstyp: 'intensivkurs',
  flowSteps: [
    {
      id: 'wissen-aneignen',
      title: 'Wissen aneignen',
      body: 'Prüfungsrelevante Grundlagen in Deutsch und Mathematik im Schnelldurchgang repetieren, typische Aufgabentypen kennenlernen.',
    },
    {
      id: 'wissen-umsetzen',
      title: 'Wissen umsetzen',
      body: 'Aufgaben im Unterricht und im Selbststudium trainieren, echte Prüfungssimulation durchführen.',
    },
    {
      id: 'wissen-pruefen',
      title: 'Wissen prüfen',
      body: 'Individuelles Feedback zur Simulation, gemeinsame Besprechung — Sie wissen danach genau, wo noch Übungsbedarf besteht.',
    },
  ],
  contentSections: [],
  booking: {
    anchorId: 'buchung',
    title: 'Termine und Buchung',
    emptyState: 'Aktuell sind keine Termine verfügbar.',
  },
} as const satisfies CourseOffer

export const bmsIntensivkursDetailPageModel = {
  audience: bms,
  offer: bmsIntensivkurs,
  sessions: bmsIntensivkursSessions,
} as const satisfies CourseDetailPageModel

// Prüfungssimulation: kein Timeline-Element und keine echte Terminliste in der Quelle (der
// "Termin wählen"-Button ist ein Selbstanker ohne Session-Daten) -- examTimeline bleibt ehrlich
// leer statt erfunden, keine Sessions-Fixture wird angelegt (Buchungstabelle zeigt dadurch korrekt
// den emptyState-Text).
export const bmsPruefungssimulation = {
  id: 'offer-bms-pruefungssimulation',
  audienceId: 'bms',
  slug: 'pruefungssimulation',
  href: '/kurse/bms/pruefungssimulation',
  displayName: 'Prüfungssimulation',
  tagline: 'Offen für alle',
  lede: 'Eine echte BMS-Aufnahmeprüfung unter realen Bedingungen — inklusive schriftlicher Bewertung und individuellem Feedback. Auch ohne vorherige Kursteilnahme buchbar.',
  description:
    'Eine echte BMS-Aufnahmeprüfung unter realen Bedingungen — inklusive schriftlicher Bewertung. Auch ohne vorherige Kursteilnahme buchbar.',
  laufzeit: 'Ein Prüfungstermin, halbtags',
  dateSummary: ['Prüfungstermin'],
  features: [
    'Prüfungssimulation nach aktuellem Prüfungsformat',
    'Durchführung unter Prüfungsbedingungen',
    'Schriftliche Bewertung des Aufsatzes',
  ],
  regularPriceRappen: 14500,
  currency: 'CHF',
  priceUnit: 'Pro Teilnahme · inkl. schriftlicher Auswertung',
  overviewBullets: [
    'Gleicher Zeitrahmen, gleiches Format wie an der echten BMS-Aufnahmeprüfung',
    'Detaillierte schriftliche Korrektur inkl. Aufsatz',
    'Buchbar unabhängig von BM1 oder BM2',
  ],
  whyUs: [
    {
      id: 'pruefungsnahe-bedingungen',
      title: 'Prüfungsnahe Bedingungen',
      description: 'Gleicher Zeitrahmen, gleiches Format und gleiche Aufgabentypen wie an der echten BMS-Aufnahmeprüfung.',
    },
    {
      id: 'schriftliche-bewertung',
      title: 'Schriftliche Bewertung',
      description: 'Detaillierte Korrektur inkl. Aufsatz auf Deutsch, mit Einschätzung des aktuellen Leistungsstands.',
    },
    {
      id: 'offen-fuer-alle',
      title: 'Offen für alle',
      description: 'Keine vorherige Kursteilnahme nötig — buchbar unabhängig von BM1 oder BM2.',
    },
  ],
  kurstyp: 'pruefungssimulation',
  flowSteps: [
    { id: 'anmeldung', title: 'Anmeldung', body: 'Buchung eines einzelnen Prüfungstermins — unabhängig davon, ob Sie sonst einen Kurs bei uns besuchen.' },
    { id: 'durchfuehrung', title: 'Durchführung', body: 'Die vollständige BMS-Aufnahmeprüfung nach aktuellem Prüfungsformat, unter denselben zeitlichen und organisatorischen Bedingungen wie am echten Prüfungstag.' },
    { id: 'auswertung-feedback', title: 'Auswertung & Feedback', body: 'Schriftliche Korrektur aller Teile, eine Einschätzung des aktuellen Leistungsstands und konkrete Hinweise, woran Sie bis zur echten Prüfung noch arbeiten können.' },
  ],
  examTimeline: [],
  faq: [
    {
      id: 'vorheriger-kurs',
      question: 'Muss ich vorher einen Kurs bei Ihnen besucht haben?',
      answer: 'Nein. Die Prüfungssimulation ist ein eigenständiges Angebot und unabhängig von einer Kursteilnahme buchbar.',
    },
    {
      id: 'bm1-bm2-unterschied',
      question: 'Ist die Simulation für BM1 und BM2 unterschiedlich?',
      answer: 'Nein, der Prüfungsinhalt ist für BM1 und BM2 identisch (Deutsch & Mathematik) — es gibt daher nur eine gemeinsame Simulation für beide Wege.',
    },
    {
      id: 'auswertung-tempo',
      question: 'Wie schnell erhalte ich die Auswertung?',
      answer: 'Die schriftliche Bewertung inkl. Einschätzung des Leistungsstands erhalten Sie zeitnah nach der Simulation.',
    },
  ],
  booking: {
    anchorId: 'buchung',
    title: 'Termine und Buchung',
    emptyState: 'Aktuell sind keine Termine verfügbar.',
  },
} as const satisfies ExamSimulationOffer

export const bmsPruefungssimulationDetailPageModel = {
  audience: bms,
  offer: bmsPruefungssimulation,
  sessions: [],
} as const satisfies ExamSimulationPageModel

export const bmsAudiencePageModel = {
  audience: bms,
  hero: {
    title: 'Vorbereitungskurse für die BMS-Aufnahmeprüfung 2027',
    description:
      'Zwei Wege zur Vorbereitung auf die BMS-Aufnahmeprüfung — wöchentliche Begleitung über mehrere Monate oder intensives Training in einer Ferienwoche.',
  },
  offers: [bmsHalbjahreskurs, bmsIntensivkurs],
  addOnOffers: [bmsPruefungssimulation],
  existingCourses: [],
} as const satisfies AudiencePageModel

// ---------------------------------------------------------------------------------------------
// Schritt 10, Runde 6/6 -- Matura: Layout_Maturapruefung_Seite.html +
// Layout_Matura_Halbjahreskurs_Unterseite.html + Layout_Matura_Intensivwoche_Unterseite.html.
// Letzte der sieben Zielgruppen (6. Klasse bereits aus Schritt 5/6 erledigt) -- damit hat Schritt
// 10 alle sieben Übersichtsseiten mit mindestens einem realen Angebot versehen.
//
// Sauberste Runde bisher: keine Preis-Diskrepanz zwischen Haupt- und Unterseite bei beiden
// Angeboten (Halbjahreskurs 2'690/2'790 stimmt exakt überein, Intensivwoche 980 ohne
// Frühbucherpreis auf beiden Seiten identisch), keine Copy-Paste-Reste aus anderen
// Zielgruppen-Vorlagen. displayName "Intensivwoche" weicht bewusst vom internen kurstyp-Key
// "intensivkurs" ab (Abschnitt 2.2: interner Key ≠ Anzeigename, exakt wie bei "Vorkurs" bei 1. Sek).
// ---------------------------------------------------------------------------------------------

export const maturaHalbjahreskursSessions = [
  {
    id: 2001,
    offerId: 'offer-matura-halbjahreskurs',
    capacity: 8,
    source: { kind: 'intensivwoche_kurse', kursId: 2001 },
    kurs: 'Kurs A',
    dateLabel: 'Samstag, 09:00–10:30',
    timeLabel: '09:00–10:30',
    standort: 'Zürich HB',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'analysis', label: 'Analysis', value: '40 Min.' },
        { id: 'vektorgeometrie', label: 'Vektorgeometrie', value: '30 Min.' },
        { id: 'wahrscheinlichkeitsrechnung', label: 'Wahrscheinlichkeitsrechnung', value: '20 Min.' },
      ],
    },
  },
  {
    id: 2002,
    offerId: 'offer-matura-halbjahreskurs',
    capacity: 8,
    source: { kind: 'intensivwoche_kurse', kursId: 2002 },
    kurs: 'Kurs B',
    dateLabel: 'Mittwoch, 17:00–18:30',
    timeLabel: '17:00–18:30',
    standort: 'Winterthur',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'analysis', label: 'Analysis', value: '40 Min.' },
        { id: 'vektorgeometrie', label: 'Vektorgeometrie', value: '30 Min.' },
        { id: 'wahrscheinlichkeitsrechnung', label: 'Wahrscheinlichkeitsrechnung', value: '20 Min.' },
      ],
    },
  },
  {
    id: 2003,
    offerId: 'offer-matura-halbjahreskurs',
    capacity: 8,
    source: { kind: 'intensivwoche_kurse', kursId: 2003 },
    kurs: 'Kurs C',
    dateLabel: 'Samstag, 11:00–12:30',
    timeLabel: '11:00–12:30',
    standort: 'Zürich HB',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'analysis', label: 'Analysis', value: '40 Min.' },
        { id: 'vektorgeometrie', label: 'Vektorgeometrie', value: '30 Min.' },
        { id: 'wahrscheinlichkeitsrechnung', label: 'Wahrscheinlichkeitsrechnung', value: '20 Min.' },
      ],
    },
  },
] satisfies SessionDefinition[]

export const maturaHalbjahreskurs = {
  id: 'offer-matura-halbjahreskurs',
  audienceId: 'matura',
  slug: 'halbjahreskurs',
  href: '/kurse/matura/halbjahreskurs',
  displayName: 'Halbjahreskurs',
  categoryLabel: 'Mathematik',
  tagline: 'Breite Vorbereitung über das ganze Semester',
  lede: 'Kontinuierliche Vorbereitung auf die Mathematik-Matura: fachliches Training in den prüfungsrelevanten Themengebieten, begleitet über das ganze letzte Gymnasialjahr mit einem festen Wochentermin.',
  description:
    'Umfassende Vorbereitung auf die Mathematik-Matura — gezielte, individuelle Förderung in den prüfungsrelevanten Themengebieten, begleitet über das ganze letzte Gymnasialjahr.',
  recommended: true,
  subject: 'ma',
  laufzeit: 'Nov. 2026 – April 2027',
  dateSummary: ['Nov. 2026 – April 2027'],
  features: [
    'Schwerpunkte: Analysis, Vektorgeometrie & Wahrscheinlichkeitsrechnung',
    'Samstag oder Mittwochnachmittag',
    'Standortbestimmung & Prüfungssimulation inbegriffen',
    'Betreuung auch ausserhalb der Kurszeiten',
  ],
  regularPriceRappen: 279000,
  earlyBirdPriceRappen: 269000,
  earlyBirdDeadline: '2026-07-31',
  currency: 'CHF',
  overviewBullets: [
    'Nov. 2026 – April 2027',
    'Kleingruppen',
    'Eigenes Lernunterlagen-Dossier',
    'Standortbestimmung & Prüfungssimulation inbegriffen',
  ],
  whyUs: [
    {
      id: 'standortbestimmung',
      title: 'Standortbestimmung zu Kursbeginn',
      description: 'Wir stellen fest, wo Lücken bestehen, bevor wir mit dem Training starten — nicht danach.',
    },
    {
      id: 'pruefungssimulation',
      title: 'Eine echte Prüfungssimulation',
      description:
        'Reale Prüfungsbedingungen, korrigiert und Schritt für Schritt besprochen — einmal reicht, wenn sie gut gemacht ist.',
    },
    {
      id: 'fokus-themen',
      title: 'Fokus auf die prüfungsrelevanten Themen',
      description:
        'Wir konzentrieren uns gezielt auf Analysis, Vektorgeometrie und Wahrscheinlichkeitsrechnung — die Schwerpunkte der Mathematik-Matura.',
    },
    {
      id: 'betreuung-ausserhalb',
      title: 'Betreuung auch ausserhalb der Kurszeit',
      description:
        'Eine gute Begleitung endet für uns nicht mit dem Kursende. Unsere Lehrpersonen stehen bei Fragen auch ausserhalb der Kurszeiten jederzeit per Chat zur Verfügung.',
    },
  ],
  testimonials: [
    {
      id: 'testi-1',
      quote: 'Vektorgeometrie war mein Angstgegner — nach dem Kurs habe ich die Aufgaben endlich verstanden.',
      author: 'Maturandin, Halbjahreskurs',
    },
    {
      id: 'testi-2',
      quote: 'Die Prüfungssimulation hat mir gezeigt, wo ich noch üben muss — genau rechtzeitig vor der Matura.',
      author: 'Maturand, Halbjahreskurs',
    },
    {
      id: 'testi-3',
      quote: 'Der wöchentliche Rhythmus hat mir geholfen, neben der Matura auch die anderen Fächer nicht zu vernachlässigen.',
      author: 'Maturandin, Halbjahreskurs',
    },
  ],
  kurstyp: 'halbjahreskurs',
  flowSteps: [
    {
      id: 'standortbestimmung',
      title: 'Standortbestimmung',
      body: 'Vor dem ersten Kurstag stellen wir fest, wo Sie aktuell stehen, um die Kurszeit von Beginn an gezielt zu nutzen.',
    },
    {
      id: 'wochentraining',
      title: 'Wochentraining',
      body: 'Von November bis April wird wöchentlich an Analysis, Vektorgeometrie und Wahrscheinlichkeitsrechnung gearbeitet.',
    },
    {
      id: 'pruefungssimulation-feedback',
      title: 'Prüfungssimulation & Feedback',
      body: 'Eine echte Prüfungssimulation zeigt den aktuellen Stand — inklusive individueller Besprechung und Empfehlungen für die letzten Wochen vor der Matura.',
    },
  ],
  contentSections: [
    {
      id: 'mathematik',
      title: 'Mathematik',
      lede: 'Aufbau, Übung und schrittweise Anleitung zum Lösen der Aufgabentypen, die an der Mathematik-Matura tatsächlich geprüft werden.',
      groups: [
        {
          id: 'analysis',
          subhead: 'Analysis',
          items: ['Ableitungen und Kurvendiskussion', 'Integralrechnung und Flächenberechnungen', 'Extremwertprobleme'],
        },
        {
          id: 'vektorgeometrie',
          subhead: 'Vektorgeometrie',
          items: ['Geraden und Ebenen im Raum', 'Schnittpunkte, Abstände und Winkel', 'Skalar- und Vektorprodukt'],
        },
        {
          id: 'wahrscheinlichkeitsrechnung',
          subhead: 'Wahrscheinlichkeitsrechnung',
          items: ['Kombinatorik und Baumdiagramme', 'Bedingte Wahrscheinlichkeiten', 'Binomial- und Normalverteilung'],
        },
      ],
    },
    {
      id: 'mentale-vorbereitung',
      title: 'Mentale Vorbereitung',
      lede: 'Neben dem Fachwissen fördern wir gezielt Ihre Lernkompetenzen — integriert im Kursprogramm. Die genauen Kursinhalte können sich noch anpassen — die Schwerpunkte richten sich nach dem Stand der jeweiligen Kursgruppe.',
      groups: [
        {
          id: 'themen',
          items: [
            'Selbstorganisation im letzten Gymnasialjahr',
            'Effiziente Lernmethoden für die Prüfungsvorbereitung',
            'Umgang mit Prüfungsdruck',
            'Zeitmanagement während der Prüfung',
          ],
        },
      ],
    },
  ],
  booking: {
    anchorId: 'buchung',
    title: 'Termine und Buchung',
    note: 'Jeder Termin folgt demselben Ablauf — Details dazu unter "Ablauf".',
    emptyState: 'Aktuell sind keine Termine verfügbar.',
  },
} as const satisfies CourseOffer

export const maturaHalbjahreskursDetailPageModel = {
  audience: matura,
  offer: maturaHalbjahreskurs,
  sessions: maturaHalbjahreskursSessions,
} as const satisfies CourseDetailPageModel

export const maturaIntensivwocheSessions = [
  {
    id: 2101,
    offerId: 'offer-matura-intensivwoche',
    capacity: 8,
    source: { kind: 'intensivwoche_kurse', kursId: 2101 },
    kurs: 'Kurs A',
    dateLabel: '26.–30. April',
    timeLabel: '09.00–13.15',
    standort: 'Zürich HB',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'mo', label: 'Mo, 26.4.', value: 'Analysis' },
        { id: 'di', label: 'Di, 27.4.', value: 'Analysis' },
        { id: 'mi', label: 'Mi, 28.4. (Prüfungssimulation)', value: '', highlight: true },
        { id: 'do', label: 'Do, 29.4.', value: 'Vektorgeometrie' },
        { id: 'fr', label: 'Fr, 30.4.', value: 'Wahrscheinlichkeitsrechnung' },
      ],
    },
  },
  {
    id: 2102,
    offerId: 'offer-matura-intensivwoche',
    capacity: 8,
    source: { kind: 'intensivwoche_kurse', kursId: 2102 },
    kurs: 'Kurs B',
    dateLabel: '03.–07. Mai',
    timeLabel: '09.00–13.15',
    standort: 'Winterthur',
    deliveryModes: ['onsite'],
    ablauf: {
      kind: 'simple',
      items: [
        { id: 'mo', label: 'Mo, 3.5.', value: 'Analysis' },
        { id: 'di', label: 'Di, 4.5.', value: 'Analysis' },
        { id: 'mi', label: 'Mi, 5.5. (Prüfungssimulation)', value: '', highlight: true },
        { id: 'do', label: 'Do, 6.5.', value: 'Vektorgeometrie' },
        { id: 'fr', label: 'Fr, 7.5.', value: 'Wahrscheinlichkeitsrechnung' },
      ],
    },
  },
] satisfies SessionDefinition[]

export const maturaIntensivwoche = {
  id: 'offer-matura-intensivwoche',
  audienceId: 'matura',
  slug: 'intensivwoche',
  href: '/kurse/matura/intensivwoche',
  displayName: 'Intensivwoche',
  categoryLabel: 'Mathematik',
  tagline: 'Intensives Training in den Frühlingsferien',
  lede: 'Möchten Sie sich in der letzten Ferienwoche vor der Prüfung nochmals gezielt auf die Mathematik-Matura vorbereiten? Im Kurs werden die prüfungsrelevanten Themen Analysis, Vektorgeometrie und Wahrscheinlichkeitsrechnung trainiert und eine Prüfung simuliert.',
  description:
    'Ideal für Maturandinnen und Maturanden, die sich in der letzten Ferienwoche vor der Prüfung nochmals gezielt auf die Mathematik-Matura vorbereiten möchten.',
  subject: 'ma',
  laufzeit: 'Ende April 2027',
  dateSummary: ['Ende April 2027'],
  features: [
    'Schwerpunkte: Analysis, Vektorgeometrie & Wahrscheinlichkeitsrechnung',
    '5 Kurstage in den Frühlingsferien',
    'Kurszeit: 09.00 – 13.15 Uhr',
    'Inklusive Prüfungssimulation',
  ],
  regularPriceRappen: 98000,
  currency: 'CHF',
  overviewBullets: [
    '5 Kurstage in den Frühlingsferien',
    'Kurszeit: 09.00 – 13.15 Uhr',
    'Kleingruppen: max. 8 Teilnehmende',
    'Zürich HB · Winterthur',
  ],
  whyUs: [
    {
      id: 'fokus-letzte-wochen',
      title: 'Fokus auf die letzten Wochen vor der Matura',
      description:
        'Kurz vor der Prüfung zählt gezieltes Wiederholen mehr als neuer Stoff — genau darauf ist die Woche ausgerichtet.',
    },
    {
      id: 'pruefungssimulation',
      title: 'Eine echte Prüfungssimulation',
      description:
        'Reale Prüfungsbedingungen, korrigiert und Schritt für Schritt besprochen — mitten in der Kurswoche, damit noch Zeit zum Nacharbeiten bleibt.',
    },
    {
      id: 'drei-schwerpunktthemen',
      title: 'Die drei Schwerpunktthemen im Fokus',
      description:
        'Analysis, Vektorgeometrie und Wahrscheinlichkeitsrechnung — konzentriert auf das, was an der Mathematik-Matura tatsächlich geprüft wird.',
    },
    {
      id: 'betreuung-ausserhalb',
      title: 'Betreuung auch ausserhalb der Kurszeit',
      description:
        'Eine gute Begleitung endet für uns nicht mit dem Kursende. Unsere Lehrpersonen stehen bei Fragen auch ausserhalb der Kurszeiten jederzeit per Chat zur Verfügung.',
    },
  ],
  testimonials: [
    {
      id: 'testi-1',
      quote: 'In der Ferienwoche konnte ich mich voll auf Mathe konzentrieren, ohne dass mir Schule dazwischenkam.',
      author: 'Maturand, Intensivwoche',
    },
    {
      id: 'testi-2',
      quote: 'Die Prüfungssimulation hat mir die Nervosität genommen — ich wusste danach genau, was mich erwartet.',
      author: 'Maturandin, Intensivwoche',
    },
    {
      id: 'testi-3',
      quote: 'Fünf Tage vor der Matura waren genau richtig, um nochmals alles zu festigen.',
      author: 'Maturand, Intensivwoche',
    },
  ],
  kurstyp: 'intensivkurs',
  flowSteps: [
    {
      id: 'wissen-aneignen',
      title: 'Wissen aneignen',
      body: 'Prüfungsrelevante Grundlagen in Analysis, Vektorgeometrie und Wahrscheinlichkeitsrechnung im Schnelldurchgang repetieren.',
    },
    {
      id: 'wissen-umsetzen',
      title: 'Wissen umsetzen',
      body: 'Aufgaben im Unterricht trainieren, echte Prüfungssimulation durchführen.',
    },
    {
      id: 'wissen-pruefen',
      title: 'Wissen prüfen',
      body: 'Individuelles Feedback zur Simulation, gemeinsame Besprechung — Sie wissen danach genau, wo noch Übungsbedarf besteht.',
    },
  ],
  contentSections: [],
  booking: {
    anchorId: 'buchung',
    title: 'Termine und Buchung',
    emptyState: 'Aktuell sind keine Termine verfügbar.',
  },
} as const satisfies CourseOffer

export const maturaIntensivwocheDetailPageModel = {
  audience: matura,
  offer: maturaIntensivwoche,
  sessions: maturaIntensivwocheSessions,
} as const satisfies CourseDetailPageModel

export const maturaAudiencePageModel = {
  audience: matura,
  hero: {
    title: 'Vorbereitungskurse für die Mathematik-Matura 2027',
    description:
      'Zwei Wege zur Vorbereitung auf die Maturaprüfung in Mathematik — wöchentliche Begleitung über mehrere Monate oder intensives Training in den Frühlingsferien.',
  },
  offers: [maturaHalbjahreskurs, maturaIntensivwoche],
  addOnOffers: [],
  existingCourses: [],
} as const satisfies AudiencePageModel

// ---------------------------------------------------------------------------------------------
// Selbststudium (BMS + 6. Klasse + 2./3. Sek) -- Layout_6_Klasse_Selbststudium_Unterseite.html +
// Layout_2_Sek_Selbststudium_Unterseite.html. bmsSelbststudium (oben, Schritt 5) ist inhaltlich
// unabhängig extrahiert -- diese beiden Seiten sind laut wörtlicher Prüfung bis auf
// Zielgruppen-Label/Backlink identisch. Die BMS-Fixture-Phrase "2×30 Min. persönliches
// Zeitguthaben für Rückfragen" kommt in KEINER der beiden Quelldateien vor -- bewusst nicht
// nachträglich ergänzt (Quelltreue, kein Uniform-Machen über verschiedene reale Seiten hinweg).
// ---------------------------------------------------------------------------------------------

export const sechsKlasseSelbststudium = {
  id: 'offer-6klasse-selbststudium',
  audienceId: '6',
  slug: 'selbststudium',
  href: '/kurse/6-klasse/selbststudium',
  displayName: 'Selbststudium',
  tagline: 'Selbststudium · 6. Klasse',
  lede: 'Zugriff auf Übungsaufgaben, alte Prüfungen mit Lösungen und persönliches Feedback zu deinen eigenen Aufsätzen — flexibel von zu Hause aus, im eigenen Tempo.',
  description:
    'Zugriff auf Übungsaufgaben, alte Prüfungen mit Lösungen und persönliches Feedback zu deinen eigenen Aufsätzen — flexibel von zu Hause aus, im eigenen Tempo.',
  laufzeit: 'Zugang bis zur Prüfung im März 2027',
  dateSummary: ['Einmalig · Zugang bis März 2027'],
  features: [
    'Übungsaufgaben zu allen Prüfungsbereichen — von Sprachbetrachtung bis Textverständnis und Mathematik',
    'Bisherige Aufnahmeprüfungen im Original, jeweils mit vollständigen Lösungen zum Selbstvergleich',
    'Bis zu 3 eigene Aufsätze einreichen und eine persönliche, schriftliche Rückmeldung erhalten',
  ],
  regularPriceRappen: 19000,
  currency: 'CHF',
  priceUnit: 'Einmalig · Zugang bis zur Prüfung im März 2027',
  overviewBullets: [
    'Übungsaufgaben zu allen Prüfungsbereichen',
    'Alte Prüfungen im Original mit vollständigen Lösungen',
    'Persönliches Aufsatz-Feedback (bis zu 3 Aufsätze)',
  ],
  whyUs: [
    {
      id: 'uebungen',
      title: 'Übungsaufgaben',
      description: 'Aufgaben zu allen Prüfungsbereichen — von Sprachbetrachtung bis Textverständnis und Mathematik.',
    },
    {
      id: 'pruefungen',
      title: 'Alte Prüfungen & Lösungen',
      description: 'Bisherige Aufnahmeprüfungen im Original, jeweils mit vollständigen Lösungen zum Selbstvergleich.',
    },
    {
      id: 'feedback',
      title: 'Aufsatz-Feedback',
      description: 'Bis zu 3 eigene Aufsätze einreichen und eine persönliche, schriftliche Rückmeldung erhalten.',
    },
  ],
  kurstyp: 'selbststudium',
  materialAreaId: 'langzeitgymi',
  access: {
    title: 'Zugriff verfällt nach der Gymiprüfung',
    description:
      'Der Zugang zur Materialplattform ist bis zur Aufnahmeprüfung im März 2027 gültig und wird danach automatisch deaktiviert. Eine Verlängerung ist nicht vorgesehen.',
  },
} as const satisfies SelfStudyOffer

export const sechsKlasseSelbststudiumPageModel = {
  audience: sechsKlasse,
  hero: {
    eyebrow: 'Selbststudium · 6. Klasse',
    title: 'Eigenständig üben, gezielt vorbereiten',
    description:
      'Zugriff auf Übungsaufgaben, alte Prüfungen mit Lösungen und persönliches Feedback zu deinen eigenen Aufsätzen — flexibel von zu Hause aus, im eigenen Tempo.',
  },
  offer: sechsKlasseSelbststudium,
  accessAction: { kind: 'disabled', label: 'Zugang erhalten', disabledReason: 'Buchung folgt in einer späteren Ausbaustufe' },
} as const satisfies SelfStudyPageModel

export const zweiDreiSekSelbststudium = {
  id: 'offer-2-3sek-selbststudium',
  audienceId: '2-3-sek',
  slug: 'selbststudium',
  href: '/kurse/2-3-sek/selbststudium',
  displayName: 'Selbststudium',
  tagline: 'Selbststudium · 2./3. Sek',
  lede: 'Zugriff auf Übungsaufgaben, alte Prüfungen mit Lösungen und persönliches Feedback zu deinen eigenen Aufsätzen — flexibel von zu Hause aus, im eigenen Tempo.',
  description:
    'Zugriff auf Übungsaufgaben, alte Prüfungen mit Lösungen und persönliches Feedback zu deinen eigenen Aufsätzen — flexibel von zu Hause aus, im eigenen Tempo.',
  laufzeit: 'Zugang bis zur Prüfung im März 2027',
  dateSummary: ['Einmalig · Zugang bis März 2027'],
  features: [
    'Übungsaufgaben zu allen Prüfungsbereichen — von Sprachbetrachtung bis Textverständnis und Mathematik',
    'Bisherige Aufnahmeprüfungen im Original, jeweils mit vollständigen Lösungen zum Selbstvergleich',
    'Bis zu 3 eigene Aufsätze einreichen und eine persönliche, schriftliche Rückmeldung erhalten',
  ],
  regularPriceRappen: 19000,
  currency: 'CHF',
  priceUnit: 'Einmalig · Zugang bis zur Prüfung im März 2027',
  overviewBullets: [
    'Übungsaufgaben zu allen Prüfungsbereichen',
    'Alte Prüfungen im Original mit vollständigen Lösungen',
    'Persönliches Aufsatz-Feedback (bis zu 3 Aufsätze)',
  ],
  whyUs: [
    {
      id: 'uebungen',
      title: 'Übungsaufgaben',
      description: 'Aufgaben zu allen Prüfungsbereichen — von Sprachbetrachtung bis Textverständnis und Mathematik.',
    },
    {
      id: 'pruefungen',
      title: 'Alte Prüfungen & Lösungen',
      description: 'Bisherige Aufnahmeprüfungen im Original, jeweils mit vollständigen Lösungen zum Selbstvergleich.',
    },
    {
      id: 'feedback',
      title: 'Aufsatz-Feedback',
      description: 'Bis zu 3 eigene Aufsätze einreichen und eine persönliche, schriftliche Rückmeldung erhalten.',
    },
  ],
  kurstyp: 'selbststudium',
  materialAreaId: 'kurzgymi',
  access: {
    title: 'Zugriff verfällt nach der Gymiprüfung',
    description:
      'Der Zugang zur Materialplattform ist bis zur Aufnahmeprüfung im März 2027 gültig und wird danach automatisch deaktiviert. Eine Verlängerung ist nicht vorgesehen.',
  },
} as const satisfies SelfStudyOffer

export const zweiDreiSekSelbststudiumPageModel = {
  audience: zweiDreiSek,
  hero: {
    eyebrow: 'Selbststudium · 2./3. Sek',
    title: 'Eigenständig üben, gezielt vorbereiten',
    description:
      'Zugriff auf Übungsaufgaben, alte Prüfungen mit Lösungen und persönliches Feedback zu deinen eigenen Aufsätzen — flexibel von zu Hause aus, im eigenen Tempo.',
  },
  offer: zweiDreiSekSelbststudium,
  accessAction: { kind: 'disabled', label: 'Zugang erhalten', disabledReason: 'Buchung folgt in einer späteren Ausbaustufe' },
} as const satisfies SelfStudyPageModel

// ---------------------------------------------------------------------------------------------
// 2.2/2.8 ExamSimulationOffer -- Layout_2_Sek_Pruefungssimulation.html (wie die 6.-Klasse-Quelle
// laut Abschnitt 4 ein fremdes, iframe-srcdoc-exportiertes Design-System; Inhalt wörtlich aus dem
// eingebetteten Markup übernommen, nicht aus dem Wrapper-CSS/der Navigation). Preis CHF 145
// stimmt mit der 6.-Klasse-Detailseite und der BMS-Prüfungssimulation überein -- kein Preis-Bug
// hier. Der vierteilige Bewertungsraster-Abschnitt ("Note" / "Inhalt & Aufbau" / "Sprache &
// Ausdruck" / "Hinweise") und der dreistufige Nachprüfungs-Feedbackfluss ("Digitalisieren" /
// "Rückmeldung" / "Freigeben") werden für beide Prüfungssimulationsseiten zentral in
// exam-simulation-detail.tsx gerendert.
// ---------------------------------------------------------------------------------------------

export const zweiDreiSekPruefungssimulation = {
  id: 'offer-2-3sek-pruefungssimulation',
  audienceId: '2-3-sek',
  slug: 'pruefungssimulation',
  href: '/kurse/2-3-sek/pruefungssimulation',
  displayName: 'Prüfungssimulation',
  tagline: 'Offen für alle',
  lede: 'Die echte Prüfungssituation kennenlernen, Zeitmanagement trainieren und gezielt erkennen, wo bis zur Gymiprüfung noch Lernbedarf besteht.',
  description:
    'Eine echte Aufnahmeprüfung unter realen Bedingungen — inklusive schriftlicher Bewertung. Auch ohne vorherige Kursteilnahme buchbar.',
  laufzeit: 'Ein Prüfungstermin, Vormittag & Nachmittag',
  dateSummary: ['Vormittag & Nachmittag'],
  features: [
    'Prüfungssimulation nach aktuellem Prüfungsformat',
    'Durchführung unter Prüfungsbedingungen',
    'Schriftliche Bewertung des Aufsatzes',
  ],
  regularPriceRappen: 14500,
  currency: 'CHF',
  priceUnit: 'pro Teilnahme',
  overviewBullets: [
    'Echte Zeitvorgaben, ohne Unterbrechung',
    'Aufgabentypen, Umfang und Schwierigkeitsgrad orientieren sich an der Aufnahmeprüfung',
    'Ruhige, kontrollierte Umgebung',
  ],
  whyUs: [
    {
      id: 'zeitvorgaben',
      title: 'Echte Zeitvorgaben',
      description: 'Die Aufgaben werden im vorgesehenen Zeitrahmen und ohne Unterbrechung gelöst.',
    },
    {
      id: 'aufgaben',
      title: 'Aufgaben',
      description: 'Aufgabentypen, Umfang und Schwierigkeitsgrad orientieren sich an der Aufnahmeprüfung.',
    },
    {
      id: 'umgebung',
      title: 'Ruhige Umgebung',
      description: 'Eine kontrollierte Durchführung hilft, Nervosität und Konzentration realistisch zu erleben.',
    },
  ],
  kurstyp: 'pruefungssimulation',
  flowSteps: [
    { id: 'einfuehrung', title: 'Einführung', body: 'Ablauf, Regeln und Material werden kurz erklärt.' },
    { id: 'pruefung', title: 'Prüfung', body: 'Deutsch und Mathematik unter echten Zeitvorgaben.' },
    { id: 'korrektur', title: 'Korrektur', body: 'Der Aufsatz wird fachlich korrigiert und benotet.' },
    { id: 'freigabe', title: 'Freigabe', body: 'Der korrigierte Aufsatz wird im Portal bereitgestellt.' },
  ],
  examTimeline: [
    { id: 'deutsch-sprache', subject: 'de', label: 'Deutsch Sprachprüfung', minutes: 45 },
    { id: 'mathematik', subject: 'ma', label: 'Mathematik', minutes: 90 },
    { id: 'mittagspause', subject: 'pause', label: 'Mittagspause', minutes: 0 },
    { id: 'deutsch-aufsatz', subject: 'de', label: 'Deutsch Aufsatz', minutes: 90 },
  ],
  faq: [
    {
      id: 'faq-aufgaben',
      question: 'Entsprechen die Aufgaben der echten Gymiprüfung?',
      answer:
        'Die Aufgaben orientieren sich an den relevanten Aufgabentypen, Anforderungen und Zeitvorgaben. Es werden keine zukünftigen Originalprüfungen verwendet.',
    },
    {
      id: 'faq-korrektur',
      question: 'Wird die gesamte Prüfung korrigiert?',
      answer:
        'Der Aufsatz wird persönlich durch eine Lehrperson korrigiert und mit schriftlichem Feedback ins Portal geladen. Für Mathematik und Deutsch Sprache stehen detaillierte Lösungen zur Selbstkorrektur bereit.',
    },
    {
      id: 'faq-scan-portal',
      question: 'Wann erscheint der gescannte Aufsatz im Portal?',
      answer:
        'Nach der fachlichen Korrektur wird der Scan dem persönlichen Teilnehmerkonto zugeordnet. Sobald er freigegeben ist, erhält der Teilnehmer eine Benachrichtigung.',
    },
    {
      id: 'faq-feedback-sichtbarkeit',
      question: 'Wer kann das Feedback sehen?',
      answer:
        'Nur berechtigte Personen im geschützten Teilnehmerkonto sowie die zuständigen Lehrpersonen können auf die Prüfungsunterlagen zugreifen.',
    },
    {
      id: 'faq-besprechung',
      question: 'Kann das Feedback mit einer Lehrperson besprochen werden?',
      answer: 'Optional kann ein persönliches Auswertungsgespräch oder eine Nachbesprechung gebucht werden.',
    },
    {
      id: 'faq-ohne-kurs',
      question: 'Kann man auch ohne laufenden Vorbereitungskurs teilnehmen?',
      answer: 'Ja. Die Prüfungssimulation eignet sich auch als unabhängige Standortbestimmung.',
    },
  ],
  booking: {
    anchorId: 'buchung',
    title: 'Termine und Buchung',
    emptyState: 'Aktuell sind keine Termine verfügbar.',
  },
} as const satisfies ExamSimulationOffer

export const zweiDreiSekPruefungssimulationSessions = [
  {
    id: 4101,
    offerId: 'offer-2-3sek-pruefungssimulation',
    capacity: 20,
    source: { kind: 'intensivwoche_kurse', kursId: 4101 },
    kurs: 'Mittwoch, 17. Februar',
    dateLabel: 'Mittwoch, 17. Februar',
    timeLabel: '09.00–11.45 & 13.15–14.45',
    standort: 'Zürich HB',
    deliveryModes: ['onsite'],
    ablauf: { kind: 'simple', items: [] },
  },
  {
    id: 4102,
    offerId: 'offer-2-3sek-pruefungssimulation',
    capacity: 20,
    source: { kind: 'intensivwoche_kurse', kursId: 4102 },
    kurs: 'Samstag, 20. Februar',
    dateLabel: 'Samstag, 20. Februar',
    timeLabel: '09.00–11.45 & 13.15–14.45',
    standort: 'Winterthur',
    deliveryModes: ['onsite'],
    ablauf: { kind: 'simple', items: [] },
  },
  {
    id: 4103,
    offerId: 'offer-2-3sek-pruefungssimulation',
    capacity: 20,
    source: { kind: 'intensivwoche_kurse', kursId: 4103 },
    kurs: 'Mittwoch, 24. Februar',
    dateLabel: 'Mittwoch, 24. Februar',
    timeLabel: '09.00–11.45 & 13.15–14.45',
    standort: 'Zürich HB',
    deliveryModes: ['onsite'],
    ablauf: { kind: 'simple', items: [] },
  },
  {
    id: 4104,
    offerId: 'offer-2-3sek-pruefungssimulation',
    capacity: 20,
    source: { kind: 'intensivwoche_kurse', kursId: 4104 },
    kurs: 'Freitag, 26. Februar',
    dateLabel: 'Freitag, 26. Februar',
    timeLabel: '09.00–11.45 & 13.15–14.45',
    standort: 'Winterthur',
    deliveryModes: ['onsite'],
    ablauf: { kind: 'simple', items: [] },
  },
] satisfies SessionDefinition[]

export const zweiDreiSekPruefungssimulationPageModel = {
  audience: zweiDreiSek,
  offer: zweiDreiSekPruefungssimulation,
  sessions: zweiDreiSekPruefungssimulationSessions,
} as const satisfies ExamSimulationPageModel
