-- E-Mail-Outbox (Abschnitt 10.4: "Eine Buchung gilt nicht wegen erfolgreichem Mailversand als
-- gespeichert. Bestätigungsmails laufen idempotent über Outbox/Retry, enthalten keine unnötigen
-- personenbezogenen Daten und machen dauerhafte Zustellfehler im Admin sichtbar.").
--
-- Architekturentscheidung: mail_outbox speichert bewusst NUR eine Referenz auf die Anmeldung
-- (anmeldung_id) plus Versand-/Retry-Metadaten -- keine Kopie von Name/E-Mail/Telefon/Notizen.
-- Die tatsaechlichen Inhalte fuer den Versand werden erst zum Sendezeitpunkt per JOIN aus
-- intensivwoche_anmeldungen/intensivwoche_kurse gelesen (lib/mail/dispatch-outbox.ts). Das
-- vermeidet eine zweite, unabhaengig zu pflegende Kopie personenbezogener Daten mit eigener
-- Aufbewahrungsfrist.
--
-- Ein AFTER-INSERT-Trigger auf intensivwoche_anmeldungen erzeugt die Outbox-Zeile automatisch --
-- unabhaengig davon, ob eine Anmeldung ueber book_intensivwoche_kurs() oder einen kuenftigen
-- zweiten Schreibpfad entsteht, und ohne die bereits gehaertete RPC-Funktion selbst anzufassen.
-- Der Unique-Index (anmeldung_id, template_key) macht ein wiederholtes Enqueuen fuer dieselbe
-- Anmeldung idempotent (ON CONFLICT DO NOTHING).

CREATE TABLE public.mail_outbox (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    anmeldung_id uuid NOT NULL REFERENCES public.intensivwoche_anmeldungen(id) ON DELETE CASCADE,
    template_key text NOT NULL DEFAULT 'booking_confirmation',
    status text NOT NULL DEFAULT 'pending',
    attempts integer NOT NULL DEFAULT 0,
    max_attempts integer NOT NULL DEFAULT 5,
    last_error text,
    provider_message_id text,
    next_attempt_at timestamp with time zone NOT NULL DEFAULT now(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    sent_at timestamp with time zone,
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT mail_outbox_status_check CHECK (status IN ('pending', 'sent', 'failed')),
    CONSTRAINT mail_outbox_attempts_non_negative CHECK (attempts >= 0),
    CONSTRAINT mail_outbox_unique_anmeldung_template UNIQUE (anmeldung_id, template_key)
);

COMMENT ON TABLE public.mail_outbox IS 'Idempotente Versand-/Retry-Warteschlange fuer Buchungsbestaetigungen (Abschnitt 10.4). Enthaelt bewusst keine Kopie von Name/E-Mail/Notizen -- nur eine Referenz auf intensivwoche_anmeldungen plus Versandstatus.';
COMMENT ON COLUMN public.mail_outbox.status IS 'pending: noch nicht (erfolgreich) versendet. sent: erfolgreich zugestellt (Provider hat angenommen). failed: max_attempts erreicht, braucht manuelle Pruefung im Admin.';
COMMENT ON COLUMN public.mail_outbox.next_attempt_at IS 'Fruehester Zeitpunkt fuer den naechsten Versandversuch (exponentielles Backoff durch lib/mail/dispatch-outbox.ts gesetzt), verhindert Retry-Sturm bei einem vorübergehenden Provider-Ausfall.';

ALTER TABLE public.mail_outbox ENABLE ROW LEVEL SECURITY;

-- Nur Admins duerfen die Warteschlange im Dashboard einsehen (dauerhafte Zustellfehler sichtbar
-- machen, Abschnitt 10.4). Schreibzugriff erfolgt ausschliesslich ueber den Enqueue-Trigger
-- (SECURITY DEFINER, siehe unten) bzw. den service_role-Dispatcher -- keine INSERT/UPDATE/DELETE-
-- Policies fuer anon/authenticated, da kein Client diese Tabelle je direkt beschreiben soll.
CREATE POLICY mail_outbox_admin_select ON public.mail_outbox
    FOR SELECT TO authenticated
    USING (public.is_admin());

CREATE FUNCTION public.enqueue_booking_confirmation_mail() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.mail_outbox (anmeldung_id, template_key)
  VALUES (NEW.id, 'booking_confirmation')
  ON CONFLICT (anmeldung_id, template_key) DO NOTHING;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enqueue_booking_confirmation_mail() IS 'Trigger-Funktion: legt nach jeder neuen intensivwoche_anmeldungen-Zeile automatisch eine mail_outbox-Zeile an. SECURITY DEFINER mit leerem search_path, damit der anon-Buchungspfad (book_intensivwoche_kurs) sie ohne zusaetzliche Grants ausloesen kann; ON CONFLICT DO NOTHING macht wiederholtes Feuern idempotent.';

CREATE TRIGGER intensivwoche_anmeldungen_enqueue_mail
    AFTER INSERT ON public.intensivwoche_anmeldungen
    FOR EACH ROW
    EXECUTE FUNCTION public.enqueue_booking_confirmation_mail();

COMMENT ON TRIGGER intensivwoche_anmeldungen_enqueue_mail ON public.intensivwoche_anmeldungen IS 'Erzeugt automatisch eine mail_outbox-Zeile fuer jede neue Anmeldung, unabhaengig vom Schreibpfad (aktuell nur book_intensivwoche_kurs()).';
