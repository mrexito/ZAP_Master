-- Behebt eine reale Regression in intensivwoche_kurse_mit_anmeldungen (security_invoker='true',
-- eingefuehrt in Migration 014 / 20260719133741_live_schema_baseline.sql als RLS-Haertung):
-- aktuelle_teilnehmer/status zeigen fuer anon (und jede Rolle ohne direkten Zeilenzugriff auf
-- intensivwoche_anmeldungen) IMMER 0 Buchungen bzw. den niedrigsten Auslastungsstatus, unabhaengig
-- von der echten Belegung.
--
-- Ursache: Migration 20260719190025_booking_hardening_phase_a.sql gewaehrt anon bewusst ein
-- Tabellen-GRANT SELECT auf intensivwoche_anmeldungen "für die aggregierende, security_invoker
-- View ... -- mangels RLS-Policy sieht anon dabei keine einzelnen Zeilen" (siehe Kommentar dort).
-- Die Absicht war: anon sieht die AGGREGIERTE Buchungszahl, aber keine einzelnen Zeilen. Da
-- security_invoker=true die interne "LEFT JOIN ... GROUP BY kurs_id"-Teilabfrage der View jedoch
-- ebenfalls der RLS des aufrufenden Codes unterwirft, und RLS fuer anon (mangels Policy) ALLE
-- Zeilen herausfiltert, liefert dieser Join fuer anon grundsaetzlich keine Zeilen zurueck -- die
-- Aggregation zaehlt buchstaeblich nichts, nicht nur anonymisiert. Per Direktabgleich reproduziert:
-- `SET ROLE anon; SELECT * FROM intensivwoche_kurse_mit_anmeldungen` zeigt aktuelle_teilnehmer=0
-- fuer einen Kurs mit echten, nicht stornierten Buchungen; per SQL/psql als Superuser oder
-- service_role ist derselbe Kurs korrekt "ausgebucht". Betrifft jede oeffentliche Verfuegbarkeits-
-- anzeige (u.a. lib/kurse/availability.ts, Abschnitt 7 Punkt 2, sowie /kurse) -- anonyme
-- Besucher:innen sahen bislang immer mehr freie Plaetze als tatsaechlich vorhanden.
--
-- Fix: eine schmale SECURITY DEFINER-Funktion liefert AUSSCHLIESSLICH die aggregierte Anzahl
-- nicht stornierter Anmeldungen pro Kurs (keine Zeilen/Personendaten) und ersetzt damit den
-- RLS-abhaengigen Join. Die View bleibt weiterhin security_invoker=true (schuetzt weiterhin jede
-- andere Spalte/jeden anderen Join korrekt per Aufrufer-RLS); nur die Zaehlung wird bewusst per
-- Definer-Rechten berechnet, exakt wie bereits bei book_intensivwoche_kurs() etabliert.

CREATE FUNCTION public.count_active_anmeldungen(p_kurs_id bigint)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT count(*)
  FROM public.intensivwoche_anmeldungen
  WHERE kurs_id = p_kurs_id
    AND status <> 'storniert';
$$;

REVOKE ALL ON FUNCTION public.count_active_anmeldungen(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_active_anmeldungen(bigint) TO anon, authenticated;

COMMENT ON FUNCTION public.count_active_anmeldungen(bigint) IS 'Liefert ausschliesslich die Anzahl nicht stornierter Anmeldungen fuer einen Kurs (kein Zeilenzugriff/keine Personendaten). SECURITY DEFINER mit festem leeren search_path, damit intensivwoche_kurse_mit_anmeldungen fuer anon/authenticated eine korrekte Aggregatzahl liefert, ohne einzelne Anmeldungszeilen offenzulegen (Fix fuer die RLS-bedingte 0-Zaehlung unter security_invoker=true).';

CREATE OR REPLACE VIEW public.intensivwoche_kurse_mit_anmeldungen WITH (security_invoker='true') AS
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
   FROM public.intensivwoche_kurse k
   CROSS JOIN LATERAL ( SELECT public.count_active_anmeldungen(k.id) AS anzahl_anmeldungen ) a;

COMMENT ON VIEW public.intensivwoche_kurse_mit_anmeldungen IS 'Oeffentliche Kursuebersicht mit aggregierter Belegung. security_invoker=true schuetzt alle Spalten/Joins korrekt per Aufrufer-RLS; aktuelle_teilnehmer/status werden bewusst ueber die SECURITY DEFINER-Funktion count_active_anmeldungen() berechnet, damit anon/authenticated eine korrekte Aggregatzahl sehen, ohne je eine einzelne intensivwoche_anmeldungen-Zeile lesen zu koennen.';
