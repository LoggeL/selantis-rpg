# Bugs aus dem E2E-Playtest vom 8. Oktober 2026

Der ursprüngliche Playtest ist abgeschlossen: 61 Szenen kapitelweise gespielt, 17 bestätigte Gameplay-/UI-Bugs (7 P2, 10 P3), ergänzt um 14 visuelle Befunde und Nacharbeitseinträge. Kein bestätigter P1. Die Kapitelabschlüsse und Abspannübergänge wurden erreicht; die Fehler betreffen insbesondere Aufgabenfortschritt, Pause/Modalsteuerung und widersprüchliche Anzeigen. Die ursprünglichen Befunde und Belege bleiben unten erhalten.

Getestet wurde der lokale Arbeitsstand von SelantisRPG auf `main`, Ausgangscommit `ef67f16b329c8bb4316394efce6531bfcfdf76ba`, einschließlich der beim Testbeginn vorhandenen uncommitteten Änderungen. Seit der Nutzerkorrektur erfolgten alle Spielprüfungen ausschließlich im internen Codex-Browser mit Musik, Sprache und Effekten auf null. Nach der entsprechenden Nutzeranweisung waren höchstens acht Agenten gleichzeitig aktiv, einschließlich des Hauptagenten. Der ursprüngliche Playtest änderte keinen Spielcode. Anschließend beauftragte der Nutzer die lokale Fixrunde. Dabei kam ST-019 hinzu: insgesamt 18 bestätigte ST-Bugs (7 P2, 11 P3); ST-006 bleibt zurückgezogen. Die Fixrunde umfasst außerdem alle 14 ART-Punkte und ist kein Commit, Push oder Deployment.

P1 bezeichnet einen nicht fortsetzbaren Hauptpfad, P2 einen reproduzierbaren Funktionsfehler, P3 einen kleineren Anzeige-, Bedienungs- oder Accessibilityfehler. Browserabbrüche und Fehler der Testhilfen zählen nicht als Spielfehler.

## Zusammenführung mit dem aktuellen Projektstand

Die lokalen Korrekturen wurden am 8. Oktober 2026 mit GitHub-Stand `aa76ba08cb275a577cafd60fa7989d3e294c3c82` zusammengeführt. Dabei bleiben die neueren FFTA-Regeln, die Vertonungsanbindung, die Spielstand-Metadaten, die Kapitelbücher, die Safe-Area-Abstände und Lias eingeschränkte Bewegung bei Vergiftung erhalten. Die neueren gemalten Minispielansichten ersetzen die älteren Darstellungsvarianten; Pausen- und Aufgabenfixes sind in diese Ansichten übertragen.

Die Figurenmaße und die neue Waldweg-Aufgabe sind auch in den zugehörigen Browsertests berücksichtigt. Die lokale Typprüfung, 655 Modultests in 93 Dateien und der Produktionsbuild bestehen. Im Browserlauf bestanden 196 Fälle. Drei veraltete Testannahmen wurden korrigiert und die betroffenen Fälle bestanden anschließend einzeln. Der Gesamtlauf wurde während der beiden langen Kampagnentests beendet; 32 weitere Fälle wurden nicht ausgeführt. Ein vollständig bestandener Browsergesamtlauf wird deshalb nicht behauptet. Die Protokolle liegen in der lokalen Sicherung; die Belege der ursprünglichen Fixrunde unten beziehen sich auf deren damaligen Arbeitsstand. GitHub-CI ist auf Nutzerwunsch deaktiviert.

Die neun früheren Arbeitsordner sind unter `.local/retired-worktrees/` archiviert. Sicherheitskopien, Dateiinventare und neue Prüfprotokolle liegen unter `.local/consolidation-2026-10-08/`. Offene Vertonungsarbeit bleibt in den bisherigen Codex-Arbeitskopien und ist über `.local/codex-workspaces/` erreichbar.

## Lokale Fixrunde und gezielte Validierung

Die Nachtests verwenden echte Tastatur-/Pointereingaben im stummen internen Browser, teils ab vorgesehenen Szenenstart-Fixtures. Sie ersetzen keinen erneuten vollständigen Durchlauf aller 61 Szenen. Zustandslesungen belegen die erspielten Ergebnisse; Erfolgsflags oder Teleports wurden dafür nicht geschrieben. Die folgende Matrix beschreibt den lokalen Fixstand, die Abschnitte danach den historischen Fehlerzustand.

| ID | Lokale Korrektur | Nachtest und Beleg |
| --- | --- | --- |
| ST-001 | Kapitelwahl in der Pause verwendet die Verlustbestätigung des Titels. | Erste Auswahl erhält den Save, zweite startet die gewählte Szene: [JSON](../output/qa/bugfix-2026-10-08/st001.json), [Warnung](../output/qa/bugfix-2026-10-08/st001-confirmation.png). |
| ST-002 | Eigener Drill-Modal und aktive Uhr halten bei Pause, anderen Overlays und Fokusverlust an. | Unveränderter Hieb/Score im [Menü](../output/qa/bugfix-2026-10-08/st002-pause.json) und nach Übergabe zum [Tagebuch](../output/qa/bugfix-2026-10-08/st002-journal.json). Overlay-/Fokusvarianten sind zusätzlich automatisiert geprüft. |
| ST-003 | Dritter Teilschluss und Gesamtschluss werden synchron gespeichert; ältere unvollständige Notizen werden ergänzt. | Escape nach 283 ms, Gesamtschluss weiterhin vorhanden: [JSON](../output/qa/bugfix-2026-10-08/st003-fast-escape.json), [Wiederöffnen](../output/qa/bugfix-2026-10-08/st003-reopened.png). Alte Zustandsvariante zusätzlich im Logiktest. |
| ST-004 | Neue Aufgaben-ID `k2-trittsteine`, Wiederherstellung des aktuellen Waldwegmarkers. | Nach echter Rast offenes Trittsteinziel und Marker: [JSON](../output/qa/bugfix-2026-10-08/st013-before-reload.json). Alt-Save-Reparatur automatisiert, Reload-Grenze siehe unten. |
| ST-005 | Aufbruchmarker liegt mit Ankunftstoleranz im Ausgang bei `[284,351]`. | Echter Mausklick führt natürlich nach `e2-bruderschaft`: [JSON](../output/qa/bugfix-2026-10-08/st005-route-exit.json), [Folgeszene](../output/qa/bugfix-2026-10-08/st005-next-scene.png). |
| ST-007 | Lederbeutel besitzt Escape über den zentralen Modalrouter. | Packpanel geschlossen, kein zweites Menü: [JSON](../output/qa/bugfix-2026-10-08/st007.json), [Ansicht](../output/qa/bugfix-2026-10-08/st007-after-escape.png). Der unmittelbare JSON-Wert `locked:true` ist die verzögerte Freigabe; nach weiteren 350 ms wurde sie im Browser beobachtet. |
| ST-008 | Nur Taktknopf/Bestätigung rütteln; HUD-Menü und Escape sind erreichbar, Minispielzeit pausiert. | [Geöffnetes Menü und Zustandsvergleich](../output/qa/bugfix-2026-10-08/st008-pause.json), danach normal erspielte [Befreiung](../output/qa/bugfix-2026-10-08/st008-complete.json). |
| ST-009 | Geschenkziel wird vor Kapitel I abgeschlossen. | Geste und Übergang nach `wiese`, Geschenkziel erledigt: [JSON](../output/qa/bugfix-2026-10-08/st009-st010.json). Alt-Save-Migration automatisiert. |
| ST-010 | Wiegenstand liegt bei `[480,254]` innerhalb des Radius. | Zweite Wiegeninteraktion und Geschenksequenz ohne Korrekturschritt bis Kapitel I: [JSON](../output/qa/bugfix-2026-10-08/st009-st010.json). Reichweite zusätzlich geometrisch geprüft. |
| ST-011 | Ratsziel wird vor Abschluss auf 4/4 aktualisiert. | [Erledigter 4/4-Eintrag](../output/qa/bugfix-2026-10-08/st011.json); Alt-Save-Migration automatisiert. |
| ST-012 | Eigene Hinweisebene oberhalb des Titels, persistente Pointer-Schließung. | Am Titel geschlossen, Speicherwert `"1"`, Hinweis inaktiv: [JSON](../output/qa/bugfix-2026-10-08/st012.json), [Ansicht](../output/qa/bugfix-2026-10-08/st012-dismissed.png). |
| ST-013 | Aufbruch und erster Waldweg enden an ihren jeweiligen Reiseabschnitten. | Beide alten Ziele nach echter Rast erledigt: [JSON](../output/qa/bugfix-2026-10-08/st013-before-reload.json). Alte und spätere Saves automatisiert geprüft. |
| ST-014 | Letzter Auskundschaftszähler wird vor Abschluss gespeichert. | Drei echte Punkte, erledigt mit 3/3, Rückkehr offen: [JSON](../output/qa/bugfix-2026-10-08/st014-scouting-complete.json), [Tagebuch](../output/qa/bugfix-2026-10-08/st014-scout-3of3.png). |
| ST-015 | Verborgene Karten sind unsichtbar für assistive Technik und enthalten keinen alten Text. | Echte Niederlage: [leere verborgene Karten](../output/qa/bugfix-2026-10-08/st015-hidden-cards.json), [AX-Baum](../output/qa/bugfix-2026-10-08/st015-defeat-ax.txt). |
| ST-016 | Aufbruch endet erst bei tatsächlichem Abschluss; Feuer-Bleiben stellt Ziel/Marker wieder her. | Echter Pfad Feuer-Bleiben, offenes Ziel, anschließend erneut Aufbruchmarker: [JSON](../output/qa/bugfix-2026-10-08/st016-fire-stay.json), [Ansicht](../output/qa/bugfix-2026-10-08/st016-open-objective.png). Alte Finale-Zustandsvariante automatisiert beim Szeneintritt geprüft. |
| ST-017 | Bildbeschreibung folgt der aktuellen Geste; verstecktes Original verliert sein altes Label. | Aktuelle Bildrollen und Texte: [Seil](../output/qa/bugfix-2026-10-08/st017-rope.json), [Augen](../output/qa/bugfix-2026-10-08/st017-eyes.json). |
| ST-018 | Beschreibung wird bei Befreiung und Kampfstart anhand von `bound` synchronisiert. | Echte Seilschnitte: [frei und passender Titel](../output/qa/bugfix-2026-10-08/st018-freed.json). Anschließend Niederlage und echter Retry mit derselben BattleDef: [wieder gefesselt und passender Titel](../output/qa/bugfix-2026-10-08/st018-real-retry.json). `st018-free-card.png` zeigt Lia und ist kein Kyra-Kartenbeweis. |
| ST-019 | Tavernen-Quellenziel wird vor Abschluss auf 3/3 aktualisiert. | Alle drei Gespräche, Routenwahl und Mausaufbruch bis `e2-bruderschaft` erneut erspielt: [erledigter 3/3-Eintrag](../output/qa/bugfix-2026-10-08/st019-counter-after.json), [Ansicht](../output/qa/bugfix-2026-10-08/st019-counter-after.png). Drei mögliche letzte Quellen zusätzlich automatisiert geprüft. |

