-- Schritt 10c (Abschnitt 2.14/3/6 des Architektur-Briefings): Arbeitszeiten und Lohnvorbereitung.
-- teacher_assignments, work_entries, teacher_rate_agreements, payroll_periods, payroll_snapshots,
-- payroll_snapshot_lines -- alle bisher nicht vorhanden (greenfield).
--
-- Ueberlappungspruefung: teacher_rate_agreements hat echte valid_from/valid_until-Daten und bekommt
-- deshalb eine echte EXCLUDE-Constraint (braucht btree_gist). work_entries hat dagegen laut
-- Abschnitt 2.14 nur work_date + durationMinutes, keine Uhrzeit -- die vom Mockup suggerierte
-- "keine ueberlappenden Kurszeiten"-Pruefung liesse sich damit nur simulieren, nicht echt
-- verifizieren (intensivwoche_kurse.uhrzeit ist Freitext, kein strukturierter Zeitbereich). Diese
-- Migration verhindert deshalb nur den eindeutig sinnvollen Fall doppelter course_teaching-
-- Eintraege derselben Lehrperson fuer dieselbe Session am selben Tag (UNIQUE), erfindet aber keine
-- Uhrzeit-Ueberlappungspruefung ohne strukturierte Zeitdaten.

-- Wie alle anderen Extensions dieses Projekts (pgcrypto, uuid-ossp, pg_net, ...) gehoert
-- btree_gist ins extensions-Schema, nicht public -- sonst landen seine ~190 Operator-/
-- Support-Funktionen im public-Schema und verzerren jede schemaweite Zaehlung (siehe
-- 0001_baseline_structure_counts.sql).
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

-- ============================================================================
-- 1) teacher_assignments: welche Lehrperson ist welcher course_session zugeteilt.
-- ============================================================================

CREATE TABLE public.teacher_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id),
  session_id bigint NOT NULL REFERENCES public.course_sessions(id),
  role text NOT NULL CHECK (role IN ('lead', 'assistant', 'exam_supervisor')),
  valid_from date NOT NULL DEFAULT current_date,
  valid_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teacher_assignments_date_order CHECK (valid_until IS NULL OR valid_until >= valid_from),
  UNIQUE (teacher_id, session_id, role)
);

CREATE INDEX idx_teacher_assignments_teacher_id ON public.teacher_assignments (teacher_id);
CREATE INDEX idx_teacher_assignments_session_id ON public.teacher_assignments (session_id);

ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.teacher_assignments FROM anon;

CREATE POLICY teacher_assignments_admin_all
  ON public.teacher_assignments FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY teacher_assignments_own_read
  ON public.teacher_assignments FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid());

COMMENT ON TABLE public.teacher_assignments IS 'Zuteilung Lehrperson <-> course_session (Schritt 10c). Admin-Vollzugriff; Lehrpersonen sehen nur eigene Zuteilungen (fuer die Kurszeit-Vorauswahl in TeacherWorkEntryForm).';

-- ============================================================================
-- 2) work_entries: tatsaechlich geleistete Zeit.
-- ============================================================================

CREATE TABLE public.work_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id),
  activity_type text NOT NULL CHECK (
    activity_type IN ('course_teaching', 'exam_supervision', 'essay_feedback', 'coaching', 'preparation', 'administration', 'other')
  ),
  work_date date NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  session_id bigint REFERENCES public.course_sessions(id),
  submission_id uuid REFERENCES public.student_essays(id),
  note text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'locked')),
  version integer NOT NULL DEFAULT 1,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Abschnitt 2.14: "genau eine fachliche Quelle darf je Eintrag gesetzt sein" -- session_id und
  -- submission_id schliessen sich gegenseitig aus; preparation/administration/other duerfen beide
  -- NULL lassen (kein erzwungener Quellbezug fuer freiformige Taetigkeiten).
  CONSTRAINT work_entries_source_exclusive CHECK (NOT (session_id IS NOT NULL AND submission_id IS NOT NULL)),
  CONSTRAINT work_entries_course_teaching_needs_session CHECK (activity_type != 'course_teaching' OR session_id IS NOT NULL),
  CONSTRAINT work_entries_essay_feedback_needs_submission CHECK (activity_type != 'essay_feedback' OR submission_id IS NOT NULL),
  -- verhindert versehentliche Doppelerfassung derselben Kurssession am selben Tag (siehe
  -- Migrationskommentar oben zur nicht moeglichen echten Uhrzeit-Ueberlappungspruefung).
  UNIQUE (teacher_id, session_id, work_date)
);

