-- Verknüpft Übungen mit derselben siebenstufigen Klassennavigation wie Lernmaterialien.
--
-- Die acht bestehenden Aufgaben stammen aus dem bisherigen Langgymnasium-ZAP-Bestand
-- und werden deshalb der 6. Klasse zugeordnet. Neue Übungen müssen ihre Zielklassen
-- explizit angeben; ein stiller Default würde Inhalte sonst in falschen Bereichen zeigen.

ALTER TABLE public.exercises
  ADD COLUMN class_levels text[] NOT NULL
  DEFAULT ARRAY['6. Klasse']::text[];

ALTER TABLE public.exercises
  ALTER COLUMN class_levels DROP DEFAULT;

ALTER TABLE public.exercises
  ADD CONSTRAINT exercises_class_levels_check
  CHECK (
    cardinality(class_levels) > 0
    AND class_levels <@ ARRAY[
      '4. Klasse',
      '5. Klasse',
      '6. Klasse',
      '1. Sek',
      '2. Sek',
      '3. Sek',
      'Gymnasium'
    ]::text[]
  );

CREATE INDEX idx_exercises_class_levels
  ON public.exercises
  USING gin (class_levels);

COMMENT ON COLUMN public.exercises.class_levels IS
  'Mindestens eine der sieben Klassenstufen aus der Login-Navigation; steuert den Übungsfilter.';
