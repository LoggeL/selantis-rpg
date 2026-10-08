// Scene „e3-vamir“ – Vamir (docs/teil-3/umsetzung.md §3, F3 42:37–43:30). Two checkpointed parts (G.goto with
// { part }, a reload restarts the current part):
//  1. default: the forest path e3-waldpfad in the late afternoon. Lia alone (Kyra and Flick search elsewhere), with
//     her own staff, poisoned (slow, staggers). Heart 1: the trail in the Spurenblick on the lower path (rules in
//     vamir-spur.ts): a frost-rimmed violet burn mark, Ignatius' lost Schattentöter (Lia picks it up, once), his boot
//     prints leaving the path for the bank. Then voices from up the bank. Lia creeps up behind the bush; tableau:
//     Vamir over the kneeling Ignatius, Ignatius defies him, Lia tries to raise her staff (storyAction 'lift') and is
//     too slow – the cold violet blow hits him, she cries out and steps into the open. Vamir turns.
//  2. 'duell' (only after the tableau, e3-va-gestellt): the tactics duel e3-vamir-duell (vamir-duell-battle.ts):
//     violet shield, teleports, the Urmacht's finisher. Defeat offers „Erneut versuchen“ in the battle; giving up
//     restarts this part. On the win: e3-vamir-besiegt → e3-ignatius-abschied.
// Violence (umsetzung.md, Vorrang): the blow is cold violet light and lands hard – a red hit flash, shake, droplets,
// and a dark stain spreading under Ignatius as he sinks into the leaves (common/blood.ts). He dies calmly later, without blood.
import { G } from '../../core/G';
import type { TacticsStartData } from '../../tactics/api';
import { defineMap, startWorld, type ActorHandle, type MapDef, type WorldCtx } from '../../world';
import { restageGesture, type GesturePicture } from '../teil-2/gewoelbe-geste';
import { look } from './battle-shared';
import { duelBattle } from './vamir-duell-battle';
import { poisonedGait } from './vamir-schwaeche';
import { OPENING_THOUGHTS, TABLEAU, TRAIL, VOICES, nextFind, pickUpSchattentoeter, trailFlag, trailFound, type TrailId } from './vamir-spur';
import { HIDE_ZONE, WALDPFAD_BLOCKS, WALDPFAD_HIDE, WALDPFAD_OCCLUDERS, WALDPFAD_SPOT, WALDPFAD_SURFACES, WALDPFAD_WALK } from './waldpfad';
import { bloodHit, bloodPool, preloadBlood } from '../common/blood';
import { VIOLET, bg, e3Scene, lia, liaLook, nextScene, sfx, ui, until } from './shared';

/** Scene flags: the voices were heard, the tableau ran (checkpoint for the duel part), the contract flag. */
const F = { heard: 'e3-va-gehoert', confronted: 'e3-va-gestellt', won: 'e3-vamir-besiegt' } as const;

const VAMIR = 'vamir';
const IGNATIUS = 'ignatius';

export const waldpfadSpur: MapDef = defineMap({
  id: 'e3-waldpfad-spur',
  name: 'Waldweg',
  background: 'e3-waldpfad',
  walk: WALDPFAD_WALK,
  block: WALDPFAD_BLOCKS,
  occluders: WALDPFAD_OCCLUDERS,
  surfaces: WALDPFAD_SURFACES,
  hidingSpots: WALDPFAD_HIDE,
  surface: 'grass',
  depthScale: { y0: 0, s0: 1.18, y1: 720, s1: 1.34 },
  clues: TRAIL.map(t => ({ id: `spur-${t.id}`, at: t.at, kind: t.kind, angle: t.angle, verb: 'Ansehen', onInteract: (w: WorldCtx) => readFind(w, t.id) })),
  triggers: [
    { id: 'busch', poly: HIDE_ZONE, once: false, when: () => G.state.is(F.heard) && !G.state.is(F.confronted), onEnter: w => confront(w) },
  ],
  spawns: { unten: { at: WALDPFAD_SPOT.start, dir: 'up' } },
  time: 'day',
  weather: 'leaves',
  ambience: ['wind', 'birds'],
  ambienceVolume: { wind: 0.55, birds: 0.25 },
  music: 'dread',
  lookMode: true,
  critters: false,
  resetOnEnter: true,
});

