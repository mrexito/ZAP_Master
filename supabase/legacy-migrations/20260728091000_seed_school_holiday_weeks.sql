-- Ueberfuehrt die bisher hart codierten Wochen aus lib/kurse/fixed-school-schedule.ts
-- (INTENSIVE_WEEKS_BY_GROUP, MATURA_INTENSIVE_WEEKS) fuer holiday_type='intensiv' 1:1 als Zeilen
-- fuer school_year='2026/27' -- der einzige aktuell in offer_editions verwendete Wert (siehe
-- 20260727130000_enable_early_bird_for_additional_vorkurse.sql). 'bms' erhaelt hier erstmals eine
-- eigene, unabhaengig editierbare Zeile statt des bisherigen impliziten Code-Fallbacks auf
-- 'langzeitgymi'.
--
-- holiday_type='vorkurs' verwendet dagegen von Anfang an reale, fachlich bestaetigte Werte pro
-- einzelner Klassenstufe (nicht mehr die bisherige gemeinsame Platzhalter-Liste je Gruppe -- siehe
-- Kommentar in 20260728090000_school_holiday_weeks_schema.sql): 4./5. Klasse und 1. Sek liegen im
-- Fruehlingssemester (KW 10-27 des zweiten Schuljahres-Kalenderjahres); 6. Klasse und 2./3. Sek
-- laufen als Halbjahreskurs bereits ab Herbst (KW 36-50 des ersten Kalenderjahres, dann KW 1-6 des
-- zweiten) -- deckt sich mit der in Abschnitt 6 des Architektur-Briefings dokumentierten
-- vierphasigen Sonderstellung dieser beiden Stufen. Mittwochs-Termine werden nicht separat
-- gespeichert, sondern in buildFixedVorkursSchedule() aus denselben Kalenderwochen wie Samstag
-- abgeleitet (ein Mi/Sa-Paar pro Woche).
INSERT INTO public.school_holiday_weeks (school_year, schedule_group, holiday_type, location, calendar_weeks)
VALUES
  ('2026/27', 'langzeitgymi', 'intensiv', 'Zürich HB', ARRAY[7, 8]),
  ('2026/27', 'langzeitgymi', 'intensiv', 'Winterthur', ARRAY[6, 7]),
  ('2026/27', 'kurzzeitgymi', 'intensiv', 'Zürich HB', ARRAY[7, 8]),
  ('2026/27', 'kurzzeitgymi', 'intensiv', 'Winterthur', ARRAY[6, 7]),
  ('2026/27', 'bms', 'intensiv', 'Zürich HB', ARRAY[7, 8]),
  ('2026/27', 'bms', 'intensiv', 'Winterthur', ARRAY[6, 7]),
  ('2026/27', 'matura', 'intensiv', 'Zürich HB', ARRAY[6, 7]),
  ('2026/27', '4', 'vorkurs', 'ALL', ARRAY[10, 11, 13, 14, 15, 16, 20, 21, 22, 23, 24, 25, 26]),
  ('2026/27', '5', 'vorkurs', 'ALL', ARRAY[20, 21, 22, 23, 24, 25, 26, 27]),
  ('2026/27', '1-sek', 'vorkurs', 'ALL', ARRAY[20, 21, 22, 23, 24, 25, 26, 27]),
  ('2026/27', '6', 'vorkurs', 'ALL', ARRAY[36, 37, 38, 39, 40, 43, 44, 45, 46, 47, 48, 49, 50, 1, 2, 3, 4, 5, 6]),
  ('2026/27', '2-3-sek', 'vorkurs', 'ALL', ARRAY[36, 37, 38, 39, 40, 43, 44, 45, 46, 47, 48, 49, 50, 1, 2, 3, 4, 5, 6])
ON CONFLICT (school_year, schedule_group, holiday_type, location) DO NOTHING;
