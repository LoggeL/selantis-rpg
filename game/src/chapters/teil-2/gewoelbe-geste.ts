// Captivity gestures in the Master's hall: the built-in story gestures illustrate book-one moments (Valentus reaching
// into the Urmacht, Lia tending her heel). For Flick's nail and Kyra's knot this module puts its own instruction and
// a close-up of the vault (painted background + the real sprites) over that picture. Purely cosmetic: input,
// progress and completion stay with the UI; if the UI's markup ever changes, the gesture simply keeps its default look.
import { loadImage } from '../../art/assets';
import { manifest } from '../../art/manifest';

type Facing = 'left' | 'right' | 'up' | 'down';

export interface GestureFigure {
  /** Character id and pose (a manifest pose, or the walk sheet's idle frame when the pose is missing). */
  id: string;
  pose: string;
  /** Feet position in map pixels of the background. */
  at: readonly [number, number];
  facing: Facing;
  /** Darken the figure (someone in the background, turned away). */
  dim?: boolean;
}

export interface GesturePicture {
  /** Painted background id (assets/bg). */
  background: string;
  /** Map pixel the close-up centres on and its zoom (screen px per map px). */
  focus: readonly [number, number];
  zoom: number;
  figures: GestureFigure[];
  /** Map pixel of the small thing the hand works on (nail head, knot): glints with the gesture's progress. */
  glint: readonly [number, number];
}

const WALK_ROW: Record<Facing, number> = { down: 0, left: 1, right: 2, up: 3 };

/**
 * Re-stages the story gesture that was just opened (call it right after G.ui.storyAction / stealthGame without
 * awaiting first). `picture` is optional: without it only the instruction text changes.
 */
export function restageGesture(kind: string, instruction: string, picture?: GesturePicture): void {
  const root = document.querySelector<HTMLElement>(`.scene-action.action-${kind}:not(.is-complete)`);
  if (!root) return;
  const help = root.querySelector('.action-instruction');
  if (help) help.textContent = instruction;
  if (!picture) return;
  const stage = root.querySelector<HTMLElement>('.action-stage');
  const original = stage?.querySelector<HTMLCanvasElement>('canvas.mini-illustration');
  if (!stage || !original) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'mini-illustration';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', original.getAttribute('aria-label') ?? '');
  stage.prepend(canvas);
  original.style.visibility = 'hidden';
  void draw(root, stage, canvas, picture);
}

async function draw(root: HTMLElement, stage: HTMLElement, canvas: HTMLCanvasElement, pic: GesturePicture): Promise<void> {
  const art = manifest();
  const bgFile = art.backgrounds[pic.background]?.file;
  const background = bgFile ? await loadImage(bgFile) : null;
  const sprites = await Promise.all(pic.figures.map(async f => {
    const entry = art.characters[f.id];
    const pose = entry?.poses[f.pose];
    const file = pose?.file ?? entry?.walk?.file;
    return { f, entry, pose, image: file ? await loadImage(file) : null };
  }));
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const t0 = performance.now();
  const frame = () => {
    if (!root.isConnected || root.classList.contains('is-complete')) return;
    const bounds = stage.getBoundingClientRect();
    if (bounds.width && bounds.height) {
      const h = Math.round(640 * bounds.height / bounds.width);
      if (canvas.width !== 640 || canvas.height !== h) { canvas.width = 640; canvas.height = h; }
      ctx.imageSmoothingEnabled = false;
      const z = pic.zoom, sw = 640 / z, sh = h / z;
      const sx = Math.max(0, Math.min((background?.width ?? 640) - sw, pic.focus[0] - sw / 2));
      const sy = Math.max(0, Math.min((background?.height ?? 360) - sh, pic.focus[1] - sh / 2));
      ctx.fillStyle = '#0b0f17';
      ctx.fillRect(0, 0, 640, h);
      if (background) ctx.drawImage(background, sx, sy, sw, sh, 0, 0, 640, h);
      for (const s of [...sprites].sort((a, b) => a.f.at[1] - b.f.at[1])) {
        if (!s.image || !s.entry) continue;
        const pw = s.pose?.w ?? s.entry.walk?.frameW ?? 64, ph = s.pose?.h ?? s.entry.walk?.frameH ?? 64;
        const foot = s.pose?.foot ?? s.entry.foot ?? [pw / 2, ph - 4];
        const srcX = s.pose ? 0 : ((s.entry.walk?.idle?.[WALK_ROW[s.f.facing]] ?? WALK_ROW[s.f.facing] * 4) % 4) * pw;
        const srcY = s.pose ? 0 : Math.floor((s.entry.walk?.idle?.[WALK_ROW[s.f.facing]] ?? WALK_ROW[s.f.facing] * 4) / 4) * ph;
        const mirror = Boolean(s.pose && (s.f.facing === 'left' || s.f.facing === 'right') && s.pose.facing !== s.f.facing);
        ctx.save();
        ctx.translate((s.f.at[0] - sx) * z, (s.f.at[1] - sy) * z);
        if (mirror) ctx.scale(-1, 1);
        if (s.f.dim) ctx.filter = 'brightness(0.55)';
        ctx.drawImage(s.image, srcX, srcY, pw, ph, -foot[0] * z, -foot[1] * z, pw * z, ph * z);
        ctx.restore();
      }
      // Vignette: the close-up is a held breath.
      const vignette = ctx.createRadialGradient(320, h / 2, h * 0.3, 320, h / 2, 360);
      vignette.addColorStop(0, '#00000000');
      vignette.addColorStop(1, '#000000b0');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, 640, h);
      // The glint on the nail head / the knot grows with the gesture's progress.
      const progress = Number(root.style.getPropertyValue('--action-progress') || 0);
      const time = (performance.now() - t0) / 1000;
      const gx = (pic.glint[0] - sx) * z, gy = (pic.glint[1] - sy) * z;
      const r = 6 + progress * 10 + Math.sin(time * 6) * 1.5;
      const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, r * 2);
      glow.addColorStop(0, '#fff3c4');
      glow.addColorStop(0.35, '#e7b45a99');
      glow.addColorStop(1, '#00000000');
      ctx.save();
      ctx.globalAlpha = 0.35 + progress * 0.55;
      ctx.fillStyle = glow;
      ctx.fillRect(gx - r * 2, gy - r * 2, r * 4, r * 4);
      ctx.restore();
    }
    requestAnimationFrame(frame);
  };
  frame();
}
