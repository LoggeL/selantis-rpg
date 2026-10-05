// Scene „verrat“ (DESIGN.md §7.4, Kapitel IV/3): early evening, everyone at supper. Lia slips away from Azar and
// sneaks through the busy camp to Elnon's tent, overhears Foltan admit what Craupor told him, and flees into the
// night forest. Narrator: Azar confronts Foltan and searches in vain. Party = [] → Kapitel V „regenwald“.
import { G } from '../../core/G';
import type { CharAnim } from '../../art/api';
import type { SfxLoop } from '../../audio/api';
import type { UiApiExt } from '../../ui';
import { defineMap, type GuardDef, type WorldCtx } from '../../world';
import { DUCK_ZONE, waldpfadBase } from './augenbinde';
import { campBase, CAMP_HIDING } from './lager';
import { bg, gotoNextChapter, lia, sfx } from './shared';

const guard = (def: GuardDef): GuardDef => ({ reaction: 1.4, range: 96, fov: 76, ...def });

export const lagerAbend = defineMap({
  ...campBase,
  id: 'k4-lager-abend',
  name: 'Das Lager am Abend',
  hidingSpots: CAMP_HIDING,
  npcs: [
    { id: 'k4-berta', preset: 'villager-f', at: [604, 376], dir: 'up', idle: 'sit', barks: ['Nachschlag gibt’s nur für Helfer!', 'Wer hat schon wieder Salz verschüttet?'], barkEvery: 8000 },
    { id: 'k4-ilvy', preset: 'elf-f', at: [676, 374], dir: 'up', idle: 'sit', barks: ['… und dann fiel die Brücke.', 'Gib mir das Brot.'], barkEvery: 9500 },
    { id: 'k4-faelan-sitz', preset: 'elf-m', at: [526, 356], dir: 'right', idle: 'sit' },
  ],
  guards: [
    guard({
      id: 'azar', preset: 'azar', speaker: 'azar', speed: 30,
      path: [{ at: [572, 292], wait: 3600, face: 'up' }, { at: [500, 384], wait: 1800, face: 'left' }, { at: [640, 448], wait: 1800, face: 'down' }, { at: [744, 392], wait: 1800, face: 'right' }],
      suspiciousBarks: ['Lia? Bist du das?', 'Hm? Wo ist sie hin?'], calmBarks: ['Ach, nur ein Schatten.', 'Sie kommt schon wieder.'],
    }),
    guard({
      id: 'k4-jorin', preset: 'villager-m', speaker: 'k4-jorin', mode: 'pingpong', lantern: true,
      path: [{ at: [150, 318], wait: 1700, face: 'up' }, { at: [336, 318], wait: 1700, face: 'up' }],
      suspiciousBarks: ['Wer da?', 'Hat da was geraschelt?'], calmBarks: ['Nur eine Katze.', 'Ich seh schon Gespenster.'],
    }),
    guard({
      id: 'k4-gundrik', preset: 'dwarf', speaker: 'k4-gundrik', speed: 26,
      path: [{ at: [852, 380], wait: 2200, face: 'left' }, { at: [884, 292], wait: 1800, face: 'down' }, { at: [780, 254], wait: 2000, face: 'left' }],
      suspiciousBarks: ['Hä?', 'Wer schleicht da rum?'], calmBarks: ['Pah. Einbildung.'],
    }),
    guard({
      id: 'k4-faelan', preset: 'elf-m', speaker: 'k4-faelan', mode: 'pingpong', speed: 24, range: 84, fov: 64, reaction: 1.6,
      path: [{ at: [430, 238], wait: 2000, face: 'right' }, { at: [862, 242], wait: 2000, face: 'left' }],
      suspiciousBarks: ['…?'], calmBarks: ['Der Wind.'],
    }),
    guard({ id: 'k4-wache', preset: 'guard-brotherhood', speaker: 'k4-wache', path: [{ at: [634, 560], face: 'down' }] }),
  ],
  props: [
    { prop: 'torch', at: [462, 262], collide: false },
    { prop: 'torch', at: [820, 262], collide: false },
    { prop: 'torch', at: [546, 486], collide: false },
    { prop: 'torch', at: [714, 486], collide: false },
  ],
  interactables: [
    {
      id: 'lauschen-west', verb: 'Lauschen', poly: [[556, 172], [600, 132], [606, 202], [560, 206]], radius: 30, standAt: [540, 224], face: 'right',
      when: () => !G.state.is('k4-gehoert'), onInteract: lauschen,
    },
    {
      id: 'lauschen-ost', verb: 'Lauschen', poly: [[676, 132], [722, 152], [740, 206], [690, 206]], radius: 30, standAt: [752, 230], face: 'left',
      when: () => !G.state.is('k4-gehoert'), onInteract: lauschen,
    },
  ],
  triggers: [
    { id: 'cp-west', poly: [[240, 370], [292, 370], [292, 410], [240, 410]], once: false, onEnter: w => checkpoint(w, [262, 394]) },
    { id: 'cp-nord', poly: [[296, 190], [364, 214], [356, 232], [292, 210]], once: false, onEnter: w => checkpoint(w, [326, 212]) },
    { id: 'cp-ost', poly: [[740, 358], [814, 356], [814, 382], [742, 384]], once: false, onEnter: w => checkpoint(w, [784, 368]) },
  ],
  lights: [
    { id: 'lagerfeuer', at: [636, 330], kind: 'fire', radius: 170, intensity: 1.1, flame: 1.3 },
    { id: 'esse', at: [1024, 236], kind: 'fire', radius: 70, intensity: 0.9 },
    { id: 'zelt', at: [636, 180], kind: 'candle', radius: 50, intensity: 0.8 },
  ],
  exits: [{
    id: 'tor-flucht', poly: [[588, 704], [680, 704], [680, 720], [588, 720]], to: 'k4-nachtwald', spawn: 'flucht', fade: 700,
    when: () => G.state.is('k4-gehoert'), blocked: 'Erst rede ich mit Elnon. Selbst.',
  }],
  spawns: { feuer: { at: [556, 392], dir: 'up' } },
  stealth: { checkpoint: 'feuer' },
  time: 'dusk',
  ambience: ['camp', 'fire', 'crickets'],
  ambienceVolume: { fire: 0.7, camp: 0.8 },
  music: 'dread',
  lookMode: false,
  playerLight: 56,
});

