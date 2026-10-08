// Scene „bruderschaft“ (DESIGN.md §7.4, Kapitel IV/2): the camp as a hub. Arrival (Elnon looks past Lia and
// only talks to Foltan), Azar at the forge, the people of the Brotherhood (humans of Trapas, dwarves of Moneda,
// elves of Ebaril) with optional stories, then the training at the palisade (Ausweichen + Ablenken).
import { G } from '../../core/G';
import type { UiApiExt } from '../../ui';
import { defineMap, type NpcDef, type WorldCtx } from '../../world';
import { campBase } from './lager';
import { bg, halt, lia, sfx } from './shared';
import { ablenkDrill, ausweichDrill, gundrikAblenken, throwStone } from './training';

/** Where the Brotherhood's people stand once the arrival crowd disperses. */
const HUB: Record<string, { at: [number, number]; face: 'left' | 'right' | 'up' | 'down' }> = {
  'k4-ilvy': { at: [104, 298], face: 'left' },
  'k4-gundrik': { at: [786, 378], face: 'up' },
  'k4-berta': { at: [572, 290], face: 'right' },
  'k4-jorin': { at: [318, 268], face: 'left' },
  'k4-wache': { at: [568, 524], face: 'down' },
  'k4-faelan': { at: [700, 394], face: 'left' },
};
const TALKERS = Object.keys(HUB);

function talked(): number { return TALKERS.filter(id => G.state.is(`k4-t-${id}`)).length; }

function markTalked(w: WorldCtx, id: string): void {
  if (G.state.is(`k4-t-${id}`)) return;
  G.state.set(`k4-t-${id}`);
  if (!G.state.is('k4-foltan-kommt')) {
    const n = talked();
    if (G.state.is('k4-t-azar')) w.setObjective('k4-umsehen', `Lerne die Bruderschaft kennen (${Math.min(3, n)}/3).`, n < 3 ? nextTalker() : null);
  }
}

function nextTalker(): string | null {
  return TALKERS.find(id => !G.state.is(`k4-t-${id}`)) ?? null;
}

const crowd = (id: string, preset: string, at: [number, number], dir: NpcDef['dir'], talk: NpcDef['talk'], barks: string[]): NpcDef =>
  ({ id, preset, at, dir, talk, barks, barkEvery: 9000 });

