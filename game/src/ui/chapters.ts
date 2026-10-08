import { getChapters, type ChapterEntry } from '../core/registry';
import { assetUrl, manifest } from '../art';
import { artId, buildBooks, defaultSelection, FALLBACK_ART, type Book, type ChapterGroup } from './chapterBooks';
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
  /** Scene to open the list at (e.g. the saved scene); default: the latest reached scene. */
  current?: string;
}

/**
 * Chapter select. The player view groups the chronicle into its three books (tabs; ←/→ switches) and shows one
 * chapter or section opened at a time (its head toggles it); scene rows warp directly. The compact debug list (F2)
 * stays a flat, filterable list of every chapter and scene.
 */
export function buildChapterSelect(host: HTMLElement, opts: ChapterSelectOptions): NavList {
  return opts.compact ? buildFlatSelect(host, opts) : buildBookSelect(host, opts);
}

type Pick = (sceneId: string, row: HTMLElement) => void;

/** Two-step pick when the caller asks for confirmation (a save would be overwritten). */
function picker(opts: ChapterSelectOptions): Pick {
  let armed: { id: string; row: HTMLElement } | null = null;
  return (sceneId, row) => {
    const warning = opts.confirm?.(sceneId) ?? null;
    if (warning && (armed?.id !== sceneId || !armed.row.isConnected)) {
      if (armed) { armed.row.classList.remove('is-confirm'); armed.row.querySelector('.chap-warn')?.remove(); }
      armed = { id: sceneId, row };
      row.classList.add('is-confirm');
      row.appendChild(el('span', 'chap-warn', warning));
      sfx('ui-cancel', { volume: 0.5 });
      return;
    }
    opts.onPick(sceneId);
  };
}

function backButton(host: HTMLElement, opts: ChapterSelectOptions, items: NavItem[]): void {
  if (!opts.onBack) return;
  const back = el('button', 'menu-item set-back', 'Zurück');
  back.type = 'button';
  host.appendChild(back);
  items.push({ el: back, activate: opts.onBack });
}

function sceneRow(title: string, unlocked: boolean, id?: string): HTMLButtonElement {
  const row = el('button', unlocked ? 'chap-scene' : 'chap-scene is-locked');
  row.type = 'button';
  row.append(el('span', 'chap-scene-title', unlocked ? title : '???'));
  if (id) row.appendChild(el('span', 'chap-scene-id', id));
  return row;
}

/** Illustration URL of a group: its own chapter plate, else a painted map background, else nothing. */
function artUrl(groupKey: string): string | null {
  const m = manifest();
  const plate = m.plates[artId(groupKey)];
  if (plate) return assetUrl(plate.file);
  const bg = m.backgrounds[FALLBACK_ART[groupKey] ?? ''];
  return bg ? assetUrl(bg.file) : null;
}

/**
 * The chronicle as an open book: one double page per book. The left page shows the book's title and the
 * illustration of the chapter under the cursor (spoiler-free places), the right page the chapters; one chapter or
 * section is open at a time (its head toggles it), scene rows warp. ←/→ or the page corners turn to the next book.
 */