function checkpoint(w: WorldCtx, at: [number, number]): void {
  if (G.state.is('k4-gehoert')) return;
  w.stealth.checkpoint(at);
  G.state.set('k4-cp', `${at[0]},${at[1]}`);
}

const SPOTTED: Record<string, [string, string]> = {
  azar: ['azar', 'Lia? Da bist du ja! Komm, setz dich, der Eintopf wird kalt.'],
  'k4-jorin': ['k4-jorin', 'Lia! Willst du mit Wache schieben? Das Essen ist am Feuer!'],
  'k4-gundrik': ['k4-gundrik', 'He, Kleine! Hier wird nicht rumgeschlichen. Ab ans Feuer.'],
  'k4-faelan': ['k4-faelan', 'Elnon wünscht keine Störung. Geh zurück zum Feuer.'],
  'k4-wache': ['k4-wache', 'Hier geht keiner raus. Zurück, Mädchen.'],
};

export async function verratSkript(w: WorldCtx): Promise<void> {
  const ui = G.ui as UiApiExt;
  const azar = w.actor('azar');
  void ui.fade('in', 600);
  w.stealth.onSpotted(async g => {
    const [speaker, line] = SPOTTED[g.id] ?? ['azar', 'Zurück ans Feuer!'];
    w.lockPlayer();
    try {
      await w.say(speaker, line);
      await ui.fade('out', 350);
      w.stealth.resetGuards();
      const cp = (G.state.flag<string>('k4-cp') ?? '556,392').split(',').map(Number) as [number, number];
      w.player.teleport(cp, 'up');
      await w.wait(120);
      await ui.fade('in', 350);
    } finally { w.unlockPlayer(); }
  });

  if (!G.state.is('k4-verrat-intro')) {
    await w.cutscene(async () => {
      azar.hold(true);
      azar.teleport([592, 396], 'left');
      azar.setIdle('sit');
      w.player.setIdle('sit');
      await w.wait(600);
      await azar.say('Und? Schmeckt’s? Bertas Eintopf ist der zweitbeste im Lager. Nach meinem natürlich.', { mood: 'happy' });
      await lia(w, 'Wo ist Foltan?');
      await azar.say('Immer noch bei Elnon. Die zwei reden, als gäbe es kein Morgen.');
      await w.think('Seit Stunden. Und keiner sagt mir etwas.');
      await w.think('Ich frage Elnon selbst. Jetzt. Azar würde mich nie lassen.');
      await azar.say('Ich hol mir Nachschlag. Willst du auch? Nein? Mehr für mich!', { mood: 'happy' });
      azar.setIdle('idle');
      await azar.walkTo(572, 292, { face: 'up' });
      w.player.setIdle('idle');
      await w.say('narrator', `Schleiche zu Elnons Zelt. Halte ${w.controlHint('sneak')} gedrückt: Hinter Kisten und Fässern bist du geduckt unsichtbar.`);
      await w.say('narrator', 'Sichtkegel zeigen, wohin jemand schaut. Läufst du Azar in die Arme, schickt er dich zurück ans Feuer.');
    });
    G.state.set('k4-verrat-intro');
  }
  if (!G.state.is('k4-gehoert')) {
    // Azar's patrol starts at the cauldron, his back to Lia; a short grace period before anyone can spot her.
    w.stealth.resetGuards();
    w.stealth.enable(false);
    azar.hold(false);
    bg(w.lighting.set('night', 20000));
    bg(w.wait(1500).then(() => { if (!G.state.is('k4-gehoert')) w.stealth.enable(true); }));
    w.setObjective('k4-zelt', 'Schleich dich zu Elnons Zelt, ohne dass Azar dich sieht.', 'lauschen-west');
    while (!G.state.is('k4-gehoert')) await w.wait(250);
  }
  await flucht(w);
}

