// Scene „e2-kyras-widerstand“ – Nicht ein Wort (docs/teil-2/umsetzung.md §3, F2 24:14–25:19). Captivity interlude:
// the player is Kyra, bound on the heavy table in the Master's hall (kyra-bound, pose lie). Heart: refusals as
// choices (all of them refusals, in Kyra's voice) and a small act of resistance – while the Master turns away she
// picks at the knot (tend gesture), a guard notices, the ropes are pulled tight again; she stays a prisoner. The
// Master admits he cannot sense Lia right now, something shields her (left unnamed); Kyra triumphs inside. Fade to
// black before his hand touches her. No reward of any kind. → e2-ignatius.
import { G } from '../../core/G';
import { defineMap, startWorld, type MapDef, type WorldCtx } from '../../world';
import { HALLE_CHAIR, HALLE_SPOT, halleBase, halleBrazierLights, pinArea, pinPlayer } from './gewoelbe';
import { restageGesture, type GesturePicture } from './gewoelbe-geste';
import { bg, e2Scene, interlude, master, sfx, ui, until, VIOLET, nextScene } from './shared';

const KNOT_FREE = 'e2-kyra-knoten-frei';
const KNOT_DONE = 'e2-kyra-knoten';

/** Close-up for the tend gesture: Kyra bound on the table, the Master and the guard at the brazier, the knot glinting. */
const KNOT_PICTURE: GesturePicture = {
  background: 'e2-halle', focus: [150, 150], zoom: 3, glint: [140, 152],
  figures: [
    { id: 'kyra-bound', pose: 'lie', at: HALLE_SPOT.tableTop, facing: 'right' },
    { id: 'vamir', pose: 'idle', at: [236, 112], facing: 'up', dim: true },
    { id: 'shadow-club', pose: 'idle', at: [218, 106], facing: 'up', dim: true },
  ],
};

export const tischMap: MapDef = defineMap({
  ...halleBase,
  id: 'e2-halle-tisch',
  name: 'Die Halle des Meisters',
  walk: [pinArea(HALLE_SPOT.tableTop)],
  block: [{ id: 'stuhl', poly: HALLE_CHAIR, sight: false }],
  spawns: { tisch: { at: HALLE_SPOT.tableTop, dir: 'right' } },
  interactables: [
    { id: 'knoten', verb: 'Am Knoten zupfen', at: [150, 160], radius: 28, once: false, when: () => G.state.is(KNOT_FREE), onInteract: pickKnot },
  ],
  lights: halleBrazierLights(0.75),
  time: 'night',
  ambience: ['room', 'fire'],
  ambienceVolume: { room: 0.75, fire: 0.4 },
  music: 'dread',
  playerLight: 30,
  resetOnEnter: true,
});

// ---------------------------------------------------------------------------------------------------------------

async function pickKnot(w: WorldCtx): Promise<void> {
  if (!G.state.is(KNOT_FREE) || G.state.is(KNOT_DONE)) return;
  G.state.set(KNOT_FREE, false);
  sfx('rustle', { volume: 0.3 });
  await w.think('Der Knoten am rechten Handgelenk. Wer den gebunden hat, war müde. Daumen drunter, zupfen. Ganz leise.');
  const gesture = G.ui.storyAction('tend', 'Am Knoten zupfen');
  restageGesture('tend', 'Schieb den Daumen unter die Schlinge und zupf sie hin und her. Leise. Er dreht dir gerade den Rücken zu.', KNOT_PICTURE);
  await gesture;
  sfx('rope-cut', { volume: 0.25 });
  await w.think('Er gibt nach! Noch ein bisschen, dann hab ich eine Hand frei. Eine Hand reicht für ein Ohr. Oder eine Nase.');
  G.state.set(KNOT_DONE);
}

