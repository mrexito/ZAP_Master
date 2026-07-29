-- Sicherheitsfix (gefunden 29.07.2026 bei der Security-Advisor-Vertiefung): accept_mentorship_request()
-- verglich `v_request.target_id != auth.uid()` mit dem einfachen Ungleichheitsoperator. In PL/pgSQL wird
-- `IF <NULL-Ausdruck> THEN` wie FALSE behandelt -- für einen anonymen Aufruf (auth.uid() IS NULL, die
-- Funktion ist laut Advisor an `anon` UND `authenticated` gegrantet) ergab `target_id != NULL` NULL,
-- die RAISE EXCEPTION griff also nie, und die Funktion (SECURITY DEFINER, umgeht RLS) akzeptierte die
-- Anfrage trotzdem im Namen des echten Targets. Der Bug bestand unverändert seit der ursprünglichen
-- Erstellung (legacy-migrations/005_create_mentorship_tables.sql) und wurde vom früheren
-- search_path-Hardening (legacy-migrations/20260719145330_harden_definer_search_path_and_realtime.sql)
-- nicht mitgefangen, weil dort nur search_path/SECURITY DEFINER geprüft wurden, nicht die
-- Autorisierungslogik selbst.
--
-- Fix: `IS DISTINCT FROM` statt `!=` -- das behandelt NULL korrekt als "verschieden" und wirft die
-- Exception zuverlässig für nicht angemeldete UND für falsch angemeldete Aufrufer. Sonst unverändert
-- gegenüber der aktuellen Live-Definition (SECURITY DEFINER, fester leerer search_path).

CREATE OR REPLACE FUNCTION public.accept_mentorship_request(request_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_request RECORD;
  v_relation_id UUID;
  v_mentor_id UUID;
  v_mentee_id UUID;
  v_listing RECORD;
BEGIN
  SELECT * INTO v_request FROM public.mentorship_requests WHERE id = request_id AND status = 'PENDING';
  IF NOT FOUND THEN RAISE EXCEPTION 'Request nicht gefunden oder nicht mehr PENDING'; END IF;
  IF v_request.target_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Nur der Target kann die Anfrage akzeptieren'; END IF;
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
$function$;

COMMENT ON FUNCTION public.accept_mentorship_request(uuid) IS 'Akzeptiert eine PENDING mentorship_request und legt die zugehörige mentorship_relations-Zeile an. Nur der Ziel-User (target_id) darf akzeptieren -- IS DISTINCT FROM statt != verhindert, dass ein anonymer oder falsch angemeldeter Aufruf die NULL-Falle nutzt, um diese Prüfung zu umgehen. SECURITY DEFINER mit festem leerem search_path.';
