/** Small deterministic PRNG (mulberry32). State is a plain number so battles can be snapshotted. */
export class Rng {
  state: number;
  constructor(seed = 1) { this.state = seed >>> 0 || 1; }
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** True with `percent` chance (0..100). */
  chance(percent: number): boolean { return this.next() * 100 < percent; }
  int(min: number, max: number): number { return min + Math.floor(this.next() * (max - min + 1)); }
}
