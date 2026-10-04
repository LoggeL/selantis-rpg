# Visueller Playtest vom 4. Oktober 2026

Die Prüfung umfasst die bestehenden Szenen sowie alle neun neuen Kapitel bis zum Ende des ersten Films. Desktop (1280×800), Touch-Hochformat (390×844) und Touch-Querformat (844×390) wurden mit tatsächlichen Klicks, Tastatur- und Touch-Eingaben geprüft. Der direkte Einstieg dient der Vorbereitung eines Abschnitts; die Prüfungen schließen echte Übergänge, Inventarerhalt und Wiedereinstieg ein. Ein ununterbrochener Gesamtdurchlauf vom Titel bis zum Filmende ist damit nicht behauptet.

## Spielerische Abnahme

Ein bestandener Dialogdurchlauf genügt nicht als Nachweis einer Spielmechanik. Für eine Herausforderung gelten zusätzlich:

- Der Spieler entscheidet über eine Handlung oder ein Ziel.
- Sichtbare Regeln erklären Erfolg und Misserfolg.
- Eine falsche Entscheidung kann den Fortschritt verhindern.
- Abbruch und Wiederholung erhalten den Kampagnenzustand.
- Fortschritt wird erst nach tatsächlich erreichtem Erfolg freigeschaltet.
- Maus, Tastatur und Touch erlauben dieselben notwendigen Entscheidungen.

Die erste Prüfung fand nach der Taverne hauptsächlich geordnete Laufpunkte und Dialoge. Daraufhin wurden die Spurensuche und Kyras Befreiung durch echte Herausforderungen ergänzt. Die ruhigeren Kapitel bleiben Dialogpassagen. Die beiden neuen Mechaniken belegen noch nicht, dass das Tempo des gesamten Abschnitts ausgewogen ist.

| Kapitel | Geprüfte Darstellung und Ablauf | Spielerische Einordnung |
| --- | --- | --- |
| Goldener Eber | Tischposition, Craupor, vier Gespräche, Ausstieg und Wiedereinstieg | Dialog und Erkundung; keine eigenständige Herausforderung |
| Leselager | Begehbarer Boden, Feuerstelle, Bücher und Versprechen | Ruhige Dialogpassage |
| Bruderschaft | Figuren, Begrüßung, Informationen und Wege | Dialog und optionale Erkundung |
| Verrat | Gespräch, Rückzug und Weiterweg | Erzählerischer Übergang |
| Regenwald | Spuren vor Flicks Auftauchen, Größen und Regen | Vorbereitung der Begegnung |
| Flicks Fährte | Hinweise, falsche Route, Wiederholung, Abbruch und Rückkehr zum Waldweg | Eigenständige Spurensuche mit Erfolgskontrolle |
| Schattenlager | Sichtbare Fesseln, Deckung, verborgenes Vorgehen und Ablenkung | Vorbereitung des Rettungskampfs; keine Wacherkennungssimulation |
| Schwestern | Dreiründige Rettung, Abbruch, Niederlage, Wiederholung, Schutz und Magieausbruch | Taktischer Kampf mit getrennten Figurenaktionen |
| Filmabschluss | Ruinenszene, Erholung, Gruppe, Schlussansicht, Wiederholung und Titelwechsel | Erzählerischer Abschluss |

## Behobene Spielfehler

- Laufziele und Figuren im Leselager sowie in der Bruderschaft stehen auf dem sichtbaren Weg statt im Gebüsch oder auf Felsen.
- Craupors Gespräch wird von Lias Tisch aus geführt. Figuren verdecken Lia bei Annäherung und Erholung nicht mehr.
- Flick hat die passende Größe, erscheint erst nach der Spurensuche und bleibt im Lager bis zur Ablenkung verborgen.
- Kyra zeigt Fesseln bereits bei der Beobachtung des Gefangenenlagers. Eine erfolgreiche Befreiung und Wiedereinstieg entfernen sie korrekt.
- Laufanimationen enden in der zuletzt verwendeten Blickrichtung. Lias inszenierte Bewegung verwendet ihre Laufanimation.
- Der Hauptmann und die Wache ziehen sich sichtbar zurück. Die Schlagpose wird vor dem Weggehen zurückgesetzt.
- Die Illustration der Bestrafung bleibt während des vollständigen Gesprächs eingeblendet. Das Erholungsbild erscheint erst nach Lias Zusammenbruch.
- Weltgebundene Regen- und Magieeffekte bleiben unter den illustrierten Nahaufnahmen.
- Die DOM-Tasche verdeckt kein zweites Canvas-Inventar. Auswahl, Kommentar, Essen und Rückkehr funktionieren.
- Feuerbohren und Foltans Gespräch erlauben die Einstellungen. Eine Pause erhält Wärme, Zeit und Gesprächsschritt.
- Titel, Flucht und mobiler Kampf haben sichtbare, passend platzierte Hinweise. Leere Textkästen verschwinden; Kampfstatus bleibt im Querformat lesbar und scrollbar.
- Die Canvas-Skalierung nutzt während Dialogen dieselbe verfügbare Fläche wie während der Erkundung.
- Die Canvas-Kampfbuttons beachten dieselbe Eingabesperre wie Tastatur und DOM-Buttons. Deckung und Rundenende können eine noch laufende Bewegung nicht unterbrechen.
- Kampfbuttons bleiben beim Neuzeichnen registriert. Schnelle Folgeklicks gehen durch einen Austausch der interaktiven Objekte nicht mehr verloren.
- Nach Abbruch oder Erfolg veröffentlicht die zurückkehrende Szene ihren aktuellen Zustand vor dem Aufwecken der Steuerelemente.

