# Technischer Handoff für Teil 2 und Teil 3

Stand: 7. Oktober 2026. Dieses Dokument beschreibt den gelesenen Arbeitsstand und den gemeinsamen [Übergangsvertrag](transition-contract.md). Es wurde für die Vorbereitung erstellt; dabei wurden keine Spielszenen implementiert und keine Änderungen veröffentlicht. Die Typprüfung des vorhandenen Arbeitsstands wurde während der Handoff-Erstellung bestanden; eine vollständige Testsuite wurde dabei nicht ausgeführt.

## Bestehender Arbeitsstand

Repository: `LoggeL/selantis-rpg`, lokaler Branch `main`, gelesener HEAD `ef67f16b329c8bb4316394efce6531bfcfdf76ba`.

Der spielbare Inhalt umfasst den Prolog und Kapitel I bis V des ersten Buches. Die vorhandenen Ordner `kapitel-2` und `kapitel-3` sind Kapitel des ersten Buches. Sie sind **nicht** die Filmteile beziehungsweise Bücher 2 und 3. Eine optionale Szene `weiterreise` ergänzt den gemeinsamen Aufbruch nach Kyras Rettung mit wiederholbaren Begegnungen, ohne bereits das zweite Buch zu erzählen.

Der Arbeitsbaum ist nicht sauber. Beim Lesen lagen diese Änderungen vor:

```text
 M docs/ffta-battle-reference.md
 M docs/rebuild/tactics-guide.md
 M game/e2e/kapitel-5.pw.ts
 M game/e2e/prolog.pw.ts
 M game/e2e/tactics-progression.pw.ts
 M game/src/chapters/dev-tactics/index.ts
 M game/src/tactics/TacticsScene.ts
 M game/src/tactics/controller.ts
 M game/src/tactics/rules/battle.ts
 M game/src/tactics/ui/battleUi.ts
 M game/src/tactics/ui/style.ts
?? game/e2e/tactics-input.pw.ts
```

Diese Dateien gehören zu laufender Arbeit an den Kämpfen. Vor Beginn erneut `git status --short`, Branch und HEAD prüfen. Keine dieser Änderungen zurücksetzen, überschreiben oder als eigene Arbeit übernehmen. Dieser Handoff wird parallel ergänzt; auch neu hinzugekommene Dokumente und Prompts bewahren. Für eine isolierte Implementierung eine eigene Arbeitskopie verwenden und ausdrücklich prüfen, ob die laufenden Kampfänderungen darin enthalten sein sollen. Ein neuer Git-Worktree enthält uncommittete Änderungen des aktuellen Arbeitsbaums nicht automatisch.

## Einstieg in den Code

| Datei oder Bereich | Bedeutung für die Fortsetzungen |
| --- | --- |
| [`game/src/main.ts`](../../game/src/main.ts) | `import.meta.glob('./chapters/*/index.ts', { eager: true })` lädt Kapitel automatisch. Zusätzliche Phaser-Szenen kommen aus `phaserScenes` der registrierten Kapitel. |
| [`game/src/core/registry.ts`](../../game/src/core/registry.ts) | `ChapterEntry`, `SceneEntry`, `defineChapter`, `findScene` und `nextScene`. Die Registry kennt Kapitel und Szenen, bisher keine eigene Buch- oder Episodenebene. |
| [`game/src/core/G.ts`](../../game/src/core/G.ts) | Zentrale Fassade. `goto` erhält den Zustand und speichert vor `start`; `warp` setzt den Zustand zurück, ruft `prepare` auf und startet danach die Szene. |
| [`game/src/core/types.ts`](../../game/src/core/types.ts) | `SaveData`, Katalogtypen und Sprecher. Der Spielstand enthält Kapitel, Szene, Parameter, Flags, Inventar, Ziele, Erinnerungen, Wissen, Hinweise, Fähigkeiten, Gruppe und Charakterfortschritt. |
| [`game/src/core/state.ts`](../../game/src/core/state.ts) | Zustand und Autosave in einem Slot `selantis.save.v1`, Formatversion 1. Keine getrennten Slots pro Buch. |
| [`game/src/core/catalog.ts`](../../game/src/core/catalog.ts) | Globale Kataloge für Sprecher, Gegenstände, Wissen, Erinnerungen, Hinweise und Fähigkeiten. |
| [`game/src/world/api.ts`](../../game/src/world/api.ts), [`world-guide.md`](../rebuild/world-guide.md) | `MapDef`, `WorldCtx`, Karten, Erkundung, Interaktionen, Schleichen und Spurenblick. |
| [`game/src/tactics/api.ts`](../../game/src/tactics/api.ts), [`tactics-guide.md`](../rebuild/tactics-guide.md) | `BattleDef`, Einheiten, Kampfziele, Wellen und Story-Hooks. Der Taktikleitfaden und mehrere Kampfdateien werden im laufenden Arbeitsbaum verändert. |
| [`game/src/ui/api.ts`](../../game/src/ui/api.ts), [`game/src/ui/index.ts`](../../game/src/ui/index.ts), [`ui-guide.md`](../rebuild/ui-guide.md) | Dialoge, Tafeln, Buchkarten, Panels, Interaktionen, Touch-Hinweise und `UiApiExt`. |
| [`game/src/art/manifest.ts`](../../game/src/art/manifest.ts), [`art-pipeline.md`](../rebuild/art-pipeline.md) | Assetformate und Produktionsweg. Laufzeitmanifest unter `game/public/assets/manifest.json`. |
| [`game/src/audio/voiceover.ts`](../../game/src/audio/voiceover.ts) | Getrennte Sprachbanken `prolog` und `story`, Zuordnung über Text, Sprecher, Szene und Stimmung. |
| [`chapter-authoring.md`](../rebuild/chapter-authoring.md) | Praktischer Kapitel-Einstieg. Beispiele verwenden die vorhandenen Kapitel des ersten Buches. |

