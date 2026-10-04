export const GAME_W = 480;
export const GAME_H = 270;

let canvas: HTMLCanvasElement | null = null;
export function setCanvas(c: HTMLCanvasElement): void { canvas = c; }

/** Converts game-canvas coordinates (0..480, 0..270, i.e. camera/screen space) to page (CSS px) coordinates. */
export function canvasToPage(x: number, y: number): { x: number; y: number; scale: number } {
  if (!canvas) return { x, y, scale: 1 };
  const r = canvas.getBoundingClientRect();
  const scale = r.width / GAME_W;
  return { x: r.left + x * scale, y: r.top + y * scale, scale };
}

export function canvasRect(): DOMRect | null { return canvas?.getBoundingClientRect() ?? null; }
