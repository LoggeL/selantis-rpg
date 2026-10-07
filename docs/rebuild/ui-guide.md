# UI-Leitfaden für Kapitel-Autoren

Die Oberfläche („Chronik“-Stil, DESIGN.md §4) ist DOM/CSS über der Leinwand und wird über `G.ui` angesprochen
(Vertrag: `game/src/ui/api.ts`, Erweiterungen: `UiApiExt` in `game/src/ui/index.ts`). Eine Vorführung aller
Bausteine liegt im versteckten Kapitel `dev-ui`: `?scene=ui-demo` (einzelne Schritte: `&step=plate|toasts|world|hold|caption|menu`).

## Story-Skripte

Alles ist `async` und eingabesicher: Jede wartende Anzeige sperrt `inputLock`, frühe oder gehaltene Tasten überspringen
keinen ungelesenen Text (erster Druck vervollständigt die Zeile, zweiter geht weiter), Tastenwiederholungen zählen nicht.

```ts
await G.ui.chapterCard('I', 'Der letzte Sommertag', 'Spätsommer');      // Buchseite schlägt auf (Ziffer/„Prolog“)
await G.ui.fade('in', 800);
await G.ui.narrate(['Seite eins …', 'Seite zwei …']);                   // Buchseite (Initiale), je String ein Takt
await G.ui.narrate('Zwischen den Szenen …', { style: 'card' });         // Text über Dunkel
await G.ui.say('kyra', 'Die Schweine warten!', { mood: 'angry' });
const i = await G.ui.choose(['Ja', { text: 'Vorlesen', disabled: true, reason: 'Kyra kann nicht lesen.' }, { text: 'Speikraut', tag: 'Kräuterlexikon' }]);
await G.ui.think('Irgendwann sehe ich mehr von der Welt.');            // Lias Gedanke, ohne Kasten
await G.ui.plate('karte', { caption: 'Selantis', pan: 'right' });       // bleibt, Dialoge laufen darüber
await G.ui.closePlate();
G.ui.letterbox(true);
await G.ui.storyAction('lift', 'Die Hand heben');
await G.ui.stealthGame('cover', 'In der Böschung verstecken', { onNoise: () => G.audio.sfx('rustle') });
await G.ui.fade('out', 900); await G.ui.caption('Sechzehn Jahre später'); // Caption lässt die Blende, wie sie war
```

- **Markup** in allen Texten: `*betont*` (kursiv), `~Urmacht~` (türkiser Schimmer – nur für das Urmacht-Motiv), `\n` Zeilenumbruch.
- `choose()` ohne `prompt` zeigt die Optionen unter der zuletzt gesprochenen Zeile (sie bleibt stehen). Tasten 1–9, Pfeile, Enter, Maus, Touch.
- Dialogboxen höchstens ~140 Zeichen (DESIGN.md §8).
- `G.ui.say('narrator', …)` = Erzählerzeile im Dialogkasten (kursiv, ohne Porträt).
- `choose(…, { speaker })` wirkt nur zusammen mit `prompt` (Namensband + Porträt über der Frage). Ohne `prompt`
  bleibt die zuletzt gesprochene Zeile samt Sprecher stehen.

## Story-Aktionen und Challenges

`storyAction(kind, label, opts?)` bietet Bewegungen ohne Zeitdruck und ohne Fehlerzustand. Pfeile/WASD,
der ziehbare Griff und Bildschirm-Pfeiltasten steuern dieselbe Bewegung. Die Welt bleibt bis zum Abschluss
gesperrt. `onStroke(n)` meldet abgeschlossene Bewegungen, `onProgress(p)` den Fortschritt von 0 bis 1.

| Art | Bewegung | Szene |
| --- | --- | --- |
| `reach` | Hand nach rechts ins Licht führen | Prolog, Höhle |
| `lift` | Hand nach oben zur Wiege heben | Prolog, Zuflucht |
| `open-eyes` | Lider nach oben schieben | Foltan und Azar |
| `tend` | Tinktur dreimal hin und her auftragen | Ferse am Bach |
| `bellows` | Großen Holzgriff ziehen: Faltenkörper zusammendrücken und öffnen, drei Pumpbewegungen | Azars Schmiede |