Für ST-004/009/011/013 prüfen automatisierte `GameState.save()`-/`load()`-Tests die Reparatur von Version-1-Saves, unvollständige Aufgaben, spätere Kapitel und wiederholtes Laden. ST-016 wird separat über den alten Finale-Zustand und `finaleScript()` geprüft; dieser Test ist kein serialisierter Save/Load-Roundtrip. Der tatsächliche Browserpfad bestätigt das Feuer-Bleiben und die erneute Ausgangswahl. Beim Browser-Fortsetzen nach der K2-Mittagspause wurde der reguläre ältere Szenenbeginn-Checkpoint geladen. Es gibt keinen Browsernachweis für einen mitten in der Rast gespeicherten Stand.

Alle 14 ART-Punkte sind lokal umgesetzt. Maßstabs- und Materialentscheidungen sind visuelle Kalibrierungen; sie werden nicht als zusätzlich bestätigte Gameplay-Bugs gezählt.

| ART-Punkte | Umsetzung und Sichtkontrolle |
| --- | --- |
| ART-001 | Gastzimmer-Figurenmaßstab 2,2, Waschstand/Versteck an die Illustration angepasst. Echter Stillhalteabschluss bei `[464,154]`: [Kontaktansicht](../output/qa/bugfix-2026-10-08/art001-bowl-contact-after.png), [erledigtes Ziel](../output/qa/bugfix-2026-10-08/art001-bowl-complete.json). Drei Geometrietests prüfen Versteck, Fußbox und Reichweite samt Ankunftstoleranz. Der [Kristallausschnitt](../output/qa/bugfix-2026-10-08/art001-gesture-after.png) zeigt die vergrößerten Figuren vollständig; die [Kerze](../output/qa/bugfix-2026-10-08/art001-candle-after.png) folgt den tatsächlichen Handpunkten des Walk-Sheets. [Alle drei Prüfungen normal abgeschlossen](../output/qa/bugfix-2026-10-08/art001-room-complete.json). |
| ART-002/003 | Hintergrundbezogene Figurenkalibrierung für Stuben, Hof, Lager, Saal und Käfig. Nachansichten: [Prologstube](../output/qa/bugfix-2026-10-08/prolog-zuflucht-after.png), [Übungsplatz](../output/qa/bugfix-2026-10-08/k4-training-after.png), [Käfigwagen und Fass](../output/qa/bugfix-2026-10-08/art003-wagon-after.png), [nächtlicher Ordenssaal](../output/qa/bugfix-2026-10-08/art003-hall-after.png). Die finale [Kapitel-I-Stube mit Faktor 3](../output/qa/bugfix-2026-10-08/k1-stube-after.png) wurde nach vier echten Gräbern und dem Morgenübergang erreicht; Tisch-/Stuhlhöhen wurden dabei visuell abgeglichen. Wageninteraktion und natürlicher Übergang in den Saal bleiben spielbar. Keine Aussage über sämtliche Möbel-/Kameravarianten. |
| ART-012 | Eigene Hintergrundvariante mit gewöhnlichen kleinen Waldpilzen und kalibrierter Referenzfigur. Der Originalhintergrund bleibt erhalten. [Nördlicher Pfad mit Lia](../output/qa/bugfix-2026-10-08/art012-mushrooms-after.png), nach Frühstück, Waldgespräch und tatsächlichem Fußweg erreicht. |
| ART-004/013 | Engere Kerkerstäbe und eigene Fluchtporträts ohne Köcher, einschließlich der benötigten Moods. [Kerker](../output/qa/bugfix-2026-10-08/art004-kerker-after.png), [Flicks Flucht](../output/qa/bugfix-2026-10-08/art013-flick-flight-after.png). |
| ART-005 | Cameomöbel, Sitzhöhe, Holzfarbe und Kerzenlicht aufeinander abgestimmt: [Taverne](../output/qa/bugfix-2026-10-08/taverne-after.png). |
| ART-006/007 | Nachtpalette/Kontaktschatten der Lauschbäume und gemeinsame Glutposition beim Pusten: [Lauschen](../output/qa/bugfix-2026-10-08/art006-listen-trees-after.png), [Pusten](../output/qa/bugfix-2026-10-08/art007-blow-after.png). |
| ART-008 | Isometrische Ritualständer mit quadratischer Auflage, anschließend eigener Maßstab 0,9. Frische [Kampfansicht](../output/qa/bugfix-2026-10-08/art008-ritual-stands-after.png); echte Umwerfaktion zusätzlich [belegt](../output/qa/bugfix-2026-10-08/art008-stand-tipped-ax.txt). |
| ART-009 | Schmale Figurenkontur und lokal beruhigter Moosgrund unter Ignatius. Frische integrierte [Abschiedsaufnahme](../output/qa/bugfix-2026-10-08/art009-ignatius-after.png). Die Waldpfad-Geometrie bleibt erhalten. |
| ART-010 | Cutaway erfasst Baumkronen und überzeichnende Büsche, auch während Gegneraktionen. Lia tatsächlich auf `(6,5)`: [Körper während Gegnerzug](../output/qa/bugfix-2026-10-08/art010-enemy-turn-after.png), [Position/Alpha-Werte](../output/qa/bugfix-2026-10-08/art010-cutaway.json). |
| ART-011 | Wasserlinie, Unterkörpermaskierung und Fußwelle. Echter Wasser-/Uferaustritt mit passenden Effektzuständen: [JSON](../output/qa/bugfix-2026-10-08/art011-water-exit.json), [Waten](../output/qa/bugfix-2026-10-08/art011-wading-after.png), [Ufer](../output/qa/bugfix-2026-10-08/art011-water-exit-after.png). |
| ART-014 | Dunkler gezackter Spaltkern, Grasrand und gedämpftes Licht. [Rissansicht](../output/qa/bugfix-2026-10-08/art014-rift-after.png), [erster Riss normal geschlossen](../output/qa/bugfix-2026-10-08/art014-first-rift-closed-ax.txt). |

Gezielte Vitest- und TypeScript-Prüfungen sind in den Fixnotizen dokumentiert: [UI](../output/qa/bugfix-2026-10-08/ui.md), [Prolog/K2](../output/qa/bugfix-2026-10-08/prolog-k2.md), [K3/K5-Panels](../output/qa/bugfix-2026-10-08/k3-k5-panels.md), [Training/Gesten](../output/qa/bugfix-2026-10-08/training-gestures.md), [Taktik/Finale](../output/qa/bugfix-2026-10-08/tactics-k5.md), [Taverne](../output/qa/bugfix-2026-10-08/taverne.md), [Rasterassets](../output/qa/bugfix-2026-10-08/art-assets.md), [Moosgrund](../output/qa/bugfix-2026-10-08/art009-background.md), [Waschstand-Geometrie](../output/qa/bugfix-2026-10-08/washstand-geometry.md). Auch [Zimmeranker und Bildausschnitt](../output/qa/bugfix-2026-10-08/room-attachments.md) sowie die [Pilzkorrektur](../output/qa/bugfix-2026-10-08/art012-background.md) sind dokumentiert.

