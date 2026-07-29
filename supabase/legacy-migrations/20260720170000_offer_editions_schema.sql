-- Editions-/Sessions-Schema (step0Baseline.revision2.md / Schritt 5, Teil 3; Abschnitt 2.12 von
-- design-reference/architektur-briefing-kursseiten.md). Schema-/RLS-Ebene nur -- die Admin-Maske
-- (OfferEditionForm/SessionEditor/EditionPreview/PublicationChecklist), die transaktionale
-- Publish-Server-Action und die automatische Audit-Log-Befuellung sind bewusst separate, spaetere
-- Runden.
--
-- Live-Inventar vor dieser Migration (Supabase-MCP-Connector, Abschnitt-2.10-Gate fuer die neuen
-- Spalten): intensivwoche_anmeldungen hat weder edition_id noch session_id. intensivwoche_kurse
-- hat zwei CHECK-Constraints (fach, valid_date_range), keinen auf ort. Echte ort-Werte: "Zürich HB"
-- (3), "Winterthur" (2), plus zwei historische Abweichler ("Lernzentrum Bern, Bahnhofstrasse 12",
-- "Lernzentrum Zürich, Limmatstrasse 45"). Abschnitt 2.12 selbst beschraenkt Zürich HB/Winterthur
-- nur fuer NEUE Zeilen ueber eine noch nicht existierende validierte RPC, nicht ueber einen
-- pauschalen CHECK (der wuerde die drei historischen Zeilen brechen) -- deshalb kein ort-CHECK in
-- dieser Migration.
--
-- Eindeutigkeit editions: Abschnitt 2.12 nennt prosaisch (offer_id, school_year, edition_key); der
-- OfferEdition-Typ selbst kennt kein edition_key-Feld, nur schoolYear -- UNIQUE(offer_id,
-- school_year) ist die einzige mit dem Typ konsistente Lesart.

-- ============================================================================
-- 1) offers: stabiler fachlicher Schluessel (Zielgruppe/Kurstyp/Slug). Oeffentlich lesbar (reine
--    Katalog-Keys, keine sensiblen Daten) -- wie material_areas.
-- ============================================================================

CREATE TABLE public.offers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  audience_id text NOT NULL,
  kurstyp text NOT NULL
    CHECK (kurstyp IN ('halbjahreskurs', 'intensivkurs', 'pruefungssimulation', 'selbststudium')),
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (audience_id, kurstyp, slug)
);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY offers_public_read
  ON public.offers FOR SELECT
  TO anon, authenticated
  USING (true);

REVOKE INSERT, UPDATE, DELETE ON TABLE public.offers FROM anon, authenticated;

COMMENT ON TABLE public.offers IS 'Stabiler fachlicher Schluessel je Angebot (Abschnitt 2.12): (audience_id, kurstyp, slug). Oeffentlich lesbar, Schreibzugriff nur ueber service_role bis die Admin-Maske existiert.';

-- ============================================================================
-- 2) offer_editions: jaehrlich veraenderliche Texte/Preise/Status je Offer.
-- ============================================================================

CREATE TABLE public.offer_editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id bigint NOT NULL REFERENCES public.offers(id),
  school_year text NOT NULL,
  public_title text NOT NULL,
  tagline text NOT NULL,
  description text NOT NULL,
  regular_price_rappen integer NOT NULL CHECK (regular_price_rappen >= 0),
  early_bird_enabled boolean NOT NULL DEFAULT true,
  early_bird_price_rappen integer,
  early_bird_deadline date,
  currency text NOT NULL DEFAULT 'CHF',
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE (offer_id, school_year),
  -- Abschnitt 2.12: bei aktivem Fruehbucherpreis sind Betrag und Stichtag Pflicht und der Preis
  -- muss unter dem Regulaerpreis liegen; bei deaktiviert werden beide Werte als NULL gespeichert.
  CONSTRAINT offer_editions_early_bird_consistency CHECK (
    (early_bird_enabled = false AND early_bird_price_rappen IS NULL AND early_bird_deadline IS NULL)
    OR (early_bird_enabled = true AND early_bird_price_rappen IS NOT NULL
        AND early_bird_deadline IS NOT NULL AND early_bird_price_rappen < regular_price_rappen)
  )
);

CREATE INDEX idx_offer_editions_offer_id ON public.offer_editions (offer_id);

ALTER TABLE public.offer_editions ENABLE ROW LEVEL SECURITY;

CREATE POLICY offer_editions_read_published_or_content_manager
  ON public.offer_editions FOR SELECT
  TO anon, authenticated
  USING (status = 'published' OR public.is_content_manager());

REVOKE INSERT, UPDATE, DELETE ON TABLE public.offer_editions FROM anon, authenticated;

COMMENT ON TABLE public.offer_editions IS 'Jaehrliche Durchfuehrung eines Offers (Abschnitt 2.12): Preise, Texte, Fruehbucher-Konfiguration, Optimistic-Concurrency-Version, Status. Oeffentlich nur wenn status=published, sonst nur fuer lehrperson/admin (is_content_manager()). Schreibzugriff nur ueber service_role bis die Admin-Maske existiert.';

