import { G } from '../core/G';
import { manifest } from '../art/manifest';
import { ctx } from './context';
import { el, sfx, wait } from './dom';
import { markSeen } from './gallery';
import { frame, label, parchment } from './plateKit';
import { setImageSource } from './image';
import { stormGrade } from './plateStorm';

type PlateDraw = () => HTMLCanvasElement | string;
type Pan = 'left' | 'right' | 'in' | 'out' | 'none';

interface Rendered { url: string; w: number; h: number; pixel: boolean; }

/**
 * Book plates in an ornate frame with slow pan, letterbox and caption. Sources, in this order:
 * 1. a painted plate image from the asset manifest (G.art.hasAsset('plate', id) → G.art.plateUrl(id), 1280x720),
 * 2. a code-drawn plate registered with registerPlate(id, draw),
 * 3. the image at G.art.plateUrl(id) even if the manifest does not list it yet,
 * 4. a neutral parchment placeholder (with a console warning).
 */
export class PlateUi {
  private registry = new Map<string, PlateDraw>();
  private cache = new Map<string, Rendered>();
  private storms = new Map<string, Promise<string | null>>();
  private current: { root: HTMLElement; close: () => void; hadLetterbox: boolean; img: HTMLImageElement; layers: HTMLImageElement[]; pan: Pan; dur: number; portrait: boolean; started: number } | null = null;
  constructor(private letterbox: (on: boolean) => void) {
    ctx.onLayout(() => this.fit());
  }

  register(id: string, draw: PlateDraw): void {
    this.registry.set(id, draw);
    this.cache.delete(id);
  }

  has(id: string): boolean { return this.registry.has(id); }
  ids(): string[] { return [...this.registry.keys()]; }

  private renderDrawn(id: string): Rendered | null {
    const draw = this.registry.get(id);
    if (!draw) return null;
    try {
      const res = draw();
      if (typeof res === 'string') return { url: res, w: 1600, h: 900, pixel: false };
      return { url: res.toDataURL('image/png'), w: res.width, h: res.height, pixel: res.width < 800 };
    } catch (err) {
      console.error(`[ui] plate ${id} failed to draw`, err);
      return null;
    }
  }

  private async resolve(id: string): Promise<Rendered> {
    const cached = this.cache.get(id);
    if (cached) return cached;
    let out: Rendered | null = null;
    let hasImage = false;
    try { hasImage = Boolean(G.art?.hasAsset?.('plate', id)); } catch { hasImage = false; }
    if (hasImage) out = await loadImage(plateUrl(id));
    if (!out) out = this.renderDrawn(id);
    if (!out && !hasImage) out = await loadImage(plateUrl(id), true);
    if (!out) {
      console.warn(`[ui] plate "${id}" has no image and is not registered (registerPlate)`);
      const c = fallback(id);
      out = { url: c.toDataURL(), w: c.width, h: c.height, pixel: false };
    }
    this.cache.set(id, out);
    return out;
  }

  /** Starts loading a plate ahead of time (e.g. while a dialogue runs), so plate() opens without delay. */
  prefetch(id: string): void { void this.resolve(id); }

