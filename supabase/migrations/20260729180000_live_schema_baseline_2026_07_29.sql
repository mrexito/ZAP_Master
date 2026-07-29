-- Baseline-Migration, ersetzt die vorherige lokale Migrationskette (siehe
-- docs/migration-evidence/2026-07-29-baseline-adoption-decision.md, Option 1).
--
-- Herkunft: schema-only pg_dump von notaqfguhhjpvmagvcic ("Lernecke") am 29.07.2026, gezogen ueber
-- die befristete read-only Rolle zap_baseline_reader_lernecke (siehe supabase/pg_service.conf).
-- Quelldatei (nicht versioniert):
-- docs/migration-evidence/private/2026-07-29/live-schema-baseline.2026-07-29.sql
-- Gegen einen frischen Live-Katalogabgleich verifiziert: 0 Drift ueber Tabellen, Views, Funktionen,
-- Policies, Trigger, Sequenzen, Indizes und Constraints (51/1/28/174/24/15/141/225).
--
-- Alle vorherigen 56 timestamp-praefigierten Migrationsdateien wurden unveraendert nach
-- supabase/legacy-migrations/ verschoben und sind ab hier nicht mehr Teil der ausfuehrbaren Kette
-- (derselbe Praezedenzfall wie zuvor bei 001-014). Diese Datei ist NICHT byte-identisch mit dem
-- rohen pg_dump-Output: Die beiden psql-eigenen Meta-Direktiven "\restrict"/"\unrestrict" (neu seit
-- pg_dump 18, nur von psql selbst interpretierbar, keine SQL-Anweisungen) wurden entfernt, da der
-- Supabase-CLI-Migrationsrunner sie nicht ausfuehren kann. Am Schema selbst wurde nichts veraendert.
--
-- Live-Registrierung dieser Version erfolgt ausschliesslich ueber das separat freizugebende
-- Baseline-Adoption-Gate (`supabase migration repair <version> --status applied`), niemals ueber
-- `supabase db push`. Vor diesem Gate: lokaler Reset/Lint/pgTAP muss hier gruen sein.

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- CREATE SCHEMA public; -- entfernt: das Supabase-Standardtemplate legt "public" bereits an;
-- ein erneutes CREATE SCHEMA würde den Reset mit SQLSTATE 42P06 abbrechen.


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';

-- Ergaenzt gegenueber dem rohen pg_dump-Output: `pg_dump --schema=public` gibt keine
-- CREATE-EXTENSION-Anweisungen aus, weil die Extensions selbst im Schema `extensions` installiert
-- sind (Supabase-Konvention), nicht in `public`. Live tatsaechlich installiert (list_extensions,
-- 29.07.2026) und hier reproduziert, weil das Schema unten Objekte referenziert, die davon
-- abhaengen: uuid (Spalten-Defaults ueber das seit PG13 eingebaute gen_random_uuid() brauchen
-- keine Extension mehr, andere Nutzungen aber schon) und insbesondere die GiST-Exclusion-Constraint
-- auf teacher_rate_agreements, die ohne btree_gist mit SQLSTATE 42704 fehlschlaegt. pgsodium/
-- supabase_vault/plpgsql bleiben bewusst aussen vor -- die legt der lokale Supabase-Stack ohnehin
-- selbst an.
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "btree_gist" WITH SCHEMA extensions;


