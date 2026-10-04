import type { SfxName } from '../audio/api';
import { abilities, clues, items, lore, memories } from '../core/catalog';
import { events } from '../core/events';
import { G } from '../core/G';
import type { ToastKind } from './api';
import { ctx } from './context';
import { el, icon, type IconName, sfx } from './dom';

const KIND: Record<ToastKind, { label: string; icon: IconName; sound?: SfxName; prio: number }> = {
  ability: { label: 'Neue Fähigkeit', icon: 'ability', sound: 'discover', prio: 5 },
  objective: { label: 'Ziel erledigt', icon: 'objective', sound: 'objective', prio: 4 },
  memory: { label: 'Erinnerung gefunden', icon: 'memory', sound: 'memory', prio: 3 },
  clue: { label: 'Hinweis notiert', icon: 'clue', sound: 'discover', prio: 3 },
  lore: { label: 'Neues Wissen', icon: 'lore', sound: 'discover', prio: 2 },
  item: { label: 'Gegenstand', icon: 'item', sound: 'pickup', prio: 1 },
  info: { label: '', icon: 'info', prio: 2 },
};

/** Visible at once; further toasts wait in the queue. */
const MAX_VISIBLE = 3;
/** Minimum gap between two toasts appearing (ms). */
const GAP_MS = 420;
/** Item gains arriving within this window are grouped into one toast. */
const GROUP_MS = 300;

interface Pending { kind: ToastKind; text: string; label?: string; itemId?: string; seq: number; }

/**
 * Notification toasts (top right, below the HUD buttons). Listens to state events.
 * Bursts are queued (at most 3 visible, one new every ~0.4 s, higher ranks first: ability > objective >
 * memory/clue > lore/info > item); items gained within 300 ms are grouped into one toast with one sound.
 */
export class ToastUi {
  private stack = el('div', 'toasts');
  /** From a UI/state reset until the next scene starts (title, warp prepare), reward toasts stay silent. */
  private muted = false;
  private queue: Pending[] = [];
  private seq = 0;
  private lastShown = -Infinity;
  private pumpTimer = 0;
  private itemGroup: { list: { id: string; n: number }[]; timer: number } | null = null;

  constructor() {
    events.on('state:changed', (p: { kind: string }) => {
      if (p?.kind === 'reset' || p?.kind === 'load') this.mute();
    });
    events.on('scene:goto', () => { setTimeout(() => { this.muted = false; }, 0); });
    events.on('item:gained', (p: { item: string; n: number }) => this.itemGained(p.item, p.n));
    events.on('memory:gained', (p: { id: string }) => this.push('memory', memories.get(p.id)?.title ?? p.id));
    events.on('lore:gained', (p: { id: string }) => this.push('lore', lore.get(p.id)?.title ?? p.id));
    events.on('clue:gained', (p: { id: string }) => this.push('clue', clues.get(p.id)?.title ?? p.id));
    events.on('ability:gained', (p: { id: string }) => this.push('ability', abilities.get(p.id)?.name ?? p.id));
    events.on('objective:done', (p: { text: string }) => this.push('objective', p.text));
  }

  mount(): void { ctx.layers.toast.appendChild(this.stack); }

  /** Silences reward toasts until the next scene:goto (and drops what is queued). */
  mute(): void {
    this.muted = true;
    this.queue = this.queue.filter(q => q.kind === 'info');
    if (this.itemGroup) { clearTimeout(this.itemGroup.timer); this.itemGroup = null; }
  }

  toast(text: string, kind: ToastKind = 'info'): void { this.push(kind, text); }

  private blocked(kind: ToastKind): boolean {
    return kind !== 'info' && (this.muted || ctx.stale());
  }

  private itemGained(id: string, n: number): void {
    if (this.blocked('item') || n <= 0) return;
    if (!this.itemGroup) {
      this.itemGroup = { list: [], timer: window.setTimeout(() => this.flushItems(), GROUP_MS) };
    }
    const same = this.itemGroup.list.find(e => e.id === id);
    if (same) same.n += n; else this.itemGroup.list.push({ id, n });
  }

  private flushItems(): void {
    const group = this.itemGroup;
    this.itemGroup = null;
    if (!group?.list.length || this.blocked('item')) return;
    const name = (e: { id: string; n: number }) => `${items.get(e.id)?.name ?? e.id}${e.n > 1 ? ` ×${e.n}` : ''}`;
    const text = group.list.map(name).join(', ');
    this.push('item', text, group.list.length > 1 ? 'Gegenstände' : undefined, group.list[0].id);
  }

  private push(kind: ToastKind, text: string, label?: string, itemId?: string): void {
    if (this.blocked(kind)) return;
    this.queue.push({ kind, text, label, itemId, seq: this.seq++ });
    this.pump();
  }

  private pump(): void {
    clearTimeout(this.pumpTimer);
    if (!this.queue.length) return;
    const wait = this.lastShown + GAP_MS - performance.now();
    if (wait > 0) { this.pumpTimer = window.setTimeout(() => this.pump(), wait + 5); return; }
    // Highest rank first, then arrival order.
    let best = 0;
    for (let i = 1; i < this.queue.length; i++) {
      const a = this.queue[i], b = this.queue[best];
      if (KIND[a.kind].prio > KIND[b.kind].prio) best = i;
    }
    const next = this.queue.splice(best, 1)[0];
    this.lastShown = performance.now();
    this.show(next);
    if (this.queue.length) this.pumpTimer = window.setTimeout(() => this.pump(), GAP_MS + 5);
  }

  private show(p: Pending): void {
    const meta = KIND[p.kind] ?? KIND.info;
    const t = el('div', `toast toast-${p.kind} ch-panel`);
    const badge = el('div', 'toast-badge');
    let iconUrl = '';
    if (p.itemId) { try { iconUrl = G.art?.iconDataUrl(items.get(p.itemId)?.icon ?? p.itemId) ?? ''; } catch { iconUrl = ''; } }
    if (iconUrl) {
      const img = el('img', 'px');
      img.src = iconUrl;
      img.alt = '';
      badge.appendChild(img);
    } else badge.appendChild(icon(meta.icon));
    const body = el('div', 'toast-body');
    const label = p.label ?? meta.label;
    if (label) body.appendChild(el('div', 'toast-label', label));
    body.appendChild(el('div', 'toast-text', p.text));
    t.append(badge, body);
    this.stack.appendChild(t);
    // Too many on screen: the oldest leaves with its exit animation (never cut off).
    const live = [...this.stack.children].filter(c => !c.classList.contains('is-out')) as HTMLElement[];
    for (let i = 0; i < live.length - MAX_VISIBLE; i++) this.dismiss(live[i]);
    if (meta.sound) sfx(meta.sound, { volume: 0.8 });
    requestAnimationFrame(() => t.classList.add('is-in'));
    const life = p.kind === 'info' ? 2800 : p.kind === 'ability' ? 4600 : 3800;
    setTimeout(() => this.dismiss(t), life);
  }

  private dismiss(t: HTMLElement): void {
    if (t.classList.contains('is-out')) return;
    t.classList.remove('is-in');
    t.classList.add('is-out');
    setTimeout(() => t.remove(), 420);
  }

  clear(): void {
    clearTimeout(this.pumpTimer);
    this.queue = [];
    if (this.itemGroup) { clearTimeout(this.itemGroup.timer); this.itemGroup = null; }
    this.stack.textContent = '';
  }
}
