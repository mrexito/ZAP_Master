-- Schritt 10d (Abschnitt 2.15/3/6 des Architektur-Briefings): Finanz-Cockpit.
-- financial_events (idempotenter, append-only Reporting-Ledger), expense_entries,
-- financial_periods, budgets, financial_adjustments -- alle bisher nicht vorhanden (greenfield).
--
-- Kein Zahlungsanbieter integriert: "bezahlt" wird ausschliesslich aus
-- intensivwoche_anmeldungen.paid_at abgeleitet (kein echtes Payment-Ledger mit Teilzahlungen).
-- "Gebucht" kommt aus booked_price_rappen, "periodengerecht verdient" wird beim booking-Event auf
-- das Kursdatum (intensivwoche_kurse.start_datum) statt das Buchungsdatum gelegt.
--
-- Direkte Lohnkosten je Angebot kommen laut Abschnitt 2.15 explizit NICHT aus financial_events,
-- sondern direkt aus payroll_snapshot_lines (join ueber work_entries.session_id ->
-- course_sessions.edition_id -> offers) -- financial_events bekommt trotzdem einen aggregierten
-- payroll_cost-Eintrag pro Snapshot fuer den Jahresverlauf-Chart, damit RevenueCostChart eine
-- einzige Ledger-Quelle fuer Kosten UND Einnahmen hat.

-- ============================================================================
-- 1) financial_events: idempotenter Ledger (source_kind, source_id, event_type, event_version).
-- ============================================================================

CREATE TABLE public.financial_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (
    event_type IN ('booking', 'payment', 'refund', 'payroll_cost', 'course_expense', 'overhead', 'manual_adjustment')
  ),
  source_kind text NOT NULL,
  source_id text NOT NULL,
  event_version integer NOT NULL DEFAULT 1,
  amount_rappen integer NOT NULL, -- vorzeichenbehaftet: Einnahme +, Aufwand/Refund -
  currency text NOT NULL DEFAULT 'CHF',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  recognized_at timestamptz NOT NULL DEFAULT now(),
  edition_id uuid REFERENCES public.offer_editions(id),
  session_id bigint REFERENCES public.course_sessions(id),
  audience_id text,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_kind, source_id, event_type, event_version)
);

CREATE INDEX idx_financial_events_recognized_at ON public.financial_events (recognized_at);
CREATE INDEX idx_financial_events_edition_id ON public.financial_events (edition_id);

ALTER TABLE public.financial_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.financial_events FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.financial_events FROM authenticated;

CREATE POLICY financial_events_admin_read
  ON public.financial_events FOR SELECT
  TO authenticated
  USING (public.is_admin());

COMMENT ON TABLE public.financial_events IS 'Idempotenter, append-only Reporting-Ledger (Schritt 10d, Abschnitt 2.15). Wird ausschliesslich durch SECURITY-DEFINER-Trigger/RPCs befuellt (sync_anmeldung_financial_events, sync_expense_financial_event, sync_financial_adjustment_event, admin_close_payroll_period) -- kein direkter INSERT/UPDATE/DELETE fuer authenticated, admin liest nur.';

-- ============================================================================
-- 2) expense_entries: Raum/Material/Marketing/externe Leistungen/Betriebskosten.
-- ============================================================================

CREATE TABLE public.expense_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('room', 'material', 'marketing', 'external_service', 'overhead')),
  amount_rappen integer NOT NULL CHECK (amount_rappen > 0),
  currency text NOT NULL DEFAULT 'CHF',
  service_date date NOT NULL,
  edition_id uuid REFERENCES public.offer_editions(id),
  session_id bigint REFERENCES public.course_sessions(id),
  receipt_ref text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'cancelled')),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1
);

CREATE INDEX idx_expense_entries_service_date ON public.expense_entries (service_date);
CREATE INDEX idx_expense_entries_edition_id ON public.expense_entries (edition_id);

