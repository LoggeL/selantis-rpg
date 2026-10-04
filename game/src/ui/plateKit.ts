/**
 * Drawing helpers for code-drawn book plates (maps, constellations, letters, seals, vignettes).
 * Register with G.ui.registerPlate(id, () => canvas). No painted people (DESIGN.md §2).
 */

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Safe area of a plate as a fraction of its size per side. Plates pan and zoom (up to ~5 % crop per side)
 * and portrait phones crop wide plates to a travelling 4:5 window: keep labels and key motifs inside.
 */
export const SAFE = 0.08;

/** The safe rectangle of a w×h plate (see SAFE). */
export function safeRect(w: number, h: number, inset = SAFE): { x: number; y: number; w: number; h: number } {
  return { x: Math.round(w * inset), y: Math.round(h * inset), w: Math.round(w * (1 - inset * 2)), h: Math.round(h * (1 - inset * 2)) };
}

export const INK = '#2b2119';
export const INK_SOFT = 'rgba(43,33,25,0.55)';
export const SEPIA = '#7a4f2a';
export const GOLD = '#b8913c';
export const TURQUOISE = '#2fb9a3';
export const DANGER = '#9e3524';

export function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  return { canvas, g: canvas.getContext('2d')! };
}

/** Aged parchment: warm base, fibres, mottling, stains and burnt edges. */
export function parchment(w = 1600, h = 900, seed = 7): { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const { canvas, g } = makeCanvas(w, h);
  const r = rng(seed);
  const base = g.createRadialGradient(w * 0.45, h * 0.42, Math.min(w, h) * 0.1, w / 2, h / 2, Math.max(w, h) * 0.75);
  base.addColorStop(0, '#f3e7cc');
  base.addColorStop(0.55, '#e9d7b2');
  base.addColorStop(1, '#c9a978');
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  // Mottling
  for (let i = 0; i < 90; i++) {
    const x = r() * w, y = r() * h, rad = 30 + r() * 160;
    const m = g.createRadialGradient(x, y, 0, x, y, rad);
    const dark = r() < 0.5;
    m.addColorStop(0, dark ? 'rgba(140,100,55,0.07)' : 'rgba(255,248,230,0.08)');
    m.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = m;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // Fibres
  g.lineWidth = 1;
  for (let i = 0; i < 1400; i++) {
    const x = r() * w, y = r() * h, len = 4 + r() * 18, a = r() * Math.PI;
    g.strokeStyle = r() < 0.5 ? 'rgba(120,85,45,0.08)' : 'rgba(255,250,235,0.10)';
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len * 0.3); g.stroke();
  }
  // Grain
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 14;
    d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.8;
  }
  g.putImageData(img, 0, 0);
  // A couple of tea stains
  for (let i = 0; i < 3; i++) {
    const x = r() * w, y = r() * h, rad = 40 + r() * 70;
    g.strokeStyle = 'rgba(130,85,40,0.10)';
    g.lineWidth = 3 + r() * 3;
    g.beginPath(); g.ellipse(x, y, rad, rad * (0.8 + r() * 0.3), r() * 3, 0, Math.PI * 2); g.stroke();
  }
  // Burnt / darkened edges
  const edge = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.56);
  edge.addColorStop(0, 'rgba(60,35,15,0)');
  edge.addColorStop(0.75, 'rgba(90,55,25,0.18)');
  edge.addColorStop(1, 'rgba(50,28,10,0.6)');
  g.fillStyle = edge;
  g.fillRect(0, 0, w, h);
  return { canvas, g };
}

/** Night sky (for constellation plates): deep blue with stars. */
export function nightSky(w = 1600, h = 900, seed = 3): { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const { canvas, g } = makeCanvas(w, h);
  const r = rng(seed);
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#060a1c');
  sky.addColorStop(0.6, '#121a38');
  sky.addColorStop(1, '#25264a');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) {
    const x = r() * w, y = r() * h, s = r();
    g.fillStyle = `rgba(${220 + r() * 35},${220 + r() * 35},255,${0.2 + s * 0.7})`;
    g.fillRect(x, y, s > 0.97 ? 2.5 : s > 0.85 ? 1.6 : 1, s > 0.97 ? 2.5 : s > 0.85 ? 1.6 : 1);
  }
  return { canvas, g };
}

/** Hand-inked wobbly line through points (map coasts, roads, rivers). */
export function inkPath(g: CanvasRenderingContext2D, pts: [number, number][], opts: { width?: number; color?: string; wobble?: number; seed?: number; close?: boolean; dash?: number[] } = {}): void {
  const r = rng(opts.seed ?? 11);
  const wob = opts.wobble ?? 2;
  g.save();
  g.strokeStyle = opts.color ?? INK;
  g.lineWidth = opts.width ?? 2.2;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (opts.dash) g.setLineDash(opts.dash);
  g.beginPath();
  const list = opts.close ? [...pts, pts[0]] : pts;
  list.forEach(([x, y], i) => {
    const jx = x + (r() - 0.5) * wob, jy = y + (r() - 0.5) * wob;
    if (i === 0) g.moveTo(jx, jy);
    else {
      const [px, py] = list[i - 1];
      g.quadraticCurveTo(px + (r() - 0.5) * wob * 2, py + (r() - 0.5) * wob * 2, (px + jx) / 2, (py + jy) / 2);
      g.lineTo(jx, jy);
    }
  });
  g.stroke();
  g.restore();
}

