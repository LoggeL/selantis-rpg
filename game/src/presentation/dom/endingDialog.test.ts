import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEndingDialog } from './endingDialog';

function browserFixture() {
  class Element {
    dataset: Record<string, string> = {};
    children: Element[] = [];
    handlers = new Map<string, Set<(event: any) => void>>();
    parent?: Element;
    open = false;
    attributes = new Map<string, string>();
    textContent = '';
    setAttribute(key: string, value: string) { this.attributes.set(key, value); }
    append(...elements: Element[]) { elements.forEach(element => { element.parent = this; this.children.push(element); }); }
    addEventListener(key: string, callback: (event: any) => void) { const callbacks = this.handlers.get(key) ?? new Set(); callbacks.add(callback); this.handlers.set(key, callbacks); }
    removeEventListener(key: string, callback: (event: any) => void) { this.handlers.get(key)?.delete(callback); }
    emit(key: string, event: any = {}) { for (const callback of this.handlers.get(key) ?? []) callback(event); }
    focus() { browser.activeElement = this; }
    showModal() { this.open = true; }
    close() { this.open = false; }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(element => element !== this); }
  }
  const events = new Element();
  const browser = {
    documentElement: new Element(), body: new Element(), activeElement: undefined as Element | undefined,
    createElement: () => new Element(),
    addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
  };
  vi.stubGlobal('document', browser);
  return { browser, events };
}
afterEach(() => vi.unstubAllGlobals());

describe('ending dialog lifetime', () => {
  it('offers native focused actions, accepts one navigation, then removes controls and listeners', () => {
    const { browser, events } = browserFixture(); const replay = vi.fn(), titleScreen = vi.fn();
    const destroy = createEndingDialog({ title: 'Ende des ersten Teils', text: 'Kyra ist frei.', replay, titleScreen });
    const dialog = browser.body.children[0]; const [heading, text, actions] = dialog.children;
    expect(dialog.open).toBe(true); expect(browser.activeElement).toBe(heading);
    expect(dialog.attributes.get('aria-labelledby')).toBe('story-ending-title');
    expect(heading.textContent).toBe('Ende des ersten Teils'); expect(text.textContent).toBe('Kyra ist frei.');
    expect(browser.documentElement.dataset.storyEnding).toBe('true');
    actions.children[0].emit('click'); actions.children[0].emit('click'); actions.children[1].emit('click');
    expect(replay).toHaveBeenCalledOnce(); expect(titleScreen).not.toHaveBeenCalled();
    destroy(); destroy();
    expect(dialog.open).toBe(false); expect(browser.body.children).toHaveLength(0);
    expect(browser.documentElement.dataset.storyEnding).toBeUndefined();
    expect(events.handlers.get('keydown')?.size).toBe(0);
    actions.children[0].emit('click'); expect(replay).toHaveBeenCalledOnce();
  });
  it('preserves R/T and native button keys while suppressing unrelated game shortcuts', () => {
    const { events } = browserFixture(); const replay = vi.fn(), titleScreen = vi.fn();
    const destroy = createEndingDialog({ title: 'Ende', text: 'Frei.', replay, titleScreen });
    const press = (code: string, repeat = false) => { const event = { code, repeat, preventDefault: vi.fn(), stopPropagation: vi.fn() }; events.emit('keydown', event); return event; };
    const tab = press('Tab'); expect(tab.stopPropagation).toHaveBeenCalledOnce(); expect(tab.preventDefault).not.toHaveBeenCalled();
    press('KeyR', true); expect(replay).not.toHaveBeenCalled();
    const title = press('KeyT'); expect(title.preventDefault).toHaveBeenCalledOnce(); expect(titleScreen).toHaveBeenCalledOnce();
    destroy(); press('KeyR'); expect(replay).not.toHaveBeenCalled();
  });
});
