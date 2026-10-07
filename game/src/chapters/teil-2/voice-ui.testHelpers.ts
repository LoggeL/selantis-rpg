// Minimal DOM and media clocks for exercising the real caption/reveal lifecycle without a browser dependency.
import { vi } from 'vitest';
import type { VoiceOutcome, VoicePlayback } from '../../audio/voiceover';

export class TestNode {
  children: TestNode[] = [];
  parent: TestNode | null = null;
  connected = false;
  private content = '';
  private classes = new Set<string>();
  private attributes = new Map<string, string>();
  private listeners = new Map<string, Set<(event: any) => void>>();
  constructor(public tagName = 'DIV', cls = '', text = '') { this.className = cls; this.content = text; }
  get isConnected(): boolean { return this.connected || Boolean(this.parent?.isConnected); }
  get textContent(): string { return this.content + this.children.map(child => child.textContent).join(''); }
  set textContent(value: string) { this.clear(); this.content = value; }
  get className(): string { return [...this.classes].join(' '); }
  set className(value: string) { this.classes = new Set(value.split(' ').filter(Boolean)); }
  classList = {
    add: (...names: string[]) => names.forEach(name => this.classes.add(name)),
    remove: (...names: string[]) => names.forEach(name => this.classes.delete(name)),
    contains: (name: string) => this.classes.has(name),
    toggle: (name: string, force?: boolean) => { const on = force ?? !this.classes.has(name); if (on) this.classes.add(name); else this.classes.delete(name); return on; },
  };
  style = { setProperty() {} };
  private clear(): void { this.children.forEach(child => { child.parent = null; }); this.children.length = 0; this.content = ''; }
  set innerHTML(html: string) {
    this.clear();
    const stack: TestNode[] = [this];
    for (const token of html.matchAll(/<\/?[^>]+>|[^<]+/gu)) {
      const text = token[0];
      if (text.startsWith('</')) { stack.pop(); continue; }
      if (text.startsWith('<')) {
        const tag = /^<([\w-]+)/u.exec(text)?.[1];
        if (!tag) continue;
        const child = new TestNode(tag.toUpperCase());
        for (const attr of text.matchAll(/([\w-]+)="([^"]*)"/gu)) child.setAttribute(attr[1], attr[2]);
        stack[stack.length - 1].appendChild(child);
        if (!/\/>$/u.test(text) && !['br', 'img', 'input'].includes(tag)) stack.push(child);
      } else stack[stack.length - 1].appendChild(new TestNode('#TEXT', '', text));
    }
  }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); if (name === 'class') this.className = value; }
  getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
  appendChild(child: TestNode): TestNode { child.remove(); child.parent = this; this.children.push(child); return child; }
  append(...children: TestNode[]): void { children.forEach(child => this.appendChild(child)); }
  prepend(child: TestNode): void { child.remove(); child.parent = this; this.children.unshift(child); }
  remove(): void { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; this.connected = false; }
  querySelector<T = TestNode>(selector: string): T | null {
    return flatten(this).slice(1).find(node => selector.startsWith('.') ? node.classList.contains(selector.slice(1)) : node.tagName.toLowerCase() === selector) as T ?? null;
  }
  addEventListener(name: string, handler: (event: any) => void): void {
    const handlers = this.listeners.get(name) ?? new Set(); handlers.add(handler); this.listeners.set(name, handlers);
  }
  removeEventListener(name: string, handler: (event: any) => void): void { this.listeners.get(name)?.delete(handler); }
  dispatch(name: string): void { this.listeners.get(name)?.forEach(handler => handler({ preventDefault() {}, pointerType: 'mouse', button: 0 })); }
}
export const flatten = (node: TestNode): TestNode[] => [node, ...node.children.flatMap(flatten)];
export const visibleCharacters = (node: TestNode): string => flatten(node).filter(child => child.classList.contains('tc') && child.classList.contains('on')).map(child => child.textContent).join('');
export function frames() {
  let next = 0;
  const pending = new Map<number, FrameRequestCallback>();
  return {
    request: (callback: FrameRequestCallback) => { pending.set(++next, callback); return next; },
    cancel: (id: number) => { pending.delete(id); },
    tick: () => { const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(callback => callback(performance.now())); },
    count: () => pending.size,
  };
}
export function media(text: string, cues = text.split(' ').map((_, index) => ({ start: .5 + index * 2, end: 1 + index * 2 }))) {
  let currentTime = 0;
  let outcome: VoiceOutcome = 'playing';
  let settle!: () => void;
  const finish = (next: VoiceOutcome) => { if (outcome === 'playing') { outcome = next; settle(); } };
  const playback: VoicePlayback = {
    done: new Promise<void>(resolve => { settle = resolve; }), started: true,
    get currentTime() { return currentTime; }, get outcome() { return outcome; },
    spokenText: text, wordCues: cues, stop: vi.fn(() => finish('stopped')),
  };
  return { playback, clock: (time: number) => { currentTime = time; }, finish };
}
