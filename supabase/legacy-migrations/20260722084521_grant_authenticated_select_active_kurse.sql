-- Real gefundene Regression, entdeckt beim Accessibility-Audit des geschuetzten Buchungsflows
-- (Abschnitt 10.4): die einzige SELECT-Policy fuer aktive Kurse auf public.intensivwoche_kurse ist
-- `anon_select_active_kurse ON ... FOR SELECT TO anon USING (ist_aktiv = true)`
-- (supabase/migrations/20260719133741_live_schema_baseline.sql) -- ausdruecklich nur TO anon, NICHT
-- TO authenticated. Die einzige SELECT-Policy fuer die Rolle `authenticated` ist
-- `lehrperson_select_own_kurse`, die zusaetzlich `is_content_manager() AND is_kurs_owner(created_by)`
-- verlangt.
--
-- Folge: sobald ein normaler Nutzer ("user"-Rolle) sich einloggt, VERLIERT er den anonymen
-- Lesezugriff auf aktive Kurse, den er als Gast noch hatte -- /intensivkurse (geschuetzte Seite,
-- app/(dashboard)/intensivkurse/page.tsx, nutzt createAuthenticatedSupabaseClient) zeigt fuer jeden
-- eingeloggten Nicht-Lehrperson-Nutzer "0 Kurse gefunden", unabhaengig von echten Daten -- die
-- security_invoker=true View intensivwoche_kurse_mit_anmeldungen (Migration 014) erbt exakt diese
-- Basis-Tabellen-RLS. Reproduziert: `SET ROLE authenticated; SELECT * FROM intensivwoche_kurse WHERE
-- ist_aktiv = true;` liefert 0 Zeilen fuer einen Nicht-Owner.
--
-- Fix: dieselbe "aktive Kurse sind oeffentlich lesbar"-Regel zusaetzlich fuer TO authenticated
-- ergaenzen -- keine Rechteausweitung, da genau dieselben Zeilen bereits ueber anon lesbar sind;
-- schliesst nur die Luecke, dass eingeloggte Nutzer schlechter gestellt waren als Gaeste.
create policy authenticated_select_active_kurse
  on public.intensivwoche_kurse
  for select
  to authenticated
  using (ist_aktiv = true);
