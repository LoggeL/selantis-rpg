import { RAMPS } from './palette';
import { Px } from './px';

/** Particle / effect textures. Pixel ones are crisp; light glows are smooth radial gradients. */

export const FX_KEYS = [
  'fx-dot', 'fx-dot-soft', 'fx-spark', 'fx-ember', 'fx-smoke', 'fx-leaf', 'fx-petal', 'fx-raindrop', 'fx-splash',
  'fx-glow', 'fx-firefly', 'fx-urmacht', 'fx-dust', 'fx-ring', 'fx-star', 'fx-arrow',
  // art extensions
  'fx-shadow', 'fx-hit', 'fx-beam', 'fx-violet', 'fx-bolt', 'fx-light-warm', 'fx-light-cool',
];

function radial(size: number, stops: [number, string][]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) grad.addColorStop(o, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

/** Pixel glow: concentric dithered alpha rings around a bright core. */
function pixelGlow(size: number, core: number, mid: number, a = 1): Px {
  const p = new Px(size, size);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot(x - c, y - c) / (size / 2);
    if (d > 1) continue;
    if (d < 0.25) p.set(x, y, 0xffffff, Math.round(255 * a));
    else if (d < 0.5) p.set(x, y, core, Math.round(230 * a));
    else if (d < 0.8) p.set(x, y, mid, Math.round(120 * a));
    else p.set(x, y, mid, Math.round(45 * a));
  }
  return p;
}

