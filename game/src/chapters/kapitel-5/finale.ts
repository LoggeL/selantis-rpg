// Kapitel V, Szene 5 „finale“ (order as in the film, wording our own): Lia wakes with Kyra and Flick („Wo sind die
// alle hin?“). Cut: Baris drags himself to the ruins, the Master steps out of black smoke („Du hast die Falsche an den
// Baum gebunden. Die Richtige stand an deinem Feuer.“) and punishes him (violet magic, one half of his face burned, an
// eye lost; staged tastefully). Back to the three: Flick will take them to the rebels, Kyra is thrilled, Lia sighs and
// hesitates (Foltan). They walk off together under Crios. Book-style credits „Ende des ersten Buches“, then back to the title.
import { G } from '../../core/G';
import { findScene } from '../../core/registry';
import type { ChoiceOption } from '../../ui/api';
import { defineMap, type MapDef, type WorldCtx } from '../../world';
import { BOOK2, continueToBook2 } from '../common/bookContract';
import { ambience, lia, sfx, ui } from './common';
import { showCredits } from './credits';
import { FIRE_AT, LAGER_BLOCK, LAGER_HIDING, LAGER_OCCLUDERS, LAGER_SURFACES, LAGER_WALK } from './lagerGeom';

const VIOLET = 0x9a6cff;

export const lagerNachtMap: MapDef = defineMap({
  id: 'k5-lager-nacht',
  name: 'Der Baum über den Feldern',
  background: 'k5-schattenlager',
  walk: LAGER_WALK,
  block: LAGER_BLOCK,
  occluders: LAGER_OCCLUDERS,
  surfaces: LAGER_SURFACES,
  hidingSpots: LAGER_HIDING,
  npcs: [
    { id: 'kyra', preset: 'kyra', at: [770, 392], dir: 'right', talk: talkKyra },
    { id: 'flick', preset: 'flick', at: [832, 404], dir: 'left', talk: talkFlick },
  ],
  props: [{ prop: 'campfire', at: [FIRE_AT[0], FIRE_AT[1] + 4], id: 'feuer', collide: false }],
  interactables: [
    { id: 'brandkreis', verb: 'Ansehen', at: [640, 446], radius: 34, sparkle: true, onInteract: scorchRing },
  ],
  triggers: [
    { id: 'aufbruch', poly: [[612, 690], [692, 690], [690, 720], [612, 720]], once: false, when: () => G.state.is('k5-weiter'), onEnter: departure },
  ],
  lights: [
    { id: 'lagerfeuer', at: [FIRE_AT[0], FIRE_AT[1]], kind: 'fire', radius: 140, intensity: 1.1, flame: 1, always: true },
    { id: 'brand', at: [640, 440], kind: 'urmacht', radius: 40, intensity: 0.45, always: true },
    { id: 'mond', at: [200, 0], kind: 'moon', radius: 520, intensity: 0.3 },
  ],
  spawns: {
    erwachen: { at: [800, 386], dir: 'down' },
    lager: { at: [800, 392], dir: 'down' },
  },
  time: 'night',
  weather: 'fireflies',
  ambience: ['night', 'crickets', 'fire'],
  ambienceVolume: { fire: 0.6 },
  music: 'refuge',
  playerLight: 56,
  depthScale: { y0: 100, s0: 0.92, y1: 720, s1: 1.05 },
});

export const ruinenMap: MapDef = defineMap({
  id: 'k5-ruinen',
  name: 'Die Ruinen',
  background: 'k5-ruinen',
  baked: 'night',
  walk: [[
    [214, 132], [300, 116], [330, 96], [356, 96], [380, 116], [470, 132], [520, 170], [520, 230], [470, 262], [400, 276],
    [380, 300], [372, 360], [300, 360], [298, 300], [270, 276], [190, 262], [150, 236], [150, 170],
  ]],
  block: [
    { id: 'saeule-l', poly: [[152, 222], [184, 220], [186, 236], [154, 238]] },
    { id: 'saeule-r', poly: [[454, 222], [488, 220], [490, 238], [456, 240]] },
  ],
  occluders: [
    { id: 'saeule-l', baseline: 236, poly: [[150, 196], [190, 194], [190, 240], [150, 240]] },
    { id: 'saeule-r', baseline: 238, poly: [[452, 198], [492, 196], [492, 242], [452, 242]] },
    { id: 'vorne', baseline: 360, poly: [[0, 300], [120, 290], [250, 310], [280, 360], [0, 360]] },
    { id: 'vorne-r', baseline: 360, poly: [[400, 330], [520, 300], [640, 300], [640, 360], [396, 360]] },
  ],
  surface: 'stone',
  lights: [{ id: 'mond', at: [560, 0], kind: 'moon', radius: 300, intensity: 0.35 }],
  spawns: { sued: { at: [336, 352], dir: 'up' } },
  time: 'night',
  weather: 'fog',
  ambience: ['night', 'wind'],
  ambienceVolume: { wind: 0.5 },
  music: 'dread',
  playerLight: 0,
});

