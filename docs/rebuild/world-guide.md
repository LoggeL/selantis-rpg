# Welt-Engine: Autorenleitfaden

Kurzanleitung für Kapitel-Autoren. Die Engine liegt in `game/src/world/`, der Vertrag in `world/api.ts`.
Eine Kapitelszene besteht aus **einer Kartendefinition** und **ein paar async-Funktionen**. Alles andere (Spieler,
Kamera, Licht, Wetter, Schleichen, Spurenblick, Interaktion, Klick-zum-Laufen, Touch) erledigt die Engine.

Demo zum Ausprobieren: `?scene=world-demo` (Feldrand in der Dämmerung, Kyra, Begleiterin, Wachen, Spurenblick,
Regen-Trigger, Ausgang zur nächtlichen Lichtung `world-demo-2`) und `?scene=world-stress` (große Karte, Leistung).
Quelle: `game/src/chapters/dev-world/index.ts`.

## Koordinaten

- **Kacheln** (16 px). `[12, 7]` ist die **Mitte** der Kachel in Spalte 12, Zeile 7. Brüche sind erlaubt: `[12.5, 7]`.
- Pixel: `{ x: 200, y: 118, px: true }`. Bereiche: `{ x, y, w, h }` in Kacheln (oder `px: true`).
- Figuren und Requisiten stehen mit den **Füßen** auf dem Punkt (Ursprung unten Mitte). Die Y-Sortierung folgt daraus.

## Karte (`MapDef`)

```ts
import { defineMap } from '../../world';

export const hof = defineMap({
  id: 'hof',                     // eindeutig, für Ausgänge und changeMap
  name: 'Der Hof',               // Toast beim Betreten über einen Ausgang (optional)
  ground: [                      // ASCII-Boden, ein Zeichen pro Kachel
    ';;;;;;;;;;;;;;;;;;;;',
    ';,,,,,ddddddd,,,,,,;',
    ';,,,,,ddddddd,,,~~,;',
    ';pppppppppppppp-~~,;',
    ';;;;;;;;;;;;;;;;;;;;',
  ],
  legend: { X: 'cobble' },      // ergänzt/überschreibt die Standardlegende
  decor: {                       // optionale ASCII-Schicht für Requisiten (gleiche Größe)
    jitter: 3,                   // natürliche Streuung in px
    legend: { T: 'tree-oak', P: 'tree-pine', h: { prop: 'bush-hide', hide: 'bush' } },
    rows: [ 'T  P  T  P  T  P  T ', /* … */ ],
  },
  props: [{ prop: 'house-farm', at: [8, 1], id: 'haus' }, { prop: 'campfire', at: [14, 2] }],
  npcs: [], interactables: [], clues: [], guards: [], triggers: [], exits: [], lights: [], hidingSpots: [],
  spawns: { start: { at: [2, 3], dir: 'right' } },
  time: 'dusk',                  // 'day' | 'dusk' | 'night' | 'dawn' | 'storm'
  weather: 'none',               // 'none' | 'rain' | 'storm' | 'fog' | 'fireflies' | 'leaves' | 'pollen'
  ambience: ['wind', 'birds'],   // G.audio.ambience
  music: 'exploration',          // undefined = laufende Musik behalten, null = ausblenden
  lookMode: false,               // Spurenblick (Q halten) erlaubt
  onEnter: async w => { /* jedes Betreten */ },
});
```

**Standardlegende:** `.` grass, `,` meadow, `;` darkgrass, `F` forest, `d` dirt, `p` path, `r` road, `m` mud,
`s` sand, `w` wheat, `c` crops, `x` stubble, `~` water, `-` shallow, `S` stone, `o` cobble, `#` wood, `R` rug,
`C` carpet, `^` cliff, Leerzeichen = void. Wasser, Klippe und Leere blockieren; Furt, Schlamm und Weizen bremsen.
Weizen versteckt einen geduckten Spieler (`hideTerrain`).

**Kollision** kommt automatisch aus dem Boden und den Fußabdrücken der Requisiten (`G.art.prop().footprint`).
`collide: false` macht eine Requisite begehbar, `blocksView: false` lässt Wachen durchsehen, `above: true` zeichnet
sie immer über Figuren (Dachüberstand). Requisiten mit `sway` aus der Kunst wiegen sich im Wind.

### Objekte

| Liste | Wichtigste Felder |
| --- | --- |
| `npcs` | `id`, `preset` (Figur), `at`, `dir`, `talk: async (w, npc) => …`, `wander` (Kacheln), `barks: [...]`, `idle` |
| `interactables` | `id`, `at`, `verb` („Untersuchen“), `prop`, `onInteract`, `item: { id }`, `thought`, `once`, `when` |
| `clues` | `id`, `at`, `kind` (`footprint`, `hoof`, `branch`, `bead`, `glint`, `blood`, `rope`, `mark`), `angle`, `clue` (Tagebuch-ID), `thought`, `onInteract` |
| `guards` | `id`, `preset`, `path: [{ at, wait, face }]`, `range` (Kacheln), `fov` (Grad), `lantern`, `suspiciousBarks` |
| `triggers` | `id`, `area`, `onEnter`, `onExit`, `once` (Standard `true`), `when` |
| `exits` | `id`, `area` (am Kartenrand), `to`, `spawn`, `when`, `blocked` (Gedanke), `door: { at, verb }` |
| `lights` | `at`, `kind` (`fire`, `lantern`, `candle`, `window`, `urmacht`, `moon`, `plain`), `radius`, `color`, `intensity` |
| `hidingSpots` | `area`, `kind` (`bush`, `grass`, `crate`). Requisiten mit `hide: 'bush'` sind automatisch Verstecke |

