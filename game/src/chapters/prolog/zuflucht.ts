// prolog-zuflucht: candle-lit farmhouse parlour. Valentus wakes, the couple has nursed him. He cannot be healed and
// fears for his rescuers. The cradle with two sleeping babies; raise the hand, turquoise shimmer, glaring
// light, a bang: Valentus is gone, the babies cry. „Sechzehn Jahre später.“ Which child? Stays open.
// Map: assets/bg/prolog-zuflucht.png (640×360, Codex).
import { G } from '../../core/G';
import { defineMap, startWorld, type WorldCtx } from '../../world';
import { ambience, bubbleAt, music, sceneOf, sfx, sleep, ui } from './util';
import { AFTERTHOUGHT, CHOICE_FLAG, lightSplits, TWINS, type Twin } from './wiege';

const CRADLE: [number, number] = [502, 250];
const CRADLE_STAND: [number, number] = [CRADLE[0] - 22, CRADLE[1] + 4];
const BED: [number, number] = [84, 178];
const BED_EDGE: [number, number] = [140, 196];
const DOOR: [number, number] = [568, 204];

export const zufluchtMap = defineMap({
  id: 'prolog-zuflucht',
  name: 'Die Bauernstube',
  background: 'prolog-zuflucht',
  baked: 'night',
  walk: [[[18, 258], [64, 258], [64, 238], [132, 238], [132, 112], [566, 112], [578, 212], [594, 228], [592, 300], [606, 360], [8, 360]]],
  block: [
    { id: 'tisch', poly: [[240, 178], [400, 178], [400, 224], [240, 224]] },
    { id: 'herd', poly: [[396, 104], [522, 104], [522, 126], [396, 126]] },
  ],
  occluders: [
    { id: 'tisch', baseline: 224, poly: [[236, 126], [404, 126], [404, 228], [236, 228]] },
    { id: 'hocker', baseline: 256, poly: [[14, 202], [62, 202], [62, 258], [14, 258]] },
  ],
  surfaces: [{ id: 'teppich', kind: 'rug', poly: [[376, 258], [586, 258], [590, 336], [380, 336]] }],
  surface: 'wood',
  props: [{ id: 'wiege', prop: 'cradle-twins', at: CRADLE }],
  npcs: [
    { id: 'baeuerin', preset: 'mother', at: [214, 236], dir: 'left', speaker: 'baeuerin', talk: talkBaeuerin },
    { id: 'bauer', preset: 'father', at: [452, 140], dir: 'down', speaker: 'bauer', talk: talkBauer },
  ],
  interactables: [
    {
      id: 'wiege-ansehen', verb: 'Hineinsehen', once: false, at: CRADLE, radius: 26, size: { w: 30, h: 26 },
      standAt: CRADLE_STAND, face: 'right', onInteract: lookCradle,
    },
    {
      id: 'fenster', verb: 'Hinaussehen', once: true, removeOnUse: false, poly: [[146, 18], [218, 18], [218, 74], [146, 74]], radius: 60,
      standAt: [182, 122], face: 'up', onInteract: lookWindow,
    },
    {
      id: 'buch', verb: 'Ansehen', once: true, removeOnUse: false, poly: [[300, 132], [360, 132], [360, 160], [300, 160]], radius: 34,
      standAt: [318, 236], face: 'up', onInteract: lookBook,
    },
    {
      id: 'schrank', verb: 'Untersuchen', once: true, removeOnUse: false, poly: [[264, 12], [372, 12], [372, 108], [264, 108]], radius: 24,
      standAt: [318, 124], face: 'up', thought: 'Ein Küchenschrank mit doppeltem Boden. Der Bauer ist vorsichtiger, als er aussieht.',
    },
  ],
  lights: [
    { id: 'kerze', at: [336, 138], kind: 'candle', radius: 90, intensity: 1.1, always: true },
    { id: 'herdfeuer', at: [458, 96], kind: 'fire', radius: 110, intensity: 0.9, always: true },
    { id: 'wandkerze', at: [624, 146], kind: 'candle', radius: 50, always: true },
    { id: 'fensterlicht', at: [182, 60], kind: 'moon', radius: 60, intensity: 0.4 },
  ],
  spawns: { bett: { at: BED_EDGE, dir: 'right' }, wiege: { at: CRADLE_STAND, dir: 'right' } },
  time: 'night',
  ambience: ['room', 'fire', 'crickets'],
  ambienceVolume: { crickets: 0.4, fire: 0.6 },
  music: 'refuge',
  depthScale: { y0: 110, s0: 1.12, y1: 360, s1: 1.24 },
  sneak: false,
  critters: false,
  resetOnEnter: true,
});

