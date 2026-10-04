import { RAMPS, mix } from './palette';
import { Px } from './px';

/** 16x16 item / UI icons. Drawn with the shared palette, light from the top-left, dark coloured outline. */

const R = RAMPS;
type Draw = (p: Px) => void;

function book(p: Px, cover: readonly number[], emblem: Draw): void {
  // closed book in 3/4 view: cover + page block on the right/bottom
  for (let y = 2; y < 14; y++) for (let x = 3; x < 13; x++) p.set(x, y, cover[x === 3 ? 4 : x > 10 ? 2 : 3]);
  for (let y = 3; y < 14; y++) { p.set(13, y, R.cream[4]); p.set(12, y + 0, cover[1]); }
  for (let x = 4; x < 14; x++) p.set(x, 14, R.cream[3]);
  for (let y = 3; y < 13; y++) p.set(4, y, cover[5] ?? cover[4]);
  for (let x = 3; x < 13; x++) { p.set(x, 2, cover[4]); }
  emblem(p);
}

function bottle(p: Px, liquid: readonly number[]): void {
  p.ellipse(8, 10.5, 4.5, 4, R.sky[4]);
  p.ellipse(8, 11.2, 3.6, 3, liquid[3]);
  p.ellipse(7, 12, 1.5, 1.2, liquid[4]);
  p.rect(7, 3, 3, 4, R.sky[4]); p.rect(7, 3, 1, 4, R.white[4]);
  p.rect(6, 1, 5, 2, R.wood[3]); p.set(6, 1, R.wood[4]);
  p.set(6, 8, R.white[4]); p.set(5, 9, R.white[4]);
}

function star(p: Px, cx: number, cy: number, r: number, c: number, c2: number): void {
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, len = k % 2 ? r * 0.5 : r;
    for (let i = 0; i <= len; i++) p.set(Math.round(cx + Math.cos(a) * i), Math.round(cy + Math.sin(a) * i), i < len * 0.5 ? c2 : c);
  }
}

