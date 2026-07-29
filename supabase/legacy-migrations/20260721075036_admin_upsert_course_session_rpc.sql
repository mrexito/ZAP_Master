-- Schritt 10a: course_sessions ist laut Abschnitt 2.12 eine reine 1:1-Erweiterung von
-- intensivwoche_kurse (id ist zugleich PK und FK). Ein neuer Termin braucht deshalb zwingend BEIDE
-- Zeilen in derselben Transaktion -- das kann der Supabase-JS-Client nicht atomar über zwei
-- getrennte REST-Aufrufe leisten. Diese RPC ersetzt das durch eine einzelne Transaktion.
--
-- Sie loest ausserdem die in Migration 20260720170000 offen dokumentierte Luecke: "Abschnitt 2.12
-- selbst beschraenkt Zürich HB/Winterthur nur fuer NEUE Zeilen ueber eine noch nicht existierende
-- validierte RPC, nicht ueber einen pauschalen CHECK". Das ist jetzt genau diese RPC.
--
-- SECURITY INVOKER (nicht DEFINER): Ein Admin, der diese Funktion aufruft, besitzt bereits alle
-- noetigen Grants/RLS-Rechte auf beiden Zieltabellen (course_sessions_admin_insert/_update aus
-- Migration 20260721074500, is_kurs_owner()-Bypass fuer Admins auf intensivwoche_kurse aus der
-- Baseline) -- keine Rechteausweitung noetig, RLS bleibt die einzige Autorisierungsquelle.
CREATE FUNCTION public.admin_upsert_course_session(
  p_edition_id uuid,
  p_name text,
  p_fach text,
  p_beschreibung text,
  p_start_datum date,
  p_end_datum date,
  p_uhrzeit text,
  p_ort text,
  p_max_teilnehmer integer,
  p_lehrer text,
  -- Postgres verlangt, dass Parameter mit DEFAULT am Ende der Deklaration stehen; PostgREST/
  -- supabase-js rufen ohnehin über benannte JSON-Keys auf (kein Positionsaufruf), die Reihenfolge
  -- hier ist deshalb nur fuer den SQL-Compiler relevant, nicht fuer den Client.
  p_kurs_id bigint DEFAULT NULL,   -- NULL = neuer Termin, sonst bestehende intensivwoche_kurse.id
  p_registration_status text DEFAULT 'bookable',
  p_delivery_modes text[] DEFAULT ARRAY['onsite']
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_kurs_id bigint;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;

  -- Abschnitt 2.12: neue Zeilen sind auf die zwei verbindlichen Standorte begrenzt. Historische
  -- Abweichler (Bestandskurse ausserhalb dieser RPC) bleiben davon unberuehrt.
  IF p_ort NOT IN ('Zürich HB', 'Winterthur') THEN
    RAISE EXCEPTION 'invalid_location' USING ERRCODE = '23514';
  END IF;

  IF p_kurs_id IS NULL THEN
    INSERT INTO public.intensivwoche_kurse (
      name, fach, beschreibung, start_datum, end_datum, uhrzeit, ort, preis, max_teilnehmer,
      lehrer, ist_aktiv, created_by
    )
    SELECT
      p_name, p_fach, p_beschreibung, p_start_datum, p_end_datum, p_uhrzeit, p_ort,
      round(e.regular_price_rappen / 100.0, 2), p_max_teilnehmer, p_lehrer,
      -- ist_aktiv bleibt IMMER false: editions-verwaltete Kurse duerfen nicht ueber den
      -- getrennten Legacy-Pfad (/kurse, intensivwoche_kurse_mit_anmeldungen.ist_aktiv) sichtbar
      -- werden, solange die oeffentliche Katalog-Verdrahtung auf offer_editions/course_sessions
      -- (Abschnitt 7) noch aussteht.
      false,
      auth.uid()
    FROM public.offer_editions e
    WHERE e.id = p_edition_id
    RETURNING id INTO v_kurs_id;

    IF v_kurs_id IS NULL THEN
      RAISE EXCEPTION 'edition_not_found' USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO public.course_sessions (id, edition_id, registration_status, delivery_modes)
    VALUES (v_kurs_id, p_edition_id, p_registration_status, p_delivery_modes);
  ELSE
    UPDATE public.intensivwoche_kurse
       SET name = p_name, fach = p_fach, beschreibung = p_beschreibung,
           start_datum = p_start_datum, end_datum = p_end_datum, uhrzeit = p_uhrzeit,
           ort = p_ort, max_teilnehmer = p_max_teilnehmer, lehrer = p_lehrer
     WHERE id = p_kurs_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'session_not_found' USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.course_sessions
       SET registration_status = p_registration_status, delivery_modes = p_delivery_modes
     WHERE id = p_kurs_id AND edition_id = p_edition_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'session_edition_mismatch' USING ERRCODE = 'P0002';
    END IF;

    v_kurs_id := p_kurs_id;
  END IF;

  RETURN v_kurs_id;
END;
$$;

COMMENT ON FUNCTION public.admin_upsert_course_session IS 'Schritt 10a (SessionEditor): legt einen Termin atomar in intensivwoche_kurse + course_sessions an oder aktualisiert beide Zeilen. Admin-only (is_admin()), Standort auf Zuerich HB/Winterthur begrenzt, neue Zeilen bleiben ist_aktiv=false (kein Leck in den Legacy-/kurse-Pfad).';

REVOKE ALL ON FUNCTION public.admin_upsert_course_session FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_upsert_course_session TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_course_session TO service_role;