--
-- Name: accept_mentorship_request(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accept_mentorship_request(request_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_request RECORD;
  v_relation_id UUID;
  v_mentor_id UUID;
  v_mentee_id UUID;
  v_listing RECORD;
BEGIN
  SELECT * INTO v_request FROM public.mentorship_requests WHERE id = request_id AND status = 'PENDING';
  IF NOT FOUND THEN RAISE EXCEPTION 'Request nicht gefunden oder nicht mehr PENDING'; END IF;
  IF v_request.target_id != auth.uid() THEN RAISE EXCEPTION 'Nur der Target kann die Anfrage akzeptieren'; END IF;
  SELECT * INTO v_listing FROM public.mentorship_listings WHERE id = v_request.listing_id;
  IF v_listing.type = 'OFFER' THEN
    v_mentor_id := v_request.target_id;
    v_mentee_id := v_request.requester_id;
  ELSE
    v_mentor_id := v_request.requester_id;
    v_mentee_id := v_request.target_id;
  END IF;
  INSERT INTO public.mentorship_relations (mentor_id, mentee_id, original_request_id, original_listing_id) VALUES (v_mentor_id, v_mentee_id, request_id, v_request.listing_id) RETURNING id INTO v_relation_id;
  UPDATE public.mentorship_requests SET status = 'ACCEPTED', responded_at = NOW() WHERE id = request_id;
  RETURN v_relation_id;
END;
$$;


--
-- Name: admin_close_payroll_period(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_close_payroll_period(p_year integer, p_month integer) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  v_period_id uuid;
  v_period_status text;
  v_start date;
  v_end date;
  v_open_count integer;
  v_missing_rate_count integer;
  v_teacher record;
  v_snapshot_id uuid;
  v_total_minutes integer;
  v_total_amount integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;

  v_start := make_date(p_year, p_month, 1);
  v_end := (v_start + interval '1 month' - interval '1 day')::date;

  SELECT id, status INTO v_period_id, v_period_status
    FROM public.payroll_periods WHERE year = p_year AND month = p_month;

  IF v_period_id IS NULL THEN
    INSERT INTO public.payroll_periods (year, month, status)
    VALUES (p_year, p_month, 'review')
    RETURNING id, status INTO v_period_id, v_period_status;
  END IF;

  IF v_period_status = 'locked' THEN
    RAISE EXCEPTION 'period_already_locked' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_open_count
    FROM public.work_entries
   WHERE work_date BETWEEN v_start AND v_end
     AND status IN ('draft', 'submitted');
  IF v_open_count > 0 THEN
    RAISE EXCEPTION 'open_entries_remaining' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_missing_rate_count
    FROM public.work_entries we
   WHERE we.work_date BETWEEN v_start AND v_end
     AND we.status = 'approved'
     AND NOT EXISTS (
       SELECT 1 FROM public.teacher_rate_agreements ra
        WHERE ra.teacher_id = we.teacher_id
          AND ra.valid_from <= we.work_date
          AND (ra.valid_until IS NULL OR ra.valid_until >= we.work_date)
     );
  IF v_missing_rate_count > 0 THEN
    RAISE EXCEPTION 'missing_rate_agreement' USING ERRCODE = '22023';
  END IF;

  FOR v_teacher IN
    SELECT DISTINCT teacher_id FROM public.work_entries
     WHERE work_date BETWEEN v_start AND v_end AND status = 'approved'
  LOOP
    SELECT
      coalesce(sum(we.duration_minutes), 0)::integer,
      coalesce(sum(round(we.duration_minutes * ra.hourly_rate_rappen / 60.0)), 0)::integer
      INTO v_total_minutes, v_total_amount
      FROM public.work_entries we
      JOIN public.teacher_rate_agreements ra
        ON ra.teacher_id = we.teacher_id
       AND ra.valid_from <= we.work_date
       AND (ra.valid_until IS NULL OR ra.valid_until >= we.work_date)
     WHERE we.teacher_id = v_teacher.teacher_id
       AND we.work_date BETWEEN v_start AND v_end
       AND we.status = 'approved';

    INSERT INTO public.payroll_snapshots (period_id, teacher_id, total_minutes, total_amount_rappen)
    VALUES (v_period_id, v_teacher.teacher_id, v_total_minutes, v_total_amount)
    RETURNING id INTO v_snapshot_id;

    INSERT INTO public.payroll_snapshot_lines (
      snapshot_id, work_entry_id, rate_agreement_id, duration_minutes, hourly_rate_rappen, amount_rappen
    )
    SELECT
      v_snapshot_id, we.id, ra.id, we.duration_minutes, ra.hourly_rate_rappen,
      round(we.duration_minutes * ra.hourly_rate_rappen / 60.0)::integer
      FROM public.work_entries we
      JOIN public.teacher_rate_agreements ra
        ON ra.teacher_id = we.teacher_id
       AND ra.valid_from <= we.work_date
       AND (ra.valid_until IS NULL OR ra.valid_until >= we.work_date)
     WHERE we.teacher_id = v_teacher.teacher_id
       AND we.work_date BETWEEN v_start AND v_end
       AND we.status = 'approved';

    UPDATE public.work_entries
       SET status = 'locked'
     WHERE teacher_id = v_teacher.teacher_id
       AND work_date BETWEEN v_start AND v_end
       AND status = 'approved';

    -- Schritt 10d: aggregierter payroll_cost-Ledgereintrag je Snapshot (idempotent -- ein erneuter
    -- Abschlussversuch fuer dieselbe (bereits gesperrte) Periode scheitert ohnehin an
    -- period_already_locked weiter oben, es kann also nie zwei Eintraege fuer denselben Snapshot
    -- geben).
    IF v_total_amount > 0 THEN
      INSERT INTO public.financial_events (
        event_type, source_kind, source_id, event_version, amount_rappen, occurred_at, recognized_at, status
      )
      VALUES (
        'payroll_cost', 'payroll_snapshot', v_snapshot_id::text, 1, -v_total_amount, now(), v_end::timestamptz, 'confirmed'
      )
      ON CONFLICT (source_kind, source_id, event_type, event_version) DO NOTHING;
    END IF;
  END LOOP;

  UPDATE public.payroll_periods
     SET status = 'locked', locked_at = now(), locked_by = auth.uid()
   WHERE id = v_period_id;

  RETURN v_period_id;
END;
$$;


--
-- Name: FUNCTION admin_close_payroll_period(p_year integer, p_month integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.admin_close_payroll_period(p_year integer, p_month integer) IS 'Schritt 10c (PayrollReviewPanel): schliesst einen Monat atomar ab -- prueft auf offene Eintraege und fehlende Lohnvereinbarungen, erzeugt unveraenderliche payroll_snapshots/-lines je Lehrperson mit dem am Leistungsdatum gueltigen Satz, sperrt die verrechneten work_entries (approved->locked) und den Zeitraum selbst. Admin-only (is_admin()).';


--
-- Name: admin_save_daily_release(uuid, text, timestamp with time zone, timestamp with time zone, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_save_daily_release(p_course_day_id uuid, p_status text, p_opens_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_closes_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_items jsonb DEFAULT '[]'::jsonb) RETURNS uuid
    LANGUAGE plpgsql
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


--
-- Name: FUNCTION admin_save_daily_release(p_course_day_id uuid, p_status text, p_opens_at timestamp with time zone, p_closes_at timestamp with time zone, p_items jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.admin_save_daily_release(p_course_day_id uuid, p_status text, p_opens_at timestamp with time zone, p_closes_at timestamp with time zone, p_items jsonb) IS 'Schritt 10b (DailyReleaseManager): legt/aktualisiert die Freigabe eines Kurstags samt kuratierter Inhaltsliste atomar an. Admin-only (is_admin()), find-or-create in release_content_catalog, ersetzt daily_release_items vollstaendig.';


--
-- Name: admin_save_rate_agreement(uuid, integer, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_save_rate_agreement(p_teacher_id uuid, p_hourly_rate_rappen integer, p_valid_from date) RETURNS uuid
    LANGUAGE plpgsql
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


--
-- Name: FUNCTION admin_save_rate_agreement(p_teacher_id uuid, p_hourly_rate_rappen integer, p_valid_from date); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.admin_save_rate_agreement(p_teacher_id uuid, p_hourly_rate_rappen integer, p_valid_from date) IS 'Schritt 10c (PayrollReviewPanel): schliesst atomar eine offene Vorgaenger-Lohnvereinbarung und legt die neue an, damit nie eine offene Luecke oder ein EXCLUDE-Konflikt entsteht. Admin-only (is_admin()); fruehere, bereits befristete Vereinbarungen bleiben unangetastet.';


--
-- Name: admin_upsert_course_session(uuid, text, text, text, date, date, text, text, integer, text, bigint, text, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_upsert_course_session(p_edition_id uuid, p_name text, p_fach text, p_beschreibung text, p_start_datum date, p_end_datum date, p_uhrzeit text, p_ort text, p_max_teilnehmer integer, p_lehrer text, p_kurs_id bigint DEFAULT NULL::bigint, p_registration_status text DEFAULT 'bookable'::text, p_delivery_modes text[] DEFAULT ARRAY['onsite'::text]) RETURNS bigint
    LANGUAGE plpgsql
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


--
-- Name: FUNCTION admin_upsert_course_session(p_edition_id uuid, p_name text, p_fach text, p_beschreibung text, p_start_datum date, p_end_datum date, p_uhrzeit text, p_ort text, p_max_teilnehmer integer, p_lehrer text, p_kurs_id bigint, p_registration_status text, p_delivery_modes text[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.admin_upsert_course_session(p_edition_id uuid, p_name text, p_fach text, p_beschreibung text, p_start_datum date, p_end_datum date, p_uhrzeit text, p_ort text, p_max_teilnehmer integer, p_lehrer text, p_kurs_id bigint, p_registration_status text, p_delivery_modes text[]) IS 'Schritt 10a (SessionEditor): legt einen Termin atomar in intensivwoche_kurse + course_sessions an oder aktualisiert beide Zeilen. Admin-only (is_admin()), Standort auf Zuerich HB/Winterthur begrenzt, neue Zeilen bleiben ist_aktiv=false (kein Leck in den Legacy-/kurse-Pfad).';


--
-- Name: book_intensivwoche_kurs(bigint, text, text, text, text, text, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.book_intensivwoche_kurs(p_kurs_id bigint, p_child_firstname text, p_child_lastname text, p_child_class_level text, p_child_gender text, p_parent_email text, p_parent_phone text, p_notes text DEFAULT NULL::text, p_idempotency_key uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_kurs RECORD;
  v_belegt INTEGER;
  v_email TEXT := lower(trim(p_parent_email));
  v_new_id UUID;
  v_existing_id UUID;
  v_versuche_count INTEGER;
  v_early_bird BOOLEAN;
  v_price_rappen INTEGER;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM public.intensivwoche_anmeldungen
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      IF (SELECT kurs_id FROM public.intensivwoche_anmeldungen WHERE id = v_existing_id) <> p_kurs_id THEN
        RAISE EXCEPTION 'idempotency_key_reused_for_different_kurs' USING ERRCODE = 'P0001';
      END IF;
      RETURN v_existing_id;
    END IF;
  END IF;

  SELECT count(*) INTO v_versuche_count
  FROM public.intensivwoche_buchungsversuche
  WHERE lower(parent_email) = v_email
    AND attempted_at > now() - interval '10 minutes';

  IF v_versuche_count >= 5 THEN
    RAISE EXCEPTION 'rate_limit_exceeded' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.intensivwoche_buchungsversuche (parent_email) VALUES (v_email);

  SELECT * INTO v_kurs
  FROM public.intensivwoche_kurse
  WHERE id = p_kurs_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'kurs_nicht_gefunden' USING ERRCODE = 'P0001';
  END IF;

  IF NOT v_kurs.ist_aktiv THEN
    RAISE EXCEPTION 'kurs_inaktiv' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.intensivwoche_anmeldungen
    WHERE kurs_id = p_kurs_id
      AND lower(parent_email) = v_email
      AND lower(trim(child_firstname)) = lower(trim(p_child_firstname))
      AND lower(trim(child_lastname)) = lower(trim(p_child_lastname))
      AND status <> 'storniert'
  ) THEN
    RAISE EXCEPTION 'bereits_angemeldet' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO v_belegt
  FROM public.intensivwoche_anmeldungen
  WHERE kurs_id = p_kurs_id
    AND status <> 'storniert';

  IF v_belegt >= v_kurs.max_teilnehmer THEN
    RAISE EXCEPTION 'voll' USING ERRCODE = 'P0001';
  END IF;

  -- Automatischer Frühbucherrabatt: 10% wenn Anmeldung >= 6 Wochen (42 Tage) vor Kursstart.
  -- Kalendertag in Europe/Zurich, damit der Stichtag unabhängig von der Server-/Session-Zeitzone
  -- konsistent zur Zürcher Ortszeit bleibt (gleiches Prinzip wie lib/utils/zurich-time.ts).
  v_early_bird := (now() AT TIME ZONE 'Europe/Zurich')::date <= (v_kurs.start_datum - 42);
  v_price_rappen := round(v_kurs.preis * 100 * (CASE WHEN v_early_bird THEN 0.9 ELSE 1.0 END))::INTEGER;

  BEGIN
    INSERT INTO public.intensivwoche_anmeldungen (
      kurs_id, child_firstname, child_lastname, child_class_level, child_gender,
      parent_email, parent_phone, notes, booked_price_rappen, currency, idempotency_key
    ) VALUES (
      p_kurs_id,
      trim(p_child_firstname),
      trim(p_child_lastname),
      trim(p_child_class_level),
      p_child_gender,
      v_email,
      trim(p_parent_phone),
      NULLIF(trim(p_notes), ''),
      v_price_rappen,
      'CHF',
      p_idempotency_key
    )
    RETURNING id INTO v_new_id;
  EXCEPTION WHEN unique_violation THEN
    IF p_idempotency_key IS NOT NULL THEN
      SELECT id INTO v_new_id
      FROM public.intensivwoche_anmeldungen
      WHERE idempotency_key = p_idempotency_key;

      IF FOUND THEN
        RETURN v_new_id;
      END IF;
    END IF;
    RAISE;
  END;

  RETURN v_new_id;
END;
$$;


--
-- Name: FUNCTION book_intensivwoche_kurs(p_kurs_id bigint, p_child_firstname text, p_child_lastname text, p_child_class_level text, p_child_gender text, p_parent_email text, p_parent_phone text, p_notes text, p_idempotency_key uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.book_intensivwoche_kurs(p_kurs_id bigint, p_child_firstname text, p_child_lastname text, p_child_class_level text, p_child_gender text, p_parent_email text, p_parent_phone text, p_notes text, p_idempotency_key uuid) IS 'Einzige zulässige Schreibstelle für Kursanmeldungen. Sperrt den Kurs (FOR UPDATE), prüft Rate-Limit (5/10min je parent_email)/Aktivität/Kapazität/familienfähige Doppelanmeldung atomar, unterstützt idempotente Wiederholungen über idempotency_key, berechnet automatisch 10% Frühbucherrabatt bei Anmeldung >=6 Wochen vor Kursstart und schreibt den Preis-Snapshot. Fester leerer search_path, SECURITY DEFINER.';


--
-- Name: bump_version_and_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bump_version_and_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  NEW.version = OLD.version + 1;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION bump_version_and_updated_at(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.bump_version_and_updated_at() IS 'Erzwingt Optimistic-Concurrency-Versionierung serverseitig (Abschnitt 2.12) auf offer_editions/course_sessions -- der Client liest die aktuelle version, die Server Action filtert das UPDATE per .eq(version, gelesen) und erkennt einen Konflikt an null betroffenen Zeilen.';


--
-- Name: count_active_anmeldungen(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.count_active_anmeldungen(p_kurs_id bigint) RETURNS bigint
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT count(*)
  FROM public.intensivwoche_anmeldungen
  WHERE kurs_id = p_kurs_id
    AND status <> 'storniert';
$$;


--
-- Name: FUNCTION count_active_anmeldungen(p_kurs_id bigint); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.count_active_anmeldungen(p_kurs_id bigint) IS 'Liefert ausschliesslich die Anzahl nicht stornierter Anmeldungen fuer einen Kurs (kein Zeilenzugriff/keine Personendaten). SECURITY DEFINER mit festem leeren search_path, damit intensivwoche_kurse_mit_anmeldungen fuer anon/authenticated eine korrekte Aggregatzahl liefert, ohne einzelne Anmeldungszeilen offenzulegen (Fix fuer die RLS-bedingte 0-Zaehlung unter security_invoker=true).';


--
-- Name: enforce_anmeldung_price_snapshot_immutable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_anmeldung_price_snapshot_immutable() RETURNS trigger
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


--
-- Name: FUNCTION enforce_anmeldung_price_snapshot_immutable(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.enforce_anmeldung_price_snapshot_immutable() IS 'Blockiert Aenderungen an booked_price_rappen/currency/edition_id/session_id nach dem INSERT (Abschnitt 2.10 Punkt 9). Erweitert um edition_id/session_id in Migration 20260720170000; status/paid_at-Updates ueber die bestehende Admin-Policy bleiben unangetastet.';


--
-- Name: enqueue_booking_confirmation_mail(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enqueue_booking_confirmation_mail() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  INSERT INTO public.mail_outbox (anmeldung_id, template_key)
  VALUES (NEW.id, 'booking_confirmation')
  ON CONFLICT (anmeldung_id, template_key) DO NOTHING;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION enqueue_booking_confirmation_mail(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.enqueue_booking_confirmation_mail() IS 'Trigger-Funktion: legt nach jeder neuen intensivwoche_anmeldungen-Zeile automatisch eine mail_outbox-Zeile an. SECURITY DEFINER mit leerem search_path, damit der anon-Buchungspfad (book_intensivwoche_kurs) sie ohne zusaetzliche Grants ausloesen kann; ON CONFLICT DO NOTHING macht wiederholtes Feuern idempotent.';


--
-- Name: get_upcoming_courses(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_upcoming_courses() RETURNS SETOF jsonb
    LANGUAGE sql
    AS $$
  select jsonb_build_object(
    'id', c.id,
    'title', c.title,
    'description', c.description,
    'price', c.price,
    'payment_method', c.payment_method,
    'location', c.location,
    'timezone', c.timezone,
    'created_at', c.created_at,
    'occurrences', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', o.id,
          'starts_at_utc', o.starts_at_utc,
          'ends_at_utc', o.ends_at_utc
        ) order by o.starts_at_utc
      ) filter (where o.starts_at_utc > now()),
      '[]'::jsonb
    )
  )
  from public.courses c
  join public.course_occurrences o on o.course_id = c.id
  where o.starts_at_utc > now()
  group by c.id;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    'user'  -- Standard-Rolle
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION handle_new_user(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.handle_new_user() IS 'Trigger-Function: Erstellt automatisch einen profiles-Eintrag wenn ein User registriert wird';


--
-- Name: increment_material_view_count(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_material_view_count(material_id integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE learning_materials
  SET download_count = download_count + 1
  WHERE id = material_id;
END;
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;


--
-- Name: FUNCTION is_admin(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.is_admin() IS 'Prüft ob der User ein System-Administrator ist (nur für sensible Daten/System-Einstellungen)';


--
-- Name: is_content_manager(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_content_manager() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('lehrperson', 'admin')
  );
END;
$$;


--
-- Name: FUNCTION is_content_manager(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.is_content_manager() IS 'Prüft ob User mindestens Lehrperson ist (role IN (''lehrperson'', ''admin'')). 
   Verwendet für Content-Verwaltung: Kurse, Übungen, Materialien, Badges.
   Ersetzt die frühere is_lehrperson() Funktion.';


--
-- Name: is_kurs_aktiv(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_kurs_aktiv(p_kurs_id bigint) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.intensivwoche_kurse 
    WHERE id = p_kurs_id AND ist_aktiv = true
  );
END;
$$;


--
-- Name: FUNCTION is_kurs_aktiv(p_kurs_id bigint); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.is_kurs_aktiv(p_kurs_id bigint) IS 'Checks if a course is active. SECURITY DEFINER to allow anon to check.';


--
-- Name: is_kurs_owner(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_kurs_owner(kurs_created_by uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  -- Admins sehen alles
  IF public.is_admin() THEN
    RETURN TRUE;
  END IF;
  -- Lehrpersonen sehen nur eigene Kurse
  RETURN auth.uid() = kurs_created_by;
END;
$$;


--
-- Name: FUNCTION is_kurs_owner(kurs_created_by uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.is_kurs_owner(kurs_created_by uuid) IS 'Prüft ob User Ersteller des Kurses ist oder Admin (für Owner-basierte Policies)';


--
-- Name: is_owner(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_owner(record_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  RETURN auth.uid() IS NOT NULL AND auth.uid() = record_user_id;
END;
$$;


--
-- Name: FUNCTION is_owner(record_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.is_owner(record_user_id uuid) IS 'Returns true if auth.uid() matches the provided user_id';


--
-- Name: link_anmeldung_beneficiary(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.link_anmeldung_beneficiary() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
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


--
-- Name: FUNCTION link_anmeldung_beneficiary(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.link_anmeldung_beneficiary() IS 'Heuristische Auto-Verknuepfung einer Anmeldung mit einem existierenden Profil per E-Mail-Abgleich (Schritt 10b). Findet sie keine Uebereinstimmung, bleibt beneficiary_user_id NULL -- kein Zugriff auf Tagesfreigaben, bis manuell verknuepft.';


--
-- Name: set_essay_review_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_essay_review_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.status = 'reviewed' AND OLD.status = 'submitted' THEN
    NEW.reviewed_at = NOW();
    NEW.reviewed_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: sync_anmeldung_financial_events(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_anmeldung_financial_events() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.booked_price_rappen IS NOT NULL THEN
      INSERT INTO public.financial_events (
        event_type, source_kind, source_id, event_version, amount_rappen, occurred_at,
        recognized_at, edition_id, session_id, status
      )
      SELECT
        'booking', 'anmeldung', NEW.id::text, 1, NEW.booked_price_rappen, NEW.created_at,
        coalesce(k.start_datum::timestamptz, NEW.created_at), NEW.edition_id, NEW.session_id, 'confirmed'
        FROM public.intensivwoche_kurse k WHERE k.id = NEW.kurs_id
      ON CONFLICT (source_kind, source_id, event_type, event_version) DO NOTHING;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.paid_at IS NOT NULL AND OLD.paid_at IS NULL AND NEW.booked_price_rappen IS NOT NULL THEN
      INSERT INTO public.financial_events (
        event_type, source_kind, source_id, event_version, amount_rappen, occurred_at,
        recognized_at, edition_id, session_id, status
      )
      VALUES (
        'payment', 'anmeldung', NEW.id::text, 1, NEW.booked_price_rappen, NEW.paid_at,
        NEW.paid_at, NEW.edition_id, NEW.session_id, 'confirmed'
      )
      ON CONFLICT (source_kind, source_id, event_type, event_version) DO NOTHING;
    END IF;

    IF NEW.status = 'storniert' AND OLD.status IS DISTINCT FROM 'storniert' AND NEW.booked_price_rappen IS NOT NULL THEN
      INSERT INTO public.financial_events (
        event_type, source_kind, source_id, event_version, amount_rappen, occurred_at,
        recognized_at, edition_id, session_id, status
      )
      VALUES (
        'refund', 'anmeldung', NEW.id::text, 1, -NEW.booked_price_rappen, now(),
        now(), NEW.edition_id, NEW.session_id, 'confirmed'
      )
      ON CONFLICT (source_kind, source_id, event_type, event_version) DO NOTHING;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION sync_anmeldung_financial_events(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.sync_anmeldung_financial_events() IS 'Spiegelt Buchung (INSERT), erste Zahlung (paid_at NULL->gesetzt) und Storno (status->storniert) automatisch als financial_events (Schritt 10d). Idempotent ueber ON CONFLICT DO NOTHING je fester event_version=1 -- ein zweites Update mit bereits gesetztem paid_at/status erzeugt keinen weiteren Eintrag.';


--
-- Name: sync_expense_financial_event(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_expense_financial_event() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  IF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.financial_events (
      event_type, source_kind, source_id, event_version, amount_rappen, occurred_at,
      recognized_at, edition_id, session_id, status
    )
    VALUES (
      CASE WHEN NEW.category = 'overhead' THEN 'overhead' ELSE 'course_expense' END,
      'expense_entry', NEW.id::text, 1, -NEW.amount_rappen, NEW.service_date::timestamptz,
      NEW.service_date::timestamptz, NEW.edition_id, NEW.session_id, 'confirmed'
    )
    ON CONFLICT (source_kind, source_id, event_type, event_version) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION sync_expense_financial_event(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.sync_expense_financial_event() IS 'Spiegelt eine Ausgabe bei der ERSTEN Genehmigung nach financial_events (Schritt 10d); feste event_version=1 verhindert doppelte Ledger-Eintraege bei spaeterer Bearbeitung nach Genehmigung.';


--
-- Name: sync_financial_adjustment_event(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_financial_adjustment_event() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  INSERT INTO public.financial_events (
    event_type, source_kind, source_id, event_version, amount_rappen, occurred_at, recognized_at, status
  )
  VALUES ('manual_adjustment', 'financial_adjustment', NEW.id::text, 1, NEW.amount_rappen, NEW.created_at, NEW.created_at, 'confirmed')
  ON CONFLICT (source_kind, source_id, event_type, event_version) DO NOTHING;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION sync_financial_adjustment_event(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.sync_financial_adjustment_event() IS 'Spiegelt jede manuelle Korrekturbuchung nach financial_events (Schritt 10d).';


--
-- Name: update_correction_rubrics_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_correction_rubrics_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_mentorship_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_mentorship_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_student_essays_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_student_essays_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: validate_work_entry_status_transition(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_work_entry_status_transition() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  IF (OLD.status = 'draft' AND NEW.status = 'submitted')
     OR (OLD.status = 'submitted' AND NEW.status IN ('approved', 'rejected'))
     OR (OLD.status = 'rejected' AND NEW.status = 'draft')
     OR (OLD.status = 'approved' AND NEW.status = 'locked') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'invalid_work_entry_status_transition' USING ERRCODE = '22023';
END;
$$;


--
-- Name: FUNCTION validate_work_entry_status_transition(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.validate_work_entry_status_transition() IS 'Erzwingt die in Abschnitt 2.14 zulaessigen Statusuebergaenge: draft->submitted->approved|rejected, rejected->draft, approved->locked (nur ueber den Monatsabschluss). Jeder andere Uebergang wird abgelehnt.';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_user_id uuid,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    action text NOT NULL,
    diff jsonb
);


--
-- Name: TABLE audit_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audit_log IS 'Generisches Mutationsprotokoll (Abschnitt 2.12): Benutzer, Zeitpunkt, Entity, Aktion, Vorher-/Nachher-Diff ohne personenbezogene Buchungsdaten. Nur fuer Admins lesbar. Befuellung ist Aufgabe der Admin-Maske-Publish-Server-Action (separate Runde), kein automatischer Trigger.';


--
-- Name: badges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.badges (
    id bigint NOT NULL,
    name text,
    criteria text,
    icon text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: badges_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.badges ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.badges_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: budgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budgets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    period_id uuid NOT NULL,
    category text NOT NULL,
    amount_rappen integer NOT NULL,
    currency text DEFAULT 'CHF'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT budgets_amount_rappen_check CHECK ((amount_rappen >= 0))
);


--
-- Name: TABLE budgets; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.budgets IS 'Budget je Kategorie und Jahr (Schritt 10d). Admin-only.';


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    relation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    content text NOT NULL,
    attachment_urls text[],
    is_read boolean DEFAULT false,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    edited_at timestamp with time zone
);


--
-- Name: correction_rubrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.correction_rubrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    subject text,
    type text NOT NULL,
    pdf_path text,
    pdf_name text,
    criteria jsonb,
    max_points integer,
    description text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT correction_rubrics_type_check CHECK ((type = ANY (ARRAY['pdf'::text, 'structured'::text])))
);


--
-- Name: course_days; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_days (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id bigint NOT NULL,
    sequence integer NOT NULL,
    course_date date NOT NULL,
    CONSTRAINT course_days_sequence_check CHECK ((sequence >= 1))
);


--
-- Name: TABLE course_days; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.course_days IS 'Kurstage einer course_session (Schritt 10b, Abschnitt 2.13). Admin-only -- kein Schueler-Leserecht in dieser Runde, da nur die Admin-Maske (nicht eine Schueler-Seite) Teil dieser Route ist.';


--
-- Name: course_occurrences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_occurrences (
    id bigint NOT NULL,
    starts_at_utc timestamp with time zone NOT NULL,
    ends_at_utc timestamp with time zone NOT NULL,
    course_id bigint,
    CONSTRAINT course_occurrences_check CHECK ((ends_at_utc > starts_at_utc))
);


--
-- Name: course_occurrences_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.course_occurrences ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.course_occurrences_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: course_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_sessions (
    id bigint NOT NULL,
    edition_id uuid NOT NULL,
    delivery_modes text[] DEFAULT ARRAY['onsite'::text] NOT NULL,
    registration_status text DEFAULT 'bookable'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT course_sessions_registration_status_check CHECK ((registration_status = ANY (ARRAY['bookable'::text, 'waitlist'::text, 'cancelled'::text])))
);


--
-- Name: TABLE course_sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.course_sessions IS 'Optionale 1:1-Erweiterung von intensivwoche_kurse (Abschnitt 2.12) -- id ist zugleich PK und FK, kein zweites Durchfuehrungssystem. Name/Datum/Standort/Kapazitaet/Aktivitaet bleiben kanonisch in intensivwoche_kurse. Oeffentlich nur wenn die zugehoerige Edition published ist. Schreibzugriff nur ueber service_role bis die Admin-Maske existiert.';


--
-- Name: courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.courses (
    id bigint NOT NULL,
    title text,
    description text,
    price real,
    location text,
    timezone text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    payment_method text
);


--
-- Name: courses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.courses ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.courses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: daily_release_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_release_items (
    release_id uuid NOT NULL,
    content_item_id uuid NOT NULL,
    "position" integer NOT NULL
);


--
-- Name: TABLE daily_release_items; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.daily_release_items IS 'Kuratierte Inhalte + Reihenfolge je Freigabe (Schritt 10b). Die Sichtbarkeitsregel liegt bereits vollstaendig in daily_releases_enrolled_read; hier reicht die Existenz der (dank RLS bereits gefilterten) Elternzeile.';


--
-- Name: daily_releases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_releases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_day_id uuid NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    opens_at timestamp with time zone,
    closes_at timestamp with time zone,
    version integer DEFAULT 1 NOT NULL,
    published_by uuid,
    published_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT daily_releases_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'active'::text, 'revoked'::text]))),
    CONSTRAINT daily_releases_window_order CHECK (((opens_at IS NULL) OR (closes_at IS NULL) OR (opens_at < closes_at)))
);


--
-- Name: TABLE daily_releases; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.daily_releases IS 'Genau eine aktuelle Freigabe pro Kurstag (Schritt 10b, Abschnitt 2.13). Admin-Vollzugriff, eingeschriebene Lernende sehen nur status=active innerhalb des Zeitfensters fuer ihre eigene course_session.';


--
-- Name: essay_ai_corrections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.essay_ai_corrections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    essay_id uuid NOT NULL,
    rubric_id uuid,
    raw_suggestion text DEFAULT ''::text NOT NULL,
    teacher_edited_suggestion text,
    status text DEFAULT 'generating'::text NOT NULL,
    model_used text DEFAULT 'claude-sonnet-4-6'::text NOT NULL,
    input_tokens integer,
    output_tokens integer,
    generated_at timestamp with time zone DEFAULT now(),
    released_at timestamp with time zone,
    released_by uuid,
    CONSTRAINT essay_ai_corrections_status_check CHECK ((status = ANY (ARRAY['generating'::text, 'ready'::text, 'released'::text])))
);


--
-- Name: exercises; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exercises (
    id bigint NOT NULL,
    subject_id bigint,
    title text,
    subtitle text,
    table_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    type text,
    class_levels text[] NOT NULL,
    CONSTRAINT exercises_class_levels_check CHECK (((cardinality(class_levels) > 0) AND (class_levels <@ ARRAY['4. Klasse'::text, '5. Klasse'::text, '6. Klasse'::text, '1. Sek'::text, '2. Sek'::text, '3. Sek'::text, 'Gymnasium'::text])))
);


--
-- Name: COLUMN exercises.class_levels; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.exercises.class_levels IS 'Mindestens eine der sieben Klassenstufen aus der Login-Navigation; steuert den Übungsfilter.';


--
-- Name: exercises_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.exercises ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.exercises_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: expense_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category text NOT NULL,
    amount_rappen integer NOT NULL,
    currency text DEFAULT 'CHF'::text NOT NULL,
    service_date date NOT NULL,
    edition_id uuid,
    session_id bigint,
    receipt_ref text,
    status text DEFAULT 'draft'::text NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT expense_entries_amount_rappen_check CHECK ((amount_rappen > 0)),
    CONSTRAINT expense_entries_category_check CHECK ((category = ANY (ARRAY['room'::text, 'material'::text, 'marketing'::text, 'external_service'::text, 'overhead'::text]))),
    CONSTRAINT expense_entries_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'cancelled'::text])))
);


--
-- Name: TABLE expense_entries; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.expense_entries IS 'Raum-/Material-/Marketing-/externe/Betriebskosten (Schritt 10d). Admin-only. status=approved spiegelt einmalig (ON CONFLICT DO NOTHING) einen course_expense/overhead-Eintrag nach financial_events -- spaetere Bearbeitung nach Genehmigung erzeugt keinen zweiten Ledger-Eintrag.';


--
-- Name: financial_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_adjustments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    period_id uuid NOT NULL,
    category text,
    amount_rappen integer NOT NULL,
    currency text DEFAULT 'CHF'::text NOT NULL,
    reason text NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE financial_adjustments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.financial_adjustments IS 'Auditierte manuelle Korrekturbuchung (Schritt 10d) -- spiegelt sich automatisch nach financial_events (event_type=manual_adjustment).';


--
-- Name: financial_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type text NOT NULL,
    source_kind text NOT NULL,
    source_id text NOT NULL,
    event_version integer DEFAULT 1 NOT NULL,
    amount_rappen integer NOT NULL,
    currency text DEFAULT 'CHF'::text NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    recognized_at timestamp with time zone DEFAULT now() NOT NULL,
    edition_id uuid,
    session_id bigint,
    audience_id text,
    status text DEFAULT 'confirmed'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT financial_events_event_type_check CHECK ((event_type = ANY (ARRAY['booking'::text, 'payment'::text, 'refund'::text, 'payroll_cost'::text, 'course_expense'::text, 'overhead'::text, 'manual_adjustment'::text]))),
    CONSTRAINT financial_events_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled'::text])))
);


--
-- Name: TABLE financial_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.financial_events IS 'Idempotenter, append-only Reporting-Ledger (Schritt 10d, Abschnitt 2.15). Wird ausschliesslich durch SECURITY-DEFINER-Trigger/RPCs befuellt (sync_anmeldung_financial_events, sync_expense_financial_event, sync_financial_adjustment_event, admin_close_payroll_period) -- kein direkter INSERT/UPDATE/DELETE fuer authenticated, admin liest nur.';


--
-- Name: financial_periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_periods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    year integer NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    locked_at timestamp with time zone,
    locked_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT financial_periods_status_check CHECK ((status = ANY (ARRAY['open'::text, 'review'::text, 'locked'::text]))),
    CONSTRAINT financial_periods_year_check CHECK (((year >= 2020) AND (year <= 2100)))
);


--
-- Name: TABLE financial_periods; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.financial_periods IS 'Jaehrlicher Finanzabschluss-Status (Schritt 10d). Admin-only.';


--
-- Name: intensivwoche_anmeldungen; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.intensivwoche_anmeldungen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kurs_id bigint,
    child_firstname text NOT NULL,
    child_lastname text NOT NULL,
    child_class_level text NOT NULL,
    child_gender text NOT NULL,
    parent_email text NOT NULL,
    parent_phone text NOT NULL,
    notes text,
    status text DEFAULT 'eingegangen'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    paid_at timestamp with time zone,
    booked_price_rappen integer,
    currency text DEFAULT 'CHF'::text NOT NULL,
    idempotency_key uuid,
    edition_id uuid,
    session_id bigint,
    beneficiary_user_id uuid,
    CONSTRAINT anmeldungen_child_class_level_length_check CHECK (((char_length(TRIM(BOTH FROM child_class_level)) >= 1) AND (char_length(TRIM(BOTH FROM child_class_level)) <= 20))),
    CONSTRAINT anmeldungen_child_firstname_length_check CHECK (((char_length(TRIM(BOTH FROM child_firstname)) >= 2) AND (char_length(TRIM(BOTH FROM child_firstname)) <= 50))),
    CONSTRAINT anmeldungen_child_lastname_length_check CHECK (((char_length(TRIM(BOTH FROM child_lastname)) >= 2) AND (char_length(TRIM(BOTH FROM child_lastname)) <= 50))),
    CONSTRAINT anmeldungen_notes_length_check CHECK (((notes IS NULL) OR (char_length(notes) <= 500))),
    CONSTRAINT anmeldungen_parent_email_format_check CHECK (((char_length(parent_email) <= 254) AND (parent_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'::text))),
    CONSTRAINT anmeldungen_parent_phone_format_check CHECK (((char_length(parent_phone) >= 10) AND (char_length(parent_phone) <= 20) AND (parent_phone ~ '^[\d\s+\-()]+$'::text))),
    CONSTRAINT booked_price_rappen_non_negative CHECK (((booked_price_rappen IS NULL) OR (booked_price_rappen >= 0))),
    CONSTRAINT intensivwoche_anmeldungen_child_gender_check CHECK ((child_gender = ANY (ARRAY['m'::text, 'w'::text, 'd'::text]))),
    CONSTRAINT intensivwoche_anmeldungen_status_check CHECK ((status = ANY (ARRAY['eingegangen'::text, 'bestaetigt'::text, 'bezahlt'::text, 'storniert'::text])))
);


--
-- Name: TABLE intensivwoche_anmeldungen; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.intensivwoche_anmeldungen IS 'Öffentliche Anmeldungen für Intensivwochen-Kurse. Schreibzugriff ausschließlich über die SECURITY DEFINER Funktion book_intensivwoche_kurs(); RLS erlaubt SELECT/UPDATE/DELETE nur für Admins (is_admin()). anon behält nur SELECT (für die aggregierende, security_invoker View intensivwoche_kurse_mit_anmeldungen) — mangels RLS-Policy sieht anon dabei keine einzelnen Zeilen.';


--
-- Name: COLUMN intensivwoche_anmeldungen.booked_price_rappen; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.intensivwoche_anmeldungen.booked_price_rappen IS 'Unveränderlicher Preis-Snapshot in Rappen zum Buchungszeitpunkt. NULL bei Altzeilen vor dieser Migration. Wird von book_intensivwoche_kurs() (Migration 014) gesetzt, niemals nachträglich aus intensivwoche_kurse.preis neu berechnet.';


--
-- Name: intensivwoche_buchungsversuche; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.intensivwoche_buchungsversuche (
    id bigint NOT NULL,
    parent_email text NOT NULL,
    attempted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE intensivwoche_buchungsversuche; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.intensivwoche_buchungsversuche IS 'Zähl-Log für den Rate-Limiter in book_intensivwoche_kurs() (max. 5 Versuche / 10 Minuten je parent_email). Nur über die SECURITY DEFINER Funktion beschrieben/gelesen, RLS ohne Policies, keine Grants an anon/authenticated. Wird bewusst nicht automatisch bereinigt (Phase B); künftiges Pruning ist ein separater, additiver Schritt.';


--
-- Name: intensivwoche_buchungsversuche_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.intensivwoche_buchungsversuche ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.intensivwoche_buchungsversuche_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: intensivwoche_kurse; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.intensivwoche_kurse (
    id bigint NOT NULL,
    name text NOT NULL,
    fach text NOT NULL,
    beschreibung text NOT NULL,
    detail_beschreibung text,
    start_datum date NOT NULL,
    end_datum date NOT NULL,
    uhrzeit text NOT NULL,
    ort text NOT NULL,
    preis numeric(10,2) NOT NULL,
    max_teilnehmer integer DEFAULT 12 NOT NULL,
    klassenstufen text[] DEFAULT ARRAY['5. Klasse'::text, '6. Klasse'::text] NOT NULL,
    lehrer text NOT NULL,
    highlights text[] DEFAULT ARRAY[]::text[],
    ist_aktiv boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT intensivwoche_kurse_fach_check CHECK ((fach = ANY (ARRAY['mathematik'::text, 'deutsch'::text, 'franzoesisch'::text, 'natur-mensch-gesellschaft'::text]))),
    CONSTRAINT valid_date_range CHECK ((end_datum >= start_datum))
);


--
-- Name: TABLE intensivwoche_kurse; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.intensivwoche_kurse IS 'Intensivwoche-Kurse. RLS: Anon kann nur aktive Kurse lesen, Authenticated hat vollen Zugriff.';


--
-- Name: intensivwoche_kurse_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.intensivwoche_kurse_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: intensivwoche_kurse_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.intensivwoche_kurse_id_seq OWNED BY public.intensivwoche_kurse.id;


--
-- Name: intensivwoche_kurse_mit_anmeldungen; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.intensivwoche_kurse_mit_anmeldungen WITH (security_invoker='true') AS
 SELECT k.id,
    k.name,
    k.fach,
    k.beschreibung,
    k.detail_beschreibung,
    k.start_datum,
    k.end_datum,
    k.uhrzeit,
    k.ort,
    k.preis,
    k.max_teilnehmer,
    k.klassenstufen,
    k.lehrer,
    k.highlights,
    k.ist_aktiv,
    k.created_at,
    k.updated_at,
    k.created_by,
    a.anzahl_anmeldungen AS aktuelle_teilnehmer,
        CASE
            WHEN (a.anzahl_anmeldungen >= k.max_teilnehmer) THEN 'ausgebucht'::text
            WHEN (a.anzahl_anmeldungen >= (k.max_teilnehmer - 2)) THEN 'wenige-plaetze'::text
            ELSE 'offen'::text
        END AS status
   FROM (public.intensivwoche_kurse k
     CROSS JOIN LATERAL ( SELECT public.count_active_anmeldungen(k.id) AS anzahl_anmeldungen) a);


--
-- Name: VIEW intensivwoche_kurse_mit_anmeldungen; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.intensivwoche_kurse_mit_anmeldungen IS 'Oeffentliche Kursuebersicht mit aggregierter Belegung. security_invoker=true schuetzt alle Spalten/Joins korrekt per Aufrufer-RLS; aktuelle_teilnehmer/status werden bewusst ueber die SECURITY DEFINER-Funktion count_active_anmeldungen() berechnet, damit anon/authenticated eine korrekte Aggregatzahl sehen, ohne je eine einzelne intensivwoche_anmeldungen-Zeile lesen zu koennen.';


--
-- Name: learning_materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_materials (
    id bigint NOT NULL,
    name character varying,
    type character varying,
    description text,
    download_path text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    subject_id bigint,
    file_url text,
    file_size bigint,
    file_type text,
    class_levels text[] NOT NULL,
    created_by uuid,
    is_public boolean DEFAULT true,
    download_count integer DEFAULT 0,
    is_link boolean DEFAULT false,
    area_id bigint,
    CONSTRAINT learning_materials_class_levels_check CHECK (((cardinality(class_levels) > 0) AND (class_levels <@ ARRAY['4. Klasse'::text, '5. Klasse'::text, '6. Klasse'::text, '1. Sek'::text, '2. Sek'::text, '3. Sek'::text, 'Gymnasium'::text])))
);


--
-- Name: COLUMN learning_materials.class_levels; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.learning_materials.class_levels IS 'Mindestens eine explizite Klassenstufe für Navigation und Materialfilter; kein impliziter Default.';


--
-- Name: COLUMN learning_materials.is_link; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.learning_materials.is_link IS 'True if this material is a link/bookmark rather than an uploaded file';


--
-- Name: COLUMN learning_materials.area_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.learning_materials.area_id IS 'FK auf material_areas. Nullable: Zeilen mit mehrdeutigen/alten class_levels-Kombinationen (z.B. gleichzeitig 5./6. Klasse) bleiben bewusst NULL und gelten als needs_review, bis sie fachlich aufgeloest sind (Abschnitt 2.11).';


--
-- Name: learning_materials_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.learning_materials ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.learning_materials_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: mail_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mail_outbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    anmeldung_id uuid NOT NULL,
    template_key text DEFAULT 'booking_confirmation'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 5 NOT NULL,
    last_error text,
    provider_message_id text,
    next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mail_outbox_attempts_non_negative CHECK ((attempts >= 0)),
    CONSTRAINT mail_outbox_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text])))
);


--
-- Name: TABLE mail_outbox; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.mail_outbox IS 'Idempotente Versand-/Retry-Warteschlange fuer Buchungsbestaetigungen (Abschnitt 10.4). Enthaelt bewusst keine Kopie von Name/E-Mail/Notizen -- nur eine Referenz auf intensivwoche_anmeldungen plus Versandstatus.';


--
-- Name: COLUMN mail_outbox.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mail_outbox.status IS 'pending: noch nicht (erfolgreich) versendet. sent: erfolgreich zugestellt (Provider hat angenommen). failed: max_attempts erreicht, braucht manuelle Pruefung im Admin.';


--
-- Name: COLUMN mail_outbox.next_attempt_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mail_outbox.next_attempt_at IS 'Fruehester Zeitpunkt fuer den naechsten Versandversuch (exponentielles Backoff durch lib/mail/dispatch-outbox.ts gesetzt), verhindert Retry-Sturm bei einem vorübergehenden Provider-Ausfall.';


--
-- Name: material_access_grants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_access_grants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    area_id bigint NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    valid_from timestamp with time zone DEFAULT now() NOT NULL,
    valid_until timestamp with time zone,
    source_kind text NOT NULL,
    source_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT material_access_grants_source_kind_check CHECK ((source_kind = ANY (ARRAY['self_study_enrollment'::text, 'admin_grant'::text]))),
    CONSTRAINT material_access_grants_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'expired'::text])))
);


--
-- Name: TABLE material_access_grants; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.material_access_grants IS 'Effektiver Materialzugriff (Abschnitt 2.11). Entzug/Ablauf setzen status/revoked_at, niemals ein Hard-Delete. Admins duerfen admin_grant-Eintraege direkt erteilen/aktualisieren (Schritt 11a); self_study_enrollment-Eintraege bleiben bis zum spaeteren Zahlungs-Flow service_role-only.';


--
-- Name: material_areas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_areas (
    id bigint NOT NULL,
    key text NOT NULL,
    label text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE material_areas; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.material_areas IS 'Vier stabile Materialbereiche (Abschnitt 2.11). Nur Lookup-Daten, kein Geschäftsbestand -- oeffentlich lesbar, Schreibzugriff nur ueber service_role.';


--
-- Name: material_areas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.material_areas ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.material_areas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: math_solution_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.math_solution_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    exercise_type text NOT NULL,
    exercise_id integer NOT NULL,
    question text NOT NULL,
    solution text NOT NULL,
    steps jsonb NOT NULL,
    model_used text DEFAULT 'claude-sonnet-4-6'::text NOT NULL,
    generated_at timestamp with time zone DEFAULT now()
);


--
-- Name: mentor_skills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mentor_skills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mentor_id uuid NOT NULL,
    subject_id bigint NOT NULL,
    class_levels text[] DEFAULT '{}'::text[] NOT NULL,
    years_experience integer,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: mentorship_listings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mentorship_listings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    author_id uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    description text,
    subject_ids bigint[] DEFAULT '{}'::bigint[] NOT NULL,
    class_levels text[] DEFAULT '{}'::text[] NOT NULL,
    max_mentees integer,
    current_mentees integer DEFAULT 0,
    availability text,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    is_featured boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    CONSTRAINT mentorship_listings_status_check CHECK ((status = ANY (ARRAY['DRAFT'::text, 'ACTIVE'::text, 'PAUSED'::text, 'CLOSED'::text]))),
    CONSTRAINT mentorship_listings_type_check CHECK ((type = ANY (ARRAY['OFFER'::text, 'REQUEST'::text])))
);


--
-- Name: mentorship_materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mentorship_materials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    relation_id uuid NOT NULL,
    uploader_id uuid NOT NULL,
    assigned_to uuid NOT NULL,
    type text DEFAULT 'OTHER'::text NOT NULL,
    title text NOT NULL,
    description text,
    file_urls text[] DEFAULT '{}'::text[] NOT NULL,
    file_types text[] DEFAULT '{}'::text[] NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    submitted_at timestamp with time zone DEFAULT now(),
    corrected_at timestamp with time zone,
    feedback text,
    feedback_file_urls text[],
    grade text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT mentorship_materials_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'IN_PROGRESS'::text, 'CORRECTED'::text, 'RETURNED'::text]))),
    CONSTRAINT mentorship_materials_type_check CHECK ((type = ANY (ARRAY['ESSAY'::text, 'WORKSHEET'::text, 'HOMEWORK'::text, 'OTHER'::text])))
);


--
-- Name: mentorship_relations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mentorship_relations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mentor_id uuid NOT NULL,
    mentee_id uuid NOT NULL,
    original_request_id uuid,
    original_listing_id uuid,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    ended_reason text,
    materials_submitted integer DEFAULT 0,
    materials_corrected integer DEFAULT 0,
    started_at timestamp with time zone DEFAULT now(),
    ended_at timestamp with time zone,
    CONSTRAINT mentorship_relations_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'PAUSED'::text, 'ENDED'::text])))
);


--
-- Name: mentorship_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mentorship_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid NOT NULL,
    requester_id uuid NOT NULL,
    target_id uuid NOT NULL,
    message text,
    response_message text,
    status text DEFAULT 'PENDING'::text NOT NULL,
    responded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval),
    CONSTRAINT mentorship_requests_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'ACCEPTED'::text, 'REJECTED'::text, 'CANCELLED'::text, 'EXPIRED'::text])))
);


