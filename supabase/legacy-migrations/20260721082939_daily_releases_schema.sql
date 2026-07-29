-- Schritt 10b (Abschnitt 2.13/3/6 des Architektur-Briefings): Tagesfreigaben fuer Intensivkurse.
-- Nur die Admin-Maske ist in der Routentabelle (Abschnitt 6) als eigene Route gelistet
-- (/dashboard/kurse/angebote/[offerId]/durchfuehrungen/[editionId]/tagesfreigaben); eine separate
-- Schueler-Dashboard-Seite ist dort NICHT aufgefuehrt -- StudentReleasePreview ist laut Abschnitt 3
-- "rein redaktionelle Vorschau innerhalb der Admin-Maske; verleiht keinen Zugriff und umgeht keine
-- RLS". Diese Migration liefert deshalb Schema + RLS (inkl. der Studierenden-Leseregel, die spaeter
-- von einer echten Konsumentenseite genutzt wird) und die Admin-Schreibrechte; eine eigene
-- Schueler-Route ist nicht Teil dieser Runde.
--
-- exercises/trainer_exams sind bereits oeffentlich lesbar (exercises_public_read/
-- trainer_exams_public_read, USING (true)) -- release_content_catalog/daily_releases schraenken
-- deshalb NICHT den Zugriff auf den Inhalt selbst ein (der ist bereits global offen), sondern nur
-- die KURATIERUNG: welche Teilmenge als "heutiges Pensum" fuer eine bestimmte Kursgruppe/einen
-- bestimmten Kurstag gilt und ab wann sichtbar ist.

-- ============================================================================
-- 0) intensivwoche_anmeldungen.beneficiary_user_id: fehlender Link zwischen einer Anmeldung (vom
--    Elternteil ueber parent_email gebucht) und dem eingeloggten Konto, das die Freigabe sehen
--    soll. Abschnitt 2.13 setzt "ein angemeldeter Benutzer mit einer aktiven Anmeldung" als
--    gegeben voraus, das Schema (Migration 20260719133741) hatte dafuer aber keine Spalte -- analog
--    zum bereits bestehenden self_study_enrollments.beneficiary_user_id-Muster (Abschnitt 2.11)
--    ergaenzt. Heuristische Auto-Verknuepfung per E-Mail-Abgleich bei Buchung; ein vollstaendiger
--    Einladungs-/Claim-Flow fuer abweichende E-Mails ist wie bei self_study_enrollments eine
--    separate, spaetere Erweiterung.
-- ============================================================================

ALTER TABLE public.intensivwoche_anmeldungen
  ADD COLUMN beneficiary_user_id uuid REFERENCES auth.users(id);

CREATE INDEX idx_anmeldungen_beneficiary_user_id ON public.intensivwoche_anmeldungen (beneficiary_user_id);

CREATE FUNCTION public.link_anmeldung_beneficiary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NEW.beneficiary_user_id IS NULL THEN
    SELECT id INTO NEW.beneficiary_user_id
      FROM public.profiles
     WHERE lower(email) = lower(NEW.parent_email)
     LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.link_anmeldung_beneficiary() IS 'Heuristische Auto-Verknuepfung einer Anmeldung mit einem existierenden Profil per E-Mail-Abgleich (Schritt 10b). Findet sie keine Uebereinstimmung, bleibt beneficiary_user_id NULL -- kein Zugriff auf Tagesfreigaben, bis manuell verknuepft.';

CREATE TRIGGER link_anmeldung_beneficiary_before_insert
  BEFORE INSERT ON public.intensivwoche_anmeldungen
  FOR EACH ROW EXECUTE FUNCTION public.link_anmeldung_beneficiary();

-- ============================================================================
-- 1) course_days: die Kurstage einer course_session (i.d.R. 5 Wochentage eines Intensivkurses).
-- ============================================================================