// ---------------------------------------------------------------------------------------------------------------

async function awakening(w: WorldCtx): Promise<void> {
  const kyra = w.actor('kyra'), flick = w.actor('flick');
  w.player.play('lie');
  kyra.setIdle('kneel'); flick.setIdle('sit');
  kyra.face('player'); flick.face('player');
  ui().prefetchPlate('k5-erwachen');
  await w.cutscene(async () => {
    await w.camera.zoom(1.4, 0);
    await G.ui.fade('in', 1600);
    await w.say('kyra', 'Lia! Mach die Augen auf, sonst kipp ich dir deinen Wasserschlauch übern Kopf. Ich mein’s ernst.', { mood: 'scared' });
    await G.ui.plate('k5-erwachen', { caption: 'Unter der Eiche', pan: 'in', durationMs: 30000 });
    await lia('Mein Kopf … Wo sind die alle hin?', 'hurt');
    await w.say('flick', 'Weg. Gerannt. Und zwar vor dir.', { mood: 'smirk' });
    await lia('Vor mir?', 'surprised');
    await w.say('flick', 'Ich hab schon einiges gesehen, Leseratte. So was noch nicht. Und das sag ich nicht gern.', { mood: 'happy' });
    await lia('Ich seh nur noch die Axt über Flick. Danach ist alles weiß.', 'thinking');
    await w.say('kyra', 'Pass auf. Das glaubst du mir nie.', { mood: 'happy' });
    await G.ui.closePlate();
    await G.ui.fade('out', 900);
  });
}

async function masterScene(w: WorldCtx): Promise<void> {
  w.player.hide();
  w.lockPlayer();
  const baris = w.spawn({ id: 'baris', preset: 'baris', at: [336, 372], dir: 'up', speed: 22, solid: false });
  const vamir = w.spawn({ id: 'vamir', preset: 'vamir', speaker: 'vamir', at: [336, 150], dir: 'down', hidden: true, solid: false });
  await w.camera.pan([336, 214], 0);
  await w.camera.zoom(1.45, 0);
  ui().prefetchPlate('k5-vamir');
  await w.narrate(['Weit entfernt, in den Ruinen eines vergessenen Heiligtums, schleppte sich ein Mann durch den Nebel.'], { style: 'card' });
  await G.ui.fade('in', 1400);
  await w.cutscene(async () => {
    await baris.walkTo(336, 244, { straight: true });
    await baris.play('hit', { ms: 600 });
    baris.setIdle('kneel');
    await w.wait(700);
    sfx('whoosh', { volume: 0.7 });
    w.fx.burst([336, 150], 'smoke', 14);
    w.fx.burst([336, 160], 'smoke', 10);
    const glow = w.lighting.add({ id: 'k5-violett', at: [336, 140], kind: 'plain', color: VIOLET, radius: 90, intensity: 0, always: true });
    void glow.fadeTo(0.9, 900);
    await w.wait(500);
    vamir.show();
    if (vamir.sprite) { vamir.sprite.setAlpha(0); w.scene.tweens.add({ targets: vamir.sprite, alpha: 1, duration: 900 }); }
    G.audio.duck(-10, 4000);
    await w.wait(900);
    await w.say('vamir', 'Sechzehn Jahre, Baris. Und du schleppst mir tagelang ein Bauernmädchen durch die Wälder.');
    await w.say('baris', 'Sie war vom richtigen Hof, Meister.');
    await w.say('vamir', 'Du hast die Falsche an den Baum gebunden. Die Richtige stand an deinem Feuer.');
    await w.say('baris', 'Die Kleine vom Feuer …');
    await w.say('vamir', 'Ich habe sie heute Nacht gespürt. Bis hierher. Und du warst nah genug, um sie anzufassen.');
    await G.ui.plate('k5-vamir', { caption: 'Der Meister', pan: 'in', durationMs: 14000 });
    await w.say('narrator', 'Der Meister hebt die Hand, ohne Eile. Violettes Licht sammelt sich darin wie Rauch in einer Schale.');
    sfx('magic', { volume: 1 });
    w.lighting.flash(VIOLET, 500);
    w.camera.shake(500, 0.006);
    sfx('hit-heavy', { volume: 0.7 });
    await w.say('narrator', 'Er legt die Hand auf Baris’ Gesicht, beinahe sanft. Es zischt. Baris schreit nicht.');
    await w.say('narrator', 'Als der Meister sie zurückzieht, ist eine Gesichtshälfte verbrannt. Das Auge darin ist trüb wie Milch.');
    await G.ui.closePlate();
    await w.say('k5-baris-scarred', '… Danke, Meister.', { mood: 'pained' });
    await w.say('vamir', 'Das andere Auge darfst du behalten. Such sie damit.');
    sfx('whoosh', { volume: 0.6 });
    w.fx.burst([336, 150], 'smoke', 16);
    if (vamir.sprite) w.scene.tweens.add({ targets: vamir.sprite, alpha: 0, duration: 700 });
    await glow.fadeTo(0, 800);
    vamir.hide();
    await w.wait(900);
    await w.say('narrator', 'Wo die Trägerin der Urmacht jetzt war, wusste auch der Meister nicht.');
  });
  await G.ui.fade('out', 1200);
  await w.camera.zoom(1, 0);
  w.despawn('baris');
  w.despawn('vamir');
  w.unlockPlayer();
  w.player.show();
}

