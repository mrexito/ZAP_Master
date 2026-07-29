-- Tagesfreigaben-Schema (Schritt 10b, Migration 20260721082939_daily_releases_schema.sql). Prueft:
-- course_days-Eindeutigkeit, release_content_catalog-XOR-CHECK, daily_releases-Zeitfenster-CHECK
-- und Ein-Release-pro-Tag-Eindeutigkeit, die Optimistic-Concurrency-Versionierung, RLS/Grants, die
-- Enroll-Gate-Policy-Definition (Text-Check, konsistent mit 0008/0009) und die
-- E-Mail-Auto-Verknuepfung von beneficiary_user_id.

begin;

select plan(16);

-- 1) Fixture: Offer/Edition/Session/Kurs fuer course_days.
with fixture_offer as (
    select id from public.offers where audience_id = '6' and kurstyp = 'intensivkurs'
), fixture_edition as (
    insert into public.offer_editions
        (offer_id, school_year, public_title, tagline, description, regular_price_rappen, status)
    select id, '2029/30', 'pgTAP Tagesfreigaben Test', 'Tagline', 'Beschreibung', 100000, 'draft'
      from fixture_offer
    returning id
), fixture_kurs as (
    insert into public.intensivwoche_kurse (
        name, fach, beschreibung, start_datum, end_datum, uhrzeit, ort, preis, max_teilnehmer, lehrer, ist_aktiv
    ) values (
        'pgTAP Testkurs Tagesfreigaben', 'mathematik', 'Testbeschreibung', '2029-02-05', '2029-02-09',
        '09:00-12:00', 'Zürich HB', 1195.00, 10, 'Test Lehrer', false
    )
    returning id
)
select set_config('pgtap.edition_id', (select id::text from fixture_edition), true),
       set_config('pgtap.kurs_id', (select id::text from fixture_kurs), true);

select lives_ok(
    format($$insert into public.course_sessions (id, edition_id) values (%L::bigint, %L::uuid)$$,
        current_setting('pgtap.kurs_id'), current_setting('pgtap.edition_id')),
    'course_sessions-Fixture fuer Tagesfreigaben angelegt'
);

-- 2) course_days: Eindeutigkeit auf (session_id, sequence) UND (session_id, course_date).
select lives_ok(
    format($$insert into public.course_days (session_id, sequence, course_date) values (%L::bigint, 1, '2029-02-05')$$,
        current_setting('pgtap.kurs_id')),
    'erster course_days-Eintrag gelingt'
);

select throws_ok(
    format($$insert into public.course_days (session_id, sequence, course_date) values (%L::bigint, 1, '2029-02-06')$$,
        current_setting('pgtap.kurs_id')),
    '23505'::char(5), NULL,
    'doppelte sequence fuer dieselbe session_id wird abgelehnt'
);

select throws_ok(
    format($$insert into public.course_days (session_id, sequence, course_date) values (%L::bigint, 2, '2029-02-05')$$,
        current_setting('pgtap.kurs_id')),
    '23505'::char(5), NULL,
    'doppeltes course_date fuer dieselbe session_id wird abgelehnt'
);

with fixture_day as (
    select id from public.course_days where session_id = current_setting('pgtap.kurs_id')::bigint and sequence = 1
)
select set_config('pgtap.day_id', (select id::text from fixture_day), true);

-- 3) release_content_catalog: XOR-CHECK. class_levels ist seit dem 29.07.2026-Baseline-Dump
--    NOT NULL auf exercises (Spalte existierte im 19.07.-Baseline-Strang noch gar nicht).
with fixture_exercise as (
    insert into public.exercises (title, type, class_levels) values ('pgTAP Uebung Tagesfreigaben', 'uebung', ARRAY['6. Klasse'])
    returning id
)
select set_config('pgtap.exercise_id', (select id::text from fixture_exercise), true);

select lives_ok(
    format($$insert into public.release_content_catalog (kind, exercise_id) values ('exercise', %L::bigint)$$,
        current_setting('pgtap.exercise_id')),
    'release_content_catalog akzeptiert kind=exercise mit gesetztem exercise_id'
);

select throws_ok(
    $$insert into public.release_content_catalog (kind, exercise_id, trainer_exam_id) values ('exercise', 1, 'x')$$,
    '23514'::char(5), NULL,
    'release_content_catalog lehnt gleichzeitig gesetzte exercise_id UND trainer_exam_id ab'
);

select throws_ok(
    $$insert into public.release_content_catalog (kind) values ('trainer_exam')$$,
    '23514'::char(5), NULL,
    'release_content_catalog lehnt kind=trainer_exam ohne trainer_exam_id ab'
);

with fixture_item as (
    select id from public.release_content_catalog where exercise_id = current_setting('pgtap.exercise_id')::bigint
)
select set_config('pgtap.content_item_id', (select id::text from fixture_item), true);

