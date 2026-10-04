# Implementierungsplan: Prolog-Tutorial

> Aktueller Stand vom 04.10.2026: Der spielbare Prolog erzählt die tatsächlich geschehene Schlacht von Dunkelhain in der Reihenfolge Rat und Konflikt, Schlacht, Verwundung, Flucht, Rettung und Zuflucht. Die frühere Fiebertraum-Inszenierung in diesem Entwurf ist überholt. Der Axtkämpfer bleibt verwundet auf dem Feld. Valentus erhält im Tutorial Schutz vor einer Niederlage. Die aktuelle Implementierung liegt unter `game/src/scenes/`.


Stand: 3. Oktober 2026. Phase 1 liefert Konzept, Datenentwurf, Style-Frames und ein Offline-Assetwerkzeug. Die folgende `game/`-Struktur entsteht in Phase 2. [Creative Direction](creative-direction-tutorial.md) und [Konzept](tutorial-valentus.md) bestimmen die Inszenierung. Claude hat E1/E2 entschieden: Rettung als veränderter Fiebertraum; Fieberspirale bis zum ersten wirklichen Erwachen im dunklen Zimmer. Das [Storyboard](../design/intro-storyboard.json) setzt diese Entscheidungen um. Nutzervorgabe (Film-Look), Handlung bleibt Roman.

## Projektstruktur

```text
game/
  package.json                    Phaser 3, TypeScript, Vite; Versionen im Lockfile
  index.html
  tsconfig.json
  vite.config.ts
  src/
    main.ts                       640 × 360, pixelArt, Integer-Skalierung
    scenes/
      BootScene.ts                Laden, Datenvalidierung, Debug-Einstieg
      BattleScene.ts              Echtzeit-Ankunft, dann Rasterkampf
      DreamBreakScene.ts          Entsättigung, Wunde, Zerfall, Hornanschluss
      FlightScene.ts              Wegfortschritt, Tempo, Interaktionsstationen
      RefugeScene.ts              Kerzenversorgung, Echo ≤ 1 s, dunkles Erwachen, Wiege
      LiaScene.ts                 Match Cut, Buch, Holzschuhe, Bewegung, Titel
    state/
      PrologueState.ts            Zustandsmaschine, Checkpoints, Lernflags
      BattleState.ts              Reine Rasterregeln, Absichten, Vorschau
    systems/
      InputRouter.ts             Eingabe je Zustand, Tastatur und Maus
      ScriptRunner.ts            Daten-Cues, Pause/Skip, Abbruch laufender Cues
      Effects.ts                 Pixelpartikel, Licht, Zerfall, Vignette
      Audio.ts                   Synthese, Pegel, Start nach erster Eingabe
    ui/                           Portrait, Lebensbalken, Icons, eine Hilfezeile
  public/
    data/maps/                    battle.json, flight.json, refuge.json, lia.json
    data/scripts/                 battle-intents.json, break.json, refuge.json, lia.json
    data/dialogue/de.json
    data/assets.json              frameW/H, cols/rows, Animationen, fps, Fußpunkt
    data/palettes/                battle.json, flight.json, refuge.json, lia.json
    assets/backgrounds/
    assets/actors/
    assets/cutscenes/              Bildschirmfüllende Nahaufnahmen
    assets/portraits/
    assets/ui/
    assets/audio/                 Nur bei späterer Wahl lizenzierter Samples
  tests/                          Rasterregeln, Skript-Endzustände, Übergänge
scripts/normalize_pixel_assets.py Offline, bereits in Phase 1 geliefert
output/imagegen/raw/             Generierte Rohbilder und Rohsheets
design/assets/*.json             Rohsheet-Layouts und Produktionsbeschreibungen
```

Ganzzahliger Maßstab: `max(1, floor(min(containerWidth/640, containerHeight/360)))`, zentrierte Letterbox-Fläche, CSS `image-rendering: pixelated`. Unter 640 × 360 bleibt das Canvas bei 1× und darf scrollen. Pixelkoordinaten beim Rendern runden, interne Bewegung bleibt in Gleitkommazahlen. Szene und HUD liegen auf getrennten Kameras. Zoom am Wiegenweg als vorgeplante ganzzahlige Vergrößerung im gerenderten Ausschnitt, damit harte Pixel erhalten bleiben.