Requisiten mit Licht in der Kunst (`PropInfo.light`, z. B. Lagerfeuer) leuchten automatisch.
Requisiten können über `interact: { verb, onInteract, item }` direkt interaktiv werden.

## Szene starten

```ts
import { defineChapter } from '../../core/registry';
import { startWorld } from '../../world';

defineChapter({
  id: 'kapitel-1', order: 1, numeral: 'I', title: 'Der letzte Sommertag',
  scenes: [{
    id: 'wiese', title: 'Die Wiese',
    prepare: () => { /* Zustand für Direkteinstieg setzen */ },
    start: () => startWorld({ map: wiese, spawn: 'start', companions: [], script: wieseSkript }),
  }],
});
```

`startWorld` beendet laufende Gameplay-Szenen, baut die Karte, blendet weich ein und startet das Skript.
Endet die Szene (z. B. `G.goto('naechste-szene')`), werden wartende Skripte still abgebrochen.

## Skript-Kontext (`w: WorldCtx`)

```ts
async function wieseSkript(w: WorldCtx) {
  const kyra = w.actor('kyra');
  w.setObjective('k1-kyra', 'Sprich mit Kyra.', 'kyra');      // HUD + Tagebuch + Zielpfeil/Marker
  await w.waitForInteract('kyra');                               // wartet auf das Gespräch
  w.completeObjective('k1-kyra');

  await w.cutscene(async () => {                                 // Spieler gesperrt, Letterbox, kein Entdecken
    await w.camera.pan('scheune', 900);
    await kyra.walkTo(14, 6, { run: true });                     // Pfadfindung
    await kyra.emote('!');                                       // '!' '?' '…' 'heart' 'drop' 'anger' 'note'
    kyra.face('player');
    await kyra.say('Komm schon, die Schweine warten!');
    await w.lighting.set('night', 4000);                         // weicher Übergang
  });
  w.weather.set('rain');                                         // schaltet auch die Regen-Ambience
  w.bark('kyra', 'Igitt, nass!');                                // Sprechblase, blockiert nicht
  await w.changeMap('hof', 'tor');                               // Blende, neue Karte, Skript läuft weiter
}
```

Wichtige Aufrufe:

- **Figuren:** `w.player`, `w.actor(id)`, `w.spawn(npcDef)`, `w.despawn(id)`. Handle: `walkTo(x, y | ziel)`, `walkPath([...])`,
  `teleport`, `face(dir | id | at)`, `play(anim, { once })`, `setIdle('sit')`, `emote`, `say`, `bark`, `hop()`, `hold()`,
  `show()/hide()`, `setLook(preset)`.
- **Dialog:** `w.say(speaker, text)`, `w.choose([...])`, `w.narrate([...])`, `w.think(text)` (über `G.ui`, eingabesicher).
- **Ablauf:** `w.wait(ms)`, `w.waitForInteract(id)`, `w.waitForTrigger(id)`, `w.waitForNear(ziel, kacheln)`,
  `w.on('interact' | 'trigger' | 'clue' | 'spotted' | 'exit' | 'map', id | '*', handler)`.
- **Sperren:** `w.lockPlayer()/unlockPlayer()`, `w.cutscene(fn)`.
- **Ziele:** `w.setObjective(id, text, ziel?)`, `w.setObjectiveTarget(ziel)`, `w.completeObjective(id)`.
  Ziel = Figur-ID, Interaktions-ID, Requisiten-ID, Ausgangs-/Trigger-ID oder Position.
- **Kamera:** `w.camera.follow(id?)`, `pan(ziel, ms)`, `zoom(z, ms)`, `shake(ms, stärke)`, `punch()`.
  Wackeln/Zoomimpulse respektieren „Reduzierte Bewegung“.
- **Licht/Wetter:** `w.lighting.set(zeit, ms)`, `w.lighting.add({ at, kind })` → Handle mit `fadeTo`, `set`, `remove`;
  `w.lighting.flash()`; `w.weather.set(art, { intensity, ms })`.
- **Schleichen:** `w.stealth.checkpoint(spawn | at)`, `w.stealth.onSpotted(async wache => …)` (ersetzt das Standardverhalten:
  „!“, Abblenden, Rücksetzen auf den Checkpoint), `w.stealth.enable(false)`, `w.stealth.resetGuards()`, `w.stealth.hidden`.
- **Spurenblick:** `w.lookMode.enable()`. Hinweise leuchten nur bei gehaltenem Q (Touch: `virtualInput.look`), bleiben danach
  schwach sichtbar und werden mit E untersucht. `clue: 'id'` trägt sie ins Tagebuch ein.
