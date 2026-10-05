// Kapitel II, Szene 2 `erstes-lager`: die Lichtung hundert Schritte abseits der Straße (640×360, assets/bg/k2-lager.png).
// Herzstück: Steine und Reisig sammeln, Steinkreis legen, Feuerbohren (Timing-Minispiel, ohne Zunder schwerer,
// beim dritten Fehlversuch springt heimlich ein türkiser Funke über), essen, Mantel ausbreiten, schlafen.
// The same clearing (other map ids, same background) hosts `foltan-azar` (night) and the start of `waldweg` (morning).
import { G } from '../../core/G';
import { defineMap, type MapDef, type OccluderDef, type Polygon, type WorldCtx } from '../../world';
import { fireAttempt } from './feuer';
import { fireConfig, newFire, resetAttempt } from './feuerLogic';
import { bg, gotoNext, sfx, sleep } from './shared';

// ---------------------------------------------------------------------------------------------------------------
// Shared geometry of the clearing
// ---------------------------------------------------------------------------------------------------------------

export const LAGER_WALK: Polygon = [
  [214, 104], [300, 98], [396, 100], [404, 126], [436, 148], [470, 158], [500, 158], [530, 160], [560, 174], [590, 194],
  [604, 212], [596, 232], [540, 244], [500, 254], [440, 266], [400, 276], [300, 278], [292, 262], [222, 258], [168, 264],
  [160, 300], [166, 360], [98, 360], [104, 320], [116, 284], [124, 250], [114, 200], [116, 160], [150, 152], [200, 138], [206, 118],
];

export const LAGER_OCCLUDERS: OccluderDef[] = [
  { id: 'busch-sw', baseline: 360, fade: 0.6, poly: [[0, 248], [60, 238], [106, 262], [100, 300], [94, 360], [0, 360]] },
  { id: 'busch-s', baseline: 360, fade: 0.6, poly: [[166, 264], [222, 256], [292, 260], [302, 282], [400, 282], [440, 270], [500, 258], [560, 242], [640, 226], [640, 360], [168, 360]] },
];

/** Where things happen on the clearing (map px). */
export const SPOT = {
  ring: [300, 196] as [number, number],
  ringStand: [274, 204] as [number, number],
  bed: [488, 178] as [number, number],
  bedStand: [470, 190] as [number, number],
  path: [132, 344] as [number, number],
  foltanSit: [258, 206] as [number, number],
  azarBed: [380, 236] as [number, number],
};

const base = {
  background: 'k2-lager',
  walk: [LAGER_WALK],
  occluders: LAGER_OCCLUDERS,
  surfaces: [{ id: 'erde', kind: 'dirt' as const, poly: [[200, 110], [400, 104], [440, 150], [560, 180], [590, 210], [540, 240], [400, 270], [220, 256], [130, 250], [124, 170]] as Polygon }],
  surface: 'forest' as const,
  depthScale: { y0: 100, s0: 0.96, y1: 360, s1: 1.04 },
};

// ---------------------------------------------------------------------------------------------------------------
// Map: first camp (dusk → night)
// ---------------------------------------------------------------------------------------------------------------

const STONES = ['stein-1', 'stein-2', 'stein-3'];
const TWIGS = ['reisig-1', 'reisig-2', 'reisig-3'];

