# Pixelart und Nahaufnahmen im Spiel

Alle verwendeten menschlichen Figurensprites, fünf HUD-Porträts und die Charakterbilder der Cutscenes wurden mit dem eingebauten Imagegen-Werkzeug neu erzeugt oder gezielt überarbeitet. Die Weltkarten bleiben die vorhandene Pixelart-Bühne. Der Roman bestimmt Ereignisse und Reihenfolge, die Filmreferenzen bestimmen belegte Gesichter und Kleidung. Lia hat dunkelblondes bis hellbraunes, hinten gebundenes Flechthaar, eine helle geraffte Bluse und einen langen beige-senfgelben Rock. Valentus trägt die ausdrücklich gewählte blaue Robe mit hellen Partien und hat langes dunkles Haar und einen kleinen Kinnbart.

## Lieferdateien und Prompts

Die finalen, vom Browser geladenen PNGs liegen unter `game/public/assets/`. Das [Lademanifest](../game/public/assets/manifest.json) registriert die tatsächlichen Dateipfade und Zellgrößen. Große Rohbilder, abgelehnte Entwürfe und lokale Prüfbilder bleiben im ignorierten `output/imagegen/` beziehungsweise `output/qa/`. Der normale Spielbuild braucht diese Rohbilder nicht.

| Satz | Finale Dateien | Produktionsdaten mit Prompts |
| --- | --- | --- |
| Prologfiguren | `sprites/valentus-{walk,cast,cloak-run,cloak-events,refuge}.png`, `warrior.png`, `axe.png`, `crossbow.png`, `boy.png`, `falke.png`, `woman.png`; vier zugehörige Porträts | [Prologspezifikation](../design/assets/pixel-unification-prologue.json) |
| Lia und Storyfiguren | `sprites/lia-{walk,read,hide,story-poses}.png`, `story-actors.png`, `raid-horse.png`, `road-travelers.png`, `portraits/lia.png` | [Storyfiguren](../design/assets/pixel-unification-story.json), [Posen](../design/assets/pixel-unification-story-poses.json), [Porträtkorrektur](../design/assets/pixel-unification-story-portrait.json) |
| Prologbilder | `cut/wound{,-mono,-red}.png`, `woman.png`, `cradle-{sleep,empty}.png`, `hand.png` | [Cutscene-Spezifikation](../design/assets/pixel-cinematic-art.json) |
| Überfall | `cut/cinematic-raid-{cover,confrontation,kyra,loss,departure}.png` | [Cutscene-Spezifikation](../design/assets/pixel-cinematic-art.json) |
| Lias Geschichte | `cut/lia-reading.png`, `family-graves.png`, `travel-pack.png`, `camp-{rest,wake,capture,companions}.png` | [Story-Nahaufnahmen](../design/assets/pixel-story-closeups.json) |

## Bild- und Animationsvertrag

Figurenblätter haben transparente 64×64-Zellen und den Fußanker `(32, 60)`. Der Reisebegegnungsatlas benutzt 128×64-Zellen mit `(64, 60)`. Die stehende Lia ist 37 sichtbare Pixel hoch. Sitz-, Schlaf- und Duckposen behalten die Körpergröße und ändern ihre Haltung. Die frühere zusätzliche Verkleinerung des Leseblatts im Browser wurde entfernt. Die Prologfiguren teilen eine begrenzte 48-Farben-Palette, Lias Zustände eine 24-Farben-Palette. Die PNG-Aufbereitung verwendet nächster-Nachbar-Skalierung und echte Transparenz, ohne Ersatzfiguren zu zeichnen.

`lia-hide` enthält pro Richtung vier Phasen: stehen, halb ducken, tief ducken, verharren. Beim Überfall geht Lia zunächst ins Gebüsch, spielt die Duckbewegung ab und bleibt kurz sichtbar in der Hocke, bevor die Nahaufnahme einsetzt. `lia-story-poses` liefert Trauer, Packen, seitliches Schlafen, erschrockenes Aufsetzen, gefesseltes Sitzen und Stehen, Reisehaltung und Fußpflege. Kyra hat die Hände hinter dem Rücken gebunden; Lia sitzt später mit vorn gebundenen Händen und gefesselten Füßen.

