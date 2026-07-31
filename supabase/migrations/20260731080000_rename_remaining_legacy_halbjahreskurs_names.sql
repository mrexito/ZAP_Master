-- Vervollständigt den sitewide-Rename "Halbjahreskurs" -> "Vorkurs" (siehe
-- 20260731071801_materialize_hauptseiten_sessions.sql, das nur die 5 Buchstaben der 6.-Klasse-
-- Vorkurs-Sessions abdeckte) für alle übrigen Zielgruppen. Live-Bestandsaufnahme am 31.07.2026
-- ergab 9 weitere Zeilen mit dem alten Präfix (Buchstaben B, D, F, K, N über 4./5. Klasse,
-- 2./3. Sek und Matura). Jedes Halbjahreskurs-Angebot trägt in types/marketing.fixtures.ts für
-- alle sieben Zielgruppen `displayName: 'Vorkurs'` -- ein einziger textbasierter Replace deckt
-- daher zuverlässig alle verbleibenden Zeilen ab, unabhängig von Klassenstufe oder Buchstabe.
--
-- Reiner Namens-Replace, ändert keine id/Klassenstufe/Standort/Preis -- unbedenklich wiederholbar
-- (WHERE-Klausel greift nach dem ersten Lauf ins Leere).

update public.intensivwoche_kurse
set name = replace(name, 'Halbjahreskurs – ', 'Vorkurs – ')
where name like 'Halbjahreskurs – %';
