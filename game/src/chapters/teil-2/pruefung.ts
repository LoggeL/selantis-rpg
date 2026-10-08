// Scene „e2-pruefung“ – Die Prüfung (docs/teil-2/umsetzung.md §3, quellenpruefung §1/§8). Dusk in front of Elnon's
// tent. Flick reports, Kyra bursts in, Lia barely remembers. Elnon orders the test; Kyra and Flick protest, Flick
// offers to run. Heart: Lia's own decision (every answer leads to her wanting it herself), the lift gesture, the
// surge she holds on to (hold with struggle, cannot finally fail), plate e2-pruefung, collapse. Cut, framed as
// „Weit entfernt …“: the Master over his crystal (plate e2-sehkugel) sends for Baris. Afterwards the druid: weak but
// alive, powers like the old stories of the Ten, Ignatius von Ignis, a night to think. Lore e2-lore-pruefung.
import { G } from '../../core/G';
import { defineMap, startWorld, type MapDef, type WorldCtx } from '../../world';
import { campBase } from '../kapitel-4/lager';
import { halt } from '../kapitel-4/shared';
import { bg, e2Scene, interlude, lia, master, sfx, ui, nextScene } from './shared';

/** Turquoise of the Urmacht (only ever used for it). */
const TURQUOISE = 0x49e0c8;
const LIA_AT: [number, number] = [636, 276];

export const lagerAbend: MapDef = defineMap({
  ...campBase,
  id: 'e2-lager-abend',
  name: 'Vor Elnons Zelt',
  npcs: [
    { id: 'elnon', preset: 'elnon', at: [636, 240], dir: 'down' },
    { id: 'kyra', preset: 'kyra', at: [596, 268], dir: 'right' },
    { id: 'flick', preset: 'flick', at: [678, 266], dir: 'left' },
    { id: 'alastir', preset: 'alastir', at: [726, 238], dir: 'down' },
    { id: 'e2-zuschauer-1', preset: 'villager-f', at: [604, 376], dir: 'up', idle: 'sit' },
    { id: 'e2-zuschauer-2', preset: 'elf-m', at: [526, 356], dir: 'right', idle: 'sit' },
    { id: 'e2-zuschauer-3', preset: 'dwarf', at: [690, 372], dir: 'up' },
  ],
  props: [
    { prop: 'torch', at: [560, 250], collide: false },
    { prop: 'torch', at: [716, 256], collide: false },
  ],
  lights: [
    { id: 'lagerfeuer', at: [636, 330], kind: 'fire', radius: 160, intensity: 1.05, flame: 1.2 },
    { id: 'esse', at: [1024, 236], kind: 'fire', radius: 60, intensity: 0.7 },
    { id: 'zelt', at: [636, 184], kind: 'candle', radius: 50, intensity: 0.8 },
  ],
  exits: [],
  spawns: { zelt: { at: LIA_AT, dir: 'up' } },
  time: 'dusk',
  ambience: ['camp', 'fire', 'crickets'],
  ambienceVolume: { fire: 0.7, camp: 0.6, crickets: 0.4 },
  music: 'refuge',
  playerLight: 40,
  resetOnEnter: true,
});

// ---------------------------------------------------------------------------------------------------------------

