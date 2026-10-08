// Scene „e3-epilog“ – Zu dritt (docs/teil-3/umsetzung.md §3, F3 45:44–46:59). The last scene of Teil III.
// The field track e3-feldweg on an autumn morning; Kyra and Flick follow Lia (no more poison: e3-gift-abklingend).
// Heart: the walk with talks on the way (each in its zone along the track, in order; texts in epilog-weg.ts): Kyra on
// how much has changed since the summer and that the parents would be proud (Lia's choice of words), Kyra stops and
// tells Lia about Elnon – the blade, his face, the lie in the forest; Lia learns only now that he is dead and answers
// in one of three comforting ways (journal: e3-elnon-wahrheit) –, Flick on being the sisters' guard. Optional: under
// the lone tree the promise to go home to the parents' graves one day (no visit). At the end of the walk the three go
// on up the track; in the foreground Valentus' apparition watches them go (only the player sees it, Lia does not turn
// round; erscheinung.ts). Plate e3-epilog, narrator, then e3-finished, checkpoint save, credits „Ende des dritten
// Buches“ (BOOK3_CREDITS via kapitel-5 showCredits), back to the title. Continuing a finished save offers a short
// closing choice (credits again / title), like teil-2/aufbruch.ts.
import { G } from '../../core/G';
import { registerClues } from '../../core/catalog';
import { defineMap, startWorld, type MapDef, type WorldCtx } from '../../world';
import { showCredits } from '../kapitel-5/credits';
import { BOOK3 } from '../common/bookContract';
import { apparition } from './erscheinung';
import { BOOK3_CREDITS } from './epilog-credits';
import {
  ELNON, ELNON_ANSWERS, ELNON_CHOICES, ELNON_CLUE, ELNON_END, END_ZONE, ENDING, FELDWEG_OCCLUDERS, FELDWEG_SPOT as SPOT, FELDWEG_SURFACES,
  FELDWEG_WALK, FINISHED_LINE, OPENING, SCHUTZ, SOMMER, SOMMER_ANSWERS, SOMMER_CHOICES, SOMMER_END, TALK_ZONES, TREE, TREE_BLOCK,
  nextTalk, talkFlag, talksDone, type Line, type TalkId,
} from './epilog-weg';
import { bg, e3Scene, lia, liaLook, ui, until } from './shared';

registerClues([
  {
    id: ELNON_CLUE, title: 'Was mit Elnon geschah',
    text: 'Kyra hat es mir auf dem Feldweg gesagt: Elnon ist tot. Vamir hat ihre Hand geführt. Was sie mir im Wald erzählt hat, war seine Lüge, nicht ihre.',
  },
]);

const F = { tree: 'e3-ep-baum', end: 'e3-ep-ende', finished: BOOK3.finished } as const;
const VAL = 'valentus';

const speakerOf: Record<Line['who'], string> = { lia: 'e3-lia', 'lia-think': '', kyra: 'e3-kyra', flick: 'e2-flick', narrator: 'narrator' };

async function play(w: WorldCtx, lines: readonly Line[]): Promise<void> {
  for (const l of lines) {
    if (l.who === 'lia-think') await w.think(l.text);
    else if (l.who === 'lia') await lia(w, l.text, l.mood);
    else await w.say(speakerOf[l.who], l.text, l.mood ? { mood: l.mood } : undefined);
  }
}