// ------------------------------------------------------------------------------------------------- talk
async function talkBaeuerin(w: WorldCtx): Promise<void> {
  if (G.state.is('prolog-kinder-gesehen')) {
    await w.say('baeuerin', 'Sie sind das Beste, was wir haben. Das Einzige, wenn ich ehrlich bin.', { mood: 'happy' });
    return;
  }
  const i = await w.choose(['„Woher kennt Ihr Euch mit Wunden aus?“', '„Wie heißen eure Töchter?“'], { speaker: 'valentus', prompt: 'Was willst du die Bäuerin fragen?' });
  if (i === 0) await w.say('baeuerin', 'Aus Büchern. Und weil man auf einem Hof jede Woche irgendwen verbindet. Meistens meinen Mann.');
  else await w.say('baeuerin', 'Lia und Kyra. Lia schläft immer zuerst ein. Und Kyra hält sie dann am Finger fest, als wollte sie sie beschützen.', { mood: 'happy' });
}

async function talkBauer(w: WorldCtx): Promise<void> {
  const i = await w.choose(['„Wo genau habt Ihr mich gefunden?“', '„Habt Ihr jemanden im Wald gesehen?“'], { speaker: 'valentus', prompt: 'Was willst du den Bauern fragen?' });
  if (i === 0) await w.say('bauer', 'Am Bach, zwei Stunden von hier. Auf den nassen Steinen. Ihr wart so kalt, ich dachte erst, Ihr wärt tot.');
  else await w.say('bauer', 'Fackeln, drüben am anderen Ufer. Die sind umgekehrt. Hierher verirrt sich keiner.', { mood: 'determined' });
}

async function lookWindow(w: WorldCtx): Promise<void> {
  G.state.addLore('lore-crios');
  await w.think('Crios, im Westen, wie immer. Treuer Adler … wenigstens du bleibst, wo du hingehörst.');
}

async function lookBook(w: WorldCtx): Promise<void> {
  await w.think('„Cronibus großes Kräuterlexikon“. Eine Bäuerin, die liest?');
  const m = w.actor('baeuerin');
  if (!m.exists || !m.sprite?.visible) return;
  m.face('player');
  await w.say('baeuerin', 'Ich stamme aus Trapas. Mein Vater war Händler. Lesen ist das Einzige, was ich mitgenommen habe.', { mood: 'happy' });
  await w.say('baeuerin', 'Ich bringe es den beiden bei, sobald sie groß genug sind. Ob sie wollen oder nicht.');
  G.state.set('prolog-buch-gesehen');
}

// ------------------------------------------------------------------------------------------------- the cradle
async function lookCradle(w: WorldCtx): Promise<void> {
  if (G.state.is('prolog-geschenk')) return;
  if (!G.state.is('prolog-kinder-gesehen')) {
    G.state.set('prolog-kinder-gesehen');
    await w.think('Zwei kleine Gesichter unter einer Decke. Sie atmen im selben Takt.');
    const m = w.actor('baeuerin'), f = w.actor('bauer');
    await w.cutscene(async () => {
      m.face('player');
      await w.say('baeuerin', 'Wehe, Ihr weckt sie. Es hat den halben Abend gedauert.', { mood: 'happy' });
      await w.say('valentus', 'Ich wecke niemanden. Ich … sehe sie nur an.', { mood: 'sad' });
      await w.say('bauer', 'Ich seh nach dem Vieh. Die Kuh war unruhig, als hätte sie Wölfe gerochen.');
      await w.say('baeuerin', 'Und ich hole frisches Wasser für Euren Verband. Bleibt sitzen, wenn Ihr könnt.');
      m.hold(true); f.hold(true);
      await Promise.all([
        f.walkPath([[520, 200], DOOR], { speed: 40 }),
        sleep(700).then(() => m.walkPath([[420, 240], [540, 222], DOOR], { speed: 40 })),
      ]);
      sfx('door', { volume: 0.6 });
      f.hide(); m.hide();
      await sleep(400);
    });
    w.completeObjective('prolog-kinder');
    w.setObjective('prolog-geschenk', 'Entscheide, was mit der Urmacht geschieht.', 'wiege-ansehen');
    await w.think('Jetzt bin ich allein. Mit ihnen. Und mit dem, was ich in mir trage.');
    return;
  }
  await gift(w);
}