async function afterwards(w: WorldCtx): Promise<void> {
  const kyra = w.actor('kyra'), flick = w.actor('flick');
  kyra.setIdle('idle'); flick.setIdle('idle');
  w.player.play('idle');
  w.camera.follow();
  await w.camera.zoom(1, 0);
  await G.ui.fade('in', 1200);
  await w.cutscene(async () => {
    kyra.face('player'); flick.face('player');
    if (G.state.is('k5-kyra-spaet-befreit')) await w.say('kyra', 'Flick hat mich losgeschnitten, als die Kerle weg waren. Dich hab ich hergeschleppt. Du bist schwerer, als du aussiehst.', { mood: 'happy' });
    await w.say('kyra', '… und dann sind sie los wie Hühner vorm Fuchs. Und der Riese ist hinterhergekrochen. Ohne Axt!', { mood: 'happy' });
    await lia('Ich hab gar nichts gemacht. Ich hab nur gedacht: nicht Flick.', 'thinking');
    await w.say('flick', 'Rührend. Und nur damit das klar ist: Ich hatte alles im Griff.', { mood: 'smirk' });
    await w.say('kyra', 'Sicher. Auf dem Rücken, mit ’ner Axt überm Kopf. Sah sehr nach Griff aus.', { mood: 'happy' });
  });
  G.state.setParty(['flick', 'kyra']);
  w.setObjective('k5-reden', 'Sprich mit Kyra und Flick.', 'flick');
  G.checkpoint(); // k5-erwacht: a reload resumes at the night camp instead of replaying the awakening
}

async function talkKyra(w: WorldCtx): Promise<void> {
  const beads = G.state.count('bead');
  if (beads > 0 && !G.state.is('k5-perlen-zurueck')) {
    G.state.set('k5-perlen-zurueck');
    await lia(beads >= 3 ? 'Hier. Die lagen auf dem Weg. Alle drei.' : 'Hier. Die lagen auf dem Weg.', 'happy');
    G.state.take('bead', beads);
    await w.say('kyra', 'Meine Perlen! Gestreut wie im Märchen. Hätt nie gedacht, dass dein ewiges Lesen mal was nützt.', { mood: 'happy' });
    await lia('Und wenn ich sie übersehen hätte?', 'sad');
    await w.say('kyra', 'Dann hätt ich dem Riesen so lang gegen die Schienbeine getreten, bis er mich freiwillig laufen lässt.', { mood: 'happy' });
    G.state.addMemory('k5-mem-perlen');
    return;
  }
  if (G.state.has('ribbon') && !G.state.is('k5-band-zurueck')) {
    G.state.set('k5-band-zurueck');
    await lia('Und das hier lag im Stall vom Goldenen Eber.', 'happy');
    G.state.take('ribbon');
    await w.say('kyra', 'Mein Haarband … Den ganzen Weg bist du mir nach. Du. Die beim Holzholen nach drei Scheiten schnauft.', { mood: 'sad' });
    return;
  }
  await w.say('kyra', 'Nachts am Pflock hab ich an den Hof gedacht. Ob jemand die Schweine füttert. Dumm, oder?', { mood: 'sad' });
  await lia('Die Schweine hab ich laufen lassen. Mutter und Vater liegen vorm Haus. Ich hab ihnen versprochen, dass wir zu zweit wiederkommen.', 'sad');
  await w.say('kyra', 'Dann halten wir das. Ich pflück die Blumen, und du weißt, wie sie heißen.', { mood: 'determined' });
}