async function lauschen(w: WorldCtx): Promise<void> {
  const ui = G.ui as UiApiExt;
  let heartbeat: SfxLoop | null = null;
  await w.cutscene(async () => {
    w.stealth.enable(false);
    w.player.play('crouch' as CharAnim);
    G.audio.music(null, { fadeMs: 1500 });
    await w.say('narrator', 'Das Zelt ist unbewacht. Durch einen Spalt in der Plane fällt Kerzenlicht.');
    ui.prefetchPlate('k4-elnon-zelt');
    await G.ui.plate('k4-elnon-zelt', { caption: 'Elnons Zelt', pan: 'in' });
    await w.think('Elnon beugt sich über eine Karte. Der Narbige lehnt am Schrank. Und Foltan …');
    await w.say('foltan', 'Nach allem, was wir herausgefunden haben, sind sie hinter dem Geweih her.');
    await w.say('elnon', 'Und da bist du dir sicher?', { mood: 'grim' });
    await w.say('foltan', 'Craupor ist verlässlich. Ich würde ihm mein Leben anvertrauen.');
    await w.say('alastir', 'Das Geweih Regas. Erst nehmen sie uns die Heimat, und jetzt das. Unverzeihlich.', { mood: 'angry' });
    if (G.state.data.lore.includes('k4-lore-destar')) await w.think('Regas Geweih … Ilvy hat gesagt, kein Elf würde es auch nur berühren.');
    await w.say('elnon', 'Ein Trupp von fünf Mann, sagst du?');
    await w.say('foltan', 'Fünf. Und sie hatten eine Gefangene. Ich denke, es ist die Schwester des Mädchens.');
    try { heartbeat = G.audio.loop('heartbeat', { interval: 0.75, volume: 0.9 }); } catch { heartbeat = null; }
    await w.think('Kyra.');
    await w.think('Er … weiß es? Er weiß, wo sie ist?');
    await w.say('elnon', 'Weiß sie davon?');
    await w.say('foltan', 'Nein. Ich habe ihr nichts erzählt.', { mood: 'ashamed' });
    heartbeat?.set({ interval: 0.5 });
    await w.say('elnon', 'Weshalb hast du es ihr verschwiegen?');
    await w.say('foltan', 'Dass ihre Schwester lange genug lebt, damit wir sie retten können? Zu unwahrscheinlich. Ich wollte ihr keine Hoffnung machen.');
    await w.say('foltan', 'Sie soll sich hier nützlich machen und darüber hinwegkommen. Der Krieg fordert solche Opfer.');
    await w.say('elnon', 'Nicht sonderlich nobel von dir.', { mood: 'grim' });
    await w.say('elnon', 'Aber ich verstehe es. Zu dritt gegen fünf Dunkelschatten? Ihr wärt gestorben, und deine Nachricht mit euch.');
    await w.say('elnon', 'Sie ist eine von tausenden Kriegswaisen. Dem Schicksal vieler muss man manchmal ein einzelnes unterordnen.');
    await w.say('elnon', 'Damit es kein zweites Ebaril gibt.');
    if (G.state.is('k3-luege-bemerkt')) await w.think('„Craupor weiß nichts.“ Ich wusste es. Ich habe es die ganze Zeit gewusst.');
    await w.think('Sie haben es versprochen. Am Lagerfeuer haben sie es mir versprochen. Beide.');
    G.state.addClue('k4-clue-fuenf');
    await G.ui.closePlate();
    heartbeat?.set({ interval: 0.42 });
    const pick = await w.choose(['Hineinstürmen und ihn anschreien', 'Weg. Einfach nur weg.']);
    if (pick === 0) {
      await w.think('Meine Hand liegt schon an der Plane. … Nein. Er würde mich nur wieder belehren. Wie ein dummes kleines Mädchen.');
    }
    await w.think('Er hält Kyra für tot. Dann suche ich sie eben allein.');
    heartbeat?.stop(600);
    heartbeat = null;
    G.state.set('k4-gehoert');
  });
}

