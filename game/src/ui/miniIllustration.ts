import { loadImage } from '../art/assets';
import { previewCanvas } from '../art/blurhash';
import { manifest, type CharacterEntry } from '../art/manifest';
import { G } from '../core/G';
import { ctx as ui } from './context';
import type { StoryActionKind } from './interactionRules';

export type IllustrationKind = StoryActionKind | 'blow' | 'stake';
export interface IllustrationState {
  progress: number; position?: number; strokes?: number;
  breath?: number; noise?: number; watch?: boolean; beat?: boolean; puff?: boolean;
}

const DESCRIPTIONS: Record<IllustrationKind, string> = {
  reach: 'Valentus streckt die Hand nach der schwebenden Kugel der Urmacht aus.',
  lift: 'Valentus hebt die Hand über die Wiege, in der die Zwillinge schlafen.',
  'open-eyes': 'Lia öffnet langsam die Augen.',
  tend: 'Lia tupft Mutters Tinktur mit einem Leinenbausch auf ihre wunde Ferse am Bach.',
  bellows: 'Der Blasebalg facht die Glut in Azars Esse an.',
  blow: 'Lia und Azar knien an der Glut im Steinring.',
  stake: 'Kyra zieht an dem Pflock, während ein Dunkelschatten am Feuer Wache hält.',
};

/**
 * What Lia sees when she opens her eyes. `backdrop` is a plate id (assets/cut/<id>.jpg) showing who stands over her.
 * Without it, or while that plate does not exist yet, the scene's painted map background is shown heavily blurred and
 * without figures (`fallback`, default: the background of the running world map) – never someone else's faces.
 */
export interface GestureView {
  backdrop?: string;
  fallback?: string;
  /** Point of the image (fractions) that stays centred, and zoom over "cover". */
  focus?: readonly [number, number];
  zoom?: number;
  /** Accessible description of the picture (defaults to a neutral line). */
  description?: string;
}

/** Story-specific illustrations. The five story gestures are painted close-ups; blow and stake stay map-scale vignettes. */
export function createMiniIllustration(host: HTMLElement, kind: IllustrationKind, view: GestureView = {}) {
  return kind === 'blow' || kind === 'stake' ? legacyIllustration(host, kind) : paintedGesture(host, kind, view);
}

/** Background id of the running world map, if any (duck-typed so the UI does not depend on the world module). */
function activeMapBackground(): string | undefined {
  try {
    for (const scene of G.game?.scene.getScenes(true) ?? []) {
      const id = (scene as unknown as { map?: { background?: string } }).map?.background;
      if (id) return id;
    }
  } catch { /* no game yet */ }
  return undefined;
}

/** Image candidates for the open-eyes gesture, best first. `blurred` marks the figure-less fallback. */
export function wakeCandidates(view: GestureView, art = manifest(), mapBackground = activeMapBackground()): { file: string; blurred: boolean; lantern: boolean }[] {
  const out: { file: string; blurred: boolean; lantern: boolean }[] = [];
  if (view.backdrop) out.push({ file: art.plates[view.backdrop]?.file ?? `assets/cut/${view.backdrop}.jpg`, blurred: false, lantern: view.backdrop === 'k2-geweckt' });
  const bg = view.fallback ?? mapBackground;
  const bgFile = bg ? art.backgrounds[bg]?.file : undefined;
  if (bgFile) out.push({ file: bgFile, blurred: true, lantern: false });
  return out;
}

// ------------------------------------------------------------------------------------------------ painted gestures

type Pt = { x: number; y: number };
interface Framing { s: number; ox: number; oy: number }
type IllustrationImage = HTMLImageElement | HTMLCanvasElement;
const TAU = Math.PI * 2;
const hash = (i: number) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => v * v * (3 - 2 * v);

/** Image file + framing of each gesture: focus point (fraction of the image) that stays centred, and zoom over "cover". */
interface Shot { focus: [number, number]; zoom: number }
const SCENES: Record<StoryActionKind, Shot & { pixel?: boolean; tall?: Shot }> = {
  reach: { focus: [0.56, 0.42], zoom: 1.06 },
  lift: { focus: [0.52, 0.42], zoom: 1.12 },
  'open-eyes': { focus: [0.77, 0.34], zoom: 1.62, tall: { focus: [0.71, 0.36], zoom: 1.12 } },
  tend: { focus: [0.44, 0.5], zoom: 1.12 },
  bellows: { focus: [0.545, 0.55], zoom: 1.1, tall: { focus: [0.57, 0.58], zoom: 1 } },
};

