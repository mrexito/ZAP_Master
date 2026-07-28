-- Admin-editierbare Ferienwochen (Migration 20260728090000_school_holiday_weeks_schema.sql,
-- 20260728091000_seed_school_holiday_weeks.sql). Prueft: die Seed-Migration ueberfuehrt die
-- vormals hart codierten Konstanten aus lib/kurse/fixed-school-schedule.ts 1:1 (Zero-Regression-
-- Nachweis), Schreiben verlangt is_admin() (gleiches Muster wie 0009_offer_editions_admin_writes),
-- Lesen ist oeffentlich, und UNIQUE/CHECK-Constraints sowie das UPSERT-Conflict-Target
-- funktionieren wie in der Admin-Maske (saveSchoolHolidayWeeksAction) vorausgesetzt.
--
-- Hinweis zur Teststrategie (konsistent mit 0009): pgTAP laeuft als Tabellenbesitzer und umgeht
-- RLS -- Admin-Gating wird deshalb ueber Policy-Existenz/-qual (pg_policies) geprueft, nicht ueber
-- eine echte Rollen-Anmeldung.

begin;

select plan(17);

-- 1) Seed-Migration: genau 12 Zeilen fuer school_year='2026/27' (7 intensiv, gruppenweise + 5
--    vorkurs, je einzelner Klassenstufe -- siehe Kommentar in der Seed-Migration).
select is(
    (select count(*)::int from public.school_holiday_weeks where school_year = '2026/27'),
    12,
    'Seed-Migration legt genau 12 Ferienwochen-Zeilen fuer 2026/27 an'
);

-- 2)-4) Stichproben gegen die entfernten TS-Konstanten (INTENSIVE_WEEKS_BY_GROUP,
--       MATURA_INTENSIVE_WEEKS) -- Zero-Regression-Nachweis fuer holiday_type='intensiv'.
select is(
    (select calendar_weeks from public.school_holiday_weeks
      where school_year = '2026/27' and schedule_group = 'langzeitgymi'
        and holiday_type = 'intensiv' and location = 'Zürich HB'),
    ARRAY[7, 8],
    'langzeitgymi/intensiv/Zürich HB entspricht dem vorherigen INTENSIVE_WEEKS_BY_GROUP-Wert'
);

select is(
    (select calendar_weeks from public.school_holiday_weeks
      where school_year = '2026/27' and schedule_group = 'matura'
        and holiday_type = 'intensiv' and location = 'Zürich HB'),
    ARRAY[6, 7],
    'matura/intensiv entspricht dem vorherigen MATURA_INTENSIVE_WEEKS-Wert'
);

select is(
    (select calendar_weeks from public.school_holiday_weeks
      where school_year = '2026/27' and schedule_group = 'bms'
        and holiday_type = 'intensiv' and location = 'Winterthur'),
    ARRAY[6, 7],
    'bms/intensiv/Winterthur besitzt jetzt eine eigene Zeile (vormals impliziter Code-Fallback auf langzeitgymi)'
);

-- 5)-9) holiday_type='vorkurs' ist pro einzelner Klassenstufe gepflegt (nicht mehr pro Gruppe):
--       4./5. Klasse und 1. Sek liegen im Fruehlingssemester (ein Kalenderjahr), 6. Klasse und
--       2./3. Sek laufen als Halbjahreskurs ueber den Jahreswechsel (zwei Kalenderjahre).
select is(
    (select calendar_weeks from public.school_holiday_weeks
      where school_year = '2026/27' and schedule_group = '4' and holiday_type = 'vorkurs' and location = 'ALL'),
    ARRAY[10, 11, 13, 14, 15, 16, 20, 21, 22, 23, 24, 25, 26],
    'Vorkurs 4. Klasse entspricht den fachlich bestätigten Wochen'
);

select is(
    (select calendar_weeks from public.school_holiday_weeks
      where school_year = '2026/27' and schedule_group = '5' and holiday_type = 'vorkurs' and location = 'ALL'),
    ARRAY[20, 21, 22, 23, 24, 25, 26, 27],
    'Vorkurs 5. Klasse entspricht den fachlich bestätigten Wochen'
);

select is(
    (select calendar_weeks from public.school_holiday_weeks
      where school_year = '2026/27' and schedule_group = '1-sek' and holiday_type = 'vorkurs' and location = 'ALL'),
    ARRAY[20, 21, 22, 23, 24, 25, 26, 27],
    'Vorkurs 1. Sek entspricht den fachlich bestätigten Wochen (identisch mit 5. Klasse)'
);

