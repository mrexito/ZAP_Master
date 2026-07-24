-- Buchbare Termine fuer den Intensivkurs der 6. Klasse.
-- Die IDs entsprechen den stabilen SessionDefinition-IDs im Marketing-Katalog.
-- Dadurch kann das bestehende, atomare book_intensivwoche_kurs()-RPC direkt verwendet werden.

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
  (9001, 'Intensivkurs 6. Klasse – Kurs B', 'deutsch', 'Deutsch und Mathematik – Vorbereitung auf die Gymiprüfung', 'Fünftägiger Intensivkurs inklusive Prüfungssimulation am Mittwoch.', '2027-02-15', '2027-02-19', '09.00–12.15', 'Zürich HB', 1195.00, 10, ARRAY['6. Klasse'], 'ZAP', ARRAY['Prüfungssimulation'], true),
  (9003, 'Intensivkurs 6. Klasse – Kurs C', 'deutsch', 'Deutsch und Mathematik – Vorbereitung auf die Gymiprüfung', 'Fünftägiger Intensivkurs inklusive Prüfungssimulation am Mittwoch.', '2027-02-15', '2027-02-19', '13.15–16.30', 'Zürich HB', 1195.00, 10, ARRAY['6. Klasse'], 'ZAP', ARRAY['Prüfungssimulation'], true),
  (9004, 'Intensivkurs 6. Klasse – Kurs D', 'deutsch', 'Deutsch und Mathematik – Vorbereitung auf die Gymiprüfung', 'Fünftägiger Intensivkurs inklusive Prüfungssimulation am Mittwoch.', '2027-02-15', '2027-02-19', '09.00–12.15', 'Winterthur', 1195.00, 10, ARRAY['6. Klasse'], 'ZAP', ARRAY['Prüfungssimulation'], true),
  (9005, 'Intensivkurs 6. Klasse – Kurs E', 'deutsch', 'Deutsch und Mathematik – Vorbereitung auf die Gymiprüfung', 'Fünftägiger Intensivkurs inklusive Prüfungssimulation am Mittwoch.', '2027-02-22', '2027-02-26', '09.00–12.15', 'Winterthur', 1195.00, 10, ARRAY['6. Klasse'], 'ZAP', ARRAY['Prüfungssimulation'], true),
  (9006, 'Intensivkurs 6. Klasse – Kurs F', 'deutsch', 'Deutsch und Mathematik – Vorbereitung auf die Gymiprüfung', 'Fünftägiger Intensivkurs inklusive Prüfungssimulation am Mittwoch.', '2027-02-22', '2027-02-26', '13.15–16.30', 'Winterthur', 1195.00, 10, ARRAY['6. Klasse'], 'ZAP', ARRAY['Prüfungssimulation'], true),
  (9007, 'Intensivkurs 6. Klasse – Kurs G', 'deutsch', 'Deutsch und Mathematik – Vorbereitung auf die Gymiprüfung', 'Fünftägiger Intensivkurs inklusive Prüfungssimulation am Mittwoch.', '2027-03-01', '2027-03-05', '09.00–12.15', 'Zürich HB', 1195.00, 10, ARRAY['6. Klasse'], 'ZAP', ARRAY['Prüfungssimulation'], true),
  (9002, 'Intensivkurs 6. Klasse – Kurs A', 'deutsch', 'Deutsch und Mathematik – Vorbereitung auf die Gymiprüfung', 'Fünftägiger Intensivkurs inklusive Prüfungssimulation am Mittwoch.', '2027-02-08', '2027-02-12', '09.00–12.15', 'Winterthur', 1195.00, 10, ARRAY['6. Klasse'], 'ZAP', ARRAY['Prüfungssimulation'], true),
  (9008, 'Intensivkurs 6. Klasse – Kurs H', 'deutsch', 'Deutsch und Mathematik – Vorbereitung auf die Gymiprüfung', 'Fünftägiger Intensivkurs inklusive Prüfungssimulation am Mittwoch.', '2027-03-01', '2027-03-05', '13.15–16.30', 'Zürich HB', 1195.00, 10, ARRAY['6. Klasse'], 'ZAP', ARRAY['Prüfungssimulation'], true)
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
