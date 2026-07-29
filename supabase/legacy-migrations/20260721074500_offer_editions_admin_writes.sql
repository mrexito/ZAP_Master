-- Schritt 10a (Abschnitt 2.12/3.6 des Architektur-Briefings): Admin-Maske fuer Jahresdurchfuehrungen.
-- Migration 20260720170000 hat offer_editions/course_sessions/audit_log bewusst nur fuer
-- service_role beschreibbar gemacht ("bis die Admin-Maske existiert"). Diese Migration loest genau
-- das ein: admin-authentifizierte Nutzer duerfen jetzt ueber RLS gezielt schreiben, service_role
-- bleibt zusaetzlich unbeschraenkt. offers bleibt bewusst weiterhin nur service_role-beschreibbar --
-- die 20 stabilen Angebote sind Migrations-Referenzdaten (20260721074103_seed_offer_catalog.sql);
-- ein "Neues Kursangebot"-Flow ist laut Abschnitt 2.12 ein separater, spaeterer Schritt.
--
-- Preisaenderungen, Publizieren und Archivieren verlangen laut Abschnitt 2.12 ausdruecklich
-- requireAdmin(), nicht nur is_content_manager() -- deshalb is_admin() statt is_content_manager()
-- in allen folgenden WITH CHECK/USING-Klauseln.

-- ============================================================================
-- 1) offer_editions: Admin darf INSERT/UPDATE. Kein DELETE -- Editionen werden archiviert
--    (status='archived'), nie geloescht (Buchungen referenzieren sie per FK).
-- ============================================================================

GRANT INSERT, UPDATE ON TABLE public.offer_editions TO authenticated;

CREATE POLICY offer_editions_admin_insert
  ON public.offer_editions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY offer_editions_admin_update
  ON public.offer_editions FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- 2) course_sessions: dieselbe Regel. Kein DELETE -- Absage ist registration_status='cancelled',
--    keine geloeschte Zeile (Abschnitt 2.12: "Sessions mit bestehenden Anmeldungen werden nicht
--    geloescht").
-- ============================================================================

GRANT INSERT, UPDATE ON TABLE public.course_sessions TO authenticated;

CREATE POLICY course_sessions_admin_insert
  ON public.course_sessions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY course_sessions_admin_update
  ON public.course_sessions FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- 3) audit_log: Admin darf INSERT, aber nur mit sich selbst als actor_user_id (kein Spoofen
--    fremder Akteure). Kein UPDATE/DELETE -- append-only, wie in Migration 20260720170000
--    dokumentiert.
-- ============================================================================

GRANT INSERT ON TABLE public.audit_log TO authenticated;

CREATE POLICY audit_log_admin_insert
  ON public.audit_log FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() AND actor_user_id = auth.uid());

-- ============================================================================
-- 4) Optimistic Concurrency: version/updated_at serverseitig erzwingen statt dem Client zu
--    vertrauen. Ein UPDATE mit veralteter, clientseitig gehaltener version trifft dank
--    ".eq('version', erwarteteVersion)" in der Server Action keine Zeile mehr, sobald diese
--    Funktion die Version bereits weitergezaehlt hat -- klassischer Optimistic-Lock ohne
--    zusaetzliche Lock-Tabelle.
-- ============================================================================

CREATE FUNCTION public.bump_version_and_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  NEW.version = OLD.version + 1;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.bump_version_and_updated_at() IS 'Erzwingt Optimistic-Concurrency-Versionierung serverseitig (Abschnitt 2.12) auf offer_editions/course_sessions -- der Client liest die aktuelle version, die Server Action filtert das UPDATE per .eq(version, gelesen) und erkennt einen Konflikt an null betroffenen Zeilen.';

CREATE TRIGGER offer_editions_bump_version
  BEFORE UPDATE ON public.offer_editions
  FOR EACH ROW EXECUTE FUNCTION public.bump_version_and_updated_at();

CREATE TRIGGER course_sessions_bump_version
  BEFORE UPDATE ON public.course_sessions
  FOR EACH ROW EXECUTE FUNCTION public.bump_version_and_updated_at();
