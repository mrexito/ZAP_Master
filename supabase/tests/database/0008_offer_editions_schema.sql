-- Editions-/Sessions-Schema (step0Baseline.revision2.md / Schritt 5, Teil 3; Migration
-- 20260720170000_offer_editions_schema.sql). Prüft: offers-Eindeutigkeit, dass course_sessions.id
-- wirklich dieselbe Identität wie eine echte intensivwoche_kurse-Zeile trägt, die erweiterte
-- Preis-Snapshot-Immutability (jetzt inkl. edition_id/session_id), RLS/Grants auf allen vier
-- neuen Tabellen und die published/draft-Sichtbarkeitsregel.
--
-- Die frühere Frühbucher-Konsistenz-CHECK (early_bird_enabled/early_bird_price_rappen/
-- early_bird_deadline) entfiel mit Migration 20260727170000_automatic_early_bird_discount.sql --
-- der Rabatt wird seither automatisch in book_intensivwoche_kurs() berechnet, siehe
-- 0023_automatic_early_bird_discount.sql.

begin;

select plan(13);

-- 1) offers: Eindeutigkeit auf (audience_id, kurstyp, slug). audience_id 'pgtap-test' ist bewusst
--    kein echtes Audience-Kuerzel -- vermeidet eine Kollision mit den 20 echten, seit
--    20260721074103_seed_offer_catalog.sql vorhandenen Referenz-Angeboten.
select lives_ok(
    $$insert into public.offers (audience_id, kurstyp, slug) values ('pgtap-test', 'intensivkurs', 'pgtap-fixture')$$,
    'erstes offers-Insert gelingt'
);

select throws_ok(
    $$insert into public.offers (audience_id, kurstyp, slug) values ('pgtap-test', 'intensivkurs', 'pgtap-fixture')$$,
    '23505'::char(5),
    NULL,
    'doppeltes (audience_id, kurstyp, slug) wird abgelehnt'
);

with fixture_offer as (
    select id from public.offers where audience_id = 'pgtap-test' and slug = 'pgtap-fixture'
)
select set_config('pgtap.offer_id', (select id::text from fixture_offer), true);

-- 2) offer_editions: einfache Preis-Inserts (kein Frühbucherfeld mehr).
select lives_ok(
    format($$insert into public.offer_editions
        (offer_id, school_year, public_title, tagline, description, regular_price_rappen, status)
        values (%L::bigint, '2026/27', 'Intensivkurs-Sportferien', 'Tagline', 'Beschreibung', 119500, 'published')$$,
        current_setting('pgtap.offer_id')),
    'gueltige published Edition wird angelegt'
);

with fixture_edition as (
    select id from public.offer_editions where offer_id = current_setting('pgtap.offer_id')::bigint
)
select set_config('pgtap.edition_id', (select id::text from fixture_edition), true);

select lives_ok(
    format($$insert into public.offer_editions
        (offer_id, school_year, public_title, tagline, description, regular_price_rappen, status)
        values (%L::bigint, '2027/28', 'Naechstes Jahr', 'Tagline', 'Beschreibung', 129500, 'draft')$$,
        current_setting('pgtap.offer_id')),
    'gueltige weitere Edition (draft) wird angelegt'
);

-- 3) course_sessions: id = echte intensivwoche_kurse.id (1:1-Erweiterung, kein zweites System).
with fixture_kurs as (
    insert into public.intensivwoche_kurse (
        name, fach, beschreibung, start_datum, end_datum, uhrzeit, ort, preis, max_teilnehmer, lehrer
    ) values (
        'pgTAP Testkurs Editions', 'mathematik', 'Testbeschreibung', '2026-08-01', '2026-08-05',
        '09:00-12:00', 'Zürich HB', 1195.00, 10, 'Test Lehrer'
    )
    returning id
)
select set_config('pgtap.kurs_id', (select id::text from fixture_kurs), true);

select lives_ok(
    format($$insert into public.course_sessions (id, edition_id) values (%L::bigint, %L::uuid)$$,
        current_setting('pgtap.kurs_id'), current_setting('pgtap.edition_id')),
    'course_sessions.id kann eine echte intensivwoche_kurse.id uebernehmen'
);

