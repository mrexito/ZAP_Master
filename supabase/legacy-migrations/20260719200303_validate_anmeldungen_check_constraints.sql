-- Abschluss von 20260719190025_booking_hardening_phase_a.sql: die dort NOT VALID angelegten
-- sechs CHECK-Constraints werden jetzt validiert. Vorab read-only gegen die Live-Daten geprüft
-- (19.07.2026): 0 Verletzer bei allen sechs Constraints. VALIDATE CONSTRAINT scannt bestehende
-- Zeilen, ändert aber keine Daten und keine Constraint-Definition -- bei 0 Verletzern ohne Risiko.

ALTER TABLE public.intensivwoche_anmeldungen VALIDATE CONSTRAINT anmeldungen_child_firstname_length_check;
ALTER TABLE public.intensivwoche_anmeldungen VALIDATE CONSTRAINT anmeldungen_child_lastname_length_check;
ALTER TABLE public.intensivwoche_anmeldungen VALIDATE CONSTRAINT anmeldungen_child_class_level_length_check;
ALTER TABLE public.intensivwoche_anmeldungen VALIDATE CONSTRAINT anmeldungen_parent_phone_format_check;
ALTER TABLE public.intensivwoche_anmeldungen VALIDATE CONSTRAINT anmeldungen_notes_length_check;
ALTER TABLE public.intensivwoche_anmeldungen VALIDATE CONSTRAINT anmeldungen_parent_email_format_check;