CREATE TRIGGER expense_entries_bump_version
  BEFORE UPDATE ON public.expense_entries
  FOR EACH ROW EXECUTE FUNCTION public.bump_version_and_updated_at();

ALTER TABLE public.expense_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.expense_entries FROM anon;

CREATE POLICY expense_entries_admin_all
  ON public.expense_entries FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON TABLE public.expense_entries IS 'Raum-/Material-/Marketing-/externe/Betriebskosten (Schritt 10d). Admin-only. status=approved spiegelt einmalig (ON CONFLICT DO NOTHING) einen course_expense/overhead-Eintrag nach financial_events -- spaetere Bearbeitung nach Genehmigung erzeugt keinen zweiten Ledger-Eintrag.';

-- ============================================================================
-- 3) financial_periods / budgets / financial_adjustments.
-- ============================================================================

CREATE TABLE public.financial_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL UNIQUE CHECK (year BETWEEN 2020 AND 2100),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'review', 'locked')),
  version integer NOT NULL DEFAULT 1,
  locked_at timestamptz,
  locked_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER financial_periods_bump_version
  BEFORE UPDATE ON public.financial_periods
  FOR EACH ROW EXECUTE FUNCTION public.bump_version_and_updated_at();

ALTER TABLE public.financial_periods ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.financial_periods FROM anon;

CREATE POLICY financial_periods_admin_all
  ON public.financial_periods FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TABLE public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.financial_periods(id),
  category text NOT NULL,
  amount_rappen integer NOT NULL CHECK (amount_rappen >= 0),
  currency text NOT NULL DEFAULT 'CHF',
  version integer NOT NULL DEFAULT 1,
  UNIQUE (period_id, category)
);

CREATE TRIGGER budgets_bump_version
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.bump_version_and_updated_at();

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.budgets FROM anon;

CREATE POLICY budgets_admin_all
  ON public.budgets FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TABLE public.financial_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.financial_periods(id),
  category text,
  amount_rappen integer NOT NULL,
  currency text NOT NULL DEFAULT 'CHF',
  reason text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_adjustments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.financial_adjustments FROM anon;

CREATE POLICY financial_adjustments_admin_all
  ON public.financial_adjustments FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON TABLE public.financial_periods IS 'Jaehrlicher Finanzabschluss-Status (Schritt 10d). Admin-only.';
COMMENT ON TABLE public.budgets IS 'Budget je Kategorie und Jahr (Schritt 10d). Admin-only.';
COMMENT ON TABLE public.financial_adjustments IS 'Auditierte manuelle Korrekturbuchung (Schritt 10d) -- spiegelt sich automatisch nach financial_events (event_type=manual_adjustment).';

-- ============================================================================
-- 4) Trigger: Buchung/Zahlung/Storno auf intensivwoche_anmeldungen spiegeln automatisch nach
--    financial_events. SECURITY DEFINER, weil auch anon (ueber book_intensivwoche_kurs()) und
--    Lehrpersonen Anmeldungen anlegen/aktualisieren koennen, aber financial_events fuer sie nicht
--    direkt beschreibbar sein darf.
-- ============================================================================

