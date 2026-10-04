# Selantis

Browser-RPG mit Lia, freier Erkundung und taktischen Rasterkämpfen. Der spielbare Prolog beginnt mit Valentus. Aktuell ist es ein Prototyp.

[Spiel öffnen](https://selantis.logge.top/) · [Visuelles Konzept und Räuberlied](https://selantis.logge.top/konzept.html) · [Szenenmusik anhören](https://selantis.logge.top/musik.html) · [Asset-Viewer](https://selantis.logge.top/assets.html)

Der Asset-Viewer zeigt die ausgewählten Grafiken aus dem Spielbuild mit Suche, Kategorien, Großansicht, Download und einer Einzelbildvorschau für Spritesheets. Er öffnet sich auch aus den Spieleinstellungen. Sein Katalog entsteht beim Zusammenstellen der Webseite automatisch aus den öffentlichen Grafikdateien und den Rastermaßen im Asset-Manifest.

## Lokal starten

Node.js 22 und npm:

```sh
cd game
npm ci
npm run dev
```

WASD oder Pfeiltasten bewegen die Figur, ein Mausklick setzt ein Laufziel. E interagiert. In der Erkundung öffnet I oder das Taschen-Icon das Inventar; Escape schließt es. Die Szenen unterstützen direkte Einstiege:

Auf Smartphones passt das vollständige Spielbild ins Hoch- und Querformat. Ein Steuerkreuz und große Aktionstasten unterstützen auch Halteaktionen und mehrere Finger. Tippen ins Bild bleibt möglich. Hinweise, Tasche und Einstellungen erscheinen zusätzlich in einer lesbaren Touch-Oberfläche. Auf dem Desktop bleiben Maus und Tastatur verfügbar.

Im Schlachtutorial hat Valentus pro Zug eine Bewegung bis zu vier Feldern und eine Aktion, in beliebiger Reihenfolge. Q wählt den Strahl, R die Druckwelle; Enter oder ein Rasterklick bestätigt das Ziel. Leertaste wählt Warten oder beendet den restlichen Zug. Vor den Gegneraktionen die Blickrichtung mit Pfeilen oder einem Nachbarfeld wählen und Enter beziehungsweise „Zug beenden“ drücken. Ein ausgeführter Schritt lässt sich nicht zurücknehmen. Warten schützt vorne, wenn die Aktion noch frei war; seitliche und rückwärtige Treffer verursachen mehr Schaden. Die Gegner handeln nach dem angezeigten Tempo innerhalb ihrer Zugphase. Valentus hat echte LP, der Tutorialschutz hält ihn bei mindestens einem LP.

Cutscenes zeigen eine Aktionstaste, deren Funktion zum aktuellen Moment passt. In der Zuflucht übernimmt E das Aufrichten, die Schritte zur Wiege und das Handheben. Beim Überfall beobachtet Lia das Gespräch und die Gefangennahme aus der Böschung; jede kurze Dialogzeile wartet auf Weiter. Handlungsbeschreibungen haben kein Charakterportrait. Mutters Sturz, ihr letztes "Kyra ..." und ihr Tod sind einzelne Schritte. Während dieser Szene ist die Tasche geschlossen.

| Parameter | Szene |
| --- | --- |
| `?scene=title` | Startbildschirm |
| `?scene=battle` | Valentus' Schlachtutorial |
| `?scene=break` | Verwundung |
| `?scene=flight` | Flucht |
| `?scene=refuge` | Zuflucht |
| `?scene=lia` | Lias Einstieg |
| `?scene=world&map=wiese` | Freie Erkundung |
| `?scene=raid` | Überfall auf den Hof und Kyras Entführung |
| `?scene=aftermath` | Abschied, Reisevorbereitung und Aufbruch |
| `?scene=journey` | Erste Reise, Nachtlager, Foltan und Azar |
| `?scene=companions-road` | Gemeinsamer Waldweg, Mittagsrast und Weiterreise |

Weitere Karten: `felder`, `waldrand`, `hohlweg`, `hof`. `&debug` oder F1 zeigt in der Erkundung Kollisionen und Ausgänge.

Zwischen Valentus und den Schwestern steht eine Schwarzblende mit "14 Jahre später". Kyras Holzsammeln, Waldweg und Entdecken Lias führen zum Gespräch unter dem Baum (Roman, PDF-Seiten 6 bis 10). Danach führt eine einzige Hauptquest, "Nach Hause", über markierte Wege zum Hof. Optionale Fundstücke und die Vogelrettung ersetzen dieses Ziel nicht. Beim Betreten des Hofs schließt die Ankunft die Quest ab und beginnt sofort der Überfall; Kyras Versprechen erklärt den Heimweg, ohne einen Sammelauftrag zu starten. Nach dem Überfall folgen selbst weiterlesbare Trauerkarten, die Nacht des Steinetragens und der Morgen an den Gräbern, bevor Lia packt und aufbricht (PDF-Seiten 13 bis 32). Kleine markierte Interaktionen führen weiter; Lia erhält noch keine Kampf- oder Magiefähigkeiten. Die Reiseausrüstung liegt in ihrer Tasche.

Nach dem Überfall bleiben Hof, Hohlweg, Wiese und Felder verbunden. Hufspuren auf den Feldern erklären den Weg nach Osten. Der sichtbare Feldabzweig führt zur Hauptstraße; vor der Heimkehr hält Lia wegen des Abendbrots um, später braucht sie dort ihre Reiseausrüstung. Auf der Hauptstraße kommt sie über den begehbaren Nordpfad an und kann auf diesem Weg zu den Feldern zurückkehren.

Vor dem ersten Lager erklärt Lia auf der Straße, dass es Abend wird und sie müde ist. Nach der Bestätigung blendet die Szene ins Waldlager über. Lia breitet ihren Mantel aus, sammelt Steine und Zunderholz und baut die Feuerstelle. Beim Feuerbohren treffen E oder Tippen den ruhigen Timingbereich; die Glut zeigt den Fortschritt, eine Pause erhält Holz und Fortschritt. Die Mahlzeit führt in die Tasche: Reiseproviant auswählen und "Essen" bestätigen. Erst danach legt Lia sich durch eine eigene Bettaktion schlafen.

Foltan und Azar kommen sichtbar zu der schlafenden Lia. Ihre Namen bleiben "???", bis sie sich vorgestellt haben. Danach sind die Lagerpunkte gemeinsam verfügbar: Foltan bietet eine kleine Dialogauswahl, Azar schnarcht beim Ansprechen, Lia kann am Feuer sitzen oder direkt bis zum Morgen schlafen. Der Blick zu Crios ist optional und öffnet eine kurze, selbst weiterlesbare Gedankenfolge. Bewegung oder E beendet das Sitzen. Am nächsten Morgen geht es mit beiden durch den Wald zur Mittagsrast (PDF-Seiten 40 bis 44) und über einen zweiten Waldweg zum abendlichen Hinweis auf den Goldenen Eber. Die Schenke ist noch nicht spielbar.

Beim Nest und auf Valentus' Fluchtstrecke folgt das Klettern dem Halten von E beziehungsweise der Touch-Aktion. Loslassen pausiert den Aufstieg. Während Valentus sich am Baum abstützt, bleibt er dort stehen. Erledigte Hofmarker verschwinden; das Haus bleibt betretbar. Die Lagergegenstände verwenden eigene freigestellte Grafiken für Mantel, Decke, Steine, Reisig und Feuer.

## Playtest-Debug

Der kleine **Debug**-Button oben rechts oder **F2** öffnet das öffentlich zugängliche Playtest-Menü; **Escape** schließt es. Währenddessen pausieren Szenen, Tastatur und Touch-Steuerung. Das Menü ist auch auf Smartphones scrollbar und mit Tastatur bedienbar.

- Warps: Schlachtutorial, Verwundung, Flucht, Zuflucht, Lias Einstieg, alle fünf Weltkarten, Überfall, Reisevorbereitung, Straße, Nachtlager, Foltan/Azar und den gemeinsamen Waldweg. Jeder Warp setzt die nötigen Kapitel-Flags und Reiseausrüstung; spätere Kapitel-Flags werden zurückgesetzt.
- Flags und Inventar lassen sich kontrolliert ändern (ganze Item-Anzahlen von 0 bis 999). **Änderungen anwenden** startet die aktuelle Szene neu, damit Marker und Ziele den geänderten Zustand übernehmen. Flags dürfen für Grenzfalltests absichtlich widersprüchlich sein.
- Live-Stats zeigen Szene/Bereich, Position, Phase/Schritt, Bewegungslocks, Fundstellen und besuchte Karten; im Kampf zusätzlich Einheiten-HP, Status und Rasterposition. Das Tutorial hat kein AP-System. Kampfwerte werden nur gelesen, nicht während geskripteter Aktionen verändert.
- Warps verändern Fortschritt und Reiseausrüstung; laufende Dialoge werden verworfen. **Alles zurücksetzen** braucht eine eigene Bestätigung und führt zum Titel. Das Spiel hat keinen persistenten Spielstand; Einstellungen bleiben erhalten.

Regressionen: `npm test --prefix game`. Browser-Smoke (Chromium, Desktop und Smartphone-Viewport): `cd game && npx playwright install chromium && npx playwright test`. Der Browser-Test startet bei Bedarf den lokalen Vite-Server.

## Build und Deployment

```sh
npm run build --prefix game
node scripts/assemble_site.mjs
```

Der Dockerfile baut aus dem Quellcode und liefert das Spiel mit Nginx aus. Dokploy verwendet `main`; Pushes werden automatisch veröffentlicht. Einzelheiten stehen in [docs/deployment.md](docs/deployment.md).

## Dateien

`game/src/` enthält das Spiel, `game/public/assets/` die vorbereiteten Spielassets und deren Manifest. Die beiden finalen Konzeptbilder und das Räuberlied liegen unter `output/`. `design/` und `docs/` enthalten Entwürfe und Spielregeln.

Sechs Szenenstücke von Lyria 3.5 liegen unter `output/audio/scenes/`. [Prompts und Produktionsnachweis](docs/scene-music-production.md) dokumentieren ihre Entstehung in Google AI Studio. O öffnet die Einstellungen für Musik, Effekte und Bewegung.

Originalfilme, PDFs, Transkripte, Rechercheframes, verworfene Grafikvarianten und temporäre Builddateien sind ausgeschlossen. Links in den Recherchedokumenten auf `sources/` beziehen sich auf die lokale Quellensammlung. Die Asset-Verarbeitungsskripte benötigen die lokal archivierten Originalbilder; ein normaler Spielbuild benötigt sie nicht.

Der Roman hat Vorrang bis zu seinem ausgearbeiteten Ende. Die Spielfigur heißt Lia. Lia und Kyra folgen auch im Aussehen dem Roman und sind eigenständige gezeichnete Figuren. Buch, Reiseausrüstung, Mantel und Schlafpose wechseln sichtbar mit der Handlung. Die übrigen Figuren behalten die jeweils gewählten Referenzen; Spielmechanik und optionale Begegnungen sind Adaptionen. Details stehen in [Figuren und sichtbare Ausrüstung](docs/character-novel-appearance.md).
