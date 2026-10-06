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
    { id: 'k4-berta', preset: 'villager-f', at: [604, 376], dir: 'up', idle: 'sit', barks: ['Nachschlag kriegt nur, wer abwäscht.', 'Wer hat schon wieder ins Salz gegriffen?'], barkEvery: 8000 },
    { id: 'k4-ilvy', preset: 'elf-f', at: [676, 374], dir: 'up', idle: 'sit', barks: ['… und dann brannte die Brücke.', 'Reich mal das Brot rüber.'], barkEvery: 9500 },
    { id: 'k4-faelan-sitz', preset: 'elf-m', at: [526, 356], dir: 'right', idle: 'sit' },
  ],
  guards: [
    guard({
      id: 'azar', preset: 'azar', speaker: 'azar', speed: 30,
      path: [{ at: [572, 292], wait: 3600, face: 'up' }, { at: [500, 384], wait: 1800, face: 'left' }, { at: [640, 448], wait: 1800, face: 'down' }, { at: [744, 392], wait: 1800, face: 'right' }],
      suspiciousBarks: ['Lia? Warst du das?', 'Wo steckt sie denn jetzt?'], calmBarks: ['Mein eigener Schatten. Ha.', 'Die kommt schon, wenn sie Hunger hat.'],
    }),
    guard({
      id: 'k4-jorin', preset: 'villager-m', speaker: 'k4-jorin', mode: 'pingpong', lantern: true,
      path: [{ at: [150, 318], wait: 1700, face: 'up' }, { at: [336, 318], wait: 1700, face: 'up' }],
      suspiciousBarks: ['Wer da?', 'Da hat doch was geraschelt.'], calmBarks: ['Bloß eine Maus.', 'Zu lange Wache. Ich seh Gespenster.'],
    }),
    guard({
      id: 'k4-gundrik', preset: 'dwarf', speaker: 'k4-gundrik', speed: 26,
      path: [{ at: [852, 380], wait: 2200, face: 'left' }, { at: [884, 292], wait: 1800, face: 'down' }, { at: [780, 254], wait: 2000, face: 'left' }],
      suspiciousBarks: ['Hä?', 'Wer drückt sich da rum?'], calmBarks: ['Pah. Zu viel Bier.'],
    }),
    guard({
      id: 'k4-faelan', preset: 'elf-m', speaker: 'k4-faelan', mode: 'pingpong', speed: 24, range: 84, fov: 64, reaction: 1.6,
      path: [{ at: [430, 238], wait: 2000, face: 'right' }, { at: [862, 242], wait: 2000, face: 'left' }],
      suspiciousBarks: ['…?'], calmBarks: ['Nur der Wind.'],
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
    when: () => G.state.is('k4-gehoert'), blocked: 'Erst Elnon. Ich frag ihn selbst.',
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
  azar: ['azar', 'Lia! Da steckst du. Setz dich hin, sonst ess ich deinen Eintopf auch noch.'],
  'k4-jorin': ['k4-jorin', 'Lia? Hier steht die Wache, nicht der Kessel. Das Essen ist am Feuer.'],
  'k4-gundrik': ['k4-gundrik', 'Na, Kleine? Schleichen übst du woanders. Ab ans Feuer.'],
  'k4-faelan': ['k4-faelan', 'Elnon will keine Störung. Geh zum Feuer zurück.'],
  'k4-wache': ['k4-wache', 'Nach Einbruch der Nacht geht keiner raus. Zurück mit dir.'],
};

export async function verratSkript(w: WorldCtx): Promise<void> {
  const ui = G.ui as UiApiExt;
  const azar = w.actor('azar');
  void ui.fade('in', 600);
  w.stealth.onSpotted(async g => {
    const [speaker, line] = SPOTTED[g.id] ?? ['azar', 'Ab ans Feuer, Lia.'];
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
      await azar.say('Bertas Eintopf. Der zweitbeste im ganzen Lager. Den besten koch ich, aber mich lässt ja keiner an den Kessel.', { mood: 'happy' });
      await lia(w, 'Und Foltan? Isst der nicht?');
      await azar.say('Sitzt noch bei Elnon. Seit Mittag. Wenn der feine Herr Foltan so lange redet, hat er morgen Halsweh.');
      await w.think('Seit Mittag. Und mir erzählt keiner ein Wort.');
      await w.think('Dann frage ich Elnon eben selbst. Azar darf es nur nicht merken, sonst hält er mich am Ärmel fest.');
      await azar.say('Ich hol mir noch eine Kelle. Du auch? … Nein? Dann nehm ich deine gleich mit.', { mood: 'happy' });
      azar.setIdle('idle');
      await azar.walkTo(572, 292, { face: 'up' });
      w.player.setIdle('idle');
      await w.say('narrator', `Schleich dich zu Elnons Zelt. Halte ${w.controlHint('sneak')} gedrückt: Hinter Kisten und Fässern duckst du dich und bleibst ungesehen.`);
      await w.say('narrator', 'Die Sichtkegel zeigen, wohin jemand schaut. Erwischt dich Azar, schickt er dich zurück ans Feuer.');
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
    await w.say('narrator', 'Vor dem Zelt steht niemand. Ein schmaler Streifen Kerzenlicht fällt durch die Plane.');
    ui.prefetchPlate('k4-elnon-zelt');
    await G.ui.plate('k4-elnon-zelt', { caption: 'Elnons Zelt', pan: 'in' });
    await w.think('Elnon über einer Karte von halb Selantis. Der Elf mit der Brandnarbe am Schrank. Und Foltan, die Arme verschränkt.');
    await w.say('foltan', 'Sie suchen eine Grotte. Und darin das Geweih.');
    await w.say('elnon', 'Woher weißt du das?', { mood: 'grim' });
    await w.say('foltan', 'Von Craupor. Der schuldet mir mehr als einen Gefallen. Der lügt mich nicht an.');
    await w.say('alastir', 'Erst Ebaril. Jetzt greifen sie nach Regas Geweih. … Unverzeihlich.', { mood: 'angry' });
    if (G.state.data.lore.includes('k4-lore-destar')) await w.think('Ilvy hat von dem Geweih erzählt. Kein Elf würde es anfassen. Die Dunkelschatten schon.');
    await w.say('elnon', 'Wie viele?');
    await w.say('foltan', 'Fünf. Dazu ein Mädchen an der Kette. Craupors Beschreibung passt auf die Schwester der Kleinen.');
    try { heartbeat = G.audio.loop('heartbeat', { interval: 0.75, volume: 0.9 }); } catch { heartbeat = null; }
    await w.think('Kyra.');
    await w.think('Er weiß, wo sie ist. Er hat es die ganze Zeit gewusst.');
    await w.say('elnon', 'Und die, die du hergebracht hast? Weiß sie es?');
    await w.say('foltan', 'Nein. Von mir nicht.', { mood: 'ashamed' });
    heartbeat?.set({ interval: 0.5 });
    await w.say('elnon', 'Warum nicht?');
    await w.say('foltan', 'Bis wir die Grotte finden, ist die Schwester tot. Oder Schlimmeres. Soll ich der Kleinen Hoffnung verkaufen, die ich selbst nicht habe?');
    await w.say('foltan', 'Hier ist sie sicher. Soll sie Kessel schrubben und Pfeile schnitzen, bis sie aufhört zu warten.');
    await w.say('elnon', 'Ehrenhaft ist das nicht.', { mood: 'grim' });
    await w.say('elnon', 'Aber klug. Drei gegen fünf Dunkelschatten, und eine davon ein Kind. Ich hätte nie von der Grotte erfahren.');
    await w.say('elnon', 'Eine Waise mehr. Nach dem Brand habe ich tausende gezählt.');
    await w.say('elnon', 'Damit es kein zweites Ebaril gibt.');
    if (G.state.is('k3-luege-bemerkt')) await w.think('Im Goldenen Eber hat er mir ins Gesicht gesehen und gesagt, Craupor wüsste nichts. Ich hab’s geahnt. Und ihm trotzdem geglaubt.');
    await w.think('Am Lagerfeuer hat er es mir versprochen. Da wusste er es schon.');
    G.state.addClue('k4-clue-fuenf');
    await G.ui.closePlate();
    heartbeat?.set({ interval: 0.42 });
    const pick = await w.choose(['Reingehen und es ihm ins Gesicht sagen', 'Gehen, bevor sie mich hören']);
    if (pick === 0) {
      await w.think('Meine Finger sind schon an der Plane. … Und dann? Er erklärt mir, warum er recht hat, und Elnon nickt dazu.');
    }
    await w.think('Für ihn ist Kyra schon tot. Für mich nicht.');
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
  w.bark('k4-berta', 'Kind? Wo brennt’s denn?', 2200);
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
        await w.think('Nicht umdrehen. Wenn ich mich umdrehe, gehe ich zurück.');
        await G.ui.closePlate();
      });
    }
    w.setObjective('k4-flucht', 'Lauf. Den Pfad hinunter, weg vom Lager.', [660, 360]);
    await w.wait(500);
    await w.think(G.state.is('k4-blinzeln') ? 'Heute Morgen hab ich unter der Binde durchgeblinzelt. Moos, Farn, dieser Pfad. Das muss reichen.' : 'Heute Morgen hab ich hier nur Schritte und Wasser gehört. Da ist er, der Bach. Ihm nach.');
  },
});

