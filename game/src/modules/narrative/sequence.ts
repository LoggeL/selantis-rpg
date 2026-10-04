/** Data-only sequences expose readiness; only explicit advance consumes a beat. */
export interface SequenceSnapshot {
  index: number;
  total: number;
  status: 'idle' | 'active' | 'complete' | 'cancelled' | 'disposed';
  ready: boolean;
}
export interface SequenceAdapter<T> {
  enter: (beat: T, index: number, ready: () => void) => void | (() => void);
  complete?: () => void;
}

/** Owns callback lifetime without owning a scene clock, renderer or input device. */
export class SequenceRunner<T> {
  private index = -1;
  private status: SequenceSnapshot['status'] = 'idle';
  private ready = false;
  private generation = 0;
  private cleanup?: () => void;

  constructor(private readonly beats: readonly T[], private readonly adapter: SequenceAdapter<T>) {}

  get snapshot(): SequenceSnapshot { return { index: this.index, total: this.beats.length, status: this.status, ready: this.ready }; }
  start(): boolean {
    if (this.status !== 'idle') return false;
    this.status = 'active';
    this.enter(0);
    return true;
  }
  advance(): boolean {
    if (this.status !== 'active' || !this.ready) return false;
    this.ready = false;
    this.enter(this.index + 1);
    return true;
  }
  /** Continuations are tied to the visible beat, so duplicate old clicks are inert. */
  continuation(): () => void {
    const generation = this.generation;
    return () => { if (generation === this.generation) this.advance(); };
  }
  cancel(): void {
    if (this.status === 'disposed' || this.status === 'cancelled' || this.status === 'complete') return;
    this.invalidate();
    this.status = 'cancelled';
  }
  dispose(): void {
    if (this.status === 'disposed') return;
    this.invalidate();
    this.status = 'disposed';
  }
  private invalidate() {
    ++this.generation;
    this.ready = false;
    const cleanup = this.cleanup;
    this.cleanup = undefined;
    cleanup?.();
  }
  private enter(index: number) {
    this.invalidate();
    this.index = index;
    if (index >= this.beats.length) {
      this.status = 'complete';
      this.adapter.complete?.();
      return;
    }
    const generation = this.generation;
    const cleanup = this.adapter.enter(this.beats[index], index, () => {
      if (generation === this.generation && this.status === 'active') this.ready = true;
    });
    // An adapter can cancel synchronously while rendering a beat.
    if (generation === this.generation && this.status === 'active') this.cleanup = cleanup || undefined;
    else cleanup?.();
  }
}
