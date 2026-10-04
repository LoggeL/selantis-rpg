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
await G.ui.hold('Halte still', 2500, { struggle: true, onRelease: () => G.audio.sfx('branch-snap') });
await G.ui.fade('out', 900); await G.ui.caption('Sechzehn Jahre später'); // Caption lässt die Blende, wie sie war
```

- **Markup** in allen Texten: `*betont*` (kursiv), `~Urmacht~` (türkiser Schimmer – nur für das Urmacht-Motiv), `\n` Zeilenumbruch.
- `choose()` ohne `prompt` zeigt die Optionen unter der zuletzt gesprochenen Zeile (sie bleibt stehen). Tasten 1–9, Pfeile, Enter, Maus, Touch.
- Dialogboxen höchstens ~140 Zeichen (DESIGN.md §8).
- `G.ui.say('narrator', …)` = Erzählerzeile im Dialogkasten (kursiv, ohne Porträt).

## Sprecher-IDs (`ui/speakers.ts`)

Porträt = `G.art.portrait(speaker.portrait ?? id, mood)`; Stimmen-Blip, Akzentfarbe des Namensbands.
`lia, kyra, mutter, vater, valentus, baeuerin, bauer, ignatius, ratsherr, abtruenniger, verschwoerer, falke, paladin,
foltan, azar, craupor, schankmaid, zwerg, gaukler, haendler, elnon, alastir, rebell, flick, grauhaarige („Der Grauhaarige“,
Porträt orwen – bis zum Kyra-Zwischenspiel benutzen!), orwen, baris, algard, maedchen („Mädchen“), harro, dunkelschatten,
wache, leichenfresser, vamir („Der Meister“), narrator`.
Eigene Sprecher: `registerSpeakers([{ id, name, portrait?, voice: { pitch, wave }, color }])` (überschreibt Vorgaben).
Moods: `neutral, happy, sad, angry, surprised, determined, hurt, thinking, scared`.

## HUD und Welt

- `G.state.objective(id, text)` / `G.state.complete(id)` aktualisieren die Zielzeile automatisch (Schreib-Animation, Durchstreichen, Toast).
  `G.ui.objective(text|null)` setzt sie direkt.
- Funde: `G.state.give/addMemory/addLore/addClue/learn` lösen Toasts **mit Ton** aus (nicht zusätzlich `pickup` spielen).
  Während `G.warp` (reset → prepare → goto) bleiben sie stumm. `G.ui.toast(text, 'info')` für freie Hinweise.
- `G.ui.hint({ verb: 'Untersuchen', x, y })` – Leinwandkoordinaten (0..480/0..270) über dem Objekt; jedes Frame aufrufen ist billig, `null` blendet aus.
- `G.ui.bubble(text, () => ({ x, y }) | null, ms?)` folgt der Position jedes Frame; gibt einen Entferner zurück.
- `G.ui.objectivePointer({ x, y } | null)` – Ziel in Leinwandkoordinaten (darf außerhalb liegen), Pfeil am Rand.
- `G.ui.setHud('explore' | 'battle' | 'cinematic' | 'none')`. Tagebuch (Tab/J) und Tasche (I) per Taste nur in `explore`,
  Esc-Menü immer (außer Titel), F2-Debug immer. Bei `has-letterbox` blendet das HUD aus.
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

## Tafeln (Buchtafeln aus Code)

```ts
import { parchment, frame, label, inkPath, compass, nightSky } from '../../ui/plateKit';
G.ui.registerPlate('crios', () => { const { canvas, g } = nightSky(1600, 900); /* zeichnen */ return canvas; });
```
16:9 empfohlen (1600×900). Kleine Leinwände (< 800 px breit) werden pixelig skaliert. **Keine gemalten Personen** (DESIGN.md §2).

## CSS-Klassen zur Wiederverwendung (z. B. Taktik-UI)

| Klasse | Zweck |
| --- | --- |
| `.ch-panel` | Nachtblaues Paneel mit Goldlinie, Innenlinie und Zierecken |
| `.ch-parch` | Pergament-Lesefläche mit dunkler Tinte |
| `.ch-key` | Tastenkappe (z. B. `<span class="ch-key">E</span>`) |
| `.ch-btn` | Goldgerahmter Knopf (`.is-sel` = ausgewählt) |
| `.ch-label` / `.ch-title` | Alegreya Sans SC-Label / Cinzel-Gold-Überschrift |
| `.ch-ico` | Inline-SVG-Icon-Hülle (1.25em) |
| `.px` | Pixelbild scharf skalieren (`image-rendering: pixelated`) |
| `.flourish` | SVG-Zierlinie (`FLOURISH` aus `ui/chapterCard.ts`) |
| `.tx-em` / `.tx-magic` | Betonung / Urmacht-Türkis |

CSS-Variablen auf `#ui.chronik`: `--night --gold --gold-hi --parch --ink --turq --danger --f-head --f-body --f-label`,
Bühnenmaße `--sx --sy --sw --sh` (Leinwand in px), `--isc` (ganzzahliger Pixel-Faktor für 16-px-Icons).
Die Schriftgröße von `#ui` skaliert mit der Fenstergröße; Maße in `em` angeben.