- **Sonstiges:** `w.interactable(id).enable()/disable()/remove()`, `w.setEnabled(exitOderTriggerId, an)`, `w.prop(id).shake()`,
  `w.addProp(def)`, `w.fx.burst(ziel, 'sparkle' | 'urmacht' | 'dust' | 'leaves' | 'splash' | 'smoke')`,
  `w.companions.add(id)/remove(id)`.

## Steuerung (automatisch)

WASD/Pfeile (8 Richtungen, Beschleunigen/Abbremsen), Shift rennen (Staub), C/Strg schleichen, Q Spurenblick,
E/Leertaste/Enter interagieren, Mausklick/Tippen = Laufziel mit A*-Pfad (Klick auf ein Objekt läuft hin und interagiert).
Touch: `core/input.virtualInput` (Stick, Aktion, Rennen, Schleichen, Blick). Während Dialogen (`inputLock`) ruht alles.

## Vollständiges Beispiel

```ts
import { G } from '../../core/G';
import { registerItems } from '../../core/catalog';
import { defineChapter } from '../../core/registry';
import { defineMap, startWorld, type WorldCtx } from '../../world';

registerItems([{ id: 'kornblumen', name: 'Kornblumen', icon: 'flower', description: 'Blau wie Mutters Schürze.' }]);

const waldrand = defineMap({
  id: 'k1-waldrand',
  ground: [
    ';;;;;;;;;;;;;;;;;;;;;;;;',
    ';,,,,,,,,,,,,,,,,,,,,,,;',
    ';,,,,wwwwwwww,,,,,,,,,,;',
    ';,,,,wwwwwwww,,,,,~~~,,;',
    ';pppppppppppppppppp-~~,p',
    ';,,,,,,,,,,,,,,,,,,,,,,;',
    ';;;;;;;;;;;;;;;;;;;;;;;;',
  ],
  decor: { jitter: 2, legend: { T: 'tree-oak' }, rows: ['T  T  T  T  T  T  T  T '] },
  props: [{ prop: 'tree-apple', at: [16, 1], id: 'apfelbaum' }],
  npcs: [{
    id: 'kyra', preset: 'kyra', at: [10, 5], dir: 'left', barks: ['Trödel nicht!'],
    talk: async w => {
      await w.actor('kyra').say('Na endlich. Die Schweine warten nicht ewig.');
      G.state.set('k1-kyra');
    },
  }],
  interactables: [
    { id: 'blumen', at: [7, 1], verb: 'Pflücken', item: { id: 'kornblumen' }, thought: 'Für Mutter.' },
  ],
  clues: [{ id: 'nest-spur', at: [15, 2], kind: 'branch', thought: 'Ein abgebrochener Zweig … und darüber ein Nest.' }],
  triggers: [{ id: 'abend', area: { x: 18, y: 1, w: 2, h: 5 }, onEnter: w => w.lighting.set('dusk', 3000) }],
  exits: [{ id: 'heim', area: { x: 23, y: 4, w: 1, h: 1 }, to: 'k1-heimweg', spawn: 'west',
    when: () => G.state.is('k1-kyra'), blocked: 'Erst rede ich mit Kyra.' }],
  spawns: { start: { at: [2, 4], dir: 'right' } },
  time: 'day', ambience: ['wind', 'birds'], music: 'exploration', lookMode: true,
});

async function script(w: WorldCtx) {
  w.setObjective('k1-kyra', 'Sprich mit Kyra.', 'kyra');
  await w.waitForInteract('kyra');
  w.completeObjective('k1-kyra');
  w.setObjective('k1-heim', 'Geh nach Hause.', 'heim');
}

defineChapter({
  id: 'kapitel-1', order: 1, numeral: 'I', title: 'Der letzte Sommertag',
  scenes: [{ id: 'wiese', title: 'Die Wiese', start: () => startWorld({ map: waldrand, spawn: 'start', script }) }],
});
```

## Tipps

- Karten klein und dicht halten (30–60 Kacheln breit). Die Kamera folgt weich mit Vorausschau und bleibt in den Grenzen
  (`camera.bounds`). Ausgänge an den Rändern blenden weich über, der Spieler läuft weiter und auf der neuen Karte herein.
- Wachen: Ein einzelner Wegpunkt mit `face` ergibt einen stehenden Posten, der sich umsieht. Kegel werden von
  sichtblockierenden Requisiten (Fußabdruck) und Klippen verdeckt. Geduckt im Busch oder im Weizen ist der Spieler unsichtbar.
- Licht: Bei Tag sind Lichtquellen fast unsichtbar, in Dämmerung und Nacht leuchten sie. `always: true` für Ausnahmen.
- Barks sind kurz (max. ~40 Zeichen). Dialogboxen max. ~140 Zeichen.
- Für Ereignisse aus anderen Systemen sendet die Engine `world:interact`, `world:trigger`, `world:clue`, `world:spotted`,
  `world:exit`, `world:map` über `G.events`.
