import { abilities, clues, lore, memories } from '../core/catalog';
import { events } from '../core/events';
import { G } from '../core/G';
import { findScene } from '../core/registry';
import { FLOURISH } from './chapterCard';
import { el, html, icon, type IconName, sfx } from './dom';
import { NavList, type NavItem } from './nav';
import { openOverlay, type OverlayHandle } from './overlay';
import { renderChars } from './typewriter';

interface Entry { id: string; title: string; text: string; meta?: string; state?: 'active' | 'done' | 'locked'; key?: string; heading?: string; }

/** Where and when objectives were noted (this session only; saves do not carry it). */
const objectiveMeta = new Map<string, { scene: string; setAt: number; doneAt?: number }>();
events.on('objective:set', (p: { id: string }) => {
  const known = objectiveMeta.get(p.id);
  objectiveMeta.set(p.id, { scene: G.currentScene, setAt: known?.setAt ?? Date.now() });
});
events.on('objective:done', (p: { id: string }) => {
  const m = objectiveMeta.get(p.id);
  if (m) m.doneAt = Date.now(); else objectiveMeta.set(p.id, { scene: G.currentScene, setAt: Date.now(), doneAt: Date.now() });
});
events.on('state:changed', (p: { kind: string }) => { if (p?.kind === 'reset' || p?.kind === 'load') objectiveMeta.clear(); });

