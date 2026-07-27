# Design-System: verbindliche UI-Konventionen für alle Marketing-/Kursseiten

Stand: 27.07.2026. Dieses Dokument fasst die tatsächlich implementierten, wiederkehrenden
UI-Muster unter `app/[locale]/(marketing)/` und ihren Komponenten zusammen — es beschreibt den
**Ist-Zustand des Codes**, nicht ein neu erfundenes Wunschbild. Ziel: Beim Bau oder Ändern einer
Seite hier nachschlagen statt Werte neu zu erfinden oder von einer anderen Seite abzuschauen, die
selbst schon abweicht. Ergänzt (ersetzt nicht) `architektur-briefing-kursseiten.md` (Komponentenschnitt,
Datenmodell, Routing) und `design-review-todo.md` (Einzelbefunde/Redaktionsgates).

Betrifft ausschliesslich den lokalisierten Marketing-Bereich (`app/[locale]/(marketing)/` und
`app/components/marketing/`, `app/components/kurse/`, `app/components/layout/`). Dashboard, Auth,
Trainer etc. verwenden bewusst weiterhin die generische shadcn-Palette (siehe `.brand-marketing`-
Scope in `app/globals.css`) und sind nicht Teil dieses Dokuments.

## 1. Layout-Primitives — immer verwenden, nie duplizieren

| Primitive | Datei | Zweck |
|---|---|---|
| `PageContainer` | `app/components/layout/page-container.tsx` | `max-w-6xl`, zentriert, `px-6`. Einzige Breiten-/Seitenabstandsquelle. |
| `Section` | `app/components/layout/section.tsx` | Vertikaler Rhythmus + Hintergrundvariante (siehe Abschnitt 2). Umschliesst automatisch `PageContainer`. |
| `SectionHeading` | `app/components/layout/section-heading.tsx` | H2/H3, optionaler Eyebrow/Description, `align="left"\|"center"`. Einzige Section-Titel-Quelle. |
| `ResponsiveGrid` | `app/components/layout/responsive-grid.tsx` | `columns={{ base, sm, md, lg }}`, `gap`. Kein manuelles `grid grid-cols-*` in Seiten-Code. |

Jede neue Sektion wird aus diesen vier Bausteinen zusammengesetzt. Eigenes `<div className="max-w-...">`
oder `<h2 className="text-...">` ausserhalb dieser Primitives ist ein Duplikat und wird vermieden.

## 2. Section-Rhythmus (Hintergrund + vertikaler Abstand)

`Section` kennt zwei unabhängige Achsen:

```ts
variant: 'default' | 'muted'   // Hintergrund
spacing: 'sm' | 'default' | 'lg'  // py-8/12 · py-12/16 · py-16/24 (mobil/md)
```

**Kanonisches Muster (sitewide, Stand 27.07.2026 — vereinheitlicht auf das auf der Startseite
validierte, kompaktere Rhythmus-Muster; siehe „Reconciliation-Log“ am Ende dieses Abschnitts):**

1. Hero/erste Sektion einer Seite: `spacing="default"`.
2. Alle folgenden Inhaltssektionen: `spacing="sm"`.
3. Der Hintergrund alterniert strikt `variant="default"` / `variant="muted"` — **nie zwei
   benachbarte Sections mit demselben Hintergrund**, sonst verschmelzen sie optisch zu einem Block
   ohne erkennbare Grenze.
4. Müssen **drei oder mehr** helle Sektionen unmittelbar aufeinanderfolgen (kein `muted` mehr
   verfügbar, ohne zwei gleiche Nachbarn zu erzeugen), wird `bg-ink-pale/50` als dritter,
   kühlerer Alternativton eingeschoben (siehe Abschnitt 5). Das ist der einzige Fall, in dem eine
   Section ihren Hintergrund über ein direktes `className` statt über `variant` setzt.
5. Eine einzelne, in sich geschlossene Zusatz-Sektion innerhalb einer Seite (z. B. ein
   Notiz-/CTA-Block, der nicht Teil der Haupt-Abschnittsfolge ist) darf ausnahmsweise enger sein
   als Punkt 2 vorgibt, siehe die Sonderfälle in `[angebot]/page.tsx` (Prüfungssimulations-
   Fremdlayout, bereits `spacing="sm"`).

**Reconciliation-Log:** Bis 27.07.2026 nutzte nur die Startseite dieses kompaktere Muster
(`sm`/`bg-ink-pale`), während alle übrigen Marketingseiten noch `lg`/`default`+`muted` ohne dritten
Ton verwendeten — eine echte, unbeabsichtigte Inkonsistenz. Entscheidung: **nicht die Startseite
zurückbauen**, sondern ihr bereits mehrfach nutzergeprüftes, dichteres Rhythmus-Muster als
sitewide-Standard übernehmen (Punkte 1–4 oben). Alle Seiten mit `<Section>`-Vorkommen wurden
entsprechend angeglichen. Ein direkter `bg-primary` unmittelbar vor `SiteFooter` bleibt weiterhin
verboten (siehe unten).