  async show(id: string, opts: { caption?: string; pan?: Pan; durationMs?: number } = {}): Promise<void> {
    const known = manifest().plates[id];
    // Plates draw text with the UI fonts: make sure they are loaded before the first render.
    if (!known && !this.cache.has(id)) { try {
      const f = document.fonts;
      if (f) await Promise.race([Promise.all(['700 32px Cinzel', '500 32px Cinzel', '500 32px Alegreya', 'italic 500 32px Alegreya'].map(spec => f.load(spec))), new Promise(r => setTimeout(r, 1500))]);
    } catch { /* fonts optional */ } }
    const r: Rendered = known ? { url: plateUrl(id), w: known.w, h: known.h, pixel: known.w < 800 } : await this.resolve(id);
    markSeen('plate', id, opts.caption);
    const previous = this.current;
    const root = el('div', 'plate');
    const frameEl = el('div', 'plate-frame');
    const view = el('div', 'plate-view');
    const img = el('img', r.pixel ? 'plate-img px' : 'plate-img');
    setImageSource(img, r.url);
    img.alt = opts.caption ?? '';
    img.draggable = false;
    view.appendChild(img);
    view.appendChild(el('div', 'plate-vignette'));
    frameEl.appendChild(view);
    for (const c of ['tl', 'tr', 'bl', 'br']) frameEl.appendChild(el('span', `plate-corner ${c}`));
    if (opts.caption) {
      const cap = el('div', 'plate-caption ch-parch');
      cap.appendChild(el('span', 'plate-caption-text', opts.caption));
      frameEl.appendChild(cap);
    }
    root.appendChild(frameEl);
    root.style.setProperty('--ar', String(r.w / r.h));
    ctx.layers.plate.appendChild(root);
    this.fitOne(root, r.w / r.h);
    if (!known) { try { await img.decode(); } catch { /* drawn fallback */ } }
    else void this.resolve(id).then(resolved => {
      if (!img.isConnected) return;
      setImageSource(img, resolved.url);
      img.classList.toggle('px', resolved.pixel);
    });

    const hadLetterbox = previous?.hadLetterbox ?? ctx.root.classList.contains('has-letterbox');
    this.letterbox(true);
    const close = previous ? previous.close : ctx.open({ id: 'plate', allowMenu: true });
    // Slow pan (Ken Burns), never with reduced motion.
    const pan = ctx.reducedMotion ? 'none' : (opts.pan ?? 'in');
    const dur = opts.durationMs ?? 16000;
    this.current = { root, close, hadLetterbox, img, layers: [], pan, dur, portrait: ctx.portrait, started: performance.now() };
    applyPan(img, pan, dur, ctx.portrait);

    sfx('page', { volume: 0.5, pitch: 0.85 });
    requestAnimationFrame(() => root.classList.add('is-in'));
    if (previous) {
      previous.root.classList.remove('is-in');
      previous.root.classList.add('is-out');
      setTimeout(() => previous.root.remove(), 900);
    }
    await wait(ctx.reducedMotion ? 200 : 900);
  }

  async close(): Promise<void> {
    const cur = this.current;
    if (!cur) return;
    this.current = null;
    cur.root.classList.remove('is-in');
    cur.root.classList.add('is-out');
    if (!cur.hadLetterbox) this.letterbox(false);
    await wait(ctx.reducedMotion ? 200 : 750);
    cur.root.remove();
    cur.close();
  }

  /**
   * The sky of the open plate darkens to a storm sky over `ms`, flickering as if lit by the lightning; the lightning
   * itself stays bright. The graded picture lies on top of the plate and pans with it. Resolves once dark.
   */
  async storm(ms = 7000): Promise<void> {
    const cur = this.current;
    if (!cur) return;
    // Grade the full picture, not the Blurhash placeholder that may still be shown while it loads.
    const url = await this.stormUrl(cur.img.dataset.imageSource ?? cur.img.src);
    if (!url || this.current !== cur) return;
    const layer = el('div', 'plate-storm');
    const img = el('img', cur.img.className);
    img.src = url;
    img.alt = '';
    img.draggable = false;
    layer.appendChild(img);
    cur.img.after(layer);
    try { await img.decode(); } catch { /* shows on load */ }
    if (this.current !== cur) return;
    cur.layers.push(img);
    followPan(img, cur.img);
    // Short brightenings while it darkens: the bolts light up the clouds (no flicker with reduced motion).
    const frames: Keyframe[] = ctx.reducedMotion
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [
          { opacity: 0, offset: 0 }, { opacity: 0.42, offset: 0.3 }, { opacity: 0.16, offset: 0.35 },
          { opacity: 0.5, offset: 0.43 }, { opacity: 0.78, offset: 0.68 }, { opacity: 0.56, offset: 0.72 },
          { opacity: 0.86, offset: 0.8 }, { opacity: 1, offset: 1 },
        ];
    const fade = layer.animate(frames, { duration: ms, easing: 'ease-in-out', fill: 'forwards' });
    try { await fade.finished; } catch { /* plate closed meanwhile */ }
  }