Abschlussprüfung des finalen lokalen Spielstands: `npm test` besteht mit 78 Testdateien und 541 Tests ([Protokoll](../output/qa/bugfix-2026-10-08/tests-final.log)). `npm run build` besteht einschließlich `tsc --noEmit` und BlurHash-Prüfung ([Protokoll](../output/qa/bugfix-2026-10-08/build-final.log)). Das Assetmanifest ist aktuell; 653 Bilder haben Vorschaumetadaten. Die drei Hintergrundvarianten liegen unter `assets/bg/variants/` und werden über ihre bisherigen logischen IDs verwendet, damit sie keine zusätzlichen gesperrten Galerieeinträge erzeugen. Originale bleiben erhalten. `git diff --check` meldet keinen Befund. Im abschließenden Browserprotokoll wurden keine Warnungen oder Fehler erfasst ([Protokoll](../output/qa/bugfix-2026-10-08/browser-console-final.json)). Vite meldet weiterhin große JavaScript-Chunks und den gemischten statischen/dynamischen Import der BootScene; der Build ist erfolgreich. Diese Prüfung ist kein Produktionsrelease.

## Ursprüngliche bestätigte Bugs

### ST-001, P2: Kapitelwahl in der Pause überschreibt den Spielstand ohne Warnung

- Bereich: Gemeinsames Pausenmenü.
- Reproduktion: Neues Spiel starten, im Prolog Escape drücken, "Kapitel wählen" öffnen und einmal "Die Wiese" anklicken.
- Erwartet: Vor dem Zurücksetzen und Überschreiben des bestehenden Kampagnenstands eine Warnung und Bestätigung anzeigen, wie bei der Kapitelwahl auf dem Titelbildschirm.
- Tatsächlich: Ein einzelner Klick startet `wiese` und ersetzt `selantis.save.v1` unmittelbar. Der vorherige Prolog-Spielstand ist anschließend nicht mehr über "Fortsetzen" erreichbar. Die Kapitelwahl zeigt keine Verlustwarnung.
- Nachweis: Im internen Browser wurde der Spielstand vor und nach dem einzelnen Klick gelesen: `prolog-rat` wurde zu `wiese`. [Vorher](../output/qa/playtest-2026-10-08/shared/pause-chapter-before.png), [nachher](../output/qa/playtest-2026-10-08/shared/pause-chapter-after.png).
- Quellhinweis: `game/src/ui/menu.ts`, `showChapters()` verwendet `buildChapterSelect()` ohne `confirm`; `game/src/ui/title.ts` übergibt diese Schutzfunktion.

### ST-002, P2: Ausweichdrill läuft während der Pause weiter

- Bereich: Kapitel IV, Bruderschaft, Ausweichtraining.
- Reproduktion: Ausweichdrill starten, vor den Hieben Escape drücken und das sichtbare Pausenmenü geöffnet lassen.
- Erwartet: Hiebe, Treffer und Abschluss des Trainings warten, bis "Fortsetzen" gewählt wird.
- Tatsächlich: Alle 16 Hiebe werden hinter dem geöffneten Menü abgewickelt. Ohne Ausweicheingabe erhält Lia 16 Treffer und lernt anschließend automatisch `ausweichen`, während das Pausenmenü noch sichtbar ist.
- Nachweis: Zustandslesung vor und nach der Pause: Fähigkeit erst nicht vorhanden, anschließend vorhanden; `k4-treffer = 16`, Menü weiterhin offen. [Vorher](../output/qa/playtest-2026-10-08/kapitel-4/iab-drill-pause-before.png), [nachher](../output/qa/playtest-2026-10-08/kapitel-4/iab-drill-pause-after.png), [Abschluss hinter dem Menü](../output/qa/playtest-2026-10-08/kapitel-4/iab-drill-finished-behind-pause.png), [Protokoll](../output/qa/playtest-2026-10-08/kapitel-4/iab-log.json).

### ST-003, P2: Zu schnelles Schließen der Notizen verliert den abschließenden Schluss

- Bereich: Kapitel III, Goldener Eber, Hinweise kombinieren.
- Reproduktion: Die drei richtigen Hinweispaare in den Notizen kombinieren. Nach dem letzten Paar innerhalb von 900 ms Escape drücken. Notizen erneut öffnen und das letzte Paar nochmals kombinieren.
- Erwartet: Der vollständige Schluss "Kyra lebt" wird gespeichert oder beim erneuten Öffnen zuverlässig nachgeholt.
- Tatsächlich: Die drei Teilschlüsse bleiben erhalten, `k3-schluss-lebt` fehlt. Erneutes Kombinieren meldet nur "Das habe ich schon aufgeschrieben". Der abschließende Schluss lässt sich in diesem Szenenzustand nicht mehr erreichen. Der weitere Hauptpfad bleibt über Haarband und Teilschlüsse spielbar.
- Nachweis: Hinweise im internen Browser tatsächlich gesammelt und kombiniert, ohne Änderung des Spielzustands durch den Test. [Nach Wiederöffnen](../output/qa/playtest-2026-10-08/kapitel-3/exploratory/04-final-missing-after-reopen.jpg), [nach erneutem Versuch](../output/qa/playtest-2026-10-08/kapitel-3/exploratory/05-final-missing-after-retry.jpg). Zustandsprotokolle liegen daneben.

### ST-004, P2: Wiederverwendetes Ost-Ziel bleibt im Tagebuch erledigt

- Bereich: Kapitel II, Waldweg nach der Mittagspause.
- Reproduktion: Kapitel II bis zum Waldweg spielen, Mittagspause abschließen, Tagebuch öffnen.
- Erwartet: "Weiter nach Osten, über die Trittsteine" ist die aktuelle offene Aufgabe.
- Tatsächlich: Das HUD zeigt den Weiterweg, im Tagebuch ist dessen wiederverwendete Aufgabe `k2-osten` aber bereits erledigt.
- Nachweis: Zusammenhängender Durchlauf `strasse → erstes-lager → foltan-azar → waldweg → eber`, [Tagebuch nach der Pause](../output/qa/playtest-2026-10-08/kapitel-2/iab-journal-after-rest.jpg). Die zusätzliche reale [Fortsetzen-Eingabe](../output/qa/playtest-2026-10-08/kapitel-2/iab-save-resumed.jpg) zeigt den älteren Szenenbeginn-Checkpoint mit "Folge den Kerben nach Osten". Das ist kein Beweis einer fehlerhaften Wiederherstellung eines mitten in der Rast gespeicherten Stands; ein solcher Browser-Save-Beleg liegt nicht vor.

### ST-005, P3: Aufbruchmarker in der Taverne führt nicht in den Ausgang

- Bereich: Teil II, `e2-taverne`.
- Reproduktion: Gespräche und Routenwahl abschließen. Beim Ziel "Aufbruch" den sichtbaren Zielmarker anklicken und Lia dort ankommen lassen.
- Erwartet: Am angezeigten Ausgangsziel wird der Übergang in die nächste Szene ausgelöst.
- Tatsächlich: Der Zielmarker liegt bei `[284, 336]`, der Ausgangstrigger beginnt erst bei `y = 342`. Lia bleibt bei ungefähr `[283.54, 333.07]` stehen. Wiederholte Klicks auf den Marker lösen den Aufbruch nicht aus. Eine kurze Bewegung nach Süden mit S löst ihn sofort aus.
- Nachweis: 30 Eingabeschritte am Marker ohne Übergang, anschließend 240 ms S und natürlicher Übergang nach `e2-bruderschaft`, ohne Teleport. [Marker ohne Übergang](../output/qa/playtest-2026-10-08/teil-2/iab/taverne-marker-idle.png).

### ST-007, P2: Escape öffnet Pause zusätzlich zum ungeschlossenen Lederbeutel

- Bereich: Kapitel I, Packdialog in der Stube.
- Reproduktion: Reisevorbereitungen abschließen, den Lederbeutel öffnen, mindestens 550 ms warten und einmal Escape drücken.
- Erwartet: Die unbestätigte Packauswahl wird geschlossen; die normale Spielansicht erscheint.
- Tatsächlich: Der Packdialog bleibt sichtbar, zusätzlich öffnet sich das Pausenmenü. Beide Oberflächen beanspruchen Tasteneingaben. Gemessen: `.k1-pack = 1`, `.menu-ov = 1`, `busy = true`, Spieler gesperrt. Zweimal im regulären Kapitelpfad reproduziert. Durch Schnüren des Beutels blieb der Hauptpfad spielbar.
- Nachweis: [Erster Versuch](../output/qa/playtest-2026-10-08/kapitel-1/iab-37-packing-canceled.png), [zweiter Versuch](../output/qa/playtest-2026-10-08/kapitel-1/iab-39-escape-packing-repro.png), [Protokoll](../output/qa/playtest-2026-10-08/kapitel-1/iab-log.json).
- Quellhinweis: `packingPanel.ts` registriert seinen Escape-Abbruch nach dem globalen Capture-Listener von `ui/context.ts`; dieser öffnet das Menü und beendet die Eventweitergabe.

