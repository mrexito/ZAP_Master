-- Lehrpersonen und Admins verwalten Tagesfreigaben gemeinsam. Zusätzlich werden
-- learning_materials als echte, referenzielle Lerneinheiten in den Freigabekatalog aufgenommen.

ALTER TABLE public.release_content_catalog
  ADD COLUMN learning_material_id bigint REFERENCES public.learning_materials(id);

ALTER TABLE public.release_content_catalog
  DROP CONSTRAINT release_content_catalog_kind_check,
  DROP CONSTRAINT release_content_catalog_source_xor;

ALTER TABLE public.release_content_catalog
  ADD CONSTRAINT release_content_catalog_kind_check
    CHECK (kind IN ('learning_material', 'exercise', 'trainer_exam')),
  ADD CONSTRAINT release_content_catalog_source_xor CHECK (
    (kind = 'learning_material' AND learning_material_id IS NOT NULL AND exercise_id IS NULL AND trainer_exam_id IS NULL)
    OR (kind = 'exercise' AND learning_material_id IS NULL AND exercise_id IS NOT NULL AND trainer_exam_id IS NULL)
    OR (kind = 'trainer_exam' AND learning_material_id IS NULL AND exercise_id IS NULL AND trainer_exam_id IS NOT NULL)
  ),
  ADD CONSTRAINT release_content_catalog_learning_material_id_key UNIQUE (learning_material_id);

DROP POLICY IF EXISTS release_content_catalog_admin_write ON public.release_content_catalog;

CREATE POLICY release_content_catalog_content_manager_insert
  ON public.release_content_catalog FOR INSERT
  TO authenticated
  WITH CHECK (public.is_content_manager());

CREATE OR REPLACE FUNCTION public.admin_save_daily_release(
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
  IF NOT public.is_content_manager() THEN
    RAISE EXCEPTION 'content_manager_required' USING ERRCODE = '42501';
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
    v_content_item_id := NULL;

    IF v_item ->> 'kind' = 'learning_material' THEN
      SELECT id INTO v_content_item_id FROM public.release_content_catalog
       WHERE learning_material_id = (v_item ->> 'learning_material_id')::bigint;
      IF v_content_item_id IS NULL THEN
        INSERT INTO public.release_content_catalog (kind, learning_material_id)
        VALUES ('learning_material', (v_item ->> 'learning_material_id')::bigint)
        RETURNING id INTO v_content_item_id;
      END IF;
    ELSIF v_item ->> 'kind' = 'exercise' THEN
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

COMMENT ON FUNCTION public.admin_save_daily_release IS
  'Speichert Tagesfreigaben atomar. Lehrpersonen und Admins dürfen Lerneinheiten, Übungen und Prüfungsinhalte kuratieren.';
