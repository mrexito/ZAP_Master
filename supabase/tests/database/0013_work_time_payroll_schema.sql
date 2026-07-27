-- Arbeitszeiten-/Lohn-Schema (Schritt 10c, Migration 20260721091344_work_time_payroll_schema.sql).
-- Prueft: work_entries-CHECKs (Dauer, Quellen-Exklusivitaet, Pflichtquelle je Taetigkeitstyp,
-- Duplikat-UNIQUE), den Statusuebergangs-Trigger, die EXCLUDE-Constraint auf
-- teacher_rate_agreements, UNIQUE-Constraints auf payroll_periods/payroll_snapshot_lines und
-- RLS/Grants.

begin;

select plan(15);

with fixture_teacher as (
    insert into auth.users (id) values (gen_random_uuid())
    returning id
)
select set_config('pgtap.teacher_id', (select id::text from fixture_teacher), true);

with fixture_offer as (
    select id from public.offers where audience_id = '6' and kurstyp = 'intensivkurs'
), fixture_edition as (
    insert into public.offer_editions
        (offer_id, school_year, public_title, tagline, description, regular_price_rappen, status)
    select id, '2029/30', 'pgTAP Payroll Test', 'Tagline', 'Beschreibung', 100000, 'draft'
      from fixture_offer
    returning id
), fixture_kurs as (
    insert into public.intensivwoche_kurse (
        name, fach, beschreibung, start_datum, end_datum, uhrzeit, ort, preis, max_teilnehmer, lehrer, ist_aktiv
    ) values (
        'pgTAP Testkurs Payroll', 'mathematik', 'Testbeschreibung', '2029-04-02', '2029-04-06',
        '09:00-12:00', 'Zürich HB', 1195.00, 10, 'Test Lehrer', false
    )
    returning id
)
select set_config('pgtap.edition_id', (select id::text from fixture_edition), true),
       set_config('pgtap.kurs_id', (select id::text from fixture_kurs), true);

select lives_ok(
    format($$insert into public.course_sessions (id, edition_id) values (%L::bigint, %L::uuid)$$,
        current_setting('pgtap.kurs_id'), current_setting('pgtap.edition_id')),
    'course_sessions-Fixture fuer Payroll-Test angelegt'
);

-- 1) work_entries: Dauer muss positiv sein.
select throws_ok(
    format($$insert into public.work_entries (teacher_id, activity_type, work_date, duration_minutes)
        values (%L::uuid, 'administration', '2029-04-02', 0)$$,
        current_setting('pgtap.teacher_id')),
    '23514'::char(5), NULL,
    'duration_minutes = 0 wird abgelehnt'
);

-- 2) course_teaching ohne session_id wird abgelehnt.
select throws_ok(
    format($$insert into public.work_entries (teacher_id, activity_type, work_date, duration_minutes)
        values (%L::uuid, 'course_teaching', '2029-04-02', 60)$$,
        current_setting('pgtap.teacher_id')),
    '23514'::char(5), NULL,
    'course_teaching ohne session_id wird abgelehnt'
);

-- 3) session_id UND submission_id gleichzeitig gesetzt wird abgelehnt.
select throws_ok(
    format($$insert into public.work_entries (teacher_id, activity_type, work_date, duration_minutes, session_id, submission_id)
        values (%L::uuid, 'course_teaching', '2029-04-02', 60, %L::bigint, gen_random_uuid())$$,
        current_setting('pgtap.teacher_id'), current_setting('pgtap.kurs_id')),
    '23514'::char(5), NULL,
    'session_id und submission_id gleichzeitig gesetzt wird abgelehnt'
);

-- 4) gueltiger Eintrag gelingt.
select lives_ok(
    format($$insert into public.work_entries (teacher_id, activity_type, work_date, duration_minutes, session_id)
        values (%L::uuid, 'course_teaching', '2029-04-02', 180, %L::bigint)$$,
        current_setting('pgtap.teacher_id'), current_setting('pgtap.kurs_id')),
    'gueltiger course_teaching-Eintrag mit session_id wird angelegt'
);

