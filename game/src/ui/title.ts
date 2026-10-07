import { G } from '../core/G';
import { findScene, getChapters } from '../core/registry';
import { FLOURISH } from './chapterCard';
import { buildChapterSelect, devMode } from './chapters';
import { ctx } from './context';
import { el, html, sfx } from './dom';
import { buildGallery, type GalleryCtl } from './gallery';
import { NavList, type NavItem } from './nav';
import { buildSettings } from './settings';
import { cheatInput, everythingUnlocked, unlockEverything } from './unlocks';

export type TitleChoice = 'new' | 'continue' | { warp: string };

/**
 * The save offered as „Fortsetzen“. Saves made in hidden dev chapters (?scene=…, F2 warps) are ignored
 * unless dev mode is on, so a test visit never poses as the player's campaign.
 */
export function savedScene(): { scene: string; label: string; hidden: boolean } | null {
  try {
    const raw = localStorage.getItem('selantis.save.v1');
    if (!raw) return null;
    const data = JSON.parse(raw) as { scene?: string; savedAt?: string };
    const found = data.scene ? findScene(data.scene) : undefined;
    if (!found) return null;
    if (found.chapter.hidden && !devMode()) return null;
    const num = found.chapter.numeral;
    return { scene: found.scene.id, hidden: Boolean(found.chapter.hidden), label: `${/^[IVXLCDM]+$/.test(num) ? `Kapitel ${num}` : num} · ${found.scene.title}` };
  } catch { return null; }
}

