-- Schritt 10c: eine neue Lohnvereinbarung anlegen beruehrt im Regelfall zwei Zeilen atomar --
-- die bisher offene Vereinbarung (valid_until IS NULL) wird auf den Tag vor dem neuen valid_from
-- geschlossen, DANACH erst die neue Zeile eingefuegt. Zwei getrennte REST-Aufrufe koennten bei
-- einem Fehler zwischen den Schritten eine offene, ueberlappende oder luecken-behaftete Historie
-- hinterlassen -- deshalb wieder eine RPC (gleiches Muster wie die drei vorherigen Admin-RPCs).
CREATE FUNCTION public.admin_save_rate_agreement(
  p_teacher_id uuid,
  p_hourly_rate_rappen integer,
  p_valid_from date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_new_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;

  IF p_hourly_rate_rappen <= 0 THEN
    RAISE EXCEPTION 'invalid_rate' USING ERRCODE = '22023';
  END IF;

  UPDATE public.teacher_rate_agreements
     SET valid_until = p_valid_from - 1
   WHERE teacher_id = p_teacher_id
     AND valid_until IS NULL
     AND valid_from < p_valid_from;

  INSERT INTO public.teacher_rate_agreements (teacher_id, hourly_rate_rappen, valid_from, created_by)
  VALUES (p_teacher_id, p_hourly_rate_rappen, p_valid_from, auth.uid())
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

COMMENT ON FUNCTION public.admin_save_rate_agreement IS 'Schritt 10c (PayrollReviewPanel): schliesst atomar eine offene Vorgaenger-Lohnvereinbarung und legt die neue an, damit nie eine offene Luecke oder ein EXCLUDE-Konflikt entsteht. Admin-only (is_admin()); fruehere, bereits befristete Vereinbarungen bleiben unangetastet.';

REVOKE ALL ON FUNCTION public.admin_save_rate_agreement FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_save_rate_agreement TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_rate_agreement TO service_role;