## Nachweise

Die dauerhaften Browserregressionen liegen in `game/e2e/visual-qa-*.pw.ts`, `rescue-gameplay.pw.ts`, `tracking-gameplay.pw.ts` und `continuation-story.pw.ts`. Die Herausforderungen besitzen zusätzlich reine Regeltests und Tests für die Szenenlebensdauer. Die bestehenden CI-Tests wurden dort korrigiert, wo verzögerte Screenshots eine zuvor beobachtete Voraussetzung ungültig machten; reale Eingaben und Erfolgsbedingungen bleiben geprüft.

Der vollständige lokale Browserlauf mit vier parallelen Workern bestand zunächst 188 von 192 Fällen. Die vier Fehler führten zur Korrektur des Canvas-Eingabeverlusts, des Dialoglesers und zweier Positionsmessungen während mobiler Layoutwechsel. Alle vier Fälle bestanden danach erneut. Die Kampffälle bestanden außerdem je vier Wiederholungen unter paralleler Last; die Spurensuche bestand neun Wiederholungen. Der abschließende Quellenstand besteht 615 Unit-Tests sowie Typ-, Architektur-, Asset- und Buildprüfungen. Diese Ergebnisse sind lokale Prüfungen; sie ersetzen keine Aussage über einen späteren CI-Lauf oder einen veröffentlichten Commit.

Nach der letzten Änderung an der Szenenrückkehr bestanden zusätzlich alle 17 betroffenen Gameplay-, Pointer- und Rettungsprüfungen. Sie umfassen Erfolg, Abbruch, Niederlage, Wiederholung und den Filmabschluss in allen drei Ansichten.

Der erste automatische Docker-Build bestand alle 615 Tests, scheiterte aber anschließend an `EMFILE` durch Dateiüberwacher. Der Musik-Auslieferungstest deaktiviert deshalb seine unnötige Überwachung; der Docker-Build führt höchstens zwei Testworker parallel aus. Der vollständige Testlauf bestand danach auch mit einem auf 1.024 begrenzten Dateilimit.

Lokale Berichte und Originalbilder:

- `output/qa/visual-playtest/valentus/coverage.md`: Titel, vier Prologkarten, Kampf, Verwundung, beide Fluchtkarten und Zuflucht, 118 Screenshots.
- `output/qa/visual-playtest/lia-journey/coverage.json`: Lia/Kyra, fünf Weltkarten, Überfall, Trauer, Hof und Haus, Reise, Lager und Gefährtenweg, 339 Screenshots.
- `output/qa/visual-playtest/novel/report.md`: die vier Romankapitel in allen drei Ansichten.
- `output/qa/visual-playtest/flick/report.json`: Regenwald, Fährte und Schattenlager.
- `output/qa/visual-playtest/rescue/report.md`: Kampf, Erholung und Filmabschluss, normaler Ablauf und Stresstest in allen drei Ansichten.
- `output/qa/visual-playtest/shared`: Inventar, Skalierung, Einstellungen und mobile Kampfstatusanzeige.
- `output/qa/visual-playtest/gameplay-tracking/report.md`: Hinweise, Wegentscheidung, Fehlversuch und Abbruch.
- `output/qa/visual-playtest/gameplay-rescue/report.md`: echte Kämpfe, Niederlage, Wiederholung und Kampagnenübergabe.

## Verbleibende Grenzen

Kyra hat keine eigene kniende Pflegepose. Der Kampf verwendet kurze Bewegungen und Trefferblitze; individuelle Nahkampfanimationen und detaillierte Gegnerchoreografie fehlen. Manche Illustrationen zeigen stärkere Nachtbeleuchtung als die Lagerkarte. Diese Unterschiede sind dokumentiert, ohne sie als blockierten Spielfortschritt zu behandeln. Langfristiges Balancing, Audioabnahme und ein vollständiger Gesamtdurchlauf bleiben separate Prüfungen.