async function noticed(w: WorldCtx): Promise<void> {
  const guard = w.actor('waerter'), vamir = w.actor('meister');
  await w.cutscene(async () => {
    bg(guard.emote('!', 900));
    await w.say('e2-waerter', 'Meister! Die Kleine fummelt am Strick!');
    vamir.face('player');
    await vamir.walkTo(HALLE_SPOT.tableHead[0], HALLE_SPOT.tableHead[1], { straight: true });
    await w.say(master(), 'Natürlich tut sie das. Ich hätte mich gewundert, wenn nicht. Zieh ihn fest. Fester als der Letzte.');
    await guard.walkPath([[220, 160], [206, 206], [150, 206]], { straight: true });
    guard.face('up');
    sfx('chain', { volume: 0.5 });
    await w.wait(300);
    sfx('rope-cut', { volume: 0.2, pitch: 0.7 });
    w.camera.shake(140, 0.002);
    await w.say('e2-kyra-bound', 'Komm ruhig näher, ich hab noch Zähne übrig.', { mood: 'angry' });
    sfx('hit', { volume: 0.3 });
    bg(guard.play('hit' as never, { ms: 500 }));
    await w.say('e2-waerter', 'Au! Die beißt ja wirklich!');
    await w.say('e2-kyra-bound', 'Hat Baris doch gesagt. Hört hier eigentlich keiner zu?', { mood: 'determined' });
    await guard.walkTo(HALLE_SPOT.tableFront[0], HALLE_SPOT.tableFront[1] + 8, { straight: true });
    guard.face('up');
    await w.think('Fest. Fester als vorher. Na gut. Dann eben mit dem Mund.');
  });
}

async function opening(w: WorldCtx): Promise<void> {
  const vamir = w.actor('meister');
  await w.cutscene(async () => {
    sfx('chain', { volume: 0.4 });
    await w.wait(400);
    await w.think('Strick um die Handgelenke, Strick um die Knöchel. Festgebunden wie ein Ferkel am Schlachttag.');
    await w.think('Nur dass die Ferkel nicht wussten, was kommt. Ich weiß es auch nicht. Das ist schlimmer.');
    await vamir.walkTo(HALLE_SPOT.tableHead[0], HALLE_SPOT.tableHead[1], { straight: true });
    vamir.face('player');
    await w.say(master(), 'Die Schwester. Gleiches Gesicht, sagt Baris. Ich sehe eher gleichen Starrsinn.');
    await w.say(master(), 'Du warst schon einmal die Falsche, Kind. Heute darfst du die Richtige sein. Sag mir, wo sie ist.');
    const pick = await w.choose([
      '„Keine Ahnung, wo Lia ist. Und ich war noch nie so froh, keine Ahnung zu haben.“',
      '(Nach seiner Hand schnappen.)',
      '„Erst bindest du mich los. Dann sag ich’s dir. Dann lauf ich weg. Guter Plan, oder?“',
    ]);
    G.state.set('e2-kyra-antwort', ['ahnung', 'biss', 'plan'][pick]);
    if (pick === 0) {
      await w.say('e2-kyra-bound', 'Keine Ahnung, wo Lia ist. Und ich war noch nie so froh, keine Ahnung zu haben.', { mood: 'determined' });
      await w.say(master(), 'Unwissen schützt nicht. Es dauert nur länger.');
    } else if (pick === 1) {
      sfx('swing', { volume: 0.4 });
      bg(vamir.hop());
      await w.say('e2-kyra-bound', 'Grrr!', { mood: 'angry' });
      await w.say(master(), 'Baris hat nicht übertrieben. Sie beißt. Wie ein Hofhund, den man zu lange an der Kette hatte.');
    } else {
      await w.say('e2-kyra-bound', 'Erst bindest du mich los. Dann sag ich’s dir. Dann lauf ich weg. Guter Plan, oder?', { mood: 'determined' });
      await w.say(master(), 'Ein Plan mit drei Schritten. Das ist mehr, als Baris je hatte.');
    }
    await w.say(master(), 'Wärter. Mehr Licht. Ich will sehen, wann sie Angst bekommt.');
    await vamir.walkTo(236, 112, { straight: true });
    vamir.face('up');
  });
}

