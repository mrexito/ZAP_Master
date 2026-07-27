-- Automatischer Frühbucherrabatt (Migration 20260727170000_automatic_early_bird_discount.sql,
-- Betreiberentscheid 27.07.2026). Prüft, dass book_intensivwoche_kurs() booked_price_rappen
-- automatisch auf 90% des Preises setzt, wenn die Anmeldung mindestens 6 Wochen (42 Tage) vor
-- v_kurs.start_datum erfolgt -- sonst 100%. Referenzpunkt ist bewusst derselbe Ausdruck wie in der
-- Funktion selbst ((now() AT TIME ZONE 'Europe/Zurich')::date), nicht current_date, damit der Test
-- unabhängig von der Session-Zeitzone der lokalen Testdatenbank exakt denselben Stichtag trifft.
-- Prüft ausserdem, dass offer_editions.early_bird_enabled/early_bird_price_rappen/
-- early_bird_deadline nicht mehr existieren (ersetzt durch diese automatische Regel).

begin;

select plan(5);

-- 0) Die drei Frühbucherspalten und ihr CHECK-Constraint sind entfernt.
select ok(
    not exists (
        select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'offer_editions'
           and column_name in ('early_bird_enabled', 'early_bird_price_rappen', 'early_bird_deadline')
    ),
    'offer_editions besitzt keine Frühbucherspalten mehr'
);

-- Vier Testkurse mit Startdatum relativ zum selben Zeitzonen-Referenzpunkt wie
-- book_intensivwoche_kurs() selbst: klar frühzeitig (60 Tage), exakt am Stichtag (42 Tage), knapp
-- darunter (41 Tage) und deutlich zu spät (5 Tage). preis = 333.35 deckt zusätzlich das Runden ab
-- (round(33335 * 0.9) = round(30001.5) = 30002, numeric rundet halbe Beträge vom Nullpunkt weg).
with ins as (
    insert into public.intensivwoche_kurse (
        name, fach, beschreibung, start_datum, end_datum, uhrzeit, ort, preis, max_teilnehmer, lehrer
    ) values (
        'pgTAP Fruehbucher weit voraus', 'mathematik', 'Test', (now() AT TIME ZONE 'Europe/Zurich')::date + 60,
        (now() AT TIME ZONE 'Europe/Zurich')::date + 64, '09:00-12:00', 'Zürich HB', 333.35, 10, 'Test Lehrer'
    )
    returning id
)
select set_config('pgtap.kurs_weit_voraus', id::text, true) from ins;

with ins as (
    insert into public.intensivwoche_kurse (
        name, fach, beschreibung, start_datum, end_datum, uhrzeit, ort, preis, max_teilnehmer, lehrer
    ) values (
        'pgTAP Fruehbucher Stichtag', 'mathematik', 'Test', (now() AT TIME ZONE 'Europe/Zurich')::date + 42,
        (now() AT TIME ZONE 'Europe/Zurich')::date + 46, '09:00-12:00', 'Zürich HB', 333.35, 10, 'Test Lehrer'
    )
    returning id
)
select set_config('pgtap.kurs_stichtag', id::text, true) from ins;

with ins as (
    insert into public.intensivwoche_kurse (
        name, fach, beschreibung, start_datum, end_datum, uhrzeit, ort, preis, max_teilnehmer, lehrer
    ) values (
        'pgTAP Fruehbucher knapp drunter', 'mathematik', 'Test', (now() AT TIME ZONE 'Europe/Zurich')::date + 41,
        (now() AT TIME ZONE 'Europe/Zurich')::date + 45, '09:00-12:00', 'Zürich HB', 333.35, 10, 'Test Lehrer'
    )
    returning id
)
select set_config('pgtap.kurs_knapp_drunter', id::text, true) from ins;

