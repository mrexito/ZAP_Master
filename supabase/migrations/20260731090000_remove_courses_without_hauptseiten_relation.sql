-- Entfernt die letzten 3 intensivwoche_kurse-Zeilen, die weder einer kuratierten
-- Hauptseiten-Session entsprechen (per id, siehe scripts/audit-live-course-relation.mjs) noch
-- über einen tatsächlich gerenderten Mechanismus auf einer Hauptseite erscheinen -- die
-- Bestandskurs-Anzeige (lib/kurse/catalog.ts#getExistingCoursesForAudience,
-- ExistingCourseSection) ist bereits fertig implementiert, wird aber in keiner Datei unter app/
-- tatsächlich aufgerufen/gerendert; Kurse, die nur über diesen Mechanismus "sichtbar" wären,
-- erscheinen also live auf keiner echten Seite.
--
-- id 11 ("Mathematik Halbjahreskurs – Winter 2026/27") und id 13 ("Mathematik Intensiv –
-- Herbstferien 2026") haben reale Anmeldungen (11 bzw. 5, Stand 31.07.2026). Auf ausdrücklichen
-- Nutzerwunsch trotzdem hart gelöscht, analog zu den bereits am 31.07.2026 entfernten Mock-Kursen
-- (20260731072500_remove_legacy_mock_intensivwoche_kurse.sql). intensivwoche_anmeldungen.kurs_id
-- ist `on delete set null`: die 16 betroffenen Anmeldungen bleiben als Datensatz erhalten,
-- verlieren aber ihre Kurs-Referenz (Name/Preis/Datum aus der Buchung selbst nicht mehr über den
-- Join nachvollziehbar).

delete from public.intensivwoche_kurse
where id in (11, 12, 13);
