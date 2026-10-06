import { describe, expect, it, vi } from 'vitest';
import { voiceover } from '../audio/voiceover';
import { createUi } from './index';

vi.mock('./context', () => ({ ctx: { stale: () => false, busy: () => true } }));
vi.mock('./speakers', () => ({ registerDefaultSpeakers: vi.fn() }));

describe('ambient bubble priority', () => {
  it('drops a late NPC or guard bark during a story modal before touching caption DOM, anchors or audio', () => {
    const play = vi.spyOn(voiceover, 'play');
    const anchor = vi.fn(() => ({ x: 100, y: 100 }));
    // An unmounted UI has no caption host. A suppressed ambient request must
    // still return a safe remover without creating a visual or audio side effect.
    const ui = createUi();
    const remove = ui.bubble('Ist da jemand?', anchor, 1800, { speaker: 'algard' });
    expect(typeof remove).toBe('function'); expect(() => remove()).not.toThrow();
    expect(anchor).not.toHaveBeenCalled(); expect(play).not.toHaveBeenCalled();
    play.mockRestore();
  });
});
