// Scene „e2-stabtraining“ – Schattentöter (docs/teil-2/umsetzung.md §3, F2 32:20–33:38). Day at the hermit's
// clearing, Lia with the borrowed staff (e2-lia-stab).
// Heart 1: target practice. Ignatius calls a target by description; Lia aims the staff impulse at the painted objects
// of the practice ground (stabtraining-zielen.ts, rules in stabtraining-ziele.ts). The bird nest, his lantern and his
// water bucket stand right beside the called targets: decision over power. Misses are only a comment and a new try.
// Heart 2: the small battle e2-uebungskampf (stabtraining-battle.ts): two ghouls at the brook, Ignatius only covers.
// The EXP of the first win is paid once (e2-uebungskampf-gewonnen). Then the talk about readiness and Besonnenheit;
// he admits a failure of his own without details. learn e2-stabimpuls, e2-training-complete → e2-flick-entkommt.
// Reload: playEncounter saves before and after the battle; finished parts (practice, won battle) are skipped.
import { G } from '../../core/G';
import { registerClues } from '../../core/catalog';
import { defineMap, type MapDef, type WorldCtx } from '../../world';
import { playEncounter, startEncounterWorld } from '../common/encounters';
import { halt } from '../kapitel-4/shared';
import { IG_EDGE, IG_SPOT, igFireLight, ignatiusBase } from './ignatius-lager';
import { bg, e2Scene, grantOnce, lia, liaLook, mentor, sfx, ui, until, nextScene } from './shared';
import { UEBUNGSKAMPF_WON, uebungskampf } from './stabtraining-battle';
import { evaluateShot, PRACTICE_CALLS, PRACTICE_OBJECTS, practiceVerdict } from './stabtraining-ziele';
import { aimStaff } from './stabtraining-zielen';

registerClues([
  {
    id: 'e2-spur-ghule', title: 'Spuren am Bach',
    text: 'Breite, nackte Abdrücke mit Krallen, zwei Paar. Sie kamen über die Trittsteine, als Lias Licht über den Übungsplatz flog.',
  },
]);

const MENTOR = 'ignatius';
/** Lia's firing spot on the practice ground (south of the middle stump). */
const SHOT: [number, number] = [300, 290];
const MENTOR_AT: [number, number] = [372, 300];
const PRACTICE_DONE = 'e2-stab-ziele-fertig';
const CALL = 'e2-stab-ruf';
const MISSES = 'e2-stab-fehler';
const GHOULS: [string, [number, number]][] = [['ghul-a', [1176, 446]], ['ghul-b', [1224, 462]]];

export const stabtrainingLager: MapDef = defineMap({
  ...ignatiusBase,
  id: 'e2-stabtraining-lager',
  name: 'Der Übungsplatz',
  npcs: [{
    id: MENTOR, preset: 'e2-ignatius', speaker: 'e2-ignatius', at: MENTOR_AT, dir: 'left', verb: 'Reden', talk: talkMentor,
    barks: ['Erst hinsehen, dann zielen.', 'Die Meisen danken.'], barkEvery: 14000,
  }],
  props: [
    { id: 'nest', prop: 'bird-nest', at: [181, 221], collide: false, above: true },
    { id: 'laterne', prop: 'lantern', at: [133, 269], collide: false, above: true, light: false },
    { id: 'eimer', prop: 'bucket', at: [258, 320], collide: false },
    { id: 'buecher', prop: 'bookstack', at: [702, 252], collide: false },
  ],
  interactables: [
    { id: 'schusslinie', verb: 'Zielen', at: SHOT, radius: 26, once: false, sparkle: true, when: () => practiceOpen(), onInteract: w => void practiceRound(w) },
    { id: 'nest-ansehen', verb: 'Ansehen', at: [181, 262], radius: 22, once: false, onInteract: lookNest },
  ],
  triggers: [
    { id: 'bach', poly: [[944, 352], [1012, 352], [1012, 440], [944, 440]], once: false, when: () => G.state.is(PRACTICE_DONE) && !G.state.is(UEBUNGSKAMPF_WON), onEnter: w => void toTheBrook(w) },
  ],
  exits: [
    { id: 'weg-sued', poly: IG_EDGE.south, to: 'e2-stabtraining-lager', spawn: 'fire', when: () => false, blocked: 'Erst die Übung. Weglaufen kann ich später noch.' },
    { id: 'weg-ost', poly: IG_EDGE.east, to: 'e2-stabtraining-lager', spawn: 'fire', when: () => false, blocked: 'Erst die Übung. Weglaufen kann ich später noch.' },
  ],
  lights: [igFireLight(0.35, 0.35)],
  time: 'day',
  weather: 'leaves',
  ambience: ['birds', 'wind', 'stream'],
  ambienceVolume: { birds: 0.6, wind: 0.4, stream: 0.4 },
  music: 'refuge',
  resetOnEnter: true,
});