export const lager: MapDef = defineMap({
  ...base,
  id: 'k2-lager',
  name: 'Die Lichtung',
  resetOnEnter: true,
  props: [
    { prop: 'stones-pile', id: 'stein-1-prop', at: [152, 236], collide: false },
    { prop: 'stones-pile', id: 'stein-2-prop', at: [568, 220], collide: false },
    { prop: 'stones-pile', id: 'stein-3-prop', at: [372, 120], collide: false },
    { prop: 'twigs', id: 'reisig-1-prop', at: [182, 158] },
    { prop: 'twigs', id: 'reisig-2-prop', at: [262, 114] },
    { prop: 'twigs', id: 'reisig-3-prop', at: [446, 164] },
    { prop: 'twigs', id: 'reisig-feucht-prop', at: [336, 268], tint: 0x8a9a8a },
  ],
  interactables: [
    ...STONES.map((id, i) => ({
      id, verb: 'Stein aufheben', at: ([[152, 236], [568, 220], [372, 120]] as [number, number][])[i], radius: 22, once: true, sparkle: true,
      onInteract: (w: WorldCtx) => collect(w, 'stein', id),
    })),
    ...TWIGS.map((id, i) => ({
      id, verb: 'Reisig sammeln', at: ([[182, 158], [262, 114], [446, 164]] as [number, number][])[i], radius: 22, once: true, sparkle: true,
      onInteract: (w: WorldCtx) => collect(w, 'reisig', id),
    })),
    {
      id: 'reisig-feucht', verb: 'Reisig sammeln', at: [336, 268], radius: 22, once: false,
      onInteract: async (w: WorldCtx) => {
        await w.player.play('kneel', { ms: 500 });
        await w.think('Feucht und moosig. Das qualmt nur und brennt nicht. Kyra hätte mich ausgelacht.');
      },
    },
    {
      id: 'feuerstelle', verb: 'Steinkreis legen', at: SPOT.ring, radius: 26, once: false, standAt: SPOT.ringStand, face: 'right',
      when: () => Number(G.state.flag('k2-steine') ?? 0) >= 3 && !G.state.is('k2-feuer'),
      onInteract: onFirePlace,
    },
    {
      id: 'essen', verb: 'Essen', at: SPOT.ring, radius: 30, once: false, standAt: [268, 208], face: 'right',
      when: () => G.state.is('k2-feuer'),
      onInteract: eat,
    },
    {
      id: 'schlafplatz', verb: 'Mantel ausbreiten', at: SPOT.bed, radius: 26, once: false, standAt: SPOT.bedStand, face: 'right',
      when: () => G.state.is('k2-gegessen'),
      onInteract: sleepNow,
    },
    {
      id: 'eiche', verb: 'Ansehen', radius: 30, once: true,
      poly: [[500, 60], [600, 50], [610, 158], [540, 160], [500, 140]],
      thought: 'Eine uralte Eiche. Zwischen ihren Wurzeln liegt man wie in einer Wiege.',
    },
    {
      id: 'baumstamm', verb: 'Ansehen', radius: 18, once: true,
      poly: [[20, 100], [180, 96], [184, 146], [24, 150]],
      thought: 'Ein umgestürzter Stamm, ganz mit Moos bewachsen. Darunter liegt bestimmt trockenes Holz.',
    },
  ],
  triggers: [
    { id: 'zurueck', once: false, poly: [[98, 346], [166, 346], [166, 360], [98, 360]], onEnter: async w => {
      await w.think('Zurück zur Straße? Nicht im Dunkeln.');
      await w.cutscene(() => w.player.walkTo([132, 318], { straight: true }));
    } },
  ],
  lights: [{ id: 'abendlicht', at: [40, 60], kind: 'moon', radius: 200, intensity: 0.25 }],
  spawns: { pfad: { at: SPOT.path, dir: 'up' } },
  time: 'dusk',
  baked: 'dusk',
  weather: 'none',
  ambience: ['wind', 'crickets', 'night'],
  ambienceVolume: { wind: 0.5, night: 0.6 },
  music: null,
  playerLight: 46,
});

// ---------------------------------------------------------------------------------------------------------------
// Script
// ---------------------------------------------------------------------------------------------------------------

function countText(): string {
  const s = Number(G.state.flag('k2-steine') ?? 0), t = Number(G.state.flag('k2-reisig') ?? 0);
  return `Sammle Steine (${s}/3) und trockenes Reisig (${t}/3).`;
}

