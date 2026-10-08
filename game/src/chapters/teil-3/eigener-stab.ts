// Scene „e3-eigener-stab“ – Ein eigener Stab (docs/teil-3/umsetzung.md §3, F3 04:38–05:35; the reunion with Ignatius is
// an adaptation). The clearing with the weeping willow on e3-lichtwald, Valentus' apparition (erscheinung.ts).
// Two checkpointed parts (G.goto with { part }, a reload restarts the current part):
//  1. default: Heart 1 – the light spirits. Valentus greets three turquoise lights like old acquaintances. They flee
//     when Lia runs and follow her when she walks up slowly or sneaks; led below the willow they settle in its branches
//     (rules in eigener-stab-geister.ts). Then storyAction('reach') for the bright branch → plate e3-eigener-stab,
//     grantOnce e3-stab-erhalten (+ e3-lia-staff, look e3-lia-eigenstab). Heart 2 – the first beam: three withered
//     seed pods in the willow, knocked down with the Stabstrahl; the resting lights and the brook must not be hit
//     (Teil II's practice ground; eigener-stab-ziele.ts, zielen.ts) → learn e3-stabstrahl. Valentus' farewell: not
//     weak; power plus the will to stand up for her friends. He dissolves; Lia stays behind with her own words.
//  2. 'ignatius': Ignatius comes up the east path, out of breath; he followed her tracks for two days. He sees the
//     staff and recognises Valentus' hand. Lia hands Schattentöter back (choice of tone, e3-schattentoeter-zurueck).
//     He proposes Trapas: the Lichterorden's paladins are the only ones who could take on Vamir's people; he is not
//     welcome there, so they go as merchants. Lia agrees. e3-ignatius-zurueck → e3-paladine.
import { G } from '../../core/G';
import type { SpiritEvent } from './eigener-stab-geister';
import { allResting, makeSpirits, stepSpirits, type Spirit, type SpiritRules } from './eigener-stab-geister';
import { learnStabstrahl, receiveOwnStaff, returnSchattentoeter, STAFF_RECEIVED } from './eigener-stab-gaben';
import { AIM_START, allPodsDown, evaluateBeam, POD_IDS, WILLOW_OBJECTS } from './eigener-stab-ziele';
import { apparition, lightPoints, type Apparition } from './erscheinung';
import { CLEARING_OVAL, CLEARING_WALK, OCCLUDERS, SPOT, SURFACES, WILLOW_REST, WILLOW_ROOTS, WILLOW_ZONE } from './lichtwald';
import { bg, e3Scene, hasOwnStaff, lia, liaLook, nextScene, sfx, TURQUOISE, ui, until } from './shared';
import { aimOwnStaff } from './zielen';
import { restageGesture, type GesturePicture } from '../teil-2/gewoelbe-geste';
import { STAFF } from '../common/bookContract';
import { defineMap, startWorld, type MapDef, type WorldCtx } from '../../world';
import type Phaser from 'phaser';
import { LICHTWALD_CLUES } from './spuersinn';

const VAL = 'valentus';
const MENTOR = 'ignatius';
const SPIRITS_HOME = 'e3-es-lichter';
const PODS = 'e3-es-kapseln';
const AIMING = 'e3-es-zielt';
const TEST_DONE = 'e3-es-probe';

/** Where the three lights drift when Lia arrives (left, right, front of the clearing). */
const SPIRIT_ANCHORS: [number, number][] = [[668, 292], [934, 300], [812, 404]];
const RULES: SpiritRules = {
  runSpeed: 150, gentleSpeed: 90, catchWalk: 40, catchGentle: 68, scareRadius: 120, fleeDistance: 110, fleeSeconds: 1.2,
  zone: WILLOW_ZONE, restAt: WILLOW_REST, oval: CLEARING_OVAL,
};

const val = (w: WorldCtx, text: string, mood?: string) => w.say('e3-valentus', text, mood ? { mood } : undefined);
const mentor = (w: WorldCtx, text: string, mood?: string) => w.say('e2-ignatius', text, mood ? { mood } : undefined);
const podsHit = (): string[] => String(G.state.flag(PODS) ?? '').split(',').filter(Boolean);