### ST-008, P2: Sichtbarer Menübutton im Pflockspiel zählt als Rüttelversuch

- Bereich: Kapitel III, Kyras Pflichtminispiel, insbesondere Touchdarstellung.
- Reproduktion: Das Pflockspiel erreichen und den sichtbaren Menübutton oben rechts antippen. Alternativ Escape drücken.
- Erwartet: Pause/Einstellungen öffnen sich, der Versuch wird nicht verändert.
- Tatsächlich: Die vollflächige `.k3-veil` fängt den Menüclick ab und wertet ihn als Rütteln. Im belegten Versuch steigt der Lärm von 0 auf 28,54 Prozent; kein Pausenmenü erscheint. Escape wird ebenfalls ignoriert. Während einer beobachtenden Wache kann die vermeintliche Menüaktion den Versuch kosten.
- Nachweis: [Screenshot](../output/qa/playtest-2026-10-08/kapitel-3/exploratory/29-touch-stake-menu-blocked.jpg), [Zustand](../output/qa/playtest-2026-10-08/kapitel-3/exploratory/29-touch-stake-menu-blocked.json), [Eingaben](../output/qa/playtest-2026-10-08/kapitel-3/exploratory/iab-events.json), Eintrag `stake visible menu click`.
- Quellhinweis: `kapitel-3/panels.ts` öffnet die Modalsteuerung ohne Menüzugang und behandelt jeden `pointerdown` auf dem Panel als Rütteln.

### ST-009, P2: Geschenkziel bleibt nach Abschluss des Prologs offen

- Bereich: Prolog, Zuflucht und Übergang nach Kapitel I.
- Reproduktion: Den Prolog vollständig spielen, in der Zuflucht die Urmacht durch die Handgeste übertragen und Kapitel I erreichen. Das Tagebuch öffnen.
- Erwartet: Das Geschenkziel ist abgeschlossen; Kapitel I übernimmt kein unerledigtes Prologziel.
- Tatsächlich: Das HUD trägt während der Kapitel-I-Eröffnung weiter "Entscheide, was mit der Urmacht geschieht." Das Tagebuch führt es als offen und zählt es weiter mit. `prolog-geschenk` ist true, das gleichnamige Objective bleibt `done: false`. In einem separaten Touch-UI-Lauf erneut beobachtet.
- Nachweis: [Kapitelübergang](../output/qa/playtest-2026-10-08/prolog/desktop/iab/56-chapter1-entry.png), [offenes Ziel](../output/qa/playtest-2026-10-08/prolog/desktop/iab/60-gift-still-open.png), [Protokoll](../output/qa/playtest-2026-10-08/prolog/desktop/iab/events.json).
- Quellhinweis: `prolog/zuflucht.ts` setzt das Geschenkflag, schließt das Objective vor dem Wechsel zu `wiese` aber nicht ab.

### ST-010, P3: Automatische Wiegenposition liegt außerhalb der Interaktionsreichweite

- Bereich: Prolog, Zuflucht.
- Reproduktion: Zum ersten Mal in die Wiege schauen, die Gespräche/den Abgang der Eltern abschließen, an der automatisch eingenommenen Position erneut E beziehungsweise den Touch-Aktionsknopf drücken.
- Erwartet: Die Wiege bleibt von der vorgesehenen Standposition erreichbar.
- Tatsächlich: Kein Hinweis und keine Reaktion. Ein kleiner Schritt nach rechts stellt "Hineinsehen" wieder her und erlaubt die Geschenksequenz. Automatische Position `(476,254)`, Wiege `(502,250)`, Abstand 26,3059 bei Radius 26.
- Nachweis: [E ohne Wirkung](../output/qa/playtest-2026-10-08/prolog/desktop/iab/51-cradle-second-e-no-effect.png), [Hinweis nach Schritt](../output/qa/playtest-2026-10-08/prolog/desktop/iab/52-cradle-step-closer.png), [erreichbare Geste](../output/qa/playtest-2026-10-08/prolog/desktop/iab/53-lift-prompt.png).
- Quellhinweis: Der Standversatz `[-26,+4]` in `prolog/zuflucht.ts` überschreitet den dort definierten Radius.

### ST-011, P3: Erledigtes Ratsziel behält den Zähler 3/4

- Bereich: Prolog, Ratssaal.
- Reproduktion: Alle vier Ratsmitglieder vollständig anhören, anschließend das abgeschlossene Ziel im Tagebuch ansehen.
- Erwartet: 4/4 oder ein Text ohne unvollständigen Zähler.
- Tatsächlich: "Höre die Ratsmitglieder an (3/4)." bleibt im Abschluss-Toast und im erledigten Tagebucheintrag stehen. Alle vier Gesprächsflags sind gesetzt.
- Nachweis: [Tagebuch](../output/qa/playtest-2026-10-08/prolog/desktop/iab/61-council-counter-three-of-four.png), [viertes Gespräch](../output/qa/playtest-2026-10-08/prolog/desktop/iab/09-talk-wortfuehrer.png).
- Quellhinweis: `prolog/rat.ts` aktualisiert den Zähler nur für `n < 4` und schließt danach den alten Text ab.

### ST-012, P3: Querformat-Hinweis am Titel lässt sich nicht schließen

- Bereich: Titelbildschirm, Touchdarstellung im Hochformat 390 × 844.
- Reproduktion: Nach dem vollständigen Einblenden des Titels innerhalb der ersten zwölf Sekunden auf das sichtbare × bei "Am schönsten im Querformat" tippen.
- Erwartet: Hinweis verschwindet und die Entscheidung wird gespeichert.
- Tatsächlich: Der Click trifft `.title.is-in`. Der Hinweis bleibt sichtbar; `selantis.rotateHint.dismissed` bleibt null. Der belegte Click erfolgte nach etwa 3,6 Sekunden. Die automatische Ausblendung nach zwölf Sekunden ist kein erfolgreicher Schließen-Click.
- Nachweis: [Vorher](../output/qa/playtest-2026-10-08/prolog/desktop/iab/66-touch-hint-ready.png), [nach Click](../output/qa/playtest-2026-10-08/prolog/desktop/iab/67-touch-hint-click-blocked.png), [Protokoll](../output/qa/playtest-2026-10-08/prolog/desktop/iab/events.json), `touch-hint-ready-repro`.
- Quellhinweis: Toast-Ebene `z-index: 38`, Titel-Ebene `60`; die sichtbare Hinweis-Ausnahme hebt die Ebene nicht über den Titel.

### ST-013, P3: Erfüllte Reiseaufgaben aus Kapitel II bleiben offen

- Bereich: Kapitel II, Morgenlichtung und Waldweg.
- Reproduktion: Nach dem Frühstück mit Foltan und Azar aufbrechen, Gabelung und Mittagsrast spielen und Kapitel III erreichen. Tagebuch prüfen.
- Erwartet: Die Aufgaben zum Aufbruch und zum ersten Waldweg sind erledigt.
- Tatsächlich: `k2-aufbruch` ("Brich mit Foltan und Azar auf") und `k2-waldweg` ("Folge den Kerben nach Osten") bleiben beide offen. Beim Kapitelwechsel liefert `activeObjective()` weiterhin `k2-waldweg`.
- Nachweis: [Tagebuch](../output/qa/playtest-2026-10-08/kapitel-2/iab-journal-after-rest.jpg), [Kapitelgrenze](../output/qa/playtest-2026-10-08/kapitel-2/iab-chapter2-complete.jpg), [Zustandslog](../output/qa/playtest-2026-10-08/kapitel-2/iab-evidence.jsonl).
- Einordnung: Anders als ST-004 betrifft dies fehlende Abschlüsse zweier alter Aufgaben. ST-004 betrifft das erneute Verwenden einer bereits abgeschlossenen Aufgaben-ID.

### ST-014, P3: Abgeschlossenes Auskundschaften bleibt bei 2/3

- Bereich: Kapitel V, Schattenlager.
- Reproduktion: Felsen, Stamm und Lauschpunkt besuchen, anschließend das abgeschlossene Auskundschaftsziel im Tagebuch auswählen.
- Erwartet: 3/3 oder ein Text ohne unvollständigen Zähler.
- Tatsächlich: Der Eintrag ist erledigt, lautet aber weiterhin "Kundschafte das Lager aus, ohne gesehen zu werden (2/3)." Alle drei zugehörigen Flags sind true; das Rückkehrziel ist bereits aktiv.
- Nachweis: [Erledigtes Ziel mit 2/3](../output/qa/playtest-2026-10-08/kapitel-5/iab/bug-k5-scout-counter-detail.png), [Zustandslog](../output/qa/playtest-2026-10-08/kapitel-5/iab/states.jsonl), `bug-k5-scout-counter-detail`.

### ST-015, P3: Ausgeblendete Niederlagenkarten bleiben mit falschen HP zugänglich

