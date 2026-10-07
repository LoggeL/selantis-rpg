// Scene „e2-kontrolle“ – Das neue Spielzeug (docs/teil-2/umsetzung.md §3, F2 35:35–38:08; quellenpruefung.md §3).
// Captivity interlude, the player is Elnon, chained to the iron ring in the Master's hall and kneeling. Vamir rages
// at the wardens and Baris over Flick's escape (he found the missing nail in his own chair), then has Kyra brought
// and picks her because her mind is the easiest door. Heart (no rescue branch): Elnon tries to reach Kyra – her
// name, her sister, the farm, and the chain itself; every attempt breaks on the control, she answers with a stranger's
// calm and calls Vamir „Meister“. A warden hands her his sword; plate e2-kontrolle; the strike is shown in the
// picture (no cut away): the thrust, a red flash and blood, Elnon's last breath, his body on the stones in a spreading
// pool. Baris confirms his death; Vamir's line about his new favourite plaything is our own wording. Elnon is dead
// (the player witnesses it, Lia never learns of it). Sets e2-kyra-controlled and e2-elnon-struck. → e2-aufbruch.
import type { CharAnim } from '../../art/api';
import { G } from '../../core/G';
import { defineMap, startWorld, type MapDef, type WorldCtx } from '../../world';
import { bloodHit, bloodPool, preloadBlood } from '../common/blood';
import { chainArea, HALLE_SPOT, halleBase, halleBrazierLights, pinPlayer } from './gewoelbe';
import { bg, e2Scene, interlude, master, sfx, ui, until, VIOLET, nextScene } from './shared';

/** Flags of this visit (reset when the scene starts; a reload restarts the scene). */
const F = { heart: 'e2-ko-herz', tried: 'e2-ko-versuche', ring: 'e2-ko-kette' } as const;
/** Kept result: Elnon's last words to Kyra. */
export const KO_RESULT = { last: 'e2-kontrolle-letztes' } as const;

const APPROACHES = [
  { id: 'name', text: '„Kyra! Sieh mich an. Du heißt Kyra.“' },
  { id: 'lia', text: '„Denk an Lia. Deine Schwester sucht dich.“' },
  { id: 'hof', text: '„Erzähl mir vom Hof. Von euren Schweinen.“' },
] as const;
type ApproachId = typeof APPROACHES[number]['id'];

/** Where Kyra stands: within the chain's reach of Elnon's voice, not of his hands. */
const KYRA_AT: [number, number] = [472, 214];
const KEY = 'waerter-schluessel';
const CLUB = 'waerter-knueppel';

export const kontrolleMap: MapDef = defineMap({
  ...halleBase,
  id: 'e2-halle-kontrolle',
  name: 'Die Halle des Meisters',
  walk: [chainArea()],
  spawns: { chained: { at: HALLE_SPOT.chained, dir: 'left' } },
  interactables: [
    { id: 'ring', verb: 'An der Kette zerren', at: HALLE_SPOT.ring, radius: 16, once: true, removeOnUse: true, when: () => G.state.is(F.heart), onInteract: tugChain },
  ],
  lights: halleBrazierLights(1),
  time: 'night',
  ambience: ['room', 'fire'],
  ambienceVolume: { room: 0.7, fire: 0.5 },
  music: 'dread',
  playerLight: 26,
  resetOnEnter: true,
});

// ---------------------------------------------------------------------------------------------------------------

function tried(): ApproachId[] {
  const v = G.state.flag<string>(F.tried);
  return typeof v === 'string' && v ? v.split(',') as ApproachId[] : [];
}

function violetPulse(w: WorldCtx, strength = 1): void {
  const light = w.lighting.get('e2-kyra-bann');
  bg(light.fadeTo(1.3 * strength, 220).then(() => light.fadeTo(0.7, 600)));
  sfx('magic', { volume: 0.35, pitch: 0.6 });
}

