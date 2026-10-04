# Architektur und Erweiterungen

Das Spiel trennt Regeln, geschriebene Inhalte, technische Adapter und die Zusammensetzung der Anwendung. Der Roman bleibt die Quelle für die ausgearbeiteten Kapitel. Dialogadaptionen und zusätzliche Spielhandlungen gehören mit ihrem Herkunftshinweis zum jeweiligen Kapitelinhalt.

## Abhängigkeiten

| Verzeichnis unter `game/src/` | Verantwortung | Erlaubte Abhängigkeiten |
| --- | --- | --- |
| `modules/` | Kampagne, Inventar, Gruppe, Kampf, Erkundung und Ablaufregeln | Andere Module; keine Engine, Browser-Globals oder I/O |
| `content/` | Kapiteltexte, Gebiete, Figuren, Begegnungen und Asset-Pakete | Eigene Inhaltsdateien und ausschließlich Typen aus Modulen |
| `platform/` | Registry, Asset-Loader, Audio, Eingabegeräte und Einstellungen | Allgemeine Module, Plattformadapter und technische Asset-Metadaten; keine Kapitel- oder Szenenadapter |
| `presentation/phaser/` und `presentation/dom/` | Phaser-Szenen, Canvas- und DOM-Ansichten sowie die Umsetzung von Effekten | Module, Inhalte, Plattformadapter und gebundene Anwendungsdienste |
| `app/` | Szene registrieren, Einstieg auflösen und Ressourcen verbinden | Die konkreten Module, Inhalte und Adapter |
| `tests/` sowie Tests neben ihren Modulen | Übergreifende Regressionen und Tests der jeweiligen Zuständigkeit | Die geprüften Implementierungen und Testwerkzeuge |

`scripts/check_architecture.mjs` prüft TypeScript- und JavaScript-Dateien mit dem TypeScript-AST. Es erkennt Imports, Re-Exports, Importtypen und dynamische Imports, löst relative Pfade auf und meldet Verstöße mit Datei, Zeile, Spalte und Regel. Für reine Module und Inhalte sind externe Pakete, bekannte Phaser-/DOM-/I/O-Globals und dynamisches Nachladen gesperrt. Inhalte importieren Moduldefinitionen mit `import type` oder `import { type ... }`. Tests sind von der Produktionsgrenze ausgenommen, dürfen aber nicht in Produktionsdateien importiert werden.

Die Prüfung ist eine statische Abhängigkeitskontrolle. Ob ein übergebener Adapter korrekt aufräumt, ein Bild lesbar erscheint oder eine Handlung spielbar bleibt, prüfen die jeweiligen Integrations- und Browsertests.

## Zustands- und Lebensdauergrenzen

`modules/campaign/commands.ts` prüft Kampagnentransaktionen vollständig, bevor es Gegenstände, Flags und beanspruchte Fundstellen verändert. Abgelehnte Transaktionen verändern den Zustand nicht. Mehrfach ausgelöste einmalige Interaktionen verwenden `once` oder `pickup`. Szenen lesen den Zustand über den Registry-Adapter und geben Änderungen an diese Befehle weiter.

`modules/campaign/serialization.ts` definiert einen versionierten Datenexport und validiert den Import. Diese Grenze fügt keinen persistenten Spielstand hinzu. Die Entscheidung über Speicherung und Speicherort gehört zum Plattformadapter; Einstellungen und Kampagnenfortschritt haben getrennte Zuständigkeiten.

`modules/party/characterRules.ts` erzeugt Figurenregeln aus einem übergebenen Katalog. `app/characterRules.ts` bindet dafür die konkreten Figuren- und Begegnungsinhalte; `app/party.ts` übergibt die Regeln an den Registry-Adapter. Ansichten verwenden die gebundenen Dienste. Der Registry-Adapter importiert weder Kapitelinhalt noch die Anwendungskomposition.

`modules/exploration/mapTypes.ts` definiert die gemeinsamen Karten- und Geometrieverträge. Die konkreten Karten und ihr Wörterbuch liegen unter `content/maps/`. Navigation und Bewegung erhalten diese Daten als Argumente; Phaser zeichnet sie und führt Übergänge aus.