- Bereich: Kapitel V, taktischer Rettungskampf, Accessibility-Baum.
- Reproduktion: Lia durch Algards Schwerthieb fallen lassen, die Niederlagenanzeige geöffnet lassen und den Accessibility-Baum prüfen.
- Erwartet: Ausgeblendete Charakterkarten sind für assistive Technik verborgen oder enthalten den tatsächlichen Endzustand mit 0 HP.
- Tatsächlich: Die visuell ausgeblendeten Karten bleiben als zugänglicher Text vorhanden. Beide HP-Einträge nennen 6/17 beziehungsweise bei der zweiten Niederlage 5/17, obwohl der gelesene Kampfzustand 0 HP und `down: dead` hat. Der folgende AX-Diff ergänzt die Niederlage, entfernt aber die HP-Karten nicht; nach über 20 Sekunden bleibt der Baum unverändert. Dies ist ein Accessibility-Bug, kein sichtbarer HP-Balkenfehler.
- Nachweis: [Echte Accessibility- und Kampfzustandslesungen](../output/qa/playtest-2026-10-08/kapitel-5/iab/bug-k5-02-accessibility-evidence.txt), [visuelle Niederlage ohne Karten](../output/qa/playtest-2026-10-08/kapitel-5/iab/rettung-defeat.png), [zweite Niederlage](../output/qa/playtest-2026-10-08/kapitel-5/iab/bug-k5-defeat-hp-stale-second.png).
- Quellhinweis: `tactics/ui/battleUi.ts` versteckt die Karten beim Ausgang über `.hidden`; diese Klasse in `style.ts` setzt `opacity: 0` und entfernt die Inhalte nicht aus dem Accessibility-Baum.

### ST-016, P3: Am Feuer bleiben schließt das Aufbruchziel trotzdem ab

- Bereich: Kapitel V, Finale.
- Reproduktion: Gespräche mit Kyra und Flick abschließen, zum südlichen Ausgang gehen und "Noch ein wenig am Feuer bleiben" wählen.
- Erwartet: Nach Rückkehr zum Feuer bleibt der spätere Aufbruch als offenes Ziel mit Wegführung verfügbar.
- Tatsächlich: Lia bleibt im Finale, aber "Brich mit Kyra und Flick auf" ist bereits erledigt und das Ziel-HUD verschwunden. Es gibt keinen offenen Auftrag mehr. Der südliche Ausgang lässt sich bei bekannter Position weiterhin erneut benutzen, daher kein Hauptpfad-Softlock.
- Nachweis: [Erledigter Aufbruch nach Bleiben](../output/qa/playtest-2026-10-08/kapitel-5/iab/bug-k5-stay-completes-departure.png), [Zustandslog](../output/qa/playtest-2026-10-08/kapitel-5/iab/states.jsonl), `finale-stay-at-fire` und `bug-k5-stay-completes-departure`.
- Quellhinweis: `kapitel-5/finale.ts` schließt `k5-aufbruch` vor der abschließenden Auswahl ab und stellt es für die Bleiben-Antwort nicht wieder her.

### ST-017, P3: Gestenbilder beschreiben für Screenreader frühere Szenen

- Bereich: Teil III, `e3-flicks-hilfe` und `e3-ritual`.
- Reproduktion: "Die Hände im Seil drehen" beziehungsweise "Die Augen öffnen" starten und die Bildbeschreibungen der Canvas-Elemente mit `role="img"` prüfen.
- Erwartet: Seilhandlung/Flick am Pfosten beziehungsweise Lia auf dem Ritualstein werden beschrieben.
- Tatsächlich: Die Seilbilder heißen "Lia versorgt ihre Ferse mit Mutters Tinktur." Die Ritualbilder heißen "Durch Lias sich öffnende Augen werden Foltan und Azar sichtbar." Die sichtbaren Bilder, Titel und Hilfetexte passen zum aktuellen Moment; die zugängliche Bildbeschreibung bleibt aus der wiederverwendeten Standardgeste zurück.
- Nachweis: [Seil-ARIA](../output/qa/playtest-2026-10-08/teil-3/late-iab/gesture-aria-flicks-hilfe.json), [Seilbild](../output/qa/playtest-2026-10-08/teil-3/late-iab/gesture-aria-flicks-hilfe.png), [Ritual-ARIA](../output/qa/playtest-2026-10-08/teil-3/late-iab/gesture-aria-ritual.json), [Ritualbild](../output/qa/playtest-2026-10-08/teil-3/late-iab/gesture-aria-ritual.png).

### ST-018, P3: Befreite Kyra wird weiter als gefesselt beschrieben

- Bereich: Kapitel V, taktischer Rettungskampf.
- Reproduktion: Mit Flick beide Seilschnitte durchführen, auf Kyras ersten freien Zug warten und ihre Einheitenbeschreibung lesen.
- Erwartet: Die Beschreibung passt zur befreiten Figur oder enthält keinen vorübergehenden Gefangenenstatus.
- Tatsächlich: "Gefesselt an die Eiche, geknebelt, wütend" bleibt stehen. Im gleichzeitig gelesenen Modell ist Kyra aktiv, `bound: false` und frei steuerbar; Bewegen und Ausweichen stehen bereit. Die nachfolgenden Bewegungen und Schubsen funktionieren.
- Nachweis: [Vollständiger Accessibility-Baum und Kampfzustand](../output/qa/playtest-2026-10-08/kapitel-5/iab/bug-k5-04-kyra-description-evidence.txt), 11:38:23 UTC. Eine separate sichtbare Detailansicht wurde nicht gespeichert; der falsche Text ist durch die tatsächliche AX-Ausgabe belegt.
- Quellhinweis: `kapitel-5/rettung.ts` setzt den Text als statische `title` der Kyra-Einheit. Nach der Befreiung wird er nicht angepasst.

## Zusätzlicher Befund aus dem Fixnachtest

### ST-019, P3: Erledigtes Tavernen-Quellenziel behält den Zähler 2/3

- Bereich: Teil II, `e2-taverne`, Quellen für den Zugang zur Bruderschaft.
- Reproduktion: Mit Craupor, Fallensteller und Schankmaid sprechen, die Routenwahl abschließen und regulär nach `e2-bruderschaft` aufbrechen. Den erledigten Eintrag `e2-zugang` prüfen.
- Erwartet: 3/3 oder ein Text ohne unvollständigen Zähler.
- Tatsächlich vor dem Zusatzfix: `done:true`, aber "Finde heraus, wie man heute zum Lager der Bruderschaft kommt (2/3)." Der natürliche Folgeszeneneinstieg ist im selben [JSON](../output/qa/bugfix-2026-10-08/st005-route-exit.json) dokumentiert.
- Lokaler Fix und erneuter Nachtest: Der Text wird vor dem Aufgabenabschluss auf 3/3 gesetzt. Alle drei Gespräche, Routenwahl und Mausaufbruch wurden erneut tatsächlich gespielt: [3/3 und erledigt](../output/qa/bugfix-2026-10-08/st019-counter-after.json), [Ansicht](../output/qa/bugfix-2026-10-08/st019-counter-after.png). Automatisierte Tests decken jede der drei Quellen als letztes Gespräch ab.

## Ursprüngliche visuelle Fehler und Artwork-Nacharbeit

Dieser Nachtrag berücksichtigt ausdrücklich Maßstab, Perspektive, Bodenkontakt, Überdeckung, Licht und die Einbindung der Objekt-/Figurensprites in das Hintergrundbild. Dafür wurden 75 vorhandene IAB-Screenshots aus allen Kapitelgruppen sowie weitere frühe Teil-III-Bilder geprüft; das Gastzimmer wurde zusätzlich im stummen internen Browser auf dem eingefrorenen Playteststand nachgeprüft. Die 14 ART-Einträge ergänzen die 17 Gameplay-/UI-Bugs. Mehrere Stellen mit demselben Nacharbeitsziel sind zusammengefasst. Nicht jeder Art-Direction-Hinweis ist ein bestätigter technischer Fehler. Sie beruhen auf den tatsächlich gespeicherten Spielansichten; reine Nacharbeitshinweise werden als solche benannt. Eine exakte neue Zeichenvorgabe oder ein pauschaler Skalierungsfaktor ist damit nicht festgelegt.

### ART-001, P3: Möbel im Teil-III-Gastzimmer sind zu groß für die Figuren

