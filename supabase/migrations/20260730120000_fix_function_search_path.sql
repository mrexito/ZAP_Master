-- Security-Advisor-Fund (WARN, function_search_path_mutable, erneut geprüft 30.07.2026): sechs
-- Funktionen hatten keinen fest gesetzten search_path. Anders als die bereits gehärteten
-- SECURITY DEFINER-Funktionen (siehe legacy-migrations/20260719145330_harden_definer_search_path_and_realtime.sql,
-- deckte nur SECURITY DEFINER-Funktionen ab) sind fünf der sechs hier reine, nicht-SECURITY-DEFINER
-- Trigger-Funktionen, die bei dieser früheren Härtung nicht mitgefasst wurden. Ein unfester
-- search_path erlaubt es einem Rollenbesitzer mit CREATE-Recht in einem Schema vor `public` im
-- Suchpfad, Objekte gleichen Namens unterzuschieben (search_path hijacking) -- bei diesen
-- Funktionen ist das Risiko gering (keine SECURITY DEFINER, kein anon-Zugriff nötig), aber die
-- Härtung ist ein no-op für die bestehende Logik: alle sechs referenzieren Tabellen entweder gar
-- nicht (nur NEW/OLD) oder bereits vollständig schemaqualifiziert (public.courses,
-- public.course_occurrences in get_upcoming_courses), und now()/auth.uid() bleiben über
-- pg_catalog/das auth-Schema unabhängig vom search_path auflösbar.
--
-- Fix: search_path für alle sechs auf '' fixieren, exakt wie bei den bereits gehärteten
-- SECURITY DEFINER-Funktionen. Reines ALTER FUNCTION, keine Änderung an Funktionslogik oder
-- Berechtigungen.

ALTER FUNCTION public.get_upcoming_courses() SET search_path = '';
ALTER FUNCTION public.set_essay_review_timestamp() SET search_path = '';
ALTER FUNCTION public.update_correction_rubrics_updated_at() SET search_path = '';
ALTER FUNCTION public.update_mentorship_updated_at() SET search_path = '';
ALTER FUNCTION public.update_student_essays_updated_at() SET search_path = '';
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';
