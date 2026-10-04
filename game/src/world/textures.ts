import Phaser from 'phaser';
import type { ClueKind, EmoteKind } from './api';

/**
 * Small procedural textures owned by the world engine (lights, emotes, weather particles, markers).
 * Everything else (ground, props, characters) comes from G.art.
 */

const OUTLINE = '#2b2119';
const PAPER = '#fbf4e2';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  return { c, g };
}

function px(g: CanvasRenderingContext2D, x: number, y: number, color: string, w = 1, h = 1) {
  g.fillStyle = color; g.fillRect(x, y, w, h);
}

/** Paints a pattern ('#' = color, other chars via map, '.' = empty). */
function pattern(g: CanvasRenderingContext2D, ox: number, oy: number, rows: string[], colors: Record<string, string>) {
  rows.forEach((row, y) => [...row].forEach((ch, x) => { const col = colors[ch]; if (col) px(g, ox + x, oy + y, col); }));
}

const EMOTE_GLYPHS: Record<EmoteKind, { rows: string[]; colors: Record<string, string> }> = {
  '!': { rows: ['..#..', '.###.', '.###.', '..#..', '..#..', '.....', '..#..'], colors: { '#': '#d4573b' } },
  '?': { rows: ['.###.', '#...#', '....#', '..##.', '..#..', '.....', '..#..'], colors: { '#': '#3a5a9a' } },
  '…': { rows: ['.....', '.....', '.....', '.....', '.....', '#.#.#', '.....'], colors: { '#': '#4a3a2c' } },
  heart: { rows: ['.#.#.', '#####', '#####', '.###.', '..#..', '.....', '.....'].map(r => r), colors: { '#': '#d84a5a' } },
  drop: { rows: ['..#..', '..#..', '.###.', '#####', '##o##', '.###.', '.....'], colors: { '#': '#4f9be0', o: '#bfe3ff' } },
  anger: { rows: ['##.##', '#...#', '.....', '#...#', '##.##', '.....', '.....'], colors: { '#': '#d4573b' } },
  note: { rows: ['..###', '..#.#', '..#.#', '..#..', '###..', '###..', '.....'], colors: { '#': '#4a3a2c' } },
};

