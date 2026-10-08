// Scene „e3-hueterin“ – Hüterin (docs/teil-3/umsetzung.md §3, F3 44:47–45:28). One part; a reload restarts it at the
// arrival on the square (round flags are reset, the fibula is once-only).
// The square of e3-trapas by day, people and banners, Lia with her own staff, Kyra and Flick following (party since the
// farewell). Lia is still weak from the poison (slow) until the end of this scene.
// Heart: a short round over the square before the ceremony. The order's healer at the fountain (required): there is no
// antidote, only rest helps. Optional: a paladin at the stairs (the Doktor is gone, his room empty – open), a merchant
// who knew Mother's family by sight (no name), and, if Lia still carries Schattentöter, laying it down in the order
// house chapel („bis einer kommt, der ihn braucht“). Then the ceremony at the foot of the stairs: the Großmeister admits
// his error, the order's task is protecting people now, he names Lia Hüterin under the order's protection (plate
// e3-hueterin). Lia answers in one of three tones (none of them rules anyone) and receives the fibula (once).
// End: e3-hueterin, e3-ordensfibel, e3-gift-abklingend, e3-orden-auftrag='schutz' → e3-epilog.
import { G } from '../../core/G';
import { defineMap, startWorld, type MapDef, type NpcDef, type WorldCtx } from '../../world';
import { pointInPoly } from '../../world/poly';
import {
  ANSWER, ANSWER_CHOICES, ANSWER_TONES, ARRIVAL_CARD, CLOSING, CROWD_BARKS, DOCTOR, DOCTOR_AGAIN, FIBULA, HEALER, HEALER_AGAIN,
  HEALER_KYRA, HEALER_KYRA_CHOICES, HEALER_REST, HUETERIN_FLAGS as F, HUETERIN_SPOT as SPOT, LAY_DOWN, MERCHANT, MERCHANT_AGAIN, OPENING,
  SPEECH, STAIRS_ZONE, canLayDown, endCeremony, grantFibula, layDownSchattentoeter, type AnswerTone, type Line,
} from './hueterin-platz';
import { TRAPAS_BLOCKS, TRAPAS_OCCLUDERS, TRAPAS_SURFACES, TRAPAS_WALK } from './paladine-orte';
import { poisonedGait } from './vamir-schwaeche';
import { bg, e3Scene, lia, liaLook, nextScene, sfx, ui, until } from './shared';
import { PLATZ_CLUES } from './spuersinn';

const GM = 'grossmeister';

const speakerOf: Record<Line['who'], string> = {
  lia: 'e3-lia', 'lia-think': '', gm: 'e3-grossmeister', heilerin: 'e3-heilerin', paladin: 'e3-paladin', haendler: 'haendler',
  kyra: 'e3-kyra', flick: 'e2-flick', narrator: 'narrator',
};

async function play(w: WorldCtx, lines: readonly Line[]): Promise<void> {
  for (const l of lines) {
    if (l.who === 'lia-think') await w.think(l.text);
    else if (l.who === 'lia') await lia(w, l.text, l.mood);
    else await w.say(speakerOf[l.who], l.text, l.mood ? { mood: l.mood } : undefined);
  }
}

const crowd: NpcDef[] = SPOT.crowd.map((at, i) => ({
  id: `buerger-${i + 1}`, preset: i % 2 ? 'villager-m' : 'villager-f', speaker: i % 2 ? 'e3-buerger' : 'e3-buergerin', at,
  dir: at[0] < 640 ? 'right' : 'left', barks: [CROWD_BARKS[i % CROWD_BARKS.length], CROWD_BARKS[(i + 2) % CROWD_BARKS.length]],
  barkEvery: 7000 + i * 900,
}));