async function talkFlick(w: WorldCtx): Promise<void> {
  if (G.state.is('k5-weiter')) { await w.say('flick', 'Na los, Leseratte. Nach Süden, über die Felder. Der Wind steht gut.', { mood: 'smirk' }); return; }
  const kyra = w.actor('kyra');
  await w.cutscene(async () => {
    kyra.face('player');
    await lia('Und jetzt? Weiter als bis zu Kyra hab ich nie gedacht.');
    await w.say('flick', 'Zu den Rebellen. Wenn irgendwer weiß, was da eben aus dir rausgebrochen ist, dann die.', { mood: 'determined' });
    await w.say('kyra', 'Rebellen? Mit Lagerfeuer und Geheimzeichen? Ich bin dabei.', { mood: 'happy' });
    await lia('In Büchern ist die Geschichte aus, wenn man die Schwester gefunden hat.', 'sad');
    await w.say('kyra', 'Dann ist das eben ein dickes Buch. Du magst doch dicke Bücher.', { mood: 'happy' });
    await lia('Am Ofen. Nicht zu Fuß.');
    await w.say('flick', 'Bei den Rebellen sitzt man auf Wurzeln. Nur damit du’s weißt.', { mood: 'smirk' });
    await w.say('kyra', 'Und du kannst jetzt Riesen umpusten! Weißt du, wie schnell wir damit Holz hacken?', { mood: 'happy' });
    await w.say('flick', 'Und wer weiß. Mit euch zwei im Schlepptau lassen sie mich vielleicht doch noch ans Feuer.', { mood: 'happy' });
    await w.think('Die Rebellen. Elnon, der über meinen Kopf hinweg geredet hat. Alastir. Und Foltan, der mich angesehen und geschwiegen hat.');
    const pick = await w.choose([
      '„Ich kenne diese Rebellen. Ich trau ihnen nicht.“',
      '(Seufzen.) „Na gut. Aber ich lauf nicht vorneweg.“',
    ]);
    if (pick === 0) {
      await lia(G.state.is('k3-luege-bemerkt') ? 'Foltan wusste, wohin sie dich bringen. Seit dem Goldenen Eber. Ich hab’s ihm angesehen.' : 'Foltan wusste, wohin sie dich bringen. Und er hat kein Wort gesagt.', 'angry');
      await w.say('kyra', 'Wer ist Foltan? Soll ich ihm eine verpassen?', { mood: 'surprised' });
      await lia('Vielleicht. Ich erzähl’s dir unterwegs.');
      await w.say('flick', 'Dann gehen wir zu dritt hin. Und diesmal stellen wir die Fragen.', { mood: 'determined' });
    } else {
      await w.say('flick', 'Musst du nicht. Vorne lauf ich. Ich seh im Dunkeln besser als ihr zwei zusammen.', { mood: 'happy' });
    }
    await w.say('kyra', 'Wir drei. Eine leuchtet, eine schießt, und ich beiße. Über uns singen die Leute mal Lieder …', { mood: 'happy' });
    await lia('Mir reicht, dass du da bist. Der Rest kann warten.', 'happy');
    await w.say('kyra', 'Jetzt wird sie rührselig. Los, bevor sie heult.', { mood: 'happy' });
  });
  G.state.set('k5-weiter');
  w.completeObjective('k5-reden');
  for (const id of ['flick', 'kyra']) { w.despawn(id); w.companions.add(id); }
  w.setObjective('k5-aufbruch', 'Brich mit Kyra und Flick auf.', [650, 704]);
  G.checkpoint(); // k5-weiter: a reload resumes with the two as companions
}