async function flucht(w: WorldCtx): Promise<void> {
  w.stealth.enable(false);
  w.completeObjective('k4-zelt');
  G.audio.music('grief', { fadeMs: 1200 });
  w.setObjective('k4-weg', 'Lauf. Weg von hier, raus aus dem Lager.', 'tor-flucht');
  await w.wait(1800);
  w.bark('k4-berta', 'Kind? Wohin so schnell?', 2200);
  await w.wait(2400);
  w.bark('k4-ilvy', 'Lia?', 1600);
}

// ---------------------------------------------------------------------------------------------------------------
// The night forest: Lia runs down the path she walked blindfolded this morning.
// ---------------------------------------------------------------------------------------------------------------

export const nachtwald = defineMap({
  ...waldpfadBase,
  id: 'k4-nachtwald',
  name: 'Der Wald bei Nacht',
  spawns: { flucht: { at: [1046, 22], dir: 'down' } },
  triggers: [
    { id: 'stamm', poly: DUCK_ZONE, onEnter: stolpern },
    { id: 'bach', poly: [[586, 326], [730, 330], [732, 392], [584, 390]], onEnter: amBach },
  ],
  lights: [{ id: 'mond', at: [200, 40], kind: 'moon', radius: 360, intensity: 0.35, always: true }],
  time: 'night',
  weather: 'none',
  ambience: ['night', 'wind', 'stream'],
  ambienceVolume: { wind: 0.7, stream: 0.6 },
  music: 'grief',
  playerLight: 100,
  onEnter: async w => {
    if (G.state.is('k4-ende')) return;
    w.stealth.enable(false);
    if (!G.state.is('k4-flucht-tafel')) {
      G.state.set('k4-flucht-tafel');
      await w.cutscene(async () => {
        await G.ui.plate('k4-flucht', { caption: 'Hinaus in die Nacht', pan: 'right' });
        await w.think('Weg. Weg vom Lager. Weg von meinen falschen Freunden.');
        await G.ui.closePlate();
      });
    }
    w.setObjective('k4-flucht', 'Lauf. Den Pfad hinunter, weg vom Lager.', [660, 360]);
    await w.wait(500);
    await w.think(G.state.is('k4-blinzeln') ? 'Der Pfad von heute Morgen. Ich habe ihn unter der Binde gesehen. Nur kurz. Es reicht.' : 'Irgendwo hier sind wir heute Morgen entlanggekommen. Ich höre den Bach.');
  },
});

