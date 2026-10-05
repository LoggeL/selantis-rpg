# Kapitel schreiben: der Einstieg für Kapitel-Agenten

Dieses Dokument ist der **einzige Einstiegspunkt** für die nächste Phase. Es erklärt, wie aus der Szenenliste in
`DESIGN.md` §7.4 spielbare Szenen werden, und verweist für Details auf die Fachleitfäden:

| Thema | Leitfaden |
| --- | --- |
| Erkundung, Karten, Schleichen, Spurenblick, Skripte | [`world-guide.md`](world-guide.md) |
| Taktikkampf | [`tactics-guide.md`](tactics-guide.md) |
| Dialog, Erzähler, Tafeln, HUD, Tagebuch, Tasche, Minispiel-Paneele | [`ui-guide.md`](ui-guide.md) |
| Bilder erzeugen (Codex), Manifest, Figuren, Posen, Porträts, Requisiten | [`art-pipeline.md`](art-pipeline.md) |
| Geschichte, Figuren, Stil, Regeln | [`DESIGN.md`](DESIGN.md) (verbindlich) |

Spielbare Vorlagen liegen in den versteckten Dev-Kapiteln (F2 oder `?scene=<id>`): `world-demo`, `world-demo-2`,
`world-stress`, `tactics-demo`, `tactics-rescue-demo`, `tactics-sandbox`, `ui-demo`, `audio-demo`, `art-gallery`.
Ihr Quelltext (`game/src/chapters/dev-*/`) ist das beste Nachschlagewerk.

## 1. Regeln (immer)

- **Text Deutsch**, korrekte Umlauts und ß, Anführungszeichen „…“, Dialogboxen höchstens ~140 Zeichen, Barks ~40.
  Code-Bezeichner Englisch. „Elf/Elfe/Elfen“, nie „Elbe“. Orwen heißt bis zum Kyra-Zwischenspiel „Der Grauhaarige“
  (Sprecher `grauhaarige`), nie „Hauptmann“; der Hauptmann ist Baris. Vamir heißt in Buch 1 nur „der Meister“.
- **Szenen-IDs** genau wie in DESIGN.md §7.4 (`prolog-rat`, `wiese`, `ueberfall`, `eber`, `rettung` …), Kapitel-IDs
  `prolog`, `kapitel-1` … `kapitel-5`. Karten-, Flag-, Item- und Objective-IDs mit Kapitelpräfix (`k1-wiese`,
  `k1-kyra-geredet`), damit nichts kollidiert (`defineMap` und die Kataloge sind global).
- **Darsteller-Privatsphäre (verbindlich, DESIGN.md §2):** Figuren dürfen nicht wie die Filmschauspieler aussehen.
  Nie Film-Standbilder (`sources/frames/`) oder alte Selantis-Porträts/Cutscenes als Bildvorlage. Aussehen nur aus der
  Figuren-Referenz in DESIGN.md §3 bzw. aus den vorhandenen Referenzbögen `docs/rebuild/art/refs/<id>.png`.
- **Grafik nur aus der Codex-Pipeline** (`scripts/art/…`, die Skripte rufen `scripts/art/codex_image.sh` auf; höchstens
  so viele parallele Jobs wie im Auftrag stehen). Jedes erzeugte Bild mit dem Read-Werkzeug **ansehen**; Fehler
  (Anatomie, Schrift im Bild, Stilbruch, abgeschnittene Figuren) neu erzeugen. Code zeichnet nur Effekte.
- Türkis gehört allein der Urmacht (`~Urmacht~`-Markup, `fx-urmacht`, Lichtart `urmacht`). Vamirs Magie ist kalt violett.
- Jede Szene hat ein spielerisches Herzstück (DESIGN.md §1). Kein reines Lauf-und-Lies.
- Fertig heißt: `cd game && npx tsc --noEmit` sauber, `npx vitest run` grün, `node scripts/map_tool.mjs all` ohne
  Befund, `npx playwright test` grün, die Szene selbst gespielt und mit Screenshots angesehen (keine Konsolenfehler).

## 2. Kapitel anlegen

Ein Kapitel ist ein Ordner `game/src/chapters/<kapitel-id>/` mit einer `index.ts`. Er wird automatisch geladen
(`import.meta.glob('./chapters/*/index.ts')` in `main.ts`), es muss nichts registriert werden.