const CLUE_SHAPES: Record<ClueKind, string[]> = {
  footprint: [
    '................',
    '..##............',
    '.####...........',
    '.####...........',
    '.####.....##....',
    '..##.....####...',
    '..##.....####...',
    '.........####...',
    '..........##....',
    '..........##....',
    '................',
    '................',
  ],
  hoof: [
    '................',
    '...###...###....',
    '..#...#.#...#...',
    '..#...#.#...#...',
    '...#.#...#.#....',
    '................',
    '.....###...###..',
    '....#...#.#...#.',
    '....#...#.#...#.',
    '.....#.#...#.#..',
    '................',
    '................',
  ],
  branch: [
    '................',
    '..........#.....',
    '.........#......',
    '..#.....#.......',
    '...#...##.......',
    '....###.#.......',
    '......#..#......',
    '.....#....##....',
    '....#...........',
    '...#............',
    '................',
    '................',
  ],
  bead: [
    '................',
    '................',
    '.....##.........',
    '....####....#...',
    '....####...###..',
    '.....##.....#...',
    '................',
    '.........##.....',
    '........####....',
    '.........##.....',
    '................',
    '................',
  ],
  glint: [
    '................',
    '.......#........',
    '.......#........',
    '......###.......',
    '...#########....',
    '......###.......',
    '.......#........',
    '.......#........',
    '................',
    '................',
    '................',
    '................',
  ],
  blood: [
    '................',
    '................',
    '....##..........',
    '...####...#.....',
    '...#####........',
    '....###.........',
    '.........##.....',
    '........###.....',
    '.........#......',
    '................',
    '................',
    '................',
  ],
  rope: [
    '................',
    '................',
    '..##............',
    '....##..........',
    '......#.........',
    '.......##...##..',
    '.........###....',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  mark: [
    '................',
    '................',
    '....#....#......',
    '.....#..#.......',
    '......##........',
    '......##........',
    '.....#..#.......',
    '....#....#......',
    '................',
    '................',
    '................',
    '................',
  ],
};

export const CLUE_KINDS = Object.keys(CLUE_SHAPES) as ClueKind[];
export const EMOTE_KINDS = Object.keys(EMOTE_GLYPHS) as EmoteKind[];

export function emoteKey(kind: EmoteKind): string { return `w-emote-${EMOTE_KINDS.indexOf(kind)}`; }
export function clueKey(kind: ClueKind): string { return `w-clue-${kind}`; }

function addCanvas(scene: Phaser.Scene, key: string, c: HTMLCanvasElement, linear = false) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.addCanvas(key, c);
  if (linear && tex) tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

/** Creates all world textures once (idempotent). */
export function ensureWorldTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('w-marker-no')) return;

  // Soft radial light. Stored as OPAQUE greyscale (black = no light) so additive stamping never leaks
  // the transparent corners of the quad.
  {
    const S = 128, { c, g } = canvas(S, S);
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const d = Math.hypot(x + 0.5 - S / 2, y + 0.5 - S / 2) / (S / 2);
      const v = d >= 1 ? 0 : Math.pow(1 - d, 1.8) * (0.85 + 0.15 * (1 - d));
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(v * 255);
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    addCanvas(scene, 'w-light', c, true);
  }
  // Glow for additive halos (also opaque greyscale).
  {
    const S = 64, { c, g } = canvas(S, S);
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const d = Math.hypot(x + 0.5 - S / 2, y + 0.5 - S / 2) / (S / 2);
      const v = d >= 1 ? 0 : 0.55 * Math.pow(1 - d, 2.2) + 0.45 * Math.pow(Math.max(0, 1 - d * 2.2), 2);
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(Math.min(1, v) * 255);
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    addCanvas(scene, 'w-glow', c, true);
  }
  // Character shadows: hard two-tone pixel ellipses (crisp next to the sprites), small and large.
  for (const [key, W, H] of [['w-shadow', 12, 5], ['w-shadow-l', 18, 6]] as [string, number, number][]) {
    const { c, g } = canvas(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - W / 2) / (W / 2), dy = (y + 0.5 - H / 2) / (H / 2);
      const d = dx * dx + dy * dy;
      if (d < 1) px(g, x, y, d < 0.5 ? 'rgba(24,16,34,0.42)' : 'rgba(24,16,34,0.24)');
    }
    addCanvas(scene, key, c);
  }
  // Wheat stalks drawn in front of an actor wading through the field (straw ramp of the art palette).
  for (const [key, W] of [['w-wheat-front', 14], ['w-wheat-front-l', 20]] as [string, number][]) {
    const H = 11, { c, g } = canvas(W, H);
    const rnd = mulberry(W * 31);
    const cols = ['#6e4b25', '#9a7034', '#c49a44', '#e2c062', '#f3dc8e'];
    for (let x = 0; x < W; x += 1) {
      if (rnd() < 0.18) continue;
      const top = 1 + Math.floor(rnd() * 4) + (x === 0 || x === W - 1 ? 2 : 0);
      const lean = rnd() < 0.5 ? 0 : (rnd() < 0.5 ? -1 : 1);
      for (let y = top; y < H; y++) {
        const k = (y - top) / (H - top);
        const xx = x + (y < top + 3 ? lean : 0);
        if (xx < 0 || xx >= W) continue;
        px(g, xx, y, k > 0.75 ? cols[1] : k > 0.4 ? cols[2] : cols[3]);
      }
      // ear (head) of the stalk
      if (rnd() < 0.55) { px(g, x + lean, top - 1 < 0 ? 0 : top - 1, cols[4]); px(g, x + lean, top, cols[3]); }
    }
    addCanvas(scene, key, c);
  }
  // Screen vignette (transparent centre, opaque edges) for the red 'spotted' pulse.
  {
    const W = 160, H = 90, { c, g } = canvas(W, H);
    const grad = g.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, W * 0.62);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.55, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,1)');
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    addCanvas(scene, 'w-vignette', c, true);
  }
  // Dust puff (soft round, warm)
  {
    const { c, g } = canvas(8, 8);
    const cols = ['rgba(222,200,160,0.9)', 'rgba(200,175,135,0.7)'];
    pattern(g, 0, 0, ['..####..', '.######.', '########', '########', '########', '########', '.######.', '..####..'].map(r => r), { '#': cols[0] });
    pattern(g, 0, 0, ['........', '........', '........', '........', '.......#', '......##', '.....##.', '..###...'], { '#': cols[1] });
    addCanvas(scene, 'w-dust', c);
  }
  // Grass bits (kicked up on grass)
  {
    const { c, g } = canvas(3, 3);
    pattern(g, 0, 0, ['.#.', '##.', '.#.'], { '#': '#8fc35a' });
    addCanvas(scene, 'w-grassbit', c);
  }
  // Rain streaks (thin far drop, thicker near drop) and splash ring
  {
    const { c, g } = canvas(2, 9);
    for (let y = 0; y < 9; y++) px(g, y < 5 ? 1 : 0, y, `rgba(200,222,245,${(0.25 + (y / 9) * 0.75).toFixed(2)})`);
    addCanvas(scene, 'w-rain', c);
  }
  {
    const { c, g } = canvas(3, 14);
    for (let y = 0; y < 14; y++) {
      const a = 0.2 + (y / 14) * 0.8;
      const x = y < 5 ? 2 : y < 10 ? 1 : 0;
      px(g, x, y, `rgba(214,232,250,${a.toFixed(2)})`);
      if (y > 3) px(g, Math.min(2, x + 1), y, `rgba(170,196,226,${(a * 0.5).toFixed(2)})`);
    }
    addCanvas(scene, 'w-rain-near', c);
  }
  // Ripple on water (flat ring, 1px)
  {
    const { c, g } = canvas(11, 5);
    pattern(g, 0, 0, ['...#####...', '.##.....##.', '#.........#', '.##.....##.', '...#####...'], { '#': 'rgba(220,236,255,0.85)' });
    addCanvas(scene, 'w-ripple', c);
  }
  {
    const { c, g } = canvas(9, 5);
    pattern(g, 0, 0, ['..#####..', '.#.....#.', '#.......#', '.#.....#.', '..#####..'], { '#': 'rgba(210,230,250,0.9)' });
    addCanvas(scene, 'w-splash', c);
  }
  {
    const { c, g } = canvas(3, 3);
    pattern(g, 0, 0, ['.#.', '#.#', '...'], { '#': 'rgba(220,236,255,0.95)' });
    addCanvas(scene, 'w-droplet', c);
  }
  // Seamless fog: wrapped soft blobs.
  {
    const W = 256, H = 128, { c, g } = canvas(W, H);
    const rnd = mulberry(77);
    for (let i = 0; i < 46; i++) {
      const x = rnd() * W, y = rnd() * H, r = 18 + rnd() * 46, a = 0.1 + rnd() * 0.2;
      for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) {
        const grad = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        grad.addColorStop(0, `rgba(235,240,248,${a})`);
        grad.addColorStop(1, 'rgba(235,240,248,0)');
        g.fillStyle = grad; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
    addCanvas(scene, 'w-fog', c, true);
  }
  // Firefly: a tiny warm-green 2x2 body; the soft halo is a separate additive 'w-glow' sprite.
  {
    const { c, g } = canvas(2, 2);
    px(g, 0, 0, '#fbffd0'); px(g, 1, 0, '#e4ff9a'); px(g, 0, 1, '#d6ff86'); px(g, 1, 1, '#b8f070');
    addCanvas(scene, 'w-firefly', c);
  }
  // Leaves (3 colours) and petals
  const leafRows = ['.##.', '####', '.##.'];
  [['#c8782e', '#e2a04a'], ['#9c5a28', '#c07a3a'], ['#7a9a38', '#a8c050']].forEach(([a, b], i) => {
    const { c, g } = canvas(4, 3);
    pattern(g, 0, 0, leafRows, { '#': a });
    px(g, 1, 0, b); px(g, 0, 1, b);
    addCanvas(scene, `w-leaf-${i}`, c);
  });
  {
    const { c, g } = canvas(2, 2);
    px(g, 0, 0, 'rgba(255,250,210,0.95)'); px(g, 1, 0, 'rgba(255,240,180,0.6)'); px(g, 0, 1, 'rgba(255,240,180,0.6)');
    addCanvas(scene, 'w-pollen', c);
  }
  // Butterfly: two frames (open, closed) in white/yellow/blue.
  [['#fbf4e2', '#e9d27a'], ['#f2d04a', '#c89a2a'], ['#8fb8f0', '#4f78c0']].forEach(([a, b], i) => {
    for (let f = 0; f < 2; f++) {
      const { c, g } = canvas(7, 5);
      if (f === 0) pattern(g, 0, 0, ['##.#.##', '#a.#.a#', '.##.##.', '..#.#..', '.......'], { '#': a, a: b });
      else pattern(g, 0, 0, ['.......', '..###..', '..a#a..', '...#...', '.......'], { '#': a, a: b });
      px(g, 3, f === 0 ? 1 : 2, '#3a2c22');
      addCanvas(scene, `w-butterfly-${i}-${f}`, c);
    }
  });
  // Emote bubbles: 13x13 speech bubble with tail, glyph inside.
  for (const kind of EMOTE_KINDS) {
    const { c, g } = canvas(13, 14);
    const bubble = [
      '..#########..',
      '.#wwwwwwwww#.',
      '#wwwwwwwwwww#',
      '#wwwwwwwwwww#',
      '#wwwwwwwwwww#',
      '#wwwwwwwwwww#',
      '#wwwwwwwwwww#',
      '#wwwwwwwwwww#',
      '#wwwwwwwwwww#',
      '#wwwwwwwwwwk#',
      '.#kwwwwwwkk#.',
      '..####w####..',
      '.....#w#.....',
      '......#......',
    ];
    pattern(g, 0, 0, bubble, { '#': OUTLINE, w: PAPER, k: '#e4d6b8' });
    const glyph = EMOTE_GLYPHS[kind];
    pattern(g, 4, 2, glyph.rows, glyph.colors);
    addCanvas(scene, emoteKey(kind), c);
  }
  // 'Blocked' click marker (small cross)
  {
    const { c, g } = canvas(7, 7);
    pattern(g, 0, 0, ['o.....o', 'o#...#o', '.o#.#o.', '..o#o..', '.o#.#o.', 'o#...#o', 'o.....o'], { '#': '#f0a080', o: 'rgba(60,24,16,0.55)' });
    addCanvas(scene, 'w-marker-no', c);
  }
  // Click/tap marker ring
  {
    const { c, g } = canvas(11, 6);
    pattern(g, 0, 0, ['...#####...', '.##.....##.', '#.........#', '#.........#', '.##.....##.', '...#####...'], { '#': '#f3dc94' });
    addCanvas(scene, 'w-marker', c);
  }
  // Objective diamond (turquoise)
  {
    const { c, g } = canvas(7, 10);
    pattern(g, 0, 0, ['...#...', '..#t#..', '.#ttt#.', '#ttwtt#', '.#ttt#.', '..#t#..', '...#...', '.......', '..ooo..', '.......'],
      { '#': '#1d4d4a', t: '#49e0c8', w: '#c9fff5', o: 'rgba(29,77,74,0.45)' });
    addCanvas(scene, 'w-objective', c);
  }
  // Sparkle (4 point star)
  {
    const { c, g } = canvas(7, 7);
    pattern(g, 0, 0, ['...#...', '...#...', '..#w#..', '##www##', '..#w#..', '...#...', '...#...'], { '#': '#f6e3a0', w: '#ffffff' });
    addCanvas(scene, 'w-sparkle', c);
  }
  {
    const { c, g } = canvas(3, 3);
    pattern(g, 0, 0, ['.#.', '###', '.#.'], { '#': '#ffffff' });
    addCanvas(scene, 'w-mote', c);
  }
  // Clue shapes: turquoise with a darker rim so they read on any ground.
  for (const kind of CLUE_KINDS) {
    const { c, g } = canvas(16, 12);
    const rows = CLUE_SHAPES[kind];
    // rim
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== '#') return;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (rows[ny]?.[nx] !== '#') px(g, nx, ny, 'rgba(12,60,58,0.85)');
      }
    }));
    pattern(g, 0, 0, rows, { '#': '#7ff5e2' });
    addCanvas(scene, clueKey(kind), c);
  }
  // 1x1 white pixel for rects/flashes
  {
    const { c, g } = canvas(4, 4);
    px(g, 0, 0, '#ffffff', 4, 4);
    addCanvas(scene, 'w-white', c);
  }
}

function mulberry(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