Die älteren Einträge in `design/asset-manifest.json` beschreiben den breiteren Spielentwurf (Tilesets, andere Feldgrößen, generierte Effekte). Für den Demo-Prolog gilt dieser Plan: Bühnenbilder plus JSON, 10 × 8-Raster, Effekte im Code. In M2 werden die überlappenden Manifest-Einträge abgeglichen.

## Szenen und Zustandsmaschine

```text
BOOT → ARRIVAL → BATTLE_PLAN ↔ MOVE_PREVIEW ↔ ACTION_PREVIEW
                    ↓ bestätigen
                 RESOLVE_PLAYER → RESOLVE_INTENTS → RESOLVE_BOY
                    ↑                                  ↓
                    └──────── nächster Beat ───────────┘
BOY_SAFE → BREAK → FLIGHT_RUN → FLIGHT_WALK → FLIGHT_LIMP
         → FALL → CARE(Kerze) → ECHO(≤ 1 s) → WAKE(dunkel, scharf)
         → STAND → CRADLE_STEPS
         → CRADLE_READY → HAND → FLASH → MATCH_CUT
         → LIA_READ → LIA_FREE → TITLE
```

- Jeder Wechsel hat Eintrittsaktion, erlaubte Eingaben und Endbedingung. Nur der Zustandscontroller wechselt Szenen. Durch Bewegung geplante Positionen werden erst mit Aktion oder Warten verbindlich.
- `RESOLVE_INTENTS` verwendet exakt die angezeigten Felder/Linien. Verdrängte Gegner verlieren ihre angekündigte Nahkampfaktion. Neue Ziele werden erst im nächsten Planungszustand angezeigt.
- `BOY_SAFE` entsteht erst, wenn der Junge den Ausgang erreicht. Ein erfolgreicher dritter Zug darf den vierten Planungszug überspringen; der Rückblick-Beat bleibt sichtbar.
- `BREAK`: `cut-wound` enthüllt die bestehende rechte Wunde; der gerettete Junge zerfällt als eines der ersten Bildteile, vor der Landschaft (E1).
- `FLIGHT_*`: weiterfallendes Fieber mit feiner, langsam atmender Randunschärfe, kein Erwachen im Wald. `FALL` führt über Schwarz zu Stimmen und `CARE` mit `bg-refuge-room-candle` / `cut-woman-face`. Das Gesicht wird lokal klarer; Randunschärfe bleibt. `ECHO` blitzt unmittelbar vor `WAKE` auf.
- `WAKE`: erstes wirkliches Erwachen, alle Randunschärfe entfernt, Bild erstmals vollständig scharf. `bg-refuge-room-dark`, Kerze erloschen; Mondlicht und später Hand-Blau sind die Lichtquellen (E2).
- Checkpoints: Battle-Start, Battle-Erfolg, Wald-Start, Erwachen, Lia-Start. Gespeichert: Schema-Version, Szene/Subzustand, Lernflags, letzte Magieaktion, Story-Entscheid-Version. Szenenwechsel schreiben atomar; Wiederaufnahme startet am passenden stabilen Punkt.
- `lastMagicAction` hält Fähigkeit, Ausgangsposition, Ziel und Treffer-/Rückstoßbilder der letzten wirklich ausgeführten Magieaktion. Warten/Blocken überschreibt sie nicht. Echo spielt diese Erinnerung höchstens 1 s nach (`maxMs: 1000`, K5).
- Cutscene-Skip: Escape 1,5 s halten; beim ersten Sehen erst nach 3 s freigeschaltet, danach sofort. Pause stoppt Audio, Tweens und Cues. Skip beendet laufende Cues, wendet den definierten Endzustand einmal an und wechselt weiter. Eigene Spieleingaben an Waldstationen, Wiegenweg und Hand bleiben erhalten.
- Debug: `?scene=battle|break|flight|refuge|lia`. Jeder Einstieg erzeugt passende feste Vorzustände; `break` erhält einen geretteten Jungen, `refuge` eine gespeicherte Beispiel-Magieaktion. Keine Abhängigkeit von einem früheren Browserlauf.

## Datenformate

Laufzeitformate haben `schemaVersion: 1`; Boot validiert Maße, IDs, Frame-Indizes, Feldgrenzen und Cue-Typen. Storyboard ist Regiegrundlage, Laufzeit-Skripte werden daraus separat verfasst.

