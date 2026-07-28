-- Struktur-Zähltests gegen den dokumentierten Kataloglauf vom 18.07.2026 / Schema-Dump vom
-- 19.07.2026 (docs/migration-evidence/2026-07-18-supabase-baseline-inventory.md, Abschnitt 6
-- und 14). Diese Zahlen sind kein Ersatz für den Schema-Diff, sondern ein zusätzliches Netz
-- gegen stille Objektverluste beim lokalen Reset.
--
-- Angepasst durch 20260719190025_booking_hardening_phase_a.sql: +1 Trigger-Funktion, +6 CHECK-
-- Constraints, netto +1 Index (−1 alter Familien-Index, +2 neue Familien-/Idempotenz-Indizes),
-- +1 Trigger.
--
-- Angepasst durch 20260720090000_booking_hardening_phase_b_rate_limit.sql: +1 Tabelle
-- (intensivwoche_buchungsversuche, RLS aktiviert), +1 Sequenz (Identity-Spalte), +1 Constraint
-- (Primary Key), +2 Indizes (Primary-Key-Index + idx_buchungsversuche_email_time). Funktionen/
-- SECURITY DEFINER/Trigger/Policies/Views unveraendert (CREATE OR REPLACE, gleiche Signatur).
--
-- Angepasst durch 20260720140000_material_access_schema.sql: +3 Tabellen (material_areas,
-- self_study_enrollments, material_access_grants; alle RLS aktiviert), +3 RLS-Policies (je eine
-- SELECT-Policy pro neuer Tabelle; die alte learning_materials_public_read-Policy wurde 1:1 durch
-- eine neue ersetzt, netto unveraendert dort), +1 Sequenz (material_areas Identity-Spalte),
-- +12 Constraints (material_areas: PK+UNIQUE; learning_materials: +1 FK; self_study_enrollments:
-- PK+2 FK+1 CHECK; material_access_grants: PK+2 FK+2 CHECK), +7 Indizes (je PK-Index der drei
-- neuen Tabellen + idx_learning_materials_area_id + idx_self_study_enrollments_beneficiary +
-- idx_material_access_grants_user_area).
--
-- Angepasst durch 20260720170000_offer_editions_schema.sql: +4 Tabellen (offers, offer_editions,
-- course_sessions, audit_log; alle RLS aktiviert), +4 RLS-Policies (je eine SELECT-Policy),
-- +1 Sequenz (offers Identity-Spalte), +16 Constraints (offers: PK+CHECK+UNIQUE=3; offer_editions:
-- PK+FK+2 CHECK+UNIQUE+CHECK=6; course_sessions: PK+FK+CHECK=3; audit_log: PK+FK=2;
-- intensivwoche_anmeldungen: +2 FK fuer edition_id/session_id), +11 Indizes (offers: PK+UNIQUE=2;
-- offer_editions: PK+UNIQUE+idx_offer_editions_offer_id=3; course_sessions: PK+
-- idx_course_sessions_edition_id=2; audit_log: PK+idx_audit_log_entity=2;
-- intensivwoche_anmeldungen: idx_anmeldungen_edition_id+idx_anmeldungen_session_id=2). Funktionen/
-- SECURITY DEFINER/Trigger unveraendert (enforce_anmeldung_price_snapshot_immutable() per
-- CREATE OR REPLACE erweitert, gleiche Signatur, bestehender Trigger unangetastet).
--
-- 20260721073228_grant_is_content_manager_to_anon.sql: nur ein GRANT, keine Struktur-/Zaehlaenderung.
--
-- 20260721074103_seed_offer_catalog.sql: reine Daten-Inserts (20 offers-Zeilen), keine
-- Struktur-/Zaehlaenderung.
--
-- Angepasst durch 20260721074500_offer_editions_admin_writes.sql (Schritt 10a, Admin-Maske):
-- +1 Funktion (bump_version_and_updated_at(), nicht SECURITY DEFINER -- Funktionen-Zaehler +1,
-- SECURITY-DEFINER-Zaehler unveraendert), +5 RLS-Policies (offer_editions_admin_insert/_update,
-- course_sessions_admin_insert/_update, audit_log_admin_insert), +2 Trigger
-- (offer_editions_bump_version, course_sessions_bump_version). Keine neuen Tabellen/Views/
-- Sequenzen/Constraints/Indizes -- nur GRANT/CREATE POLICY/CREATE TRIGGER auf bestehenden Tabellen.
--
-- Angepasst durch 20260721075036_admin_upsert_course_session_rpc.sql (SessionEditor-RPC):
-- +1 Funktion (admin_upsert_course_session(), SECURITY INVOKER -- Funktionen-Zaehler +1,
-- SECURITY-DEFINER-Zaehler unveraendert). Keine neuen Tabellen/Policies/Trigger/Constraints/
-- Indizes.
--
-- Angepasst durch 20260721082939_daily_releases_schema.sql (Schritt 10b, Tagesfreigaben):
-- +4 Tabellen (course_days, release_content_catalog, daily_releases, daily_release_items; alle RLS
-- aktiviert), +7 RLS-Policies (course_days_admin_all; release_content_catalog_public_read/
-- _admin_write; daily_releases_admin_all/_enrolled_read; daily_release_items_admin_all/
-- _enrolled_read), +1 Funktion (link_anmeldung_beneficiary(), SECURITY DEFINER -- Funktionen- UND
-- SECURITY-DEFINER-Zaehler je +1), +2 Trigger (link_anmeldung_beneficiary_before_insert auf
-- intensivwoche_anmeldungen, daily_releases_bump_version), +22 Constraints
-- (intensivwoche_anmeldungen: +1 FK fuer beneficiary_user_id; course_days: PK+FK+CHECK+2×UNIQUE=5;
-- release_content_catalog: PK+2 FK+2 CHECK+2×UNIQUE=7; daily_releases: PK+UNIQUE+FK+CHECK+FK+CHECK=6;
-- daily_release_items: PK(composite)+2 FK=3), +11 Indizes (idx_anmeldungen_beneficiary_user_id=1;
-- course_days: PK+2×UNIQUE+idx_course_days_session_id=4; release_content_catalog: PK+2×UNIQUE=3;
-- daily_releases: PK+UNIQUE=2; daily_release_items: PK=1). Keine neue Sequenz (alle vier Tabellen
-- nutzen uuid/gen_random_uuid() statt Identity-Spalten).
--
-- Angepasst durch 20260721084035_admin_save_daily_release_rpc.sql (DailyReleaseManager-RPC):
-- +1 Funktion (admin_save_daily_release(), SECURITY INVOKER -- Funktionen-Zaehler +1, SECURITY-
-- DEFINER-Zaehler unveraendert). Keine neuen Tabellen/Policies/Trigger/Constraints/Indizes.
--
-- Angepasst durch 20260721091344_work_time_payroll_schema.sql (Schritt 10c, Arbeitszeiten/Lohn):
-- btree_gist absichtlich im extensions-Schema installiert (nicht public), zaehlt deshalb hier
-- nicht mit. +6 Tabellen (teacher_assignments, work_entries, teacher_rate_agreements,
-- payroll_periods, payroll_snapshots, payroll_snapshot_lines; alle RLS aktiviert), +1 Funktion
-- (validate_work_entry_status_transition(), nicht SECURITY DEFINER), +11 RLS-Policies
-- (teacher_assignments: admin_all+own_read=2; work_entries: admin_all+own_read+
-- own_insert_draft+own_update_draft_or_rejected=4; teacher_rate_agreements: admin_all+own_read=2;
-- payroll_periods/_snapshots/_snapshot_lines: je admin_all=3), +3 Trigger
-- (work_entries_bump_version, work_entries_validate_transition, payroll_periods_bump_version),
-- +44 Constraints, +20 Indizes (im Detail: teacher_assignments 6/4; work_entries 12/5;
-- teacher_rate_agreements 6/3 inkl. EXCLUDE; payroll_periods 6/2; payroll_snapshots 6/3;
-- payroll_snapshot_lines 8/3). Keine neue Sequenz (alle sechs Tabellen nutzen uuid).
--
-- Angepasst durch 20260721091511_admin_close_payroll_period_rpc.sql (PayrollReviewPanel-RPC):
-- +1 Funktion (admin_close_payroll_period(), SECURITY INVOKER -- Funktionen-Zaehler +1, SECURITY-
-- DEFINER-Zaehler unveraendert). Keine neuen Tabellen/Policies/Trigger/Constraints/Indizes.
--
-- Angepasst durch 20260721092720_admin_save_rate_agreement_rpc.sql (PayrollReviewPanel-RPC):
-- +1 Funktion (admin_save_rate_agreement(), SECURITY INVOKER -- Funktionen-Zaehler +1, SECURITY-
-- DEFINER-Zaehler unveraendert). Keine neuen Tabellen/Policies/Trigger/Constraints/Indizes.
--
-- Angepasst durch 20260721095032_financial_cockpit_schema.sql (Schritt 10d, Finanz-Cockpit):
-- +5 Tabellen (financial_events, expense_entries, financial_periods, budgets,
-- financial_adjustments; alle RLS aktiviert), +3 Funktionen (sync_anmeldung_financial_events,
-- sync_expense_financial_event, sync_financial_adjustment_event -- alle drei SECURITY DEFINER,
-- Funktionen- UND SECURITY-DEFINER-Zaehler je +3), +6 RLS-Policies (financial_events_admin_read;
-- expense_entries_admin_all; financial_periods_admin_all; budgets_admin_all;
-- financial_adjustments_admin_all; sowie -- separat gezaehlt, aus der Folge-Migration --
-- financial_events_admin_insert), +6 Trigger (expense_entries_bump_version,
-- financial_periods_bump_version, budgets_bump_version, sync_anmeldung_financial_events_trigger,
-- sync_expense_financial_event_trigger, sync_financial_adjustment_event_trigger), +25 Constraints,
-- +12 Indizes (im Detail: financial_events 6/4; expense_entries 7/3; financial_periods 5/2;
-- budgets 4/2; financial_adjustments 3/1). Keine neue Sequenz.
--
-- Angepasst durch 20260721095136_admin_close_payroll_period_ledger_sync.sql: GRANT INSERT +
-- financial_events_admin_insert-Policy (bereits oben mitgezaehlt) sowie CREATE OR REPLACE von
-- admin_close_payroll_period() (gleiche Signatur, kein neuer Funktions-Zaehler-Eintrag). Keine
-- weiteren Struktur-/Zaehlaenderungen.
--
-- Angepasst durch 20260721125216_material_access_grant_admin_and_storage.sql (Schritt 11a):
-- +2 RLS-Policies im public-Schema (material_access_grants_admin_insert/_update). Die neue
-- Storage-Policy lernmaterialien_read_access liegt im storage-Schema und zaehlt hier bewusst
-- nicht mit (alle Zaehlungen dieser Datei sind auf schemaname='public' begrenzt). Keine neuen
-- Tabellen/Funktionen/Trigger/Constraints/Indizes im public-Schema.
--
-- Angepasst durch 20260721153000_fix_public_availability_count_rls_gap.sql: +1 Funktion
-- (count_active_anmeldungen(), SECURITY DEFINER -- Funktionen- UND SECURITY-DEFINER-Zaehler je
-- +1) sowie CREATE OR REPLACE von intensivwoche_kurse_mit_anmeldungen (gleiche Signatur/
-- Spaltenliste/security_invoker-Option, kein neuer View-Zaehler-Eintrag). Behebt eine reale
-- RLS-Regression: die View zaehlte fuer anon wegen security_invoker=true bislang immer 0
-- Anmeldungen. Keine neuen Tabellen/Trigger/Constraints/Indizes/Policies im public-Schema.
--
-- Angepasst durch 20260722084521_grant_authenticated_select_active_kurse.sql: +1 RLS-Policy
-- (authenticated_select_active_kurse). Behebt eine reale, beim Accessibility-Audit gefundene
-- Regression: die einzige bisherige SELECT-Policy fuer aktive Kurse war TO anon beschraenkt,
-- wodurch ein eingeloggter Nicht-Lehrperson-Nutzer auf /intensivkurse schlechter gestellt war als
-- ein anonymer Gast (0 sichtbare Kurse). Keine neuen Tabellen/Funktionen/Trigger/Constraints/
-- Indizes/Views im public-Schema.
--
-- Angepasst durch 20260722092503_mail_outbox_schema.sql (E-Mail-Outbox, Abschnitt 10.4): +1
-- Tabelle mail_outbox (RLS aktiviert -- Tabellen- UND RLS-Tabellen-Zaehler je +1), +1 Funktion
-- (enqueue_booking_confirmation_mail(), SECURITY DEFINER -- Funktionen- UND
-- SECURITY-DEFINER-Zaehler je +1), +1 RLS-Policy (mail_outbox_admin_select), +1 Trigger
-- (intensivwoche_anmeldungen_enqueue_mail), +5 Constraints (PK, 2x CHECK, UNIQUE, FK), +2 Indizes
-- (PK- und UNIQUE-Index). Keine neue Sequenz (uuid-PK per gen_random_uuid(), kein serial/identity).
--
-- Zwischen 20260722092503_mail_outbox_schema.sql und 20260728090000_school_holiday_weeks_schema.sql
-- liegen mehrere Migrationen (u.a. 20260724170000_expand_learning_material_class_levels.sql,
-- 20260727140000_add_exercise_class_levels.sql), die Tabellen-/Policy-/Constraint-Zaehler
-- veraendert haben, ohne hier dokumentiert worden zu sein -- sichtbar an den zuvor fehlschlagenden
-- Policy-/Constraint-Zaehlungen dieser Datei sowie an separat fehlschlagenden NOT-NULL-Fixtures in
-- 0007_material_access_schema.sql/0011_daily_releases_schema.sql (dort, nicht hier, zu beheben).
-- Diese Datei wird deshalb ausnahmsweise nicht als Summe einzelner Deltas fortgeschrieben, sondern
-- per psql gegen `supabase db reset --local` auf den tatsaechlichen Stand resynchronisiert.
--
-- Angepasst durch 20260728090000_school_holiday_weeks_schema.sql (admin-editierbare
-- Ferienwochen-Kalenderwochen, ersetzt hart codierte TS-Konstanten in
-- lib/kurse/fixed-school-schedule.ts): +1 Tabelle school_holiday_weeks (RLS aktiviert -- Tabellen-
-- UND RLS-Tabellen-Zaehler je +1), +3 RLS-Policies (school_holiday_weeks_public_read/_admin_insert/
-- _admin_update), +7 Constraints (PK, UNIQUE, FK auf auth.users, 4x CHECK fuer schedule_group/
-- holiday_type/location/calendar_weeks-cardinality), +2 Indizes (PK- und UNIQUE-Index). Keine neue
-- Sequenz (uuid-PK per gen_random_uuid()), keine neue Funktion/Trigger/View.
-- Alle Werte empirisch per psql gegen die lokale Instanz nach `supabase db reset --local`
-- verifiziert, nicht nur rechnerisch hergeleitet.