async function report(w: WorldCtx): Promise<void> {
  const elnon = w.actor('elnon'), flick = w.actor('flick'), kyra = w.actor('kyra');
  await w.cutscene(async () => {
    await w.wait(500);
    flick.face('elnon');
    void flick.play('crouch' as never, { ms: 1400 });
    await w.say('flick', 'Baris hatte die Axt schon oben. Über mir. Dann war es hell. Nicht wie Feuer. Eher wie Wasser, das brennt.');
    void kyra.hop();
    await w.say('kyra', 'Sie ist geschwebt! Eine Handbreit über dem Gras! Und geschimmert hat sie!', { mood: 'happy' });
    await w.say('kyra', 'Und dann hat sie den Riesen weggeschleudert wie einen Sack Rüben. Den Hauptmann! Einfach weg!', { mood: 'happy' });
    await w.say('flick', 'Ich hab Gaukler gesehen, die für drei Funken einen Tag geübt haben. Das da war was anderes.');
    elnon.face('player');
    await elnon.say('Und du? Du stehst daneben, als ginge es um jemand anderen.');
    await lia(w, 'Ich weiß nur noch die Axt. Dann war es weiß. Dann hat Kyra gedroht, mir Wasser über den Kopf zu kippen.', 'thinking');
    await w.say('kyra', 'Hat gewirkt.', { mood: 'happy' });
    elnon.face('flick');
    await elnon.say('Von dir nehme ich keine Geschichte ungeprüft, Flick. Das weißt du.', { mood: 'grim' });
    await w.say('flick', 'Dann prüf sie doch. Dafür bist du ja da.', { mood: 'angry' });
    elnon.face('player');
    await elnon.say('Seit Dunkelhain zählen wir die Zauberkundigen, die noch zu den Freien halten, an einer Hand. Ich brauche nicht mal die.');
    await elnon.say('Die übrigen sitzen hinter Stadtmauern und zaubern für Fürsten, die das Land längst aufgegeben haben.');
    await elnon.say('Wenn das stimmt, ändert es alles. Wenn nicht, will ich es heute wissen. Nicht mitten in einem Gefecht.');
    await elnon.say('Der Druide soll die Prüfung machen.');
    await lia(w, 'Eine Prüfung? Muss ich etwas vorlesen? Darin bin ich gut.');
    await elnon.say('Ein Trank. Wer die Kraft wirklich in sich trägt, trinkt ihn wie Brunnenwasser.');
    await lia(w, 'Und wer sie nicht trägt?', 'worried');
    await w.wait(700);
    await elnon.say('Darüber reden wir, wenn es so weit ist.');
    void kyra.emote('anger');
    await w.say('kyra', 'Nein! Sie ist meine Schwester. Keine Ziege, an der man Kräuter ausprobiert!', { mood: 'angry' });
    await w.say('flick', 'Elnon, das ist zu viel. Sie kann seit Tagen kaum gerade stehen.', { mood: 'angry' });
    await elnon.say('Der Druide ist schon unterwegs.');
  });
}

/** The heart: Lia decides herself, then lifts the bowl and holds on through the surge. */
async function decision(w: WorldCtx): Promise<void> {
  const druid = w.spawn({ id: 'druide', preset: 'e2-druide', speaker: 'e2-druide', at: [548, 252], dir: 'right', solid: false });
  const kyra = w.actor('kyra'), flick = w.actor('flick');
  ui().prefetchPlate('e2-pruefung');
  await w.cutscene(async () => {
    await druid.walkTo(610, 252, { face: 'down' });
    await w.say('e2-druide', 'Ruhig, Kinder. Ich bin alt, nicht grausam. Die Schale halte ich nicht gern.');
    flick.face('player');
    await w.say('flick', 'Ein Wort, und wir sind über der Palisade, bevor der Alte die Schale abgestellt hat.', { mood: 'determined' });
    await w.think('Weglaufen. Darin bin ich inzwischen richtig gut.');
    const pick = await w.choose([
      '„Wir laufen seit Tagen. Hinter uns läuft immer jemand mit.“',
      '„Wenn das Ding in mir echt ist, will ich es wissen. Ich. Nicht nur er.“',
      '„Kyra, sag ehrlich: Hab ich wirklich geleuchtet?“',
    ]);
    G.state.set('e2-pruefung-wahl', pick);
    if (pick === 0) {
      await w.say('flick', '… Stimmt. Leider. Ich hasse es, wenn du recht hast.', { mood: 'sad' });
    } else if (pick === 1) {
      await w.say('kyra', 'Dann halt ich deine Hand. Und wenn’s schiefgeht, verhau ich den Druiden.', { mood: 'determined' });
      await w.say('e2-druide', 'Das habe ich gehört.');
    } else {
      await w.say('kyra', 'Wie ein Sonnwendfeuer. Ich schwör’s auf Mutters Kräuterbuch.', { mood: 'sad' });
      await lia(w, 'Dann sollte ich wohl herausfinden, was da in mir leuchtet.', 'thinking');
    }
    await lia(w, 'Ich trinke. Nicht weil er es will. Weil ich es wissen will.', 'determined');
    kyra.face('player');
    await w.say('e2-druide', 'Langsam trinken. Und wenn es dich packt, halt dich an dir selbst fest. An nichts anderem.');
    await druid.walkTo(LIA_AT[0] - 18, LIA_AT[1] - 6, { face: 'right' });
    w.player.face('left');
  });
  w.lockPlayer();
  await w.player.play('interact' as never, { ms: 700 }).catch(() => {});
  await w.think('Moos. Und darunter etwas Bitteres, das sich gleich hinter der Zunge festkrallt. Ein Schluck. Noch einer.');
  sfx('heal', { volume: 0.4, pitch: 0.7 });
  await w.wait(900);
}

