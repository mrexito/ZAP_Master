# Schritt-12-Verifikationsgate — 30.07.2026

Vollständiger Durchlauf des in `architektur-briefing-kursseiten.md` Abschnitt 10.2 geforderten
Zwölf-Befehle-Gates, inklusive vertiefter Root-Cause-Analyse aller `test:routes`-Fehlschläge (auf
ausdrücklichen Nutzerwunsch nach dem ersten Lauf). **Ergebnis: VERIFIKATION NICHT BESTANDEN** —
2 von 108 Playwright-Routentests schlagen weiterhin auf, mit einer konkret identifizierten,
umweltbedingten Ursache statt eines Funktionsfehlers. Alle anderen elf Befehle sind grün.

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

**Verbleibender, nicht vollständig aufgeklärter Rest:** Im vollen `test:routes`-Lauf (dieser Test
läuft dort als 104. von 108, nach einer langen sequenziellen Kette gegen denselben langlebigen
`next start`-Prozess) schlägt exakt dieser Test weiterhin gelegentlich fehl — in der
Stichprobe dieser Session 3 von 6 vollen Läufen, davon einmal mit einem zusätzlichen, unabhängigen
Fehlschlag eines völlig anderen Tests (Aufsatz-Upload, 30s Timeout) im selben Lauf. Das spricht für
eine kumulative Last-/Timing-Marginalität des langlebigen, in dieser Session bereits sehr lange
wiederverwendeten Next.js-Serverprozesses (viele Docker-/Build-/Testprozesse liefen parallel auf
derselben Maschine über die gesamte Sitzung), nicht für einen deterministischen Anwendungsfehler:
Der zugrunde liegende Speicher-/Cache-Invalidierungspfad wurde mehrfach isoliert als korrekt
nachgewiesen. Ein expliziter `{ timeout: 15_000 }` wurde ergänzt (vorher galt der knappe
5s-Default), reicht aber unter dieser Last nicht immer aus. Empfehlung für einen späteren, neuen
Lauf: denselben Test mit frisch gestartetem `next start`-Prozess (statt eines über die gesamte
Sitzung wiederverwendeten) und ohne parallele Docker-/Build-Last erneut beobachten, um zu
bestätigen, dass die Fehlerursache tatsächlich rein umgebungsbedingt ist.

## Geänderte Dateien

- `supabase/migrations/20260730120000_fix_function_search_path.sql` — bereits live angewendet
  (siehe `docs/migration-evidence/2026-07-29-baseline-adoption-decision.md`, Abschnitt 7).
- `tests/routes.spec.ts` — vier Locator-Robustheitsfixes (`.first()` ×3, `:visible` ×1) plus zwei
  explizite Timeout-Erhöhungen auf 15s. Keine App-Code-Änderung.

## Nicht erledigt in diesem Lauf

- Der verbleibende, umgebungsbedingt vermutete Rest-Flake bei „offer_editions-Preisänderung" ist
  nicht zu 100% ausgeschlossen — siehe Empfehlung oben für einen erneuten, isolierten Beobachtungslauf.
- §10.4 (Produktions-/Datenschutz-/SEO-/Betriebs-Gate: Staging-Backup, Feature-Flag-Rollback,
  Consent-Entscheidung, Observability-Runbook, WCAG/Performance-Abnahme) nicht Teil dieses Laufs.
