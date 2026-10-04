import Phaser from 'phaser';
import { G } from '../core/G';
import { GAME_H, GAME_W } from '../core/viewport';

/**
 * Title backdrop: a procedural pixel-art summer night over the family farm. Crios shines in the west,
 * fireflies drift over the meadow, layers glide in slow parallax. Purely decorative (DOM draws the title).
 * Also used as a calm backdrop by the UI demo (data: { mode: 'backdrop' }).
 */

/** Colours shared with the DOM backdrop so the letterbox bars blend into the picture. */
export const TITLE_SKY_TOP = '#060a1a';
export const TITLE_GROUND = '#06080f';
export const HORIZON_Y = 196;

const W = GAME_W, H = GAME_H;
const PAD = 70; // extra width on each side for parallax drift
const LW = W + PAD * 2;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 1D value noise, smooth. */
function noise1(seed: number) {
  const r = rng(seed);
  const pts = Array.from({ length: 256 }, () => r());
  return (x: number) => {
    const i = Math.floor(x), f = x - i;
    const a = pts[((i % 256) + 256) % 256], b = pts[(((i + 1) % 256) + 256) % 256];
    const u = f * f * (3 - 2 * f);
    return a + (b - a) * u;
  };
}

const hex = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => v / 16);

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  return { c, g };
}

/** Vertical gradient with ordered dithering between colour bands (pixel-art sky). */
function ditherGradient(g: CanvasRenderingContext2D, w: number, h: number, stops: [number, string][]) {
  const img = g.createImageData(w, h);
  const cols = stops.map(([p, c]) => [p, ...hex(c)] as [number, number, number, number]);
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1);
    let k = 0;
    while (k < cols.length - 2 && t > cols[k + 1][0]) k++;
    const [p0, r0, g0, b0] = cols[k];
    const [p1, r1, g1, b1] = cols[k + 1];
    const f = Math.min(1, Math.max(0, (t - p0) / (p1 - p0)));
    // Quantise into 6 steps per band and dither between neighbours.
    const steps = 6;
    const q = f * steps;
    const lo = Math.floor(q), frac = q - lo;
    for (let x = 0; x < w; x++) {
      const s = (frac > BAYER[(y % 4) * 4 + (x % 4)] ? lo + 1 : lo) / steps;
      const i = (y * w + x) * 4;
      img.data[i] = r0 + (r1 - r0) * s;
      img.data[i + 1] = g0 + (g1 - g0) * s;
      img.data[i + 2] = b0 + (b1 - b0) * s;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
}

function radial(key: string, size: number, color: string, scene: Phaser.Scene, falloff = 2.2) {
  if (scene.textures.exists(key)) return;
  const { c, g } = canvas(size, size);
  const [r, gg, b] = hex(color);
  const img = g.createImageData(size, size);
  const half = (size - 1) / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot(x - half, y - half) / half;
    const a = Math.max(0, 1 - d) ** falloff;
    const i = (y * size + x) * 4;
    img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = Math.round(a * 255);
  }
  g.putImageData(img, 0, 0);
  scene.textures.addCanvas(key, c);
}

/** Hand-made pixel glow (diamond falloff) — reads as pixel art instead of a blurry square. */
function pixelGlow(key: string, color: string, scene: Phaser.Scene) {
  if (scene.textures.exists(key)) return;
  const size = 9, half = 4;
  const { c, g } = canvas(size, size);
  const [r, gg, b] = hex(color);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.abs(x - half) + Math.abs(y - half);
    const a = d === 0 ? 1 : d === 1 ? 0.7 : d === 2 ? 0.38 : d === 3 ? 0.16 : d === 4 ? 0.06 : 0;
    if (!a) continue;
    g.fillStyle = `rgba(${r},${gg},${b},${a})`;
    g.fillRect(x, y, 1, 1);
  }
  scene.textures.addCanvas(key, c);
}

interface Firefly { s: Phaser.GameObjects.Image; core: Phaser.GameObjects.Rectangle; x: number; y: number; vx: number; vy: number; phase: number; speed: number; magic: boolean; }
interface Blade { x: number; h: number; phase: number; color: number; }