select is(
    (select calendar_weeks from public.school_holiday_weeks
      where school_year = '2026/27' and schedule_group = '6' and holiday_type = 'vorkurs' and location = 'ALL'),
    ARRAY[36, 37, 38, 39, 40, 43, 44, 45, 46, 47, 48, 49, 50, 1, 2, 3, 4, 5, 6],
    'Vorkurs 6. Klasse deckt Herbst (KW 36-50) und Winter/Fruehling des Folgejahres (KW 1-6) ab'
);

select is(
    (select calendar_weeks from public.school_holiday_weeks
      where school_year = '2026/27' and schedule_group = '2-3-sek' and holiday_type = 'vorkurs' and location = 'ALL'),
    ARRAY[36, 37, 38, 39, 40, 43, 44, 45, 46, 47, 48, 49, 50, 1, 2, 3, 4, 5, 6],
    'Vorkurs 2./3. Sek entspricht 6. Klasse (identische KW-Liste)'
);

-- 6) INSERT/UPDATE-Policies verlangen is_admin() (gleiches Muster wie offer_editions).
select ok(
    (select count(*)::int from pg_policies
      where schemaname = 'public' and tablename = 'school_holiday_weeks'
        and cmd in ('INSERT', 'UPDATE')
        and coalesce(qual, '') || coalesce(with_check, '') like '%is_admin%') = 2,
    'school_holiday_weeks INSERT- und UPDATE-Policy verlangen is_admin()'
);

-- 7) SELECT ist oeffentlich (anon + authenticated) -- die Wochen speisen die oeffentliche
--    Terminanzeige (WeekFilter/SessionTable), keine sensiblen Daten.
select ok(
    exists (
        select 1 from pg_policies
         where schemaname = 'public' and tablename = 'school_holiday_weeks' and cmd = 'SELECT'
           and 'anon' = any(roles) and 'authenticated' = any(roles)
    ),
    'school_holiday_weeks SELECT-Policy erlaubt anon und authenticated'
);

-- 8)-10) UPSERT-Verhalten wie in saveSchoolHolidayWeeksAction (onConflict:
--        'school_year,schedule_group,holiday_type,location').
select lives_ok(
    $$insert into public.school_holiday_weeks (school_year, schedule_group, holiday_type, location, calendar_weeks)
      values ('2099/00', 'matura', 'intensiv', 'Zürich HB', ARRAY[6, 7])$$,
    'erste Ferienwochen-Zeile fuer ein neues Schuljahr laesst sich anlegen'
);

select throws_ok(
    $$insert into public.school_holiday_weeks (school_year, schedule_group, holiday_type, location, calendar_weeks)
      values ('2099/00', 'matura', 'intensiv', 'Zürich HB', ARRAY[9, 10])$$,
    '23505'::char(5),
    NULL,
    'doppeltes (school_year, schedule_group, holiday_type, location) wird abgelehnt'
);

select lives_ok(
    $$insert into public.school_holiday_weeks (school_year, schedule_group, holiday_type, location, calendar_weeks)
      values ('2099/00', 'matura', 'intensiv', 'Zürich HB', ARRAY[16, 17])
      on conflict (school_year, schedule_group, holiday_type, location)
      do update set calendar_weeks = excluded.calendar_weeks$$,
    'UPSERT mit demselben Conflict-Target ueberschreibt calendar_weeks statt eine zweite Zeile anzulegen'
);

select is(
    (select calendar_weeks from public.school_holiday_weeks
      where school_year = '2099/00' and schedule_group = 'matura'
        and holiday_type = 'intensiv' and location = 'Zürich HB'),
    ARRAY[16, 17],
    'UPSERT hat calendar_weeks korrekt auf den neuen Wert aktualisiert'
);

-- 11)-12) CHECK-Constraints.
select throws_ok(
    $$insert into public.school_holiday_weeks (school_year, schedule_group, holiday_type, location, calendar_weeks)
      values ('2099/00', 'langzeitgymi', 'intensiv', 'Zürich HB', ARRAY[]::integer[])$$,
    '23514'::char(5),
    NULL,
    'ein leeres calendar_weeks-Array wird abgelehnt'
);

select throws_ok(
    $$insert into public.school_holiday_weeks (school_year, schedule_group, holiday_type, location, calendar_weeks)
      values ('2099/00', 'langzeitgymi', 'intensiv', 'Bern', ARRAY[6, 7])$$,
    '23514'::char(5),
    NULL,
    'ein nicht freigegebener Standort ausserhalb Zürich HB/Winterthur/ALL wird abgelehnt'
);

select * from finish();

rollback;
