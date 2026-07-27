-- Ersetzt den manuell gepflegten Frühbucherpreis (offer_editions.early_bird_*) durch eine
-- automatische Regel (Betreiberentscheid 27.07.2026): Eine Anmeldung erhält 10% Rabatt auf den
-- Regulärpreis, wenn sie mindestens 6 Wochen (42 Tage) vor dem Kursstart (intensivwoche_kurse.
-- start_datum) erfolgt. Das Startdatum ist bereits über Abschnitt 3 ("Termine/Kapazität") der
-- Admin-Maske bekannt -- ein zusätzliches, unabhängig gepflegtes Frühbucherpreis-/Stichtag-Feld in
-- Abschnitt 2 ("Preise") ist damit redundant und wurde bislang ohnehin nie real abgerechnet, siehe
-- Punkt 2 unten.
--
-- Der Stichtag gilt pro Session/Durchführung (jede Kursgruppe hat ihr eigenes Startdatum), nicht
-- pro Edition -- deshalb kann diese Regel nicht in offer_editions leben, sondern gehört in
-- book_intensivwoche_kurs(), wo v_kurs.start_datum bereits pro Buchung geladen wird.

-- ============================================================================
-- 1) offer_editions: Frühbucherpreis-Spalten und ihr CHECK-Constraint entfallen. Diese Felder
--    waren bislang nur ein Marketing-Anzeigewert (siehe Punkt 2) und werden durch die berechnete
--    Regel in lib/pricing.ts (TypeScript-Seite) und diese Migration (Buchungsseite) ersetzt.
-- ============================================================================

ALTER TABLE public.offer_editions
  DROP CONSTRAINT offer_editions_early_bird_consistency;

ALTER TABLE public.offer_editions
  DROP COLUMN early_bird_enabled,
  DROP COLUMN early_bird_price_rappen,
  DROP COLUMN early_bird_deadline;

-- ============================================================================
-- 2) book_intensivwoche_kurs: bislang setzte booked_price_rappen IMMER round(v_kurs.preis * 100)
--    -- der Frühbucherpreis aus offer_editions wirkte sich nie auf den real belasteten Preis aus.
--    Ab jetzt wird der Rabatt hier automatisch berechnet: 90% des Preises, wenn das Anmeldedatum
--    (Europe/Zurich-Kalendertag) höchstens 42 Tage vor v_kurs.start_datum liegt, sonst 100%.
--    Unverändert gegenüber Phase B (20260720090000): Signatur, Rate-Limit, Idempotenz,
--    Duplikat-/Kapazitätsprüfung. CREATE OR REPLACE genügt (Signatur unverändert seit Phase A).
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

COMMENT ON FUNCTION public.book_intensivwoche_kurs(bigint, text, text, text, text, text, text, text, uuid) IS 'Einzige zulässige Schreibstelle für Kursanmeldungen. Sperrt den Kurs (FOR UPDATE), prüft Rate-Limit (5/10min je parent_email)/Aktivität/Kapazität/familienfähige Doppelanmeldung atomar, unterstützt idempotente Wiederholungen über idempotency_key, berechnet automatisch 10% Frühbucherrabatt bei Anmeldung >=6 Wochen vor Kursstart und schreibt den Preis-Snapshot. Fester leerer search_path, SECURITY DEFINER.';

-- CREATE OR REPLACE erhält bestehende Grants, da Eigentümer und Signatur unverändert bleiben --
-- zur Klarheit trotzdem explizit erneut gesetzt.
REVOKE ALL ON FUNCTION public.book_intensivwoche_kurs(bigint, text, text, text, text, text, text, text, uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.book_intensivwoche_kurs(bigint, text, text, text, text, text, text, text, uuid) TO anon;
GRANT ALL ON FUNCTION public.book_intensivwoche_kurs(bigint, text, text, text, text, text, text, text, uuid) TO authenticated;
GRANT ALL ON FUNCTION public.book_intensivwoche_kurs(bigint, text, text, text, text, text, text, text, uuid) TO service_role;