const BRANCH_PICTURE = (): GesturePicture => ({
  background: 'e3-lichtwald', focus: [846, 238], zoom: 3, glint: SPOT.branch,
  figures: [{ id: liaLook(), pose: 'idle', at: SPOT.branchStand, facing: 'up' }],
});

export const lichtung: MapDef = defineMap({
  id: 'e3-lichtwald',
  name: 'Die Lichtung mit der Weide',
  background: 'e3-lichtwald',
  walk: CLEARING_WALK,
  block: [{ id: 'weide-wurzeln', poly: WILLOW_ROOTS }],
  occluders: OCCLUDERS,
  surfaces: SURFACES,
  surface: 'grass',
  depthScale: { y0: 0, s0: 0.92, y1: 720, s1: 1.04 },
  interactables: [
    {
      id: 'heller-ast', verb: 'Nach dem Ast greifen', at: SPOT.branchStand, radius: 30, sparkle: true, once: false,
      standAt: SPOT.branchStand, face: 'up',
      when: () => G.state.is(SPIRITS_HOME) && !G.state.is(STAFF_RECEIVED), onInteract: takeBranch,
    },
    {
      id: 'probe', verb: 'Zielen', at: SPOT.aim, radius: 26, sparkle: true, once: false,
      when: () => G.state.is(STAFF_RECEIVED) && !G.state.is(TEST_DONE) && !G.state.is(AIMING), onInteract: w => void aimRound(w),
    },
  ],
  exits: [
    { id: 'pfad-zurueck', poly: [[0, 690], [70, 690], [62, 720], [0, 720]], to: 'e3-lichtwald', spawn: 'lichtung', when: () => false, blocked: 'Zurück? Nicht jetzt. Hier passiert gerade etwas.' },
    { id: 'ostpfad', poly: [[1262, 328], [1280, 328], [1280, 364], [1262, 366]], to: 'e3-lichtwald', spawn: 'lichtung', when: () => false, blocked: 'Der Ostpfad. Später vielleicht. Erst die Weide.' },
  ],
  spawns: {
    lichtung: { at: SPOT.clearing, dir: 'right' },
    nachher: { at: SPOT.afterWillow, dir: 'right' },
  },
  time: 'dawn',
  weather: 'leaves',
  ambience: ['birds', 'wind', 'stream'],
  ambienceVolume: { birds: 0.5, wind: 0.4, stream: 0.45 },
  music: 'refuge',
  resetOnEnter: true,
  lookMode: true,
  clues: LICHTWALD_CLUES,
});

// ---------------------------------------------------------------------------------------------------------------
// The light spirits (code-drawn lights, no characters)
// ---------------------------------------------------------------------------------------------------------------

interface SpiritControl {
  readonly spirits: Spirit[];
  /** While false they only drift (cutscenes, dialogue). */
  active: boolean;
  /** Events since the last drain. */
  drain(): SpiritEvent[];
}

/** Runs and draws the three lights every frame. Lia's speed is measured from her movement (run / walk / sneak). */
function startSpirits(w: WorldCtx, spirits: Spirit[]): SpiritControl {
  const pts = lightPoints(w, spirits.length, 2.1);
  const glows = spirits.map((s, i) => w.lighting.add({ id: `e3-geist-${i}`, at: [s.x, s.y + 24], kind: 'urmacht', color: TURQUOISE, radius: 28, intensity: 0.7, always: true }));
  let time = 0, lastX = w.player.x, lastY = w.player.y, speed = 0;
  let events: SpiritEvent[] = [];
  const ctl: SpiritControl = { spirits, active: false, drain: () => { const e = events; events = []; return e; } };
  const onUpdate = (_t: number, delta: number) => {
    const dt = Math.min(0.1, delta / 1000);
    if (dt <= 0) return;
    time += dt;
    const px = w.player.x, py = w.player.y;
    const inst = Math.hypot(px - lastX, py - lastY) / dt;
    lastX = px; lastY = py;
    speed += (inst - speed) * Math.min(1, dt * 10);
    const live = ctl.active && !G.ui.busy();
    events.push(...stepSpirits(spirits, live ? [px, py] : [-9999, -9999], live ? speed : 0, dt, time, RULES));
    spirits.forEach((s, i) => {
      const flicker = 0.82 + 0.18 * Math.sin(time * 5 + i * 2);
      pts.set(i, s.x, s.y + Math.sin(time * 3 + i) * 1.5, flicker);
      glows[i].set({ at: [s.x, s.y + 20], intensity: 0.6 * flicker });
    });
  };
  w.scene.events.on('update', onUpdate);
  w.scene.events.once('shutdown', () => w.scene.events.off('update', onUpdate));
  return ctl;
}

