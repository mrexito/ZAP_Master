-- Prueft 20260722130621_seed_published_offer_editions.sql plus die additiven
-- 20260723063259_... und 20260723072315_seed_published_offer_editions.sql: Punkt 1 aus
-- design-review-todo.md (aufgeloest 2026-07-23) hat die bis dahin einzeln je Angebot geforderte
-- Preisfreigabe durch eine Uebergangsentscheidung ersetzt -- alle Preise gelten als
-- vorlaeufig/fiktiv (siehe lib/kurse/pricing-status.ts), buchbar ist dadurch keines davon. Seither
-- haben auch BMS-Halbjahreskurs (Inhalt seit 22.07.2026) und 5. Klasse Lerncamp (Fixture seit
-- 23.07.2026 ergaenzt, Nutzer-Entscheid CHF 950 statt des zuvor ungeloesten Konflikts CHF 950 vs.
-- CHF 890) je eine published offer_editions-Zeile mit Preis/Titel: 20 statt 18.

begin;

select plan(5);

select is(
    (select count(*)::int from public.offer_editions where status = 'published'),
    20,
    '20 offer_editions-Zeilen mit status=published'
);

select is(
    (select count(*)::int
       from public.offer_editions e
      where status = 'published'
        and (public_title is null or public_title = '' or regular_price_rappen is null)),
    0,
    'jede published-Zeile hat Titel und Preis gesetzt'
);

select is(
    (select e.status from public.offer_editions e
       join public.offers o on o.id = e.offer_id
      where o.audience_id = 'bms' and o.kurstyp = 'halbjahreskurs'),
    'published',
    'BMS-Halbjahreskurs hat seit Punkt 1 (2026-07-23) eine published offer_editions-Zeile'
);

select is(
    (select e.status from public.offer_editions e
       join public.offers o on o.id = e.offer_id
      where o.audience_id = '5' and o.kurstyp = 'intensivkurs' and o.slug = 'lerncamp-sportferien'),
    'published',
    '5. Klasse Lerncamp hat seit dem Fixture vom 23.07.2026 eine published offer_editions-Zeile'
);

-- Idempotenz: ein zweiter Lauf derselben INSERTs (ON CONFLICT DO NOTHING auf (offer_id,
-- school_year)) darf keine Duplikate erzeugen.
insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, currency, status
)
select o.id, '2026/27', 'Duplikat-Testlauf', 'x', 'x', 1, 'CHF', 'published'
from public.offers o
where o.audience_id = '6' and o.kurstyp = 'halbjahreskurs' and o.slug = 'halbjahreskurs'
on conflict (offer_id, school_year) do nothing;

select is(
    (select count(*)::int from public.offer_editions e
       join public.offers o on o.id = e.offer_id
      where o.audience_id = '6' and o.kurstyp = 'halbjahreskurs' and o.slug = 'halbjahreskurs'
        and e.school_year = '2026/27'),
    1,
    'wiederholter Insert fuer dieselbe (offer_id, school_year) erzeugt kein Duplikat'
);

select * from finish();

rollback;