export const lager = defineMap({
  ...campBase,
  id: 'k4-lager',
  name: 'Das Lager der Freien Bruderschaft',
  npcs: [
    { id: 'azar', preset: 'azar', at: [606, 612], dir: 'up', talk: talkAzar, barks: ['Ein Schmied ist unentbehrlich!', 'Wer hat dieses Kettenhemd so zerfetzt?', 'Stille Wasser sind tief. Kettenhemden rosten.'], barkEvery: 11000 },
    { id: 'foltan', preset: 'foltan', at: [662, 612], dir: 'up', talk: talkFoltan },
    { id: 'elnon', preset: 'elnon', at: [636, 226], dir: 'down', hidden: true, talk: talkElnon },
    { id: 'alastir', preset: 'alastir', at: [666, 228], dir: 'down', hidden: true, talk: talkAlastir },
    crowd('k4-ilvy', 'elf-f', [576, 512], 'down', talkIlvy, ['Ruhig atmen … und los.', 'Fast in die Mitte.']),
    crowd('k4-gundrik', 'dwarf', [690, 500], 'down', talkGundrik, ['Holz hacken. Wieder Holz hacken.', 'Elfen. Pah.']),
    crowd('k4-berta', 'villager-f', [560, 470], 'down', talkBerta, ['Wer hat meinen Lorbeer?', 'Noch eine Stunde, dann gibt’s Eintopf!']),
    crowd('k4-jorin', 'villager-m', [672, 470], 'down', talkJorin, ['Hah! Nimm das, Strohkopf!', 'Eines Tages trage ich ein echtes Schwert.']),
    crowd('k4-wache', 'guard-brotherhood', [600, 540], 'down', talkWache, ['Losung ist Losung.']),
    crowd('k4-faelan', 'elf-m', [532, 500], 'down', talkFaelan, ['…', 'Der Wind dreht.']),
  ],
  interactables: [
    { id: 'kessel', verb: 'Probieren', poly: [[590, 256], [632, 256], [632, 306], [590, 306]], radius: 26, onInteract: tasteStew },
    { id: 'zielscheibe', verb: 'Ansehen', poly: [[58, 222], [96, 222], [98, 262], [56, 262]], when: () => !G.state.flag<number>('k4-ablenken-phase'), thought: 'Drei Pfeile in der Mitte, einer im Rand. Ich würde nicht mal die Scheibe treffen.' },
    { id: 'puppen', verb: 'Ansehen', poly: [[150, 222], [182, 222], [182, 266], [150, 266]], radius: 22, onInteract: dummies },
    { id: 'waffen', verb: 'Ansehen', poly: [[284, 196], [300, 186], [376, 220], [372, 250], [286, 222]], thought: 'Holzschwerter, zerkerbt und geflickt. Hier wird jeden Tag geübt.' },
    {
      id: 'zelt-eingang', verb: 'Hineingehen', poly: [[612, 166], [656, 166], [658, 206], [612, 206]], standAt: [634, 228], face: 'up', once: false,
      onInteract: async w => {
        if (G.state.is('k4-foltan-kommt')) await w.think('Elnon ist noch drinnen. Ohne Einladung? Lieber nicht. Noch nicht.');
        else await w.think('Drinnen gedämpfte Stimmen. Foltan erzählt ihm bestimmt gerade von Kyra.');
      },
    },
    { id: 'k4-stein-fass', verb: 'Stein werfen', poly: [[378, 222], [416, 222], [416, 250], [378, 250]], radius: 150, once: false, when: () => G.state.flag<number>('k4-ablenken-phase') === 1, onInteract: w => throwStone(w, true) },
    { id: 'k4-stein-scheibe', verb: 'Stein werfen', poly: [[58, 226], [96, 226], [98, 262], [56, 262]], radius: 150, once: false, when: () => G.state.flag<number>('k4-ablenken-phase') === 1, onInteract: w => throwStone(w, false) },
  ],
  lights: [
    { id: 'esse', at: [1024, 236], kind: 'fire', radius: 60, intensity: 0.8, always: true },
    { id: 'feuer', at: [636, 330], kind: 'fire', radius: 70, intensity: 0.5, flame: 0.7 },
  ],
  exits: [{
    id: 'tor', poly: [[588, 706], [680, 706], [680, 720], [588, 720]], to: 'k4-lager', spawn: 'tor',
    when: () => false, blocked: 'Allein zurück in den Wald? Ohne zu wissen, wo Kyra ist? Nein.',
  }],
  spawns: { tor: { at: [634, 586], dir: 'up' }, training: { at: [252, 306], dir: 'right' } },
  time: 'day',
  ambience: ['camp', 'forge', 'birds', 'wind'],
  ambienceVolume: { forge: 0.55, birds: 0.5, wind: 0.4 },
  music: 'refuge',
  onEnter: async w => {
    w.spawn({ id: 'k4-turm-l', preset: 'elf-m', at: [206, 112], dir: 'down', solid: false });
    w.spawn({ id: 'k4-turm-r', preset: 'guard-brotherhood', at: [1122, 114], dir: 'down', solid: false });
  },
});

// ---------------------------------------------------------------------------------------------------------------
// Main script
// ---------------------------------------------------------------------------------------------------------------

