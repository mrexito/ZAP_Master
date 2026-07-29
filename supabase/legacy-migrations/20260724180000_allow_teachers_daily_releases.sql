-- Erlaubt Lehrpersonen (role IN ('lehrperson', 'admin')) den Zugriff auf Tagesfreigaben.

-- 1) course_days
DROP POLICY IF EXISTS course_days_admin_all ON public.course_days;

CREATE POLICY course_days_content_manager_all
  ON public.course_days FOR ALL
  TO authenticated
  USING (public.is_content_manager())
  WITH CHECK (public.is_content_manager());

-- 2) daily_releases
DROP POLICY IF EXISTS daily_releases_admin_all ON public.daily_releases;

CREATE POLICY daily_releases_content_manager_all
  ON public.daily_releases FOR ALL
  TO authenticated
  USING (public.is_content_manager())
  WITH CHECK (public.is_content_manager());

-- 3) daily_release_items
DROP POLICY IF EXISTS daily_release_items_admin_all ON public.daily_release_items;

CREATE POLICY daily_release_items_content_manager_all
  ON public.daily_release_items FOR ALL
  TO authenticated
  USING (public.is_content_manager())
  WITH CHECK (public.is_content_manager());

COMMENT ON TABLE public.course_days IS 'Kurstage einer course_session (Lehrperson/Admin Vollzugriff via is_content_manager).';
COMMENT ON TABLE public.daily_releases IS 'Genau eine aktuelle Freigabe pro Kurstag (Lehrperson/Admin Vollzugriff via is_content_manager).';
COMMENT ON TABLE public.daily_release_items IS 'Kuratierte Inhalte je Freigabe (Lehrperson/Admin Vollzugriff via is_content_manager).';
