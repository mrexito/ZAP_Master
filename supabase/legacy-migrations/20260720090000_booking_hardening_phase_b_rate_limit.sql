-- Buchungshärtungen Phase B (step0Baseline.revision2.md, Abschnitt 12). Letzter der acht dort
-- festgehaltenen Punkte, der eine Migration braucht: dauerhafter, serverseitiger Rate-Limiter.
-- (Der verbleibende Punkt, "automatisierter Parallelitätstest für den letzten freien Platz", ist
-- ein Testartefakt ohne Schemaänderung -- siehe scripts/concurrency-test-booking.ts.)
--
-- Design: pro normalisierter parent_email max. 5 Aufrufe von book_intensivwoche_kurs() innerhalb
-- von 10 Minuten (gleitendes Fenster). Persistiert in einer eigenen Tabelle statt In-Memory, damit
-- der Limiter Funktions-Kaltstarts/Neuverbindungen übersteht ("dauerhaft" laut Abschnitt 12).
-- Geprüft direkt in der SECURITY DEFINER Funktion (nicht nur in der Server Action), damit auch
-- direkte anonyme RPC-Aufrufe erfasst werden -- konsistent mit dem bestehenden Muster "einzige
-- Schreibstelle". Ein per idempotency_key erkannter Wiederholungsaufruf (Kurzschluss ganz am
-- Anfang der Funktion, unverändert seit Phase A) zählt bewusst NICHT als neuer Versuch: ein
-- Netzwerk-Retry mit demselben Schlüssel darf das Kontingent nicht verbrauchen.

-- ============================================================================
-- 1) Tabelle für gezählte Versuche. RLS aktiv, aber ohne Policies: einziger Zugriffspfad ist die
--    SECURITY DEFINER Funktion unten, die als Tabelleneigentümer läuft (BYPASSRLS) -- anon/
--    authenticated bekommen bewusst keine Grants, RLS ohne Policy blockt zusätzlich jeden anderen
--    Pfad (z.B. PostgREST) selbst falls künftig versehentlich ein Grant hinzukäme.
-- ============================================================================

CREATE TABLE public.intensivwoche_buchungsversuche (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parent_email text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.intensivwoche_buchungsversuche ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_buchungsversuche_email_time
  ON public.intensivwoche_buchungsversuche (lower(parent_email), attempted_at);

REVOKE ALL ON TABLE public.intensivwoche_buchungsversuche FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.intensivwoche_buchungsversuche IS 'Zähl-Log für den Rate-Limiter in book_intensivwoche_kurs() (max. 5 Versuche / 10 Minuten je parent_email). Nur über die SECURITY DEFINER Funktion beschrieben/gelesen, RLS ohne Policies, keine Grants an anon/authenticated. Wird bewusst nicht automatisch bereinigt (Phase B); künftiges Pruning ist ein separater, additiver Schritt.';

-- ============================================================================
-- 2) book_intensivwoche_kurs: Rate-Limit-Prüfung direkt nach dem idempotency_key-Kurzschluss und
--    vor dem Kurs-Lock eingefügt, sonst unverändert gegenüber Phase A. CREATE OR REPLACE genügt
--    hier (Signatur unverändert seit Phase A -- Argumenttyp-Liste bleibt bei 9 Typen).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.book_intensivwoche_kurs(
  p_kurs_id bigint,
  p_child_firstname text,
  p_child_lastname text,
  p_child_class_level text,
  p_child_gender text,
  p_parent_email text,
  p_parent_phone text,
  p_notes text DEFAULT NULL::text,
  p_idempotency_key uuid DEFAULT NULL::uuid
) RETURNS uuid
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
      round(v_kurs.preis * 100)::INTEGER,
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

COMMENT ON FUNCTION public.book_intensivwoche_kurs(bigint, text, text, text, text, text, text, text, uuid) IS 'Einzige zulässige Schreibstelle für Kursanmeldungen. Sperrt den Kurs (FOR UPDATE), prüft Rate-Limit (5/10min je parent_email)/Aktivität/Kapazität/familienfähige Doppelanmeldung atomar, unterstützt idempotente Wiederholungen über idempotency_key, schreibt den Preis-Snapshot. Fester leerer search_path, SECURITY DEFINER.';

-- CREATE OR REPLACE erhält bestehende Grants, da Eigentümer und Signatur unverändert bleiben --
-- zur Klarheit trotzdem explizit erneut gesetzt.
REVOKE ALL ON FUNCTION public.book_intensivwoche_kurs(bigint, text, text, text, text, text, text, text, uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.book_intensivwoche_kurs(bigint, text, text, text, text, text, text, text, uuid) TO anon;
GRANT ALL ON FUNCTION public.book_intensivwoche_kurs(bigint, text, text, text, text, text, text, text, uuid) TO authenticated;
GRANT ALL ON FUNCTION public.book_intensivwoche_kurs(bigint, text, text, text, text, text, text, text, uuid) TO service_role;