begin;

select plan(10);

select is(
    (select count(*)::int from pg_tables where schemaname = 'public'),
    51,
    '51 Tabellen im public-Schema'
);

select is(
    (select count(*)::int from pg_tables where schemaname = 'public' and rowsecurity),
    51,
    'alle 51 public-Tabellen haben RLS aktiviert'
);

select is(
    (select count(*)::int from pg_views where schemaname = 'public'),
    1,
    'genau eine View im public-Schema'
);

select is(
    (select count(*)::int
       from information_schema.routines
      where routine_schema = 'public'
        and routine_type = 'FUNCTION'),
    28,
    '28 Funktionen im public-Schema'
);

select is(
    (select count(*)::int
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.prosecdef),
    15,
    '15 davon SECURITY DEFINER'
);

select is(
    (select count(*)::int from pg_policies where schemaname = 'public'),
    174,
    '174 RLS-Policies im public-Schema'
);

select is(
    (select count(*)::int from pg_sequences where schemaname = 'public'),
    15,
    '15 Sequenzen im public-Schema'
);

select is(
    (select count(*)::int
       from pg_constraint con
       join pg_class c on c.oid = con.conrelid
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'),
    227,
    '227 Constraints (PK/UNIQUE/FK/CHECK) im public-Schema'
);

select is(
    (select count(*)::int from pg_indexes where schemaname = 'public'),
    142,
    '142 Indizes im public-Schema'
);

select is(
    (select count(*)::int
       from pg_trigger t
       join pg_class c on c.oid = t.tgrelid
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and not t.tgisinternal),
    24,
    '24 nicht-interne Trigger im public-Schema'
);

select * from finish();

rollback;