const say = (w: WorldCtx, text: string, mood?: string) => w.say(mentor(), text, mood ? { mood } : undefined);
const callIndex = () => Number(G.state.flag(CALL) ?? 0);
const practiceOpen = () => G.state.is('e2-stab-erklaert') && !G.state.is(PRACTICE_DONE) && !G.state.is('e2-stab-zielt');

// ---------------------------------------------------------------------------------------------------------------
// Heart 1: target practice
// ---------------------------------------------------------------------------------------------------------------

async function talkMentor(w: WorldCtx): Promise<void> {
  if (!G.state.is('e2-stab-erklaert')) { G.state.set('e2-stab-bereit'); return; }
  if (!G.state.is(PRACTICE_DONE)) {
    const c = PRACTICE_CALLS[Math.min(callIndex(), PRACTICE_CALLS.length - 1)];
    await say(w, c.call);
    return;
  }
  if (!G.state.is(UEBUNGSKAMPF_WON)) { await say(w, 'Zum Bach. Langsam, aber nicht zu langsam.', 'determined'); return; }
}

async function lookNest(w: WorldCtx): Promise<void> {
  await w.think('Zwei Meisenküken, die Schnäbel weit offen. Sie halten mich für die Mutter. Oder für das Frühstück.');
}

async function explain(w: WorldCtx): Promise<void> {
  const m = w.actor(MENTOR);
  m.hold(true);
  await w.player.walkTo(SHOT[0], SHOT[1], { face: 'right' });
  m.face('player');
  await say(w, 'Heute zielen wir. Ich rufe, du triffst. Und zwar nur das, was ich rufe.');
  await w.camera.pan([220, 240], 800);
  await say(w, 'Das Nest auf dem Stumpf, meine Laterne, mein Eimer: Die gehören nicht zur Übung. Die gehören mir. Das Nest den Meisen.', 'happy');
  await lia(w, 'Und wenn ich danebenschieße?');
  await say(w, 'Dann schimpfen die Meisen, und ich lache. Kraft hast du genug. Heute geht es nur ums Wohin.');
  await w.say('narrator', `Wähl das Ziel mit ${w.controlHint('move')} oder den Pfeilen unten, dann „Stabimpuls“ (${w.controlHint('interact')}). Hör genau hin, was er ruft.`);
  w.camera.follow();
  m.hold(false);
  G.state.set('e2-stab-erklaert');
}

/** One or more aimed shots until all calls are hit or Lia lowers the staff. */
async function practiceRound(w: WorldCtx): Promise<void> {
  if (G.state.is('e2-stab-zielt')) return;
  G.state.set('e2-stab-zielt');
  try {
    w.lockPlayer();
    await w.player.walkTo(SHOT[0], SHOT[1]);
    let last: string | undefined;
    while (callIndex() < PRACTICE_CALLS.length && w.alive) {
      const call = PRACTICE_CALLS[callIndex()];
      w.setObjective('e2-stab-ziel', `Ignatius ruft: „${call.call}“ Triff genau das mit dem Stabimpuls.`, [220, 236]);
      const picked = await aimStaff(w, `<em>Ignatius:</em> „${call.call}“`, last);
      if (!picked) {
        w.setObjective('e2-stab-ziel', 'Stab abgesetzt. Zurück an die Schusslinie, wenn du so weit bist.', 'schusslinie');
        return;
      }
      last = picked;
      await fire(w, picked);
      const result = evaluateShot(callIndex(), picked);
      if (result === 'hit') {
        G.state.inc(CALL);
        await hitComment(w, callIndex());
      } else {
        G.state.inc(MISSES);
        await missComment(w, picked, result);
      }
    }
    if (callIndex() >= PRACTICE_CALLS.length) await practiceDone(w);
  } finally {
    G.state.set('e2-stab-zielt', false);
    w.unlockPlayer();
  }
}

