# ZAP v2 — Zürcher Aufnahmeprüfung Lernplattform

Eine Lernplattform zur Vorbereitung auf die Zürcher Aufnahmeprüfung (ZAP), entwickelt als Masterthesis an der Berner Fachhochschule (BFH).

---

## Inhaltsverzeichnis

1. [Was ist ZAP v2?](#was-ist-zap-v2)
2. [Features](#features)
3. [Tech Stack](#tech-stack)
4. [Voraussetzungen](#voraussetzungen)
5. [Schritt-für-Schritt Installation](#schritt-für-schritt-installation)
   - [Schritt 1: Node.js installieren](#schritt-1-nodejs-installieren)
   - [Schritt 2: Projekt herunterladen](#schritt-2-projekt-herunterladen)
   - [Schritt 3: Supabase einrichten](#schritt-3-supabase-einrichten)
   - [Schritt 4: Umgebungsvariablen konfigurieren](#schritt-4-umgebungsvariablen-konfigurieren)
   - [Schritt 5: Datenbank einrichten](#schritt-5-datenbank-einrichten)
   - [Schritt 6: KI-Funktion einrichten (optional)](#schritt-6-ki-funktion-einrichten-optional)
   - [Schritt 7: App starten](#schritt-7-app-starten)
6. [Projektstruktur](#projektstruktur)
7. [Häufige Probleme & Lösungen](#häufige-probleme--lösungen)
8. [Entwicklung](#entwicklung)
9. [Lizenz & Kontakt](#lizenz--kontakt)

---

## Was ist ZAP v2?

ZAP v2 ist eine vollständige Webanwendung, die Schülerinnen und Schüler bei der Vorbereitung auf die Zürcher Aufnahmeprüfung unterstützt. Die Plattform bietet interaktive Übungen, vergangene Prüfungsaufgaben, Lernmaterialien und ein Mentoring-System.

Dies ist die Neuentwicklung (v2) der ursprünglichen ZAP-Plattform — vollständig neu implementiert mit modernen Web-Technologien.

---

## Features

| Feature | Beschreibung |
|---|---|
| **Prüfungstrainer** | Interaktive Übungen für Mathematik und Deutsch |
| **Simulationsprüfung** | Simuliert eine echte ZAP-Prüfung mit Rückmeldung zu den Antworten |
| **Lernmaterialien** | Strukturierte Lerninhalte, hochgeladen von Trainer:innen |
| **Aufsätze** | Aufsatzübungen mit KI-gestützter Korrektur |
| **Intensivkurse** | Kursverwaltung und Anmeldung für Vorbereitungskurse |
| **Mentoring (Götti-System)** | Peer-to-Peer Lernunterstützung mit Marktplatz, Anfragen und Material-Hub |
| **Admin-Bereich** | Benutzerverwaltung, Kursverwaltung, Statistiken |
| **Dark Mode** | Unterstützung für helles und dunkles Design |

---

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router) mit React 19 und TypeScript
- **Datenbank & Auth**: [Supabase](https://supabase.com/) (PostgreSQL + Authentifizierung)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/)
- **Authentifizierung**: NextAuth.js v5 mit Supabase-Integration
- **Formularvalidierung**: React Hook Form + Zod
- **Mathematik**: KaTeX für mathematische Formeln
- **KI**: Anthropic Claude API für Aufsatzkorrekturen
- **State Management**: Zustand

---

## Voraussetzungen

Bevor du anfängst, stelle sicher, dass folgendes auf deinem Computer installiert ist:

| Was | Warum | Woher |
|---|---|---|
| **Node.js 20 oder neuer** | Führt die App aus | [nodejs.org](https://nodejs.org/de) — "LTS" Version herunterladen |
| **Git** | Zum Klonen des Repositories | [git-scm.com](https://git-scm.com/downloads) |
| Ein **Supabase-Konto** | Datenbank und Authentifizierung | [supabase.com](https://supabase.com) — kostenloser Account |

> **Bin ich auf dem richtigen Weg?**
> Öffne ein Terminal (auf Mac: Cmd+Leertaste → "Terminal") und tippe:
> ```
> node --version
> ```
> Du solltest etwas wie `v20.x.x` oder höher sehen. Wenn nicht, installiere Node.js über den Link oben.

---

## Schritt-für-Schritt Installation

### Schritt 1: Node.js installieren

1. Gehe auf [nodejs.org](https://nodejs.org/de)
2. Klicke auf den grossen Download-Button mit der Aufschrift **"LTS"** (Long Term Support)
3. Führe die heruntergeladene Datei aus und folge dem Installationsassistenten
4. Öffne ein neues Terminal-Fenster und prüfe die Installation:
   ```bash
   node --version
   npm --version
   ```
   Beide Befehle sollten eine Versionsnummer ausgeben.

---

### Schritt 2: Projekt herunterladen

Öffne ein Terminal und führe diese Befehle aus:

```bash
# Projekt klonen (herunterladen)
git clone https://github.com/RobinMuehBFH/zap-v2.git

# In den Projektordner wechseln
cd zap-v2

# Abhängigkeiten installieren (alle benötigten Bibliotheken)
npm install
```

> **Was passiert hier?**
> - `git clone` lädt das gesamte Projekt von GitHub herunter
> - `npm install` liest die Datei `package.json` und installiert alle benötigten Bibliotheken automatisch in den Ordner `node_modules/`
> - Dies kann 1–3 Minuten dauern

---

### Schritt 3: Supabase einrichten

Supabase ist die Datenbank, in der alle Benutzerdaten, Kurse und Lernmaterialien gespeichert werden.

#### 3a. Supabase-Konto erstellen

1. Gehe auf [supabase.com](https://supabase.com)
2. Klicke auf **"Start your project"**
3. Registriere dich (kostenlos) mit deiner E-Mail-Adresse oder über GitHub

#### 3b. Neues Supabase-Projekt anlegen

1. Klicke auf **"New Project"**
2. Wähle deine Organisation (oder erstelle eine neue)
3. Fülle die Felder aus:
   - **Name**: `zap-v2` (oder ein beliebiger Name)
   - **Database Password**: Vergib ein sicheres Passwort — **merke es dir!**
   - **Region**: Wähle `Central EU (Frankfurt)` für geringe Latenz
4. Klicke auf **"Create new project"**
5. Warte ca. 1–2 Minuten, bis das Projekt bereit ist

#### 3c. API-Schlüssel notieren

Du brauchst drei Werte für die Konfiguration. Diese findest du in Supabase unter:
**Project Settings → API**

| Was du brauchst | Wo es steht | Beispiel |
|---|---|---|
| **Project URL** | "Project URL" | `https://abcdefghij.supabase.co` |
| **Anon Key** | "Project API keys → anon public" | `eyJhbGc...` (langer Text) |
| **Service Role Key** | "Project API keys → service_role" | `eyJhbGc...` (anderer langer Text) |

> **Achtung**: Den `service_role` Key **niemals** öffentlich teilen! Er hat vollen Datenbankzugriff.

---

### Schritt 4: Umgebungsvariablen konfigurieren

Umgebungsvariablen sind Konfigurationswerte, die der App sagen, wo die Datenbank ist und wie sie sich anmelden soll.

#### 4a. Konfigurationsdatei erstellen

Im Terminal, im Projektordner:

```bash
# Vorlage kopieren
cp .env.example .env.local
```

#### 4b. Werte eintragen

Öffne die neu erstellte Datei `.env.local` mit einem Texteditor (z.B. VS Code, Notepad, TextEdit) und ersetze die Platzhalter mit deinen echten Werten:

```env
# Supabase — aus Schritt 3c
NEXT_PUBLIC_SUPABASE_URL=https://DEIN-PROJEKT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=dein-anon-key
SUPABASE_SERVICE_ROLE_KEY=dein-service-role-key

# Auth Secret — ein langer, zufälliger Text (mindestens 32 Zeichen)
AUTH_SECRET=ein-langer-geheimer-zufalls-text-mindestens-32-zeichen

# Anthropic (nur wenn du die KI-Aufsatzkorrektur nutzen möchtest)
ANTHROPIC_API_KEY=dein-anthropic-api-key
```

#### 4c. Auth Secret generieren

Das `AUTH_SECRET` muss ein zufälliger, sicherer Text sein. Du kannst es so generieren:

```bash
# Im Terminal eingeben:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Den ausgegebenen Text kopieren und als `AUTH_SECRET` einsetzen.

---

### Schritt 5: Datenbank einrichten

Die Datenbank braucht Tabellen und Sicherheitsregeln. Der aktuell eingecheckte historische
Migrationsordner ist jedoch **nicht** zum Aufbau einer neuen Datenbank oder zum Ausrollen auf ein
bestehendes Supabase-Projekt freigegeben.

#### 5a. Aktueller Migrationsstatus

Die zwölf Dateien unter `supabase/migrations/` dokumentieren historische Teilstände. Sie bilden
weder die tatsächliche Live-Migrationshistorie noch eine auf einer leeren Datenbank ausführbare
Kette ab. Unter anderem existieren zwei Versionen `002`, mehrere Basistabellen fehlen und
`006_seed_test_data.sql` enthält lokale Auth-/Testdaten.

Deshalb gilt bis zum abgeschlossenen Baseline-Gate:

- historische Dateien nicht manuell im SQL Editor ausführen;
- kein `supabase db push`, kein Remote-Reset und kein `migration repair` ohne die dafür
  dokumentierte separate Freigabe;
- keine Geschäfts-, Auth- oder Testdaten aus historischen Dateien übernehmen;
- den verbindlichen Ablauf in `step0Baseline.revision2.md` und
  `design-reference/datenmodell-review.md` verwenden.

Der geplante neue lokale Strang beginnt mit einer geprüften, datenfreien Baseline des aktuellen
Live-Schemas. Danach folgen ausschließlich additive Migrationen mit UTC-Zeitstempelpräfix. Erst
wenn lokaler Reset, Lint, pgTAP und Schema-Diff erfolgreich sind, darf ein gesondert freigegebener
Staging- oder Live-Rollout geplant werden.

#### 5b. Authentifizierung konfigurieren

In Supabase unter **"Authentication → URL Configuration"**:

- **Site URL**: `http://localhost:3000`
- **Redirect URLs**: `http://localhost:3000/**`

Speichern mit **"Save"**.

---

### Schritt 6: KI-Funktion einrichten (optional)

Die KI-gestützte Aufsatzkorrektur verwendet die Anthropic Claude API. Diese Funktion ist optional — die App läuft auch ohne sie, nur die Aufsatzkorrektur wird nicht verfügbar sein.

1. Erstelle ein Konto auf [anthropic.com](https://www.anthropic.com)
2. Gehe auf [console.anthropic.com](https://console.anthropic.com)
3. Erstelle einen neuen API-Schlüssel unter **"API Keys"**
4. Kopiere den Schlüssel in die `.env.local`-Datei als `ANTHROPIC_API_KEY`

> **Kosten**: Die Anthropic API ist kostenpflichtig (pay-per-use). Für Entwicklung und Tests entstehen in der Regel sehr geringe Kosten (wenige Cents bis ein paar Franken).

---

### Schritt 7: App starten

```bash
# Entwicklungsserver starten
npm run dev
```

Öffne dann im Browser: **[http://localhost:3000](http://localhost:3000)**

Du solltest die ZAP v2 Startseite sehen.

> **Der Server läuft im Hintergrund.** Um ihn zu stoppen, drücke im Terminal `Ctrl+C`.

---

## Projektstruktur

```
zap-v2/
│
├── app/                        # Alle Seiten und Routen der App
│   ├── (auth)/                 # Login- und Registrierungsseiten
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/            # Alle Seiten nach dem Login
│   │   ├── dashboard/          # Dashboard und Admin-Bereich
│   │   │   ├── admin/          # Benutzerverwaltung, Einstellungen
│   │   │   ├── aufsaetze/      # Aufsatzverwaltung für Trainer
│   │   │   ├── kurse/          # Kursverwaltung
│   │   │   ├── materialien/    # Lernmaterialien verwalten
│   │   │   └── mentorship/     # Mentoring-System verwalten
│   │   ├── aufsaetze/          # Aufsatzeingabe für Schüler
│   │   ├── intensivkurse/      # Intensivkurs-Übersicht
│   │   ├── materialien/        # Lernmaterialien ansehen
│   │   ├── profil/             # Benutzerprofil
│   │   ├── pruefung/           # Prüfungssimulation (alte Prüfungen)
│   │   ├── trainer/            # Trainer-spezifische Ansichten
│   │   └── uebungen/           # Interaktive Übungen (Mathe/Deutsch)
│   ├── (public)/               # Öffentliche Seiten (ohne Login)
│   │   └── kurse/              # Kursübersicht öffentlich
│   ├── api/                    # Server-seitige API-Endpunkte
│   │   ├── auth/               # Authentifizierungs-API
│   │   └── user/               # Benutzer-API
│   └── components/             # Wiederverwendbare UI-Komponenten
│       ├── exam/               # Prüfungs-Komponenten
│       ├── layout/             # Navigation, Sidebar, Navbar
│       ├── ui/                 # Basis-UI (Buttons, Cards, etc.)
│       └── zap/                # ZAP-spezifische Komponenten
│
├── components/                 # Übergreifende Komponenten
│   ├── providers/              # React Context Providers
│   └── ui/                     # shadcn/ui Komponenten
│
├── context/                    # React Contexts
├── lib/                        # Hilfsfunktionen und Konfiguration
│   ├── ai/                     # Anthropic KI-Integration
│   ├── auth/                   # Authentifizierungskonfiguration
│   ├── supabase/               # Supabase Client und Typen
│   └── utils/                  # Allgemeine Hilfsfunktionen
│
├── public/                     # Statische Dateien (Bilder, Symbole)
├── scripts/                    # Hilfsskripte (z.B. Daten-Import)
├── store/                      # Globaler App-Zustand (Zustand)
├── supabase/                   # Datenbankmigrationen
│   └── migrations/             # SQL-Dateien für DB-Setup
├── types/                      # TypeScript-Typdefinitionen
├── docs/                       # Dokumentation und Analysen
│   ├── analysis/               # Entwicklungsnotizen und Analysen
│   └── architecture_plans/     # Architekturentscheidungen
│
├── .env.example                # Vorlage für Umgebungsvariablen
├── .env.local                  # Deine lokalen Einstellungen (NICHT in Git!)
├── next.config.ts              # Next.js Konfiguration
├── package.json                # Projektabhängigkeiten
└── tsconfig.json               # TypeScript-Konfiguration
```

---

## Häufige Probleme & Lösungen

### "Module not found" oder ähnliche Fehler beim Start

**Ursache**: `npm install` wurde nicht ausgeführt oder ist fehlgeschlagen.

**Lösung**:
```bash
# node_modules löschen und neu installieren
rm -rf node_modules
npm install
```

---

### Die App startet, zeigt aber "Supabase connection error" oder weisser Bildschirm

**Ursache**: Die Umgebungsvariablen in `.env.local` sind falsch oder fehlen.

**Lösung**:
1. Überprüfe, ob die Datei `.env.local` im Projektordner existiert (nicht `.env.example`)
2. Überprüfe, ob `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY` korrekt eingetragen sind
3. Starte den Entwicklungsserver neu: `Ctrl+C` im Terminal, dann `npm run dev`

---

### Login funktioniert nicht / Weiterleitung auf Login-Seite

**Ursache**: Supabase Authentication ist nicht konfiguriert oder `AUTH_SECRET` fehlt.

**Lösung**:
1. Prüfe in Supabase unter **Authentication → URL Configuration**, ob `http://localhost:3000` als Site URL eingetragen ist
2. Stelle sicher, dass `AUTH_SECRET` in `.env.local` gesetzt ist (mindestens 32 Zeichen lang)

---

### SQL-Fehler beim Ausführen der Migrations

**Ursache**: Der historische Ordner `supabase/migrations/` ist derzeit keine reproduzierbare,
freigegebene Migrationskette. Ein Fehler darf nicht durch Ausprobieren einer anderen Reihenfolge
oder durch Zurücksetzen eines Supabase-Projekts umgangen werden.

**Lösung**: Ausführung abbrechen und den Baseline-Status anhand von
`step0Baseline.revision2.md` prüfen. Remote-Datenbanken niemals zur Fehlerbehebung zurücksetzen.
Lokale Resets sind erst nach Aufbau des neuen Baseline-Strangs und ausschließlich mit explizitem
`--local` zulässig.

---

### Port 3000 ist bereits belegt

**Ursache**: Ein anderes Programm läuft bereits auf Port 3000.

**Lösung**:
```bash
# App auf anderem Port starten
npm run dev -- --port 3001
```
Dann im Browser `http://localhost:3001` aufrufen.

---

### "ANTHROPIC_API_KEY nicht gesetzt" Fehler

**Ursache**: Der Anthropic API-Schlüssel fehlt in `.env.local`.

**Lösung**: Entweder den Schlüssel in `.env.local` eintragen (siehe Schritt 6), oder die Aufsatzkorrektur-Funktion nicht verwenden. Alle anderen Funktionen der App laufen ohne diesen Schlüssel.

---

## Entwicklung

### Verfügbare Befehle

```bash
npm run dev      # Entwicklungsserver starten (mit Hot-Reload)
npm run build    # Produktions-Build erstellen
npm run start    # Produktionsserver starten (nach build)
npm run lint     # Code-Qualität prüfen
```

### Commit-Konvention

Das Projekt verwendet [Conventional Commits](https://conventionalcommits.org/):

```
feat: Neue Funktion hinzugefügt
fix: Fehler behoben
docs: Dokumentation aktualisiert
refactor: Code umstrukturiert (kein neues Feature, kein Bugfix)
```

### Branch-Strategie

- `main` — Stabiler, getesteter Code
- `feature/*` — Neue Features

---

## Kontakt

**Autor**: Robin Mühlemann  
**Hochschule**: Berner Fachhochschule (BFH)  
**Studiengang**: Master Wirtschaftsinformatik 
**Jahr**: 2025/2026
