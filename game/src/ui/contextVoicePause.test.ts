import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiContext } from './context';

afterEach(() => { vi.runAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('recorded voice under stacked menus', () => {
  it('resumes only after the last covering menu closes, while ordinary dialogue stays audible', () => {
    vi.useFakeTimers(); vi.stubGlobal('document', { activeElement: null });
    const ui = new UiContext();
    const pause = vi.fn(); ui.onVoicePause = pause;
    const dialogue = ui.open({ id: 'dialogue', allowMenu: true });
    expect(pause).toHaveBeenLastCalledWith(false);
    const menu = ui.open({ id: 'menu', pauseVoice: true });
    const journal = ui.open({ id: 'journal', pauseVoice: true });
    menu();
    expect(pause).toHaveBeenLastCalledWith(true);
    journal();
    expect(pause).toHaveBeenLastCalledWith(false);
    expect(ui.has('dialogue')).toBe(true);
    dialogue();
  });
  it('clears pause on scene reset and ignores a stale menu close in the new scene', () => {
    vi.useFakeTimers(); vi.stubGlobal('document', { activeElement: null });
    const ui = new UiContext();
    const pause = vi.fn(); ui.onVoicePause = pause;
    const oldMenu = ui.open({ id: 'old-menu', pauseVoice: true });
    ui.clearModals();
    expect(pause).toHaveBeenLastCalledWith(false);
    const newMenu = ui.open({ id: 'new-menu', pauseVoice: true });
    oldMenu();
    expect(pause).toHaveBeenLastCalledWith(true);
    expect(ui.has('new-menu')).toBe(true);
    newMenu();
    expect(pause).toHaveBeenLastCalledWith(false);
  });
});
