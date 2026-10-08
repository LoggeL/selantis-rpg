import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { G } from '../core/G';
import { settings } from '../core/settings';
import { inputLock } from '../core/input';
import { openPacking } from '../chapters/kapitel-1/packingPanel';
import { buildChapterSelect } from './chapters';
import { ctx } from './context';
import { openMenu } from './menu';
import { RotateHint } from './rotate';
import { savedScene } from './title';

// The chapter book has its own rendering/navigation implementation. Here its
// contract is captured to test the pause menu's save-loss policy in isolation.
vi.mock('./chapters', () => ({ devMode: () => false, buildChapterSelect: vi.fn(() => ({ key: () => false })) }));
vi.mock('./title', () => ({ savedScene: vi.fn(() => null) }));
vi.mock('./chapterCard', () => ({ FLOURISH: '' }));
vi.mock('../art/manifest', () => ({ manifest: () => ({ images: {} }), assetUrl: (s: string) => s }));

/** DOM adapter for real modal/key routing, without starting a game or browser. */
class Node extends EventTarget {
  children: Node[] = [];
  parent: Node | null = null;
  connectedRoot = false;
  className = '';
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  hidden = false;
  inert = false;
  disabled = false;
  type = '';
  id = '';
  clientWidth = 1280;
  offsetWidth = 0;
  private markup = '';
  get innerHTML(): string { return this.markup; }
  set innerHTML(value: string) {
    this.markup = value;
    this.children.forEach(c => { c.parent = null; }); this.children = [];
    for (const _match of value.matchAll(/<img\b/g)) this.appendChild(new Node('IMG'));
  }
  private content = '';
  readonly style = { setProperty: vi.fn() };
  readonly classList = {
    contains: (c: string) => this.className.split(/\s+/).includes(c),
    add: (...classes: string[]) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...classes])].join(' '); },
    remove: (...classes: string[]) => { this.className = this.className.split(/\s+/).filter(c => !classes.includes(c)).join(' '); },
    toggle: (c: string, force?: boolean) => {
      const on = force ?? !this.classList.contains(c);
      if (on) this.classList.add(c); else this.classList.remove(c);
      return on;
    },
  };
  constructor(readonly tagName = 'DIV') { super(); }
  get isConnected(): boolean { return this.connectedRoot || Boolean(this.parent?.isConnected); }
  get textContent(): string { return this.content + this.children.map(c => c.textContent).join(''); }
  set textContent(value: string) { this.content = value; this.children.forEach(c => { c.parent = null; }); this.children = []; }
  get firstElementChild(): Node | null { return this.children[0] ?? null; }
  get lastElementChild(): Node | null { return this.children[this.children.length - 1] ?? null; }
  append(...nodes: Node[]): void { nodes.forEach(n => this.appendChild(n)); }
  appendChild(node: Node): Node { node.remove(); node.parent = this; this.children.push(node); return node; }
  remove(): void { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); this.parent = null; }
  setAttribute(key: string, value: string): void { this.attributes.set(key, value); }
  getAttribute(key: string): string | null { return this.attributes.get(key) ?? null; }
  insertAdjacentHTML(_position: string, value: string): void { this.innerHTML += value; }
  scrollIntoView(): void {}
  getBoundingClientRect() { const width = window.innerWidth || 1280, height = window.innerHeight || 720; return { x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height }; }
  querySelectorAll<T = Node>(selector: string): T[] {
    const matches = (node: Node) => selector.startsWith('.') ? node.classList.contains(selector.slice(1)) : node.tagName.toLowerCase() === selector;
    const all = (node: Node): Node[] => node.children.flatMap(child => [child, ...all(child)]);
    return all(this).filter(matches) as T[];
  }
  querySelector<T = Node>(selector: string): T | null { return this.querySelectorAll<T>(selector)[0] ?? null; }
}

let root: Node;
let win: EventTarget;
let values: Map<string, string>;
let now: number;
const originalUi = G.ui;
const originalArt = G.art;
const originalReducedMotion = settings.reducedMotion;

function key(value: string, up = false): Event {
  const code = value.length === 1 ? (/\d/.test(value) ? `Digit${value}` : `Key${value.toUpperCase()}`) : value;
  const event = new Event(up ? 'keyup' : 'keydown', { cancelable: true });
  Object.defineProperties(event, { key: { value }, code: { value: code }, repeat: { value: false } });
  win.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  vi.useFakeTimers();
  settings.reducedMotion = true;
  now = 1000;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  root = new Node(); root.connectedRoot = true;
  const head = new Node('HEAD'); head.connectedRoot = true;
  const doc = Object.assign(new EventTarget(), {
    head, body: root, activeElement: null,
    createElement: (tag: string) => new Node(tag.toUpperCase()),
    // Context mount needs a canvas to stop the deferred canvas-discovery loop.
    querySelector: (selector: string) => selector === '#game canvas' ? new Node('CANVAS') : root.querySelector(selector),
  });
  win = Object.assign(new EventTarget(), { innerWidth: 1280, innerHeight: 720, setTimeout });
  values = new Map();
  vi.stubGlobal('document', doc);
  vi.stubGlobal('Image', class extends Node { constructor() { super('IMG'); } src = ''; });
  vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '0' })); vi.stubGlobal('window', win);
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { fn(now); return 1; });
  vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v) });
  ctx.held.clear();
  ctx.mount(root as unknown as HTMLElement);
  ctx.globalKeys = vi.fn(() => true);
  G.ui = { panel: (className: string) => { const panel = new Node(); panel.className = className; root.appendChild(panel); return panel; } } as unknown as typeof G.ui;
  G.art = { iconDataUrl: () => '' } as unknown as typeof G.art;
  vi.mocked(savedScene).mockReturnValue(null);
  vi.mocked(buildChapterSelect).mockClear();
});

