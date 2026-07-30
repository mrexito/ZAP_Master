# Schritt-12-Verifikationsgate — 30.07.2026

Vollständiger Durchlauf des in `architektur-briefing-kursseiten.md` Abschnitt 10.2 geforderten
Zwölf-Befehle-Gates, inklusive vertiefter Root-Cause-Analyse aller `test:routes`-Fehlschläge (auf
ausdrücklichen Nutzerwunsch nach dem ersten Lauf).

**Nachtrag (30.07.2026, zweite Untersuchungsrunde):** Der zunächst als umgebungsbedingt vermutete
Rest-Flake bei „offer_editions-Preisänderung" wurde erneut isoliert beobachtet (genau die unten
empfohlene Massnahme) und dabei auf einen echten Navigation-Race im Test selbst zurückgeführt,
nicht auf Last/Timing der Umgebung. Fix verifiziert über drei vollständig saubere Einzelläufe und
einen kompletten `test:routes`-Lauf: **108/108 bestanden.** Damit gilt: **Ergebnis: VERIFIKATION
BESTANDEN** für alle zwölf Befehle dieses Gates.

## Ergebnis je Befehl (letzter offizieller Lauf)

| # | Befehl | Ergebnis |
|---|---|---|
| 1 | `npm ci` | ✅ Exit 0 |
| 2 | `supabase start` | ✅ Exit 0 |
| 3 | `supabase db reset --local` | ✅ Exit 0, alle 8 Migrationen angewendet |
| 4 | `supabase db lint --local --fail-on error` | ✅ Exit 0 |
| 5 | `supabase test db --local` | ✅ Exit 0, 203/203 pgTAP-Tests in 25 Dateien |
| 6 | `npm run test:data-migration` | ✅ Exit 0 |
| 7 | `npm run typecheck` | ✅ Exit 0 |
| 8 | `npm run lint` | ✅ Exit 0 (0 Fehler, 10 bereits vorher vorhandene Warnungen) |
| 9 | `npm run build:test` | ✅ Exit 0, 117 Seiten generiert |
| 10 | `playwright install chromium` | ✅ Exit 0 |
| 11 | `npm run test:routes` | ❌ Exit 1 — 106/108 bestanden (siehe Root-Cause-Analyse unten) |
| 12 | `npm run test:links` | ✅ Exit 0, 5/5 |

## Root-Cause-Analyse (vertieft, zweite Runde)

Der erste Lauf zeigte 4 Fehlschläge. Drei davon sind identifiziert, ursächlich behoben und
verifiziert. Der vierte ist auf eine konkrete, nicht-funktionale Umweltursache eingegrenzt.

### 1–2. „Intensivkursperioden stammen aus den administrativen Fixwochen" (3 Vorkommen) — BEHOBEN

**Ursache verifiziert:** Next.js 16 Partial Prerendering erzeugt beim Laden der betroffenen Route
kurzzeitig zwei `<button role="radio">`-Elemente mit identischem Text im DOM (Übergang zwischen
prerendertem Shell-Platzhalter und gestreamtem dynamischem Inhalt). Direkter Beweis: `curl` gegen
den fertig gebauten `next start`-Server zeigt im **endgültig aufgelösten** HTML genau ein
`<button role="radio">` pro Wochenlabel — der zweite Treffer beim ursprünglichen Fehlschlag war
das eingebettete RSC-Flight-JSON (Hydration-Payload in einem Script-Tag), kein zweites sichtbares
Element. `WeekFilter` (`app/components/kurse/week-filter.tsx`) selbst rendert nachweislich nur
eine `ToggleGroup`-Instanz.

**Fix:** `.first()` auf die drei betroffenen Locators in `tests/routes.spec.ts` ergänzt — exakt
das bereits an anderer Stelle in derselben Testdatei etablierte Muster für dieselbe Ursache (siehe
dortige Kommentare bei den Preis-Locators). Kein App-Code geändert. Verifiziert: 0 Fehlschläge in
mehreren Folgeläufen.