--
-- Name: offer_editions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offer_editions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    offer_id bigint NOT NULL,
    school_year text NOT NULL,
    public_title text NOT NULL,
    tagline text NOT NULL,
    description text NOT NULL,
    regular_price_rappen integer NOT NULL,
    currency text DEFAULT 'CHF'::text NOT NULL,
    registration_opens_at timestamp with time zone,
    registration_closes_at timestamp with time zone,
    status text DEFAULT 'draft'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    CONSTRAINT offer_editions_regular_price_rappen_check CHECK ((regular_price_rappen >= 0)),
    CONSTRAINT offer_editions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);


--
-- Name: TABLE offer_editions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.offer_editions IS 'Jaehrliche Durchfuehrung eines Offers (Abschnitt 2.12): Preise, Texte, Fruehbucher-Konfiguration, Optimistic-Concurrency-Version, Status. Oeffentlich nur wenn status=published, sonst nur fuer lehrperson/admin (is_content_manager()). Schreibzugriff nur ueber service_role bis die Admin-Maske existiert.';


--
-- Name: offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offers (
    id bigint NOT NULL,
    audience_id text NOT NULL,
    kurstyp text NOT NULL,
    slug text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT offers_kurstyp_check CHECK ((kurstyp = ANY (ARRAY['halbjahreskurs'::text, 'intensivkurs'::text, 'pruefungssimulation'::text, 'selbststudium'::text])))
);


--
-- Name: TABLE offers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.offers IS 'Stabiler fachlicher Schluessel je Angebot (Abschnitt 2.12): (audience_id, kurstyp, slug). Oeffentlich lesbar, Schreibzugriff nur ueber service_role bis die Admin-Maske existiert.';


--
-- Name: offers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.offers ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.offers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: payroll_periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_periods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    year integer NOT NULL,
    month integer NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    locked_at timestamp with time zone,
    locked_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payroll_periods_month_check CHECK (((month >= 1) AND (month <= 12))),
    CONSTRAINT payroll_periods_status_check CHECK ((status = ANY (ARRAY['open'::text, 'review'::text, 'locked'::text]))),
    CONSTRAINT payroll_periods_year_check CHECK (((year >= 2020) AND (year <= 2100)))
);


--
-- Name: TABLE payroll_periods; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.payroll_periods IS 'Monatlicher Lohnperioden-Status (Schritt 10c). Admin-only in jeder Hinsicht.';


--
-- Name: payroll_snapshot_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_snapshot_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    snapshot_id uuid NOT NULL,
    work_entry_id uuid NOT NULL,
    rate_agreement_id uuid NOT NULL,
    duration_minutes integer NOT NULL,
    hourly_rate_rappen integer NOT NULL,
    amount_rappen integer NOT NULL,
    CONSTRAINT payroll_snapshot_lines_amount_rappen_check CHECK ((amount_rappen >= 0)),
    CONSTRAINT payroll_snapshot_lines_duration_minutes_check CHECK ((duration_minutes > 0)),
    CONSTRAINT payroll_snapshot_lines_hourly_rate_rappen_check CHECK ((hourly_rate_rappen > 0))
);


--
-- Name: TABLE payroll_snapshot_lines; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.payroll_snapshot_lines IS 'Unveraenderliche Einzelzeilen eines Payroll-Snapshots (Schritt 10c) -- ein work_entry kann per UNIQUE(work_entry_id) nur in genau einem Snapshot verrechnet werden.';


--
-- Name: payroll_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    period_id uuid NOT NULL,
    teacher_id uuid NOT NULL,
    total_minutes integer NOT NULL,
    total_amount_rappen integer NOT NULL,
    currency text DEFAULT 'CHF'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payroll_snapshots_total_amount_rappen_check CHECK ((total_amount_rappen >= 0)),
    CONSTRAINT payroll_snapshots_total_minutes_check CHECK ((total_minutes >= 0))
);


--
-- Name: TABLE payroll_snapshots; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.payroll_snapshots IS 'Unveraenderliches Ergebnis eines Monatsabschlusses je Lehrperson (Schritt 10c). Wird ausschliesslich durch admin_close_payroll_period() befuellt.';


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    first_name text,
    last_name text,
    phone text,
    avatar_url text,
    email character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    role text DEFAULT 'user'::text,
    gender text,
    birth_date date,
    school_name text,
    class_level text,
    bio text,
    theme_preference character varying(10) DEFAULT 'light'::character varying,
    CONSTRAINT profiles_class_level_check CHECK (((class_level IS NULL) OR (class_level = ANY (ARRAY['4. Klasse'::text, '5. Klasse'::text, '6. Klasse'::text, '1. Sek'::text, '2. Sek'::text, '3. Sek'::text, 'Gymnasium'::text, 'other'::text])))),
    CONSTRAINT profiles_gender_check CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text, 'prefer_not_to_say'::text]))),
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['user'::text, 'lehrperson'::text, 'admin'::text]))),
    CONSTRAINT profiles_theme_preference_check CHECK (((theme_preference)::text = ANY (ARRAY[('light'::character varying)::text, ('dark'::character varying)::text, ('system'::character varying)::text])))
);


--
-- Name: COLUMN profiles.role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.role IS 'User role for RBAC: user, admin, moderator';


--
-- Name: COLUMN profiles.gender; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.gender IS 'Geschlecht: male, female, other, prefer_not_to_say';


--
-- Name: COLUMN profiles.birth_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.birth_date IS 'Geburtsdatum für Altersberechnung';


--
-- Name: COLUMN profiles.school_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.school_name IS 'Name der Schule';


--
-- Name: COLUMN profiles.class_level; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.class_level IS 'Aktuelle Klassenstufe: 4.–6. Klasse, 1.–3. Sek, Gymnasium oder other.';


--
-- Name: COLUMN profiles.bio; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.bio IS 'Kurze Beschreibung/Bio';


--
-- Name: COLUMN profiles.theme_preference; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.theme_preference IS 'User theme preference: light, dark, or system';


--
-- Name: questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.questions (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: questions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.questions ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.questions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: release_content_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.release_content_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kind text NOT NULL,
    exercise_id bigint,
    trainer_exam_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT release_content_catalog_kind_check CHECK ((kind = ANY (ARRAY['exercise'::text, 'trainer_exam'::text]))),
    CONSTRAINT release_content_catalog_source_xor CHECK ((((kind = 'exercise'::text) AND (exercise_id IS NOT NULL) AND (trainer_exam_id IS NULL)) OR ((kind = 'trainer_exam'::text) AND (trainer_exam_id IS NOT NULL) AND (exercise_id IS NULL))))
);


--
-- Name: TABLE release_content_catalog; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.release_content_catalog IS 'Referenzierbare Teilmenge aus exercises/trainer_exams fuer Tagesfreigaben (Schritt 10b). Kein Materialduplikat -- nur echte FKs mit XOR-CHECK.';


--
-- Name: school_holiday_weeks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.school_holiday_weeks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_year text NOT NULL,
    schedule_group text NOT NULL,
    holiday_type text NOT NULL,
    location text DEFAULT 'ALL'::text NOT NULL,
    calendar_weeks integer[] NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT school_holiday_weeks_calendar_weeks_check CHECK ((cardinality(calendar_weeks) > 0)),
    CONSTRAINT school_holiday_weeks_holiday_type_check CHECK ((holiday_type = ANY (ARRAY['vorkurs'::text, 'intensiv'::text]))),
    CONSTRAINT school_holiday_weeks_location_check CHECK ((location = ANY (ARRAY['Zürich HB'::text, 'Winterthur'::text, 'ALL'::text]))),
    CONSTRAINT school_holiday_weeks_schedule_group_check CHECK ((schedule_group = ANY (ARRAY['langzeitgymi'::text, 'kurzzeitgymi'::text, 'bms'::text, 'matura'::text, '4'::text, '5'::text, '6'::text, '1-sek'::text, '2-3-sek'::text])))
);


--
-- Name: TABLE school_holiday_weeks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.school_holiday_weeks IS 'Admin-pflegbare Kalenderwochen fuer die automatische Intensivkurs-/Vorkurs-Terminierung (ersetzt hart codierte TS-Konstanten in lib/kurse/fixed-school-schedule.ts). Oeffentlich lesbar, Schreibzugriff nur is_admin().';


