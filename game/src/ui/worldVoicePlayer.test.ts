import { describe, expect, it } from 'vitest';
import { WorldVoicePlayer } from './worldVoicePlayer';

function activeWorld(speaker: string) {
  const owner = { alive: true, active: true, player: { speaker }, sys: { isActive: () => owner.active } };
  return owner;
}

describe('current world player voice', () => {
  it('does not borrow a running world before it is ready for this story scene', () => {
    const voices = new WorldVoicePlayer();
    expect(voices.speaker('e2-aufbruch', activeWorld('e2-flick-gefangen'))).toBeUndefined();
  });

  it('follows Flick to Lia across maps within e2-aufbruch instead of retaining the first actor', () => {
    const voices = new WorldVoicePlayer();
    const world = activeWorld('e2-flick-gefangen');
    voices.ready('e2-aufbruch', world);
    expect(voices.speaker('e2-aufbruch', world)).toBe('e2-flick-gefangen');
    world.player = { speaker: 'e2-lia-stab' };
    expect(voices.speaker('e2-aufbruch', world)).toBe('e2-lia-stab');
  });

  it('clears the old player at scene:goto even when the old world is still running', () => {
    const voices = new WorldVoicePlayer();
    const world = activeWorld('e2-flick-gefangen');
    voices.ready('e2-aufbruch', world);
    expect(voices.speaker('e2-kontrolle', world)).toBeUndefined();
    voices.sceneChanged();
    expect(voices.speaker('e2-aufbruch', world)).toBeUndefined();
    expect(voices.speaker('e2-kontrolle', world)).toBeUndefined();
    world.player = { speaker: 'e2-elnon-gefangen' };
    voices.ready('e2-kontrolle', world);
    expect(voices.speaker('e2-kontrolle', world)).toBe('e2-elnon-gefangen');
  });

  it('does not use a stopped, inactive, removed or replacement world', () => {
    const voices = new WorldVoicePlayer();
    const world = activeWorld('kyra');
    voices.ready('e2-pfad', world);
    world.alive = false;
    expect(voices.speaker('e2-pfad', world)).toBeUndefined();
    world.alive = true; world.active = false;
    expect(voices.speaker('e2-pfad', world)).toBeUndefined();
    world.active = true;
    expect(voices.speaker('e2-pfad', undefined)).toBeUndefined();
    expect(voices.speaker('e2-pfad', activeWorld('flick'))).toBeUndefined();
  });
});
