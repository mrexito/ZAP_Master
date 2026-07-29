-- Nur die öffentliche Bezeichnung ändert sich. Der stabile Kurstyp und die Slugs
-- bleiben weiterhin "halbjahreskurs", damit bestehende URLs und Referenzen gültig bleiben.
update public.offer_editions as edition
set public_title = replace(edition.public_title, 'Halbjahreskurs', 'Vorkurs')
from public.offers as offer
where offer.id = edition.offer_id
  and offer.kurstyp = 'halbjahreskurs'
  and edition.public_title like '%Halbjahreskurs%';
