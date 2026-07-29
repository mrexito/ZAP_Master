-- Befuellt offer_editions fuer die 18 bereits oeffentlich publizierten Angebote (Abschnitt 2.12)
-- mit den aktuell auf der Website sichtbaren Preisen/Texten aus types/marketing.fixtures.ts --
-- generiert per scripts/generate-offer-editions-migration.mjs, keine manuelle Abschrift. Macht
-- die Preise ab sofort ueber /dashboard/kurse/angebote (Schritt 10a) live editierbar, OHNE die
-- oeffentlich sichtbaren Werte zu aendern (identisch zu den bisherigen Fixture-Werten). Sobald die
-- oeffentlichen Seiten auf offer_editions statt der statischen Fixtures umgestellt sind (separater
-- Schritt), werden Preisaenderungen ueber die Admin-Maske sofort live sichtbar.
--
-- BEWUSST NICHT enthalten: 5. Klasse Lerncamp (dokumentierter Preiskonflikt CHF 950 vs. 890, siehe
-- supabase/seed.sql und den Kommentar bei fuenfKlasseHalbjahreskurs in den Fixtures -- der echte
-- Preis folgt separat, sobald er fachlich freigegeben ist) und BMS-Halbjahreskurs (kein Inhalt,
-- siehe Abschnitt 9.1 des Architektur-Briefings). Beide offers-Zeilen existieren bereits, bleiben
-- hier aber ohne offer_editions-Zeile.
--
-- Alle offers-Zeilen existieren bereits (20260721074103_seed_offer_catalog.sql); ON CONFLICT DO
-- NOTHING macht diese Migration bei einem erneuten Lauf ungefaehrlich wiederholbar.

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, early_bird_enabled, early_bird_price_rappen, early_bird_deadline,
  currency, status
)
select o.id, $str$2026/27$str$, $str$Halbjahreskurs$str$, $str$Breite Vorbereitung über das ganze Semester$str$, $str$Umfassende Vorbereitung auf die BM1- oder BM2-Aufnahmeprüfung — gezielte, individuelle Förderung in Deutsch und Mathematik mit einem festen Termin pro Woche.$str$,
  299000, true, 289000, '2026-07-31',
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$bms$str$ and o.kurstyp = $str$halbjahreskurs$str$ and o.slug = $str$halbjahreskurs$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, early_bird_enabled, early_bird_price_rappen, early_bird_deadline,
  currency, status
)
select o.id, $str$2026/27$str$, $str$Intensivkurs-Sportferien$str$, $str$Kompaktes Training in den Schulferien$str$, $str$Ideal für alle, die sich kurz vor der Prüfung nochmals intensiv mit dem Prüfungsformat und typischen Aufgaben auseinandersetzen möchten – inklusive praktischer Tipps & Tricks für die BMS-Aufnahmeprüfung.$str$,
  99000, false, null, null,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$bms$str$ and o.kurstyp = $str$intensivkurs$str$ and o.slug = $str$intensivkurs$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, early_bird_enabled, early_bird_price_rappen, early_bird_deadline,
  currency, status
)
select o.id, $str$2026/27$str$, $str$Prüfungssimulation$str$, $str$Offen für alle$str$, $str$Eine echte BMS-Aufnahmeprüfung unter realen Bedingungen — inklusive schriftlicher Bewertung. Auch ohne vorherige Kursteilnahme buchbar.$str$,
  14500, false, null, null,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$bms$str$ and o.kurstyp = $str$pruefungssimulation$str$ and o.slug = $str$pruefungssimulation$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, early_bird_enabled, early_bird_price_rappen, early_bird_deadline,
  currency, status
)
select o.id, $str$2026/27$str$, $str$Selbststudium$str$, $str$Selbststudium · BMS$str$, $str$Übungsaufgaben für Deutsch und Mathematik, bisherige BMS-Aufnahmeprüfungen mit Lösungen und persönliches Feedback zu eigenen Aufsätzen — flexibel und im eigenen Tempo.$str$,
  19000, false, null, null,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$bms$str$ and o.kurstyp = $str$selbststudium$str$ and o.slug = $str$selbststudium$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, early_bird_enabled, early_bird_price_rappen, early_bird_deadline,
  currency, status
)
select o.id, $str$2026/27$str$, $str$Lerncamp – Sportferien$str$, $str$Spielerisch, ohne Prüfungsdruck$str$, $str$Ideal für Kinder, die ihre Grundlagen in Deutsch und Mathematik stärken und Lücken schliessen möchten — spielerisch, ohne Prüfungsdruck, mit spürbarem Fortschritt in einer Woche.$str$,
  89000, false, null, null,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$1-sek$str$ and o.kurstyp = $str$intensivkurs$str$ and o.slug = $str$lerncamp-sportferien$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, early_bird_enabled, early_bird_price_rappen, early_bird_deadline,
  currency, status
)
select o.id, $str$2026/27$str$, $str$Vorkurs$str$, $str$Breite Vorbereitung über das ganze Semester$str$, $str$Ideal für Kinder, die sich frühzeitig und ohne Druck auf die Kurzzeit-Prüfung 2028 vorbereiten möchten — mit viel Vorlauf und einer Standortbestimmung zum Einstieg.$str$,
  99000, false, null, null,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$1-sek$str$ and o.kurstyp = $str$halbjahreskurs$str$ and o.slug = $str$vorkurs$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, early_bird_enabled, early_bird_price_rappen, early_bird_deadline,
  currency, status
)
select o.id, $str$2026/27$str$, $str$Halbjahreskurs$str$, $str$Breite Vorbereitung über das ganze Semester$str$, $str$Deutsch, Mathematik und spielerisches Lernen in einem Termin — je 45 Minuten pro Bereich, mit Fachwechsel für maximale Aufmerksamkeit. Ob Wortschatz-Spiele oder Kopfrechen-Wettbewerbe: Lernen mit Spass statt nur Pauken.$str$,
  349000, false, null, null,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$5$str$ and o.kurstyp = $str$halbjahreskurs$str$ and o.slug = $str$halbjahreskurs$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, early_bird_enabled, early_bird_price_rappen, early_bird_deadline,
  currency, status
)
select o.id, $str$2026/27$str$, $str$Halbjahreskurs$str$, $str$Breite Vorbereitung über das ganze Semester$str$, $str$Umfassende Vorbereitung auf die Mathematik-Matura — gezielte, individuelle Förderung in den prüfungsrelevanten Themengebieten, begleitet über das ganze letzte Gymnasialjahr.$str$,
  279000, true, 269000, '2026-07-31',
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$matura$str$ and o.kurstyp = $str$halbjahreskurs$str$ and o.slug = $str$halbjahreskurs$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, early_bird_enabled, early_bird_price_rappen, early_bird_deadline,
  currency, status
)
select o.id, $str$2026/27$str$, $str$Intensivwoche$str$, $str$Intensives Training in den Frühlingsferien$str$, $str$Ideal für Maturandinnen und Maturanden, die sich in der letzten Ferienwoche vor der Prüfung nochmals gezielt auf die Mathematik-Matura vorbereiten möchten.$str$,
  98000, false, null, null,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$matura$str$ and o.kurstyp = $str$intensivkurs$str$ and o.slug = $str$intensivwoche$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, early_bird_enabled, early_bird_price_rappen, early_bird_deadline,
  currency, status
)
select o.id, $str$2026/27$str$, $str$Halbjahreskurs$str$, $str$Breite Vorbereitung über das ganze Semester$str$, $str$Umfassende und optimale Vorbereitung auf die Aufnahmeprüfung ins Langzeitgymnasium — gezielte, individuelle Förderung in Deutsch und Mathematik.$str$,
  349000, true, 339000, '2026-07-31',
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$6$str$ and o.kurstyp = $str$halbjahreskurs$str$ and o.slug = $str$halbjahreskurs$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, early_bird_enabled, early_bird_price_rappen, early_bird_deadline,
  currency, status
)
select o.id, $str$2026/27$str$, $str$Intensivkurs-Sportferien$str$, $str$Intensives Training in den Sportferien$str$, $str$Ideal für Kinder, die sich intensiv auf die Prüfungsaufgaben und die Prüfungssituation vorbereiten wollen – inklusive praktischer Tipps & Tricks für die Gymiprüfung.$str$,
  119500, false, null, null,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$6$str$ and o.kurstyp = $str$intensivkurs$str$ and o.slug = $str$intensivkurs-sportferien$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, early_bird_enabled, early_bird_price_rappen, early_bird_deadline,
  currency, status
)
select o.id, $str$2026/27$str$, $str$Prüfungssimulation$str$, $str$Offen für alle$str$, $str$Eine echte Aufnahmeprüfung unter realen Bedingungen — inklusive schriftlicher Bewertung. Auch ohne vorherige Kursteilnahme buchbar.$str$,
  14500, false, null, null,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$6$str$ and o.kurstyp = $str$pruefungssimulation$str$ and o.slug = $str$pruefungssimulation$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, early_bird_enabled, early_bird_price_rappen, early_bird_deadline,
  currency, status
)
select o.id, $str$2026/27$str$, $str$Selbststudium$str$, $str$Selbststudium · 6. Klasse$str$, $str$Zugriff auf Übungsaufgaben, alte Prüfungen mit Lösungen und persönliches Feedback zu deinen eigenen Aufsätzen — flexibel von zu Hause aus, im eigenen Tempo.$str$,
  19000, false, null, null,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$6$str$ and o.kurstyp = $str$selbststudium$str$ and o.slug = $str$selbststudium$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, early_bird_enabled, early_bird_price_rappen, early_bird_deadline,
  currency, status
)
select o.id, $str$2026/27$str$, $str$Halbjahreskurs$str$, $str$Breite Vorbereitung über das ganze Semester$str$, $str$Deutsch, Mathematik und spielerisches Lernen in einem Termin — je 45 Minuten pro Bereich, mit Fachwechsel für maximale Aufmerksamkeit. Ob Wortschatz-Spiele oder Kopfrechen-Wettbewerbe: Lernen mit Spass statt nur Pauken.$str$,
  349000, true, 269000, '2026-07-31',
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$4$str$ and o.kurstyp = $str$halbjahreskurs$str$ and o.slug = $str$halbjahreskurs$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, early_bird_enabled, early_bird_price_rappen, early_bird_deadline,
  currency, status
)
select o.id, $str$2026/27$str$, $str$Lerncamp – Sportferien$str$, $str$Spielerisch, ohne Prüfungsdruck$str$, $str$Ideal für Kinder, die ihre Grundlagen in Deutsch und Mathematik stärken und Lücken schliessen möchten — spielerisch, ohne Prüfungsdruck, mit spürbarem Fortschritt in einer Woche.$str$,
  89000, false, null, null,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$4$str$ and o.kurstyp = $str$intensivkurs$str$ and o.slug = $str$lerncamp-sportferien$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, early_bird_enabled, early_bird_price_rappen, early_bird_deadline,
  currency, status
)
select o.id, $str$2026/27$str$, $str$Halbjahreskurs$str$, $str$Breite Vorbereitung über das ganze Semester$str$, $str$Optimale und nachhaltige Vorbereitung auf die Aufnahmeprüfung ins Kurzzeitgymnasium — gezielte, individuelle Förderung in Mathematik und Deutsch.$str$,
  349000, false, null, null,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$2-3-sek$str$ and o.kurstyp = $str$halbjahreskurs$str$ and o.slug = $str$halbjahreskurs$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, early_bird_enabled, early_bird_price_rappen, early_bird_deadline,
  currency, status
)
select o.id, $str$2026/27$str$, $str$Intensivkurs-Sportferien$str$, $str$Intensives Training in den Sportferien$str$, $str$Ideal für Kinder, die sich intensiv auf die Prüfungsaufgaben und die Prüfungssituation vorbereiten wollen – inklusive praktischer Tipps & Tricks für die Gymiprüfung.$str$,
  119500, false, null, null,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$2-3-sek$str$ and o.kurstyp = $str$intensivkurs$str$ and o.slug = $str$intensivkurs-sportferien$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, early_bird_enabled, early_bird_price_rappen, early_bird_deadline,
  currency, status
)
select o.id, $str$2026/27$str$, $str$Prüfungssimulation$str$, $str$Offen für alle$str$, $str$Eine echte Aufnahmeprüfung unter realen Bedingungen — inklusive schriftlicher Bewertung. Auch ohne vorherige Kursteilnahme buchbar.$str$,
  14500, false, null, null,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$2-3-sek$str$ and o.kurstyp = $str$pruefungssimulation$str$ and o.slug = $str$pruefungssimulation$str$
on conflict (offer_id, school_year) do nothing;

insert into public.offer_editions (
  offer_id, school_year, public_title, tagline, description,
  regular_price_rappen, early_bird_enabled, early_bird_price_rappen, early_bird_deadline,
  currency, status
)
select o.id, $str$2026/27$str$, $str$Selbststudium$str$, $str$Selbststudium · 2./3. Sek$str$, $str$Zugriff auf Übungsaufgaben, alte Prüfungen mit Lösungen und persönliches Feedback zu deinen eigenen Aufsätzen — flexibel von zu Hause aus, im eigenen Tempo.$str$,
  19000, false, null, null,
  $str$CHF$str$, 'published'
from public.offers o
where o.audience_id = $str$2-3-sek$str$ and o.kurstyp = $str$selbststudium$str$ and o.slug = $str$selbststudium$str$
on conflict (offer_id, school_year) do nothing;