with ins as (
    insert into public.intensivwoche_kurse (
        name, fach, beschreibung, start_datum, end_datum, uhrzeit, ort, preis, max_teilnehmer, lehrer
    ) values (
        'pgTAP Fruehbucher zu spaet', 'mathematik', 'Test', (now() AT TIME ZONE 'Europe/Zurich')::date + 5,
        (now() AT TIME ZONE 'Europe/Zurich')::date + 9, '09:00-12:00', 'Zürich HB', 333.35, 10, 'Test Lehrer'
    )
    returning id
)
select set_config('pgtap.kurs_zu_spaet', id::text, true) from ins;

-- Buchungs-Insert je Fall zuerst als eigenständige WITH-Anweisung (wie in 0005/0006), NICHT als
-- Funktionsaufruf innerhalb eines WHERE gegen intensivwoche_anmeldungen: bei anfangs leerer
-- Tabelle kann der Planer die Auswertung sonst ganz überspringen und liefert NULL statt eines
-- echten Fehlers oder Treffers -- keine verlässliche Assertion.
with ins as (
    select public.book_intensivwoche_kurs(
        current_setting('pgtap.kurs_weit_voraus')::bigint, 'Frueh', 'Buchend', '6. Klasse', 'w',
        'fruehbucher-weit@example.com', '0791110002'
    ) as id
)
select set_config('pgtap.anmeldung_weit_voraus', (select id::text from ins), true);

with ins as (
    select public.book_intensivwoche_kurs(
        current_setting('pgtap.kurs_stichtag')::bigint, 'Stich', 'Tag', '6. Klasse', 'm',
        'fruehbucher-stichtag@example.com', '0791110003'
    ) as id
)
select set_config('pgtap.anmeldung_stichtag', (select id::text from ins), true);

with ins as (
    select public.book_intensivwoche_kurs(
        current_setting('pgtap.kurs_knapp_drunter')::bigint, 'Knapp', 'Drunter', '6. Klasse', 'w',
        'fruehbucher-knapp@example.com', '0791110004'
    ) as id
)
select set_config('pgtap.anmeldung_knapp_drunter', (select id::text from ins), true);

with ins as (
    select public.book_intensivwoche_kurs(
        current_setting('pgtap.kurs_zu_spaet')::bigint, 'Spaet', 'Dran', '6. Klasse', 'm',
        'fruehbucher-spaet@example.com', '0791110005'
    ) as id
)
select set_config('pgtap.anmeldung_zu_spaet', (select id::text from ins), true);

-- 1) Weit im Voraus (60 Tage): 10% Rabatt, korrekt gerundet.
select is(
    (select booked_price_rappen from public.intensivwoche_anmeldungen
      where id = current_setting('pgtap.anmeldung_weit_voraus')::uuid),
    30002,
    '60 Tage im Voraus: 10% Rabatt korrekt gerundet (round(33335*0.9)=30002)'
);

-- 2) Exakt am Stichtag (42 Tage): Grenztag zählt noch als Frühbucher.
select is(
    (select booked_price_rappen from public.intensivwoche_anmeldungen
      where id = current_setting('pgtap.anmeldung_stichtag')::uuid),
    30002,
    'genau 42 Tage vor Kursstart: Grenztag zählt noch als Frühbucher (10% Rabatt)'
);

-- 3) Einen Tag zu spät (41 Tage): kein Rabatt mehr.
select is(
    (select booked_price_rappen from public.intensivwoche_anmeldungen
      where id = current_setting('pgtap.anmeldung_knapp_drunter')::uuid),
    33335,
    '41 Tage vor Kursstart: kein Rabatt mehr (voller Preis)'
);

-- 4) Kurz vor Kursstart (5 Tage): voller Preis.
select is(
    (select booked_price_rappen from public.intensivwoche_anmeldungen
      where id = current_setting('pgtap.anmeldung_zu_spaet')::uuid),
    33335,
    '5 Tage vor Kursstart: voller Preis'
);

select * from finish();

rollback;
