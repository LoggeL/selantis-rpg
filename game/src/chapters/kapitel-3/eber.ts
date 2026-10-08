// Scene 'eber' — the Golden Boar as a hub (DESIGN.md §7.4, Kapitel III/1; novel p. 46–54).
// Maps: k3-eber (taproom, 640×360) and k3-stall (stable, 640×360). Heart of the scene: gather clues, combine them on
// the clue board („Lias Notizen“) and know better when Foltan comes back with „Craupor weiß nichts.“
import { G } from '../../core/G';
import type { CharAnim } from '../../art/api';
import { defineMap, type MapDef, type WorldCtx } from '../../world';
import { contradictsFoltan, FINAL } from './deduce';
import { bg, boardCount, lia, sfx, ui, until, walk } from './k3';
import { openClueBoard } from './panels';
import { escortEncounter, playEncounter } from '../common/encounters';

// ---------------------------------------------------------------------------------------------------------------
// Map: the taproom
// ---------------------------------------------------------------------------------------------------------------

const COUNTER_FOLTAN: [number, number] = [504, 134];
const TABLE_STAND: [number, number] = [112, 176];

export const eberMap: MapDef = defineMap({
  id: 'k3-eber',
  name: 'Zum Goldenen Eber',
  background: 'k3-eber',
  player: 'lia-cloak',
  walk: [[
    [14, 112], [60, 104], [108, 100], [150, 96], [250, 84], [330, 80], [498, 80], [512, 110], [523, 140], [535, 170],
    [547, 200], [556, 228], [560, 286], [636, 288], [636, 306], [370, 310], [345, 316], [340, 360], [226, 360], [222, 316],
    [195, 310], [12, 310],
  ]],
  block: [
    { id: 'tisch-spielleute', poly: [[106, 86], [236, 82], [250, 100], [250, 120], [232, 122], [106, 112]] },
    { id: 'tisch-lia', poly: [[58, 132], [192, 130], [206, 138], [206, 154], [176, 160], [58, 160]] },
    { id: 'tisch-reisende', poly: [[16, 192], [120, 192], [134, 198], [134, 208], [96, 220], [16, 220]] },
    { id: 'tisch-haendler', poly: [[138, 192], [238, 192], [252, 198], [252, 214], [222, 230], [138, 230]] },
    { id: 'tisch-ecke', poly: [[0, 262], [66, 262], [78, 272], [78, 302], [0, 302]] },
    { id: 'pfeiler', poly: [[316, 200], [349, 200], [349, 222], [316, 222]] },
    { id: 'faesser', poly: [[580, 284], [620, 284], [620, 302], [580, 302]] },
    { id: 'bank-links', poly: [[0, 108], [22, 108], [22, 142], [0, 142]] },
    { id: 'fass-hinten', poly: [[398, 74], [420, 74], [420, 88], [398, 88]] },
    { id: 'hocker-theke', poly: [[478, 78], [498, 78], [498, 92], [478, 92]] },
  ],
  occluders: [
    { id: 'tisch-spielleute', baseline: 120, poly: [[106, 58], [240, 58], [250, 100], [250, 122], [106, 114]] },
    { id: 'tisch-lia', baseline: 148, poly: [[58, 112], [186, 112], [186, 148], [58, 148]] },
    { id: 'tisch-reisende', baseline: 220, poly: [[14, 164], [136, 164], [136, 222], [14, 222]] },
    { id: 'tisch-haendler', baseline: 230, poly: [[136, 162], [254, 162], [254, 232], [136, 232]] },
    { id: 'tisch-ecke', baseline: 302, poly: [[0, 244], [80, 244], [80, 304], [0, 304]] },
    { id: 'pfeiler', baseline: 221, fade: 0.6, poly: [[315, 106], [351, 106], [351, 224], [315, 224]] },
    { id: 'theke-oben', baseline: 136, poly: [[494, 46], [532, 46], [556, 132], [524, 140], [512, 110], [500, 80]] },
  ],
  surfaces: [{ id: 'dielen', kind: 'wood', poly: [[0, 80], [640, 80], [640, 360], [0, 360]] }],
  surface: 'wood',
  npcs: [
    { id: 'craupor', preset: 'craupor', at: [538, 98], dir: 'left', talk: talkCraupor, verb: 'Reden' },
    { id: 'foltan', preset: 'foltan', at: COUNTER_FOLTAN, dir: 'right', talk: talkFoltanCounter, verb: 'Reden' },
    { id: 'azar', preset: 'azar', at: [198, 150], dir: 'left', idle: 'sit', talk: talkAzar, verb: 'Reden' },
    {
      id: 'schankmaid', preset: 'barmaid', speaker: 'schankmaid', at: [420, 236], wander: 46, speed: 38, talk: talkBarmaid, verb: 'Reden',
      barks: ['Noch ein Eintopf? Kommt!', 'Pfoten weg vom Krug!', 'Wer hat hier verschüttet?'], barkEvery: 9000,
    },
    {
      id: 'spielmann', preset: 'bard', speaker: 'k3-spielmann', at: [262, 132], dir: 'left', talk: talkBard, verb: 'Reden',
      barks: ['♪ Hoch die Krüge! ♪', '♪ Wer nichts wagt … ♪', 'Noch eine Runde für die Musik?'], barkEvery: 7000,
    },
    {
      id: 'gaukler', preset: 'juggler', speaker: 'gaukler', at: [282, 104], dir: 'down', wander: 20, talk: talkJuggler, verb: 'Reden',
      barks: ['Auf nach Trapas!', 'Kettengebäck, frisch vom Fest … fast.', 'Hopp, hopp, hopp!'], barkEvery: 8000,
    },
    {
      id: 'haendler', preset: 'merchant', speaker: 'haendler', at: [195, 248], dir: 'up', talk: talkMerchant, verb: 'Reden',
      barks: ['Die Straßen sind leer wie nie.', 'Zwei Kupfer für den Krug? Wucher!'], barkEvery: 10000,
    },
    {
      id: 'reisender', preset: 'villager-m', speaker: 'k3-reisender', at: [40, 238], dir: 'up', talk: talkTravellers, verb: 'Reden',
      barks: ['Seit Dunkelhain traut sich keiner allein raus.', 'Pst! Nicht so laut.'], barkEvery: 11000,
    },
    {
      id: 'reisende', preset: 'villager-f', speaker: 'k3-reisende', at: [80, 242], dir: 'up', talk: talkTravellers, verb: 'Reden',
      barks: ['Hast du die Kerle gestern gesehen?', 'Ich will nur heim.'], barkEvery: 12000,
    },
    { id: 'zwerg', preset: 'dwarf', speaker: 'zwerg', at: [98, 284], dir: 'left', talk: talkDwarf, verb: 'Reden' },
    { id: 'hund', preset: 'dog', at: [80, 116], dir: 'right', idle: 'lie', solid: false, talk: async w => { void w.actor('hund').emote('heart'); await w.think('Der Hund klopft mit dem Schwanz auf die Dielen. Wenigstens einer, der sich freut.'); }, verb: 'Streicheln' },
  ],
  interactables: [
    {
      id: 'pfeiler', verb: 'Untersuchen', once: false, radius: 26, poly: [[316, 108], [350, 108], [350, 220], [316, 220]],
      onInteract: async w => {
        if (G.state.hasClue('k3-seilfasern')) { await w.think('Hier hat sie gesessen. Festgebunden wie ein Hund.'); return; }
        await w.think(`Kerben im Holz, in Sitzhöhe. Ich sollte genauer hinsehen. (${w.controlHint('look')} halten)`);
      },
    },
    {
      id: 'tisch', verb: 'Notizen ordnen', once: false, poly: [[70, 120], [180, 120], [180, 150], [70, 150]], radius: 30,
      standAt: TABLE_STAND, face: 'up', onInteract: async () => { await openNotes(); },
    },
    {
      id: 'eintopf', verb: 'Probieren', poly: [[96, 122], [130, 122], [130, 136], [96, 136]], radius: 30, once: true,
      when: () => G.state.is('k3-intro'), onInteract: async w => {
        sfx('eat');
        await w.think('Eintopf mit Speck. Azar hat recht, der ist gut. Kyra hätte drei Schüsseln gegessen.');
      },
    },
  ],
  clues: [
    {
      id: 'fasern', at: [333, 230], kind: 'rope', verb: 'Ansehen', clue: 'k3-seilfasern',
      thought: 'Hanffasern, in Sitzhöhe. Und Kratzer von einem Hocker. Hier war jemand angebunden.',
    },
  ],
  triggers: [
    { id: 'theke-lauschen', poly: [[518, 196], [556, 196], [558, 284], [520, 284]], onEnter: overhearCounter },
  ],
  lights: [
    { id: 'kamin', at: [78, 74], kind: 'fire', radius: 120, intensity: 0.75, always: true },
    { id: 'pfeiler-l', at: [313, 150], kind: 'candle', radius: 40, intensity: 0.5, always: true },
    { id: 'pfeiler-r', at: [349, 150], kind: 'candle', radius: 40, intensity: 0.5, always: true },
    { id: 'tisch-1', at: [178, 92], kind: 'candle', radius: 34, intensity: 0.45, always: true },
    { id: 'tisch-2', at: [136, 120], kind: 'candle', radius: 34, intensity: 0.45, always: true },
    { id: 'tisch-3', at: [88, 176], kind: 'candle', radius: 34, intensity: 0.45, always: true },
    { id: 'tisch-4', at: [190, 174], kind: 'candle', radius: 34, intensity: 0.45, always: true },
    { id: 'theke-1', at: [520, 66], kind: 'candle', radius: 34, intensity: 0.45, always: true },
    { id: 'theke-2', at: [566, 170], kind: 'candle', radius: 34, intensity: 0.45, always: true },
    { id: 'theke-3', at: [614, 222], kind: 'candle', radius: 34, intensity: 0.45, always: true },
  ],
  exits: [
    { id: 'hintertuer', to: 'k3-stall', spawn: 'tor', door: { at: [365, 86], verb: 'Zum Stall' } },
    {
      id: 'eingang', poly: [[228, 348], [338, 348], [338, 360], [228, 360]], to: 'k3-eber', spawn: 'eingang',
      when: () => false, blocked: 'Ohne Foltan und Azar gehe ich nirgendwohin.',
    },
  ],
  spawns: {
    eingang: { at: [284, 330], dir: 'up' },
    tuer: { at: [365, 100], dir: 'down' },
    tisch: { at: TABLE_STAND, dir: 'up' },
  },
  time: 'day',
  ambience: ['tavern', 'fire'],
  ambienceVolume: { fire: 0.4 },
  music: 'tavern',
  lookMode: true,
  sneak: true,
  critters: false,
  onEnter: async w => {
    if (G.state.is('k3-foltan-zurueck')) w.actor('foltan').teleport([150, 172], 'up');
  },
});