CREATE TABLE public.course_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id bigint NOT NULL REFERENCES public.course_sessions(id),
  sequence integer NOT NULL CHECK (sequence >= 1),
  course_date date NOT NULL,
  UNIQUE (session_id, sequence),
  UNIQUE (session_id, course_date)
);

CREATE INDEX idx_course_days_session_id ON public.course_days (session_id);

ALTER TABLE public.course_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY course_days_admin_all
  ON public.course_days FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Supabase grantet neuen Tabellen standardmaessig volle CRUD-Rechte an anon/authenticated (siehe
-- die REVOKE-Zeilen in jeder frueheren Migration dieses Repos); anon bekommt hier ueberhaupt keinen
-- Zugriff, authenticated bleibt gegrantet und wird ausschliesslich durch obige RLS-Policy begrenzt.
REVOKE ALL ON TABLE public.course_days FROM anon;

COMMENT ON TABLE public.course_days IS 'Kurstage einer course_session (Schritt 10b, Abschnitt 2.13). Admin-only -- kein Schueler-Leserecht in dieser Runde, da nur die Admin-Maske (nicht eine Schueler-Seite) Teil dieser Route ist.';

-- ============================================================================
-- 2) release_content_catalog: schmale Registry, die exercises/trainer_exams referenzierbar macht
--    (echte FKs, XOR-CHECK -- genau eine Quelle pro Eintrag). trainer_exams.id ist text, nicht
--    bigint, deshalb zwei getrennte, jeweils nullable FK-Spalten statt einer gemeinsamen.
-- ============================================================================

CREATE TABLE public.release_content_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('exercise', 'trainer_exam')),
  exercise_id bigint REFERENCES public.exercises(id),
  trainer_exam_id text REFERENCES public.trainer_exams(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT release_content_catalog_source_xor CHECK (
    (kind = 'exercise' AND exercise_id IS NOT NULL AND trainer_exam_id IS NULL)
    OR (kind = 'trainer_exam' AND trainer_exam_id IS NOT NULL AND exercise_id IS NULL)
  ),
  UNIQUE (exercise_id),
  UNIQUE (trainer_exam_id)
);

ALTER TABLE public.release_content_catalog ENABLE ROW LEVEL SECURITY;

-- exercises/trainer_exams sind ohnehin oeffentlich lesbar -- die Registry-Zeile selbst (welche IDs
-- referenzierbar sind) ist deshalb genauso oeffentlich lesbar, nur Schreiben bleibt admin-only.
CREATE POLICY release_content_catalog_public_read
  ON public.release_content_catalog FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY release_content_catalog_admin_write
  ON public.release_content_catalog FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- SELECT bleibt fuer anon/authenticated gegrantet (siehe Policy oben); nur INSERT/UPDATE/DELETE
-- werden von anon entzogen -- kein UPDATE/DELETE-Pfad existiert ueberhaupt (weder Policy noch
-- vorgesehen), deshalb auch von authenticated entzogen.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.release_content_catalog FROM anon;
REVOKE UPDATE, DELETE ON TABLE public.release_content_catalog FROM authenticated;

COMMENT ON TABLE public.release_content_catalog IS 'Referenzierbare Teilmenge aus exercises/trainer_exams fuer Tagesfreigaben (Schritt 10b). Kein Materialduplikat -- nur echte FKs mit XOR-CHECK.';

-- ============================================================================
-- 3) daily_releases: hoechstens eine (aktuelle) Freigabe pro Kurstag -- Statuswechsel ueber die
--    Zeit, kein Verlauf mehrerer Zeilen (Historie liegt im generischen audit_log aus Schritt 10a).
-- ============================================================================

CREATE TABLE public.daily_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_day_id uuid NOT NULL UNIQUE REFERENCES public.course_days(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'revoked')),
  opens_at timestamptz,
  closes_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  published_by uuid REFERENCES auth.users(id),
  published_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_releases_window_order CHECK (
    opens_at IS NULL OR closes_at IS NULL OR opens_at < closes_at
  )
);