function paintedGesture(host: HTMLElement, kind: StoryActionKind, wake: GestureView) {
  const art = manifest();
  const canvas = document.createElement('canvas');
  canvas.className = 'mini-illustration is-painted';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', (kind === 'open-eyes' && wake.description) || DESCRIPTIONS[kind]);
  host.prepend(canvas);
  host.classList.add('has-mini-art');
  host.dataset.art = 'loading';
  const g = canvas.getContext('2d')!;
  const image = (key: string) => art.images[`minigames/${key}`]?.file ?? `assets/minigames/${key}.${key.endsWith('-scene') ? 'jpg' : 'png'}`;
  const files: Record<string, string> = {
    reach: { backdrop: image('gesture-reach-scene'), arm: image('gesture-reach-arm') },
    lift: { backdrop: image('gesture-lift-scene'), arm: image('gesture-lift-arm') },
    'open-eyes': {} as Record<string, string>,
    tend: { backdrop: image('gesture-tend-scene'), hand: image('gesture-tend-hand') },
    bellows: {
      backdrop: image('gesture-bellows-scene'),
      top: image('gesture-bellows-top'), leather: image('gesture-bellows-leather'), base: image('gesture-bellows-base'),
    },
  }[kind];
  const pictures = new Map<string, IllustrationImage>();
  for (const [id, file] of Object.entries(files)) {
    const preview = previewCanvas(file);
    if (preview) pictures.set(id, preview);
  }
  let loaded = false;
  let completed = 0;
  // Open-eyes: the first candidate that loads wins (scene plate, else the blurred map background without figures).
  let blurred = false, lantern = false;
  const candidates = kind === 'open-eyes' ? wakeCandidates(wake) : [];
  if (candidates[0]) {
    const preview = previewCanvas(candidates[0].file);
    if (preview) { pictures.set('backdrop', preview); blurred = candidates[0].blurred; lantern = candidates[0].lantern; }
  }
  const ready = (kind === 'open-eyes'
    ? (async () => {
      for (const c of candidates) {
        const pic = await loadImage(c.file);
        if (pic) { pictures.set('backdrop', pic); blurred = c.blurred; lantern = c.lantern; host.dataset.backdrop = c.blurred ? 'fallback' : 'plate'; return true; }
      }
      pictures.delete('backdrop');
      host.dataset.backdrop = 'none';
      return true;
    })()
    : Promise.all(Object.entries(files).map(async ([id, file]) => {
      const pic = await loadImage(file);
      if (pic) { pictures.set(id, pic); completed++; }
    })).then(() => completed === Object.keys(files).length)
  ).then(ok => {
    loaded = ok;
    host.dataset.art = loaded ? 'ready' : 'failed';
    return loaded;
  });

  let time = 0, W = 0, H = 0, view: Framing = { s: 1, ox: 0, oy: 0 };
  let lastStrokes = 0, flare = 0, lastPosition: number | undefined, motion = 0, moveDir = 0;
  const at = (x: number, y: number): Pt => ({ x: view.ox + x * view.s, y: view.oy + y * view.s });
  const reduced = () => ui.reducedMotion;

  const frame = (pic: IllustrationImage) => {
    const custom: Shot | undefined = kind === 'open-eyes' && !lantern ? { focus: [wake.focus?.[0] ?? 0.5, wake.focus?.[1] ?? 0.45], zoom: wake.zoom ?? 1.08 } : undefined;
    const scene = custom ?? ((W / H < 1.1 && SCENES[kind].tall) || SCENES[kind]);
    const s = Math.max(W / pic.width, H / pic.height) * scene.zoom;
    const ox = Math.min(0, Math.max(W - pic.width * s, W / 2 - scene.focus[0] * pic.width * s));
    const oy = Math.min(0, Math.max(H - pic.height * s, H / 2 - scene.focus[1] * pic.height * s));
    view = { s, ox, oy };
  };
  const backdrop = (alpha = 1, dx = 0, dy = 0) => {
    const pic = pictures.get('backdrop');
    if (!pic) return;
    g.save();
    g.globalAlpha = alpha;
    g.imageSmoothingEnabled = !SCENES[kind].pixel;
    g.drawImage(pic, view.ox + dx, view.oy + dy, pic.width * view.s, pic.height * view.s);
    g.restore();
  };
  /** Draws a cut-out so that its anchor (fractions of the image) lands on p. */
  const cutout = (id: string, p: Pt, height: number, anchor: [number, number], rotate = 0, alpha = 1) => {
    const pic = pictures.get(id);
    if (!pic) return;
    const w = height * pic.width / pic.height;
    g.save();
    g.globalAlpha = alpha;
    g.translate(p.x, p.y); g.rotate(rotate);
    g.drawImage(pic, -anchor[0] * w, -anchor[1] * height, w, height);
    g.restore();
  };
  /** Soft additive light. */
  const light = (p: Pt, radius: number, color: string, alpha: number, core = '#ffffff') => {
    if (alpha <= 0.002 || radius <= 0) return;
    const grad = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
    grad.addColorStop(0, core); grad.addColorStop(0.18, color); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(1, alpha);
    g.fillStyle = grad; g.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2); g.restore();
  };
  /** Small glowing motes; deterministic, frozen with reduced motion. */
  const motes = (count: number, spawn: (i: number, t: number) => Pt & { a: number; r: number }, color: string) => {
    g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = color;
    for (let i = 0; i < count; i++) {
      const m = spawn(i, ((reduced() ? 0.37 : time) * (0.18 + hash(i) * 0.22) + hash(i + 7)) % 1);
      if (m.a <= 0.01) continue;
      g.globalAlpha = Math.min(1, m.a);
      g.beginPath(); g.arc(m.x, m.y, m.r, 0, TAU); g.fill();
    }
    g.restore();
  };
  const vignette = (strength: number, tint = '5,7,12') => {
    const grad = g.createRadialGradient(W / 2, H * 0.48, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.62);
    grad.addColorStop(0, `rgba(${tint},0)`); grad.addColorStop(1, `rgba(${tint},${strength})`);
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
  };
  /** Darkened band under the control rail, so the gilt slider reads on every painting. */
  const railBand = (vertical: boolean) => {
    const size = 84;
    const grad = vertical ? g.createLinearGradient(W - size, 0, W, 0) : g.createLinearGradient(0, H - size, 0, H);
    grad.addColorStop(0, 'rgba(6,9,16,0)'); grad.addColorStop(1, 'rgba(6,9,16,0.72)');
    g.fillStyle = grad;
    if (vertical) g.fillRect(W - size, 0, size, H); else g.fillRect(0, H - size, W, size);
  };
  const flicker = (seed: number) => reduced() ? 1 : 0.86 + 0.08 * Math.sin(time * 9.1 + seed) + 0.06 * Math.sin(time * 23.7 + seed * 3);

  // ---- per gesture
  const drawReach = (p: number, pos: number) => {
    backdrop();
    const orb = at(903, 226), r = 92 * view.s;
    const pulse = reduced() ? 1 : 1 + 0.05 * Math.sin(time * 2.4);
    light(orb, r * 3.2 * pulse, 'rgba(73,224,200,0.55)', 0.35 + 0.45 * p, '#e9fffb');
    // The arm enters from the left; its fingertips stop just before the light.
    const tipEnd = { x: orb.x - r * 1.05, y: orb.y + r * 0.42 };
    const tipStart = { x: Math.max(W * 0.24, tipEnd.x - W * 0.42), y: tipEnd.y + r * 0.35 };
    const e = ease(pos);
    const tip = { x: tipStart.x + (tipEnd.x - tipStart.x) * e, y: tipStart.y + (tipEnd.y - tipStart.y) * e };
    const armPic = pictures.get('arm'), aspect = armPic ? armPic.width / armPic.height : 2.17;
    const armW = Math.max(H * 0.5 * aspect, tipEnd.x + 30), armH = armW / aspect;
    // Turquoise threads reach from the light towards the hand as it closes in.
    g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const a = Math.pow(p, 1.6) * (0.55 - i * 0.1);
      if (a <= 0.01) continue;
      const wob = reduced() ? 0 : Math.sin(time * (1.6 + i * 0.4) + i * 2) * r * 0.35;
      g.strokeStyle = `rgba(120,255,232,${a})`; g.lineWidth = Math.max(1, r * (0.07 - i * 0.012));
      g.beginPath(); g.moveTo(orb.x - r * 0.5, orb.y + (i - 1.5) * r * 0.18);
      g.bezierCurveTo(orb.x - r * 1.4, orb.y - r * 0.6 + wob, tip.x + r * 0.7, tip.y - r * 0.4 - wob, tip.x - r * 0.08, tip.y - r * 0.12);
      g.stroke();
    }
    g.restore();
    cutout('arm', tip, armH, [0.995, 0.31], (1 - e) * 0.06);
    light({ x: tip.x - armH * 0.18, y: tip.y + armH * 0.02 }, armH * (0.35 + 0.35 * p), 'rgba(73,224,200,0.5)', 0.15 + 0.6 * p, '#d9fff7');
    motes(34, (i, t) => {
      const ang = hash(i) * TAU + t * TAU * 0.4, rad = r * (1.1 + hash(i + 3) * 1.4) * (1 - 0.55 * p * t);
      const pull = p * t;
      return { x: orb.x + Math.cos(ang) * rad * (1 - pull) + (tip.x - orb.x) * pull * 0.8, y: orb.y + Math.sin(ang) * rad * 0.7 * (1 - pull) + (tip.y - orb.y) * pull * 0.8,
        a: (0.35 + 0.5 * p) * Math.sin(t * Math.PI), r: 1 + hash(i + 5) * 1.6 };
    }, '#b9fff2');
    vignette(0.75);
    if (p >= 1) light(orb, Math.max(W, H), 'rgba(160,255,240,0.6)', 0.35, '#ffffff');
    railBand(false);
  };

  const drawLift = (p: number, pos: number) => {
    backdrop();
    const candle = at(253, 160);
    light(candle, H * 0.55 * flicker(1), 'rgba(255,170,80,0.45)', 0.4, '#fff1c8');
    const babies = at(666, 150);
    const armH = H * 1.08, e = ease(1 - pos);
    const tipTop = babies.y + H * 0.13, tipBottom = H * 0.9;
    const tip = { x: babies.x + W * 0.03, y: tipBottom + (tipTop - tipBottom) * e };
    // Urmacht settles over the twins as the hand rises.
    light(babies, H * (0.35 + 0.25 * p), 'rgba(73,224,200,0.5)', p * 0.75, '#e6fffb');
    cutout('arm', tip, armH, [0.43, 0], (1 - e) * -0.08);
    const palm = { x: tip.x, y: tip.y + armH * 0.2 };
    light(palm, armH * 0.32, 'rgba(73,224,200,0.55)', 0.1 + 0.55 * p, '#dffff8');
    motes(30, (i, t) => {
      const sx = palm.x + (hash(i) - 0.5) * armH * 0.25, ex = babies.x + (hash(i + 9) - 0.5) * W * 0.16;
      return { x: sx + (ex - sx) * t + Math.sin(t * 6 + i) * 6, y: palm.y + (babies.y - palm.y) * t, a: p * Math.sin(t * Math.PI) * 0.9, r: 1 + hash(i + 2) * 1.8 };
    }, '#c4fff4');
    motes(18, (i, t) => ({ x: W * hash(i + 40), y: H * (1 - t), a: 0.25 * Math.sin(t * Math.PI), r: 0.8 + hash(i) }), '#ffd89a');
    vignette(0.7, '8,5,3');
    if (p >= 1) light(babies, Math.max(W, H), 'rgba(160,255,240,0.6)', 0.3, '#ffffff');
    railBand(true);
  };

  const drawOpenEyes = (p: number) => {
    const open = ease(p);
    const pic = pictures.get('backdrop');
    const canFilter = 'filter' in g;
    // The figure-less fallback never comes fully into focus: a place, not people.
    const blur = blurred ? 6 + (1 - open) * 6 : (1 - open) * 7;
    const bright = blurred ? 0.4 + 0.25 * open : 0.55 + 0.45 * open;
    if (canFilter) g.filter = `blur(${blur.toFixed(1)}px) brightness(${bright.toFixed(2)})`;
    backdrop();
    if (canFilter) g.filter = 'none';
    // A drowsy double image that slides into focus.
    if (pic && open < 0.98) backdrop(0.35 * (1 - open), (1 - open) * W * 0.03, (1 - open) * H * 0.01);
    if (lantern) {
      // Azar's lantern and the campfire in plate k2-geweckt.
      light(at(1160, 190), H * 0.5 * flicker(2), 'rgba(255,170,70,0.5)', 0.25 + 0.35 * open, '#fff0c0');
      light(at(1120, 610), H * 0.45 * flicker(5), 'rgba(255,120,40,0.45)', 0.2 + 0.2 * open, '#ffd08a');
    }
    vignette(blurred ? 0.75 : 0.6);
    // Eyelids: warm darkness with light glowing through, an almond opening that widens with the gesture.
    if (open < 1) {
      g.save();
      g.fillStyle = `rgba(70,16,10,${(0.35 * (1 - open)).toFixed(3)})`; g.fillRect(0, 0, W, H);
      const lid = g.createLinearGradient(0, 0, 0, H);
      lid.addColorStop(0, '#070304'); lid.addColorStop(0.42, '#2a0d09'); lid.addColorStop(0.5, '#3b140c'); lid.addColorStop(0.58, '#2a0d09'); lid.addColorStop(1, '#070304');
      g.fillStyle = lid;
      const cx = W / 2, cy = H * 0.5, rx = W * (0.62 + 0.3 * open), ry = H * (0.02 + 0.76 * open);
      if (canFilter) g.filter = `blur(${Math.max(2, Math.min(W, H) * 0.02).toFixed(1)}px)`;
      g.globalAlpha = open > 0.85 ? (1 - open) / 0.15 : 1;
      g.beginPath(); g.rect(-20, -20, W + 40, H + 40);
      g.ellipse(cx, cy, rx, ry, 0, 0, TAU);
      g.fill('evenodd');
      g.restore();
    }
    railBand(true);
  };

  const drawTend = (p: number, pos: number) => {
    backdrop();
    // Sunlight dapples drifting over the stones and the water sparkling.
    motes(14, (i, t) => ({ x: W * hash(i + 3) + Math.sin(t * TAU) * 10, y: H * (0.05 + 0.25 * hash(i + 11)), a: 0.55 * Math.max(0, Math.sin(t * TAU * 2 + i)), r: 1.2 + hash(i) * 1.5 }), '#fff8dc');
    const wound = at(452, 381), size = 70 * view.s;
    // The scrape throbs until the tincture is on it; then a cool, glistening glaze settles.
    const throb = reduced() ? 0.7 : 0.6 + 0.4 * Math.sin(time * 3.2);
    light(wound, size * 1.1, 'rgba(230,60,40,0.55)', (1 - p) * 0.28 * throb, 'rgba(255,90,60,0.9)');
    const glaze = g.createRadialGradient(wound.x, wound.y, 0, wound.x, wound.y, size);
    glaze.addColorStop(0, `rgba(196,190,96,${0.42 * p})`); glaze.addColorStop(0.7, `rgba(150,170,80,${0.22 * p})`); glaze.addColorStop(1, 'rgba(150,170,80,0)');
    g.fillStyle = glaze; g.beginPath(); g.ellipse(wound.x, wound.y, size, size * 0.8, -0.3, 0, TAU); g.fill();
    light({ x: wound.x - size * 0.2, y: wound.y - size * 0.25 }, size * 0.35, 'rgba(255,255,230,0.7)', p * 0.55, '#ffffff');
    const swing = (pos - 0.5) * 2;
    const tip = { x: wound.x + swing * size * 1.15, y: wound.y + size * 0.05 - Math.cos(swing * Math.PI / 2) * size * 0.18 };
    if (motion > 0.02) motes(10, (i, t) => ({ x: tip.x + (hash(i) - 0.5) * size * 0.8, y: tip.y - t * size * 0.5, a: Math.min(1, motion * 4) * (1 - t) * 0.8, r: 1 + hash(i + 1) }), '#e9f2a8');
    cutout('hand', tip, H * 0.92, [0.356, 0.985], swing * 0.07 - 0.04);
    vignette(0.55, '10,14,6');
    railBand(false);
  };

  // The painted bellows stands on the smithy floor; its nozzle sits in the iron air pipe of Azar's hearth.
  const PIPE: Pt = { x: 700, y: 446 }, NOZZLE_Y = 34 / 76;
  let bellowsLayer: HTMLCanvasElement | undefined;
  const geometry = { bellowsTop: 0, leatherTop: 0, leatherH: 0, x: 0, w: 0, bottom: 0 };
  const layoutBellows = (pos: number) => {
    const tall = W / H < 1.1;
    const hasBackdrop = pictures.has('backdrop');
    const w = hasBackdrop ? W * (tall ? 0.5 : 0.33) : Math.min(W * 0.48, H * 1.05), k = w / 640;
    // Until the art is there, a plain bottom-left placement keeps the fold box meaningful.
    const pipe = hasBackdrop ? at(PIPE.x, PIPE.y) : { x: W * 0.05 + w, y: H - 10 - 42 * k };
    const x = pipe.x + 3 * k - w;
    const bottom = pipe.y - NOZZLE_Y * 76 * k + 76 * k;
    const leatherBottom = bottom - 34 * k;
    const leatherH = 164 * k * Math.max(0.12, 1.12 - pos);
    Object.assign(geometry, { x, w, bottom, leatherH, leatherTop: leatherBottom - leatherH, bellowsTop: leatherBottom - leatherH - 134 * k });
    host.style.setProperty('--folds-left', `${geometry.x.toFixed(1)}px`);
    host.style.setProperty('--folds-width', `${(w * 0.86).toFixed(1)}px`);
    host.style.setProperty('--folds-top', `${geometry.leatherTop.toFixed(1)}px`);
    host.style.setProperty('--folds-height', `${leatherH.toFixed(1)}px`);
  };
  const drawBellows = (p: number, pos: number) => {
    backdrop();
    const fire = at(1052, 270), coals = at(1040, 318);
    const heat = Math.min(1.4, 0.25 + 0.6 * p + flare * 0.7);
    light(fire, H * (0.3 + 0.3 * heat) * flicker(4), 'rgba(255,120,40,0.6)', 0.3 + 0.4 * heat, '#fff2b0');
    light(coals, H * 0.14 * heat, 'rgba(255,200,110,0.9)', 0.45 * heat, '#ffffff');
    // Azar's lantern and the wall lamp breathe a little.
    light(at(78, 190), H * 0.16 * flicker(7), 'rgba(255,170,80,0.5)', 0.35, '#fff0c8');
    light(at(1212, 140), H * 0.18 * flicker(9), 'rgba(255,170,80,0.5)', 0.35, '#fff0c8');
    motes(Math.round(10 + 26 * Math.min(1, heat)), (i, t) => ({
      x: coals.x + (hash(i) - 0.5) * W * 0.16 + Math.sin(t * 8 + i) * 8, y: coals.y - t * H * (0.3 + hash(i + 4) * 0.3),
      a: (1 - t) * Math.min(1, heat), r: 0.8 + hash(i + 2) * 1.6,
    }), '#ffb35a');
    const { x, w, leatherTop, leatherH, bellowsTop, bottom } = geometry, k = w / 640;
    g.save(); g.fillStyle = 'rgba(0,0,0,0.5)';
    g.beginPath(); g.ellipse(x + w * 0.47, bottom - 2 * k, w * 0.52, Math.max(5, 14 * k), 0, 0, TAU); g.fill(); g.restore();
    const top = pictures.get('top'), leather = pictures.get('leather'), base = pictures.get('base');
    if (top && leather && base) {
      // Drawn on a layer first, so the hearth's firelight only tints the bellows itself, not the air around it.
      const layer = bellowsLayer ??= document.createElement('canvas');
      if (layer.width !== canvas.width || layer.height !== canvas.height) { layer.width = canvas.width; layer.height = canvas.height; }
      const l = layer.getContext('2d')!;
      l.setTransform(1, 0, 0, 1, 0, 0); l.clearRect(0, 0, layer.width, layer.height);
      l.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
      l.imageSmoothingEnabled = true; l.imageSmoothingQuality = 'high';
      l.drawImage(base, x, bottom - 76 * k, w, 76 * k);
      if (leatherH > 0.5) l.drawImage(leather, x, leatherTop, w, leatherH + 1);
      l.drawImage(top, x, bellowsTop, w, 134 * k);
      const rim = l.createLinearGradient(x + w * 0.45, 0, x + w, 0);
      rim.addColorStop(0, 'rgba(255,140,60,0)'); rim.addColorStop(1, `rgba(255,150,70,${(0.14 + 0.2 * heat).toFixed(3)})`);
      l.globalCompositeOperation = 'source-atop'; l.fillStyle = rim; l.fillRect(x, bellowsTop, w, bottom - bellowsTop);
      l.globalCompositeOperation = 'source-over';
      g.drawImage(layer, 0, 0, W, H);
    }
    // A downstroke blows through the pipe: dust at the joint, sparks leaping from the coals.
    const pipe = at(PIPE.x, PIPE.y);
    const gust = Math.min(1, Math.max(moveDir > 0 ? motion * 6 : 0, flare));
    if (gust > 0.02) {
      motes(10, (i, t) => ({ x: pipe.x - t * w * 0.12 * (0.5 + hash(i)), y: pipe.y + (hash(i + 3) - 0.5) * 18 * k * 4 * t - t * 10, a: gust * (1 - t) * 0.45, r: 1 + t * 3 }), '#b9a58c');
      motes(22, (i, t) => ({ x: coals.x + (hash(i) - 0.5) * W * 0.1 + (hash(i + 8) - 0.5) * t * W * 0.12, y: coals.y - t * H * (0.25 + hash(i + 1) * 0.35), a: gust * (1 - t), r: 1 + hash(i + 6) * 1.8 }), '#ffd27a');
    }
    vignette(0.6, '6,5,4');
    railBand(true);
  };

  function render(state: IllustrationState, dt = 0) {
    const bounds = host.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    W = bounds.width; H = bounds.height;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.round(W * dpr), ch = Math.round(H * dpr);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    if (!reduced()) time += dt;
    const p = clamp01(state.progress), pos = clamp01(state.position ?? 0);
    const strokes = state.strokes ?? 0;
    if (strokes > lastStrokes) flare = 1;
    lastStrokes = strokes;
    flare = Math.max(0, flare - dt * 1.6);
    motion = dt > 0 && lastPosition !== undefined ? Math.min(1, Math.abs(pos - lastPosition) / dt / 3) : motion * 0.9;
    if (lastPosition !== undefined && pos !== lastPosition) moveDir = Math.sign(pos - lastPosition);
    lastPosition = pos;
    g.fillStyle = '#0b0f17'; g.fillRect(0, 0, W, H);
    const background = pictures.get('backdrop');
    if (background) frame(background);
    if (kind === 'bellows') layoutBellows(pos);
    if (!background && kind === 'open-eyes' && host.dataset.backdrop === 'none') { drawOpenEyes(p); return; }
    if (!background) return;
    if (kind === 'reach') drawReach(p, pos);
    else if (kind === 'lift') drawLift(p, pos);
    else if (kind === 'open-eyes') drawOpenEyes(p);
    else if (kind === 'tend') drawTend(p, pos);
    else drawBellows(p, pos);
  }
  return { ready, render };
}

