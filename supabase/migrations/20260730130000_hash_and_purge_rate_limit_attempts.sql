-- Abschnitt 10.4 (Datenschutz und Aufbewahrung): data-retention-runbook.md dokumentiert zwei
-- offene Luecken bei intensivwoche_buchungsversuche (Tabellenkommentar der Baseline: "Wird bewusst
-- nicht automatisch bereinigt (Phase B); kuenftiges Pruning ist ein separater, additiver Schritt"):
-- (1) die Rate-Limit-Zeilen speichern die Klartext-E-Mail statt einer gehashten Kennung, (2) es
-- gibt keinen automatischen Purge. Diese Migration behebt beide additiv, ohne neue Infrastruktur
-- (kein pg_cron/externer Scheduler). Der Rate-Limiter zaehlt weiterhin pro E-Mail-Adresse -- eine
-- Umstellung auf eine IP-/Netzwerk-basierte Kennung waere eine groessere, separate
-- Design-Entscheidung mit eigenen Tradeoffs (NAT/Shared-IP-Familien, VPNs) und ist nicht Teil
-- dieser Migration -- ersetzt aber die Klartext-Spalte durch einen SHA-256-Hash und entfernt bei
-- jedem Aufruf opportunistisch Zeilen, die aelter als das Rate-Limit-Fenster sind.

-- 1) Hash-Spalte ergaenzen, bestehende (kurzlebige) Zeilen migrieren, Klartext entfernen.
alter table public.intensivwoche_buchungsversuche
  add column email_hash text;

update public.intensivwoche_buchungsversuche
  set email_hash = encode(extensions.digest(lower(trim(parent_email)), 'sha256'), 'hex')
  where email_hash is null;

alter table public.intensivwoche_buchungsversuche
  alter column email_hash set not null;

drop index if exists public.idx_buchungsversuche_email_time;

alter table public.intensivwoche_buchungsversuche
  drop column parent_email;

create index idx_buchungsversuche_email_hash_time
  on public.intensivwoche_buchungsversuche using btree (email_hash, attempted_at);

comment on table public.intensivwoche_buchungsversuche is
  'Zähl-Log für den Rate-Limiter in book_intensivwoche_kurs() (max. 5 Versuche / 10 Minuten je '
  'E-Mail-Hash). Nur über die SECURITY DEFINER Funktion beschrieben/gelesen, RLS ohne Policies, '
  'keine Grants an anon/authenticated. Speichert seit '
  '20260730130000_hash_and_purge_rate_limit_attempts einen SHA-256-Hash statt der Klartext-E-Mail '
  '(data-retention-runbook.md); Zeilen älter als das Rate-Limit-Fenster werden bei jedem '
  'Funktionsaufruf opportunistisch gelöscht (kein pg_cron/Scheduler nötig).';

-- 2) book_intensivwoche_kurs() auf den Hash umstellen und um den opportunistischen Purge ergaenzen.
-- Unveraendert gegenueber der Baseline: Signatur, Rueckgabetyp, restliche Geschaeftslogik (Sperre,
-- Kapazitaet, Doppelanmeldung, Fruehbucherrabatt, Idempotenz). CREATE OR REPLACE behaelt bestehende
-- GRANTs (anon/authenticated/service_role) unveraendert bei. Fester leerer search_path bleibt
-- bestehen -- extensions.digest() deshalb vollstaendig schemaqualifiziert (anders als
-- gen_random_uuid(), das seit PG13 in pg_catalog liegt und deshalb ohne Praefix funktioniert).
create or replace function public.book_intensivwoche_kurs(
  p_kurs_id bigint,
  p_child_firstname text,
  p_child_lastname text,
  p_child_class_level text,
  p_child_gender text,
  p_parent_email text,
  p_parent_phone text,
  p_notes text default null::text,
  p_idempotency_key uuid default null::uuid
) returns uuid
    language plpgsql security definer
    set search_path to ''
    as $$
DECLARE
  v_kurs RECORD;
  v_belegt INTEGER;
  v_email TEXT := lower(trim(p_parent_email));
  v_email_hash TEXT;
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

  v_email_hash := encode(extensions.digest(v_email, 'sha256'), 'hex');

  -- Opportunistischer Purge statt pg_cron/Scheduler: laeuft bei jedem Buchungsversuch mit, loescht
  -- Zeilen weit ausserhalb des 10-Minuten-Rate-Limit-Fensters (data-retention-runbook.md).
  DELETE FROM public.intensivwoche_buchungsversuche
  WHERE attempted_at < now() - interval '1 day';

  SELECT count(*) INTO v_versuche_count
  FROM public.intensivwoche_buchungsversuche
  WHERE email_hash = v_email_hash
    AND attempted_at > now() - interval '10 minutes';

  IF v_versuche_count >= 5 THEN
    RAISE EXCEPTION 'rate_limit_exceeded' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.intensivwoche_buchungsversuche (email_hash) VALUES (v_email_hash);

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

comment on function public.book_intensivwoche_kurs(p_kurs_id bigint, p_child_firstname text, p_child_lastname text, p_child_class_level text, p_child_gender text, p_parent_email text, p_parent_phone text, p_notes text, p_idempotency_key uuid) is
  'Einzige zulässige Schreibstelle für Kursanmeldungen. Sperrt den Kurs (FOR UPDATE), prüft '
  'Rate-Limit (5/10min je gehashter E-Mail, mit opportunistischem Purge alter Versuche älter als '
  '1 Tag)/Aktivität/Kapazität/familienfähige Doppelanmeldung atomar, unterstützt idempotente '
  'Wiederholungen über idempotency_key, berechnet automatisch 10% Frühbucherrabatt bei Anmeldung '
  '>=6 Wochen vor Kursstart und schreibt den Preis-Snapshot. Fester leerer search_path, SECURITY '
  'DEFINER.';
