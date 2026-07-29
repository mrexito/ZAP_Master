-- Restores the 12 school_holiday_weeks rows that the 29.07.2026 baseline reset dropped: the new
-- schema-only baseline (20260729180000_live_schema_baseline_2026_07_29.sql) replaced 56
-- migrations, including
-- supabase/legacy-migrations/20260728091000_seed_school_holiday_weeks.sql, which originally
-- seeded this table (its accompanying schema migration, 20260728090000_school_holiday_weeks_schema.sql,
-- is already part of the live schema captured in the new baseline, so only the INSERT needs
-- restoring here). Reference data used by the admin course-scheduling UI
-- (lib/kurse/fixed-school-schedule.ts) -- identical on every environment, not a local-only
-- supabase/seed.sql fixture. Values copied unchanged.
INSERT INTO public.school_holiday_weeks (school_year, schedule_group, holiday_type, location, calendar_weeks)
VALUES
  ('2026/27', 'langzeitgymi', 'intensiv', 'Zürich HB', ARRAY[7, 8]),
  ('2026/27', 'langzeitgymi', 'intensiv', 'Winterthur', ARRAY[6, 7]),
  ('2026/27', 'kurzzeitgymi', 'intensiv', 'Zürich HB', ARRAY[7, 8]),
  ('2026/27', 'kurzzeitgymi', 'intensiv', 'Winterthur', ARRAY[6, 7]),
  ('2026/27', 'bms', 'intensiv', 'Zürich HB', ARRAY[7, 8]),
  ('2026/27', 'bms', 'intensiv', 'Winterthur', ARRAY[6, 7]),
  ('2026/27', 'matura', 'intensiv', 'Zürich HB', ARRAY[6, 7]),
  ('2026/27', '4', 'vorkurs', 'ALL', ARRAY[10, 11, 13, 14, 15, 16, 20, 21, 22, 23, 24, 25, 26]),
  ('2026/27', '5', 'vorkurs', 'ALL', ARRAY[20, 21, 22, 23, 24, 25, 26, 27]),
  ('2026/27', '1-sek', 'vorkurs', 'ALL', ARRAY[20, 21, 22, 23, 24, 25, 26, 27]),
  ('2026/27', '6', 'vorkurs', 'ALL', ARRAY[36, 37, 38, 39, 40, 43, 44, 45, 46, 47, 48, 49, 50, 1, 2, 3, 4, 5, 6]),
  ('2026/27', '2-3-sek', 'vorkurs', 'ALL', ARRAY[36, 37, 38, 39, 40, 43, 44, 45, 46, 47, 48, 49, 50, 1, 2, 3, 4, 5, 6])
ON CONFLICT (school_year, schedule_group, holiday_type, location) DO NOTHING;
