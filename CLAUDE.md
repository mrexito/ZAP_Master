# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ZAP v2 — a learning platform for Zürcher Aufnahmeprüfung (ZAP) exam prep, built as a BFH master's
thesis. Next.js 16 (App Router) + React 19 + TypeScript, Supabase (Postgres + Auth), NextAuth v5,
Tailwind CSS 4, Zod, Anthropic Claude API for essay correction.

## Commands

```bash
npm run dev              # start dev server
npm run build             # production build
npm run build:analyze     # build with bundle analyzer (ANALYZE=true)
npm run typecheck         # tsc --noEmit
npm run lint               # eslint
```

There is no JS/TS test runner configured (no `test` script, no vitest/jest/playwright). Database
correctness is verified with pgTAP against a local Supabase instance instead — see "Database
workflow" below.

## Database workflow — read this before touching `supabase/`

The historical migration files `001`–`014` under `supabase/migrations/` are **not** a reproducible
or approved migration chain (duplicate `002` versions, missing base tables, one file with local
auth/test data). They do not reflect the real live migration history. **Do not run them manually,
do not use them to bootstrap a new database, and do not `supabase db push` them.**

The canonical process is documented in `step0Baseline.revision2.md` and
`design-reference/datenmodell-review.md`:
- A reviewed, data-free schema dump of the live project (`ybzdibifgqjsbohtztmy` / "ZAP_25") is the
  actual local baseline (`supabase/migrations/20260719133741_live_schema_baseline.sql`).
- Every migration after that baseline is additive, timestamp-prefixed
  (`YYYYMMDDHHMMSS_description.sql`), and reviewed individually. Already-applied files are never
  renamed or edited.
- Local verification loop: `supabase db reset --local --no-seed` → `supabase db lint --local
  --level error --fail-on error` → `supabase test db supabase/tests/database --local`. pgTAP tests
  live under `supabase/tests/database/`, one file per feature area; each wraps in `begin;
  ... rollback;`.
- Only a pinned, hash-verified Supabase CLI (`scripts/approved-supabase-cli.ps1`) and pinned
  psql/pg_dump (`scripts/approved-postgres-tools.ps1`) are used against the live project — never
  ad hoc installs.
- Any real write against the live database (`db push`, `migration repair`) needs a separate,
  explicit approval and is run by the human operator directly in their own terminal — the DB
  password/service keys are never typed into or handled by the assistant/conversation. This
  project has been burned by a secret leaking into chat before; treat that boundary as firm.
- The Supabase MCP connector (`mcp__claude_ai_Supabase__*` tools) gives direct **read-only**
  access to the live project's schema, table stats, and advisors without needing any password —
  prefer it for live inspection. Note `list_tables`'s `rows` field is Postgres's estimated
  row-count statistic, not an exact count; use `execute_sql` with `COUNT(*)` when precision matters.

## Supabase client architecture (`lib/supabase/`)

Three distinct client factories, each for a different privilege level — using the wrong one is a
common source of bugs (silently empty results or RLS bypass):

- `createServerSupabaseClient()` — anon key, cookie-based. For public reads only.
  `auth.uid()` is `NULL` without a token.
- `createAuthenticatedSupabaseClient(supabaseAccessToken)` — anon key + `Authorization: Bearer`
  header using the Supabase access token carried in the NextAuth session
  (`session.supabaseAccessToken`). This is the correct client for any user-scoped request that
  needs RLS to see `auth.uid()`.
- `createAdminSupabaseClient()` — service role key, bypasses RLS entirely. Server-only, for admin
  operations (user creation, batch jobs, storage cleanup). Never expose to a client component.

## Auth model

NextAuth v5 Credentials provider authenticates against Supabase Auth
(`signInWithPassword`), but role/profile data comes from the `profiles` table, not
`auth.users` — `lib/auth/config.ts`'s `authorize()` fetches `role`/name from `profiles` after
Supabase login succeeds. Three roles: `user`, `lehrperson`, `admin` (`types/next-auth.d.ts`).