// ---------------------------------------------------------------------------------------------------------------
// Map: the stable behind the inn
// ---------------------------------------------------------------------------------------------------------------

export const stallMap: MapDef = defineMap({
  id: 'k3-stall',
  name: 'Der Stall',
  background: 'k3-stall',
  player: 'lia-cloak',
  baked: 'night',
  walk: [[
    [56, 112], [100, 110], [500, 110], [492, 140], [500, 170], [545, 178], [566, 180], [568, 236], [612, 240], [620, 262],
    [450, 282], [450, 360], [186, 360], [186, 282], [0, 272], [0, 250], [20, 200], [40, 150],
  ]],
  block: [
    { id: 'balken', poly: [[144, 194], [173, 194], [173, 214], [144, 214]] },
    { id: 'sack', sight: false, poly: [[174, 194], [204, 194], [204, 210], [174, 210]] },
  ],
  occluders: [
    { id: 'balken', baseline: 212, poly: [[144, 96], [173, 96], [173, 214], [144, 214]] },
    { id: 'boxen', baseline: 112, poly: [[96, 64], [524, 64], [524, 112], [96, 112]] },
  ],
  surfaces: [{ id: 'stroh', kind: 'dirt', poly: [[0, 100], [640, 100], [640, 300], [0, 300]] }],
  surface: 'dirt',
  npcs: [
    { id: 'pferd', preset: 'horse', at: [452, 150], dir: 'left', idle: 'graze' as CharAnim, talk: async w => { sfx('horse', { volume: 0.5 }); await w.think('Ein brauner Wallach mit Händlersattel. Nicht ihrer. Die Dunkelschatten sind längst fort.'); }, verb: 'Ansehen' },
  ],
  interactables: [
    {
      id: 'kette', verb: 'Untersuchen', once: false, radius: 26, poly: [[146, 120], [172, 120], [172, 192], [146, 192]],
      onInteract: async w => {
        if (G.state.hasClue('k3-kette')) { await w.think('Die Fußschelle. Klein genug für Kyras Knöchel.'); return; }
        sfx('chain', { volume: 0.7 });
        await w.player.play('kneel', { ms: 900 });
        G.state.addClue('k3-kette');
        await w.think('Eine Kette am Ring, mit einer offenen Fußschelle. Frisch geölt … nein. Frisch *benutzt*.');
        if (!G.state.hasClue('k3-haarband')) await w.think(`Wenn hier noch etwas ist, sehe ich es nur, wenn ich genau hinsehe. (${w.controlHint('look')} halten)`);
      },
    },
    {
      id: 'sack', verb: 'Untersuchen', once: false, radius: 24, poly: [[174, 184], [206, 184], [206, 210], [174, 210]],
      onInteract: async w => {
        if (G.state.hasClue('k3-kornsack')) { await w.think('Sie hat sich damit zugedeckt. Sie hat gefroren.'); return; }
        G.state.addClue('k3-kornsack');
        await w.think('Ein leerer Kornsack, zerknüllt wie eine Decke. Jemand hat hier im Stroh geschlafen und gefroren.');
      },
    },
    {
      id: 'mondlicht', verb: 'Nach oben sehen', once: false, at: [340, 150], radius: 26,
      onInteract: async w => {
        w.player.face('up');
        if (G.state.data.memories.includes('k3-mem-crios')) { await w.think('Crios. Halt durch, Kyra.'); return; }
        await w.wait(500);
        await w.think('Durch das morsche Dach sieht man die Sterne. Und da, ganz hell, im Westen …');
        await w.think('Crios. Sie hat hier gelegen und ihn gesehen. In derselben Nacht wie ich.');
        G.state.addMemory('k3-mem-crios');
      },
    },
  ],
  clues: [
    {
      id: 'haarband', at: [118, 238], kind: 'glint', verb: 'Aufheben', onInteract: async w => {
        await w.player.play('kneel', { ms: 800 });
        G.state.give('ribbon');
        G.state.addClue('k3-haarband');
        await w.say('k3-lia', 'Kyras Haarband … Sie war hier. Kyra war wirklich hier!', { mood: 'surprised' });
      },
    },
    { id: 'kratzer', at: [160, 222], kind: 'mark', thought: 'Kratzspuren im Lehm, wo die Kette über den Boden schleifte.' },
  ],
  lights: [
    { id: 'laterne', at: [32, 96], kind: 'lantern', radius: 90, intensity: 0.9, always: true },
    { id: 'mond-1', at: [330, 150], kind: 'moon', radius: 50, intensity: 0.35 },
    { id: 'mond-2', at: [470, 150], kind: 'moon', radius: 46, intensity: 0.3 },
  ],
  exits: [{ id: 'zurueck', poly: [[190, 346], [446, 346], [446, 360], [190, 360]], to: 'k3-eber', spawn: 'tuer' }],
  spawns: { tor: { at: [318, 300], dir: 'up' } },
  time: 'night',
  ambience: ['night', 'crickets', 'tavern'],
  ambienceVolume: { tavern: 0.25, crickets: 0.6 },
  music: 'tavern',
  playerLight: 50,
  lookMode: true,
  critters: false,
});