// ------------------------------------------------------------------------------------------------ map-scale vignettes

/** Small map-scale scenes for the Leselager panels (blow, stake): sprites and props on a cropped map background. */
function legacyIllustration(host: HTMLElement, kind: 'blow' | 'stake') {
  const art = manifest();
  const canvas = document.createElement('canvas');
  canvas.className = 'mini-illustration';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', DESCRIPTIONS[kind]);
  host.prepend(canvas);
  host.classList.add('has-mini-art');
  const ctx = canvas.getContext('2d')!;
  const pictures = new Map<string, IllustrationImage>();
  const files = new Map<string, string>();
  const addCharacter = (id: string, poses: string[]) => {
    const entry = art.characters[id];
    if (entry?.walk) files.set(`${id}:walk`, entry.walk.file);
    for (const pose of poses) if (entry?.poses[pose]) files.set(`${id}:${pose}`, entry.poses[pose].file);
  };
  if (kind === 'blow') { addCharacter('azar', ['kneel']); addCharacter('lia', ['kneel']); }
  if (kind === 'stake') { addCharacter('kyra-bound', ['sit', 'crouch']); addCharacter('shadow-spear', []); }
  const props = kind === 'blow' ? ['firering', 'campfire'] : ['iso-stake-0', 'campfire', 'keg'];
  for (const id of props) if (art.props[id]) files.set(id, art.props[id].file);
  const backdrop = kind === 'blow' ? art.backgrounds['k3-leselager'] : art.backgrounds['k2-lager'];
  if (backdrop) files.set('backdrop', backdrop.file);
  for (const [id, file] of files) {
    const preview = previewCanvas(file);
    if (preview) pictures.set(id, preview);
  }
  host.dataset.art = 'loading';
  let loaded = false, time = 0, height = 200;
  let completed = 0;
  const ready = Promise.all([...files].map(async ([id, file]) => {
    const image = await loadImage(file);
    if (image) { pictures.set(id, image); completed++; }
  })).then(() => {
    loaded = completed === files.size;
    host.dataset.art = loaded ? 'ready' : 'failed';
    return loaded;
  });

  const character = (id: string, pose: string, x: number, y: number, scale: number, facing: 'left' | 'right' = 'right') => {
    const entry: CharacterEntry = art.characters[id];
    const pe = entry.poses[pose];
    const image = pictures.get(`${id}:${pe ? pose : 'walk'}`);
    if (!image) return;
    const w = pe?.w ?? 64, h = pe?.h ?? 64, foot = pe?.foot ?? entry.foot ?? [32, 60];
    const index = entry.walk?.idle?.[facing === 'right' ? 2 : 1] ?? (facing === 'right' ? 8 : 4);
    ctx.save(); ctx.translate(x, y);
    if (pe && facing !== pe.facing && ['left', 'right'].includes(pe.facing)) ctx.scale(-1, 1);
    ctx.drawImage(image, pe ? 0 : index % 4 * 64, pe ? 0 : Math.floor(index / 4) * 64, w, h, -foot[0] * scale, -foot[1] * scale, w * scale, h * scale);
    ctx.restore();
  };
  const prop = (id: string, x: number, y: number, scale: number, rotate = 0, opacity = 1) => {
    const image = pictures.get(id), entry = art.props[id];
    if (!image || !entry) return;
    const frame = Math.floor(time * (entry.fps ?? 6)) % entry.frames;
    ctx.save(); ctx.globalAlpha = opacity; ctx.translate(x, y); ctx.rotate(rotate);
    ctx.drawImage(image, frame * entry.w, 0, entry.w, entry.h, -entry.anchor[0] * scale, -entry.anchor[1] * scale, entry.w * scale, entry.h * scale);
    ctx.restore();
  };
  const glow = (x: number, y: number, radius: number, strength: number, magical = false) => {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, magical ? '#c2fff9' : '#fff0a8'); gradient.addColorStop(0.2, magical ? '#59e8d7aa' : '#ffa44daa'); gradient.addColorStop(1, '#00000000');
    ctx.save(); ctx.globalAlpha = strength; ctx.fillStyle = gradient; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2); ctx.restore();
  };
  const sparks = (x: number, y: number, p: number, magical = false) => {
    ctx.fillStyle = magical ? '#b6ffee' : '#ffc06f';
    for (let i = 0; i < 12; i++) {
      const t = (time * 0.4 + i / 12) % 1;
      ctx.globalAlpha = (1 - t) * p;
      ctx.fillRect(x + Math.sin(i * 3.2 + time) * 22 * t, y - t * 60, 2, 2);
    }
    ctx.globalAlpha = 1;
  };

  function render(state: IllustrationState, dt = 0) {
    const bounds = host.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    height = Math.round(640 * bounds.height / bounds.width);
    if (canvas.width !== 640 || canvas.height !== height) { canvas.width = 640; canvas.height = height; }
    ctx.imageSmoothingEnabled = false; time += dt;
    ctx.fillStyle = '#111b27'; ctx.fillRect(0, 0, 640, height);
    const background = pictures.get('backdrop');
    if (background) {
      // Crop to the card instead of squeezing characters and scenery into its wide aspect ratio.
      const cropH = Math.min(background.height, background.width * height / 640);
      const focus = 0.64;
      const top = Math.max(0, Math.min(background.height - cropH, background.height * focus - cropH / 2));
      ctx.drawImage(background, 0, top, background.width, cropH, 0, 0, 640, height);
    }
    ctx.fillStyle = '#07102099'; ctx.fillRect(0, 0, 640, height);
    if (!pictures.size) return;
    const p = Math.max(0, Math.min(1, state.progress));
    const y = height * 0.87, scale = Math.max(1.3, Math.min(3.6, height / 80));
    if (kind === 'blow') {
      const x = 330;
      character('lia', 'kneel', 182, y, scale, 'right'); character('azar', 'kneel', 492, y, scale, 'left');
      glow(x, y - 20, 80, 0.2 + p * 0.75);
      prop('firering', x, y, scale * 1.6);
      if (p > 0.1) prop('campfire', x, y, scale * 1.3, 0, p);
      sparks(x, y - 20, p);
      const breath = state.breath ?? 0;
      for (let i = 0; i < 5; i++) {
        const t = (time * (0.4 + breath) + i / 5) % 1;
        ctx.fillStyle = `rgba(230,238,232,${breath * (1 - t) * 0.65})`;
        ctx.fillRect(198 + t * 118, y - 28 * scale + t * 50, 4, 2);
      }
      if (state.puff) { ctx.fillStyle = '#b6b9ad55'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x + Math.sin(i * 4) * 16, y - 32 - i * 12, 8 + i * 4, 0, Math.PI * 2); ctx.fill(); } }
    } else if (kind === 'stake') {
      prop('campfire', 478, height * 0.49, scale * 0.75);
      prop('keg', 555, height * 0.52, scale * 0.65);
      character('shadow-spear', 'idle', 523, height * 0.44, scale * 0.6, state.watch ? 'left' : 'right');
      const tug = state.beat ? Math.sin(time * 25) * 4 : 0;
      character('kyra-bound', 'sit', 245 - p * 12 + tug, y, scale * 1.1, 'right');
      const stakeY = y - p * 25;
      prop('iso-stake-0', 332 + tug * 0.7, stakeY, scale * 0.9, state.beat ? Math.sin(time * 15) * 0.09 : 0);
      ctx.strokeStyle = '#c2a379'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(255 + tug, y - 17 * scale); ctx.lineTo(332, stakeY - 22 * scale); ctx.stroke();
      if (state.watch) { glow(523, height * 0.32, 40, 0.45); }
    }
  }
  return { ready, render };
}
