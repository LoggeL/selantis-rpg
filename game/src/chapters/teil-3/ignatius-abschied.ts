// Scene „e3-ignatius-abschied“ – Abschied (docs/teil-3/umsetzung.md §3, F3 43:38–44:18). One part; a reload restarts it
// from the moment after the duel (Ignatius alive on the bank), which is always a valid start.
// On the mossy bank of e3-waldpfad in the warm evening light Ignatius lies where Vamir's blow threw him. Lia (own
// staff, still poisoned: slow) goes to him. Heart: a quiet conversation with choices. She kneels and takes his hand
// (storyAction 'tend'); if she carries Mother's tincture she may try it and he gently refuses (it is not used up).
// He sees her progress, apologises (the night outside the study, Gwynn long dead), Lia forgives in her own words
// (three tones, all forgive), he speaks of the body as a worn coat and of watching from further back, asks her to pass
// Schattentöter on if she carries it, and his last words tell her to turn round when it gets quiet. His hand goes
// still. Flick and Kyra come up the path („Hier!“): she turns round, and there they are. Stillness.
// End: e3-ignatius-tot, e3-versoehnt, party Kyra + Flick → e3-hueterin. Texts: ignatius-abschied-texte.ts.
import { G } from '../../core/G';
import { defineMap, startWorld, type ActorHandle, type MapDef, type WorldCtx } from '../../world';
import {
  AFTER_DEATH, APOLOGY, ARRIVAL, CARE_CHOICES, FINAL, FORGIVE, FORGIVE_CHOICES, FORGIVE_TONES, HAND, LAST, LAST_CHOICES, LETTING_GO,
  PROGRESS, SCHATTENTOETER, TINCTURE, WAKE, carriesSchattentoeter, endFarewell, tinctureOffered, type ForgiveTone, type Line,
} from './ignatius-abschied-texte';
import { restageGesture, type GesturePicture } from '../teil-2/gewoelbe-geste';
import { look } from './battle-shared';
import { poisonedGait } from './vamir-schwaeche';
import { WALDPFAD_BLOCKS, WALDPFAD_OCCLUDERS, WALDPFAD_SPOT, WALDPFAD_SURFACES, WALDPFAD_WALK } from './waldpfad';
import { AMBER, VIOLET, bg, e3Scene, lia, liaLook, nextScene, sfx, ui, until } from './shared';

const IGNATIUS = 'ignatius';
/** Scene flags (reset when the scene starts): the conversation is over, his hand went still. */
const F = { talked: 'e3-ab-gespraech', tone: 'e3-ab-ton' } as const;

export const waldpfadAbschied: MapDef = defineMap({
  id: 'e3-waldpfad-abschied',
  name: 'Waldrand',
  background: 'e3-waldpfad',
  walk: WALDPFAD_WALK,
  block: WALDPFAD_BLOCKS,
  occluders: WALDPFAD_OCCLUDERS,
  surfaces: WALDPFAD_SURFACES,
  surface: 'grass',
  depthScale: { y0: 0, s0: 1.18, y1: 720, s1: 1.34 },
  npcs: [
    {
      id: IGNATIUS, preset: 'e2-ignatius', speaker: 'e2-ignatius', at: WALDPFAD_SPOT.ignatius, dir: 'right', idle: 'lie', facePlayer: false,
      verb: 'Zu ihm knien', talk: (w, ig) => farewell(w, ig),
    },
  ],
  spawns: { duell: { at: WALDPFAD_SPOT.afterDuel, dir: 'left' } },
  time: 'dusk',
  weather: 'leaves',
  ambience: ['wind', 'birds'],
  ambienceVolume: { wind: 0.45, birds: 0.15 },
  music: null,
  lookMode: false,
  critters: false,
  resetOnEnter: true,
});

const speakerOf: Record<Line['who'], string> = { ignatius: 'e2-ignatius', lia: 'e3-lia', 'lia-think': '', kyra: 'e3-kyra', flick: 'e2-flick' };

async function play(w: WorldCtx, lines: readonly Line[]): Promise<void> {
  for (const l of lines) {
    if (l.who === 'lia-think') await w.think(l.text);
    else if (l.who === 'lia') await lia(w, l.text, l.mood);
    else await w.say(speakerOf[l.who], l.text, l.mood ? { mood: l.mood } : undefined);
  }
}

/** Close-up behind the gesture: Ignatius on the moss, Lia kneeling beside him. */
const HAND_PICTURE = (): GesturePicture => ({
  background: 'e3-waldpfad',
  focus: [438, 320],
  zoom: 3.4,
  figures: [
    { id: 'e2-ignatius', pose: 'lie', at: WALDPFAD_SPOT.ignatius, facing: 'right' },
    { id: look('e3-lia-eigenstab', 'lia-cloak'), pose: 'kneel', at: WALDPFAD_SPOT.kneel, facing: 'left' },
  ],
  glint: [WALDPFAD_SPOT.kneel[0] - 16, WALDPFAD_SPOT.kneel[1] - 14],
});

