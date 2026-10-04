import { describe, expect, it, vi } from 'vitest';
import { ApplicationLifetime } from "./lifetime";

describe('application lifetime', () => {
  it('cleans resources once in reverse order and disposes late registrations immediately', () => {
    const lifetime = new ApplicationLifetime();
    const calls: string[] = [];
    lifetime.add(() => calls.push('first'));
    lifetime.add(() => calls.push('second'));
    lifetime.dispose(); lifetime.dispose();
    lifetime.add(() => calls.push('late'));
    expect(calls).toEqual(['second', 'first', 'late']);
  });

  it('still removes all resources when one cleanup fails', () => {
    const lifetime = new ApplicationLifetime();
    const cleanup = vi.fn();
    lifetime.add(cleanup);
    lifetime.add(() => { throw new Error('cleanup'); });
    expect(lifetime.dispose).toThrow(AggregateError);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(lifetime.dispose).not.toThrow();
  });
});
