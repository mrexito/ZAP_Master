-- ============================================================================
-- Live-Schema-Baseline (datenfrei) fuer das Supabase-Projekt ZAP_25
-- ============================================================================
-- Herkunft:   docs/migration-evidence/private/2026-07-19/step0PublicSchema.2026-07-19.sql
-- Quell-Hash: SHA-256 47CA58A401A5C7C4F8E71FBFCA42B8CA62248A392483DDB2320274C44E7E8527
-- Erzeugt:    2026-07-19T13:37:41Z, Rolle zap_baseline_reader, transaction_read_only=on,
--             pg_dump --schema-only --schema=public --no-owner (Version 18.4 gegen Server 17.4)
-- Abgleich:   exakte Uebereinstimmung mit dem DB-Level-Kataloglauf vom 18.07.2026 --
--             26 Tabellen, 1 View, 15 Funktionen (davon 9 SECURITY DEFINER), 131 Policies,
--             12 Sequenzen, 84 Constraints, 72 Indizes, 9 Trigger. Siehe
--             docs/migration-evidence/2026-07-18-supabase-baseline-inventory.md, Abschnitt 14.
--
-- Gegenueber dem rohen pg_dump-Output wurden ausschliesslich folgende Anpassungen vorgenommen:
--   1. '\restrict' / '\unrestrict' (psql-18-Metabefehle ohne SQL-Bedeutung) entfernt.
--   2. 'CREATE SCHEMA public;' zu 'CREATE SCHEMA IF NOT EXISTS public;' gemacht, da das
--      Schema in einer frischen lokalen Supabase-Instanz bereits existiert.
--   3. 28 GRANT-Zeilen auf die befristete Audit-Rolle 'zap_baseline_reader' entfernt
--      (USAGE ON SCHEMA public + 27x SELECT ON TABLE). Diese Rolle ist keine Anwendungsrolle,
--      war zum Dump-Zeitpunkt nur befristet fuer diesen einen Lauf mit SELECT ausgestattet
--      (siehe Abschnitt 14 des Berichts) und darf nicht Teil der dauerhaften Baseline sein.
--
-- Diese Datei enthaelt ausschliesslich Schema-DDL (Tabellen, Constraints, Indizes, Sequenzen,
-- Views, Funktionen, Trigger, RLS-Policies, Grants fuer echte Anwendungsrollen). Sie enthaelt
-- keine Datenzeilen, keine Auth-/Testnutzer und keine Secrets.
--
-- Diese Datei ist auf dem bestehenden Remote-Projekt NICHT als angewandte Migration
-- registriert. Ein 'db push' gegen das Remote-Projekt wuerde versuchen, dieses SQL erneut
-- auszufuehren und ist bis zur separat freizugebenden Baseline-Adoption (Abschnitt 9.1 in
-- step0Baseline.revision2.md) verboten.
-- ============================================================================

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.4
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

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: accept_mentorship_request(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accept_mentorship_request(request_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
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
-- Name: book_intensivwoche_kurs(bigint, text, text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.book_intensivwoche_kurs(p_kurs_id bigint, p_child_firstname text, p_child_lastname text, p_child_class_level text, p_child_gender text, p_parent_email text, p_parent_phone text, p_notes text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_kurs RECORD;
  v_belegt INTEGER;
  v_email TEXT := lower(trim(p_parent_email));
  v_new_id UUID;
BEGIN
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

  INSERT INTO public.intensivwoche_anmeldungen (
    kurs_id, child_firstname, child_lastname, child_class_level, child_gender,
    parent_email, parent_phone, notes, booked_price_rappen, currency
  ) VALUES (
    p_kurs_id,
    trim(p_child_firstname),
    trim(p_child_lastname),
    trim(p_child_class_level),
    p_child_gender,
    v_email,
    trim(p_parent_phone),
    NULLIF(trim(p_notes), ''),
    round(v_kurs.preis * 100)::INTEGER,
    'CHF'
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;


--
-- Name: FUNCTION book_intensivwoche_kurs(p_kurs_id bigint, p_child_firstname text, p_child_lastname text, p_child_class_level text, p_child_gender text, p_parent_email text, p_parent_phone text, p_notes text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.book_intensivwoche_kurs(p_kurs_id bigint, p_child_firstname text, p_child_lastname text, p_child_class_level text, p_child_gender text, p_parent_email text, p_parent_phone text, p_notes text) IS 'Einzige zulässige Schreibstelle für Kursanmeldungen. Sperrt den Kurs (FOR UPDATE), prüft Aktivität/Kapazität/Doppelanmeldung atomar und schreibt den Preis-Snapshot. Fester leerer search_path, SECURITY DEFINER — Grants siehe unten.';


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


SET default_table_access_method = heap;

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
    type text
);


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
    CONSTRAINT booked_price_rappen_non_negative CHECK (((booked_price_rappen IS NULL) OR (booked_price_rappen >= 0))),
    CONSTRAINT intensivwoche_anmeldungen_child_gender_check CHECK ((child_gender = ANY (ARRAY['m'::text, 'w'::text, 'd'::text]))),
    CONSTRAINT intensivwoche_anmeldungen_status_check CHECK ((status = ANY (ARRAY['eingegangen'::text, 'bestaetigt'::text, 'bezahlt'::text, 'storniert'::text])))
);


--
-- Name: TABLE intensivwoche_anmeldungen; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.intensivwoche_anmeldungen IS 'Öffentliche Anmeldungen für Intensivwochen-Kurse. RLS: Anon kann nur INSERT, Authenticated hat vollen Zugriff.';


--
-- Name: COLUMN intensivwoche_anmeldungen.booked_price_rappen; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.intensivwoche_anmeldungen.booked_price_rappen IS 'Unveränderlicher Preis-Snapshot in Rappen zum Buchungszeitpunkt. NULL bei Altzeilen vor dieser Migration. Wird von book_intensivwoche_kurs() (Migration 014) gesetzt, niemals nachträglich aus intensivwoche_kurse.preis neu berechnet.';


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
    COALESCE(a.anzahl_anmeldungen, (0)::bigint) AS aktuelle_teilnehmer,
        CASE
            WHEN (COALESCE(a.anzahl_anmeldungen, (0)::bigint) >= k.max_teilnehmer) THEN 'ausgebucht'::text
            WHEN (COALESCE(a.anzahl_anmeldungen, (0)::bigint) >= (k.max_teilnehmer - 2)) THEN 'wenige-plaetze'::text
            ELSE 'offen'::text
        END AS status
   FROM (public.intensivwoche_kurse k
     LEFT JOIN ( SELECT intensivwoche_anmeldungen.kurs_id,
            count(*) AS anzahl_anmeldungen
           FROM public.intensivwoche_anmeldungen
          WHERE (intensivwoche_anmeldungen.status <> 'storniert'::text)
          GROUP BY intensivwoche_anmeldungen.kurs_id) a ON ((k.id = a.kurs_id)));


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
    class_levels text[] DEFAULT ARRAY['5. Klasse'::text, '6. Klasse'::text],
    created_by uuid,
    is_public boolean DEFAULT true,
    download_count integer DEFAULT 0,
    is_link boolean DEFAULT false
);


--
-- Name: COLUMN learning_materials.is_link; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.learning_materials.is_link IS 'True if this material is a link/bookmark rather than an uploaded file';


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
    CONSTRAINT profiles_gender_check CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text, 'prefer_not_to_say'::text]))),
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['user'::text, 'lehrperson'::text, 'admin'::text]))),
    CONSTRAINT profiles_theme_preference_check CHECK (((theme_preference)::text = ANY ((ARRAY['light'::character varying, 'dark'::character varying, 'system'::character varying])::text[])))
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