**K1, datengetriebene Sprite-Layouts:** `game/public/data/assets.json` ist der Laufzeitvertrag: `frameW`, `frameH`, `cols`, `rows`, Animation → Frame-Indizes mit `fps`, Fußpunkt `footPx`, Datei und Palette. Boot lädt und erzeugt Animationen daraus; Szenen enthalten keine festen Sheet-Spalten oder Richtungszeilen. `design/assets/*.json` beschreibt Rohsheets, Reihenfolge, Quellmaße und Normalisierungsziel. M2 überträgt die geprüfte Belegung in den Laufzeitvertrag.

Beispiel für die Datenform, keine verbindliche Sheet-Belegung:

```json
{
  "schemaVersion": 1,
  "assets": [{
    "id": "valentus-robe", "kind": "sprite",
    "file": "assets/actors/valentus-robe.png",
    "frameW": 32, "frameH": 48, "cols": 8, "rows": 4,
    "footPx": [16, 44], "palette": "battle",
    "animations": {
      "idle-south": {"frames": [0, 1], "fps": 4},
      "walk-south": {"frames": [2, 3, 4, 5], "fps": 8},
      "cast-south": {"frames": [6, 7], "fps": 8}
    }
  }]
}
```

Frame-Indizes sind nullbasiert, zeilenweise. Boot prüft `sheetW = frameW * cols`, `sheetH = frameH * rows`, gültige Indizes, positive fps und Fußpunkte innerhalb des Frames. Statische Bilder haben Asset-ID und Maße, ohne Sprite-Layout.

**Raster:** Orthogonale Felder mit erhöht gezeichneten Figuren; Bildschirm-X folgt Feld-X, Bildschirm-Y folgt Feld-Y. 32 × 32 px, Ursprung `[160,64]`, Feldzentrum `[160+32*x+16,64+32*y+16]`. Koordinaten nullbasiert, Y wächst hangabwärts. Höhenzeichnung verändert in dieser Demo keine Reichweiten.

```json
{
  "schemaVersion": 1,
  "id": "battle",
  "background": "assets/backgrounds/battle-dream.png",
  "worldPx": [640, 360],
  "grid": {"originPx": [160, 64], "cellPx": 32, "size": [10, 8]},
  "solidCells": [[8, 4], [8, 5]],
  "blocksSightCells": [[8, 4], [8, 5]],
  "markers": {"valentus": [2, 3], "boy": [6, 3], "safeExit": [6, 0]},
  "routes": {"boyEscape": [[6, 3], [6, 2], [6, 1], [6, 0]]}
}
```

Die beiden Zellen stellen einen sichtbaren Felsen dar. Figurbelegung bleibt im BattleState, getrennt von statischer Kollision. Für Wald, Zimmer und Lia: `worldPx`, Hintergrunddatei, Rechtecke/Polygone in Pixelkoordinaten, Fuß-Kollisionsradius 6 px, Trigger mit `id`, `boundsPx`, `interaction`, `nextMarker`. Wald enthält einen Weggraph mit Stationen und Distanzfortschritt; Zimmer enthält eine feste Acht-Schritt-Route. Dekorative Baumkronen erhalten eigene Vordergrundmasken, Stämme definieren Kollision.

**Absichten und Cues als Daten:**

```json
{
  "schemaVersion": 1,
  "beat": "axe",
  "spawns": [{"id": "axe", "cell": [5, 3], "hp": 60}],
  "intents": [{"actor": "axe", "kind": "melee", "icon": "axe", "targetActor": "boy", "targetCells": [[6, 3]], "damage": 20}],
  "advanceWhen": "axe_threat_resolved"
}
```