// ---------------------------------------------------------------------------------------------------------------
// Hub: talk handlers
// ---------------------------------------------------------------------------------------------------------------

async function openNotes(): Promise<void> {
  await openClueBoard();
  if (G.state.hasClue(FINAL) && !G.state.is('k3-final-gedacht')) {
    G.state.set('k3-final-gedacht');
    await G.ui.think('Kyra lebt. Ich muss es Foltan sagen. Er kann nicht behaupten, sie sei nie hier gewesen.');
  }
  updateObjective();
}

function updateObjective(): void {
  if (G.state.is('k3-bereit')) return;
  const story = G.state.is('k3-azar-geschichte');
  if (!story && boardCount() >= 2) {
    G.state.objective('k3-umhoeren', 'Azar winkt dich an den Tisch.');
  } else if (story && boardCount() >= 3) {
    G.state.objective('k3-umhoeren', G.state.hasClue(FINAL)
      ? 'Sprich mit Azar: Foltan soll zurückkommen.'
      : 'Ordne deine Hinweise (Tisch oder Notizen). Wenn du genug weißt: Sprich mit Azar.');
  }
}

async function talkAzar(w: WorldCtx): Promise<void> {
  const azar = w.actor('azar');
  if (!G.state.is('k3-azar-geschichte') && boardCount() >= 2) { await azarStory(w); return; }
  if (G.state.is('k3-azar-geschichte') && boardCount() >= 3) {
    await azar.say(G.state.hasClue(FINAL) ? 'Du hast was rausgefunden, das sehe ich dir an. Soll ich den feinen Herrn holen?' : 'Na, Spürnase? Genug geschnüffelt? Dann hole ich Foltan von der Theke.', { mood: 'happy' });
    const pick = await w.choose(['„Hol ihn. Ich will hören, was Craupor weiß.“', '„Gleich. Ich sehe mich noch um.“', '„Ich ordne erst meine Notizen.“']);
    if (pick === 0) { G.state.set('k3-bereit'); return; }
    if (pick === 2) await openNotes();
    return;
  }
  const n = G.state.inc('k3-azar-plausch');
  const lines = [
    'Der Eintopf! Extra Speck! Craupor ist ein Künstler. Ein dürrer, glatzköpfiger Künstler.',
    'Geh nur und sieh dich um. Aber trink das Dünnbier nicht in einem Zug. Lass dir das von einem Fachmann sagen.',
    'Stille Wasser sind tief, Lia. Und laute Schenken haben viele Ohren. Hör dich um.',
  ];
  await azar.say(lines[(n - 1) % lines.length], { mood: 'happy' });
  if (boardCount() > 0) {
    const pick = await w.choose(['„Ich ordne meine Notizen.“', '„Bis gleich.“']);
    if (pick === 0) await openNotes();
  }
}

