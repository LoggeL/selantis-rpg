import { items } from '../core/catalog';
import { G } from '../core/G';
import { ctx, isConfirm } from './context';
import { el, icon, sfx } from './dom';
import { NavList, type NavItem } from './nav';
import { openOverlay, type OverlayHandle } from './overlay';

function iconUrl(id: string): string {
  try { return G.art?.iconDataUrl(id) ?? ''; } catch { return ''; }
}

/** What happens when the player uses an item from the bag (see UiApiExt.registerItemAction). */
export interface ItemAction {
  /** Button label, default „Benutzen“. */
  label?: string;
  /** Whether the item can be used right now (default: always). False shows the button disabled. */
  when?: () => boolean;
  /** Line shown when `when()` is false (default: „Das kann ich hier nicht gebrauchen.“). */
  reason?: string;
  run: () => void | Promise<void>;
  /** Close the bag before running (default true). */
  closeBag?: boolean;
}

const actions = new Map<string, ItemAction>();
const NOT_HERE = 'Das kann ich hier nicht gebrauchen.';

export function registerItemAction(itemId: string, action: ItemAction): void { actions.set(itemId, action); }

/** Lia's leather bag: item grid with pixel icons, description, Lia's comment and an optional use action. */
export function openBag(): OverlayHandle {
  const entries = Object.entries(G.state.data.inventory).filter(([, n]) => n > 0);
  const columns = ctx.portrait ? 4 : 5;
  const grid = el('div', 'bag-grid');
  grid.style.setProperty('--cols', String(columns));
  const detail = el('div', 'bag-detail ch-parch');
  let nav: NavList | null = null;
  let current: string | undefined;
  let busy = false;

  const overlay = openOverlay({
    id: 'bag', className: 'bag-ov', title: 'Lias Tasche', closeKeys: ['i', 'I'],
    onKey: e => {
      if (isConfirm(e) && !e.repeat) { use(); return true; }
      return nav?.key(e) ?? false;
    },
  });
  const wrap = el('div', 'bag-wrap');
  wrap.append(grid, detail);
  overlay.body.appendChild(wrap);
  overlay.body.appendChild(el('div', 'jr-help', '↑ ↓ ← → auswählen · Enter benutzen · Esc schließen'));

  const canUse = (a: ItemAction | undefined) => {
    if (!a) return false;
    try { return a.when ? a.when() : true; } catch { return false; }
  };

  /** Lia's short remark in the detail pane (no action / not usable here). */
  const remark = (text: string) => {
    detail.querySelector('.bag-remark')?.remove();
    const r = el('div', 'bag-remark');
    r.append(icon('quill', 'ch-ico bag-comment-ico'), el('span', '', text));
    detail.appendChild(r);
  };

  function use(): void {
    if (!current || busy) return;
    const action = actions.get(current);
    if (!action || !canUse(action)) {
      sfx('ui-cancel', { volume: 0.6 });
      remark(action?.reason ?? NOT_HERE);
      return;
    }
    busy = true;
    sfx('ui-confirm', { volume: 0.7 });
    const run = () => {
      try {
        const p = action.run();
        if (p) p.catch(err => console.error('[ui] item action failed', err));
      } catch (err) { console.error('[ui] item action failed', err); }
    };
    if (action.closeBag !== false) { overlay.close(); run(); }
    else { run(); busy = false; setTimeout(() => { if (!overlay.closed && current) show(current, G.state.count(current)); }, 60); }
  }

  const show = (id: string | undefined, count = 0) => {
    current = id;
    detail.textContent = '';
    detail.classList.remove('is-anim');
    void detail.offsetWidth;
    detail.classList.add('is-anim');
    if (!id) {
      detail.append(el('div', 'jr-empty-orn', '❦'), el('p', 'jr-empty', 'Die Tasche ist leer.'));
      return;
    }
    const def = items.get(id);
    const top = el('div', 'bag-detail-top');
    const big = el('div', 'bag-detail-icon');
    const url = iconUrl(def?.icon ?? id);
    if (url) { const img = el('img', 'px'); img.src = url; img.alt = ''; big.appendChild(img); } else big.appendChild(icon('item'));
    const name = el('div', 'bag-detail-name', def?.name ?? id);
    if (count > 1) name.appendChild(el('span', 'bag-detail-count', ` ×${count}`));
    top.append(big, name);
    detail.appendChild(top);
    detail.appendChild(el('p', 'bag-detail-desc', def?.description ?? ''));
    if (def?.comment) {
      const c = el('div', 'bag-comment');
      c.append(icon('quill', 'ch-ico bag-comment-ico'), el('span', '', def.comment));
      detail.appendChild(c);
    }
    const action = actions.get(id);
    if (action) {
      const row = el('div', 'bag-actions');
      const btn = el('button', 'ch-btn bag-use');
      btn.type = 'button';
      const usable = canUse(action);
      btn.classList.toggle('is-disabled', !usable);
      const key = el('span', 'ch-key bag-use-key');
      if (ctx.root.classList.contains('is-touch')) key.appendChild(icon('hand')); else key.textContent = 'E';
      btn.append(key, el('span', '', action.label ?? 'Benutzen'));
      btn.addEventListener('click', e => { e.stopPropagation(); use(); });
      row.appendChild(btn);
      detail.appendChild(row);
    }
  };

  const slots = Math.max(entries.length, columns * 3);
  const navItems: NavItem[] = [];
  for (let i = 0; i < slots; i++) {
    const slot = el('button', 'bag-slot');
    slot.type = 'button';
    const entry = entries[i];
    if (entry) {
      const [id, n] = entry;
      const def = items.get(id);
      const url = iconUrl(def?.icon ?? id);
      if (url) { const img = el('img', 'px'); img.src = url; img.alt = def?.name ?? id; slot.appendChild(img); } else slot.appendChild(icon('item'));
      if (n > 1) slot.appendChild(el('span', 'bag-count', String(n)));
      if (actions.has(id)) slot.appendChild(el('span', 'bag-usable'));
      slot.title = def?.name ?? id;
      const k = navItems.length;
      // Tapping a slot selects it; tapping the selected slot again uses the item.
      navItems.push({ el: slot, activate: () => { if (nav?.index === k && selectedBefore === k) use(); } });
    } else {
      slot.classList.add('is-empty');
      slot.tabIndex = -1;
    }
    grid.appendChild(slot);
  }
  let selectedBefore = -1;
  grid.addEventListener('pointerdown', () => { selectedBefore = nav?.index ?? -1; }, true);
  nav = new NavList(navItems, { columns, onSelect: k => show(entries[k][0], entries[k][1]) });
  if (!entries.length) show(undefined);
  return overlay;
}