Der abschliessende `SiteFooter` ist immer `bg-primary` (identisch mit `SiteNav`, siehe Abschnitt 5) —
eine Section direkt davor darf deshalb nicht ebenfalls `bg-primary` verwenden (siehe „Nicht sicher,
welcher Kurs passt?“-Banner, das deshalb bewusst `bg-secondary` erhielt).

## 3. Typografie-Skala

| Element | Klassen | Beispiel |
|---|---|---|
| Hero-H1 | `font-serif text-3xl md:text-4xl font-semibold` | Startseiten-/Audience-Hero-Titel |
| Section-H2 (`SectionHeading`, `size="default"`) | `font-semibold text-2xl md:text-3xl` | „Unsere Leistungen“, „Ergänzend zu unseren Kursen“ |
| Card-/Tile-Titel (`h3`) | `font-serif text-lg` bis `text-xl font-semibold` | `ServiceCard`, `ValueProps`, `WhyUsGrid` |
| Eyebrow/Label (unlackiert, kein Badge) | `font-mono text-xs tracking-wide uppercase text-secondary` | Hero-Eyebrow „Kompetenzzentrum …“ |
| Fliesstext | Standard `<p>`, `text-muted-foreground` für Sekundärtext | Beschreibungen |
| Caption/Autor | `font-mono text-sm text-muted-foreground` | Testimonial-Attribution |

**Eyebrow-Regel:** Ein Eyebrow-Label ist **reiner Text in einer Markenfarbe**, keine gefüllte
`Badge`. Eine gefüllte `Badge` ist ausschliesslich für echte Status-/Fach-Aussagen reserviert
(siehe Abschnitt 4) — nicht als reines Stilmittel für Kleingedrucktes über einer Überschrift.
Grund: `text-secondary` (sage-deep) hat auf `--background` bereits ausreichenden eigenen Kontrast
(~6:1); eine Badge fügt visuelles Gewicht hinzu, das die Vorlage an dieser Stelle nicht vorsieht.

## 4. Badges — drei verschiedene, nicht austauschbare Bedeutungen

| Komponente | Datei | Bedeutung | Beispiel |
|---|---|---|---|
| `StatusBadge` | `app/components/kurse/status-badge.tsx` | Verfügbarkeit/Status, **immer mit Text**, nie nur Farbe | „freie Plätze“, „wenige Plätze“, „Vorschau“ |
| `CategoryBadge` | `app/components/kurse/category-badge.tsx` | Fach-/Fit-Tag, Farbe aus `Subject` (`subject-{de,ma,fr,nmg}-pale/-foreground`) | „Deutsch & Mathematik“ |
| plain `<p>`/`<span>` mit `text-{token}` | — | Eyebrow/Label ohne Fach- oder Statusaussage | Hero-Eyebrow |

Eine neue Komponente entscheidet zuerst, in welche dieser drei Kategorien ihr Label fällt, statt
eine neue vierte Variante zu erfinden.

## 5. Farbsystem — wofür welcher Token steht

Basis: `app/globals.css`, Tokens gelten nur innerhalb `.brand-marketing` (vom Marketing-Layout
gesetzt, siehe `app/[locale]/(marketing)/layout.tsx`).

| Token | Bedeutung | Typische Verwendung |
|---|---|---|
| `primary` (Ink, Navy) | Marke/Struktur | `SiteNav`, `SiteFooter` — **immer identisch**, da beide `bg-primary` sind |
| `secondary` (Sage-deep) | Erfolg/„frei“/Deutsch/primärer Aktionsakzent | Eyebrow-Text, `StatusBadge frei`, Primarschule-Picker-Band, Final-CTA-Hintergrund |
| `accent` (Gold) | Mathematik/Sekundarschule/Preis-Akzente | Sek-Picker-Band, `examprep`-Kartenrahmen, Login-Button |
| `tertiary` (Azure) | BMS/Matura | `tertiary`-Kartenrahmen (Abschnitt „Ergänzend zu unseren Kursen“) |
| `subject-de/ma/fr/nmg` (+ `-pale`, `-foreground`) | Fachfarben | `CategoryBadge`, `CourseCard`-Akzente |
| `muted` | Standard-Sektionsalternation (warmes Grau) | siehe Abschnitt 2 |
| `ink-pale` | Dritter, kühlerer Alternativton zu `muted` (sitewide, für 3+ helle Sektionen in Folge) | Startseite „Unsere Leistungen“ (Abschnitt 2, Punkt 4) |
| `destructive` | Fehlerzustand/„ausgebucht“ | `StatusBadge voll` |

