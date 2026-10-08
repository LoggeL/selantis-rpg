// Scene 'kyra' — interlude: Kyra in Baris' camp at the pond (DESIGN.md §7.4, Kapitel III/3; novel p. 33–75).
// Narrator bridge (the bite → „Mädchen“, the audience „Hast du Angst?“ – „Habe ich Grund dazu?“), then playable as
// Kyra at night: chained to a stake while the men sing the Waffenknechtlied, she rocks the stake loose in time with
// the drum (minigame), sneaks to the captain's tent, overhears Baris and Orwen (map, grotto, the master, the Geweih
// Regas, a five-man ride), is caught and tied up again — and swears to fight and live. Writing stays unreadable.
import type { CharAnim } from '../../art/api';
import { G } from '../../core/G';
import { virtualInput } from '../../core/input';
import { findScene } from '../../core/registry';
import { defineMap, startWorld, type ActorHandle, type MapDef, type WorldCtx } from '../../world';
import { bg, ambience, music, sfx, ui } from './k3';
import { stakeGame } from './panels';
import { registerK3Plates } from './plates';
import { startSong, type Song } from './song';

const STAKE_SEAT: [number, number] = [112, 150];
const LISTEN: [number, number] = [358, 84];
const SINGERS = ['maedchen', 'saenger-1', 'saenger-2', 'harro'];