- Bereich: `e3-macht-und-schutz`, Karte `e3-gastzimmer-pruefung`, Hintergrund `e3-gastzimmer`; derselbe Hintergrund wird in den späteren Zimmersequenzen verwendet.
- Sichtbarer Fehler: Beim Doktor am hinteren Arbeitstisch liegt die Tischplatte ungefähr auf Kopfhöhe statt auf üblicher Arbeitshöhe. Bett, Truhe, Waschtisch und die rechte Zimmertür wirken im Verhältnis zu Lia und dem Doktor ebenfalls für deutlich größere Bewohner gezeichnet. Die Figuren erscheinen wie Miniaturen im Raum.
- Nachweis: [Neue, dialogfreie Gegenprüfung im stummen internen Browser](../output/qa/playtest-2026-10-08/visual/e3-gastzimmer-scale.png), [gelesene Renderdaten](../output/qa/playtest-2026-10-08/visual/e3-gastzimmer-scale.json). Beide Figuren haben eine sichtbare Höhe von 44 Weltpixeln bei `scale: 1`, Kamera-Zoom 1; die Karte setzt weder `spriteScale` noch `depthScale`. Das ist ein Ausgangswert für die Nacharbeit, kein Beweis für einen bestimmten korrigierten Faktor.
- Weitere Stelle: [Wasserschalenprüfung](../output/qa/playtest-2026-10-08/shared/water-cdp-direct-front-result.png). Bei der angeforderten Beugehandlung stehen Lia und der Doktor optisch deutlich unterhalb des gezeichneten Waschplatzes. Hier sollten nach dem Maßstabsabgleich auch die Stand-/Interaktionspunkte an die Illustration angepasst werden.
- Nacharbeit: Einen Referenzkörper neben Tisch, Hocker, Bett und Tür legen und Möbelhöhe sowie Figurengröße zusammen kalibrieren. Anschließend Laufgeometrie, Standpunkte und gegebenenfalls Tiefenskalierung prüfen. Ein größer gezeichneter Baum oder eine monumentale Ordenshaustür allein wäre kein Maßstabsfehler; dieser Befund betrifft normale Zimmermöbel und ihre Benutzung.
- Teststand: Eingefrorener Playtest-Snapshot vom 8. Oktober 2026, 11:46:20 UTC. Der visuelle Nachtest hat keine Spiel- oder Artwork-Dateien verändert.

![Maßstabsvergleich: Doktor und Lia neben den Zimmermöbeln](../output/qa/playtest-2026-10-08/visual/e3-gastzimmer-scale.png)

### ART-002, Nacharbeit: Hausmöbel in Kapitel I und im Prolog passen nicht zum Figurenmaßstab

- Kapitel I, Stube: Lia ist vor dem Esstisch ungefähr so hoch wie Tischplatte bis Tischfuß; der Hocker beim Geheimfach wirkt neben ihr ebenfalls sehr groß. Bettgestelle verstärken den Eindruck. [Tischvergleich](../output/qa/playtest-2026-10-08/kapitel-1/iab-26-house.png), [Hocker beim Geheimfach](../output/qa/playtest-2026-10-08/kapitel-1/iab-29-secret-compartment.png).
- Prolog, Zuflucht: Die Vorderkante des Esstischs reicht beim davorstehenden Valentus ungefähr in den Kopf-/Schulterbereich. Die Wiege hat dagegen ein plausibleres Verhältnis zur Figur. [Bauernstube](../output/qa/playtest-2026-10-08/prolog/desktop/iab/47-book-read.png).
- Kapitel I, Hof: Die offene Haustür ist im Verhältnis zu Lia vor der Schwelle sehr hoch. Diese Stelle hat geringere Bewertungssicherheit, da eine hohe Tür und Lias Jugend eine Rolle spielen können. [Hoftür](../output/qa/playtest-2026-10-08/kapitel-1/iab-43-farm-return.png).
- Nacharbeit: Innenraum und Hof mit derselben Referenzfigur abgleichen. Tisch-, Sitz-, Bett- und Türhöhe auf vergleichbarer Bodentiefe prüfen, danach Sprite-/Tiefenskalierung und Hintergrund zusammen abstimmen. Ein Kamerazoom allein korrigiert das Verhältnis nicht.
- Sicherheit: Hoch für den Größenunterschied bei den Stubenmöbeln, mittel für die Ursache; bei der Hoftür mittel. Die Bilder entscheiden nicht allein, ob Figuren oder Hintergrund geändert werden müssen.

### ART-003, Nacharbeit: Weitere Lagerrequisiten wirken im Verhältnis zu den Figuren sehr groß

- Kapitel IV, Übungsplatz: Die Strohpuppen sind höher und im Oberkörper breiter als die aufrechte erwachsene Figur rechts von Foltan. Auch Fässer/Kisten als Referenz prüfen. [Übungsplatz](../output/qa/playtest-2026-10-08/kapitel-4/iab-training-complete.png).
- Teil III, Falle: Lia ist vor dem Käfigwagen niedriger als dessen großes rechtes Rad; das Fass daneben überragt ihre ganze Figur. [Käfigwagen und Fass](../output/qa/playtest-2026-10-08/teil-3/late-iab/optional-cage-click-stopped.png).
- Teil III, nächtlicher Ordenssaal: Der Stuhl hinter Ignatius erreicht ungefähr seine stehende Figurenhöhe; der Tisch wirkt neben ihm sehr hoch. [Ordenssaal](../output/qa/playtest-2026-10-08/teil-3/late-iab/progress-154-e3-flicks-hilfe.png).
- Teil II, Einsiedlerlager: Der Steinring der Feuerstelle ist ungefähr viermal so breit, wie Lia hoch ist. Er wirkt eher wie ein großes Becken oder Versammlungsfeuer. [Feuerstelle](../output/qa/playtest-2026-10-08/teil-2/iab/urmacht.png).
- Teil II, Stabtraining: Das offene Holzgefäß rechts am Baum ist ungefähr figurenhoch; der zusätzliche Eimer beim vorderen Stumpf ist wesentlich kleiner. [Beide Gefäße](../output/qa/playtest-2026-10-08/teil-2/iab/stab-wrong-target.png).
- Nacharbeit: Übungspuppen, Fass/Wagenrad, Tisch/Stuhl, Feuerring und Gefäße jeweils mit einer menschlichen Referenz in derselben Tiefe prüfen. Beim rechten Holzgefäß zuerst klären, ob ein Eimer oder ein großes Sammelfass gemeint ist.
- Sicherheit: Die Verhältnisse sind sichtbar; die Fehlerbewertung ist mittel. Übergroße Übungsziele, Käfigwagen oder Feuerstellen können gewollt sein. Daher konkrete Maßstabsprüfungen statt einer pauschalen Verkleinerung aller Props.

### ART-004, Nacharbeit: Kerkerstäbe wirken zu weit auseinander

- Bereich: Teil II, `e2-flick-entkommt` und `e2-zellengespraeche`.
- Sichtbarer Eindruck: Freie Abstände zwischen Zellenstäben sind ungefähr so breit wie die schmalen Figurentorsi oder breiter. Die Gefangenen wirken dadurch stellenweise, als könnten sie hindurchpassen.
- Nacharbeit: Gitterabstände an frontaler und seitlicher Figur in derselben Bodentiefe prüfen und gegebenenfalls enger zeichnen. Türbogen, Zellenboden und Figurenmaßstab gemeinsam erhalten.
- Sicherheit: Hoch für den Bildeindruck, mittel für die genaue räumliche Durchlässigkeit. Es wurde kein tatsächliches Durchlaufen des Gitters festgestellt.
- Belege: [Flicks Zelle](../output/qa/playtest-2026-10-08/teil-2/iab/flick-alarm.png), [Zellenfront](../output/qa/playtest-2026-10-08/teil-2/iab/zellen-locked.png).

### ART-005, Nacharbeit: Zusätzliche Tavernenmöbel wirken als anders gezeichnete Spritegruppe

- Bereich: Teil II, `e2-taverne`, kleiner Tisch mit Cameogästen rechts der zentralen Säule.
- Sichtbarer Eindruck: Die kleine Tischgruppe ist kantiger und kompakter als die plastisch gemalten Tische/Bänke links. Holzton, Kanten und Schatten lassen sie wie nachträglich aufgelegte Sprites wirken. Ein Zweiertisch darf kleiner sein; die Integration ist der relevante Punkt.
- Nacharbeit: Holzmaterial, Kantenkontrast, Schatten, Beinperspektive und Sitzhöhe an die benachbarten Möbel und Gäste angleichen.
- Sicherheit: Mittel, kein allein durch seine Größe nachgewiesener Fehler.
- Belege: [Tischgruppe im Tavernenraum](../output/qa/playtest-2026-10-08/teil-2/iab/taverne-route.png), [zweite Ansicht](../output/qa/playtest-2026-10-08/teil-2/iab/taverne-marker-idle.png).

### ART-006, Nacharbeit: Tagesfarbige Baum-Sprites fallen aus der nächtlichen Lauschszene heraus

- Bereich: Kapitel V, Schattenlager, "Im Schatten lauschen".
- Sichtbarer Eindruck: Zwei freistehende Baum-Sprites sind hell gelbgrün, während der Hintergrund dunkelblau ist. Der helle Rand um die linke Baumkrone und schwache Kontaktschatten verstärken den Eindruck eines aufgelegten Assets.
- Nacharbeit: Nachtpalette, Lichtseite zur Fackel und Bodenschatten angleichen. Eine bewusste Deckungsmarkierung als klaren UI-Effekt von der Umgebungsbeleuchtung unterscheiden.
- Sicherheit: Hoch für die sichtbare Differenz, mittel für ihre Bewertung, da der Rand auch ein Deckungshinweis sein kann.
- Beleg: [Lauschminispiel mit den Bäumen](../output/qa/playtest-2026-10-08/kapitel-5/iab/schattenlager-tree-scene.png).

### ART-007, Nacharbeit: Die Pusten-Illustration zeigt die Handlung räumlich kaum