`modules/combat/model.ts` nimmt eine `EncounterDefinition` und einen Stat-Resolver entgegen. `dispatch` prüft Befehle und liefert Effekte. Der Szenenadapter stellt diese Effekte dar und ruft `settle(effect.id)` am vorgesehenen Wirkungspunkt auf. Wiederholtes Abrechnen derselben Effekt-ID bleibt ohne zweite Wirkung. Brettregeln erhalten eine `BattleBoard`, statt ein globales Spielfeld vorauszusetzen.

`modules/narrative/sequence.ts` hält Reihenfolge und Bereitschaft einer Sequenz. Der Adapter stellt einen Beat dar, signalisiert Bereitschaft und gibt bei Bedarf eine Aufräumfunktion zurück. Abbruch oder Entsorgung macht alte Fortsetzungen ungültig. `app/lifetime.ts` verwaltet Aufräumfunktionen auf Anwendungsebene; die Phaser-Adapter besitzen ihre szenengebundenen Listener, Timer und Ansichten.

`app/composition.ts` erstellt das Spiel, verbindet die konkreten Adapter und besitzt ihre gemeinsame Lebensdauer. Einstellungen speichern und normalisieren ihre Werte in `platform/settings.ts`; `app/settings.ts` steuert die spielgebundene Einstellungsansicht und die dafür pausierten Szenen. Die Musikdateien stehen in `content/audio/tracks.ts`, der Stimmungsvertrag in `modules/audio/types.ts` und die Zuordnung von Szenen zu Stimmungen in `app/musicPolicy.ts`. `platform/audio/runtime.ts` besitzt die technischen Wiedergaberessourcen.

Eingabegeräte veröffentlichen typisierte Absichten über `platform/input/router.ts`. Die Canvas- und DOM-Ansichten verwenden das gemeinsame Lesemodell aus `presentation/model.ts`. Bestehende `mobile:*`- und `dialogue:*`-Schlüssel bleiben für lesende Playtest-Diagnosen als Spiegel verfügbar. Sie bilden keine zweite Autorität für Kampagne, Kampf oder Eingabebefehle. Neue Ansichten verwenden die typisierten Verträge.

## Ein Kapitel ergänzen

1. Kapiteltexte und Gebietsdaten unter `content/chapters/<kapitel>/` beziehungsweise `content/areas/` anlegen. Freie Weltkarten liegen unter `content/maps/` und verwenden die Typen aus `modules/exploration/mapTypes.ts`. Die Texte erhalten stabile IDs, soweit das jeweilige Beatformat sie vorsieht, sowie einen Herkunfts- oder Adaptionshinweis. Modulverträge über Typimports verwenden.
2. Neue Regeln in einem passenden Modul ergänzen. Kapitelinhalt als Argument übergeben, wenn eine Regel darauf angewiesen ist. Reine Modultests decken Voraussetzungen, Ergebnis und Wiederholung einer Handlung ab.
3. Die Phaser-Szene unter `presentation/phaser/scenes/` und ihre Ansichten unter `presentation/phaser/` oder `presentation/dom/` ergänzen. Der Adapter übersetzt Eingaben in Befehle und Ergebnisse in Darstellung. Abbruch und Szenenwechsel müssen Listener, Timer und offene Fortsetzungen aufräumen.
4. Kapitel und Szenenschlüssel in `app/sceneCatalog.ts` registrieren. Den Szenenkonstruktor in `applicationScenes()` in `app/composition.ts` ergänzen; dessen `Record<SceneKey, SceneConstructor>` verlangt für jeden Katalogschlüssel einen Konstruktor. Die Komposition umschließt alle Szenen außer Boot mit `withSceneAssets`. Nötige Playtest-Einstiege in `modules/campaign/checkpoints.ts` registrieren. URL-Einstiege verwenden dieselben Checkpoints wie Debug-Warps.
5. Für denselben Szenenschlüssel ein Paket in `content/assets/packs.json` eintragen, auch wenn es keine eigenen Grafiken benötigt. Benötigte Grafiken im Produktionsmanifest registrieren und dem Paket zuordnen. Porträts und zusätzlich registrierte Grafiken gehören in die benachbarten Asset-Dateien. Anschließend die Asset-Prüfung und einen direkten Browser-Einstieg in die neue Szene ausführen.

## Eine Begegnung ergänzen

Eine Begegnung ist ein Inhalt unter `content/encounters/` mit dem Typ `EncounterDefinition`. Sie beschreibt logisches Brett und Renderlayout getrennt, die Spielfigur, Fähigkeiten, Gegnerregeln, Beats und Abschlussbedingungen. Schutzregeln und besondere narrative Ereignisse sind explizite Felder. Neue Regeltypen benötigen eine Erweiterung des Modulvertrags und einen verhaltenbezogenen Modultest; die konkrete Begegnung darf keine Szenencallbacks enthalten.