--
-- Name: self_study_enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.self_study_enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    audience_id text NOT NULL,
    area_id bigint NOT NULL,
    beneficiary_user_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    access_until timestamp with time zone,
    payment_provider_ref text,
    invite_token_hash text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT self_study_enrollments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'cancelled'::text, 'refunded'::text])))
);


--
-- Name: TABLE self_study_enrollments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.self_study_enrollments IS 'Fachliche Selbststudium-Einschreibung (Abschnitt 2.11). Kein Klartext-Einladungstoken (nur invite_token_hash). Erzeugung/Aenderung ausschliesslich ueber service_role bis der Zahlungs-/Admin-Flow gebaut ist -- kein INSERT/UPDATE-Grant fuer anon/authenticated in dieser Runde.';


--
-- Name: student_essays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_essays (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    file_path text NOT NULL,
    file_name text NOT NULL,
    file_size integer NOT NULL,
    file_type text NOT NULL,
    subject text NOT NULL,
    status text DEFAULT 'draft'::text,
    feedback text,
    grade text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT student_essays_file_size_check CHECK ((file_size <= 10485760)),
    CONSTRAINT student_essays_file_type_check CHECK ((file_type = ANY (ARRAY['application/pdf'::text, 'application/msword'::text, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'::text]))),
    CONSTRAINT student_essays_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'in_korrektur'::text, 'reviewed'::text, 'returned'::text])))
);


--
-- Name: subjects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subjects (
    id bigint NOT NULL,
    name character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    thumbnail_url text
);


--
-- Name: subject_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.subjects ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.subject_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id bigint NOT NULL,
    exercise_id integer NOT NULL,
    question text NOT NULL,
    formula text,
    solution text NOT NULL,
    type text,
    hint text,
    options jsonb,
    highlight text
);


--
-- Name: tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tasks_id_seq OWNED BY public.tasks.id;


--
-- Name: tasks_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.tasks ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.tasks_id_seq1
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: teacher_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teacher_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    teacher_id uuid NOT NULL,
    session_id bigint NOT NULL,
    role text NOT NULL,
    valid_from date DEFAULT CURRENT_DATE NOT NULL,
    valid_until date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT teacher_assignments_date_order CHECK (((valid_until IS NULL) OR (valid_until >= valid_from))),
    CONSTRAINT teacher_assignments_role_check CHECK ((role = ANY (ARRAY['lead'::text, 'assistant'::text, 'exam_supervisor'::text])))
);


--
-- Name: TABLE teacher_assignments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.teacher_assignments IS 'Zuteilung Lehrperson <-> course_session (Schritt 10c). Admin-Vollzugriff; Lehrpersonen sehen nur eigene Zuteilungen (fuer die Kurszeit-Vorauswahl in TeacherWorkEntryForm).';


--
-- Name: teacher_rate_agreements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teacher_rate_agreements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    teacher_id uuid NOT NULL,
    hourly_rate_rappen integer NOT NULL,
    currency text DEFAULT 'CHF'::text NOT NULL,
    valid_from date NOT NULL,
    valid_until date,
    version integer DEFAULT 1 NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT teacher_rate_agreements_date_order CHECK (((valid_until IS NULL) OR (valid_until >= valid_from))),
    CONSTRAINT teacher_rate_agreements_hourly_rate_rappen_check CHECK ((hourly_rate_rappen > 0))
);


--
-- Name: TABLE teacher_rate_agreements; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.teacher_rate_agreements IS 'Zeitlich gueltiger, admin-vereinbarter Stundensatz je Lehrperson (Schritt 10c). Nur Admins schreiben; eine neue Vereinbarung ueberschreibt keine fruehere (Abschnitt 2.14), die EXCLUDE-Constraint verhindert ueberlappende Gueltigkeitszeitraeume.';


--
-- Name: trainer_exams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trainer_exams (
    id text NOT NULL,
    title text NOT NULL,
    subject text NOT NULL,
    year integer NOT NULL,
    generated_by text,
    data jsonb NOT NULL,
    text_lines text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT trainer_exams_subject_check CHECK ((subject = ANY (ARRAY['Math'::text, 'German'::text])))
);


--
-- Name: trainer_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trainer_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    exam_id text NOT NULL,
    answers jsonb DEFAULT '{}'::jsonb,
    completed_at timestamp with time zone,
    last_updated timestamp with time zone DEFAULT now()
);


--
-- Name: user_badges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_badges (
    id integer NOT NULL,
    user_id uuid,
    badge_name text NOT NULL,
    earned_at timestamp without time zone DEFAULT now()
);


--
-- Name: user_badges_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_badges_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_badges_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_badges_id_seq OWNED BY public.user_badges.id;


--
-- Name: user_exercises; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_exercises (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    exercise_type character varying(255),
    question text,
    user_answer text,
    is_correct boolean,
    created_at timestamp without time zone DEFAULT now(),
    question_id integer
);


--
-- Name: wake_up; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wake_up (
    id integer NOT NULL,
    message text,
    wake_up_call timestamp without time zone
);


--
-- Name: wake_up_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wake_up_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wake_up_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wake_up_id_seq OWNED BY public.wake_up.id;


--
-- Name: work_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    teacher_id uuid NOT NULL,
    activity_type text NOT NULL,
    work_date date NOT NULL,
    duration_minutes integer NOT NULL,
    session_id bigint,
    submission_id uuid,
    note text,
    status text DEFAULT 'draft'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    rejection_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT work_entries_activity_type_check CHECK ((activity_type = ANY (ARRAY['course_teaching'::text, 'exam_supervision'::text, 'essay_feedback'::text, 'coaching'::text, 'preparation'::text, 'administration'::text, 'other'::text]))),
    CONSTRAINT work_entries_course_teaching_needs_session CHECK (((activity_type <> 'course_teaching'::text) OR (session_id IS NOT NULL))),
    CONSTRAINT work_entries_duration_minutes_check CHECK ((duration_minutes > 0)),
    CONSTRAINT work_entries_essay_feedback_needs_submission CHECK (((activity_type <> 'essay_feedback'::text) OR (submission_id IS NOT NULL))),
    CONSTRAINT work_entries_source_exclusive CHECK ((NOT ((session_id IS NOT NULL) AND (submission_id IS NOT NULL)))),
    CONSTRAINT work_entries_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'approved'::text, 'rejected'::text, 'locked'::text])))
);


--
-- Name: TABLE work_entries; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.work_entries IS 'Geleistete Arbeitszeit (Schritt 10c, Abschnitt 2.14). Lehrpersonen verwalten nur eigene draft/rejected-Eintraege; Genehmigung/Zurueckweisung/Sperrung bleiben admin-only.';


--
-- Name: intensivwoche_kurse id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intensivwoche_kurse ALTER COLUMN id SET DEFAULT nextval('public.intensivwoche_kurse_id_seq'::regclass);


--
-- Name: user_badges id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges ALTER COLUMN id SET DEFAULT nextval('public.user_badges_id_seq'::regclass);


--
-- Name: wake_up id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wake_up ALTER COLUMN id SET DEFAULT nextval('public.wake_up_id_seq'::regclass);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: badges badges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.badges
    ADD CONSTRAINT badges_pkey PRIMARY KEY (id);


--
-- Name: budgets budgets_period_id_category_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_period_id_category_key UNIQUE (period_id, category);


--
-- Name: budgets budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: correction_rubrics correction_rubrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.correction_rubrics
    ADD CONSTRAINT correction_rubrics_pkey PRIMARY KEY (id);


--
-- Name: course_days course_days_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_days
    ADD CONSTRAINT course_days_pkey PRIMARY KEY (id);


--
-- Name: course_days course_days_session_id_course_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_days
    ADD CONSTRAINT course_days_session_id_course_date_key UNIQUE (session_id, course_date);


--
-- Name: course_days course_days_session_id_sequence_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_days
    ADD CONSTRAINT course_days_session_id_sequence_key UNIQUE (session_id, sequence);


--
-- Name: course_occurrences course_occurrences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_occurrences
    ADD CONSTRAINT course_occurrences_pkey PRIMARY KEY (id);


--
-- Name: course_sessions course_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_sessions
    ADD CONSTRAINT course_sessions_pkey PRIMARY KEY (id);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);


--
-- Name: daily_release_items daily_release_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_release_items
    ADD CONSTRAINT daily_release_items_pkey PRIMARY KEY (release_id, content_item_id);


--
-- Name: daily_releases daily_releases_course_day_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_releases
    ADD CONSTRAINT daily_releases_course_day_id_key UNIQUE (course_day_id);


--
-- Name: daily_releases daily_releases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_releases
    ADD CONSTRAINT daily_releases_pkey PRIMARY KEY (id);


--
-- Name: essay_ai_corrections essay_ai_corrections_essay_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.essay_ai_corrections
    ADD CONSTRAINT essay_ai_corrections_essay_id_key UNIQUE (essay_id);


--
-- Name: essay_ai_corrections essay_ai_corrections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.essay_ai_corrections
    ADD CONSTRAINT essay_ai_corrections_pkey PRIMARY KEY (id);


--
-- Name: exercises exercises_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_pkey PRIMARY KEY (id);


--
-- Name: expense_entries expense_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_entries
    ADD CONSTRAINT expense_entries_pkey PRIMARY KEY (id);


--
-- Name: financial_adjustments financial_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_adjustments
    ADD CONSTRAINT financial_adjustments_pkey PRIMARY KEY (id);


--
-- Name: financial_events financial_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_events
    ADD CONSTRAINT financial_events_pkey PRIMARY KEY (id);


--
-- Name: financial_events financial_events_source_kind_source_id_event_type_event_ver_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_events
    ADD CONSTRAINT financial_events_source_kind_source_id_event_type_event_ver_key UNIQUE (source_kind, source_id, event_type, event_version);


--
-- Name: financial_periods financial_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_periods
    ADD CONSTRAINT financial_periods_pkey PRIMARY KEY (id);


--
-- Name: financial_periods financial_periods_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_periods
    ADD CONSTRAINT financial_periods_year_key UNIQUE (year);


--
-- Name: intensivwoche_anmeldungen intensivwoche_anmeldungen_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intensivwoche_anmeldungen
    ADD CONSTRAINT intensivwoche_anmeldungen_pkey PRIMARY KEY (id);


--
-- Name: intensivwoche_buchungsversuche intensivwoche_buchungsversuche_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intensivwoche_buchungsversuche
    ADD CONSTRAINT intensivwoche_buchungsversuche_pkey PRIMARY KEY (id);


--
-- Name: intensivwoche_kurse intensivwoche_kurse_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intensivwoche_kurse
    ADD CONSTRAINT intensivwoche_kurse_pkey PRIMARY KEY (id);


--
-- Name: learning_materials learning_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_materials
    ADD CONSTRAINT learning_materials_pkey PRIMARY KEY (id);


--
-- Name: mail_outbox mail_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mail_outbox
    ADD CONSTRAINT mail_outbox_pkey PRIMARY KEY (id);


--
-- Name: mail_outbox mail_outbox_unique_anmeldung_template; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mail_outbox
    ADD CONSTRAINT mail_outbox_unique_anmeldung_template UNIQUE (anmeldung_id, template_key);


--
-- Name: material_access_grants material_access_grants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_access_grants
    ADD CONSTRAINT material_access_grants_pkey PRIMARY KEY (id);


--
-- Name: material_areas material_areas_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_areas
    ADD CONSTRAINT material_areas_key_key UNIQUE (key);


--
-- Name: material_areas material_areas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_areas
    ADD CONSTRAINT material_areas_pkey PRIMARY KEY (id);


--
-- Name: math_solution_steps math_solution_steps_exercise_type_exercise_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_solution_steps
    ADD CONSTRAINT math_solution_steps_exercise_type_exercise_id_key UNIQUE (exercise_type, exercise_id);


--
-- Name: math_solution_steps math_solution_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.math_solution_steps
    ADD CONSTRAINT math_solution_steps_pkey PRIMARY KEY (id);


--
-- Name: mentor_skills mentor_skills_mentor_id_subject_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentor_skills
    ADD CONSTRAINT mentor_skills_mentor_id_subject_id_key UNIQUE (mentor_id, subject_id);


--
-- Name: mentor_skills mentor_skills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentor_skills
    ADD CONSTRAINT mentor_skills_pkey PRIMARY KEY (id);


--
-- Name: mentorship_listings mentorship_listings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentorship_listings
    ADD CONSTRAINT mentorship_listings_pkey PRIMARY KEY (id);


--
-- Name: mentorship_materials mentorship_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentorship_materials
    ADD CONSTRAINT mentorship_materials_pkey PRIMARY KEY (id);


--
-- Name: mentorship_relations mentorship_relations_mentor_id_mentee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentorship_relations
    ADD CONSTRAINT mentorship_relations_mentor_id_mentee_id_key UNIQUE (mentor_id, mentee_id);


--
-- Name: mentorship_relations mentorship_relations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentorship_relations
    ADD CONSTRAINT mentorship_relations_pkey PRIMARY KEY (id);


--
-- Name: mentorship_requests mentorship_requests_listing_id_requester_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentorship_requests
    ADD CONSTRAINT mentorship_requests_listing_id_requester_id_key UNIQUE (listing_id, requester_id);


--
-- Name: mentorship_requests mentorship_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentorship_requests
    ADD CONSTRAINT mentorship_requests_pkey PRIMARY KEY (id);


--
-- Name: offer_editions offer_editions_offer_id_school_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_editions
    ADD CONSTRAINT offer_editions_offer_id_school_year_key UNIQUE (offer_id, school_year);


--
-- Name: offer_editions offer_editions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_editions
    ADD CONSTRAINT offer_editions_pkey PRIMARY KEY (id);


--
-- Name: offers offers_audience_id_kurstyp_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offers
    ADD CONSTRAINT offers_audience_id_kurstyp_slug_key UNIQUE (audience_id, kurstyp, slug);


--
-- Name: offers offers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offers
    ADD CONSTRAINT offers_pkey PRIMARY KEY (id);


--
-- Name: payroll_periods payroll_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_periods
    ADD CONSTRAINT payroll_periods_pkey PRIMARY KEY (id);


--
-- Name: payroll_periods payroll_periods_year_month_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_periods
    ADD CONSTRAINT payroll_periods_year_month_key UNIQUE (year, month);


--
-- Name: payroll_snapshot_lines payroll_snapshot_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_snapshot_lines
    ADD CONSTRAINT payroll_snapshot_lines_pkey PRIMARY KEY (id);


--
-- Name: payroll_snapshot_lines payroll_snapshot_lines_work_entry_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_snapshot_lines
    ADD CONSTRAINT payroll_snapshot_lines_work_entry_id_key UNIQUE (work_entry_id);


--
-- Name: payroll_snapshots payroll_snapshots_period_id_teacher_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_snapshots
    ADD CONSTRAINT payroll_snapshots_period_id_teacher_id_key UNIQUE (period_id, teacher_id);


--
-- Name: payroll_snapshots payroll_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_snapshots
    ADD CONSTRAINT payroll_snapshots_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);


--
-- Name: release_content_catalog release_content_catalog_exercise_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.release_content_catalog
    ADD CONSTRAINT release_content_catalog_exercise_id_key UNIQUE (exercise_id);


--
-- Name: release_content_catalog release_content_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.release_content_catalog
    ADD CONSTRAINT release_content_catalog_pkey PRIMARY KEY (id);


--
-- Name: release_content_catalog release_content_catalog_trainer_exam_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.release_content_catalog
    ADD CONSTRAINT release_content_catalog_trainer_exam_id_key UNIQUE (trainer_exam_id);


--
-- Name: school_holiday_weeks school_holiday_weeks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_holiday_weeks
    ADD CONSTRAINT school_holiday_weeks_pkey PRIMARY KEY (id);


--
-- Name: school_holiday_weeks school_holiday_weeks_school_year_schedule_group_holiday_typ_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_holiday_weeks
    ADD CONSTRAINT school_holiday_weeks_school_year_schedule_group_holiday_typ_key UNIQUE (school_year, schedule_group, holiday_type, location);


--
-- Name: self_study_enrollments self_study_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.self_study_enrollments
    ADD CONSTRAINT self_study_enrollments_pkey PRIMARY KEY (id);


--
-- Name: student_essays student_essays_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_essays
    ADD CONSTRAINT student_essays_pkey PRIMARY KEY (id);


--
-- Name: subjects subject_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subject_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: teacher_assignments teacher_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_assignments
    ADD CONSTRAINT teacher_assignments_pkey PRIMARY KEY (id);


--
-- Name: teacher_assignments teacher_assignments_teacher_id_session_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_assignments
    ADD CONSTRAINT teacher_assignments_teacher_id_session_id_role_key UNIQUE (teacher_id, session_id, role);


--
-- Name: teacher_rate_agreements teacher_rate_agreements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_rate_agreements
    ADD CONSTRAINT teacher_rate_agreements_pkey PRIMARY KEY (id);


--
-- Name: teacher_rate_agreements teacher_rate_agreements_teacher_id_daterange_excl; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_rate_agreements
    ADD CONSTRAINT teacher_rate_agreements_teacher_id_daterange_excl EXCLUDE USING gist (teacher_id WITH =, daterange(valid_from, COALESCE(valid_until, 'infinity'::date), '[]'::text) WITH &&);


--
-- Name: trainer_exams trainer_exams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trainer_exams
    ADD CONSTRAINT trainer_exams_pkey PRIMARY KEY (id);


--
-- Name: trainer_progress trainer_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trainer_progress
    ADD CONSTRAINT trainer_progress_pkey PRIMARY KEY (id);


--
-- Name: trainer_progress trainer_progress_user_id_exam_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trainer_progress
    ADD CONSTRAINT trainer_progress_user_id_exam_id_key UNIQUE (user_id, exam_id);


--
-- Name: user_badges unique_user_badge; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT unique_user_badge UNIQUE (user_id, badge_name);


--
-- Name: user_badges user_badges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_pkey PRIMARY KEY (id);


--
-- Name: user_exercises user_exercises_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_exercises
    ADD CONSTRAINT user_exercises_pkey PRIMARY KEY (id);


--
-- Name: wake_up wake_up_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wake_up
    ADD CONSTRAINT wake_up_pkey PRIMARY KEY (id);


--
-- Name: work_entries work_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_entries
    ADD CONSTRAINT work_entries_pkey PRIMARY KEY (id);


--
-- Name: work_entries work_entries_teacher_id_session_id_work_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_entries
    ADD CONSTRAINT work_entries_teacher_id_session_id_work_date_key UNIQUE (teacher_id, session_id, work_date);


--
-- Name: idx_anmeldungen_beneficiary_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_anmeldungen_beneficiary_user_id ON public.intensivwoche_anmeldungen USING btree (beneficiary_user_id);


--
-- Name: idx_anmeldungen_edition_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_anmeldungen_edition_id ON public.intensivwoche_anmeldungen USING btree (edition_id);


--
-- Name: idx_anmeldungen_idempotency_key_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_anmeldungen_idempotency_key_unique ON public.intensivwoche_anmeldungen USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: idx_anmeldungen_kurs_email_child_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_anmeldungen_kurs_email_child_unique ON public.intensivwoche_anmeldungen USING btree (kurs_id, lower(parent_email), lower(TRIM(BOTH FROM child_firstname)), lower(TRIM(BOTH FROM child_lastname))) WHERE (status <> 'storniert'::text);


--
-- Name: idx_anmeldungen_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_anmeldungen_session_id ON public.intensivwoche_anmeldungen USING btree (session_id);


--
-- Name: idx_audit_log_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_entity ON public.audit_log USING btree (entity_type, entity_id);


--
-- Name: idx_buchungsversuche_email_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_buchungsversuche_email_time ON public.intensivwoche_buchungsversuche USING btree (lower(parent_email), attempted_at);


--
-- Name: idx_chat_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_created ON public.chat_messages USING btree (created_at DESC);


--
-- Name: idx_chat_relation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_relation ON public.chat_messages USING btree (relation_id);


--
-- Name: idx_chat_sender; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_sender ON public.chat_messages USING btree (sender_id);


--
-- Name: idx_correction_rubrics_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_correction_rubrics_created_by ON public.correction_rubrics USING btree (created_by);


--
-- Name: idx_correction_rubrics_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_correction_rubrics_subject ON public.correction_rubrics USING btree (subject);


--
-- Name: idx_course_days_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_course_days_session_id ON public.course_days USING btree (session_id);


--
-- Name: idx_course_sessions_edition_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_course_sessions_edition_id ON public.course_sessions USING btree (edition_id);