export const feldwegEpilog: MapDef = defineMap({
  id: 'e3-feldweg-epilog',
  name: 'Feldweg',
  background: 'e3-feldweg',
  walk: FELDWEG_WALK,
  block: [TREE_BLOCK],
  occluders: FELDWEG_OCCLUDERS,
  surfaces: FELDWEG_SURFACES,
  surface: 'grass',
  interactables: [
    {
      id: 'baum', verb: 'Kurz unter dem Baum stehen bleiben', at: SPOT.tree, radius: 26, once: false, sparkle: true,
      when: () => !G.state.is(F.tree) && !G.state.is(F.end), onInteract: w => underTheTree(w),
    },
  ],
  triggers: [
    ...TALK_ZONES.map(z => ({ id: `talk-${z.id}`, poly: z.poly, once: false, when: () => nextTalk() === z.id, onEnter: (w: WorldCtx) => talk(w, z.id) })),
    { id: 'ende', poly: END_ZONE, once: false, when: () => talksDone() && !G.state.is(F.end), onEnter: w => ending(w) },
  ],
  spawns: { start: { at: SPOT.start, dir: 'up' } },
  time: 'dawn',
  ambience: ['wind', 'birds'],
  ambienceVolume: { wind: 0.4, birds: 0.5 },
  music: 'refuge',
  lookMode: false,
  resetOnEnter: true,
});

// ---------------------------------------------------------------------------------------------------------------
// Talks on the way
// ---------------------------------------------------------------------------------------------------------------

function updateWalkObjective(w: WorldCtx): void {
  const next = nextTalk();
  const zone = next ? TALK_ZONES.find(z => z.id === next)! : null;
  const target: [number, number] = zone
    ? [Math.round(zone.poly.reduce((n, p) => n + p[0], 0) / zone.poly.length), Math.round(zone.poly.reduce((n, p) => n + p[1], 0) / zone.poly.length)]
    : [Math.round((END_ZONE[0][0] + END_ZONE[2][0]) / 2), Math.round((END_ZONE[1][1] + END_ZONE[3][1]) / 2)];
  w.setObjective('e3-ep-weg', 'Geht den Feldweg entlang nach Nordosten.', target);
}

async function talk(w: WorldCtx, id: TalkId): Promise<void> {
  if (G.state.is(talkFlag(id))) return;
  G.state.set(talkFlag(id));
  if (id === 'sommer') {
    await play(w, SOMMER);
    const pick = await w.choose([...SOMMER_CHOICES]);
    G.state.set('e3-ep-eltern', pick);
    await play(w, SOMMER_ANSWERS[pick]);
    await play(w, SOMMER_END);
  } else if (id === 'elnon') {
    await w.cutscene(async () => {
      const kyra = w.actor('kyra'), flick = w.actor('flick');
      kyra.hold(true);
      flick.hold(true);
      w.player.face(kyra.id);
      kyra.face('player');
      await play(w, ELNON);
      const pick = await w.choose([...ELNON_CHOICES], { prompt: 'Was tut Lia?', speaker: 'e3-lia' });
      G.state.set('e3-ep-elnon-antwort', pick);
      if (pick === 1) {
        await w.player.walkTo(kyra.x + (w.player.x < kyra.x ? -14 : 14), kyra.y + 2);
        bg(w.player.emote('heart'));
      }
      await play(w, ELNON_ANSWERS[pick]);
      flick.face('player');
      await play(w, ELNON_END);
      kyra.hold(false);
      flick.hold(false);
    });
    G.state.set('e3-elnon-erfahren');
    G.state.addClue(ELNON_CLUE);
  } else {
    await play(w, SCHUTZ);
  }
  updateWalkObjective(w);
}

async function underTheTree(w: WorldCtx): Promise<void> {
  if (G.state.is(F.tree)) return;
  await w.cutscene(async () => {
    w.player.face('up');
    await play(w, TREE);
  });
  G.state.set(F.tree);
}

// ---------------------------------------------------------------------------------------------------------------
// The end of the walk
// ---------------------------------------------------------------------------------------------------------------

