import { beforeAll, describe, expect, it, vi } from 'vitest';
import { events } from '../core/events';
import { defineChapter } from '../core/registry';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

const scene = (id: string) => ({ id, title: id, start: () => {} });
defineChapter({ id: 'u-test-1', order: 901, numeral: 'I', title: 'Eins', scenes: [scene('u-a'), scene('u-b')] });
defineChapter({ id: 'u-test-2', order: 902, numeral: 'II', title: 'Zwei', scenes: [scene('u-c')] });
defineChapter({ id: 'u-dev', order: 903, numeral: 'Dev', title: 'Dev', hidden: true, scenes: [scene('u-dev-a')] });

let U: typeof import('./unlocks');
beforeAll(async () => {
  // An existing campaign save at u-b: everything before it counts as reached on the first run.
  store.set('selantis.save.v1', JSON.stringify({ scene: 'u-b' }));
  U = await import('./unlocks');
  U.trackProgress();
});

describe('chapter unlocks', () => {
  it('seeds reached scenes from an existing save', () => {
    expect(U.sceneUnlocked('u-a')).toBe(true);
    expect(U.sceneUnlocked('u-b')).toBe(true);
    expect(U.sceneUnlocked('u-c')).toBe(false);
  });

  it('records scenes the story enters, but not dev scenes', () => {
    events.emit('scene:goto', { id: 'u-c', chapter: 'u-test-2' });
    events.emit('scene:goto', { id: 'u-dev-a', chapter: 'u-dev' });
    expect(U.sceneUnlocked('u-c')).toBe(true);
    expect(JSON.parse(store.get('selantis.progress.v1')!).reached).toEqual(['u-a', 'u-b', 'u-c']);
  });

  it('the cheat code unlocks everything and persists', () => {
    const input = U.cheatInput();
    const keys = ['ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'A'];
    const hits = keys.map(key => input({ key } as KeyboardEvent));
    expect(hits.lastIndexOf(true)).toBe(keys.length - 1);
    expect(hits.filter(Boolean)).toHaveLength(1);
    U.unlockEverything();
    expect(U.everythingUnlocked()).toBe(true);
    expect(U.sceneUnlocked('u-dev-a')).toBe(true);
    expect(JSON.parse(store.get('selantis.progress.v1')!).all).toBe(true);
  });
});