export const weiherMap: MapDef = defineMap({
  id: 'k3-weiher',
  name: 'Das Lager am Weiher',
  background: 'k3-weiher',
  baked: 'night',
  player: 'kyra',
  walk: [[
    [30, 190], [40, 150], [60, 118], [96, 104], [114, 104], [116, 118], [190, 118], [192, 110], [234, 110], [236, 102],
    [258, 100], [260, 92], [300, 92], [302, 90], [346, 90], [348, 66], [370, 66], [372, 100], [420, 104], [500, 102],
    [520, 102], [522, 112], [490, 128], [470, 160], [430, 175], [400, 190], [380, 230], [340, 250], [332, 300], [330, 360],
    [210, 360], [205, 290], [190, 266], [172, 266], [110, 262], [90, 244], [60, 216],
  ]],
  block: [
    { id: 'zelt-1', poly: [[40, 140], [100, 140], [100, 166], [40, 166]] },
    { id: 'kisten-1', poly: [[34, 150], [84, 150], [84, 180], [34, 180]] },
    { id: 'pflock', poly: [[96, 130], [106, 130], [106, 140], [96, 140]] },
    { id: 'zelt-hauptmann', poly: [[372, 60], [508, 60], [508, 100], [372, 100]] },
    { id: 'kisten-5', poly: [[504, 78], [524, 78], [524, 100], [504, 100]] },
    { id: 'feuerstelle', sight: false, poly: [[238, 140], [352, 140], [352, 190], [238, 190]] },
    { id: 'stumpf', sight: false, poly: [[200, 178], [236, 178], [236, 200], [200, 200]] },
    { id: 'sattel', sight: false, poly: [[55, 238], [172, 238], [172, 262], [55, 262]] },
  ],
  occluders: [
    { id: 'zelt-1', baseline: 165, fade: 0.55, poly: [[36, 108], [104, 108], [104, 168], [36, 168]] },
    { id: 'pflock', baseline: 139, poly: [[94, 92], [108, 92], [108, 141], [94, 141]] },
    { id: 'zelt-hauptmann', baseline: 99, fade: 0.5, poly: [[366, 12], [512, 12], [512, 100], [366, 100]] },
  ],
  surfaces: [{ id: 'erde', kind: 'dirt', poly: [[40, 100], [520, 100], [400, 260], [330, 360], [210, 360], [60, 220]] }],
  surface: 'darkgrass',
  hidingSpots: [
    { id: 'kisten-links', kind: 'crate', poly: [[116, 118], [150, 118], [150, 130], [116, 130]] },
    { id: 'gestell', kind: 'crate', poly: [[192, 110], [234, 110], [234, 122], [192, 122]] },
    { id: 'kisten-t4', kind: 'crate', poly: [[260, 92], [300, 92], [300, 102], [260, 102]] },
    { id: 'zeltschatten', kind: 'bush', poly: [[348, 66], [370, 66], [370, 100], [348, 100]] },
  ],
  npcs: [
    { id: 'maedchen', preset: 'maedchen', at: [290, 200], dir: 'up' },
    { id: 'saenger-1', preset: 'shadow-club', speaker: 'dunkelschatten', at: [230, 166], dir: 'right' },
    { id: 'saenger-2', preset: 'shadow-crossbow', speaker: 'dunkelschatten', at: [362, 164], dir: 'left' },
    { id: 'harro', preset: 'harro', at: [330, 202], dir: 'up' },
    { id: 'orwen', preset: 'orwen', at: [440, 106], dir: 'down', hidden: true },
  ],
  guards: [
    {
      id: 'wache', preset: 'shadow-spear', speaker: 'wache', lantern: true, speed: 30,
      path: [{ at: [200, 214], wait: 1600, face: 'left' }, { at: [368, 212], wait: 1500, face: 'right' }, { at: [392, 150] }, { at: [300, 130], wait: 1200, face: 'down' }],
      suspiciousBarks: ['Hä? Wer da?', 'Was war das?'], calmBarks: ['Nur ein Frosch.', 'Verfluchtes Metbier.'],
    },
    {
      id: 'zeltwache', preset: 'shadow-sword', speaker: 'wache', path: [{ at: [432, 114], face: 'down' }], range: 80,
      suspiciousBarks: ['Hm?'], calmBarks: ['Ruhe jetzt.'],
    },
    {
      // The drunk Algard sways between the weapon rack and the crates: slip past behind his back.
      id: 'algard', preset: 'algard', speaker: 'algard', mode: 'pingpong', speed: 18, range: 64, fov: 64,
      path: [{ at: [242, 112], wait: 3200, face: 'down' }, { at: [290, 108], wait: 3200, face: 'left' }],
      suspiciousBarks: ['Hicks … wer da?'], calmBarks: ['Hicks.', 'Noch ein Krug …'],
    },
  ],
  triggers: [
    { id: 'lauschen', poly: [[348, 66], [370, 66], [370, 100], [348, 100]], when: () => G.state.is('k3-kyra-frei') },
    { id: 'cp-mitte', poly: [[192, 110], [234, 110], [234, 122], [192, 122]], onEnter: w => { w.stealth.checkpoint([212, 116], 'right'); } },
  ],
  lights: [
    { id: 'feuer', at: [292, 158], kind: 'fire', radius: 120, intensity: 1, flame: 1.1, always: true },
    { id: 'zelt-licht', at: [440, 82], kind: 'candle', radius: 56, intensity: 0.9, always: true },
    { id: 'mond', at: [590, 180], kind: 'moon', radius: 160, intensity: 0.3 },
  ],
  exits: [{
    id: 'pfad', poly: [[212, 346], [328, 346], [328, 360], [212, 360]], to: 'k3-weiher', spawn: 'pflock', when: () => false,
    blocked: 'Weglaufen? Barfuß, mit einer Kette am Bein, mitten in der Nacht? Erst will ich wissen, was die vorhaben.',
  }],
  spawns: { pflock: { at: STAKE_SEAT, dir: 'right' } },
  stealth: { checkpoint: 'pflock' },
  time: 'night',
  ambience: ['night', 'camp', 'lake', 'fire'],
  ambienceVolume: { fire: 0.6, camp: 0.7 },
  music: null,
  playerLight: 40,
  critters: false,
  lookMode: false,
  resetOnEnter: true,
});

// ---------------------------------------------------------------------------------------------------------------
// Narrator bridge before the map (over black): the bite, the audience
// ---------------------------------------------------------------------------------------------------------------