Erkundung wird mit `startWorld({ map, spawn, player, companions, script })` gestartet. Storykämpfe starten über `G.game.scene.start('Tactics', { battle, onEnd })`, zuvor die bisherigen Gameplay-Szenen beenden. Für freiwillige Kämpfe mit Rückkehr in dieselbe Weltinstanz stehen `playEncounter`, `saveEncounterReturn` und `startEncounterWorld` in [`chapters/common/encounters.ts`](../../game/src/chapters/common/encounters.ts) zur Verfügung. Diese Helfer schlafen die Erkundung während des Kampfes ein, sichern den Rückkehrpunkt und wecken die Welt danach wieder.

## Namen und unabhängige Umsetzung

Für die beiden separaten Aufträge gilt der [Übergangsvertrag](transition-contract.md). Seine neuen IDs sind reserviert, im Ausgangscode jedoch noch nicht implementiert:

| Teil | Kapitelordner und Kapitel-ID | Einstieg und Abschluss | Weitere IDs | Registrierung |
| --- | --- | --- | --- | --- |
| 2 | `game/src/chapters/teil-2/`, ID `teil-2` | `e2-taverne` bis `e2-aufbruch` | Präfix `e2-` für Szenen, Karten, Flags, Ziele, neue Items, Hinweise, Tafeln, Begegnungen und Sprechervarianten | `order: 6`, `numeral: 'Teil II'`, `title: 'Letzte Hoffnung'` |
| 3 | `game/src/chapters/teil-3/`, ID `teil-3` | `e3-valentus` bis `e3-epilog` | Präfix `e3-` | `order: 7`, `numeral: 'Teil III'`, `title: 'Falscher Glaube'` |

Ordner müssen direkt unter `game/src/chapters/` liegen, damit der vorhandene Glob sie findet. Zusätzliche Phaser-Szenen brauchen ebenfalls eindeutige Schlüssel, etwa `E2Training` und `E3Finale`. Die Registrierung macht den jeweiligen Teil kenntlich; dafür ist kein neues Menü- oder Registry-System erforderlich.

Bestehende Szenen-IDs und Kapitel-IDs behalten, damit alte Spielstände ihre Einstiegsszene weiterhin finden. Nur `defineChapter` prüft doppelte Kapitel-IDs. Doppelte Szenen-IDs werden bisher nicht abgewiesen; `findScene` liefert den ersten Treffer. Karten und Kataloge schreiben bei identischen IDs den vorherigen Eintrag still um. Deshalb ist der Präfix auch für scheinbar lokale Inhalte verbindlich.