/** Azar secretly tells Foltan's desertion story while Foltan talks to Craupor (novel p. 53–54). */
async function azarStory(w: WorldCtx): Promise<void> {
  const azar = w.actor('azar');
  G.state.set('k3-azar-geschichte');
  await w.cutscene(async () => {
    await walk(w, 'player', TABLE_STAND, { face: 'up' });
    w.player.teleport([112, 160], 'right');
    w.player.setIdle('sit');
    await lia(w, 'Azar … wieso helft ihr mir eigentlich? Ich bin euch dankbar. Aber was habt ihr davon?');
    void azar.emote('…');
    await azar.say('Hm. Du willst es wirklich wissen.', { mood: 'worried' });
    await w.camera.pan('foltan', 900);
    await azar.say('Foltan war Leutnant in der Garde von Portas. Ein Pedant. Treu bis in die Stiefelspitzen.');
    await azar.say('Sie schickten ihn mit einer Strafexpedition zu Bauern, die zu wenig Steuern an den Rat gezahlt hatten.', { mood: 'sad' });
    await azar.say('Auf den Höfen war nichts zu holen. Da haben sie die Bauern gequält, damit sie ihre Verstecke verraten.', { mood: 'sad' });
    await azar.say('Aber die hatten nichts. Gar nichts. Jeder Schlag umsonst.', { mood: 'sad' });
    await azar.say('Dann befahl der Hauptmann, die Frauen und Kinder hinzurichten. Vor den Augen ihrer Männer.', { mood: 'sad' });
    await w.camera.pan('azar', 700);
    await lia(w, '…', 'scared');
    await azar.say('Foltan hat sich geweigert. Der Hauptmann hat es trotzdem getan. Auf dem Rückweg ist Foltan desertiert.');
    await azar.say('Seitdem hilft er denen, denen er damals nicht helfen konnte. Darum sind wir hier.');
    void azar.emote('drop');
    await azar.say('Ich habe dir das natürlich nicht erzählt.', { mood: 'worried' });
    const pick = await w.choose(['„Ich weiß gar nicht, wovon du sprichst.“', '„Warum erzählst du es mir dann?“', '„Danke, Azar.“']);
    if (pick === 0) await azar.say('Sehr gut. Du lernst schnell.', { mood: 'happy' });
    else if (pick === 1) await azar.say('Weil du wissen sollst, dass er ein guter Mann ist. Auch wenn er einen Stock im Hintern hat.', { mood: 'happy' });
    else await azar.say('Wofür? Ich hab nichts gesagt. Ich esse nur Eintopf.', { mood: 'happy' });
    w.player.setIdle('idle');
    w.player.teleport(TABLE_STAND, 'down');
  });
  updateObjective();
}

async function talkFoltanCounter(w: WorldCtx): Promise<void> {
  const foltan = w.actor('foltan');
  const n = G.state.inc('k3-foltan-theke');
  if (n === 1) {
    await foltan.say('Gleich, Lia. Craupor und ich haben noch zu reden. Setz dich zu Azar.');
    await lia(w, 'Es geht um meine Schwester. Ich kann still danebensitzen.', 'angry');
    await foltan.say('Du? Still? Geh schon.');
  } else {
    await foltan.say(['Gleich, habe ich gesagt.', 'Lia. Bitte.', 'Geduld ist eine Tugend. Azar hat davon auch keine.'][(n - 2) % 3]);
  }
}

async function talkCraupor(w: WorldCtx): Promise<void> {
  const craupor = w.actor('craupor');
  void craupor.emote('drop');
  await craupor.say('Ah, die junge Dame! Foltans Freunde essen bei mir umsonst. Ehrensache.', { mood: 'happy' });
  await lia(w, 'Waren gestern Dunkelschatten hier? Mit einem Mädchen, so groß wie ich?');
  await craupor.say('Ich, äh … Sprich mit Foltan, Mädchen. Das ist besser so.', { mood: 'worried' });
  await w.think('Er weicht meinem Blick aus. Er weiß etwas.');
}

