// Scene „e2-gefangene“ – Köder (docs/teil-2/umsetzung.md §3, F2 13:43–16:07). Captivity interlude, framed
// „Unterdessen …“: the player is Flick, chained to the iron ring in the Master's hall (a small walk area around it).
// Heart: watch what lies within the chain's reach – the loose ring in the floor (only while the key guard looks
// elsewhere), the key bunch on the patrolling guard's belt (catch him while he passes), Elnon kneeling next to her,
// the side door to the cells. Then the entrance: the Master scolds Baris for Lia's escape, Baris presents his
// prisoners as bait, Elnon provokes and is dragged off while Flick defends him (defiant choices), Baris mentions in
// passing that most rebels got away south, and the Master claims Lia carries something of his. Lia never learns any
// of this. → e2-urmacht.
import type { CharAnim } from '../../art/api';
import { G } from '../../core/G';
import { defineMap, startWorld, type ActorHandle, type MapDef, type WorldCtx } from '../../world';
import { bloodHit } from '../common/blood';
import { chainArea, HALLE_SPOT, halleBase, halleBrazierLights } from './gewoelbe';
import { bg, e2Scene, interlude, master, sfx, ui, VIOLET, nextScene } from './shared';

const SEEN = { ring: 'e2-gef-ring', keys: 'e2-gef-schluessel', elnon: 'e2-gef-elnon', door: 'e2-gef-tuer' } as const;
const PATROL_DONE = 'e2-gef-patrouille-aus';

const KEY_GUARD = 'waerter-schluessel';
/** The key guard's round: from the south arch along the chain's reach to the cell door and back. */
const PATROL: [number, number][] = [[262, 246], [380, 246], [470, 236], [522, 230], [556, 206], [548, 168]];

export const koederMap: MapDef = defineMap({
  ...halleBase,
  id: 'e2-halle-koeder',
  name: 'Die Halle des Meisters',
  walk: [chainArea()],
  spawns: { chained: { at: HALLE_SPOT.chained, dir: 'left' } },
  npcs: [{
    id: 'elnon', preset: 'e2-elnon-gefangen', speaker: 'e2-elnon', at: [464, 210], dir: 'right', idle: 'kneel',
    verb: 'Flüstern', talk: whisperElnon, facePlayer: false,
  }],
  interactables: [
    { id: 'ring', verb: 'An der Kette ziehen', at: HALLE_SPOT.ring, radius: 16, once: false, sparkle: true, onInteract: tugRing },
    { id: 'tuer', verb: 'Hinsehen', poly: [[560, 80], [590, 80], [590, 140], [560, 140]], radius: 66, once: false, onInteract: lookDoor },
  ],
  lights: halleBrazierLights(0.9),
  time: 'night',
  ambience: ['room', 'fire'],
  ambienceVolume: { room: 0.7, fire: 0.4 },
  music: 'dread',
  playerLight: 26,
  resetOnEnter: true,
});

// ---------------------------------------------------------------------------------------------------------------
// Observing within the chain's reach
// ---------------------------------------------------------------------------------------------------------------

function seenCount(): number {
  return Object.values(SEEN).filter(f => G.state.is(f)).length;
}

function updateObjective(w: WorldCtx): void {
  const n = seenCount();
  w.setObjective('e2-gef-beobachten', `Sieh dich um, so weit die Kette reicht: Ring, Wärter, Elnon, Tür (${n}/4).`, nextTarget());
}

function nextTarget(): string | [number, number] | null {
  if (!G.state.is(SEEN.ring)) return 'ring';
  if (!G.state.is(SEEN.elnon)) return 'elnon';
  if (!G.state.is(SEEN.door)) return 'tuer';
  if (!G.state.is(SEEN.keys)) return KEY_GUARD;
  return null;
}

function keyGuardNear(w: WorldCtx, dist = 100): boolean {
  const g = w.actor(KEY_GUARD);
  return g.exists && Math.hypot(g.x - w.player.x, g.y - w.player.y) < dist;
}