Globale Sprecher nicht für eine spätere Enthüllung umbenennen. `vamir` heißt im ersten Buch `Der Meister`. Eine Teil-2-Variante wie `e2-vamir` kann Name, Porträt und später die eigene Sprachzuordnung tragen, ohne den ersten Teil rückwirkend zu verändern. Dasselbe gilt für neue Kostüme und Rollenwissen. Die vorhandenen Assets `elnon` und `tholoss` sind kein Beleg, dass die ASR-Namen `Elhon` oder `Tolos` ungeprüft übernommen werden dürfen; die fachliche Namensentscheidung steht in den Quellen- und Kontinuitätsunterlagen.

## Übergänge und Spielstände

Das heutige Ende des ersten Buches steht in [`kapitel-5/finale.ts`](../../game/src/chapters/kapitel-5/finale.ts). Die Funktion `departure` setzt `k5-ende`, inszeniert den Aufbruch und bietet danach den Buchabschluss oder die optionale `weiterreise`. Der Abschluss zeigt [`kapitel-5/credits.ts`](../../game/src/chapters/kapitel-5/credits.ts) und kehrt mit `showTitle()` zum Titel zurück. Das ist ein expliziter Übergang, kein automatisch verwendeter `nextScene`-Aufruf.

Teil 2 ergänzt eine ausdrückliche Wahl nach `e2-taverne` aus diesem Abschluss sowie der Weiterreise; die vorhandenen Abschlusswege bleiben erhalten. Alte Spielstände mit gesetztem `k5-ende` müssen den neuen Einstieg ebenfalls erreichen: Der bestehende Early Return in `departure` darf ihn nicht blockieren. Ein normaler Übergang muss `G.goto('e2-taverne')` verwenden und den vorhandenen Zustand mitnehmen. `G.warp` ist der direkte, zurücksetzende Einstieg für Kapitelwahl, F2 und `?scene=`. Die vorhandene Kapitelwahl ist automatisch auch für neu registrierte Kapitel verfügbar, warnt bei Überschreiben des einzigen Spielstands aber weiterhin nur für diesen einen Slot.

Für Teil 3 die erste Szene `e3-valentus` und `prepare()` bereitstellen, die unabhängig von fertig implementiertem Teil 2 erreichbar sind. Der direkte URL-Einstieg darf die unten beschriebene Teil-2-Endlage als ausdrücklich dokumentierte Testvorbereitung herstellen. Der Produktionsübergang aus Teil 2 verwendet später `G.goto('e3-valentus')` und übernimmt den echten Spielstand. Kein Szenenstart darf pauschal die Testvorbereitung anwenden: Das würde beim normalen Weitergehen Inventar, Entscheidungen oder Figurenfortschritt überschreiben. Solange der Übergang noch nicht integriert ist, endet Teil 2 sauber am Titel. Die Änderungen an `finale.ts`, `weiterreise.ts` und dem Übergang von Teil 2 zu Teil 3 liegen bei der Integrationsarbeit für Teil 2.

Die Registry bietet keine Mehrfachspielstände, keine Buchfreischaltung und keine Gruppierung. Diese Systeme sind für die Fortsetzung nicht vorausgesetzt. Keine Engine-Neufassung daraus machen. Falls eine echte Formatänderung erforderlich wird, den alten Slot migrieren und die alten IDs weiterhin auflösen; das heutige `load()` akzeptiert ausschließlich Version 1.

`G.goto` speichert **vor** dem Szenenskript. Änderungen während der Szene liegen zunächst nur im Arbeitsspeicher. Für einen langen Abschnitt entweder eigene Abschnittsszenen mit eindeutigen IDs verwenden oder einen klaren Checkpoint mit `G.state.save(...)` nach dem bestätigten Abschluss setzen. Ein Laden startet die gespeicherte Szene erneut. Szenenskripte müssen daraus einen gültigen, nicht blockierten Einstieg machen. Dauerhafte Fortschritte gehören in `G.state`, nicht in Modulvariablen.

Kartengedächtnis wird unter `world.mem.<mapId>` in Flags geführt, siehe [`game/src/world/memory.ts`](../../game/src/world/memory.ts). Es merkt sich unter anderem benutzte Objekte, ausgelöste Trigger und gefundene Hinweise. Bei einer erzählerisch veränderten Rückkehr dieselbe Karten-ID nur verwenden, wenn die gemerkten Zustände weiterhin passen; sonst eine neue, präfixierte Map-ID anlegen.

