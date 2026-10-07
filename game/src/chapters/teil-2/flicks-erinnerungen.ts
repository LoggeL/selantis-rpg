// Scene „e2-flicks-erinnerungen“ – Fremde Hände im Kopf (docs/teil-2/umsetzung.md §3, quellenpruefung §2,
// F2 22:05–24:08). Captivity interlude: Flick on the chair again; the Master pushes into her memories (cold violet).
// The memory plate e2-erinnerung is visibly framed as what HE describes (his words, never narration): a burning
// city, prisoners in a row, one of his men, a woman Flick is bound to – unnamed, no relation, no detail of her
// fate. Flick demands he leave her head. Heart: inner resistance – first what she fills her head with (choice), then
// she hides the forest memory of Lia from his searching gaze (stealthGame 'cover'; mistakes only repeat the beat,
// no failure, no reward). She gives nothing away and he sends for the sister. → e2-kyras-widerstand.
import { G } from '../../core/G';
import { defineMap, startWorld, type MapDef, type WorldCtx } from '../../world';
import { HALLE_SPOT, HALLE_TABLE, halleBase, halleBrazierLights, pinArea, pinPlayer } from './gewoelbe';
import { bg, e2Scene, interlude, master, sfx, ui, VIOLET, nextScene } from './shared';

export const erinnerungMap: MapDef = defineMap({
  ...halleBase,
  id: 'e2-halle-erinnerung',
  name: 'Die Halle des Meisters',
  walk: [pinArea(HALLE_SPOT.chair)],
  block: [{ id: 'tisch', poly: HALLE_TABLE }],
  spawns: { stuhl: { at: HALLE_SPOT.chair, dir: 'left' } },
  lights: halleBrazierLights(0.6),
  time: 'night',
  ambience: ['room', 'fire'],
  ambienceVolume: { room: 0.8, fire: 0.3 },
  music: 'dread',
  playerLight: 24,
  resetOnEnter: true,
});

// ---------------------------------------------------------------------------------------------------------------

async function intrusion(w: WorldCtx): Promise<void> {
  const vamir = w.actor('meister');
  ui().prefetchPlate('e2-erinnerung');
  await w.cutscene(async () => {
    await w.wait(500);
    await w.think('Die Hände tun weh. Nicht hinsehen. Wer hinsieht, zählt nach.');
    vamir.face('player');
    await w.say(master(), 'Du schweigst gut. Also frage ich nicht mehr. Ich sehe selbst nach.');
    await vamir.walkTo(HALLE_SPOT.chair[0] - 22, HALLE_SPOT.chair[1] - 4, { straight: true });
    vamir.face('player');
    bg(vamir.play('cast', { ms: 2600 }));
    const hand: [number, number] = [HALLE_SPOT.chair[0] - 10, HALLE_SPOT.chair[1] - 36];
    const veil = w.lighting.add({ id: 'e2-schleier', at: hand, kind: 'plain', color: VIOLET, radius: 70, intensity: 0, always: true });
    sfx('magic', { volume: 0.5, pitch: 0.6 });
    await veil.fadeTo(1, 1200);
    G.audio.duck(-8, 9000);
    await w.camera.zoom(1.35, 1000);
    await w.think('Kalt. Wie Finger im Nacken, nur von innen. Er blättert in mir herum wie in einem Buch, das ihm nicht gehört.');
    await w.say(master(), 'So viel Wald in dir. Laub, Rinde, nasse Füße. Und dahinter … Mauern. Rauch.');
  });
}

async function memory(w: WorldCtx): Promise<void> {
  await w.cutscene(async () => {
    sfx('whoosh', { volume: 0.5 });
    await G.ui.plate('e2-erinnerung', { caption: 'Was der Meister in Flicks Erinnerung zu sehen behauptet', pan: 'in', durationMs: 26000 });
    await w.say(master(), 'Eine Stadt, die brennt. Weit weg, und trotzdem riechst du den Rauch noch. Deine Hände sind ganz kalt geworden.');
    await w.say(master(), 'Menschen in einer Reihe, die Hände gebunden. Und einer von meinen Leuten geht die Reihe entlang.');
    await w.say(master(), 'Da ist eine Frau. Du siehst sie an, als würdest du sie kennen. Wer ist sie dir, kleine Halbelfe?');
    await w.say('e2-flick', 'Da drin hast du nichts verloren! Hörst du? Nimm deine Finger aus meinem Kopf!', { mood: 'angry' });
    await w.say(master(), 'Raus? Ich bin gerade erst angekommen. Und hier drin ist es so schön still.');
    await w.think('Nein. Nicht sie. Nicht diesen Tag. Den kriegt er nicht.');
    sfx('shockwave', { volume: 0.4 });
    w.lighting.flash(VIOLET, 400);
    await G.ui.closePlate();
    w.camera.shake(260, 0.004);
    await w.say(master(), 'Zugeschlagen. Wie eine Tür im Wind. Gut, gut. Dann eben die Gegenwart.');
    await w.say(master(), 'Zeig mir das Mädchen. Wo hast du sie zuletzt gesehen? Woran denkst du, wenn du an sie denkst?');
  });
}