export default class TitleScene extends Phaser.Scene {
  private layers: { obj: Phaser.GameObjects.Image; depth: number; amp: number }[] = [];
  private flies: Firefly[] = [];
  private stars: { s: Phaser.GameObjects.Rectangle; base: number; speed: number; phase: number }[] = [];
  private blades: Blade[] = [];
  private grass!: Phaser.GameObjects.Graphics;
  private fog: Phaser.GameObjects.TileSprite[] = [];
  private crios!: Phaser.GameObjects.Container;
  private windowGlow!: Phaser.GameObjects.Image;
  private t = 0;
  private pointerX = 0;
  private pointerY = 0;
  private nextShooting = 4000;
  private houseX = 0;
  private houseY = 0;
  private treeX = 0;
  private treeY = 0;

  constructor() { super('Title'); }

  create(): void {
    this.layers = []; this.flies = []; this.stars = []; this.blades = []; this.fog = [];
    this.t = 0;
    this.cameras.main.setBackgroundColor(TITLE_SKY_TOP);
    this.makeTextures();

    // Sky
    this.add.image(0, 0, 'title-sky').setOrigin(0).setDepth(0);
    this.makeStars();
    this.makeCrios();
    this.add.image(0, 0, 'title-milky').setOrigin(0).setDepth(1).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD);