function nearestLeft(w: WorldCtx): string | null {
  const left = [...STONES, ...TWIGS].filter(id => !w.interactable(id).used);
  let best: string | null = null, bd = Infinity;
  const pos: Record<string, [number, number]> = {
    'stein-1': [152, 236], 'stein-2': [568, 220], 'stein-3': [372, 120], 'reisig-1': [182, 158], 'reisig-2': [262, 114], 'reisig-3': [446, 164],
  };
  for (const id of left) {
    const [x, y] = pos[id];
    const d = Math.hypot(x - w.player.x, y - w.player.y);
    if (d < bd) { bd = d; best = id; }
  }
  return best;
}

async function collect(w: WorldCtx, kind: 'stein' | 'reisig', id: string): Promise<void> {
  await w.player.play('kneel', { ms: 420 });
  w.prop(`${id}-prop`).remove();
  sfx(kind === 'stein' ? 'stone-place' : 'rustle', { volume: 0.7 });
  const n = G.state.inc(kind === 'stein' ? 'k2-steine' : 'k2-reisig');
  if (kind === 'reisig' && n === 1) w.bark('player', 'Trocken. Gut.');
  if (kind === 'stein' && n === 1) w.bark('player', 'Schwer …');
  const s = Number(G.state.flag('k2-steine') ?? 0), t = Number(G.state.flag('k2-reisig') ?? 0);
  if (s >= 3 && t >= 3) {
    w.completeObjective('k2-lager-sammeln');
    await w.think('Genug. Jetzt eine Feuerstelle, mitten auf der Lichtung.');
    w.setObjective('k2-lager-ring', 'Lege in der Mitte der Lichtung einen Steinkreis.', SPOT.ring);
  } else {
    w.setObjective('k2-lager-sammeln', countText(), nearestLeft(w));
  }
}

async function onFirePlace(w: WorldCtx): Promise<void> {
  if (Number(G.state.flag('k2-reisig') ?? 0) < 3) {
    await w.think('Erst brauche ich noch trockenes Reisig.');
    return;
  }
  if (!G.state.is('k2-ring')) {
    await w.player.play('kneel', { ms: 900 });
    for (let i = 0; i < 3; i++) { sfx('stone-place', { volume: 0.6, pitch: 0.9 + i * 0.08 }); await sleep(220); }
    w.addProp({ prop: 'firering', id: 'ring', at: SPOT.ring });
    w.addProp({ prop: 'twigs', id: 'ring-reisig', at: [SPOT.ring[0] + 2, SPOT.ring[1] - 2], collide: false });
    w.fx.burst(SPOT.ring, 'dust', 6);
    G.state.set('k2-ring');
    w.completeObjective('k2-lager-ring');
    await w.think('Eine Mulde, ein Steinkreis, Reisig und trockenes Laub. Wie in den Abenteuerbüchern.');
    w.setObjective('k2-lager-feuer', 'Entfache ein Feuer.', 'feuerstelle');
    return;
  }
  await drillFire(w);
}

