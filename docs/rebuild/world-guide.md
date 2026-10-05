# Welt-Engine: Autorenleitfaden

Kurzanleitung für Kapitel-Autoren. Die Engine liegt in `game/src/world/`, der Vertrag in `world/api.ts`.
Eine Kapitelszene besteht aus **einer Kartendefinition** (gemalter Hintergrund + Polygone) und **ein paar
async-Funktionen**. Alles andere (Spieler, Begleiter, Kamera, Licht, Wetter, Schleichen, Spurenblick, Interaktion,
Klick-zum-Laufen, Touch, Kartengedächtnis) erledigt die Engine.

Demo: `?scene=world-demo` (Wiese am Hof, 1280×720 scrollend: Kyra, Kornblumen, Spurenblick-Spur, Wache mit Laterne,
Verstecke im Gebüsch, Schilf, Regenstein, Dämmerung → Nacht, Lia hinter Eiche und Hecke) und `?scene=world-demo-2`
(Lichtung bei Nacht, 640×360: Lagerfeuer entfachen, auf den Baumstamm setzen, Glühwürmchen). Quelle:
`game/src/chapters/dev-world/maps.ts`. `?scene=world-stress` ist ein Leistungstest auf der Wiese (24 wandernde
Figuren und Tiere, zwei Wachen, zwölf Laternen, Regen in der Dämmerung).

## Grundidee (DESIGN.md §3, §6.2)

- Die Karte ist ein **gemaltes Bild** (`game/public/assets/bg/<id>.png`, Codex-Bildgenerierung): **640×360** = ein
  Bildschirm, **1280×720** = scrollend (die Kamera folgt weich und bleibt im Bild).
- Darüber liegt **Geometrie aus Polygonen in Kartenpixeln**: begehbare Flächen, Hindernisse, Verdecker, Untergründe,
  Verstecke, Trigger, Ausgänge, Hotspots. Die Engine rastert sie in ein feines 4-px-Raster (Pfadfindung A*, Kollision,
  Sichtlinien der Wachen).
- **Figuren** kommen aus `G.art` (Codex-Laufblätter, 64×64-Zellen, Fußanker aus `characterAnchor()`, Figuren ≈ 42 px).
  Fehlt ein Blatt noch, erscheint der Platzhalter. Die Engine lädt alles vor dem Kartenaufbau
  (`G.art.preload` für Figuren, Requisiten, Hintergrund) während der Blende.

## Koordinaten

- Auf gemalten Karten ist **alles in Pixeln**: `[312, 240]` ist ein Pixel des Hintergrunds. Das gilt für `at`, `area`,
  `wander`, `range` der Wachen und den Radius von `waitForNear`. Polygone sind immer Pixel.
- Figuren und Requisiten stehen mit den **Füßen** auf dem Punkt. Y-Sortierung nach Fußpunkt.
- **Weltmaßstab** `worldScale` (Standard 1,75 auf gemalten Karten): Gehgeschwindigkeit, Interaktionsradien,
  Folgeabstände, Fußbox und Sichtweite sind passend zu 42-px-Figuren skaliert. Selten nötig zu ändern.
- `units: 'tiles'` schaltet `at`/`area`/Abstände auf 16-px-Kacheln (Kachelmitte) um; selten sinnvoll. Polygone bleiben Pixel.

## Geometrie

```ts
type Polygon = [number, number][];          // [[x, y], [x, y], …], schließt sich selbst
```

