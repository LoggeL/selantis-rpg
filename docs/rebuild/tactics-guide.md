# Taktikkampf – Leitfaden für Kapitel-Autoren

Der Taktikkampf (`game/src/tactics/`) ist ein isometrisches Raster mit Höhenstufen im Stil von FFTA. Ein Kampf ist reine Daten (`BattleDef`) plus async-Hooks für Story-Momente. Vertrag: `game/src/tactics/api.ts`. Regeln (rein, getestet): `game/src/tactics/rules/`.

## Kampf starten

```ts
import { G } from '../../core/G';
import type { TacticsStartData } from '../../tactics/api';

G.stopGameplayScenes();
G.game.scene.start('Tactics', {
  battle: myBattle,
  onEnd: async result => {            // result.outcome: 'win' | 'lose', rounds, dead, wounded, flags, retries
    await G.goto('naechste-szene');
  },
} satisfies TacticsStartData);
```

Bei einer Niederlage bietet der Kampf standardmäßig „Erneut versuchen“ an (Neustart ohne Fortschrittsverlust). Mit `onDefeat: 'end'` wird stattdessen `onLose` und `onEnd({ outcome: 'lose' })` aufgerufen.

## Karte

Zwei gleich große ASCII-Raster. Leerzeichen zwischen den Zellen sind erlaubt.

- `height`: Ziffern `0`–`9` (oder `a`–`z` für 10+) = Höhenstufe.
- `terrain`: `.` Gras · `,` Erde · `:` Steinboden · `s` Sand · `~` Wasser (kostet 2, dämpft Stürze) · `m` Schlamm (kostet 2) · `b` Gebüsch (Deckung −30 %, verbirgt) · `r` Fels · `#` Mauer/Ruine · `T` Baum (alle drei blockieren) · `f` Feuer (3 Schaden beim Betreten) · `x` kein Feld.
- `props`: Deko auf Feldern (`banner-light`, `banner-dark`, `campfire`, `stake`, `crate`, `barrel`, `stump`, `tree-pine`, `tree-oak`, `tree-dead`, `rock`, `bush`, `ruin`, `fire`) oder eine Requisiten-ID aus dem Art-Manifest (wird per `G.art.preload` geladen). Steht eine Deko auf einem Fels-/Baum-/Feuerfeld, ersetzt sie dessen Aussehen (z. B. `crate` auf `r`, `campfire` auf `f`).
- `trees`: `'oak' | 'pine' | 'mixed' | 'dead'` für `T`-Felder.

- `ground`: Aussehen der Grasfelder (`.`, `b`, `T`): `'lush'` sattes Sommergras (Standard), `'dry'` trockenes Spätsommergras, `'forest'` Waldboden mit Moos und Laub. Nur Optik.
- `paint`: optionale Übermalung pro Feld (nur Optik, Regeln bleiben), gleich groß wie `terrain`: `g` Gras · `y` trockenes Gras · `f` Waldboden · `d` Erdpfad · `s` Steinplatten · `a` Sand · `m` Schlamm · jedes andere Zeichen = Standard. Gut für Trampelpfade, zertretenen Boden um ein Lager, Steinplatten unter Ruinen. Gleich hohe Nachbarfelder gehen mit unregelmäßigen, gemalten Rändern ineinander über.

Wasserfelder sollten auf Höhe 0 oder neben gleich hohen Feldern liegen. x = Spalte (nach rechts unten), y = Zeile (nach links unten); (0,0) ist oben.

## Darstellung und Grafik

- Interne Auflösung 640×360. Isometrische Felder sind 48×24 px, eine Höhenstufe 12 px. Figuren kommen aus den Codex-Laufblättern (64×64-Zellen, Figur ~42 px, Fußanker über `G.art.characterAnchor`) und stehen 1:1 auf den Feldern, ungefähr so groß wie in FFTA. Der Kampf lädt vor dem Start `G.art.preload(scene, { characters })` für alle `preset`/`boundPreset` der Einheiten und Wellen. Fehlt ein Laufblatt, zeichnet die Art-Ebene einen Platzhalter.
- Posen: `attack`, `hit` (auch `hurt`), `kneel`, `cast`, `shoot`, `fall` (sonst `lie`), `sit`. Fehlt eine Pose, gilt die Kette in `view/units.ts` (`POSE_CHAIN`), zuletzt `idle`.
- `boundPreset` an einer Einheit (z. B. `'kyra-bound'`) zeigt dieses Aussehen, solange sie gefesselt ist. Nach dem Befreien wechselt sie zu `preset`.
- Gelände ist **gemalt**: nahtlose 256×256-Pixeltexturen aus der Codex-Bildgenerierung (`game/public/assets/tactics/tex-*.png`: Gras, trockenes Gras, Waldboden, Erde, Steinplatten, Sand, Wasser, Schlamm, Erd-/Felswand, Graskante, Mauerwerk). Die Texturen werden in Weltkoordinaten auf Ober- und Seitenflächen gelegt, also ohne sichtbare Kachelwiederholung. Dazu kommen Flächenschattierung, Lichtkanten, Kontaktschatten, Gras, das über die Kante hängt, und ein feines Raster zum Zählen der Felder.
- Requisiten sind gemalte Iso-Sprites (`game/public/assets/props/iso-*.png`) mit Kontaktschatten. Feuer und Flammen bleiben Code-Effekte.
- Der Himmel ist pro `backdrop` gemalt (`game/public/assets/tactics/sky-{dusk,night,day,forest}.png`), dazu kommt eine passende Lichtfärbung auf Gelände und Figuren.
- Pipeline: `scripts/art/tactics_prompts.py` (Prompts), `tactics_generate.py` (Codex, 2 parallel, mit Timeout und Wiederholung), `tactics_build.py` (Freistellen, Verkleinern, Nahtprüfung, `manifest.json`). Prompts und Lieferdaten stehen in `docs/rebuild/art/tactics.json`. Fehlt eine Datei, zeigt der Kampf einen schlichten Verlauf als Himmel bzw. einen neutralen Platzhalterblock; nur Feuer und Flammen sind Code-Effekte.