function restingSpirits(): Spirit[] {
  const s = makeSpirits(WILLOW_REST);
  s.forEach((sp, i) => { sp.mode = 'rest'; sp.rest = i; });
  return s;
}

const CAUGHT_BARKS = ['Hallo, du.', 'Ganz ruhig. Ich bin harmlos.', 'Noch eins. Komm mit.'];

async function leadSpirits(w: WorldCtx, ctl: SpiritControl): Promise<void> {
  const objective = (n: number) => w.setObjective('e3-es-lichter', `Führe die drei Lichter zur alten Weide (${n}/3). Nicht rennen.`, n < 3 ? null : WILLOW_ZONE.at);
  objective(0);
  ctl.active = true;
  let caught = 0, scared = 0, hinted = false, lastBark = 0, t = 0;
  while (w.alive && !allResting(ctl.spirits)) {
    await w.wait(150);
    t += 150;
    for (const e of ctl.drain()) {
      if (e.kind === 'caught') {
        sfx('spark', { volume: 0.35, pitch: 1.2 });
        if (t - lastBark > 1800) { w.bark('player', CAUGHT_BARKS[caught % CAUGHT_BARKS.length], 1800); lastBark = t; }
        caught++;
        if (ctl.spirits.some(s => s.mode === 'follow') && !G.state.is('e3-es-hinweis-weide')) {
          G.state.set('e3-es-hinweis-weide');
          w.setObjectiveTarget(WILLOW_ZONE.at);
        }
      } else if (e.kind === 'scared') {
        scared++;
        sfx('whoosh', { volume: 0.25, pitch: 1.6 });
        if (t - lastBark > 2200) { w.bark(scared > 2 && !hinted ? VAL : 'player', scared > 2 && !hinted ? 'Nicht rennen! Das sind keine Hühner.' : 'Oh. Zu schnell.', 2000); lastBark = t; }
        if (scared > 2) hinted = true;
      } else {
        const s = ctl.spirits[e.id];
        sfx('urmacht', { volume: 0.25, pitch: 1.5 });
        w.fx.burst([s.x, s.y + 10], 'urmacht', 6);
        objective(ctl.spirits.filter(x => x.mode === 'rest').length);
      }
    }
  }
  ctl.active = false;
  w.completeObjective('e3-es-lichter');
}

/** Valentus answers when Lia talks to him during the scene (hints, no progress). */
async function talkValentus(w: WorldCtx): Promise<void> {
  if (!G.state.is(SPIRITS_HOME)) { await val(w, 'Langsam auf sie zu. Sie folgen dir, wenn du ihnen Zeit lässt. Und dann unter die Weide.'); return; }
  if (!G.state.is(STAFF_RECEIVED)) { await val(w, 'Der helle Ast. Greif zu, er wartet nicht ewig.', 'happy'); return; }
  await val(w, 'Die trockenen Kapseln unten an den Zweigen. Nicht die Lichter, nicht den Bach.');
}

// ---------------------------------------------------------------------------------------------------------------
// The bright branch
// ---------------------------------------------------------------------------------------------------------------

