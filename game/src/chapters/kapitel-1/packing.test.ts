import { describe, expect, it } from 'vitest';
import { add, canAdd, CAPACITY, remove, settle, used, verdict } from './packing';

const ownAll = (id: string) => (id === 'apple' ? 3 : 1);

describe('kapitel-1 packing', () => {
  it('counts room by size', () => {
    expect(used({})).toBe(0);
    expect(used({ 'book-herbs': 1, tinder: 1 })).toBe(3);
    expect(used({ apple: 2 })).toBe(2);
  });

  it('allows both books (the novel choice) but then nothing else', () => {
    let s = add({}, 'book-herbs', ownAll);
    s = add(s, 'book-alana', ownAll);
    expect(used(s)).toBe(CAPACITY);
    expect(canAdd(s, 'tinder', ownAll)).toBe(false);
    expect(add(s, 'tinder', ownAll)).toBe(s);
  });

  it('never packs more than Lia owns', () => {
    const own = (id: string) => (id === 'apple' ? 1 : id === 'book-alana' ? 0 : 1);
    let s = add({}, 'apple', own);
    expect(canAdd(s, 'apple', own)).toBe(false);
    expect(canAdd(s, 'book-alana', own)).toBe(false);
    s = remove(s, 'apple');
    expect(s).toEqual({});
  });

  it('settles the inventory: fixed items given, unpacked extras taken', () => {
    const inv: Record<string, number> = { 'book-alana': 1, apple: 3, coins: 1, dagger: 1, tincture: 1, flowers: 1 };
    const has = (id: string) => inv[id] ?? 0;
    const own = (id: string) => has(id) + (id === 'book-herbs' || id === 'tinder' ? 1 : 0);
    const { give, take } = settle({ tinder: 1, apple: 1, 'book-herbs': 1 }, own, has);
    expect(give).toEqual({ bread: 2, cheese: 1, bacon: 1, waterskin: 1, blanket: 1, cloak: 1 });
    expect(take).toEqual({ 'book-alana': 1, apple: 2 });
  });

  it('comments on the missing tinder', () => {
    expect(verdict({ 'book-herbs': 1, 'book-alana': 1 }).join(' ')).toMatch(/Zunder/);
    expect(verdict({ tinder: 1 }).join(' ')).toMatch(/Buch/);
  });
});