| Feld | Bedeutung |
| --- | --- |
| `walk: Polygon[]` oder `{ poly, holes }[]` | Begehbare Flächen (Vereinigung). Alles außerhalb ist gesperrt. Löcher = Teich im Feld |
| `block: Polygon[]` oder `{ id, poly, sight, move }[]` | Hindernisse: Stamm, Mauer, Teich. `sight: false` = Wachen sehen darüber (Teich, Zaun, Feuerstelle). Nur die **Grundfläche** (Fuß des Objekts) eintragen |
| `occluders: { id, poly, baseline, fade }[]` | **Verdecker**: dieser Bildausschnitt wird über Figuren gezeichnet, deren Füße **über** der `baseline` stehen (Baumkrone + Stamm, Dach, Hecke, Torbogen, Vordergrundbüsche). `baseline` = wo das Objekt den Boden berührt (Standard: unterster Punkt). `fade: 0.55` = wird durchscheinend, solange es Lia verdeckt |
| `surfaces: { poly, kind, speed, hide }[]` | Untergrund (`path`, `dirt`, `wood`, `stone`, `shallow`, `mud`, `wheat` …): Schrittgeräusch, Staub/Spritzer, Tempo. `kind: 'wheat'` (Weizen, Schilf, hohes Gras): Beine versinken, geduckt unsichtbar. Spätere Einträge gewinnen. `surface` = Standard außerhalb (Default `grass`) |
| `hidingSpots: { id, poly, kind }[]` | Verstecke (Büsche): geduckt unsichtbar für Wachen. Mit einem Verdecker mit `fade` darüber sieht man Lia durch die Blätter |
| `interactables: { id, poly, verb, … }` | Hotspot = das gemalte Objekt als Polygon. Klickbar, Reichweite = Abstand zum Umriss (`radius`). Im Fokus hellt das Objekt pulsierend auf. Ohne `poly`: `at` + `radius` (Punkt) |
| `exits: { id, poly, to, spawn, when, blocked, fade }` | Hineinlaufen = weicher Übergang (Blende, Lia läuft weiter und auf der neuen Karte herein). `door: { at, verb }` für Türen mit Interaktion |
| `triggers: { id, poly, onEnter, onExit, once }` | Zonen für Skripte (Standard einmalig, gemerkt) |
| `spawns`, `npcs`, `guards`, `clues`, `lights`, `props` | wie bisher, `at` in Pixeln |
| `depthScale: { y0, s0, y1, s1 }` | optional: Figuren hinten (y0) kleiner, vorne (y1) größer (Perspektive) |
| `baked: 'night'` | Der Hintergrund ist schon nachts gemalt: die Engine dunkelt nur leicht ab (Lichter wirken trotzdem) |
| `lights: [{ …, flame: true }]` | Licht mit Flammen-Partikeln, z. B. Lagerfeuer über einer gemalten Feuerstelle |

**Faustregeln.** Blocke nur Grundflächen, nicht das ganze gemalte Objekt (Lia muss *hinter* einem Baum laufen können).
Alles, was höher ist als der Boden und vor der Figur stehen kann, bekommt einen Verdecker. Ausgänge liegen am
Bildrand und ragen etwas in die begehbare Fläche hinein. `standAt` setzt Lia für eine Interaktion an einen festen
Platz (vor die Tür, an die Feuerstelle, auf den Baumstamm).

## Karten bauen (Arbeitsablauf)

1. **Hintergrund malen lassen** (nur über die Codex-CLI, DESIGN.md §3): Prompt mit Stil-Satz, „no people“, Layout
   genau beschreiben (wo Wege die Bildränder verlassen, wo Hindernisse stehen) und die Figurengröße angeben
   („a standing adult would be about one eighth of the image height“ für 640×360, „one sixteenth“ für 1280×720).
   Vorlage: `scripts/art/world_backgrounds.py` (`gen <job>` erzeugt, `build` verkleinert auf 640×360/1280×720 und
   reduziert die Palette, Protokoll in `docs/rebuild/art/world.json`). Bild **ansehen**, bei Fehlern neu erzeugen.
2. **Karte anlegen** mit `background: '<id>'`, einem groben `walk`-Rechteck und einem `spawn`.
3. **Im Spiel vermessen:** `?scene=<id>&debug` oder **F1** blendet die Geometrie mit Beschriftungen ein und zeigt
   unten die Mausposition in Kartenpixeln (begehbar/gesperrt, Untergrund). **Shift+Klick** setzt Punkte eines
   Entwurfspolygons, **Shift+Z** nimmt den letzten zurück, **Shift+C** kopiert `[[x, y], …]` in die Zwischenablage
   (und die Konsole), **Shift+X** verwirft, **Shift+G** zeigt das Kollisionsraster.
4. **Prüfen ohne Browser:** `node scripts/map_tool.mjs <mapId|all>` zeichnet Hintergrund + Geometrie nach
   `output/qa/maps/<id>.png` (unerreichbare begehbare Fläche rot getönt) und prüft: Starts begehbar und
   erreichbar, jeder Ausgang/Hotspot/NPC/Hinweis/Trigger/Versteck erreichbar, Wachen-Wegpunkte frei, Ausgänge zeigen
   auf vorhandene Karten und Starts. Exit-Code 1 bei Problemen. (Requisiten-Fußabdrücke prüft das Werkzeug nicht.)

## Vollständiges Beispiel

