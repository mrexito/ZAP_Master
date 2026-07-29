-- Additive Härtungsmigration nach der Baseline (20260719133741_live_schema_baseline.sql).
-- Behebt die beiden Lücken, die der lokale Gate-Lauf vom 19.07.2026 aufgedeckt hat
-- (supabase/tests/database/0002_security_definer_functions.sql und
-- 0004_realtime_publication.sql), noch nicht remote ausgerollt.
--
-- 1) Sieben SECURITY DEFINER-Funktionen hatten keinen festen search_path gesetzt (bekanntes
--    Postgres-Sicherheitsrisiko: search_path hijacking). Alle sieben referenzieren in ihrem
--    Funktionskörper ausschließlich schema-qualifizierte Objekte (public.*, auth.uid()) sowie
--    eingebaute Operatoren/Funktionen aus pg_catalog, das bei einem leeren search_path weiterhin
--    implizit durchsucht wird. Ein leerer search_path ist daher sicher und konsistent mit dem
--    bereits bestehenden Muster bei public.book_intensivwoche_kurs.
--
-- 2) Die Realtime-Publication-Zuordnung (`supabase_realtime` -> `public.chat_messages`) wird von
--    `pg_dump --schema-only` nicht mit exportiert (bekannte Tool-Lücke, siehe
--    step0Baseline.revision2.md, Abschnitt 10) und fehlte deshalb nach dem lokalen Reset. Auf der
--    Live-Datenbank ist diese Zuordnung dagegen laut Kataloglauf vom 18.07.2026 bereits vorhanden
--    (docs/migration-evidence/2026-07-18-supabase-baseline-inventory.md, Abschnitt 6) — ein
--    unbedingtes `ALTER PUBLICATION ... ADD TABLE` würde dort mit einem
--    "already member of publication"-Fehler die gesamte Migrationstransaktion scheitern lassen.
--    Deshalb per Existenzprüfung idempotent: lokal behebt es die Lücke, remote ist es ein No-op.

alter function public.accept_mentorship_request(uuid) set search_path to '';
alter function public.handle_new_user() set search_path to '';
alter function public.is_admin() set search_path to '';
alter function public.is_content_manager() set search_path to '';
alter function public.is_kurs_aktiv(bigint) set search_path to '';
alter function public.is_kurs_owner(uuid) set search_path to '';
alter function public.is_owner(uuid) set search_path to '';

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end
$$;
