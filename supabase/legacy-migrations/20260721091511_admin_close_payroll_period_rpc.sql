-- Schritt 10c: Monatsabschluss beruehrt payroll_periods (Statuswechsel), payroll_snapshots +
-- payroll_snapshot_lines (Neuanlage je Lehrperson/Eintrag) UND work_entries (approved -> locked)
-- in einem Zug -- dieselbe Mehrtabellen-Atomaritaet wie admin_upsert_course_session() und
-- admin_save_daily_release(), deshalb wieder eine RPC statt mehrerer REST-Aufrufe.
CREATE FUNCTION public.admin_close_payroll_period(p_year integer, p_month integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_period_id uuid;
  v_period_status text;
  v_start date;
  v_end date;
  v_open_count integer;
  v_missing_rate_count integer;
  v_teacher record;
  v_snapshot_id uuid;
  v_total_minutes integer;
  v_total_amount integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;

  v_start := make_date(p_year, p_month, 1);
  v_end := (v_start + interval '1 month' - interval '1 day')::date;

  SELECT id, status INTO v_period_id, v_period_status
    FROM public.payroll_periods WHERE year = p_year AND month = p_month;

  IF v_period_id IS NULL THEN
    INSERT INTO public.payroll_periods (year, month, status)
    VALUES (p_year, p_month, 'review')
    RETURNING id, status INTO v_period_id, v_period_status;
  END IF;

  IF v_period_status = 'locked' THEN
    RAISE EXCEPTION 'period_already_locked' USING ERRCODE = '22023';
  END IF;

  -- Abschnitt 2.14/Mockup: Abschluss ist erst moeglich, wenn keine Eintraege mehr offen sind.
  SELECT count(*) INTO v_open_count
    FROM public.work_entries
   WHERE work_date BETWEEN v_start AND v_end
     AND status IN ('draft', 'submitted');
  IF v_open_count > 0 THEN
    RAISE EXCEPTION 'open_entries_remaining' USING ERRCODE = '22023';
  END IF;

  -- Jeder genehmigte Eintrag braucht eine zum Leistungsdatum gueltige Lohnvereinbarung, sonst
  -- gibt es keinen Satz zum Verrechnen.
  SELECT count(*) INTO v_missing_rate_count
    FROM public.work_entries we
   WHERE we.work_date BETWEEN v_start AND v_end
     AND we.status = 'approved'
     AND NOT EXISTS (
       SELECT 1 FROM public.teacher_rate_agreements ra
        WHERE ra.teacher_id = we.teacher_id
          AND ra.valid_from <= we.work_date
          AND (ra.valid_until IS NULL OR ra.valid_until >= we.work_date)
     );
  IF v_missing_rate_count > 0 THEN
    RAISE EXCEPTION 'missing_rate_agreement' USING ERRCODE = '22023';
  END IF;

  FOR v_teacher IN
    SELECT DISTINCT teacher_id FROM public.work_entries
     WHERE work_date BETWEEN v_start AND v_end AND status = 'approved'
  LOOP
    SELECT
      coalesce(sum(we.duration_minutes), 0)::integer,
      coalesce(sum(round(we.duration_minutes * ra.hourly_rate_rappen / 60.0)), 0)::integer
      INTO v_total_minutes, v_total_amount
      FROM public.work_entries we
      JOIN public.teacher_rate_agreements ra
        ON ra.teacher_id = we.teacher_id
       AND ra.valid_from <= we.work_date
       AND (ra.valid_until IS NULL OR ra.valid_until >= we.work_date)
     WHERE we.teacher_id = v_teacher.teacher_id
       AND we.work_date BETWEEN v_start AND v_end
       AND we.status = 'approved';

    INSERT INTO public.payroll_snapshots (period_id, teacher_id, total_minutes, total_amount_rappen)
    VALUES (v_period_id, v_teacher.teacher_id, v_total_minutes, v_total_amount)
    RETURNING id INTO v_snapshot_id;

    INSERT INTO public.payroll_snapshot_lines (
      snapshot_id, work_entry_id, rate_agreement_id, duration_minutes, hourly_rate_rappen, amount_rappen
    )
    SELECT
      v_snapshot_id, we.id, ra.id, we.duration_minutes, ra.hourly_rate_rappen,
      round(we.duration_minutes * ra.hourly_rate_rappen / 60.0)::integer
      FROM public.work_entries we
      JOIN public.teacher_rate_agreements ra
        ON ra.teacher_id = we.teacher_id
       AND ra.valid_from <= we.work_date
       AND (ra.valid_until IS NULL OR ra.valid_until >= we.work_date)
     WHERE we.teacher_id = v_teacher.teacher_id
       AND we.work_date BETWEEN v_start AND v_end
       AND we.status = 'approved';

    UPDATE public.work_entries
       SET status = 'locked'
     WHERE teacher_id = v_teacher.teacher_id
       AND work_date BETWEEN v_start AND v_end
       AND status = 'approved';
  END LOOP;

  UPDATE public.payroll_periods
     SET status = 'locked', locked_at = now(), locked_by = auth.uid()
   WHERE id = v_period_id;

  RETURN v_period_id;
END;
$$;

COMMENT ON FUNCTION public.admin_close_payroll_period IS 'Schritt 10c (PayrollReviewPanel): schliesst einen Monat atomar ab -- prueft auf offene Eintraege und fehlende Lohnvereinbarungen, erzeugt unveraenderliche payroll_snapshots/-lines je Lehrperson mit dem am Leistungsdatum gueltigen Satz, sperrt die verrechneten work_entries (approved->locked) und den Zeitraum selbst. Admin-only (is_admin()).';

REVOKE ALL ON FUNCTION public.admin_close_payroll_period FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_close_payroll_period TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_close_payroll_period TO service_role;