async function tugRing(w: WorldCtx): Promise<void> {
  if (G.state.is(SEEN.ring)) { await w.think('Der Ring wackelt immer noch. Nur nicht hinsehen, sonst sieht er es auch.'); return; }
  if (keyGuardNear(w)) {
    w.player.face(w.actor(KEY_GUARD).x < w.player.x ? 'left' : 'right');
    await w.think('Nicht, solange der mit dem Schlüssel herschaut. Ich zähl lieber Steine.');
    return;
  }
  bg(w.player.play('crouch' as never, { ms: 1400 }));
  sfx('chain', { volume: 0.6 });
  await w.wait(500);
  sfx('chain', { volume: 0.35 });
  await w.think('Ich ziehe, als wollte ich nur die Kette strecken. Der Ring sitzt in einem Stein, der Mörtel drumherum bröselt wie altes Brot.');
  await w.think('Er wackelt. Nicht genug. Noch nicht. Aber gut zu wissen, dass hier unten nicht alles so fest ist, wie es tut.');
  G.state.set(SEEN.ring);
  updateObjective(w);
}

async function whisperElnon(w: WorldCtx): Promise<void> {
  const elnon = w.actor('elnon');
  if (G.state.is(SEEN.elnon)) {
    await w.say('e2-elnon', 'Spar dir den Atem, Flick. Du wirst ihn noch brauchen.', { mood: 'grim' });
    return;
  }
  elnon.face('player');
  await w.say('e2-flick', 'Psst. Elnon. Lebst du noch, oder kniest du nur aus Gewohnheit?', { mood: 'smirk' });
  await w.say('e2-elnon', 'Beides. Sie haben Kyra nach unten gebracht. Sie hat einem in den Daumen gebissen, bevor die Tür zuging.', { mood: 'grim' });
  await w.say('e2-flick', 'Das ist unser Mädchen.', { mood: 'happy' });
  await w.say('e2-elnon', 'Hör zu. Was immer sie fragen: kein Wort über die andere. Nicht wohin, nicht was sie kann.', { mood: 'grim' });
  await w.say('e2-flick', 'Keine Sorge. Ich hab schon mal bei einem Eid die Hälfte weggelassen. Ich hab Übung.', { mood: 'smirk' });
  await w.wait(400);
  await w.say('e2-elnon', '… Diesmal ist das gut so.');
  elnon.face('right');
  G.state.set(SEEN.elnon);
  updateObjective(w);
}

async function lookDoor(w: WorldCtx): Promise<void> {
  if (G.state.is(SEEN.door)) { await w.think('Die Seitentür. Dahinter Stroh, Rost und Kyra.'); return; }
  w.player.face('right');
  await w.think('Die Seitentür. Von dort kam vorhin Kyras Gezeter, dann ein Riegel, dann nichts mehr.');
  await w.think('Kühle Luft unten durch den Spalt. Riecht nach Stroh, Rost und nassen Steinen. Zellen. Eine Treppe runter, schätze ich.');
  G.state.set(SEEN.door);
  updateObjective(w);
}

async function watchKeys(w: WorldCtx, guard: ActorHandle): Promise<void> {
  if (G.state.is(SEEN.keys)) { await w.think('Sieben Bärte. Der dritte glänzt. Ich vergess das nicht.'); return; }
  w.player.face(guard.x < w.player.x ? 'left' : 'right');
  await w.think('Der Bund hängt links am Gürtel, an einem Haken, nicht am Riemen. Wer schnell zugreift, kriegt ihn ab.');
  await w.think('Sieben Bärte. Einer ist blank gegriffen. Der für die Zellen, wette ich.');
  G.state.set(SEEN.keys);
  updateObjective(w);
}