## Vertrag für die Kontinuität

Der [Übergangsvertrag](transition-contract.md) reserviert `e2-finished`, `e2-staff-received`, `e2-training-complete`, `e2-flick-escaped`, `e2-kyra-controlled`, `e2-elnon-struck` und `e3-finished`. Der geliehene Stab trägt die Item-ID `e2-schattentoeter`; Lias eigener späterer Stab die ID `e3-lia-staff`. Diese zwei Gegenstände nicht zusammenführen. Folgende Regeln verbinden den Vertrag mit der bestehenden Runtime:

1. **Start Teil 2:** Lia ist die Spielerfigur; `G.state.party` enthält die Begleiter `['flick', 'kyra']`. Der Weg führt zu den Rebellen. Lia hat die Urmacht erlebt; `k5-urmacht` und die Fähigkeit `urmacht` beschreiben noch keine frei beherrschte Zauberauswahl. Bei direktem Einstieg brauchbare Reiseausrüstung und die bisherigen Grundfähigkeiten vorbereiten. Bei normalem Übergang tatsächliche Funde, Packentscheidungen, Inventarmengen und Erinnerungen übernehmen.
2. **Optionaler Lichtstoß:** Die `weiterreise` kann Lia nach zwei gewonnenen Begegnungen `lichtstoss` lehren. Das steht in [`chapters/kapitel-5/weiterreise.ts`](../../game/src/chapters/kapitel-5/weiterreise.ts), [`chapters/common/travelBattles.ts`](../../game/src/chapters/common/travelBattles.ts) und [`combat-progression.md`](../combat-progression.md). Teil 2 muss sowohl einen Spielstand mit als auch ohne diese Technik unterstützen. Eine kleine gezielte Reise-Technik ersetzt Ignatius' spätere Ausbildung nicht. Den zusätzlichen Status beim normalen Übergang erhalten; bei direktem Teil-2-Einstieg nicht still voraussetzen.
3. **Gruppe und Perspektive:** `G.state.setParty(...)` setzt lediglich eine ID-Liste. Die tatsächlich sichtbare beziehungsweise spielbare Gruppe wird zusätzlich über `startWorld` (`player`, `companions`, NPCs) und die Einheiten des `BattleDef` festgelegt. Die bisherigen Szenen führen dort oft Begleiter ohne die Hauptfigur. Den vorhandenen Gebrauch übernehmen und bei Perspektivwechseln beides bewusst aktualisieren. Neue Magie oder Lesefähigkeit nicht allein wegen eines Figurenwechsels verfügbar machen.
4. **Charakterfortschritt:** `G.state.data.characters` führt EXP, Level und Waffenmeisterung pro Charakter-ID. Der Kampf lädt und schreibt über diese IDs. Lia muss daher `lia` bleiben, auch wenn das Sprite später anders heißt. Neue Figuren benötigen eine bewusste Ausgangsdefinition; das bloße Vorhandensein eines Sprites legt noch keine Kampfwerte fest. [`chapters/common/battleCharacters.ts`](../../game/src/chapters/common/battleCharacters.ts) enthält bisher keinen Kampfstartwert für Ignatius oder Gwynn.
5. **Belohnungen:** Einmalige Kämpfe und Aufträge erhalten eigene Abschlussflags. Inventarbelohnung, Figurenfortschritt und Abschluss gemeinsam sichern, bevor ein wiederholbares Nachgespräch beginnt. Verlorene Kämpfe und Wiederholungsversuche dürfen keinen dauerhaften Zuwachs liefern. Für freiwillige Begegnungen den vorhandenen Rückkehrmechanismus verwenden. Relevante Vorbilder und Reload-Prüfungen stehen in [`game/e2e/travel-encounters.pw.ts`](../../game/e2e/travel-encounters.pw.ts).
6. **Endlage Teil 2 / Start Teil 3:** Lia hat mit Ignatius trainiert und reist allein, `party` ist leer. Ignatius lebt. Flick ist aus der Gefangenschaft entkommen, aber noch nicht mit Lia vereint; Kyra ist weiterhin unter Vamirs Einfluss. Kyras Angriff auf Elnon ist geschehen; der Zusammenbruch bestätigt keine Rettung und keine endgültige Todesmeldung. Vamir lebt und besitzt die Urmacht nicht. Der geliehene Schattentöter und Lias eigener späterer Stab behalten getrennte IDs; Besitz, abgelegte Ausrüstung und tatsächlicher Zugang im Kampf werden je Szene unterschieden. Für einen eigenständigen Teil-3-Direkteinstieg diese Lage in `prepare()` ausdrücklich herstellen und als Testvorbereitung kennzeichnen. Der echte Übergang bewahrt darüber hinaus die tatsächlichen Teil-2-Entscheidungen und Fortschritte.