/** Calligraphic label (Cinzel / Alegreya must be loaded; falls back to serif). */
export function label(g: CanvasRenderingContext2D, text: string, x: number, y: number, opts: { size?: number; font?: 'head' | 'body' | 'italic'; color?: string; align?: CanvasTextAlign; spacing?: number } = {}): void {
  const size = opts.size ?? 28;
  const family = opts.font === 'head' ? 'Cinzel, serif' : 'Alegreya, Georgia, serif';
  g.save();
  g.font = `${opts.font === 'italic' ? 'italic ' : ''}${opts.font === 'head' ? 700 : 500} ${size}px ${family}`;
  g.fillStyle = opts.color ?? INK;
  g.textAlign = opts.align ?? 'center';
  g.textBaseline = 'middle';
  if (opts.spacing && 'letterSpacing' in g) (g as unknown as { letterSpacing: string }).letterSpacing = `${opts.spacing}px`;
  g.fillText(text, x, y);
  g.restore();
}

/** Compass rose. */
export function compass(g: CanvasRenderingContext2D, x: number, y: number, rad: number, color = INK): void {
  g.save();
  g.translate(x, y);
  g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 1.5;
  g.beginPath(); g.arc(0, 0, rad * 0.62, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(0, 0, rad * 0.56, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const long = i % 2 === 0;
    const len = long ? rad : rad * 0.55;
    const wdt = long ? rad * 0.13 : rad * 0.09;
    g.beginPath();
    g.moveTo(Math.cos(a) * len, Math.sin(a) * len);
    g.lineTo(Math.cos(a + Math.PI / 2) * wdt, Math.sin(a + Math.PI / 2) * wdt);
    g.lineTo(0, 0);
    g.closePath();
    g.globalAlpha = 1; g.fill();
    g.beginPath();
    g.moveTo(Math.cos(a) * len, Math.sin(a) * len);
    g.lineTo(Math.cos(a - Math.PI / 2) * wdt, Math.sin(a - Math.PI / 2) * wdt);
    g.lineTo(0, 0);
    g.closePath();
    g.stroke();
  }
  label(g, 'N', 0, -rad - rad * 0.22, { size: rad * 0.3, font: 'head', color });
  g.restore();
}

/** Ornamental double frame line inside the plate. */
export function frame(g: CanvasRenderingContext2D, w: number, h: number, inset = 28, color = INK_SOFT): void {
  g.save();
  g.strokeStyle = color;
  g.lineWidth = 2.5; g.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
  g.lineWidth = 1; g.strokeRect(inset + 7, inset + 7, w - inset * 2 - 14, h - inset * 2 - 14);
  const c = 18;
  for (const [cx, cy, sx, sy] of [[inset, inset, 1, 1], [w - inset, inset, -1, 1], [inset, h - inset, 1, -1], [w - inset, h - inset, -1, -1]] as const) {
    g.beginPath();
    g.moveTo(cx + sx * 7, cy + sy * (c + 7)); g.quadraticCurveTo(cx + sx * 7, cy + sy * 7, cx + sx * (c + 7), cy + sy * 7);
    g.lineWidth = 2; g.stroke();
    g.beginPath(); g.arc(cx + sx * 13, cy + sy * 13, 2.5, 0, Math.PI * 2); g.fillStyle = color; g.fill();
  }
  g.restore();
}

/** Small tree glyph (map forests). */
export function treeGlyph(g: CanvasRenderingContext2D, x: number, y: number, s: number, color = INK): void {
  g.save();
  g.strokeStyle = color; g.lineWidth = Math.max(1, s * 0.12);
  g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - s * 0.35); g.stroke();
  g.beginPath(); g.arc(x, y - s * 0.65, s * 0.32, 0, Math.PI * 2);
  g.fillStyle = 'rgba(70,90,50,0.25)'; g.fill(); g.stroke();
  g.restore();
}

/** Mountain glyph (map ranges). */
export function mountainGlyph(g: CanvasRenderingContext2D, x: number, y: number, s: number, color = INK): void {
  g.save();
  g.strokeStyle = color; g.lineWidth = Math.max(1, s * 0.07); g.lineJoin = 'round';
  g.beginPath(); g.moveTo(x - s * 0.6, y); g.lineTo(x - s * 0.05, y - s * 0.8); g.lineTo(x + s * 0.6, y); g.stroke();
  g.beginPath(); g.moveTo(x - s * 0.05, y - s * 0.8); g.lineTo(x + s * 0.12, y - s * 0.35); g.lineTo(x + s * 0.02, y - s * 0.1);
  g.stroke();
  g.fillStyle = 'rgba(60,40,20,0.18)';
  g.beginPath(); g.moveTo(x - s * 0.05, y - s * 0.8); g.lineTo(x + s * 0.6, y); g.lineTo(x + s * 0.05, y); g.closePath(); g.fill();
  g.restore();
}

/** City/settlement glyph: little towers. */
export function townGlyph(g: CanvasRenderingContext2D, x: number, y: number, s: number, color = INK, fill = '#c8a46a'): void {
  g.save();
  g.strokeStyle = color; g.fillStyle = fill; g.lineWidth = Math.max(1, s * 0.07);
  const towers: [number, number, number][] = [[-0.38, 0.55, 0.22], [0, 0.85, 0.26], [0.38, 0.62, 0.22]];
  for (const [dx, hgt, wd] of towers) {
    const tx = x + dx * s, w2 = wd * s;
    g.beginPath(); g.rect(tx - w2 / 2, y - hgt * s, w2, hgt * s); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(tx - w2 / 2 - 2, y - hgt * s); g.lineTo(tx, y - hgt * s - w2 * 0.9); g.lineTo(tx + w2 / 2 + 2, y - hgt * s); g.closePath();
    g.fillStyle = '#8e3d2c'; g.fill(); g.stroke(); g.fillStyle = fill;
  }
  g.beginPath(); g.moveTo(x - s * 0.6, y); g.lineTo(x + s * 0.6, y); g.stroke();
  g.restore();
}