export async function bruderschaftSkript(w: WorldCtx): Promise<void> {
  const ui = G.ui as UiApiExt;
  if (!G.state.is('k4-ankunft')) await ankunft(w);
  else disperse(w, true);
  void ui.fade('in', 300);

  if (!G.state.is('k4-t-azar')) {
    w.setObjective('k4-azar', 'Besuch Azar in der Schmiede.', 'azar');
    while (!G.state.is('k4-t-azar')) await w.wait(250);
    w.completeObjective('k4-azar');
  }
  if (talked() < 3) {
    w.setObjective('k4-umsehen', `Lerne die Bruderschaft kennen (${talked()}/3).`, nextTalker());
    while (talked() < 3) await w.wait(300);
  }
  w.completeObjective('k4-umsehen');
  G.state.set('k4-foltan-kommt');

  const foltan = w.actor('foltan');
  const alastir = w.actor('alastir');
  if (!G.state.is('k4-training-done')) {
    await w.cutscene(async () => {
      foltan.teleport([636, 228], 'down'); foltan.show();
      alastir.teleport([666, 230], 'down'); alastir.show();
      await w.camera.pan('foltan', 900);
      bg(alastir.walkTo(792, 232, { face: 'down' }));
      await foltan.say('Lia! An die Palisade. Ich will sehen, was du kannst.');
      await foltan.walkTo(292, 306, { face: 'left' });
    });
    w.setObjective('k4-training', 'Geh zu Foltan an den Übungsplatz.', 'foltan');
    G.state.set('k4-training-bereit');
    await w.waitForInteract('foltan');
    await training(w);
  } else {
    foltan.teleport([292, 306], 'left'); foltan.show();
    alastir.teleport([792, 232], 'down'); alastir.show();
  }

  // Evening: supper at the big fire.
  bg(w.lighting.set('dusk', 6000));
  w.bark('k4-berta', 'Essen! Wer zu spät kommt, kriegt den Boden vom Kessel!', 3200);
  w.setObjective('k4-essen', 'Geh zum Abendessen ans große Feuer.', [636, 384]);
  await w.waitForNear([636, 384], 44);
  w.completeObjective('k4-essen');
  await ui.fade('out', 900);
  halt(w, ['azar', 'foltan', 'alastir', ...TALKERS]);
  await G.goto('verrat');
}

async function ankunft(w: WorldCtx): Promise<void> {
  const ui = G.ui as UiApiExt;
  const elnon = w.actor('elnon');
  const alastir = w.actor('alastir');
  const foltan = w.actor('foltan');
  const azar = w.actor('azar');
  for (const id of TALKERS) w.actor(id).face('player');
  await w.cutscene(async () => {
    void ui.fade('in', 1600);
    w.player.face('up');
    await w.wait(500);
    await w.think('Licht. Viel zu viel davon. Ich blinzle wie ein Maulwurf.');
    await w.think('Menschen. Nein, nicht nur Menschen. Spitze Ohren unter langem Haar … Elfen! Und Zwerge, kleiner als ich.');
    w.bark('k4-jorin', 'Ein Mädchen?', 1800);
    await w.wait(500);
    w.bark('k4-gundrik', 'Foltan bringt Gäste mit? Seit wann?', 2200);
    await w.wait(900);
    elnon.show(); alastir.show();
    await w.camera.pan([636, 380], 1100);
    // The crowd opens a lane.
    bg(w.actor('k4-berta').walkTo(530, 470));
    bg(w.actor('k4-jorin').walkTo(712, 470));
    bg(elnon.walkTo(636, 530, { face: 'down' }));
    await alastir.walkTo(670, 534, { face: 'down' });
    w.camera.follow('player');
    elnon.face('foltan');
    await elnon.say('Ihr habt euch ganz schön Zeit gelassen.', { mood: 'grim' });
    await w.think('Er schaut über mich hinweg. Direkt zu Foltan.');
    await foltan.say('Entschuldige, Elnon. Wir haben unterwegs etwas gefunden, das uns aufgehalten hat.');
    await w.think('Etwas? Ich bin doch kein Fundstück.');
    await elnon.say('Ein Mädchen. Wo habt ihr das denn aufgegabelt?');
    await foltan.say('Dunkelschatten haben ihren Hof überfallen. Sie saß verängstigt im Wald.');
    await w.think('Verängstigt? Übertreib mal nicht.');
    const pick = await w.choose(['„Ich kann selbst reden. Ich heiße Lia.“', '„Sie haben meine Schwester entführt! Ihr müsst …“', 'Schweigen und Alastirs Blick erwidern']);
    if (pick === 0) {
      await lia(w, 'Ich kann selbst reden. Ich heiße Lia.', 'determined');
      elnon.face('foltan');
      await elnon.say('Löblich. Den Schwachen helfen, so will es der Kodex.');
      await w.think('Er sieht einfach durch mich hindurch.');
    } else if (pick === 1) {
      await lia(w, 'Sie haben meine Schwester entführt! Ihr müsst …', 'angry');
      await elnon.say('Foltan. Deinen Bericht. Jetzt.', { mood: 'grim' });
      bg(alastir.emote('…'));
      await w.think('Kein Wort an mich. Nur der Narbige sieht mich an. Lange.');
    } else {
      alastir.face('player');
      bg(alastir.emote('…'));
      await w.think('Die Hälfte seines Gesichts ist verbrannt. Er mustert mich, als läse er ein Buch, das ihm nicht gefällt.');
      await w.think('Ich halte stand. Drei Atemzüge. Dann schaue ich doch weg.');
      await elnon.say('Löblich. Den Schwachen helfen, so will es der Kodex.');
    }
    await elnon.say('Foltan, in mein Zelt. Azar, die Kleine braucht einen Schlafplatz.');
    bg(elnon.walkTo(636, 228));
    bg(alastir.walkTo(666, 230));
    await foltan.walkTo(650, 240);
    elnon.hide(); alastir.hide(); foltan.hide();
    disperse(w, false);
    azar.face('player');
    await azar.say('Mach dir nichts draus. Elnon ist zu allen so. Außer zu Leuten mit Neuigkeiten.', { mood: 'happy' });
    await lia(w, 'Ich habe Neuigkeiten. Meine Schwester ist entführt worden.', 'sad');
    await azar.say('Und genau das erzählt Foltan ihm jetzt. Er ist gründlich, unser feiner Herr Foltan.');
    await azar.say('Ich muss in die Schmiede, die Kettenhemden flicken sich nicht von allein. Schau dich um! Aber verlauf dich nicht.');
    bg(azar.walkTo(968, 292, { face: 'right' }));
  });
  G.state.set('k4-ankunft');
}

