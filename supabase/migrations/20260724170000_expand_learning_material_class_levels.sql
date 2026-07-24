-- Vereinheitlicht die Klassenstufen der Login-/Materialnavigation.
--
-- Die bisherigen Spalten waren bereits text/text[] und konnten die neuen Werte technisch
-- speichern. learning_materials hatte jedoch noch den historischen Default
-- ['5. Klasse', '6. Klasse']; direkte Inserts ohne Klassenangabe wurden dadurch unbemerkt
-- beiden Stufen zugeordnet. Künftig ist mindestens eine explizite, gültige Stufe erforderlich.

UPDATE public.profiles
SET class_level = CASE lower(trim(class_level))
  WHEN '' THEN NULL
  WHEN '4' THEN '4. Klasse'
  WHEN '4. klasse' THEN '4. Klasse'
  WHEN '5' THEN '5. Klasse'
  WHEN '5. klasse' THEN '5. Klasse'
  WHEN '6' THEN '6. Klasse'
  WHEN '6. klasse' THEN '6. Klasse'
  WHEN '7' THEN '1. Sek'
  WHEN '7. klasse (sek)' THEN '1. Sek'
  WHEN '1. sek' THEN '1. Sek'
  WHEN '8' THEN '2. Sek'
  WHEN '8. klasse (sek)' THEN '2. Sek'
  WHEN '2. sek' THEN '2. Sek'
  WHEN '9' THEN '3. Sek'
  WHEN '9. klasse (sek)' THEN '3. Sek'
  WHEN '3. sek' THEN '3. Sek'
  WHEN 'gym' THEN 'Gymnasium'
  WHEN 'gymnasium' THEN 'Gymnasium'
  WHEN 'andere' THEN 'other'
  WHEN 'other' THEN 'other'
  ELSE class_level
END
WHERE class_level IS NOT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_class_level_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_class_level_check
  CHECK (
    class_level IS NULL
    OR class_level = ANY (
      ARRAY[
        '4. Klasse',
        '5. Klasse',
        '6. Klasse',
        '1. Sek',
        '2. Sek',
        '3. Sek',
        'Gymnasium',
        'other'
      ]::text[]
    )
  );

ALTER TABLE public.learning_materials
  ALTER COLUMN class_levels DROP DEFAULT,
  ALTER COLUMN class_levels SET NOT NULL;

ALTER TABLE public.learning_materials
  DROP CONSTRAINT IF EXISTS learning_materials_class_levels_check;

ALTER TABLE public.learning_materials
  ADD CONSTRAINT learning_materials_class_levels_check
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

COMMENT ON COLUMN public.profiles.class_level IS
  'Aktuelle Klassenstufe: 4.–6. Klasse, 1.–3. Sek, Gymnasium oder other.';

COMMENT ON COLUMN public.learning_materials.class_levels IS
  'Mindestens eine explizite Klassenstufe für Navigation und Materialfilter; kein impliziter Default.';