-- ============================================================================
-- 3) course_sessions: KEINE zweite Durchfuehrungstabelle -- 1:1-Erweiterung der kanonischen
--    intensivwoche_kurse-Zeile (id ist zugleich PK und FK, keine eigene Identity).
-- ============================================================================

CREATE TABLE public.course_sessions (
  id bigint PRIMARY KEY REFERENCES public.intensivwoche_kurse(id),
  edition_id uuid NOT NULL REFERENCES public.offer_editions(id),
  delivery_modes text[] NOT NULL DEFAULT ARRAY['onsite'],
  registration_status text NOT NULL DEFAULT 'bookable'
    CHECK (registration_status IN ('bookable', 'waitlist', 'cancelled')),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_course_sessions_edition_id ON public.course_sessions (edition_id);

ALTER TABLE public.course_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY course_sessions_read_published_or_content_manager
  ON public.course_sessions FOR SELECT
  TO anon, authenticated
  USING (
    public.is_content_manager()
    OR EXISTS (
      SELECT 1 FROM public.offer_editions e
       WHERE e.id = course_sessions.edition_id AND e.status = 'published'
    )
  );

REVOKE INSERT, UPDATE, DELETE ON TABLE public.course_sessions FROM anon, authenticated;

COMMENT ON TABLE public.course_sessions IS 'Optionale 1:1-Erweiterung von intensivwoche_kurse (Abschnitt 2.12) -- id ist zugleich PK und FK, kein zweites Durchfuehrungssystem. Name/Datum/Standort/Kapazitaet/Aktivitaet bleiben kanonisch in intensivwoche_kurse. Oeffentlich nur wenn die zugehoerige Edition published ist. Schreibzugriff nur ueber service_role bis die Admin-Maske existiert.';

-- ============================================================================
-- 4) intensivwoche_anmeldungen: edition_id/session_id als weitere unveraenderliche
--    Buchungsfakten (Abschnitt 2.10 Punkt 9). Beide nullable -- die 48 Bestandszeilen und jede
--    Buchung gegen einen nicht editions-verknuepften Bestandskurs bleiben ohne Wert.
-- ============================================================================

ALTER TABLE public.intensivwoche_anmeldungen
  ADD COLUMN edition_id uuid REFERENCES public.offer_editions(id),
  ADD COLUMN session_id bigint REFERENCES public.course_sessions(id);

CREATE INDEX idx_anmeldungen_edition_id ON public.intensivwoche_anmeldungen (edition_id);
CREATE INDEX idx_anmeldungen_session_id ON public.intensivwoche_anmeldungen (session_id);

-- Bestehende Preis-Snapshot-Immutability-Funktion (Migration 20260719190025) um die zwei neuen
-- Spalten erweitern -- gleiche Signatur, CREATE OR REPLACE genuegt (keine Argumentliste, kein
-- Konflikt wie bei book_intensivwoche_kurs).
CREATE OR REPLACE FUNCTION public.enforce_anmeldung_price_snapshot_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF NEW.booked_price_rappen IS DISTINCT FROM OLD.booked_price_rappen
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.edition_id IS DISTINCT FROM OLD.edition_id
     OR NEW.session_id IS DISTINCT FROM OLD.session_id THEN
    RAISE EXCEPTION 'booked_price_snapshot_immutable' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_anmeldung_price_snapshot_immutable() IS 'Blockiert Aenderungen an booked_price_rappen/currency/edition_id/session_id nach dem INSERT (Abschnitt 2.10 Punkt 9). Erweitert um edition_id/session_id in Migration 20260720170000; status/paid_at-Updates ueber die bestehende Admin-Policy bleiben unangetastet.';

-- ============================================================================
-- 5) audit_log: generisches Mutationsprotokoll (Abschnitt 2.12). Nur die Tabelle + Lesezugriff in
--    dieser Runde -- das Befuellen ist Aufgabe der noch nicht gebauten Publish-Server-Action,
--    nicht eines pauschalen Triggers auf jeder Tabelle.
-- ============================================================================

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  action text NOT NULL,
  diff jsonb
);

CREATE INDEX idx_audit_log_entity ON public.audit_log (entity_type, entity_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_admin_read
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.is_admin());

REVOKE INSERT, UPDATE, DELETE ON TABLE public.audit_log FROM anon, authenticated;

COMMENT ON TABLE public.audit_log IS 'Generisches Mutationsprotokoll (Abschnitt 2.12): Benutzer, Zeitpunkt, Entity, Aktion, Vorher-/Nachher-Diff ohne personenbezogene Buchungsdaten. Nur fuer Admins lesbar. Befuellung ist Aufgabe der Admin-Maske-Publish-Server-Action (separate Runde), kein automatischer Trigger.';