/** Sends the arrival crowd to their places in the camp. */
function disperse(w: WorldCtx, instant: boolean): void {
  for (const id of TALKERS) {
    const h = HUB[id];
    const a = w.actor(id);
    if (instant) a.teleport(h.at, h.face);
    else bg(a.walkTo(h.at[0], h.at[1], { face: h.face }));
  }
  if (instant) {
    w.actor('azar').teleport([968, 292], 'right');
    w.actor('foltan').hide();
  }
}

async function training(w: WorldCtx): Promise<void> {
  const foltan = w.actor('foltan');
  await w.cutscene(async () => {
    w.player.face('foltan');
    await foltan.say('Da bist du. Elnon weiß Bescheid.');
    await lia(w, 'Hast du ihm von Kyra erzählt?');
    await foltan.say('Er weiß, was er wissen muss.');
    const opts = ['„Und? Schickt er Späher los?“'];
    if (G.state.is('k3-luege-bemerkt')) opts.push('„Was hat Craupor wirklich gesagt, Foltan?“');
    const pick = await w.choose(opts);
    if (pick === 0) {
      await foltan.say('Elnon entscheidet. Nicht ich und nicht du.');
    } else {
      await foltan.say('Nichts, was dir weiterhilft. Lass es gut sein, Lia.', { mood: 'worried' });
      await w.think('Schon wieder weicht er aus. Genau wie im Eber.');
    }
    await foltan.say('Bis dahin: Wer mit uns zieht, muss sich wehren können. Oder wenigstens nicht getroffen werden.');
    await lia(w, 'Ich will mich wehren. Ich will, dass sie für Mutter und Vater bezahlen. Ich weiß nur noch nicht, wie.', 'determined');
    await foltan.say('Mit Wut allein triffst du niemanden. Erst lernst du, nicht getroffen zu werden. Ich schlage, du weichst aus. Immer WEG von der Klinge. Und Vorsicht: Ich täusche an.');
    await w.say('narrator', 'Ein Bogen zeigt, woher der Hieb kommt. Hieb von links: weiche nach rechts aus. Von rechts: nach links. Hoher Hieb: ducken.');
    await w.say('narrator', 'Tasten A/D bzw. ←/→ zum Ausweichen, S bzw. ↓ zum Ducken. Oder tippe die Knöpfe unten.');
  });
  w.player.teleport([252, 306], 'right');
  foltan.teleport([292, 306], 'left');
  w.setObjective('k4-ausweichen', 'Weiche Foltans Hieben aus.', null);
  w.lockPlayer();
  const hits = await ausweichDrill(w, 5);
  w.unlockPlayer();
  w.completeObjective('k4-ausweichen');
  G.state.learn('ausweichen');
  await w.cutscene(async () => {
    if (hits === 0) await foltan.say('Kein einziger Treffer? Hm. Nicht schlecht. Für eine Leserin.', { mood: 'surprised' });
    else if (hits < 4) await foltan.say('Nicht schlecht. Für eine Leserin.');
    else await foltan.say('Du hast mehr blaue Flecken als Ausweichschritte. Aber am Ende hast du es begriffen.');
    if (!G.state.data.memories.includes('k4-mem-stockfechten')) {
      await w.think('Kyra hat mich mit Haselstöcken gejagt, damals. Ich habe mich immer nur geduckt. Und manchmal gewonnen.');
      G.state.addMemory('k4-mem-stockfechten');
    }
    await foltan.say('Zweite Lektion: Ablenken. Gundrik! Jorin! Herkommen!');
    const g = w.actor('k4-gundrik'), j = w.actor('k4-jorin');
    bg(g.walkTo(162, 298, { face: 'left' }));
    await j.walkTo(70, 352, { face: 'right' });
    await g.walkTo(162, 298, { face: 'left' });
    await foltan.say('Gundrik bewacht das Banner dort. Jorin will es holen. Du sorgst dafür, dass Gundrik woanders hinschaut.');
    await w.actor('k4-gundrik').say('Pah. Mich lenkt man nicht ab. Ich bin ein Zwerg aus Moneda.');
  });
  await ablenkDrill(w);
  G.state.learn('ablenken');
  await w.cutscene(async () => {
    await foltan.say('Ablenken heißt: Sie sollen dich ansehen, nicht deine Freunde. Merk dir das.');
    await lia(w, 'Und wenn sie mich zu genau ansehen?', 'thinking');
    await foltan.say('Dann weichst du aus. Siehst du? Alles hängt zusammen.');
    await lia(w, 'Und wann suchen wir Kyra?', 'determined');
    bg(foltan.emote('…'));
    await foltan.say('Morgen. Vielleicht. Iss erst mal etwas.', { mood: 'ashamed' });
    for (const id of ['k4-gundrik', 'k4-jorin']) { const h = HUB[id]; bg(w.actor(id).walkTo(h.at[0], h.at[1], { face: h.face })); }
  });
  G.state.set('k4-training-done');
  w.completeObjective('k4-training');
}