--
-- Name: idx_essay_ai_corrections_essay_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_essay_ai_corrections_essay_id ON public.essay_ai_corrections USING btree (essay_id);


--
-- Name: idx_essay_ai_corrections_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_essay_ai_corrections_status ON public.essay_ai_corrections USING btree (status);


--
-- Name: idx_exercises_class_levels; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exercises_class_levels ON public.exercises USING gin (class_levels);


--
-- Name: idx_expense_entries_edition_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expense_entries_edition_id ON public.expense_entries USING btree (edition_id);


--
-- Name: idx_expense_entries_service_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expense_entries_service_date ON public.expense_entries USING btree (service_date);


--
-- Name: idx_financial_events_edition_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_events_edition_id ON public.financial_events USING btree (edition_id);


--
-- Name: idx_financial_events_recognized_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_events_recognized_at ON public.financial_events USING btree (recognized_at);


--
-- Name: idx_intensivwoche_anmeldungen_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intensivwoche_anmeldungen_created_at ON public.intensivwoche_anmeldungen USING btree (created_at DESC);


--
-- Name: idx_intensivwoche_anmeldungen_kurs_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intensivwoche_anmeldungen_kurs_id ON public.intensivwoche_anmeldungen USING btree (kurs_id);


--
-- Name: idx_intensivwoche_anmeldungen_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intensivwoche_anmeldungen_status ON public.intensivwoche_anmeldungen USING btree (status);


--
-- Name: idx_intensivwoche_kurse_fach; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intensivwoche_kurse_fach ON public.intensivwoche_kurse USING btree (fach);


--
-- Name: idx_intensivwoche_kurse_ist_aktiv; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intensivwoche_kurse_ist_aktiv ON public.intensivwoche_kurse USING btree (ist_aktiv);


--
-- Name: idx_intensivwoche_kurse_start_datum; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intensivwoche_kurse_start_datum ON public.intensivwoche_kurse USING btree (start_datum);


--
-- Name: idx_kurse_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kurse_created_by ON public.intensivwoche_kurse USING btree (created_by);


--
-- Name: idx_learning_materials_area_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_materials_area_id ON public.learning_materials USING btree (area_id);


--
-- Name: idx_listings_author; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_listings_author ON public.mentorship_listings USING btree (author_id);


--
-- Name: idx_listings_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_listings_search ON public.mentorship_listings USING gin (to_tsvector('german'::regconfig, ((title || ' '::text) || COALESCE(description, ''::text))));


--
-- Name: idx_listings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_listings_status ON public.mentorship_listings USING btree (status);


--
-- Name: idx_listings_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_listings_type ON public.mentorship_listings USING btree (type);


--
-- Name: idx_material_access_grants_user_area; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_material_access_grants_user_area ON public.material_access_grants USING btree (user_id, area_id);


--
-- Name: idx_materials_assigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_assigned ON public.mentorship_materials USING btree (assigned_to);


--
-- Name: idx_materials_relation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_relation ON public.mentorship_materials USING btree (relation_id);


--
-- Name: idx_materials_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_status ON public.mentorship_materials USING btree (status);


--
-- Name: idx_materials_uploader; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_uploader ON public.mentorship_materials USING btree (uploader_id);


--
-- Name: idx_mentor_skills_mentor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mentor_skills_mentor ON public.mentor_skills USING btree (mentor_id);


--
-- Name: idx_mentor_skills_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mentor_skills_subject ON public.mentor_skills USING btree (subject_id);


--
-- Name: idx_offer_editions_offer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offer_editions_offer_id ON public.offer_editions USING btree (offer_id);


--
-- Name: idx_payroll_snapshot_lines_snapshot_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_snapshot_lines_snapshot_id ON public.payroll_snapshot_lines USING btree (snapshot_id);


--
-- Name: idx_payroll_snapshots_period_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_snapshots_period_id ON public.payroll_snapshots USING btree (period_id);


--
-- Name: idx_relations_mentee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_relations_mentee ON public.mentorship_relations USING btree (mentee_id);


--
-- Name: idx_relations_mentor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_relations_mentor ON public.mentorship_relations USING btree (mentor_id);


--
-- Name: idx_relations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_relations_status ON public.mentorship_relations USING btree (status);


--
-- Name: idx_requests_listing; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_listing ON public.mentorship_requests USING btree (listing_id);


--
-- Name: idx_requests_requester; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_requester ON public.mentorship_requests USING btree (requester_id);


--
-- Name: idx_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_status ON public.mentorship_requests USING btree (status);


--
-- Name: idx_requests_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_target ON public.mentorship_requests USING btree (target_id);


--
-- Name: idx_self_study_enrollments_beneficiary; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_self_study_enrollments_beneficiary ON public.self_study_enrollments USING btree (beneficiary_user_id);


--
-- Name: idx_student_essays_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_essays_status ON public.student_essays USING btree (status);


--
-- Name: idx_student_essays_student_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_essays_student_id ON public.student_essays USING btree (student_id);


--
-- Name: idx_student_essays_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_essays_subject ON public.student_essays USING btree (subject);


--
-- Name: idx_teacher_assignments_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teacher_assignments_session_id ON public.teacher_assignments USING btree (session_id);


--
-- Name: idx_teacher_assignments_teacher_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teacher_assignments_teacher_id ON public.teacher_assignments USING btree (teacher_id);


--
-- Name: idx_teacher_rate_agreements_teacher_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teacher_rate_agreements_teacher_id ON public.teacher_rate_agreements USING btree (teacher_id);


--
-- Name: idx_trainer_exams_generated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trainer_exams_generated_by ON public.trainer_exams USING btree (generated_by);


--
-- Name: idx_trainer_exams_subject_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trainer_exams_subject_year ON public.trainer_exams USING btree (subject, year);


--
-- Name: idx_trainer_progress_exam; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trainer_progress_exam ON public.trainer_progress USING btree (exam_id);


--
-- Name: idx_trainer_progress_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trainer_progress_user ON public.trainer_progress USING btree (user_id);


--
-- Name: idx_work_entries_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_entries_status ON public.work_entries USING btree (status);


--
-- Name: idx_work_entries_teacher_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_entries_teacher_id ON public.work_entries USING btree (teacher_id);


--
-- Name: idx_work_entries_work_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_entries_work_date ON public.work_entries USING btree (work_date);


--
-- Name: intensivwoche_anmeldungen anmeldungen_price_snapshot_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER anmeldungen_price_snapshot_immutable BEFORE UPDATE ON public.intensivwoche_anmeldungen FOR EACH ROW EXECUTE FUNCTION public.enforce_anmeldung_price_snapshot_immutable();


--
-- Name: budgets budgets_bump_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER budgets_bump_version BEFORE UPDATE ON public.budgets FOR EACH ROW EXECUTE FUNCTION public.bump_version_and_updated_at();


--
-- Name: correction_rubrics correction_rubrics_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER correction_rubrics_updated_at BEFORE UPDATE ON public.correction_rubrics FOR EACH ROW EXECUTE FUNCTION public.update_correction_rubrics_updated_at();


--
-- Name: course_sessions course_sessions_bump_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER course_sessions_bump_version BEFORE UPDATE ON public.course_sessions FOR EACH ROW EXECUTE FUNCTION public.bump_version_and_updated_at();


--
-- Name: daily_releases daily_releases_bump_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER daily_releases_bump_version BEFORE UPDATE ON public.daily_releases FOR EACH ROW EXECUTE FUNCTION public.bump_version_and_updated_at();


--
-- Name: expense_entries expense_entries_bump_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER expense_entries_bump_version BEFORE UPDATE ON public.expense_entries FOR EACH ROW EXECUTE FUNCTION public.bump_version_and_updated_at();


--
-- Name: financial_periods financial_periods_bump_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER financial_periods_bump_version BEFORE UPDATE ON public.financial_periods FOR EACH ROW EXECUTE FUNCTION public.bump_version_and_updated_at();


--
-- Name: intensivwoche_anmeldungen intensivwoche_anmeldungen_enqueue_mail; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER intensivwoche_anmeldungen_enqueue_mail AFTER INSERT ON public.intensivwoche_anmeldungen FOR EACH ROW EXECUTE FUNCTION public.enqueue_booking_confirmation_mail();


--
-- Name: TRIGGER intensivwoche_anmeldungen_enqueue_mail ON intensivwoche_anmeldungen; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER intensivwoche_anmeldungen_enqueue_mail ON public.intensivwoche_anmeldungen IS 'Erzeugt automatisch eine mail_outbox-Zeile fuer jede neue Anmeldung, unabhaengig vom Schreibpfad (aktuell nur book_intensivwoche_kurs()).';


--
-- Name: intensivwoche_anmeldungen link_anmeldung_beneficiary_before_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER link_anmeldung_beneficiary_before_insert BEFORE INSERT ON public.intensivwoche_anmeldungen FOR EACH ROW EXECUTE FUNCTION public.link_anmeldung_beneficiary();


--
-- Name: offer_editions offer_editions_bump_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER offer_editions_bump_version BEFORE UPDATE ON public.offer_editions FOR EACH ROW EXECUTE FUNCTION public.bump_version_and_updated_at();


--
-- Name: payroll_periods payroll_periods_bump_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER payroll_periods_bump_version BEFORE UPDATE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION public.bump_version_and_updated_at();


--
-- Name: student_essays student_essays_review_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER student_essays_review_timestamp BEFORE UPDATE ON public.student_essays FOR EACH ROW EXECUTE FUNCTION public.set_essay_review_timestamp();


--
-- Name: student_essays student_essays_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER student_essays_updated_at BEFORE UPDATE ON public.student_essays FOR EACH ROW EXECUTE FUNCTION public.update_student_essays_updated_at();


--
-- Name: intensivwoche_anmeldungen sync_anmeldung_financial_events_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_anmeldung_financial_events_trigger AFTER INSERT OR UPDATE ON public.intensivwoche_anmeldungen FOR EACH ROW EXECUTE FUNCTION public.sync_anmeldung_financial_events();


--
-- Name: expense_entries sync_expense_financial_event_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_expense_financial_event_trigger AFTER INSERT OR UPDATE ON public.expense_entries FOR EACH ROW EXECUTE FUNCTION public.sync_expense_financial_event();


--
-- Name: financial_adjustments sync_financial_adjustment_event_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_financial_adjustment_event_trigger AFTER INSERT ON public.financial_adjustments FOR EACH ROW EXECUTE FUNCTION public.sync_financial_adjustment_event();


--
-- Name: intensivwoche_kurse update_intensivwoche_kurse_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_intensivwoche_kurse_updated_at BEFORE UPDATE ON public.intensivwoche_kurse FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: mentor_skills update_mentor_skills_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_mentor_skills_updated_at BEFORE UPDATE ON public.mentor_skills FOR EACH ROW EXECUTE FUNCTION public.update_mentorship_updated_at();


--
-- Name: mentorship_listings update_mentorship_listings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_mentorship_listings_updated_at BEFORE UPDATE ON public.mentorship_listings FOR EACH ROW EXECUTE FUNCTION public.update_mentorship_updated_at();


--
-- Name: mentorship_materials update_mentorship_materials_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_mentorship_materials_updated_at BEFORE UPDATE ON public.mentorship_materials FOR EACH ROW EXECUTE FUNCTION public.update_mentorship_updated_at();


--
-- Name: trainer_exams update_trainer_exams_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_trainer_exams_updated_at BEFORE UPDATE ON public.trainer_exams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: trainer_progress update_trainer_progress_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_trainer_progress_updated_at BEFORE UPDATE ON public.trainer_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: work_entries work_entries_bump_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER work_entries_bump_version BEFORE UPDATE ON public.work_entries FOR EACH ROW EXECUTE FUNCTION public.bump_version_and_updated_at();


--
-- Name: work_entries work_entries_validate_transition; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER work_entries_validate_transition BEFORE UPDATE ON public.work_entries FOR EACH ROW EXECUTE FUNCTION public.validate_work_entry_status_transition();


--
-- Name: audit_log audit_log_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id);


--
-- Name: budgets budgets_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.financial_periods(id);


--
-- Name: chat_messages chat_messages_relation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_relation_id_fkey FOREIGN KEY (relation_id) REFERENCES public.mentorship_relations(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: correction_rubrics correction_rubrics_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.correction_rubrics
    ADD CONSTRAINT correction_rubrics_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: course_days course_days_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_days
    ADD CONSTRAINT course_days_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.course_sessions(id);


--
-- Name: course_occurrences course_occurrences_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_occurrences
    ADD CONSTRAINT course_occurrences_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id);


--
-- Name: course_sessions course_sessions_edition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_sessions
    ADD CONSTRAINT course_sessions_edition_id_fkey FOREIGN KEY (edition_id) REFERENCES public.offer_editions(id);


--
-- Name: course_sessions course_sessions_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_sessions
    ADD CONSTRAINT course_sessions_id_fkey FOREIGN KEY (id) REFERENCES public.intensivwoche_kurse(id);


--
-- Name: daily_release_items daily_release_items_content_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_release_items
    ADD CONSTRAINT daily_release_items_content_item_id_fkey FOREIGN KEY (content_item_id) REFERENCES public.release_content_catalog(id);


--
-- Name: daily_release_items daily_release_items_release_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_release_items
    ADD CONSTRAINT daily_release_items_release_id_fkey FOREIGN KEY (release_id) REFERENCES public.daily_releases(id);


--
-- Name: daily_releases daily_releases_course_day_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_releases
    ADD CONSTRAINT daily_releases_course_day_id_fkey FOREIGN KEY (course_day_id) REFERENCES public.course_days(id);


--
-- Name: daily_releases daily_releases_published_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_releases
    ADD CONSTRAINT daily_releases_published_by_fkey FOREIGN KEY (published_by) REFERENCES auth.users(id);


--
-- Name: essay_ai_corrections essay_ai_corrections_essay_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.essay_ai_corrections
    ADD CONSTRAINT essay_ai_corrections_essay_id_fkey FOREIGN KEY (essay_id) REFERENCES public.student_essays(id) ON DELETE CASCADE;


--
-- Name: essay_ai_corrections essay_ai_corrections_released_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.essay_ai_corrections
    ADD CONSTRAINT essay_ai_corrections_released_by_fkey FOREIGN KEY (released_by) REFERENCES public.profiles(id);


--
-- Name: essay_ai_corrections essay_ai_corrections_rubric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.essay_ai_corrections
    ADD CONSTRAINT essay_ai_corrections_rubric_id_fkey FOREIGN KEY (rubric_id) REFERENCES public.correction_rubrics(id) ON DELETE SET NULL;


--
-- Name: exercises exercises_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;


--
-- Name: expense_entries expense_entries_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_entries
    ADD CONSTRAINT expense_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: expense_entries expense_entries_edition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_entries
    ADD CONSTRAINT expense_entries_edition_id_fkey FOREIGN KEY (edition_id) REFERENCES public.offer_editions(id);


--
-- Name: expense_entries expense_entries_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_entries
    ADD CONSTRAINT expense_entries_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.course_sessions(id);


--
-- Name: financial_adjustments financial_adjustments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_adjustments
    ADD CONSTRAINT financial_adjustments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: financial_adjustments financial_adjustments_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_adjustments
    ADD CONSTRAINT financial_adjustments_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.financial_periods(id);


--
-- Name: financial_events financial_events_edition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_events
    ADD CONSTRAINT financial_events_edition_id_fkey FOREIGN KEY (edition_id) REFERENCES public.offer_editions(id);


--
-- Name: financial_events financial_events_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_events
    ADD CONSTRAINT financial_events_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.course_sessions(id);


--
-- Name: financial_periods financial_periods_locked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_periods
    ADD CONSTRAINT financial_periods_locked_by_fkey FOREIGN KEY (locked_by) REFERENCES auth.users(id);


--
-- Name: intensivwoche_anmeldungen intensivwoche_anmeldungen_beneficiary_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intensivwoche_anmeldungen
    ADD CONSTRAINT intensivwoche_anmeldungen_beneficiary_user_id_fkey FOREIGN KEY (beneficiary_user_id) REFERENCES auth.users(id);


--
-- Name: intensivwoche_anmeldungen intensivwoche_anmeldungen_edition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intensivwoche_anmeldungen
    ADD CONSTRAINT intensivwoche_anmeldungen_edition_id_fkey FOREIGN KEY (edition_id) REFERENCES public.offer_editions(id);


--
-- Name: intensivwoche_anmeldungen intensivwoche_anmeldungen_kurs_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intensivwoche_anmeldungen
    ADD CONSTRAINT intensivwoche_anmeldungen_kurs_id_fkey FOREIGN KEY (kurs_id) REFERENCES public.intensivwoche_kurse(id) ON DELETE SET NULL;


--
-- Name: intensivwoche_anmeldungen intensivwoche_anmeldungen_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intensivwoche_anmeldungen
    ADD CONSTRAINT intensivwoche_anmeldungen_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.course_sessions(id);


--
-- Name: intensivwoche_kurse intensivwoche_kurse_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intensivwoche_kurse
    ADD CONSTRAINT intensivwoche_kurse_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: learning_materials learning_materials_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_materials
    ADD CONSTRAINT learning_materials_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.material_areas(id);


--
-- Name: learning_materials learning_materials_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_materials
    ADD CONSTRAINT learning_materials_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: learning_materials learning_materials_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_materials
    ADD CONSTRAINT learning_materials_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;


--
-- Name: mail_outbox mail_outbox_anmeldung_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mail_outbox
    ADD CONSTRAINT mail_outbox_anmeldung_id_fkey FOREIGN KEY (anmeldung_id) REFERENCES public.intensivwoche_anmeldungen(id) ON DELETE CASCADE;


--
-- Name: material_access_grants material_access_grants_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_access_grants
    ADD CONSTRAINT material_access_grants_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.material_areas(id);


