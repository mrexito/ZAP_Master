-- Admin-editierbare Ferienwochen fuer die Intensivkurs-/Vorkurs-Terminierung. Loest, dass die
-- Kalenderwochen bisher als TS-Konstanten in lib/kurse/fixed-school-schedule.ts hart codiert waren
-- (INTENSIVE_WEEKS_BY_GROUP, VORKURS_CALENDAR_WEEKS_BY_GROUP, MATURA_INTENSIVE_WEEKS) -- eine
-- Verschiebung z.B. der Fruehlingsferien (KW 17/18 im Normalfall, KW 16/17 wenn Ostermontag in
-- KW 16 faellt) haette bisher einen Code-Release erfordert. Bewusst kein neues
-- "Ferienperioden"-Konzept mit automatischer Ableitung der Vorkurs-Wochenliste (Nutzerentscheidung):
-- die bisherigen Arrays wandern unveraendert als Werte in diese Tabelle.
--
-- 'location' nutzt den Sentinel-Wert 'ALL' statt NULL fuer den standortunabhaengigen Vorkurs-Typ --
-- Postgres behandelt mehrere NULLs im selben UNIQUE-Constraint als paarweise verschieden, ein
-- zweiter Vorkurs-Eintrag mit location=NULL wuerde den Constraint sonst nicht verletzen.
--
-- schedule_group deckt zwei unterschiedliche Granularitaeten ab: fuer holiday_type='intensiv'
-- weiterhin die vier Gruppen (mehrere Klassenstufen teilen sich denselben Sportferien-Fixplan);
-- fuer holiday_type='vorkurs' dagegen einzelne Klassenstufen-IDs -- reale Daten zeigen, dass sich
-- z.B. 4. und 5. Klasse trotz gleicher 'langzeitgymi'-Gruppe in ihren Vorkurs-Wochen unterscheiden
-- (4. Klasse startet im Herbst mit anderem KW-Raster als 5. Klasse). Keine gemeinsame CHECK-Kopplung
-- von schedule_group an holiday_type, um die Liste nicht doppelt pflegen zu muessen.
CREATE TABLE public.school_holiday_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_year text NOT NULL,
  schedule_group text NOT NULL
    CHECK (schedule_group IN (
      'langzeitgymi', 'kurzzeitgymi', 'bms', 'matura', '4', '5', '6', '1-sek', '2-3-sek'
    )),
  holiday_type text NOT NULL CHECK (holiday_type IN ('vorkurs', 'intensiv')),
  location text NOT NULL DEFAULT 'ALL'
    CHECK (location IN ('Zürich HB', 'Winterthur', 'ALL')),
  calendar_weeks integer[] NOT NULL CHECK (cardinality(calendar_weeks) > 0),
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_year, schedule_group, holiday_type, location)
);

ALTER TABLE public.school_holiday_weeks ENABLE ROW LEVEL SECURITY;

-- Oeffentlich lesbar: unsensible Referenzdaten, werden von der oeffentlichen Kurstabelle
-- (WeekFilter/SessionTable ueber lib/kurse/catalog.ts) fuer alle Besucher gelesen.
CREATE POLICY school_holiday_weeks_public_read
  ON public.school_holiday_weeks FOR SELECT
  TO anon, authenticated
  USING (true);

-- Schreiben nur Admin -- gleiches Muster wie offer_editions_admin_insert/_update
-- (20260721074500_offer_editions_admin_writes.sql). Kein DELETE: eine nicht mehr benoetigte Zeile
-- wird durch UPSERT mit neuen Wochen ersetzt, nicht geloescht (vermeidet ein Jahr ohne jede Zeile).
GRANT INSERT, UPDATE ON TABLE public.school_holiday_weeks TO authenticated;

CREATE POLICY school_holiday_weeks_admin_insert
  ON public.school_holiday_weeks FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY school_holiday_weeks_admin_update
  ON public.school_holiday_weeks FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON TABLE public.school_holiday_weeks IS 'Admin-pflegbare Kalenderwochen fuer die automatische Intensivkurs-/Vorkurs-Terminierung (ersetzt hart codierte TS-Konstanten in lib/kurse/fixed-school-schedule.ts). Oeffentlich lesbar, Schreibzugriff nur is_admin().';
