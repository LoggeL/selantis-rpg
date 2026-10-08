import { pal } from './palette';
import type { Pix } from './pixels';

/** The story hill's slender wooden stand: square tray, narrow stem and splayed feet in iso space. */
export function paintRitualStand(p: Pix, variant: number): void {
  const wood = (n: number) => pal('wood', n);
  p.ellipse(16, 42, 12, 3, pal('ink', 0), 0.25);
  // Four feet, seen along the isometric diagonals, and the two lit faces of the stem.
  for (let i = 0; i < 10; i++) {
    p.rect(15 - i, 36 + Math.floor(i / 2), 3, 2, wood(1));
    p.rect(16 + i, 36 + Math.floor(i / 2), 3, 2, wood(3));
  }
  p.rect(13, 16, 6, 25, wood(1));
  p.rect(16, 16, 3, 24, wood(3));
  p.rect(17, 19, 1, 17, wood(4));
  // A square top projects to a 2:1 diamond, with a thick front rim and visible planks.
  for (let y = 0; y <= 12; y++) {
    const half = Math.min(y, 12 - y) * 2;
    p.rect(16 - half, 7 + y, half * 2 + 1, 3, wood(y < 6 ? 2 : 0));
  }
  for (let y = 0; y <= 12; y++) {
    const half = Math.min(y, 12 - y) * 2;
    for (let x = 16 - half; x <= 16 + half; x++) {
      const edge = x === 16 - half || x === 16 + half || y === 0 || y === 12;
      p.set(x, 7 + y, wood(edge ? 4 : ((x + y * 2) % 9 === 0 ? 1 : 3)));
    }
  }
  // Small angular relic on the tray, rather than a round practice-target head.
  const relicX = 15 + (variant % 2);
  p.rect(relicX, 3, 3, 8, pal('coal', 1));
  p.set(relicX + 1, 2, pal('coal', 2));
  p.set(relicX + 2, 6, pal('urmacht', 2));
}
