-- Korrigiert die verbleibenden 12 Zeilen mit kuratierter id aber abweichendem Namen (gefunden
-- per scripts/audit-live-course-relation.mjs, 31.07.2026): die 8 Sessions von
-- offer-6klasse-intensivkurs-sportferien und die 4 Sessions von
-- offer-6klasse-pruefungssimulation tragen noch ein älteres "<Angebot> 6. Klasse – …"-Namensmuster
-- statt des aktuellen Hauptseiten-Namens `${offer.displayName} – ${session.kurs}`
-- (offer.displayName = "Intensivkurs-Sportferien" bzw. "Prüfungssimulation", siehe
-- types/marketing.fixtures.ts). Reiner Namens-Replace, ändert keine id/Klassenstufe/Standort/
-- Preis -- unbedenklich wiederholbar (WHERE-Klausel greift nach dem ersten Lauf ins Leere).

update public.intensivwoche_kurse
set name = replace(name, 'Intensivkurs 6. Klasse – ', 'Intensivkurs-Sportferien – ')
where name like 'Intensivkurs 6. Klasse – %';

update public.intensivwoche_kurse
set name = replace(name, 'Prüfungssimulation 6. Klasse – ', 'Prüfungssimulation – ')
where name like 'Prüfungssimulation 6. Klasse – %';
