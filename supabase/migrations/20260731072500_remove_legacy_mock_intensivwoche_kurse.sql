-- Entfernt reale intensivwoche_kurse-Zeilen, die dem alten, nicht mehr verwendeten Namensmuster
-- "<Fach> Intensiv – <Zeitraum> <Jahr>" folgen (identisch zum Muster der früheren
-- MOCK_KURSE-Fixtures in types/kurs.ts) und keinem Angebot auf den aktuellen Hauptseiten
-- entsprechen. Vom Nutzer für die konkret aufgeführten Zeilen bestätigt (Kursverwaltung,
-- 31.07.2026) -- kein pauschales Löschen aller "... Intensiv ..."-Kurse, da nicht abschliessend
-- geprüft werden konnte, ob weitere, fachlich noch gültige Kurse zufällig einem ähnlichen
-- Namensmuster folgen. Der `like`-Ausdruck für "Mathematik Intensiv – Sommer" deckt eine im
-- Admin-UI abgeschnittene Namensanzeige ab, deren genaues Suffix nicht sichtbar war.
--
-- intensivwoche_anmeldungen.kurs_id ist `on delete set null`: bestehende Anmeldungen zu diesen
-- Kursen (falls vorhanden) werden nicht mitgelöscht, verlieren aber ihre Kurs-Referenz. Vor dem
-- Live-Anwenden prüfen, ob eine dieser Zeilen aktive Anmeldungen hat.

delete from public.intensivwoche_kurse
where name in (
  'Französisch Intensiv – Herbstferien 2026',
  'NMG Intensiv – Herbstferien 2026',
  'Deutsch Intensiv – Sommer 2026'
)
or name like 'Mathematik Intensiv – Sommer%';
