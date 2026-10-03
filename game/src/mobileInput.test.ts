import { describe, expect, it } from 'vitest';
import { TouchKeyHolds, touchHint, type TouchKey } from './mobileInput';

const event = { timeStamp: 100 } as KeyboardEvent;
function key(initial = false) {
  const calls: string[] = [];
  const value: TouchKey = {
    isDown: initial,
    onDown() { this.isDown = true; calls.push('down'); },
    onUp() { this.isDown = false; calls.push('up'); },
    reset() { this.isDown = false; calls.push('reset'); },
  };
  return { value, calls };
}

describe('touch key ownership', () => {
  it('holds a key until the last finger releases', () => {
    const input = new TouchKeyHolds(), k = key();
    input.press(k.value, event); input.press(k.value, event);
    input.release(k.value, event);
    expect(k.value.isDown).toBe(true);
    expect(k.calls).toEqual(['down']);
    input.release(k.value, event);
    expect(k.value.isDown).toBe(false);
    expect(k.calls).toEqual(['down', 'up']);
  });

  it('releases simultaneous movement and held interaction on cancellation', () => {
    const input = new TouchKeyHolds(), move = key(), interact = key();
    input.press(move.value, event); input.press(interact.value, event);
    input.cancel(event); input.cancel(event);
    expect(move.calls).toEqual(['down', 'up', 'reset']);
    expect(interact.calls).toEqual(['down', 'up', 'reset']);
    expect(move.value.isDown || interact.value.isDown).toBe(false);
  });

  it('changes direction without leaving the old key held', () => {
    const input = new TouchKeyHolds(), left = key(), right = key();
    input.press(left.value, event); input.release(left.value, event);
    input.press(right.value, event);
    expect(left.value.isDown).toBe(false);
    expect(right.value.isDown).toBe(true);
    input.cancel(event);
    expect(right.value.isDown).toBe(false);
  });

  it('does not release a key already held by a hardware keyboard', () => {
    const input = new TouchKeyHolds(), k = key(true);
    input.press(k.value, event); input.cancel(event);
    expect(k.calls).toEqual([]);
    expect(k.value.isDown).toBe(true);
  });
});


describe('touch instructions', () => {
  it('names the controls shown on the phone', () => {
    expect(touchHint('WASD / Pfeiltasten: Geh zu deinem Platz.')).toBe('Steuerkreuz: Geh zu deinem Platz.');
    expect(touchHint('Klick / Enter: Strahl · Rechtsklick: zurück.')).toBe('Tippen / Bestätigen: Strahl · Zurück.');
  });
  it('keeps walking instructions short beside the visible bag button', () => {
    expect(touchHint('WASD / Pfeile: gehen · Klick: gehen / untersuchen · I: Tasche'))
      .toBe('Steuerkreuz: gehen · Tippen: untersuchen');
    expect(touchHint('WASD / Pfeiltasten: gehen · I: Tasche · E: Blatt fangen'))
      .toBe('Steuerkreuz: gehen · Aktion: Blatt fangen');
  });
  it('preserves scene context and distinguishes preview arrows from direction buttons', () => {
    expect(touchHint('Pfeile: Rückstoß · Verbündete geschützt · Klick / Enter.'))
      .toBe('Pfeile: Rückstoß · Verbündete geschützt · Tippen / Bestätigen.');
    expect(touchHint('Blau: bewegen · Q: Strahl · Pfeile + Enter oder Klick.'))
      .toBe('Blau: bewegen · Strahl · Steuerkreuz + Bestätigen oder Tippen.');
    expect(touchHint('E halten: Holz reiben · Klick auf die Feuerstelle: fertigreiben'))
      .toBe('Aktion halten: Holz reiben · Tippen auf die Feuerstelle: fertigreiben');
  });
  it('does not treat the first letter of German words as a key', () => {
    expect(touchHint('Rückstoß · R: Druckwelle · Über den Stamm'))
      .toBe('Rückstoß · Welle: Druckwelle · Über den Stamm');
  });
  it('keeps held actions explicit without duplicating halten', () => {
    expect(touchHint('E halten · Esc halten', { E: 'Aktion halten', ESC: 'Weiter halten' })).toBe('Aktion halten · Weiter halten');
  });
});
