-- Einheitliche Frühbucherstruktur für die Vorkurse der 5. Klasse, 1. Sek und 2./3. Sek.
-- Betreiberentscheid 27.07.2026: CHF 3'190 regulär, Frühbucherpreis exakt 10 % tiefer.
update public.offer_editions as edition
set
  regular_price_rappen = 319000,
  early_bird_enabled = true,
  early_bird_price_rappen = 287100,
  early_bird_deadline = date '2026-07-31',
  version = edition.version + 1,
  updated_at = now()
from public.offers as offer
where offer.id = edition.offer_id
  and edition.school_year = '2026/27'
  and (
    (offer.audience_id = '5' and offer.kurstyp = 'halbjahreskurs' and offer.slug = 'halbjahreskurs')
    or (offer.audience_id = '1-sek' and offer.kurstyp = 'halbjahreskurs' and offer.slug = 'vorkurs')
    or (
      offer.audience_id = '2-3-sek'
      and offer.kurstyp = 'halbjahreskurs'
      and offer.slug = 'halbjahreskurs'
    )
  );