async function gift(w: WorldCtx): Promise<void> {
  await w.cutscene(async () => {
    w.player.face('right');
    await w.think('Die ~Urmacht~ wird mit mir sterben – oder sie fällt denen in die Hände, die mich jagen.');
    await w.think('Wer sucht schon bei einem Säugling? Das Unschuldigste und Wehrloseste, was es gibt.');
    await w.think('Vorerst würde so kein Schaden angerichtet werden.');
    const glow = w.lighting.add({ id: 'urmacht-wiege', at: [CRADLE[0], CRADLE[1] - 12], kind: 'urmacht', radius: 50, intensity: 0, always: true });
    void glow.fadeTo(0.8, 3200);
    const shimmer = sceneOf(w).time.addEvent({ delay: 380, loop: true, callback: () => w.fx.burst([CRADLE[0], CRADLE[1] - 14], 'urmacht', 2) });
    w.player.play('cast');
    let hum: { stop(ms?: number): void } | null = null;
    try { hum = G.audio.loop('urmacht', { interval: 1.6, volume: 0.35 }); } catch { hum = null; }
    const gift = await G.ui.scenePick({
      label: 'Wem gebe ich sie?',
      help: 'Zwei Kinder in einer Wiege. Die Urmacht in Valentus’ Hand. Er kann sie nur einem geben.',
      backdrop: 'minigames/gesture-lift-scene',
      layout: 'row',
      className: 'prolog-wiege',
      rounds: [{
        prompt: { speaker: 'valentus', text: 'Eins von euch muss sie tragen. Welches?' },
        cards: TWINS.map(t => ({ ...t })),
        judge: (id: string) => ({ ok: true, mood: 'flash', reply: [{ speaker: 'valentus', text: lightSplits(id as Twin) }, { speaker: 'valentus', text: AFTERTHOUGHT }] }),
      }],
      onVerdict: () => { sfx('urmacht', { volume: 0.8 }); },
    });
    G.state.set(CHOICE_FLAG, gift.picks[0]?.id ?? 'still');
    shimmer.remove(false);
    hum?.stop(400);
    void glow.fadeTo(1.5, 600);
    w.fx.burst([CRADLE[0], CRADLE[1] - 14], 'urmacht', 24);
    sfx('urmacht', { volume: 1 });
    ui().prefetchPlate('prolog-wiege');
    await G.ui.plate('prolog-wiege', { caption: 'Das Geschenk', pan: 'in', durationMs: 18000 });
    await G.ui.say('valentus', 'Schlaft. Und vergebt mir, was ich euch aufbürde.', { mood: 'sad' });
    await G.ui.say('valentus', 'Wenn ihr groß seid, wird sie euch finden. Oder ihr sie. Möge das Licht euch schützen.', { mood: 'sad' });
    await G.ui.closePlate();
    // Glaring light, a bang. Valentus is gone.
    G.state.set('prolog-geschenk');
    w.completeObjective('prolog-geschenk');
    music(null, 300);
    await G.ui.fade('out', 260, '#eafffb');
    sfx('shockwave', { volume: 1.2 });
    sfx('thunder', { volume: 0.7 });
    w.camera.shake(420, 0.01);
    w.player.hide();
    glow.remove();
    await sleep(700);
    await G.ui.fade('in', 1400, '#eafffb');
    w.fx.burst([CRADLE[0] - 26, CRADLE[1] - 20], 'sparkle', 16);
    await sleep(600);
    const cries = ['Uäääh!', 'Uääh! Uääh!', 'Wääh!'];
    for (let k = 0; k < 4; k++) { bubbleAt(w, CRADLE[0] + (k % 2 ? 8 : -8), CRADLE[1] - 26, cries[k % cries.length], 1300); await sleep(700); }
    await w.camera.pan([CRADLE[0], CRADLE[1] - 40], 600);
    const m = w.actor('baeuerin'), f = w.actor('bauer');
    sfx('door', { volume: 0.9 });
    m.teleport(DOOR, 'left'); f.teleport([DOOR[0] - 4, DOOR[1] + 22], 'left');
    m.show(); f.show();
    await Promise.all([m.walkTo([CRADLE[0] + 24, CRADLE[1] - 4], { run: true }), f.walkTo([CRADLE[0] - 30, CRADLE[1] - 30], { run: true })]);
    await w.say('baeuerin', 'Was war das für ein Licht?! Die Kinder –', { mood: 'scared' });
    m.face('left');
    void m.play('kneel', { ms: 6000 });
    bubbleAt(w, CRADLE[0], CRADLE[1] - 26, 'Uääh …', 1400);
    await w.say('baeuerin', 'Schsch … alles gut. Alles gut, ihr zwei. Ich bin ja da.', { mood: 'sad' });
    f.face('down');
    await w.say('bauer', 'Er ist fort. Kein Mantel, kein Blut, nichts. Als wäre er nie hier gewesen.', { mood: 'scared' });
    await w.say('baeuerin', 'Sie sind warm. Beide. Und sie hören auf zu weinen …');
    await sleep(800);
    music('grief', 2000);
    await G.ui.fade('out', 2600);
  });
  ambience([], 2000);
  await G.ui.narrate([
    'Er übergab die ~Urmacht~ dem Unschuldigsten und Wehrlosesten, was er finden konnte. Vorerst würde so kein Schaden angerichtet werden.',
    'Welchem der beiden Kinder? Das wusste nur das Licht. Und das Licht schwieg – sechzehn Jahre lang.',
  ], { style: 'card' });
  await G.ui.caption('Sechzehn Jahre später', 2600);
  music(null, 1500);
  await G.goto('wiese');
}

