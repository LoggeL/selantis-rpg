// The packing puzzle as a DOM panel in the Chronik style (G.ui.panel). Rules: ./packing.ts.
import { items } from '../../core/catalog';
import { G } from '../../core/G';
import { add, CAPACITY, EXTRAS, FIXED, remove, used, verdict, type Owned, type Selection } from './packing';
import { sfx } from './shared';

const CSS = `
.k1-pack { display: grid; place-items: center; background: rgba(6, 8, 12, 0.72); backdrop-filter: blur(2px); font-family: var(--f-body); animation: k1-fade 0.35s ease-out; }
@keyframes k1-fade { from { opacity: 0; } to { opacity: 1; } }
.k1-pack-card { width: min(46em, 94%); max-height: 94%; overflow: auto; padding: 1.1em 1.3em 1em; color: var(--parch); }
.k1-pack-card h2 { margin: 0; font-size: 1.45em; text-align: center; }
.k1-pack-room { display: flex; justify-content: center; align-items: center; gap: 0.5em; margin: 0.35em 0 0.7em; font-family: var(--f-label); letter-spacing: 0.06em; color: var(--parch-dim); }
.k1-pack-dots { display: inline-flex; gap: 0.25em; }
.k1-pack-dot { width: 0.8em; height: 0.8em; border-radius: 50%; border: 1px solid var(--gold); transition: background 0.2s, transform 0.2s; }
.k1-pack-dot.on { background: var(--gold); box-shadow: 0 0 0.5em rgba(216, 178, 90, 0.6); }
.k1-pack-dot.over { background: var(--danger); border-color: var(--danger); transform: scale(1.2); }
.k1-pack-cols { display: grid; grid-template-columns: 1fr; gap: 0.6em; }
.k1-pack-fixed { padding: 0.45em 0.8em 0.5em; border-radius: var(--radius); font-size: 0.82em; }
.k1-pack-fixed h3, .k1-pack-extras h3 { margin: 0 0 0.35em; font-family: var(--f-label); font-size: 0.95em; letter-spacing: 0.08em; font-weight: 400; }
.k1-pack-fixed ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.2em 0.9em; }
.k1-pack-fixed li { display: flex; align-items: center; gap: 0.3em; }
.k1-pack-fixed img, .k1-pack-item img { width: 1.9em; height: 1.9em; image-rendering: pixelated; flex: none; }
.k1-pack-extras { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4em; align-content: start; }
.k1-pack-extras h3 { grid-column: 1 / -1; }
.k1-pack-item { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 0.55em; padding: 0.45em 0.6em; border-radius: var(--radius);
  border: 1px solid var(--gold-faint); background: rgba(255, 255, 255, 0.03); color: var(--parch); text-align: left; font: inherit; cursor: pointer; transition: border-color 0.15s, background 0.15s, transform 0.15s; }
.k1-pack-item:hover:not(:disabled), .k1-pack-item.is-focus { border-color: var(--gold-line); background: rgba(216, 178, 90, 0.08); }
.k1-pack-item.is-in { border-color: var(--gold); background: linear-gradient(180deg, rgba(216, 178, 90, 0.24), rgba(216, 178, 90, 0.08)); }
.k1-pack-item.is-in .k1-pack-check { opacity: 1; transform: scale(1); }
.k1-pack-item:disabled { opacity: 0.45; cursor: default; }
.k1-pack-item.shake { animation: k1-shake 0.32s; }
@keyframes k1-shake { 25% { transform: translateX(-0.3em); } 75% { transform: translateX(0.3em); } }
.k1-pack-name { font-weight: 700; font-size: 0.95em; }
.k1-pack-note { font-size: 0.8em; color: var(--parch-dim); font-style: italic; line-height: 1.25; }
.k1-pack-size { display: inline-flex; gap: 0.18em; margin-left: 0.4em; vertical-align: middle; }
.k1-pack-size i { width: 0.5em; height: 0.5em; border-radius: 50%; background: var(--gold); display: inline-block; }
.k1-pack-check { width: 1.5em; height: 1.5em; border-radius: 50%; display: grid; place-items: center; background: var(--gold); color: var(--ink); font-weight: 700;
  opacity: 0; transform: scale(0.4); transition: opacity 0.15s, transform 0.2s var(--ease-back); }
.k1-pack-key { font-family: var(--f-label); font-size: 0.7em; color: var(--gold); border: 1px solid var(--gold-faint); border-radius: 0.3em; padding: 0 0.3em; margin-right: 0.3em; }
.k1-pack-thought { min-height: 1.4em; margin: 0.55em 0 0.5em; font-style: italic; color: var(--parch); text-align: center; font-size: 0.95em; }
.k1-pack-actions { display: flex; justify-content: center; gap: 0.8em; }
.k1-pack-actions .ch-btn { font-size: 1em; padding: 0.4em 1.1em; }
@media (max-height: 520px) { .k1-pack-card h2 { font-size: 1.1em; } .k1-pack-room { margin: 0.1em 0 0.3em; } .k1-pack-fixed h3, .k1-pack-extras h3 { display: none; } .k1-pack-thought { margin: 0.3em 0; } .k1-pack-note { display: none; } .k1-pack-card { padding: 0.6em 0.9em; } .k1-pack-fixed li span { font-size: 0.9em; } .k1-pack-item { padding: 0.3em 0.5em; } }
.is-portrait .k1-pack-extras, .k1-pack.narrow .k1-pack-extras { grid-template-columns: 1fr; }
`;

