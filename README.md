# Selantis

Browser-RPG mit Lia, freier Erkundung und taktischen Rasterkämpfen. Der spielbare Prolog beginnt mit Valentus. Aktuell ist es ein Prototyp.

[Spiel öffnen](https://selantis.logge.top/) · [Visuelles Konzept und Räuberlied](https://selantis.logge.top/konzept.html) · [Szenenmusik anhören](https://selantis.logge.top/musik.html)

## Lokal starten

Node.js 22 und npm:

```sh
cd game
npm ci
npm run dev
```

WASD oder Pfeiltasten bewegen die Figur, ein Mausklick setzt ein Laufziel. E interagiert. In der Erkundung öffnet I oder das Taschen-Icon das Inventar; Escape schließt es. Die Szenen unterstützen direkte Einstiege:

Auf Smartphones passt das vollständige Spielbild ins Hoch- und Querformat. Ein Steuerkreuz und große Aktionstasten unterstützen auch Halteaktionen und mehrere Finger. Tippen ins Bild bleibt möglich. Hinweise, Tasche und Einstellungen erscheinen zusätzlich in einer lesbaren Touch-Oberfläche. Auf dem Desktop bleiben Maus und Tastatur verfügbar.

Cutscenes zeigen eine Aktionstaste, deren Funktion zum aktuellen Moment passt. In der Zuflucht übernimmt E das Aufrichten, die Schritte zur Wiege und das Handheben. Beim Überfall beobachtet Lia das Gespräch und die Gefangennahme aus der Böschung; jede kurze Dialogzeile wartet auf Weiter. Während dieser Szene ist die Tasche geschlossen.

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

Weitere Karten: `felder`, `waldrand`, `hohlweg`, `hof`. `&debug` oder F1 zeigt in der Erkundung Kollisionen und Ausgänge.

Lias Einstieg beginnt mit dem kurzen Gespräch mit Kyra unter dem Baum (Roman, PDF-Seiten 9 bis 10). Danach führt eine einzige Hauptquest, "Nach Hause", über markierte Wege zum Hauseingang. Optionale Fundstücke und die Vogelrettung ersetzen dieses Ziel nicht. Die Ankunft schließt die Quest ab und geht in den Überfall über; Kyras Versprechen erklärt den Heimweg, ohne einen Sammelauftrag zu starten. Danach folgen der Morgen am Hof und die erste Reise bis zum gemeinsamen Nachtlager (PDF-Seiten 13 bis 32). Kleine markierte Interaktionen führen weiter; Lia erhält noch keine Kampf- oder Magiefähigkeiten. Die Reiseausrüstung liegt in ihrer Tasche.

## Playtest-Debug

Der kleine **Debug**-Button oben rechts oder **F2** öffnet das öffentlich zugängliche Playtest-Menü; **Escape** schließt es. Währenddessen pausieren Szenen, Tastatur und Touch-Steuerung. Das Menü ist auch auf Smartphones scrollbar und mit Tastatur bedienbar.

- Warps: Schlachtutorial, Verwundung, Flucht, Zuflucht, Lias Einstieg, alle fünf Weltkarten, Überfall, Reisevorbereitung, Straße, Nachtlager und Foltan/Azar. Jeder Warp setzt die nötigen Kapitel-Flags und Reiseausrüstung; spätere Kapitel-Flags werden zurückgesetzt.
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

Der Roman hat Vorrang bis zu seinem ausgearbeiteten Ende. Die Spielfigur heißt Lia. Der Film dient als Vorlage für das Aussehen; Spielmechanik und optionale Begegnungen sind Adaptionen.