-- 4) daily_releases: Zeitfenster-CHECK, Ein-Release-pro-Tag, Optimistic-Concurrency.
select throws_ok(
    format($$insert into public.daily_releases (course_day_id, opens_at, closes_at)
        values (%L::uuid, '2029-02-05T12:00:00Z', '2029-02-05T08:00:00Z')$$,
        current_setting('pgtap.day_id')),
    '23514'::char(5), NULL,
    'opens_at nach closes_at wird abgelehnt'
);

select lives_ok(
    format($$insert into public.daily_releases (course_day_id, status) values (%L::uuid, 'draft')$$,
        current_setting('pgtap.day_id')),
    'gueltige daily_releases-Zeile (draft) wird angelegt'
);

select throws_ok(
    format($$insert into public.daily_releases (course_day_id, status) values (%L::uuid, 'draft')$$,
        current_setting('pgtap.day_id')),
    '23505'::char(5), NULL,
    'ein zweites daily_releases pro course_day_id wird abgelehnt (hoechstens eine aktuelle Freigabe)'
);

with fixture_release as (
    select id, version from public.daily_releases where course_day_id = current_setting('pgtap.day_id')::uuid
)
select set_config('pgtap.release_id', (select id::text from fixture_release), true);

update public.daily_releases set status = 'active', version = 999 where id = current_setting('pgtap.release_id')::uuid;

select is(
    (select version from public.daily_releases where id = current_setting('pgtap.release_id')::uuid),
    2,
    'daily_releases-Version wird serverseitig erzwungen (Client-Wert 999 wird ignoriert)'
);

-- 5) Grants/RLS: anon hat auf keiner der vier Tabellen Schreibrechte; release_content_catalog ist
--    fuer anon/authenticated lesbar (wie exercises/trainer_exams selbst), die anderen drei nicht.
select ok(
    not exists (
        select 1
          from unnest(array['course_days', 'release_content_catalog', 'daily_releases', 'daily_release_items']) tbl,
               unnest(array['INSERT', 'UPDATE', 'DELETE']) priv
         where has_table_privilege('anon', 'public.' || tbl, priv)
    ),
    'anon hat keine Schreibrechte auf den vier Tagesfreigaben-Tabellen'
);

select ok(
    has_table_privilege('anon', 'public.release_content_catalog', 'SELECT')
      and not has_table_privilege('anon', 'public.course_days', 'SELECT')
      and not has_table_privilege('anon', 'public.daily_releases', 'SELECT'),
    'release_content_catalog ist oeffentlich lesbar, course_days/daily_releases nicht'
);

-- 6) Enroll-Gate-Policy: qual verweist auf beneficiary_user_id, den Nicht-storniert-Status und ein
--    Zeitfenster -- Text-Check im Stil von 0008/0009.
select ok(
    exists (
        select 1 from pg_policies
         where schemaname = 'public' and tablename = 'daily_releases' and cmd = 'SELECT'
           and qual like '%beneficiary_user_id%' and qual like '%storniert%' and qual like '%opens_at%'
    ),
    'daily_releases-Leserichtlinie fuer Lernende prueft beneficiary_user_id, Storno-Status und Zeitfenster'
);

-- 7) beneficiary_user_id-Auto-Verknuepfung per E-Mail. profiles.id ist FK auf auth.users(id) --
--    dieselbe Kette existiert bei jedem echten Signup (auto_create_profile_on_signup-Trigger), im
--    Testfixture muss die auth.users-Zeile deshalb explizit mit angelegt werden.
with fixture_auth_user as (
    insert into auth.users (id) values (gen_random_uuid())
    returning id
), fixture_profile as (
    insert into public.profiles (id, email, role)
    select id, 'pgtap-eltern@example.com', 'user' from fixture_auth_user
    returning id
)
select set_config('pgtap.profile_id', (select id::text from fixture_profile), true);

with fixture_anmeldung as (
    insert into public.intensivwoche_anmeldungen (
        kurs_id, child_firstname, child_lastname, child_class_level, child_gender,
        parent_email, parent_phone
    ) values (
        current_setting('pgtap.kurs_id')::bigint, 'Kind', 'Test', '6. Klasse', 'w',
        'PGTAP-Eltern@example.com', '0791234567'
    )
    returning beneficiary_user_id
)
select is(
    (select beneficiary_user_id::text from fixture_anmeldung),
    current_setting('pgtap.profile_id'),
    'beneficiary_user_id wird bei passendem (case-insensitivem) parent_email automatisch verknuepft'
);

with fixture_anmeldung_unmatched as (
    insert into public.intensivwoche_anmeldungen (
        kurs_id, child_firstname, child_lastname, child_class_level, child_gender,
        parent_email, parent_phone
    ) values (
        current_setting('pgtap.kurs_id')::bigint, 'Kind2', 'Test2', '6. Klasse', 'm',
        'unbekannt@example.com', '0791234568'
    )
    returning beneficiary_user_id
)
select is(
    (select beneficiary_user_id from fixture_anmeldung_unmatched),
    NULL,
    'beneficiary_user_id bleibt NULL ohne passendes Profil'
);

select * from finish();

rollback;
