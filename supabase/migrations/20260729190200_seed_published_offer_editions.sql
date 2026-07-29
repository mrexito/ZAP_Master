-- Restores the 20 published offer_editions rows that the 29.07.2026 baseline reset dropped: the
-- new schema-only baseline (20260729180000_live_schema_baseline_2026_07_29.sql) replaced 56
-- migrations, including the three cumulative
-- supabase/legacy-migrations/202607{22130621,23063259,23072315}_seed_published_offer_editions.sql
-- files that originally seeded this table (each superseded the previous one via ON CONFLICT DO
-- NOTHING; 072315 is the full 20-row union). Real, non-personal production pricing/catalog
-- content -- identical on every environment -- not a local-only supabase/seed.sql fixture.
--
-- Column list adjusted for the current schema: early_bird_enabled/early_bird_price_rappen/
-- early_bird_deadline were dropped from offer_editions by
-- 20260727170000_automatic_early_bird_discount.sql (the discount is now computed automatically
-- from regular_price_rappen and session start date, see book_intensivwoche_kurs()). The archived
-- source files still reference those three columns; this migration keeps only
-- regular_price_rappen/currency/status, which is schema-compatible with what those rows resolved
-- to on every non-early-bird row. Depends on supabase/migrations/20260729190000_seed_offer_catalog.sql
-- having already populated public.offers.

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, currency, status
)
select o.id, $str$2026/27$str$, $str$Halbjahreskurs$str$, $str$Breite Vorbereitung über das ganze Semester$str$, $str$Umfassende Vorbereitung auf die BM1- oder BM2-Aufnahmeprüfung — gezielte, individuelle Förderung in Deutsch und Mathematik mit einem festen Termin pro Woche.$str$,
  299000,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$bms$str$ and o.kurstyp = $str$halbjahreskurs$str$ and o.slug = $str$halbjahreskurs$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, currency, status
)
select o.id, $str$2026/27$str$, $str$Intensivkurs-Sportferien$str$, $str$Kompaktes Training in den Schulferien$str$, $str$Ideal für alle, die sich kurz vor der Prüfung nochmals intensiv mit dem Prüfungsformat und typischen Aufgaben auseinandersetzen möchten – inklusive praktischer Tipps & Tricks für die BMS-Aufnahmeprüfung.$str$,
  99000,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$bms$str$ and o.kurstyp = $str$intensivkurs$str$ and o.slug = $str$intensivkurs$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, currency, status
)
select o.id, $str$2026/27$str$, $str$Prüfungssimulation$str$, $str$Offen für alle$str$, $str$Eine echte BMS-Aufnahmeprüfung unter realen Bedingungen — inklusive schriftlicher Bewertung. Auch ohne vorherige Kursteilnahme buchbar.$str$,
  14500,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$bms$str$ and o.kurstyp = $str$pruefungssimulation$str$ and o.slug = $str$pruefungssimulation$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, currency, status
)
select o.id, $str$2026/27$str$, $str$Selbststudium$str$, $str$Selbststudium · BMS$str$, $str$Übungsaufgaben für Deutsch und Mathematik, bisherige BMS-Aufnahmeprüfungen mit Lösungen und persönliches Feedback zu eigenen Aufsätzen — flexibel und im eigenen Tempo.$str$,
  19000,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$bms$str$ and o.kurstyp = $str$selbststudium$str$ and o.slug = $str$selbststudium$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, currency, status
)
select o.id, $str$2026/27$str$, $str$Lerncamp – Sportferien$str$, $str$Spielerisch, ohne Prüfungsdruck$str$, $str$Ideal für Kinder, die ihre Grundlagen in Deutsch und Mathematik stärken und Lücken schliessen möchten — spielerisch, ohne Prüfungsdruck, mit spürbarem Fortschritt in einer Woche.$str$,
  89000,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$1-sek$str$ and o.kurstyp = $str$intensivkurs$str$ and o.slug = $str$lerncamp-sportferien$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, currency, status
)
select o.id, $str$2026/27$str$, $str$Vorkurs$str$, $str$Breite Vorbereitung über das ganze Semester$str$, $str$Ideal für Kinder, die sich frühzeitig und ohne Druck auf die Kurzzeit-Prüfung 2028 vorbereiten möchten — mit viel Vorlauf und einer Standortbestimmung zum Einstieg.$str$,
  99000,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$1-sek$str$ and o.kurstyp = $str$halbjahreskurs$str$ and o.slug = $str$vorkurs$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, currency, status
)
select o.id, $str$2026/27$str$, $str$Halbjahreskurs$str$, $str$Breite Vorbereitung über das ganze Semester$str$, $str$Deutsch, Mathematik und spielerisches Lernen in einem Termin — je 45 Minuten pro Bereich, mit Fachwechsel für maximale Aufmerksamkeit. Ob Wortschatz-Spiele oder Kopfrechen-Wettbewerbe: Lernen mit Spass statt nur Pauken.$str$,
  349000,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$5$str$ and o.kurstyp = $str$halbjahreskurs$str$ and o.slug = $str$halbjahreskurs$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, currency, status
)
select o.id, $str$2026/27$str$, $str$Lerncamp – Sportferien$str$, $str$Spielerisch, ohne Prüfungsdruck$str$, $str$Ideal für Kinder, die ihre Grundlagen in Deutsch und Mathematik stärken und Lücken schliessen möchten — spielerisch, ohne Prüfungsdruck, mit spürbarem Fortschritt in einer Woche.$str$,
  95000,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$5$str$ and o.kurstyp = $str$intensivkurs$str$ and o.slug = $str$lerncamp-sportferien$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, currency, status
)
select o.id, $str$2026/27$str$, $str$Halbjahreskurs$str$, $str$Breite Vorbereitung über das ganze Semester$str$, $str$Umfassende Vorbereitung auf die Mathematik-Matura — gezielte, individuelle Förderung in den prüfungsrelevanten Themengebieten, begleitet über das ganze letzte Gymnasialjahr.$str$,
  279000,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$matura$str$ and o.kurstyp = $str$halbjahreskurs$str$ and o.slug = $str$halbjahreskurs$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, currency, status
)
select o.id, $str$2026/27$str$, $str$Intensivwoche$str$, $str$Intensives Training in den Frühlingsferien$str$, $str$Ideal für Maturandinnen und Maturanden, die sich in der letzten Ferienwoche vor der Prüfung nochmals gezielt auf die Mathematik-Matura vorbereiten möchten.$str$,
  98000,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$matura$str$ and o.kurstyp = $str$intensivkurs$str$ and o.slug = $str$intensivwoche$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, currency, status
)
select o.id, $str$2026/27$str$, $str$Halbjahreskurs$str$, $str$Breite Vorbereitung über das ganze Semester$str$, $str$Umfassende und optimale Vorbereitung auf die Aufnahmeprüfung ins Langzeitgymnasium — gezielte, individuelle Förderung in Deutsch und Mathematik.$str$,
  349000,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$6$str$ and o.kurstyp = $str$halbjahreskurs$str$ and o.slug = $str$halbjahreskurs$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, currency, status
)
select o.id, $str$2026/27$str$, $str$Intensivkurs-Sportferien$str$, $str$Intensives Training in den Sportferien$str$, $str$Ideal für Kinder, die sich intensiv auf die Prüfungsaufgaben und die Prüfungssituation vorbereiten wollen – inklusive praktischer Tipps & Tricks für die Gymiprüfung.$str$,
  119500,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$6$str$ and o.kurstyp = $str$intensivkurs$str$ and o.slug = $str$intensivkurs-sportferien$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, currency, status
)
select o.id, $str$2026/27$str$, $str$Prüfungssimulation$str$, $str$Offen für alle$str$, $str$Eine echte Aufnahmeprüfung unter realen Bedingungen — inklusive schriftlicher Bewertung. Auch ohne vorherige Kursteilnahme buchbar.$str$,
  14500,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$6$str$ and o.kurstyp = $str$pruefungssimulation$str$ and o.slug = $str$pruefungssimulation$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, currency, status
)
select o.id, $str$2026/27$str$, $str$Selbststudium$str$, $str$Selbststudium · 6. Klasse$str$, $str$Zugriff auf Übungsaufgaben, alte Prüfungen mit Lösungen und persönliches Feedback zu deinen eigenen Aufsätzen — flexibel von zu Hause aus, im eigenen Tempo.$str$,
  19000,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$6$str$ and o.kurstyp = $str$selbststudium$str$ and o.slug = $str$selbststudium$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, currency, status
)
select o.id, $str$2026/27$str$, $str$Halbjahreskurs$str$, $str$Breite Vorbereitung über das ganze Semester$str$, $str$Deutsch, Mathematik und spielerisches Lernen in einem Termin — je 45 Minuten pro Bereich, mit Fachwechsel für maximale Aufmerksamkeit. Ob Wortschatz-Spiele oder Kopfrechen-Wettbewerbe: Lernen mit Spass statt nur Pauken.$str$,
  349000,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$4$str$ and o.kurstyp = $str$halbjahreskurs$str$ and o.slug = $str$halbjahreskurs$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, currency, status
)
select o.id, $str$2026/27$str$, $str$Lerncamp – Sportferien$str$, $str$Spielerisch, ohne Prüfungsdruck$str$, $str$Ideal für Kinder, die ihre Grundlagen in Deutsch und Mathematik stärken und Lücken schliessen möchten — spielerisch, ohne Prüfungsdruck, mit spürbarem Fortschritt in einer Woche.$str$,
  89000,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$4$str$ and o.kurstyp = $str$intensivkurs$str$ and o.slug = $str$lerncamp-sportferien$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, currency, status
)
select o.id, $str$2026/27$str$, $str$Halbjahreskurs$str$, $str$Breite Vorbereitung über das ganze Semester$str$, $str$Optimale und nachhaltige Vorbereitung auf die Aufnahmeprüfung ins Kurzzeitgymnasium — gezielte, individuelle Förderung in Mathematik und Deutsch.$str$,
  349000,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$2-3-sek$str$ and o.kurstyp = $str$halbjahreskurs$str$ and o.slug = $str$halbjahreskurs$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, currency, status
)
select o.id, $str$2026/27$str$, $str$Intensivkurs-Sportferien$str$, $str$Intensives Training in den Sportferien$str$, $str$Ideal für Kinder, die sich intensiv auf die Prüfungsaufgaben und die Prüfungssituation vorbereiten wollen – inklusive praktischer Tipps & Tricks für die Gymiprüfung.$str$,
  119500,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$2-3-sek$str$ and o.kurstyp = $str$intensivkurs$str$ and o.slug = $str$intensivkurs-sportferien$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, currency, status
)
select o.id, $str$2026/27$str$, $str$Prüfungssimulation$str$, $str$Offen für alle$str$, $str$Eine echte Aufnahmeprüfung unter realen Bedingungen — inklusive schriftlicher Bewertung. Auch ohne vorherige Kursteilnahme buchbar.$str$,
  14500,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$2-3-sek$str$ and o.kurstyp = $str$pruefungssimulation$str$ and o.slug = $str$pruefungssimulation$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, currency, status
)
select o.id, $str$2026/27$str$, $str$Selbststudium$str$, $str$Selbststudium · 2./3. Sek$str$, $str$Zugriff auf Übungsaufgaben, alte Prüfungen mit Lösungen und persönliches Feedback zu deinen eigenen Aufsätzen — flexibel von zu Hause aus, im eigenen Tempo.$str$,
  19000,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$2-3-sek$str$ and o.kurstyp = $str$selbststudium$str$ and o.slug = $str$selbststudium$str$
on conflict (offer_id, school_year) do nothing;