```ts
// game/src/chapters/kapitel-1/wiese.ts
import { G } from '../../core/G';
import { registerItems } from '../../core/catalog';
import { defineMap, type WorldCtx } from '../../world';

registerItems([{ id: 'kornblumen', name: 'Kornblumen', icon: 'flowers', description: 'Blau wie Mutters Schürze.' }]);

export const wiese = defineMap({
  id: 'k1-wiese', name: 'Die Wiese', background: 'k1-wiese',            // assets/bg/k1-wiese.png, 1280×720
  walk: [{ poly: [[0, 250], [700, 10], [1280, 10], [1280, 720], [0, 720]], holes: [] }],
  block: [
    { id: 'eiche', poly: [[424, 346], [496, 334], [522, 348], [470, 380], [426, 370]] },            // nur der Stammfuß
    { id: 'teich', sight: false, poly: [[0, 418], [170, 410], [278, 492], [250, 550], [0, 548]] },
  ],
  occluders: [
    { id: 'eiche', baseline: 368, fade: 0.55, poly: [[272, 262], [332, 116], [452, 54], [600, 96], [700, 252], [530, 372], [416, 372]] },
    { id: 'busch', baseline: 482, fade: 0.6, poly: [[1132, 424], [1232, 394], [1278, 470], [1150, 482]] },
  ],
  surfaces: [
    { id: 'weg', kind: 'path', poly: [[530, 720], [620, 470], [760, 330], [1280, 280], [1280, 340], [700, 400], [590, 720]] },
    { id: 'schilf', kind: 'wheat', poly: [[0, 342], [270, 384], [386, 520], [300, 600], [0, 600]] },
  ],
  hidingSpots: [{ id: 'busch', kind: 'bush', poly: [[1140, 426], [1230, 400], [1272, 466], [1152, 476]] }],
  npcs: [{
    id: 'kyra', preset: 'kyra', at: [600, 452], dir: 'left', wander: 34, barks: ['Trödel nicht!'],
    talk: async w => { await w.actor('kyra').say('Na endlich. Die Schweine warten nicht ewig.'); G.state.set('k1-kyra'); },
  }],
  interactables: [
    { id: 'blumen', verb: 'Pflücken', item: { id: 'kornblumen' }, thought: 'Für Mutter.',
      poly: [[326, 622], [384, 624], [386, 648], [324, 646]] },
    { id: 'tuer', verb: 'Klopfen', poly: [[1078, 52], [1108, 52], [1110, 98], [1078, 98]],
      standAt: [1094, 116], face: 'up', thought: 'Niemand da.' },
  ],
  clues: [{ id: 'spur', at: [700, 640], kind: 'footprint', angle: 90, thought: 'Barfußspuren …' }],
  guards: [{ id: 'wache', preset: 'shadow-sword', mode: 'pingpong', lantern: true,
    path: [{ at: [900, 320], wait: 1500, face: 'left' }, { at: [1150, 298], wait: 2000, face: 'down' }] }],
  lights: [{ id: 'fenster', at: [1034, 62], kind: 'window', radius: 40 }],
  exits: [{ id: 'heim', poly: [[1262, 268], [1280, 268], [1280, 340], [1262, 340]], to: 'k1-heimweg', spawn: 'west',
    when: () => G.state.is('k1-kyra'), blocked: 'Erst rede ich mit Kyra.' }],
  spawns: { start: { at: [566, 690], dir: 'up' } },
  depthScale: { y0: 100, s0: 0.92, y1: 720, s1: 1.04 },
  time: 'day', ambience: ['wind', 'birds'], music: 'exploration', lookMode: true,
});

export async function wieseSkript(w: WorldCtx) {
  w.setObjective('k1-kyra', 'Sprich mit Kyra.', 'kyra');
  await w.waitForInteract('kyra');
  w.completeObjective('k1-kyra');
  void w.lighting.set('dusk', 5000);                              // weicher Übergang in den Abend
  w.setObjective('k1-heim', 'Geh nach Hause.', 'heim');
}

// index.ts: defineChapter({ …, scenes: [{ id: 'wiese', title: 'Die Wiese',
//   start: () => startWorld({ map: wiese, spawn: 'start', companions: [], script: wieseSkript }) }] });
```

## Szene starten

```ts
start: () => startWorld({ map: wiese, spawn: 'start', companions: ['flick'], script: wieseSkript })
```

`startWorld` beendet laufende Gameplay-Szenen, lädt die Kunst, baut die Karte, blendet weich ein und startet das Skript.
Endet die Szene (z. B. `G.goto('naechste-szene')`), werden wartende Skripte still abgebrochen.

## Skript-Kontext (`w: WorldCtx`)

```ts
async function skript(w: WorldCtx) {
  const kyra = w.actor('kyra');
  await w.cutscene(async () => {                                 // Spieler gesperrt, Letterbox, kein Entdecken
    await w.camera.pan('scheune', 900);
    await kyra.walkTo(640, 300, { run: true });                  // Pfadfindung (Pixel auf gemalten Karten)
    await kyra.emote('!');                                       // '!' '?' '…' 'heart' 'drop' 'anger' 'note'
    kyra.face('player');
    await kyra.say('Komm schon, die Schweine warten!');
    await w.lighting.set('night', 4000);
  });
  w.weather.set('rain', { ms: 2000 });                           // blendet weich, schaltet die Regen-Ambience
  w.bark('kyra', 'Igitt, nass!');                                // Sprechblase, blockiert nicht
  await w.changeMap('hof', 'tor');                               // Blende, neue Karte, Skript läuft weiter
}
```

