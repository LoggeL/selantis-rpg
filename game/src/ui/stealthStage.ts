import { loadImage } from '../art/assets';
import { previewCanvas } from '../art/blurhash';
import { manifest, type CharacterEntry, type PoseEntry } from '../art/manifest';
import { ctx as ui } from './context';
import { stealthPhase, stealthSafe, stealthTarget, stealthTiming, type StealthKind, type StealthState } from './interactionRules';

type Facing = 'down' | 'left' | 'right' | 'up';
type Img = HTMLImageElement | HTMLCanvasElement;
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: 'mote' | 'dust' | 'leaf' | 'spark' | 'ring' }

/** World raster of the painted scenes (1280×720). Everything below is placed in these coordinates. */
const WW = 1280, WH = 720;
const GOLD = '#d8b25a', GOLD_HI = '#f3d58a';

/** Per scene: painted backdrop, ground lines and figure scales measured on the Codex paintings. */
const SCENES = {
  cover: { bg: 'stealth-cover', ground: 626, guardY: 362, guardScale: 1.75, lia: 3.6 },
  duck: { bg: 'stealth-duck', ground: 640, guardY: 462, guardScale: 2.5, lia: 4.2 },
  listen: { bg: 'stealth-listen', ground: 664, guardY: 452, guardScale: 1.9, lia: 3.5 },
} as const;

/**
 * A painted side-view tableau per hiding game: Codex backdrop and foreground props, the campaign's real sprite sheets,
 * and only light, particles and markers drawn in code. Gameplay positions stay in the stage's screen space, so the
 * pointer mapping in interactions.ts is unchanged.
 */