async function talkBarmaid(w: WorldCtx): Promise<void> {
  const maid = w.actor('schankmaid');
  maid.hold(true);
  try {
    if (G.state.hasClue('k3-schminke')) {
      await maid.say('Mein schönes Täschchen. Den Puder hab ich drei Wochen gespart.');
      return;
    }
    void maid.emote('anger');
    await maid.say('Frag mich bloß nichts. Ich bin heute nicht in Stimmung.');
    const pick = await w.choose(['„Was ist denn passiert?“', '„Schon gut.“']);
    if (pick === 1) return;
    await maid.say('Gestern Abend. Fünf Kerle in Schwarz-Weiß. Haben gesoffen und mich angegrabscht.');
    await maid.say('Und heute früh nimmt mir der Kahle mit der roten Glatze mein Schminktäschchen weg! „Geliehen“, sagt er.');
    await lia(w, 'Wofür braucht ein Dunkelschatten Schminke?');
    await maid.say('Für das Mädchen, das sie dabeihatten. Sie soll ihrem Hauptmann gefallen, hat er gesagt. Pah!');
    G.state.addClue('k3-schminke');
    await w.think('Ein Mädchen. Für einen Hauptmann. Kyra …');
  } finally { maid.hold(false); }
}

async function talkBard(w: WorldCtx): Promise<void> {
  const bard = w.actor('spielmann');
  if (G.state.hasClue('k3-wette')) {
    await bard.say('Wir spielen in Trapas am Tempelplatz. Komm vorbei, wenn du kannst. Und pass auf dich auf.');
    return;
  }
  await bard.say('Ein Lied gefällig, junge Dame? Wir ziehen zum Verbannungsfest. Das Räuberlied kennt dort jedes Kind.', { mood: 'happy' });
  const pick = await w.choose(['„Waren gestern Dunkelschatten hier?“', '„Spielt weiter, es ist schön.“']);
  if (pick === 1) { await bard.say('Für dich doch gern!'); return; }
  void bard.emote('…');
  await bard.say('Pst. Fünf Stück. Am Tisch da drüben haben sie geprahlt, so laut, dass wir kaum mehr spielen konnten.');
  await bard.say('Ein neues Dienstmädchen für ihren Hauptmann, hieß es. Und sie haben gewettet, wie lange sie durchhält.');
  await bard.say('„Drei Wochen“, sagte der Kahle. Die anderen lachten. Wir haben danach extra laut gespielt.');
  G.state.addClue('k3-wette');
  await lia(w, 'Sie wetten auf ihr Leben …', 'angry');
}

async function talkJuggler(w: WorldCtx): Promise<void> {
  const j = w.actor('gaukler');
  if (G.state.is('k3-gaukler')) { await j.say('Iss das Kettengebäck, bevor es hart wird! Hopp!'); return; }
  G.state.set('k3-gaukler');
  await j.say('Na, Kleine? Auch auf dem Weg nach Trapas? Das Verbannungsfest! Tempel, Tanz und Kettengebäck!', { mood: 'happy' });
  await lia(w, 'Klein? Ich bin sechzehn. Und nein, ich war noch nie auf dem Fest.');
  await j.say('Nie? Dann weißt du ja gar nicht, warum die Kringel Ketten sind!');
  await j.say('Die Zehn Götter brachen die Ketten der Xenovia und verbannten sie auf den Meeresgrund. Und wir essen die Ketten auf!');
  G.state.addLore('k3-lore-verbannungsfest');
  await j.say('Hier. Eins hab ich übrig. Ein bisschen zerdrückt, aber süß.');
  G.state.give('chain-pastry');
  await w.think('Kettengebäck … Vater hat es jedes Jahr mitgebracht. „Für das Fest seid ihr noch zu jung.“');
  G.state.addMemory('k3-mem-fest');
}

async function talkMerchant(w: WorldCtx): Promise<void> {
  const m = w.actor('haendler');
  if (G.state.is('k3-haendler')) { await offerEscort(w); return; }
  G.state.set('k3-haendler');
  await m.say('Die Straße nach Portas ist leer wie nie. Wer reist, reist in Gruppen. Oder gar nicht.');
  await m.say('Und der Rat der Drei? Hockt in Trapas. Ihr Großmeister soll verrückt sein. Jagt fremde Kulte statt Räuber.');
  G.state.addLore('k3-lore-rat-der-drei');
  await lia(w, 'Und wer schützt die Höfe?');
  await m.say('Niemand, Kind. Niemand.');
  await offerEscort(w);
}

async function offerEscort(w: WorldCtx): Promise<void> {
  if (G.state.is('k3-begleitung-erledigt')) {
    await w.say('haendler', 'Mein Reisegefährte ist sicher angekommen. Gute Reise euch, und danke noch einmal.');
    return;
  }
  await w.say('haendler', 'Mein Reisegefährte wartet im Stall. Bringt ihr ihn bis zum Wegzeichen? Dort lungern Räuber. Ich zahle mit Brot und Wundtinktur.');
  const pick = await w.choose(['„Wir suchen meine Schwester. Heute nicht.“', '„Foltan, Azar, helft ihr mir dabei?“']);
  if (pick === 0) return;
  await w.say('foltan', 'Bis zum Wegzeichen. Danach gehen wir unserer eigenen Sache nach.');
  await w.narrate('Zu viert treten sie vor die Schenke. Hinter der Wegbiegung stehen drei Gestalten auf der Straße.', { style: 'card' });
  const result = await playEncounter(w, escortEncounter(), 'k3-begleitung-erledigt', () => {
    G.state.give('bread'); G.state.give('tincture');
  });
  if (result.outcome === 'win') {
    await w.say('haendler', 'Er ist bei den anderen. Hier, wie versprochen. Und danke.');
    await w.think('Wir haben nicht jeden Räuber erwischt. Mussten wir auch nicht. Hauptsache, er ist durchgekommen.');
  }
}