--
-- Name: material_access_grants material_access_grants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_access_grants
    ADD CONSTRAINT material_access_grants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: mentor_skills mentor_skills_mentor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentor_skills
    ADD CONSTRAINT mentor_skills_mentor_id_fkey FOREIGN KEY (mentor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: mentor_skills mentor_skills_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentor_skills
    ADD CONSTRAINT mentor_skills_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;


--
-- Name: mentorship_listings mentorship_listings_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentorship_listings
    ADD CONSTRAINT mentorship_listings_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: mentorship_materials mentorship_materials_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentorship_materials
    ADD CONSTRAINT mentorship_materials_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: mentorship_materials mentorship_materials_relation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentorship_materials
    ADD CONSTRAINT mentorship_materials_relation_id_fkey FOREIGN KEY (relation_id) REFERENCES public.mentorship_relations(id) ON DELETE CASCADE;


--
-- Name: mentorship_materials mentorship_materials_uploader_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentorship_materials
    ADD CONSTRAINT mentorship_materials_uploader_id_fkey FOREIGN KEY (uploader_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: mentorship_relations mentorship_relations_mentee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentorship_relations
    ADD CONSTRAINT mentorship_relations_mentee_id_fkey FOREIGN KEY (mentee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: mentorship_relations mentorship_relations_mentor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentorship_relations
    ADD CONSTRAINT mentorship_relations_mentor_id_fkey FOREIGN KEY (mentor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: mentorship_relations mentorship_relations_original_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentorship_relations
    ADD CONSTRAINT mentorship_relations_original_listing_id_fkey FOREIGN KEY (original_listing_id) REFERENCES public.mentorship_listings(id);


--
-- Name: mentorship_relations mentorship_relations_original_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentorship_relations
    ADD CONSTRAINT mentorship_relations_original_request_id_fkey FOREIGN KEY (original_request_id) REFERENCES public.mentorship_requests(id);


--
-- Name: mentorship_requests mentorship_requests_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentorship_requests
    ADD CONSTRAINT mentorship_requests_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.mentorship_listings(id) ON DELETE CASCADE;


--
-- Name: mentorship_requests mentorship_requests_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentorship_requests
    ADD CONSTRAINT mentorship_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: mentorship_requests mentorship_requests_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentorship_requests
    ADD CONSTRAINT mentorship_requests_target_id_fkey FOREIGN KEY (target_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: offer_editions offer_editions_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_editions
    ADD CONSTRAINT offer_editions_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.offers(id);


--
-- Name: payroll_periods payroll_periods_locked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_periods
    ADD CONSTRAINT payroll_periods_locked_by_fkey FOREIGN KEY (locked_by) REFERENCES auth.users(id);


--
-- Name: payroll_snapshot_lines payroll_snapshot_lines_rate_agreement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_snapshot_lines
    ADD CONSTRAINT payroll_snapshot_lines_rate_agreement_id_fkey FOREIGN KEY (rate_agreement_id) REFERENCES public.teacher_rate_agreements(id);


--
-- Name: payroll_snapshot_lines payroll_snapshot_lines_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_snapshot_lines
    ADD CONSTRAINT payroll_snapshot_lines_snapshot_id_fkey FOREIGN KEY (snapshot_id) REFERENCES public.payroll_snapshots(id);


--
-- Name: payroll_snapshot_lines payroll_snapshot_lines_work_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_snapshot_lines
    ADD CONSTRAINT payroll_snapshot_lines_work_entry_id_fkey FOREIGN KEY (work_entry_id) REFERENCES public.work_entries(id);


--
-- Name: payroll_snapshots payroll_snapshots_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_snapshots
    ADD CONSTRAINT payroll_snapshots_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.payroll_periods(id);


--
-- Name: payroll_snapshots payroll_snapshots_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_snapshots
    ADD CONSTRAINT payroll_snapshots_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES auth.users(id);


--
-- Name: release_content_catalog release_content_catalog_exercise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.release_content_catalog
    ADD CONSTRAINT release_content_catalog_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id);


--
-- Name: release_content_catalog release_content_catalog_trainer_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.release_content_catalog
    ADD CONSTRAINT release_content_catalog_trainer_exam_id_fkey FOREIGN KEY (trainer_exam_id) REFERENCES public.trainer_exams(id);


--
-- Name: school_holiday_weeks school_holiday_weeks_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_holiday_weeks
    ADD CONSTRAINT school_holiday_weeks_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: self_study_enrollments self_study_enrollments_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.self_study_enrollments
    ADD CONSTRAINT self_study_enrollments_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.material_areas(id);


--
-- Name: self_study_enrollments self_study_enrollments_beneficiary_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.self_study_enrollments
    ADD CONSTRAINT self_study_enrollments_beneficiary_user_id_fkey FOREIGN KEY (beneficiary_user_id) REFERENCES auth.users(id);


--
-- Name: student_essays student_essays_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_essays
    ADD CONSTRAINT student_essays_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id);


--
-- Name: student_essays student_essays_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_essays
    ADD CONSTRAINT student_essays_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_exercise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id);


--
-- Name: teacher_assignments teacher_assignments_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_assignments
    ADD CONSTRAINT teacher_assignments_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.course_sessions(id);


--
-- Name: teacher_assignments teacher_assignments_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_assignments
    ADD CONSTRAINT teacher_assignments_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES auth.users(id);


--
-- Name: teacher_rate_agreements teacher_rate_agreements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_rate_agreements
    ADD CONSTRAINT teacher_rate_agreements_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: teacher_rate_agreements teacher_rate_agreements_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_rate_agreements
    ADD CONSTRAINT teacher_rate_agreements_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES auth.users(id);


--
-- Name: trainer_progress trainer_progress_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trainer_progress
    ADD CONSTRAINT trainer_progress_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.trainer_exams(id) ON DELETE CASCADE;


--
-- Name: trainer_progress trainer_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trainer_progress
    ADD CONSTRAINT trainer_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: work_entries work_entries_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_entries
    ADD CONSTRAINT work_entries_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);


--
-- Name: work_entries work_entries_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_entries
    ADD CONSTRAINT work_entries_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.course_sessions(id);


--
-- Name: work_entries work_entries_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_entries
    ADD CONSTRAINT work_entries_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.student_essays(id);


--
-- Name: work_entries work_entries_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_entries
    ADD CONSTRAINT work_entries_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES auth.users(id);


--
-- Name: subjects Alle können Subjects lesen; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Alle können Subjects lesen" ON public.subjects FOR SELECT USING (true);


--
-- Name: learning_materials Alle können öffentliche Materialien lesen; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Alle können öffentliche Materialien lesen" ON public.learning_materials FOR SELECT USING (((is_public = true) OR (auth.uid() = created_by)));


--
-- Name: math_solution_steps Allow public read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read" ON public.math_solution_steps FOR SELECT USING (true);


--
-- Name: learning_materials Lehrpersonen können Materialien erstellen; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lehrpersonen können Materialien erstellen" ON public.learning_materials FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['lehrperson'::text, 'admin'::text]))))));


--
-- Name: learning_materials Lehrpersonen können eigene Materialien bearbeiten; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lehrpersonen können eigene Materialien bearbeiten" ON public.learning_materials FOR UPDATE USING (((auth.uid() = created_by) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));


--
-- Name: learning_materials Lehrpersonen können eigene Materialien löschen; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lehrpersonen können eigene Materialien löschen" ON public.learning_materials FOR DELETE USING (((auth.uid() = created_by) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));


--
-- Name: profiles Users können ihr eigenes Profil aktualisieren; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users können ihr eigenes Profil aktualisieren" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: profiles Users können ihr eigenes Profil lesen; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users können ihr eigenes Profil lesen" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: intensivwoche_anmeldungen anmeldungen_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anmeldungen_admin_delete ON public.intensivwoche_anmeldungen FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: intensivwoche_anmeldungen anmeldungen_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anmeldungen_admin_select ON public.intensivwoche_anmeldungen FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: intensivwoche_anmeldungen anmeldungen_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anmeldungen_admin_update ON public.intensivwoche_anmeldungen FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: intensivwoche_kurse anon_select_active_kurse; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_select_active_kurse ON public.intensivwoche_kurse FOR SELECT TO anon USING ((ist_aktiv = true));


--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log audit_log_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_log_admin_insert ON public.audit_log FOR INSERT TO authenticated WITH CHECK ((public.is_admin() AND (actor_user_id = auth.uid())));


--
-- Name: audit_log audit_log_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_log_admin_read ON public.audit_log FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: intensivwoche_kurse authenticated_select_active_kurse; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_select_active_kurse ON public.intensivwoche_kurse FOR SELECT TO authenticated USING ((ist_aktiv = true));


--
-- Name: badges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

--
-- Name: badges badges_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY badges_admin_delete ON public.badges FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: badges badges_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY badges_admin_insert ON public.badges FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: badges badges_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY badges_admin_update ON public.badges FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: badges badges_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY badges_public_read ON public.badges FOR SELECT TO authenticated, anon USING (true);


--
-- Name: budgets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

--
-- Name: budgets budgets_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY budgets_admin_all ON public.budgets TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: chat_messages chat_insert_involved; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_insert_involved ON public.chat_messages FOR INSERT WITH CHECK (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.mentorship_relations mr
  WHERE ((mr.id = chat_messages.relation_id) AND ((mr.mentor_id = auth.uid()) OR (mr.mentee_id = auth.uid())) AND (mr.status = 'ACTIVE'::text))))));


--
-- Name: chat_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_messages chat_select_involved; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_select_involved ON public.chat_messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.mentorship_relations mr
  WHERE ((mr.id = chat_messages.relation_id) AND ((mr.mentor_id = auth.uid()) OR (mr.mentee_id = auth.uid()))))));


--
-- Name: chat_messages chat_update_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_update_read ON public.chat_messages FOR UPDATE USING (((sender_id <> auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.mentorship_relations mr
  WHERE ((mr.id = chat_messages.relation_id) AND ((mr.mentor_id = auth.uid()) OR (mr.mentee_id = auth.uid())))))));


--
-- Name: badges content_manager_delete_badges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_manager_delete_badges ON public.badges FOR DELETE TO authenticated USING (public.is_content_manager());


--
-- Name: course_occurrences content_manager_delete_course_occurrences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_manager_delete_course_occurrences ON public.course_occurrences FOR DELETE TO authenticated USING (public.is_content_manager());


--
-- Name: courses content_manager_delete_courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_manager_delete_courses ON public.courses FOR DELETE TO authenticated USING (public.is_content_manager());


--
-- Name: exercises content_manager_delete_exercises; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_manager_delete_exercises ON public.exercises FOR DELETE TO authenticated USING (public.is_content_manager());


--
-- Name: learning_materials content_manager_delete_learning_materials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_manager_delete_learning_materials ON public.learning_materials FOR DELETE TO authenticated USING (public.is_content_manager());


--
-- Name: questions content_manager_delete_questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_manager_delete_questions ON public.questions FOR DELETE TO authenticated USING (public.is_content_manager());


--
-- Name: subjects content_manager_delete_subjects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_manager_delete_subjects ON public.subjects FOR DELETE TO authenticated USING (public.is_content_manager());


--
-- Name: tasks content_manager_delete_tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_manager_delete_tasks ON public.tasks FOR DELETE TO authenticated USING (public.is_content_manager());


--
-- Name: trainer_exams content_manager_delete_trainer_exams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_manager_delete_trainer_exams ON public.trainer_exams FOR DELETE TO authenticated USING (public.is_content_manager());


--
-- Name: badges content_manager_insert_badges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_manager_insert_badges ON public.badges FOR INSERT TO authenticated WITH CHECK (public.is_content_manager());


--
-- Name: course_occurrences content_manager_insert_course_occurrences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_manager_insert_course_occurrences ON public.course_occurrences FOR INSERT TO authenticated WITH CHECK (public.is_content_manager());


--
-- Name: courses content_manager_insert_courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_manager_insert_courses ON public.courses FOR INSERT TO authenticated WITH CHECK (public.is_content_manager());


--
-- Name: exercises content_manager_insert_exercises; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_manager_insert_exercises ON public.exercises FOR INSERT TO authenticated WITH CHECK (public.is_content_manager());


--
-- Name: learning_materials content_manager_insert_learning_materials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_manager_insert_learning_materials ON public.learning_materials FOR INSERT TO authenticated WITH CHECK (public.is_content_manager());


--
-- Name: questions content_manager_insert_questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_manager_insert_questions ON public.questions FOR INSERT TO authenticated WITH CHECK (public.is_content_manager());


--
-- Name: subjects content_manager_insert_subjects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_manager_insert_subjects ON public.subjects FOR INSERT TO authenticated WITH CHECK (public.is_content_manager());


--
-- Name: tasks content_manager_insert_tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_manager_insert_tasks ON public.tasks FOR INSERT TO authenticated WITH CHECK (public.is_content_manager());


--
-- Name: trainer_exams content_manager_insert_trainer_exams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_manager_insert_trainer_exams ON public.trainer_exams FOR INSERT TO authenticated WITH CHECK (public.is_content_manager());


--
-- Name: badges content_manager_update_badges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_manager_update_badges ON public.badges FOR UPDATE TO authenticated USING (public.is_content_manager()) WITH CHECK (public.is_content_manager());


--
-- Name: course_occurrences content_manager_update_course_occurrences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_manager_update_course_occurrences ON public.course_occurrences FOR UPDATE TO authenticated USING (public.is_content_manager()) WITH CHECK (public.is_content_manager());


--
-- Name: courses content_manager_update_courses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_manager_update_courses ON public.courses FOR UPDATE TO authenticated USING (public.is_content_manager()) WITH CHECK (public.is_content_manager());


--
-- Name: exercises content_manager_update_exercises; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_manager_update_exercises ON public.exercises FOR UPDATE TO authenticated USING (public.is_content_manager()) WITH CHECK (public.is_content_manager());


--
-- Name: learning_materials content_manager_update_learning_materials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_manager_update_learning_materials ON public.learning_materials FOR UPDATE TO authenticated USING (public.is_content_manager()) WITH CHECK (public.is_content_manager());


--
-- Name: questions content_manager_update_questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_manager_update_questions ON public.questions FOR UPDATE TO authenticated USING (public.is_content_manager()) WITH CHECK (public.is_content_manager());


--
-- Name: subjects content_manager_update_subjects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_manager_update_subjects ON public.subjects FOR UPDATE TO authenticated USING (public.is_content_manager()) WITH CHECK (public.is_content_manager());


--
-- Name: tasks content_manager_update_tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_manager_update_tasks ON public.tasks FOR UPDATE TO authenticated USING (public.is_content_manager()) WITH CHECK (public.is_content_manager());


--
-- Name: trainer_exams content_manager_update_trainer_exams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_manager_update_trainer_exams ON public.trainer_exams FOR UPDATE TO authenticated USING (public.is_content_manager()) WITH CHECK (public.is_content_manager());


--
-- Name: correction_rubrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.correction_rubrics ENABLE ROW LEVEL SECURITY;

--
-- Name: course_days; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.course_days ENABLE ROW LEVEL SECURITY;

--
-- Name: course_days course_days_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY course_days_admin_all ON public.course_days TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: course_occurrences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.course_occurrences ENABLE ROW LEVEL SECURITY;

--
-- Name: course_occurrences course_occurrences_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY course_occurrences_admin_delete ON public.course_occurrences FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: course_occurrences course_occurrences_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY course_occurrences_admin_insert ON public.course_occurrences FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: course_occurrences course_occurrences_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY course_occurrences_admin_update ON public.course_occurrences FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: course_occurrences course_occurrences_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY course_occurrences_public_read ON public.course_occurrences FOR SELECT TO authenticated, anon USING (true);


--
-- Name: course_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.course_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: course_sessions course_sessions_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY course_sessions_admin_insert ON public.course_sessions FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: course_sessions course_sessions_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY course_sessions_admin_update ON public.course_sessions FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: course_sessions course_sessions_read_published_or_content_manager; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY course_sessions_read_published_or_content_manager ON public.course_sessions FOR SELECT TO authenticated, anon USING ((public.is_content_manager() OR (EXISTS ( SELECT 1
   FROM public.offer_editions e
  WHERE ((e.id = course_sessions.edition_id) AND (e.status = 'published'::text))))));


--
-- Name: courses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

--
-- Name: courses courses_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY courses_admin_delete ON public.courses FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: courses courses_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY courses_admin_insert ON public.courses FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: courses courses_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY courses_admin_update ON public.courses FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: courses courses_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY courses_public_read ON public.courses FOR SELECT TO authenticated, anon USING (true);


--
-- Name: daily_release_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.daily_release_items ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_release_items daily_release_items_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY daily_release_items_admin_all ON public.daily_release_items TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: daily_release_items daily_release_items_enrolled_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY daily_release_items_enrolled_read ON public.daily_release_items FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.daily_releases dr
  WHERE (dr.id = daily_release_items.release_id))));


--
-- Name: daily_releases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.daily_releases ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_releases daily_releases_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY daily_releases_admin_all ON public.daily_releases TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: daily_releases daily_releases_enrolled_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY daily_releases_enrolled_read ON public.daily_releases FOR SELECT TO authenticated USING (((status = ANY (ARRAY['active'::text, 'scheduled'::text])) AND ((opens_at IS NULL) OR (opens_at <= now())) AND ((closes_at IS NULL) OR (closes_at >= now())) AND (EXISTS ( SELECT 1
   FROM (public.course_days cd
     JOIN public.intensivwoche_anmeldungen a ON ((a.kurs_id = cd.session_id)))
  WHERE ((cd.id = daily_releases.course_day_id) AND (a.beneficiary_user_id = auth.uid()) AND (a.status <> 'storniert'::text))))));


--
-- Name: essay_ai_corrections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.essay_ai_corrections ENABLE ROW LEVEL SECURITY;

--
-- Name: exercises; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

--
-- Name: exercises exercises_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exercises_admin_delete ON public.exercises FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: exercises exercises_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exercises_admin_insert ON public.exercises FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: exercises exercises_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exercises_admin_update ON public.exercises FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: exercises exercises_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exercises_public_read ON public.exercises FOR SELECT TO authenticated, anon USING (true);


--
-- Name: expense_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expense_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: expense_entries expense_entries_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY expense_entries_admin_all ON public.expense_entries TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: financial_adjustments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.financial_adjustments ENABLE ROW LEVEL SECURITY;

--
-- Name: financial_adjustments financial_adjustments_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY financial_adjustments_admin_all ON public.financial_adjustments TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: financial_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.financial_events ENABLE ROW LEVEL SECURITY;

--
-- Name: financial_events financial_events_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY financial_events_admin_insert ON public.financial_events FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: financial_events financial_events_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY financial_events_admin_read ON public.financial_events FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: financial_periods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.financial_periods ENABLE ROW LEVEL SECURITY;

--
-- Name: financial_periods financial_periods_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY financial_periods_admin_all ON public.financial_periods TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: intensivwoche_anmeldungen; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.intensivwoche_anmeldungen ENABLE ROW LEVEL SECURITY;

--
-- Name: intensivwoche_buchungsversuche; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.intensivwoche_buchungsversuche ENABLE ROW LEVEL SECURITY;

--
-- Name: intensivwoche_kurse; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.intensivwoche_kurse ENABLE ROW LEVEL SECURITY;

--
-- Name: learning_materials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learning_materials ENABLE ROW LEVEL SECURITY;

--
-- Name: learning_materials learning_materials_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY learning_materials_admin_delete ON public.learning_materials FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: learning_materials learning_materials_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY learning_materials_admin_insert ON public.learning_materials FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: learning_materials learning_materials_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY learning_materials_admin_update ON public.learning_materials FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: learning_materials learning_materials_read_public_own_or_granted; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY learning_materials_read_public_own_or_granted ON public.learning_materials FOR SELECT TO authenticated, anon USING (((is_public = true) OR (auth.uid() = created_by) OR public.is_content_manager() OR (EXISTS ( SELECT 1
   FROM public.material_access_grants g
  WHERE ((g.user_id = auth.uid()) AND (g.area_id = learning_materials.area_id) AND (g.status = 'active'::text) AND ((g.valid_until IS NULL) OR (g.valid_until > now())))))));


--
-- Name: POLICY learning_materials_read_public_own_or_granted ON learning_materials; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY learning_materials_read_public_own_or_granted ON public.learning_materials IS 'Ersetzt die fehlerhafte learning_materials_public_read-Policy (qual=true, liess anon/authenticated bislang jede Zeile lesen). Sichtbar sind: oeffentliche Materialien, eigene Materialien, Content-Manager/Admin, sowie Materialien mit passendem aktivem material_access_grants-Eintrag.';


--
-- Name: intensivwoche_kurse lehrperson_delete_own_kurse; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lehrperson_delete_own_kurse ON public.intensivwoche_kurse FOR DELETE TO authenticated USING ((public.is_content_manager() AND public.is_kurs_owner(created_by)));


--
-- Name: intensivwoche_kurse lehrperson_insert_own_kurse; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lehrperson_insert_own_kurse ON public.intensivwoche_kurse FOR INSERT TO authenticated WITH CHECK ((public.is_content_manager() AND (auth.uid() = created_by)));


--
-- Name: intensivwoche_kurse lehrperson_select_own_kurse; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lehrperson_select_own_kurse ON public.intensivwoche_kurse FOR SELECT TO authenticated USING ((public.is_content_manager() AND public.is_kurs_owner(created_by)));


--
-- Name: intensivwoche_kurse lehrperson_update_own_kurse; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lehrperson_update_own_kurse ON public.intensivwoche_kurse FOR UPDATE TO authenticated USING ((public.is_content_manager() AND public.is_kurs_owner(created_by))) WITH CHECK ((public.is_content_manager() AND public.is_kurs_owner(created_by)));


--
-- Name: mentorship_listings listings_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY listings_delete_own ON public.mentorship_listings FOR DELETE USING ((author_id = auth.uid()));


--
-- Name: mentorship_listings listings_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY listings_insert_own ON public.mentorship_listings FOR INSERT WITH CHECK (((author_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['lehrperson'::text, 'user'::text])))))));


--
-- Name: mentorship_listings listings_select_public_or_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY listings_select_public_or_own ON public.mentorship_listings FOR SELECT USING (((status = 'ACTIVE'::text) OR (author_id = auth.uid())));


--
-- Name: mentorship_listings listings_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY listings_update_own ON public.mentorship_listings FOR UPDATE USING ((author_id = auth.uid())) WITH CHECK ((author_id = auth.uid()));


--
-- Name: mail_outbox; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mail_outbox ENABLE ROW LEVEL SECURITY;

--
-- Name: mail_outbox mail_outbox_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mail_outbox_admin_select ON public.mail_outbox FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: material_access_grants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.material_access_grants ENABLE ROW LEVEL SECURITY;

--
-- Name: material_access_grants material_access_grants_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY material_access_grants_admin_insert ON public.material_access_grants FOR INSERT TO authenticated WITH CHECK ((public.is_admin() AND (source_kind = 'admin_grant'::text)));


--
-- Name: material_access_grants material_access_grants_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY material_access_grants_admin_update ON public.material_access_grants FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: material_access_grants material_access_grants_select_own_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY material_access_grants_select_own_or_admin ON public.material_access_grants FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.is_admin()));


