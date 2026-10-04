import { G } from '../core/G';
import { buildChapterSelect } from './chapters';
import { ctx } from './context';
import { el } from './dom';
import type { NavList } from './nav';
import { openOverlay, type OverlayHandle } from './overlay';

/** F2 debug chapter/scene select (always available, includes hidden dev chapters). */
export function openDebug(actions: { warp(id: string): void; toTitle(): void }): OverlayHandle {
  let nav: NavList | null = null;
  const overlay = openOverlay({
    id: 'debug', className: 'debug-ov', title: 'Debug · Szenenwahl', layer: 'debug', closeKeys: ['F2'],
    onKey: e => {
      if (e.target === filter && !e.key.startsWith('Arrow') && e.key !== 'Enter') return false;
      return nav?.key(e) ?? false;
    },
  });
  const info = el('div', 'debug-info');
  const d = G.state.data;
  info.textContent = `Szene: ${G.currentScene || '—'} · HUD: ${ctx.hudMode} · Flags: ${Object.keys(d.flags).length} · Gegenstände: ${Object.keys(d.inventory).length} · Ziele: ${d.objectives.length}`;
  const filter = el('input', 'debug-filter');
  filter.type = 'text';
  filter.placeholder = 'Filtern … (Szenen-ID oder Titel)';
  filter.spellcheck = false;
  const listHost = el('div', 'debug-list');
  const tools = el('div', 'debug-tools');
  const toTitle = el('button', 'menu-item', 'Zum Titel');
  toTitle.type = 'button';
  toTitle.addEventListener('click', () => { overlay.close(); actions.toTitle(); });
  tools.append(toTitle);
  overlay.body.append(info, filter, listHost, tools);

  // Rebuilt from the matching rows only, so arrow keys never land on hidden rows.
  const render = () => {
    nav = buildChapterSelect(listHost, { includeHidden: true, compact: true, filter: filter.value, onPick: id => { overlay.close(); actions.warp(id); } });
  };
  filter.addEventListener('input', render);
  render();
  setTimeout(() => filter.focus(), 30);
  return overlay;
}