async function bridge(): Promise<void> {
  registerK3Plates();
  ui().setHud('none');
  await G.ui.caption('Zwischenspiel: Kyra', 2200);
  music('dread', 1800);
  await G.ui.narrate([
    'Kyras Handgelenke brannten. Seit zwei Tagen zog man sie an einem Seil hinter den Pferden her.',
    'Anfangs hatte man sie bäuchlings über einen Sattel geworfen. Bis sie dem Kahlgeschorenen herzhaft in den Schenkel biss.',
    'Er heulte auf wie ein kleines Mädchen. Seitdem nannten ihn alle nur noch „Mädchen“. Er hatte ihr dafür ein Veilchen geschlagen.',
    'Am Abend erreichten sie ein Lager an einem Weiher. Man ließ sie sich waschen, schminken, das Haar mit einer Kordel binden.',
    'Dann brachte Orwen, der Grauhaarige, sie in das größte Zelt.',
  ], { style: 'book' });
  try { ui().prefetchPlate('k3-audienz'); } catch { /* */ }
  await G.ui.plate('k3-audienz', { caption: 'Hauptmann Baris', pan: 'in', durationMs: 26000 });
  await ui().fade('in', 900);
  await G.ui.say('baris', 'Mach sie los.');
  sfx('rope-cut', { volume: 0.5 });
  await G.ui.say('baris', 'Hast du Angst?', { mood: 'smirk' });
  await G.ui.say('orwen', 'Antworte dem Hauptmann gefälligst!', { mood: 'angry' });
  const pick = await G.ui.choose(['„Habe ich Grund dazu?“', '„Nein.“', '(Seinem Blick standhalten.)']);
  if (pick === 0) {
    await G.ui.say('orwen', 'Du sollst die Frage des Hauptmanns beantworten!', { mood: 'angry' });
    await G.ui.say('baris', 'Halt!');
    await G.ui.say('baris', 'Du scheinst mutig. Vielleicht bist du aber auch einfach nur dumm.');
  } else if (pick === 1) {
    await G.ui.say('baris', 'Lügnerin. Aber eine gute.', { mood: 'smirk' });
  } else {
    await G.ui.say('orwen', 'Bist du taub, Mädel?', { mood: 'angry' });
    await G.ui.say('baris', 'Halt! … Stumm oder stolz. Beides gefällt mir.', { mood: 'smirk' });
  }
  await G.ui.say('baris', 'Hat man dir nichts über mich erzählt?');
  await G.ui.say('kyra', 'Dass Ihr Eure Dienstmädchen quält, bis sie gebrochen sind. Dann langweilen sie Euch.', { mood: 'determined' });
  await G.ui.say('baris', 'Das erzählt man also über mich. Und? Glaubst du das?', { mood: 'smirk' });
  await G.ui.say('kyra', 'Sollte ich?', { mood: 'determined' });
  await G.ui.say('baris', 'Besser wäre es. Aber du hast Schneid, Mädchen. Aus dir hätte was werden können. Tragisch. So spielt der Krieg.');
  await G.ui.say('orwen', 'Ihr werdet sie behalten, Herr Baris?');
  await G.ui.say('baris', 'Ich habe Gefallen an ihr gefunden. Schaff sie raus.');
  await G.ui.think('Baris. So heißt er also. Den Namen vergesse ich nicht.');
  await G.ui.closePlate();
}

// ---------------------------------------------------------------------------------------------------------------
// Night at the stake
// ---------------------------------------------------------------------------------------------------------------

let song: Song | null = null;

function singAlong(w: WorldCtx): void {
  song?.stop();
  song = startSong({ volume: 1 });
  let i = 0;
  song.onLine(text => {
    if (!w.alive) return;
    const who = SINGERS[i++ % SINGERS.length];
    w.bark(who, `♪ ${text}`, 2500);
  });
}

async function softCaught(w: WorldCtx, guard: ActorHandle | null, line: string): Promise<void> {
  w.lockPlayer();
  try {
    if (guard) { guard.face('player'); void guard.emote('!'); guard.bark(line, 1800); }
    void w.player.emote('drop', 900);
    sfx('alert');
    await w.wait(900);
    await ui().fade('out', 450);
    w.stealth.resetGuards();
    const cp = G.state.is('k3-cp-mitte') ? [212, 116] as [number, number] : STAKE_SEAT;
    w.player.teleport(cp, 'right');
    await w.wait(200);
    await ui().fade('in', 450);
    await w.think(guard ? 'Das war knapp. Noch einmal – und diesmal in Deckung bleiben, bis er wegsieht.' : 'Die Kette! Ich darf nicht rennen. Leise, Kyra.');
  } finally { w.unlockPlayer(); }
}