## Regeln in Kürze

- **Runde:** Alle Teams teilen sich eine Zugreihenfolge nach `speed` (höchster Wert zuerst, Gleichstand nach Einheiten-ID). Nur die aktive Figur darf bewegen oder handeln. Jede Einheit: einmal bewegen + einmal handeln, beliebige Reihenfolge. Bewegung lässt sich zurücknehmen, bis gehandelt wurde. Verstärkung und befreite Figuren kommen nächste Runde hinzu.
- **Fortschritt:** HP, MP, Level, Exp und Tempo erscheinen auf Figurenkarten. Erfolgreiche Aktionen geben 10 Exp und 10 AP, ein besiegtes Ziel 20 Exp pro Aktion. Sieg gibt zusätzlich 20 Exp und 20 AP. 100 Exp erhöhen das Level, 50 AP meistern die Fähigkeiten der ausgerüsteten Waffe. Level, Exp, Ausrüstung und gemeisterte Fähigkeiten werden nach dem Sieg in den Kampagnenzustand übernommen und am nächsten Speicherpunkt gespeichert. Details und Referenzbilder: `docs/ffta-battle-reference.md`.
- **Waffen und MP:** `weapon` und `weapons` setzen Ausrüstung und Wechselmöglichkeiten. Ohne Angaben ergibt sich die Startausrüstung aus den Fähigkeiten. Wechsel ist vor Bewegung/Aktion im eigenen Zug möglich. Gemeisterte Fähigkeiten bleiben ohne die ursprüngliche Waffe verfügbar. `mpCost` kostet MP pro Aktion, 2 MP regenerieren am Beginn des eigenen Zuges. `mp`, `maxMp`, `level` und `exp` können an `BattleUnitDef` gesetzt werden.
- **Bewegung:** `move` Punkte; Klettern um mehr als 1 Stufe kostet +1 je Stufe; höchstens `jump` Stufen hinauf, `jump + 1` hinab. Verbündete kann man durchqueren, Feinde nicht.
- **Treffer:** Chance = Genauigkeit ± 5 % je Höhenstufe (max. ±3) + Seite +10 / Rücken +20 − Deckung 30 − Ausweichen 45. Schaden = Stärke + Angriff − Rüstung, × Seite 1,25 / Rücken 1,5 × Höhe ±10 % je Stufe × Schutzwall 0,5.
- **Blickrichtung** folgt automatisch der letzten Bewegung/Aktion (Pfeil unter jeder Figur).
- **Wegstoßen:** Aufprall an Hindernis, Kante oder Rand 3 Schaden (die getroffene Einheit 2); Sturz 4 Schaden je Stufe ab der zweiten; Wasser dämpft Stürze. Schutzwall verhindert Stoßen.
- **Fernkampf:** braucht freie Schusslinie; `heightRange` gibt +1 Reichweite je 2 Stufen Höhenvorteil.
- **Status:** `guarded` (Schutzwall), `stunned`, `taunt` (Ablenken: Feinde gehen auf sie los), `evasive`, `bound` (gefesselt, unangreifbar, befreibar durch `befreien`), `burning`.
- **Einheiten-Flags:** `nonLethal: true` → „kampfunfähig“ statt tot (bleibt kniend liegen). Tag `'spared'` → Feinde dürfen die Einheit nicht verletzen. Tag `'vip'` → KI bevorzugt sie als Ziel.

## Level und Figurenwerte

