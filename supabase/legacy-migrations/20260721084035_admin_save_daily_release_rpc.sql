-- Schritt 10b: eine Freigabe speichern beruehrt immer daily_releases (Upsert auf course_day_id)
-- UND die vollstaendige Neuordnung von daily_release_items (inkl. Find-or-Create in
-- release_content_catalog fuer neu ausgewaehlte exercises/trainer_exams) -- dieselbe
-- Mehrtabellen-Atomaritaet wie schon bei admin_upsert_course_session() (Migration 20260721075036),
-- deshalb wieder eine RPC statt mehrerer getrennter REST-Aufrufe.
--
-- Revoke ist bewusst NICHT Teil dieser RPC: Abschnitt 2.13 verlangt, dass eine zurueckgezogene
-- Freigabe historisch auditierbar bleibt -- ein Aufruf dieser Funktion mit p_status='revoked'
-- wuerde die Item-Liste durch den DELETE+INSERT-Zyklus unten sonst mitloeschen. Widerruf und die
-- kursgruppenweite Notfallsperre sind deshalb einfache Einzeltabellen-UPDATEs in den Server
-- Actions (admin_upsert_course_session-Grants/RLS reichen dafuer bereits aus), keine RPC noetig.
CREATE FUNCTION public.admin_save_daily_release(
  p_course_day_id uuid,
  p_status text,
  p_opens_at timestamptz DEFAULT NULL,
  p_closes_at timestamptz DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_release_id uuid;
  v_item jsonb;
  v_content_item_id uuid;
  v_position integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('draft', 'scheduled', 'active') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.daily_releases (course_day_id, status, opens_at, closes_at, published_by, published_at)
  VALUES (
    p_course_day_id, p_status, p_opens_at, p_closes_at,
    CASE WHEN p_status IN ('active', 'scheduled') THEN auth.uid() ELSE NULL END,
    CASE WHEN p_status IN ('active', 'scheduled') THEN now() ELSE NULL END
  )
  ON CONFLICT (course_day_id) DO UPDATE SET
    status = excluded.status,
    opens_at = excluded.opens_at,
    closes_at = excluded.closes_at,
    published_by = CASE WHEN excluded.status IN ('active', 'scheduled')
                         THEN auth.uid() ELSE public.daily_releases.published_by END,
    published_at = CASE WHEN excluded.status IN ('active', 'scheduled') AND public.daily_releases.published_at IS NULL
                         THEN now() ELSE public.daily_releases.published_at END
  RETURNING id INTO v_release_id;

  DELETE FROM public.daily_release_items WHERE release_id = v_release_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  LOOP
    IF v_item ->> 'kind' = 'exercise' THEN
      SELECT id INTO v_content_item_id FROM public.release_content_catalog
       WHERE exercise_id = (v_item ->> 'exercise_id')::bigint;
      IF v_content_item_id IS NULL THEN
        INSERT INTO public.release_content_catalog (kind, exercise_id)
        VALUES ('exercise', (v_item ->> 'exercise_id')::bigint)
        RETURNING id INTO v_content_item_id;
      END IF;
    ELSIF v_item ->> 'kind' = 'trainer_exam' THEN
      SELECT id INTO v_content_item_id FROM public.release_content_catalog
       WHERE trainer_exam_id = (v_item ->> 'trainer_exam_id');
      IF v_content_item_id IS NULL THEN
        INSERT INTO public.release_content_catalog (kind, trainer_exam_id)
        VALUES ('trainer_exam', (v_item ->> 'trainer_exam_id'))
        RETURNING id INTO v_content_item_id;
      END IF;
    ELSE
      RAISE EXCEPTION 'invalid_item_kind' USING ERRCODE = '22023';
    END IF;

    v_position := v_position + 1;
    INSERT INTO public.daily_release_items (release_id, content_item_id, position)
    VALUES (v_release_id, v_content_item_id, v_position);
  END LOOP;

  RETURN v_release_id;
END;
$$;

COMMENT ON FUNCTION public.admin_save_daily_release IS 'Schritt 10b (DailyReleaseManager): legt/aktualisiert die Freigabe eines Kurstags samt kuratierter Inhaltsliste atomar an. Admin-only (is_admin()), find-or-create in release_content_catalog, ersetzt daily_release_items vollstaendig.';

REVOKE ALL ON FUNCTION public.admin_save_daily_release FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_save_daily_release TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_daily_release TO service_role;