/** The staff impulse: a small turquoise light from the staff tip to the chosen object. */
async function fire(w: WorldCtx, id: string): Promise<void> {
  const obj = PRACTICE_OBJECTS.find(o => o.id === id)!;
  w.player.face(obj.at);
  const tip: [number, number] = [w.player.x + (obj.at[0] < w.player.x ? -10 : 10), w.player.y - 34];
  const glow = w.lighting.add({ id: 'e2-stabimpuls', at: tip, kind: 'urmacht', radius: 22, intensity: 0, always: true });
  bg(w.player.play('cast', { ms: 900 }));
  await glow.fadeTo(1, 260);
  sfx('beam', { volume: 0.45, pitch: 1.35 });
  w.fx.burst(tip, 'urmacht', 4);
  await w.wait(160);
  glow.set({ at: obj.at });
  w.fx.burst(obj.at, 'urmacht', 8);
  if (id === 'nest') { sfx('rustle', { volume: 0.8 }); w.fx.burst(obj.at, 'leaves', 8); w.prop('nest').shake(); }
  else if (id === 'laterne') { sfx('block', { volume: 0.6, pitch: 1.4 }); w.prop('laterne').shake(); }
  else if (id === 'eimer') { sfx('splash', { volume: 0.7 }); w.fx.burst(obj.at, 'splash', 10); w.prop('eimer').shake(); }
  else if (id.startsWith('ziel-scheibe')) { sfx('arrow-hit', { volume: 0.7 }); w.fx.burst(obj.at, 'dust', 6); }
  else { sfx('thud', { volume: 0.7 }); w.fx.burst(obj.at, 'leaves', 6); }
  w.camera.punch(0.25);
  await glow.fadeTo(0, 420);
  glow.remove();
}

async function hitComment(w: WorldCtx, done: number): Promise<void> {
  const lines = [
    'Getroffen. Und vorher hingesehen.',
    'Die Meisen haben nicht mal gezuckt.',
    'Der Eimer ist noch voll. Sehr gut.',
    'Laterne heil, Scheibe getroffen.',
  ];
  w.bark(MENTOR, lines[Math.min(done - 1, lines.length - 1)], 2200);
  await w.wait(700);
}

async function missComment(w: WorldCtx, id: string, result: ReturnType<typeof evaluateShot>): Promise<void> {
  if (result === 'forbidden') {
    if (id === 'nest') {
      await w.say('narrator', 'Der Impuls streift den Rand des Nests. Zwei Küken zetern, die Mutter schießt aus dem Laub und schimpft.');
      await say(w, 'Die Meisen werden dir das bis zum Herbst nachtragen. Hör hin, dann ziel.', 'happy');
    } else if (id === 'laterne') {
      await say(w, 'Die Laterne hat Dunkelhain überlebt. Sei so gut und lass sie auch dich überleben.', 'happy');
    } else {
      await say(w, 'Gegossen ist der Boden jetzt. Gezielt hast du auf etwas anderes. Noch einmal.', 'happy');
    }
    return;
  }
  await say(w, 'Getroffen, ja. Nur nicht das, was ich gerufen habe. Erst hören, dann zielen.');
}