Route protection is two-layered, and both layers matter:
- `proxy.ts` (this project's Next.js middleware) redirects unauthenticated requests to `/login`
  for its `matcher` paths only (`/dashboard`, `/trainer`, `/uebungen`, `/pruefung`, `/profil`,
  `/login`, `/register`). It also force-relogins sessions missing `supabaseAccessToken`.
- Route groups under `app/(dashboard)/` don't add a URL segment, so pages like `/materialien`
  aren't covered by the proxy matcher above. `app/(dashboard)/layout.tsx` has its own
  `if (!session) redirect('/login')` guard as the actual protection for those routes.

Login always redirects to `/dashboard` regardless of role.

## Data model notes

- `types/database.ts` is the single canonical generated type source (regenerated from the live
  schema). There is no second `lib/supabase/database.types.ts` — don't recreate one.
- `book_intensivwoche_kurs()` (SECURITY DEFINER RPC) is the **only** allowed write path for
  `intensivwoche_anmeldungen` — direct inserts are revoked at the grant level. It's atomic (locks
  the course row `FOR UPDATE`), enforces the family-capable duplicate check (course + parent email
  + child name), an `idempotency_key` short-circuit for retries, a persistent per-email rate limit,
  and snapshots price/currency immutably after insert. `app/(public)/kurse/actions.ts` calls only
  this RPC — never write to that table any other way.
- Storage buckets: `avatars`, `lernmaterialien` (active materials bucket), `student-essays`,
  `correction-rubrics` are all code-referenced. There is no `learning_materials` bucket — it was a
  pre-rename artifact, decommissioned; the `learning_materials` *table* is unrelated and active.

## App Router structure

Route groups: `(auth)` (login/register), `(dashboard)` (protected app), `(public)` (marketing +
`/kurse`). `app/components/ui/` holds shadcn-style primitives (no `components.json` yet — it's
part of a planned, not-yet-started shadcn CLI setup). `app/components/zap/` and
`app/components/layout/` hold project-specific composed components.

This repo is mid-migration from an older marketing/course-page implementation to a new one, driven
by the step-by-step plan referenced below. Step 0 (security/baseline gate) and Step 1 (inventory)
are complete as of 2026-07-20; see `step0Baseline.revision2.md` for the full record.

## Kursseiten- und Startseiten-Migration
Architektur-Vorgaben, Datenmodell, Komponentenschnitt, Routentabelle:
@design-reference/architektur-briefing-kursseiten.md
Aktueller Live-Datenbankstand und verbindliche DB-Entscheidungen:
@design-reference/datenmodell-review.md
Designkorrekturen und redaktionelle Publikationsgates:
@design-reference/design-review-todo.md
Verbindliche UI-Konventionen (Section-Rhythmus, Typografie-Skala, Card-Muster, Farbsystem) für
alle Marketing-/Kursseiten, vor jeder neuen Sektion/Komponente prüfen:
@design-reference/design-system.md
Referenz-Prototyp Buchungstabelle: @design-reference/SessionTable.jsx
Die Startseite in design-reference/Startseite.html ERSETZT die
bestehende Startseite vollständig, sie wird nicht ergänzt.

## Prinzipien (gelten sessionübergreifend, unabhängig vom aktuellen Schritt)
- Wiederkehrende UI-Elemente (Cards, Buttons, Badges, Tabellen, Nav) werden IMMER
  als zentrale Komponente unter app/components/ gebaut, nie pro Seite/Klassenstufe
  dupliziert oder kopiert.
- Vor dem Anlegen einer neuen Komponente: app/components/ durchsuchen, ob eine
  bestehende erweitert werden kann, statt eine neue mit ähnlichem Markup zu bauen.
- Unterschiede zwischen Klassenstufen werden ausschliesslich über Props/Daten
  gelöst, nie über Code-Verzweigungen, Copy-Paste oder seiten-spezifische Varianten.

## Ausführungsplan
Vollständiger Schritt-für-Schritt-Plan für diese Migration:
@design-reference/claude-code-ausfuehrungsplan.md
Nur den jeweils angeforderten Schritt ausführen, nicht vorgreifen.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
