// Code-drawn book pages of the prologue chronicle (ui/plateKit). No painted people (DESIGN.md §2).
import { G } from '../../core/G';
import { DANGER, frame, GOLD, INK, INK_SOFT, inkPath, label, mountainGlyph, parchment, rng, SEPIA, treeGlyph, TURQUOISE } from '../../ui/plateKit';

const W = 1600, H = 900;

function glow(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha = 0.55): void {
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, color.replace('ALPHA', String(alpha)));
  grad.addColorStop(1, color.replace('ALPHA', '0'));
  g.fillStyle = grad;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

/** A tiny robed figure glyph (ink silhouette, no face). */
function figure(g: CanvasRenderingContext2D, x: number, y: number, s: number, color = INK, hood = false): void {
  g.save();
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y - s * 1.55, s * 0.32, 0, Math.PI * 2);
  g.fill();
  if (hood) {
    g.beginPath();
    g.moveTo(x - s * 0.42, y - s * 1.3); g.quadraticCurveTo(x, y - s * 2.2, x + s * 0.42, y - s * 1.3); g.closePath(); g.fill();
  }
  g.beginPath();
  g.moveTo(x - s * 0.22, y - s * 1.25);
  g.quadraticCurveTo(x - s * 0.5, y - s * 0.5, x - s * 0.62, y);
  g.lineTo(x + s * 0.62, y);
  g.quadraticCurveTo(x + s * 0.5, y - s * 0.5, x + s * 0.22, y - s * 1.25);
  g.closePath();
  g.fill();
  g.restore();
}

/** Page 1: Xenovia, the ten, the sealed cave with the turquoise light. */
export function drawUrmachtPage(): HTMLCanvasElement {
  const { canvas, g } = parchment(W, H, 4711);
  const r = rng(17);
  frame(g, W, H, 34);
  label(g, 'Von der Urmacht', W / 2, 150, { size: 62, font: 'head', spacing: 4 });
  inkPath(g, [[560, 182], [1040, 182]], { width: 2, color: INK_SOFT, wobble: 1 });

  // Left: the sea with the banished goddess (a sinking crown of light).
  for (let i = 0; i < 9; i++) {
    const y = 560 + i * 26;
    const pts: [number, number][] = [];
    for (let x = 170; x <= 610; x += 20) pts.push([x, y + Math.sin(x * 0.04 + i) * 6]);
    inkPath(g, pts, { width: 1.6, color: `rgba(43,33,25,${0.5 - i * 0.04})`, wobble: 0.8, seed: i });
  }
  glow(g, 390, 650, 120, 'rgba(70,120,140,ALPHA)', 0.25);
  figure(g, 390, 700, 46, 'rgba(43,33,25,0.35)');
  label(g, 'Xenovia, verbannt auf den Meeresgrund', 390, 830, { size: 26, font: 'italic', color: SEPIA });

  // Centre: the cave in the mountain, sealed, the turquoise light inside.
  mountainGlyph(g, 800, 560, 170, INK);
  mountainGlyph(g, 640, 600, 90, INK_SOFT);
  mountainGlyph(g, 960, 600, 100, INK_SOFT);
  g.save();
  g.beginPath(); g.ellipse(800, 520, 64, 74, 0, Math.PI, 0); g.lineTo(864, 560); g.lineTo(736, 560); g.closePath();
  g.fillStyle = '#1d1a18'; g.fill();
  g.restore();
  glow(g, 800, 520, 150, 'rgba(47,185,163,ALPHA)', 0.55);
  g.save();
  g.fillStyle = TURQUOISE;
  g.beginPath(); g.arc(800, 515, 20, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, d = 30 + r() * 90;
    g.globalAlpha = 0.4 + r() * 0.5;
    g.fillRect(800 + Math.cos(a) * d, 515 + Math.sin(a) * d * 0.7, 3, 3);
  }
  g.restore();
  // Seal ring
  g.save(); g.strokeStyle = GOLD; g.lineWidth = 4; g.beginPath(); g.arc(800, 520, 46, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; g.beginPath(); g.moveTo(800 + Math.cos(a) * 40, 520 + Math.sin(a) * 40); g.lineTo(800 + Math.cos(a) * 54, 520 + Math.sin(a) * 54); g.stroke(); }
  g.restore();
  label(g, 'Die Höhle hinter dem Ratssaal', 800, 650, { size: 26, font: 'italic', color: SEPIA });

  // Right: the first ten humans.
  for (let i = 0; i < 10; i++) {
    const x = 1060 + (i % 5) * 80, y = 470 + Math.floor(i / 5) * 150;
    figure(g, x, y, 34);
  }
  label(g, 'Die ersten zehn Menschen', 1220, 830, { size: 26, font: 'italic', color: SEPIA });
  inkPath(g, [[1010, 560], [900, 540]], { width: 2, color: INK_SOFT, wobble: 2, dash: [10, 8] });
  inkPath(g, [[620, 650], [700, 580]], { width: 2, color: INK_SOFT, wobble: 2, dash: [10, 8] });
  return canvas;
}

const CITY_COLOURS = ['#3d64b8', '#d07a3a', '#3f8a5a', '#c49a3a', '#6f7782', '#7b4fa0', '#b8343a', '#5aa0d8', '#222222', '#8a2a3a'];