```
game/src/chapters/kapitel-1/
  index.ts         defineChapter + Szenenliste (nur Verdrahtung)
  catalog.ts       registerItems / registerLore / registerMemories / registerClues / registerSpeakers
  wiese.ts         Karte (defineMap) + Skript einer Szene
  heimweg.ts
  ueberfall.ts
  feuerbohren.ts   Minispiel (Phaser-Szene oder DOM-Paneel), falls nötig
```

```ts
// game/src/chapters/kapitel-1/index.ts
import { G } from '../../core/G';
import { defineChapter } from '../../core/registry';
import { startWorld } from '../../world';
import './catalog';
import { wiese, wieseSkript } from './wiese';

defineChapter({
  id: 'kapitel-1', order: 1, numeral: 'I', title: 'Der letzte Sommertag', subtitle: 'Spätsommer am Hof',
  scenes: [
    {
      id: 'wiese', title: 'Die Wiese',
      // Für direkte Sprünge (F2, ?scene=wiese, Kapitelwahl): Zustand herstellen, den frühere Szenen erzeugt hätten.
      prepare: () => { G.state.setParty(['lia']); G.state.give('k1-alana-buch'); },
      start: () => startWorld({ map: wiese, spawn: 'start', script: wieseSkript }),
    },
    // { id: 'heimweg', … }, { id: 'ueberfall', … }, { id: 'trauer', … }
  ],
  // phaserScenes: [FeuerbohrenScene],   // eigene Phaser-Szenen (Minispiele), einmal beim Start registriert
});
```

- `order`: Prolog 0, Kapitel I = 1 … V = 5 (Dev-Kapitel ≥ 900 und `hidden: true`).
- `start(params?)` startet die Szene (Welt, Kampf, Minispiel oder reines Skript). `prepare()` wird **nur** bei direkten
  Sprüngen aufgerufen (`G.warp`: Zustand zurücksetzen → `prepare` → `goto`): Flags, Inventar, Gruppe (`setParty`),
  Fähigkeiten (`learn`), offene Ziele setzen, damit die Szene allein spielbar ist.
- **Weiter zur nächsten Szene:** `await G.goto('heimweg')` (optional mit Parametern `G.goto('heimweg', { route: 'felder' })`,
  die `start(params)` bekommt). `nextScene(id)` aus `core/registry` liefert die Folgeszene in Story-Reihenfolge.
  Das letzte Kapitel kehrt mit `showTitle()` aus `scenes/BootScene` zum Titel zurück.
- **Kapitelanfang:** `await G.ui.chapterCard('I', 'Der letzte Sommertag', 'Spätsommer')` und danach `G.ui.fade('in')`
  im `start` der ersten Szene. Erzählerbrücken zwischen Szenen: `G.ui.narrate([...], { style: 'card' })`.
- **Speichern:** `G.goto` speichert automatisch beim Szenenstart (Kapitel, Szene, Parameter, kompletter `G.state`);
  „Fortsetzen“ im Titel startet genau diese Szene neu. Versteckte Dev-Kapitel speichern nicht. Lange Szenen in
  Abschnitte teilen, die eigene Szenen-IDs bekommen, statt mitten in einer Szene zu speichern. Fortschritt gehört in
  `G.state` (Flags, Inventar, Ziele, Erinnerungen …), nie in Modulvariablen. Karten merken sich ihren Zustand selbst
  (benutzte Objekte, gefundene Hinweise; siehe world-guide „Kartengedächtnis“).

## 3. Zustand und Kataloge

```ts
// catalog.ts — beim Import registriert
import { registerClues, registerItems, registerLore, registerMemories, registerAbilities } from '../../core/catalog';
registerItems([{ id: 'k1-alana-buch', name: 'Die Geschichten der Magierin Alana', icon: 'book-alana',
  description: 'Abgegriffen, mit Goldprägung.', comment: 'Ich habe es schon dreimal gelesen.' }]);
registerMemories([{ id: 'k1-mem-kuchen', title: 'Honig und Äpfel', text: '…' }]);
registerLore([{ id: 'lore-crios', title: 'Crios', text: '…' }]);
registerClues([{ id: 'k1-hufspuren', title: 'Frische Hufspuren', text: '…' }]);
registerAbilities([{ id: 'spurenblick', name: 'Spurenblick', key: 'Q', description: '…' }]);
```

- Benutzen: `G.state.give(id, n)`, `take`, `has`, `set/is/flag/inc` (Flags), `objective(id, text)` / `complete(id)`,
  `addMemory`, `addLore`, `addClue`, `learn` (Fähigkeit), `setParty`. Jede Änderung zeigt den passenden Toast mit Ton.