export const trapasZeremonie: MapDef = defineMap({
  id: 'e3-trapas-zeremonie',
  name: 'Trapas',
  background: 'e3-trapas',
  walk: TRAPAS_WALK,
  block: TRAPAS_BLOCKS,
  occluders: TRAPAS_OCCLUDERS,
  surfaces: TRAPAS_SURFACES,
  surface: 'stone',
  npcs: [
    { id: 'heilerin', preset: 'villager-f', speaker: 'e3-heilerin', at: SPOT.healer, dir: 'down', verb: 'Mit der Heilerin reden', talk: w => talkHealer(w) },
    { id: 'haendler', preset: 'merchant', speaker: 'haendler', at: SPOT.merchant, dir: 'right', verb: 'Reden', talk: w => talkMerchant(w) },
    { id: 'paladin', preset: 'paladin', speaker: 'e3-paladin', at: SPOT.paladinDoctor, dir: 'right', verb: 'Nach dem Doktor fragen', talk: w => talkPaladin(w) },
    { id: 'novize', preset: 'villager-m', speaker: 'e3-novize', at: SPOT.novice, dir: 'left', barks: ['Gleich geht es los.', 'Der Großmeister zieht sich noch um.'], barkEvery: 8000 },
    { id: 'banner-west', preset: 'paladin', speaker: 'e3-paladin', at: SPOT.bannerWest, dir: 'down' },
    { id: 'banner-ost', preset: 'paladin', speaker: 'e3-paladin', at: SPOT.bannerEast, dir: 'down' },
    { id: GM, preset: 'e3-grossmeister', speaker: 'e3-grossmeister', at: SPOT.gmPortal, dir: 'down', hidden: true, facePlayer: false },
    ...crowd,
  ],
  interactables: [
    {
      id: 'kapelle', verb: 'Schattentöter in die Ordenskapelle bringen', at: SPOT.portal, radius: 26, once: false, sparkle: true,
      standAt: [SPOT.portal[0], SPOT.portal[1] + 6], face: 'up', when: () => canLayDown() && !G.state.is(F.ceremony), onInteract: w => layDown(w),
    },
  ],
  triggers: [
    { id: 'treppe', poly: STAIRS_ZONE, once: false, when: () => G.state.is(F.healer) && !G.state.is(F.ceremony), onEnter: w => ceremony(w) },
  ],
  lights: [{ id: 'esse', at: [196, 336], kind: 'fire', radius: 46, intensity: 0.7, always: true }],
  spawns: { strasse: { at: SPOT.start, dir: 'up' } },
  time: 'day',
  ambience: ['wind', 'tavern', 'birds'],
  ambienceVolume: { wind: 0.25, tavern: 0.3, birds: 0.25 },
  music: 'refuge',
  critters: false,
  resetOnEnter: true,
  lookMode: true,
  clues: PLATZ_CLUES,
});

// ---------------------------------------------------------------------------------------------------------------
// The round over the square
// ---------------------------------------------------------------------------------------------------------------

async function talkHealer(w: WorldCtx): Promise<void> {
  if (G.state.is(F.healer)) { await w.say('e3-heilerin', HEALER_AGAIN); return; }
  await w.cutscene(async () => {
    await play(w, HEALER);
    const pick = await w.choose([...HEALER_KYRA_CHOICES]);
    await play(w, pick === 0 ? HEALER_KYRA : HEALER_REST);
  });
  G.state.set(F.healer);
  w.completeObjective('e3-hu-heilerin');
  w.setObjective('e3-hu-treppe', 'Die Zeremonie beginnt an der Treppe des Ordenshauses. Wer will, sieht sich vorher noch um.', SPOT.liaCeremony);
}

async function talkPaladin(w: WorldCtx): Promise<void> {
  if (G.state.is(F.doctor)) { await w.say('e3-paladin', DOCTOR_AGAIN); return; }
  await w.cutscene(() => play(w, DOCTOR));
  G.state.set(F.doctor);
}

async function talkMerchant(w: WorldCtx): Promise<void> {
  if (G.state.is(F.merchant)) { await w.say('haendler', MERCHANT_AGAIN); return; }
  await w.cutscene(() => play(w, MERCHANT));
  G.state.set(F.merchant);
}