async function reachKyra(w: WorldCtx): Promise<void> {
  if (!G.state.is(F.heart)) return;
  const done = tried();
  if (done.length >= APPROACHES.length) { await w.think('Da ist nichts mehr, wo ich anklopfen kann. Nur noch er.'); return; }
  const vamir = w.actor('meister');
  await w.cutscene(async () => {
    const pick = await w.choose(APPROACHES.map(a => ({ text: a.text, disabled: done.includes(a.id), reason: 'Schon versucht.' })));
    const id = APPROACHES[pick].id;
    if (id === 'name') {
      await w.say('e2-elnon', 'Kyra! Sieh mich an. Du heißt Kyra, und du beißt jeden, der dir zu nahe kommt.', { mood: 'determined' });
      violetPulse(w);
      await w.say('e2-kyra-gebannt', 'Ich sehe dich. Du bist laut. Der Meister mag es nicht, wenn man laut ist.', { mood: 'cold' });
      await w.say(master(), 'Namen. Als wäre ein Name eine Tür, durch die man einfach wieder hinausgeht.');
    } else if (id === 'lia') {
      await w.say('e2-elnon', 'Denk an Lia. Deine Schwester sucht dich. Sie hat dich schon einmal da rausgeholt.', { mood: 'determined' });
      const light = w.lighting.get('e2-kyra-bann');
      await light.fadeTo(0.15, 500);
      await w.say('e2-kyra-gebannt', 'Lia …', { mood: 'struggle' });
      await w.wait(500);
      violetPulse(w, 1.4);
      await w.say('e2-kyra-gebannt', 'Lia ist weit weg. Der Meister ist hier.', { mood: 'cold' });
      vamir.face('player');
      await w.say(master(), 'Oh, das hat gezuckt. Hast du’s gesehen? Ein Fünkchen. Und schon ist es wieder still.');
    } else {
      await w.say('e2-elnon', 'Der Hof, Kyra. Die Schweine. Du hast die halbe Nacht von ihnen erzählt. Ich kenne jedes beim Namen.', { mood: 'grim' });
      violetPulse(w);
      await w.say('e2-kyra-gebannt', 'Ich habe keinen Hof. Ich hatte nie einen. Ich habe den Meister.', { mood: 'cold' });
      await w.say(master(), 'Ich räume gründlich auf, wenn ich irgendwo einziehe. Alte Möbel, alte Tiere. Alles raus.');
    }
    G.state.set(F.tried, [...done, id].join(','));
  });
  const n = tried().length;
  if (n < APPROACHES.length) w.setObjective('e2-ko-kyra', `Ruf Kyra zurück. Mit allem, was du hast (${n}/3).`, 'kyra');
}