**Karten-Rahmenfarbe nach Kategorie ist ein etabliertes Muster, kein Einzelfall:** `CourseCard`
färbt Kopfverlauf/Tags nach Karten-Index (`secondary`/`accent`-Wechsel), `ServiceCard` färbt nach
`ServiceSubgroupModel.id` (`core`→`secondary`, `examprep`→`accent`, `tertiary`→`tertiary`). Eine
neue kategorisierte Kartenliste folgt demselben Prinzip: **Farbe kommt aus der fachlichen
Kategorie/Position, nie aus einer neu erfundenen, lokal hartcodierten Hex-/Klassenkombination.**

## 6. Card-/Tile-Muster — drei Varianten, bewusst unterschiedlich

| Variante | Komponente(n) | Aussehen | Wann verwenden |
|---|---|---|---|
| Gefüllte Card mit Farbverlauf-Kopf | `CourseCard` | `Card` mit Gradient-Header + Tag-Badge + Feature-Liste | Kurs-/Angebotskacheln mit Preis/CTA |
| Gefüllte Card, farbiger Rahmen | `ServiceCard`, `WhyUsGrid` | Standard-`Card` (Rahmen, Hintergrund, Schatten), `gap-2` zwischen Titel/Text, Rahmenfarbe nach Kategorie | Klickbare Verweiskarten (Zusatzangebote), „4 Gründe, die zählen“ |
| Flaches Tile, nur farbige Oberkante | `ValueProps` | Kein Rahmen/Hintergrund/Schatten, nur `border-t-2` in Akzentfarbe | Reine Werte-/Vorteils-Aufzählung ohne Klickziel (Startseite „Unsere Leistungen“) |

**Nicht mischen:** `WhyUsGrid` (Kursdetailseiten, „4 Gründe, die zählen“) und `ValueProps`
(Startseite, „Unsere Leistungen“) sehen bewusst unterschiedlich aus, weil die Vorlage das so
vorsieht — nicht versehentlich dieselbe Kartenoptik für beide wiederverwenden.

**Titel-Text-Abstand:** Der shadcn-`Card`-Default (`gap-6` zwischen `CardHeader`/`CardContent`)
ist für kompakte Zwei-Zeilen-Karten (Titel + kurzer Text) zu gross. `ServiceCard` überschreibt dies
auf `gap-2`. Neue kompakte Karten übernehmen `gap-2`, nicht den ungeprüften Default.

## 7. Buttons je Hintergrund

| Hintergrund der Section | Button-Klassen |
|---|---|
| `bg-primary` (Navy, z. B. `SiteNav`) | `bg-accent text-accent-foreground` (Login-CTA) |
| `bg-secondary` (Sage, z. B. Final-CTA-Banner) | `bg-background text-foreground hover:bg-accent hover:text-accent-foreground` |
| Standard-/`muted`-Hintergrund | Default-`Button` (`bg-primary text-primary-foreground`) |

Regel: Ein Button auf einer farbigen Section-Fläche braucht **immer** einen manuell geprüften
Kontrast-Override — der shadcn-Default (`bg-primary`) ist nur auf neutralem Seitenhintergrund
korrekt.

## 8. Vor dem Bau einer neuen Sektion — Checkliste

1. Passt eine der drei Card-/Tile-Varianten aus Abschnitt 6, oder ist wirklich eine neue Variante
   nötig? (Neue Variante nur mit Begründung, warum keine der drei passt.)
2. Alterniert die neue Section korrekt gegenüber ihrer Vorgänger-Section (Abschnitt 2)?
3. Steht die Section direkt vor `SiteFooter`? Dann **nicht** `bg-primary` verwenden.
4. Ist ein Label wirklich ein Status/Fach (→ `StatusBadge`/`CategoryBadge`) oder nur Zierelement
   (→ plain Text, Abschnitt 3/4)?
5. Kommt eine Akzentfarbe aus der fachlichen Kategorie (Abschnitt 5), nicht aus einer neuen,
   lokal erfundenen Klasse?
6. Wurde `PageContainer`/`Section`/`SectionHeading`/`ResponsiveGrid` verwendet statt eigenem
   Wrapper-Markup?

## 9. Offene Punkte

Keine offenen Punkte mehr zum Section-Rhythmus — Abschnitt 2 (Reconciliation-Log) ist der
verbindliche, sitewide umgesetzte Stand. Das in `[angebot]/page.tsx` separat behandelte
Prüfungssimulations-Fremdlayout (`usesReferenceExamLayout`, siehe Abschnitt 4 des
Architektur-Briefings) bleibt bewusst ausserhalb dieses Rhythmus, da es ein eigenes,
nicht-migriertes Design-System einbettet.
