/** Fit the logical pixel canvas without cropping, including sub-640px phones. */
export function fitGameScale(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 0;
  const fit = Math.min(width / 640, height / 360);
  return fit >= 1 ? Math.floor(fit) : Math.floor(fit * 10000) / 10000;
}