export function createStealthStage(stage: HTMLElement, kind: StealthKind) {
  const canvas = document.createElement('canvas');
  canvas.className = 'stealth-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', kind === 'duck' ? 'Lia duckt sich im Hohlweg unter vorbeireitenden Dunkelschatten.'
    : kind === 'listen' ? 'Lia lauscht nachts hinter alten Eichenstämmen, eine Wache mit Fackel streift über die Wiese.'
      : 'Lia schleicht am Hof von Busch zu Busch, eine Wache patrouilliert auf dem Feldweg.');
  stage.append(canvas);
  const g = canvas.getContext('2d')!;
  const art = manifest();
  const cfg = SCENES[kind];
  const playerId = kind === 'listen' ? 'lia-cloak' : 'lia';
  const playerEntry = art.characters[playerId];
  const guardEntry = art.characters['shadow-spear'];
  const riderEntry = art.characters['shadow-rider'];
  const mini = (id: string, ext: string) => art.images?.[`minigames/${id}`]?.file ?? `assets/minigames/${id}.${ext}`;
  const files = {
    ground: mini(cfg.bg, 'jpg'),
    player: playerEntry?.walk?.file,
    crouch: playerEntry?.poses.crouch?.file,
    guard: guardEntry?.walk?.file,
    rider: riderEntry?.walk?.file,
    coverA: kind === 'cover' ? mini('stealth-bush-a', 'png') : kind === 'listen' ? mini('stealth-trunk-a', 'png') : mini('stealth-bank', 'png'),
    coverB: kind === 'cover' ? mini('stealth-bush-b', 'png') : kind === 'listen' ? mini('stealth-trunk-b', 'png') : undefined,
    torch: art.props['torch']?.file,
  };
  const pictures: Partial<Record<keyof typeof files, Img>> = {};
  const shaded: Partial<Record<'coverA' | 'coverB', HTMLCanvasElement>> = {};
  /** Foreground trunks at night: the painting darkened and cooled once, so the torch light reads against them. */
  const nightShade = (img: Img) => {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const cg = c.getContext('2d')!;
    cg.drawImage(img, 0, 0);
    cg.globalCompositeOperation = 'source-atop';
    const v = cg.createLinearGradient(0, 0, 0, img.height);
    v.addColorStop(0, 'rgba(6, 10, 28, 0.62)'); v.addColorStop(1, 'rgba(6, 10, 28, 0.38)');
    cg.fillStyle = v; cg.fillRect(0, 0, img.width, img.height);
    return c;
  };
  let loaded = false, time = 0, lastPosition = 0.5;
  let facing: Facing = 'right';
  let lastPhase = '', lastRound = 0, lastSafe = false, shake = 0, flash = 0, glory = 0;
  let guardFacing: Facing = 'left', guardWalking = false;
  const particles: Particle[] = [];
  const tint = document.createElement('canvas');
  const tg = tint.getContext('2d')!;
  const body = document.createElement('canvas');
  const bg = body.getContext('2d')!;
  const completed = new Set<string>();
  for (const [name, file] of Object.entries(files)) {
    const preview = file ? previewCanvas(file) : null;
    if (preview) {
      pictures[name as keyof typeof files] = preview;
      if (kind === 'listen' && (name === 'coverA' || name === 'coverB')) shaded[name] = nightShade(preview);
    }
  }
  const ready = Promise.all(Object.entries(files).map(async ([name, file]) => {
    if (file) {
      const image = await loadImage(file);
      if (image) {
        pictures[name as keyof typeof files] = image;
        completed.add(name);
        if (kind === 'listen' && (name === 'coverA' || name === 'coverB')) shaded[name] = nightShade(image);
      }
    }
  })).then(() => {
    loaded = ['ground', 'player', 'crouch', 'guard', 'rider', 'coverA', ...(kind === 'duck' ? [] : ['coverB'])].every(name => completed.has(name));
    stage.dataset.assets = loaded ? 'ready' : 'failed';
    return loaded;
  });
  stage.dataset.character = playerId;
  stage.dataset.assets = 'loading';
  const still = () => ui.reducedMotion;
  const rand = (a: number, b: number) => a + Math.random() * (b - a);

  function frameOf(entry: CharacterEntry, dir: Facing, moving: boolean, pose?: PoseEntry) {
    const walk = entry.walk!;
    const row = walk.dirs.indexOf(dir);
    const frame = moving ? row * walk.cols + Math.floor(time * walk.fps) % walk.cols : (walk.idle?.[row] ?? row * walk.cols);
    const w = pose?.w ?? walk.frameW, h = pose?.h ?? walk.frameH;
    return { w, h, sx: pose ? 0 : frame % walk.cols * w, sy: pose ? 0 : Math.floor(frame / walk.cols) * h, foot: pose?.foot ?? entry.foot ?? [w / 2, h - 4],
      flip: Boolean(pose && ((dir === 'left' && pose.facing === 'right') || (dir === 'right' && pose.facing === 'left'))) };
  }

  /** Sprite cells stay crisp: they are the campaign's pixel sprites, scaled by whole-ish factors. */
  function sprite(image: Img | undefined, entry: CharacterEntry, x: number, y: number, scale: number, dir: Facing, moving: boolean, pose?: PoseEntry, alpha = 1) {
    if (!image) return;
    const f = frameOf(entry, dir, moving, pose);
    g.save();
    g.imageSmoothingEnabled = false;
    g.globalAlpha = alpha;
    g.translate(x, y);
    if (f.flip) g.scale(-1, 1);
    g.drawImage(image, f.sx, f.sy, f.w, f.h, -f.foot[0] * scale, -f.foot[1] * scale, f.w * scale, f.h * scale);
    g.restore();
  }

  /**
   * Lia seen through foliage: her own sprite as a dim shadow plus a glowing rim (one sprite pixel wide), so the player
   * always knows where she is. Gold rim = safe in cover; pale rim = behind the leaves but not yet in the hiding spot.
   */
  function silhouette(image: Img | undefined, entry: CharacterEntry, x: number, y: number, scale: number, dir: Facing, moving: boolean, pose: PoseEntry | undefined, safe: boolean) {
    if (!image) return;
    const f = frameOf(entry, dir, moving, pose);
    const W = f.w + 2, H = f.h + 2;
    for (const c of [tint, body]) if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    tg.globalCompositeOperation = 'source-over';
    tg.clearRect(0, 0, W, H);
    for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) tg.drawImage(image, f.sx, f.sy, f.w, f.h, dx, dy, f.w, f.h);
    tg.globalCompositeOperation = 'source-in';
    tg.fillStyle = safe ? GOLD_HI : '#f4ead6'; tg.fillRect(0, 0, W, H);
    tg.globalCompositeOperation = 'destination-out';
    tg.drawImage(image, f.sx, f.sy, f.w, f.h, 1, 1, f.w, f.h);
    bg.globalCompositeOperation = 'source-over';
    bg.clearRect(0, 0, W, H);
    bg.drawImage(image, f.sx, f.sy, f.w, f.h, 1, 1, f.w, f.h);
    bg.globalCompositeOperation = 'source-atop';
    bg.fillStyle = 'rgba(12, 16, 28, 0.55)'; bg.fillRect(0, 0, W, H);
    const pulse = still() ? 1 : 0.86 + Math.sin(time * 3) * 0.14;
    g.save();
    g.imageSmoothingEnabled = false;
    g.translate(x, y);
    if (f.flip) g.scale(-1, 1);
    const dx = -(f.foot[0] + 1) * scale, dy = -(f.foot[1] + 1) * scale;
    g.globalAlpha = 0.5;
    g.drawImage(body, dx, dy, W * scale, H * scale);
    g.globalAlpha = (safe ? 1 : 0.8) * pulse;
    g.shadowColor = safe ? 'rgba(243, 213, 138, 0.95)' : 'rgba(255, 236, 210, 0.6)';
    g.shadowBlur = safe ? 14 : 8;
    g.drawImage(tint, dx, dy, W * scale, H * scale);
    g.restore();
  }

  /** Soft light fan, built once: a wedge whose edges and tip fade out. Drawn rotated from the guard's eyes or torch. */
  function makeCone(rgb: string) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const cg = c.getContext('2d')!;
    const grad = cg.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0, `rgba(${rgb}, 1)`); grad.addColorStop(0.55, `rgba(${rgb}, 0.7)`); grad.addColorStop(1, `rgba(${rgb}, 0)`);
    cg.fillStyle = grad;
    const layers = 14;
    cg.globalAlpha = 1 / layers * 1.6;
    for (let i = 0; i < layers; i++) {
      const h = 128 * (0.35 + 0.65 * i / (layers - 1));
      cg.beginPath(); cg.moveTo(0, 128 - h * 0.06); cg.lineTo(512, 128 - h); cg.lineTo(512, 128 + h); cg.lineTo(0, 128 + h * 0.06); cg.closePath(); cg.fill();
    }
    return c;
  }
  const cone = makeCone(kind === 'listen' ? '255, 176, 92' : '255, 150, 104');

  /** The search sweep: a fan from (x, y) towards the exposed spot, and a pool of light where it lands. */
  function sweepLight(x: number, y: number, tx: number, ty: number, strength: number) {
    const sway = still() ? 0 : Math.sin(time * 2.4) * 0.07;
    const angle = Math.atan2(ty - y, tx - x) + sway;
    const len = Math.hypot(tx - x, ty - y) * 1.3;
    g.save();
    g.globalCompositeOperation = kind === 'listen' ? 'lighter' : 'screen';
    g.globalAlpha = strength;
    g.translate(x, y); g.rotate(angle);
    g.drawImage(cone, 0, -len * 0.36, len, len * 0.72);
    g.restore();
    g.save();
    g.globalCompositeOperation = kind === 'listen' ? 'lighter' : 'screen';
    const px = x + Math.cos(angle) * len * 0.78, py = y + Math.sin(angle) * len * 0.78;
    g.translate(px, py); g.scale(1, 0.3);
    const r = len * 0.34;
    const pool = g.createRadialGradient(0, 0, 0, 0, 0, r);
    const rgb = kind === 'listen' ? '255, 176, 92' : '255, 150, 104';
    pool.addColorStop(0, `rgba(${rgb}, ${0.42 * strength})`); pool.addColorStop(1, `rgba(${rgb}, 0)`);
    g.fillStyle = pool; g.fillRect(-r, -r, r * 2, r * 2);
    g.restore();
  }

  /** Painted prop with its foot at (x, y). */
  function prop(image: Img | HTMLCanvasElement | undefined, x: number, y: number, w: number, glow = 0) {
    if (!image) return;
    const h = image.height * w / image.width;
    g.save();
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    if (glow > 0) { g.shadowColor = `rgba(243, 213, 138, ${0.85 * glow})`; g.shadowBlur = 26 * glow; }
    g.drawImage(image, x - w / 2, y - h, w, h);
    g.restore();
  }

  function shadow(x: number, y: number, w: number, alpha = 0.45) {
    g.save();
    g.fillStyle = `rgba(6, 10, 8, ${alpha})`;
    g.beginPath(); g.ellipse(x, y, w, w * 0.22, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  function glowAt(x: number, y: number, r: number, color: string, alpha: number) {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, color.replace('A', String(alpha)));
    grad.addColorStop(1, color.replace('A', '0'));
    g.fillStyle = grad; g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  /** Gold chevron marker hovering above the next hiding place. */
  function chevron(x: number, y: number, size: number, dir: 1 | -1, alpha = 1) {
    const bob = still() ? 0 : Math.sin(time * 4) * size * 0.25;
    g.save();
    g.translate(x, y + bob * dir);
    g.globalAlpha = alpha;
    g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = size * 0.5;
    for (let i = 0; i < 2; i++) {
      const o = i * size * 0.55 * -dir;
      g.beginPath();
      g.moveTo(-size, o - size * 0.45 * dir); g.lineTo(0, o + size * 0.45 * dir); g.lineTo(size, o - size * 0.45 * dir);
      g.lineWidth = size * 0.36; g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = '#2a1d10'; g.stroke();
      g.lineWidth = size * 0.2; g.strokeStyle = i ? 'rgba(243,213,138,.55)' : GOLD_HI; g.stroke();
    }
    g.restore();
  }

  /** Pulsing gold ring on the ground where Lia is safe. */
  function groundRing(x: number, y: number, rx: number, active: boolean) {
    const pulse = still() ? 0.5 : (Math.sin(time * 3.2) + 1) / 2;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.translate(x, y); g.scale(1, 0.22);
    const grad = g.createRadialGradient(0, 0, rx * 0.2, 0, 0, rx);
    grad.addColorStop(0, `rgba(243, 213, 138, ${active ? 0.36 : 0.16 + pulse * 0.14})`);
    grad.addColorStop(1, 'rgba(216, 178, 90, 0)');
    g.fillStyle = grad; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'source-over';
    g.lineWidth = 5; g.strokeStyle = `rgba(243, 213, 138, ${active ? 0.95 : 0.45 + pulse * 0.4})`;
    g.setLineDash(active ? [] : [18, 12]); g.lineDashOffset = still() ? 0 : -time * 30;
    g.beginPath(); g.arc(0, 0, rx * 0.86, 0, Math.PI * 2); g.stroke();
    g.restore();
  }

  /** Guard alert badge: '?' while turning, '!' while searching or after a noise. Pure marker, no lettering in art. */
  function badge(x: number, y: number, mark: '?' | '!', size: number) {
    const pop = still() ? 1 : 1 + Math.max(0, Math.sin(time * 9)) * 0.08;
    g.save();
    g.translate(x, y); g.scale(pop, pop);
    g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = size * 0.4;
    g.beginPath();
    g.moveTo(-size * 0.7, -size); g.lineTo(size * 0.7, -size);
    g.quadraticCurveTo(size, -size, size, -size * 0.7); g.lineTo(size, size * 0.4);
    g.quadraticCurveTo(size, size * 0.7, size * 0.7, size * 0.7); g.lineTo(size * 0.2, size * 0.7);
    g.lineTo(0, size * 1.1); g.lineTo(-size * 0.2, size * 0.7); g.lineTo(-size * 0.7, size * 0.7);
    g.quadraticCurveTo(-size, size * 0.7, -size, size * 0.4); g.lineTo(-size, -size * 0.7);
    g.quadraticCurveTo(-size, -size, -size * 0.7, -size); g.closePath();
    g.fillStyle = mark === '!' ? '#3a120c' : '#2b2119'; g.fill();
    g.shadowBlur = 0;
    g.lineWidth = size * 0.14; g.strokeStyle = mark === '!' ? '#f08a6a' : GOLD; g.stroke();
    g.fillStyle = mark === '!' ? '#ffd9b8' : GOLD_HI;
    g.font = `700 ${Math.round(size * 1.35)}px Cinzel, Georgia, serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(mark, 0, -size * 0.12);
    g.restore();
  }

  function spawn(p: Omit<Particle, 'max'>) { if (particles.length < 160) particles.push({ ...p, max: p.life }); }

  function ambient(dt: number, view: { l: number; r: number }) {
    const want = still() ? 0 : kind === 'listen' ? 26 : 22;
    let motes = 0;
    for (const p of particles) if (p.kind === 'mote') motes++;
    for (let i = motes; i < want && Math.random() < dt * 12; i++) {
      spawn(kind === 'listen'
        ? { kind: 'mote', x: rand(view.l, view.r), y: rand(300, 690), vx: rand(-8, 8), vy: rand(-10, 4), life: rand(3, 6), size: rand(2.5, 4.5), color: '246, 226, 122' }
        : { kind: 'mote', x: rand(view.l, view.r), y: rand(120, 640), vx: rand(-14, -4), vy: rand(-6, 3), life: rand(4, 8), size: rand(1.6, 3.2), color: kind === 'duck' ? '255, 214, 140' : '255, 200, 120' });
    }
  }

  function burst(x: number, y: number, type: 'leaf' | 'spark', n: number) {
    if (still()) n = Math.min(n, 6);
    for (let i = 0; i < n; i++) {
      const a = rand(-Math.PI, 0), v = rand(60, 220);
      spawn(type === 'leaf'
        ? { kind: 'leaf', x: x + rand(-30, 30), y: y + rand(-40, 0), vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.7, 1.3), size: rand(9, 16), color: Math.random() < 0.5 ? '108, 140, 52' : '168, 120, 52' }
        : { kind: 'spark', x: x + rand(-20, 20), y: y + rand(-60, 0), vx: Math.cos(a) * v * 0.5, vy: Math.sin(a) * v * 0.6, life: rand(0.6, 1.2), size: rand(2, 4.5), color: '243, 213, 138' });
    }
  }

  function stepParticles(dt: number) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      if (still()) continue;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'leaf') { p.vy += 260 * dt; p.vx *= 0.98; }
      if (p.kind === 'dust') { p.vx *= 0.97; p.vy -= 6 * dt; p.size += 26 * dt; }
      if (p.kind === 'spark') p.vy -= 20 * dt;
      if (p.kind === 'ring') p.size += 260 * dt;
    }
  }

  /** Back layer: motes and dust behind the cover. Front layer: leaves, sparks and noise rings in front of it. */
  function drawParticles(front: boolean) {
    for (const p of particles) {
      if ((p.kind === 'leaf' || p.kind === 'spark' || p.kind === 'ring') !== front) continue;
      const t = p.life / p.max;
      g.save();
      if (p.kind === 'mote' || p.kind === 'spark') {
        g.globalCompositeOperation = 'lighter';
        const fl = p.kind === 'mote' ? Math.sin((1 - t) * Math.PI) * (kind === 'listen' ? 0.5 + 0.5 * Math.sin(time * 5 + p.x) : 0.8) : t;
        const grad = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
        grad.addColorStop(0, `rgba(${p.color}, ${0.9 * fl})`); grad.addColorStop(0.35, `rgba(${p.color}, ${0.35 * fl})`); grad.addColorStop(1, `rgba(${p.color}, 0)`);
        g.fillStyle = grad; g.fillRect(p.x - p.size * 3, p.y - p.size * 3, p.size * 6, p.size * 6);
      } else if (p.kind === 'dust') {
        const grad = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        grad.addColorStop(0, `rgba(${p.color}, ${0.34 * t})`); grad.addColorStop(1, `rgba(${p.color}, 0)`);
        g.fillStyle = grad; g.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
      } else if (p.kind === 'leaf') {
        g.translate(p.x, p.y); g.rotate(time * 8 + p.x);
        g.fillStyle = `rgba(${p.color}, ${Math.min(1, t * 2)})`;
        g.beginPath(); g.ellipse(0, 0, p.size / 2, p.size / 4.5, 0, 0, Math.PI * 2); g.fill();
      } else {
        g.lineWidth = 6 * t; g.strokeStyle = `rgba(240, 138, 106, ${0.85 * t})`;
        g.beginPath(); g.ellipse(p.x, p.y, p.size, p.size * 0.45, 0, 0, Math.PI * 2); g.stroke();
      }
      g.restore();
    }
  }

  function render(state: StealthState, started: boolean, dt = 0) {
    const bounds = stage.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const S = Math.min(dpr, 1920 / bounds.width);
    const cw = Math.round(bounds.width * S), ch = Math.round(bounds.height * S);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    time += dt;
    shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt * 1.6); glory = Math.max(0, glory - dt * 0.8);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#0b1018'; g.fillRect(0, 0, cw, ch);
    if (!pictures.ground || !pictures.coverA) {
      g.fillStyle = '#d9cfb5'; g.font = `${Math.round(16 * S)}px Alegreya, Georgia, serif`; g.textAlign = 'center';
      g.fillText(stage.dataset.assets === 'failed' ? 'Die Bilder konnten nicht geladen werden.' : 'Die Szene wird gemalt …', cw / 2, ch / 2);
      return;
    }
    const phase = stealthPhase(state, kind);
    const timing = stealthTiming(kind);
    const searching = started && phase === 'danger';
    const turning = started && phase === 'move' && state.time > timing.prepare - 0.6;
    const target = stealthTarget(kind, state.round);
    const safe = stealthSafe(state, kind);
    const moving = Math.abs(state.position - lastPosition) > 0.0005;
    if (moving && kind !== 'duck') facing = state.position < lastPosition ? 'left' : 'right';
    lastPosition = state.position;

    // Camera: the painting covers the stage; gameplay x stays in screen space (pointer mapping in interactions.ts).
    // Tall phone windows zoom in a little and crop sky rather than shrinking the figures.
    const tall = ch > cw * 0.9;
    const k = Math.max(cw / WW, ch / WH) * (tall ? 1.7 : 1);
    const ox = (cw - WW * k) / 2, oy = (ch - WH * k) * (tall ? (kind === 'listen' ? 0.93 : kind === 'cover' ? 0.8 : 0.88) : cw / ch > WW / WH ? 0.62 : 0.5);
    const toWorldX = (sx: number) => (sx * S - ox) / k;
    const toWorldY = (sy: number) => (sy * S - oy) / k;
    const view = { l: toWorldX(0), r: toWorldX(bounds.width) };
    const visW = view.r - view.l;
    const at = (p: number) => toWorldX(24 + (bounds.width - 48) * p);
    const s = Math.max(0.5, Math.min(1, visW / WW));
    let sx = 0, sy = 0;
    if (shake > 0 && !still()) { sx = rand(-1, 1) * 7 * shake * S; sy = rand(-1, 1) * 5 * shake * S; }
    g.setTransform(k, 0, 0, k, ox + sx, oy + sy);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(pictures.ground!, 0, 0, WW, WH);

    // Events: noise, safe beats and phase changes start effects.
    const caught = phase === 'retry' && lastPhase !== 'retry' && started;
    const beat = state.round > lastRound;
    let playerX: number, playerY: number, hidden: boolean;
    // Hiding places are sized from the visible width; Lia and the guard keep their proportion to them,
    // so on a narrow phone window the foreground grows a little instead of turning into a strip of tiny figures.
    const coverW = (kind === 'listen' ? 0.27 : 0.29) * visW * (tall ? (kind === 'listen' ? 1.45 : 1.7) : 1);
    const fg = coverW / ((kind === 'listen' ? 0.27 : 0.29) * WW) * (tall ? 1.2 : 1);
    const liaScale = kind === 'duck' ? 5 * Math.max(0.7, s) : cfg.lia * fg;
    ambient(dt, view);

    if (kind === 'duck') {
      // Hollow lane: riders gallop right to left, Lia hides in the near bank. Head height follows the pointer mapping.
      playerX = view.l + visW * (tall ? 0.3 : 0.24);
      const headY = toWorldY(bounds.height * (0.42 + state.position * 0.42) + bounds.height * 0.01);
      hidden = state.position > 0.63;
      const crouchPose = playerEntry.poses.crouch;
      const figure = (hidden ? 40 : 46) * liaScale;
      playerY = hidden ? Math.min(headY + figure, toWorldY(bounds.height * 0.95)) : headY + figure;
      const riding = searching && target > 0.5;
      const cycle = Math.max(0, state.time - timing.prepare) / timing.danger;
      const approaching = started && phase === 'move' && target > 0.5 && state.time > timing.prepare * 0.45;
      const laneY = cfg.guardY;
      if (approaching && !still()) {
        // Dust rolling in from the right telegraphs the riders.
        const near = (state.time - timing.prepare * 0.45) / (timing.prepare * 0.55);
        if (Math.random() < dt * 30) spawn({ kind: 'dust', x: view.r + rand(-20, 60) - near * 80, y: laneY - rand(0, 30), vx: rand(-80, -30), vy: rand(-10, 0), life: rand(0.8, 1.4), size: rand(12, 26), color: '196, 150, 96' });
        shake = Math.max(shake, 0.08 * near);
      }
      if (riding) {
        const span = visW + 520 * s;
        for (let i = 0; i < 3; i++) {
          const x = view.r + 120 - cycle * span * 1.25 + i * 150 * s;
          shadow(x, laneY + 4, 60 * s, 0.4);
          sprite(pictures.rider, riderEntry, x, laneY, cfg.guardScale * s * 1.1, 'left', true);
          if (!still() && Math.random() < dt * 40) spawn({ kind: 'dust', x: x + 40 * s, y: laneY - rand(0, 16), vx: rand(20, 90), vy: rand(-30, -5), life: rand(0.6, 1.1), size: rand(10, 22), color: '186, 140, 90' });
        }
        shake = Math.max(shake, 0.18);
      }
      stepParticles(dt);
      drawParticles(false);
      // Lia, from behind, peeking across the lane; crouched pose when hidden.
      sprite(hidden ? pictures.crouch : pictures.player, playerEntry, playerX, playerY, liaScale, hidden ? 'right' : 'up', false, hidden ? crouchPose : undefined);
      // Near bank: painted vegetation band tiled across the view, its leafy edge at the hiding line.
      const bank = pictures.coverA!;
      const top = toWorldY(bounds.height * 0.625);
      const bh = Math.max(WH - top + 30, 240), bw = bank.width * bh / bank.height;
      g.save(); g.imageSmoothingEnabled = true;
      for (let x = view.l - bw * 0.3, i = 0; x < view.r; x += bw * 0.82, i++) {
        g.save(); g.translate(x + bw / 2, top);
        if (i % 2) g.scale(-1, 1);
        g.drawImage(bank, -bw / 2, 0, bw, bh); g.restore();
      }
      g.restore();
      if (hidden) silhouette(pictures.crouch, playerEntry, playerX, playerY, liaScale, 'right', false, crouchPose, true);
      drawParticles(true);
      // Target cue next to Lia.
      if (started && phase !== 'done') {
        const goalY = toWorldY(bounds.height * (0.42 + target * 0.42) + bounds.height * 0.01) + 20 * liaScale;
        const cueX = playerX + 30 * liaScale;
        if (!safe) chevron(cueX, goalY - 30 * s * (target > 0.5 ? 1 : -1), 24 * Math.max(0.85, s), target > 0.5 ? 1 : -1);
      }
      if (caught) { burst(playerX, headY + 20, 'leaf', 16); spawn({ kind: 'ring', x: playerX, y: headY + 30, vx: 0, vy: 0, life: 0.7, size: 30, color: '' }); }
    } else {
      // Side view: a guard on the lane (cover) or with a torch on the meadow (listen); two hiding places in front.
      playerX = at(state.position); playerY = cfg.ground;
      hidden = [0.2, 0.8].some(p => Math.abs(state.position - p) < 0.13);
      const sway = Math.sin(time * 0.9);
      const guardX = at(searching || turning ? 0.5 : 0.6 + sway * 0.12);
      const guardY = cfg.guardY;
      guardWalking = started && !searching && !turning && phase !== 'retry';
      if (searching || turning || phase === 'retry') guardFacing = 'down';
      else guardFacing = Math.cos(time * 0.9) >= 0 ? 'right' : 'left';
      const gs = cfg.guardScale * Math.min(1, Math.max(0.6, fg));
      if (kind === 'listen') {
        // Night: deepen the painting, then add firelight and the torch as additive light.
        g.fillStyle = 'rgba(6, 10, 26, 0.32)'; g.fillRect(view.l, 0, visW, WH);
        g.save(); g.globalCompositeOperation = 'lighter';
        const fire = 0.32 + (still() ? 0 : Math.sin(time * 13) * 0.04 + Math.sin(time * 7.3) * 0.04);
        glowAt(968, 282, 120, 'rgba(255, 150, 60, A)', fire);
        g.restore();
      }
      if (searching && kind === 'cover') {
        // The guard's gaze: a warm fan from his eyes to the hiding place Lia must not be in.
        sweepLight(guardX, guardY - 34 * gs, at(target < 0.5 ? 0.8 : 0.2), cfg.ground - 30, 0.75);
      }
      shadow(guardX, guardY + 2, 16 * gs, 0.4);
      sprite(pictures.guard, guardEntry, guardX, guardY, gs, guardFacing, guardWalking);
      if (kind === 'listen' && pictures.torch) {
        const torch = art.props.torch;
        const frame = Math.floor(time * (torch.fps ?? 8)) % torch.frames;
        const tx = guardX + (guardFacing === 'left' ? -12 : 12) * gs, ty = guardY - 30 * gs;
        g.save(); g.imageSmoothingEnabled = false;
        g.drawImage(pictures.torch, frame * torch.w, 0, torch.w, torch.h, tx - torch.w * gs * 0.5, ty - torch.h * gs * 0.55, torch.w * gs, torch.h * gs);
        g.globalCompositeOperation = 'lighter';
        const fl = 0.55 + (still() ? 0 : Math.sin(time * 17) * 0.06 + Math.sin(time * 9) * 0.06);
        glowAt(tx, ty - torch.h * gs * 0.3, (searching ? 260 : 190) * s + 60, 'rgba(255, 150, 64, A)', fl * (searching ? 0.75 : 0.5));
        g.restore();
        // Torch beam towards the trunk Lia must leave.
        if (searching) sweepLight(tx, ty - torch.h * gs * 0.3, at(target < 0.5 ? 0.8 : 0.2), cfg.ground - 20, 0.62 * (fl + 0.45));
      }
      if (searching || phase === 'retry') badge(guardX, guardY - 62 * gs, '!', 17);
      else if (turning) badge(guardX, guardY - 62 * gs, '?', 15);
      stepParticles(dt);
      drawParticles(false);

      const coverY = kind === 'listen' ? cfg.ground + 34 * s : cfg.ground + 24 * s;
      for (const p of [0.2, 0.8]) {
        const x = at(p);
        shadow(x, coverY - 6 * s, coverW * 0.46, 0.5);
        if (started && p === target && phase !== 'done') groundRing(x, cfg.ground + 4, coverW * 0.42, safe);
      }
      shadow(playerX, playerY + 2, 18 * liaScale * 0.6, 0.45);
      const crouching = hidden && !moving;
      const pose = crouching ? playerEntry.poses.crouch : undefined;
      const playerImg = crouching ? pictures.crouch : pictures.player;
      sprite(playerImg, playerEntry, playerX, playerY, liaScale, facing, moving, pose);
      // Foliage and trunks are painted after Lia. Their alpha really occludes her sprite.
      for (const p of [0.2, 0.8]) {
        const x = at(p);
        const img = p === 0.2 ? shaded.coverA ?? pictures.coverA : shaded.coverB ?? pictures.coverB;
        const glow = started && p === target && phase !== 'done' ? (safe ? 1 : 0.55 + (still() ? 0 : Math.sin(time * 3.2) * 0.25)) : 0;
        if (kind === 'listen' && img) {
          // Trunk rises out of frame: stretch its top band of bark up to the stage edge.
          const w = coverW * (tall ? 1.55 : 1.3), h = img.height * w / img.width, top = coverY - h;
          prop(img, x, coverY, w);
          const sky = Math.min(0, toWorldY(0)) - 10;
          if (top > sky) {
            // Continue the bark upwards with the trunk's own upper slice, mirrored on every repeat so the seams meet.
            const slice = Math.round(img.height * 0.3), th = slice * w / img.width;
            g.save(); g.imageSmoothingEnabled = true;
            for (let y = top + 2, i = 0; y > sky && i < 8; y -= th, i++) {
              g.save(); g.translate(x, y - th / 2);
              if (i % 2 === 0) g.scale(1, -1);
              g.drawImage(img, 0, 0, img.width, slice, -w / 2, -th / 2, w, th);
              g.restore();
            }
            g.restore();
          }
        } else prop(img, x, coverY, coverW, glow);
        if (started && p === target && phase !== 'done' && !safe) {
          const topY = kind === 'listen' ? cfg.ground - 250 * s : coverY - (img ? img.height * coverW / img.width : 200) - 26 * s;
          chevron(x, topY, 24 * Math.max(0.85, s), 1);
        }
      }
      const behind = hidden || [0.2, 0.8].some(p => Math.abs(playerX - at(p)) < coverW * (kind === 'listen' ? 0.3 : 0.42));
      if (behind) silhouette(playerImg, playerEntry, playerX, playerY, liaScale, facing, moving, pose, hidden);
      drawParticles(true);
      if (kind === 'listen') {
        // Torch light spills over the near trunks only when the guard searches.
        const v = g.createLinearGradient(0, 0, 0, WH);
        v.addColorStop(0, 'rgba(4, 8, 22, 0.35)'); v.addColorStop(0.5, 'rgba(4, 8, 22, 0)'); v.addColorStop(1, 'rgba(4, 8, 22, 0.25)');
        g.fillStyle = v; g.fillRect(view.l, 0, visW, WH);
      }
      if (caught) { burst(playerX, playerY - 30, 'leaf', 18); spawn({ kind: 'ring', x: playerX, y: playerY - 20, vx: 0, vy: 0, life: 0.7, size: 30, color: '' }); }
    }

    if (caught) { shake = 0.4; flash = 1; }
    if (beat) { burst(playerX, playerY - 40, 'spark', 22); glory = state.done ? 1.4 : 0.6; }
    if (started && phase === 'move' && safe && !lastSafe && kind !== 'duck') burst(playerX, playerY - 50, 'leaf', 6);
    lastPhase = phase; lastRound = state.round; lastSafe = safe;

    // Screen-space grading: vignette, danger pulse, noise flash and success glow.
    g.setTransform(1, 0, 0, 1, 0, 0);
    const vig = g.createRadialGradient(cw / 2, ch * 0.55, Math.min(cw, ch) * 0.35, cw / 2, ch * 0.55, Math.max(cw, ch) * 0.75);
    vig.addColorStop(0, 'rgba(5, 8, 14, 0)'); vig.addColorStop(1, kind === 'listen' ? 'rgba(3, 5, 14, 0.78)' : 'rgba(10, 8, 14, 0.6)');
    g.fillStyle = vig; g.fillRect(0, 0, cw, ch);
    if (searching || flash > 0) {
      const pulse = flash > 0 ? flash : still() ? 0.5 : 0.45 + Math.sin(time * 8) * 0.2;
      const red = g.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.4, cw / 2, ch / 2, Math.max(cw, ch) * 0.72);
      red.addColorStop(0, 'rgba(212, 87, 59, 0)'); red.addColorStop(1, `rgba(212, 87, 59, ${0.38 * pulse})`);
      g.fillStyle = red; g.fillRect(0, 0, cw, ch);
    }
    if (glory > 0) {
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = `rgba(243, 213, 138, ${0.12 * Math.min(1, glory)})`; g.fillRect(0, 0, cw, ch);
      g.globalCompositeOperation = 'source-over';
    }
    if (!loaded) {
      g.fillStyle = '#d9cfb5'; g.font = `${Math.round(16 * S)}px Alegreya, Georgia, serif`; g.textAlign = 'center';
      g.fillText(stage.dataset.assets === 'failed' ? 'Die Bilder konnten nicht geladen werden.' : 'Die Szene wird gemalt …', cw / 2, 24 * S);
    }
    stage.dataset.pose = hidden && !moving ? 'crouch' : moving ? 'walk' : 'idle';
    stage.dataset.hidden = String(hidden);
  }
  return { ready, render };
}