async function talkTravellers(w: WorldCtx): Promise<void> {
  if (G.state.is('k3-reisende')) { await w.say('k3-reisende', 'Gute Reise. Und Augen auf.'); return; }
  G.state.set('k3-reisende');
  await w.say('k3-reisender', 'Wir sind auf dem Weg nach Trapas. Hinter den Mauern ist man sicher. Sagt man.');
  await w.say('k3-reisende', 'Seit Dunkelhain machen die Fürsten abends die Tore zu. Wer dann noch draußen steht, hat eben Pech.');
  G.state.addLore('k3-lore-nach-dunkelhain');
  await w.say('k3-reisender', 'Die Kerle gestern … die saßen genau hier. Wir haben kein Wort gesagt. Kein einziges.');
}

async function talkDwarf(w: WorldCtx): Promise<void> {
  const z = w.actor('zwerg');
  if (G.state.hasClue('k3-zwerg')) { await z.say('Ich trinke auf sie. Mehr kann ich nicht.'); return; }
  const leverage = G.state.hasClue('k3-seilfasern') || G.state.hasClue('k3-haarband') || G.state.hasClue('k3-schminke') || G.state.hasClue('k3-wette');
  if (!leverage) {
    await z.say('Lass mich in Ruhe, Mädchen. Ich hab heute schon genug falsch gemacht.');
    const pick = await w.choose(['„Was hast du denn falsch gemacht?“', '„Schon gut.“']);
    if (pick === 0) await z.say('Geht dich nichts an. Hau ab.');
    await w.think('Er starrt in seinen Krug, als hätte er Angst vor dem, was er darin sieht.');
    return;
  }
  await lia(w, 'Gestern war ein Mädchen hier. Am Pfeiler festgebunden. Du hast sie gesehen.');
  void z.emote('drop');
  await z.say('… Ja. Hat mir ein Bein gestellt, als ich raus wollte. Und mir dann ins Ohr gezischt: „Hilf mir, oder du bist kein Zwerg.“', { mood: 'neutral' });
  await z.say('Und ich hab gesagt: „Geht mich nen Dreck an.“ Fünf Kerle in Schwarz-Weiß. Ich bin ein Zwerg, kein Narr.');
  await z.say('Im Morgengrauen sind sie los. Nach Osten, den Waldweg. Sie musste hinter den Pferden herlaufen.');
  G.state.addClue('k3-zwerg');
  const pick = await w.choose(['„Sie ist meine Schwester!“', '„Du hattest Angst.“', '(Schweigen)']);
  if (pick === 0) await z.say('Ich weiß. Ich seh’s an deinen Augen. Und ich trink seitdem auf ihr Wohl. Das ist alles, was ich kann.');
  else if (pick === 1) await z.say('Angst. Ja. Sag ihr, wenn du sie findest … sie war tapferer als drei Zwerge zusammen.');
  else { void z.emote('…'); await z.say('Schau mich nicht so an. Ich schau mich selbst schon so an.'); }
}

async function overhearCounter(w: WorldCtx): Promise<void> {
  if (G.state.hasClue('k3-fuenf') || G.state.is('k3-foltan-zurueck')) return;
  w.bark('craupor', '… fünf Mann, sag ich dir. Und das Mädchen bei sich.', 3200);
  await w.wait(1600);
  w.bark('foltan', 'Leiser, Craupor!', 2000);
  await w.wait(1400);
  G.state.addClue('k3-fuenf');
  await w.think('Fünf Mann. Und ein Mädchen. Ich habe es genau gehört.');
  w.actor('foltan').face('player');
  await w.actor('foltan').say('Lia? Du sollst bei Azar sitzen. Ich komme gleich.');
  w.actor('foltan').face('right');
}

// ---------------------------------------------------------------------------------------------------------------
// Main script
// ---------------------------------------------------------------------------------------------------------------