`stealthGame(kind, label, { onNoise? })` startet erst mit „Bereit“ oder E/Enter. Es dauert bei fehlerfreiem
Spiel etwa sechs bis sieben Sekunden. Ein Fehler wiederholt nur den aktuellen Abschnitt; abgeschlossene
Abschnitte bleiben erhalten. Das Ergebnis ist die Anzahl der Geräusche, damit das Kapitel darauf reagieren kann.

| Art | Challenge |
| --- | --- |
| `cover` | Zum markierten Busch wechseln, solange die Wache wegsieht. Während der Suche stillbleiben. |
| `duck` | Unter zwei Reitergruppen abtauchen und dazwischen kurz nach Kyra sehen. |
| `listen` | Zwischen den Schatten zweier Baumstämme wechseln, bevor die Fackel herüberschwenkt. |

Die Vorführung `?scene=interaction-demo&kind=cover` unterstützt alle acht Arten aus diesen Tabellen.
Die Auswahl „Vorschau“ wechselt direkt zwischen ihnen sowie Feuerbohren (`fire`), Atemregler (`blow`) und
Pflockziehen (`stake`), ohne einen Kapitelweg vorzuspielen.
Beim Blasebalg folgt der Griff direkt dem Ziehen. W/S oder Hoch/Runter bewegen ihn mit 2,8 Hüben pro Sekunde.
Der Atemregler im Leselager verwendet Links/Rechts oder Ziehen. Feuerbohren und Pflockziehen haben eigene
Zeitfenster, die übrigen Challenges behalten ihre jeweiligen Regeln für Erkundung, Rätsel und Training.
`hold()` bleibt als UI-Baustein für die Entwicklungsdemo verfügbar; die Storykapitel verwenden ihn nicht.

### Optik der Minispiele

Jedes Minispiel ist ein gemaltes Szenenbild im HD-2D-Stil der übrigen Spielgrafik, kein Formular. Alle Bilder
liegen in `assets/minigames/<gruppe>-*` (Codex-Pipeline, Prompts je Bild in `art/minigames.json`, Aufbereitung
und Freistellung in `output/<gruppe>-build.py`, danach `scripts/art/build_manifest.py`):

| Gruppe | Assets | Code zeichnet |
| --- | --- | --- |
| Versteckspiele (`cover`, `duck`, `listen`) | `stealth-{cover,duck,listen}` als Hintergrund, `stealth-bush-*`, `-bank`, `-trunk-*` als Deckung vor Lia | Sprites von Lia und Wachen, Lichtkegel, Umriss hinter Deckung |
| Story-Gesten | `gesture-*-scene` plus freigestellte Hand, Arm oder Blasebalg (drei Scheiben); `open-eyes` nutzt die Tafel `k2-geweckt` | Licht, Partikel, Lider, Unschärfe, Schieber |
| Feuerbohren, Atemregler | `feuer-scene`, `-hands`, `-flame`; `k3-blow-scene` (leiht `feuer-flame`) | Glut, Rauch, Atem, Glutfeld |
| Hinweistafel, Pflock | `k3-notes-table`, `-paper`, `k3-clue-*`; `k3-stake-scene`, `-post`, `-mound`, `-algard-*` | Fäden, Nadeln, Fokus, Takt, Alarm |
| Drill, Augenbinde | `k4-drill-bg`, `k4-drill-{foltan,lia}-*` (Posen); `k4-blind-cloth`, `-hands` | Hiebbogen, Schallringe, Dunkelheit |
| Ausweichen (Kapitel V) | `k5-dodge-bg`, `k5-dodge-{ghoul,lia}-*` | Ring, Axthieb, Blitz |
| Packen, Sternbilder | `packen-table`, `-bag`, Gegenstände; `sterne-sky`, `-canopy`, `-eagle` | Etiketten, Sterne, Linien |