async function practiceDone(w: WorldCtx): Promise<void> {
  w.completeObjective('e2-stab-ziel');
  G.state.set(PRACTICE_DONE);
  const verdict = practiceVerdict(Number(G.state.flag(MISSES) ?? 0));
  await w.cutscene(async () => {
    const m = w.actor(MENTOR);
    m.hold(true);
    m.face('player');
    if (verdict === 'flawless') {
      await say(w, 'Viermal gerufen, viermal getroffen, nichts zerbrochen. Entweder Talent oder Glück. Das finden wir noch heraus.', 'happy');
    } else if (verdict === 'good') {
      await say(w, 'Ein paarmal hast du schneller gezielt als gehört. Aber du hast es gemerkt. Das ist schon die halbe Übung.');
    } else {
      await say(w, 'Du triffst, was du willst. Jetzt musst du nur noch wollen, was ich sage. Das kommt.', 'thinking');
    }
    await lia(w, 'Der Stab summt. Als würde er sich freuen.', 'happy');
    await w.wait(500);
    sfx('rustle', { volume: 0.6, pan: 0.8, distance: 0.6 });
    m.face('right');
    await say(w, 'Hörst du das? Am Bach.', 'worried');
    await w.camera.pan([1150, 440], 900);
    for (const [id, at] of GHOULS) {
      const g = w.spawn({ id, preset: 'ghoul', speaker: 'leichenfresser', at, dir: 'left', solid: false, speed: 30 });
      g.hold(true);
    }
    w.bark(GHOULS[0][0], 'Hhrrrh …', 1600);
    await w.wait(900);
    await say(w, 'Leichenfresser. Zwei. Dein Licht hat sie angelockt wie Fliegen den Honig.', 'grim');
    await w.camera.pan([w.player.x, w.player.y], 700);
    await lia(w, 'Die aus dem Regenwald? Die hatten eine Axt. Und schlechte Laune.', 'scared');
    await say(w, 'Diese hier haben rostige Beile und noch schlechtere. Ich bleibe neben dir und decke dich. Kämpfen musst du.', 'determined');
    w.camera.follow();
    m.hold(false);
  });
  w.setObjective('e2-stab-bach', 'Geh mit Ignatius zum Bach. Die Leichenfresser warten an den Trittsteinen.', IG_SPOT.stream);
}

// ---------------------------------------------------------------------------------------------------------------
// Heart 2: the practice fight
// ---------------------------------------------------------------------------------------------------------------

async function toTheBrook(w: WorldCtx): Promise<void> {
  if (G.state.is('e2-stab-kampf-laeuft')) return;
  G.state.set('e2-stab-kampf-laeuft');
  try {
    G.state.addClue('e2-spur-ghule');
    await w.cutscene(async () => {
      const m = w.actor(MENTOR);
      m.hold(true);
      await m.walkTo(w.player.x - 26, w.player.y + 6);
      m.face('right');
      await lia(w, 'Atmen, zielen, nicht schreien. In welcher Reihenfolge noch mal?', 'scared');
      await say(w, 'Genau in dieser. Das Schreien darfst du weglassen.', 'happy');
    });
    while (w.alive && !G.state.is(UEBUNGSKAMPF_WON)) {
      const result = await playEncounter(w, uebungskampf({ lichtstoss: G.state.knows('lichtstoss'), won: G.state.is(UEBUNGSKAMPF_WON) }), undefined,
        () => { grantOnce(UEBUNGSKAMPF_WON, () => G.state.inc('e2-uebungskampf-siege')); });
      if (result.outcome === 'win') break;
      await say(w, 'Noch einmal. Diesmal mit mehr Abstand und weniger Mut.', 'worried');
    }
    for (const [id] of GHOULS) if (w.actor(id).exists) w.despawn(id);
    w.completeObjective('e2-stab-bach');
    await afterTheFight(w);
  } finally {
    G.state.set('e2-stab-kampf-laeuft', false);
  }
}

async function afterTheFight(w: WorldCtx): Promise<void> {
  await w.cutscene(async () => {
    const m = w.actor(MENTOR);
    m.hold(true);
    m.face('player');
    w.player.face(MENTOR);
    await say(w, 'Schneller als ich damals. Viel schneller. Und mein Lehrer hat mit Kreide nach mir geworfen.', 'happy');
    await lia(w, 'Ich hab ja auch einen Grund. Jeden Tag, den ich hier übe, sitzen Kyra und Flick irgendwo fest.', 'determined');
    await say(w, 'Sorge macht Beine. Das weiß ich.', 'sad');
    const pick = await w.choose([
      '„Dann lasst mich gehen. Ihr habt gesehen, dass ich treffe.“',
      '„Jeder Tag hier ist ein Tag zu viel für sie.“',
      '„Und wenn ich nie bereit bin? Wartet Ihr dann ewig?“',
    ]);
    G.state.set('e2-stab-ton', ['treffen', 'zeit', 'zweifel'][pick]);
    if (pick === 0) await say(w, 'Du triffst Stümpfe, die stillhalten. Und Leichenfresser, die dumm sind. Vamirs Leute sind keins von beidem.', 'thinking');
    else if (pick === 1) await say(w, 'Und ein Tag zu früh kann einer zu viel für dich sein. Dann holt sie keiner mehr.', 'worried');
    else await say(w, 'Nein. Aber ich warte lieber eine Woche zu lang als einen Tag zu kurz.', 'sad');
    await lia(w, 'Was fehlt mir denn noch?');
    await say(w, 'Ruhe. Ein kühler Kopf, wenn in dir alles brennt. Kraft ohne Besonnenheit ist ein Pferd ohne Zügel.', 'determined');
    await say(w, 'Das kann ich dir nicht beibringen wie das Zielen. Das wächst. Oder es wächst nicht.');
    await lia(w, 'Ihr klingt, als hättet Ihr das selbst ausprobiert.', 'thinking');
    await say(w, 'Ich war einmal sehr sicher, dass ich bereit bin. Ich war es nicht. Mehr erzähle ich heute nicht.', 'sad');
    await w.think('Er sieht auf den Bach, als stünde dort etwas, das nur er sieht. Ich frage nicht weiter. Heute nicht.');
    if (!G.state.knows('e2-stabimpuls')) G.state.learn('e2-stabimpuls');
    await say(w, 'Den Stabimpuls kannst du jetzt. Den Rest übst du. Jeden Tag.');
    m.hold(false);
  });
}