/** Running makes the chain rattle; near a soldier that gives Kyra away. */
function chainWatch(w: WorldCtx): void {
  const scene = w.scene as unknown as { player?: { running: boolean; sneaking: boolean; vx: number; vy: number } };
  let noise = 0, lastRattle = 0, busy = false;
  const guards = ['wache', 'zeltwache', 'algard'];
  bg((async () => {
    while (w.alive && !G.state.is('k3-kyra-lauscht')) {
      await w.wait(120);
      const p = scene.player;
      if (!p || busy) continue;
      const moving = Math.hypot(p.vx, p.vy) > 10;
      if (moving && (p.running || virtualInput.run)) {
        noise += 0.12;
        if (performance.now() - lastRattle > 320) { sfx('chain', { volume: 0.55 }); lastRattle = performance.now(); }
      } else noise = Math.max(0, noise - 0.06);
      if (noise > 0.9) {
        const near = guards.map(id => w.actor(id)).find(g => g.exists && Math.hypot(g.x - w.player.x, g.y - w.player.y) < 110);
        if (near) { busy = true; noise = 0; await softCaught(w, near, 'Was klirrt da?'); busy = false; }
        else noise = 0.6;
      }
    }
  })());
}

async function atTheStake(w: WorldCtx): Promise<void> {
  const orwen = w.actor('orwen');
  w.stealth.enable(false);
  w.player.setIdle('sit');
  w.player.face('right');
  singAlong(w);
  await w.cutscene(async () => {
    await w.wait(1400);
    await w.think('Sie singen. Sie saufen. Und ich hänge hier an einer Kette wie ein Hofhund.');
    // Orwen brings leftovers from the captain's tent.
    orwen.show();
    orwen.hold(true);
    await orwen.walkTo([150, 150]);
    orwen.face('player');
    await orwen.say('Der Hauptmann lässt Grüße ausrichten. Du sollst uns ja nicht verhungern.', { mood: 'smirk' });
    await orwen.say('Wenn du stirbst, wollen wir schon ein Wörtchen mitzureden haben. Fleisch. Und ein Krug Metbier.');
    await orwen.say('Morgen früh machst du dem Hauptmann Frühstück. Speck und Eier. Ich hoffe für dich, dass es ihm schmeckt.');
    bg(orwen.walkTo([440, 106]).then(() => orwen.hide()));
    await w.wait(900);
    sfx('eat');
    await w.think('Erst, wenn er weg ist. Er soll nicht sehen, wie hungrig ich bin.');
    await w.think('… Köstlich. Und das Metbier ist gar nicht so bitter, wie ich dachte.');
    await w.think('Ich warte nicht, bis dieser Baris mich zu Tode schuftet.');
    sfx('chain', { volume: 0.4 });
    await w.think('Der Pflock steckt in weichem Uferlehm. Wenn ich im Takt der Trommel daran rüttle, hört es keiner.');
  });
  w.setObjective('k3-pflock', 'Rüttle im Takt der Trommel am Pflock.', null);
  w.lockPlayer();
  const s = song!;
  await stakeGame(s, on => {
    if (on) w.bark('algard', 'Na, Mädel? Was klimperst du da?', 2000);
  });
  w.unlockPlayer();
  w.completeObjective('k3-pflock');
  G.state.set('k3-kyra-frei');
  w.player.setIdle('idle');
  sfx('chain', { volume: 0.5 });
  await w.cutscene(async () => {
    await w.think('Frei! Na ja … die Schelle sitzt noch am Knöchel. Ich nehme die Kette in die Hand, dann klirrt sie nicht.');
    await w.think('Orwen ging in das große schwarze Zelt. Was besprechen die da drin?');
  });
  await w.say('narrator', `Halte ${w.controlHint('sneak')} gedrückt: Geduckt hinter Kisten und im Zeltschatten sieht dich niemand. Nicht rennen – die Kette klirrt!`);
  w.setObjective('k3-lauschen', 'Schleich von Deckung zu Deckung zum Zelt des Hauptmanns.', LISTEN);
  w.stealth.enable(true);
  w.stealth.onSpotted(async g => { await softCaught(w, g, 'He! Die Kleine ist los!'); });
  chainWatch(w);
  w.onMap('trigger', 'cp-mitte', () => { G.state.set('k3-cp-mitte'); });
}

