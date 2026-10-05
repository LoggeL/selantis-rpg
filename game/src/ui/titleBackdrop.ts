import { ctx } from './context';
import { el } from './dom';
import { TITLE_PREVIEW, TITLE_STARS } from './titleData';

/**
 * Title backdrop: the Codex-painted night over Selantis (assets/ui/title.png, 1280x720) brought to life in
 * the DOM — slow drift (a gliding panorama on portrait phones), pointer parallax, twinkling stars, Crios'
 * turquoise pulse, the flickering farmhouse window and town lights, chimney smoke, valley mist, wandering
 * fireflies (one turquoise mote: the Urmacht is never far) and the odd shooting star.
 *
 * Modes: 'title' covers the whole window (title screen); 'stage' maps the picture exactly onto the game
 * canvas (static, for the UI demo), so canvas-space anchors (anchor()) line up with the painting.
 */

export type BackdropMode = 'title' | 'stage';

const IW = 1280, IH = 720;
export const TITLE_IMAGE = 'assets/ui/title.png';

/** Points of interest in image space (1280x720). */
const P = {
  crios: { x: 295, y: 119 },
  window: { x: 852, y: 436 },
  chimney: { x: 907, y: 366 },
  tree: { x: 786, y: 448 },
  house: { x: 870, y: 400 },
};
/** Fireflies painted into the picture: they blink in place. */
const PAINTED_FLIES: [number, number][] = [[373, 630], [697, 632], [308, 665], [954, 605], [184, 603], [1197, 591]];
/** Lights of the town in the west (they shimmer faintly). */
const TOWN: [number, number][] = [[399, 464], [372, 464], [458, 451], [428, 464], [484, 464], [411, 445], [481, 478]];

interface Fly { x: number; y: number; vx: number; vy: number; phase: number; speed: number; depth: number; magic: boolean; }
interface Puff { x: number; y: number; age: number; life: number; size: number; drift: number; }
interface Mist { x: number; y: number; w: number; h: number; speed: number; alpha: number; }
interface Shoot { x: number; y: number; age: number; vx: number; vy: number; }