Neue Minispiele folgen demselben Aufbau: ein gemalter Hintergrund im Bildformat 16:9 (für das Telefon im
Hochformat einen eigenen Ausschnitt wählen), Figuren und Requisiten als freigestellte Codex-Bilder (Chroma-
Hintergrund, Freistellung wie `scripts/art/props.py`), Figuren nach `docs/rebuild/art/refs/<id>.png`, nie nach
Filmbildern oder alten Porträts. Der Code zeichnet nur Effekte, Markierungen und Balken, keine Figuren oder
Gegenstände aus Formen. Rahmen und Bedienung folgen dem Chronik-Stil: dunkle Navy-Fläche, Goldrahmen, Titel in
Kapitälchen, darunter eine Hinweisleiste mit Tastenkappen (Tastatur) oder einem kurzen Tipp-Hinweis (Touch) und
runde goldgerahmte Pfeilknöpfe. Volle Ausschnitte (Drill, Ausweichen, Packen, Sterne) dürfen randlos sein.
Türkis bleibt der Urmacht vorbehalten. Prüfen auf 1280×720, 390×844 und 844×390, mit Maus, Touch und Tastatur;
bei `prefers-reduced-motion` entfallen Wackeln, Schwanken und Blinken.

Details der Gesten: Die Schieberenden liegen 36 px innerhalb des Bildrands, damit der Zielring den Goldrahmen
nicht berührt. Drückt man gegen das Schieberende, wackelt der Griff und das Hinweisband leuchtet auf. Der
Blasebalg steht auf dem Boden der Schmiede (`gesture-bellows-scene`, Azar am Amboss), steckt mit der Düse im
Windrohr der Esse, und seine Falten stauchen sich mit dem Griff.

Die neuen Interaktionen pausieren bei Fokusverlust oder im Hintergrund. Szenenwechsel entfernen Eingaben
und Oberflächen und verhindern, dass alte Abschlussversprechen die Geschichte fortsetzen. Gehaltene
Richtungstasten geben die Welteingabe erst nach dem Loslassen frei.

## Skripte, die die Szene überleben (wichtig)

Verlässt der Spieler eine Szene (Titel, Warp, `transition`), laufen alte Skripte sonst weiter. Deshalb:
- `await (G.ui as UiApiExt).wait(ms)` statt `setTimeout`/eigener Sleeps – kehrt **nie** zurück, wenn die Szene inzwischen
  verlassen wurde; das Skript bleibt an seinem nächsten `await` stehen.
- Alle Story-Aufrufe (`say/choose/narrate/think/plate/chapterCard/caption/hold/storyAction/stealthGame`) aus einer verlassenen Szene zeichnen nichts
  und lösen nie auf. `letterbox(true)`, `bubble`, `hint` und Belohnungs-Toasts werden dann ignoriert.
- Für eigene Schleifen: `const t = ui.token(); … if (!ui.alive(t)) return;`

## Sprecher-IDs (`ui/speakers.ts`)

