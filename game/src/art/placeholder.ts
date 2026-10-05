/**
 * Neutral placeholder art for ids that have no generated asset yet (DESIGN.md §3): simple soft silhouettes,
 * drawn into canvases. They keep the exact geometry of the real assets (64×64 frames, foot at (32, 60)) so a
 * scene works unchanged once the painted asset arrives.
 */

const SIL = '#384152';
const SIL_LIGHT = '#566179';
const SIL_DARK = '#232a37';

function hashHue(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 360);
}

/** One hooded figure into a 64×64 cell at (ox, oy). frame 0..3 animates legs; dir picks a facing hint. */
export function drawFigure(g: CanvasRenderingContext2D, ox: number, oy: number, frame: number, dir: string,
  tint?: string, height = 40, pose: 'stand' | 'sit' | 'lie' | 'kneel' = 'stand'): void {
  const fx = ox + 32;
  const fy = oy + 60;
  const s = height / 40;
  const body = tint ?? SIL;
  g.save();
  g.translate(fx, fy);
  g.scale(s, s);
  // ground shadow
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.beginPath(); g.ellipse(0, 0, pose === 'lie' ? 20 : 9, 2.5, 0, 0, Math.PI * 2); g.fill();
  if (pose === 'lie') {
    g.fillStyle = body;
    g.beginPath(); g.ellipse(2, -5, 17, 5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = SIL_LIGHT;
    g.beginPath(); g.arc(-17, -6, 5, 0, Math.PI * 2); g.fill();
    g.restore();
    return;
  }
  const crouch = pose === 'sit' ? 13 : pose === 'kneel' ? 10 : 0;
  const bob = pose === 'stand' && (frame === 1 || frame === 3) ? -1 : 0;
  // legs
  if (pose === 'stand') {
    const swing = frame === 0 ? 3 : frame === 2 ? -3 : 0;
    g.fillStyle = SIL_DARK;
    const side = dir === 'left' || dir === 'right';
    if (side) {
      g.fillRect(-2 + swing, -12, 3, 12);
      g.fillRect(-1 - swing, -12, 3, 12);
    } else {
      g.fillRect(-4, -12 - (frame === 0 ? 1 : 0), 3, 12);
      g.fillRect(1, -12 - (frame === 2 ? 1 : 0), 3, 12);
    }
  }
  // robe / body
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(-6, -27 + crouch + bob);
  g.lineTo(6, -27 + crouch + bob);
  g.lineTo(8, -9 + (pose === 'stand' ? 0 : -1));
  g.lineTo(-8, -9 + (pose === 'stand' ? 0 : -1));
  g.closePath();
  g.fill();
  if (pose !== 'stand') { g.fillRect(-9, -9, 18, 8); }
  // hood / head
  g.fillStyle = SIL_LIGHT;
  g.beginPath(); g.arc(0, -32 + crouch + bob, 6, 0, Math.PI * 2); g.fill();
  g.fillStyle = SIL_DARK;
  const faceX = dir === 'left' ? -2 : dir === 'right' ? 2 : 0;
  if (dir !== 'up') { g.beginPath(); g.arc(faceX, -31 + crouch + bob, 3.2, 0, Math.PI * 2); g.fill(); }
  g.restore();
}

/** A 256×256 walk sheet with the standard layout (rows down, left, right, up × 4 frames). */
export function placeholderWalkSheet(id: string, tint?: string, height = 40): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d')!;
  const dirs = ['down', 'left', 'right', 'up'];
  for (let r = 0; r < 4; r++) for (let f = 0; f < 4; f++) drawFigure(g, f * 64, r * 64, f, dirs[r], tint, height);
  void id;
  return c;
}

export function placeholderPose(w: number, h: number, frames: number, pose: string, tint?: string, height = 40): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w * frames; c.height = h;
  const g = c.getContext('2d')!;
  const kind = pose === 'lie' || pose === 'sleep' ? 'lie' : pose.startsWith('sit') ? 'sit' : pose === 'kneel' || pose === 'crouch' ? 'kneel' : 'stand';
  for (let f = 0; f < frames; f++) drawFigure(g, f * w + (w - 64) / 2, h - 64, 1, 'right', tint, height, kind);
  return c;
}

export function placeholderProp(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(4, w); c.height = Math.max(4, h);
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath(); g.ellipse(c.width / 2, c.height - 2, c.width * 0.42, 2.5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = SIL;
  g.globalAlpha = 0.85;
  const r = Math.min(4, c.width / 4);
  g.beginPath();
  g.roundRect(c.width * 0.1, c.height * 0.1, c.width * 0.8, c.height * 0.85, r);
  g.fill();
  g.strokeStyle = SIL_LIGHT;
  g.lineWidth = 1;
  g.stroke();
  return c;
}

/** 32×32 neutral item icon (a tied cloth bundle) for item ids without a painted icon in ui/items.png. */
export function placeholderIcon(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath(); g.ellipse(16, 28, 10, 2.5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = SIL; g.strokeStyle = SIL_LIGHT; g.lineWidth = 1;
  g.beginPath(); g.moveTo(8, 27); g.quadraticCurveTo(4, 16, 12, 12); g.lineTo(20, 12); g.quadraticCurveTo(28, 16, 24, 27); g.closePath();
  g.fill(); g.stroke();
  g.beginPath(); g.moveTo(12, 12); g.lineTo(9, 5); g.lineTo(16, 9); g.lineTo(23, 5); g.lineTo(20, 12); g.closePath();
  g.fill(); g.stroke();
  return c;
}

export function placeholderBackground(w: number, h: number, id: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#2c3b2e');
  grad.addColorStop(1, '#1d2620');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,0.05)';
  for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, h); g.stroke(); }
  for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(w, y + 0.5); g.stroke(); }
  g.fillStyle = 'rgba(239,227,200,0.35)';
  g.font = '12px Georgia, serif';
  g.fillText(`bg/${id}`, 8, 18);
  return c;
}

const portraitCache = new Map<string, string>();

/** Dark hooded bust (256×256) — fallback dialogue portrait. */
export function placeholderPortrait(id: string): string {
  const hit = portraitCache.get(id);
  if (hit) return hit;
  if (typeof document === 'undefined') return '';
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d')!;
  const hue = hashHue(id);
  const bg = g.createRadialGradient(128, 110, 20, 128, 128, 190);
  bg.addColorStop(0, `hsl(${hue} 18% 20%)`);
  bg.addColorStop(1, '#0d1118');
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = SIL;
  g.beginPath();
  g.moveTo(30, 256); g.quadraticCurveTo(40, 170, 128, 160); g.quadraticCurveTo(216, 170, 226, 256);
  g.fill();
  g.beginPath(); g.ellipse(128, 112, 54, 64, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = SIL_DARK;
  g.beginPath(); g.ellipse(128, 122, 34, 42, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = `hsl(${hue} 40% 55% / 0.35)`;
  g.lineWidth = 3;
  g.beginPath(); g.ellipse(128, 112, 54, 64, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
  const url = c.toDataURL('image/png');
  portraitCache.set(id, url);
  return url;
}