- **Itemsymbole** kommen aus dem gemalten Atlas `ui/items.png` (32×32): `bead, map, key, stone, twig, rope, letter, bag,
  book-alana, book-herbs, journal, dagger, coins, tincture, bread, cheese, bacon, waterskin, blanket, cloak, tinder,
  flowers, apple, ribbon, honey-cake, chain-pastry`. Neues Symbol: `python3 scripts/art/icons.py gen <bogen> …`
  (art-pipeline §5). Ohne Symbol erscheint ein neutrales Bündel als Platzhalter.
- Bag-Aktionen („Essen“, „Feuer machen“): `(G.ui as UiApiExt).registerItemAction(itemId, { label, when, reason, run })`.
- Lias Lesen ist eine echte Fähigkeit: Schilder, Briefe, Bücher nur für Lia lesbar; in Kyra-Szenen bleibt Schrift
  unlesbar (DESIGN.md §3).

## 4. Erkundungsszene mit gemalter Karte

Ablauf (Details und vollständiges Beispiel: world-guide „Karten bauen“ und „Vollständiges Beispiel“):

1. **Hintergrund malen lassen** (Codex): 640×360 für einen Bildschirm, 1280×720 für Wege/Verfolgungen.
   `python3 scripts/art/backgrounds.py bg k1-wiese --size=1280x720 --desc="…"` oder als Vorlage mit eigenen Jobs
   `scripts/art/world_backgrounds.py`. Im Prompt: Drei-Viertel-Draufsicht, **keine Personen**, genaue Lage von Wegen,
   Ausgängen, Hindernissen, Verstecken; Figurengröße angeben (ein Erwachsener ≈ 1/8 der Bildhöhe bei 640×360,
   ≈ 1/16 bei 1280×720). Stilreferenzen aus `output/imagegen/style-refs/` (selantis-*, insel-bg-*). Bild ansehen.
2. **Karte anlegen:** `defineMap({ id, background: '<bg-id>', walk, block, occluders, surfaces, hidingSpots, npcs,
   interactables, clues, guards, lights, exits, spawns, time, weather, ambience, music, … })`. Alles in Kartenpixeln.
   Figuren über `preset: '<charakter-id>'` (Liste in §8), Requisiten über `props: [{ prop: '<id>', at }]`.
3. **Vermessen** im Spiel mit **F1** (oder `&debug`): Polygone, Mausposition in Kartenpixeln; Shift+Klick sammelt Punkte,
   Shift+C kopiert das Polygon.
4. **Verdecker** (`occluders`) für alles, hinter dem Figuren verschwinden: Baumkronen, Dächer, Hecken, Vordergrundbüsche
   (`baseline` = wo das Objekt den Boden berührt, `fade` macht große Verdecker durchsichtig, solange Lia dahinter steht).
5. **Prüfen:** `node scripts/map_tool.mjs k1-wiese` → `output/qa/maps/k1-wiese.png` ansehen (rot = unerreichbar).
6. **Skript:** `startWorld({ map, spawn, companions, script })`; im Skript der `WorldCtx` `w`:
   `w.say/choose/narrate/think`, `w.actor('kyra').walkTo(…)/say/emote/play('kneel')`, `w.cutscene(async () => …)`,
   `w.waitForInteract/Trigger/Near`, `w.setObjective(id, text, ziel)`, `w.camera.pan/zoom/shake`, `w.lighting.set('dusk',
   ms)`, `w.weather.set('rain')`, `w.fx.burst(…, 'urmacht')`, `w.changeMap(id, spawn)`. Story-Tableaus = Kamera +
   Letterbox (`cutscene`) + Posen + Licht + Partikel. Gewalt nur über Kamera, Silhouetten und Abblenden.

**Schleichen** (world-guide „Geometrie“, `guards`, `hidingSpots`): Wachen mit Patrouillen (`path`, `mode`, `lantern`,
`range`, `fov`), sichtbare Sichtkegel, die von `block`-Polygonen verdeckt werden; Verstecke als Polygone (Büsche) oder
Untergrund `wheat` (geduckt unsichtbar). Entdeckt → sanfter Rücksprung zum Checkpoint (`stealth: { checkpoint }`,
`w.stealth.checkpoint(…)`, eigene Reaktion mit `w.stealth.onSpotted`). Steuerungshinweise immer über
`w.controlHint('sneak')`, damit Touch-Spieler den richtigen Knopf lesen.