function sprite(size: number, stops: [number, string][]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) grad.addColorStop(o, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class TitleBackdrop {
  private root = el('div', 'tb');
  private pic = el('div', 'tb-pic');
  private img = el('img', 'tb-img');
  private fx = el('canvas', 'tb-fx');
  private g = this.fx.getContext('2d')!;
  private mode: BackdropMode = 'title';
  private active = false;
  private raf = 0;
  private last = 0;
  private t = 0;
  private rect = { x: 0, y: 0, w: IW, h: IH };
  private pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  private flies: Fly[] = [];
  private puffs: Puff[] = [];
  private mist: Mist[] = [];
  private shoots: Shoot[] = [];
  private nextPuff = 0;
  private nextShoot = 6;
  private stars = TITLE_STARS.filter(([x, y]) => Math.hypot(x - P.crios.x, y - P.crios.y) > 34)
    .map(([x, y, b, c], i) => ({ x, y, b, c, speed: 0.6 + ((i * 37) % 17) / 10, phase: (i * 2.399) % (Math.PI * 2) }));
  private spr = {
    star: sprite(32, [[0, 'rgba(255,255,255,1)'], [0.18, 'rgba(225,235,255,0.75)'], [0.5, 'rgba(170,190,255,0.16)'], [1, 'rgba(150,170,255,0)']]),
    turq: sprite(256, [[0, 'rgba(190,255,245,0.9)'], [0.08, 'rgba(120,240,222,0.55)'], [0.3, 'rgba(73,224,200,0.18)'], [0.65, 'rgba(40,150,170,0.05)'], [1, 'rgba(30,90,140,0)']]),
    warm: sprite(128, [[0, 'rgba(255,214,140,0.95)'], [0.2, 'rgba(255,170,80,0.45)'], [0.55, 'rgba(255,130,50,0.1)'], [1, 'rgba(255,110,40,0)']]),
    fly: sprite(48, [[0, 'rgba(255,255,220,1)'], [0.12, 'rgba(236,255,150,0.9)'], [0.35, 'rgba(190,240,90,0.28)'], [1, 'rgba(160,220,60,0)']]),
    mote: sprite(48, [[0, 'rgba(230,255,252,1)'], [0.14, 'rgba(140,255,236,0.85)'], [0.4, 'rgba(73,224,200,0.25)'], [1, 'rgba(73,224,200,0)']]),
    smoke: sprite(64, [[0, 'rgba(170,180,215,0.5)'], [0.5, 'rgba(140,150,195,0.22)'], [1, 'rgba(120,130,180,0)']]),
    mist: sprite(128, [[0, 'rgba(150,165,225,0.55)'], [0.55, 'rgba(130,145,210,0.2)'], [1, 'rgba(120,135,200,0)']]),
  };
  private ready: Promise<void> | null = null;

  constructor() {
    this.img.alt = '';
    this.img.draggable = false;
    this.img.decoding = 'async';
    // A tiny blurred preview shows at once; the full painting fades in over it once decoded.
    const preview = el('div', 'tb-preview');
    preview.style.backgroundImage = `url(${TITLE_PREVIEW})`;
    this.pic.append(preview, this.img, this.fx);
    this.root.append(this.pic, el('div', 'tb-shade'));
    const r = rng(1213);
    for (let i = 0; i < 30; i++) {
      const depth = 0.35 + r() * 0.65;
      this.flies.push({
        x: r() * IW, y: 470 + depth * 230 * (0.4 + r() * 0.6), vx: (r() - 0.5) * 14, vy: (r() - 0.5) * 8,
        phase: r() * 10, speed: 0.5 + r() * 1.1, depth, magic: false,
      });
    }
    this.flies.push({ x: 560, y: 690, vx: 3, vy: -6, phase: 0, speed: 0.8, depth: 0.9, magic: true });
    for (let i = 0; i < 5; i++) this.mist.push({ x: r() * IW * 1.4 - IW * 0.2, y: 500 + r() * 70, w: 420 + r() * 380, h: 50 + r() * 40, speed: 4 + r() * 6, alpha: 0.09 + r() * 0.07 });
    ctx.onLayout(() => { if (this.active) this.layout(); });
    window.addEventListener('pointermove', e => {
      this.pointer.tx = (e.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
      this.pointer.ty = (e.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
    }, { passive: true });
  }

  /** Starts loading the painting (call early; idempotent). */
  preload(): Promise<void> {
    if (!this.ready) {
      this.img.src = TITLE_IMAGE;
      this.ready = this.img.decode().then(() => { this.img.classList.add('is-loaded'); }, () => { /* missing image: the preview stays, effects still run */ });
    }
    return this.ready;
  }

  show(mode: BackdropMode): void {
    this.mode = mode;
    this.root.classList.toggle('is-stage', mode === 'stage');
    if (!this.root.isConnected) ctx.layers.backdrop.appendChild(this.root);
    const wasActive = this.active;
    this.active = true;
    this.layout();
    if (!wasActive) {
      this.root.classList.remove('is-in');
      void this.preload();
      requestAnimationFrame(() => { if (this.active) this.root.classList.add('is-in'); });
      this.last = performance.now();
      cancelAnimationFrame(this.raf);
      this.raf = requestAnimationFrame(this.tick);
    }
  }

  hide(): void {
    if (!this.active) return;
    this.active = false;
    this.root.classList.remove('is-in');
    const node = this.root;
    setTimeout(() => { if (!this.active) { cancelAnimationFrame(this.raf); this.raf = 0; node.remove(); } }, 700);
  }

  get visible(): boolean { return this.active; }

  /** Image-space point → game-canvas coordinates (640x360). Exact in 'stage' mode. */
  anchor(name: 'house' | 'tree' | 'crios' | 'firefly' | 'window'): { x: number; y: number } {
    const k = 640 / IW;
    if (name === 'firefly') {
      const f = this.flies.find(ff => !ff.magic && ff.y > 520 && ff.x > 80 && ff.x < IW - 80) ?? this.flies[0];
      return { x: f.x * k, y: (f.y - 8) * k };
    }
    const p = P[name];
    return { x: p.x * k, y: p.y * k };
  }

  // ------------------------------------------------------------------ layout

  private layout(): void {
    const vw = window.innerWidth, vh = window.innerHeight;
    let { x, y, w, h } = ctx.stage;
    if (this.mode === 'title') {
      // Cover the window (slightly oversized, so the drift never shows an edge).
      const s = Math.max(vw / IW, vh / IH) * 1.06;
      w = IW * s; h = IH * s;
      x = (vw - w) / 2; y = (vh - h) / 2;
    }
    this.rect = { x, y, w, h };
    const st = this.pic.style;
    st.width = `${w}px`; st.height = `${h}px`;
    // Effects canvas in device pixels, capped (fill-rate) — glows are soft, they need no more.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.round(Math.min(w * dpr, 2200));
    const chh = Math.round(cw * IH / IW);
    if (this.fx.width !== cw || this.fx.height !== chh) { this.fx.width = cw; this.fx.height = chh; }
    this.place(0);
  }

  /** Positions the picture: drift + pointer parallax (title), gliding panorama (portrait title). */
  private place(t: number): void {
    const { w, h } = this.rect;
    let { x, y } = this.rect;
    const reduced = ctx.reducedMotion;
    if (this.mode === 'title') {
      const vw = window.innerWidth, vh = window.innerHeight;
      if (w > vw * 1.25) {
        // Narrow window: glide between Crios (west) and the farmhouse, slowly, back and forth.
        const f0 = P.crios.x / IW + 0.04, f1 = P.house.x / IW;
        const k = reduced ? 0.5 : 0.5 - 0.5 * Math.cos(t * (Math.PI * 2) / 80);
        const focus = f0 + (f1 - f0) * k;
        x = Math.min(0, Math.max(vw - w, vw / 2 - focus * w));
      } else if (!reduced) {
        x += Math.sin(t * (Math.PI * 2) / 70) * w * 0.012;
        y += Math.sin(t * (Math.PI * 2) / 53 + 1) * h * 0.008;
      }
      if (!reduced) {
        x -= this.pointer.x * w * 0.008;
        y -= this.pointer.y * h * 0.006;
      }
      x = Math.min(0, Math.max(vw - w, x));
      y = Math.min(0, Math.max(vh - h, y));
    }
    this.pic.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  }

  // ------------------------------------------------------------------ animation

  private tick = (now: number) => {
    if (!this.active) return;
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.t += dt;
    const p = this.pointer;
    p.x += (p.tx - p.x) * Math.min(1, dt * 2.5);
    p.y += (p.ty - p.y) * Math.min(1, dt * 2.5);
    this.place(this.t);
    this.draw(dt);
    this.raf = requestAnimationFrame(this.tick);
  };

  private draw(dt: number): void {
    const g = this.g;
    const k = this.fx.width / IW;
    const t = this.t;
    const reduced = ctx.reducedMotion;
    const motion = reduced ? 0.3 : 1;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.fx.width, this.fx.height);
    g.setTransform(k, 0, 0, k, 0, 0);

    // Valley mist (normal blending, very faint, drifting east).
    g.globalCompositeOperation = 'source-over';
    for (const m of this.mist) {
      m.x += m.speed * dt * motion;
      if (m.x - m.w / 2 > IW + 40) m.x = -m.w / 2 - 40;
      g.globalAlpha = m.alpha * (0.75 + 0.25 * Math.sin(t * 0.21 + m.y));
      g.drawImage(this.spr.mist, m.x - m.w / 2, m.y - m.h / 2, m.w, m.h);
    }

    // Chimney smoke: soft puffs rising and leaning with the night breeze.
    this.nextPuff -= dt;
    if (this.nextPuff <= 0) {
      this.nextPuff = 0.55 + Math.random() * 0.35;
      this.puffs.push({ x: P.chimney.x + (Math.random() - 0.5) * 2, y: P.chimney.y, age: 0, life: 5.5 + Math.random() * 2, size: 7 + Math.random() * 3, drift: 3 + Math.random() * 3 });
    }
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const s = this.puffs[i];
      s.age += dt;
      if (s.age > s.life) { this.puffs.splice(i, 1); continue; }
      const f = s.age / s.life;
      s.y -= dt * 9 * motion;
      s.x += dt * (s.drift * f + Math.sin(s.age * 1.3) * 1.2) * motion;
      const size = s.size + f * 26;
      g.globalAlpha = Math.sin(Math.min(1, f * 4) * Math.PI / 2) * (1 - f) * 0.5;
      g.drawImage(this.spr.smoke, s.x - size / 2, s.y - size / 2, size, size);
    }

    g.globalCompositeOperation = 'lighter';

    // Stars twinkle (the painted stars brighten and dim; a few sparkle).
    for (const s of this.stars) {
      const tw = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase);
      const a = s.b * tw * tw * 0.75;
      if (a < 0.02) continue;
      const size = 7 + s.b * 9 * (0.6 + tw * 0.4);
      g.globalAlpha = a;
      g.drawImage(this.spr.star, s.x - size / 2, s.y - size / 2, size, size);
    }

    // Crios: a slow turquoise breath and gently pulsing rays.
    const breath = 0.5 + 0.5 * Math.sin(t * 0.9);
    const c = P.crios;
    g.globalAlpha = 0.32 + breath * 0.22;
    const halo = 150 + breath * 40;
    g.drawImage(this.spr.turq, c.x - halo / 2, c.y - halo / 2, halo, halo);
    g.globalAlpha = 0.5 + breath * 0.3;
    g.drawImage(this.spr.star, c.x - 14, c.y - 14, 28, 28);
    const ray = (len: number, ang: number, alpha: number, width: number) => {
      g.save();
      g.translate(c.x, c.y);
      g.rotate(ang);
      const grad = g.createLinearGradient(-len, 0, len, 0);
      grad.addColorStop(0, 'rgba(120,255,235,0)');
      grad.addColorStop(0.5, `rgba(220,255,250,${alpha})`);
      grad.addColorStop(1, 'rgba(120,255,235,0)');
      g.globalAlpha = 1;
      g.fillStyle = grad;
      g.fillRect(-len, -width / 2, len * 2, width);
      g.restore();
    };
    ray(46 + breath * 22, 0, 0.55, 1.6);
    ray(40 + breath * 20, Math.PI / 2, 0.5, 1.6);
    ray(18 + breath * 10, Math.PI / 4, 0.22, 1);
    ray(18 + breath * 10, -Math.PI / 4, 0.22, 1);

    // Farmhouse window: candle flicker; town lights shimmer.
    const flick = 0.78 + Math.sin(t * 7.1) * 0.08 + Math.sin(t * 12.7 + 1) * 0.06 + Math.sin(t * 2.3) * 0.05;
    g.globalAlpha = 0.42 * flick;
    g.drawImage(this.spr.warm, P.window.x - 40, P.window.y - 36, 80, 72);
    g.globalAlpha = 0.5 * flick;
    g.drawImage(this.spr.warm, P.window.x - 12, P.window.y - 11, 24, 22);
    TOWN.forEach(([x, y], i) => {
      g.globalAlpha = 0.16 + 0.12 * (0.5 + 0.5 * Math.sin(t * (1.1 + i * 0.37) + i * 2));
      g.drawImage(this.spr.warm, x - 9, y - 9, 18, 18);
    });
    PAINTED_FLIES.forEach(([x, y], i) => {
      const b = Math.max(0, Math.sin(t * (0.9 + i * 0.23) + i * 1.7));
      g.globalAlpha = b * b * 0.85;
      g.drawImage(this.spr.fly, x - 13, y - 13, 26, 26);
    });

    // Shooting star, now and then.
    this.nextShoot -= dt;
    if (this.nextShoot <= 0 && !reduced) {
      this.nextShoot = 9 + Math.random() * 12;
      this.shoots.push({ x: 520 + Math.random() * 560, y: 30 + Math.random() * 120, age: 0, vx: -260 - Math.random() * 120, vy: 95 + Math.random() * 50 });
    }
    for (let i = this.shoots.length - 1; i >= 0; i--) {
      const s = this.shoots[i];
      s.age += dt;
      if (s.age > 0.9) { this.shoots.splice(i, 1); continue; }
      s.x += s.vx * dt; s.y += s.vy * dt;
      const fade = Math.sin((s.age / 0.9) * Math.PI);
      const tail = 0.16;
      const grad = g.createLinearGradient(s.x, s.y, s.x - s.vx * tail, s.y - s.vy * tail);
      grad.addColorStop(0, `rgba(235,242,255,${0.9 * fade})`);
      grad.addColorStop(1, 'rgba(235,242,255,0)');
      g.globalAlpha = 1;
      g.strokeStyle = grad;
      g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(s.x - s.vx * tail, s.y - s.vy * tail); g.stroke();
    }

    // Fireflies wander over the wheat and the grass; near ones are bigger and follow the pointer more.
    const px = this.mode === 'title' && !reduced ? this.pointer.x : 0;
    const py = this.mode === 'title' && !reduced ? this.pointer.y : 0;
    for (const f of this.flies) {
      f.phase += dt * f.speed;
      f.vx += Math.sin(f.phase * 1.7) * dt * 9;
      f.vy += Math.cos(f.phase * 1.3) * dt * 6;
      f.vx *= 0.985; f.vy *= 0.985;
      f.x += f.vx * dt * motion;
      f.y += f.vy * dt * motion;
      if (f.magic) {
        f.y -= dt * 7 * motion;
        if (f.y < 430) { f.y = 700; f.x = 260 + Math.random() * 760; f.vx = (Math.random() - 0.5) * 6; }
      } else {
        if (f.y < 470) { f.y = 470; f.vy = Math.abs(f.vy); }
        if (f.y > 712) { f.y = 712; f.vy = -Math.abs(f.vy); }
      }
      if (f.x < -20) f.x = IW + 20; else if (f.x > IW + 20) f.x = -20;
      const blink = Math.max(0, Math.sin(f.phase * 2.1)) ** 2;
      const a = f.magic ? 0.6 + 0.35 * Math.sin(t * 2.2) : 0.08 + blink * 0.92;
      const size = (f.magic ? 30 : 16 + f.depth * 18) * (f.magic ? 1 : 0.8 + blink * 0.3);
      const ox = -px * f.depth * 14, oy = -py * f.depth * 8;
      g.globalAlpha = a;
      g.drawImage(f.magic ? this.spr.mote : this.spr.fly, f.x + ox - size / 2, f.y + oy - size / 2, size, size);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }
}

let instance: TitleBackdrop | null = null;
const backdrop = () => (instance ??= new TitleBackdrop());

/** Shows the painted title backdrop ('title': covers the window; 'stage': exactly on the game canvas). */
export function showBackdrop(mode: BackdropMode = 'title'): void { backdrop().show(mode); }
export function hideBackdrop(): void { instance?.hide(); }
export function preloadBackdrop(): void { void backdrop().preload(); }
export function backdropVisible(): boolean { return instance?.visible ?? false; }
/** Canvas-space (640x360) anchors on the painting: house, tree, crios, window, a firefly. */
export function backdropAnchor(name: 'house' | 'tree' | 'crios' | 'firefly' | 'window'): { x: number; y: number } {
  return backdrop().anchor(name);
}