async function intro(w: WorldCtx): Promise<void> {
  const foltan = w.actor('foltan'), azar = w.actor('azar');
  await w.cutscene(async () => {
    await w.wait(300);
    bg(walk(w, 'azar', [300, 290]));
    await walk(w, 'foltan', [266, 292]);
    await azar.say('Erstaunlich viel los für eine Schenke mitten im Nirgendwo!', { mood: 'happy' });
    await foltan.say('Craupors Gastfreundschaft hat sich herumgesprochen. Und bald ist das Verbannungsfest in Trapas.');
    w.bark('spielmann', '♪ Hoch die Krüge! ♪', 2200);
    await foltan.say('Das zieht allerlei Gaukler und Gesindel an. Nur noch Saufen und Schlemmen, das Fest.');
    await azar.say('Gegen ein zünftiges Festmahl ist nichts einzuwenden!', { mood: 'happy' });
    // To the table in the back-left corner (the barmaid is already on her way).
    const maid = w.actor('schankmaid');
    maid.hold(true);
    bg(walk(w, 'schankmaid', [150, 178], { face: 'up' }, 6000));
    bg(walk(w, 'azar', [214, 152]));
    await walk(w, 'foltan', [44, 156]);
    foltan.teleport([46, 150], 'right'); foltan.setIdle('sit');
    await walk(w, 'player', TABLE_STAND);
    azar.teleport([198, 150], 'left'); azar.setIdle('sit');
    w.player.teleport([112, 160], 'right'); w.player.setIdle('sit');
    await walk(w, 'schankmaid', [150, 178], { face: 'up' }, 1500);
    await w.say('schankmaid', 'Was darf’s sein?');
    await foltan.say('Zwei Metbier und ein Dünnbier für die Kleine.');
    await lia(w, 'Die Kleine kann ihr Getränk auch selbst bestellen.', 'angry');
    await foltan.say('Und dreimal Eintopf.');
    await azar.say('Bei mir bitte mit extra viel Speck!', { mood: 'happy' });
    await w.say('schankmaid', 'Wie immer umsonst, nehme ich an?');
    await foltan.say('So ist es. Richte Craupor aus, dass ich später mit ihm reden will.');
    maid.hold(false);
    bg(maid.walkTo([420, 236]));
    await azar.say('Umsonst? Das ist ja nicht das erste Mal, dass du hier umsonst einkehrst.');
    await foltan.say('Sagen wir: Craupor schuldet mir einen großen Gefallen.');
    await azar.say('Ich bin ganz Ohr.', { mood: 'happy' });
    // Foltan's story (painted plate).
    try { ui().prefetchPlate('k3-craupor'); } catch { /* */ }
    await foltan.say('Als ich noch in der Garde von Portas diente, eskortierten wir einen Kaufmann nach Trapas.');
    await G.ui.plate('k3-craupor', { caption: 'Wie Foltan Craupor kennenlernte', pan: 'in', durationMs: 18000 });
    await foltan.say('Wir betraten die Schenke: Bänke umgestoßen, Krüge zerschlagen. Eine Banditenbande hatte es sich gemütlich gemacht.');
    await foltan.say('Und den guten Craupor hatten sie kopfüber an einen Balken gehängt …');
    await azar.say('Lass mich raten. Du hast ihn heldenhaft befreit, und er hat dir ewigen Dank geschworen.', { mood: 'happy' });
    await G.ui.closePlate();
    await foltan.say('Spielverderber. So macht Geschichtenerzählen keinen Spaß.', { mood: 'angry' });
    sfx('thud', { volume: 0.4 });
    await w.say('narrator', 'Die Schankmaid stellt drei dampfende Schüsseln und die Krüge auf den Tisch.');
    const sip = await w.choose(['Am Dünnbier nippen', 'Den Krug zur Seite schieben']);
    if (sip === 0) {
      await w.think('Bitter. Bitter und widerlich.');
      await azar.say('Da sieh mal an! Da hat jemand gerade seinen ersten Schluck Alkohol getrunken!', { mood: 'happy' });
      await lia(w, 'Ich verstehe nicht, wie man so etwas freiwillig trinken kann.', 'angry');
      await azar.say('Nach dem dritten schmeckt’s!', { mood: 'happy' });
      await foltan.say('So weit lassen wir es nicht kommen.');
      G.state.set('k3-duennbier');
    } else {
      await azar.say('Nicht durstig? Dann trinke ich es. Wäre doch schade drum.', { mood: 'happy' });
    }
    await foltan.say('Lia. Beschreib mir deine Schwester. Ich frage Craupor, ob in letzter Zeit Dunkelschatten hier waren.');
    const desc = await w.choose(['„So groß wie ich. Lange braune Haare, ein beiges Kleid.“', '„Braune Haare, braune Augen. Und ein Mundwerk, vor dem sich das halbe Dorf fürchtet.“']);
    if (desc === 0) await foltan.say('Ich werde sehen, was sich machen lässt.');
    else { await azar.say('Ein Mundwerk? Die gefällt mir.', { mood: 'happy' }); await foltan.say('Ich werde sehen, was sich machen lässt.'); }
    // Optional question
    const ask = await w.choose(['„Was sind das für Rebellen, zu denen ihr gehört?“', '„Warum seid ihr eigentlich Freischärler?“']);
    if (ask === 0) {
      await foltan.say('Pscht! Nicht so laut. Wer weiß, wer hier zuhört.', { mood: 'angry' });
      await foltan.say('Seit Dunkelhain verkriechen sich die Fürsten in ihren Städten und überlassen das Land den Dunkelschatten.');
      await foltan.say('Wir von der Freien Bruderschaft haben uns vom Dienst der Hohen losgesagt. Wir jagen das Pack.');
      G.state.addLore('k3-lore-nach-dunkelhain');
      G.state.addLore('k3-lore-bruderschaft');
    } else {
      await foltan.say('Kurzfassung: Ich habe einen Befehl verweigert und die Garde verlassen. Azar hat Schulden. Den Rest ersparen wir dir.');
      await lia(w, 'Welchen Befehl?');
      await foltan.say('Kurzfassung, sagte ich.', { mood: 'angry' });
      G.state.addLore('k3-lore-bruderschaft');
    }
    await foltan.say('Haltet hier die Stellung.');
    foltan.setIdle('idle');
    foltan.teleport([44, 156], 'right');
    w.player.setIdle('idle');
    w.player.teleport([112, 196], 'up');
    await walk(w, 'foltan', COUNTER_FOLTAN, { face: 'right' }, 7000);
    w.bark('craupor', 'Foltan! Alter Freund!', 2400);
    w.player.teleport(TABLE_STAND, 'down');
    await w.wait(300);
    await w.think('Ich sitze hier nicht herum. Wenn Kyra hier war, hat irgendwer etwas gesehen.');
  });
  foltan.hold(false); azar.hold(false);
  G.state.set('k3-intro');
  G.state.give('k3-notizen');
  await w.say('narrator', 'Lia kramt ein Stück Papier und einen Kohlestift aus dem Beutel. *Lias Notizen* liegen jetzt in der Tasche.');
  await w.say('narrator', `Sprich mit den Gästen und untersuche die Schenke (${w.controlHint('look')} halten für den Spurenblick). Hinweise kombinierst du am Tisch oder in den Notizen.`);
}