--
-- Name: material_areas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.material_areas ENABLE ROW LEVEL SECURITY;

--
-- Name: material_areas material_areas_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY material_areas_public_read ON public.material_areas FOR SELECT TO authenticated, anon USING (true);


--
-- Name: mentorship_materials materials_insert_student; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY materials_insert_student ON public.mentorship_materials FOR INSERT WITH CHECK (((uploader_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.mentorship_relations mr
  WHERE ((mr.id = mentorship_materials.relation_id) AND ((mr.mentee_id = auth.uid()) OR (mr.mentor_id = auth.uid())) AND (mr.status = 'ACTIVE'::text))))));


--
-- Name: mentorship_materials materials_select_involved; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY materials_select_involved ON public.mentorship_materials FOR SELECT USING (((uploader_id = auth.uid()) OR (assigned_to = auth.uid())));


--
-- Name: mentorship_materials materials_update_involved; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY materials_update_involved ON public.mentorship_materials FOR UPDATE USING (((uploader_id = auth.uid()) OR (assigned_to = auth.uid())));


--
-- Name: math_solution_steps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.math_solution_steps ENABLE ROW LEVEL SECURITY;

--
-- Name: mentor_skills; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mentor_skills ENABLE ROW LEVEL SECURITY;

--
-- Name: mentor_skills mentor_skills_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mentor_skills_delete_own ON public.mentor_skills FOR DELETE USING ((mentor_id = auth.uid()));


--
-- Name: mentor_skills mentor_skills_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mentor_skills_insert_own ON public.mentor_skills FOR INSERT WITH CHECK (((mentor_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'lehrperson'::text))))));


--
-- Name: mentor_skills mentor_skills_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mentor_skills_select_all ON public.mentor_skills FOR SELECT USING (true);


--
-- Name: mentor_skills mentor_skills_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mentor_skills_update_own ON public.mentor_skills FOR UPDATE USING ((mentor_id = auth.uid())) WITH CHECK ((mentor_id = auth.uid()));


--
-- Name: mentorship_listings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mentorship_listings ENABLE ROW LEVEL SECURITY;

--
-- Name: mentorship_materials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mentorship_materials ENABLE ROW LEVEL SECURITY;

--
-- Name: mentorship_relations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mentorship_relations ENABLE ROW LEVEL SECURITY;

--
-- Name: mentorship_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mentorship_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: offer_editions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.offer_editions ENABLE ROW LEVEL SECURITY;

--
-- Name: offer_editions offer_editions_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offer_editions_admin_insert ON public.offer_editions FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: offer_editions offer_editions_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offer_editions_admin_update ON public.offer_editions FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: offer_editions offer_editions_read_published_or_content_manager; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offer_editions_read_published_or_content_manager ON public.offer_editions FOR SELECT TO authenticated, anon USING (((status = 'published'::text) OR public.is_content_manager()));


--
-- Name: offers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

--
-- Name: offers offers_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offers_public_read ON public.offers FOR SELECT TO authenticated, anon USING (true);


--
-- Name: payroll_periods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;

--
-- Name: payroll_periods payroll_periods_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payroll_periods_admin_all ON public.payroll_periods TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: payroll_snapshot_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payroll_snapshot_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: payroll_snapshot_lines payroll_snapshot_lines_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payroll_snapshot_lines_admin_all ON public.payroll_snapshot_lines TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: payroll_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payroll_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: payroll_snapshots payroll_snapshots_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payroll_snapshots_admin_all ON public.payroll_snapshots TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_admin_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_admin_select_all ON public.profiles FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: profiles profiles_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = id));


--
-- Name: profiles profiles_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

--
-- Name: questions questions_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY questions_admin_delete ON public.questions FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: questions questions_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY questions_admin_insert ON public.questions FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: questions questions_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY questions_admin_update ON public.questions FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: questions questions_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY questions_public_read ON public.questions FOR SELECT TO authenticated, anon USING (true);


--
-- Name: mentorship_relations relations_insert_involved; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY relations_insert_involved ON public.mentorship_relations FOR INSERT WITH CHECK (((mentor_id = auth.uid()) OR (mentee_id = auth.uid())));


--
-- Name: mentorship_relations relations_select_involved; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY relations_select_involved ON public.mentorship_relations FOR SELECT USING (((mentor_id = auth.uid()) OR (mentee_id = auth.uid())));


--
-- Name: mentorship_relations relations_update_involved; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY relations_update_involved ON public.mentorship_relations FOR UPDATE USING (((mentor_id = auth.uid()) OR (mentee_id = auth.uid())));


--
-- Name: release_content_catalog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.release_content_catalog ENABLE ROW LEVEL SECURITY;

--
-- Name: release_content_catalog release_content_catalog_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY release_content_catalog_admin_write ON public.release_content_catalog FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: release_content_catalog release_content_catalog_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY release_content_catalog_public_read ON public.release_content_catalog FOR SELECT TO authenticated, anon USING (true);


--
-- Name: mentorship_requests requests_insert_as_requester; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY requests_insert_as_requester ON public.mentorship_requests FOR INSERT WITH CHECK (((requester_id = auth.uid()) AND (requester_id <> target_id)));


--
-- Name: mentorship_requests requests_select_involved; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY requests_select_involved ON public.mentorship_requests FOR SELECT USING (((requester_id = auth.uid()) OR (target_id = auth.uid())));


--
-- Name: mentorship_requests requests_update_involved; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY requests_update_involved ON public.mentorship_requests FOR UPDATE USING (((requester_id = auth.uid()) OR (target_id = auth.uid())));


--
-- Name: school_holiday_weeks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.school_holiday_weeks ENABLE ROW LEVEL SECURITY;

--
-- Name: school_holiday_weeks school_holiday_weeks_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY school_holiday_weeks_admin_insert ON public.school_holiday_weeks FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: school_holiday_weeks school_holiday_weeks_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY school_holiday_weeks_admin_update ON public.school_holiday_weeks FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: school_holiday_weeks school_holiday_weeks_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY school_holiday_weeks_public_read ON public.school_holiday_weeks FOR SELECT TO authenticated, anon USING (true);


--
-- Name: self_study_enrollments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.self_study_enrollments ENABLE ROW LEVEL SECURITY;

--
-- Name: self_study_enrollments self_study_enrollments_select_own_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY self_study_enrollments_select_own_or_admin ON public.self_study_enrollments FOR SELECT TO authenticated USING (((beneficiary_user_id = auth.uid()) OR public.is_admin()));


--
-- Name: student_essays; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.student_essays ENABLE ROW LEVEL SECURITY;

--
-- Name: student_essays students_delete_draft_essays; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY students_delete_draft_essays ON public.student_essays FOR DELETE TO authenticated USING (((student_id = auth.uid()) AND (status = 'draft'::text)));


--
-- Name: student_essays students_insert_own_essays; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY students_insert_own_essays ON public.student_essays FOR INSERT TO authenticated WITH CHECK ((student_id = auth.uid()));


--
-- Name: essay_ai_corrections students_read_released_corrections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY students_read_released_corrections ON public.essay_ai_corrections FOR SELECT TO authenticated USING (((status = 'released'::text) AND (EXISTS ( SELECT 1
   FROM public.student_essays
  WHERE ((student_essays.id = essay_ai_corrections.essay_id) AND (student_essays.student_id = auth.uid()))))));


--
-- Name: student_essays students_select_own_essays; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY students_select_own_essays ON public.student_essays FOR SELECT TO authenticated USING ((student_id = auth.uid()));


--
-- Name: student_essays students_update_draft_essays; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY students_update_draft_essays ON public.student_essays FOR UPDATE TO authenticated USING (((student_id = auth.uid()) AND (status = 'draft'::text))) WITH CHECK ((student_id = auth.uid()));


--
-- Name: subjects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

--
-- Name: subjects subjects_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subjects_admin_delete ON public.subjects FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: subjects subjects_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subjects_admin_insert ON public.subjects FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: subjects subjects_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subjects_admin_update ON public.subjects FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: subjects subjects_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subjects_public_read ON public.subjects FOR SELECT TO authenticated, anon USING (true);


--
-- Name: tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: tasks tasks_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasks_admin_delete ON public.tasks FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: tasks tasks_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasks_admin_insert ON public.tasks FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: tasks tasks_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasks_admin_update ON public.tasks FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: tasks tasks_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasks_public_read ON public.tasks FOR SELECT TO authenticated, anon USING (true);


--
-- Name: teacher_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: teacher_assignments teacher_assignments_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teacher_assignments_admin_all ON public.teacher_assignments TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: teacher_assignments teacher_assignments_own_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teacher_assignments_own_read ON public.teacher_assignments FOR SELECT TO authenticated USING ((teacher_id = auth.uid()));


--
-- Name: teacher_rate_agreements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teacher_rate_agreements ENABLE ROW LEVEL SECURITY;

--
-- Name: teacher_rate_agreements teacher_rate_agreements_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teacher_rate_agreements_admin_all ON public.teacher_rate_agreements TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: teacher_rate_agreements teacher_rate_agreements_own_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teacher_rate_agreements_own_read ON public.teacher_rate_agreements FOR SELECT TO authenticated USING ((teacher_id = auth.uid()));


--
-- Name: essay_ai_corrections teachers_delete_ai_corrections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teachers_delete_ai_corrections ON public.essay_ai_corrections FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['lehrperson'::text, 'admin'::text]))))));


--
-- Name: correction_rubrics teachers_delete_rubrics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teachers_delete_rubrics ON public.correction_rubrics FOR DELETE TO authenticated USING (((created_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['lehrperson'::text, 'admin'::text])))))));


--
-- Name: essay_ai_corrections teachers_insert_ai_corrections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teachers_insert_ai_corrections ON public.essay_ai_corrections FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['lehrperson'::text, 'admin'::text]))))));


--
-- Name: correction_rubrics teachers_insert_rubrics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teachers_insert_rubrics ON public.correction_rubrics FOR INSERT TO authenticated WITH CHECK (((created_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['lehrperson'::text, 'admin'::text])))))));


--
-- Name: essay_ai_corrections teachers_read_ai_corrections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teachers_read_ai_corrections ON public.essay_ai_corrections FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['lehrperson'::text, 'admin'::text]))))));


--
-- Name: correction_rubrics teachers_read_rubrics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teachers_read_rubrics ON public.correction_rubrics FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['lehrperson'::text, 'admin'::text]))))));


--
-- Name: essay_ai_corrections teachers_update_ai_corrections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teachers_update_ai_corrections ON public.essay_ai_corrections FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['lehrperson'::text, 'admin'::text]))))));


--
-- Name: student_essays teachers_update_grading_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teachers_update_grading_only ON public.student_essays FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['lehrperson'::text, 'admin'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['lehrperson'::text, 'admin'::text]))))));


--
-- Name: correction_rubrics teachers_update_rubrics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teachers_update_rubrics ON public.correction_rubrics FOR UPDATE TO authenticated USING (((created_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['lehrperson'::text, 'admin'::text])))))));


--
-- Name: trainer_exams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trainer_exams ENABLE ROW LEVEL SECURITY;

--
-- Name: trainer_exams trainer_exams_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trainer_exams_admin_delete ON public.trainer_exams FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: trainer_exams trainer_exams_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trainer_exams_admin_insert ON public.trainer_exams FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: trainer_exams trainer_exams_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trainer_exams_admin_update ON public.trainer_exams FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: trainer_exams trainer_exams_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trainer_exams_public_read ON public.trainer_exams FOR SELECT TO authenticated, anon USING (true);


--
-- Name: trainer_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trainer_progress ENABLE ROW LEVEL SECURITY;

--
-- Name: trainer_progress trainer_progress_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trainer_progress_insert_own ON public.trainer_progress FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: trainer_progress trainer_progress_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trainer_progress_select_own ON public.trainer_progress FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: trainer_progress trainer_progress_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trainer_progress_update_own ON public.trainer_progress FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: student_essays trainers_review_essays; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trainers_review_essays ON public.student_essays FOR UPDATE TO authenticated USING (((status = ANY (ARRAY['submitted'::text, 'in_korrektur'::text])) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['lehrperson'::text, 'admin'::text]))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['lehrperson'::text, 'admin'::text]))))));


--
-- Name: student_essays trainers_view_submitted_essays; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trainers_view_submitted_essays ON public.student_essays FOR SELECT TO authenticated USING (((status <> 'draft'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['lehrperson'::text, 'admin'::text])))))));


--
-- Name: user_badges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

--
-- Name: user_badges user_badges_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_badges_admin_all ON public.user_badges TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: user_badges user_badges_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_badges_delete_own ON public.user_badges FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: user_badges user_badges_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_badges_insert_own ON public.user_badges FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_badges user_badges_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_badges_select_own ON public.user_badges FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: user_exercises; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_exercises ENABLE ROW LEVEL SECURITY;

--
-- Name: user_exercises user_exercises_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_exercises_admin_all ON public.user_exercises TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: user_exercises user_exercises_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_exercises_delete_own ON public.user_exercises FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: user_exercises user_exercises_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_exercises_insert_own ON public.user_exercises FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_exercises user_exercises_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_exercises_select_own ON public.user_exercises FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: user_exercises user_exercises_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_exercises_update_own ON public.user_exercises FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: wake_up; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wake_up ENABLE ROW LEVEL SECURITY;

--
-- Name: wake_up wake_up_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wake_up_admin_all ON public.wake_up TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: work_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.work_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: work_entries work_entries_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY work_entries_admin_all ON public.work_entries TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: work_entries work_entries_own_insert_draft; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY work_entries_own_insert_draft ON public.work_entries FOR INSERT TO authenticated WITH CHECK (((teacher_id = auth.uid()) AND (status = 'draft'::text)));


--
-- Name: work_entries work_entries_own_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY work_entries_own_read ON public.work_entries FOR SELECT TO authenticated USING ((teacher_id = auth.uid()));


--
-- Name: work_entries work_entries_own_update_draft_or_rejected; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY work_entries_own_update_draft_or_rejected ON public.work_entries FOR UPDATE TO authenticated USING (((teacher_id = auth.uid()) AND (status = ANY (ARRAY['draft'::text, 'rejected'::text])))) WITH CHECK (((teacher_id = auth.uid()) AND (status = ANY (ARRAY['draft'::text, 'submitted'::text]))));