  /** Storm-graded copy of a plate image (cached per image), null when the pixels cannot be read. */
  private stormUrl(url: string): Promise<string | null> {
    let job = this.storms.get(url);
    if (!job) {
      job = (async () => {
        try {
          const src = new Image();
          src.src = url;
          await src.decode();
          const w = src.naturalWidth, h = src.naturalHeight;
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const g = canvas.getContext('2d', { willReadFrequently: true });
          if (!g || !w || !h) return null;
          g.drawImage(src, 0, 0);
          const data = g.getImageData(0, 0, w, h);
          data.data.set(stormGrade(data.data, w, h));
          g.putImageData(data, 0, 0);
          const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
          return blob ? URL.createObjectURL(blob) : null;
        } catch (err) {
          console.warn('[ui] plate storm grade failed', err);
          return null;
        }
      })();
      this.storms.set(url, job);
    }
    return job;
  }

  clear(): void {
    if (!this.current) return;
    this.current.root.remove();
    this.current.close();
    this.current = null;
  }

  get open(): boolean { return this.current !== null; }

  private fit(): void {
    const cur = this.current;
    if (!cur) return;
    this.fitOne(cur.root, Number(cur.root.style.getPropertyValue('--ar')) || 16 / 9);
    if (cur.portrait !== ctx.portrait) {
      // Orientation changed: continue the pan in the new framing.
      cur.portrait = ctx.portrait;
      cur.img.getAnimations().forEach(a => a.cancel());
      const left = Math.max(2000, cur.dur - (performance.now() - cur.started));
      applyPan(cur.img, cur.pan, left, cur.portrait);
      for (const layer of cur.layers) followPan(layer, cur.img);
    }
  }

  /**
   * Fits the frame between the letterbox bar (plus caption) and the dialogue dock, so a dialogue over the
   * plate never covers it. Portrait phones get a taller 4:5 window that the pan travels across.
   */
  private fitOne(root: HTMLElement, ar: number): void {
    const s = ctx.stage;
    const em = ctx.fontPx;
    const portrait = ctx.portrait;
    const vw = window.innerWidth, vh = window.innerHeight;
    const small = Math.min(vw, vh) < 560;
    const frameEl = root.firstElementChild as HTMLElement;
    const caption = root.querySelector('.plate-caption') ? em * 1.5 : em * 0.5;
    let w: number, h: number, top: number, bottom: number;
    if (portrait) {
      top = em * 4.4 + caption;                 // below the HUD row
      bottom = vh - em * 9.2;                   // above the dialogue box
      const viewAr = Math.min(ar, 4 / 5);
      w = vw - 24; h = w / viewAr;
      if (h > bottom - top) { h = bottom - top; w = Math.min(vw - 24, h * viewAr); }
    } else {
      top = s.y + s.h * 0.105 + caption;        // below the letterbox bar
      bottom = Math.min(s.y + s.h * 0.895, vh - em * (small ? 8.2 : 10.5));
      const availW = s.w * 0.84;
      const availH = Math.min(s.h * 0.66, bottom - top);
      w = availW; h = w / ar;
      if (h > availH) { h = availH; w = h * ar; }
    }
    frameEl.style.width = `${Math.round(w)}px`;
    frameEl.style.height = `${Math.round(h)}px`;
    const cx = portrait ? vw / 2 : s.x + s.w / 2;
    const cy = Math.max(top + h / 2, (top + bottom) / 2);
    frameEl.style.left = `${Math.round(cx - w / 2)}px`;
    frameEl.style.top = `${Math.round(cy - h / 2)}px`;
    root.classList.toggle('is-tall', portrait);
  }
}