export function makeFx(key: string): HTMLCanvasElement {
  switch (key) {
    case 'fx-dot': { const p = new Px(2, 2); p.rect(0, 0, 2, 2, 0xffffff); return p.toCanvas(); }
    case 'fx-dot-soft': return pixelGlow(5, 0xffffff, 0xffffff).toCanvas();
    case 'fx-spark': {
      const p = new Px(7, 7);
      for (let i = 0; i < 7; i++) { const a = Math.abs(i - 3) < 2 ? 255 : 150; p.set(3, i, i === 3 ? 0xffffff : 0xfff2a8, a); p.set(i, 3, i === 3 ? 0xffffff : 0xfff2a8, a); }
      p.set(2, 2, 0xfff2a8, 120); p.set(4, 4, 0xfff2a8, 120); p.set(2, 4, 0xfff2a8, 120); p.set(4, 2, 0xfff2a8, 120);
      return p.toCanvas();
    }
    case 'fx-ember': { const p = new Px(3, 3); p.set(1, 1, RAMPS.fire[4]); p.set(0, 1, RAMPS.fire[2], 200); p.set(2, 1, RAMPS.fire[2], 200); p.set(1, 0, RAMPS.fire[3], 200); p.set(1, 2, RAMPS.fire[1], 200); return p.toCanvas(); }
    case 'fx-smoke': {
      const p = new Px(16, 16);
      const blobs = [[8, 9, 6], [5, 7, 4], [11, 6, 4], [8, 5, 4]];
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        let best = 0;
        for (const [bx, by, r] of blobs) best = Math.max(best, 1 - Math.hypot(x + 0.5 - bx, y + 0.5 - by) / r);
        if (best <= 0) continue;
        const lit = x + y < 15;
        p.set(x, y, lit ? 0xd8d4d0 : 0x9a9490, Math.round(Math.min(1, best * 1.6) * 170));
      }
      return p.toCanvas();
    }
    case 'fx-leaf': {
      const p = new Px(6, 4);
      p.set(1, 1, RAMPS.olive[4]); p.set(2, 1, RAMPS.olive[4]); p.set(3, 1, RAMPS.olive[3]); p.set(2, 2, RAMPS.olive[3]); p.set(3, 2, RAMPS.olive[2]); p.set(4, 2, RAMPS.olive[2]);
      p.set(0, 0, RAMPS.wood[3]); p.set(5, 3, RAMPS.olive[1]);
      return p.toCanvas();
    }
    case 'fx-petal': { const p = new Px(4, 3); p.set(1, 0, RAMPS.pink[4]); p.set(0, 1, RAMPS.pink[3]); p.set(1, 1, RAMPS.pink[4]); p.set(2, 1, RAMPS.pink[3]); p.set(2, 2, RAMPS.pink[2]); p.set(3, 2, RAMPS.pink[2]); return p.toCanvas(); }
    case 'fx-raindrop': { const p = new Px(1, 7); for (let y = 0; y < 7; y++) p.set(0, y, y > 4 ? 0xe4faff : 0xa6d8e6, 60 + y * 25); return p.toCanvas(); }
    case 'fx-splash': {
      const p = new Px(9, 5);
      for (const [x, y, a] of [[0, 3, 160], [1, 2, 220], [2, 1, 200], [4, 0, 220], [6, 1, 200], [7, 2, 220], [8, 3, 160], [3, 4, 120], [5, 4, 120]] as const) p.set(x, y, 0xe4faff, a);
      return p.toCanvas();
    }
    case 'fx-glow': return radial(64, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.55)'], [0.6, 'rgba(255,255,255,0.15)'], [1, 'rgba(255,255,255,0)']]);
    case 'fx-light-warm': return radial(128, [[0, 'rgba(255,214,140,0.9)'], [0.35, 'rgba(255,170,80,0.35)'], [1, 'rgba(255,140,60,0)']]);
    case 'fx-light-cool': return radial(128, [[0, 'rgba(200,220,255,0.8)'], [0.35, 'rgba(150,180,255,0.3)'], [1, 'rgba(120,150,255,0)']]);
    case 'fx-firefly': return pixelGlow(7, 0xf6f4a0, 0xd8f070).toCanvas();
    case 'fx-urmacht': return pixelGlow(9, RAMPS.urmacht[4], RAMPS.urmacht[3]).toCanvas();
    case 'fx-violet': return pixelGlow(9, RAMPS.violet[4], RAMPS.violet[3]).toCanvas();
    case 'fx-dust': {
      const p = new Px(7, 7);
      for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
        const d = Math.hypot(x - 3, y - 3.4) / 3.5;
        if (d > 1) continue;
        p.set(x, y, x + y < 6 ? RAMPS.sand[4] : RAMPS.sand[2], Math.round((1 - d) * 210));
      }
      return p.toCanvas();
    }
    case 'fx-ring': {
      const p = new Px(32, 32);
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        const d = Math.hypot(x - 15.5, y - 15.5);
        if (d > 15.5 || d < 11.5) continue;
        const a = d > 14.5 ? 120 : d > 13.5 ? 255 : 160;
        p.set(x, y, d > 13 && d < 14.5 ? 0xffffff : 0xd8f0ff, a);
      }
      return p.toCanvas();
    }
    case 'fx-star': {
      const p = new Px(7, 7);
      p.set(3, 0, 0xffffff, 140); p.set(3, 6, 0xffffff, 140); p.set(0, 3, 0xffffff, 140); p.set(6, 3, 0xffffff, 140);
      for (const [x, y] of [[3, 1], [3, 5], [1, 3], [5, 3], [3, 2], [3, 4], [2, 3], [4, 3]] as const) p.set(x, y, 0xffffff, 230);
      p.set(3, 3, 0xffffff);
      return p.toCanvas();
    }
    case 'fx-arrow': {
      const p = new Px(12, 3);
      for (let x = 2; x < 10; x++) p.set(x, 1, RAMPS.wood[3]);
      p.set(10, 1, RAMPS.steel[5]); p.set(11, 1, RAMPS.steel[6]); p.set(10, 0, RAMPS.steel[4]); p.set(10, 2, RAMPS.steel[3]);
      p.set(0, 0, RAMPS.cream[4]); p.set(1, 0, RAMPS.red[3]); p.set(0, 2, RAMPS.cream[3]); p.set(1, 2, RAMPS.red[2]); p.set(1, 1, RAMPS.cream[4]);
      return p.toCanvas();
    }
    case 'fx-bolt': {
      const p = new Px(9, 3);
      for (let x = 1; x < 7; x++) p.set(x, 1, RAMPS.wood[2]);
      p.set(7, 1, RAMPS.iron[4]); p.set(8, 1, RAMPS.steel[5]); p.set(0, 0, RAMPS.black[3]); p.set(0, 2, RAMPS.black[3]);
      return p.toCanvas();
    }
    case 'fx-shadow': {
      const p = new Px(16, 6);
      for (let y = 0; y < 6; y++) for (let x = 0; x < 16; x++) {
        const d = ((x + 0.5 - 8) / 8) ** 2 + ((y + 0.5 - 3) / 3) ** 2;
        if (d <= 1) p.set(x, y, 0x14101c, d > 0.55 ? 55 : 95);
      }
      return p.toCanvas();
    }
    case 'fx-hit': {
      const p = new Px(16, 16);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + 0.2, len = k % 2 ? 5 : 7;
        for (let i = 2; i <= len; i++) p.set(Math.round(7.5 + Math.cos(a) * i), Math.round(7.5 + Math.sin(a) * i), i < 4 ? 0xffffff : 0xfff2a8, i > len - 1 ? 150 : 255);
      }
      p.set(7, 7, 0xffffff); p.set(8, 8, 0xffffff); p.set(7, 8, 0xffffff); p.set(8, 7, 0xffffff);
      return p.toCanvas();
    }
    case 'fx-beam': {
      const p = new Px(16, 9);
      for (let x = 0; x < 16; x++) for (let y = 0; y < 9; y++) {
        const d = Math.abs(y - 4);
        const wob = (x + y) % 4 === 0 ? 1 : 0;
        if (d > 4 - wob) continue;
        p.set(x, y, d === 0 ? 0xffffff : d === 1 ? RAMPS.urmacht[5] : d === 2 ? RAMPS.urmacht[4] : RAMPS.urmacht[3], d > 2 ? 140 : 255);
      }
      return p.toCanvas();
    }
  }
  const p = new Px(4, 4); p.rect(0, 0, 4, 4, 0xffffff); return p.toCanvas();
}
