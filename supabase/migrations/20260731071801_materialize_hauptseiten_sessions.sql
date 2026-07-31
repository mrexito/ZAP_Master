-- Materialisiert die auf den Hauptseiten (Abschnitt "Termine") gezeigten Kurstermine als echte
-- intensivwoche_kurse-Zeilen -- mit derselben id wie die Fixture-Session (source.kursId), damit die
-- Kursverwaltung (/dashboard/kurse) dieselbe ID zeigt wie die öffentliche Terminliste, statt dass
-- die Relation erst bei der ersten Anmeldung lazy über
-- lib/kurse/ensure-bookable-session.ts#ensureMarketingSessionIsBookable() entsteht.
-- Generiert per scripts/generate-hauptseiten-session-migration.mjs aus
-- types/marketing.fixtures.ts -- keine manuelle Abschrift.
--
-- `on conflict (id) do nothing` macht die insert-Anweisungen ungefährlich wiederholbar: bereits
-- vorher (z.B. durch eine echte Buchung) materialisierte Zeilen werden nicht überschrieben.
--
-- Enthaltene Angebote: offer-6klasse-halbjahreskurs

insert into public.intensivwoche_kurse (
  id, name, fach, beschreibung, detail_beschreibung, start_datum, end_datum,
  uhrzeit, ort, preis, max_teilnehmer, klassenstufen, lehrer, highlights, ist_aktiv
)
values (
  9201, $str$Vorkurs – Kurs A$str$, $str$deutsch$str$, $str$Umfassende und optimale Vorbereitung auf die Aufnahmeprüfung ins Langzeitgymnasium — gezielte, individuelle Förderung in Deutsch und Mathematik.$str$, $str$Umfassende und optimale Vorbereitung auf die Aufnahmeprüfung ins Langzeitgymnasium — gezielte, individuelle Förderung in Deutsch und Mathematik.$str$,
  $str$2026-09-01$str$, $str$2027-03-31$str$, $str$09:00–10:30$str$, $str$Zürich HB$str$,
  3490, 10, ARRAY[$str$6. Klasse$str$]::text[], $str$ZAP$str$,
  ARRAY[$str$Deutsch (inkl. Aufsatztraining) & Mathematik$str$, $str$Samstag oder Mittwochnachmittag$str$, $str$Standortbestimmung, Lerncoaching & Prüfungssimulation inbegriffen$str$, $str$Betreuung auch ausserhalb der Kurszeiten$str$]::text[], true
)
on conflict (id) do nothing;

insert into public.intensivwoche_kurse (
  id, name, fach, beschreibung, detail_beschreibung, start_datum, end_datum,
  uhrzeit, ort, preis, max_teilnehmer, klassenstufen, lehrer, highlights, ist_aktiv
)
values (
  9202, $str$Vorkurs – Kurs C$str$, $str$deutsch$str$, $str$Umfassende und optimale Vorbereitung auf die Aufnahmeprüfung ins Langzeitgymnasium — gezielte, individuelle Förderung in Deutsch und Mathematik.$str$, $str$Umfassende und optimale Vorbereitung auf die Aufnahmeprüfung ins Langzeitgymnasium — gezielte, individuelle Förderung in Deutsch und Mathematik.$str$,
  $str$2026-09-01$str$, $str$2027-03-31$str$, $str$11:00–12:30$str$, $str$Winterthur$str$,
  3490, 10, ARRAY[$str$6. Klasse$str$]::text[], $str$ZAP$str$,
  ARRAY[$str$Deutsch (inkl. Aufsatztraining) & Mathematik$str$, $str$Samstag oder Mittwochnachmittag$str$, $str$Standortbestimmung, Lerncoaching & Prüfungssimulation inbegriffen$str$, $str$Betreuung auch ausserhalb der Kurszeiten$str$]::text[], true
)
on conflict (id) do nothing;

insert into public.intensivwoche_kurse (
  id, name, fach, beschreibung, detail_beschreibung, start_datum, end_datum,
  uhrzeit, ort, preis, max_teilnehmer, klassenstufen, lehrer, highlights, ist_aktiv
)
values (
  9203, $str$Vorkurs – Kurs E$str$, $str$deutsch$str$, $str$Umfassende und optimale Vorbereitung auf die Aufnahmeprüfung ins Langzeitgymnasium — gezielte, individuelle Förderung in Deutsch und Mathematik.$str$, $str$Umfassende und optimale Vorbereitung auf die Aufnahmeprüfung ins Langzeitgymnasium — gezielte, individuelle Förderung in Deutsch und Mathematik.$str$,
  $str$2026-09-01$str$, $str$2027-03-31$str$, $str$14:00–15:30$str$, $str$Zürich HB$str$,
  3490, 10, ARRAY[$str$6. Klasse$str$]::text[], $str$ZAP$str$,
  ARRAY[$str$Deutsch (inkl. Aufsatztraining) & Mathematik$str$, $str$Samstag oder Mittwochnachmittag$str$, $str$Standortbestimmung, Lerncoaching & Prüfungssimulation inbegriffen$str$, $str$Betreuung auch ausserhalb der Kurszeiten$str$]::text[], true
)
on conflict (id) do nothing;