async function ending(w: WorldCtx): Promise<void> {
  if (G.state.is(F.end)) return;
  G.state.set(F.end);
  w.completeObjective('e3-ep-weg');
  ui().prefetchPlate('e3-epilog');
  await w.cutscene(async () => {
    const kyra = w.actor('kyra'), flick = w.actor('flick');
    // The three walk on up the track; the camera stays behind.
    await w.camera.pan(SPOT.endCamera, 1200);
    const [ax, ay] = SPOT.away;
    bg(w.player.walkTo(ax, ay, { straight: true, speed: 30 }));
    bg(kyra.walkTo(ax - 26, ay + 18, { straight: true, speed: 30 }));
    bg(flick.walkTo(ax + 4, ay + 28, { straight: true, speed: 30 }));
    await w.wait(1600);
    // Behind them, in the foreground: Valentus' apparition. Only the player sees it; Lia does not turn round.
    w.spawn({ id: VAL, preset: 'valentus', speaker: 'e3-valentus', at: SPOT.valentus, dir: 'up', solid: false, facePlayer: false });
    w.actor(VAL).hold(true);
    const ghost = apparition(w, VAL, 0);
    await ghost.fadeTo(0.6, 2200);
    await w.wait(2600);
    await ghost.dissolve(1600);
    await ui().fade('out', 1200);
  });
  await G.ui.plate('e3-epilog', { caption: 'Zu dritt', pan: 'in', durationMs: 40000 });
  await ui().fade('in', 900);
  for (const l of ENDING) await G.ui.say('narrator', l.text);
  await ui().fade('out', 1400);
  await G.ui.closePlate();
  await finishBook();
}

/** End of Teil III: the finished flag, a checkpoint at this scene, the credits, back to the title. */
async function finishBook(): Promise<void> {
  G.state.set(F.finished);
  G.state.setParty(['kyra', 'flick']);
  G.state.save(BOOK3.chapter, BOOK3.last, { book3Finished: true });
  await showCredits(BOOK3_CREDITS);
  const { showTitle } = await import('../../scenes/BootScene');
  await showTitle();
}

async function epilogScript(w: WorldCtx): Promise<void> {
  for (const id of ['sommer', 'elnon', 'schutz'] as const) G.state.set(talkFlag(id), false);
  G.state.set(F.tree, false);
  G.state.set(F.end, false);
  w.lockPlayer();
  await ui().fade('in', 1400);
  bg(w.lighting.set('day', 40000));
  await w.cutscene(() => play(w, OPENING));
  updateWalkObjective(w);
  w.unlockPlayer();
  await until(w, () => G.state.is(F.end));
}

// ---------------------------------------------------------------------------------------------------------------
// After the end: Continue offers a short closing choice instead of replaying everything
// ---------------------------------------------------------------------------------------------------------------

async function closingChoice(): Promise<void> {
  G.stopGameplayScenes();
  await ui().fade('out', 0);
  await G.ui.plate('e3-epilog', { caption: 'Zu dritt', pan: 'none' });
  await ui().fade('in', 900);
  await G.ui.say('narrator', FINISHED_LINE);
  for (;;) {
    const pick = await G.ui.choose(['Den Abspann noch einmal ansehen.', 'Zurück zum Titel.']);
    if (pick === 0) {
      await G.ui.closePlate();
      await showCredits(BOOK3_CREDITS);
      await G.ui.plate('e3-epilog', { caption: 'Zu dritt', pan: 'none' });
      continue;
    }
    await ui().fade('out', 700);
    await G.ui.closePlate();
    const { showTitle } = await import('../../scenes/BootScene');
    await showTitle();
    return;
  }
}

export const scene = e3Scene('e3-epilog', 'Zu dritt', async () => {
  if (G.state.is(F.finished)) { await closingChoice(); return; }
  await G.ui.fade('out', 0);
  await G.ui.narrate(['Am Morgen nach der Zeremonie verließen sie Trapas durch das Südtor. Niemand hielt sie an.'], { style: 'card' });
  await startWorld({
    map: feldwegEpilog, spawn: 'start', player: liaLook(), fadeIn: false, script: epilogScript,
    companions: [{ id: 'kyra', preset: 'kyra', speaker: 'e3-kyra' }, { id: 'flick', preset: 'flick', speaker: 'e2-flick' }],
  });
});