- Bereich: Kapitel III, Leselager, "Sanft pusten".
- Sichtbarer Eindruck: Lia und Azar knien weit links/rechts vom Steinkreis. Figuren, Kreis und Boden lesen sich eher als drei getrennte Piktogramme; Blick-/Kopfhaltung zeigen das gemeinsame Pusten an der Glut kaum. Der grobere helle Steinkreis fällt aus dem feineren Boden heraus.
- Nacharbeit: Figuren näher an die Glut setzen, Kopf-/Blickhaltung zum Kreis ausrichten, Bodenfläche und Kontaktschatten verbinden. Die vereinfachte Minispielgestaltung kann dabei erhalten bleiben.
- Sicherheit: Hoch für Abstand und unterschiedliche Detailwirkung, mittel für die Bewertung als Fehler einer eventuell bewusst schematischen Illustration.
- Beleg: [Pustenpanel](../output/qa/playtest-2026-10-08/kapitel-3/exploratory/08-blow-escape-ignored.jpg).

### ART-008, Nacharbeit: Ritualständer wechseln zwischen Erzählbild und Kampf ihre Form

- Bereich: Teil III, `e3-ritual` und `e3-ritualangriff`.
- Sichtbarer Eindruck: Vor/nach dem Kampf sind es schlanke Holzständer mit quadratischen Auflagen. Im Kampf stehen dort dicke, seilumwickelte Gebilde mit runden/spitzen Köpfen und dunkle Zieltafeln. Sie erinnern an Übungsziele; der Ritualort ist an diesen Gegenständen schlechter wiederzuerkennen.
- Nacharbeit: Isometrische Fassungen derselben Ritualständer verwenden. Auflage, Füße und Reliktträger zwischen Erzählkarte, Kampffeld und Nachszene wiedererkennbar halten.
- Sicherheit: Hoch für den Formwechsel, mittel bis hoch für den Nacharbeitsbedarf. Die andere Kampfperspektive allein wird nicht beanstandet.
- Belege: [Vor dem Kampf](../output/qa/playtest-2026-10-08/teil-3/late-iab/progress-196-e3-ritual.png), [Kampfobjekte](../output/qa/playtest-2026-10-08/teil-3/late-iab/progress-213-e3-ritualangriff.png), [nach dem Kampf](../output/qa/playtest-2026-10-08/teil-3/late-iab/progress-261-e3-ritualangriff.png).

### ART-009, Nacharbeit: Erzählerisch wichtige Figuren gehen im goldbraunen Laub unter

- Kapitel V, Fährte: Lia rechts unter der Feuerstelle hat fast dieselben Rot-/Brauntöne wie der Pfad. Der Fußring ist klarer erkennbar als Teile des Körpers. [Lagerstelle](../output/qa/playtest-2026-10-08/kapitel-5/iab/faehrte-camp.png).
- Teil III, Vamir-Konfrontation: Mantel, Haare und Beine verlieren sich zwischen kleinteiligen gelbgrünen Blättern. Ein vorausgehendes Verstecken kann gewollt sein; die Gesprächssituation sollte trotzdem lesbar bleiben. [Konfrontation](../output/qa/playtest-2026-10-08/teil-3/late-iab/progress-298-e3-vamir.png).
- Teil III, Ignatius' Abschied: Der orangebraune liegende Körper ist auf orangebraunem Laubboden schwer zu erkennen; hauptsächlich der weiße Bart trennt sich ab. [Abschied](../output/qa/playtest-2026-10-08/teil-3/late-iab/progress-314-e3-ignatius-abschied.png).
- Nacharbeit: Hintergrund unmittelbar hinter den Figuren beruhigen, lokalen Helligkeits-/Sättigungskontrast abstimmen oder dezente Kontur-/Schattenakzente verwenden. Ignatius auf einer ruhigeren Moosfläche würde auch die liegende Pose klarer zeigen.
- Sicherheit: Hoch für den schwachen Kontrast in den Bildern, mittel für die Bewertung bei Lia; beim Abschied ist der Nacharbeitsbedarf deutlicher.

### ART-010, Nacharbeit: Baumkrone verdeckt Lia im Vamir-Duell fast vollständig

- Bereich: Teil III, taktisches Vamir-Duell, Runde 4.
- Sichtbarer Fehler: Trotz transparenter Baumkrone ist von Lia in der Kampffeldmitte fast nur der Kopf unter dem HP-Balken sichtbar. Körper, Füße und Standpunkt verschwinden. Die Zellumrandung ersetzt die fehlende Körperkontur nur teilweise.
- Nacharbeit: Krone bei Figurenüberschneidung stärker zurücknehmen oder die verdeckte Einheit davor zeichnen. Standzelle und Fußposition sichtbar halten.
- Sicherheit: Hoch für diesen Screenshot; die Dauerhaftigkeit ist mittel, weil die Aufnahme während einer gegnerischen Aktion entstand. Die verschiedenen Animationsphasen müssen bei der Bearbeitung nachgeprüft werden.
- Beleg: [Verdeckte Lia im Duell](../output/qa/playtest-2026-10-08/teil-3/late-iab/progress-300-e3-vamir.png).

### ART-011, Nacharbeit: Valentus' Wasserkontakt beim Waten ist schwach lesbar

- Bereich: Prolog, Flucht, Bachquerung vor dem Ostufer.
- Sichtbarer Eindruck: Die Figur steht hell und scharf über der Wassertextur. Eine Wasserlinie/Kontaktwelle an den Füßen ist kaum erkennbar, während benachbarte gemalte Steine ausgeprägte Wellenränder haben.
- Nacharbeit: Kleine Wellen am Fußpunkt, passende Unterkörpermaskierung und Wasserfärbung prüfen. Stand, Gehen und Austritt am Ufer vergleichen.
- Sicherheit: Mittel bis niedrig. Ein vorhandener Effekt kann im Einzelbild gerade fehlen; kein nachgewiesener Animationsbug.
- Beleg: [Bachquerung](../output/qa/playtest-2026-10-08/prolog/desktop/iab/37-stream-crossing.png).

### ART-012, Art-Direction-Frage: Kniehohe Waldpilze als gewöhnliche oder fantastische Pflanzen einordnen

- Bereich: Kapitel II, nördlicher Waldpfad mit Foltan.
- Sichtbarer Eindruck: Breite Hüte und lange Stiele lassen Pilze neben den Baumstämmen wie kniehohe Hocker wirken.
- Nacharbeit: Wenn gewöhnliche Waldpilze gemeint sind, mit Figurenreferenz verkleinern. Wenn es Fantasiepilze sind, diese Größenklasse in der Welt bewusst und konsistent einsetzen.
- Sicherheit: Mittel für den Größenunterschied, niedrig für die Fehlerbewertung. Es wird keine Änderung einer möglicherweise gewollten Fantasiepflanze als zwingend behauptet.
- Beleg: [Nördlicher Waldpfad](../output/qa/playtest-2026-10-08/kapitel-2/iab-forest-north-deadend.jpg).

### ART-013, Art-Direction-Frage: Flicks Fluchtporträt zeigt einen gefüllten Köcher

- Bereich: Teil II, `e2-aufbruch`, Farnversteck nach der Kerkerflucht.
- Sichtbarer Eindruck: Flicks Porträt zeigt Reisegewand und einen gefüllten Köcher. Die Weltfigur ist im Farn verborgen, ihr tatsächlicher Ausrüstungszustand lässt sich im Bild nicht vergleichen.
- Nacharbeit: Festlegen, ob Porträts feste Personenkennungen oder die aktuelle Ausstattung zeigen. Im zweiten Fall eine Flucht-/Gefangenschaftsvariante ohne Köcher prüfen; im ersten Fall die feste Darstellung konsistent halten.
- Sicherheit: Hoch für den Köcher, niedrig bis mittel für einen Ausstattungswiderspruch. Kein bestätigter Inventar- oder Storybug.
- Beleg: [Fluchtporträt](../output/qa/playtest-2026-10-08/teil-2/iab/flick-farn.png).

### ART-014, Art-Direction-Frage: Magische Risse wirken eher wie flache Symbole

- Bereich: Teil III, `e3-hoffnung-und-weigerung`.
- Sichtbarer Eindruck: Dünne violette Äste bilden sternartige Formen auf der kleinteiligen Wiese. Eine Öffnung im Boden ist schwächer erkennbar als das leuchtende Symbol.
- Nacharbeit: Dunklen Spaltkern deutlicher zeichnen, Übergang zu Gras/Boden ausarbeiten oder ruhigere Position wählen. Die violette Leuchtkante kann bleiben.
- Sicherheit: Hoch für die Form, mittel für den Nacharbeitsbedarf. Die innere Welt kann absichtlich symbolisch wirken.
- Belege: [Erster Riss](../output/qa/playtest-2026-10-08/teil-3/late-iab/rift-first-before.png), [zweiter Riss](../output/qa/playtest-2026-10-08/teil-3/late-iab/progress-179-e3-hoffnung-und-weigerung.png).