```json
{
  "schemaVersion": 1,
  "id": "cradle-hand",
  "cues": [
    {"op": "showImage", "asset": "cut-cradle-sleep", "fullscreen": true},
    {"op": "wait", "ms": 1000},
    {"op": "dialogue", "key": "cradle.apology"},
    {"op": "awaitInput", "action": "beam", "edge": "down"},
    {"op": "showImage", "asset": "cut-cradle-hand", "fullscreen": true},
    {"op": "effect", "id": "cradleBlue", "anchor": "cradle.center", "ms": 1600},
    {"op": "effect", "id": "flash", "ms": 350},
    {"op": "sound", "id": "cradleBang"},
    {"op": "setFlag", "key": "valentusAbsent", "value": true},
    {"op": "showImage", "asset": "cut-cradle-empty", "fullscreen": true},
    {"op": "wait", "ms": 500},
    {"op": "effect", "id": "whiteReturn", "ms": 250},
    {"op": "transition", "to": "lia", "style": "whiteSunMatch"}
  ],
  "skipEndState": {"valentusAbsent": true, "next": "lia"}
}
```

`showImage` blendet das benannte 640 × 360-Cutscene-Bild über die Spielansicht; Licht und Effekte liegen darüber. Weitere erlaubte Ops: `wait`, `camera`, `subtitle`, `spawn`, `despawn`, `setPose`, `checkpoint`. Länger dauernde Cues werden awaited; parallele Effekte stehen ausdrücklich in einer `parallel`-Gruppe. Dialogdaten: `{id, speaker, text, minMs, voiceStyle}`; Gedankenstimme hat `speaker: "Valentus"`, `voiceStyle: "thought"`. Die kurzen Romanzeilen stehen zentral in `de.json`. Skip des rein filmischen Teils am Wiegenrand beginnt erst nach der bestätigten Hand-Eingabe.

## Kampfregeln mit Zahlen

| Regel | Wert / Verhalten |
| --- | --- |
| Bewegung | 4 orthogonale Schritte pro Zug, jede freie Zelle kostet 1; Pfad blockiert an Fels oder stehender Figur. Rücknahme bis zur bestätigten Aktion. |
| Aktion | Eine Magieaktion oder Warten pro Zug; Bewegung davor optional. Treffer deterministisch, Zauber sofort verfügbar. |
| Leben | Valentus 100/100 im Traum, tatsächlicher Schadensabzug 0; Junge 20; Krieger je 60; Axtkämpfer 60; Armbrustschütze 40. Traumbruch setzt Anzeige auf 12/100. |
| Strahl | 6 Felder Länge, 1 Feld Breite; 8 Rasterrichtungen (orthogonal/diagonal), 100 Schaden an jeder getroffenen Figur, durchdringt Figuren und endet vor Sichtblockern. Diagonale Schritte zählen als ein Strahlfeld; an einer Ecke mit mindestens einem angrenzenden Sichtblocker stoppt der Strahl. Freundtreffer erscheinen rot in der Vorschau. |
| Druckwelle | Mittelpunkt höchstens 4 Manhattan-Felder entfernt, 3 × 3-Feldfläche um den Mittelpunkt, an Feldrand abgeschnitten. Präzise Wirkung ausschließlich auf Feinde, 80 Schaden und 2 Felder Rückstoß vom Mittelpunkt weg. Überträgt sich nicht durch Sichtblocker; Sichtprüfung zum Mittelpunkt und je betroffenem Feind. |
| Rückstoß | Richtung vom Flächenmittelpunkt zum Gegner, größte Koordinatendifferenz entscheidet Achse, Gleichstand X zuerst; am Mittelpunkt Richtung von Valentus zum Gegner. Vorschau zeigt Pfad und Endfeld. Hindernis/Kartenrand/stehende Figur stoppt davor; 40 Kollisionsschaden an gestoßenem Feind und, bei feindlicher Figur, am Kollisionspartner. Verbündete werden nicht beschädigt. |
| Reihenfolge | Vorschau berechnet Treffer und Rückstoß gemeinsam; Ausführung zeigt Stoß, dann Schadensauflösung. Auch tödlich getroffene Gegner werden sichtbar geschleudert. Mehrfachstöße: feste Actor-ID-Reihenfolge, dieselbe Reihenfolge in der Vorschau. |
| Nahkampf | Krieger 15 Rohschaden, Axt 20; fest angekündigtes Nachbarfeld. Valentus hält sichtbar stand; Axt gegen Jungen wäre tödlich, greift deshalb die Schutz-/Wiederholregel. |
| Armbrust | 8 Felder, erster Körper oder Fels hält Bolzen auf, 20 Rohschaden; fest gezeichnete Linie, vor Auflösung wird die neue Belegung auf dieser Linie geprüft. |
| Feedback | Strahl: 80 ms Freeze-Frame, 120 ms Bildstoß bis 2 px. Druckwelle: 220 ms Stoßanimation, 100 ms Bildstoß bis 1 px. Planansicht danach exakt wiederherstellen. |