**Spurenblick** (Q halten): `lookMode: true` an der Karte oder `w.lookMode.enable(true)`; Hinweise als `clues: [{ id, at,
kind: 'footprint' | 'hoof' | 'branch' | 'bead' | 'glint' | 'blood' | 'rope' | 'mark', angle, clue, thought }]`.
Mit `clue: '<clue-id>'` landet der Fund im Tagebuch. Weiterführen: `w.on('clue', '*', id => w.setObjectiveTarget(…))`.

## 5. Tafeln, Cutscenes und Porträts

- **Gemalte Tafel** (Codex, 1280×720, ≤ 400 KB):
  `python3 scripts/art/backgrounds.py plate wiese-lia-liest --chars=lia --desc="…"` → `assets/cut/<id>.jpg`, im Manifest.
  Figuren nur über `--chars` (deren Referenzbögen), nie nach Filmbildern; Ergebnis genau ansehen (Gesicht, Hände).
  Anzeigen: `await G.ui.plate('wiese-lia-liest', { caption: '…', pan: 'in' })`, Dialog darüber, dann `G.ui.closePlate()`.
  Beispiel: `?scene=ui-demo&step=tableau`. Vorladen: `(G.ui as UiApiExt).prefetchPlate(id)`.
- **Gezeichnete Buchtafel** (Karten, Sternbilder, Briefe): `G.ui.registerPlate(id, () => canvas)` mit `ui/plateKit.ts`.
- **Porträts** kommen automatisch über den Sprecher: `G.ui.say('kyra', '…', { mood: 'angry' })`. Sprecher-IDs und
  Stimmungen: ui-guide „Sprecher-IDs“. Andere Variante für eine Zeile: `{ portrait: 'kyra-bound' }`,
  `{ portrait: 'lia-cloak' }` (Reisekleidung), `{ portrait: 'baris-scarred' }` (nach dem Finale).
  Neue Stimmung für eine Figur: `python3 scripts/art/characters.py portrait foltan --moods=scared`.
- **Neue Figur oder Pose:** art-pipeline §1 (`cast.json`-Eintrag → `ref` → `walk` → `pose` → `portrait`). Alle 45
  Menschen-Figuren stehen schon in `scripts/art/cast.json`; zusätzliche Posen für vorhandene Figuren:
  `python3 scripts/art/characters.py pose kyra --poses=carry` (Posentext vorher in `POSES` in `prompts.py`).
  Outfitwechsel in der Welt: `w.player.setLook('lia-cloak')` bzw. `actor.setLook(…)`.

## 6. Taktikkämpfe

Ein Kampf ist ein `BattleDef` (Karte als Höhen- und Geländeraster, Einheiten mit `preset`, Ziele, Wellen, Hooks).
Vorlagen: `game/src/chapters/dev-tactics/index.ts` (Dunkelhain-Tutorial, Rettung mit gefesselter Kyra
`boundPreset: 'kyra-bound'`, Übungsplatz). Start und Rückweg:

```ts
G.stopGameplayScenes();
G.game.scene.start('Tactics', {
  battle: rettungKampf,
  onEnd: async result => { if (result.outcome === 'win') await G.goto('finale'); },
} satisfies TacticsStartData);
```

Story-Momente laufen in Hooks über `BattleCtx` (`ctx.say`, `ctx.hint`, `ctx.banner`, `ctx.spawn`, `ctx.pose(unit,
'kneel')`, `ctx.focus`, `ctx.win()`). Baris stirbt nie (`nonLethal: true`). Niederlage bietet „Erneut versuchen“.
Alles Weitere: tactics-guide.

## 7. Minispiele, Audio

- **Minispiel als Phaser-Szene** (Feuerbohren, Fesseln lösen): Klasse in `phaserScenes` des Kapitels eintragen, starten
  mit `G.stopGameplayScenes(); G.game.scene.start('K2Feuerbohren', data)`; Grafik über `await G.art.preload(this, {
  props: [...], characters: [...] })` in `create()`, Eingaben nur, wenn `!inputLock.locked && !G.ui.busy()`;
  am Ende `G.goto(…)` oder zurück in die Welt (`startWorld({ map, spawn: 'nach-minispiel' })`).
- **Minispiel als DOM-Paneel** (Packen, Rätsel): `const el = G.ui.panel('k1-packen')` liefert ein Vollbild-Element im
  Chronik-Stil (CSS-Klassen: ui-guide); es verschwindet beim nächsten `G.goto` von selbst, sonst `el.remove()`.
