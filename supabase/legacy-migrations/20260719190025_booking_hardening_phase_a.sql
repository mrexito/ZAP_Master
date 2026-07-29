-- Buchungshärtungen Phase A (step0Baseline.revision2.md, Abschnitt 12; Plan
-- optimized-wobbling-thompson.md). Deckt fünf der acht dort festgehaltenen Punkte ab:
-- familienfähiger Duplikatschlüssel, idempotency_key, Format-/Längen-Checks, unveränderlicher
-- Preis-/Währungs-Snapshot, minimale Grants. Rate-Limiter und Concurrency-Test bleiben Phase B.

-- ============================================================================
-- 1) Familienfähiger Unique-Index ersetzt den bestehenden, zu engen Index.
--    Der bisherige Index (kurs_id, lower(parent_email)) blockierte Geschwisterbuchungen unter
--    derselben Eltern-E-Mail. Neuer Schlüssel ist eine strikte Obermenge der Altspalten, daher
--    kein Risiko gegen Bestandsdaten.
-- ============================================================================

DROP INDEX public.idx_anmeldungen_kurs_email_unique;

CREATE UNIQUE INDEX idx_anmeldungen_kurs_email_child_unique
  ON public.intensivwoche_anmeldungen (
    kurs_id, lower(parent_email), lower(trim(child_firstname)), lower(trim(child_lastname))
  )
  WHERE (status <> 'storniert'::text);

-- ============================================================================
-- 2) idempotency_key: Spalte + partieller Unique-Index.
-- ============================================================================

ALTER TABLE public.intensivwoche_anmeldungen ADD COLUMN idempotency_key uuid;

CREATE UNIQUE INDEX idx_anmeldungen_idempotency_key_unique
  ON public.intensivwoche_anmeldungen (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ============================================================================
-- 3) DB-seitige Format-/Längen-Checks, gespiegelt vom bestehenden Zod-Schema
--    (types/intensivwoche.ts). NOT VALID: sofort wirksam für neue/geänderte Zeilen, kein Scan
--    bestehender Zeilen beim Anlegen -- kann daher nicht an Altdaten scheitern. VALIDATE
--    CONSTRAINT ist ein bewusst nachgelagerter, separater Schritt nach Live-Datenprüfung.
-- ============================================================================

ALTER TABLE public.intensivwoche_anmeldungen
  ADD CONSTRAINT anmeldungen_child_firstname_length_check
    CHECK (char_length(trim(child_firstname)) BETWEEN 2 AND 50) NOT VALID,
  ADD CONSTRAINT anmeldungen_child_lastname_length_check
    CHECK (char_length(trim(child_lastname)) BETWEEN 2 AND 50) NOT VALID,
  ADD CONSTRAINT anmeldungen_child_class_level_length_check
    CHECK (char_length(trim(child_class_level)) BETWEEN 1 AND 20) NOT VALID,
  ADD CONSTRAINT anmeldungen_parent_phone_format_check
    CHECK (char_length(parent_phone) BETWEEN 10 AND 20 AND parent_phone ~ '^[\d\s+\-()]+$') NOT VALID,
  ADD CONSTRAINT anmeldungen_notes_length_check
    CHECK (notes IS NULL OR char_length(notes) <= 500) NOT VALID,
  ADD CONSTRAINT anmeldungen_parent_email_format_check
    CHECK (char_length(parent_email) <= 254
           AND parent_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') NOT VALID;

-- ============================================================================
-- 4) Unveränderlicher Preis-/Währungs-Snapshot. Blockiert gezielt nur booked_price_rappen/
--    currency; status/paid_at-Updates ueber die bestehende Admin-Policy bleiben unangetastet.
--    Nicht SECURITY DEFINER (braucht keine erhoehten Rechte). Greift auch bei service_role
--    (Trigger umgehen RLS nicht).
-- ============================================================================

CREATE FUNCTION public.enforce_anmeldung_price_snapshot_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF NEW.booked_price_rappen IS DISTINCT FROM OLD.booked_price_rappen
     OR NEW.currency IS DISTINCT FROM OLD.currency THEN
    RAISE EXCEPTION 'booked_price_snapshot_immutable' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER anmeldungen_price_snapshot_immutable
  BEFORE UPDATE ON public.intensivwoche_anmeldungen
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_anmeldung_price_snapshot_immutable();