CREATE INDEX idx_work_entries_teacher_id ON public.work_entries (teacher_id);
CREATE INDEX idx_work_entries_work_date ON public.work_entries (work_date);
CREATE INDEX idx_work_entries_status ON public.work_entries (status);

CREATE TRIGGER work_entries_bump_version
  BEFORE UPDATE ON public.work_entries
  FOR EACH ROW EXECUTE FUNCTION public.bump_version_and_updated_at();

CREATE FUNCTION public.validate_work_entry_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  IF (OLD.status = 'draft' AND NEW.status = 'submitted')
     OR (OLD.status = 'submitted' AND NEW.status IN ('approved', 'rejected'))
     OR (OLD.status = 'rejected' AND NEW.status = 'draft')
     OR (OLD.status = 'approved' AND NEW.status = 'locked') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'invalid_work_entry_status_transition' USING ERRCODE = '22023';
END;
$$;

COMMENT ON FUNCTION public.validate_work_entry_status_transition() IS 'Erzwingt die in Abschnitt 2.14 zulaessigen Statusuebergaenge: draft->submitted->approved|rejected, rejected->draft, approved->locked (nur ueber den Monatsabschluss). Jeder andere Uebergang wird abgelehnt.';

CREATE TRIGGER work_entries_validate_transition
  BEFORE UPDATE ON public.work_entries
  FOR EACH ROW EXECUTE FUNCTION public.validate_work_entry_status_transition();

ALTER TABLE public.work_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.work_entries FROM anon;

CREATE POLICY work_entries_admin_all
  ON public.work_entries FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY work_entries_own_read
  ON public.work_entries FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY work_entries_own_insert_draft
  ON public.work_entries FOR INSERT
  TO authenticated
  WITH CHECK (teacher_id = auth.uid() AND status = 'draft');

-- Nur draft/rejected sind fuer die Lehrperson selbst editierbar (USING), und sie darf das Ergebnis
-- nur wieder auf draft oder submitted setzen (WITH CHECK) -- approved/rejected/locked bleiben
-- ausschliesslich Admin-Aktionen, unabhaengig vom Transitions-Trigger (Verteidigung in der Tiefe).
CREATE POLICY work_entries_own_update_draft_or_rejected
  ON public.work_entries FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid() AND status IN ('draft', 'rejected'))
  WITH CHECK (teacher_id = auth.uid() AND status IN ('draft', 'submitted'));

COMMENT ON TABLE public.work_entries IS 'Geleistete Arbeitszeit (Schritt 10c, Abschnitt 2.14). Lehrpersonen verwalten nur eigene draft/rejected-Eintraege; Genehmigung/Zurueckweisung/Sperrung bleiben admin-only.';

-- ============================================================================
-- 3) teacher_rate_agreements: vom Administrator vereinbarter Stundensatz, zeitlich gueltig,
--    ueberlappungsfrei je Lehrperson (echte EXCLUDE-Constraint, da valid_from/valid_until Daten
--    sind).
-- ============================================================================

CREATE TABLE public.teacher_rate_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id),
  hourly_rate_rappen integer NOT NULL CHECK (hourly_rate_rappen > 0),
  currency text NOT NULL DEFAULT 'CHF',
  valid_from date NOT NULL,
  valid_until date,
  version integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teacher_rate_agreements_date_order CHECK (valid_until IS NULL OR valid_until >= valid_from),
  EXCLUDE USING gist (
    teacher_id WITH =,
    daterange(valid_from, coalesce(valid_until, 'infinity'::date), '[]') WITH &&
  )
);