async function tugChain(w: WorldCtx): Promise<void> {
  const baris = w.actor('baris');
  sfx('chain', { volume: 0.7 });
  w.camera.shake(120, 0.002);
  if (G.state.is(F.ring)) { await w.think('Er hält. Und Baris’ Stiefel steht noch drauf.'); return; }
  G.state.set(F.ring);
  await w.cutscene(async () => {
    await w.think('Der Ring im Boden wackelt. Flick hatte recht. Er wackelt – und hält.');
    await baris.walkTo(HALLE_SPOT.ring[0] - 30, HALLE_SPOT.ring[1] + 22, { straight: true });
    sfx('thud', { volume: 0.5 });
    await w.say('e2-baris', 'Hiergeblieben, Elf. Du darfst zusehen. Mehr nicht.', { mood: 'pained' });
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Story beats
// ---------------------------------------------------------------------------------------------------------------

async function rage(w: WorldCtx): Promise<void> {
  const key = w.actor(KEY), club = w.actor(CLUB), baris = w.actor('baris'), vamir = w.actor('meister');
  await w.cutscene(async () => {
    await w.camera.pan([320, 140], 0);
    await ui().fade('in', 900);
    sfx('whoosh', { volume: 0.5 });
    G.audio.duck(-8, 5000);
    await w.say(master(), 'Eine Gefangene. Angekettet, ohne Bogen, ohne Messer. Und sie geht an euch vorbei wie an zwei Zaunpfählen.');
    await w.say('e2-waerterin', 'Meister, sie hatte auf einmal eine Hand frei, keiner weiß, wie …');
    await w.say(master(), 'Ich weiß es. In meinem Verhörstuhl fehlt ein Nagel. Mein eigener Stuhl hat ihr den Schlüssel geschnitzt.');
    w.lighting.flash(VIOLET, 300);
    sfx('magic', { volume: 0.5, pitch: 0.5 });
    bg(key.play('hit', { ms: 500 }));
    bg(club.play('hit', { ms: 500 }));
    await w.say(master(), 'Ihr zwei bewacht ab heute ihre Zelle. Die leere. Tag und Nacht. Damit ihr seht, wie das aussieht.');
    baris.face('meister');
    await w.say('e2-baris', 'Meister, meine Männer kämmen den Wald. Sie ist zu Fuß. Weit kommt sie nicht.', { mood: 'pained' });
    await w.say(master(), 'Zu Fuß war auch das Mädchen mit dem Licht. Zweimal, Baris. Ich zähle mit.');
    await w.say(master(), 'Genug. Wenn mir schon ein Vogel entwischt ist, will ich wenigstens den anderen singen hören. Bringt die Schwester.');
    key.setIdle('idle'); club.setIdle('idle');
    await Promise.all([
      key.walkTo(HALLE_SPOT.doorCells[0], HALLE_SPOT.doorCells[1], { straight: true }),
      club.walkTo(HALLE_SPOT.doorCells[0] - 12, HALLE_SPOT.doorCells[1] + 10, { straight: true }),
    ]);
    sfx('door', { volume: 0.5 });
    key.hide(); club.hide();
    await w.camera.pan([430, 180], 900);
    await vamir.walkPath([[320, 122], [400, 170], [430, 196]], { straight: true });
    vamir.face('player');
    await w.say(master(), 'Und der Anführer kniet in der ersten Reihe. Du sollst ja auch etwas lernen heute.');
  });
}

async function kyraBrought(w: WorldCtx): Promise<void> {
  const key = w.actor(KEY), club = w.actor(CLUB), vamir = w.actor('meister');
  const kyra = w.spawn({
    id: 'kyra', preset: 'kyra-bound', speaker: 'e2-kyra-gebannt', at: HALLE_SPOT.doorCells, dir: 'left', solid: false, hidden: true, speed: 30,
    verb: 'Zu ihr durchdringen', facePlayer: false, talk: ww => reachKyra(ww),
  });
  kyra.hold(true);
  await w.cutscene(async () => {
    sfx('door', { volume: 0.6 });
    key.show(); club.show(); kyra.show();
    await Promise.all([
      kyra.walkTo(KYRA_AT[0], KYRA_AT[1], { straight: true }),
      key.walkTo(KYRA_AT[0] + 34, KYRA_AT[1] + 20, { straight: true }),
      club.walkTo(KYRA_AT[0] - 30, KYRA_AT[1] + 24, { straight: true }),
    ]);
    kyra.face('meister');
    await w.say('e2-kyra-bound', 'Schon wieder du. Ich hab dir gestern nichts gesagt, ich sag dir heute nichts.', { mood: 'hurt' });
    await w.say(master(), 'Sieh nur, wie sie zittert. Und trotzdem reckt sie das Kinn. Wie rührend.');
    await w.say('e2-elnon', 'Lass sie. Wenn du einen Kopf zum Aufbrechen brauchst, nimm meinen.', { mood: 'angry' });
    vamir.face('player');
    await w.say(master(), 'Deinen? Da müsste ich mich durch Jahrzehnte Starrsinn graben. Ich klopfe lieber dort, wo die Tür schon wackelt.');
    await w.say('e2-elnon', 'Sie hat seit Nächten nicht geschlafen. Das ist keine Kunst. Das ist Feigheit.', { mood: 'angry' });
    await w.say(master(), 'Feigheit? Nein. Sparsamkeit.');
    vamir.face('kyra');
    G.audio.duck(-12, 6000);
    bg(vamir.play('cast', { ms: 3200 }));
    const glow = w.lighting.add({ id: 'e2-kyra-bann', at: [KYRA_AT[0], KYRA_AT[1] - 26], kind: 'plain', color: VIOLET, radius: 46, intensity: 0, always: true });
    sfx('magic', { volume: 0.6, pitch: 0.5 });
    await glow.fadeTo(1.2, 1400);
    bg(kyra.play('hit', { ms: 600 }));
    await w.say('e2-kyra-bound', 'Raus … raus aus meinem …', { mood: 'pained' });
    sfx('heartbeat', { volume: 0.6 });
    await w.camera.zoom(1.35, 1200);
    await w.wait(900);
    await glow.fadeTo(0.7, 900);
    kyra.face('meister');
    await w.wait(600);
    sfx('rope-cut', { volume: 0.4 });
    await w.say('narrator', 'Ein Wärter schneidet ihr die Stricke durch. Kyra rührt sich nicht. Sie reibt sich nicht einmal die Handgelenke.');
    await w.say('e2-kyra-gebannt', 'Meister.', { mood: 'devoted' });
    await w.say(master(), 'Siehst du, Anführer? Es ging schneller, als du dachtest.');
    kyra.face('player');
  });
}

async function theSword(w: WorldCtx): Promise<void> {
  const key = w.actor(KEY), kyra = w.actor('kyra'), vamir = w.actor('meister');
  ui().prefetchPlate('e2-kontrolle');
  await w.cutscene(async () => {
    await w.say(master(), 'Genug geplaudert. Jetzt zeige ich dir, auf wessen Stimme sie hört.');
    vamir.face(KEY);
    await w.say(master(), 'Du. Deine Klinge. Gib sie ihr.');
    await w.say('e2-waerterin', 'Meister … der Kleinen?');
    await w.say(master(), 'Heute ist dir schon eine Gefangene abhandengekommen. Soll ich dich gleich mit dazuzählen?');
    await key.walkTo(KYRA_AT[0] + 16, KYRA_AT[1] + 6, { straight: true });
    sfx('sword-draw', { volume: 0.7 });
    kyra.setLook('e2-kyra-gebannt');
    await key.walkTo(HALLE_SPOT.guardCells[0], HALLE_SPOT.guardCells[1], { straight: true });
    key.face('left');
    await vamir.walkTo(KYRA_AT[0] - 18, KYRA_AT[1] - 8, { straight: true });
    await G.ui.plate('e2-kontrolle', { caption: 'In der Halle des Meisters', pan: 'in', durationMs: 26000 });
    await w.say(master(), 'Dieser Mann hat dich angeschrien, Kind. Er stört. Sorg dafür, dass er nie wieder stört.');
    const pick = await w.choose([
      '„Kyra. Ich bin dir nicht böse. Was immer jetzt passiert.“',
      '„Wehr dich! Nur einen Atemzug lang!“',
      '(Ihr in die Augen sehen. Und schweigen.)',
    ]);
    G.state.set(KO_RESULT.last, ['nicht-boese', 'wehr-dich', 'schweigen'][pick]);
    if (pick === 0) await w.say('e2-elnon', 'Kyra. Ich bin dir nicht böse. Was immer jetzt passiert. Das bist nicht du.', { mood: 'grim' });
    else if (pick === 1) await w.say('e2-elnon', 'Wehr dich! Nur einen Atemzug lang! Mehr brauchst du nicht!', { mood: 'determined' });
    else { await w.wait(1400); await w.say('narrator', 'Elnon sieht ihr in die Augen. Darin ist kein Hof, kein Stroh, keine Schwester. Nur kaltes Violett.'); }
    await w.say('e2-kyra-gebannt', 'Ja, Meister.', { mood: 'devoted' });
    await G.ui.closePlate();
  });
}

/** Elnon's last words, shaped by what he said to her before the order (KO_RESULT.last). */
function lastWords(): string | null {
  const last = G.state.flag<string>(KO_RESULT.last);
  if (last === 'nicht-boese') return 'Nicht … du. Das … warst nicht …';
  if (last === 'wehr-dich') return 'Kyra … wehr … dich …';
  return null;
}

async function theStrike(w: WorldCtx): Promise<void> {
  const kyra = w.actor('kyra'), vamir = w.actor('meister'), baris = w.actor('baris');
  const key = w.actor(KEY), club = w.actor(CLUB);
  await w.cutscene(async () => {
    await w.camera.pan([486, 196], 500);
    await w.camera.zoom(1.6, 600);
    void w.lighting.get('becken-west').fadeTo(0.55, 800);
    void w.lighting.get('becken-ost').fadeTo(0.55, 800);
    sfx('heartbeat', { volume: 0.7 });
    await kyra.walkTo(w.player.x - 20, w.player.y + 4, { straight: true });
    kyra.face('player');
    w.lighting.get('e2-kyra-bann').set({ at: [kyra.x, kyra.y - 26] });
    await w.wait(500);
    await w.think('Ihre Hände zittern nicht. Meine schon.');
    // The thrust, in the picture: no cut away.
    sfx('swing', { volume: 0.6, pitch: 0.8 });
    bg(kyra.play('attack', { ms: 700 }));
    await w.wait(180);
    sfx('hit-heavy', { volume: 0.85, pitch: 0.75 });
    bloodHit(w, [w.player.x, w.player.y - 18], 1.4);
    w.camera.punch(0.1);
    bg(w.player.play('hurt' as CharAnim, { ms: 1400 }));
    sfx('chain', { volume: 0.7, pitch: 0.7 });
    G.audio.duck(-14, 7000);
    await w.wait(1200);
    w.fx.burst([w.player.x - 4, w.player.y - 10], 'blood', 8);
    const words = lastWords();
    if (words) await w.say('e2-elnon', words, { mood: 'pained' });
    else await w.say('narrator', 'Elnon sagt nichts. Er sieht sie nur an, bis er es nicht mehr kann.');
    sfx('fall', { volume: 0.6 });
    await w.player.play('fall', { ms: 600 });
    w.player.setIdle('lie');
    sfx('thud', { volume: 0.55 });
    sfx('chain', { volume: 0.5, pitch: 0.5 });
    bloodPool(w, [w.player.x, w.player.y - 4], { id: 'elnon-blut', scale: 1.35, ms: 5000 });
    await w.wait(1600);
    await w.say('narrator', 'Die Kette klirrt noch einmal. Dann liegt sie still, wie er.');
    // For one breath Kyra herself looks out of her eyes – and the Master closes the door again.
    const bann = w.lighting.get('e2-kyra-bann');
    await bann.fadeTo(0.2, 400);
    await w.say('e2-kyra-gebannt', 'Elnon …? Warum ist da so viel … Was hab ich …', { mood: 'struggle' });
    vamir.face('kyra');
    bg(vamir.play('cast', { ms: 900 }));
    violetPulse(w, 1.5);
    await w.say(master(), 'Still, Kind. Da ist nichts. Sieh mich an.');
    await w.say('e2-kyra-gebannt', 'Da ist nichts.', { mood: 'cold' });

    // Wider shot: the body in its blood, Kyra above it with the sword, the Master coming closer.
    await Promise.all([w.camera.zoom(1.3, 1200), w.camera.pan([440, 190], 1200)]);
    await vamir.walkTo(KYRA_AT[0] - 30, KYRA_AT[1] - 14, { straight: true });
    vamir.face('player');
    await w.say(master(), 'Kein Zögern. Kein Zittern. Habt ihr das gesehen? So sieht Gehorsam aus, wenn man ihn richtig anfasst.');
    kyra.face('meister');
    await w.say('e2-kyra-gebannt', 'Wie Ihr befehlt, Meister.', { mood: 'devoted' });
    baris.face('player');
    await baris.walkTo(w.player.x + 24, w.player.y + 10, { straight: true });
    bg(baris.play('kneel', { ms: 1800 }));
    await w.wait(1200);
    await w.say('e2-baris', 'Tot, Meister. Ein Stich, glatt durch. Die Kleine hat dabei nicht mal geblinzelt.', { mood: 'pained' });
    baris.face('kyra');
    await w.say('e2-baris', 'Gestern hat sie mir noch in die Hand gebissen. Und jetzt das.', { mood: 'pained' });
    await w.say(master(), 'Alte Spielsachen gehen kaputt, Baris. Diese hier nicht. Ich glaube, die behalte ich. Sie ist mir schon jetzt die liebste.');
    await w.say(master(), 'Gib ihr ein Tuch für die Klinge. Und schafft ihn hinaus. Dann findet mir die Spitzohrige.');
    key.face('player'); club.face('player');
    sfx('magic', { volume: 0.4, pitch: 0.45 });
    await w.lighting.get('e2-kyra-bann').fadeTo(1.3, 800);
    await ui().fade('out', 1600, '#0b0712');
  });
  await G.ui.narrate([
    'Elnon, der Anführer der Freien, starb in Ketten auf den Steinen der Halle. Durch Kyras Hand, auf Befehl des Meisters.',
    'Lia erfuhr nichts davon.',
  ], { style: 'card' });
}

async function kontrolleScript(w: WorldCtx): Promise<void> {
  for (const f of Object.values(F)) G.state.set(f, false);
  G.state.set(KO_RESULT.last, false);
  preloadBlood(w);
  const vamir = w.spawn({ id: 'meister', preset: 'vamir', speaker: master(), at: HALLE_SPOT.dais, dir: 'down', solid: false, speed: 30 });
  const baris = w.spawn({ id: 'baris', preset: 'baris-scarred', speaker: 'e2-baris', at: [HALLE_SPOT.daisFoot[0] - 70, HALLE_SPOT.daisFoot[1] + 10], dir: 'up', solid: false, speed: 40 });
  const key = w.spawn({ id: KEY, preset: 'shadow-sword', speaker: 'e2-waerterin', at: [HALLE_SPOT.daisFoot[0] - 16, HALLE_SPOT.daisFoot[1] + 16], dir: 'up', idle: 'kneel', solid: false, speed: 40 });
  const club = w.spawn({ id: CLUB, preset: 'shadow-club', speaker: 'e2-waerter', at: [HALLE_SPOT.daisFoot[0] + 16, HALLE_SPOT.daisFoot[1] + 16], dir: 'up', idle: 'kneel', solid: false, speed: 40 });
  for (const a of [vamir, baris, key, club]) a.hold(true);
  pinPlayer(w, 'kneel', 'left');
  await rage(w);
  await kyraBrought(w);
  G.state.set(F.heart);
  w.setObjective('e2-ko-kyra', 'Ruf Kyra zurück. Mit allem, was du hast (0/3).', 'kyra');
  await until(w, () => tried().length >= APPROACHES.length && !G.ui.busy());
  G.state.set(F.heart, false);
  w.completeObjective('e2-ko-kyra');
  await theSword(w);
  await theStrike(w);
  G.state.set('e2-kyra-controlled');
  G.state.set('e2-elnon-struck');
  await nextScene('e2-aufbruch');
}

export const scene = e2Scene('e2-kontrolle', 'Das neue Spielzeug', async () => {
  await interlude('Unterdessen, in der Halle des Meisters …');
  await startWorld({ map: kontrolleMap, spawn: 'chained', player: 'e2-elnon-gefangen', companions: [], fadeIn: false, script: kontrolleScript });
});
