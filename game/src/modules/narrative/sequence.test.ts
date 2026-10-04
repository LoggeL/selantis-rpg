import { describe, expect, it, vi } from 'vitest';
import { SequenceRunner } from "./sequence";

describe('manual narrative sequence', () => {
  it('requires readiness and consumes every continuation only once', () => {
    const entered: string[] = [];
    let ready = () => {};
    const complete = vi.fn();
    const sequence = new SequenceRunner(['first', 'second'], { enter: (beat, _index, unlock) => { entered.push(beat); ready = unlock; }, complete });
    expect(sequence.start()).toBe(true);
    expect(sequence.start()).toBe(false);
    expect(sequence.advance()).toBe(false);
    const stale = sequence.continuation();
    ready();
    expect(entered).toEqual(['first']);
    stale(); stale();
    expect(entered).toEqual(['first', 'second']);
    ready();
    const last = sequence.continuation();
    last(); last();
    expect(complete).toHaveBeenCalledOnce();
    expect(sequence.snapshot).toMatchObject({ status: 'complete', ready: false });
  });
  it.each(['cancel', 'dispose'] as const)('invalidates asynchronous readiness and cleans up on %s', method => {
    const cleanup = vi.fn();
    const complete = vi.fn();
    let ready = () => {};
    const sequence = new SequenceRunner([1], { enter: (_beat, _index, unlock) => { ready = unlock; return cleanup; }, complete });
    sequence.start();
    const stale = sequence.continuation();
    sequence[method](); sequence[method]();
    ready(); stale();
    expect(sequence.snapshot.ready).toBe(false);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(complete).not.toHaveBeenCalled();
  });
  it('finishes an empty sequence once and cleans up a beat before rendering its successor', () => {
    const order: string[] = [];
    const complete = vi.fn();
    new SequenceRunner([], { enter: vi.fn(), complete }).start();
    expect(complete).toHaveBeenCalledOnce();
    const sequence = new SequenceRunner([1, 2], { enter: (beat, _index, ready) => { order.push(`enter:${beat}`); ready(); return () => order.push(`leave:${beat}`); } });
    sequence.start(); sequence.advance(); sequence.dispose();
    expect(order).toEqual(['enter:1', 'leave:1', 'enter:2', 'leave:2']);
  });
});