async function resistance(w: WorldCtx): Promise<number> {
  await w.think('Er sucht die Leseratte. In meinem Kopf. Dann versteck ich sie eben. Da drin kenn ich jeden Busch.');
  const pick = await w.choose([
    '(An den Wald denken: Laub, Wind, nichts als Laub.)',
    '(An Lias furchtbare Witze denken. Alle. Der Reihe nach.)',
    '(Steine zählen. Laut. Im Kopf.)',
  ]);
  G.state.set('e2-erinnerung-gedanke', ['wald', 'witze', 'steine'][pick]);
  if (pick === 0) await w.think('Buchen. Farn. Der Bach. Hundert Bäume, und hinter jedem kann sich eine kleine Leseratte verstecken.');
  else if (pick === 1) await w.think('„Was ist grün und liest?“ … Grauenhaft. Er soll ruhig mithören.');
  else await w.think('Eins. Zwei. Drei. Der vierte Stein hat einen Sprung. Fünf. Ich kann das die ganze Nacht.');
  w.setObjective('e2-erinnerung-verschliessen', 'Halte die Erinnerung an Lia vor seinem Blick verborgen.', null);
  const noise = await G.ui.stealthGame('cover', 'Die Erinnerung verschließen', {
    onNoise: () => { sfx('suspicious', { volume: 0.35 }); w.lighting.flash(VIOLET, 200); },
    help: 'In Flicks Kopf ist Wald. Bring die Leseratte in Deckung, solange sein Blick woanders sucht. Sucht er hier: nicht rühren.',
    keyHint: 'A / D oder ← / → · Leseratte ziehen',
  });
  w.completeObjective('e2-erinnerung-verschliessen');
  return noise;
}

async function aftermath(w: WorldCtx, noise: number): Promise<void> {
  const vamir = w.actor('meister');
  await w.cutscene(async () => {
    const veil = w.lighting.get('e2-schleier');
    await veil.fadeTo(0.2, 900);
    await w.camera.zoom(1.15, 800);
    if (noise === 0) await w.say(master(), 'Nichts. Blätter. Lauter Blätter, und dahinter noch mehr Blätter.');
    else await w.say(master(), 'Da! Ein Rascheln … und weg. Du rennst in deinem eigenen Kopf vor mir davon. Wie ungezogen.');
    await w.say(master(), 'Wo ist sie? Ein Wort. Ein Weg, ein Fluss, ein Name. Dann darfst du schlafen.');
    const pick = await w.choose([
      '„Such ruhig weiter. Da drin ist genug Wald für hundert Jahre.“',
      '„Ich weiß nicht, wo sie ist. Das ist das Schönste, was ich dir heute sagen kann.“',
      '(Lachen. Leise, aber so, dass er es hört.)',
    ]);
    if (pick === 0) await w.say('e2-flick', 'Such ruhig weiter. Da drin ist genug Wald für hundert Jahre. Ich hab Zeit, du offenbar auch.', { mood: 'smirk' });
    else if (pick === 1) await w.say('e2-flick', 'Ich weiß nicht, wo sie ist. Ehrlich. Das ist das Schönste, was ich dir heute sagen kann.', { mood: 'determined' });
    else { sfx('rustle', { volume: 0.2 }); await w.think('Es tut weh zu lachen. Ich lache trotzdem. Er soll es hören.'); }
    await veil.fadeTo(0, 600);
    await vamir.walkTo(HALLE_SPOT.chairFront[0], HALLE_SPOT.chairFront[1], { straight: true });
    vamir.face('player');
    await w.say(master(), 'Spitzohren. Immer mit dem Kopf durch die Wand. Sogar durch die eigene.');
    await w.say(master(), 'Baris. Bring mir die Schwester. Ich will sehen, ob sie auch so viel Wald im Kopf hat.');
    await w.say('e2-baris', 'Ja, Meister.', { mood: 'pained' });
    await w.think('Kyra. Nein. Nicht Kyra. Die hat doch nur Wut im Kopf und Rüben und ihre Schwester.');
    await w.say('e2-flick', 'Lass die Kleine! Die weiß nichts, hörst du? Die kann nicht mal lesen!', { mood: 'angry' });
    await w.say(master(), 'Wunderbar. Dann steht in ihr nichts Kleingedrucktes.');
    await G.ui.fade('out', 1300);
  });
}

async function erinnerungScript(w: WorldCtx): Promise<void> {
  G.state.set('e2-erinnerung-gedanke', false);
  const vamir = w.spawn({ id: 'meister', preset: 'vamir', speaker: master(), at: HALLE_SPOT.chairFront, dir: 'right', solid: false, speed: 26 });
  const baris = w.spawn({ id: 'baris', preset: 'baris-scarred', speaker: 'e2-baris', at: [536, 214], dir: 'left', solid: false });
  const door = w.spawn({ id: 'waerter', preset: 'shadow-club', speaker: 'e2-waerter', at: HALLE_SPOT.guardCells, dir: 'left', solid: false });
  for (const a of [vamir, baris, door]) a.hold(true);
  pinPlayer(w, 'sit-chair', 'left');
  await ui().fade('in', 900);
  w.setObjective('e2-erinnerung-standhalten', 'Verrate nichts. Nicht ein Wort über Lia.', 'meister');
  await intrusion(w);
  await memory(w);
  const noise = await resistance(w);
  await aftermath(w, noise);
  w.completeObjective('e2-erinnerung-standhalten');
  G.state.set('e2-erinnerungen-done');
  await nextScene('e2-kyras-widerstand');
}

export const scene = e2Scene('e2-flicks-erinnerungen', 'Fremde Hände im Kopf', async () => {
  await interlude('Unterdessen, wieder in der Halle des Meisters …');
  await startWorld({ map: erinnerungMap, spawn: 'stuhl', player: 'e2-flick-gefangen', companions: [], script: erinnerungScript });
});