async function shield(w: WorldCtx): Promise<void> {
  const vamir = w.actor('meister');
  await w.cutscene(async () => {
    await w.say(master(), 'Weißt du, was mich wirklich ärgert? Neulich habe ich deine Schwester gespürt. Hell wie ein Leuchtfeuer.');
    await w.say(master(), 'Und jetzt? Nebel. Da, wo sie sein müsste, liegt etwas über ihr. Wie eine Hand über einer Kerze.');
    await w.say(master(), 'Ob es ein Mensch ist oder ein Zauber, ich weiß es nicht. Aber etwas legt sich über sie. Also musst du mir helfen, Kind.');
    await w.think('Nebel. Er findet sie nicht. Lia ist irgendwo, wo er nicht hinkommt.');
    await w.think('Lauf, Lia. Lauf und dreh dich nicht um. Diesmal bin ich gern die Falsche.');
    const pick = await w.choose([
      '„Hörst du das? Das ist meine Schwester. Wie sie dich auslacht. Von ganz weit weg.“',
      '„Ich hab Schweine gehütet, die klügere Fragen gestellt haben.“',
      '„Mund zu. Den hat nicht mal Mutter aufgekriegt, wenn’s Rüben gab.“',
    ]);
    if (pick === 0) await w.say('e2-kyra-bound', 'Hörst du das? Das ist meine Schwester. Wie sie dich auslacht. Von ganz weit weg.', { mood: 'determined' });
    else if (pick === 1) await w.say('e2-kyra-bound', 'Ich hab Schweine gehütet, die klügere Fragen gestellt haben. Und die haben besser gerochen.', { mood: 'angry' });
    else await w.say('e2-kyra-bound', 'Mund zu. Den hat nicht mal Mutter aufgekriegt, wenn’s Rüben gab. Und die hatte wenigstens Honig dabei.', { mood: 'sad' });
    await vamir.walkTo(HALLE_SPOT.tableHead[0], HALLE_SPOT.tableHead[1], { straight: true });
    vamir.face('player');
    await w.say(master(), 'Mund zu, Augen offen. Das genügt mir. Ich lese ohnehin lieber selbst.');
    await w.say('e2-kyra-bound', 'Na dann viel Spaß. Bei mir steht nichts drin. Ich kann nämlich nicht schreiben.', { mood: 'determined' });
  });
}

async function touch(w: WorldCtx): Promise<void> {
  const vamir = w.actor('meister');
  await w.cutscene(async () => {
    G.audio.duck(-12, 5000);
    bg(vamir.play('cast', { ms: 3000 }));
    const hand: [number, number] = [HALLE_SPOT.tableHead[0] - 14, HALLE_SPOT.tableHead[1] - 34];
    const glow = w.lighting.add({ id: 'e2-meister-hand', at: hand, kind: 'plain', color: VIOLET, radius: 40, intensity: 0, always: true });
    sfx('magic', { volume: 0.5, pitch: 0.55 });
    await w.camera.zoom(1.4, 1400);
    await glow.fadeTo(1.1, 1600);
    await w.think('Violett. Kalt wie Brunnenwasser im Winter. Es kommt näher.');
    await w.think('Ich mach die Augen nicht zu. Den Gefallen tu ich ihm nicht.');
    sfx('heartbeat', { volume: 0.6 });
    await G.ui.fade('out', 900, '#0b0712');
  });
}

async function tischScript(w: WorldCtx): Promise<void> {
  G.state.set(KNOT_FREE, false);
  G.state.set(KNOT_DONE, false);
  G.state.set('e2-kyra-antwort', false);
  const vamir = w.spawn({ id: 'meister', preset: 'vamir', speaker: master(), at: [300, 140], dir: 'left', solid: false, speed: 28 });
  const guard = w.spawn({ id: 'waerter', preset: 'shadow-club', speaker: 'e2-waerter', at: [HALLE_SPOT.tableFront[0], HALLE_SPOT.tableFront[1] + 8], dir: 'up', solid: false, speed: 40 });
  const baris = w.spawn({ id: 'baris', preset: 'baris-scarred', speaker: 'e2-baris', at: HALLE_SPOT.guardSouthWest, dir: 'up', solid: false });
  for (const a of [vamir, guard, baris]) a.hold(true);
  pinPlayer(w, 'lie', 'right');
  await ui().fade('in', 900);
  w.setObjective('e2-kyra-schweigen', 'Kein Wort über Lia.', 'meister');
  await opening(w);

  // The Master turns his back and the guard goes for the torch: Kyra's moment.
  bg(guard.walkPath([[214, 222], [222, 150], [218, 108]], { straight: true }).then(() => guard.face('up')));
  G.state.set(KNOT_FREE, true);
  w.setObjective('e2-kyra-knoten', 'Er sieht weg. Zupf am Knoten an deinem rechten Handgelenk.', 'knoten');
  await until(w, () => G.state.is(KNOT_DONE));
  w.completeObjective('e2-kyra-knoten');
  await noticed(w);
  await shield(w);
  await touch(w);
  w.completeObjective('e2-kyra-schweigen');
  G.state.set('e2-kyra-widerstand-done');
  await nextScene('e2-ignatius');
}

export const scene = e2Scene('e2-kyras-widerstand', 'Nicht ein Wort', async () => {
  await interlude('Unterdessen, auf dem Tisch in der Halle des Meisters …');
  await startWorld({ map: tischMap, spawn: 'tisch', player: 'kyra-bound', companions: [], script: tischScript });
});