// ------------------------------------------------------------------------------------------------- scene
export function prepareZuflucht(): void {
  G.state.setParty(['valentus']);
  G.state.addLore('lore-urmacht');
  G.state.addLore('lore-dunkelhain');
}

export async function startZuflucht(): Promise<void> {
  await G.ui.fade('out', 0);
  await startWorld({ map: zufluchtMap, spawn: 'bett', player: 'valentus', script: zufluchtScript });
}

async function zufluchtScript(w: WorldCtx): Promise<void> {
  const m = w.actor('baeuerin'), f = w.actor('bauer');
  w.prop('wiege').image?.setScale(1.7);
  w.player.teleport(BED, 'right');
  w.player.setIdle('lie');
  w.player.setSpeed(sceneOf(w).player.walkSpeed * 0.55);
  sceneOf(w).player.runSpeed = sceneOf(w).player.walkSpeed * 1.2;
  await w.cutscene(async () => {
    m.hold(true); f.hold(true);
    await G.ui.fade('in', 2200);
    await sleep(600);
    await w.say('narrator', 'Kerzenlicht. Der Geruch von Kräutern und Rauch. Valentus erwachte.');
    m.face('left');
    void m.emote('!', 900);
    await w.say('baeuerin', 'Ihr seid wach! Drei Tage habt Ihr im Fieber gelegen.', { mood: 'surprised' });
    await w.say('valentus', 'Wo … bin ich?', { mood: 'pained' });
    f.face('left');
    await w.say('bauer', 'Auf unserem Hof. Ich hab Euch am Bach gefunden. Im Schlaf habt Ihr von Licht geredet. Viel Licht.');
    const i = await w.choose(['„Ihr hättet mich liegen lassen sollen.“', '„Ich danke euch. Ihr wisst nicht, was ihr getan habt.“']);
    if (i === 0) await w.say('baeuerin', 'Einen Verwundeten im Wald liegen lassen? So hat uns niemand erzogen. Weder in Trapas noch hier.', { mood: 'determined' });
    else await w.say('bauer', 'Einen alten Mann aufgelesen. Mehr nicht. Mein Rücken weiß es noch.', { mood: 'happy' });
    await w.say('baeuerin', 'Aber die Wunde … sie schließt sich nicht. Meine Tinktur, meine Kräuter, nichts hilft.', { mood: 'sad' });
    await w.say('valentus', 'Kein Kraut heilt, was dieser Pfeil geschlagen hat. Mir bleibt nicht mehr viel Zeit.', { mood: 'sad' });
    await w.say('valentus', 'Hört mir zu. Man jagt mich. Wenn sie mich hier finden, töten sie euch. Alle.', { mood: 'determined' });
    await w.say('bauer', 'Hierher kommt nicht mal der Steuereintreiber. Ruht Euch aus, Alter.');
    await w.say('baeuerin', 'Und leise, bitte. Die beiden schlafen endlich.');
    await w.say('valentus', 'Die beiden?', { mood: 'surprised' });
    await w.say('baeuerin', 'Unsere Töchter. Zwillinge, drei Monde alt. Da drüben in der Wiege.', { mood: 'happy' });
    await w.say('valentus', 'Ich muss … aufstehen.', { mood: 'pained' });
    w.player.setIdle('sit');
    await sleep(500);
    w.player.setIdle('idle');
    await w.player.walkTo(BED_EDGE, { straight: true, speed: 30 });
    m.hold(false); f.hold(false);
  });
  w.setObjective('prolog-kinder', 'Steh auf und sieh nach den Kindern in der Wiege.', 'wiege-ansehen');
  await sleep(400);
  w.bark('bauer', 'Langsam, Alter, langsam!', 1800);
}