-- 5) doppelter Eintrag derselben Lehrperson/Session/Tag wird abgelehnt.
select throws_ok(
    format($$insert into public.work_entries (teacher_id, activity_type, work_date, duration_minutes, session_id)
        values (%L::uuid, 'course_teaching', '2029-04-02', 60, %L::bigint)$$,
        current_setting('pgtap.teacher_id'), current_setting('pgtap.kurs_id')),
    '23505'::char(5), NULL,
    'doppelter Eintrag (teacher_id, session_id, work_date) wird abgelehnt'
);

with fixture_entry as (
    select id from public.work_entries
     where teacher_id = current_setting('pgtap.teacher_id')::uuid
       and session_id = current_setting('pgtap.kurs_id')::bigint
)
select set_config('pgtap.entry_id', (select id::text from fixture_entry), true);

-- 6) Statusuebergang: draft -> submitted erlaubt, draft -> approved (Sprung) verboten.
select lives_ok(
    format($$update public.work_entries set status = 'submitted' where id = %L::uuid$$,
        current_setting('pgtap.entry_id')),
    'draft -> submitted ist ein gueltiger Uebergang'
);

select throws_ok(
    format($$update public.work_entries set status = 'draft' where id = %L::uuid$$,
        current_setting('pgtap.entry_id')),
    'invalid_work_entry_status_transition',
    'submitted -> draft (kein Zurueckweisen) ist kein gueltiger Uebergang'
);

select lives_ok(
    format($$update public.work_entries set status = 'approved' where id = %L::uuid$$,
        current_setting('pgtap.entry_id')),
    'submitted -> approved ist ein gueltiger Uebergang'
);

-- 7) teacher_rate_agreements: EXCLUDE verhindert ueberlappende Gueltigkeit, erlaubt nicht-
--    ueberlappende Nachfolgevereinbarung.
select lives_ok(
    format($$insert into public.teacher_rate_agreements (teacher_id, hourly_rate_rappen, valid_from, valid_until, created_by)
        values (%L::uuid, 8000, '2029-01-01', '2029-06-30', %L::uuid)$$,
        current_setting('pgtap.teacher_id'), current_setting('pgtap.teacher_id')),
    'erste Lohnvereinbarung (Jan-Jun 2029) wird angelegt'
);

select throws_ok(
    format($$insert into public.teacher_rate_agreements (teacher_id, hourly_rate_rappen, valid_from, created_by)
        values (%L::uuid, 8500, '2029-05-01', %L::uuid)$$,
        current_setting('pgtap.teacher_id'), current_setting('pgtap.teacher_id')),
    '23P01'::char(5), NULL,
    'ueberlappende Lohnvereinbarung (ab Mai, waehrend Jan-Jun laeuft) wird abgelehnt'
);

select lives_ok(
    format($$insert into public.teacher_rate_agreements (teacher_id, hourly_rate_rappen, valid_from, created_by)
        values (%L::uuid, 8500, '2029-07-01', %L::uuid)$$,
        current_setting('pgtap.teacher_id'), current_setting('pgtap.teacher_id')),
    'direkt anschliessende, nicht ueberlappende Nachfolgevereinbarung (ab Juli) wird angelegt'
);

-- 8) payroll_periods: Eindeutigkeit auf (year, month).
select lives_ok(
    $$insert into public.payroll_periods (year, month) values (2029, 4)$$,
    'erste payroll_periods-Zeile fuer 2029-04 wird angelegt'
);

select throws_ok(
    $$insert into public.payroll_periods (year, month) values (2029, 4)$$,
    '23505'::char(5), NULL,
    'doppelte payroll_periods-Zeile fuer denselben Monat wird abgelehnt'
);

-- 9) RLS/Grants: anon hat auf keiner der sechs Tabellen irgendeinen Zugriff.
select ok(
    not exists (
        select 1
          from unnest(array[
            'teacher_assignments', 'work_entries', 'teacher_rate_agreements',
            'payroll_periods', 'payroll_snapshots', 'payroll_snapshot_lines'
          ]) tbl,
               unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) priv
         where has_table_privilege('anon', 'public.' || tbl, priv)
    ),
    'anon hat auf keiner der sechs Arbeitszeit-/Lohn-Tabellen irgendeinen Zugriff'
);

select * from finish();

rollback;