-- ============================================================================
-- 5) book_intensivwoche_kurs neu erzeugen (nicht CREATE OR REPLACE): ein angehängter Parameter
--    aendert die Argumenttyp-Liste (8 -> 9 Typen), CREATE OR REPLACE ersetzt nur bei identischer
--    Liste -- sonst entstuende eine zweite, ueberlappende Funktion mit PUBLIC-EXECUTE-Default und
--    mehrdeutiger Aufloesung bei genau 8 Argumenten. Deshalb explizit DROP + CREATE + GRANTs neu.
--
--    Neu: familienfaehiger Duplikat-Check (Kindername statt nur Eltern-E-Mail), idempotency_key
--    mit Lookup VOR dem Kurs-Lock (eine Wiederholung nach erneuter Pruefung koennte sonst
--    faelschlich 'voll'/'kurs_inaktiv' werfen, obwohl die urspruengliche Buchung schon gelang),
--    Cross-Kurs-Missbrauch eines Schluessels wird abgefangen, unique_violation-Handler faengt die
--    seltene Race zwischen zwei parallelen Aufrufen mit demselben Schluessel fuer unterschiedliche
--    kurs_id ab (nicht durch das Kurs-Lock serialisiert) und RAISEt alles andere weiter.
-- ============================================================================

DROP FUNCTION public.book_intensivwoche_kurs(bigint, text, text, text, text, text, text, text);

CREATE FUNCTION public.book_intensivwoche_kurs(
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

COMMENT ON FUNCTION public.book_intensivwoche_kurs(bigint, text, text, text, text, text, text, text, uuid) IS 'Einzige zulässige Schreibstelle für Kursanmeldungen. Sperrt den Kurs (FOR UPDATE), prüft Aktivität/Kapazität/familienfähige Doppelanmeldung atomar, unterstützt idempotente Wiederholungen über idempotency_key, schreibt den Preis-Snapshot. Fester leerer search_path, SECURITY DEFINER.';

REVOKE ALL ON FUNCTION public.book_intensivwoche_kurs(bigint, text, text, text, text, text, text, text, uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.book_intensivwoche_kurs(bigint, text, text, text, text, text, text, text, uuid) TO anon;
GRANT ALL ON FUNCTION public.book_intensivwoche_kurs(bigint, text, text, text, text, text, text, text, uuid) TO authenticated;
GRANT ALL ON FUNCTION public.book_intensivwoche_kurs(bigint, text, text, text, text, text, text, text, uuid) TO service_role;

-- ============================================================================
-- 6) Minimale Grants auf intensivwoche_anmeldungen. authenticated behaelt SELECT/UPDATE/DELETE,
--    weil die drei bestehenden is_admin()-Policies den Tabellen-Grant als Vorbedingung brauchen
--    (RLS filtert zusaetzlich, ersetzt aber nicht den Grant); REFERENCES/TRIGGER/TRUNCATE/
--    MAINTAIN dienen keiner der beiden Rollen und werden entzogen. Keine bestehende Tabelle
--    referenziert intensivwoche_anmeldungen(id) per FK, REFERENCES-Entzug ist unkritisch.
--
--    anon behaelt SELECT (nicht vollstaendig entzogen): Die oeffentliche View
--    intensivwoche_kurse_mit_anmeldungen (security_invoker='true') liest intern von dieser
--    Tabelle, um die Teilnehmerzahl je Kurs zu aggregieren, und laeuft dabei mit den Rechten des
--    Aufrufers -- ohne den Tabellen-Grant wirft die View einen harten
--    "permission denied"-Fehler und die gesamte oeffentliche Kursliste faellt aus (waehrend der
--    lokalen Browser-Verifikation dieser Migration entdeckt). Da fuer anon keine RLS-Policy auf
--    dieser Tabelle existiert, sieht anon ueber den SELECT-Grant hinaus ohnehin keine einzelnen
--    Zeilen (kein PII-Leck) -- das ist ein vorbestehendes, von dieser Migration unabhaengiges
--    Verhalten (die Teilnehmerzahl duerfte fuer anon schon vor dieser Migration stets 0 gewesen
--    sein) und wird hier bewusst nicht mitbehoben.
-- ============================================================================

REVOKE REFERENCES, DELETE, TRIGGER, TRUNCATE, MAINTAIN, UPDATE
  ON TABLE public.intensivwoche_anmeldungen FROM anon;

REVOKE REFERENCES, TRIGGER, TRUNCATE, MAINTAIN
  ON TABLE public.intensivwoche_anmeldungen FROM authenticated;

COMMENT ON TABLE public.intensivwoche_anmeldungen IS 'Öffentliche Anmeldungen für Intensivwochen-Kurse. Schreibzugriff ausschließlich über die SECURITY DEFINER Funktion book_intensivwoche_kurs(); RLS erlaubt SELECT/UPDATE/DELETE nur für Admins (is_admin()). anon behält nur SELECT (für die aggregierende, security_invoker View intensivwoche_kurse_mit_anmeldungen) — mangels RLS-Policy sieht anon dabei keine einzelnen Zeilen.';
