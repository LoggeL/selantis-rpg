import { G } from '../core/G';
import { findScene, getChapters } from '../core/registry';
import { FLOURISH } from './chapterCard';
import { buildChapterSelect, devMode } from './chapters';
import { ctx } from './context';
import { el, html, sfx } from './dom';
import { NavList, type NavItem } from './nav';
import { buildSettings } from './settings';

export type TitleChoice = 'new' | 'continue' | { warp: string };

/** Colours of the title backdrop (scenes/TitleScene) for the letterbox bars, so they blend in. */
const SKY: [number, string][] = [[0, '#060a1a'], [0.32, '#0b1130'], [0.58, '#18204c'], [0.72, '#2a2a5c'], [0.8, '#3b3060'], [0.875, '#2a2348']];
const GROUND = '#06080f';

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

let starCache: { key: string; url: string } | null = null;

/** A faint star field for the black bars above the canvas (portrait phones), so the sky continues. */
function starField(w: number, h: number): string {
  const key = `${w}x${h}`;
  if (starCache?.key === key) return starCache.url;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  const g = c.getContext('2d')!;
  let seed = 1337;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const n = Math.round((w * h) / 900);
  for (let i = 0; i < n; i++) {
    const x = rnd() * w, y = rnd() * h;
    const fade = Math.min(1, (h - y) / (h * 0.35) + 0.25); // denser/brighter towards the canvas
    const a = (0.15 + rnd() * 0.55) * fade;
    const s = rnd() > 0.97 ? 2 : 1;
    g.fillStyle = `rgba(${rnd() < 0.3 ? '200,212,255' : '168,180,232'},${a.toFixed(2)})`;
    g.fillRect(Math.round(x), Math.round(y), s, s);
  }
  starCache = { key, url: c.toDataURL() };
  return starCache.url;
}

function paintBackdrop(): void {
  const game = document.getElementById('game');
  if (!game) return;
  const { y, h } = ctx.stage;
  const stops = SKY.map(([p, c]) => `${c} ${Math.round(y + p * h)}px`);
  const gradient = `linear-gradient(to bottom, ${SKY[0][1]} 0px, ${stops.join(', ')}, ${GROUND} ${Math.round(y + 0.885 * h)}px, ${GROUND} 100%)`;
  const stars = y > 40 ? `url(${starField(window.innerWidth, y)}) 0 0 / ${window.innerWidth}px ${Math.round(y)}px no-repeat, ` : '';
  game.style.background = stars + gradient;
}

/** Title screen over the Phaser backdrop. Resolves with the player's choice. */
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
    paintBackdrop();
    const offLayout = ctx.onLayout(paintBackdrop);
    requestAnimationFrame(() => root.classList.add('is-in'));
    try { G.audio?.music('refuge', { fadeMs: 2500 }); G.audio?.ambience(['night', 'crickets'], { fadeMs: 2500, volume: { crickets: 0.6 } }); } catch { /* audio optional */ }

    let nav: NavList | null = null;
    let page: 'main' | 'chapters' | 'settings' = 'main';
    let done = false;
    const closeModal = ctx.open({
      id: 'title',
      allowMenu: false,
      onKey: e => {
        if (e.key === 'Escape' && page !== 'main') { sfx('ui-cancel', { volume: 0.5 }); showMain(); return true; }
        return nav?.key(e) ?? false;
      },
    });

    const finish = (choice: TitleChoice) => {
      if (done) return;
      done = true;
      sfx('ui-confirm', { volume: 0.9 });
      closeModal();
      offLayout();
      root.classList.add('is-out');
      try { G.audio?.ambience([], { fadeMs: 1200 }); } catch { /* audio optional */ }
      setTimeout(() => {
        root.remove();
        ctx.root.classList.remove('title-active');
        const game = document.getElementById('game');
        if (game) game.style.background = '';
      }, 700);
      resolve(choice);
    };

    function showMain(): void {
      page = 'main';
      root.classList.remove('is-sub');
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
      add('Einstellungen', () => showSettings());
      menu.appendChild(list);
      nav = new NavList(items);
    }

    function showChapters(): void {
      page = 'chapters';
      sfx('ui-open', { volume: 0.6 });
      root.classList.add('is-sub');
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

    function showSettings(): void {
      page = 'settings';
      sfx('ui-open', { volume: 0.6 });
      root.classList.add('is-sub');
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
