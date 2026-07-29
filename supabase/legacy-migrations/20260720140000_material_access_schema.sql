-- Materialzugriff-Schema (step0Baseline.revision2.md / Schritt 5, Teil 2; Abschnitt 2.11 von
-- design-reference/architektur-briefing-kursseiten.md). Schema-/RLS-Ebene nur -- private
-- Storage-Auslieferung, /materialien/[area]-Routen und die eigentliche Grant-Ausstellung
-- (Zahlungs-Webhook/Admin-Flow) sind bewusst separate, spätere Runden.
--
-- Live-Inventar vor dieser Migration (über den Supabase-MCP-Connector gelesen, Abschnitt-2.10-Gate
-- für diesen Backfill): learning_materials hat genau 2 Zeilen.
--   id=9  " Lineare GLEICHUNGEN lösen einfach erklärt", class_levels={6. Klasse}      -> eindeutig langzeitgymi
--   id=10 " Bruchrechnen",                              class_levels={5. Klasse,6. Klasse} -> alte Kombination, needs_review, area_id bleibt NULL
-- Beide bereits is_public=true; kein bestehender Zugriff wird durch diese Migration eingeschränkt.

-- ============================================================================
-- 1) material_areas: Lookup-Tabelle der vier stabilen Bereiche (Abschnitt 2.11).
-- ============================================================================

CREATE TABLE public.material_areas (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.material_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY material_areas_public_read
  ON public.material_areas FOR SELECT
  TO anon, authenticated
  USING (true);

REVOKE INSERT, UPDATE, DELETE ON TABLE public.material_areas FROM anon, authenticated;

COMMENT ON TABLE public.material_areas IS 'Vier stabile Materialbereiche (Abschnitt 2.11). Nur Lookup-Daten, kein Geschäftsbestand -- oeffentlich lesbar, Schreibzugriff nur ueber service_role.';

INSERT INTO public.material_areas (key, label) VALUES
  ('langzeitgymi', 'Langzeitgymi'),
  ('kurzgymi', 'Kurzgymi'),
  ('bms', 'BMS'),
  ('matura', 'Matura');

-- ============================================================================
-- 2) learning_materials.area_id: nullable FK, additiver Backfill. NOT NULL erst nach Aufloesung
--    aller needs_review-Zeilen (hier: Zeile 10) -- eine eigene, spaetere fachliche Entscheidung.
-- ============================================================================

ALTER TABLE public.learning_materials
  ADD COLUMN area_id bigint REFERENCES public.material_areas(id);

CREATE INDEX idx_learning_materials_area_id ON public.learning_materials (area_id);

COMMENT ON COLUMN public.learning_materials.area_id IS 'FK auf material_areas. Nullable: Zeilen mit mehrdeutigen/alten class_levels-Kombinationen (z.B. gleichzeitig 5./6. Klasse) bleiben bewusst NULL und gelten als needs_review, bis sie fachlich aufgeloest sind (Abschnitt 2.11).';

-- Eindeutig zuordenbar: nur "6. Klasse" -> langzeitgymi.
UPDATE public.learning_materials
   SET area_id = (SELECT id FROM public.material_areas WHERE key = 'langzeitgymi')
 WHERE id = 9;

-- Zeile 10 (class_levels = {5. Klasse, 6. Klasse}) bleibt absichtlich unveraendert / area_id NULL:
-- needs_review, siehe Kommentar oben. Kein automatisches Zuordnen aufgrund aehnlicher Werte.

-- ============================================================================
-- 3) self_study_enrollments: fachliche Einschreibung (Abschnitt 2.11). Nur SELECT-Policies fuer
--    Betroffene/Admin -- Erzeugung ist ein spaeterer, separater Zahlungs-/Admin-Flow.
-- ============================================================================

CREATE TABLE public.self_study_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience_id text NOT NULL,
  area_id bigint NOT NULL REFERENCES public.material_areas(id),
  beneficiary_user_id uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'cancelled', 'refunded')),
  access_until timestamptz,
  payment_provider_ref text,
  invite_token_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_self_study_enrollments_beneficiary
  ON public.self_study_enrollments (beneficiary_user_id);