async function farewell(w: WorldCtx, ig: ActorHandle): Promise<void> {
  if (G.state.is(F.talked)) return;
  // Warm amber around him that fades with him (his colour, never turquoise).
  const warmth = w.lighting.add({ id: 'e3-ab-glut', at: [ig.x, ig.y - 10], kind: 'plain', color: AMBER, radius: 46, intensity: 0, always: true });
  ui().prefetchPlate('e3-abschied');
  let tone: ForgiveTone = 'gut';
  await w.cutscene(async () => {
    await w.player.walkTo(WALDPFAD_SPOT.kneel[0], WALDPFAD_SPOT.kneel[1], { face: 'left' });
    w.player.setIdle('kneel');
    bg(warmth.fadeTo(0.55, 1200));
    try { G.audio.music('grief', { fadeMs: 3000 }); } catch { /* audio optional */ }
    await w.camera.pan([ig.x + 30, ig.y - 10], 900);
    await play(w, WAKE);
    if (tinctureOffered()) {
      const pick = await w.choose([...CARE_CHOICES], { prompt: 'Was tut Lia?', speaker: 'e3-lia' });
      G.state.set('e3-ab-tinktur', pick === 0);
      if (pick === 0) await play(w, TINCTURE);
    }
    await G.ui.plate('e3-abschied', { caption: 'Abschied', pan: 'in', durationMs: 60000 });
    const gesture = G.ui.storyAction('tend', 'Seine Hand halten');
    restageGesture('tend', 'Nimm seine Hand. Ganz ruhig, hin und her, damit sie warm wird.', HAND_PICTURE());
    await gesture;
    await play(w, HAND);
    await play(w, PROGRESS);
    await play(w, APOLOGY);
    const f = await w.choose([...FORGIVE_CHOICES], { prompt: 'Was sagt Lia?', speaker: 'e3-lia' });
    tone = FORGIVE_TONES[f];
    G.state.set(F.tone, tone);
    await play(w, FORGIVE[tone]);
    await play(w, LETTING_GO);
    const last = await w.choose([...LAST_CHOICES], { prompt: 'Was sagt Lia zum Schluss?', speaker: 'e3-lia' });
    await play(w, LAST[last]);
    if (carriesSchattentoeter()) await play(w, SCHATTENTOETER);
    await play(w, FINAL);
    await G.ui.closePlate();
    // His hand goes still: the warmth fades, only the wind is left.
    await w.wait(600);
    await warmth.fadeTo(0, 2600);
    warmth.remove();
    try { G.audio.music(null, { fadeMs: 2500 }); } catch { /* audio optional */ }
    for (const t of AFTER_DEATH) await w.think(t);
  });
  G.state.set(F.talked);
  await arrival(w);
  endFarewell(tone);
  await ui().fade('out', 1600);
  await nextScene('e3-hueterin');
}

/** Flick and Kyra come up the path. Lia turns round. */
async function arrival(w: WorldCtx): Promise<void> {
  const [ax, ay] = WALDPFAD_SPOT.arrive;
  const flick = w.spawn({ id: 'flick', preset: 'flick', speaker: 'e2-flick', at: [ax + 14, ay], dir: 'up', facePlayer: false, solid: false });
  const kyra = w.spawn({ id: 'kyra', preset: 'kyra', speaker: 'e3-kyra', at: [ax - 10, ay + 4], dir: 'up', facePlayer: false, solid: false });
  flick.hold(true);
  kyra.hold(true);
  await w.cutscene(async () => {
    sfx('rustle', { volume: 0.4, distance: 0.4 });
    await w.wait(500);
    await play(w, ARRIVAL.slice(0, 1));
    await w.camera.pan([500, 470], 1100);
    bg(flick.walkTo(WALDPFAD_SPOT.flickWatch[0], WALDPFAD_SPOT.flickWatch[1] + 40, { run: true }));
    await kyra.walkTo(WALDPFAD_SPOT.flickWatch[0] - 30, WALDPFAD_SPOT.flickWatch[1] + 20, { run: true });
    w.player.setIdle('idle');
    w.player.face('down');
    await play(w, ARRIVAL.slice(1, 3));
    bg(w.camera.pan([470, 372], 1200));
    await kyra.walkTo(WALDPFAD_SPOT.kyraKneel[0], WALDPFAD_SPOT.kyraKneel[1], { face: 'left' });
    kyra.setIdle('kneel');
    w.player.setIdle('kneel');
    w.player.face('left');
    await play(w, ARRIVAL.slice(3, 4));
    await flick.walkTo(WALDPFAD_SPOT.flickWatch[0], WALDPFAD_SPOT.flickWatch[1], { face: 'down' });
    await play(w, ARRIVAL.slice(4));
    await w.wait(1500);
  });
}

async function abschiedScript(w: WorldCtx): Promise<void> {
  G.state.set(F.talked, false);
  w.lockPlayer();
  bg(poisonedGait(w, () => G.state.is(F.talked)));
  // Where Vamir stood a last violet haze thins out.
  const haze = w.lighting.add({ id: 'e3-ab-dunst', at: [WALDPFAD_SPOT.vamir[0], WALDPFAD_SPOT.vamir[1] - 16], kind: 'plain', color: VIOLET, radius: 60, intensity: 0.7, always: true });
  w.fx.burst([WALDPFAD_SPOT.vamir[0], WALDPFAD_SPOT.vamir[1] - 10], 'smoke', 6);
  await ui().fade('in', 1400);
  await w.cutscene(async () => {
    await haze.fadeTo(0, 2200);
    haze.remove();
    await w.think('Fort. Wo er stand, ist nur noch ein kalter Hauch. Und Reif auf dem Moos.');
    await lia(w, 'Ignatius?', 'scared');
  });
  w.setObjective('e3-ab-hin', 'Ignatius liegt auf der Böschung. Geh zu ihm.', IGNATIUS);
  w.unlockPlayer();
  await until(w, () => G.state.is(F.talked));
  w.completeObjective('e3-ab-hin');
}

export const scene = e3Scene('e3-ignatius-abschied', 'Abschied', async () => {
  await G.ui.fade('out', 0);
  await startWorld({ map: waldpfadAbschied, spawn: 'duell', player: liaLook(), companions: [], fadeIn: false, script: abschiedScript });
});