/**
 * Pan keyframes. Landscape: at most 4 % crop per side (keep labels inside plateKit's SAFE inset).
 * Portrait (4:5 window over a wide plate): the window travels across the picture via object-position.
 */
function applyPan(img: HTMLImageElement, pan: Pan, dur: number, portrait: boolean): void {
  const ease = 'cubic-bezier(.45,.05,.55,.95)';
  let frames: Keyframe[];
  if (portrait) {
    const travel: Record<Pan, [string, string]> = { left: ['78% 50%', '22% 50%'], right: ['22% 50%', '78% 50%'], in: ['35% 50%', '65% 50%'], out: ['65% 50%', '35% 50%'], none: ['50% 50%', '50% 50%'] };
    const [a, b] = travel[pan];
    const zoom = pan === 'in' ? ['scale(1)', 'scale(1.06)'] : pan === 'out' ? ['scale(1.06)', 'scale(1)'] : ['scale(1)', 'scale(1)'];
    frames = [{ objectPosition: a, transform: zoom[0] }, { objectPosition: b, transform: zoom[1] }];
  } else {
    const set: Record<Pan, [string, string]> = {
      left: ['scale(1.06) translateX(2%)', 'scale(1.06) translateX(-2%)'],
      right: ['scale(1.06) translateX(-2%)', 'scale(1.06) translateX(2%)'],
      in: ['scale(1.0)', 'scale(1.08)'],
      out: ['scale(1.08)', 'scale(1.0)'],
      none: ['scale(1.0)', 'scale(1.0)'],
    };
    frames = [{ transform: set[pan][0], objectPosition: '50% 50%' }, { transform: set[pan][1], objectPosition: '50% 50%' }];
  }
  img.animate(frames, { duration: dur, easing: ease, fill: 'forwards' });
}

/** Runs the same pan as `source` on `target`, at the same point in time (overlay layers of a plate). */
function followPan(target: HTMLImageElement, source: HTMLImageElement): void {
  target.getAnimations().forEach(a => a.cancel());
  const pan = source.getAnimations()[0];
  if (!(pan?.effect instanceof KeyframeEffect)) return;
  const copy = target.animate(pan.effect.getKeyframes(), pan.effect.getTiming());
  copy.currentTime = pan.currentTime;
}

function plateUrl(id: string): string {
  try { return G.art?.plateUrl?.(id) ?? `assets/cut/${id}.jpg`; } catch { return `assets/cut/${id}.jpg`; }
}

/** Loads and decodes a plate image (null when missing). `quiet`: a miss is expected (no warning). */
function loadImage(url: string, quiet = false): Promise<Rendered | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.decoding = 'async';
    let done = false;
    const finish = (r: Rendered | null) => { if (!done) { done = true; resolve(r); } };
    img.onload = () => {
      const ok = img.naturalWidth > 0;
      if (!ok && !quiet) console.warn(`[ui] plate image ${url} is empty`);
      const ready = () => finish(ok ? { url, w: img.naturalWidth, h: img.naturalHeight, pixel: img.naturalWidth < 800 } : null);
      img.decode().then(ready, ready);
    };
    img.onerror = () => { if (!quiet) console.warn(`[ui] plate image ${url} failed to load`); finish(null); };
    setTimeout(() => finish(null), 8000);
    img.src = url;
  });
}

function fallback(id: string): HTMLCanvasElement {
  const { canvas, g } = parchment(1600, 900, id.length * 31 + 5);
  frame(g, 1600, 900);
  label(g, '❦', 800, 400, { size: 90, color: 'rgba(43,33,25,0.35)' });
  label(g, id, 800, 520, { size: 34, font: 'italic', color: 'rgba(43,33,25,0.5)' });
  return canvas;
}