let styled = false;
function style(): void {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const s = document.createElement('style');
  s.id = 'k1-pack-style';
  s.textContent = CSS;
  document.head.appendChild(s);
}

function icon(id: string): string {
  try { return G.art.iconDataUrl(items.get(id)?.icon ?? id); } catch { return ''; }
}
const nameOf = (id: string) => items.get(id)?.name ?? id;

/**
 * Opens the bag panel. Resolves with the chosen extras, or null if Lia closes it without packing.
 * `owned(id)` = how many of an extra are within reach (inventory or on the shelf), `start` = previous selection.
 */
export function openPacking(owned: Owned, start: Selection): Promise<Selection | null> {
  style();
  const root = G.ui.panel('k1-pack');
  if (root.clientWidth && root.clientWidth < 640) root.classList.add('narrow');
  const card = document.createElement('div');
  card.className = 'k1-pack-card ch-panel';
  root.appendChild(card);
  let sel: Selection = { ...start };
  let thought = 'Erst das Nötigste: Brot, Käse, Speck. Was passt noch hinein?';

  // One card per unit (apples can be several).
  const units: { id: string; idx: number }[] = [];
  for (const e of EXTRAS) {
    const n = Math.max(1, owned(e.id));
    for (let i = 0; i < n; i++) units.push({ id: e.id, idx: i });
  }

  return new Promise(resolve => {
    let focus = 0;
    const done = (value: Selection | null) => {
      window.removeEventListener('keydown', onKey, true);
      root.remove();
      resolve(value);
    };
    const toggle = (u: { id: string; idx: number }, btn?: HTMLElement) => {
      const count = sel[u.id] ?? 0;
      if (u.idx < count) {
        sel = remove(sel, u.id);
        sfx('ui-cancel', { volume: 0.6 });
        thought = 'Wieder raus damit.';
      } else {
        const next = add(sel, u.id, owned);
        if (next === sel) {
          sfx('ui-cancel');
          btn?.classList.remove('shake');
          void btn?.offsetWidth;
          btn?.classList.add('shake');
          thought = owned(u.id) <= count ? (EXTRAS.find(e => e.id === u.id)?.missing ?? 'Hab ich nicht.') : 'Das passt nicht mehr hinein. Dann muss etwas anderes raus.';
        } else {
          sel = next;
          sfx('pickup', { volume: 0.5 });
          thought = EXTRAS.find(e => e.id === u.id)?.note ?? '';
        }
      }
      render();
    };
    const openedAt = performance.now();
    const onKey = (e: KeyboardEvent) => {
      if (!root.isConnected) { window.removeEventListener('keydown', onKey, true); return; }
      const k = e.key;
      // The key that opened the bag (E) must not also pick the first item.
      if (performance.now() - openedAt < 300 || e.repeat) { e.preventDefault(); e.stopPropagation(); return; }
      let used_ = true;
      if (/^[1-9]$/.test(k)) { const u = units[Number(k) - 1]; if (u) { focus = Number(k) - 1; toggle(u, card.querySelectorAll<HTMLElement>('.k1-pack-item')[focus]); } }
      else if (k === 'ArrowDown' || k === 's' || k === 'S') { focus = (focus + 1) % (units.length + 1); render(); }
      else if (k === 'ArrowUp' || k === 'w' || k === 'W') { focus = (focus + units.length) % (units.length + 1); render(); }
      else if (k === 'Enter' || k === ' ' || k === 'e' || k === 'E') {
        if (e.repeat) { e.preventDefault(); e.stopPropagation(); return; }
        if (focus >= units.length) finish(); else toggle(units[focus], card.querySelectorAll<HTMLElement>('.k1-pack-item')[focus]);
      } else if (k === 'Escape' || k === 'Backspace') { sfx('ui-close'); done(null); }
      else used_ = false;
      if (used_) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener('keydown', onKey, true);

    const finish = () => {
      sfx('ui-confirm');
      done(sel);
    };

    function render(): void {
      card.textContent = '';
      const h = document.createElement('h2');
      h.className = 'ch-title';
      h.textContent = 'Der Lederbeutel';
      card.appendChild(h);
      const room = document.createElement('div');
      room.className = 'k1-pack-room';
      const u = used(sel);
      room.innerHTML = `<span>Platz für Zusätzliches</span>`;
      const dots = document.createElement('span');
      dots.className = 'k1-pack-dots';
      for (let i = 0; i < CAPACITY; i++) {
        const d = document.createElement('i');
        d.className = `k1-pack-dot${i < u ? ' on' : ''}`;
        dots.appendChild(d);
      }
      room.appendChild(dots);
      room.insertAdjacentHTML('beforeend', `<span>${u} / ${CAPACITY}</span>`);
      card.appendChild(room);

      const cols = document.createElement('div');
      cols.className = 'k1-pack-cols';
      const fixed = document.createElement('div');
      fixed.className = 'k1-pack-fixed ch-parch';
      fixed.innerHTML = '<h3>Fest eingepackt</h3>';
      const ul = document.createElement('ul');
      for (const f of FIXED) {
        const li = document.createElement('li');
        li.innerHTML = `<img alt="" src="${icon(f.id)}"><span>${nameOf(f.id)}${f.n > 1 ? ` ×${f.n}` : ''}</span>`;
        ul.appendChild(li);
      }
      fixed.appendChild(ul);
      const extras = document.createElement('div');
      extras.className = 'k1-pack-extras';
      extras.innerHTML = '<h3>Was nehme ich noch mit?</h3>';
      units.forEach((unit, i) => {
        const e = EXTRAS.find(x => x.id === unit.id)!;
        const avail = owned(unit.id) > unit.idx;
        const isIn = unit.idx < (sel[unit.id] ?? 0);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `k1-pack-item${isIn ? ' is-in' : ''}${focus === i ? ' is-focus' : ''}`;
        b.dataset.item = unit.id;
        b.disabled = !avail;
        const size = Array.from({ length: e.size }, () => '<i></i>').join('');
        b.innerHTML = `<img alt="" src="${icon(unit.id)}"><span><span class="k1-pack-name"><span class="k1-pack-key">${i + 1}</span>${nameOf(unit.id)}<span class="k1-pack-size" title="Platz">${size}</span></span><br><span class="k1-pack-note">${avail ? e.note : (e.missing ?? '')}</span></span><span class="k1-pack-check">✓</span>`;
        b.addEventListener('click', () => { focus = i; toggle(unit, b); });
        extras.appendChild(b);
      });
      cols.append(fixed, extras);
      card.appendChild(cols);

      const t = document.createElement('div');
      t.className = 'k1-pack-thought';
      t.textContent = `„${thought}“`;
      card.appendChild(t);

      const actions = document.createElement('div');
      actions.className = 'k1-pack-actions';
      const later = document.createElement('button');
      later.type = 'button';
      later.className = 'ch-btn';
      later.textContent = 'Später';
      later.addEventListener('click', () => { sfx('ui-close'); done(null); });
      const ok = document.createElement('button');
      ok.type = 'button';
      ok.className = `ch-btn k1-pack-done${focus >= units.length ? ' is-sel' : ''}`;
      ok.textContent = 'Beutel schnüren';
      ok.addEventListener('click', finish);
      actions.append(later, ok);
      card.appendChild(actions);
    }
    render();
  });
}

/** Lia's thoughts after closing the bag. */
export function packingVerdict(sel: Selection): string[] { return verdict(sel); }
