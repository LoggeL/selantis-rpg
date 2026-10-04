import { describe, expect, it } from 'vitest';
import { touchHint, resolveMobileControls, type MobileControlProfile } from "../presentation/dom/controlLabels";

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


describe('scene control overrides', () => {
  const exploration: MobileControlProfile = {
    directions: ['up', 'left', 'down', 'right'],
    actions: { Q: 'Strahl', R: 'Welle', SPACE: 'Warten', ENTER: 'Bestätigen', ESC: 'Zurück' },
    inventory: true,
  };
  it('replaces tactical controls with exactly one cinematic action', () => {
    const result = resolveMobileControls(exploration, { directions: [], actions: { E: 'Weiter' }, inventory: false, disabled: true });
    expect(result).toEqual({ directions: [], actions: { E: 'Weiter' }, inventory: false, disabled: true });
    expect(exploration.directions).toHaveLength(4);
    expect(Object.keys(exploration.actions)).toHaveLength(5);
  });
  it('returns ordinary controls when the override is removed', () => {
    expect(resolveMobileControls(exploration, undefined)).toBe(exploration);
  });
  it('keeps the optional inventory preference when a scene overrides only actions', () => {
    expect(resolveMobileControls(exploration, { directions: [], actions: { E: 'Atmen' } }).inventory).toBe(true);
  });
});