// ---------------------------------------------------------------------------------------------------------------
// Talk handlers
// ---------------------------------------------------------------------------------------------------------------

async function talkAzar(w: WorldCtx): Promise<void> {
  const azar = w.actor('azar');
  if (!G.state.is('k4-ankunft')) return;
  if (Math.hypot(azar.x - 968, azar.y - 292) > 30) {
    await azar.say('Komm mit in die Schmiede, da redet es sich besser!', { mood: 'happy' });
    bg(azar.walkTo(968, 292, { face: 'right' }));
    return;
  }
  if (!G.state.is('k4-t-azar')) {
    await azar.say('Willkommen in meinem Reich! Merk dir eins: Ein Schmied ist unentbehrlich.', { mood: 'happy' });
    await azar.say('Jeder Kämpfer braucht einen guten Schmied. Sonst kämpft er bald im Hemd. Tritt mal den Blasebalg, ja?');
    // Staged: Lia treads the bellows three times, the forge breathes with her.
    await lia(w, 'Na gut. Aber wenn ich dabei umfalle, ist das deine Schuld.');
    for (let i = 0; i < 3; i++) {
      sfx('whoosh', { volume: 0.5 });
      w.fx.burst([1024, 236], 'sparkle', 4 + i * 2);
      try { bg(w.lighting.get('esse').fadeTo(0.9 + i * 0.15, 260)); } catch { /* */ }
      await w.wait(420);
    }
    sfx('fire-ignite', { volume: 0.8 });
    w.fx.burst([1024, 236], 'sparkle', 12);
    try { bg(w.lighting.get('esse').fadeTo(1.4, 300)); } catch { /* */ }
    for (let i = 0; i < 3; i++) { bg(azar.play('attack', { once: true })); sfx('block', { volume: 0.6, pitch: 1.4 }); w.fx.burst([1000, 270], 'sparkle', 5); await w.wait(380); }
    try { bg(w.lighting.get('esse').fadeTo(0.8, 900)); } catch { /* */ }
    await azar.say('Ha! Siehst du die Funken? Hoffnung kann Stürme beschwören.', { mood: 'happy' });
    await lia(w, 'Wer ist dieser Elnon?');
    await azar.say('Unser Anführer. Gewählt, weil er vom Krieg am meisten versteht. Er war Hauptmann der Garde von Ebaril.');
    await azar.say('Bevor die Dunkelschatten die Stadt niedergebrannt haben. Seitdem lacht er nicht mehr. Na ja. Selten.');
    await lia(w, 'Und er hilft uns, Kyra zu finden?', 'thinking');
    await azar.say('Bestimmt! Foltan erzählt ihm gerade alles. Elnon schickt sicher einen Spähtrupp los.', { mood: 'happy' });
    await w.think('Ein Spähtrupp. Für Kyra. Ich trau mich kaum, daran zu glauben.');
    G.state.set('k4-t-azar');
    return;
  }
  const lines = [
    'Die Elfen hier sind höflich, aber sie lachen nie über meine Witze. Nicht mal über die guten.',
    'Gundrik behauptet, Zwerge schmieden besser. Ich sage: Zwerge schmieden kleiner.',
    'Stille Wasser sind tief. Und Kettenhemden rosten, wenn man sie anschweigt.',
  ];
  const n = G.state.inc('k4-azar-plausch');
  await azar.say(lines[(n - 1) % lines.length], { mood: 'happy' });
}