CREATE INDEX idx_teacher_rate_agreements_teacher_id ON public.teacher_rate_agreements (teacher_id);

ALTER TABLE public.teacher_rate_agreements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.teacher_rate_agreements FROM anon;

CREATE POLICY teacher_rate_agreements_admin_all
  ON public.teacher_rate_agreements FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY teacher_rate_agreements_own_read
  ON public.teacher_rate_agreements FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid());

COMMENT ON TABLE public.teacher_rate_agreements IS 'Zeitlich gueltiger, admin-vereinbarter Stundensatz je Lehrperson (Schritt 10c). Nur Admins schreiben; eine neue Vereinbarung ueberschreibt keine fruehere (Abschnitt 2.14), die EXCLUDE-Constraint verhindert ueberlappende Gueltigkeitszeitraeume.';

-- ============================================================================
-- 4) payroll_periods / payroll_snapshots / payroll_snapshot_lines: Monatsabschluss, danach
--    unveraenderlich. Admin-only in jeder Hinsicht (auch Lesen) -- Abschnitt 2.14: "Schueler,
--    Eltern und oeffentliche Rollen erhalten keinerlei Zugriff auf Zeit-, Satz- oder Lohndaten";
--    die Lehrperson kennt ihren Stand bereits ueber die eigenen work_entries und braucht keinen
--    Snapshot-Zugriff.
-- ============================================================================

CREATE TABLE public.payroll_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL CHECK (year BETWEEN 2020 AND 2100),
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'review', 'locked')),
  version integer NOT NULL DEFAULT 1,
  locked_at timestamptz,
  locked_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, month)
);

CREATE TRIGGER payroll_periods_bump_version
  BEFORE UPDATE ON public.payroll_periods
  FOR EACH ROW EXECUTE FUNCTION public.bump_version_and_updated_at();

ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payroll_periods FROM anon;

CREATE POLICY payroll_periods_admin_all
  ON public.payroll_periods FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TABLE public.payroll_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.payroll_periods(id),
  teacher_id uuid NOT NULL REFERENCES auth.users(id),
  total_minutes integer NOT NULL CHECK (total_minutes >= 0),
  total_amount_rappen integer NOT NULL CHECK (total_amount_rappen >= 0),
  currency text NOT NULL DEFAULT 'CHF',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, teacher_id)
);

CREATE INDEX idx_payroll_snapshots_period_id ON public.payroll_snapshots (period_id);

ALTER TABLE public.payroll_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payroll_snapshots FROM anon;

CREATE POLICY payroll_snapshots_admin_all
  ON public.payroll_snapshots FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TABLE public.payroll_snapshot_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES public.payroll_snapshots(id),
  work_entry_id uuid NOT NULL REFERENCES public.work_entries(id),
  rate_agreement_id uuid NOT NULL REFERENCES public.teacher_rate_agreements(id),
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  hourly_rate_rappen integer NOT NULL CHECK (hourly_rate_rappen > 0),
  amount_rappen integer NOT NULL CHECK (amount_rappen >= 0),
  UNIQUE (work_entry_id)
);

CREATE INDEX idx_payroll_snapshot_lines_snapshot_id ON public.payroll_snapshot_lines (snapshot_id);

ALTER TABLE public.payroll_snapshot_lines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payroll_snapshot_lines FROM anon;

CREATE POLICY payroll_snapshot_lines_admin_all
  ON public.payroll_snapshot_lines FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON TABLE public.payroll_periods IS 'Monatlicher Lohnperioden-Status (Schritt 10c). Admin-only in jeder Hinsicht.';
COMMENT ON TABLE public.payroll_snapshots IS 'Unveraenderliches Ergebnis eines Monatsabschlusses je Lehrperson (Schritt 10c). Wird ausschliesslich durch admin_close_payroll_period() befuellt.';
COMMENT ON TABLE public.payroll_snapshot_lines IS 'Unveraenderliche Einzelzeilen eines Payroll-Snapshots (Schritt 10c) -- ein work_entry kann per UNIQUE(work_entry_id) nur in genau einem Snapshot verrechnet werden.';
