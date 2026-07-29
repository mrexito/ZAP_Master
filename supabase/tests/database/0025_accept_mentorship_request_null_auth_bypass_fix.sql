-- Sicherheitsfix (Migration 20260729210000): accept_mentorship_request() verglich
-- `target_id != auth.uid()` mit dem einfachen Ungleichheitsoperator. In PL/pgSQL wird
-- `IF <NULL-Ausdruck> THEN` wie FALSE behandelt -- ein anonymer Aufruf (auth.uid() IS NULL) liess die
-- RAISE EXCEPTION deshalb nie greifen, obwohl die Funktion SECURITY DEFINER ist und damit RLS auf
-- mentorship_relations/mentorship_requests umgeht. Jeder unangemeldete Aufrufer konnte so eine
-- beliebige PENDING-Anfrage im Namen des echten Targets akzeptieren.
--
-- Teststrategie wie in 0009/0010 dokumentiert: pgTAP laeuft ohne request.jwt.claims, auth.uid() ist
-- deshalb bereits im Standard-Testkontext NULL -- das ist exakt das anonyme Angriffsszenario, kein
-- zusaetzliches Rollen-Setup noetig. Vor dem Fix waere Test 1 fehlgeschlagen (die Funktion haette
-- statt zu werfen erfolgreich eine Relation angelegt).

begin;

select plan(4);

with fixture_target as (
    insert into public.profiles (id, first_name, last_name, email, role)
    values (gen_random_uuid(), 'Ziel', 'Person', 'pgtap-target@example.test', 'user')
    returning id
), fixture_requester as (
    insert into public.profiles (id, first_name, last_name, email, role)
    values (gen_random_uuid(), 'Anfragende', 'Person', 'pgtap-requester@example.test', 'user')
    returning id
), fixture_listing as (
    insert into public.mentorship_listings (author_id, type, title, status)
    select id, 'OFFER', 'pgTAP Listing', 'ACTIVE' from fixture_target
    returning id
), fixture_request as (
    insert into public.mentorship_requests (listing_id, requester_id, target_id, status)
    select fixture_listing.id, fixture_requester.id, fixture_target.id, 'PENDING'
      from fixture_listing, fixture_requester, fixture_target
    returning id, target_id
)
select
    set_config('pgtap.mentorship_request_id', id::text, true),
    set_config('pgtap.mentorship_target_id', target_id::text, true)
from fixture_request;

-- 1) Anonymer Aufruf (auth.uid() IS NULL im pgTAP-Kontext) wird abgelehnt, statt die Anfrage im
--    Namen des echten Targets stillschweigend zu akzeptieren.
select throws_ok(
    format(
        $$select public.accept_mentorship_request(%L::uuid)$$,
        current_setting('pgtap.mentorship_request_id')
    ),
    'Nur der Target kann die Anfrage akzeptieren',
    'accept_mentorship_request lehnt einen anonymen (auth.uid() IS NULL) Aufruf ab'
);

-- 2) Kein Seiteneffekt: die Anfrage bleibt PENDING.
select is(
    (select status from public.mentorship_requests
      where id = current_setting('pgtap.mentorship_request_id')::uuid),
    'PENDING',
    'mentorship_requests.status bleibt nach dem abgelehnten Aufruf PENDING'
);

-- 3) Kein Seiteneffekt: keine mentorship_relations-Zeile wurde angelegt.
select is(
    (select count(*)::int from public.mentorship_relations
      where original_request_id = current_setting('pgtap.mentorship_request_id')::uuid),
    0,
    'kein mentorship_relations-Eintrag wurde fuer die abgelehnte Anfrage angelegt'
);

-- 4) Strukturelle Absicherung gegen eine Regression: die verwundbare `!=`-Verknuepfung mit
--    auth.uid() darf nicht zurueckkehren, IS DISTINCT FROM muss die Zielpruefung tragen.
select ok(
    (select prosrc from pg_proc where proname = 'accept_mentorship_request' and pronamespace = 'public'::regnamespace)
      like '%target_id IS DISTINCT FROM auth.uid()%',
    'accept_mentorship_request verwendet IS DISTINCT FROM statt der NULL-anfaelligen !=-Pruefung'
);

select * from finish();

rollback;
