-- Die Detailseite der Prüfungssimulation 6. Klasse folgt ihrer verbindlichen Vorlage
-- Layout_6_Klasse_Pruefungssimulation.html: CHF 125 pro Teilnahme.
UPDATE public.offer_editions
SET
  regular_price_rappen = 12500,
  updated_at = now()
WHERE offer_id IN (
  SELECT id
  FROM public.offers
  WHERE audience_id = '6'
    AND kurstyp = 'pruefungssimulation'
    AND slug = 'pruefungssimulation'
);

-- Alle vier Termine aus der Vorlage werden als direkt buchbare Legacy-Sessions materialisiert.
INSERT INTO public.intensivwoche_kurse (
  id,
  name,
  fach,
  beschreibung,
  detail_beschreibung,
  start_datum,
  end_datum,
  uhrzeit,
  ort,
  preis,
  max_teilnehmer,
  klassenstufen,
  lehrer,
  highlights,
  ist_aktiv
)
VALUES
  (9101, 'Prüfungssimulation 6. Klasse – Dienstag, 16. Februar', 'deutsch', 'Prüfungssimulation unter realistischen Bedingungen', 'Deutsch und Mathematik nach aktuellem Prüfungsformat mit Aufsatzkorrektur.', '2027-02-16', '2027-02-16', '08.00–11.45', 'Zürich HB', 125.00, 20, ARRAY['6. Klasse'], 'ZAP', ARRAY['Aufsatzkorrektur'], true),
  (9102, 'Prüfungssimulation 6. Klasse – Donnerstag, 18. Februar', 'deutsch', 'Prüfungssimulation unter realistischen Bedingungen', 'Deutsch und Mathematik nach aktuellem Prüfungsformat mit Aufsatzkorrektur.', '2027-02-18', '2027-02-18', '08.00–11.45', 'Winterthur', 125.00, 20, ARRAY['6. Klasse'], 'ZAP', ARRAY['Aufsatzkorrektur'], true),
  (9103, 'Prüfungssimulation 6. Klasse – Dienstag, 23. Februar', 'deutsch', 'Prüfungssimulation unter realistischen Bedingungen', 'Deutsch und Mathematik nach aktuellem Prüfungsformat mit Aufsatzkorrektur.', '2027-02-23', '2027-02-23', '08.00–11.45', 'Zürich HB', 125.00, 20, ARRAY['6. Klasse'], 'ZAP', ARRAY['Aufsatzkorrektur'], true),
  (9104, 'Prüfungssimulation 6. Klasse – Samstag, 27. Februar', 'deutsch', 'Prüfungssimulation unter realistischen Bedingungen', 'Deutsch und Mathematik nach aktuellem Prüfungsformat mit Aufsatzkorrektur.', '2027-02-27', '2027-02-27', '08.00–11.45', 'Winterthur', 125.00, 20, ARRAY['6. Klasse'], 'ZAP', ARRAY['Aufsatzkorrektur'], true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  fach = EXCLUDED.fach,
  beschreibung = EXCLUDED.beschreibung,
  detail_beschreibung = EXCLUDED.detail_beschreibung,
  start_datum = EXCLUDED.start_datum,
  end_datum = EXCLUDED.end_datum,
  uhrzeit = EXCLUDED.uhrzeit,
  ort = EXCLUDED.ort,
  preis = EXCLUDED.preis,
  max_teilnehmer = EXCLUDED.max_teilnehmer,
  klassenstufen = EXCLUDED.klassenstufen,
  lehrer = EXCLUDED.lehrer,
  highlights = EXCLUDED.highlights,
  ist_aktiv = EXCLUDED.ist_aktiv,
  updated_at = now();