async function surge(w: WorldCtx): Promise<void> {
  const elnon = w.actor('elnon'), kyra = w.actor('kyra'), druid = w.actor('druide');
  const glow = w.lighting.add({ id: 'e2-urmacht', at: [LIA_AT[0], LIA_AT[1] - 14], kind: 'urmacht', radius: 50, intensity: 0, always: true });
  let surging = true;
  await w.cutscene(async () => {
    w.player.face('down');
    sfx('urmacht', { volume: 0.9 });
    void glow.fadeTo(1.3, 1200);
    glow.set({ radius: 120 });
    w.fx.burst('player', 'urmacht', 24);
    w.camera.shake(700, 0.006);
    w.lighting.flash(TURQUOISE, 400);
    w.player.setIdle('cast');
    bg(druid.walkTo(LIA_AT[0] - 46, LIA_AT[1] - 2, { face: 'right' }));
    bg(elnon.walkTo(636, 226, { face: 'down' }));
    void kyra.emote('!');
    const r1 = w.spawn({ id: 'e2-halter-1', preset: 'guard-brotherhood', at: [560, 292], dir: 'right', solid: false });
    const r2 = w.spawn({ id: 'e2-halter-2', preset: 'elf-m', at: [712, 290], dir: 'left', solid: false });
    bg(r1.walkTo(LIA_AT[0] - 18, LIA_AT[1] + 4, { run: true, face: 'right' }));
    bg(r2.walkTo(LIA_AT[0] + 18, LIA_AT[1] + 4, { run: true, face: 'left' }));
    await elnon.say('Packt sie! Nicht loslassen!', { mood: 'surprised' });
    bg((async () => {
      while (surging && w.alive) {
        w.fx.burst('player', 'urmacht', 10);
        await w.wait(420);
      }
    })());
    await G.ui.hold('Dich selbst festhalten', 4200, {
      struggle: true,
      onRelease: () => { w.camera.shake(260, 0.005); sfx('shockwave', { volume: 0.5 }); },
    });
    surging = false;
    await G.ui.plate('e2-pruefung', { caption: 'Die Prüfung', pan: 'in', durationMs: 20000 });
    await w.say('narrator', 'Das Licht kam nicht aus der Schale. Es kam aus Lia: ~türkis~, kalt und hell, bis hinauf in die Wipfel.');
    await w.say('narrator', 'Jemand warf ihr einen Strick um die Handgelenke. Er riss wie Zwirn. Zwei Rebellen landeten im Gras, zwei andere packten zu.');
    await w.say('narrator', 'Elnon wich einen Schritt zurück. Nur der Druide sah nicht weg.');
    await G.ui.closePlate();
    sfx('fall', { volume: 0.6 });
    void glow.fadeTo(0, 900);
    w.player.setIdle('lie');
    w.camera.shake(200, 0.003);
    bg(kyra.walkTo(LIA_AT[0] + 22, LIA_AT[1] + 4, { run: true, face: 'left' }));
    await w.say('kyra', 'Lia!', { mood: 'scared' });
    await w.wait(600);
  });
  await ui().fade('out', 900);
  w.despawn('e2-halter-1');
  w.despawn('e2-halter-2');
}

/** Cut to the enemy (player knowledge only, visibly framed). */
async function farAway(): Promise<void> {
  ui().prefetchPlate('e2-sehkugel');
  await interlude('Weit entfernt …');
  await G.ui.plate('e2-sehkugel', { caption: 'Weit entfernt', pan: 'in', durationMs: 16000 });
  await ui().fade('in', 700);
  await G.ui.say('narrator', 'Eine bleiche Hand ruhte über einer Kugel aus Kristall. Tief in ihr glomm ein winziger ~Funke~.');
  await G.ui.say(master(), 'Erst die Nacht an der Eiche. Und jetzt leuchtest du wieder, als wolltest du gefunden werden.');
  await G.ui.say(master(), 'Wer immer dich so weit gebracht hat: Ich bin ihm dankbar.');
  await G.ui.say(master(), 'Holt Baris. Er soll sein Auge benutzen, solange er noch eines hat.');
  await G.ui.say('wache', 'Sofort, Meister.');
  await ui().fade('out', 700);
  await G.ui.closePlate();
}

