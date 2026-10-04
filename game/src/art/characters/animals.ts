import type { Dir } from '../../core/types';
import { RAMPS, mix } from '../palette';
import { Px } from '../px';

type R = readonly number[];

interface AnimalDef {
  w: number; h: number;
  idleFrames: number; idleFps: number; walkFps: number; runFps: number;
  draw(p: Px, anim: 'idle' | 'walk' | 'run', f: number, dir: 'down' | 'up' | 'right', L: boolean): void;
}

interface Quad {
  bodyLen: number; bodyH: number; legLen: number; legW: number;
  head: number; neck: number; snout: number;
  fur: R; belly?: R; mane?: R; hoof?: number;
  ears: 'floppy' | 'pointy' | 'long' | 'horse' | 'pig';
  tail: 'wag' | 'curl' | 'horse' | 'puff' | 'short';
  antlers?: boolean; spots?: boolean;
}

const sh = (r: R, i: number) => r[Math.max(0, Math.min(r.length - 1, i))];

/** Generic quadruped: side view with a 4-beat gait, plus compact front/back views. */
function quad(q: Quad, w: number, h: number): AnimalDef['draw'] {
  return (p, anim, f, dir, L) => {
    const ground = h - 1;
    const n = anim === 'idle' ? 4 : 6;
    const ph = (f / n) * Math.PI * 2;
    const run = anim === 'run';
    const bob = anim === 'idle' ? (f >= 2 ? 1 : 0) : run ? Math.round(Math.sin(ph * 2) * 1) : (f % 3 === 0 ? 1 : 0);
    const r = q.fur, b = q.belly ?? q.fur;
    const legTop = ground - q.legLen;
    const by = legTop - Math.floor(q.bodyH / 2) + 1 + bob;
    if (dir === 'right') {
      const cx = Math.floor(w / 2) - 1;
      const rx = q.bodyLen / 2, ry = q.bodyH / 2;
      const legs: [number, number, boolean][] = [
        [cx - rx * 0.55, 0, false], [cx + rx * 0.6, Math.PI, false],
        [cx - rx * 0.55, Math.PI, true], [cx + rx * 0.6, 0, true],
      ];
      const stride = anim === 'idle' ? 0 : run ? 3 : 2;
      const drawLeg = (hx: number, off: number, near: boolean) => {
        const a = ph + off;
        const fx = Math.round(hx + Math.sin(a) * stride);
        const lift = anim === 'idle' ? 0 : Math.max(0, Math.cos(a)) * (run ? 2 : 1);
        const fy = ground - Math.round(lift);
        const kx = Math.round((hx + fx) / 2 + (lift > 0 ? 1 : 0));
        const ky = Math.round((legTop + bob + fy) / 2);
        const c0 = near ? sh(r, 3) : sh(r, 1);
        for (let k = 0; k < q.legW; k++) {
          lineP(p, Math.round(hx) + k, legTop + bob, kx + k, ky, c0);
          lineP(p, kx + k, ky, fx + k, fy, c0);
        }
        if (q.hoof !== undefined) for (let k = 0; k < q.legW; k++) p.set(fx + k, fy, near ? q.hoof : mix(q.hoof, 0, 0.3));
      };
      for (const [hx, off, near] of legs) if (!near) drawLeg(hx, off, near);
      // tail
      const tx = Math.round(cx - rx), ty = by - Math.round(ry * 0.4);
      const wag = Math.round(Math.sin(ph * (anim === 'idle' ? 1 : 2)) * 1.5);
      if (q.tail === 'wag') { for (let i = 0; i < 4; i++) p.set(tx - i, ty - i + (i > 1 ? wag : 0), sh(r, 3)); }
      else if (q.tail === 'horse') { const tc = q.mane ?? r; for (let i = 0; i < 8; i++) { p.set(tx - 1 - (i > 3 ? 1 : 0) + (i > 5 ? wag : 0), ty + i, sh(tc, i % 2 ? 2 : 3)); p.set(tx - (i > 3 ? 1 : 0), ty + i, sh(tc, 2)); } }
      else if (q.tail === 'curl') { p.set(tx - 1, ty, sh(r, 3)); p.set(tx - 2, ty - 1, sh(r, 3)); p.set(tx - 1, ty - 2, sh(r, 4)); }
      else if (q.tail === 'puff') { p.set(tx - 1, ty, 0xf4f0e8); p.set(tx - 1, ty - 1, 0xffffff); }
      else p.set(tx - 1, ty, sh(r, 2));
      // body
      for (let y = Math.floor(by - ry); y <= Math.ceil(by + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - by) / ry;
        if (nx * nx + ny * ny > 1) continue;
        let i = ny < -0.45 ? 4 : ny > 0.45 ? 2 : 3;
        if (ny > 0.25 && q.belly) { p.set(x, y, sh(b, ny > 0.6 ? 2 : 3)); continue; }
        if (q.spots && (x * 7 + y * 3) % 11 === 0 && ny < 0.3) i = 5;
        p.set(x, y, sh(r, i));
      }
      for (const [hx, off, near] of legs) if (near) drawLeg(hx, off, near);
      // neck + head
      const nx0 = Math.round(cx + rx * 0.7), ny0 = Math.round(by - ry * 0.3);
      const hx = nx0 + Math.round(q.neck * 0.6), hy = ny0 - q.neck + (anim === 'idle' && f === 3 ? 1 : 0);
      for (let i = 0; i <= q.neck; i++) {
        const t = i / Math.max(1, q.neck);
        const x = Math.round(nx0 + (hx - nx0) * t), y = Math.round(ny0 + (hy - ny0) * t);
        for (let k = -1; k <= 1; k++) p.set(x + k, y, sh(r, k < 0 ? 4 : 3));
        if (q.mane) { p.set(x - 2, y, sh(q.mane, 3)); p.set(x - 1, y - 1, sh(q.mane, 4)); }
      }
      const hr = q.head / 2;
      p.ellipse(hx, hy, hr, hr * 0.85, sh(r, 3));
      p.ellipse(hx - 0.5, hy - 0.5, hr * 0.6, hr * 0.5, sh(r, 4));
      // snout
      for (let i = 1; i <= q.snout; i++) for (let k = 0; k < Math.max(2, Math.round(hr)); k++) p.set(Math.round(hx + hr - 1 + i), Math.round(hy + k - 0.5), sh(r, k === 0 ? 4 : 3));
      p.set(Math.round(hx + hr - 1 + q.snout), Math.round(hy - 0.5), q.ears === 'pig' ? RAMPS.pink[2] : 0x1a1214);
      // eye
      p.set(Math.round(hx + 0.5), Math.round(hy - 1), 0x120c10);
      // ears
      const ex = Math.round(hx - hr * 0.3), ey = Math.round(hy - hr);
      if (q.ears === 'floppy') { p.set(ex, ey + 1, sh(r, 1)); p.set(ex - 1, ey + 2, sh(r, 1)); p.set(ex, ey + 2, sh(r, 2)); }
      if (q.ears === 'pointy') { p.set(ex, ey, sh(r, 3)); p.set(ex, ey - 1, sh(r, 2)); p.set(ex + 1, ey, sh(r, 2)); }
      if (q.ears === 'long') { for (let i = 0; i < 4; i++) { p.set(ex - Math.floor(i / 2), ey - i, sh(r, 3)); p.set(ex + 1 - Math.floor(i / 2), ey - i, sh(r, 4)); } }
      if (q.ears === 'horse') { p.set(ex, ey, sh(r, 3)); p.set(ex, ey - 1, sh(r, 2)); }
      if (q.ears === 'pig') { p.set(ex, ey, RAMPS.pink[2]); p.set(ex + 1, ey, RAMPS.pink[3]); }
      if (q.antlers) {
        const ax = ex, ay = ey - 1;
        const tine = (dx: number, dy: number, c: number) => p.set(ax + dx, ay + dy, c);
        const ac = RAMPS.straw[3], ad = RAMPS.straw[1];
        for (let i = 0; i < 6; i++) { tine(-Math.floor(i / 2), -i, ac); }
        tine(-1, -3, ad); tine(-2, -4, ac); tine(-4, -5, ac); tine(1, -2, ac); tine(2, -3, ac); tine(-3, -6, ad);
      }
      return;
    }
    // front / back views
    const cx = Math.floor(w / 2);
    const brx = Math.max(3, q.bodyH / 2 + 1), bry = q.bodyH / 2;
    const step = anim === 'idle' ? 0 : 1;
    const liftA = step && Math.sin(ph) > 0 ? (run ? 2 : 1) : 0, liftB = step && Math.sin(ph) < 0 ? (run ? 2 : 1) : 0;
    const legX = [cx - Math.round(brx * 0.6) - 1, cx + Math.round(brx * 0.6) - q.legW + 1];
    const lifts = [liftA, liftB];
    // back legs (slightly inside)
    legX.forEach((lx, i) => { for (let y = legTop + bob; y <= ground - lifts[1 - i]; y++) for (let k = 0; k < q.legW; k++) p.set(lx + (i ? -1 : 1) + k, y, sh(r, 1)); });
    for (let y = Math.floor(by - bry); y <= Math.ceil(by + bry); y++) for (let x = Math.floor(cx - brx); x <= Math.ceil(cx + brx); x++) {
      const nx = (x + 0.5 - cx) / brx, ny = (y + 0.5 - by) / bry;
      if (nx * nx + ny * ny > 1) continue;
      const lit = L ? nx < -0.3 : nx > 0.3;
      p.set(x, y, sh(r, lit ? 4 : nx > 0.4 || nx < -0.4 ? 2 : 3));
    }
    legX.forEach((lx, i) => { for (let y = legTop + bob; y <= ground - lifts[i]; y++) for (let k = 0; k < q.legW; k++) p.set(lx + k, y, sh(r, k === 0 ? 4 : 3)); if (q.hoof !== undefined) for (let k = 0; k < q.legW; k++) p.set(lx + k, ground - lifts[i], q.hoof); });
    if (dir === 'down') {
      const hy = by - bry + 1 - Math.round(q.neck * 0.5);
      const hr = q.head / 2;
      if (q.mane) for (let y = hy - 1; y < by; y++) p.set(cx, y, sh(q.mane, 3));
      p.ellipse(cx, hy, hr, hr, sh(r, 3));
      p.ellipse(cx - 0.5, hy - 0.5, hr * 0.6, hr * 0.6, sh(r, 4));
      // muzzle
      p.ellipse(cx, hy + hr * 0.7, Math.max(1.2, hr * 0.5), Math.max(1, hr * 0.45), q.ears === 'pig' ? RAMPS.pink[3] : sh(q.belly ?? r, 4));
      p.set(Math.round(cx - hr * 0.45), Math.round(hy - 0.5), 0x120c10); p.set(Math.round(cx + hr * 0.45) - 1, Math.round(hy - 0.5), 0x120c10);
      p.set(cx - 1, Math.round(hy + hr * 0.8), 0x1a1214);
      const ey = Math.round(hy - hr);
      if (q.ears === 'floppy') { p.set(Math.round(cx - hr) - 1, ey + 2, sh(r, 1)); p.set(Math.round(cx + hr), ey + 2, sh(r, 1)); }
      if (q.ears === 'pointy' || q.ears === 'horse' || q.ears === 'pig') { p.set(Math.round(cx - hr), ey, sh(r, 3)); p.set(Math.round(cx + hr) - 1, ey, sh(r, 2)); }
      if (q.ears === 'long') for (let i = 0; i < 4; i++) { p.set(cx - 2, ey - i, sh(r, 3)); p.set(cx + 1, ey - i, sh(r, 2)); }
      if (q.antlers) for (let i = 0; i < 5; i++) { p.set(cx - 2 - Math.floor(i / 2), ey - i, RAMPS.straw[3]); p.set(cx + 1 + Math.floor(i / 2), ey - i, RAMPS.straw[2]); }
    } else {
      // rump + tail
      const ty = by - Math.round(bry * 0.3);
      if (q.tail === 'horse') for (let i = 0; i < 7; i++) { p.set(cx, ty + i, sh(q.mane ?? r, 2)); p.set(cx - 1, ty + i, sh(q.mane ?? r, 3)); }
      else if (q.tail === 'puff') { p.set(cx, ty, 0xffffff); p.set(cx - 1, ty, 0xf0ece4); }
      else if (q.tail === 'wag') { const wag = Math.round(Math.sin(ph * 2)); for (let i = 0; i < 4; i++) p.set(cx + wag * Math.floor(i / 2), ty - 2 - i, sh(r, 3)); }
      else p.set(cx, ty, sh(r, 2));
      const hy = by - bry - 1;
      p.ellipse(cx, hy, q.head / 2 - 0.5, q.head / 2 - 1, sh(r, 2));
      if (q.ears === 'long') for (let i = 0; i < 4; i++) { p.set(cx - 2, hy - 2 - i, sh(r, 3)); p.set(cx + 1, hy - 2 - i, sh(r, 2)); }
      if (q.antlers) for (let i = 0; i < 5; i++) { p.set(cx - 2 - Math.floor(i / 2), hy - 3 - i, RAMPS.straw[3]); p.set(cx + 1 + Math.floor(i / 2), hy - 3 - i, RAMPS.straw[2]); }
    }
  };
}