    // Parallax layers (far → near)
    const add = (key: string, depth: number, amp: number) => {
      const obj = this.add.image(-PAD, 0, key).setOrigin(0).setDepth(depth);
      this.layers.push({ obj, depth, amp });
      return obj;
    };
    add('title-mountains', 3, 6);
    const fogFar = this.add.tileSprite(0, 158, W, 40, 'title-fog').setOrigin(0).setDepth(4).setAlpha(0.35);
    this.fog.push(fogFar);
    add('title-hills', 5, 12);
    // Warm window glow of the farmhouse (on the hills layer).
    this.windowGlow = this.add.image(this.houseX - PAD, this.houseY, 'title-warm').setDepth(5.5).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.9);
    this.makeSmoke();
    const fogNear = this.add.tileSprite(0, 186, W, 40, 'title-fog').setOrigin(0).setDepth(6).setAlpha(0.28);
    fogNear.tilePositionX = 200;
    this.fog.push(fogNear);
    add('title-forest', 7, 20);
    add('title-meadow', 8, 30);
    this.grass = this.add.graphics().setDepth(9);
    this.makeBlades();
    this.makeFireflies();

    // Vignette
    this.add.image(0, 0, 'title-vignette').setOrigin(0).setDepth(20);

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.pointerX = (p.x / W - 0.5) * 2;
      this.pointerY = (p.y / H - 0.5) * 2;
    });
    this.cameras.main.fadeIn(1200, 6, 10, 26);
  }

  /** Canvas-space anchors for demos (bubbles/hints). */
  anchor(name: 'house' | 'tree' | 'crios' | 'firefly'): { x: number; y: number } {
    const hills = this.layers[1]?.obj;
    const hx = hills ? hills.x : -PAD, hy = hills ? hills.y : 0;
    if (name === 'house') return { x: this.houseX + hx, y: this.houseY - 16 + hy };
    if (name === 'tree') return { x: this.treeX + hx, y: this.treeY + hy };
    if (name === 'crios') return { x: this.crios.x, y: this.crios.y };
    const f = this.flies.find(ff => !ff.magic) ?? this.flies[0];
    return { x: f.s.x, y: f.s.y - 4 };
  }

  // ------------------------------------------------------------------ textures

  private makeTextures(): void {
    const tex = this.textures;
    if (!tex.exists('title-sky')) {
      const { c, g } = canvas(W, H);
      ditherGradient(g, W, H, [[0, TITLE_SKY_TOP], [0.32, '#0b1130'], [0.58, '#18204c'], [0.72, '#2a2a5c'], [0.8, '#3b3060'], [1, '#2a2348']]);
      tex.addCanvas('title-sky', c);
    }
    if (!tex.exists('title-milky')) {
      const { c, g } = canvas(W, H);
      const r = rng(77);
      const n = noise1(5);
      for (let i = 0; i < 2600; i++) {
        const t = r();
        const x = t * W;
        const cy = 20 + t * 120 + (n(t * 8) - 0.5) * 50;
        const y = cy + (r() + r() + r() - 1.5) * 26;
        const a = 0.05 + r() * 0.16;
        g.fillStyle = r() < 0.15 ? `rgba(170,150,230,${a})` : `rgba(150,170,240,${a})`;
        g.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
      tex.addCanvas('title-milky', c);
    }
    this.makeMountains();
    this.makeHills();
    this.makeForest();
    this.makeMeadow();
    if (!tex.exists('title-fog')) {
      const { c, g } = canvas(256, 40);
      const n = noise1(9), m = noise1(13);
      for (let y = 0; y < 40; y++) for (let x = 0; x < 256; x++) {
        const v = n(x / 18) * 0.6 + m(x / 7 + y / 5) * 0.4;
        const fall = Math.sin((y / 39) * Math.PI);
        const a = Math.max(0, v - 0.35) * fall * 0.5;
        if (a <= 0.01) continue;
        g.fillStyle = `rgba(120,130,190,${a.toFixed(3)})`;
        g.fillRect(x, y, 1, 1);
      }
      tex.addCanvas('title-fog', c);
    }
    if (!tex.exists('title-vignette')) {
      const { c, g } = canvas(W, H);
      const grad = g.createRadialGradient(W / 2, H * 0.48, H * 0.35, W / 2, H * 0.5, W * 0.62);
      grad.addColorStop(0, 'rgba(3,4,10,0)');
      grad.addColorStop(1, 'rgba(3,4,10,0.55)');
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
      tex.addCanvas('title-vignette', c);
    }
    radial('title-glow', 32, '#bcd4ff', this, 2.4);
    radial('title-warm', 24, '#ffb257', this, 1.8);
    pixelGlow('title-fly', '#e9f58a', this);
    pixelGlow('title-fly-magic', '#49e0c8', this);
    radial('title-smoke', 10, '#8a8fb0', this, 1.2);
  }

  /**
   * Two mountain ranges lit from the west (Crios): a hazy far range and a darker near range.
   * Slopes facing the star get a dithered moonlit face that fades into the body, so the ridge never
   * reads as a loose highlight line; the highest peaks carry snow that follows the lit side.
   */
  private makeMountains(): void {
    if (this.textures.exists('title-mountains')) return;
    const { c, g } = canvas(LW, H);
    const img = g.createImageData(LW, H);
    const put = (x: number, y: number, col: number[]) => {
      if (x < 0 || x >= LW || y < 0 || y >= H) return;
      const i = (y * LW + x) * 4;
      img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
    };
    const mix = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const range = (opts: { seed: number; base: number; amp: number; peakX: number; peak: number; body: string; lit: string; shade: string; rim: string; snow: string; snowLine: number; litDepth: number }) => {
      const n1 = noise1(opts.seed), n2 = noise1(opts.seed + 1), n3 = noise1(opts.seed + 2), nf = noise1(opts.seed + 3);
      const ridge = (x: number) => opts.base + (n1(x / 70) - 0.5) * opts.amp + (n2(x / 23) - 0.5) * opts.amp * 0.36 + (n3(x / 7) - 0.5) * 3.5
        - Math.max(0, 1 - Math.abs(x - opts.peakX) / 160) * opts.peak;
      const body = hex(opts.body), lit = hex(opts.lit), shade = hex(opts.shade), rim = hex(opts.rim), snow = hex(opts.snow);
      for (let x = 0; x < LW; x++) {
        const top = Math.round(ridge(x));
        // Smoothed slope: < 0 means the ground rises to the right, i.e. the face looks west towards Crios.
        const slope = (ridge(x + 3) - ridge(x - 3)) / 6;
        const facing = Math.max(-1, Math.min(1, -slope * 1.6));
        // Gullies break up the lit faces.
        const gully = nf(x / 5) > 0.72 ? 0.55 : 1;
        for (let y = top; y < H; y++) {
          const depth = y - top;
          const bay = BAYER[(y % 4) * 4 + (x % 4)];
          let col = body;
          if (facing > 0.05) {
            const strength = facing * gully * Math.max(0, 1 - depth / (opts.litDepth * (0.6 + facing)));
            if (strength > bay * 0.9) col = strength > 0.55 + bay * 0.3 ? lit : mix(body, lit, 0.5);
          } else if (facing < -0.15 && depth < opts.litDepth * 1.4) {
            const s2 = -facing * Math.max(0, 1 - depth / (opts.litDepth * 1.4));
            if (s2 > bay) col = shade;
          }
          // Snow on the highest peaks, brighter on the lit side, ragged lower edge.
          const snowDepth = (opts.snowLine - top) / 3.2 + (nf(x / 3) - 0.5) * 3;
          if (top < opts.snowLine && depth < snowDepth) col = facing > 0 ? snow : mix(snow, body, 0.45);
          if (depth === 0) col = facing > 0.05 ? (top < opts.snowLine ? snow : rim) : mix(col, rim, 0.45);
          put(x, y, col);
        }
      }
    };
    // Far range: hazier and lighter (atmospheric perspective), taller peaks.
    range({ seed: 121, base: 147, amp: 36, peakX: 330, peak: 16, body: '#1c2250', lit: '#2f3874', shade: '#181d46', rim: '#38427c', snow: '#58629c', snowLine: 124, litDepth: 12 });
    // Near range: darker silhouette in front, lit faces strongly towards the west.
    range({ seed: 21, base: 158, amp: 44, peakX: 200, peak: 18, body: '#10143a', lit: '#28306a', shade: '#0c1032', rim: '#323b74', snow: '#4a5490', snowLine: 128, litDepth: 22 });
    g.putImageData(img, 0, 0);
    this.textures.addCanvas('title-mountains', c);
  }

  private makeHills(): void {
    if (this.textures.exists('title-hills')) return;
    const { c, g } = canvas(LW, H);
    const n = noise1(31);
    const hill = (x: number) => 186 + Math.sin(x / 55) * 6 + (n(x / 30) - 0.5) * 10 - Math.max(0, 1 - Math.abs(x - 470) / 90) * 14;
    for (let x = 0; x < LW; x++) {
      const top = Math.round(hill(x));
      g.fillStyle = '#0f1330';
      g.fillRect(x, top, 1, H - top);
      if (hill(x + 1) - hill(x - 1) > 0.2) { g.fillStyle = '#1b2148'; g.fillRect(x, top, 1, 1); }
    }
    // Field rows (faint)
    g.fillStyle = '#141a3c';
    for (let y = 196; y < 214; y += 3) for (let x = 120; x < 360; x += 1) if ((x + y) % 7 < 4) g.fillRect(x, y + Math.round(Math.sin(x / 40) * 1), 1, 1);
    // Farmhouse silhouette at the right hill
    const hx = 400 + PAD, hy = Math.round(hill(400 + PAD));
    this.houseX = hx; this.houseY = hy - 8;
    const body = '#0b0e24', roof = '#0d1029', edge = '#232a55';
    g.fillStyle = body; g.fillRect(hx - 13, hy - 12, 26, 13);
    g.fillStyle = roof;
    for (let i = 0; i < 11; i++) g.fillRect(hx - 16 + i, hy - 13 - i, 32 - i * 2, 1);
    g.fillStyle = edge;
    for (let i = 0; i < 11; i++) g.fillRect(hx - 16 + i, hy - 13 - i, 1, 1);
    g.fillStyle = body; g.fillRect(hx + 6, hy - 26, 3, 8); // chimney
    // Barn (larger, right of the house, R S. 13)
    g.fillStyle = '#0a0d22'; g.fillRect(hx + 18, hy - 10, 24, 11);
    for (let i = 0; i < 8; i++) { g.fillRect(hx + 16 + i, hy - 11 - i, 28 - i * 2, 1); }
    // Lit windows
    g.fillStyle = '#ffcb6b'; g.fillRect(hx - 8, hy - 7, 3, 3); g.fillRect(hx + 3, hy - 7, 3, 3);
    g.fillStyle = '#ffe9b0'; g.fillRect(hx - 8, hy - 7, 1, 1); g.fillRect(hx + 3, hy - 7, 1, 1);
    this.houseY = hy - 6;
    // Fence posts
    g.fillStyle = '#0b0e24';
    for (let x = hx - 60; x < hx - 18; x += 5) { const ty = Math.round(hill(x)); g.fillRect(x, ty - 4, 1, 4); }
    for (let x = hx - 60; x < hx - 18; x++) { const ty = Math.round(hill(x)); g.fillRect(x, ty - 3, 1, 1); }
    // The reading tree on the left hill crest
    this.tree(g, 75 + PAD, Math.round(hill(75 + PAD)), 34, '#0c1028', '#1a2048');
    this.treeX = 75 + PAD; this.treeY = Math.round(hill(75 + PAD)) - 34;
    this.tree(g, 470 + PAD + 25, Math.round(hill(470 + PAD + 25)), 22, '#0c1028', '#1a2048');
    this.textures.addCanvas('title-hills', c);
  }

  private tree(g: CanvasRenderingContext2D, x: number, base: number, size: number, col: string, rim: string): void {
    const r = rng(x * 7 + base);
    g.fillStyle = col;
    g.fillRect(x - 1, base - size * 0.55, 3, size * 0.55);
    g.fillRect(x - 3, base - 2, 7, 2);
    const blobs = 9;
    for (let i = 0; i < blobs; i++) {
      const bx = x + (r() - 0.5) * size * 0.9, by = base - size * 0.62 + (r() - 0.5) * size * 0.4, br = size * (0.18 + r() * 0.14);
      for (let yy = -br; yy <= br; yy++) for (let xx = -br; xx <= br; xx++) {
        if (xx * xx + yy * yy > br * br) continue;
        g.fillStyle = (xx + yy < -br * 0.9 && r() < 0.6) ? rim : col;
        g.fillRect(Math.round(bx + xx), Math.round(by + yy), 1, 1);
      }
    }
  }

  private makeForest(): void {
    if (this.textures.exists('title-forest')) return;
    const { c, g } = canvas(LW, H);
    const r = rng(41);
    const n = noise1(42);
    const ground = (x: number) => 214 + (n(x / 40) - 0.5) * 8;
    for (let x = 0; x < LW; x++) { g.fillStyle = '#0a0d22'; g.fillRect(x, Math.round(ground(x)), 1, H); }
    // Pines and broadleaf clumps, leaving a clearing in the middle for the meadow view.
    for (let x = -6; x < LW + 6; x += 3 + Math.floor(r() * 5)) {
      const centre = Math.abs(x - LW / 2) < 120;
      if (centre && r() < 0.85) continue;
      const base = Math.round(ground(x)) + 2;
      const hgt = (centre ? 10 : 16) + r() * (centre ? 8 : 26);
      if (r() < 0.6) {
        for (let y = 0; y < hgt; y++) {
          const wdt = Math.max(1, Math.round((y / hgt) * hgt * 0.32 + ((y % 4) === 0 ? 1 : 0)));
          g.fillStyle = '#090c20';
          g.fillRect(x - wdt, base - hgt + y, wdt * 2 + 1, 1);
          if ((y % 4) === 1) { g.fillStyle = '#151a3a'; g.fillRect(x - wdt, base - hgt + y, 1, 1); }
        }
      } else {
        this.tree(g, x, base, hgt * 0.9, '#090c20', '#151a3a');
      }
    }
    this.textures.addCanvas('title-forest', c);
  }

  private makeMeadow(): void {
    if (this.textures.exists('title-meadow')) return;
    const { c, g } = canvas(LW, H);
    const n = noise1(51);
    const r = rng(52);
    const top = (x: number) => 238 + (n(x / 34) - 0.5) * 10;
    for (let x = 0; x < LW; x++) {
      const t = Math.round(top(x));
      g.fillStyle = TITLE_GROUND;
      g.fillRect(x, t, 1, H - t);
      g.fillStyle = '#0c1024';
      g.fillRect(x, t, 1, 1);
    }
    // Wildflowers catching the starlight
    for (let i = 0; i < 70; i++) {
      const x = Math.floor(r() * LW), y = Math.round(top(x)) + 2 + Math.floor(r() * 26);
      g.fillStyle = r() < 0.5 ? '#3c4a8a' : '#5a4f86';
      g.fillRect(x, y, 1, 1);
    }
    this.textures.addCanvas('title-meadow', c);
  }

  // ------------------------------------------------------------------ objects

  private makeStars(): void {
    const r = rng(61);
    for (let i = 0; i < 170; i++) {
      const x = Math.floor(r() * W), y = Math.floor(r() * r() * 175);
      const bright = r();
      const col = bright > 0.92 ? 0xffffff : r() < 0.3 ? 0xc8d4ff : r() < 0.15 ? 0xffe2c4 : 0xa8b4e8;
      const base = 0.25 + bright * 0.7;
      const s = this.add.rectangle(x, y, 1, 1, col, base).setOrigin(0).setDepth(1);
      this.stars.push({ s, base, speed: 0.6 + r() * 2.2, phase: r() * Math.PI * 2 });
      if (bright > 0.965) {
        this.add.rectangle(x - 1, y, 3, 1, col, base * 0.35).setOrigin(0).setDepth(1);
        this.add.rectangle(x, y - 1, 1, 3, col, base * 0.35).setOrigin(0).setDepth(1);
      }
    }
  }

  private makeCrios(): void {
    // Crios: the brightest star, always in the west (left).
    const x = 92, y = 50;
    const glow = this.add.image(0, 0, 'title-glow').setBlendMode(Phaser.BlendModes.ADD).setScale(1.6).setAlpha(0.65);
    const glint = this.add.graphics();
    glint.fillStyle(0xdfe8ff, 0.9);
    glint.fillRect(-6, 0, 13, 1); glint.fillRect(0, -6, 1, 13);
    glint.fillStyle(0xdfe8ff, 0.45);
    glint.fillRect(-11, 0, 5, 1); glint.fillRect(7, 0, 5, 1); glint.fillRect(0, -11, 1, 5); glint.fillRect(0, 7, 1, 5);
    glint.fillStyle(0xffffff, 1);
    glint.fillRect(-1, -1, 3, 3);
    glint.fillStyle(0xffffff, 0.6);
    glint.fillRect(-1, -1, 1, 1); glint.fillRect(1, 1, 1, 1);
    const d1 = this.add.graphics();
    d1.fillStyle(0xbcd0ff, 0.35);
    for (let i = 2; i <= 4; i++) { d1.fillRect(-i, -i, 1, 1); d1.fillRect(i, -i, 1, 1); d1.fillRect(-i, i, 1, 1); d1.fillRect(i, i, 1, 1); }
    this.crios = this.add.container(x, y, [glow, d1, glint]).setDepth(2);
  }

  private makeSmoke(): void {
    const drift = -PAD;
    this.add.particles(this.houseX + drift + 7, this.houseY - 21, 'title-smoke', {
      lifespan: 5200, frequency: 420, speedY: { min: -6, max: -3.5 }, speedX: { min: 1.5, max: 3.5 },
      scale: { start: 0.5, end: 2.0 }, alpha: { start: 0.32, end: 0 }, quantity: 1,
    }).setDepth(5.4);
  }

  private makeBlades(): void {
    const r = rng(71);
    const n = noise1(51);
    for (let x = 0; x < W; x += 1) {
      if (r() < 0.45) continue;
      const base = 238 + (n((x + PAD) / 34) - 0.5) * 10;
      this.blades.push({ x, h: 3 + Math.floor(r() * 7) + (r() < 0.08 ? 5 : 0), phase: base, color: r() < 0.25 ? 0x151b3a : r() < 0.5 ? 0x10152f : 0x0c1026 });
    }
  }

  private makeFireflies(): void {
    const r = rng(81);
    for (let i = 0; i < 34; i++) {
      const magic = i === 0; // one turquoise mote: the Urmacht is never far
      const x = r() * W, y = 175 + r() * 85;
      const s = this.add.image(x, y, magic ? 'title-fly-magic' : 'title-fly').setBlendMode(Phaser.BlendModes.ADD).setDepth(magic ? 10 : 9.5);
      const core = this.add.rectangle(x, y, 1, 1, magic ? 0xbffff4 : 0xfaffd0).setDepth(10);
      this.flies.push({ s, core, x, y, vx: (r() - 0.5) * 6, vy: (r() - 0.5) * 4, phase: r() * 10, speed: 0.6 + r() * 1.2, magic });
    }
  }

  // ------------------------------------------------------------------ update

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(0.05, deltaMs / 1000);
    const reduced = G.settings.reducedMotion;
    this.t += dt;
    const t = this.t;

    // Slow parallax drift + gentle pointer parallax.
    for (const L of this.layers) {
      const sway = reduced ? 0 : Math.sin(t * 0.045) * L.amp + this.pointerX * L.amp * 0.35;
      L.obj.x = Math.round(-PAD - sway);
      L.obj.y = Math.round(reduced ? 0 : -this.pointerY * L.amp * 0.08);
    }
    const hills = this.layers[1]?.obj;
    if (hills) {
      this.windowGlow.x = this.houseX + hills.x;
      this.windowGlow.y = this.houseY + hills.y;
      this.windowGlow.setAlpha(0.75 + Math.sin(t * 7.3) * 0.06 + Math.sin(t * 13.1) * 0.04);
    }
    for (const f of this.fog) f.tilePositionX += dt * (f.depth > 5 ? 3.2 : 1.6);

    // Twinkle
    for (const s of this.stars) s.s.setAlpha(Math.max(0.08, s.base * (0.72 + 0.28 * Math.sin(t * s.speed + s.phase))));
    const pulse = 1 + Math.sin(t * 1.3) * 0.08;
    this.crios.setScale(pulse);
    (this.crios.list[0] as Phaser.GameObjects.Image).setAlpha(0.55 + Math.sin(t * 0.9) * 0.12);

    // Grass sway
    const g = this.grass;
    g.clear();
    const meadow = this.layers[3]?.obj;
    const offX = meadow ? meadow.x + PAD : 0;
    const offY = meadow ? meadow.y : 0;
    for (const b of this.blades) {
      const wind = reduced ? 0 : Math.sin(t * 1.6 + b.x * 0.07) * 1.2 + Math.sin(t * 0.7 + b.x * 0.013) * 1.4;
      g.fillStyle(b.color, 1);
      for (let k = 0; k < b.h; k++) {
        const frac = k / b.h;
        const dx = Math.round(wind * frac * frac);
        g.fillRect(Math.round(b.x + offX + dx), Math.round(b.phase + offY - k), 1, 1);
      }
    }

    // Fireflies wander and blink
    for (const f of this.flies) {
      f.phase += dt * f.speed;
      f.vx += Math.sin(f.phase * 1.7) * dt * 4;
      f.vy += Math.cos(f.phase * 1.3) * dt * 3;
      f.vx *= 0.985; f.vy *= 0.985;
      f.x += f.vx * dt * (reduced ? 0.3 : 1);
      f.y += f.vy * dt * (reduced ? 0.3 : 1);
      if (f.magic) f.y -= dt * 2.2;
      if (f.x < -10) f.x = W + 10; if (f.x > W + 10) f.x = -10;
      if (f.y < 150) { f.y = 150; f.vy = Math.abs(f.vy); if (f.magic) { f.y = 262; f.x = 120 + Math.random() * 240; } }
      if (f.y > 266) { f.y = 266; f.vy = -Math.abs(f.vy); }
      const blink = Math.max(0, Math.sin(f.phase * 2.1)) ** 2;
      const a = f.magic ? 0.55 + 0.4 * Math.sin(t * 2) : 0.1 + blink * 0.9;
      f.s.setPosition(Math.round(f.x), Math.round(f.y)).setAlpha(a).setScale(f.magic ? 1 : 1);
      f.core.setPosition(Math.round(f.x), Math.round(f.y)).setAlpha(Math.min(1, a * 1.2));
    }

    // Occasional shooting star
    this.nextShooting -= deltaMs;
    if (this.nextShooting <= 0 && !reduced) {
      this.nextShooting = 7000 + Math.random() * 9000;
      this.shootingStar();
    }
  }

  private shootingStar(): void {
    const x = 160 + Math.random() * 260, y = 15 + Math.random() * 50;
    const g = this.add.graphics().setDepth(1.5).setBlendMode(Phaser.BlendModes.ADD);
    for (let i = 0; i < 14; i++) { g.fillStyle(0xdfe8ff, 1 - i / 14); g.fillRect(i, Math.round(i * 0.45), 1, 1); }
    g.setPosition(x, y);
    this.tweens.add({ targets: g, x: x - 70, y: y + 32, alpha: 0, duration: 900, ease: 'Quad.easeIn', onComplete: () => g.destroy() });
  }
}