- **Figuren:** `w.player`, `w.actor(id)`, `w.spawn(npcDef)`, `w.despawn(id)`. Handle: `walkTo(x, y | ziel, { anchor })`,
  `walkPath([...])`, `teleport`, `face(dir | id | at)`, `play(anim, { once })`, `setIdle('sit')`, `emote`, `say`, `bark`,
  `hop()`, `hold()`, `show()/hide()`, `setLook(preset)`.
- **Dialog:** `w.say(speaker, text)`, `w.choose([...])`, `w.narrate([...])`, `w.think(text)` (über `G.ui`, eingabesicher).
- **Ablauf:** `w.wait(ms)`, `w.waitForInteract(id)`, `w.waitForTrigger(id)`, `w.waitForNear(ziel, radius)`,
  `w.on(…)` und `w.onMap(…)` (endet mit dem Verlassen der Karte, sicher in `onEnter`) für `'interact' | 'trigger' |
  'clue' | 'spotted' | 'exit' | 'map'`.
- **Sperren:** `w.lockPlayer()/unlockPlayer()`, `w.cutscene(fn)`.
- **Ziele:** `w.setObjective(id, text, ziel?)`, `w.setObjectiveTarget(ziel)`, `w.completeObjective(id)`.
- **Kamera:** `w.camera.follow(id?)`, `pan(ziel, ms)`, `zoom(z, ms)`, `shake(ms, stärke)`, `punch()` (respektiert
  „Reduzierte Bewegung“).
- **Licht/Wetter:** `w.lighting.set(zeit, ms)`, `w.lighting.add({ at, kind, flame })` → Handle mit `fadeTo`, `set`,
  `remove`; `w.lighting.flash()`; `w.weather.set(art, { intensity, ms })`.
- **Schleichen:** `w.stealth.checkpoint(spawn | at, dir?)`, `w.stealth.onSpotted(async wache => …)`, `enable(false)`,
  `resetGuards()`, `hidden`. Sichtkegel liegen am Boden (Verdecker und Figuren decken sie ab) und werden von
  `block`-Polygonen mit Sicht verdeckt.
- **Spurenblick:** `w.lookMode.enable()`. Hinweise leuchten bei gehaltenem Q, `clue: 'id'` trägt ins Tagebuch ein.
- **Texte für Tutorials:** `` `Halte ${w.controlHint('sneak')} gedrückt …` `` (Taste oder Touch-Knopf).
- **Sonstiges:** `w.interactable(id).enable()/disable()/remove()`, `w.setEnabled(id, an)`, `w.prop(id).shake()`,
  `w.addProp(def)`, `w.fx.burst(ziel, art)`, `w.companions.add(id)/remove(id)`, `w.resetMapMemory(mapId?)`.

**Kartengedächtnis:** Karten merken sich zwischen Besuchen (und im Spielstand) benutzte/entfernte Objekte, ausgelöste
Trigger, gefundene Hinweise, abgeschaltete Objekte und das per Skript gesetzte Licht/Wetter. Zur Laufzeit hinzugefügte
Lichter merkt sie nicht: solche Zustände in `onEnter` aus einem Flag wiederherstellen (Beispiel: Lagerfeuer der Lichtung).
`resetOnEnter: true` startet eine Karte jedes Mal frisch.

## Steuerung (automatisch)

WASD/Pfeile (8 Richtungen, Beschleunigen/Abbremsen), Shift rennen, C/Strg schleichen, Q Spurenblick, E/Leertaste/Enter
interagieren, Mausklick/Tippen = Laufziel mit A*-Pfad (Klick auf einen Hotspot läuft hin und interagiert; Klick ins
Wasser läuft bis ans Ufer). F1 = Kartenüberlagerung (nur zum Bauen).

## Tipps

- Pro Szene eine 640×360-Karte, für Wege und Verfolgungen 1280×720. Die Kamera folgt weich mit Vorausschau.
- Gemalte Nachtkarten mit `baked: 'night'` markieren; für Dämmerung→Nacht eine Tageskarte mit `w.lighting.set` abdunkeln.
- Barks kurz (max. ~40 Zeichen), Dialogboxen max. ~140 Zeichen.
- Ereignisse für andere Systeme: `world:interact`, `world:trigger`, `world:clue`, `world:spotted`, `world:exit`,
  `world:map` über `G.events`.