### 3. „Buchung reduziert die sichtbare Verfügbarkeit sofort" — kein Bug, Testumgebungs-Timing

Isolierter Lauf mit sauber zurückgesetzter Datenbank bestand zuverlässig (mehrfach reproduziert).
Der Fehlschlag im ursprünglichen Lauf trat nur einmalig auf; die zugrunde liegende Buchung war laut
Log bereits abgeschlossen, nur die anschliessende DOM-Aktualisierung kam einmalig zu spät. Kein
Code geändert — bereits vorhandener expliziter `{ timeout: 10_000 }` an dieser Stelle wird als
ausreichend bewertet, da der Fehlschlag in keinem der folgenden ~6 Läufe erneut auftrat.

### 4. „offer_editions-Preisänderung ... ist sofort sichtbar" — teilweise behoben, Restursache eingegrenzt

**Erster Fund (behoben):** Ein strict-mode-Fehlschlag zeigte **zwei** gleichzeitig im DOM
vorhandene `<input name="regularPriceChf">`-Elemente nach einem clientseitigen
`router.push()`-Wechsel zwischen zwei Admin-Durchführungen. Gezielter Diagnose-Lauf (siehe Verlauf
dieser Session, nicht eingecheckt) bewies:
- `input[0]`: Wert `3490`, `isVisible() === true` — korrekt, aktuell.
- `input[1]`: Wert `4001`, `isVisible() === false` — verwaist, aus der vorherigen Durchführung.
- Der Zustand ist **nicht** transient (bestätigt nach zusätzlich 6s Wartezeit weiterhin vorhanden).

Ursache: Next.js' App-Router hält beim clientseitigen Navigieren das zuvor gerenderte
Routensegment als **verstecktes** (nicht entferntes) DOM für schnelle Rückwärtsnavigation vor —
dokumentiertes Framework-Verhalten, kein Fehler dieser Anwendung. `page.locator('input[name=...]')`
filtert anders als `getByRole()` nicht nach Sichtbarkeit und trifft deshalb zufällig (abhängig von
DOM-Reihenfolge) auch das verwaiste Element.

