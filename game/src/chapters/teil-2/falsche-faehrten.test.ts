import { describe, expect, it } from 'vitest';
import { PROBES } from './falsche-faehrten';

describe('Falsche Fährten', () => {
  it('every question has harmless memories that fit and at least one that leads to Lia', () => {
    for (const p of PROBES) {
      expect(p.trails.some(t => t.ok), p.id).toBe(true);
      expect(p.trails.some(t => !t.ok), p.id).toBe(true);
      expect(new Set(p.trails.map(t => t.id)).size).toBe(p.trails.length);
      for (const t of p.trails) expect(t.reply.length).toBeGreaterThan(20);
    }
  });
});