COMMENT ON COLUMN public.profiles.class_level IS 'Klassenstufe (z.B. 6. Klasse)';


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
-- Name: badges badges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.badges
    ADD CONSTRAINT badges_pkey PRIMARY KEY (id);


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
-- Name: course_occurrences course_occurrences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_occurrences
    ADD CONSTRAINT course_occurrences_pkey PRIMARY KEY (id);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);


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
-- Name: intensivwoche_anmeldungen intensivwoche_anmeldungen_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intensivwoche_anmeldungen
    ADD CONSTRAINT intensivwoche_anmeldungen_pkey PRIMARY KEY (id);


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
-- Name: idx_anmeldungen_kurs_email_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_anmeldungen_kurs_email_unique ON public.intensivwoche_anmeldungen USING btree (kurs_id, lower(parent_email)) WHERE (status <> 'storniert'::text);


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
-- Name: idx_essay_ai_corrections_essay_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_essay_ai_corrections_essay_id ON public.essay_ai_corrections USING btree (essay_id);


--
-- Name: idx_essay_ai_corrections_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_essay_ai_corrections_status ON public.essay_ai_corrections USING btree (status);


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
-- Name: correction_rubrics correction_rubrics_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER correction_rubrics_updated_at BEFORE UPDATE ON public.correction_rubrics FOR EACH ROW EXECUTE FUNCTION public.update_correction_rubrics_updated_at();


--
-- Name: student_essays student_essays_review_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER student_essays_review_timestamp BEFORE UPDATE ON public.student_essays FOR EACH ROW EXECUTE FUNCTION public.set_essay_review_timestamp();