Die Druckwelle hat eine andere Zielregel als der Strahl: Der Mittelpunkt legt die Fläche und den nach außen gerichteten Stoß fest. Das schützt den Jungen im Flächenkern und macht die Rückstoßvorschau verständlich. Diese Regel ist eine konkrete Spieladaption der präzisen Druckwelle.

### Feste Skriptabsichten und lösbarer Musterverlauf

| Beat | Aufstellung und angekündigte Absicht | Spielerentscheidung / Fortschritt |
| --- | --- | --- |
| 1, Linie | Valentus `[2,3]`; Krieger `[5,3]` und `[7,3]`. Beide kündigen Annäherung entlang der Reihe und Angriff auf Valentus an, markiert mit Laufspur und Schwertern. | Von `[2,3]` nach Osten strahlen trifft beide innerhalb von 6 Feldern. Wer wartet, sieht die Krieger höchstens 2 Felder zum letzten freien Feld vor Valentus vorrücken; nächste Absicht wird neu angezeigt. Beat endet erst nach beiden Treffern. |
| 2, Axt | Junge `[6,3]`, Axtkämpfer `[5,3]`, Hieb auf `[6,3]`. | Valentus kann nach `[4,4]` gehen (3 Schritte) und Druckwelle auf `[6,3]` richten (Distanz 3). Der Axtkämpfer wird westwärts bis `[3,3]` geschleudert und besiegt. Ein Strahl von `[4,3]` nach Osten würde Axt und Jungen treffen. |
| 3, Bolzen | Schütze `[6,7]`, Linie nach Norden auf Junge `[6,3]`. Junge richtet sich auf. | Von `[4,4]` erreicht Valentus `[6,5]` in 3 Schritten. Warten fängt den Bolzen ab; Strahl nach Süden besiegt den Schützen und gibt die schnelle Drei-Zug-Lösung frei. |
| 4, Flucht | Nach abgefangenem Bolzen lädt der Schütze einen Zug lang nach (Stundenglas, markierter eigener Stand). Junge folgt `[6,3] → [6,0]`. | Spieler gibt den Ausgang frei und wartet oder beseitigt den nachladenden Schützen. Junge erreicht die Reihen; sein Rückblick und die Nackenabsicht beginnen den Bruch. |

Die Jungenroute wird vor dem Übergang auf Belegung geprüft; eine blockierende Valentus-Position wird als belegtes Ausgangsfeld markiert. Der Junge wartet, bis sie frei ist. Gegner wählen weder Zufallsziele noch spontane neue Opfer. Überlebende Gegner behalten ihren Beat, bis dessen Gefahr gelöst ist.

Schutzregel: Erste Aktion, die den Jungen treffen ließe (auch Freundstrahl), wird vor der Auflösung durch eine kurze Falken-Intervention abgefangen; danach vollständiger Snapshot des aktuellen Beats zurück in die Planung. Strahl-Freundtreffer erhalten vorab eine zusätzliche Gefahrenbestätigung. Weitere gefährliche Bestätigungen bleiben in der roten Vorschau. Ab dem fünften Planungsversuch pulsiert die Bedienhilfe zur aktuellen Vorschau; der Spieler bestätigt weiter selbst. Das ist Tutorialhilfe, keine zusätzliche kanonische Rettung durch den Falken.

## Flucht, Wiegenweg und Übergang