Nahaufnahmen sind eigene 640×360-Bilder mit einem exakten 320×180-Pixelraster. Desktopbilder zeigen den oberen Ausschnitt von 264 Pixeln über der Dialogkarte. Auf dem Handy stehen Bild und lesbare DOM-Dialogkarte getrennt, mit einer einzigen Aktionsfläche. Ein offenes Bild wird bei einem Layoutwechsel neu zugeschnitten, ohne sein Seitenverhältnis zu verzerren. Die Dialoge warten auf die Aktion; während einer geskripteten Bewegung ist diese gesperrt. Freie Bewegung und Tasche kehren beim Schließen zurück.

Die Szene im Versteck zeigt Lias Blick, die Befragung der Familie, ihre Reaktion, Kyras Fesselung und den Abzug. Die Fesselaufnahme erscheint erst nach der tatsächlichen Fesselung. Die Reaktionsaufnahme zeigt keine Todesfolgen vor dem jeweiligen Ereignis. Weitere Bilder zeigen Lesen, Abschied, Packen, Fußpflege, Pulsprüfung, Gefangennahme und die später ungefesselten Reisegefährten.

## Prüfung

`python3 scripts/verify_pixel_delivery.py` prüft sämtliche registrierten Bilder, Atlasabmessungen, transparente Zellränder, feste Fußanker, Porträtgrößen und das 2×-Raster aller Cutbilder. Die Skripte `prepare_pixel_prologue.py`, `build_pixel_unification_story.py`, `prepare_pixel_cinematic_art.py` und `prepare_pixel_story_closeups.py` sind getrennte Aufbereitungswerkzeuge für die jeweiligen Rohbilder. Das frühere `build_prologue_assets.py` darf diesen neuen Satz nicht aus alten Quellen überschreiben.

Die automatischen Spieltests prüfen weiterhin die Erreichbarkeit der Story- und Weltziele und die Handysteuerung. Vier zusätzliche Tests prüfen Dialogaktionssperren, die Wiederherstellung der Erkundungssteuerung und den Bildausschnitt nach einem Layoutwechsel. Die visuelle Abnahme erfolgt separat durch einen Subagent und im laufenden Browser. Feine Gesichtszüge, Finger und Seile bleiben in den kleinen Sprites vereinfacht.

Prüfstand vom 3. Oktober 2026: 128 Tests bestanden und TypeScript/Vite-Build erfolgreich. Die Exportprüfung bestätigte 42 Pixeldateien, 205 belegte Atlasframes und insgesamt 1.973.884 Bytes für den erneuerten Figurensatz und die Cutbilder. Ein unabhängiger Subagent prüfte die finalen Prologfiguren, Lia-Posen, Reisebegegnungen sowie alle Überfall- und Storybilder. Die zunächst gefundenen falschen Haarfarben und angeschnittenen Köpfe wurden über Imagegen korrigiert und erneut geprüft. Die großen Nahaufnahmen haben naturgemäß mehr Schattierung und Textur als die kleinen Sprites; beide verwenden sichtbare, scharfe Pixelkanten.

Im laufenden Browser wurde die Bedienung auf Desktop sowie bei 390×844 und 844×390 geprüft. Durchgespielt wurden Lesen und Buchschließen, alle 17 Beobachtungsdialoge des Überfalls, der Schwur, Gräber und Packen sowie die Lagersequenz bis zu gelösten Fesseln, Crios-Stern und freier Bewegung. Die Tasche blieb während der Nahaufnahmen gesperrt und war danach wieder nutzbar. Ein dabei gefundener Versatz beim ersten Kartentipp nach dem Schließen wurde durch Aktualisierung der Phaser-Canvasgrenzen nach dem DOM-Layout behoben. Die Nachprüfung bestätigte übereinstimmende Grenzen und einen sofort erfolgreichen ersten Türtipp.

Zusätzlich wurden die neuen Prologfiguren in Schlacht, Flucht und Zuflucht sowie Wund- und Frauenaufnahme im Browser angesehen. Die Prologmechanik wurde in diesem Durchlauf nicht vollständig erneut gespielt. Doppelte kleine Canvas-Untertitel und Hinweise neben der mobilen Dialogfläche wurden ausgeblendet. Die kontinuierliche Haltdauer ließ sich mit dem verwendeten Computer-Use-Eingabewerkzeug nicht zuverlässig messen; die angebotene Klickalternative zum Entzünden des Feuers wurde durchgespielt.
