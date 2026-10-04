import type Phaser from 'phaser';
import { mix, pal } from './palette';
import { Pix } from './pixels';
import { TH, TW } from './iso';

/** Small generated textures for overlays, cursor, facing arrows, status icons, projectiles. */
export function ensureTacticsTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('tac-ov-move')) return;
  const add = (key: string, p: Pix) => { if (!scene.textures.exists(key)) scene.textures.addCanvas(key, p.toCanvas()); };

  const diamond = (fill: number, edge: number, fa: number, ea: number, inset = 0) => {
    const p = new Pix(TW, TH);
    for (let y = 0; y < TH; y++) {
      const half = y < 8 ? (y + 1) * 2 : (16 - y) * 2;
      for (let x = 16 - half; x <= 15 + half; x++) {
        const edgeRow = y === 0 || y === TH - 1 || x === 16 - half || x === 15 + half || x === 16 - half + 1 || x === 14 + half;
        if (edgeRow) p.set(x, y, edge, ea);
        else if (inset && (x === 16 - half + 2 || x === 13 + half)) p.set(x, y, edge, ea * 0.4);
        else p.set(x, y, fill, fa);
      }
    }
    return p;
  };
  add('tac-ov-move', diamond(0x4f9cff, 0xbfe0ff, 0.34, 0.9, 1));
  add('tac-ov-move-dim', diamond(0x4f9cff, 0x8ebcff, 0.16, 0.45));
  add('tac-ov-act', diamond(0xe8b84a, 0xfff0b0, 0.3, 0.9, 1));
  add('tac-ov-danger', diamond(0xe0503a, 0xff9a80, 0.16, 0.6));
  add('tac-ov-aoe', diamond(0xff7a3a, 0xffe0a0, 0.5, 1, 1));
  add('tac-ov-magic', diamond(0x49e0c8, 0xd8fff6, 0.42, 1, 1));
  add('tac-ov-ally', diamond(0x6ad08a, 0xd8ffe0, 0.38, 1, 1));
  add('tac-ov-goal', diamond(0xd8b25a, 0xfff3c0, 0.22, 0.85, 1));
  add('tac-ov-hover', diamond(0xffffff, 0xffffff, 0.16, 0.0));

  // Cursor: gold corner brackets on the diamond outline.
  {
    const p = new Pix(TW + 4, TH + 4);
    const gold = 0xf3d27a, dark = pal('ink', 0);
    const pts: [number, number][] = [];
    for (let i = 0; i <= 16; i++) { pts.push([2 + i, 10 - Math.floor(i / 2)]); pts.push([2 + 16 + i, 2 + Math.floor(i / 2)]); }
    for (let i = 0; i <= 16; i++) { pts.push([2 + i, 10 + Math.floor(i / 2)]); pts.push([2 + 16 + i, 18 - Math.floor(i / 2)]); }
    for (const [x, y] of pts) {
      const cornerish = Math.min(Math.abs(x - 2), Math.abs(x - 34), Math.abs(x - 18)) < 6;
      if (!cornerish) continue;
      p.set(x, y + 1, dark, 0.8);
      p.set(x, y, gold);
    }
    add('tac-cursor', p);
  }
  // Pointer arrow (bobbing above the hovered tile/unit).
  {
    const p = new Pix(9, 9);
    for (let y = 0; y < 6; y++) for (let x = y; x < 9 - y; x++) p.set(x, y + 1, y === 0 ? 0xfff3c0 : x === y || x === 8 - y ? 0xb08020 : 0xf3d27a);
    p.outline(pal('ink', 0), 0.9);
    add('tac-pointer', p);
  }
  // Facing arrow, pointing screen down-right (flip for other diagonals).
  for (const [key, c] of [['tac-face-player', 0xf3e2b0], ['tac-face-enemy', 0xff8a6a], ['tac-face-ally', 0x9ae8b0]] as const) {
    const p = new Pix(12, 8);
    // simple chevron: an iso-flattened triangle
    const tri: [number, number][] = [[2, 1], [10, 4], [3, 7]];
    for (let y = 0; y < 8; y++) for (let x = 0; x < 12; x++) {
      const [a, b, d] = tri;
      const s = (p1: number[], p2: number[], p3: number[]) => (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
      const pt = [x + 0.5, y + 0.5];
      const d1 = s(pt, a, b), d2 = s(pt, b, d), d3 = s(pt, d, a);
      const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
      if (!(neg && pos)) p.set(x, y, y < 4 ? c : mix(c, 0x000000, 0.25));
    }
    p.outline(pal('ink', 0), 0.85);
    add(key, p);
  }
  // Team rings under units (iso ellipse outline).
  for (const [key, c] of [['tac-ring-player', 0x7fb8ff], ['tac-ring-enemy', 0xff6a50], ['tac-ring-ally', 0x8ae0a0], ['tac-ring-active', 0xffe08a]] as const) {
    const p = new Pix(22, 12);
    for (let y = 0; y < 12; y++) for (let x = 0; x < 22; x++) {
      const nx = (x + 0.5 - 11) / 10.5, ny = (y + 0.5 - 6) / 5.5;
      const d = nx * nx + ny * ny;
      if (d <= 1 && d > 0.6) p.set(x, y, c, y > 6 ? 0.95 : 0.55);
    }
    add(key, p);
  }
  // Soft shadow.
  {
    const p = new Pix(18, 8);
    p.ellipse(9, 4, 8.5, 3.6, pal('ink', 0), 0.45);
    p.ellipse(9, 4, 6, 2.4, pal('ink', 0), 0.25);
    add('tac-shadow', p);
  }
  // Path step marker.
  {
    const p = new Pix(10, 6);
    p.ellipse(5, 3, 4.5, 2.5, 0xfff0b8, 1);
    p.ellipse(5, 3, 3, 1.5, 0xf3c45a, 1);
    p.outline(pal('ink', 0), 0.6);
    add('tac-step', p);
  }
  // Status icons 7x7.
  const icon = (key: string, rows: string[], colors: Record<string, number>) => {
    const p = new Pix(rows[0].length, rows.length);
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (colors[ch] !== undefined) p.set(x, y, colors[ch]); }));
    p.outline(pal('ink', 0), 0.9);
    add(key, p);
  };
  icon('tac-st-guarded', ['.aaaaa.', 'abbbbba', 'abcccba', 'abcccba', '.abcba.', '..aba..', '...a...'], { a: 0x138078, b: 0x49e0c8, c: 0xd8fff6 });
  icon('tac-st-stunned', ['.a...a.', 'aaa.aaa', '.a...a.', '...a...', '..aaa..', '...a...', '.......'], { a: 0xffe070 });
  icon('tac-st-taunt', ['..aa...', '..aa...', '..aa...', '..aa...', '.......', '..aa...', '..aa...'], { a: 0xff6a50 });
  icon('tac-st-evasive', ['....aa.', '...ab..', '..ab...', '.ab....', 'ab..aa.', '...ab..', '..a....'], { a: 0xd8dce4, b: 0xffffff });
  icon('tac-st-bound', ['.abba..', 'ab..ba.', 'b....b.', 'ab..bab', '.abbabb', '....ab.', '.......'], { a: 0x9a7034, b: 0xe2c062 });
  icon('tac-st-burning', ['...a...', '..aa...', '.aab.a.', '.abba..', 'abbbba.', 'abccba.', '.aaaa..'], { a: 0xc8501c, b: 0xec8a2c, c: 0xfff2a8 });
  icon('tac-st-wounded', ['.......', 'a.....a', '.a...a.', '..a.a..', '...a...', '..a.a..', '.a...a.'], { a: 0xd4573b });

  // Projectiles.
  {
    const p = new Pix(12, 3);
    p.rect(0, 1, 9, 1, pal('wood', 4)); p.set(9, 0, pal('steel', 5)); p.set(10, 1, pal('steel', 6)); p.set(9, 2, pal('steel', 4)); p.set(9, 1, pal('steel', 5));
    p.set(0, 0, 0xf0f2f6); p.set(1, 0, 0xd8dce4); p.set(0, 2, 0xf0f2f6); p.set(1, 2, 0xd8dce4);
    add('tac-arrow', p);
  }
  {
    const p = new Pix(9, 3);
    p.rect(0, 1, 7, 1, pal('wood', 2)); p.rect(6, 0, 2, 3, pal('steel', 4)); p.set(8, 1, pal('steel', 6));
    p.set(0, 0, pal('black', 3)); p.set(0, 2, pal('black', 3));
    add('tac-bolt', p);
  }
  {
    const p = new Pix(5, 5);
    p.ellipse(2.5, 2.5, 2.4, 2.2, pal('stone', 3)); p.set(1, 1, pal('stone', 5)); p.set(2, 1, pal('stone', 4));
    p.outline(pal('ink', 0), 0.8);
    add('tac-stone', p);
  }
  // Slash arc (white crescent) and impact star.
  {
    const p = new Pix(24, 24);
    for (let a = -1.2; a <= 1.2; a += 0.02) {
      for (let r = 8; r <= 11; r += 0.5) {
        const w = 1 - Math.abs(a) / 1.2;
        if (r > 8 + w * 3.2) continue;
        p.set(12 + Math.cos(a) * r, 12 + Math.sin(a) * r, r > 10 ? 0xffffff : 0xfff2c0, 0.95);
      }
    }
    add('tac-slash', p);
  }
  {
    const p = new Pix(15, 15);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, len = i % 2 ? 4 : 7;
      for (let r = 1; r <= len; r++) p.set(7 + Math.round(Math.cos(a) * r), 7 + Math.round(Math.sin(a) * r), r < 3 ? 0xffffff : 0xfff0a0, 1 - r / (len + 2));
    }
    p.ellipse(7.5, 7.5, 2, 2, 0xffffff);
    add('tac-impact', p);
  }
  // Rope piece for freeing.
  {
    const p = new Pix(4, 2);
    p.rect(0, 0, 4, 1, pal('straw', 2)); p.rect(0, 1, 4, 1, pal('straw', 1));
    add('tac-rope', p);
  }
  // Generic soft dot for particles (independent of the art layer).
  {
    const p = new Pix(6, 6);
    p.ellipse(3, 3, 3, 3, 0xffffff, 0.5);
    p.ellipse(3, 3, 1.6, 1.6, 0xffffff, 1);
    add('tac-dot', p);
  }
  {
    const p = new Pix(3, 3);
    p.rect(0, 0, 3, 3, 0xffffff, 0.5); p.set(1, 1, 0xffffff);
    add('tac-px', p);
  }
  // Soft radial glow (lights, magic).
  {
    const p = new Pix(64, 32);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 64; x++) {
      const nx = (x + 0.5 - 32) / 32, ny = (y + 0.5 - 16) / 16;
      const d = Math.sqrt(nx * nx + ny * ny);
      if (d < 1) p.set(x, y, 0xffffff, Math.pow(1 - d, 2) * 0.9);
    }
    add('tac-glow', p);
  }
  // Flag for goal tiles.
  {
    const p = new Pix(12, 18);
    p.rect(2, 1, 1, 16, pal('wood', 3));
    for (let y = 0; y < 6; y++) for (let x = 0; x < 8 - Math.floor(y / 2); x++) p.set(3 + x, 2 + y, y < 3 ? 0xf3d27a : 0xd8b25a);
    p.ellipse(2.5, 16.5, 2, 1, pal('ink', 0), 0.5);
    p.outline(pal('ink', 0), 0.85);
    add('tac-flag', p);
  }
}