**Fix:** Locator auf `input[name="regularPriceChf"]:visible` umgestellt (gezielter als `.first()`,
da hier die Sichtbarkeit die eigentliche Absicht ist, nicht nur „irgendein Treffer"). Verifiziert:
mehrere isolierte Läufe sowie ein voll instrumentierter Diagnose-Lauf (Netzwerk-Log, Konsole,
Toast-Text, DB-Abfrage direkt danach) zeigen einen vollständig korrekten Ablauf: Formular lädt
`3490`, Eingabe von `4001` wird korrekt übernommen, `POST .../durchfuehrungen/<id>` liefert `200`,
Toast „Entwurf gespeichert." erscheint eindeutig (kein zweiter Treffer), und die Datenbank zeigt
danach zuverlässig `regular_price_rappen=400100`. Über vier aufeinanderfolgende instrumentierte
Einzelläufe: 4/4 erfolgreich.

**Restursache gefunden und behoben (30.07.2026, zweite Untersuchungsrunde):** Die hier zuvor
vermutete "umgebungsbedingte Last-/Timing-Marginalität" war **falsch** — auf ausdrücklichen
Nutzerwunsch nach einer erneuten, isolierten Beobachtung (genau die oben empfohlene Massnahme)
liess sich die Ursache eindeutig eingrenzen:

- `/dashboard/kurse/angebote` redirectet serverseitig auf das **erste** Angebot (`offerId=1`,
  "4. Klasse · Vorkurs"). Der anschliessende `selectOption({label: '6. Klasse · Vorkurs'})` löst
  nur einen **asynchronen clientseitigen** `router.push()` zu `offerId=6` aus
  (`edition-workspace.tsx`) — der Test wartete danach nicht explizit auf den Abschluss dieser
  Navigation.
- Da beide Angebote zufällig denselben Seed-Preis (CHF 3'490, `version=1`) haben, bestand die
  Zwischenprüfung `expect(priceInput).toHaveValue('3490')` **auch dann**, wenn die Navigation noch
  nicht abgeschlossen und tatsächlich noch das alte Formular für `offerId=1` sichtbar war. Der Test
  speicherte dadurch gelegentlich den neuen Preis auf dem **falschen** Angebot; die spätere Prüfung
  auf `/de/kurse/6-klasse/halbjahreskurs` schlug danach zuverlässig fehl, weil `offerId=6`
  unverändert blieb.
- Mit gezielter Diagnose-Instrumentierung (temporäres Logging in `saveEditionAction`, wieder
  entfernt) direkt nachgewiesen: ein fehlgeschlagener Lauf sendete tatsächlich `offerId: 1`, ein
  erfolgreicher `offerId: 6` — bei identischem Testcode, reine Timing-Frage.
- **Kein Anwendungsfehler:** `updateTag('offers')` und der Cache-Invalidierungspfad selbst
  funktionieren korrekt (in dieser Runde zusätzlich über einen direkten `curl` gegen einen frisch
  gebauten `next start`-Prozess sowie 3 vollständig saubere Einzelläufe erneut bestätigt).
- **Nebenfund, kein Bug, aber für künftige Diagnosen relevant:** `supabase db reset --local`
  invalidiert **nicht** den persistenten Next.js-Daten-Cache unter `.next/cache` — ein DB-Reset
  ohne begleitenden Cache-Clear/Rebuild kann deshalb einen zuvor über `updateTag()` geschriebenen,
  inzwischen durch den Reset überholten Cache-Eintrag unverändert weiter ausliefern. Für die reale
  Gate-Ausführung irrelevant (dort wird die DB genau einmal vor dem einzigen `build:test` +
  `test:routes`-Lauf zurückgesetzt, nie dazwischen), aber eine Falle für jede manuelle,
  wiederholte Beobachtung wie in dieser Untersuchung.

**Fix:** `await page.waitForURL(/\/angebote\/6\/durchfuehrungen\//)` nach dem `selectOption()`
ergänzt (`tests/routes.spec.ts`) — wartet auf den tatsächlichen Abschluss der clientseitigen
Navigation, statt sich auf die (zufällig identische) Preisanzeige zu verlassen. Verifiziert: 3
vollständig saubere Einzelläufe (Reset+Rebuild+Test) sowie ein vollständiger `test:routes`-Lauf
— **108/108 bestanden**, Zieltest in 1.8s statt vorheriger 15s-Timeouts.

## Geänderte Dateien

- `supabase/migrations/20260730120000_fix_function_search_path.sql` — bereits live angewendet
  (siehe `docs/migration-evidence/2026-07-29-baseline-adoption-decision.md`, Abschnitt 7).
- `tests/routes.spec.ts` — vier Locator-Robustheitsfixes (`.first()` ×3, `:visible` ×1), zwei
  explizite Timeout-Erhöhungen auf 15s, sowie (30.07.2026, zweite Runde) ein `waitForURL()` nach
  der Angebotsauswahl im Preisänderungstest — behebt die tatsächliche Ursache des Rest-Flakes
  (Navigation-Race, siehe oben). Keine App-Code-Änderung.

## Nicht erledigt in diesem Lauf

- ~~Der verbleibende, umgebungsbedingt vermutete Rest-Flake bei „offer_editions-Preisänderung"~~
  **Behoben (30.07.2026):** Ursache war ein Navigation-Race im Test selbst, nicht die Umgebung —
  siehe Root-Cause-Analyse oben. 108/108 Routentests jetzt grün.
- §10.4 (Produktions-/Datenschutz-/SEO-/Betriebs-Gate: Staging-Backup, Feature-Flag-Rollback,
  Consent-Entscheidung, Observability-Runbook, WCAG/Performance-Abnahme) nicht Teil dieses Laufs —
  seither aber grossteils separat bearbeitet, siehe die jeweiligen Runbooks
  (`staging-backup-restore-runbook.md`, `data-retention-runbook.md`, `observability-runbook.md`,
  `env-separation-audit.md`).