- K4, Wald: `bg-flight-a` und `bg-flight-b` (je 640 × 360) stehen bei `[0,0]` und `[640,0]` nebeneinander, Welt 1280 × 360. Weglänge und Tempo stehen in `flight.json`; Ziel sind 45–60 s aktive Spielzeit inklusive Stationen. Startwerte für etwa 1120 px Weg: 32 / 24 / 16 px/s bei 0–35 / 35–70 / 70–100 % Fortschritt, Übergänge über 2 s. Im Durchspieltest auf den tatsächlichen Weg abstimmen. Randunschärfe atmet durchgehend; Pausen erhöhen Druck nur bis zum gedeckelten Audio-/Vignettenpegel. Verfolger sind Bildrand-/Klanginszenierung.
- Stationen: Wurzelstolpern 0,6 s; Bachsprung mit E, 1,2 s; Hang hochziehen mit E 2,5 s halten; Stamm mit E 1,8 s abstützen; glitschiger Stein löst Sturz aus. Haltefortschritt bleibt beim Loslassen bestehen. Gesamte aktive Waldzeit 45–60 s, frei pausierbar.
- Q/R im Wald: 150 ms blaues Glimmen, 400 ms Erlöschen; 1 s Wiederholsperre für Klang, ohne Kampfwirkung. Rechtsseitige Blutspur und Herzschlag bleiben sichtbar/hörbar.
- Zimmer: E 2,4 s zum Aufstehen; acht feste Schritte zu je 18 px entlang autorisierter Route, jeweils neue Richtungseingabe, 2 s Taumelanimation plus 0,6 s Atemruhe. Gehaltene Richtung wiederholt sich hier nicht. Bedienhinweis nennt die neue Eingabe. Pausen lassen Valentus am letzten Schritt ruhen.
- K3, Wiegenkante: Die Wiege im Raum ist Teil von `bg-refuge-room-dark`. Am Ende der Schrittsteuerung übernimmt bildschirmfüllend `cut-cradle-sleep`: beide Kinder, eine Sekunde Stille, Gedankenzeile, neue Q-Eingabe. Danach `cut-cradle-hand`: Handlicht-Anker über der Mitte, Wiegenkante verdeckt die Zielseite. Beide Kinder behalten gleiche Decke, Lichtwerte und Bildgewicht. Keine separaten Wiegen-/Säuglingssprites.
- Blitzfolge: 350 ms Ausbrennen, Knall, 500 ms dunkler Nachblick als `cut-cradle-empty` mit zwei Schreien und leerem Platz (beide Kinder bleiben); 250 ms Rückkehr zu Weiß. Match Cut hält das Lichtzentrum und legt darunter Lias Sonnenbild frei (1,2 s). Portraitwechsel zu LIA erst mit ihrer Kontrollübernahme.
- Lia: Buch schließt sich, Holzschuhe anziehen, WASD/Pfeile mit 72 px/s. Nach mindestens 3 s eigener Bewegung und 96 px Weg erscheint SELANTIS. Eigener Zustand, Interaktion als einzige aktive Fähigkeit.

## Asset-Liste

Maße sind Produktionspixel, PNG/RGBA. Rohbilder liegen unter `output/imagegen/raw/`, Beschreibungen unter `design/assets/*.json`. Figuren bleiben klein und ungetrimmt; Frame-Maße, Richtungsbelegung, Animationen, fps und Fußpunkte werden pro Sheet in `public/data/assets.json` festgelegt (K1). Valentus/Lia brauchen vier Richtungen, Gegner dürfen zwei plus Spiegelung nutzen.

Nutzervorgabe (Film-Look), Handlung bleibt Roman: Valentus hat lange dunkle Haare mit Mittelscheitel, schmalen Kinnbart, dunkelblaue Robe mit hellen Längsbahnen und Gürtel mit ovaler Schnalle; bei der Flucht dunkle Strähnen unter der Kapuze. Lia folgt Film-Triss: hellbraun bis dunkelblond, seitlich geflochten, weiße geraffte Bluse, beige-senfgelber Rock, dunkler geflochtener Gürtel. Banner aus Film Folge 1: blau-weiß radial mit geflügeltem Zeichen / schwarz-weiß geviertelt.

