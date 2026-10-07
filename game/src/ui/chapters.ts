import { getChapters } from '../core/registry';
import { el, sfx } from './dom';
import { NavList, type NavItem } from './nav';
import { sceneUnlocked } from './unlocks';

export const devMode = (): boolean => {
  const q = new URLSearchParams(location.search);
  return q.has('dev') || q.has('debug');
};

export interface ChapterSelectOptions {
  includeHidden?: boolean;
  onPick: (sceneId: string) => void;
  onBack?: () => void;
  compact?: boolean;
  /** Text filter (scene id / title / chapter title). Rows that do not match are left out entirely. */
  filter?: string;
  /**
   * Asks for a second pick before warping (e.g. a save would be overwritten). Return the warning to show
   * on the row, or null to pick right away.
   */
  confirm?: (sceneId: string) => string | null;
}

/** Chapter + scene list. Chapter rows start their first scene; scene rows warp directly. */
export function buildChapterSelect(host: HTMLElement, opts: ChapterSelectOptions): NavList {
  host.textContent = '';
  const list = el('div', opts.compact ? 'chap-list is-compact' : 'chap-list');
  host.appendChild(list);
  const items: NavItem[] = [];
  const q = (opts.filter ?? '').trim().toLowerCase();
  const matches = (...texts: string[]) => !q || texts.some(t => t.toLowerCase().includes(q));
  const chapters = getChapters().filter(c => opts.includeHidden || !c.hidden);
  let armed: { id: string; row: HTMLElement } | null = null;

  const pick = (sceneId: string, row: HTMLElement) => {
    const warning = opts.confirm?.(sceneId) ?? null;
    if (warning && armed?.id !== sceneId) {
      if (armed) { armed.row.classList.remove('is-confirm'); armed.row.querySelector('.chap-warn')?.remove(); }
      armed = { id: sceneId, row };
      row.classList.add('is-confirm');
      row.appendChild(el('span', 'chap-warn', warning));
      sfx('ui-cancel', { volume: 0.5 });
      return;
    }
    opts.onPick(sceneId);
  };

  let shown = 0;
  // Players only get the scenes they have reached (or everything via the cheat); dev lists stay complete.
  const open = (sceneId: string) => opts.includeHidden || sceneUnlocked(sceneId);
  for (const chapter of chapters) {
    const chapterHit = matches(chapter.title, chapter.numeral, chapter.id);
    const scenes = chapter.scenes.filter(s => chapterHit || matches(s.id, s.title));
    if (q && !scenes.length) continue;
    shown++;
    const reached = chapter.scenes.filter(s => open(s.id));
    const head = el('button', `chap-head${chapter.hidden ? ' is-hidden' : ''}${reached.length ? '' : ' is-locked'}`);
    head.type = 'button';
    head.append(el('span', 'chap-num', chapter.numeral), el('span', 'chap-title', reached.length ? chapter.title : 'Noch nicht erreicht'));
    // The numeral already says „Dev“ for dev chapters: a badge only where it adds something.
    if (chapter.hidden && chapter.numeral !== 'Dev') head.appendChild(el('span', 'chap-badge', 'Dev'));
    if (chapter.subtitle && !opts.compact && reached.length) head.appendChild(el('span', 'chap-sub', chapter.subtitle));
    list.appendChild(head);
    const first = reached[0];
    items.push({ el: head, disabled: !first, activate: () => first && pick(first.id, head) });
    if (!reached.length) continue;
    for (const scene of scenes) {
      const unlocked = open(scene.id);
      const row = el('button', unlocked ? 'chap-scene' : 'chap-scene is-locked');
      row.type = 'button';
      row.append(el('span', 'chap-scene-title', unlocked ? scene.title : '???'));
      if (opts.compact || chapter.hidden) row.appendChild(el('span', 'chap-scene-id', scene.id));
      list.appendChild(row);
      items.push({ el: row, disabled: !unlocked, activate: () => unlocked && pick(scene.id, row) });
    }
  }
  if (!shown) list.appendChild(el('div', 'chap-empty', q ? 'Keine Szene passt zu diesem Filter.' : 'Die Chronik ist noch ungeschrieben. Bald gibt es hier Kapitel.'));
  if (opts.onBack) {
    const back = el('button', 'menu-item set-back', 'Zurück');
    back.type = 'button';
    host.appendChild(back);
    items.push({ el: back, activate: opts.onBack });
  }
  return new NavList(items);
}