ALTER TABLE public.self_study_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY self_study_enrollments_select_own_or_admin
  ON public.self_study_enrollments FOR SELECT
  TO authenticated
  USING (beneficiary_user_id = auth.uid() OR public.is_admin());

-- Supabase-Projekte gewaehren neuen Tabellen per ALTER DEFAULT PRIVILEGES standardmaessig volle
-- CRUD-Rechte an anon/authenticated -- ohne dieses REVOKE waeren INSERT/UPDATE/DELETE nur durch
-- (fehlende) RLS-Policies blockiert, nicht durch den Grant selbst. Explizit entzogen, analog zum
-- Vorgehen bei intensivwoche_buchungsversuche (Migration 20260720090000).
REVOKE INSERT, UPDATE, DELETE ON TABLE public.self_study_enrollments FROM anon, authenticated;

COMMENT ON TABLE public.self_study_enrollments IS 'Fachliche Selbststudium-Einschreibung (Abschnitt 2.11). Kein Klartext-Einladungstoken (nur invite_token_hash). Erzeugung/Aenderung ausschliesslich ueber service_role bis der Zahlungs-/Admin-Flow gebaut ist -- kein INSERT/UPDATE-Grant fuer anon/authenticated in dieser Runde.';

-- ============================================================================
-- 4) material_access_grants: effektiver Zugriff (Abschnitt 2.11). Nur SELECT-Policies fuer
--    Betroffene/Admin -- Erzeugung ist derselbe spaetere Flow wie oben.
-- ============================================================================

CREATE TABLE public.material_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  area_id bigint NOT NULL REFERENCES public.material_areas(id),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked', 'expired')),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  source_kind text NOT NULL
    CHECK (source_kind IN ('self_study_enrollment', 'admin_grant')),
  source_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX idx_material_access_grants_user_area
  ON public.material_access_grants (user_id, area_id);

ALTER TABLE public.material_access_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY material_access_grants_select_own_or_admin
  ON public.material_access_grants FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

REVOKE INSERT, UPDATE, DELETE ON TABLE public.material_access_grants FROM anon, authenticated;

COMMENT ON TABLE public.material_access_grants IS 'Effektiver Materialzugriff (Abschnitt 2.11). Entzug/Ablauf setzen status/revoked_at, niemals ein Hard-Delete -- historische Grants bleiben auditierbar. Erzeugung/Aenderung ausschliesslich ueber service_role bis der Zahlungs-/Admin-Flow gebaut ist.';

-- ============================================================================
-- 5) Gefundene Luecke schliessen: learning_materials_public_read erlaubte anon/authenticated
--    bislang JEDE Zeile zu lesen (qual = true), unabhaengig von is_public -- da RLS-Policies
--    ODER-verknuepft sind, machte das die eigentlich korrekte "is_public = true OR own"-Policy
--    wirkungslos. Bisher folgenlos, weil beide Bestandszeilen ohnehin is_public=true sind, aber
--    mit echten privaten Materialien waere das ein Datenleck. Ersetzt durch eine Policy, die
--    zusaetzlich auch den in dieser Migration eingefuehrten Grant-Mechanismus beruecksichtigt.
-- ============================================================================

DROP POLICY IF EXISTS "learning_materials_public_read" ON public.learning_materials;

CREATE POLICY learning_materials_read_public_own_or_granted
  ON public.learning_materials FOR SELECT
  TO anon, authenticated
  USING (
    is_public = true
    OR auth.uid() = created_by
    OR public.is_content_manager()
    OR EXISTS (
      SELECT 1 FROM public.material_access_grants g
       WHERE g.user_id = auth.uid()
         AND g.area_id = learning_materials.area_id
         AND g.status = 'active'
         AND (g.valid_until IS NULL OR g.valid_until > now())
    )
  );

COMMENT ON POLICY learning_materials_read_public_own_or_granted ON public.learning_materials IS 'Ersetzt die fehlerhafte learning_materials_public_read-Policy (qual=true, liess anon/authenticated bislang jede Zeile lesen). Sichtbar sind: oeffentliche Materialien, eigene Materialien, Content-Manager/Admin, sowie Materialien mit passendem aktivem material_access_grants-Eintrag.';
