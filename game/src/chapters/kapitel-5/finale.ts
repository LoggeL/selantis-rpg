// Kapitel V, Szene 5 „finale“ (order as in the film): Lia wakes with Kyra and Flick („Was ist passiert?“). Cut: Baris
// drags himself to the ruins, the Master steps out of black smoke („Du hast versagt, Baris. Du hattest von Anfang an
// die Falsche.“) and punishes him (violet magic, one half of his face burned, an eye lost; staged tastefully). Back to
// the three: Flick will take them to the rebels, Kyra is thrilled, Lia sighs and hesitates (Foltan). They walk off
// together under Crios. Book-style credits „Ende des ersten Buches“, then back to the title.
import { G } from '../../core/G';
import { defineMap, type MapDef, type WorldCtx } from '../../world';
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
    await w.say('kyra', 'Lia? Lia! Geht’s dir gut?', { mood: 'scared' });
    await G.ui.plate('k5-erwachen', { caption: 'Unter der Eiche', pan: 'in', durationMs: 30000 });
    await lia('Was … was ist passiert?', 'hurt');
    await w.say('flick', 'Na, wie’s aussieht, hast du sie in die Flucht geschlagen.', { mood: 'smirk' });
    await lia('Hab ich das?', 'surprised');
    await w.say('flick', 'Ja. Und das war zugegebenermaßen ziemlich beeindruckend.', { mood: 'happy' });
    await lia('Wieso? Was genau hab ich denn gemacht?', 'thinking');
    await w.say('kyra', 'Also, das war so …', { mood: 'happy' });
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
    await w.say('vamir', 'Du hast versagt, Baris.');
    await w.say('baris', 'Ja, Meister.');
    await w.say('vamir', 'Du hattest von Anfang an die Falsche.');
    await w.say('baris', 'Ja … Meister.');
    await w.say('vamir', 'Ich habe sie gespürt, heute Nacht. Die Urmacht. Sie stand vor dir, und du hast sie laufen lassen.');
    await G.ui.plate('k5-vamir', { caption: 'Der Meister', pan: 'in', durationMs: 14000 });
    await w.say('narrator', 'Der Meister hebt die Hand. Kaltes, violettes Licht kriecht über seine Finger.');
    sfx('magic', { volume: 1 });
    w.lighting.flash(VIOLET, 500);
    w.camera.shake(500, 0.006);
    sfx('hit-heavy', { volume: 0.7 });
    await w.say('narrator', 'Es brennt sich in Baris’ Gesicht. Er schreit nicht. Als das Licht erlischt, ist eine Hälfte seines Gesichts verbrannt, ein Auge erblindet.');
    await G.ui.closePlate();
    await w.say('k5-baris-scarred', 'Ja … Meister.', { mood: 'pained' });
    await w.say('vamir', 'Beim nächsten Mal bin ich nicht so nachsichtig.');
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
    if (G.state.is('k5-kyra-spaet-befreit')) await w.say('kyra', 'Flick hat mich losgeschnitten, als die Kerle weg waren. Und dich habe ich bis hierher getragen.', { mood: 'happy' });
    await w.say('kyra', '… und dann sind sie gerannt wie die Hasen! Sogar der Riese!', { mood: 'happy' });
    await lia('Ich weiß nicht, was das war. Ich weiß nur, dass ich Flick nicht verlieren wollte.', 'thinking');
    await w.say('flick', 'Sehr freundlich. Ich hatte die Lage übrigens völlig im Griff.', { mood: 'smirk' });
    await w.say('kyra', 'Klar. Am Boden liegend, mit einer Axt über dem Kopf.', { mood: 'happy' });
  });
  G.state.setParty(['flick', 'kyra']);
  w.setObjective('k5-reden', 'Sprich mit Kyra und Flick.', 'flick');
}

async function talkKyra(w: WorldCtx): Promise<void> {
  const beads = G.state.count('bead');
  if (beads > 0 && !G.state.is('k5-perlen-zurueck')) {
    G.state.set('k5-perlen-zurueck');
    await lia(beads >= 3 ? 'Hier. Die habe ich unterwegs gefunden. Alle drei.' : 'Hier. Die habe ich unterwegs gefunden.', 'happy');
    G.state.take('bead', beads);
    await w.say('kyra', 'Meine Perlen! Ich hab sie fallen lassen, damit du mich findest. Ich wusste, du kommst.', { mood: 'happy' });
    await lia('Und wenn nicht?', 'sad');
    await w.say('kyra', 'Dann hätte ich dem Riesen so lange auf die Nerven getan, bis er mich freiwillig gehen lässt.', { mood: 'happy' });
    G.state.addMemory('k5-mem-perlen');
    return;
  }
  if (G.state.has('ribbon') && !G.state.is('k5-band-zurueck')) {
    G.state.set('k5-band-zurueck');
    await lia('Und das hier lag im Stall vom Goldenen Eber.', 'happy');
    G.state.take('ribbon');
    await w.say('kyra', 'Mein Haarband! Du bist mir wirklich den ganzen Weg gefolgt …', { mood: 'sad' });
    return;
  }
  await w.say('kyra', 'Mutter und Vater … Ich habe die ganze Zeit an sie gedacht. Und an dich.', { mood: 'sad' });
  await lia('Ich habe ihnen Steine aufs Grab gelegt. Jedem einen Hügel.', 'sad');
  await w.say('kyra', 'Wir bringen ihnen Blumen. Wenn das alles vorbei ist.', { mood: 'determined' });
}

