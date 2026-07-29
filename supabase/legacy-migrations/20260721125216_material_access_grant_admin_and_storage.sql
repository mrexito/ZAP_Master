-- Schritt 11a (Abschnitt 2.11 des Architektur-Briefings): schliesst die in Migration
-- 20260720140000 bewusst offen gelassenen Luecken -- private Storage-Auslieferung und die
-- Admin-Grant-Erzeugung (der Zahlungs-Flow ueber self_study_enrollments bleibt weiterhin
-- service_role-only, da kein Zahlungsanbieter integriert ist; das ist eine separate,
-- ausdruecklich spaetere Erweiterung, kein Teil dieser Runde).
--
-- WICHTIG fuer den spaeteren Live-Rollout: Dieses Migration setzt storage.buckets.public=false fuer
-- 'lernmaterialien'. Anders als alle rein additiven Migrationen dieser Session VERAENDERT das
-- echtes Zugriffsverhalten (falls der Live-Bucket aktuell public ist). Vor einem Push auf das
-- Live-Projekt separat pruefen und freigeben -- lokal ist es risikofrei (frischer, leerer Bucket).

-- ============================================================================
-- 1) lernmaterialien-Bucket: privat, Auslieferung ausschliesslich ueber Signed URLs nach
--    serverseitiger Zugriffspruefung (Abschnitt 2.11).
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('lernmaterialien', 'lernmaterialien', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Spiegelt exakt dieselbe Zugriffsregel wie learning_materials_read_public_own_or_granted
-- (Migration 20260720140000) auf die zugehoerigen Storage-Objekte -- ohne diese Policy waere die
-- Tabellen-RLS wirkungslos, sobald jemand den Storage-Pfad kennt.
CREATE POLICY lernmaterialien_read_access
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'lernmaterialien'
    AND EXISTS (
      SELECT 1 FROM public.learning_materials lm
       WHERE lm.download_path = storage.objects.name
         AND (
           lm.is_public = true
           OR auth.uid() = lm.created_by
           OR public.is_content_manager()
           OR EXISTS (
             SELECT 1 FROM public.material_access_grants g
              WHERE g.user_id = auth.uid()
                AND g.area_id = lm.area_id
                AND g.status = 'active'
                AND (g.valid_until IS NULL OR g.valid_until > now())
           )
         )
    )
  );

-- Kein COMMENT ON POLICY hier: die lokale Migrationsrolle ist nicht Owner von storage.objects
-- (das ist supabase_storage_admin) und darf zwar per Supabase-Grant Policies anlegen, aber keine
-- Kommentare auf fremdem Storage-Schema setzen. Die Begruendung steht stattdessen oben als
-- gewoehnlicher SQL-Kommentar direkt vor der Policy.

-- ============================================================================
-- 2) material_access_grants: Admins duerfen protokollierte Freigaben manuell erteilen/entziehen
--    (source_kind='admin_grant'). Der zweite Quelltyp (self_study_enrollment) bleibt
--    service_role-only bis zum spaeteren Zahlungs-Flow.
-- ============================================================================

CREATE POLICY material_access_grants_admin_insert
  ON public.material_access_grants FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() AND source_kind = 'admin_grant');

CREATE POLICY material_access_grants_admin_update
  ON public.material_access_grants FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT INSERT, UPDATE ON TABLE public.material_access_grants TO authenticated;

COMMENT ON TABLE public.material_access_grants IS 'Effektiver Materialzugriff (Abschnitt 2.11). Entzug/Ablauf setzen status/revoked_at, niemals ein Hard-Delete. Admins duerfen admin_grant-Eintraege direkt erteilen/aktualisieren (Schritt 11a); self_study_enrollment-Eintraege bleiben bis zum spaeteren Zahlungs-Flow service_role-only.';