async function drillFire(w: WorldCtx): Promise<void> {
  const tinder = G.state.has('tinder');
  if (!G.state.is('k2-feuer-versucht')) {
    G.state.set('k2-feuer-versucht');
    if (tinder) await w.think('Gut, dass ich Zunder dabeihabe. Damit fängt die Glut viel schneller.');
    else await w.think('Zu Hause hatten wir Zunder. Den hätte ich besser mitgenommen. Dann eben mit trockenem Laub.');
  }
  const c = fireConfig(tinder);
  const s = newFire();
  w.lockPlayer();
  G.ui.setHud('cinematic');
  w.player.face('right');
  w.player.setIdle('kneel');
  let result: string;
  try {
    for (;;) {
      const r = await fireAttempt(s, c, {
        onHit: heat => {
          sfx('drill', { volume: 0.8, pitch: 0.9 + heat / 300 });
          w.fx.burst([SPOT.ring[0], SPOT.ring[1] - 4], 'smoke', heat > 50 ? 3 : 1);
        },
        onSlip: () => { sfx('thud', { volume: 0.5 }); w.camera.shake(120, 0.002); },
      });
      if (r === 'ember' || r === 'spark') { result = r; break; }
      // A failed attempt: Lia's own grumbling, then the next try.
      const lines = tinder
        ? ['Na komm schon …', 'Meine Hände krampfen. Noch einmal.']
        : ['Na komm schon. Ich hab es doch fast.', 'Ohne Zunder … dummes, dummes Laub.'];
      w.player.setIdle('idle');
      await w.think(lines[Math.min(lines.length - 1, s.failed - 1)]);
      w.player.setIdle('kneel');
      resetAttempt(s);
    }
  } finally {
    G.ui.setHud('explore');
    w.unlockPlayer();
  }
  if (result === 'spark') {
    // The secret turquoise spark (Adaption, DESIGN §1/§7.4): the player sees it, Lia does not.
    G.state.set('k2-funke');
    await w.cutscene(async () => {
      await w.think('Nur noch Qualm. Ich puste. Ein letztes Mal …');
      await sleep(500);
      const at: [number, number] = [SPOT.ring[0], SPOT.ring[1] - 6];
      const glow = w.lighting.add({ id: 'funke', at, kind: 'urmacht', radius: 64, intensity: 0, always: true });
      sfx('spark');
      w.fx.burst(at, 'urmacht', 18);
      await glow.fadeTo(1.4, 260);
      await sleep(380);
      w.fx.burst(at, 'urmacht', 8);
      sfx('spark', { pitch: 1.2, volume: 0.6 });
      await sleep(300);
      bg(glow.fadeTo(0, 900).then(() => glow.remove()));
      await igniteFire(w);
      await w.think('Es brennt! Ich hab’s geschafft! … Ganz allein.');
    });
  } else {
    await w.cutscene(async () => {
      await sleep(250);
      await igniteFire(w);
      await w.think('Es brennt! Na also. Kyra wäre beeindruckt. Ein bisschen.');
    });
  }
  w.player.setIdle('idle');
  G.state.addMemory('k2-mem-feuer');
  w.completeObjective('k2-lager-feuer');
  w.setObjective('k2-lager-essen', 'Setz dich ans Feuer und iss etwas.', 'essen');
}

export function addCampfire(w: WorldCtx, intensity = 1.1): void {
  if (w.prop('ring').exists) w.prop('ring').remove();
  if (w.prop('ring-reisig').exists) w.prop('ring-reisig').remove();
  if (!w.prop('lagerfeuer').exists) w.addProp({ prop: 'campfire', id: 'lagerfeuer', at: SPOT.ring, light: false });
  w.lighting.add({ id: 'feuerlicht', at: [SPOT.ring[0], SPOT.ring[1] - 8], kind: 'fire', radius: 120, intensity, flame: 0.8, always: true });
}

async function igniteFire(w: WorldCtx): Promise<void> {
  sfx('fire-ignite');
  addCampfire(w, 0);
  await w.lighting.get('feuerlicht').fadeTo(1.15, 900);
  G.state.set('k2-feuer');
  bg(w.lighting.set('night', 6000));
  try { G.audio.ambience(['crickets', 'night', 'fire'], { fadeMs: 1200, volume: { fire: 0.8, night: 0.5 } }); } catch { /* audio optional */ }
  try { G.audio.music('refuge', { fadeMs: 3000 }); } catch { /* audio optional */ }
}