Die vereinbarten Start-/Endszenen, Flags, Gruppenlage und Stab-IDs können bei Bedarf in einer einfachen gemeinsamen Datei unter `chapters/common/` repräsentiert werden. Teil 3 darf diesen Vertrag und neutrale Katalogdefinitionen nutzen, soll für seinen Direkteinstieg aber keine noch nicht vorhandene Teil-2-Storydatei importieren müssen. Die Testvorbereitung darf nur für zurücksetzende Einstiege gelten; sie ist keine nachträgliche Mutation eines geladenen Teil-2-Spielstands. Vor Integration die reservierte Schnittstelle mit dem tatsächlich implementierten Teil-2-Code abgleichen.

## Grafik und weitere Materialien

Das aktuelle [`game/public/assets/manifest.json`](../../game/public/assets/manifest.json) enthält 59 Charakter-IDs, 51 Porträt-IDs, 26 Hintergrund-IDs, 27 Tafeln und 80 Requisiten. Die Zahl 45 und die Aussage, es gebe nur Demo-Hintergründe in §8 des Kapitel-Leitfadens, entsprechen dem gelesenen Laufzeitstand nicht mehr. Das Manifest ist für die tatsächliche Verfügbarkeit maßgeblich.

Bereits vorhanden sind unter anderem `lia`, `lia-cloak`, `kyra`, `kyra-bound`, `flick`, `elnon`, `ignatius`, `gwynn`, `vamir`, `paladin` und Schattengegner. Baris hat das Porträt `baris-scarred`; das ist bisher kein eigener Charakter mit Laufblatt. Die zusätzlichen Ratspersonen wie `tholoss`, `burm`, `samira` und `rikkon` dürfen nicht allein wegen ihrer Existenz als neue Figuren der Fortsetzung verwendet werden.

Die vorhandenen Hintergründe und gemalten Tafeln decken den ersten Teil und die Demos ab. Es gibt keine benannten Teil-2- oder Teil-3-Kartensätze, kein eigenes Schattentöter-Itemicon und keine verifizierte spätere Lia-Stabvariante im gelesenen Manifest. Für die Fortsetzungen einen Assetbedarf je Szene anlegen: Hintergrund, Geometrie, benötigte Figurenpose, Outfit, Porträtstimmung, Requisiten und Tafeln. Vorhandene Assets nur dort wiederverwenden, wo Ort und Situation passen.

Figurenbeschreibung und Produktionsdaten: [`scripts/art/cast.json`](../../scripts/art/cast.json), `docs/rebuild/art/*.json`; genehmigte Referenzbögen unter `docs/rebuild/art/refs/`. Für `gwynn`, `burm`, `samira` und `rikkon` fehlten dort beim Lesen gleichnamige Einzelreferenzbilder, obwohl Laufzeitassets existieren. Herkunft und vorhandene Produktionsdaten prüfen und eine geeignete Originalreferenz herstellen, bevor weitere Varianten generiert werden. Nicht anhand eines Filmframes ergänzen.

Filmframes dienen der Handlung und Inszenierungsfolge. Figuren dürfen den Filmschauspielern nicht nachempfunden werden. Aussehen kommt aus dem Roman, bestehenden Originalentwürfen und freigegebenen Figurenbögen. Türkis ist der Urmacht vorbehalten; Vamirs Magie ist kalt violett. Die bestehende Grafikpipeline unter `scripts/art/` verwenden und jedes produzierte Bild ansehen. Rohbilder liegen unter ignoriertem `output/imagegen/`; öffentliche Spielfiles gehören unter `game/public/assets/` und in das Manifest.