`chapters/common/battleCharacters.ts` enthält die Ausgangslevel und Level-1-Werte aller Kampffiguren. Kapitel verwenden `...characterStats('flick')`; Dunkelschatten erhalten über `shadowStats(preset)` ihre Werte. Storykämpfe und Übungsplätze verwenden dieselben Profile.

| Figur | Startlevel | HP | MP | Angriff | Rüstung | Tempo |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Valentus | 20 | 87 | 62 | 22 | 11 | 9 |
| Falke | 12 | 59 | 26 | 14 | 7 | 9 |
| Flick | 8 | 39 | 20 | 10 | 4 | 9 |
| Lia | 2 | 17 | 20 | 2 | 0 | 6 |
| Kyra | 1 | 12 | 10 | 2 | 0 | 6 |
| Baris im Prolog | 9 | 48 | 18 | 12 | 6 | 4 |
| Baris als Hauptmann | 16 | 69 | 32 | 19 | 9 | 8 |
| Orwen | 10 | 47 | 24 | 12 | 6 | 5 |
| Algard | 5 | 26 | 12 | 6 | 3 | 4 |
| Mädchen | 4 | 21 | 10 | 5 | 2 | 5 |
| Paladin | 8 | 43 | 22 | 9 | 5 | 3 |
| Dunkelschatten mit Schwert | 4 | 22 | 10 | 5 | 2 | 4 |

`baseStats` beschreibt maximale HP/MP, Angriff, Rüstung und Tempo auf Level 1. Pro weiterem Level steigen maximale HP um 3, maximale MP um 2 und Angriff um 1. Rüstung steigt auf Level 3, 5, 7 usw.; Tempo auf Level 6, 11, 16 usw. `statsAtLevel()` liefert die Anfangswerte. Speicherstand-Wiederherstellung und EXP-Levelaufstiege verwenden dieselbe Kurve. Bewegung und Sprung bleiben Eigenschaften der Figur.

Ohne `hp` und `mp` beginnt eine Figur mit vollen Ressourcen. Explizite Werte setzen Verletzung oder erschöpfte MP am angegebenen Startlevel. Die verwundeten Paladine behalten ihren Verletzungsanteil. Erhöht ein gespeichertes Level die Maxima, bleibt die fehlende Menge erhalten. Ältere Speicherstände mit Platzhalter-Level 1 unterschreiten das neue Ausgangslevel nicht; EXP und Meisterung bleiben erhalten. Ältere eigene Begegnungen ohne `baseStats` können weiterhin absolute Werte am Startlevel angeben.

## Fähigkeiten

Standardbibliothek in `rules/abilities.ts`: `handstoss`, `strahl`, `druckwelle`, `schutzwall` (Valentus) · `doppelhieb`, `tritt` (Falke) · `schwerthieb`, `speerstoss`, `bolzen`, `axthieb`, `wuchtschlag` (Dunkelschatten) · `ausweichen`, `ablenken`, `steinwurf`, `dolch` (Lia) · `bogen`, `messer` (Flick) · `befreien`, `schubsen`. Eigene oder geänderte über `BattleDef.abilities` (gleiche Struktur wie `AbilityDef`, Formen: `single`, `line`, `ring`, `cone`, `area`, `self`).

## KI

`ai`: `'melee'` (nähern, flankieren, Verwundete fokussieren) · `'archer'` (Abstand, Höhe, schießen und zurückweichen) · `'guard'` (wartet, bis jemand in `guardRadius` kommt) · `'hold'` · `'passive'` · `'flee'`. Hooks können überschreiben: `ctx.setAi(id, { profile, target, goal, block, skip })`. `block: 'kyra'` lässt Wachen eine Einheit umstellen (mit `goal` = deren Fluchtziel), statt sie anzugreifen.

## Ziele

`win` (eins genügt): `defeatAll`, `defeat {units}`, `survive {rounds}`, `reach {tiles, unit?}`, `escort {unit, tiles}`, `flag {flag}`.
`lose` (zusätzlich immer „alle Spieler-Einheiten fallen“): `unitDown {units}`, `timeout {rounds}`, `enemyReach {tiles}`, `flag`.
Ziel-Felder von `reach`/`escort` werden mit goldenen Fahnen markiert (oder `goalTiles`).

## Hooks und BattleCtx

Alle Hooks sind async und halten den Kampf an, bis sie fertig sind: `onStart`, `onRound(ctx, round, phase)`, `onUnitDown`, `onHpBelow: [{ unit, below, run }]`, `triggers: [{ id, when, run, once }]`, `onAction`, `onMove`, `onFree`; außerdem `waves: [{ round, phase?, units, text? }]` für Verstärkung.

