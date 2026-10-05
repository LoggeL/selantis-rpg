// prolog-flucht: night chase through the forest. Torch bearers with vision cones, hounds that follow Valentus'
// scent trail until he wades through the stream, a slowing, swaying wounded old man, the slip on a dewy stone,
// footsteps, a lantern, black. Map: assets/bg/prolog-flucht.png (1280×720, Codex), one continuous map.
import { G } from '../../core/G';
import { defineMap, startWorld, type ActorHandle, type Polygon, type WorldCtx } from '../../world';
import { ambience, music, reducedMotion, sceneOf, sfx, sleep } from './util';

/** The stream (wadeable): no scent on water. */
const STREAM: Polygon = [[770, 110], [902, 110], [906, 300], [952, 318], [988, 420], [992, 720], [780, 720], [772, 620], [742, 470], [742, 420], [758, 300]];
const START: [number, number] = [26, 408];
const HOUND_START: [number, number] = [6, 412];

function inPoly(x: number, y: number, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inWater = (x: number, y: number) => inPoly(x, y, STREAM);
const onEastBank = (x: number, y: number) => !inWater(x, y) && x > 900;

export const fluchtMap = defineMap({
  id: 'prolog-flucht',
  name: 'Der Wald nördlich von Dunkelhain',
  background: 'prolog-flucht',
  baked: 'night',
  walk: [
    // Path from the west edge up to the turn.
    [[0, 384], [110, 374], [210, 350], [258, 322], [296, 296], [312, 318], [266, 366], [170, 398], [70, 424], [0, 432]],
    // Undergrowth south of the path (ferns): links the west path with the central forest floor.
    [[40, 434], [160, 406], [250, 368], [300, 372], [330, 430], [330, 500], [240, 524], [120, 520], [40, 486]],
    // The climbing bend of the path and the small clearing at the top.
    [[250, 330], [270, 270], [262, 222], [214, 176], [226, 132], [330, 118], [400, 172], [330, 206], [306, 250], [318, 300]],
    // Central forest floor between path, clearing and stream.
    [[300, 200], [400, 176], [560, 160], [700, 150], [770, 150], [764, 300], [744, 430], [770, 520], [760, 600], [640, 594], [520, 556], [420, 520], [320, 500], [262, 440], [250, 376], [290, 330], [300, 300]],
    // The stream (wading) and the ford.
    STREAM,
    // East bank: ford exit, path between the rocks, out to the east.
    [[900, 150], [962, 158], [1004, 198], [1044, 240], [1078, 288], [1114, 330], [1152, 368], [1204, 398], [1280, 418], [1280, 498], [1222, 490], [1162, 470], [1112, 446], [1082, 422], [1062, 384], [1040, 334], [1000, 304], [950, 302], [904, 292]],
    // Lower east bank below the big rock (where the wading route comes out).
    [[984, 418], [1050, 420], [1072, 398], [1112, 418], [1114, 446], [1064, 518], [1002, 560], [988, 500]],
  ],
  block: [
    { id: 'eiche', poly: [[416, 134], [474, 134], [480, 166], [410, 166]] },
    { id: 'baumstamm', sight: false, poly: [[328, 456], [438, 400], [456, 420], [342, 482]] },
    { id: 'felsen-sued', poly: [[350, 540], [500, 534], [506, 600], [350, 600]] },
    { id: 'felsen-ufer', poly: [[642, 452], [792, 440], [770, 520], [700, 556], [650, 522]] },
    { id: 'steine-mitte', poly: [[656, 262], [722, 258], [728, 292], [660, 296]] },
    { id: 'fels-ost', poly: [[948, 312], [1040, 300], [1062, 360], [1048, 418], [990, 420], [962, 360]] },
  ],
  occluders: [
    { id: 'eiche', baseline: 166, fade: 0.5, poly: [[340, 0], [560, 0], [540, 90], [480, 120], [478, 166], [410, 166], [400, 110], [340, 60]] },
    { id: 'fels-ost', baseline: 418, poly: [[944, 300], [1000, 290], [1048, 304], [1064, 360], [1050, 420], [988, 422], [958, 360]] },
    { id: 'felsen-ufer', baseline: 540, poly: [[640, 440], [700, 430], [796, 436], [774, 524], [702, 560], [646, 526]] },
    { id: 'busch-pfad', baseline: 292, fade: 0.55, poly: [[308, 236], [330, 222], [372, 224], [392, 250], [386, 292], [316, 294]] },
    { id: 'busch-west', baseline: 348, fade: 0.55, poly: [[232, 306], [256, 292], [290, 296], [294, 336], [246, 352]] },
    { id: 'farn-mitte', baseline: 406, fade: 0.55, poly: [[346, 340], [400, 322], [462, 328], [482, 396], [364, 410]] },
    { id: 'busch-nord', baseline: 256, fade: 0.55, poly: [[496, 206], [536, 188], [584, 196], [594, 248], [508, 258]] },
    { id: 'busch-ost', baseline: 296, fade: 0.55, poly: [[980, 252], [1010, 236], [1044, 246], [1050, 294], [988, 298]] },
    { id: 'baeume-sued', baseline: 720, fade: 0.6, poly: [[0, 560], [200, 560], [330, 600], [420, 640], [560, 650], [700, 660], [760, 720], [0, 720]] },
    { id: 'baeume-so', baseline: 720, fade: 0.6, poly: [[1000, 600], [1080, 540], [1180, 510], [1280, 520], [1280, 720], [990, 720]] },
  ],
  surfaces: [
    { id: 'pfad-west', kind: 'path', poly: [[0, 394], [110, 384], [210, 360], [262, 330], [290, 300], [282, 250], [270, 214], [300, 188], [400, 178], [560, 168], [700, 158], [770, 170], [770, 200], [700, 188], [560, 196], [400, 200], [310, 206], [296, 222], [306, 252], [306, 310], [270, 352], [170, 392], [70, 418], [0, 424]] },
    { id: 'bach', kind: 'shallow', poly: STREAM, speed: 0.6 },
    { id: 'furt', kind: 'stone', poly: [[766, 174], [900, 174], [904, 230], [770, 230]] },
    { id: 'pfad-ost', kind: 'path', poly: [[900, 196], [962, 204], [1004, 232], [1044, 276], [1080, 320], [1120, 362], [1168, 398], [1280, 440], [1280, 470], [1160, 428], [1100, 380], [1060, 330], [1020, 272], [970, 236], [900, 226]] },
    { id: 'schilf-west', kind: 'wheat', poly: [[722, 300], [764, 300], [744, 430], [722, 420]] },
  ],
  surface: 'forest',
  hidingSpots: [
    { id: 'busch-pfad', kind: 'bush', poly: [[312, 230], [378, 228], [388, 284], [318, 292]] },
    { id: 'busch-west', kind: 'bush', poly: [[236, 300], [288, 296], [290, 334], [246, 348]] },
    { id: 'farn-mitte', kind: 'bush', poly: [[350, 332], [466, 330], [478, 398], [362, 408]] },
    { id: 'busch-nord', kind: 'bush', poly: [[500, 200], [580, 196], [590, 250], [506, 256]] },
    { id: 'busch-ost', kind: 'bush', poly: [[984, 244], [1040, 246], [1046, 292], [990, 296]] },
  ],
  guards: [
    {
      id: 'fackel-1', preset: 'shadow-spear', speaker: 'prolog-fackeltraeger', lantern: true, mode: 'pingpong', range: 120, fov: 66,
      path: [{ at: [196, 364], wait: 2000, face: 'left' }, { at: [304, 322], wait: 700 }, { at: [298, 236], wait: 2600, face: 'down' }],
      suspiciousBarks: ['Da! Im Farn?', 'Wer ist da?'], calmBarks: ['Nur ein Reh.', 'Weiter, weiter.'],
    },
    {
      id: 'fackel-2', preset: 'shadow-sword', speaker: 'prolog-fackeltraeger', lantern: true, mode: 'pingpong', range: 130, fov: 70,
      path: [{ at: [420, 190], wait: 1400, face: 'down' }, { at: [620, 176], wait: 1800, face: 'down' }, { at: [700, 230], wait: 1200, face: 'left' }],
      suspiciousBarks: ['Hörst du das?', 'Großmeister? Zeigt Euch!'], calmBarks: ['Der Alte ist längst tot.', 'Verdammter Wald.'],
    },
    {
      id: 'spuerhund', preset: 'dog', lantern: false, range: 84, fov: 120, reaction: 1.4,
      path: [{ at: [560, 230], wait: 2400, face: 'down' }, { at: [520, 300], wait: 2400, face: 'left' }],
      suspiciousBarks: ['Wuff?'], calmBarks: ['…'],
    },
    {
      id: 'fackel-furt', preset: 'shadow-crossbow', speaker: 'prolog-fackeltraeger', lantern: true, range: 150, fov: 64,
      path: [{ at: [960, 214], wait: 2600, face: 'left' }, { at: [930, 250], wait: 2200, face: 'left' }],
      suspiciousBarks: ['Bewegt sich da was im Wasser?'], calmBarks: ['Nur die Strömung.'],
    },
  ],
  triggers: [
    { id: 'hunde', poly: [[420, 176], [560, 160], [700, 150], [764, 300], [744, 430], [770, 520], [760, 600], [520, 556], [430, 520], [470, 300]] },
    { id: 'nasser-stein', poly: [[1124, 352], [1210, 392], [1196, 470], [1112, 440]] },
  ],
  lights: [
    { id: 'mond', at: [160, 40], kind: 'moon', radius: 300, intensity: 0.3 },
  ],
  spawns: {
    start: { at: START, dir: 'right' },
    mitte: { at: [430, 470], dir: 'right' },
    ostufer: { at: [1012, 470], dir: 'up' },
    'vor-stein': { at: [1074, 360], dir: 'right' },
  },
  stealth: { checkpoint: 'start' },
  time: 'night',
  weather: 'none',
  ambience: ['night', 'wind', 'stream'],
  ambienceVolume: { stream: 0.7, wind: 0.5 },
  music: 'flight',
  playerLight: 46,
  critters: false,
  resetOnEnter: true,
});

// ------------------------------------------------------------------------------------------------- hounds
interface Chase { trail: { x: number; y: number }[]; active: boolean; lost: boolean; checkpoint: string }

function houndDefs(): { id: string; at: [number, number] }[] {
  return [{ id: 'hund-1', at: HOUND_START }, { id: 'hund-2', at: [HOUND_START[0] - 4, HOUND_START[1] + 16] }];
}

function spawnHounds(w: WorldCtx): ActorHandle[] {
  return houndDefs().map(d => {
    if (w.actor(d.id).exists) w.despawn(d.id);
    const a = w.spawn({ id: d.id, preset: 'dog', at: d.at, dir: 'right', solid: false, speed: 100 });
    a.hold(true);
    return a;
  });
}

/** Moves the hounds along the scent trail; returns 'caught' when one reaches Valentus. */
async function houndLoop(w: WorldCtx, chase: Chase): Promise<void> {
  const speeds = [100, 90];
  const idx = [0, 0];
  let barkT = 0;
  while (w.alive) {
    await w.wait(120);
    if (!chase.active) continue;
    // Dialogue and thoughts freeze the player, so the hounds wait as well.
    if (G.ui.busy()) { for (const k of [1, 2]) { const h = w.actor(`hund-${k}`); if (h.exists) void h.walkTo([h.x, h.y], { straight: true }); } continue; }
    const p = w.player;
    // Record scent only on land.
    const last = chase.trail[chase.trail.length - 1];
    if (!inWater(p.x, p.y) && (!last || Math.hypot(last.x - p.x, last.y - p.y) > 10)) chase.trail.push({ x: p.x, y: p.y });
    if (onEastBank(p.x, p.y) && !chase.lost) { void loseScent(w, chase); continue; }
    barkT -= 120;
    for (let k = 0; k < 2; k++) {
      const h = w.actor(`hund-${k + 1}`);
      if (!h.exists) continue;
      // Advance to the next trail point that is not reached yet.
      while (idx[k] < chase.trail.length - 1 && Math.hypot(chase.trail[idx[k]].x - h.x, chase.trail[idx[k]].y - h.y) < 14) idx[k]++;
      const target = chase.trail[idx[k]];
      if (!target) continue;
      void h.walkTo([target.x + k * 6, target.y + k * 4], { straight: true, run: true, speed: speeds[k] });
      if (Math.hypot(h.x - p.x, h.y - p.y) < 22 && !inWater(p.x, p.y)) { chase.active = false; await caught(w, chase, h); idx[0] = idx[1] = 0; break; }
    }
    if (barkT <= 0) {
      barkT = 1600 + Math.random() * 1200;
      const h = w.actor('hund-1');
      const d = h.exists ? Math.hypot(h.x - p.x, h.y - p.y) : 600;
      sfx('bark-dog', { distance: Math.min(1, d / 520), pan: h.x < p.x ? -0.5 : 0.5, key: 'hund' });
    }
  }
}

async function caught(w: WorldCtx, chase: Chase, h: ActorHandle): Promise<void> {
  w.lockPlayer();
  void h.emote('!', 1000);
  sfx('bark-dog', { volume: 1.2 });
  w.camera.shake(200, 0.004);
  await w.say('narrator', 'Die Hunde haben ihn gestellt. Fackeln kommen näher … Noch einmal. *Wasser verwischt die Spur.*');
  await resetTo(w, chase, chase.checkpoint);
  w.unlockPlayer();
}

async function resetTo(w: WorldCtx, chase: Chase, spawn: string): Promise<void> {
  await G.ui.fade('out', 420);
  const at = fluchtMap.spawns[spawn].at as [number, number];
  w.player.teleport(at, fluchtMap.spawns[spawn].dir);
  w.stealth.resetGuards();
  if ((chase.active || G.state.is('prolog-hunde-los')) && !chase.lost) {
    spawnHounds(w);
    chase.trail = [{ x: HOUND_START[0] + 30, y: HOUND_START[1] }, { x: 230, y: 350 }, { x: 300, y: 300 }, { x: at[0], y: at[1] }];
    chase.active = !chase.lost;
  }
  await sleep(250);
  await G.ui.fade('in', 420);
}

async function loseScent(w: WorldCtx, chase: Chase): Promise<void> {
  chase.lost = true;
  chase.active = false;
  G.state.set('prolog-hunde-verloren');
  chase.checkpoint = 'ostufer';
  w.stealth.checkpoint('ostufer');
  for (let k = 1; k <= 2; k++) {
    const h = w.actor(`hund-${k}`);
    if (!h.exists) continue;
    const bank: [number, number] = [740 + k * 10, 260 + k * 40];
    void h.walkTo(bank, { run: true }).then(async () => {
      void h.emote('?', 1600);
      await w.wait(1800);
      await h.walkTo([360 - k * 20, 380 + k * 30], { speed: 70 });
      h.hide();
    }).catch(() => { /* scene ended */ });
  }
  sfx('bark-dog', { distance: 0.6, pitch: 0.8 });
  await w.wait(700);
  w.bark('fackel-furt', 'Die Köter haben die Spur verloren!', 2000);
  await w.think('Sie winseln am Ufer. Das Wasser hat meine Spur geschluckt. Weiter … nach Osten.');
  G.state.complete('prolog-bach');
  w.setObjective('prolog-osten', 'Schlepp dich weiter nach Osten. Nur noch ein Stück.', 'nasser-stein');
  void weaken(w);
}

/** East of the stream: slower and slower, the camera starts to sway. */
async function weaken(w: WorldCtx): Promise<void> {
  const s = sceneOf(w);
  const baseWalk = s.player.walkSpeed, baseRun = s.player.runSpeed;
  const cam = s.cameras.main;
  let t = 0;
  while (w.alive && !G.state.is('prolog-gestuerzt')) {
    await w.wait(50);
    t += 0.05;
    const k = Math.min(1, Math.max(0, (w.player.x - 900) / 300));
    s.player.walkSpeed = baseWalk * (0.75 - k * 0.3);
    s.player.runSpeed = baseRun * (0.55 - k * 0.2);
    if (!reducedMotion()) cam.setRotation(Math.sin(t * 1.3) * (0.006 + k * 0.012));
  }
  cam.setRotation(0);
}

// ------------------------------------------------------------------------------------------------- the end
async function slip(w: WorldCtx): Promise<void> {
  if (G.state.is('prolog-gestuerzt')) return;
  G.state.set('prolog-gestuerzt');
  w.completeObjective('prolog-osten');
  await w.cutscene(async () => {
    w.stealth.enable(false);
    await w.player.walkTo(1150, 410, { speed: 40 });
    sfx('splash', { volume: 0.5 });
    sfx('fall', { volume: 1 });
    await w.player.play('hit', { ms: 300 });
    w.player.play('lie');
    w.camera.shake(260, 0.006);
    await sleep(900);
    await w.say('valentus', 'Der Stein … nass vom Tau …', { portrait: 'valentus-cloak', mood: 'pained' });
    music(null, 4000);
    ambience(['night', 'stream'], 3000, { stream: 0.5 });
    await w.camera.zoom(1.4, 2600);
    await w.think('Ich kann … nicht mehr aufstehen. Verzeih mir, Urmacht. Ich habe dich nicht weit gebracht.');
    // Footsteps, a lantern coming out of the dark.
    let steps: { stop(ms?: number): void; set(o: { distance?: number }): void } | null = null;
    try { steps = G.audio.loop('step-grass', { interval: 0.6, distance: 0.9 }); } catch { steps = null; }
    const lamp = w.lighting.add({ id: 'laterne', at: [1290, 450], kind: 'lantern', radius: 70, intensity: 0, always: true });
    const farmer = w.spawn({ id: 'bauer', preset: 'father', at: [1290, 452], dir: 'left', solid: false, speed: 34 });
    farmer.hold(true);
    void lamp.fadeTo(1, 2600);
    const walk = farmer.walkTo(1186, 418, { straight: true, speed: 30 });
    for (let i = 0; i < 26; i++) {
      await sleep(150);
      lamp.set({ at: [farmer.x - 8, farmer.y - 22] });
      steps?.set({ distance: Math.max(0, 0.9 - i * 0.035) });
    }
    await walk;
    steps?.stop(300);
    lamp.set({ at: [farmer.x - 8, farmer.y - 22] });
    void farmer.play('kneel', { ms: 3000 });
    await w.say('prolog-stimme', 'Bei allen Zehn … da liegt ja einer. He! Lebt Ihr noch?');
    await G.ui.fade('out', 2600);
    await w.say('prolog-stimme', 'Ganz ruhig, Alter. Ich bring Euch nach Hause. Meine Frau weiß, was zu tun ist.');
  });
  await G.ui.narrate('Ein Bauer fand ihn und nahm ihn mit sich nach Hause.', { style: 'card' });
  await G.goto('prolog-zuflucht');
}

// ------------------------------------------------------------------------------------------------- scene
export function prepareFlucht(): void {
  G.state.setParty(['valentus']);
  G.state.addLore('lore-urmacht');
  G.state.addLore('lore-dunkelhain');
}

export async function startFlucht(): Promise<void> {
  await G.ui.fade('out', 0);
  await startWorld({ map: fluchtMap, spawn: 'start', player: 'valentus-cloak', script: fluchtScript });
}

async function fluchtScript(w: WorldCtx): Promise<void> {
  const chase: Chase = { trail: [], active: false, lost: false, checkpoint: 'start' };
  w.stealth.onSpotted(async guard => {
    w.lockPlayer();
    sfx('alert');
    w.bark(guard.id, guard.id === 'spuerhund' ? 'Wuff! Wuff!' : 'Da ist er! Der Alte!', 1400);
    await sleep(900);
    await resetTo(w, chase, chase.checkpoint);
    w.unlockPlayer();
  });
  await G.ui.narrate(['Nacht. Der Wald nördlich von Dunkelhain.', 'Valentus floh, die ~Urmacht~ in sich und einen Pfeil in der Seite. Hinter ihm suchten Fackeln und Hunde den Wald ab.'], { style: 'card' });
  void G.ui.fade('in', 1400);
  w.player.setSpeed(sceneOf(w).player.walkSpeed * 0.85);
  await sleep(900);
  await w.say('valentus', 'Der Pfeil ist heraus. Die Wunde nicht. Weiter … nur weiter.', { portrait: 'valentus-cloak', mood: 'pained' });
  w.setObjective('prolog-flucht', 'Flieh nach Osten durch den Wald. Meide die Fackeln.', [760, 420]);
  await w.say('narrator', `Halte ${w.controlHint('sneak')} gedrückt, um zu schleichen. Geduckt im Unterholz sieht dich niemand. Die Lichtkegel zeigen, wohin die Fackelträger blicken.`);
  sfx('bark-dog', { distance: 0.95 });
  void houndLoop(w, chase).catch(() => { /* scene ended */ });

  await w.waitForTrigger('hunde');
  if (!G.state.is('prolog-hunde-los')) {
    G.state.set('prolog-hunde-los');
    chase.checkpoint = 'mitte';
    w.stealth.checkpoint('mitte');
    sfx('bark-dog', { distance: 0.4, volume: 1.2 });
    w.bark('fackel-1', 'Lasst die Hunde los!', 2000);
    spawnHounds(w);
    const p = w.player;
    chase.trail = [{ x: HOUND_START[0] + 30, y: HOUND_START[1] }, { x: 230, y: 350 }, { x: 300, y: 300 }, { x: p.x, y: p.y }];
    chase.active = true;
    w.completeObjective('prolog-flucht');
    w.setObjective('prolog-bach', 'Die Hunde haben Witterung! Erreiche den Bach – Wasser verwischt die Spur.', [780, 440]);
    await w.think('Die Hunde. Sie riechen das Blut. Der Bach … Wasser trägt keine Witterung.');
  }
  // First step into the water.
  while (w.alive && !inWater(w.player.x, w.player.y)) await w.wait(150);
  if (!chase.lost) await w.think('Kalt … Die Furt bewacht einer mit Fackel. Also flussabwärts, durchs Wasser, ans andere Ufer.');
  await w.waitForTrigger('nasser-stein');
  await slip(w);
}