Recherchequellen unter `sources/` sind lokal und vollständig von Git ausgeschlossen. Ein frischer Clone enthält die Videos, Roman-PDFs, Transkripte und Frames deshalb nicht automatisch. Die vollständigen 720p-Videos der Teile 2 und 3 wurden am 7. Oktober wiederhergestellt; [`source-status.json`](source-status.json) dokumentiert Pfade, Dauer, Audio-/Videoströme, Dateihashes und dekodierte Stichproben. Dieser technische Nachweis bedeutet keine erneute vollständige Filmsichtung. Für Opus den separat vorbereiteten Materialindex beziehungsweise das Materialpaket verwenden und dessen tatsächliche Dateien prüfen. `sources/` und private Produktionsdateien niemals unter `game/public/` kopieren. Der normale Docker-Build benötigt nur vorbereitete öffentliche Assets.

## Sprachausgabe und Musik

Neue Szenen wechseln automatisch in die Sprachbank `story`; lediglich die vier bekannten Prologszenen verwenden `prolog`. Ein fehlender passender Clip lässt die normale Textanzeige weiterlaufen. Dadurch sind unvertont implementierte Szenen bereits spielbar.

Die heutige Inventarpipeline [`scripts/story_voice_inventory.mjs`](../../scripts/story_voice_inventory.mjs) scannt ausdrücklich nur `chapters/(kapitel-[1-5]|common)/`. Sie erfasst die vereinbarten Fortsetzungsordner `teil-2` und `teil-3` nicht. Auch Sprecheralias-Regeln und Spielerzuordnungen sind auf die bisherigen Kapitel ausgelegt. Teil 2 und Teil 3 brauchen separate neue Inventare oder eine bewusst erweiterte Pipeline, einschließlich Szene, Perspektive, Sprecheralias und Stimmung.

Das eingefrorene Teil-1-Inventar [`docs/voice-production/story-lines.json`](../voice-production/story-lines.json) und vorhandene Prologaufnahmen erhalten. Der gelesene Gitstand enthält kein getracktes `game/public/audio/story/manifest.json`; die Produktionsdokumentation der Kapitel-I-bis-V-Vertonung ist keine Bestätigung, dass alle Clips ausgeliefert sind. Vor einer späteren Audioarbeit den tatsächlichen Exportstand gesondert prüfen. Keine bezahlten Generierungsjobs im Rahmen dieses Implementierungshandoffs einreichen. Neue Stimmen und Aufnahmen erst nach Textabschluss und konkret beauftragter Audioproduktion erzeugen und qualifizieren.

Bestehende Musikstimmungen und Ambience stehen in [`game/src/audio/api.ts`](../../game/src/audio/api.ts), die Stücke in `output/audio/scenes/` mit Manifest. Musik, Effekte und Sprachlautstärke bleiben über ihre vorhandenen unabhängigen Einstellungen steuerbar. Neue Szenen dürfen bei deaktivierter Sprache vollständig bedienbar bleiben.

## Prüfen und abgeben

Voraussetzungen laut README: Node.js 22 und npm. Vom Projektstamm:

```sh
npm ci --prefix game
cd game
npx playwright install chromium
npm run verify
cd ..
node scripts/map_tool.mjs all
python3 scripts/art/build_manifest.py --check
```

`npm run verify` führt Typprüfung, Vitest, Produktionsbuild und alle Playwright-Tests aus. Es beinhaltet die separate Kartenprüfung und Manifestprüfung **nicht**. Während der Handoff-Erstellung bestand `npm run check --prefix game` mit dem vorhandenen Arbeitsbaum. Das belegt die Typprüfung, keinen vollständigen grünen Ausgangsstand: Vitest, Build, Playwright, Karten- und Manifestprüfung wurden für diesen Handoff nicht vollständig ausgeführt.

Für gezielte Arbeit:

```sh
npm run check --prefix game
npm test --prefix game
npm run build --prefix game
cd game
npx playwright test e2e/teil-2.pw.ts
npx playwright test e2e/teil-3.pw.ts
cd ..
node scripts/map_tool.mjs 'e2-<karten-id>'
node scripts/map_tool.mjs 'e3-<karten-id>'
python3 scripts/art/build_manifest.py --check
```

Die Beispiel-Testdateien `teil-2.pw.ts` und `teil-3.pw.ts` sind erst bei Implementierung anzulegen. Playwright lädt alle `e2e/**/*.pw.ts`, startet einen eigenen Vite-Server auf Port 5187 und verwendet keine laufende Instanz. Bei paralleler Arbeit einen eigenen Port und Ausgabeordner verwenden:

```sh
cd game
SELANTIS_E2E_PORT=5192 SELANTIS_E2E_OUTPUT=test-results/teil-2 npx playwright test e2e/teil-2.pw.ts
```

Die Kartenprüfung schreibt geometrische Bilder und JSON-Befunde nach `output/qa/maps/`. Bilder ansehen. Das Werkzeug kann ein Kapitel bei einem Importfehler überspringen und dies nur in der Ausgabe melden. Deshalb die vollständige Ausgabe prüfen und neue Karten zusätzlich gezielt mit ihrer ID aufrufen. Ein allgemeiner erfolgreicher Lauf allein beweist nicht, dass alle neuen Karten erfasst wurden.

Abnahme je Teil:

- Jede neue Szene per `?scene=<id>` mit ihrer `prepare()`-Vorbereitung laden, Assets prüfen und Konsolenfehler sowie HTTP-Fehler erfassen. Dafür die Szenenliste in [`game/e2e/smoke.pw.ts`](../../game/e2e/smoke.pw.ts) ergänzen oder gleichwertige teilbezogene Smoke-Tests anlegen.
- Übergänge durch reales Weiterspielen aus der Vorszene prüfen. Ein erfolgreicher Debug-Einstieg deckt die erhaltene Kampagne nicht ab.
- Neustart/Fortsetzen prüfen: Ziele, abgeschlossene Interaktionen, Inventar, Belohnungen, Charakterfortschritt und Rückkehrpunkt. Einen alten Teil-1-Spielstand und beide Teil-2-Varianten mit und ohne Lichtstoß verwenden.
- Für Teil 3 sowohl die dokumentierte direkte Testvorbereitung als auch einen echten Endstand von Teil 2 prüfen, sobald dieser vorhanden ist. Bis dahin diesen Produktionsübergang als noch nicht gemeinsam getestet ausweisen.
- Minispiele, Kampfzielbestätigung und Storyaktionen mit Tastatur und Touch bedienen. Keine Mechanik allein durch direktes Setzen eines Erfolgsflags abnehmen.
- Screenshots bei 1280×720 und 390×844 ansehen, ebenso einen spielbaren mobilen Querformat-Ausschnitt. Hochformat zeigt derzeit den vorhandenen Hinweis zum Drehen. Reduzierte Bewegung und deaktivierte Sprache prüfen.
- Jede Szene braucht einen sinnvollen spielerischen Kern gemäß Designgrundlage. Reine Dialogtafeln und Quellenbezüge ersetzen das Durchspielen nicht.

Die tatsächliche Implementierung und ihre geprüften Grenzen in README beziehungsweise Teil-Dokumentation nachführen. Falls ein Commit später beauftragt wird, Code, Inhalte, Assets und Tests gezielt aufnehmen. Recherchemedien, Schlüssel, private Providerantworten und temporäre Prüfdateien bleiben außerhalb des Commits.

## Veröffentlichung, falls später beauftragt

Dieser Auftrag bereitet die Umsetzung vor und autorisiert keine Veröffentlichung. Für eine später beauftragte Veröffentlichung gilt [`AGENTS.md`](../../AGENTS.md): Selantis ausschließlich durch Push geprüfter Änderungen nach `main` in `LoggeL/selantis-rpg` veröffentlichen. Dokploys GitHub-Integration deployt den Push automatisch. Keine Buildarchive hochladen, keine manuellen Deployments starten und nicht den Provider wechseln.

Nach dem Push den automatischen Deploymentstatus und die öffentliche Commit-ID prüfen:

```sh
python3 scripts/dokploy_release.py status
python3 scripts/verify_public_release.py --commit <gepushter-commit>
```

Erst erfolgreiche automatische Bereitstellung und eine passende Commit-ID in `https://selantis.logge.top/release.json` erlauben die Aussage, dass der Teil live ist. Ein lokaler Build, ein Commit und ein Push sind jeweils eigene Zustände. Git und GitHub CLI verwenden; den GitHub-Connector oder das GitHub-Plugin nicht verwenden. Vorhandene Keychain-Anmeldung erhalten und keine Zugangsdaten in Dokumente oder Befehlsausgaben übernehmen.