Porträt = `G.art.portrait(speaker.portrait ?? id, mood)`; Stimmen-Blip, Akzentfarbe des Namensbands.
Gemalte Porträts (256×256, Codex) werden weich auf ~7 em skaliert; kleine Pixel-Porträts (Platzhalter) bleiben ganzzahlig
scharf. Ein neuer Sprecher erscheint mit kurzem „Pop“, eine neue Stimmung desselben Sprechers blendet weich über.
Fehlt ein Stimmungsbild, nimmt die UI das neutrale, fehlt auch das, eine Kapuzen-Silhouette. Die übrigen Stimmungen
eines Sprechers werden beim ersten Auftritt im Hintergrund vorgeladen.
`lia, kyra, mutter, vater, valentus, baeuerin, bauer, ignatius, ratsherr, abtruenniger, verschwoerer, falke, paladin,
foltan, azar, craupor, schankmaid, zwerg, gaukler, haendler, elnon, alastir, rebell, flick, grauhaarige („Der Grauhaarige“,
Porträt orwen – bis zum Kyra-Zwischenspiel benutzen!), orwen, baris, algard, maedchen („Mädchen“), harro, dunkelschatten,
wache, leichenfresser, vamir („Der Meister“), narrator`.
Eigene Sprecher: `registerSpeakers([{ id, name, portrait?, voice: { pitch, wave }, color }])` (überschreibt Vorgaben).
Rollen ohne eigene Figur zeigen das passende gemalte Porträt (`mutter` → `mother`, `zwerg` → `dwarf`, `wache` → `shadow-sword` …;
`src/ui/speakers.test.ts` prüft, dass jeder Sprecher ein Porträt im Manifest hat). Nach dem Finale: `{ portrait: 'baris-scarred' }`.
Moods: `neutral, happy, sad, angry, surprised, determined, hurt, pained, thinking, scared, worried, ashamed, smirk, grim`
(welche es je Figur gibt: Galerie `?scene=art-gallery&page=portraits`; fehlende fallen auf eine verwandte Stimmung, dann neutral).

## HUD und Welt

- `G.state.objective(id, text)` / `G.state.complete(id)` aktualisieren die Zielzeile automatisch (Schreib-Animation, Durchstreichen, Toast).
  `G.ui.objective(text|null)` setzt sie direkt.
- Funde: `G.state.give/addMemory/addLore/addClue/learn` lösen Toasts **mit Ton** aus (nicht zusätzlich `pickup` spielen).
  Während `G.warp` (reset → prepare → goto) bleiben sie stumm. `G.ui.toast(text, 'info')` für freie Hinweise.
- `G.ui.hint({ verb: 'Untersuchen', x, y })` – Leinwandkoordinaten (0..640/0..360) über dem Objekt; jedes Frame aufrufen ist billig, `null` blendet aus.
- `G.ui.bubble(text, () => ({ x, y }) | null, ms?)` folgt der Position jedes Frame; gibt einen Entferner zurück.
- `G.ui.objectivePointer({ x, y } | null)` – Ziel in Leinwandkoordinaten (darf außerhalb liegen), Pfeil am Rand.
- `G.ui.setHud('explore' | 'battle' | 'cinematic' | 'none')`. Tagebuch (Tab/J) und Tasche (I) per Taste nur in `explore`,
  Esc-Menü immer (außer Titel; eine Szene kann Esc vorher mit `ui.setEscapeHandler(fn)` beanspruchen, der Kampf bricht so zuerst die Auswahl ab), F2-Debug immer (auch aus dem Filterfeld der Szenenwahl). Bei `has-letterbox` blendet das HUD aus.
- Touch (nur Touch-Geräte oder `?touch`): Stick links unten schreibt `virtualInput.x/y`, Aktionsknopf setzt `actionPressed`
  (zeigt das Verb des Hinweises), Rennen-Schalter `run`, `G.ui.setTouchExtras({ sneak, look })` blendet Halteknöpfe ein.
  **Achtung Welt/Taktik:** Taps in der linken unteren Hälfte gehen an den Stick, nicht an die Leinwand.

## Wichtig für Gameplay-Szenen

- Bei offenen UI-Fenstern verschluckt die UI E/Leertaste/Enter/Pfeile (sie erreichen Phaser nicht). Prüft trotzdem `inputLock.locked`
  und `G.ui.busy()`; nach dem Schließen bleibt die Sperre bestehen, bis die Bestätigungstaste losgelassen ist (kein Doppelauslösen).
- Szenenwechsel aus Menüs: `G.ui.transition(() => G.warp(id))` blendet aus, räumt die UI ab, stoppt Gameplay-Szenen und blendet
  automatisch wieder ein – **außer** die neue Szene ruft selbst `fade()` (dann übernimmt sie). `G.ui.reset()` räumt alles ab.
