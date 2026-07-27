-- Admin-Maske Schritt 10a (Migration 20260721074103_seed_offer_catalog.sql,
-- 20260721074500_offer_editions_admin_writes.sql). Prueft: die 20 Referenz-Angebote sind
-- vollstaendig und eindeutig, die neuen Admin-INSERT/UPDATE-Policies verlangen is_admin() (nicht
-- bloss is_content_manager()), audit_log-Inserts duerfen den actor_user_id nicht faelschen, und
-- die serverseitige Optimistic-Concurrency-Versionierung laesst sich vom Client nicht
-- ueberschreiben.
--
-- Hinweis zur Teststrategie (konsistent mit 0001-0008): pgTAP laeuft hier als Tabellenbesitzer und
-- umgeht damit RLS grundsaetzlich -- ein tatsaechlicher "als Nicht-Admin eingeloggter Nutzer wird
-- abgelehnt"-Test waere deshalb ein Test des Test-Setups, nicht der Policy. Admin-Gating wird daher
-- wie in den bestehenden Dateien ueber Policy-Existenz/-qual (pg_policies) geprueft; die
-- Versionierungs-Trigger sind dagegen normale BEFORE-UPDATE-Trigger und laufen rollenunabhaengig,
-- deshalb dafuer ein echter Verhaltenstest.

begin;

select plan(8);

-- 1) Alle 20 Referenz-Angebote aus der Admin-Maske sind vorhanden und eindeutig.
select is(
    (select count(*)::int from public.offers),
    20,
    'genau 20 stabile Angebote sind ueber die Katalog-Migration angelegt'
);

select is(
    (select count(distinct (audience_id, kurstyp, slug))::int from public.offers),
    20,
    'alle 20 Angebote sind eindeutig (audience_id, kurstyp, slug)'
);

select ok(
    exists (select 1 from public.offers where audience_id = '5' and kurstyp = 'intensivkurs' and slug = 'lerncamp-sportferien'),
    '5. Klasse Lerncamp (Preiskonflikt-Angebot) ist Teil der Katalog-Migration'
);

-- 2) offer_editions/course_sessions: INSERT/UPDATE-Policies verlangen is_admin(), nicht nur
--    is_content_manager() (Abschnitt 2.12: Preisaenderung/Publizieren sind admin-only).
select ok(
    (select count(*)::int from pg_policies
      where schemaname = 'public' and tablename = 'offer_editions'
        and cmd in ('INSERT', 'UPDATE')
        and coalesce(qual, '') || coalesce(with_check, '') like '%is_admin%') = 2,
    'offer_editions INSERT- und UPDATE-Policy verlangen is_admin()'
);

select ok(
    (select count(*)::int from pg_policies
      where schemaname = 'public' and tablename = 'course_sessions'
        and cmd in ('INSERT', 'UPDATE')
        and coalesce(qual, '') || coalesce(with_check, '') like '%is_admin%') = 2,
    'course_sessions INSERT- und UPDATE-Policy verlangen is_admin()'
);

-- 3) audit_log: INSERT-Policy verlangt is_admin() UND actor_user_id = auth.uid() (kein Spoofen).
select ok(
    exists (
        select 1 from pg_policies
         where schemaname = 'public' and tablename = 'audit_log' and cmd = 'INSERT'
           and with_check like '%is_admin%' and with_check like '%actor_user_id%auth.uid%'
    ),
    'audit_log INSERT-Policy verlangt is_admin() und actor_user_id = auth.uid()'
);

-- 4) Optimistic-Concurrency-Trigger: version/updated_at werden serverseitig erzwungen, ein vom
--    Client mitgeschickter Wert wird ueberschrieben.
with fixture_offer as (
    select id from public.offers where audience_id = 'matura' and kurstyp = 'halbjahreskurs'
), fixture_edition as (
    insert into public.offer_editions
        (offer_id, school_year, public_title, tagline, description, regular_price_rappen, status)
    select id, '2029/30', 'pgTAP Version Test', 'Tagline', 'Beschreibung', 100000, 'draft'
      from fixture_offer
    returning id, version
)
select set_config('pgtap.version_edition_id', (select id::text from fixture_edition), true);

select is(
    (select version from public.offer_editions where id = current_setting('pgtap.version_edition_id')::uuid),
    1,
    'neue Edition startet bei version = 1'
);

-- Client versucht, version direkt auf 999 zu faelschen -- der Trigger ignoriert das und zaehlt
-- stattdessen strikt von der zuletzt gespeicherten version hoch.
update public.offer_editions
   set public_title = 'pgTAP Version Test (geaendert)', version = 999
 where id = current_setting('pgtap.version_edition_id')::uuid;

select is(
    (select version from public.offer_editions where id = current_setting('pgtap.version_edition_id')::uuid),
    2,
    'UPDATE erhoeht version serverseitig um genau 1, ignoriert vom Client gesetzten Wert (999)'
);

-- Kein created_at/updated_at-Vergleich hier: beide verwenden now() (Transaktionszeit, konsistent
-- mit dem bestehenden update_updated_at_column()-Trigger auf intensivwoche_kurse), und pgTAP
-- wrappt diese ganze Datei in eine Transaktion -- ein Diff waere ein Test des Testaufbaus, nicht
-- der Funktion. Der Versionssprung oben beweist bereits, dass der Trigger tatsaechlich feuert.

select * from finish();

rollback;