function lineP(p: Px, x0: number, y0: number, x1: number, y1: number, c: number): void {
  p.line(x0, y0, x1, y1, c);
}

function bird(kind: 'chicken' | 'crow'): AnimalDef['draw'] {
  return (p, anim, f, dir) => {
    const chicken = kind === 'chicken';
    const body: R = chicken ? [0x8a8478, 0xb4ae9e, 0xdcd6c6, 0xf2eee2, 0xffffff, 0xffffff] : [0x08080c, 0x12121a, 0x1e1e2a, 0x2c2c3c, 0x40405a, 0x5a5a78];
    const w = p.w, ground = p.h - 1;
    const flying = !chicken && anim === 'run';
    const hop = anim === 'walk' ? (f % 3 === 0 ? -1 : 0) : 0;
    const peck = anim === 'idle' && f === 3 ? 2 : 0;
    const cy = ground - 4 + hop - (flying ? 3 + (f % 2) : 0);
    const cx = Math.floor(w / 2);
    if (dir === 'right') {
      p.ellipse(cx - 0.5, cy, 3.5, 2.6, body[3]);
      p.ellipse(cx - 1, cy - 0.8, 2.2, 1.4, body[4]);
      // tail
      p.set(cx - 4, cy - 1, body[2]); p.set(cx - 5, cy - 2, body[3]); if (chicken) p.set(cx - 4, cy - 3, body[3]);
      // head
      const hx = cx + 2, hy = cy - 3 + peck;
      p.ellipse(hx, hy, 1.6, 1.6, body[3]);
      p.set(hx + 1, hy - 1, 0x120c10);
      p.set(hx + 2, hy, chicken ? RAMPS.yellow[3] : RAMPS.ash[2]); p.set(hx + 3, hy, chicken ? RAMPS.yellow[2] : RAMPS.ash[1]);
      if (chicken) { p.set(hx, hy - 2, RAMPS.red[3]); p.set(hx + 1, hy - 2, RAMPS.red[4]); p.set(hx + 1, hy + 1, RAMPS.red[3]); }
      if (flying) {
        const up = f % 2 === 0;
        for (let i = 0; i < 4; i++) p.set(cx - 1 + i - 1, cy + (up ? -2 - i : 1 + Math.floor(i / 2)), body[up ? 4 : 2]);
      } else {
        p.set(cx - 2, cy - 1, body[2]); p.set(cx - 1, cy - 1, body[2]); // wing line
        const step = anim === 'walk' ? (f % 2) : 0;
        const leg = chicken ? RAMPS.yellow[2] : RAMPS.ash[2];
        p.set(cx - 1 + step, ground, leg); p.set(cx - 1, ground - 1, leg); p.set(cx + 1 - step, ground, leg); p.set(cx + 1, ground - 1, leg);
      }
    } else {
      p.ellipse(cx - 0.5, cy, 2.8, 2.8, body[3]);
      p.ellipse(cx - 1, cy - 1, 1.5, 1.5, body[4]);
      const hy = cy - 3 + (dir === 'down' ? peck : 0);
      p.ellipse(cx - 0.5, hy, 1.6, 1.6, body[3]);
      if (dir === 'down') { p.set(cx - 2, hy, 0x120c10); p.set(cx + 1, hy, 0x120c10); p.set(cx - 1, hy + 1, chicken ? RAMPS.yellow[3] : RAMPS.ash[2]); if (chicken) p.set(cx - 1, hy - 2, RAMPS.red[4]); }
      if (flying) { const up = f % 2 === 0; for (let i = 1; i < 5; i++) { p.set(cx - 2 - i, cy + (up ? -i : 1), body[4]); p.set(cx + 1 + i, cy + (up ? -i : 1), body[2]); } }
      else { const leg = chicken ? RAMPS.yellow[2] : RAMPS.ash[2]; p.set(cx - 2, ground, leg); p.set(cx + 1, ground, leg); p.set(cx - 2, ground - 1, leg); p.set(cx + 1, ground - 1, leg); }
    }
  };
}

