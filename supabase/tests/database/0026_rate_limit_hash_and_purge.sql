-- Rate-Limit-Haertung: Hash statt Klartext-E-Mail, opportunistischer Purge (Migration
-- 20260730130000_hash_and_purge_rate_limit_attempts.sql, data-retention-runbook.md). Prueft:
-- Klartextspalte ist weg, Hash-Spalte ist korrekt befuellt, alte Zeilen werden bei jedem
-- Funktionsaufruf geloescht, aber nur solche ausserhalb des 1-Tage-Fensters. Der Rate-Limiter
-- selbst (5 Versuche/10 Minuten) bleibt durch 0006_booking_hardening_phase_b.sql abgedeckt und
-- wird hier nicht erneut geprueft -- diese Datei prueft ausschliesslich, was durch die Umstellung
-- neu hinzugekommen ist.

begin;

select plan(5);

-- 0) Klartext-Spalte ist weg, Hash-Spalte ist vorhanden und NOT NULL.
select ok(
    not exists (
        select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'intensivwoche_buchungsversuche'
           and column_name = 'parent_email'
    ),
    'intensivwoche_buchungsversuche speichert keine Klartext-E-Mail mehr'
);

select ok(
    exists (
        select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'intensivwoche_buchungsversuche'
           and column_name = 'email_hash' and is_nullable = 'NO'
    ),
    'intensivwoche_buchungsversuche hat eine NOT-NULL email_hash-Spalte'
);

with ins as (
    insert into public.intensivwoche_kurse (
        name, fach, beschreibung, start_datum, end_datum, uhrzeit, ort, preis, max_teilnehmer, lehrer
    ) values (
        'pgTAP Testkurs RateHash', 'deutsch', 'Testbeschreibung', '2026-09-15', '2026-09-19',
        '09:00-12:00', 'Testort', 90.00, 20, 'Test Lehrer'
    )
    returning id
)
select set_config('pgtap.test_kurs_ratehash', id::text, true) from ins;

-- 1) Ein Buchungsversuch speichert den korrekten SHA-256-Hash der kleingeschriebenen/getrimmten
--    E-Mail, keinen Klartext.
select public.book_intensivwoche_kurs(
    current_setting('pgtap.test_kurs_ratehash')::bigint, 'Hash', 'Test', '6. Klasse', 'w',
    '  HashTest@Example.com  ', '0791234567'
);

select is(
    (select email_hash from public.intensivwoche_buchungsversuche
      where attempted_at > now() - interval '1 minute'
      order by attempted_at desc limit 1),
    encode(extensions.digest('hashtest@example.com', 'sha256'), 'hex'),
    'gespeicherter Hash entspricht SHA-256 der kleingeschriebenen/getrimmten E-Mail'
);

-- 2) Ein alter Versuch (deutlich ausserhalb des 1-Tage-Purge-Fensters) wird beim naechsten
--    Funktionsaufruf geloescht -- unabhaengig davon, welche E-Mail den Aufruf ausloest.
insert into public.intensivwoche_buchungsversuche (email_hash, attempted_at)
values ('deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef', now() - interval '2 days');

select public.book_intensivwoche_kurs(
    current_setting('pgtap.test_kurs_ratehash')::bigint, 'Hash2', 'Test', '6. Klasse', 'w',
    'purge-trigger@example.com', '0791234567'
);

select ok(
    not exists (
        select 1 from public.intensivwoche_buchungsversuche
         where email_hash = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
    ),
    'ein Versuch aelter als 1 Tag wird beim naechsten Funktionsaufruf geloescht'
);

-- 3) Ein Versuch innerhalb des 1-Tage-Fensters, aber ausserhalb des 10-Minuten-Rate-Limit-Fensters,
--    bleibt erhalten -- der Purge ist nicht aggressiver als dokumentiert.
insert into public.intensivwoche_buchungsversuche (email_hash, attempted_at)
values ('cafebabecafebabecafebabecafebabecafebabecafebabecafebabecafebabe', now() - interval '30 minutes');

select public.book_intensivwoche_kurs(
    current_setting('pgtap.test_kurs_ratehash')::bigint, 'Hash3', 'Test', '6. Klasse', 'w',
    'no-purge@example.com', '0791234567'
);

select ok(
    exists (
        select 1 from public.intensivwoche_buchungsversuche
         where email_hash = 'cafebabecafebabecafebabecafebabecafebabecafebabecafebabecafebabe'
    ),
    'ein Versuch innerhalb des 1-Tage-Fensters wird nicht vorzeitig geloescht'
);

select * from finish();

rollback;