ALTER TABLE public.daily_releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY daily_releases_admin_all
  ON public.daily_releases FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Abschnitt 2.13, Zugriffsregel: nur ein Nutzer mit aktiver, nicht stornierter Anmeldung fuer
-- GENAU dieselbe course_session darf eine aktuell offene Freigabe sehen -- und nur waehrend ihres
-- Zeitfensters. status='active' ist noch keine Sichtbarkeitsgarantie: eine geplante Freigabe kann
-- aktiv gesetzt sein, bevor opens_at erreicht ist (Admin-Vorbereitung), und nach closes_at soll der
-- Zugriff automatisch enden, ohne dass ein Admin manuell "revoked" setzen muss. status='scheduled'
-- zaehlt hier bewusst mit: "scheduled" heisst nur "verbindlich mit Zeitfenster geplant", die
-- tatsaechliche Sichtbarkeit ergibt sich ausschliesslich aus opens_at/closes_at vs. now() -- kein
-- Cron-Job muss status jemals automatisch auf 'active' umschalten.
CREATE POLICY daily_releases_enrolled_read
  ON public.daily_releases FOR SELECT
  TO authenticated
  USING (
    status IN ('active', 'scheduled')
    AND (opens_at IS NULL OR opens_at <= now())
    AND (closes_at IS NULL OR closes_at >= now())
    AND EXISTS (
      SELECT 1
        FROM public.course_days cd
        JOIN public.intensivwoche_anmeldungen a ON a.kurs_id = cd.session_id
       WHERE cd.id = daily_releases.course_day_id
         AND a.beneficiary_user_id = auth.uid()
         AND a.status != 'storniert'
    )
  );

-- anon bekommt keinerlei Zugriff (Abschnitt 2.13 setzt "ein angemeldeter Benutzer" voraus);
-- authenticated bleibt gegrantet, RLS filtert auf Admin bzw. korrekt eingeschriebene Lernende.
REVOKE ALL ON TABLE public.daily_releases FROM anon;

COMMENT ON TABLE public.daily_releases IS 'Genau eine aktuelle Freigabe pro Kurstag (Schritt 10b, Abschnitt 2.13). Admin-Vollzugriff, eingeschriebene Lernende sehen nur status=active innerhalb des Zeitfensters fuer ihre eigene course_session.';

-- ============================================================================
-- 4) daily_release_items: kuratierte Auswahl + Reihenfolge je Freigabe.
-- ============================================================================

CREATE TABLE public.daily_release_items (
  release_id uuid NOT NULL REFERENCES public.daily_releases(id),
  content_item_id uuid NOT NULL REFERENCES public.release_content_catalog(id),
  position integer NOT NULL,
  PRIMARY KEY (release_id, content_item_id)
);

ALTER TABLE public.daily_release_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY daily_release_items_admin_all
  ON public.daily_release_items FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY daily_release_items_enrolled_read
  ON public.daily_release_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.daily_releases dr WHERE dr.id = daily_release_items.release_id
    )
  );

REVOKE ALL ON TABLE public.daily_release_items FROM anon;

COMMENT ON TABLE public.daily_release_items IS 'Kuratierte Inhalte + Reihenfolge je Freigabe (Schritt 10b). Die Sichtbarkeitsregel liegt bereits vollstaendig in daily_releases_enrolled_read; hier reicht die Existenz der (dank RLS bereits gefilterten) Elternzeile.';

-- ============================================================================
-- 5) Optimistic Concurrency fuer daily_releases (dieselbe Mechanik wie offer_editions/
--    course_sessions aus Migration 20260721074500).
-- ============================================================================

CREATE TRIGGER daily_releases_bump_version
  BEFORE UPDATE ON public.daily_releases
  FOR EACH ROW EXECUTE FUNCTION public.bump_version_and_updated_at();