// ---------------------------------------------------------------------------------------------------------------

async function stabtrainingScript(w: WorldCtx): Promise<void> {
  // The props are small next to the painted stumps: show the three things not to hit a little larger.
  for (const id of ['nest', 'laterne', 'eimer']) w.prop(id).image?.setScale(id === 'nest' ? 2.2 : 1.7);
  // The chicks stir now and then, so the small grey nest reads as alive (and as something not to hit).
  bg((async () => {
    while (w.alive && !G.state.is(PRACTICE_DONE)) {
      await w.wait(4200 + Math.random() * 2400);
      if (w.prop('nest').exists) w.prop('nest').shake();
    }
  })());
  G.state.set('e2-stab-zielt', false);
  G.state.set('e2-stab-kampf-laeuft', false);
  const fresh = !G.state.is(PRACTICE_DONE) && !G.state.is('e2-stab-erklaert');
  if (fresh) await w.narrate(['Die Tage rochen nach Rauch und Moos. Lia hackte Holz, holte Wasser, atmete. Den Stab legte sie nicht mehr aus der Hand.'], { style: 'card' });
  await ui().fade('in', 900);
  if (!G.state.is(PRACTICE_DONE)) {
    if (!G.state.is('e2-stab-erklaert')) {
      G.state.set(CALL, 0);
      G.state.set(MISSES, 0);
      G.state.set('e2-stab-bereit', false);
      w.setObjective('e2-stab-platz', 'Ignatius wartet auf dem Übungsplatz.', MENTOR);
      await until(w, () => G.state.is('e2-stab-bereit'));
      w.completeObjective('e2-stab-platz');
      await w.cutscene(() => explain(w));
    }
    await practiceRound(w);
    await until(w, () => G.state.is(PRACTICE_DONE) && !G.state.is('e2-stab-zielt'));
  } else if (!G.state.is(UEBUNGSKAMPF_WON)) {
    for (const [id, at] of GHOULS) w.spawn({ id, preset: 'ghoul', speaker: 'leichenfresser', at, dir: 'left', solid: false }).hold(true);
    w.setObjective('e2-stab-bach', 'Geh mit Ignatius zum Bach. Die Leichenfresser warten an den Trittsteinen.', IG_SPOT.stream);
    // Reloaded right after the battle started (encounter save near the brook): go on directly.
    if (Math.hypot(w.player.x - IG_SPOT.stream[0], w.player.y - IG_SPOT.stream[1]) < 90) void toTheBrook(w);
  } else {
    // Reloaded after the win (the encounter saves before toTheBrook closes the objective): close it here.
    w.completeObjective('e2-stab-bach');
    await afterTheFight(w);
  }
  await until(w, () => G.state.knows('e2-stabimpuls') && !G.state.is('e2-stab-kampf-laeuft'));
  halt(w, [MENTOR]);
  w.lockPlayer();
  await ui().fade('out', 1200);
  G.state.set('e2-training-complete');
  await nextScene('e2-flick-entkommt');
}

export const scene = e2Scene('e2-stabtraining', 'Schattentöter', async () => {
  await ui().fade('out', 0);
  await startEncounterWorld({ map: stabtrainingLager, spawn: 'fire', player: liaLook(), companions: [], fadeIn: false, script: stabtrainingScript });
});