function ago(t: number): string {
  const min = Math.round((Date.now() - t) / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return min === 1 ? 'vor einer Minute' : `vor ${min} Minuten`;
  const h = Math.round(min / 60);
  return h === 1 ? 'vor einer Stunde' : `vor ${h} Stunden`;
}

function objectiveNote(id: string, done: boolean): string {
  const m = objectiveMeta.get(id);
  if (!m) return done ? 'Erledigt – auf einem früheren Abschnitt der Reise.' : 'Notiert auf einem früheren Abschnitt der Reise.';
  const found = m.scene ? findScene(m.scene) : undefined;
  const where = found ? `${/^[IVXLCDM]+$/.test(found.chapter.numeral) ? `Kapitel ${found.chapter.numeral}` : found.chapter.numeral} · „${found.scene.title}“` : '';
  const lines = [`Notiert ${ago(m.setAt)}${where ? ` – ${where}` : ''}.`];
  if (done) lines.push(m.doneAt ? `Erledigt ${ago(m.doneAt)}.` : 'Erledigt.');
  return lines.join('\n');
}

/**
 * Memories of dev/test content (ids starting with dev- or demo-) are never listed as missing:
 * otherwise a hidden chapter's catalog entries would show up as „Verblasste Erinnerung“ in the real game.
 */
const isDevId = (id: string) => /^(dev|demo)-/.test(id);
const missingMemories = () => {
  const found = new Set(G.state.data.memories);
  return [...memories.keys()].filter(id => !found.has(id) && !isDevId(id));
};
interface Tab { id: string; label: string; icon: IconName; empty: string; entries(): Entry[]; }

const TABS: Tab[] = [
  {
    id: 'goals', label: 'Ziele', icon: 'objective', empty: 'Gerade gibt es nichts zu tun. Genieß die Ruhe.',
    entries: () => {
      const list = G.state.data.objectives;
      const active = G.state.activeObjective();
      const open = list.filter(o => !o.done).reverse();
      const done = list.filter(o => o.done).reverse();
      return [
        ...open.map(o => ({ id: o.id, title: o.text, text: objectiveNote(o.id, false), state: (o === active ? 'active' : undefined) as Entry['state'], meta: o === active ? 'Aktuelles Ziel' : 'Offen' })),
        ...done.map(o => ({ id: o.id, title: o.text, text: objectiveNote(o.id, true), state: 'done' as const, meta: 'Erledigt' })),
      ];
    },
  },
  {
    id: 'clues', label: 'Hinweise', icon: 'clue', empty: 'Noch keine Hinweise. Augen offen halten!',
    entries: () => G.state.data.clues.map(id => ({ id, title: clues.get(id)?.title ?? id, text: clues.get(id)?.text ?? '' })).reverse(),
  },
  {
    id: 'memories', label: 'Erinnerungen', icon: 'memory', empty: 'Noch keine Erinnerungen gesammelt.',
    entries: () => {
      const known = G.state.data.memories.map(id => ({ id, title: memories.get(id)?.title ?? id, text: memories.get(id)?.text ?? '' }));
      const missing = missingMemories().map(id => ({ id, title: 'Verblasste Erinnerung', text: 'Diese Erinnerung hast du noch nicht wiedergefunden.', state: 'locked' as const }));
      return [...known, ...missing];
    },
  },
  {
    id: 'lore', label: 'Wissen', icon: 'lore', empty: 'Lia hat hier noch nichts Neues notiert.',
    entries: () => G.state.data.lore.map(id => ({ id, title: lore.get(id)?.title ?? id, text: lore.get(id)?.text ?? '' })),
  },
  {
    id: 'abilities', label: 'Fähigkeiten', icon: 'ability', empty: 'Noch keine besonderen Fähigkeiten.',
    entries: () => G.state.data.abilities.map(id => {
      const a = abilities.get(id);
      return { id, title: a?.name ?? id, text: a?.description ?? '', key: a?.key };
    }),
  },
];

let lastTab = 0;

/** Lia's journal: a two-page book with ribbon tabs. */
export function openJournal(startTab?: string): OverlayHandle {
  let tabIndex = startTab ? Math.max(0, TABS.findIndex(t => t.id === startTab)) : lastTab;
  const tabsEl = el('div', 'jr-tabs');
  const left = el('div', 'jr-page jr-left ch-parch');
  const right = el('div', 'jr-page jr-right ch-parch');
  const listTitle = el('div', 'jr-page-title');
  const list = el('div', 'jr-list');
  left.append(listTitle, list);
  const detail = el('div', 'jr-detail');
  right.appendChild(detail);
  let nav: NavList | null = null;

  const tabButtons = TABS.map((tab, i) => {
    const b = el('button', 'jr-tab');
    b.type = 'button';
    b.append(icon(tab.icon), el('span', 'jr-tab-label', tab.label));
    const count = el('span', 'jr-tab-count');
    b.appendChild(count);
    b.addEventListener('click', e => { e.stopPropagation(); selectTab(i); });
    tabsEl.appendChild(b);
    return { b, count };
  });

  const book = el('div', 'jr-book');
  book.append(left, right, el('div', 'jr-spine'));

  const overlay = openOverlay({
    id: 'journal', className: 'journal-ov', closeKeys: ['Tab', 'j', 'J'], panelClass: 'jr-panel',
    onKey: e => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' || e.key === 'q' || e.key === 'Q') { selectTab((tabIndex + TABS.length - 1) % TABS.length); return true; }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D' || e.key === 'e' || e.key === 'E') { selectTab((tabIndex + 1) % TABS.length); return true; }
      return nav?.key(e) ?? false;
    },
  });
  const head = el('div', 'jr-head');
  head.append(el('div', 'jr-title', 'Lias Tagebuch'), html('div', 'jr-head-orn', FLOURISH));
  overlay.body.append(head, tabsEl, book, el('div', 'jr-help', '← → Seite wechseln · ↑ ↓ Eintrag · Esc schließen'));

  function showDetail(entry: Entry | undefined, tab: Tab): void {
    detail.textContent = '';
    detail.classList.remove('is-anim');
    void detail.offsetWidth;
    detail.classList.add('is-anim');
    if (!entry) {
      detail.append(html('div', 'jr-empty-orn', '❦'), el('p', 'jr-empty', tab.empty));
      return;
    }
    if (entry.meta) detail.appendChild(el('div', `jr-meta${entry.state ? ` is-${entry.state}` : ''}`, entry.meta));
    detail.appendChild(el('h3', 'jr-entry-title', entry.title));
    detail.appendChild(html('div', 'jr-entry-orn', FLOURISH));
    const p = el('div', `jr-entry-text${entry.state === 'locked' ? ' is-locked' : ''}`);
    renderChars(p, entry.text).forEach(c => c.classList.add('on'));
    detail.appendChild(p);
    if (entry.key) {
      const k = el('div', 'jr-entry-key');
      k.append(el('span', 'ch-key', entry.key), el('span', '', 'gedrückt halten'));
      detail.appendChild(k);
    }
  }

  function selectTab(i: number, sound = true): void {
    if (sound && i !== tabIndex) sfx('page', { volume: 0.5 });
    tabIndex = i;
    lastTab = i;
    const tab = TABS[i];
    tabButtons.forEach(({ b }, k) => b.classList.toggle('is-active', k === i));
    listTitle.textContent = tab.label;
    list.textContent = '';
    const entries = tab.entries();
    if (tab.id === 'memories') {
      const total = G.state.data.memories.length + missingMemories().length;
      if (total) listTitle.appendChild(el('span', 'jr-progress', ` ${G.state.data.memories.length} / ${total}`));
    }
    const items: NavItem[] = entries.map(entry => {
      const row = el('button', `jr-row${entry.state ? ` is-${entry.state}` : ''}`);
      row.type = 'button';
      row.appendChild(el('span', 'jr-row-mark'));
      row.appendChild(el('span', 'jr-row-text', entry.title));
      list.appendChild(row);
      return { el: row, activate: () => {} };
    });
    if (!entries.length) list.appendChild(el('div', 'jr-list-empty', '—'));
    nav = new NavList(items, { onSelect: k => showDetail(entries[k], tab) });
    if (!entries.length) showDetail(undefined, tab);
  }

  const refreshCounts = () => TABS.forEach((tab, i) => {
    const n = tab.id === 'goals' ? G.state.data.objectives.filter(o => !o.done).length : tab.id === 'memories' ? G.state.data.memories.length : tab.entries().length;
    tabButtons[i].count.textContent = n ? String(n) : '';
  });
  refreshCounts();
  selectTab(tabIndex, false);
  return overlay;
}
