// Code-drawn book plates of Kapitel III.
//  k3-karte: the master's map on Baris' table, as Kyra sees it through a gap in the tent — she cannot read, so every
//            label is an illegible scrawl (DESIGN.md §3: in Kyra scenes writing stays unreadable).
import { G } from '../../core/G';
import { frame, INK, INK_SOFT, inkPath, mountainGlyph, parchment, rng, treeGlyph } from '../../ui/plateKit';

/** A line of pseudo-writing: loops and hooks that look like script but are not letters. */
function scrawl(g: CanvasRenderingContext2D, x: number, y: number, width: number, size: number, seed: number, color = INK): void {
  const r = rng(seed);
  g.save();
  g.strokeStyle = color;
  g.lineWidth = Math.max(1.4, size * 0.09);
  g.lineCap = 'round';
  g.beginPath();
  let cx = x;
  g.moveTo(cx, y);
  while (cx < x + width) {
    const w = size * (0.35 + r() * 0.5);
    const up = size * (0.3 + r() * 0.7) * (r() < 0.18 ? 1.8 : 1);
    g.bezierCurveTo(cx + w * 0.2, y - up, cx + w * 0.8, y - up * 0.6, cx + w, y + (r() - 0.5) * size * 0.25);
    if (r() < 0.22) { g.moveTo(cx + w + size * 0.3, y); cx += size * 0.3; } // word gap
    cx += w;
  }
  g.stroke();
  g.restore();
}

function antler(g: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  g.save();
  g.translate(x, y);
  g.strokeStyle = '#7a2e1f';
  g.lineWidth = 4;
  g.lineCap = 'round';
  const branch = (dir: number) => {
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(dir * s * 0.25, -s * 0.5, dir * s * 0.45, -s); g.stroke();
    for (const t of [0.35, 0.6, 0.85]) {
      const bx = dir * s * 0.45 * t * 1.05, by = -s * t;
      g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + dir * s * 0.28, by - s * 0.16); g.stroke();
    }
  };
  branch(-1); branch(1);
  g.restore();
}

export function drawBarisMap(): HTMLCanvasElement {
  const W = 1600, H = 900;
  const { canvas, g } = parchment(W, H, 451);
  const r = rng(4511);
  // forest belt
  for (let i = 0; i < 70; i++) treeGlyph(g, 260 + r() * 820, 260 + r() * 380, 20 + r() * 10);
  // hills in the east with the grotto
  for (let i = 0; i < 9; i++) mountainGlyph(g, 1080 + i * 46 + (r() - 0.5) * 20, 330 + (r() - 0.5) * 40, 46 + r() * 22);
  // pond (the camp)
  g.save();
  g.fillStyle = 'rgba(60,90,120,0.28)';
  g.beginPath(); g.ellipse(360, 610, 70, 40, 0.2, 0, Math.PI * 2); g.fill();
  g.restore();
  inkPath(g, Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * Math.PI * 2; return [360 + Math.cos(a) * 72, 610 + Math.sin(a) * 42] as [number, number]; }), { width: 2, close: true, seed: 3 });
  // dotted route: camp → river → hills (two days' ride)
  const route: [number, number][] = [[420, 590], [560, 560], [700, 520], [820, 470], [930, 430], [1030, 400], [1140, 380], [1215, 372]];
  inkPath(g, route, { width: 3, color: 'rgba(122,46,31,0.85)', dash: [14, 10], wobble: 3, seed: 9 });
  // river
  inkPath(g, [[760, 180], [740, 300], [790, 420], [760, 560], [800, 740]], { width: 3, color: 'rgba(60,90,120,0.6)', wobble: 4, seed: 12 });
  // the grotto: a cave mouth and a crossed-out circle
  g.save();
  g.fillStyle = INK;
  g.beginPath(); g.ellipse(1230, 372, 22, 14, 0, Math.PI, 0); g.fill();
  g.restore();
  g.save();
  g.strokeStyle = '#7a2e1f'; g.lineWidth = 3;
  g.beginPath(); g.arc(1230, 372, 52, 0, Math.PI * 2); g.stroke();
  g.restore();
  antler(g, 1230, 300, 60);
  // illegible labels everywhere (Kyra cannot read)
  scrawl(g, 270, 690, 190, 24, 1);
  scrawl(g, 1120, 470, 230, 26, 2, '#7a2e1f');
  scrawl(g, 600, 150, 300, 30, 3);
  scrawl(g, 860, 620, 160, 20, 4, INK_SOFT);
  scrawl(g, 1180, 230, 140, 20, 5);
  scrawl(g, 200, 200, 230, 34, 6);
  scrawl(g, 205, 250, 180, 22, 7, INK_SOFT);
  // a seal in the corner: the master's mark (cold violet wax)
  g.save();
  g.fillStyle = '#5b3f8a';
  g.beginPath(); g.arc(1390, 760, 46, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(30,15,50,0.6)'; g.lineWidth = 3;
  g.beginPath(); g.arc(1390, 760, 34, 0, Math.PI * 2); g.stroke();
  g.restore();
  // dim candle light from the tent: dark vignette, a slit of light (seen through a gap in the canvas)
  const v = g.createRadialGradient(W * 0.55, H * 0.5, H * 0.2, W * 0.5, H * 0.5, W * 0.62);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(10,6,4,0.78)');
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
  frame(g, W, H, 26);
  return canvas;
}

let registered = false;
export function registerK3Plates(): void {
  if (registered) return;
  registered = true;
  G.ui.registerPlate('k3-karte', drawBarisMap);
}