async function talkFoltan(w: WorldCtx): Promise<void> {
  if (G.state.is('k4-training-bereit') && !G.state.is('k4-training-done')) return; // the main script runs the training
  if (G.state.is('k4-training-done')) await w.actor('foltan').say('Geh essen. Morgen sehen wir weiter.');
}

async function talkElnon(w: WorldCtx): Promise<void> {
  await w.actor('elnon').say('Foltan. Später.');
}

async function talkAlastir(w: WorldCtx): Promise<void> {
  const al = w.actor('alastir');
  if (G.state.is('k4-t-alastir')) { await al.say('Geh. Iss etwas. Die Nacht wird kalt.'); return; }
  await al.say('Du starrst. Das tun alle.', { mood: 'grim' });
  const pick = await w.choose(['„Woher hast du die Narbe?“', '„Entschuldige.“']);
  if (pick === 0) {
    await al.say('Ebaril. Die Stadt brannte drei Tage. Ich habe zwei davon gesehen.');
    await al.say('Ich war in der großen Bibliothek, als das Dach einstürzte. Die Bücher brannten am hellsten.');
    await lia(w, 'Die Bibliothek von Ebaril … ich habe davon gelesen.', 'sad');
    await al.say('Dann weißt du mehr als die meisten Menschen. Das ist alles, was von ihr übrig ist: was in Köpfen steht.');
    G.state.addLore('k4-lore-ebaril');
  } else {
    await al.say('Nicht nötig. Narben sind ehrlich. Ehrlicher als die meisten Gesichter.');
  }
  await al.say('Elnon ist nicht kalt, Mädchen. Er rechnet. Ein Leben gegen tausend andere. Jeden Tag.');
  G.state.set('k4-t-alastir');
}

async function talkIlvy(w: WorldCtx): Promise<void> {
  const s = (t: string) => w.say('k4-ilvy', t);
  if (G.state.is('k4-t-k4-ilvy')) { await s('Ruhig atmen, dann loslassen. Beim Bogen wie bei allem anderen.'); return; }
  await s('Ein Menschenmädchen, das nach Büchern riecht. Das sieht man hier selten.');
  const pick = await w.choose(['„Was bedeuten Grün und Silber?“', '„Zu welchem Gott betet ihr Elfen?“']);
  if (pick === 0) {
    await s('Die Farben von Ebaril. Wir tragen sie, bis die Stadt wieder steht.');
    await lia(w, 'Und zu welchem Gott betet ihr?');
  }
  await s('Zu Destar. Sein weißer Hirsch Rega trug ihn durch die ersten Wälder, als es noch keine Wege gab.');
  await s('Regas Geweih ist heilig. Wer es raubt, schändet Destar selbst. Kein Elf würde es auch nur berühren.');
  G.state.addLore('k4-lore-destar');
  markTalked(w, 'k4-ilvy');
}