| Asset-ID | Zielmaß / Layout | Inhalt |
| --- | --- | --- |
| `bg-battle-dream` | 640 × 360 | Hangbühne, Fels gemäß Rasterdaten, Heere und Film-1-Banner. |
| `bg-flight-a`, `bg-flight-b` | Je 640 × 360 | Zwei anschließende Waldhälften, zusammen 1280 × 360; Stationen gemäß Wegdaten. |
| `bg-refuge-room-candle` | 640 × 360 | Zimmer mit Bett, Tür, Regalen und Wiege; Kerze brennt nur bei CARE. |
| `bg-refuge-room-dark` | 640 × 360 | Derselbe Raum und dieselbe Wiege, Kerze erloschen, Mondlicht; WAKE und Schrittsteuerung. |
| `bg-lia-sunset` | 640 × 360 | Baum, Sommerwiese, Abendgegenlicht, Lias Sitzplatz frei. |
| `cut-wound` | 640 × 360 | Wundnahaufnahme für den Traumbruch. |
| `cut-woman-face` | 640 × 360 | Frau aus Bett-Perspektive im Kerzenlicht; Blur im Code. |
| `cut-cradle-sleep` | 640 × 360 | Bildschirmfüllende Nahaufnahme, zwei gleich eingehüllte schlafende Kinder. |
| `cut-cradle-hand` | 640 × 360 | Bildschirmfüllende Nahaufnahme, Hand über der Mitte, Zielseite verdeckt. |
| `cut-cradle-empty` | 640 × 360 | Bildschirmfüllender Nachblick: Valentus verschwunden, beide Kinder bleiben und schreien. |
| `valentus-robe` | Sheet laut Manifest | Filmrobe: idle, walk, cast. |
| `valentus-wounded-cloak` | Sheet laut Manifest | Filmlook unter Kapuze: idle, walk, stumble, pull, collapse. |
| `valentus-bandaged` | Sheet laut Manifest | Mantel abgelegt, Bauchverband: idle, step, stand. |
| `black-warrior`, `axe-fighter`, `crossbowman` | Je Sheet laut Manifest | Menschliche Soldaten, schwarz-weiße Wappenröcke; idle, walk, attack, hurt. |
| `boy` | Sheet laut Manifest | Etwa 16 bis 17, hell/blau-weiß; prone, rise, escape, lookback. |
| `falcon-soldier` | Sheet laut Manifest | Blau-weiß, zwei Kurzschwerter; run, intervene, idle, hurt. |
| `refuge-woman` | Sheet laut Manifest | Rötliche Locken, braunes Kleid; idle, reassure. |
| `lia` | Sheet laut Manifest | Film-Triss-Look; idle, walk, read, bookClose, shoes. |
| Portraits: Valentus, Junge, Retterin, Lia | Je 64 × 64 | Aktuelle Figurenlooks; Retterin mit grünen Augen. |
| UI: Icons, Marker | Layout laut Manifest | Fähigkeiten, Absichten, Bewegung, Gefahr und Rückstoß-Endfeld; Muster plus Kontur. |

Laufzeit-Dateipfade werden je Asset-ID im Manifest hinterlegt. Vordergrundmasken nur bei Bedarf, deckungsgleich mit ihrer Bühne; für Wald insgesamt 1280 × 360. Wiege und Nahaufnahmen benötigen keine separaten Säuglings-, Wiegen- oder Vorderkantensprites (K3).

Effekte entstehen im Code auf dem 640 × 360-Raster, inklusive Kerzenflackern, Schattenbewegung, Blau, Zerfall und Blitz. Titel und lesbare Schrift werden als Text gerendert. Der Mann ist im Demoumfang eine Stimme. Army-Silhouetten dürfen als ausgeschnittene Bereiche des Bühnenbilds dezent animiert werden. Schwerpunkt-Sounds: Jagdhorn, Herzschlag, Dielenknarren, Einsaugen. Dazu Wind/Trompete, Strahl, Welle, Bolzen, Atem, Sturz, Wiegenknall und Säuglingsschreie. Synthesepresets stehen in Audio.ts; bei Samples werden Quelle und Lizenz in `assets.json` erfasst.

## Pixelnormalisierung

Werkzeug: [scripts/normalize_pixel_assets.py](../scripts/normalize_pixel_assets.py), Python 3 + Pillow. Es ist ein Offline-Werkzeug und erzeugt keinen Spielcode. Palette als JSON-Liste von 1 bis 256 Hexfarben; für die Demo 32 Farben je Bühne, 64 je Figurenset, 32 je Portrait. Gemeinsames Blau #397FC1 ist in allen betreffenden Paletten reserviert. Batch-Manifest: `assets: [{source, output, size: [w,h], palette, frameGrid: [cols,rows]}]`, alle Pfade relativ zum Manifest. Für Einzelbilder ist `frameGrid: [1,1]` gültig.

```text
python3 scripts/normalize_pixel_assets.py --manifest <asset-jobs.json>
```

