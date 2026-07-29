-- Restores the four material_areas lookup rows that the 29.07.2026 baseline reset dropped: the
-- new schema-only baseline (20260729180000_live_schema_baseline_2026_07_29.sql) replaced 56
-- migrations, including supabase/legacy-migrations/20260720140000_material_access_schema.sql,
-- which originally seeded this table (that same file's ALTER TABLE/CREATE INDEX for
-- learning_materials.area_id is already part of the live schema captured in the new baseline, so
-- only the INSERT needs restoring here). Pure lookup/reference data, identical on every
-- environment -- not a local-only supabase/seed.sql fixture. Values copied unchanged.
INSERT INTO public.material_areas (key, label) VALUES
  ('langzeitgymi', 'Langzeitgymi'),
  ('kurzgymi', 'Kurzgymi'),
  ('bms', 'BMS'),
  ('matura', 'Matura')
ON CONFLICT (key) DO NOTHING;