async function takeBranch(w: WorldCtx): Promise<void> {
  if (G.state.is(STAFF_RECEIVED)) return;
  ui().prefetchPlate('e3-eigener-stab');
  await w.cutscene(async () => {
    w.player.face('up');
    const gesture = G.ui.storyAction('reach', 'Nach dem hellen Ast greifen');
    restageGesture('reach', 'Streck die Hand nach dem hellen Ast aus. Er hängt tiefer als die anderen, fast als warte er.', BRANCH_PICTURE());
    await gesture;
    sfx('urmacht', { volume: 0.45, pitch: 1.1 });
    w.lighting.flash(TURQUOISE, 320);
    w.fx.burst(SPOT.branch, 'urmacht', 16);
    await G.ui.plate('e3-eigener-stab', { caption: 'Ein eigener Stab', pan: 'in', durationMs: 28000 });
    await w.say('narrator', 'Der Ast löste sich, ohne dass Lia zog. In ihrer Hand wurde er länger, heller und gerade. Kein Messer hatte ihn je berührt.');
    await lia(w, 'Er ist … gewachsen. In meiner Hand. Das steht in keinem einzigen Buch.', 'surprised');
    await val(w, 'Dann schreib eins. Er gehört dir. Kein Name, keine Geschichte. Nur deiner.', 'happy');
    await lia(w, 'Meiner. Den muss ich niemandem zurückbringen.', 'happy');
    await G.ui.closePlate();
    // Granted once the plate is closed, so the item toast does not sit on the plate frame.
    receiveOwnStaff();
    w.player.setLook(liaLook());
    w.fx.burst([w.player.x, w.player.y - 40], 'urmacht', 6);
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Heart 2: the first beam
// ---------------------------------------------------------------------------------------------------------------

const DESCRIBE: Record<string, string> = {
  'kapsel-links': 'Eine trockene Kapsel, links an den Zweigen.',
  'kapsel-mitte': 'Eine trockene Kapsel rechts neben dem Stamm.',
  'kapsel-rechts': 'Eine trockene Kapsel, ganz rechts über dem Bach.',
  'geist-links': 'Eines der Lichter.',
  'geist-mitte': 'Eines der Lichter.',
  'geist-rechts': 'Eines der Lichter.',
  bach: 'Der Bach.',
  stamm: 'Der Stamm der Weide.',
};

/** A thin turquoise beam from the staff tip to the chosen spot. */
async function fireBeam(w: WorldCtx, id: string): Promise<void> {
  const obj = WILLOW_OBJECTS.find(o => o.id === id)!;
  w.player.face(obj.at);
  const tip: [number, number] = [w.player.x + (obj.at[0] < w.player.x ? -8 : 8), w.player.y - 40];
  const glow = w.lighting.add({ id: 'e3-stabstrahl', at: tip, kind: 'urmacht', radius: 22, intensity: 0, always: true });
  bg(w.player.play('cast', { ms: 900 }));
  await glow.fadeTo(1, 240);
  sfx('beam', { volume: 0.45, pitch: 1.25 });
  const scene = w.scene as Phaser.Scene & { addWorld?<T extends Phaser.GameObjects.GameObject>(o: T): T };
  const g = scene.add.graphics().setDepth(4450).setBlendMode(1);
  scene.addWorld?.(g);
  g.lineStyle(5, TURQUOISE, 0.45).lineBetween(tip[0], tip[1], obj.at[0], obj.at[1]);
  g.lineStyle(2, 0xe8fffb, 0.95).lineBetween(tip[0], tip[1], obj.at[0], obj.at[1]);
  scene.tweens.add({ targets: g, alpha: 0, duration: 380, onComplete: () => g.destroy() });
  glow.set({ at: obj.at });
  w.fx.burst(obj.at, 'urmacht', 8);
  if (obj.kind === 'target') { sfx('rustle', { volume: 0.7 }); w.fx.burst(obj.at, 'leaves', 10); w.fx.burst([obj.at[0], obj.at[1] + 30], 'dust', 4); }
  else if (id === 'bach') { sfx('splash', { volume: 0.7 }); w.fx.burst(obj.at, 'splash', 10); }
  else if (id === 'stamm') { sfx('thud', { volume: 0.6 }); w.fx.burst(obj.at, 'dust', 5); }
  else { sfx('spark', { volume: 0.5, pitch: 0.8 }); }
  w.camera.punch(0.2);
  await glow.fadeTo(0, 380);
  glow.remove();
}

async function aimRound(w: WorldCtx): Promise<void> {
  if (G.state.is(AIMING)) return;
  G.state.set(AIMING);
  try {
    w.lockPlayer();
    await w.player.walkTo(SPOT.aim[0], SPOT.aim[1], { face: 'up' });
    let last = AIM_START;
    while (!allPodsDown(podsHit()) && w.alive) {
      const left = POD_IDS.length - podsHit().length;
      const picked = await aimOwnStaff(w, WILLOW_OBJECTS,
        `Noch ${left === 1 ? 'eine Kapsel' : `${left} Kapseln`}. <em>Nicht die Lichter, nicht den Bach.</em>`, last, 'Stabstrahl', id => DESCRIBE[id] ?? '');
      if (!picked) {
        w.setObjective('e3-es-probe', 'Stab gesenkt. Zurück vor die Weide, wenn du so weit bist.', 'probe');
        return;
      }
      last = picked;
      await fireBeam(w, picked);
      const result = evaluateBeam(podsHit(), picked);
      if (result === 'hit') {
        G.state.set(PODS, [...podsHit(), picked].join(','));
        const n = podsHit().length;
        w.setObjective('e3-es-probe', `Stoß die drei verdorrten Samenkapseln aus der Weide (${n}/3). Die Lichter und den Bach nicht treffen.`, 'probe');
        if (n === 1) w.bark('player', 'Getroffen! Ich hab getroffen!', 1800);
        else if (n === 2) w.bark(VAL, 'Ruhige Hand.', 1600);
        await w.wait(600);
      } else if (result === 'again') {
        w.bark(VAL, 'Die liegt schon im Gras.', 1600);
        await w.wait(500);
      } else if (result === 'neutral') {
        await val(w, 'Die Weide hat Schlimmeres überstanden als dich. Die Kapseln, Lia.', 'happy');
      } else if (picked === 'bach') {
        await val(w, 'Nasser ist er jetzt nicht. Nur wacher. Die Kapseln hängen weiter oben.', 'happy');
      } else {
        await w.say('narrator', 'Der Strahl streift eines der Lichter. Es zuckt, flackert empört und rückt ein Stück höher in die Zweige.');
        await val(w, 'Sie haben dir gerade einen Stab geschenkt. Ziel bitte woandershin.');
      }
    }
    if (allPodsDown(podsHit())) {
      w.completeObjective('e3-es-probe');
      learnStabstrahl();
      G.state.set(TEST_DONE);
    }
  } finally {
    G.state.set(AIMING, false);
    w.unlockPlayer();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Part 1: lights, branch, first beam, farewell
// ---------------------------------------------------------------------------------------------------------------

async function lichtungScript(w: WorldCtx): Promise<void> {
  for (const f of [SPIRITS_HOME, TEST_DONE, AIMING, 'e3-es-hinweis-weide']) G.state.set(f, false);
  G.state.set(PODS, '');
  w.lockPlayer();
  w.spawn({ id: VAL, preset: 'valentus', speaker: 'e3-valentus', at: [772, 312], dir: 'left', solid: false, talk: talkValentus });
  const ghost = apparition(w, VAL, 0.62);
  const v = w.actor(VAL);
  v.hold(true);
  const ctl = startSpirits(w, makeSpirits(SPIRIT_ANCHORS));
  await ui().fade('in', 1000);
  await w.cutscene(async () => {
    await w.think('Eine Lichtung mit einer Weide, so alt, dass ihre Zweige fast den Boden fegen. Wie ein Vorhang, hinter dem jemand wohnt.');
    await w.player.walkTo(650, 336, { face: 'right' });
    await w.camera.pan([800, 320], 900);
    v.face('up');
    await val(w, 'Ihr drei. Immer noch hier, immer noch viel zu neugierig für euer Alter.', 'happy');
    await val(w, 'Ich bringe euch jemanden. Die Weide soll ihr etwas schenken, und ihr sollt es der Weide sagen.');
    v.face('player');
    await lia(w, 'Moment. Ihr unterhaltet Euch mit … Glühwürmchen?', 'surprised');
    await val(w, 'Sag das nicht zu laut. Sie sind älter als die Weide und empfindlich, was Insekten angeht.', 'happy');
    await val(w, 'Sie mögen keine Hast. Geh langsam auf sie zu, dann folgen sie dir. Bring sie unter die Weide, dann hört sie zu.');
    w.camera.follow();
  });
  w.unlockPlayer();
  await w.say('narrator', `Wer rennt, verscheucht sie. Geh oder schleich (${w.controlHint('sneak')} halten) dicht an ein Licht heran, dann folgt es dir.`);
  await leadSpirits(w, ctl);
  G.state.set(SPIRITS_HOME);

  // The willow answers: the bright branch.
  const branchLight = w.lighting.add({ id: 'e3-heller-ast', at: SPOT.branch, kind: 'urmacht', color: TURQUOISE, radius: 36, intensity: 0, always: true });
  await w.cutscene(async () => {
    await w.camera.pan([846, 230], 800);
    sfx('urmacht', { volume: 0.3, pitch: 1.3 });
    await branchLight.fadeTo(1, 1200);
    w.fx.burst(SPOT.branch, 'urmacht', 10);
    v.face(SPOT.branch);
    await val(w, 'Jetzt hört sie zu. Siehst du den hellen Ast, der tiefer hängt als die anderen? Nimm ihn dir.', 'happy');
    w.camera.follow();
  });
  w.setObjective('e3-es-ast', 'Greif nach dem hellen Ast der Weide.', 'heller-ast');
  await until(w, () => G.state.is(STAFF_RECEIVED) && !G.ui.busy());
  w.completeObjective('e3-es-ast');
  bg(branchLight.fadeTo(0, 900));

  // Heart 2: the first beam.
  await w.cutscene(async () => {
    await v.walkTo(SPOT.valentusWillow[0], SPOT.valentusWillow[1], { straight: true, speed: 30 });
    v.face('player');
    await val(w, 'Probier ihn aus. Drei Samenkapseln hängen noch vom Sommer in den Zweigen, trocken wie altes Papier. Stoß sie herunter.');
    await val(w, 'Die Lichter lässt du in Ruhe. Den Bach auch. Der hat dir nichts getan.', 'happy');
  });
  await w.say('narrator', `Stell dich vor die Weide und ziel: ${w.controlHint('move')} oder die Pfeile unten wählen, „Stabstrahl“ (${w.controlHint('interact')}) löst aus.`);
  w.setObjective('e3-es-probe', 'Stoß die drei verdorrten Samenkapseln aus der Weide (0/3). Die Lichter und den Bach nicht treffen.', 'probe');
  await until(w, () => G.state.is(TEST_DONE) && !G.ui.busy());
  await farewell(w, ghost);
}

async function farewell(w: WorldCtx, ghost: Apparition): Promise<void> {
  const v = w.actor(VAL);
  await w.cutscene(async () => {
    v.face('player');
    w.player.face(VAL);
    await lia(w, 'Er tut, was ich will. Nicht mehr und nicht weniger. Als hätte ich ihn schon immer gehabt und nur verlegt.', 'happy');
    await ghost.fadeTo(0.38, 1600);
    await val(w, 'Meine Zeit hier ist fast um. Das Bild wird dünn.', 'sad');
    await lia(w, 'Jetzt schon? Ich habe noch hundert Fragen.', 'surprised');
    await val(w, 'Und ich keine hundert Atemzüge mehr. Frag Ignatius. Er kommt gerade schnaufend den Ostpfad herauf.', 'happy');
    await lia(w, 'Und das reicht? Ein Stab, drei Kapseln, und ich hole Kyra und Flick zurück?', 'sad');
    await val(w, 'Wer schwach ist, läuft nicht zwei Tage allein durch fremden Wald, um eine Schwester und eine Freundin zu holen.');
    await val(w, 'Du hast mehr Licht in dir, als ich je hatte. Und du weißt, für wen du es willst. Damit fängt man an.', 'determined');
    await lia(w, 'Wartet …', 'surprised');
    sfx('urmacht', { volume: 0.35, pitch: 0.7 });
    await ghost.dissolve(1600);
    v.hide();
    await w.wait(700);
    await lia(w, 'Ich hoffe sehr, Ihr wisst, wovon Ihr redet.', 'sad');
  });
  w.lockPlayer();
  await ui().fade('out', 1200);
  await G.ui.narrate(['Lia blieb unter der Weide stehen, bis die letzten Funken im Gras verloschen waren. Dann hörte sie Schritte.'], { style: 'card' });
  await nextScene('e3-eigener-stab', { part: 'ignatius' });
}

// ---------------------------------------------------------------------------------------------------------------
// Part 2: Ignatius
// ---------------------------------------------------------------------------------------------------------------

async function ignatiusScript(w: WorldCtx): Promise<void> {
  w.lockPlayer();
  startSpirits(w, restingSpirits());
  w.spawn({ id: MENTOR, preset: 'e2-ignatius', speaker: 'e2-ignatius', at: SPOT.eastBank, dir: 'left', solid: false });
  const m = w.actor(MENTOR);
  m.hold(true);
  w.player.face('right');
  await ui().fade('in', 1000);
  await w.cutscene(async () => {
    await w.camera.pan([1060, 330], 900);
    await m.walkTo(SPOT.ignatiusStop[0], SPOT.ignatiusStop[1]);
    m.face('player');
    w.camera.follow();
    await mentor(w, 'Lia! Da bist du. Zwei Tage hinter einem Mädchen her, das Haken schlägt wie ein Hase. Meine Knie hassen dich.', 'happy');
    await lia(w, 'Ihr seid mir nachgelaufen? Den ganzen Weg?', 'surprised');
    const abschied = G.state.flag<string>('e2-abschied');
    if (abschied === 'brief') await mentor(w, 'Ich habe deine Rinde gefunden. Und danach deine Fußspuren. Die waren leserlicher.', 'happy');
    else if (abschied === 'gesicht') await mentor(w, 'Ich habe dich gehen lassen und es bereut, bevor du hinter der Buche warst. Also bin ich hinterher.', 'sad');
    else await mentor(w, 'Deinen Spuren nach. Du trittst mit der linken Ferse fester auf, wusstest du das?', 'thinking');
    await m.emote('!');
    await mentor(w, 'Und was … ist das?', 'surprised');
    await lia(w, 'Mein Stab. Mein eigener. Die Weide hat ihn mir gegeben. Mit etwas Hilfe.');
    await mentor(w, 'Gewachsen, nicht geschnitzt. Keine Kerbe, die nicht da sein will.', 'thinking');
    await mentor(w, 'Das ist Valentus’ Handschrift. So hat er schon im Rat gearbeitet: ohne Werkzeug und ohne ein Wort der Erklärung.', 'thinking');
    await lia(w, 'Er war hier. Durchsichtig und ziemlich müde. Er lässt grüßen.');
    await mentor(w, 'Sechzehn Jahre kein Wort. Und dann kommt er zu dir, nicht zu mir.', 'sad');
    await mentor(w, 'Er hatte recht damit. Du bist diejenige, die ihn braucht.');
  });
  await returnStaff(w);
  await plan(w);
  w.lockPlayer();
  await ui().fade('out', 1200);
  G.state.set('e3-ignatius-zurueck');
  learnStabstrahl();
  await nextScene('e3-paladine');
}

async function returnStaff(w: WorldCtx): Promise<void> {
  await w.cutscene(async () => {
    await w.think(G.state.has(STAFF.borrowed) ? 'Zwei Stäbe. Und einer davon ist geliehen.' : 'Schattentöter … den sollte ich ihm zurückgeben. Und wenigstens erklären, wo er ist.');
    const warm = G.state.flag<string>('e2-abschied') === 'gesicht'
      ? '„Hier, Schattentöter. Ihr wolltet ihn zurück, mit mir dran. Bitte sehr: beides.“'
      : '„Hier, Schattentöter. Geliehen, habt Ihr gesagt. Ich bringe ihn heil zurück.“';
    const pick = await w.choose([
      warm,
      '„Nehmt ihn. Einen geliehenen brauche ich nicht mehr.“',
      '„Danke, dass ich ihn tragen durfte. Ohne ihn wäre ich nie bis hierher gekommen.“',
    ]);
    G.state.set('e3-rueckgabe-ton', ['warm', 'stolz', 'dankbar'][pick]);
    sfx('pickup', { volume: 0.4, pitch: 0.8 });
    returnSchattentoeter();
    if (pick === 0) await mentor(w, 'Beides heil. Mehr wollte ich nicht.', 'happy');
    else if (pick === 1) await mentor(w, 'Das klang fast wie ich vor vierzig Jahren. Ich war damals unerträglich.', 'happy');
    else await mentor(w, 'Er hat dich getragen, nicht umgekehrt. So soll es bei Stäben sein.', 'happy');
  });
}

async function plan(w: WorldCtx): Promise<void> {
  await w.cutscene(async () => {
    await lia(w, 'Ich gehe trotzdem weiter. Ich hole sie da raus. Ihr könnt mich nicht umstimmen.', 'determined');
    await mentor(w, 'Ich bin nicht hier, um dich zurückzuholen. Ich bin hier, damit du nicht allein gehst.');
    await mentor(w, 'Allein schaffen wir beide nichts gegen Vamirs Leute. Aber es gibt welche, die es könnten.', 'thinking');
    await mentor(w, 'Die Paladine des Lichterordens in Trapas. Männer, Waffen, Mauern. Die Einzigen weit und breit.', 'determined');
    await lia(w, 'Trapas? Da ist Vater immer zum Markt gefahren. Er hat mir von dort Bücher mitgebracht.', 'sad');
    await mentor(w, 'Und der Großmeister des Ordens würde Vamirs Leute lieber heute als morgen vom Land fegen.');
    await lia(w, 'Warum klingt Ihr dann, als hättet Ihr Zahnweh?');
    await mentor(w, 'Weil ich dort nicht willkommen bin. Eine alte Geschichte, und keine gute. Wir gehen als Händler.', 'grim');
    await lia(w, 'Händler ohne Waren?');
    await mentor(w, 'Die Waren lagern bei einem Bekannten in der Stadt. Sagen wir. Und du redest so wenig wie möglich.', 'happy');
    await lia(w, 'Ich? Wenig reden?', 'surprised');
    await mentor(w, 'Ich weiß. Ein Wagnis.', 'happy');
    await w.think('Zwei Tage allein haben mir genau eins beigebracht: Allein komme ich nicht weit.');
    await lia(w, 'Gut. Dann eben Trapas.', 'determined');
    await mentor(w, 'Dann los. Und lass den Stab nicht los. Er ist deiner, und das sieht man.', 'happy');
  });
}

export const scene = e3Scene('e3-eigener-stab', 'Ein eigener Stab', async params => {
  await ui().fade('out', 0);
  if (params?.part === 'ignatius' && G.state.is(STAFF_RECEIVED) && hasOwnStaff()) {
    await startWorld({ map: lichtung, spawn: 'nachher', player: liaLook(), companions: [], fadeIn: false, script: ignatiusScript });
    return;
  }
  await startWorld({ map: lichtung, spawn: 'lichtung', player: liaLook(), companions: [], fadeIn: false, script: lichtungScript });
});
