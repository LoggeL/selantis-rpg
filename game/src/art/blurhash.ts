import { decode } from 'blurhash';
import hashes from './blurhashes.json';

export interface PreviewHash { hash: string; alphaHash?: string }
export interface PreviewFrame extends PreviewHash { x: number; y: number; width: number; height: number }
export interface PreviewInfo extends PreviewHash { width: number; height: number; frames?: PreviewFrame[] }
const registry: Record<string, PreviewInfo> = hashes;
const decoded = new Map<string, HTMLCanvasElement>();
const canvases = new Map<string, HTMLCanvasElement>();
const urls = new Map<string, string>();

/** Resolve only local public assets, including Vite base paths and cache-busting queries. */
export function previewInfo(file: string): PreviewInfo | null {
  if (/^(data:|blob:)/i.test(file)) return null;
  let path = file.split(/[?#]/)[0];
  if (/^(https?:)?\/\//i.test(path)) {
    try {
      const url = new URL(path, typeof location === 'undefined' ? 'http://localhost' : location.href);
      if (typeof location === 'undefined' || url.origin !== location.origin) return null;
      path = url.pathname;
    } catch { return null; }
  }
  try { path = decodeURIComponent(path); } catch { return null; }
  const base = (import.meta.env?.BASE_URL ?? '/').replace(/^\/+|\/+$/g, '');
  path = path.replace(/^\.?\//, '');
  if (base && path.startsWith(`${base}/`)) path = path.slice(base.length + 1);
  return registry[path] ?? null;
}

function thumbnail(info: PreviewHash, width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const scale = Math.min(1, 32 / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
  const key = `${info.hash}:${info.alphaHash ?? ''}:${w}:${h}`;
  const cached = decoded.get(key);
  if (cached) return cached;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const pixels = decode(info.hash, w, h);
    if (info.alphaHash) {
      const alpha = decode(info.alphaHash, w, h);
      for (let p = 0; p < pixels.length; p += 4) pixels[p + 3] = alpha[p];
    }
    const image = ctx.createImageData(w, h);
    image.data.set(pixels);
    ctx.putImageData(image, 0, 0);
    decoded.set(key, canvas);
    if (decoded.size > 256) decoded.delete(decoded.keys().next().value!);
    return canvas;
  } catch { return null; }
}

/** Paint full images or individual atlas cells without blurring between animation frames. */
export function drawPreview(ctx: CanvasRenderingContext2D, file: string, x: number, y: number, w: number, h: number,
  grid?: { w: number; h: number; count: number; cols: number } | null, flip = false): boolean {
  const info = previewInfo(file);
  if (!info) return false;
  const paint = (source: HTMLCanvasElement, dx: number, dy: number, dw: number, dh: number) => {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    if (flip) { ctx.translate(dx + dw, dy); ctx.scale(-1, 1); ctx.drawImage(source, 0, 0, dw, dh); }
    else ctx.drawImage(source, dx, dy, dw, dh);
    ctx.restore();
  };
  if (info.frames?.length) {
    for (let i = 0; i < (grid?.count ?? info.frames.length); i++) {
      const frame = info.frames[i];
      if (!frame) continue;
      const source = thumbnail(frame, frame.width, frame.height);
      if (!source) continue;
      const dx = grid ? (i % grid.cols) * grid.w : frame.x * w / info.width;
      const dy = grid ? Math.floor(i / grid.cols) * grid.h : frame.y * h / info.height;
      paint(source, x + dx, y + dy, grid?.w ?? frame.width * w / info.width, grid?.h ?? frame.height * h / info.height);
    }
    return true;
  }
  const source = thumbnail(info, info.width, info.height);
  if (!source) return false;
  paint(source, x, y, w, h);
  return true;
}

/** A source with native geometry for existing canvas code that crops sprite sheets. */
export function previewCanvas(file: string): HTMLCanvasElement | null {
  const info = previewInfo(file);
  if (!info || typeof document === 'undefined') return null;
  const cached = canvases.get(file);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = info.width; canvas.height = info.height;
  const ctx = canvas.getContext('2d');
  if (!ctx || !drawPreview(ctx, file, 0, 0, info.width, info.height)) return null;
  canvases.set(file, canvas);
  if (canvases.size > 24) canvases.delete(canvases.keys().next().value!);
  return canvas;
}

/** Tiny inline PNG decoded locally from the hash, no preview image request. */
export function previewDataUrl(file: string): string | null {
  const info = previewInfo(file);
  if (!info) return null;
  const key = `${info.hash}:${info.alphaHash ?? ''}:${info.width}:${info.height}`;
  let url = urls.get(key);
  if (!url) {
    const source = thumbnail(info, info.width, info.height);
    if (!source) return null;
    url = source.toDataURL('image/png');
    urls.set(key, url);
  }
  return url;
}