async function layDown(w: WorldCtx): Promise<void> {
  if (!canLayDown()) return;
  await w.cutscene(async () => {
    sfx('door', { volume: 0.5 });
    await ui().fade('out', 600);
    layDownSchattentoeter();
    await play(w, LAY_DOWN.slice(0, 1));
    await ui().fade('in', 600);
    await play(w, LAY_DOWN.slice(1));
  });
}

// ---------------------------------------------------------------------------------------------------------------
// The ceremony
// ---------------------------------------------------------------------------------------------------------------

async function ceremony(w: WorldCtx): Promise<void> {
  if (G.state.is(F.ceremony)) return;
  G.state.set(F.ceremony);
  w.completeObjective('e3-hu-treppe');
  const gm = w.actor(GM);
  ui().prefetchPlate('e3-hueterin');
  let tone: AnswerTone = 'fest';
  await w.cutscene(async () => {
    const kyra = w.actor('kyra'), flick = w.actor('flick');
    bg(kyra.walkTo(SPOT.kyraCeremony[0], SPOT.kyraCeremony[1], { face: 'up' }));
    bg(flick.walkTo(SPOT.flickCeremony[0], SPOT.flickCeremony[1], { face: 'up' }));
    await w.player.walkTo(SPOT.liaCeremony[0], SPOT.liaCeremony[1], { face: 'up' });
    await w.camera.pan([640, 200], 900);
    sfx('door', { volume: 0.6 });
    gm.show();
    gm.hold(true);
    await gm.walkTo(SPOT.gmStairs[0], SPOT.gmStairs[1], { face: 'down', straight: true });
    await w.wait(400);
    await G.ui.plate('e3-hueterin', { caption: 'Hüterin', pan: 'in', durationMs: 60000 });
    await play(w, SPEECH);
    const pick = await w.choose([...ANSWER_CHOICES], { prompt: 'Was antwortet Lia?', speaker: 'e3-lia' });
    tone = ANSWER_TONES[pick];
    await play(w, ANSWER[tone]);
    await G.ui.closePlate();
    await gm.walkTo(SPOT.gmStairs[0], SPOT.gmStairs[1] + 30, { face: 'down', straight: true });
    await play(w, FIBULA);
    grantFibula();
    sfx('discover', { volume: 0.5 });
    await w.wait(500);
    for (let i = 1; i <= SPOT.crowd.length; i++) w.bark(`buerger-${i}`, i % 2 ? 'Hüterin!' : 'Für Trapas!', 1800);
    await w.wait(1200);
    w.player.face('down');
    await play(w, CLOSING);
  });
  endCeremony(tone);
  await ui().fade('out', 1400);
  await nextScene('e3-epilog');
}

async function platzScript(w: WorldCtx): Promise<void> {
  for (const f of [F.healer, F.merchant, F.doctor, F.ceremony]) G.state.set(f, false);
  w.lockPlayer();
  bg(poisonedGait(w, () => G.state.is(F.ceremony)));
  await ui().fade('in', 1200);
  await w.cutscene(() => play(w, OPENING));
  w.setObjective('e3-hu-heilerin', 'Die Heilerin des Ordens wartet am Brunnen.', 'heilerin');
  w.unlockPlayer();
  // Walking past the stairs too early only earns a reminder.
  await until(w, () => G.state.is(F.ceremony) || (!G.state.is(F.healer) && pointInPoly(w.player.x, w.player.y, STAIRS_ZONE) && !G.ui.busy()));
  if (!G.state.is(F.ceremony)) {
    await w.think('Erst zur Heilerin. Kyra lässt mich sonst nicht in Ruhe, und sie hat recht.');
  }
}

export const scene = e3Scene('e3-hueterin', 'Hüterin', async () => {
  await G.ui.fade('out', 0);
  await G.ui.narrate([ARRIVAL_CARD], { style: 'card' });
  await startWorld({
    map: trapasZeremonie, spawn: 'strasse', player: liaLook(), fadeIn: false, script: platzScript,
    companions: [{ id: 'kyra', preset: 'kyra', speaker: 'e3-kyra' }, { id: 'flick', preset: 'flick', speaker: 'e2-flick' }],
  });
});
