import { describe, expect, it } from 'vitest';
import { MapMemory, memoryKey, type MemoryStore } from './memory';

function store(): MemoryStore & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return { data, read: k => data[k], write: (k, v) => { data[k] = v; } };
}

describe('MapMemory', () => {
  it('remembers used interactables and lighting across loads', () => {
    const s = store();
    const m = MapMemory.load('farm', s);
    m.add('used', 'apfelbaum');
    m.add('triggers', 'nacht');
    m.setTime('night');
    const again = MapMemory.load('farm', s);
    expect(again.has('used', 'apfelbaum')).toBe(true);
    expect(again.has('triggers', 'nacht')).toBe(true);
    expect(again.time).toBe('night');
    expect(again.has('used', 'other')).toBe(false);
  });
  it('keeps maps apart and writes under world.mem.<id>', () => {
    const s = store();
    MapMemory.load('a', s).add('props', 'kiste');
    expect(Object.keys(s.data)).toEqual([memoryKey('a')]);
    expect(MapMemory.load('b', s).has('props', 'kiste')).toBe(false);
  });
  it('clear() forgets everything and tolerates broken data', () => {
    const s = store();
    const m = MapMemory.load('a', s);
    m.add('clues', 'spur'); m.setWeather('rain');
    m.clear();
    expect(MapMemory.load('a', s).empty).toBe(true);
    s.data[memoryKey('x')] = '{broken';
    expect(MapMemory.load('x', s).empty).toBe(true);
  });
  it('delete() re-enables a disabled object', () => {
    const s = store();
    const m = MapMemory.load('a', s);
    m.add('off', 'tor'); m.delete('off', 'tor');
    expect(MapMemory.load('a', s).has('off', 'tor')).toBe(false);
  });
});