async function talkFlick(w: WorldCtx): Promise<void> {
  if (G.state.is('k5-weiter')) { await w.say('flick', 'Na los, Spurenleserin. Ab nach Süden, über die Felder.', { mood: 'smirk' }); return; }
  const kyra = w.actor('kyra');
  await w.cutscene(async () => {
    kyra.face('player');
    await lia('Und was machen wir jetzt?');
    await w.say('flick', 'Ich bringe euch zu den Rebellen. Die wissen bestimmt, was für eine Kraft in dir wohnt.', { mood: 'determined' });
    await w.say('kyra', 'Das klingt nach Abenteuer!', { mood: 'happy' });
    await lia('Oh nee. Ich dachte, das war’s.', 'sad');
    await w.say('kyra', 'Hey, das wird bestimmt spannend!', { mood: 'happy' });
    await lia('Wahnsinnig spannend.');
    await w.say('flick', 'Da muss ich ihr recht geben.', { mood: 'smirk' });
    await w.say('kyra', 'Lia, denk doch mal, was du mit deinen neuen Kräften alles anstellen kannst!', { mood: 'happy' });
    await w.say('flick', 'Und vielleicht nehmen mich die Rebellen jetzt auf. Mit euch beiden im Gepäck …', { mood: 'happy' });
    await w.think('Die Rebellen. Elnon, der über mich hinwegsah. Alastir. Und Foltan, der mir ins Gesicht gelogen hat.');
    const pick = await w.choose([
      '„Ich kenne diese Rebellen. Sie haben mich belogen.“',
      '(Seufzen.) „Na gut. Gehen wir.“',
    ]);
    if (pick === 0) {
      await lia(G.state.is('k3-luege-bemerkt') ? 'Foltan wusste von Anfang an, wohin sie Kyra gebracht haben. Ich hab’s gemerkt, schon im Eber.' : 'Foltan wusste, wohin sie Kyra gebracht haben. Und er hat geschwiegen.', 'angry');
      await w.say('kyra', 'Wer ist Foltan?', { mood: 'surprised' });
      await lia('Erzähl ich dir unterwegs.');
      await w.say('flick', 'Dann gehen wir eben zu dritt hin. Und lassen uns diesmal nicht abwimmeln.', { mood: 'determined' });
    } else {
      await w.say('flick', 'So gefällt mir das.', { mood: 'happy' });
    }
    await w.say('kyra', 'Wir sind so ein tolles Team, und überhaupt …', { mood: 'happy' });
    await lia('Kyra?');
    await w.say('kyra', 'Ja?', { mood: 'happy' });
    await lia('Beruhig dich mal.', 'happy');
  });
  G.state.set('k5-weiter');
  w.completeObjective('k5-reden');
  for (const id of ['flick', 'kyra']) { w.despawn(id); w.companions.add(id); }
  w.setObjective('k5-aufbruch', 'Brich mit Kyra und Flick auf.', [650, 704]);
}

async function scorchRing(w: WorldCtx): Promise<void> {
  w.fx.burst([640, 440], 'urmacht', 6);
  await w.think('Das Gras ist in einem perfekten Kreis versengt. Genau hier habe ich gestanden.');
  await w.think('Flick sagt, das Licht war türkis. Wie in den Geschichten über Alana.');
  G.state.addLore('k5-lore-tuerkis');
}

async function departure(w: WorldCtx): Promise<void> {
  if (G.state.is('k5-ende')) return;
  G.state.set('k5-ende');
  w.lockPlayer();
  G.state.complete('k5-aufbruch');
  ui().prefetchPlate('k5-aufbruch');
  await G.ui.fade('out', 900);
  await G.ui.plate('k5-aufbruch', { caption: 'Drei unter Crios', pan: 'in', durationMs: 22000 });
  await G.ui.fade('in', 900);
  await w.say('narrator', 'So zogen sie los, zu dritt, über die nächtlichen Felder. Über ihnen stand Crios, wie immer im Westen.');
  await w.say('narrator', 'Ein treuer Gefährte, hatte Lia sich gewünscht. Jetzt hatte sie zwei.');
  await w.say('narrator', 'Und tief in ihr schlief etwas, das ~türkis~ leuchtete und auf seine Stunde wartete.');
  await G.ui.closePlate();
  await G.ui.fade('out', 1000);
  G.audio.music('refuge', { fadeMs: 1500 });
  await G.ui.fade('in', 500);
  const next = await w.choose(['Das erste Buch abschließen.', 'Mit Kyra und Flick weiterreisen.']);
  await G.ui.fade('out', 500);
  if (next === 1) { await G.goto('weiterreise'); return; }
  await showCredits();
  const m = await import('../../scenes/BootScene');
  await m.showTitle();
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
    w.setObjective('k5-aufbruch', 'Brich mit Kyra und Flick auf.', [650, 704]);
  } else w.setObjective('k5-reden', 'Sprich mit Kyra und Flick.', 'flick');
}