// ---------------------------------------------------------------------------------------------------------------
// Eavesdropping, caught, the vow
// ---------------------------------------------------------------------------------------------------------------

async function eavesdrop(w: WorldCtx): Promise<void> {
  G.state.set('k3-kyra-lauscht');
  w.completeObjective('k3-lauschen');
  if (song) song.volume = 0.35;
  await w.cutscene(async () => {
    await w.player.walkTo(LISTEN, { face: 'right' });
    w.player.setIdle('crouch' as CharAnim);
    await w.camera.pan([420, 80], 900);
    await w.say('k3-orwen-zelt', 'Die Späher sind zurück, Herr. Keine Grotte. Die Karte muss fehlerhaft sein.');
    await w.say('k3-baris-zelt', 'Und ich sage dir: Der Meister ist sich sicher, dass die Karte echt ist.');
    await w.say('k3-orwen-zelt', 'Das waren unsere fähigsten Leute. Wenn sie nichts gefunden haben, dann ist da auch nichts.');
    await w.say('k3-baris-zelt', 'Willst du dem Meister erzählen, dass er sich irrt?');
    await w.say('k3-orwen-zelt', '… Nein, Herr.');
    await w.think('Orwen hat Angst. Zum ersten Mal höre ich ihn Angst haben.');
    await w.say('k3-baris-zelt', 'Ich auch nicht. Also finden wir dieses verfluchte Geweih. Das Geweih Regas.');
    // A gap in the canvas: the map on the table — but Kyra cannot read.
    const peek = await w.choose(['Durch einen Spalt in der Plane spähen', 'Nur weiter lauschen']);
    if (peek === 0) {
      await G.ui.plate('k3-karte', { caption: 'Durch einen Spalt in der Zeltplane', pan: 'in', durationMs: 16000 });
      await G.ui.think('Eine Karte. Wälder, ein Weiher, Hügel … und überall Krakel. Lauter Krakel.');
      await G.ui.think('Wenn ich doch nur ein einziges Mal bei Mutters Lektionen aufgepasst hätte. Lia könnte das lesen.');
      G.state.addMemory('k3-mem-kyra-lektion');
      await G.ui.think('Aber das da kann ich erkennen: ein Geweih. Und ein roter Kreis bei den Hügeln im Osten.');
      await G.ui.closePlate();
      G.state.set('k3-karte-gesehen');
    }
    await w.say('k3-baris-zelt', 'Unsere fähigsten Leute, sagst du? Dann überzeuge ich mich selbst. Sattle mein Pferd.');
    await w.say('k3-orwen-zelt', 'Herr, das sind zwei Tagesritte. Sollen wir das ganze Lager abschlagen?');
    await w.say('k3-baris-zelt', 'Nein. Nur wir. Du, ich und drei deiner Männer. Und das Mädchen.');
    await w.say('k3-orwen-zelt', 'Das Mädchen? Sie ist nur ein Klotz am Bein.');
    await w.say('k3-baris-zelt', 'Mir egal. Was mir gehört, lasse ich nicht bei deinen Säufern.');
    G.state.addLore('k3-lore-geweih');
    await w.think('Fünf Reiter und ich. Zu einer Grotte, die keiner findet. Lia … wo bist du?');
  });
  await caught(w);
}

