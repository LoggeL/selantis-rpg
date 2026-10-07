export const BASE_GAME_W = 640;
export const BASE_GAME_H = 360;
export let GAME_W = BASE_GAME_W;
export let GAME_H = BASE_GAME_H;

/** Keep pixel scale while showing more world on landscape displays. Portrait retains its reading layout. */
export function gameSizeForViewport(width: number, height: number): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || height > width * 1.05) {
    return { width: BASE_GAME_W, height: BASE_GAME_H };
  }
  const scale = Math.min(width / BASE_GAME_W, height / BASE_GAME_H);
  return { width: Math.round(width / scale), height: Math.round(height / scale) };
}

export function setViewportSize(width: number, height: number): boolean {
  const size = gameSizeForViewport(width, height);
  if (GAME_W === size.width && GAME_H === size.height) return false;
  GAME_W = size.width; GAME_H = size.height;
  return true;
}

let canvas: HTMLCanvasElement | null = null;
export function setCanvas(c: HTMLCanvasElement): void { canvas = c; }

/** Converts game-canvas coordinates (current camera/screen space) to page (CSS px) coordinates. */
export function canvasToPage(x: number, y: number): { x: number; y: number; scale: number } {
  if (!canvas) return { x, y, scale: 1 };
  const r = canvas.getBoundingClientRect();
  const scale = r.width / GAME_W;
  return { x: r.left + x * scale, y: r.top + y * scale, scale };
}

export function canvasRect(): DOMRect | null { return canvas?.getBoundingClientRect() ?? null; }