/** Page 2: the council of ten in a semicircle, the seal behind them. */
export function drawRatPage(): HTMLCanvasElement {
  const { canvas, g } = parchment(W, H, 815);
  frame(g, W, H, 34);
  label(g, 'Der Rat der Zehn Geweihten', W / 2, 150, { size: 58, font: 'head', spacing: 3 });
  inkPath(g, [[500, 182], [1100, 182]], { width: 2, color: INK_SOFT, wobble: 1 });
  const cx = 800, cy = 640;
  // Seal at the apex
  glow(g, cx, 290, 110, 'rgba(47,185,163,ALPHA)', 0.45);
  g.save(); g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.arc(cx, 290, 50, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = GOLD; g.beginPath(); g.arc(cx, 290, 36, 0, Math.PI * 2); g.stroke(); g.restore();
  label(g, 'das Siegel', cx, 380, { size: 24, font: 'italic', color: SEPIA });
  // Ten seats with banners
  for (let i = 0; i < 10; i++) {
    const side = i < 5 ? -1 : 1;
    const k = i < 5 ? 4 - i : i - 5;
    const theta = side * (0.32 + k * 0.25);
    const x = cx + Math.sin(theta) * 540, y = cy + 20 - Math.cos(theta) * 240;
    // banner
    g.save();
    g.fillStyle = CITY_COLOURS[i];
    g.globalAlpha = 0.85;
    g.beginPath(); g.moveTo(x - 18, y - 120); g.lineTo(x + 18, y - 120); g.lineTo(x + 18, y - 64); g.lineTo(x, y - 76); g.lineTo(x - 18, y - 64); g.closePath(); g.fill();
    g.restore();
    inkPath(g, [[x - 18, y - 120], [x + 18, y - 120], [x + 18, y - 64], [x, y - 76], [x - 18, y - 64]], { width: 2, close: true, wobble: 0.6, seed: i });
    // seat
    inkPath(g, [[x - 20, y], [x - 20, y - 46], [x, y - 58], [x + 20, y - 46], [x + 20, y]], { width: 3, wobble: 0.8, seed: 40 + i });
  }
  // Mosaic star in the middle
  const star: [number, number][] = [];
  for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? 30 : 80; star.push([cx + Math.cos(a) * rr * 1.6, cy - 60 + Math.sin(a) * rr * 0.7]); }
  inkPath(g, star, { width: 2, color: GOLD, close: true, wobble: 0.5 });
  label(g, 'Sechs, die wachen wollten', 470, 780, { size: 26, font: 'italic', color: SEPIA });
  label(g, 'Vier, die herrschen wollten', 1130, 780, { size: 26, font: 'italic', color: DANGER });
  return canvas;
}

/** Page 3: Dunkelhain — the hill, the banners, the black army (bridge before the battle). */
export function drawDunkelhainPage(): HTMLCanvasElement {
  const { canvas, g } = parchment(W, H, 1604);
  const r = rng(5);
  frame(g, W, H, 34);
  label(g, 'Dunkelhain', W / 2, 150, { size: 64, font: 'head', spacing: 6 });
  inkPath(g, [[620, 182], [980, 182]], { width: 2, color: INK_SOFT, wobble: 1 });
  // The hill
  const hill: [number, number][] = [];
  for (let x = 180; x <= 1420; x += 20) hill.push([x, 700 - Math.exp(-(((x - 640) / 300) ** 2)) * 300 - Math.sin(x * 0.02) * 6]);
  inkPath(g, hill, { width: 3, wobble: 1.4 });
  for (let i = 0; i < 40; i++) treeGlyph(g, 200 + r() * 1200, 720 + r() * 80, 16 + r() * 10, INK_SOFT);
  // Light banners on the summit
  for (let i = 0; i < 5; i++) {
    const x = 540 + i * 50, y = 420 + Math.abs(i - 2) * 18;
    inkPath(g, [[x, y], [x, y - 70]], { width: 2 });
    g.save(); g.fillStyle = '#3d64b8'; g.globalAlpha = 0.75; g.fillRect(x, y - 70, 30, 22); g.fillStyle = '#f2f0e6'; g.fillRect(x, y - 48, 30, 10); g.restore();
  }
  // Black army below (rows of spears)
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i < 22; i++) {
      const x = 900 + i * 22 + row * 10, y = 640 + row * 24;
      inkPath(g, [[x, y], [x + 3, y - 34]], { width: 2, color: INK });
      g.save(); g.fillStyle = INK; g.beginPath(); g.arc(x, y - 6, 5, 0, Math.PI * 2); g.fill(); g.restore();
    }
  }
  for (let i = 0; i < 4; i++) {
    const x = 960 + i * 120, y = 590;
    inkPath(g, [[x, y], [x, y - 60]], { width: 2 });
    g.save(); g.fillStyle = '#1d1d1d'; g.fillRect(x, y - 60, 14, 11); g.fillRect(x + 14, y - 49, 14, 11); g.fillStyle = '#efe9da'; g.fillRect(x + 14, y - 60, 14, 11); g.fillRect(x, y - 49, 14, 11); g.restore();
  }
  // Arrow of the advance
  inkPath(g, [[1300, 560], [1100, 500], [880, 470]], { width: 4, color: DANGER, wobble: 2 });
  inkPath(g, [[900, 450], [880, 470], [904, 488]], { width: 4, color: DANGER, wobble: 1 });
  label(g, 'Paladine des Lichts · Brigaden aus Ebaril · Falken aus Portas', 640, 300, { size: 24, font: 'italic', color: SEPIA });
  label(g, 'das schwarze Heer der Vier', 1180, 780, { size: 26, font: 'italic', color: DANGER });
  return canvas;
}

let registered = false;
export function registerBookPlates(): void {
  if (registered) return;
  registered = true;
  G.ui.registerPlate('prolog-buch-urmacht', drawUrmachtPage);
  G.ui.registerPlate('prolog-buch-rat', drawRatPage);
  G.ui.registerPlate('prolog-buch-dunkelhain', drawDunkelhainPage);
}