/** Foltan returns from the counter: „Craupor weiß nichts.“ — and the player knows better. */
async function foltanReturns(w: WorldCtx): Promise<void> {
  const foltan = w.actor('foltan'), azar = w.actor('azar');
  G.state.complete('k3-umhoeren');
  const knows = contradictsFoltan(G.state.data.clues, G.state.has('ribbon'));
  if (knows) G.state.set('k3-luege-bemerkt');
  await w.cutscene(async () => {
    foltan.hold(true);
    await walk(w, 'player', TABLE_STAND, { face: 'up' });
    azar.face('player');
    await azar.say('He! Foltan! Die Kleine ist ungeduldig!', { mood: 'happy' });
    await w.camera.pan('foltan', 700);
    w.bark('craupor', 'Viel Glück, Foltan.', 1800);
    await walk(w, 'foltan', [150, 174], { face: 'left' }, 7000);
    G.state.set('k3-foltan-zurueck');
    await w.camera.pan('player', 600);
    await lia(w, 'Und? Hat er etwas gesehen?');
    void foltan.emote('…');
    await foltan.say('Nein, leider nicht. Craupor weiß nichts.');
    if (!knows) {
      await lia(w, 'Nichts? Gar nichts?', 'sad');
      await w.think('Ich hätte schwören können, dass hier … Nein. Hoffnung ist dumm.');
      await foltan.say('Iss auf. Wir haben noch ein gutes Stück Weg vor uns.');
    } else {
      sfx('heartbeat', { volume: 0.6 });
      await w.think('Er lügt. Kyra war hier. Ich habe es schwarz auf weiß in meinen Notizen.');
      const opts: string[] = ['„Das stimmt nicht! Sie war hier. Ich habe ihr Haarband gefunden!“', '(Nichts sagen. Ihn beobachten.)'];
      const fuenf = G.state.hasClue('k3-fuenf');
      if (fuenf) opts.splice(1, 0, '„Und die fünf Mann mit dem Mädchen, von denen Craupor sprach?“');
      const pick = await w.choose(opts);
      const choice = opts[pick];
      if (choice.includes('Haarband') && G.state.has('ribbon')) {
        G.state.set('k3-foltan-konfrontiert');
        await foltan.say('Ein Haarband. Davon gibt es tausende zwischen Trapas und Portas.', { mood: 'angry' });
        await lia(w, 'Es ist *ihres*! Ich würde es unter tausend erkennen!', 'angry');
        void azar.emote('drop');
        await foltan.say('Craupor hat sie nicht gesehen. Belassen wir es dabei.');
        await w.think('Azar sieht auf seine Schüssel. Er sagt kein Wort.');
      } else if (choice.includes('Haarband')) {
        G.state.set('k3-foltan-konfrontiert');
        await foltan.say('Und wo ist dieses Haarband?');
        await w.think('… Ich habe es nicht mitgenommen. Verflucht.');
        await foltan.say('Siehst du. Craupor hat nichts gesehen.');
      } else if (choice.includes('fünf Mann')) {
        G.state.set('k3-foltan-konfrontiert');
        void foltan.emote('!');
        await foltan.say('Du hast gelauscht?', { mood: 'angry' });
        await foltan.say('Fünf Mann und ein Mädchen – das sagt gar nichts. Solche Trupps ziehen jede Woche durch.', { mood: 'angry' });
        await w.think('Er sieht mich nicht an, wenn er das sagt.');
      } else {
        G.state.set('k3-geschwiegen');
        await w.think('Er lügt. Und er weiß, dass er lügt. Ich merke mir das, Foltan.');
      }
    }
    await foltan.say('Wir sollten weiterziehen. Hier zu übernachten ist mir zu unsicher.');
    await foltan.say('Man weiß nie, wer sonst noch so unter einem Dach schläft.');
    await azar.say('Und mein zweiter Teller Eintopf?', { mood: 'sad' });
    await foltan.say('Wird kalt. Los.');
    azar.setIdle('idle');
    azar.teleport([214, 152], 'down');
    bg(walk(w, 'azar', [284, 330]));
    bg(walk(w, 'foltan', [270, 336]));
    await walk(w, 'player', [290, 345]);
  });
}

export async function eberScript(w: WorldCtx): Promise<void> {
  if (!G.state.is('k3-intro')) {
    // The three come in together: place Foltan and Azar at the door before anything is visible.
    const foltan = w.actor('foltan'), azar = w.actor('azar');
    foltan.hold(true); azar.hold(true);
    foltan.teleport([266, 328], 'up'); azar.teleport([304, 334], 'up');
    azar.setIdle('idle');
    await G.ui.chapterCard('III', 'Der Goldene Eber', 'Eine Schenke an der Handelsstraße');
    void ui().fade('in', 700);
    await w.narrate([
      'Am Abend standen sie vor einer Hausfassade mitten im Nirgendwo. An einer Kette baumelte ein Schild in Form eines Wildschweins.',
      '„Zum Goldenen Eber“, las Lia in großen Lettern. Azar leckte sich die Lippen.',
    ], { style: 'card' });
    await intro(w);
  } else {
    w.player.setIdle('idle');
    void ui().fade('in', 400);
  }
  if (!G.state.is('k3-azar-geschichte')) w.setObjective('k3-umhoeren', 'Hör dich im Goldenen Eber um: War Kyra hier?', G.state.hasClue('k3-seilfasern') ? null : 'pfeiler');
  updateObjective();
  // Azar waves Lia over once she has something.
  const unsubs: (() => void)[] = [];
  unsubs.push(w.on('clue', '*', () => { if (G.state.hasClue('k3-seilfasern')) w.setObjectiveTarget(null); }));
  bg((async () => {
    while (w.alive && !G.state.is('k3-azar-geschichte')) {
      await w.wait(7000);
      if (boardCount() >= 2 && !G.state.is('k3-azar-geschichte') && w.map.id === 'k3-eber') {
        w.bark('azar', 'Psst! Lia! Komm mal her.', 2600);
        w.setObjectiveTarget('azar');
      }
    }
  })());
  unsubs.push(G.events.on('clue:gained', () => { if (G.currentScene === 'eber') updateObjective(); }));
  await until(w, () => G.state.is('k3-bereit'));
  if (w.map.id !== 'k3-eber') await w.changeMap('k3-eber', 'tisch');
  await foltanReturns(w);
  unsubs.forEach(u => u());
  await ui().fade('out', 700);
  await G.goto('leselager');
}