// ---------------------------------------------------------------------------------------------------------------
// Part 1: the trail
// ---------------------------------------------------------------------------------------------------------------

function updateTrailObjective(w: WorldCtx): void {
  const next = nextFind(trailFound());
  if (next) w.setObjective('e3-va-spur', `Folge Ignatius’ Spur den Weg hinauf (${w.controlHint('look')} halten für den Spurenblick).`, `spur-${next.id}`);
}

async function readFind(w: WorldCtx, id: TrailId): Promise<void> {
  const find = TRAIL.find(t => t.id === id)!;
  if (G.state.is(trailFlag(id))) { await w.think(find.thought); return; }
  await w.cutscene(async () => {
    if (id === 'brand') {
      w.fx.burst(find.at, 'smoke', 4);
      await w.think(find.thought);
      await w.think('Ignatius’ Feuer ist bernsteinfarben und warm. Das hier ist das Gegenteil. Das ist Vamir.');
    } else if (id === 'stab') {
      await w.think(find.thought);
      w.player.setIdle('kneel');
      await w.wait(400);
      pickUpSchattentoeter();
      w.player.setIdle('idle');
      await w.think('Ich nehme ihn mit. Er bekommt ihn zurück. Gleich. Wenn ich ihn gefunden habe.');
    } else {
      await w.think(find.thought);
    }
  });
  G.state.set(trailFlag(id));
  if (nextFind(trailFound())) updateTrailObjective(w);
}

/** All finds read: voices from up the bank, out of sight. Vamir and Ignatius are placed there now (still off-screen). */
async function hearVoices(w: WorldCtx): Promise<void> {
  w.completeObjective('e3-va-spur');
  w.spawn({ id: IGNATIUS, preset: 'e2-ignatius', speaker: 'e2-ignatius', at: WALDPFAD_SPOT.ignatius, dir: 'right', idle: 'kneel', facePlayer: false });
  w.spawn({ id: VAMIR, preset: 'vamir', speaker: 'e2-vamir', at: WALDPFAD_SPOT.vamir, dir: 'left', facePlayer: false });
  w.actor(IGNATIUS).hold(true);
  w.actor(VAMIR).hold(true);
  await w.cutscene(async () => {
    w.player.face('up');
    sfx('thud', { volume: 0.4, distance: 0.6 });
    await w.wait(500);
    for (const v of VOICES) await w.say(v.who === 'vamir' ? 'e2-vamir' : 'e2-ignatius', v.text);
    await w.player.emote('!');
    await w.think('Da oben. Hinter dem Busch auf der Böschung. Leise jetzt, so leise, wie es mit diesen Beinen geht.');
  });
  G.state.set(F.heard);
  w.setObjective('e3-va-heran', `Schleich dich hinter den Busch auf der Böschung (${w.controlHint('sneak')} halten).`, WALDPFAD_SPOT.hide);
}

/**
 * A cold violet blow that lands hard: violet light, then the red hit flash with droplets; Ignatius sinks into the
 * leaves and a dark stain spreads under him.
 */
async function violetBlow(w: WorldCtx, ig: ActorHandle): Promise<void> {
  const glow = w.lighting.add({ id: 'e3-va-stoss', at: [ig.x, ig.y - 18], kind: 'plain', color: VIOLET, radius: 70, intensity: 1.2, always: true });
  sfx('shockwave', { volume: 0.7, pitch: 0.7 });
  w.lighting.flash(VIOLET, 220);
  w.fx.burst([ig.x, ig.y - 20], 'smoke', 10);
  await w.wait(120);
  bloodHit(w, [ig.x, ig.y - 26], 1);
  sfx('hit-heavy', { volume: 0.85 });
  await ig.play('hurt' as never, { ms: 700 });
  ig.setIdle('lie');
  sfx('fall', { volume: 0.5 });
  bloodPool(w, [ig.x - 4, ig.y - 2], { id: 'e3-va-blut', scale: 0.6, ms: 2600 });
  bg(glow.fadeTo(0, 1600).then(() => glow.remove()));
}