/** The key guard walks his round until the entrance begins; when he passes close he can be watched. */
async function patrol(w: WorldCtx): Promise<void> {
  const g = w.actor(KEY_GUARD);
  let i = 0, step = 1;
  while (w.alive && !G.state.is(PATROL_DONE)) {
    i += step;
    if (i >= PATROL.length - 1 || i <= 0) step = -step;
    const [x, y] = PATROL[Math.max(0, Math.min(PATROL.length - 1, i))];
    await g.walkTo(x, y, { straight: true });
    if (i === PATROL.length - 1) { g.face('up'); await w.wait(1800); }
    else if (i === 0) { g.face('left'); await w.wait(3200); }
    else if (i === 3) { g.face('player'); await w.wait(900); }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The entrance: the Master, Baris and the bait
// ---------------------------------------------------------------------------------------------------------------

async function entrance(w: WorldCtx): Promise<void> {
  const keys = w.actor(KEY_GUARD), door = w.actor('waerter-tuer'), elnon = w.actor('elnon');
  G.state.set(PATROL_DONE);
  const baris = w.spawn({ id: 'baris', preset: 'baris-scarred', speaker: 'e2-baris', at: [320, 304], dir: 'up', solid: false, hidden: true, speed: 40 });
  const vamir = w.spawn({ id: 'meister', preset: 'vamir', speaker: master(), at: HALLE_SPOT.dais, dir: 'down', solid: false, hidden: true, speed: 30 });
  await w.cutscene(async () => {
    sfx('door', { volume: 0.6 });
    await w.wait(400);
    await keys.walkTo(HALLE_SPOT.guardSouthEast[0], HALLE_SPOT.guardSouthEast[1], { straight: true });
    keys.face('left');
    door.face('left');
    elnon.face('up');
    w.player.face('left');
    await w.think('Schritte auf der Treppe. Schwere. Einer zieht ein Bein nach.');
    baris.show();
    await baris.walkTo(320, 150, { straight: true });
    await w.camera.pan([320, 140], 900);
    G.audio.duck(-8, 6000);
    sfx('whoosh', { volume: 0.7 });
    w.fx.burst(HALLE_SPOT.dais, 'smoke', 16);
    const glow = w.lighting.add({ id: 'e2-meister', at: [320, 66], kind: 'plain', color: VIOLET, radius: 90, intensity: 0, always: true });
    void glow.fadeTo(0.8, 900);
    await w.wait(400);
    vamir.show();
    if (vamir.sprite) { vamir.sprite.setAlpha(0); w.scene.tweens.add({ targets: vamir.sprite, alpha: 1, duration: 900 }); }
    await w.wait(900);
    bg(baris.play('kneel'));
    baris.setIdle('kneel');
    await w.say(master(), 'Baris. Du kommst allein die Treppe herauf. Das ist nie ein gutes Zeichen.');
    await w.say('e2-baris', 'Meister, das Lager war voller Rebellen. Im Dunkeln, im Wald, wir hatten …', { mood: 'pained' });
    await w.say(master(), 'Du hattest sie auf Steinwurfweite. Zum zweiten Mal. Erzähl mir nichts von Wald.');
    await w.say('e2-baris', 'Wir haben mitgebracht, was ihr lieb ist. Die Spitzohrige dort. Die Schwester, unten eingesperrt. Sie beißt.');
    await w.say('e2-baris', 'Und den Anführer. Wer Freunde hat, kommt sie holen, Meister. Früher oder später.');
    await w.say(master(), 'Du wirfst mir drei Würmer vor die Füße und nennst es Angeln.');
    await w.say(master(), 'Steh auf und stell dich an die Wand. Du bist nicht entlassen. Nur unwichtig.');
    baris.setIdle('idle');
    await baris.walkTo(HALLE_SPOT.guardSouthWest[0] + 20, HALLE_SPOT.guardSouthWest[1] - 40, { straight: true });
    baris.face('player');
    await w.think('Halbes Gesicht verbrannt, ein Auge milchig. Und das andere sieht mich an, als wär ich schuld daran.');

    await w.camera.pan([440, 190], 900);
    await vamir.walkPath([[320, 122], [396, 178], [420, 200]], { straight: true });
    vamir.face('elnon');
    await w.say(master(), 'Und das hier kniet, als hätte es Übung darin.');
    await w.say('e2-baris', 'Elnon, Meister. Er führt die Rebellen. Führte.');
    await w.say(master(), 'Die Freien wählen sich einen Anführer, der sich fangen lässt. Das erklärt vieles.');
    elnon.face('meister');
    await w.say('e2-elnon', 'In Ebaril haben deine Männer auch große Reden gehalten. Vor Häusern, die sie selbst angezündet hatten.', { mood: 'angry' });
    await w.say('e2-elnon', 'Mutig waren sie nur aus sicherer Entfernung. Wie du.', { mood: 'angry' });
    await w.say(master(), 'Wie laut er ist. Bringt ihn mir aus den Ohren.');
    await door.walkTo(476, 222, { straight: true });
    door.face('elnon');
    sfx('swing', { volume: 0.5 });
    bg(door.play('attack', { ms: 450 }));
    await w.wait(160);
    sfx('hit-heavy', { volume: 0.6 });
    bloodHit(w, [elnon.x, elnon.y - 24], 0.8);
    bg(elnon.play('hurt' as CharAnim, { ms: 800 }));
    w.player.bark('Elnon!', 1200);
    await w.wait(900);
    w.fx.burst([elnon.x - 4, elnon.y - 8], 'blood', 5);
    await w.say('narrator', 'Der Knüppel trifft Elnon am Mund. Er spuckt Blut auf den Stein und hebt trotzdem den Kopf.');
    elnon.face('up');
    await w.wait(300);
  });
  await defendElnon(w);
  await w.cutscene(async () => {
    elnon.setIdle('idle');
    await Promise.all([
      elnon.walkTo(HALLE_SPOT.doorCells[0], HALLE_SPOT.doorCells[1], { straight: true }),
      door.walkTo(HALLE_SPOT.doorCells[0] - 18, HALLE_SPOT.doorCells[1] + 8, { straight: true }),
    ]);
    sfx('door', { volume: 0.5 });
    w.despawn('elnon');
    await door.walkTo(HALLE_SPOT.guardCells[0], HALLE_SPOT.guardCells[1], { straight: true });
    door.face('left');
    w.player.face('left');
    await w.say(master(), 'Und die übrigen Rebellen, Baris? Auch alle so gesprächig?');
    await w.say('e2-baris', 'Die meisten sind nach Süden durch. Wir hatten nur Augen für … für das Mädchen.', { mood: 'pained' });
    await w.say(master(), 'Sollen sie laufen. Keiner von ihnen trägt, was ich will.');
    vamir.face('player');
    await vamir.walkTo(452, 200, { straight: true });
    await w.camera.zoom(1.25, 900);
  });
  await claim(w);
  await w.cutscene(async () => {
    await w.say(master(), 'Ich frage nicht gern zweimal. Beim dritten Mal frage ich mit Werkzeug.');
    await w.say(master(), 'Bringt sie zu den anderen. Sie soll eine Nacht darüber schlafen. Schlecht, hoffentlich.');
    sfx('whoosh', { volume: 0.6 });
    w.fx.burst([vamir.x, vamir.y - 20], 'smoke', 14);
    if (vamir.sprite) w.scene.tweens.add({ targets: vamir.sprite, alpha: 0, duration: 700 });
    await w.lighting.get('e2-meister').fadeTo(0, 800);
    vamir.hide();
    await keys.walkTo(w.player.x - 22, w.player.y + 14, { straight: true });
    keys.face('player');
    sfx('chain', { volume: 0.7 });
    await w.wait(500);
    await G.ui.fade('out', 1200);
  });
}

async function defendElnon(w: WorldCtx): Promise<void> {
  await w.cutscene(async () => {
    await w.think('Elnon, du sturer Klotz. Du hast mich vor allen eine Lügnerin genannt. Und trotzdem …');
    const pick = await w.choose([
      '„Lass ihn. Wer sein Gesicht unter einer Kapuze versteckt, sollte über keinen lachen.“',
      '„Er ist ein sturer Klotz. Aber unser Klotz. Finger weg.“',
      '„Wenn du jemanden zum Anschreien brauchst: Ich bin lauter.“',
    ]);
    G.state.set('e2-gef-ton', ['kapuze', 'klotz', 'lauter'][pick]);
    if (pick === 0) {
      await w.say('e2-flick', 'Lass ihn. Wer sein Gesicht unter einer Kapuze versteckt, sollte über keinen lachen.', { mood: 'angry' });
      await w.say(master(), 'Mein Gesicht geht dich nichts an. Du wirst es früh genug sehen. Oder nie.');
    } else if (pick === 1) {
      await w.say('e2-flick', 'Er ist ein sturer Klotz. Aber unser Klotz. Finger weg.', { mood: 'determined' });
      await w.say('e2-elnon', '… Halt dich da raus, Flick.', { mood: 'grim' });
      await w.think('Gern geschehen, Klotz.');
    } else {
      await w.say('e2-flick', 'Wenn du jemanden zum Anschreien brauchst: Ich bin lauter. Und ich halte länger durch.', { mood: 'smirk' });
      await w.say(master(), 'Das werden wir prüfen. Später. Gründlich.');
    }
    await w.say(master(), 'Rührend. Gefangene, die einander verteidigen. Das hält meistens bis zum zweiten Tag.');
  });
}

async function claim(w: WorldCtx): Promise<void> {
  await w.cutscene(async () => {
    await w.say(master(), 'Und nun zu dir. Ohne Bogen siehst du kleiner aus als in Baris’ Geschichten.');
    await w.say(master(), 'Dein Mädchen mit dem Licht hat sich an meinem Eigentum vergriffen. Ich hole es mir. So oder so.');
    await w.think('Das Licht im Gras. Der Riese, der davonflog. Das meint er.');
    const pick = await w.choose([
      '„Was sie hat, hatte sie vor dir. Und sie behält es.“',
      '„Dann frag sie doch selbst. Ach nein, sie ist euch ja weggelaufen. Zweimal.“',
      '(Schweigen. Und grinsen.)',
    ]);
    if (pick === 0) {
      await w.say('e2-flick', 'Was sie hat, hatte sie vor dir. Und sie behält es.', { mood: 'determined' });
      await w.say(master(), 'Vor mir? Kind, es war schon meins, bevor es sie gab.');
    } else if (pick === 1) {
      await w.say('e2-flick', 'Dann frag sie doch selbst. Ach nein, sie ist euch ja weggelaufen. Zweimal.', { mood: 'smirk' });
      await w.say('e2-baris', 'Halt dein Maul, Spitzohr.', { mood: 'pained' });
      await w.say(master(), 'Lass sie, Baris. Sie hat ja recht. Das ist das Ärgerliche daran.');
    } else {
      await w.wait(900);
      await w.say(master(), 'Ein Grinsen. Wie mutig. Das hält erfahrungsgemäß nicht lange.');
    }
  });
}

// ---------------------------------------------------------------------------------------------------------------

async function koederScript(w: WorldCtx): Promise<void> {
  for (const f of [...Object.values(SEEN), PATROL_DONE]) G.state.set(f, false);
  G.state.set('e2-gef-ton', false);
  const keys = w.spawn({
    id: KEY_GUARD, preset: 'shadow-sword', speaker: 'e2-waerterin', at: PATROL[0], dir: 'right', solid: false, speed: 34,
    verb: 'Beobachten', facePlayer: false, talk: (ww, npc) => watchKeys(ww, npc),
    barks: ['Hübsch stillsitzen.', 'Was glotzt du?', 'Kette ist kurz, Spitzohr.'], barkEvery: 9000,
  });
  keys.hold(true);
  const door = w.spawn({ id: 'waerter-tuer', preset: 'shadow-club', speaker: 'e2-waerter', at: HALLE_SPOT.guardCells, dir: 'down', solid: false });
  door.hold(true);
  w.actor('elnon').setIdle('kneel');
  w.player.face('left');
  await ui().fade('in', 900);
  await w.cutscene(async () => {
    await w.wait(500);
    sfx('chain', { volume: 0.5 });
    await w.think('Eisen um die Handgelenke, eine Kette zum Boden. Lang genug zum Aufstehen. Zu kurz für alles andere.');
    await w.think('Bogen weg, Messer weg. Bleibt, was ich immer hab: Augen.');
  });
  bg(patrol(w));
  updateObjective(w);
  while (w.alive && seenCount() < 4) await w.wait(250);
  w.completeObjective('e2-gef-beobachten');
  await w.wait(600);
  await entrance(w);
  G.state.set('e2-gefangene-done');
  G.state.set('e2-flick-sah-ring');
  await nextScene('e2-urmacht');
}

export const scene = e2Scene('e2-gefangene', 'Köder', async () => {
  await interlude('Unterdessen, in den Gewölben des Meisters …');
  await startWorld({ map: koederMap, spawn: 'chained', player: 'e2-flick-gefangen', companions: [], script: koederScript });
});