const ICONS: Record<string, Draw> = {
  'book-herbs': p => book(p, R.green, q => {
    // leaf emblem
    q.set(8, 5, R.olive[5]); q.set(7, 6, R.olive[5]); q.set(8, 6, R.olive[4]); q.set(9, 6, R.olive[4]); q.set(7, 7, R.olive[4]); q.set(8, 7, R.olive[5]); q.set(9, 7, R.olive[3]); q.set(8, 8, R.olive[3]); q.set(8, 9, R.wood[4]); q.set(8, 10, R.wood[3]);
    for (let x = 5; x < 11; x++) q.set(x, 12, R.gold[3]);
  }),
  'book-alana': p => book(p, R.blue, q => {
    star(q, 8, 7, 3, R.gold[3], R.gold[5]);
    for (let x = 5; x < 11; x++) q.set(x, 12, R.gold[3]);
    q.set(8, 7, R.urmacht[4]);
  }),
  'journal': p => book(p, R.leather, q => {
    for (let y = 2; y < 15; y++) q.set(10, y, R.red[3]);
    q.set(10, 15, R.red[2]); q.set(9, 15, R.red[3]);
    for (let x = 5; x < 9; x++) { q.set(x, 6, R.leather[2]); q.set(x, 8, R.leather[2]); }
  }),
  'dagger': p => {
    for (let i = 0; i < 8; i++) { p.set(4 + i, 11 - i, R.steel[6]); p.set(5 + i, 11 - i, R.steel[4]); p.set(5 + i, 12 - i, R.steel[3]); }
    p.set(13, 3, R.steel[6]); p.set(13, 2, R.steel[5]);
    for (let i = 0; i < 4; i++) { p.set(2 + i, 10 + i, R.gold[i < 2 ? 4 : 3]); }
    p.set(3, 13, R.leather[3]); p.set(2, 14, R.leather[2]); p.set(1, 14, R.gold[3]); p.set(4, 12, R.leather[3]); p.set(3, 12, R.leather[4]);
  },
  'coins': p => {
    // stack of copper coins + a silver one leaning
    for (let k = 0; k < 4; k++) { const y = 12 - k * 2; p.ellipse(7, y, 4.5, 1.8, R.rust[2]); p.ellipse(7, y - 0.6, 4.5, 1.6, k === 3 ? R.rust[4] : R.rust[3]); }
    p.ellipse(6, 5.6, 2, 0.7, R.rust[5]);
    p.ellipse(12, 10, 2.6, 3.6, R.silver[2]); p.ellipse(11.6, 9.6, 2, 3, R.silver[4]); p.set(11, 8, 0xffffff); p.set(12, 10, R.silver[2]);
  },
  'tincture': p => bottle(p, R.red),
  'bread': p => {
    p.ellipse(8, 9, 6.5, 4, R.straw[2]);
    p.ellipse(7.5, 8, 5.5, 3, R.straw[3]);
    p.ellipse(6.5, 7, 3, 1.5, R.straw[4]);
    for (const x of [5, 8, 11]) { p.set(x, 8, R.straw[1]); p.set(x + 1, 7, R.straw[1]); p.set(x, 7, R.straw[5]); }
  },
  'cheese': p => {
    p.poly([[2, 10], [13, 5], [14, 12], [3, 14]], R.yellow[3]);
    p.poly([[2, 10], [13, 5], [14, 7], [3, 11]], R.yellow[4]);
    for (let x = 3; x < 14; x++) p.set(x, 13 - Math.round((x - 3) * 0.1), R.yellow[1]);
    p.set(7, 12, R.yellow[1]); p.set(10, 10, R.yellow[2]); p.set(11, 11, R.yellow[1]); p.set(6, 11, R.yellow[2]);
  },
  'bacon': p => {
    for (let x = 2; x < 14; x++) {
      const w = Math.round(Math.sin(x * 0.9) * 1.2);
      for (let y = 5; y < 11; y++) {
        const yy = y + w;
        const band = y < 6 ? R.red[4] : y < 8 ? R.cream[4] : y < 9 ? R.red[3] : R.cream[3];
        p.set(x, yy, band);
      }
    }
    p.set(3, 6, R.cream[5]);
  },
  'waterskin': p => {
    p.ellipse(8, 10, 5, 4.5, R.leather[3]);
    p.ellipse(7, 9, 3, 2.5, R.leather[4]);
    p.rect(7, 3, 3, 3, R.leather[2]); p.rect(6, 2, 5, 1, R.wood[3]);
    for (let x = 3; x < 14; x++) p.set(x, 8 + Math.round(((x - 8) ** 2) / 12), R.leather[1]);
    p.set(5, 9, R.leather[5]); p.set(12, 3, R.straw[3]); p.set(11, 4, R.straw[2]); p.set(13, 2, R.straw[3]);
  },
  'blanket': p => {
    for (let y = 4; y < 13; y++) for (let x = 2; x < 14; x++) {
      const stripe = (y - 4) % 4 < 2;
      p.set(x, y, stripe ? R.red[3] : R.cream[4]);
    }
    for (let x = 2; x < 14; x++) { p.set(x, 13, R.red[2]); p.set(x, 4, R.red[4]); }
    for (let x = 3; x < 14; x += 2) p.set(x, 14, R.cream[3]); // fringe
  },
  'cloak': p => {
    const g = R.green;
    p.poly([[5, 2], [11, 2], [14, 14], [2, 14]], g[3]);
    for (let y = 3; y < 14; y++) { p.set(8, y, g[2]); p.set(5 + Math.round((y - 2) * -0.15), y, g[4]); }
    for (let x = 3; x < 14; x++) p.set(x, 14, g[1]);
    p.rect(6, 1, 4, 2, g[4]); p.set(8, 3, R.gold[4]); p.set(7, 3, R.gold[3]);
  },
  'tinder': p => {
    // tinder pouch with flint and steel spark
    p.ellipse(7, 10, 5, 4, R.linen[2]); p.ellipse(6, 9, 3, 2.5, R.linen[3]);
    p.rect(5, 5, 4, 2, R.linen[1]);
    p.rect(10, 4, 4, 3, R.stone[3]); p.set(10, 4, R.stone[5]);
    p.set(12, 2, R.fire[4]); p.set(13, 1, R.fire[3]); p.set(11, 1, R.fire[4]); p.set(14, 3, R.fire[3]);
  },
  'flowers': p => {
    for (let i = 0; i < 4; i++) { const x = 5 + i * 2; for (let y = 8; y < 15; y++) p.set(x + (y < 11 ? (i - 1.5 > 0 ? 1 : 0) : 0), y, R.grass[3]); }
    const cf = R.cornflower;
    for (const [x, y] of [[4, 5], [8, 3], [11, 5], [7, 7]] as const) { p.set(x, y, cf[3]); p.set(x - 1, y, cf[2]); p.set(x + 1, y, cf[3]); p.set(x, y - 1, cf[4]); p.set(x, y + 1, cf[2]); p.set(x - 1, y - 1, cf[4]); }
    p.rect(5, 11, 6, 2, R.straw[3]);
  },
  'apple': p => {
    p.ellipse(8, 9.5, 5.5, 5, R.red[3]);
    p.ellipse(6.5, 8, 3, 2.5, R.red[4]);
    p.set(5, 7, R.red[5]); p.set(6, 6, R.red[5]);
    p.set(8, 4, R.wood[2]); p.set(8, 3, R.wood[3]); p.set(9, 3, R.green[4]); p.set(10, 2, R.green[5]); p.set(10, 3, R.green[3]);
  },
  'ribbon': p => {
    const o = R.olive;
    // bow: two loops + knot + two tails
    p.ellipse(4.5, 6, 3.5, 2.6, o[4]); p.ellipse(4.5, 6, 1.6, 1, o[1]);
    p.ellipse(11.5, 6, 3.5, 2.6, o[3]); p.ellipse(11.5, 6, 1.6, 1, o[1]);
    p.rect(7, 5, 3, 3, o[4]); p.set(7, 5, o[5]);
    for (let i = 0; i < 6; i++) { p.set(7 - Math.round(i * 0.6), 8 + i, o[3]); p.set(8 - Math.round(i * 0.6), 8 + i, o[4]); p.set(9 + Math.round(i * 0.6), 8 + i, o[2]); p.set(10 + Math.round(i * 0.6), 8 + i, o[3]); }
    p.set(2, 5, o[5]); p.set(3, 4, o[5]);
  },
  'bead': p => {
    for (let k = 0; k < 7; k++) { const a = Math.PI + (k / 6) * Math.PI; p.set(Math.round(8 + Math.cos(a) * 6), Math.round(10 + Math.sin(a) * 5), R.straw[2]); }
    p.ellipse(8, 10, 3, 3, R.cornflower[3]); p.ellipse(7, 9, 1.4, 1.4, R.cornflower[4]); p.set(7, 9, 0xffffff);
    p.ellipse(3, 8, 1.4, 1.4, R.gold[3]); p.ellipse(13, 8, 1.4, 1.4, R.gold[3]);
  },
  'map': p => {
    for (let y = 3; y < 14; y++) for (let x = 2; x < 14; x++) {
      const fold = Math.floor((x - 2) / 4);
      p.set(x, y + (fold % 2 ? 1 : 0), fold % 2 ? R.linen[3] : R.linen[4]);
    }
    p.line(3, 11, 6, 8, R.red[3]); p.line(6, 8, 10, 10, R.red[3]); p.line(10, 10, 12, 6, R.red[3]);
    p.set(12, 5, R.red[2]); p.set(11, 5, R.red[2]); p.set(12, 6, R.red[2]);
    p.set(4, 5, R.green[3]); p.set(5, 5, R.green[3]); p.set(9, 5, R.blue[3]); p.set(9, 6, R.blue[3]);
  },
  'key': p => {
    p.ellipse(5, 6, 3.5, 3.5, R.gold[3]); p.ellipse(5, 6, 1.6, 1.6, 0); p.set(5, 6, 0);
    for (let x = 4; x < 9; x++) p.clear(5, 6);
    p.clear(4, 6); p.clear(5, 5); p.clear(6, 6); p.clear(5, 7);
    for (let i = 0; i < 8; i++) { p.set(7 + i, 8 + Math.round(i * 0.5), R.gold[3]); p.set(7 + i, 7 + Math.round(i * 0.5), R.gold[4]); }
    p.set(12, 11, R.gold[3]); p.set(12, 12, R.gold[2]); p.set(14, 12, R.gold[3]); p.set(14, 13, R.gold[2]);
    p.set(3, 4, R.gold[5]);
  },
  'stone': p => {
    for (let y = 4; y < 14; y++) for (let x = 2; x < 14; x++) {
      const nx = (x + 0.5 - 8) / 6, ny = (y + 0.5 - 9.5) / 4.5;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      const l = -nx * 0.6 - ny * 0.7 + Math.sqrt(1 - d) * 0.5;
      p.set(x, y, R.stone[l > 0.55 ? 5 : l > 0.2 ? 4 : l > -0.2 ? 3 : 2]);
    }
    p.set(9, 9, R.stone[1]); p.set(10, 10, R.stone[1]);
  },
  'twig': p => {
    p.line(2, 13, 13, 3, R.wood[3]); p.line(3, 13, 14, 3, R.wood[2]);
    p.line(8, 8, 6, 4, R.wood[3]); p.line(10, 6, 13, 7, R.wood[3]);
    p.set(5, 3, R.green[4]); p.set(6, 3, R.green[3]); p.set(14, 7, R.green[4]);
  },
  'rope': p => {
    for (let k = 0; k < 3; k++) {
      for (let a = 0; a < 40; a++) {
        const t = (a / 40) * Math.PI * 2;
        p.set(Math.round(8 + Math.cos(t) * (5 - k * 1.5)), Math.round(9 + Math.sin(t) * (3.5 - k)), (a + k * 3) % 4 < 2 ? R.straw[3] : R.straw[2]);
      }
    }
    p.line(12, 9, 14, 13, R.straw[3]); p.set(14, 14, R.straw[4]);
  },
  'letter': p => {
    for (let y = 4; y < 13; y++) for (let x = 1; x < 15; x++) p.set(x, y, R.cream[4]);
    for (let i = 0; i < 7; i++) { p.set(1 + i, 4 + Math.round(i * 0.6), R.cream[2]); p.set(14 - i, 4 + Math.round(i * 0.6), R.cream[2]); }
    for (let x = 1; x < 15; x++) p.set(x, 12, R.cream[3]);
    p.ellipse(8, 9, 1.8, 1.8, R.red[3]); p.set(7, 8, R.red[4]);
  },
  'bag': p => {
    p.poly([[3, 6], [13, 6], [14, 14], [2, 14]], R.leather[3]);
    for (let y = 6; y < 14; y++) p.set(3, y, R.leather[4]);
    p.poly([[3, 6], [13, 6], [12, 10], [4, 10]], R.leather[4]);
    for (let x = 4; x < 13; x++) p.set(x, 10, R.leather[1]);
    p.set(8, 10, R.gold[4]); p.set(8, 11, R.gold[2]);
    for (let x = 4; x < 13; x++) p.set(x, 3 + Math.round(((x - 8) ** 2) / 6) , R.leather[2]);
  },
  'menu': p => {
    for (const y of [4, 8, 12]) { for (let x = 3; x < 13; x++) { p.set(x, y, R.gold[4]); p.set(x, y + 1, R.gold[2]); } }
  },
  'hourglass': p => {
    for (let x = 3; x < 13; x++) { p.set(x, 1, R.wood[4]); p.set(x, 2, R.wood[2]); p.set(x, 13, R.wood[4]); p.set(x, 14, R.wood[2]); }
    for (let y = 3; y < 13; y++) {
      const half = Math.max(1, Math.round(Math.abs(y - 7.5) * 0.9));
      for (let x = 8 - half; x < 8 + half; x++) p.set(x, y, R.sky[5]);
    }
    for (let y = 9; y < 13; y++) { const half = Math.max(1, Math.round(Math.abs(y - 7.5) * 0.9)) - 1; for (let x = 8 - half; x < 8 + half; x++) p.set(x, y, R.sand[3]); }
    for (let y = 4; y < 6; y++) { const half = Math.round(Math.abs(y - 7.5) * 0.9) - 1; for (let x = 8 - half; x < 8 + half; x++) p.set(x, y, R.sand[3]); }
    p.set(7, 7, R.sand[4]); p.set(7, 8, R.sand[3]);
    for (let y = 3; y < 13; y++) { p.set(3, y, R.wood[3]); p.set(12, y, R.wood[1]); }
  },
  'sword': p => {
    for (let i = 0; i < 9; i++) { p.set(5 + i, 10 - i, R.steel[6]); p.set(6 + i, 10 - i, R.steel[4]); p.set(6 + i, 11 - i, R.steel[3]); }
    for (let i = -2; i <= 2; i++) p.set(5 + i, 11 + i, R.gold[i < 0 ? 4 : 3]);
    p.set(3, 13, R.leather[3]); p.set(2, 14, R.gold[4]); p.set(4, 12, R.leather[4]);
  },
  'bow': p => {
    for (let y = 1; y < 15; y++) { const x = 4 + Math.round(Math.sin(((y - 1) / 13) * Math.PI) * 5); p.set(x, y, R.wood[4]); p.set(x + 1, y, R.wood[2]); }
    for (let y = 2; y < 14; y++) p.set(4, y, R.cream[4]);
    for (let x = 4; x < 14; x++) p.set(x, 8, R.wood[3]);
    p.set(14, 8, R.steel[5]); p.set(13, 7, R.steel[4]); p.set(13, 9, R.steel[4]); p.set(5, 7, R.red[3]); p.set(5, 9, R.red[3]);
  },
  'shield': p => {
    p.poly([[3, 2], [13, 2], [13, 8], [8, 14], [3, 8]], R.blue[3]);
    p.poly([[3, 2], [8, 2], [8, 14], [3, 8]], R.blue[4]);
    for (let y = 2; y < 14; y++) p.set(8, y, R.gold[3]);
    for (let x = 3; x < 14; x++) p.set(x, 5, R.gold[3]);
    for (let x = 3; x < 14; x++) p.set(x, 2, R.steel[5]);
  },
  'beam': p => {
    for (let x = 1; x < 15; x++) for (let y = 6; y < 10; y++) { const core = y === 7 || y === 8; p.set(x, y, core ? R.urmacht[5] : R.urmacht[3]); }
    p.ellipse(3, 8, 3, 3, R.urmacht[4]); p.ellipse(3, 8, 1.5, 1.5, 0xffffff);
    for (let x = 4; x < 15; x += 3) { p.set(x, 5, R.urmacht[4]); p.set(x + 1, 10, R.urmacht[4]); }
  },
  'shockwave': p => {
    for (const [r, c] of [[6.5, R.urmacht[3]], [4.5, R.urmacht[4]], [2.2, R.urmacht[5]]] as const) for (let a = 0; a < 64; a++) { const t = (a / 64) * Math.PI * 2; p.set(Math.round(8 + Math.cos(t) * r), Math.round(8 + Math.sin(t) * r), c); }
    p.set(8, 8, 0xffffff);
  },
  'ward': p => {
    for (let y = 1; y < 15; y++) for (let x = 2; x < 14; x++) {
      const nx = (x + 0.5 - 8) / 6, ny = (y + 0.5 - 8) / 7;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      p.set(x, y, d > 0.7 ? R.urmacht[4] : mix(R.urmacht[2], 0x0c1a24, 0.35));
    }
    star(p, 8, 8, 3, R.urmacht[5], 0xffffff);
  },
  'dodge': p => {
    // swift figure with motion lines
    for (const y of [5, 8, 11]) for (let x = 1; x < 6; x++) if ((x + y) % 2) p.set(x, y, R.sky[4]);
    p.ellipse(10, 4, 2, 2, R.skin[4]);
    p.line(10, 6, 8, 10, R.green[3]); p.line(9, 6, 7, 10, R.green[4]);
    p.line(8, 10, 5, 13, R.leather[3]); p.line(8, 10, 12, 13, R.leather[3]);
    p.line(9, 7, 13, 6, R.green[3]); p.line(8, 7, 5, 8, R.green[3]);
  },
  'distract': p => {
    // pebble arcing toward a "?" mark
    for (let i = 0; i < 9; i++) p.set(2 + i, Math.round(12 - Math.sin((i / 8) * Math.PI) * 7), i % 2 ? R.sky[4] : R.sky[3]);
    p.ellipse(12, 12, 1.8, 1.4, R.stone[4]);
    p.set(12, 2, R.yellow[4]); p.set(13, 2, R.yellow[4]); p.set(14, 3, R.yellow[4]); p.set(13, 4, R.yellow[4]); p.set(13, 5, R.yellow[3]); p.set(13, 7, R.yellow[4]);
  },
  'throw': p => {
    // stone flying along a dotted arc
    for (let i = 0; i < 9; i++) if (i % 2 === 0) p.set(1 + i, Math.round(14 - Math.sin((i / 12) * Math.PI) * 9), R.sky[4]);
    p.ellipse(11.5, 5.5, 3, 2.6, R.stone[3]); p.ellipse(10.8, 4.8, 1.6, 1.2, R.stone[5]); p.set(13, 7, R.stone[1]);
    p.set(14, 2, R.sky[4]); p.set(15, 4, R.sky[4]);
  },
  'urmacht': p => {
    for (let r = 7; r > 0; r--) p.ellipse(8, 8, r, r, mix(0x0c3040, R.urmacht[r < 3 ? 5 : r < 5 ? 4 : 2], r < 6 ? 1 : 0.5));
    star(p, 8, 8, 6, R.urmacht[4], 0xffffff);
    p.set(8, 8, 0xffffff);
  },
  'heart': p => {
    p.ellipse(5.5, 6, 3.2, 3, R.red[3]); p.ellipse(10.5, 6, 3.2, 3, R.red[3]);
    p.poly([[2.5, 7], [13.5, 7], [8, 14]], R.red[3]);
    p.ellipse(5, 5, 1.5, 1.2, R.red[5]); p.set(4, 5, 0xffffff);
    for (let i = 0; i < 4; i++) p.set(10 + i, 9 - i + 2, R.red[2]);
  },
  'eye': p => {
    for (let x = 1; x < 15; x++) { const h = Math.round(Math.sin(((x - 1) / 13) * Math.PI) * 4); for (let y = 8 - h; y <= 8 + h; y++) p.set(x, y, R.cream[5]); p.set(x, 8 - h - 1, R.ink[2]); p.set(x, 8 + h + 1, R.ink[1]); }
    p.ellipse(8, 8, 3, 3, R.urmacht[3]); p.ellipse(8, 8, 1.5, 1.5, 0x0a0a10); p.set(7, 7, 0xffffff); p.set(6, 6, 0xffffff);
  },
};

export const ICON_IDS = Object.keys(ICONS);

const cache = new Map<string, Px>();
export function iconPx(id: string): Px {
  let p = cache.get(id);
  if (p) return p;
  p = new Px(16, 16);
  (ICONS[id] ?? ICONS.stone)(p);
  p.outline({ amount: 0.9 });
  cache.set(id, p);
  return p;
}

const urls = new Map<string, string>();
export function iconDataUrl(id: string): string {
  let u = urls.get(id);
  if (!u) { u = iconPx(id).toCanvas().toDataURL('image/png'); urls.set(id, u); }
  return u;
}
