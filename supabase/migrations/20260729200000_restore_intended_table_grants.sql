-- Restores the table-level grants that supabase/tests/database/ already expects, but which
-- notaqfguhhjpvmagvcic never actually has (found 29.07.2026 via a GRANT/REVOKE-preserving schema
-- dump plus a full local pgTAP run against it — see
-- docs/migration-evidence/2026-07-29-baseline-adoption-decision.md, Abschnitt 6, for the full
-- table list and how this was found). Every table below currently has plain GRANT ALL for
-- anon/authenticated on live; the REVOKEs that the archived hardening migrations
-- (supabase/legacy-migrations/) already intended never took effect there — same failure mode as
-- the already-fixed early-bird-price bug and the missing school_holiday_weeks table
-- (datenmodell-review.md, Abschnitt 3/6.1).
--
-- Statements below are copied from the archived migrations, not reinvented, with one exception
-- (section 1): the archived 20260719190025_booking_hardening_phase_a.sql never revoked INSERT
-- from anon on intensivwoche_anmeldungen, even though its own test
-- (supabase/tests/database/0005_booking_hardening.sql, "anon hat sonst keine Tabellenrechte mehr")
-- already required it -- a genuine gap in that migration, not just a never-applied one. Fixed here.
--
-- Deliberately NOT touched: TRUNCATE/REFERENCES/TRIGGER/MAINTAIN on the publicly-readable tables
-- below (offers, offer_editions, course_sessions, audit_log, material_areas,
-- self_study_enrollments, material_access_grants, release_content_catalog) — the archived
-- migrations never revoked those either, no pgTAP test requires it, and stripping them now would
-- be new hardening beyond what this migration restores. Flagged as a separate, lower-priority
-- follow-up in the runbook, not fixed here.

-- ============================================================================
-- 1) intensivwoche_anmeldungen / intensivwoche_buchungsversuche
--    (supabase/tests/database/0005_booking_hardening.sql, 0006_booking_hardening_phase_b.sql)
-- ============================================================================

REVOKE INSERT, REFERENCES, DELETE, TRIGGER, TRUNCATE, MAINTAIN, UPDATE
  ON TABLE public.intensivwoche_anmeldungen FROM anon;

REVOKE REFERENCES, TRIGGER, TRUNCATE, MAINTAIN
  ON TABLE public.intensivwoche_anmeldungen FROM authenticated;

REVOKE ALL ON TABLE public.intensivwoche_buchungsversuche FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 2) offers / offer_editions / course_sessions / audit_log
--    (supabase/tests/database/0008_offer_editions_schema.sql)
-- ============================================================================

REVOKE INSERT, UPDATE, DELETE ON TABLE public.offers FROM anon, authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.offer_editions FROM anon, authenticated;
GRANT INSERT, UPDATE ON TABLE public.offer_editions TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.course_sessions FROM anon, authenticated;
GRANT INSERT, UPDATE ON TABLE public.course_sessions TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.audit_log FROM anon, authenticated;
GRANT INSERT ON TABLE public.audit_log TO authenticated;

-- ============================================================================
-- 3) material_areas / self_study_enrollments / material_access_grants
--    (supabase/tests/database/0007_material_access_schema.sql,
--    0017_material_access_grant_admin_and_storage.sql)
-- ============================================================================

REVOKE INSERT, UPDATE, DELETE ON TABLE public.material_areas FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.self_study_enrollments FROM anon, authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.material_access_grants FROM anon, authenticated;
GRANT INSERT, UPDATE ON TABLE public.material_access_grants TO authenticated;

-- ============================================================================
-- 4) Tagesfreigaben: course_days / release_content_catalog / daily_releases / daily_release_items
--    (supabase/tests/database/0011_daily_releases_schema.sql)
-- ============================================================================

REVOKE ALL ON TABLE public.course_days FROM anon;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.release_content_catalog FROM anon;
REVOKE UPDATE, DELETE ON TABLE public.release_content_catalog FROM authenticated;

REVOKE ALL ON TABLE public.daily_releases FROM anon;
REVOKE ALL ON TABLE public.daily_release_items FROM anon;

-- ============================================================================
-- 5) Arbeitszeit/Lohn: sechs Tabellen, anon-only (admin-only Bereich, kein oeffentliches Lesen)
--    (supabase/tests/database/0013_work_time_payroll_schema.sql)
-- ============================================================================

REVOKE ALL ON TABLE public.teacher_assignments FROM anon;
REVOKE ALL ON TABLE public.work_entries FROM anon;
REVOKE ALL ON TABLE public.teacher_rate_agreements FROM anon;
REVOKE ALL ON TABLE public.payroll_periods FROM anon;
REVOKE ALL ON TABLE public.payroll_snapshots FROM anon;
REVOKE ALL ON TABLE public.payroll_snapshot_lines FROM anon;

-- ============================================================================
-- 6) Finanzen: fuenf Tabellen, anon-only + financial_events bleibt fuer authenticated append-only
--    (supabase/tests/database/0016_financial_cockpit_schema.sql)
-- ============================================================================

REVOKE ALL ON TABLE public.financial_events FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.financial_events FROM authenticated;

REVOKE ALL ON TABLE public.expense_entries FROM anon;
REVOKE ALL ON TABLE public.financial_periods FROM anon;
REVOKE ALL ON TABLE public.budgets FROM anon;
REVOKE ALL ON TABLE public.financial_adjustments FROM anon;