async function afterwards(w: WorldCtx): Promise<void> {
  const elnon = w.actor('elnon'), kyra = w.actor('kyra'), flick = w.actor('flick'), druid = w.actor('druide');
  await w.lighting.set('night', 0);
  w.player.teleport(LIA_AT, 'down');
  w.player.setIdle('lie');
  druid.teleport([LIA_AT[0] - 22, LIA_AT[1] - 2], 'right'); druid.setIdle('kneel');
  kyra.teleport([LIA_AT[0] + 22, LIA_AT[1] + 2], 'left'); kyra.setIdle('kneel');
  flick.teleport([690, 270], 'left');
  elnon.teleport([636, 244], 'down');
  await w.camera.pan([LIA_AT[0], LIA_AT[1] - 10], 0);
  await w.camera.zoom(1.3, 0);
  void ui().fade('in', 1000);
  await w.cutscene(async () => {
    await w.wait(600);
    await w.say('e2-druide', 'Ihr Atem ist flach, aber ruhig. Sie kommt zurück. Gebt ihr Zeit und Wasser.', { mood: 'worried' });
    await w.say('kyra', 'Was heißt das? Was ist sie? Und sag jetzt nicht „deine Schwester“. Das weiß ich selbst.', { mood: 'scared' });
    await w.say('e2-druide', 'In den alten Geschichten über die Zehn klingt es so. Ich hielt das immer für Ausschmückung. Bis eben.');
    await elnon.say('Kannst du ihr helfen?');
    await w.say('e2-druide', 'Ich? Ich koche Tränke. Das hier versteht vielleicht nur noch einer.');
    await w.say('e2-druide', 'Ignatius von Ignis. Einer der Zehn Geweihten. Nach Dunkelhain ist er verschwunden wie Rauch im Wind.');
    await w.say('flick', 'Sechzehn Jahre verschwunden. Klingt nach einem, der ganz bestimmt nicht gefunden werden will.', { mood: 'smirk' });
    await w.say('e2-druide', 'Wer sich so lange verbirgt, kann sich verbergen. Das ist schon etwas.');
    await elnon.say('Und wie finden wir ihn?');
    await w.say('e2-druide', 'Lass mich bis morgen nachdenken. Ein alter Kopf braucht eine Nacht. Ein voller zwei.');
    await elnon.say('Bis morgen.', { mood: 'grim' });
    bg(elnon.walkTo(634, 214, { face: 'up' }).then(() => elnon.hide()));
    await w.say('kyra', 'Hörst du, Lia? Bis morgen. Du schläfst jetzt, und ich pass auf.', { mood: 'determined' });
    G.state.addLore('e2-lore-pruefung');
    await w.wait(800);
  });
}

async function pruefungScript(w: WorldCtx): Promise<void> {
  for (const id of ['elnon', 'kyra', 'flick', 'alastir']) w.actor(id).hold(true);
  w.player.face('up');
  void ui().fade('in', 900);
  w.setObjective('e2-pruefung', 'Hör dir an, was Elnon entscheidet.', null);
  await report(w);
  w.setObjective('e2-pruefung', 'Entscheide selbst: die Schale des Druiden.', 'druide');
  await decision(w);
  // Done with the decision; completed before the surge so its toast never lies on the crystal-ball plate.
  w.completeObjective('e2-pruefung');
  await surge(w);
  await farAway();
  await afterwards(w);
  G.state.set('e2-pruefung-done');
  await ui().fade('out', 1000);
  halt(w, ['elnon', 'kyra', 'flick', 'druide']);
  await nextScene('e2-flicks-herkunft');
}

export const scene = e2Scene('e2-pruefung', 'Die Prüfung', () =>
  startWorld({ map: lagerAbend, spawn: 'zelt', player: 'lia-cloak', companions: [], fadeIn: false, script: pruefungScript }));