- **Halten-Mechanik** („Halte still“): `G.ui.hold('Halte still', 2500, { struggle: true, onRelease })`.
- **Audio:** Musikstimmung an der Karte (`music: 'exploration' | 'dread' | 'grief' | 'flight' | 'refuge' | 'battle' |
  'tavern'`, `null` blendet aus) oder `G.audio.music(mood)`; Ambience-Schichten (`ambience: ['wind', 'birds',
  'crickets', 'rain', 'fire', 'tavern', 'stream', 'night', 'camp', 'battle-far', 'room', 'farm', …]`);
  Effekte `G.audio.sfx('branch-snap')` (Liste: `audio/api.ts`, anhören: `?scene=audio-demo`). Schritte, Dialog-Blips,
  Fund-Töne und Kampfgeräusche laufen automatisch.

## 8. Was es an Grafik schon gibt

Alles steht in `game/public/assets/manifest.json`; ansehen in der Galerie `?scene=art-gallery&page=walk|poses|portraits|
props|backgrounds|fx`. `G.art.hasAsset(kind, id)` prüft, ob etwas da ist (fehlende IDs zeigen neutrale Platzhalter).

- **Figuren** (Laufblatt 4 Richtungen; Posen): lia, lia-cloak, kyra, kyra-bound, valentus, valentus-cloak, mother,
  father, orwen, algard, maedchen, harro, baris-young, baris, foltan, azar, craupor, elnon, alastir, flick, vamir,
  ignatius, council-mage-a/b/c, conspirator, falke-soldier, paladin, shadow-sword, shadow-spear, shadow-crossbow,
  shadow-club, shadow-rider (Reiter), ghoul (Leichenfresser), barmaid, bard, juggler, merchant, dwarf, villager-m,
  villager-f, elf-m, elf-f, guard-brotherhood; Tiere dog, horse, pig, chicken, hare, crow (Flug: Pose `fly`), deer.
  Animationen `idle, walk, run, sneak, sit, kneel, lie, crouch, read, sit-read, cast, attack, shoot, hit, fall, talk,
  interact …` mit Fallback-Ketten; jede Manifest-Pose ist zusätzlich unter ihrem Namen abspielbar (`graze`, `peck`).
- **Porträts**: jede sprechende Figur oben (außer Tieren und dem Leichenfresser), dazu `baris-scarred`.
- **Requisiten**: alana-book, anvil, banner-falcon, banner-shadow, barrel, bench, bird-nest(-chick/-fledgling),
  blanket, bookstack, broken-spear, bucket, campfire (animiert, Licht), candle(-unlit), cart, cloak-spread,
  cradle-twins, crate, fallen-banner, firering, grave-cairn(-v2), haystack, keg, kyra-bead, kyra-ribbon, lantern,
  oak-tree, pigpen-gate, sack, shield-on-ground, signpost, stones-pile, stool, table, tent, tent-big-black, torch,
  training-dummy, twigs, weapon-rack, well.
- **Hintergründe**: nur die Demos (`dev-meadow`, `dev-clearing`, `art-gallery-meadow`). **Jede Kapitelkarte braucht
  einen eigenen gemalten Hintergrund.**
- **Tafeln**: `wiese-lia-liest` (Lia liest unter der Eiche, für `wiese`).

## 9. Prüfen und abgeben

```bash
cd game
npx tsc --noEmit                      # Typen
npx vitest run                        # Logik-Tests (eigene *.test.ts neben dem Code für reine Logik)
node ../scripts/map_tool.mjs all      # Karten-Geometrie
python3 ../scripts/art/build_manifest.py --check
npx playwright test                   # Smoke-Test (e2e/smoke.pw.ts) + Eingabe-Test (e2e/input.pw.ts)
```

- Neue Szenen in `game/e2e/smoke.pw.ts` (Liste `SCENES`) mit einem Kennzeichen eintragen, das sicher erscheint
  (z. B. Zieltext im HUD), damit Ladefehler und Konsolenfehler automatisch auffallen.
- Eigene Playwright-Experimente in `game/e2e/scratch-<bereich>/` und vor der Abgabe löschen. Screenshots in
  1280×720 und 390×844 ansehen; Hochformat zeigt den Querformat-Hinweis.
- Szenen per `?scene=<id>` und per Durchspielen aus der Vorszene testen (`prepare` deckt nur Sprünge ab).