--
-- Name: student_essays student_essays_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER student_essays_updated_at BEFORE UPDATE ON public.student_essays FOR EACH ROW EXECUTE FUNCTION public.update_student_essays_updated_at();


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
-- Name: course_occurrences course_occurrences_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_occurrences
    ADD CONSTRAINT course_occurrences_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id);


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
-- Name: intensivwoche_anmeldungen intensivwoche_anmeldungen_kurs_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intensivwoche_anmeldungen
    ADD CONSTRAINT intensivwoche_anmeldungen_kurs_id_fkey FOREIGN KEY (kurs_id) REFERENCES public.intensivwoche_kurse(id) ON DELETE SET NULL;


--
-- Name: intensivwoche_kurse intensivwoche_kurse_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intensivwoche_kurse
    ADD CONSTRAINT intensivwoche_kurse_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


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
-- Name: intensivwoche_anmeldungen; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.intensivwoche_anmeldungen ENABLE ROW LEVEL SECURITY;

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
-- Name: learning_materials learning_materials_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY learning_materials_public_read ON public.learning_materials FOR SELECT TO authenticated, anon USING (true);


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
GRANT ALL ON FUNCTION public.accept_mentorship_request(request_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.accept_mentorship_request(request_id uuid) TO service_role;


--
-- Name: FUNCTION book_intensivwoche_kurs(p_kurs_id bigint, p_child_firstname text, p_child_lastname text, p_child_class_level text, p_child_gender text, p_parent_email text, p_parent_phone text, p_notes text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.book_intensivwoche_kurs(p_kurs_id bigint, p_child_firstname text, p_child_lastname text, p_child_class_level text, p_child_gender text, p_parent_email text, p_parent_phone text, p_notes text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.book_intensivwoche_kurs(p_kurs_id bigint, p_child_firstname text, p_child_lastname text, p_child_class_level text, p_child_gender text, p_parent_email text, p_parent_phone text, p_notes text) TO anon;
GRANT ALL ON FUNCTION public.book_intensivwoche_kurs(p_kurs_id bigint, p_child_firstname text, p_child_lastname text, p_child_class_level text, p_child_gender text, p_parent_email text, p_parent_phone text, p_notes text) TO authenticated;
GRANT ALL ON FUNCTION public.book_intensivwoche_kurs(p_kurs_id bigint, p_child_firstname text, p_child_lastname text, p_child_class_level text, p_child_gender text, p_parent_email text, p_parent_phone text, p_notes text) TO service_role;


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


--
-- Name: FUNCTION increment_material_view_count(material_id integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.increment_material_view_count(material_id integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.increment_material_view_count(material_id integer) TO authenticated;
GRANT ALL ON FUNCTION public.increment_material_view_count(material_id integer) TO service_role;


--
-- Name: FUNCTION is_admin(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_admin() TO service_role;


--
-- Name: FUNCTION is_content_manager(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_content_manager() FROM PUBLIC;
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
GRANT ALL ON FUNCTION public.is_kurs_owner(kurs_created_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_kurs_owner(kurs_created_by uuid) TO service_role;


--
-- Name: FUNCTION is_owner(record_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_owner(record_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_owner(record_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_owner(record_user_id uuid) TO service_role;


--
-- Name: FUNCTION set_essay_review_timestamp(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_essay_review_timestamp() TO anon;
GRANT ALL ON FUNCTION public.set_essay_review_timestamp() TO authenticated;
GRANT ALL ON FUNCTION public.set_essay_review_timestamp() TO service_role;


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
-- Name: TABLE intensivwoche_anmeldungen; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.intensivwoche_anmeldungen TO anon;
GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.intensivwoche_anmeldungen TO authenticated;
GRANT ALL ON TABLE public.intensivwoche_anmeldungen TO service_role;


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
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

-- Auskommentiert am 19.07.2026 (lokaler Gate-Lauf, nie remote ausgerollt): pg_dump hat diese
-- vom Live-Projekt mitgenommenen ALTER DEFAULT PRIVILEGES-Anweisungen ursprünglich als Rolle
-- supabase_admin gesetzt. Lokal führt die Supabase-CLI Migrationen als Rolle `postgres` aus,
-- die sich (wie auf der Supabase-Plattform selbst) nicht per SET ROLE zu supabase_admin machen
-- darf -> `permission denied to change default privileges (SQLSTATE 42501)`, dokumentiertes
-- Supabase-Verhalten (github.com/orgs/supabase/discussions/37471). Die parallelen
-- "FOR ROLE postgres"-Grants oben decken den für einen selbstverwalteten Migrationsablauf
-- relevanten Fall bereits ab.
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

-- Auskommentiert am 19.07.2026 aus demselben Grund wie beim SEQUENCES-Block oben (postgres darf
-- lokal nicht SET ROLE supabase_admin).
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

-- Auskommentiert am 19.07.2026 aus demselben Grund wie beim SEQUENCES-Block oben (postgres darf
-- lokal nicht SET ROLE supabase_admin).
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--


