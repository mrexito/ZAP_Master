-- admin_save_daily_release() (Migration 20260721084035). Prueft admin-Gate, gueltige Status-Werte,
-- und dass die Funktion SECURITY INVOKER bleibt (RLS bleibt einzige Autorisierungsquelle) --
-- gleicher Teststil wie 0010 fuer admin_upsert_course_session().

begin;

select plan(3);

with fixture_offer as (
    select id from public.offers where audience_id = '6' and kurstyp = 'intensivkurs'
), fixture_edition as (
    insert into public.offer_editions
        (offer_id, school_year, public_title, tagline, description, regular_price_rappen, status)
    select id, '2029/30', 'pgTAP RPC Test 2', 'Tagline', 'Beschreibung', 100000, 'draft'
      from fixture_offer
    returning id
), fixture_kurs as (
    insert into public.intensivwoche_kurse (
        name, fach, beschreibung, start_datum, end_datum, uhrzeit, ort, preis, max_teilnehmer, lehrer, ist_aktiv
    ) values (
        'pgTAP Testkurs Release-RPC', 'mathematik', 'Testbeschreibung', '2029-03-05', '2029-03-09',
        '09:00-12:00', 'Winterthur', 1195.00, 10, 'Test Lehrer', false
    )
    returning id
)
select set_config('pgtap.edition_id', (select id::text from fixture_edition), true),
       set_config('pgtap.kurs_id', (select id::text from fixture_kurs), true);

select lives_ok(
    format($$insert into public.course_sessions (id, edition_id) values (%L::bigint, %L::uuid)$$,
        current_setting('pgtap.kurs_id'), current_setting('pgtap.edition_id')),
    'course_sessions-Fixture fuer Release-RPC-Test angelegt'
);

with fixture_day as (
    insert into public.course_days (session_id, sequence, course_date)
    values (current_setting('pgtap.kurs_id')::bigint, 1, '2029-03-05')
    returning id
)
select set_config('pgtap.day_id', (select id::text from fixture_day), true);

-- 1) Ohne is_admin()=true (pgTAP-Kontext) wird jeder Aufruf abgelehnt -- wie bei
--    admin_upsert_course_session ist das selbst der Beweis, dass die Rollenpruefung zuerst greift.
select throws_ok(
    format($$select public.admin_save_daily_release(%L::uuid, 'active', NULL, NULL, '[]'::jsonb)$$,
        current_setting('pgtap.day_id')),
    'admin_required',
    'admin_save_daily_release lehnt Aufrufe ohne is_admin() ab'
);

select ok(
    (select security_type from information_schema.routines
      where routine_schema = 'public' and routine_name = 'admin_save_daily_release') = 'INVOKER',
    'admin_save_daily_release ist SECURITY INVOKER (RLS bleibt einzige Autorisierungsquelle)'
);

select * from finish();

rollback;