-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION accept_mentorship_request(request_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.accept_mentorship_request(request_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.accept_mentorship_request(request_id uuid) TO anon;
GRANT ALL ON FUNCTION public.accept_mentorship_request(request_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.accept_mentorship_request(request_id uuid) TO service_role;


--
-- Name: FUNCTION admin_close_payroll_period(p_year integer, p_month integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_close_payroll_period(p_year integer, p_month integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_close_payroll_period(p_year integer, p_month integer) TO anon;
GRANT ALL ON FUNCTION public.admin_close_payroll_period(p_year integer, p_month integer) TO authenticated;
GRANT ALL ON FUNCTION public.admin_close_payroll_period(p_year integer, p_month integer) TO service_role;


--
-- Name: FUNCTION admin_save_daily_release(p_course_day_id uuid, p_status text, p_opens_at timestamp with time zone, p_closes_at timestamp with time zone, p_items jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_save_daily_release(p_course_day_id uuid, p_status text, p_opens_at timestamp with time zone, p_closes_at timestamp with time zone, p_items jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_save_daily_release(p_course_day_id uuid, p_status text, p_opens_at timestamp with time zone, p_closes_at timestamp with time zone, p_items jsonb) TO anon;
GRANT ALL ON FUNCTION public.admin_save_daily_release(p_course_day_id uuid, p_status text, p_opens_at timestamp with time zone, p_closes_at timestamp with time zone, p_items jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.admin_save_daily_release(p_course_day_id uuid, p_status text, p_opens_at timestamp with time zone, p_closes_at timestamp with time zone, p_items jsonb) TO service_role;


--
-- Name: FUNCTION admin_save_rate_agreement(p_teacher_id uuid, p_hourly_rate_rappen integer, p_valid_from date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_save_rate_agreement(p_teacher_id uuid, p_hourly_rate_rappen integer, p_valid_from date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_save_rate_agreement(p_teacher_id uuid, p_hourly_rate_rappen integer, p_valid_from date) TO anon;
GRANT ALL ON FUNCTION public.admin_save_rate_agreement(p_teacher_id uuid, p_hourly_rate_rappen integer, p_valid_from date) TO authenticated;
GRANT ALL ON FUNCTION public.admin_save_rate_agreement(p_teacher_id uuid, p_hourly_rate_rappen integer, p_valid_from date) TO service_role;


--
-- Name: FUNCTION admin_upsert_course_session(p_edition_id uuid, p_name text, p_fach text, p_beschreibung text, p_start_datum date, p_end_datum date, p_uhrzeit text, p_ort text, p_max_teilnehmer integer, p_lehrer text, p_kurs_id bigint, p_registration_status text, p_delivery_modes text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_upsert_course_session(p_edition_id uuid, p_name text, p_fach text, p_beschreibung text, p_start_datum date, p_end_datum date, p_uhrzeit text, p_ort text, p_max_teilnehmer integer, p_lehrer text, p_kurs_id bigint, p_registration_status text, p_delivery_modes text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_upsert_course_session(p_edition_id uuid, p_name text, p_fach text, p_beschreibung text, p_start_datum date, p_end_datum date, p_uhrzeit text, p_ort text, p_max_teilnehmer integer, p_lehrer text, p_kurs_id bigint, p_registration_status text, p_delivery_modes text[]) TO anon;
GRANT ALL ON FUNCTION public.admin_upsert_course_session(p_edition_id uuid, p_name text, p_fach text, p_beschreibung text, p_start_datum date, p_end_datum date, p_uhrzeit text, p_ort text, p_max_teilnehmer integer, p_lehrer text, p_kurs_id bigint, p_registration_status text, p_delivery_modes text[]) TO authenticated;
GRANT ALL ON FUNCTION public.admin_upsert_course_session(p_edition_id uuid, p_name text, p_fach text, p_beschreibung text, p_start_datum date, p_end_datum date, p_uhrzeit text, p_ort text, p_max_teilnehmer integer, p_lehrer text, p_kurs_id bigint, p_registration_status text, p_delivery_modes text[]) TO service_role;


--
-- Name: FUNCTION book_intensivwoche_kurs(p_kurs_id bigint, p_child_firstname text, p_child_lastname text, p_child_class_level text, p_child_gender text, p_parent_email text, p_parent_phone text, p_notes text, p_idempotency_key uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.book_intensivwoche_kurs(p_kurs_id bigint, p_child_firstname text, p_child_lastname text, p_child_class_level text, p_child_gender text, p_parent_email text, p_parent_phone text, p_notes text, p_idempotency_key uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.book_intensivwoche_kurs(p_kurs_id bigint, p_child_firstname text, p_child_lastname text, p_child_class_level text, p_child_gender text, p_parent_email text, p_parent_phone text, p_notes text, p_idempotency_key uuid) TO anon;
GRANT ALL ON FUNCTION public.book_intensivwoche_kurs(p_kurs_id bigint, p_child_firstname text, p_child_lastname text, p_child_class_level text, p_child_gender text, p_parent_email text, p_parent_phone text, p_notes text, p_idempotency_key uuid) TO authenticated;
GRANT ALL ON FUNCTION public.book_intensivwoche_kurs(p_kurs_id bigint, p_child_firstname text, p_child_lastname text, p_child_class_level text, p_child_gender text, p_parent_email text, p_parent_phone text, p_notes text, p_idempotency_key uuid) TO service_role;


--
-- Name: FUNCTION bump_version_and_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.bump_version_and_updated_at() TO anon;
GRANT ALL ON FUNCTION public.bump_version_and_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.bump_version_and_updated_at() TO service_role;


--
-- Name: FUNCTION count_active_anmeldungen(p_kurs_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.count_active_anmeldungen(p_kurs_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.count_active_anmeldungen(p_kurs_id bigint) TO anon;
GRANT ALL ON FUNCTION public.count_active_anmeldungen(p_kurs_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.count_active_anmeldungen(p_kurs_id bigint) TO service_role;


--
-- Name: FUNCTION enforce_anmeldung_price_snapshot_immutable(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.enforce_anmeldung_price_snapshot_immutable() TO anon;
GRANT ALL ON FUNCTION public.enforce_anmeldung_price_snapshot_immutable() TO authenticated;
GRANT ALL ON FUNCTION public.enforce_anmeldung_price_snapshot_immutable() TO service_role;


--
-- Name: FUNCTION enqueue_booking_confirmation_mail(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.enqueue_booking_confirmation_mail() TO anon;
GRANT ALL ON FUNCTION public.enqueue_booking_confirmation_mail() TO authenticated;
GRANT ALL ON FUNCTION public.enqueue_booking_confirmation_mail() TO service_role;


--
-- Name: FUNCTION get_upcoming_courses(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_upcoming_courses() TO anon;
GRANT ALL ON FUNCTION public.get_upcoming_courses() TO authenticated;
GRANT ALL ON FUNCTION public.get_upcoming_courses() TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION increment_material_view_count(material_id integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.increment_material_view_count(material_id integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.increment_material_view_count(material_id integer) TO anon;
GRANT ALL ON FUNCTION public.increment_material_view_count(material_id integer) TO authenticated;
GRANT ALL ON FUNCTION public.increment_material_view_count(material_id integer) TO service_role;


--
-- Name: FUNCTION is_admin(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_admin() TO anon;
GRANT ALL ON FUNCTION public.is_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_admin() TO service_role;


--
-- Name: FUNCTION is_content_manager(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_content_manager() FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_content_manager() TO anon;
GRANT ALL ON FUNCTION public.is_content_manager() TO authenticated;
GRANT ALL ON FUNCTION public.is_content_manager() TO service_role;


--
-- Name: FUNCTION is_kurs_aktiv(p_kurs_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_kurs_aktiv(p_kurs_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_kurs_aktiv(p_kurs_id bigint) TO anon;
GRANT ALL ON FUNCTION public.is_kurs_aktiv(p_kurs_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.is_kurs_aktiv(p_kurs_id bigint) TO service_role;


--
-- Name: FUNCTION is_kurs_owner(kurs_created_by uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_kurs_owner(kurs_created_by uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_kurs_owner(kurs_created_by uuid) TO anon;
GRANT ALL ON FUNCTION public.is_kurs_owner(kurs_created_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_kurs_owner(kurs_created_by uuid) TO service_role;


--
-- Name: FUNCTION is_owner(record_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_owner(record_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_owner(record_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_owner(record_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_owner(record_user_id uuid) TO service_role;


--
-- Name: FUNCTION link_anmeldung_beneficiary(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.link_anmeldung_beneficiary() TO anon;
GRANT ALL ON FUNCTION public.link_anmeldung_beneficiary() TO authenticated;
GRANT ALL ON FUNCTION public.link_anmeldung_beneficiary() TO service_role;


--
-- Name: FUNCTION set_essay_review_timestamp(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_essay_review_timestamp() TO anon;
GRANT ALL ON FUNCTION public.set_essay_review_timestamp() TO authenticated;
GRANT ALL ON FUNCTION public.set_essay_review_timestamp() TO service_role;


--
-- Name: FUNCTION sync_anmeldung_financial_events(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sync_anmeldung_financial_events() TO anon;
GRANT ALL ON FUNCTION public.sync_anmeldung_financial_events() TO authenticated;
GRANT ALL ON FUNCTION public.sync_anmeldung_financial_events() TO service_role;


--
-- Name: FUNCTION sync_expense_financial_event(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sync_expense_financial_event() TO anon;
GRANT ALL ON FUNCTION public.sync_expense_financial_event() TO authenticated;
GRANT ALL ON FUNCTION public.sync_expense_financial_event() TO service_role;


--
-- Name: FUNCTION sync_financial_adjustment_event(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sync_financial_adjustment_event() TO anon;
GRANT ALL ON FUNCTION public.sync_financial_adjustment_event() TO authenticated;
GRANT ALL ON FUNCTION public.sync_financial_adjustment_event() TO service_role;


--
-- Name: FUNCTION update_correction_rubrics_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_correction_rubrics_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_correction_rubrics_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_correction_rubrics_updated_at() TO service_role;


--
-- Name: FUNCTION update_mentorship_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_mentorship_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_mentorship_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_mentorship_updated_at() TO service_role;


--
-- Name: FUNCTION update_student_essays_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_student_essays_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_student_essays_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_student_essays_updated_at() TO service_role;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_updated_at_column() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;


--
-- Name: FUNCTION validate_work_entry_status_transition(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.validate_work_entry_status_transition() TO anon;
GRANT ALL ON FUNCTION public.validate_work_entry_status_transition() TO authenticated;
GRANT ALL ON FUNCTION public.validate_work_entry_status_transition() TO service_role;


--
-- Name: TABLE audit_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.audit_log TO anon;
GRANT ALL ON TABLE public.audit_log TO authenticated;
GRANT ALL ON TABLE public.audit_log TO service_role;


--
-- Name: TABLE badges; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.badges TO anon;
GRANT ALL ON TABLE public.badges TO authenticated;
GRANT ALL ON TABLE public.badges TO service_role;


--
-- Name: SEQUENCE badges_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.badges_id_seq TO anon;
GRANT ALL ON SEQUENCE public.badges_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.badges_id_seq TO service_role;


--
-- Name: TABLE budgets; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.budgets TO anon;
GRANT ALL ON TABLE public.budgets TO authenticated;
GRANT ALL ON TABLE public.budgets TO service_role;


--
-- Name: TABLE chat_messages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.chat_messages TO anon;
GRANT ALL ON TABLE public.chat_messages TO authenticated;
GRANT ALL ON TABLE public.chat_messages TO service_role;


--
-- Name: TABLE correction_rubrics; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.correction_rubrics TO anon;
GRANT ALL ON TABLE public.correction_rubrics TO authenticated;
GRANT ALL ON TABLE public.correction_rubrics TO service_role;


--
-- Name: TABLE course_days; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.course_days TO anon;
GRANT ALL ON TABLE public.course_days TO authenticated;
GRANT ALL ON TABLE public.course_days TO service_role;


--
-- Name: TABLE course_occurrences; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.course_occurrences TO anon;
GRANT ALL ON TABLE public.course_occurrences TO authenticated;
GRANT ALL ON TABLE public.course_occurrences TO service_role;


--
-- Name: SEQUENCE course_occurrences_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.course_occurrences_id_seq TO anon;
GRANT ALL ON SEQUENCE public.course_occurrences_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.course_occurrences_id_seq TO service_role;


--
-- Name: TABLE course_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.course_sessions TO anon;
GRANT ALL ON TABLE public.course_sessions TO authenticated;
GRANT ALL ON TABLE public.course_sessions TO service_role;


--
-- Name: TABLE courses; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.courses TO anon;
GRANT ALL ON TABLE public.courses TO authenticated;
GRANT ALL ON TABLE public.courses TO service_role;


--
-- Name: SEQUENCE courses_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.courses_id_seq TO anon;
GRANT ALL ON SEQUENCE public.courses_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.courses_id_seq TO service_role;


--
-- Name: TABLE daily_release_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.daily_release_items TO anon;
GRANT ALL ON TABLE public.daily_release_items TO authenticated;
GRANT ALL ON TABLE public.daily_release_items TO service_role;


--
-- Name: TABLE daily_releases; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.daily_releases TO anon;
GRANT ALL ON TABLE public.daily_releases TO authenticated;
GRANT ALL ON TABLE public.daily_releases TO service_role;


--
-- Name: TABLE essay_ai_corrections; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.essay_ai_corrections TO anon;
GRANT ALL ON TABLE public.essay_ai_corrections TO authenticated;
GRANT ALL ON TABLE public.essay_ai_corrections TO service_role;


--
-- Name: TABLE exercises; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.exercises TO anon;
GRANT ALL ON TABLE public.exercises TO authenticated;
GRANT ALL ON TABLE public.exercises TO service_role;


--
-- Name: SEQUENCE exercises_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.exercises_id_seq TO anon;
GRANT ALL ON SEQUENCE public.exercises_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.exercises_id_seq TO service_role;


--
-- Name: TABLE expense_entries; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.expense_entries TO anon;
GRANT ALL ON TABLE public.expense_entries TO authenticated;
GRANT ALL ON TABLE public.expense_entries TO service_role;


--
-- Name: TABLE financial_adjustments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.financial_adjustments TO anon;
GRANT ALL ON TABLE public.financial_adjustments TO authenticated;
GRANT ALL ON TABLE public.financial_adjustments TO service_role;


--
-- Name: TABLE financial_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.financial_events TO anon;
GRANT ALL ON TABLE public.financial_events TO authenticated;
GRANT ALL ON TABLE public.financial_events TO service_role;


--
-- Name: TABLE financial_periods; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.financial_periods TO anon;
GRANT ALL ON TABLE public.financial_periods TO authenticated;
GRANT ALL ON TABLE public.financial_periods TO service_role;


--
-- Name: TABLE intensivwoche_anmeldungen; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.intensivwoche_anmeldungen TO anon;
GRANT ALL ON TABLE public.intensivwoche_anmeldungen TO authenticated;
GRANT ALL ON TABLE public.intensivwoche_anmeldungen TO service_role;


--
-- Name: TABLE intensivwoche_buchungsversuche; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.intensivwoche_buchungsversuche TO anon;
GRANT ALL ON TABLE public.intensivwoche_buchungsversuche TO authenticated;
GRANT ALL ON TABLE public.intensivwoche_buchungsversuche TO service_role;


--
-- Name: SEQUENCE intensivwoche_buchungsversuche_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.intensivwoche_buchungsversuche_id_seq TO anon;
GRANT ALL ON SEQUENCE public.intensivwoche_buchungsversuche_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.intensivwoche_buchungsversuche_id_seq TO service_role;


--
-- Name: TABLE intensivwoche_kurse; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.intensivwoche_kurse TO anon;
GRANT ALL ON TABLE public.intensivwoche_kurse TO authenticated;
GRANT ALL ON TABLE public.intensivwoche_kurse TO service_role;


--
-- Name: SEQUENCE intensivwoche_kurse_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.intensivwoche_kurse_id_seq TO anon;
GRANT ALL ON SEQUENCE public.intensivwoche_kurse_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.intensivwoche_kurse_id_seq TO service_role;


--
-- Name: TABLE intensivwoche_kurse_mit_anmeldungen; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.intensivwoche_kurse_mit_anmeldungen TO anon;
GRANT ALL ON TABLE public.intensivwoche_kurse_mit_anmeldungen TO authenticated;
GRANT ALL ON TABLE public.intensivwoche_kurse_mit_anmeldungen TO service_role;


--
-- Name: TABLE learning_materials; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.learning_materials TO anon;
GRANT ALL ON TABLE public.learning_materials TO authenticated;
GRANT ALL ON TABLE public.learning_materials TO service_role;


--
-- Name: SEQUENCE learning_materials_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.learning_materials_id_seq TO anon;
GRANT ALL ON SEQUENCE public.learning_materials_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.learning_materials_id_seq TO service_role;


--
-- Name: TABLE mail_outbox; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mail_outbox TO anon;
GRANT ALL ON TABLE public.mail_outbox TO authenticated;
GRANT ALL ON TABLE public.mail_outbox TO service_role;


--
-- Name: TABLE material_access_grants; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.material_access_grants TO anon;
GRANT ALL ON TABLE public.material_access_grants TO authenticated;
GRANT ALL ON TABLE public.material_access_grants TO service_role;


--
-- Name: TABLE material_areas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.material_areas TO anon;
GRANT ALL ON TABLE public.material_areas TO authenticated;
GRANT ALL ON TABLE public.material_areas TO service_role;


--
-- Name: SEQUENCE material_areas_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.material_areas_id_seq TO anon;
GRANT ALL ON SEQUENCE public.material_areas_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.material_areas_id_seq TO service_role;


--
-- Name: TABLE math_solution_steps; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.math_solution_steps TO anon;
GRANT ALL ON TABLE public.math_solution_steps TO authenticated;
GRANT ALL ON TABLE public.math_solution_steps TO service_role;


--
-- Name: TABLE mentor_skills; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mentor_skills TO anon;
GRANT ALL ON TABLE public.mentor_skills TO authenticated;
GRANT ALL ON TABLE public.mentor_skills TO service_role;


--
-- Name: TABLE mentorship_listings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mentorship_listings TO anon;
GRANT ALL ON TABLE public.mentorship_listings TO authenticated;
GRANT ALL ON TABLE public.mentorship_listings TO service_role;


--
-- Name: TABLE mentorship_materials; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mentorship_materials TO anon;
GRANT ALL ON TABLE public.mentorship_materials TO authenticated;
GRANT ALL ON TABLE public.mentorship_materials TO service_role;


--
-- Name: TABLE mentorship_relations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mentorship_relations TO anon;
GRANT ALL ON TABLE public.mentorship_relations TO authenticated;
GRANT ALL ON TABLE public.mentorship_relations TO service_role;


--
-- Name: TABLE mentorship_requests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mentorship_requests TO anon;
GRANT ALL ON TABLE public.mentorship_requests TO authenticated;
GRANT ALL ON TABLE public.mentorship_requests TO service_role;


--
-- Name: TABLE offer_editions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.offer_editions TO anon;
GRANT ALL ON TABLE public.offer_editions TO authenticated;
GRANT ALL ON TABLE public.offer_editions TO service_role;


--
-- Name: TABLE offers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.offers TO anon;
GRANT ALL ON TABLE public.offers TO authenticated;
GRANT ALL ON TABLE public.offers TO service_role;


--
-- Name: SEQUENCE offers_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.offers_id_seq TO anon;
GRANT ALL ON SEQUENCE public.offers_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.offers_id_seq TO service_role;


--
-- Name: TABLE payroll_periods; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.payroll_periods TO anon;
GRANT ALL ON TABLE public.payroll_periods TO authenticated;
GRANT ALL ON TABLE public.payroll_periods TO service_role;


--
-- Name: TABLE payroll_snapshot_lines; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.payroll_snapshot_lines TO anon;
GRANT ALL ON TABLE public.payroll_snapshot_lines TO authenticated;
GRANT ALL ON TABLE public.payroll_snapshot_lines TO service_role;


--
-- Name: TABLE payroll_snapshots; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.payroll_snapshots TO anon;
GRANT ALL ON TABLE public.payroll_snapshots TO authenticated;
GRANT ALL ON TABLE public.payroll_snapshots TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE questions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.questions TO anon;
GRANT ALL ON TABLE public.questions TO authenticated;
GRANT ALL ON TABLE public.questions TO service_role;


--
-- Name: SEQUENCE questions_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.questions_id_seq TO anon;
GRANT ALL ON SEQUENCE public.questions_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.questions_id_seq TO service_role;


--
-- Name: TABLE release_content_catalog; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.release_content_catalog TO anon;
GRANT ALL ON TABLE public.release_content_catalog TO authenticated;
GRANT ALL ON TABLE public.release_content_catalog TO service_role;


--
-- Name: TABLE school_holiday_weeks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.school_holiday_weeks TO anon;
GRANT ALL ON TABLE public.school_holiday_weeks TO authenticated;
GRANT ALL ON TABLE public.school_holiday_weeks TO service_role;


--
-- Name: TABLE self_study_enrollments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.self_study_enrollments TO anon;
GRANT ALL ON TABLE public.self_study_enrollments TO authenticated;
GRANT ALL ON TABLE public.self_study_enrollments TO service_role;


--
-- Name: TABLE student_essays; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.student_essays TO anon;
GRANT ALL ON TABLE public.student_essays TO authenticated;
GRANT ALL ON TABLE public.student_essays TO service_role;


--
-- Name: TABLE subjects; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.subjects TO anon;
GRANT ALL ON TABLE public.subjects TO authenticated;
GRANT ALL ON TABLE public.subjects TO service_role;


--
-- Name: SEQUENCE subject_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.subject_id_seq TO anon;
GRANT ALL ON SEQUENCE public.subject_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.subject_id_seq TO service_role;


--
-- Name: TABLE tasks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tasks TO anon;
GRANT ALL ON TABLE public.tasks TO authenticated;
GRANT ALL ON TABLE public.tasks TO service_role;


--
-- Name: SEQUENCE tasks_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.tasks_id_seq TO anon;
GRANT ALL ON SEQUENCE public.tasks_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.tasks_id_seq TO service_role;


--
-- Name: SEQUENCE tasks_id_seq1; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.tasks_id_seq1 TO anon;
GRANT ALL ON SEQUENCE public.tasks_id_seq1 TO authenticated;
GRANT ALL ON SEQUENCE public.tasks_id_seq1 TO service_role;


--
-- Name: TABLE teacher_assignments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.teacher_assignments TO anon;
GRANT ALL ON TABLE public.teacher_assignments TO authenticated;
GRANT ALL ON TABLE public.teacher_assignments TO service_role;


--
-- Name: TABLE teacher_rate_agreements; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.teacher_rate_agreements TO anon;
GRANT ALL ON TABLE public.teacher_rate_agreements TO authenticated;
GRANT ALL ON TABLE public.teacher_rate_agreements TO service_role;


--
-- Name: TABLE trainer_exams; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trainer_exams TO anon;
GRANT ALL ON TABLE public.trainer_exams TO authenticated;
GRANT ALL ON TABLE public.trainer_exams TO service_role;


--
-- Name: TABLE trainer_progress; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trainer_progress TO anon;
GRANT ALL ON TABLE public.trainer_progress TO authenticated;
GRANT ALL ON TABLE public.trainer_progress TO service_role;


--
-- Name: TABLE user_badges; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_badges TO anon;
GRANT ALL ON TABLE public.user_badges TO authenticated;
GRANT ALL ON TABLE public.user_badges TO service_role;


--
-- Name: SEQUENCE user_badges_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.user_badges_id_seq TO anon;
GRANT ALL ON SEQUENCE public.user_badges_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.user_badges_id_seq TO service_role;


--
-- Name: TABLE user_exercises; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_exercises TO anon;
GRANT ALL ON TABLE public.user_exercises TO authenticated;
GRANT ALL ON TABLE public.user_exercises TO service_role;


--
-- Name: TABLE wake_up; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.wake_up TO anon;
GRANT ALL ON TABLE public.wake_up TO authenticated;
GRANT ALL ON TABLE public.wake_up TO service_role;


--
-- Name: SEQUENCE wake_up_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.wake_up_id_seq TO anon;
GRANT ALL ON SEQUENCE public.wake_up_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.wake_up_id_seq TO service_role;


--
-- Name: TABLE work_entries; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.work_entries TO anon;
GRANT ALL ON TABLE public.work_entries TO authenticated;
GRANT ALL ON TABLE public.work_entries TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--


--


--
-- Ergaenzt gegenueber dem rohen pg_dump-Output (Live-Abgleich 29.07.2026, read-only via
-- Supabase-MCP-Connector, keine Zugangsdaten noetig): Storage-Bucket-Definitionen und die
-- Realtime-Publikationsmitgliedschaft liegen ausserhalb des per `--schema=public` gedumpten
-- Bereichs (storage.buckets gehoert zum storage-Schema, Publikationen sind clusterweite
-- Objekte). Reine Konfiguration, keine Nutzerdaten/Dateien.
--

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('correction-rubrics', 'correction-rubrics', false, 5242880, ARRAY['application/pdf']),
  ('lernmaterialien', 'lernmaterialien', false, 52428800, ARRAY[
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'audio/mpeg'
  ]),
  ('student-essays', 'student-essays', false, 10485760, ARRAY[
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ])
ON CONFLICT (id) DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

--
-- Ergaenzt gegenueber dem rohen pg_dump-Output (29.07.2026, read-only via
-- Supabase-MCP-Connector, keine Zugangsdaten noetig): storage.objects-Policies liegen wie die
-- Storage-Buckets oben ausserhalb des per `--schema=public` gedumpten Bereichs. Live bestaetigt
-- vorhanden und wortgleich reproduziert -- kein Live-Sicherheitsbefund, nur eine
-- Baseline-Vervollstaendigung fuer den lokalen pgTAP-Test 0017. Weitere Storage-Policies auf den
-- Buckets avatars/correction-rubrics/student-essays sind nicht live verifiziert und bewusst nicht
-- miterraten.
--

CREATE POLICY lernmaterialien_read_access ON storage.objects FOR SELECT TO authenticated
  USING (
    (bucket_id = 'lernmaterialien'::text) AND (EXISTS (
      SELECT 1 FROM public.learning_materials lm
      WHERE (lm.download_path = objects.name) AND (
        (lm.is_public = true)
        OR (auth.uid() = lm.created_by)
        OR public.is_content_manager()
        OR (EXISTS (
          SELECT 1 FROM public.material_access_grants g
          WHERE (g.user_id = auth.uid())
            AND (g.area_id = lm.area_id)
            AND (g.status = 'active'::text)
            AND ((g.valid_until IS NULL) OR (g.valid_until > now()))
        ))
      )
    ))
  );


--
-- PostgreSQL database dump complete
--