async function scorchRing(w: WorldCtx): Promise<void> {
  w.fx.burst([640, 440], 'urmacht', 6);
  await w.think('Ein Kreis aus verbranntem Gras, so rund wie mit dem Zirkel gezogen. Und ich stand in der Mitte.');
  await w.think('Türkis, sagt Flick. Wie bei Alana. Nur dass Alana in einem Buch steht. Und ich hier.');
  G.state.addLore('k5-lore-tuerkis');
}

/** Worlds whose departure choice is currently open (the trigger may fire again while the dialogue runs). */
const departing = new WeakSet<WorldCtx>();

async function departure(w: WorldCtx): Promise<void> {
  if (departing.has(w)) return;
  departing.add(w);
  try {
    w.lockPlayer();
    // Saves that already reached the end of book one (k5-ende) skip the closing tableau and get the choice again.
    if (!G.state.is('k5-ende')) {
      G.state.set('k5-ende');
      ui().prefetchPlate('k5-aufbruch');
      await G.ui.fade('out', 900);
      await G.ui.plate('k5-aufbruch', { caption: 'Drei unter Crios', pan: 'in', durationMs: 22000 });
      await G.ui.fade('in', 900);
      await w.say('narrator', 'Sie gingen zu dritt über die nächtlichen Felder. Kyra redete, Flick horchte in den Wind. Im Westen stand Crios, wie immer.');
      await w.say('narrator', 'Ein treuer Gefährte, hatte Lia sich gewünscht. Jetzt hatte sie zwei.');
      await w.say('narrator', 'Und tief in Lia schlief etwas ~Türkises~. Es hatte Zeit.');
      await G.ui.closePlate();
      await G.ui.fade('out', 1000);
      G.audio.music('refuge', { fadeMs: 1500 });
      await G.ui.fade('in', 500);
      G.checkpoint(); // k5-ende: „Fortsetzen“ (also after the credits) offers the choice again without the tableau
    }
    const next = await w.choose([...bookOneEndChoices(), { text: 'Noch ein wenig am Feuer bleiben.' }]);
    if (next === 3) {
      await G.ui.fade('in', 300);
      restoreDepartureObjective(w);
      w.unlockPlayer();
      return;
    }
    w.completeObjective('k5-aufbruch');
    await G.ui.fade('out', 500);
    if (next === 1) { await G.goto('weiterreise'); return; }
    if (next === 2) { await continueToBook2(); return; }
    await showCredits();
    const m = await import('../../scenes/BootScene');
    await m.showTitle();
  } finally {
    departing.delete(w);
  }
}

/** Staying at the fire also reopens the goal in saves made before this choice kept it active. */
function restoreDepartureObjective(w: WorldCtx): void {
  const objective = G.state.data.objectives.find(o => o.id === 'k5-aufbruch');
  if (objective) objective.done = false;
  w.setObjective('k5-aufbruch', 'Brich mit Kyra und Flick auf.', [650, 704]);
}

/** The three ways out of book one: credits, optional travel, or the explicit continuation into Teil II. */
export function bookOneEndChoices(): ChoiceOption[] {
  const book2 = Boolean(findScene(BOOK2.entry));
  return [
    { text: 'Das erste Buch abschließen.' },
    { text: 'Mit Kyra und Flick weiterreisen.' },
    { text: 'Weiter zu den Rebellen: Teil II „Letzte Hoffnung“.', disabled: !book2, reason: book2 ? undefined : 'Noch nicht verfügbar.' },
  ];
}

export async function finaleScript(w: WorldCtx): Promise<void> {
  if (!G.state.is('k5-erwacht')) {
    await awakening(w);
    await w.changeMap(ruinenMap, 'sued', { fadeMs: 0 });
    await masterScene(w);
    await w.changeMap(lagerNachtMap, 'lager', { fadeMs: 0 });
    G.state.set('k5-erwacht');
    ambience(['night', 'crickets', 'fire'], { fire: 0.6 });
    G.audio.music('refuge', { fadeMs: 2000 });
    await afterwards(w);
    return;
  }
  if (G.state.is('k5-weiter')) {
    for (const id of ['flick', 'kyra']) { w.despawn(id); w.companions.add(id); }
    restoreDepartureObjective(w);
  } else w.setObjective('k5-reden', 'Sprich mit Kyra und Flick.', 'flick');
}