afterEach(() => {
  settings.reducedMotion = originalReducedMotion;
  ctx.held.clear(); ctx.clearModals(); ctx.globalKeys = () => false;
  G.ui = originalUi; G.art = originalArt;
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

describe('ST-001: pause chapter selection protects a campaign save', () => {
  function chapters() {
    const warp = vi.fn();
    openMenu({ journal: vi.fn(), bag: vi.fn(), toTitle: vi.fn(), debug: () => false, warp });
    for (let i = 0; i < 4; i++) { key('ArrowDown'); key('ArrowDown', true); }
    key('Enter'); key('Enter', true);
    return { warp, opts: vi.mocked(buildChapterSelect).mock.calls[0][1] };
  }
  it('passes the title screen loss warning before any scene is picked', () => {
    vi.mocked(savedScene).mockReturnValue({ scene: 'prolog-rat', hidden: false, label: 'Prolog' });
    const { warp, opts } = chapters();
    expect(opts.confirm?.('wiese')).toBe('Nochmal wählen – der Spielstand wird überschrieben.');
    expect(warp).not.toHaveBeenCalled();
    opts.onPick('wiese');
    expect(warp).toHaveBeenCalledExactlyOnceWith('wiese');
  });
  it.each([null, { scene: 'dev-scene', hidden: true, label: 'Dev' }])('matches title behavior without a campaign save: %j', save => {
    vi.mocked(savedScene).mockReturnValue(save);
    expect(chapters().opts.confirm?.('wiese')).toBeNull();
  });
});

describe('ST-007: the packing modal owns Escape', () => {
  it('closes an unconfirmed selection through the already-mounted global router', async () => {
    const start = { tinder: 1 };
    const packed = openPacking(() => 1, start);
    expect(ctx.has('k1-pack')).toBe(true);
    expect(inputLock.locked).toBe(true);
    now += 550;
    key('1'); key('1', true); // Change the tentative selection, then abandon it.
    const escape = key('Escape'); key('Escape', true);
    await expect(packed).resolves.toBeNull();
    expect(escape.defaultPrevented).toBe(true);
    expect(ctx.globalKeys).not.toHaveBeenCalled();
    expect(root.querySelector('.k1-pack')).toBeNull();
    expect(ctx.has('k1-pack')).toBe(false);
    expect(start).toEqual({ tinder: 1 });
    vi.advanceTimersByTime(50);
    expect(inputLock.locked).toBe(false);
  });
  it('allows an immediate deliberate Escape while suppressing the opening E', async () => {
    const packed = openPacking(() => 1, {});
    key('e'); key('e', true);
    expect(root.querySelector('.k1-pack')).not.toBeNull();
    key('Escape'); key('Escape', true);
    await expect(packed).resolves.toBeNull();
    expect(ctx.globalKeys).not.toHaveBeenCalled();
  });
  it('releases its modal on normal confirmation and can be opened again', async () => {
    const packed = openPacking(() => 1, { tinder: 1 });
    root.querySelector('.k1-pack-done')!.dispatchEvent(new Event('click'));
    await expect(packed).resolves.toEqual({ tinder: 1 });
    expect(ctx.busy()).toBe(false);
    const reopened = openPacking(() => 1, {});
    now += 550; key('Backspace'); key('Backspace', true);
    await expect(reopened).resolves.toBeNull();
  });
});

describe('ST-012: portrait hint dismissal', () => {
  function portrait() {
    Object.assign(win, { innerWidth: 390, innerHeight: 844 });
    ctx.layout();
    new RotateHint().mount();
    return root.querySelector('.rotate-hint')!;
  }
  it('uses its own title-covering layer and persists a real close-button event', () => {
    ctx.root.classList.add('title-active');
    const hint = portrait();
    expect(hint.parent!.classList.contains('ui-layer-rotate-hint')).toBe(true);
    hint.querySelector('.rotate-hint-close')!.dispatchEvent(new Event('click', { cancelable: true }));
    expect(values.get('selantis.rotateHint.dismissed')).toBe('1');
    expect(hint.inert).toBe(true);
    vi.advanceTimersByTime(500);
    expect(root.querySelector('.rotate-hint')).toBeNull();
    ctx.layout();
    new RotateHint().mount(); // The next mounted instance also respects the persisted choice.
    expect(root.querySelector('.rotate-hint')).toBeNull();
  });
  it('stays dismissed for this session even when storage is unavailable', () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => { throw new Error('Storage unavailable'); } });
    const hint = portrait();
    hint.querySelector('.rotate-hint-close')!.dispatchEvent(new Event('click', { cancelable: true }));
    vi.advanceTimersByTime(500);
    ctx.layout();
    expect(root.querySelector('.rotate-hint')).toBeNull();
  });
  it('does not treat the automatic timeout as a persistent user dismissal', () => {
    portrait();
    vi.advanceTimersByTime(12500);
    expect(root.querySelector('.rotate-hint')).toBeNull();
    expect(values.has('selantis.rotateHint.dismissed')).toBe(false);
  });
});