async function stolpern(w: WorldCtx): Promise<void> {
  await w.cutscene(async () => {
    sfx('thud', { volume: 0.9 });
    w.camera.shake(220, 0.006);
    await w.player.play('hit', { ms: 500 });
    w.player.setIdle('kneel');
    await w.think('Der umgestürzte Stamm. Heute Morgen hat Azar „Kopf runter“ gerufen. Jetzt ruft keiner.');
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
    await w.think('Das Wasser ist eiskalt. Gut. Dann hat das Zittern wenigstens einen Grund.');
    await w.think('Fünf Dunkelschatten. Eine Gefangene. Ein Geweih. Ich sage es mir vor wie Vokabeln, damit nichts verloren geht.');
    if (G.state.has('ribbon')) await w.think('Kyras Haarband. Ich wickle es mir um die Finger, bis sie weiß werden.');
    await w.wait(500);
    w.bark('player', '…', 1500);
    // Far away: Azar calls her name.
    const far = () => ({ x: 560, y: 60 });
    const spoken = G.ui.bubble('*Azar (fern):* Liaaa!', far, 2200, { speaker: 'azar', voiceText: 'Liaaa!', foreground: true });
    if (!spoken.voiced) for (let i = 0; i < 5; i++) { try { G.audio.blip(105, 'square', { pan: 0.6, volume: 0.35 }); } catch { /* */ } await ui.wait(70); }
    if (spoken.voiceDone) await spoken.voiceDone;
    await ui.wait(spoken.voiced ? 600 : 1800);
    const pick = await w.choose(['Zurückrufen', 'Stillhalten']);
    if (pick === 0) await w.think('Ich hole Luft. Es kommt nichts. Dann ist der Wald wieder still.');
    else await w.think('Azar. Der hat mir Wachteleier gebraten. … Vielleicht wusste er es trotzdem.');
    await w.think('Allein also. Fünf Dunkelschatten, eine Grotte und ein Mädchen, das zu viel liest. In Büchern geht so was gut aus. Meistens.');
  });
  await ui.fade('out', 1200);
  await G.ui.narrate('Im Lager fielen die Feuer in sich zusammen.', { style: 'card' });
  ui.prefetchPlate('k4-azar-foltan');
  await G.ui.plate('k4-azar-foltan', { caption: 'Am Feuer der Bruderschaft', pan: 'in' });
  await ui.fade('in', 600);
  await G.ui.say('azar', 'Ich saß daneben, als du es ihr versprochen hast. Ich hab dich sogar dazu gezwungen, ich Esel.', { mood: 'angry' });
  await G.ui.say('foltan', 'Ich halte sie am Leben. Eine andere Hilfe habe ich nicht.', { mood: 'ashamed' });
  await G.ui.say('azar', 'Du hast ein Herz wie ein Amboss. Kalt, und man haut sich die Hand dran kaputt. Ich geh sie suchen.', { mood: 'angry' });
  await G.ui.say('foltan', 'Azar. Kein Wort von Craupor, wenn du sie findest. Versprich mir das.');
  await G.ui.say('azar', 'Ein Versprechen. Was sind die hier denn noch wert, Foltan?', { mood: 'sad' });
  await G.ui.narrate(['Azar nahm eine Fackel und suchte bis weit nach Mitternacht. Sein Rufen wurde mit jeder Stunde heiserer.',
    'Foltan blieb am Feuer sitzen und legte kein Holz nach. Als die Glut grau wurde, saß er immer noch da.']);
  await G.ui.closePlate();
  G.state.setParty([]);
  G.state.set('k4-verrat-done');
  await ui.fade('out', 900);
  await gotoNextChapter();
}
