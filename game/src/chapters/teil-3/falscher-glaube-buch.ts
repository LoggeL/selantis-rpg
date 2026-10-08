// The doctor's book as a drawn plate (ui/plateKit): an old copy without a title, open on the lectern under his
// forgotten lamp. Only marks, no readable words (the passages Lia reads come as narration): on the left page waves and
// a mound of earth, on the right a smudged block of text and a ring of ten fresh ink strokes, between them the stub of
// a page that was cut out. Nothing on it names an object (umsetzung.md §3: no relic list, no recipe).
import { G } from '../../core/G';
import { INK, INK_SOFT, inkPath, makeCanvas, rng, SEPIA } from '../../ui/plateKit';

export const BOOK_PLATE = 'e3-buch-des-doktors';

const W = 1600, H = 900;

/** One page of aged paper (a skewed quad with soft edges). */
function page(g: CanvasRenderingContext2D, pts: [number, number][], seed: number): void {
  const r = rng(seed);
  g.save();
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  const grad = g.createLinearGradient(pts[0][0], 0, pts[1][0], 0);
  grad.addColorStop(0, '#d9c49a');
  grad.addColorStop(0.5, '#e8d6ac');
  grad.addColorStop(1, '#cbb284');
  g.fillStyle = grad;
  g.fill();
  g.clip();
  for (let i = 0; i < 160; i++) {
    g.fillStyle = `rgba(110,80,40,${0.04 + r() * 0.06})`;
    g.beginPath();
    g.arc(pts[0][0] + r() * (pts[1][0] - pts[0][0]), 120 + r() * 640, 2 + r() * 14, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/** Illegible lines of an old hand: wavy strokes with gaps, no letters. */
function scribble(g: CanvasRenderingContext2D, x0: number, x1: number, y0: number, rows: number, seed: number, color = INK_SOFT): void {
  const r = rng(seed);
  for (let row = 0; row < rows; row++) {
    const y = y0 + row * 30;
    let x = x0 + (row === 0 ? 40 : 0);
    while (x < x1 - 20) {
      const len = 30 + r() * 70;
      const pts: [number, number][] = [];
      for (let t = 0; t <= len; t += 6) pts.push([x + t, y + Math.sin((x + t) * 0.35 + row) * 3 + (r() - 0.5) * 2]);
      inkPath(g, pts, { width: 2, color, wobble: 0.6, seed: row * 31 + Math.floor(x) });
      x += len + 10 + r() * 14;
    }
  }
}

function drawBook(): HTMLCanvasElement {
  const { canvas, g } = makeCanvas(W, H);
  // Dark lectern wood and the warm pool of the lamp.
  g.fillStyle = '#21160f';
  g.fillRect(0, 0, W, H);
  const lamp = g.createRadialGradient(560, 300, 40, 760, 460, 900);
  lamp.addColorStop(0, 'rgba(255,196,107,0.35)');
  lamp.addColorStop(1, 'rgba(255,196,107,0)');
  g.fillStyle = lamp;
  g.fillRect(0, 0, W, H);
  // Cover edges under the pages.
  g.fillStyle = '#4a2a1a';
  g.beginPath(); g.moveTo(170, 130); g.lineTo(1430, 120); g.lineTo(1460, 790); g.lineTo(140, 800); g.closePath(); g.fill();

  page(g, [[200, 150], [790, 170], [790, 770], [180, 770]], 11);
  page(g, [[810, 170], [1400, 145], [1420, 770], [810, 770]], 23);
  // The gutter and the stub of the cut page.
  g.fillStyle = 'rgba(40,25,15,0.45)';
  g.fillRect(784, 160, 32, 620);
  g.fillStyle = '#d6c093';
  g.beginPath(); g.moveTo(796, 175); g.lineTo(826, 180); g.lineTo(822, 765); g.lineTo(798, 765); g.closePath(); g.fill();
  inkPath(g, [[826, 180], [822, 765]], { width: 1.5, color: SEPIA, wobble: 0.2 });

  // Left page: the making of the world – waves, a mound of earth, a breath, ten small figures as dots.
  scribble(g, 250, 740, 220, 6, 3);
  for (let i = 0; i < 4; i++) {
    const pts: [number, number][] = [];
    for (let x = 270; x <= 720; x += 15) pts.push([x, 520 + i * 18 + Math.sin(x * 0.05 + i) * 6]);
    inkPath(g, pts, { width: 2, color: INK_SOFT, wobble: 0.8, seed: 50 + i });
  }
  inkPath(g, [[330, 500], [420, 430], [520, 410], [620, 440], [690, 500]], { width: 3, color: INK, wobble: 1.2, seed: 7 });
  for (let i = 0; i < 10; i++) {
    g.fillStyle = INK;
    g.beginPath(); g.arc(380 + i * 30, 470 - Math.sin(i / 9 * Math.PI) * 30, 5, 0, Math.PI * 2); g.fill();
  }
  scribble(g, 250, 740, 640, 3, 9);

  // Right page: smudged text, then the ring of ten strokes in fresh, glossy ink, and a fresh note in the margin.
  scribble(g, 860, 1360, 220, 5, 17);
  g.save();
  g.filter = 'blur(3px)';
  scribble(g, 860, 1360, 370, 3, 19, 'rgba(43,33,25,0.45)');
  g.restore();
  const cx = 1110, cy = 590;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    inkPath(g, [[cx + Math.cos(a) * 70, cy + Math.sin(a) * 70], [cx + Math.cos(a) * 100, cy + Math.sin(a) * 100]], { width: 4, color: '#120c08', wobble: 0.3, seed: 70 + i });
  }
  g.save();
  g.strokeStyle = 'rgba(255,240,210,0.35)';
  g.lineWidth = 1.5;
  g.beginPath(); g.arc(cx, cy, 86, 0, Math.PI * 2); g.stroke();
  g.restore();
  inkPath(g, [[1300, 500], [1330, 488], [1352, 500], [1340, 520]], { width: 2.5, color: '#120c08', wobble: 0.4, seed: 91 });
  inkPath(g, [[1346, 534], [1346, 538]], { width: 3, color: '#120c08' });
  return canvas;
}

let registered = false;
export function registerBookPlate(): void {
  if (registered) return;
  registered = true;
  G.ui.registerPlate(BOOK_PLATE, drawBook);
}