CREATE FUNCTION public.sync_anmeldung_financial_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.booked_price_rappen IS NOT NULL THEN
      INSERT INTO public.financial_events (
        event_type, source_kind, source_id, event_version, amount_rappen, occurred_at,
        recognized_at, edition_id, session_id, status
      )
      SELECT
        'booking', 'anmeldung', NEW.id::text, 1, NEW.booked_price_rappen, NEW.created_at,
        coalesce(k.start_datum::timestamptz, NEW.created_at), NEW.edition_id, NEW.session_id, 'confirmed'
        FROM public.intensivwoche_kurse k WHERE k.id = NEW.kurs_id
      ON CONFLICT (source_kind, source_id, event_type, event_version) DO NOTHING;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.paid_at IS NOT NULL AND OLD.paid_at IS NULL AND NEW.booked_price_rappen IS NOT NULL THEN
      INSERT INTO public.financial_events (
        event_type, source_kind, source_id, event_version, amount_rappen, occurred_at,
        recognized_at, edition_id, session_id, status
      )
      VALUES (
        'payment', 'anmeldung', NEW.id::text, 1, NEW.booked_price_rappen, NEW.paid_at,
        NEW.paid_at, NEW.edition_id, NEW.session_id, 'confirmed'
      )
      ON CONFLICT (source_kind, source_id, event_type, event_version) DO NOTHING;
    END IF;

    IF NEW.status = 'storniert' AND OLD.status IS DISTINCT FROM 'storniert' AND NEW.booked_price_rappen IS NOT NULL THEN
      INSERT INTO public.financial_events (
        event_type, source_kind, source_id, event_version, amount_rappen, occurred_at,
        recognized_at, edition_id, session_id, status
      )
      VALUES (
        'refund', 'anmeldung', NEW.id::text, 1, -NEW.booked_price_rappen, now(),
        now(), NEW.edition_id, NEW.session_id, 'confirmed'
      )
      ON CONFLICT (source_kind, source_id, event_type, event_version) DO NOTHING;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_anmeldung_financial_events() IS 'Spiegelt Buchung (INSERT), erste Zahlung (paid_at NULL->gesetzt) und Storno (status->storniert) automatisch als financial_events (Schritt 10d). Idempotent ueber ON CONFLICT DO NOTHING je fester event_version=1 -- ein zweites Update mit bereits gesetztem paid_at/status erzeugt keinen weiteren Eintrag.';

CREATE TRIGGER sync_anmeldung_financial_events_trigger
  AFTER INSERT OR UPDATE ON public.intensivwoche_anmeldungen
  FOR EACH ROW EXECUTE FUNCTION public.sync_anmeldung_financial_events();

-- ============================================================================
-- 5) Trigger: genehmigte expense_entries -> financial_events (course_expense/overhead).
-- ============================================================================

CREATE FUNCTION public.sync_expense_financial_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.financial_events (
      event_type, source_kind, source_id, event_version, amount_rappen, occurred_at,
      recognized_at, edition_id, session_id, status
    )
    VALUES (
      CASE WHEN NEW.category = 'overhead' THEN 'overhead' ELSE 'course_expense' END,
      'expense_entry', NEW.id::text, 1, -NEW.amount_rappen, NEW.service_date::timestamptz,
      NEW.service_date::timestamptz, NEW.edition_id, NEW.session_id, 'confirmed'
    )
    ON CONFLICT (source_kind, source_id, event_type, event_version) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_expense_financial_event() IS 'Spiegelt eine Ausgabe bei der ERSTEN Genehmigung nach financial_events (Schritt 10d); feste event_version=1 verhindert doppelte Ledger-Eintraege bei spaeterer Bearbeitung nach Genehmigung.';

CREATE TRIGGER sync_expense_financial_event_trigger
  AFTER INSERT OR UPDATE ON public.expense_entries
  FOR EACH ROW EXECUTE FUNCTION public.sync_expense_financial_event();

-- ============================================================================
-- 6) Trigger: financial_adjustments -> financial_events (manual_adjustment).
-- ============================================================================

CREATE FUNCTION public.sync_financial_adjustment_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  INSERT INTO public.financial_events (
    event_type, source_kind, source_id, event_version, amount_rappen, occurred_at, recognized_at, status
  )
  VALUES ('manual_adjustment', 'financial_adjustment', NEW.id::text, 1, NEW.amount_rappen, NEW.created_at, NEW.created_at, 'confirmed')
  ON CONFLICT (source_kind, source_id, event_type, event_version) DO NOTHING;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_financial_adjustment_event() IS 'Spiegelt jede manuelle Korrekturbuchung nach financial_events (Schritt 10d).';

CREATE TRIGGER sync_financial_adjustment_event_trigger
  AFTER INSERT ON public.financial_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.sync_financial_adjustment_event();