`ctx`: `say`, `hint(text, { title, unit, tile, until })` (Tutorial-Karte; `until`: `'click' | 'select' | 'move' | 'act' | 'endTurn' | fn`; Hinweise blockieren die Eingabe nie und verfallen, wenn der Spieler die Runde beendet), `focus`, `wait`, `banner`, `bark`, `spawn`, `remove`, `move`, `face`, `pose`, `damage`, `heal`, `setStatus`, `setAi`, `setObjective`, `flag`, `hasFlag`, `shake`, `win`, `lose`, sowie `ctx.battle` (Regel-Engine, lesend).

## Steuerung (für Texte/Hinweise)

Maus: Einheit anklicken, blaues Feld anklicken (Pfadvorschau beim Überfahren), Fähigkeit wählen, Ziel anklicken; Rechtsklick = zurück; Ziehen = Kamera; Mausrad = Zoom (×2, zum Mauszeiger hin). Tastatur: Pfeile/WASD Cursor, Enter/E bestätigen, Rücktaste oder Esc zurück (Esc bricht zuerst Zielwahl/Auswahl ab und öffnet erst danach das Menü), 1–9 Fähigkeiten, Tab nächste Einheit, Leertaste „Zug beenden“, Z Rückgängig, F Warten, M Bewegen, Q/R Ansicht drehen. Touch: Tippen = Auswahl/Vorschau, zweites Tippen = bestätigen.

## Vollständiges Beispiel

```ts
import type { BattleDef } from '../../tactics/api';

export const hofKampf: BattleDef = {
  id: 'kapitel-x-hof',
  title: 'Der Hof im Morgengrauen',
  subtitle: 'Haltet die Scheune',
  backdrop: 'dusk',                       // 'dusk' | 'night' | 'day' | 'forest'
  music: 'battle',
  ambience: ['wind'],
  seed: 42,
  map: {
    height: [
      '2 2 1 0 0 0',
      '2 2 1 0 0 0',
      '1 1 1 0 0 0',
      '0 0 0 0 1 1',
      '0 0 0 0 1 1',
    ],
    terrain: [
      '. b . , , .',
      '. . . , ~ .',
      'r . . , ~ .',
      '. . b , . T',
      '. . . , . .',
    ],
    ground: 'dry',
    paint: [
      '. . . d . .',
      '. . . d . .',
      '. . . d . .',
      '. . . . . .',
      '. . . . . .',
    ],
    props: [{ x: 0, y: 0, prop: 'banner-light' }],
  },
  units: [
    { id: 'valentus', name: 'Valentus', team: 'player', x: 0, y: 0, facing: 's', hp: 30, atk: 3, def: 2,
      move: 4, jump: 2, abilities: ['handstoss', 'strahl', 'druckwelle', 'schutzwall'], preset: 'valentus' },
    { id: 'axt', name: 'Axtkämpfer', team: 'enemy', x: 4, y: 4, facing: 'n', hp: 20, atk: 4, def: 2,
      move: 3, jump: 1, abilities: ['axthieb'], nonLethal: true, preset: 'baris-young', ai: 'melee' },
    { id: 'armbrust', name: 'Armbrustschütze', team: 'enemy', x: 5, y: 4, hp: 10, atk: 3,
      abilities: ['bolzen'], preset: 'shadow-crossbow', ai: 'archer' },
  ],
  waves: [{ round: 3, text: 'Verstärkung!', units: [
    { id: 'ds-9', name: 'Dunkelschatten', team: 'enemy', x: 5, y: 0, hp: 13, atk: 2, def: 1,
      abilities: ['schwerthieb'], preset: 'shadow-sword' },
  ] }],
  objective: {
    text: 'Haltet die Scheune',
    detail: 'Überlebe 4 Runden oder besiege alle Feinde.',
    win: [{ type: 'survive', rounds: 4 }, { type: 'defeatAll' }],
    lose: [{ type: 'unitDown', units: ['valentus'] }],
  },
  victoryText: 'Die Scheune steht noch.',
  hooks: {
    async onStart(ctx) {
      await ctx.say('valentus', 'Bleibt oben am Hang!');
    },
    async onRound(ctx, round, phase) {
      if (round === 1 && phase === 'player') {
        await ctx.hint('Wähle <em>Valentus</em>.', { unit: 'valentus', until: 'select' });
        await ctx.hint('Blaue Felder zeigen seine Reichweite.', { until: 'move' });
      }
    },
    async onUnitDown(ctx, unit, kind) {
      if (unit.id === 'axt' && kind === 'wounded') ctx.bark('axt', 'Das … war noch nicht alles …');
    },
    onHpBelow: [{ unit: 'valentus', below: 0.3, run: ctx => ctx.say('valentus', 'Lange halte ich das nicht durch …') }],
  },
};
```

Demos zum Ausprobieren: `?scene=tactics-demo` (Dunkelhain mit Tutorial), `?scene=tactics-rescue-demo` (Befreien/Geleiten), `?scene=tactics-sandbox` (Stoßen, Sturz, Aufprall).