const dogFur = [0x2a1a14, 0x4a2c1c, 0x6e4228, 0x925c34, 0xb47e4a, 0xd0a06a] as R;
const horseFur = [0x24140e, 0x3e2216, 0x5a3220, 0x78462a, 0x98603a, 0xb47e52] as R;
const pigFur = [0x8a4a52, 0xb4686e, 0xd88a8c, 0xeeaaa8, 0xf8c8c4, 0xffe0dc] as R;
const hareFur = [0x3a3028, 0x5c4c3e, 0x7e6a56, 0x9c8670, 0xbaa68c, 0xd8c8b0] as R;
const deerFur = [0x3a1e10, 0x5e3218, 0x804822, 0xa0602e, 0xbc7c42, 0xd49c62] as R;

export const ANIMALS: Record<string, AnimalDef> = {
  dog: { w: 24, h: 18, idleFrames: 4, idleFps: 4, walkFps: 10, runFps: 16, draw: quad({ bodyLen: 11, bodyH: 6, legLen: 5, legW: 1, head: 6, neck: 2, snout: 2, fur: dogFur, belly: RAMPS.sand, ears: 'floppy', tail: 'wag' }, 24, 18) },
  horse: { w: 40, h: 34, idleFrames: 4, idleFps: 3, walkFps: 8, runFps: 14, draw: quad({ bodyLen: 20, bodyH: 10, legLen: 11, legW: 2, head: 7, neck: 7, snout: 3, fur: horseFur, mane: RAMPS.coal, hoof: 0x1a1214, ears: 'horse', tail: 'horse' }, 40, 34) },
  pig: { w: 24, h: 16, idleFrames: 4, idleFps: 3, walkFps: 8, runFps: 14, draw: quad({ bodyLen: 13, bodyH: 8, legLen: 3, legW: 2, head: 6, neck: 0, snout: 2, fur: pigFur, ears: 'pig', tail: 'curl' }, 24, 16) },
  chicken: { w: 14, h: 14, idleFrames: 4, idleFps: 3, walkFps: 8, runFps: 12, draw: bird('chicken') },
  hare: { w: 18, h: 14, idleFrames: 4, idleFps: 3, walkFps: 9, runFps: 16, draw: quad({ bodyLen: 8, bodyH: 6, legLen: 3, legW: 1, head: 5, neck: 1, snout: 1, fur: hareFur, belly: RAMPS.cream, ears: 'long', tail: 'puff' }, 18, 14) },
  crow: { w: 16, h: 14, idleFrames: 4, idleFps: 3, walkFps: 8, runFps: 10, draw: bird('crow') },
  deer: { w: 34, h: 34, idleFrames: 4, idleFps: 3, walkFps: 8, runFps: 14, draw: quad({ bodyLen: 15, bodyH: 8, legLen: 11, legW: 1, head: 6, neck: 6, snout: 2, fur: deerFur, belly: RAMPS.cream, ears: 'pointy', tail: 'short', antlers: true, spots: false }, 34, 34) },
};

export function renderAnimalFrame(id: string, anim: 'idle' | 'walk' | 'run', f: number, dir: Dir): Px {
  const def = ANIMALS[id];
  const p = new Px(def.w, def.h);
  if (dir === 'left') {
    def.draw(p, anim, f, 'right', false);
    const out = p.flipped();
    out.outline({ amount: 0.9 });
    return out;
  }
  def.draw(p, anim, f, dir, true);
  p.outline({ amount: 0.9 });
  return p;
}