select is(
    (select k.name from public.intensivwoche_kurse k
       join public.course_sessions cs on cs.id = k.id
      where k.id = current_setting('pgtap.kurs_id')::bigint),
    'pgTAP Testkurs Editions',
    'course_sessions.id referenziert dieselbe Zeile wie intensivwoche_kurse -- keine Kopie'
);

-- 4) Erweiterte Preis-Snapshot-Immutability: edition_id/session_id nach INSERT unveraenderlich.
with fixture_anmeldung as (
    insert into public.intensivwoche_anmeldungen (
        kurs_id, child_firstname, child_lastname, child_class_level, child_gender,
        parent_email, parent_phone, booked_price_rappen, currency, edition_id, session_id
    ) values (
        current_setting('pgtap.kurs_id')::bigint, 'Edith', 'Testkind', '6. Klasse', 'w',
        'edition-test@example.com', '0791234567', 119500, 'CHF',
        current_setting('pgtap.edition_id')::uuid, current_setting('pgtap.kurs_id')::bigint
    )
    returning id
)
select set_config('pgtap.anmeldung_id', (select id::text from fixture_anmeldung), true);

select throws_ok(
    format($$update public.intensivwoche_anmeldungen set edition_id = null where id = %L::uuid$$,
        current_setting('pgtap.anmeldung_id')),
    'booked_price_snapshot_immutable',
    'edition_id kann nach dem Insert nicht mehr geaendert werden'
);

select throws_ok(
    format($$update public.intensivwoche_anmeldungen set session_id = null where id = %L::uuid$$,
        current_setting('pgtap.anmeldung_id')),
    'booked_price_snapshot_immutable',
    'session_id kann nach dem Insert nicht mehr geaendert werden'
);

-- 5) RLS aktiv + keine Schreibrechte fuer anon/authenticated auf den vier neuen Tabellen.
select ok(
    (select bool_and(relrowsecurity) from pg_class
      where oid = any (array['public.offers', 'public.offer_editions', 'public.course_sessions', 'public.audit_log']::regclass[])),
    'RLS ist auf offers/offer_editions/course_sessions/audit_log aktiviert'
);

select ok(
    not exists (
        select 1
          from unnest(array['offers', 'offer_editions', 'course_sessions', 'audit_log']) tbl,
               unnest(array['INSERT', 'UPDATE', 'DELETE']) priv
         where has_table_privilege('anon', 'public.' || tbl, priv)
    ),
    'anon hat weiterhin keine INSERT/UPDATE/DELETE-Rechte auf den vier neuen Tabellen'
);

-- offers bleibt Migrations-Referenzdaten (Schritt 10a fuegt bewusst keinen "Neues Kursangebot"-
-- Flow hinzu); authenticated bekommt seit Migration 20260721074500 gezielt INSERT/UPDATE auf
-- offer_editions/course_sessions und INSERT auf audit_log (Admin-Maske), aber nach wie vor kein
-- DELETE irgendwo und keine Rechte auf offers.
select ok(
    not exists (
        select 1
          from unnest(array['offers', 'offer_editions', 'course_sessions', 'audit_log']) tbl,
               unnest(array['INSERT', 'UPDATE', 'DELETE']) priv
         where has_table_privilege('authenticated', 'public.' || tbl, priv)
           and not (
             (tbl in ('offer_editions', 'course_sessions') and priv in ('INSERT', 'UPDATE'))
             or (tbl = 'audit_log' and priv = 'INSERT')
           )
    ),
    'authenticated hat nur die fuer die Admin-Maske vorgesehenen INSERT/UPDATE-Rechte, kein DELETE, keine Rechte auf offers'
);

-- 6) published/draft-Sichtbarkeitsregel (Policy-Ebene, konsistent mit dem Stil dieser Testdatei).
select ok(
    exists (
        select 1 from pg_policies
         where schemaname = 'public' and tablename = 'offer_editions'
           and qual like '%published%' and qual like '%is_content_manager%'
    ),
    'offer_editions-Policy unterscheidet published (oeffentlich) von is_content_manager()'
);

select ok(
    exists (
        select 1 from pg_policies
         where schemaname = 'public' and tablename = 'course_sessions'
           and qual like '%offer_editions%' and qual like '%published%'
    ),
    'course_sessions-Policy prueft den Status der zugehoerigen Edition'
);

select * from finish();

rollback;