async function caught(w: WorldCtx): Promise<void> {
  const orwen = w.actor('orwen');
  await w.cutscene(async () => {
    await w.say('k3-orwen-zelt', 'Ich sattle die Pferde.');
    orwen.show();
    orwen.teleport([440, 106], 'down');
    orwen.hold(true);
    await orwen.walkTo([392, 110], { face: 'left' });
    w.camera.follow('player');
    w.player.setIdle('idle');
    await w.think('Weg hier!');
    bg(w.player.walkTo([330, 100]));
    await w.wait(260);
    sfx('chain', { volume: 1 });
    w.camera.shake(180, 0.004);
    void orwen.emote('!');
    await w.wait(500);
    await orwen.say('Sieh an. Die Kleine hat Ohren.', { mood: 'smirk' });
    await orwen.walkTo([346, 100], { run: true });
    w.camera.punch(0.08);
    sfx('hit', { volume: 0.5 });
    await orwen.say('Und Hände, die einen Pflock aus dem Matsch ziehen. Mädchen! Du Hornochse! Wer hat den Pflock ins Ufer gerammt?', { mood: 'angry' });
    await ui().fade('out', 600);
    // Back at the stake, bound hand and foot.
    song?.stop();
    w.player.setLook('kyra-bound');
    w.player.teleport(STAKE_SEAT, 'right');
    w.player.setIdle('sit');
    orwen.teleport([150, 152], 'left');
    w.actor('maedchen').teleport([128, 168], 'up');
    w.camera.follow('player');
    await w.wait(300);
    await ui().fade('in', 600);
    sfx('thud', { volume: 0.8, pitch: 0.7 }); await w.wait(380);
    sfx('thud', { volume: 0.8, pitch: 0.7 }); await w.wait(380);
    sfx('thud', { volume: 0.9, pitch: 0.65 });
    await w.say('maedchen', 'D-der sitzt jetzt. In hartem Boden. Ehrlich.', { mood: 'angry' });
    await orwen.say('Hände und Füße, du Narr. Und wenn sie noch einmal wegläuft, binde ich dich daneben.');
    await orwen.say('Und du, Mädel. Was hast du gehört?');
    const pick = await w.choose(['„Nichts. Ich wollte nur weg.“', '„Dass euer Meister euch Angst macht.“', '(Schweigen)']);
    if (pick === 0) await orwen.say('Lügen kannst du auch nicht. Gut so.', { mood: 'smirk' });
    else if (pick === 1) {
      w.camera.shake(220, 0.006);
      sfx('hit-heavy', { volume: 0.5 });
      w.lighting.flash(0xffffff, 120);
      await orwen.say('Sprich nie wieder von ihm. Nie. Hast du verstanden?', { mood: 'angry' });
      await w.say('k3-kyra-bound', '…', { mood: 'hurt' });
    } else await orwen.say('Klug. Schweigen ist das Einzige, was dich am Leben hält.');
    await orwen.say('Schlaf jetzt. Morgen reitest du. Ich hoffe, du kannst reiten.');
    orwen.hold(true);
    bg(orwen.walkTo([440, 106]).then(() => orwen.hide()));
    bg(w.actor('maedchen').walkTo([290, 200]));
    await w.wait(1200);
  });
  await vow(w);
}

async function vow(w: WorldCtx): Promise<void> {
  singAlong(w);
  if (song) song.volume = 0.5;
  await w.cutscene(async () => {
    await w.wait(900);
    await G.ui.plate('k3-schwur', { caption: 'Das Leben als Waffenknecht', pan: 'in', durationMs: 26000 });
    await G.ui.narrate([
      'Da saß sie nun, abseits im Feuerschein. Noch wusste sie nicht, ob es gut oder schlecht war, dass man sie nicht gleich getötet hatte.',
      'Aber Kyra beschloss, dass jetzt keine Zeit für Trauer oder Selbstmitleid war. Wenn sie aufgab, würde sie sterben.',
    ], { style: 'book' });
    await w.say('k3-kyra-bound', 'Ich werde kämpfen. Und ich werde leben.', { mood: 'determined' });
    await w.say('k3-kyra-bound', 'Und irgendwann, Baris, bist du derjenige, der Angst hat.', { mood: 'angry' });
    await w.say('narrator', 'Über ihr leuchtete Crios, der hellste Stern im Westen.');
    await G.ui.closePlate();
  });
  song?.stop();
  await ui().fade('out', 1200);
  if (findScene('augenbinde')) await G.goto('augenbinde');
  else { const m = await import('../../scenes/BootScene'); await m.showTitle(); }
}

export async function kyraScript(w: WorldCtx): Promise<void> {
  ambience(['night', 'camp', 'lake', 'fire'], { volume: { fire: 0.6, camp: 0.7 } });
  music(null, 1500);
  await atTheStake(w);
  await w.waitForTrigger('lauschen');
  await eavesdrop(w);
}

/** Scene start: narrator bridge over black, then the camp at night. */
export async function startKyra(): Promise<void> {
  G.stopGameplayScenes();
  await ui().fade('out', 0);
  await bridge();
  await startWorld({ map: weiherMap, spawn: 'pflock', player: 'kyra', companions: [], script: kyraScript });
}
