-- Restores the offers catalog (20 stable audience_id/kurstyp/slug rows) that the
-- 29.07.2026 baseline reset dropped: the new schema-only baseline
-- (20260729180000_live_schema_baseline_2026_07_29.sql) replaced 56 migrations, including
-- supabase/legacy-migrations/20260721074103_seed_offer_catalog.sql, which originally seeded this
-- table. That file's own header explains why this belongs in a migration and not
-- supabase/seed.sql: offers is deterministic reference data, identical on every environment
-- (local/staging/live), not a local-only synthetic fixture. Values copied unchanged from the
-- archived migration; offer_editions depends on these rows via (audience_id, kurstyp, slug)
-- lookups in the next migration.
insert into public.offers (audience_id, kurstyp, slug) values
  ('4', 'halbjahreskurs', 'halbjahreskurs'),
  ('4', 'intensivkurs', 'lerncamp-sportferien'),
  ('5', 'halbjahreskurs', 'halbjahreskurs'),
  ('5', 'intensivkurs', 'lerncamp-sportferien'),
  ('6', 'intensivkurs', 'intensivkurs-sportferien'),
  ('6', 'halbjahreskurs', 'halbjahreskurs'),
  ('6', 'pruefungssimulation', 'pruefungssimulation'),
  ('6', 'selbststudium', 'selbststudium'),
  ('1-sek', 'halbjahreskurs', 'vorkurs'),
  ('1-sek', 'intensivkurs', 'lerncamp-sportferien'),
  ('2-3-sek', 'intensivkurs', 'intensivkurs-sportferien'),
  ('2-3-sek', 'halbjahreskurs', 'halbjahreskurs'),
  ('2-3-sek', 'pruefungssimulation', 'pruefungssimulation'),
  ('2-3-sek', 'selbststudium', 'selbststudium'),
  ('bms', 'halbjahreskurs', 'halbjahreskurs'),
  ('bms', 'intensivkurs', 'intensivkurs'),
  ('bms', 'pruefungssimulation', 'pruefungssimulation'),
  ('bms', 'selbststudium', 'selbststudium'),
  ('matura', 'halbjahreskurs', 'halbjahreskurs'),
  ('matura', 'intensivkurs', 'intensivwoche')
on conflict (audience_id, kurstyp, slug) do nothing;
