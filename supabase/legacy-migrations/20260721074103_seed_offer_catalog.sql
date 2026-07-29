-- offers ist laut Abschnitt 2.12 des Architektur-Briefings der stabile fachliche Schluessel
-- (audience_id, kurstyp, slug) -- reine Katalog-Referenzdaten, keine jaehrlich veraenderlichen
-- Inhalte (die liegen in offer_editions). Genau wie material_areas (Migration 20260720140000)
-- gehoert diese Liste deshalb als deterministische Reihe in eine Migration, nicht in
-- supabase/seed.sql: sie ist auf jeder Umgebung (lokal/Staging/Live) identisch und Voraussetzung
-- fuer die Admin-Maske (Schritt 10a) -- der "Kursangebot"-Selector dort muss alle 20 stabilen
-- Angebote zeigen koennen, auch die redaktionell noch nicht befuellten (BMS-Halbjahreskurs,
-- 5.-Klasse-Lerncamp).
--
-- Werte 1:1 aus den bereits vorhandenen Next.js-Fixtures (types/marketing.fixtures.ts) bzw. aus
-- der Admin-Referenz Layout_Admin_Kursangebot_Maske.html (dort exakt 20 <option>-Eintraege in 7
-- <optgroup>s) uebernommen -- keine neuen Slugs erfunden. Die Reihenfolge folgt der Referenzdatei,
-- damit die vergebenen bigint-IDs vorhersehbar bleiben. audience_id/kurstyp sind Freitext-Spalten
-- (siehe Migration 20260720170000); die zulaessigen Werte sind ausschliesslich ueber die
-- Anwendung/den CHECK auf kurstyp begrenzt, es gibt keine FK auf eine Audience-Tabelle.
--
-- 5. Klasse Lerncamp existierte bereits als Einzeil-Insert in supabase/seed.sql (Platzhalter-Preis-
-- Runde). Das Duplikat wird dort im selben Zug entfernt -- diese Migration ist ab jetzt die einzige
-- Quelle fuer offers-Zeilen, seed.sql bleibt fuer offer_editions (jaehrliche Inhalte) zustaendig.
insert into public.offers (audience_id, kurstyp, slug) values
  ('4', 'halbjahreskurs', 'halbjahreskurs'),
  ('4', 'intensivkurs', 'lerncamp-sportferien'),
  ('5', 'halbjahreskurs', 'halbjahreskurs'),
  ('5', 'intensivkurs', 'lerncamp-sportferien'),
  ('6', 'intensivkurs', 'intensivkurs-sportferien'),
  ('6', 'halbjahreskurs', 'halbjahreskurs'),
  ('6', 'pruefungssimulation', 'pruefungssimulation'),
  ('6', 'selbststudium', 'selbststudium'),
  ('1-sek', 'halbjahreskurs', 'vorkurs'),
  ('1-sek', 'intensivkurs', 'lerncamp-sportferien'),
  ('2-3-sek', 'intensivkurs', 'intensivkurs-sportferien'),
  ('2-3-sek', 'halbjahreskurs', 'halbjahreskurs'),
  ('2-3-sek', 'pruefungssimulation', 'pruefungssimulation'),
  ('2-3-sek', 'selbststudium', 'selbststudium'),
  ('bms', 'halbjahreskurs', 'halbjahreskurs'),
  ('bms', 'intensivkurs', 'intensivkurs'),
  ('bms', 'pruefungssimulation', 'pruefungssimulation'),
  ('bms', 'selbststudium', 'selbststudium'),
  ('matura', 'halbjahreskurs', 'halbjahreskurs'),
  ('matura', 'intensivkurs', 'intensivwoche');