/** Title screen over the painted backdrop (ui/titleBackdrop.ts). Resolves with the player's choice. */
export function showTitle(): Promise<TitleChoice> {
  return new Promise(resolve => {
    const root = el('div', 'title');
    const logo = el('div', 'title-logo');
    logo.append(
      el('div', 'title-kicker', 'Die Chroniken von'),
      el('h1', 'title-name', 'Selantis'),
      html('div', 'title-orn', FLOURISH),
      el('div', 'title-sub', 'Das Buch der Schwestern'),
    );
    const menu = el('div', 'title-menu');
    const foot = el('div', 'title-foot', ctx.root.classList.contains('is-touch') ? 'Tippen zum Auswählen' : '↑ ↓ wählen · Enter bestätigen');
    root.append(logo, menu, foot);
    ctx.layers.title.appendChild(root);
    ctx.root.classList.add('title-active');
    requestAnimationFrame(() => root.classList.add('is-in'));
    try { G.audio?.music('refuge', { fadeMs: 2500 }); G.audio?.ambience(['night', 'crickets'], { fadeMs: 2500, volume: { crickets: 0.6 } }); } catch { /* audio optional */ }

    let nav: NavList | null = null;
    let page: 'main' | 'chapters' | 'settings' | 'gallery' = 'main';
    let gallery: GalleryCtl | null = null;
    let done = false;
    const closeModal = ctx.open({
      id: 'title',
      allowMenu: false,
      onKey: e => {
        if (cheat(e)) { unlockAll(); return true; }
        if (page === 'gallery' && gallery?.key(e)) return true;
        if (e.key === 'Escape' && page !== 'main') { sfx('ui-cancel', { volume: 0.5 }); showMain(); return true; }
        return nav?.key(e) ?? false;
      },
    });

    // Cheat: ↑ ↑ ↓ ↓ ← → ← → B A, or seven taps on the logo, opens every chapter and gallery picture.
    const cheat = cheatInput();
    let taps = 0, tapAt = 0;
    logo.addEventListener('pointerdown', () => {
      const now = performance.now();
      taps = now - tapAt < 700 ? taps + 1 : 1;
      tapAt = now;
      if (taps >= 7) { taps = 0; unlockAll(); }
    });
    function unlockAll(): void {
      if (everythingUnlocked()) { G.ui.toast('Schon alles freigeschaltet.', 'info'); return; }
      unlockEverything();
      sfx('ui-confirm', { volume: 1 });
      G.ui.toast('Alle Kapitel und die ganze Galerie sind freigeschaltet.', 'info');
      if (page === 'chapters') showChapters();
      else if (page === 'gallery') showGallery();
    }

    const finish = (choice: TitleChoice) => {
      if (done) return;
      done = true;
      sfx('ui-confirm', { volume: 0.9 });
      closeModal();
      root.classList.add('is-out');
      try { G.audio?.ambience([], { fadeMs: 1200 }); } catch { /* audio optional */ }
      setTimeout(() => {
        root.remove();
        ctx.root.classList.remove('title-active', 'title-subpage');
      }, 700);
      resolve(choice);
    };

    function showMain(): void {
      page = 'main';
      root.classList.remove('is-sub');
      ctx.root.classList.remove('title-subpage');
      menu.textContent = '';
      const list = el('div', 'title-list');
      const items: NavItem[] = [];
      const save = savedScene();
      const hasChapter = getChapters().some(c => !c.hidden && c.scenes.length);
      let confirmNew = false;
      const add = (label: string, fn: (b: HTMLButtonElement) => void, note?: string) => {
        const b = el('button', 'title-item');
        b.type = 'button';
        b.appendChild(el('span', 'title-item-label', label));
        if (note) b.appendChild(el('span', 'title-item-note', note));
        b.style.animationDelay = `${900 + items.length * 110}ms`;
        list.appendChild(b);
        items.push({ el: b, activate: () => fn(b) });
      };
      if (save) add('Fortsetzen', () => finish('continue'), save.label);
      add('Neues Spiel', b => {
        if (!hasChapter) {
          sfx('ui-cancel', { volume: 0.6 });
          G.ui.toast('Das erste Kapitel wird gerade noch geschrieben.', 'info');
          return;
        }
        if (save && !confirmNew) {
          confirmNew = true;
          b.classList.add('is-confirm');
          (b.firstElementChild as HTMLElement).textContent = 'Neues Spiel – sicher?';
          const note = b.querySelector('.title-item-note') ?? b.appendChild(el('span', 'title-item-note'));
          note.textContent = 'Der Spielstand wird beim Start überschrieben.';
          sfx('ui-cancel', { volume: 0.5 });
          return;
        }
        finish('new');
      });
      add('Kapitel', () => showChapters());
      add('Galerie', () => showGallery());
      add('Einstellungen', () => showSettings());
      menu.appendChild(list);
      nav = new NavList(items);
    }

    function showChapters(): void {
      page = 'chapters';
      sfx('ui-open', { volume: 0.6 });
      root.classList.add('is-sub');
      ctx.root.classList.add('title-subpage');
      menu.textContent = '';
      const panel = el('div', 'title-panel ch-panel');
      panel.appendChild(el('h2', 'title-panel-head', 'Kapitel'));
      const body = el('div', 'title-panel-body');
      panel.appendChild(body);
      menu.appendChild(panel);
      const save = savedScene();
      nav = buildChapterSelect(body, {
        includeHidden: devMode(),
        onPick: id => finish({ warp: id }),
        // A campaign save would be overwritten by the warp: ask once (pick the same row again to confirm).
        confirm: () => (save && !save.hidden ? 'Nochmal wählen – der Spielstand wird überschrieben.' : null),
        onBack: () => { sfx('ui-cancel', { volume: 0.5 }); showMain(); },
      });
    }

    function showGallery(): void {
      page = 'gallery';
      nav = null;
      sfx('ui-open', { volume: 0.6 });
      root.classList.add('is-sub');
      ctx.root.classList.add('title-subpage');
      menu.textContent = '';
      const panel = el('div', 'title-panel ch-panel gal-panel');
      panel.appendChild(el('h2', 'title-panel-head', 'Galerie'));
      const body = el('div', 'title-panel-body');
      panel.appendChild(body);
      menu.appendChild(panel);
      gallery = buildGallery(body, () => { sfx('ui-cancel', { volume: 0.5 }); showMain(); });
    }

    function showSettings(): void {
      page = 'settings';
      sfx('ui-open', { volume: 0.6 });
      root.classList.add('is-sub');
      ctx.root.classList.add('title-subpage');
      menu.textContent = '';
      const panel = el('div', 'title-panel ch-panel');
      panel.appendChild(el('h2', 'title-panel-head', 'Einstellungen'));
      const body = el('div', 'title-panel-body');
      panel.appendChild(body);
      menu.appendChild(panel);
      nav = buildSettings(body, () => { sfx('ui-cancel', { volume: 0.5 }); showMain(); });
    }

    showMain();
  });
}