- `G.ui.panel(cls)` liefert ein Vollbild-DOM-Element für Minispiele; es wird beim nächsten `scene:goto` entfernt.
- `G.ui.whenIdle()` wartet, bis kein Fenster mehr offen ist (z. B. nach `openJournal()`).

## Tafeln (gemalte Bilder oder Code)

`G.ui.plate(id, …)` nimmt in dieser Reihenfolge: (1) ein gemaltes Tafelbild aus dem Manifest
(`G.art.hasAsset('plate', id)` → `G.art.plateUrl(id)` = `assets/cut/<id>.jpg`, 1280×720, weich skaliert),
(2) eine mit `registerPlate` gezeichnete Tafel, (3) das Bild unter `plateUrl(id)`, auch wenn das Manifest es noch nicht
kennt, (4) einen Pergament-Platzhalter mit Konsolenwarnung. `ui.prefetchPlate(id)` lädt eine Tafel vorab (z. B. während
des Dialogs davor), damit sie ohne Verzögerung aufgeht. **Keine gemalten Personen nach Filmvorlagen** (DESIGN.md §2).

```ts
import { parchment, frame, label, inkPath, compass, nightSky } from '../../ui/plateKit';
G.ui.registerPlate('crios', () => { const { canvas, g } = nightSky(1600, 900); /* zeichnen */ return canvas; });
```
16:9 empfohlen (1600×900). Kleine Leinwände (< 800 px breit) werden pixelig skaliert. Beschriftungen innerhalb von
`safeRect()` (8 % Rand) halten, der Schwenk schneidet höchstens 4 % je Seite ab.

## Titel-Hintergrund

Das gemalte Titelbild (`public/assets/ui/title.png`, 1280×720, Codex; Pipeline `scripts/art/ui_title.py`, Herkunft in
`docs/rebuild/art/ui.json`) wird im DOM animiert (`ui/titleBackdrop.ts`): langsames Gleiten, Maus-Parallaxe, funkelnde
Sterne, Crios' türkiser Atem, flackerndes Fenster, Rauch, Nebel, Glühwürmchen, Sternschnuppen; im Hochformat ein
langsames Panorama zwischen Crios und dem Hof. Die Phaser-Szene `Title` steuert nur Ein-/Ausblenden:
`G.game.scene.start('Title', { mode: 'backdrop' })` legt das Bild als ruhige Bühne genau auf die Leinwand
(UI-Vorführung), `scene.anchor('house' | 'tree' | 'crios' | 'window' | 'firefly')` liefert Leinwandkoordinaten.

## CSS-Klassen zur Wiederverwendung (z. B. Taktik-UI)

| Klasse | Zweck |
| --- | --- |
| `.ch-panel` | Nachtblaues Paneel mit Goldlinie, Innenlinie und Zierecken |
| `.ch-parch` | Pergament-Lesefläche mit dunkler Tinte |
| `.ch-key` | Tastenkappe (z. B. `<span class="ch-key">E</span>`) |
| `.ch-btn` | Goldgerahmter Knopf (`.is-sel` = ausgewählt) |
| `.ch-label` / `.ch-title` | Alegreya Sans SC-Label / Cinzel-Gold-Überschrift |
| `.ch-ico` | Inline-SVG-Icon-Hülle (1.25em) |
| `.px` | Pixelbild scharf skalieren (`image-rendering: pixelated`) – nicht für gemalte Bilder (Porträts, Tafeln, Titel) |
| `.flourish` | SVG-Zierlinie (`FLOURISH` aus `ui/chapterCard.ts`) |
| `.tx-em` / `.tx-magic` | Betonung / Urmacht-Türkis |

CSS-Variablen auf `#ui.chronik`: `--night --gold --gold-hi --parch --ink --turq --danger --f-head --f-body --f-label`,
Bühnenmaße `--sx --sy --sw --sh` (Leinwand in px), `--isc` (ganzzahliger Pixel-Faktor für 16-px-Icons).
Die Schriftgröße von `#ui` skaliert mit der Fenstergröße; Maße in `em` angeben.
