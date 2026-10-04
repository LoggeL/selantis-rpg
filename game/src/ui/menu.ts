import { FLOURISH } from './chapterCard';
import { buildChapterSelect, devMode } from './chapters';
import { el, html, sfx } from './dom';
import { NavList, type NavItem } from './nav';
import { openOverlay, type OverlayHandle } from './overlay';
import { buildSettings } from './settings';

export interface MenuActions {
  journal(): void;
  bag(): void;
  warp(sceneId: string): void;
  toTitle(): void;
  debug(): boolean;
}

/** Pause menu (Esc): Fortsetzen, Tagebuch, Tasche, Einstellungen, Kapitel wählen, Zum Titel. */
export function openMenu(actions: MenuActions): OverlayHandle {
  let page: 'main' | 'settings' | 'chapters' = 'main';
  let nav: NavList | null = null;
  /** Selection on the main page survives a visit to a sub page. */
  let mainIndex = 0;
  const overlay = openOverlay({
    id: 'menu', className: 'menu-ov',
    onKey: e => nav?.key(e) ?? false,
    onEscape: () => { if (page !== 'main') { showMain(); return false; } return true; },
  });
  const head = el('div', 'menu-head');
  const title = el('h2', 'menu-title', 'Pause');
  head.append(title, html('div', 'menu-orn', FLOURISH));
  const content = el('div', 'menu-content');
  overlay.body.append(head, content);

  function showMain(): void {
    page = 'main';
    title.textContent = 'Pause';
    overlay.panel.classList.remove('is-wide');
    content.textContent = '';
    let confirmTitle = false;
    const list = el('div', 'menu-list');
    const items: NavItem[] = [];
    const add = (label: string, fn: (b: HTMLButtonElement) => void, cls = '') => {
      const b = el('button', `menu-item ${cls}`, label);
      b.type = 'button';
      list.appendChild(b);
      items.push({ el: b, activate: () => fn(b) });
    };
    add('Fortsetzen', () => overlay.close());
    add('Tagebuch', () => { overlay.close(); actions.journal(); });
    add('Tasche', () => { overlay.close(); actions.bag(); });
    add('Einstellungen', () => showSettings());
    add('Kapitel wählen', () => showChapters());
    add('Zum Titel', b => {
      if (!confirmTitle) {
        confirmTitle = true;
        b.classList.add('is-confirm');
        b.textContent = 'Wirklich? Nochmal bestätigen';
        b.appendChild(el('span', 'menu-item-note', 'Fortschritt seit dem letzten Szenenbeginn geht verloren.'));
        sfx('ui-cancel', { volume: 0.6 });
        return;
      }
      overlay.close();
      actions.toTitle();
    }, 'is-danger');
    content.appendChild(list);
    nav = new NavList(items, { start: mainIndex, onSelect: i => { mainIndex = i; } });
  }

  function showSettings(): void {
    page = 'settings';
    title.textContent = 'Einstellungen';
    overlay.panel.classList.add('is-wide');
    sfx('ui-confirm', { volume: 0.5 });
    nav = buildSettings(content, () => { sfx('ui-cancel', { volume: 0.5 }); showMain(); });
  }

  function showChapters(): void {
    page = 'chapters';
    title.textContent = 'Kapitel wählen';
    overlay.panel.classList.add('is-wide');
    sfx('ui-confirm', { volume: 0.5 });
    nav = buildChapterSelect(content, {
      includeHidden: devMode() || actions.debug(),
      onPick: id => { overlay.close(); actions.warp(id); },
      onBack: () => { sfx('ui-cancel', { volume: 0.5 }); showMain(); },
    });
  }

  showMain();
  return overlay;
}