Pipeline: Quellformat/Sheet-Teilbarkeit und Seitenverhältnis pro Frame prüfen → jeden Frame einzeln mit Nearest-Neighbour auf Zielmaß bringen → RGB auf die gemeinsame feste Palette quantisieren, Dithering aus → Alpha bei 128 auf 0/255 setzen → transparente RGB-Werte nullen → Sheet ohne Trim zusammensetzen → PNG plus Maße/Farbzahl/Alpha-Verifikation. Vorhandene Zieldateien werden nur mit `--overwrite` ersetzt. Generierte Alpha-Sprites kommen bereits aus imagegen mit transparentem Hintergrund; das Werkzeug entfernt keinen gemalten Hintergrund.

Style-Frames: Palette und Atmosphäre abgenommen, Perspektive und alter Valentus-Look verworfen. Sie sind Farb-/Atmosphärenreferenzen und werden nicht als Bühnen verwendet. Normalisierung prüft Pixelraster und Palette; Perspektive, Silhouetten und Details brauchen zusätzlich Bildreview.

## Meilensteine und Prüfung

| Meilenstein | Lieferung | Abnahme |
| --- | --- | --- |
| M1: Battle mit Platzhaltern | `game/`-Gerüst, Raster, Eingaben, beide Zauber, feste Absichten, Junge, Schutzregel; Spielwerte als Daten. | Drei-Zug- und Vier-Zug-Weg funktionieren; Bewegung rücknehmbar; Vorschau entspricht Resultat; Junge erreicht Ausgang. Automatisierte Regeltests für Sichtblocker, Freundtreffer, Rückstoß, Wiederholung und Erfolg. E1/E2 gemäß entschiedener Fieberspirale dokumentiert. |
| M2: Assets drin | Bühnen inklusive beider Waldhälften und Zimmer-Lichtvarianten, Nahaufnahmen, Figurensheets, Portraits, UI, Normalisierung und datengetriebenes Manifest; Szenen per Debug sichtbar. | Maße, Fußpunkte, Alpha und Paletten geprüft. Browseransichten bei 1×/2×/3× zeigen kleine lesbare Figuren und ruhiges HUD. Beide Style-Frames dienen als Farbvergleich. |
| M3: Traumbruch + Flucht | 100→12, rotes Blut im monochromen Bruch, früher Zerfall des Jungen, Hornschnitt, Fieber-Randunschärfe, kompletter Wald mit kippendem Tempo und versagenden Zaubern. | Durchspieltest Battle→Wald→Sturz; Stationen selbst bedient; 45–60 s aktive Waldzeit gemessen; Pausen bleiben stabil; keine Verfolger-Kollision. Skip/Debug und Checkpoint erzeugen denselben Endzustand. |
| M4: Zuflucht/Wiege + Lia + Titel | CARE bei Kerze, Echo ≤ 1 s, WAKE scharf im Mondlicht, acht selbst eingegebene Schritte, drei Wiegen-Nahaufnahmen, Hand per Q, zwei Kinder, Blitz, Match Cut, Lia-Bewegung, SELANTIS. | End-to-End im Browser; Versorgung/Wiege 70–100 s als Richtwert prüfen; Echo gemessen ≤ 1 s; erstmals vollständig scharfes Bild bei WAKE; Kerze erloschen; Empfänger verdeckt; Lia eigener Zustand. Audio startet nach Eingabe; Pause, Skip und Wiederaufnahme funktionieren. Gesamtzeit mit neuem Spieler messen und Creative-Director-Review einholen. |

Phase 1 hat noch keine Laufzeitabnahme. Die Meilensteine liefern jeweils Spielzustand, kurze Bildschirmaufnahme und gemessene Zeiten; Bilder oder Quellenreview ersetzen diese Nachweise nicht.

## Phase-1-Prüfung

Storyboard als JSON geparst. Offline-Pipeline mit einem Zwei-Frame-RGBA-Sheet geprüft: Maße, getrennte Frame-Grenzen, feste Farben, Alpha-Schwelle 127/128, Überschreibschutz und Ablehnung falscher Seitenverhältnisse. Style-Frames werden visuell auf Figuren, Kinderzahl, Farbgruppen und Requisiten geprüft. Spielregeln und Laufzeiten sind spezifiziert; ihre Browserprüfung beginnt in M1.