Die Komposition übergibt die Begegnung und den Stat-Resolver an `BattleModel`. Der Szenenadapter übersetzt die ausgegebenen Effekte in Bewegung, Animation und Dialog. Ein zweites kleines Brett oder eine zweite Begegnung in Modultests prüft, ob die Regeln ohne die IDs und Geometrie des Prologs funktionieren. Der Browser prüft anschließend Darstellung, Eingaben und Szenenübergang.

## Asset-Vertrag

Die vorhandenen Produktionsskripte schreiben weiterhin `game/public/assets/manifest.json`. `scripts/asset_catalog.mjs` übersetzt diesen Eingang zusammen mit den Asset-Inhalten in einen validierten, versionierten Laufzeitkatalog. Die gemeinsame Schema-Prüfung liegt in `platform/assets/schema.mjs`. Der Vite-Adapter liefert `assets/runtime-manifest.json` und `assets/catalog.json`; der Website-Assembler verwendet denselben Katalog und vergleicht den gebauten Laufzeitkatalog mit den aktuellen Eingängen.

Boot lädt das gemeinsame UI-Paket und das Titelpaket. Porträts gehören zu den Kapiteln mit den jeweiligen Figuren. `platform/assets/sceneAssets.ts` lädt vor dem Start einer registrierten Szene die fehlenden Texturen ihres Pakets und erstellt danach verfügbare Animationen. Geladene Texturen bleiben im Phaser-Cache.

Beim Paketumbau sank die deklarierte Grafiknutzlast für den Titelstart von 102.464.009 auf 2.634.798 Bytes, entsprechend 97,43 Prozent. Diese Werte summieren die zugeordneten Grafikdateien. Sie messen weder die tatsächlich übertragene Bandbreite noch Startdauer, Browserarbeitsspeicher oder GPU-Speicher.

## Prüfen und migrieren

Aus `game/`:

```sh
npm ci
npx playwright install chromium
npm run verify
```

`verify` führt die Architekturprüfung, ihre verbotenen Importfixtures, die Asset-Prüfung, die separate strikte Typprüfung des Browserharness, Vitest, den typgeprüften Produktionsbuild und Playwright nacheinander aus. Jeder Fehler stoppt den Lauf. Einzelne Tore sind mit `check:architecture`, `test:architecture`, `check:assets`, `check:e2e`, `test`, `build` und `test:e2e` verfügbar. `check` prüft Spielcode und Modultests; `check:e2e` prüft Browserharness und Playwright-Konfiguration separat.

Playwright startet einen eigenen Vite-Server auf Port 5187. `SELANTIS_E2E_PORT` kann einen anderen freien Port wählen. Ein belegter Port führt zum Fehler; bestehende Server werden nicht wiederverwendet. Ergebnisdateien liegen nach Port getrennt unter `game/test-results/<port>/`; `SELANTIS_E2E_OUTPUT` kann einen eigenen Ordner wählen. Dadurch überschreiben parallele Testläufe auf verschiedenen Ports ihre Fehlernachweise nicht. Der CI-Workflow unter `.github/workflows/quality.yml` installiert Chromium und führt denselben Gesamtlauf aus.

Die Produktionsimporte verwenden die Zuständigkeitsverzeichnisse; frühere `src/world/`, `src/story/` und `src/scenes/`-Pfade bestehen nicht mehr. Bei weiteren Migrationen zuerst den Modulvertrag und seine Tests ergänzen, dann die konkrete Szene und alle Aufrufer auf diesen Vertrag umstellen. Eine Implementierung besitzt jeden Zustand und jede Regel. Nach jedem Schnitt die betroffenen Modultests, den Build und die passenden Browserregressionen ausführen. Eine bestandene Quellenprüfung ersetzt keine Prüfung von Rendering und realen Eingaben.

Veröffentlichungen erfolgen über geprüfte Pushes nach `main`; Dokploy veröffentlicht automatisch. Die [Deployment-Anleitung](deployment.md) beschreibt den Status- und Commitvergleich. Dieser Refactorleitfaden trifft keine Aussage über einen veröffentlichten oder bereits abgenommenen Stand.