Die vollständigen Bildauswahlen und weiteren unauffälligen Stellen stehen in den visuellen Detailberichten: [Prolog/Kapitel I und II](../output/qa/playtest-2026-10-08/visual-prolog-k1-k2.md), [Kapitel III bis V](../output/qa/playtest-2026-10-08/visual-k3-k4-k5.md), [Teil II](../output/qa/playtest-2026-10-08/visual-teil2.md), [später Teil III](../output/qa/playtest-2026-10-08/visual-teil3-late.md). Diese Standbildprüfung qualifiziert nicht jede Animation, Kameraposition oder Überdeckungsänderung.

## Ursprüngliche Testabdeckung

Alle 61 regulären Szenen wurden in Kapitelabschnitten gespielt. Das ist kein einzelner ununterbrochener Durchlauf von "Neues Spiel" bis zum letzten Abspann. Die Kapitel starten teils über die reguläre Kapitelwahl oder die vorgesehene E2E-Szenen-URL. Ab diesen Einstiegen entstand der dokumentierte Fortschritt durch echte Eingaben. Spielstände und Kampfzustände wurden nur gelesen; erfolgreiche Spielhandlungen wurden nicht durch gesetzte Erfolgsflags oder Teleports ersetzt.

| Abschnitt | Szenen | Gespielter Pfad und zusätzliche Prüfungen | Detailbericht |
| --- | ---: | --- | --- |
| Prolog | 4 | Neues Spiel bis Wiese; echter Schlachtsieg Runde 6, Fluchtfehler/Rücksetzungen, Geschenk, Reload/Fortsetzen; Zuflucht zusätzlich über Touch-UI. | [Prolog](../output/qa/playtest-2026-10-08/prolog/report.md) |
| Kapitel I | 4 | Wiese bis Straße; beide Heimwege, Überfall/Deckungen/Retry, vier Grabsteine, Packen/Repacking, Schweine, Save/Load. | [Kapitel I](../output/qa/playtest-2026-10-08/kapitel-1/report.md) |
| Kapitel II | 4 | Straße bis Eber; Spuren, Lagerbau, Feuerfehler, Bücher/Ferse, Sterne, Kräuter, Räuber umgehen; separat echter Räubersieg und unveränderte Belohnung/Position nach Reload. | [Kapitel II](../output/qa/playtest-2026-10-08/kapitel-2/report.md) |
| Kapitel III | 3 | Eber bis Augenbinde; alle sechs Hinweise, Notizen, Bücher, Pflock, Wachen/Retry; optionaler Begleitkampf abgelehnt/angenommen, Niederlage/Retry/Sieg/Belohnung. | [Kapitel III](../output/qa/playtest-2026-10-08/kapitel-3/report.md) |
| Kapitel IV | 3 | Augenbinde bis Bruderschaft sowie Bruderschaft bis Regenwald; Blindpfad, Blasebalg, Drill, Ablenken, Verrat/Retry, Save/Load; Drill zusätzlich per Touch-UI. | [Kapitel IV](../output/qa/playtest-2026-10-08/kapitel-4/report.md) |
| Kapitel V | 6 | Regenwald/Fährte/Schattenlager, Rettungsniederlagen und Retry; separat gewonnene Rettung mit Standard-Bluff-2-Einstieg, Finale, Weiterreise mit zwei Bonuskämpfen, Save/Load, Abspann/Titel und Teil-II-Übergang. | [Kapitel V](../output/qa/playtest-2026-10-08/kapitel-5/report.md) |
| Teil II | 18 | Alle 18 Szenen bis Credits und natürlichem Teil-III-Übergang; beide Kämpfe gewonnen, Konzentration/Stab-Fehlversuche, Nagel/Schlüssel, Schleichen/Softreset, Save/Load. | [Teil II](../output/qa/playtest-2026-10-08/teil-2/report.md) |
| Teil III, früh | 9 | Valentus bis Falle; drei Lichter/drei Kapseln, Eskorte/Trapas, Doktor/Ordenshaus, Bücher/Lauschen/Wachen-Reset, Keller/Brunnen, Flicks Seil/Schleichen, alle vier Schwester-Berichtsthemen. Natürlicher Save/Load und Nacht-Checkpoint erneut gespielt. | [Frühe Szenen](../output/qa/playtest-2026-10-08/shared/teil3-early-report.md) |
| Teil III, spät | 10 | Falle bis Epilog, Credits/Titel; Ritualangriff und Vamir-Duell gewonnen, abgeschlossenes Save geladen; zusätzlich alle drei Fallenhinweise. | [Späte Szenen](../output/qa/playtest-2026-10-08/teil-3/late-iab/report.md) |
| Gesamt | 61 | Hauptszenen, Kapitelübergänge, ausgewählte optionale Wege, tatsächliche Kämpfe, Fehler/Retry, Menü und Speichern. | |

Kapitel V ist bewusst als geteilte Abdeckung ausgewiesen: Der gewachsene Pfad führte mit misslungenem Bluff (0) zu zwei echten Rettungsniederlagen. Der Sieg wurde anschließend vom vorgesehenen direkten Rettungseinstieg mit Bluff 2 durch tatsächliche Kampfzüge erspielt. Ein Sieg mit dem gewachsenen Bluff-0-Spielstand ist nicht bestätigt. Die Schwierigkeit dieses Zweigs wird ohne Nachweis eines unlösbaren Zustands nicht als Bug gezählt.

## Umgebung und Grenzen

- Ausgangsstand: `main`, Commit `ef67f16b329c8bb4316394efce6531bfcfdf76ba`, mit beim Start vorhandenen uncommitteten Änderungen. Der ursprüngliche Playtest nahm keine Spielcodeänderungen vor. Die spätere beauftragte lokale Fixrunde ist oben separat dokumentiert. Keine Commits, Pushes oder Deployments.
- Nach der Nutzerkorrektur ausschließlich interner Codex-Browser und alle drei Audiokanäle 0. Nach der Vorgabe zur Parallelität höchstens acht aktive Agenten gleichzeitig, einschließlich Hauptagent. Audioqualität/Stereoortung wurde deshalb nicht bewertet.
- Ein anderer Task änderte während des Playtests die Quellen. Das verursachte einen HMR-Neustart und vorübergehend fehlende Asset-/UI-Dateien im frühen Teil III. Der Hauptagent fror den Stand um 11:46:20 UTC (13:46:20 MESZ) ein und spielte den Nacht-Checkpoint auf Port 5400 mit deaktiviertem HMR erneut. [Snapshot mit Quellhashes](../output/qa/playtest-2026-10-08/snapshot/source-snapshot.json). Andere Kapitelberichte geben ihren jeweiligen lokalen Lauf an. Dies ist keine Aussage über spätere Änderungen oder einen Produktionsrelease.
- Touchdarstellung und Bildschirmknöpfe wurden in mehreren Kapiteln mit emulierten Größen und echten Pointereingaben geprüft. Physische Touch-Hardware und Mehrfingerbedienung wurden nicht qualifiziert. Teil II/III haben keinen vollständigen mobilen E2E-Lauf.
- Nicht alle Dialogkombinationen, Inventarvarianten, Nebenhandlungen und Kampffähigkeiten wurden ausgeschöpft. Die Detailberichte nennen die jeweils offenen Varianten. Insbesondere liegt kein komplett durchgespielter kampagnenweiter Carry-over-Lauf von Prolog bis Teil-III-Abspann vor.
- Anfangs gestartete externe Playwright-Regressionsläufe brachen wiederholt mit geschlossenen Chromium-Prozessen beziehungsweise Grafikfehlern ab. Nach der Nutzerkorrektur wurden sie beendet. Sie sind weder bestandene E2E-Prüfungen noch bestätigte Spielabstürze. Bestehende Tests mit Teleports/Erfolgsflags zählen hier ebenfalls nicht als regulär erspielte Pfade.
- Timeouts der Testhilfen, zu frühe Dialogeingaben, unterbrochen gehaltenes Schleichen und falsch zugeordnete native Browserkoordinaten wurden mit tatsächlichen Eingaben erneut geprüft. Sie sind keine Spielfehler. Eine unbeabsichtigte Prolognavigation im Kapitel-V-Helfer wurde ohne unabhängige Reproduktion ebenfalls ausgeschlossen.

## Verworfen: ST-006, Wasserschalen-Annäherung

Die zunächst als ST-006 gemeldete Mausauffälligkeit wurde in einer gesonderten Gegenprüfung verworfen. Ein präziser echter CDP-Mausclick im internen Browser startet die Interaktion auch von vorne. Die Wegsuche führt Lia um die Kollision herum und anschließend an den vorgesehenen Standpunkt. Die frühere Beobachtung kam durch falsch zugeordnete native Browserkoordinaten zustande. Die statischen Abstandswerte allein belegen keinen Fehler. [Gegenprobe von vorne](../output/qa/playtest-2026-10-08/shared/water-cdp-direct-front-result.json), [erfolgreiche Interaktion](../output/qa/playtest-2026-10-08/shared/water-cdp-direct-front-result.png). Die ID bleibt zur Nachvollziehbarkeit reserviert und zählt weder zu den 17 ursprünglichen noch zu den nun 18 bestätigten ST-Bugs.