/** Close-up behind the gesture: Vamir's raised hand over the kneeling Ignatius, Lia at the bush below. */
const LIFT_PICTURE = (): GesturePicture => ({
  background: 'e3-waldpfad',
  focus: [492, 330],
  zoom: 3,
  figures: [
    { id: 'e2-ignatius', pose: 'kneel', at: WALDPFAD_SPOT.ignatius, facing: 'right' },
    { id: 'vamir', pose: 'cast', at: WALDPFAD_SPOT.vamir, facing: 'left' },
    { id: look('e3-lia-eigenstab', 'lia-cloak'), pose: 'kneel', at: WALDPFAD_SPOT.hide, facing: 'left' },
  ],
  glint: [WALDPFAD_SPOT.hide[0] - 6, WALDPFAD_SPOT.hide[1] - 46],
});

async function confront(w: WorldCtx): Promise<void> {
  if (G.state.is(F.confronted)) return;
  G.state.set(F.confronted);
  w.completeObjective('e3-va-heran');
  const ig = w.actor(IGNATIUS), va = w.actor(VAMIR);
  ui().prefetchPlate('e3-vamir-fall');
  await w.cutscene(async () => {
    w.player.setIdle('crouch' as never);
    await w.camera.pan([470, 330], 900);
    for (const line of TABLEAU) {
      if (line.who === 'lia-think') await w.think(line.text);
      else await w.say(line.who === 'vamir' ? 'e2-vamir' : 'e2-ignatius', line.text, line.who === 'ignatius' ? { mood: 'determined' } : undefined);
      if (line.text.startsWith('Dann kümmern')) {
        va.face(ig.id);
        bg(va.play('cast', { ms: 1800 }));
      }
    }
    // Lia tries to lift her staff in time. She does it – and it is still too late.
    const gesture = G.ui.storyAction('lift', 'Den Stab heben');
    restageGesture('lift', 'Heb den Stab. Schneller, als das Gift es will. Er hat die Hand schon erhoben.', LIFT_PICTURE());
    await gesture;
    await violetBlow(w, ig);
    w.player.setIdle('idle');
    await lia(w, 'Ignatius!', 'scared');
    await w.player.walkTo(WALDPFAD_SPOT.stepOut[0], WALDPFAD_SPOT.stepOut[1], { face: 'left' });
    va.face('player');
    await w.wait(500);
    await w.think('Er dreht sich um. Unter der Kapuze nur Dunkel. Und ich stehe hier, mitten im Moos, mit zitternden Knien.');
  });
  await ui().fade('out', 900);
  await nextScene('e3-vamir', { part: 'duell' });
}

async function spurScript(w: WorldCtx): Promise<void> {
  preloadBlood(w);
  for (const id of TRAIL.map(t => t.id)) G.state.set(trailFlag(id), false);
  G.state.set(F.heard, false);
  G.state.set(F.confronted, false);
  w.lockPlayer();
  bg(poisonedGait(w, () => G.state.is(F.confronted)));
  await ui().fade('in', 1100);
  w.unlockPlayer();
  for (const t of OPENING_THOUGHTS) await w.think(t);
  updateTrailObjective(w);
  await until(w, () => !nextFind(trailFound()) && !G.ui.busy());
  await hearVoices(w);
}

// ---------------------------------------------------------------------------------------------------------------
// Part 2: the duel
// ---------------------------------------------------------------------------------------------------------------

function startDuel(): void {
  G.stopGameplayScenes();
  ui().prefetchPlate('e3-vamir-fall');
  void G.ui.fade('in', 900);
  G.game.scene.start('Tactics', {
    battle: duelBattle(),
    onEnd: async result => {
      if (result.outcome !== 'win') { await nextScene('e3-vamir', { part: 'duell' }); return; }
      await G.ui.fade('out', 900);
      G.state.set(F.won);
      await nextScene('e3-ignatius-abschied');
    },
  } satisfies TacticsStartData);
}

export const scene = e3Scene('e3-vamir', 'Vamir', async params => {
  if (params?.part === 'duell' && G.state.is(F.confronted)) { startDuel(); return; }
  await G.ui.fade('out', 0);
  await G.ui.narrate(['Ignatius’ Spur führte vom Hügel hinunter in einen Wald, in dem das Laub knöcheltief lag. Lia folgte ihr allein.'], { style: 'card' });
  await startWorld({ map: waldpfadSpur, spawn: 'unten', player: liaLook(), companions: [], fadeIn: false, script: spurScript });
});