async function eat(w: WorldCtx): Promise<void> {
  w.player.setIdle('sit');
  const food: { id: string; label: string; line: string; memory?: string }[] = [
    { id: 'bread', label: 'Brot und Käse', line: 'Brot und Käse. Wie an jedem Erntetag auf dem Feld. Nur ohne Kyra, die mir den Käse klaut.' },
    { id: 'bacon', label: 'Speck', line: 'Geräuchert. Vater hat ihn im Frühjahr selbst aufgehängt.' },
    { id: 'chain-pastry', label: 'Kettengebäck', line: 'Süß und weich. Kyra hätte die Hälfte gewollt. Die größere Hälfte.', memory: 'k2-mem-fest' },
    { id: 'apple', label: 'Apfel', line: 'Knackig. Der Händler hat nicht gelogen.' },
    { id: 'honey-cake', label: 'Honig-Apfelkuchen', line: 'Honig und Äpfel. Vaters Kuchen. Ich esse ganz langsam.' },
  ];
  for (;;) {
    const avail = food.filter(f => G.state.has(f.id));
    const opts = [
      ...avail.map(f => f.label),
      { text: 'Die Ferse versorgen', disabled: !G.state.has('tincture') || G.state.is('k2-ferse'), reason: G.state.is('k2-ferse') ? 'Schon versorgt.' : 'Keine Tinktur.' },
      { text: 'Im Alana-Buch lesen', disabled: !G.state.has('book-alana') || G.state.is('k2-alana-versucht'), reason: G.state.is('k2-alana-versucht') ? 'Nicht heute Nacht.' : 'Das Buch ist zu Hause geblieben.' },
      G.state.is('k2-gegessen') ? 'Genug für heute.' : { text: 'Genug für heute.', disabled: true, reason: 'Erst etwas essen. Der Tag war lang.' },
    ];
    const pick = await w.choose(opts, { speaker: 'k2-lia', prompt: 'Am Feuer. Was jetzt?' });
    if (pick < avail.length) {
      const f = avail[pick];
      if (f.id === 'bread') { G.state.take('bread'); if (G.state.has('cheese')) G.state.take('cheese'); }
      else G.state.take(f.id);
      sfx('eat');
      await w.think(f.line);
      if (f.memory) G.state.addMemory(f.memory);
      if (!G.state.is('k2-gegessen')) {
        G.state.set('k2-gegessen');
        w.completeObjective('k2-lager-essen');
      }
      continue;
    }
    const rest = pick - avail.length;
    if (rest === 0) {
      G.state.set('k2-ferse');
      await w.think('Die Ferse ist wund gescheuert. Mutters Tinktur. „Es brennt, weil es hilft.“');
      sfx('heal', { volume: 0.4 });
      G.state.addMemory('k2-mem-tinktur');
    } else if (rest === 1) {
      G.state.set('k2-alana-versucht');
      w.player.setIdle('read');
      await sleep(600);
      await w.think('„Alana hob die Hand, und das Licht gehorchte ihr …“');
      await w.think('Ich lese denselben Satz zum fünften Mal. Ich kann nicht. Nicht heute.');
      w.player.setIdle('sit');
    } else {
      break;
    }
  }
  w.player.setIdle('idle');
  w.setObjective('k2-lager-schlafen', 'Breite den Mantel zwischen den Eichenwurzeln aus und schlaf.', 'schlafplatz');
}

async function sleepNow(w: WorldCtx): Promise<void> {
  await w.cutscene(async () => {
    w.addProp({ prop: 'cloak-spread', id: 'mantel', at: [SPOT.bed[0], SPOT.bed[1] + 4], collide: false, depthOffset: -30 });
    sfx('rustle', { volume: 0.5 });
    await sleep(300);
    w.player.teleport(SPOT.bed, 'right');
    w.player.setIdle('lie');
    G.state.set('k2-schlafplatz');
    w.completeObjective('k2-lager-schlafen');
    w.weather.set('fireflies', { ms: 4000, intensity: 0.5 });
    await w.camera.zoom(1.25, 2600);
    await w.think('Gestern hatte ich noch ein Zuhause.');
    await w.think('Kyra … wo bist du jetzt? Frierst du auch?');
    await sleep(1200);
    await w.think('Nur kurz die Augen zumachen …');
  });
  await G.ui.fade('out', 2200);
  try { G.audio.music(null, { fadeMs: 2500 }); } catch { /* audio optional */ }
  await sleep(600);
  await gotoNext('foltan-azar');
}

export async function erstesLagerSkript(w: WorldCtx): Promise<void> {
  if (G.state.is('k2-feuer')) addCampfire(w);
  await sleep(600);
  await w.think('Hier. Von der Straße aus sieht mich niemand.');
  await w.think('Es wird kalt. Ich brauche ein Feuer, solange ich noch etwas sehe.');
  w.setObjective('k2-lager-sammeln', countText(), nearestLeft(w));
}