async function talkGundrik(w: WorldCtx): Promise<void> {
  if (G.state.flag<number>('k4-ablenken-phase') === 2) { await gundrikAblenken(w); return; }
  const s = (t: string, mood?: string) => w.say('k4-gundrik', t, mood ? { mood } : undefined);
  if (G.state.is('k4-t-k4-gundrik')) { await s('Holz. Hacken. Mehr gibt’s nicht zu sagen.'); return; }
  await s('Was glotzt du? Noch nie einen Zwerg gesehen?');
  await lia(w, 'Nur in Büchern. Da wart ihr größer.', 'happy');
  await s('Pah! Bücher. Moneda hat seit Dunkelhain die Tore zu. Die feinen Herren hocken auf ihrem Gold.');
  await s('Ich nicht. Ich bin raus. Lieber hacke ich hier Holz, als dort unten Däumchen zu drehen.');
  G.state.addLore('k4-lore-moneda');
  markTalked(w, 'k4-gundrik');
}

async function talkBerta(w: WorldCtx): Promise<void> {
  const s = (t: string) => w.say('k4-berta', t);
  if (G.state.is('k4-t-k4-berta')) { await s('Probier ruhig vom Kessel, Kind. Aber nicht verraten, dass der Lorbeer fehlt.'); return; }
  await s('Na, du bist also Foltans Fundstück. Hunger?');
  await lia(w, 'Ein bisschen. Warum hat er mich überhaupt mitgenommen?');
  await s('Der Kodex. Keiner bleibt zurück, und wer schwach ist, kriegt Hilfe. Sonst wären wir bloß Leute mit Messern im Wald.');
  await s('Menschen, Zwerge, Elfen. Alle aus einem Grund hier. Elnon sagt: Damit es kein zweites Ebaril gibt.');
  G.state.addLore('k4-lore-bruderschaft');
  markTalked(w, 'k4-berta');
}

async function talkJorin(w: WorldCtx): Promise<void> {
  const s = (t: string) => w.say('k4-jorin', t);
  if (G.state.is('k4-t-k4-jorin')) { await s('Hast du gesehen? Ich hab der Puppe fast den Kopf abgehauen. Fast.'); return; }
  await s('Ich bin Jorin, aus Trapas! Der Lichterorden predigt, und die Fürsten verriegeln die Tore.');
  await s('Da dachte ich: Wenn keiner rausgeht, geh ich eben selbst.');
  await lia(w, 'Meine Mutter kam aus Trapas. Aus einer Händlerfamilie.', 'sad');
  await s('Dann sind wir ja fast verwandt! … Kam? Oh. Tut mir leid.');
  markTalked(w, 'k4-jorin');
}

async function talkWache(w: WorldCtx): Promise<void> {
  const s = (t: string) => w.say('k4-wache', t);
  if (G.state.is('k4-t-k4-wache')) { await s('Raus nur mit Foltan oder Elnon. Befehl.'); return; }
  await s('Losung ist Losung. Selbst für Gäste mit Augenbinde.');
  await lia(w, 'Du trägst Rot und Weiß. Wie die Stadtwache von Trapas.');
  await s('War ich mal. Trapas schickt keine Soldaten mehr raus. Also sind wir eben selbst gegangen.');
  markTalked(w, 'k4-wache');
}

async function talkFaelan(w: WorldCtx): Promise<void> {
  const s = (t: string) => w.say('k4-faelan', t);
  if (G.state.is('k4-t-k4-faelan')) { await s('Der Wind dreht. Morgen regnet es. Endlich.'); return; }
  await s('Du fragst dich, warum Elnon dich nicht ansieht.');
  await s('In der letzten Nacht von Ebaril hat er Kinder durch den Fluchttunnel gebracht. Dann ist er zurückgegangen.');
  await s('Seitdem zählt er. Wie viele er retten kann. Wie viele nicht.');
  markTalked(w, 'k4-faelan');
}

async function tasteStew(w: WorldCtx): Promise<void> {
  if (G.state.is('k4-eintopf')) { await w.think('Noch heiß. Später gibt es mehr.'); return; }
  G.state.set('k4-eintopf');
  sfx('eat', { volume: 0.7 });
  await w.think('Linsen, Speck … und Lorbeer. Genau wie bei Mutter.');
  G.state.addMemory('k4-mem-eintopf');
}

async function dummies(w: WorldCtx): Promise<void> {
  await w.think('Strohpuppen mit aufgemalten Gesichtern. Eine sieht aus wie ein Dunkelschatten. Jemand hat ihr ein Auge ausgestochen.');
}