async function stolpern(w: WorldCtx): Promise<void> {
  await w.cutscene(async () => {
    sfx('thud', { volume: 0.9 });
    w.camera.shake(220, 0.006);
    await w.player.play('hit', { ms: 500 });
    w.player.setIdle('kneel');
    await w.think('Der umgestürzte Baum. Heute Morgen hat Azar mich gewarnt. Jetzt warnt mich niemand mehr.');
    w.player.setIdle('idle');
  });
}

async function amBach(w: WorldCtx): Promise<void> {
  if (G.state.is('k4-ende')) return;
  G.state.set('k4-ende');
  const ui = G.ui as UiApiExt;
  w.completeObjective('k4-flucht');
  await w.cutscene(async () => {
    w.player.setIdle('kneel');
    sfx('splash', { volume: 0.6, pitch: 0.8 });
    await w.wait(700);
    await w.think('Sie haben es versprochen. Beide.');
    await w.think('Foltan hat es die ganze Zeit gewusst. Seit dem Goldenen Eber. Fünf Dunkelschatten, eine Gefangene, ein Geweih.');
    if (G.state.has('ribbon')) await w.think('Kyras Haarband. Ich halte es so fest, dass meine Finger wehtun.');
    await w.wait(500);
    w.bark('player', '…', 1500);
    // Far away: Azar calls her name.
    const far = () => ({ x: 560, y: 60 });
    const spoken = G.ui.bubble('*Azar (fern):* Liaaa!', far, 2200, { speaker: 'azar', voiceText: 'Liaaa!', foreground: true });
    if (!spoken.voiced) for (let i = 0; i < 5; i++) { try { G.audio.blip(105, 'square', { pan: 0.6, volume: 0.35 }); } catch { /* */ } await ui.wait(70); }
    if (spoken.voiceDone) await spoken.voiceDone;
    await ui.wait(spoken.voiced ? 600 : 1800);
    const pick = await w.choose(['Antworten', 'Schweigen']);
    if (pick === 0) await w.think('Ich öffne den Mund. Kein Ton kommt heraus. Dann ist die Stimme weg.');
    else await w.think('Azar. … Nein. Vielleicht hat er es auch gewusst.');
    await w.think('Dann eben allein. Fünf Dunkelschatten und eine Grotte. So schwer kann das nicht sein.');
  });
  await ui.fade('out', 1200);
  await G.ui.narrate('Im Lager brannten die Feuer herunter.', { style: 'card' });
  ui.prefetchPlate('k4-azar-foltan');
  await G.ui.plate('k4-azar-foltan', { caption: 'Am Feuer der Bruderschaft', pan: 'in' });
  await ui.fade('in', 600);
  await G.ui.say('azar', 'Du hast es ihr versprochen! Du hast ihr versprochen, ihr zu helfen, ihre Schwester zu finden!', { mood: 'angry' });
  await G.ui.say('foltan', 'Ich helfe ihr. Glaub mir, eines Tages wird sie es verstehen.', { mood: 'ashamed' });
  await G.ui.say('azar', 'Gefühlloser Holzklotz. Ich gehe sie suchen.', { mood: 'angry' });
  await G.ui.say('foltan', 'Azar! Du darfst ihr nichts sagen. Hörst du? Versprich es!');
  await G.ui.say('azar', 'Versprechen gelten hier anscheinend sowieso nichts mehr.', { mood: 'sad' });
  await G.ui.narrate(['Azar suchte bis tief in die Nacht. Er rief ihren Namen in den Wald, wieder und wieder. Niemand antwortete.',
    'Foltan blieb allein am Feuer zurück und starrte in die Glut. Er wusste nicht mehr, ob er das Richtige getan hatte.']);
  await G.ui.closePlate();
  G.state.setParty([]);
  G.state.set('k4-verrat-done');
  await ui.fade('out', 900);
  await gotoNextChapter();
}