insert into public.intensivwoche_kurse (
  id, name, fach, beschreibung, detail_beschreibung, start_datum, end_datum,
  uhrzeit, ort, preis, max_teilnehmer, klassenstufen, lehrer, highlights, ist_aktiv
)
values (
  9204, $str$Vorkurs – Kurs G$str$, $str$deutsch$str$, $str$Umfassende und optimale Vorbereitung auf die Aufnahmeprüfung ins Langzeitgymnasium — gezielte, individuelle Förderung in Deutsch und Mathematik.$str$, $str$Umfassende und optimale Vorbereitung auf die Aufnahmeprüfung ins Langzeitgymnasium — gezielte, individuelle Förderung in Deutsch und Mathematik.$str$,
  $str$2026-09-01$str$, $str$2027-03-31$str$, $str$16:00–17:30$str$, $str$Winterthur$str$,
  3490, 10, ARRAY[$str$6. Klasse$str$]::text[], $str$ZAP$str$,
  ARRAY[$str$Deutsch (inkl. Aufsatztraining) & Mathematik$str$, $str$Samstag oder Mittwochnachmittag$str$, $str$Standortbestimmung, Lerncoaching & Prüfungssimulation inbegriffen$str$, $str$Betreuung auch ausserhalb der Kurszeiten$str$]::text[], true
)
on conflict (id) do nothing;

insert into public.intensivwoche_kurse (
  id, name, fach, beschreibung, detail_beschreibung, start_datum, end_datum,
  uhrzeit, ort, preis, max_teilnehmer, klassenstufen, lehrer, highlights, ist_aktiv
)
values (
  9205, $str$Vorkurs – Kurs I$str$, $str$deutsch$str$, $str$Umfassende und optimale Vorbereitung auf die Aufnahmeprüfung ins Langzeitgymnasium — gezielte, individuelle Förderung in Deutsch und Mathematik.$str$, $str$Umfassende und optimale Vorbereitung auf die Aufnahmeprüfung ins Langzeitgymnasium — gezielte, individuelle Förderung in Deutsch und Mathematik.$str$,
  $str$2026-09-01$str$, $str$2027-03-31$str$, $str$18:00–19:30$str$, $str$Winterthur$str$,
  3490, 10, ARRAY[$str$6. Klasse$str$]::text[], $str$ZAP$str$,
  ARRAY[$str$Deutsch (inkl. Aufsatztraining) & Mathematik$str$, $str$Samstag oder Mittwochnachmittag$str$, $str$Standortbestimmung, Lerncoaching & Prüfungssimulation inbegriffen$str$, $str$Betreuung auch ausserhalb der Kurszeiten$str$]::text[], true
)
on conflict (id) do nothing;

-- Korrigiert reale Zeilen, die noch unter dem alten Namen "Halbjahreskurs – <Kurs>"
-- existieren (vor dem sitewide-Rename "Halbjahreskurs" -> "Vorkurs"), auf den aktuell auf der
-- Hauptseite gezeigten Namen. Trifft per exaktem Namenstext, unabhängig von der id der betroffenen
-- Zeile -- deckt damit auch Zeilen ab, die unter einer anderen id als der Fixture-Session existieren
-- und von `on conflict (id) do nothing` oben nicht erreicht würden. Bewusst NICHT enthalten: eine
-- Änderung der id dieser Zeilen -- das würde intensivwoche_anmeldungen.kurs_id-Verweise betreffen
-- und braucht eine separate, manuelle Entscheidung.

update public.intensivwoche_kurse set name = $str$Vorkurs – Kurs A$str$ where name = $str$Halbjahreskurs – Kurs A$str$;
update public.intensivwoche_kurse set name = $str$Vorkurs – Kurs C$str$ where name = $str$Halbjahreskurs – Kurs C$str$;
update public.intensivwoche_kurse set name = $str$Vorkurs – Kurs E$str$ where name = $str$Halbjahreskurs – Kurs E$str$;
update public.intensivwoche_kurse set name = $str$Vorkurs – Kurs G$str$ where name = $str$Halbjahreskurs – Kurs G$str$;
update public.intensivwoche_kurse set name = $str$Vorkurs – Kurs I$str$ where name = $str$Halbjahreskurs – Kurs I$str$;