function buildBookSelect(host: HTMLElement, opts: ChapterSelectOptions): NavList {
  host.textContent = '';
  const open = (sceneId: string) => opts.includeHidden || sceneUnlocked(sceneId);
  const books = buildBooks(getChapters().filter(c => opts.includeHidden || !c.hidden));
  const reachedIn = (g: ChapterGroup) => g.scenes.filter(s => open(s.id));
  const bookOpen = (b: Book) => b.groups.some(g => reachedIn(g).length > 0);
  const pick = picker(opts);
  const sel = defaultSelection(books, open, opts.current);
  let bookId = sel?.book ?? books[0]?.id ?? 1;
  let openGroup: string | null = sel?.group ?? null;

  const spread = el('div', 'chap-spread');
  const left = el('div', 'chap-page is-left ch-parch');
  const right = el('div', 'chap-page is-right ch-parch');
  spread.append(left, el('div', 'chap-gutter'), right);
  host.appendChild(spread);
  const backItems: NavItem[] = [];
  backButton(host, opts, backItems);
  /** Group shown on the left page for each nav item (index → group key). */
  let itemGroup: (string | null)[] = [];
  let showArt: (key: string | null) => void = () => {};
  const nav = new NavList([], { onSelect: i => showArt(itemGroup[i] ?? null) });
  if (!books.length) {
    right.appendChild(el('div', 'chap-empty', 'Die Chronik ist noch ungeschrieben. Bald gibt es hier Kapitel.'));
    nav.setItems(backItems);
    return nav;
  }

  /** Turns to the previous/next book (or a given one) and opens its latest reached part. */
  const turn = (dir: number) => {
    const at = books.findIndex(b => b.id === bookId);
    const target = books[at + dir];
    if (!target) return;
    bookId = target.id;
    const inBook = defaultSelection([target], open, opts.current);
    openGroup = inBook && target.groups.some(g => g.key === inBook.group && reachedIn(g).length) ? inBook.group : null;
    sfx('page', { volume: 0.5 });
    spread.classList.remove('is-turn-next', 'is-turn-prev');
    void spread.offsetWidth;
    spread.classList.add(dir > 0 ? 'is-turn-next' : 'is-turn-prev');
    render({ turn: dir });
  };

  const render = (focus: { group?: string; scene?: string; turn?: number } = {}) => {
    left.textContent = '';
    right.textContent = '';
    const items: NavItem[] = [];
    itemGroup = [];
    let start: number | undefined;
    const at = books.findIndex(b => b.id === bookId);
    const book = books[at] ?? books[0];
    const prev = books[at - 1], next = books[at + 1];
    const lr = { left: () => turn(-1), right: () => turn(1) };
    const reachable = bookOpen(book);

    // Left page: the book's title and the illustration.
    const headL = el('div', 'chap-page-head');
    headL.append(el('span', 'chap-book-label', book.info.label), el('span', 'chap-book-title', reachable ? book.info.title : 'Noch nicht geschrieben'));
    const fig = el('figure', 'chap-art');
    const img = el('img', 'chap-art-img');
    img.alt = '';
    img.decoding = 'async';
    const cap = el('figcaption', 'chap-art-cap');
    fig.append(img, cap);
    left.append(headL, fig);
    let shown: string | null | undefined;
    showArt = key => {
      const g = key ? book.groups.find(x => x.key === key) : undefined;
      const usable = g && reachedIn(g).length ? g : undefined;
      const k = usable?.key ?? null;
      if (k === shown) return;
      shown = k;
      const url = k ? artUrl(k) : null;
      fig.classList.toggle('is-empty', !url);
      if (url) { img.classList.remove('is-in'); img.onload = () => img.classList.add('is-in'); img.src = url; }
      else img.removeAttribute('src');
      cap.textContent = '';
      if (usable) cap.append(el('span', 'chap-art-num', usable.numeral), el('span', 'chap-art-title', usable.title));
      else if (!reachable) cap.append(el('span', 'chap-art-title', 'Dieses Buch ist noch nicht aufgeschlagen.'));
    };

    // Right page: the chapters of this book.
    const list = el('div', 'chap-list is-books');
    right.appendChild(list);
    for (const g of book.groups) {
      const reached = reachedIn(g);
      const isOpen = g.key === openGroup && reached.length > 0;
      const head = el('button', `chap-head${isOpen ? ' is-open' : ''}${reached.length ? '' : ' is-locked'}${g.chapter.hidden ? ' is-hidden' : ''}`);
      head.type = 'button';
      head.setAttribute('aria-expanded', String(isOpen));
      head.append(el('span', 'chap-num', g.numeral), el('span', 'chap-title', reached.length ? g.title : 'Noch nicht erreicht'));
      head.appendChild(el('span', 'chap-count', reached.length ? `${reached.length}/${g.scenes.length}` : ''));
      if (g.subtitle && reached.length) head.appendChild(el('span', 'chap-sub', g.subtitle));
      list.appendChild(head);
      if (focus.group === g.key || (start === undefined && !focus.group && !focus.scene && isOpen)) start = items.length;
      itemGroup.push(g.key);
      items.push({
        el: head, disabled: !reached.length, ...lr,
        activate: () => {
          openGroup = isOpen ? null : g.key;
          sfx(isOpen ? 'ui-cancel' : 'ui-confirm', { volume: 0.4 });
          render({ group: g.key });
        },
      });
      if (!isOpen) continue;
      for (const scene of g.scenes) {
        const unlocked = open(scene.id);
        const row = sceneRow(scene.title, unlocked, g.chapter.hidden ? scene.id : undefined);
        row.classList.add('is-in-open');
        list.appendChild(row);
        if (focus.scene === scene.id) start = items.length;
        itemGroup.push(g.key);
        items.push({ el: row, disabled: !unlocked, ...lr, activate: () => unlocked && pick(scene.id, row) });
      }
    }

    // Page corners: turn to the neighbouring books.
    const corner = (dir: number, target: Book | undefined, page: HTMLElement) => {
      if (!target) return;
      const btn = el('button', `chap-turn ${dir < 0 ? 'is-prev' : 'is-next'}`);
      btn.type = 'button';
      btn.setAttribute('aria-label', `Umblättern: ${target.info.label}`);
      btn.append(el('span', 'chap-turn-arrow', dir < 0 ? '‹' : '›'), el('span', 'chap-turn-label', target.info.label));
      page.appendChild(btn);
      if (focus.turn === dir && start === undefined) start = items.length;
      itemGroup.push(null);
      items.push({ el: btn, ...lr, activate: () => turn(dir) });
    };
    corner(-1, prev, left);
    corner(1, next, right);

    if (start === undefined && focus.turn !== undefined) start = items.findIndex(it => !it.disabled);
    itemGroup.push(...backItems.map(() => null));
    items.push(...backItems);
    shown = undefined;
    nav.setItems(items, start);
    showArt(itemGroup[nav.index] ?? openGroup);
    items[nav.index]?.el.scrollIntoView?.({ block: 'nearest' });
  };

  render();
  return nav;
}

/** The flat list of the F2 debug window (filterable, every chapter expanded). */
function buildFlatSelect(host: HTMLElement, opts: ChapterSelectOptions): NavList {
  host.textContent = '';
  const list = el('div', opts.compact ? 'chap-list is-compact' : 'chap-list');
  host.appendChild(list);
  const items: NavItem[] = [];
  const q = (opts.filter ?? '').trim().toLowerCase();
  const matches = (...texts: string[]) => !q || texts.some(t => t.toLowerCase().includes(q));
  const chapters: readonly ChapterEntry[] = getChapters().filter(c => opts.includeHidden || !c.hidden);
  const pick = picker(opts);

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
      const row = sceneRow(scene.title, unlocked, opts.compact || chapter.hidden ? scene.id : undefined);
      list.appendChild(row);
      items.push({ el: row, disabled: !unlocked, activate: () => unlocked && pick(scene.id, row) });
    }
  }
  if (!shown) list.appendChild(el('div', 'chap-empty', q ? 'Keine Szene passt zu diesem Filter.' : 'Die Chronik ist noch ungeschrieben. Bald gibt es hier Kapitel.'));
  backButton(host, opts, items);
  return new NavList(items);
}
